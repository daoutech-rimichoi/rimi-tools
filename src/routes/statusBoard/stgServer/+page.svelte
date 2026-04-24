<script>
    import { onMount, onDestroy } from 'svelte';
    import { supabase } from '$lib/supabaseClient.js';
    import { USER_NAMES } from '$lib/config/users.js';

    const users = USER_NAMES;

    let servers = [];
    let serverStatus = {};
    let isLoading = true;
    let toastMessage = '';
    let showToast = false;
    let toastType = 'error'; // 'error' or 'success'
    let showRefreshAlert = false;
    let subscription = null;
    let lastSavedAt = null;

    // Toast 표시 함수
    function showToastMessage(message, type = 'error') {
        toastMessage = message;
        toastType = type;
        showToast = true;
        setTimeout(() => {
            showToast = false;
        }, 3000);
    }

    // 새로고침 알림 표시 함수
    function showRefreshNotification() {
        showRefreshAlert = true;
    }

    // 새로고침 실행 함수
    function handleRefresh() {
        showRefreshAlert = false;
        loadServerStatus();
    }

    // 실시간 구독 설정
    function setupRealtimeSubscription() {
        subscription = supabase
            .channel('server_status_stg_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'server_status',
                    filter: 'env_type=eq.stg'
                },
                (payload) => {
                    console.log('DB 변경 감지:', payload);
                    // 본인이 저장한 경우 알림 무시 (2초 이내)
                    if (lastSavedAt && Date.now() - lastSavedAt < 2000) {
                        return;
                    }
                    showRefreshNotification();
                }
            )
            .subscribe();
    }

    onMount(async () => {
        await loadServerStatus();
        setupRealtimeSubscription();
    });

    onDestroy(() => {
        if (subscription) {
            supabase.removeChannel(subscription);
        }
    });

    async function loadServerStatus() {
        isLoading = true;
        try {
            const { data, error } = await supabase
                .from('server_status')
                .select('service_name, environment_name, url, in_use, assigned_to, updated_at, display_order')
                .eq('env_type', 'stg')
                .order('display_order', { ascending: true })
                .order('service_name', { ascending: true })
                .order('environment_name', { ascending: true });

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading server status:', error);
            } else if (data && data.length > 0) {
                // servers 배열 구성
                const serviceMap = new Map();
                data.forEach(item => {
                    if (!serviceMap.has(item.service_name)) {
                        serviceMap.set(item.service_name, []);
                    }
                    serviceMap.get(item.service_name).push({
                        name: item.environment_name,
                        url: item.url
                    });
                });
                
                servers = Array.from(serviceMap.entries()).map(([service, environments]) => ({
                    service,
                    environments
                }));

                // serverStatus 구성
                serverStatus = {};
                data.forEach(item => {
                    const key = getServerKey(item.service_name, item.environment_name);
                    serverStatus[key] = {
                        inUse: item.in_use,
                        assignedTo: item.assigned_to || '',
                        updatedAt: item.updated_at
                    };
                });
            }
        } catch (err) {
            console.error('Failed to load server status:', err);
        } finally {
            isLoading = false;
        }
    }



    function getServerKey(serviceName, envName) {
        return `${serviceName}_${envName}`;
    }

    async function toggleInUse(serviceName, envName, event) {
        const key = getServerKey(serviceName, envName);
        if (!serverStatus[key]) {
            serverStatus[key] = { inUse: false, assignedTo: '', updatedAt: null };
        }
        
        // 사용중으로 변경하려고 할 때 사용자 선택 확인
        if (!serverStatus[key].inUse && !serverStatus[key].assignedTo) {
            event.preventDefault();
            showToastMessage('사용자를 먼저 선택해주세요.');
            return;
        }
        
        serverStatus[key].inUse = !serverStatus[key].inUse;
        
        // 사용중(true)으로 변경 시 실발송 주의 메시지
        if (serverStatus[key].inUse) {
            showToastMessage('🚨실발송 주의🚨', 'success');
        }
        
        // 사용가능(false)으로 변경 시 사용자 리셋
        if (!serverStatus[key].inUse) {
            serverStatus[key].assignedTo = '';
        }
        
        serverStatus = { ...serverStatus };
        
        // DB에 즉시 저장
        await saveToDb(serviceName, envName);
    }

    async function updateAssignedTo(serviceName, envName, user) {
        const key = getServerKey(serviceName, envName);
        if (!serverStatus[key]) {
            serverStatus[key] = { inUse: false, assignedTo: '', updatedAt: null };
        }
        serverStatus[key].assignedTo = user;
        
        // 사용자 변경 시 사용여부 자동으로 false로 변경
        if (serverStatus[key].inUse) {
            serverStatus[key].inUse = false;
        }
        
        serverStatus = { ...serverStatus };
    }

    async function saveToDb(serviceName, envName) {
        lastSavedAt = Date.now();
        try {
            const key = getServerKey(serviceName, envName);
            const status = serverStatus[key] || { inUse: false, assignedTo: '', updatedAt: null };
            const env = servers
                .find(s => s.service === serviceName)
                ?.environments.find(e => e.name === envName);
            
            if (!env) return;

            const now = new Date().toISOString();

            const { error } = await supabase
                .from('server_status')
                .upsert({
                    env_type: 'stg',
                    service_name: serviceName,
                    environment_name: envName,
                    url: env.url,
                    in_use: status.inUse,
                    assigned_to: status.assignedTo,
                    updated_at: now
                }, { onConflict: 'env_type,service_name,environment_name' });

            if (error) {
                console.error('Error saving:', error);
                showToastMessage('저장 중 오류가 발생했습니다.');
            } else {
                serverStatus[key].updatedAt = now;
                serverStatus = { ...serverStatus };
            }
        } catch (err) {
            console.error('Failed to save:', err);
            showToastMessage('저장 중 오류가 발생했습니다.');
        }
    }
</script>

<div class="container mx-auto p-4">
	<div class="mb-8 text-center bg-gradient-to-r from-green-500 to-emerald-600 text-white py-8 rounded-2xl shadow-2xl">
		<h1 class="text-4xl font-bold mb-2">🧨 검수장비 현황판 🧨</h1>
		<p class="text-lg opacity-90">검수장비는 항시 실발송 주의!!</p>
	</div>

    {#if isLoading}
        <div class="flex flex-col items-center justify-center py-24 gap-4">
            <span class="loading loading-bars loading-lg text-primary"></span>
            <p class="text-sm opacity-60">데이터를 불러오는 중입니다...</p>
        </div>
    {:else}
        <div class="space-y-6">
            {#each servers as service, index}
                {#if index > 0}
                    <div class="divider"></div>
                {/if}
                <div class="card bg-base-100 shadow-xl">
                    <div class="card-body">
                        <h2 class="card-title text-2xl">{service.service}</h2>
                        <div class="overflow-x-auto">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th class="w-1/6">환경</th>
                                        <th class="w-1/4">사용자</th>
                                        <th class="w-1/3">사용여부</th>
                                        <th class="w-1/4">수정일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each service.environments as env}
                                        {@const key = getServerKey(service.service, env.name)}
                                        {@const status = serverStatus[key] || { inUse: false, assignedTo: '', updatedAt: null }}
                                        <tr>
                                            <td class="font-semibold">
                                                {#if env.url}
                                                    <a
                                                        href={env.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="link"
                                                    >
                                                        {env.name}
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            class="inline h-4 w-4"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                stroke-width="2"
                                                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                            />
                                                        </svg>
                                                    </a>
                                                {:else}
                                                    {env.name}
                                                {/if}
                                            </td>
                                            <td>
                                                <select
                                                    class="select select-bordered w-full max-w-xs {status.assignedTo ? 'select-success' : ''}"
                                                    value={status.assignedTo}
                                                    on:change={(e) => updateAssignedTo(service.service, env.name, e.target.value)}
                                                >
                                                    <option value="">사용자 선택</option>
                                                    {#each users as user}
                                                        <option value={user}>{user}</option>
                                                    {/each}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    class="toggle toggle-success"
                                                    checked={status.inUse}
                                                    on:click={(e) => toggleInUse(service.service, env.name, e)}
                                                />
                                                <span class="ml-2 {status.inUse ? 'text-success font-semibold' : 'text-base-content/50'}">
                                                    {status.inUse ? '사용중' : '사용가능'}
                                                </span>
                                            </td>
                                            <td class="text-sm text-base-content/70">
                                                {#if status.updatedAt}
                                                    {new Date(status.updatedAt).toLocaleString('ko-KR', { 
                                                        year: 'numeric', 
                                                        month: '2-digit', 
                                                        day: '2-digit', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                {:else}
                                                    -
                                                {/if}
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Toast Notification -->
    {#if showToast}
        <div class="toast toast-top toast-end z-50">
            <div class="alert alert-{toastType}">
                <span>{toastMessage}</span>
            </div>
        </div>
    {/if}

    <!-- 새로고침 알림 -->
    {#if showRefreshAlert}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="alert alert-warning max-w-md shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                    <h3 class="font-bold">데이터가 변경되었습니다!</h3>
                    <div class="text-sm">다른 사용자가 상태를 변경했습니다.<br/>새로고침해주세요.</div>
                </div>
                <button class="btn btn-primary btn-sm" on:click={handleRefresh}>새로고침</button>
            </div>
        </div>
    {/if}
</div>

<style>
    .table th {
        background-color: hsl(var(--b3));
    }
</style>
