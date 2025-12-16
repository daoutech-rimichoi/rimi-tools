<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabaseClient.js';
    import { USER_NAMES } from '$lib/config/users.js';

    const users = USER_NAMES;

    const servers = [
        {
            service: '비즈뿌리오 웹',
            environments: [
                { name: 'test0', url: 'https://dev.bizppurio.com:14119/' },
                { name: 'test1', url: 'https://dev-test1.bizppurio.com:14119/' },
                { name: 'test2', url: 'https://dev-test2.bizppurio.com:14119/' }
            ]
        },
        {
            service: '비즈뿌리오 배치',
            environments: [
                { name: 'test0', url: '' },
                { name: 'test1', url: '' },
                { name: 'test2', url: '' }
            ]
        },
        {
            service: 'KAPI',
            environments: [
                { name: 'test', url: '' }
            ]
        },
        {
            service: '영업관리시스템',
            environments: [
                { name: 'test0', url: 'https://dev-bizsales.ppurio.com:14110/login.do' },
                { name: 'test1', url: 'https://dev-bizsales-test1.ppurio.com:14110/login.do' }
            ]
        },
        {
            service: '유핏',
            environments: [
                { name: 'test', url: 'https://dev.ufit.co.kr:6261/' }
            ]
        }
    ];

    let serverStatus = {};
    let isLoading = true;
    let toastMessage = '';
    let showToast = false;

    // Toast 표시 함수
    function showToastMessage(message) {
        toastMessage = message;
        showToast = true;
        setTimeout(() => {
            showToast = false;
        }, 3000);
    }

    onMount(async () => {
        await loadServerStatus();
    });

    async function loadServerStatus() {
        isLoading = true;
        try {
            const { data, error } = await supabase
                .from('server_status')
                .select('service_name, environment_name, in_use, assigned_to, updated_at')
                .eq('env_type', 'dev');

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading server status:', error);
                initializeServerStatus();
            } else if (data && data.length > 0) {
                serverStatus = {};
                data.forEach(item => {
                    const key = getServerKey(item.service_name, item.environment_name);
                    serverStatus[key] = {
                        inUse: item.in_use,
                        assignedTo: item.assigned_to || '',
                        updatedAt: item.updated_at
                    };
                });
            } else {
                initializeServerStatus();
            }
        } catch (err) {
            console.error('Failed to load server status:', err);
            initializeServerStatus();
        } finally {
            isLoading = false;
        }
    }

    function initializeServerStatus() {
        serverStatus = {};
        servers.forEach(service => {
            service.environments.forEach(env => {
                const key = `${service.service}_${env.name}`;
                serverStatus[key] = {
                    inUse: false,
                    assignedTo: '',
                    updatedAt: null
                };
            });
        });
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
        
        const previousAssignedTo = serverStatus[key].assignedTo;
        serverStatus[key].assignedTo = user;
        
        // 사용자 변경 시 사용여부 자동으로 false로 변경
        if (serverStatus[key].inUse) {
            serverStatus[key].inUse = false;
        }
        
        serverStatus = { ...serverStatus };
        
        // "사용자 선택" (빈 값)으로 변경한 경우에만 DB 저장
        if (user === '' && previousAssignedTo !== '') {
            await saveToDb(serviceName, envName);
        }
    }

    async function saveToDb(serviceName, envName) {
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
                    env_type: 'dev',
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

<div class="container mx-auto p-6">
    <div class="mb-8 text-center bg-gradient-to-r from-blue-500 to-purple-600 text-white py-8 rounded-2xl shadow-2xl">
        <h1 class="text-4xl font-bold mb-2">🔫 개발장비 현황판 🔫</h1>
        <p class="text-lg opacity-90">싸우지 말고 사용합시다~</p>
    </div>

    {#if isLoading}
        <div class="flex justify-center p-12">
            <span class="loading loading-spinner loading-lg"></span>
        </div>
    {:else}
        <div class="space-y-6">
            {#each servers as service, index}
                <div class="card bg-base-100 shadow-2xl border-2 border-base-300 hover:shadow-3xl transition-all duration-300">
                    <div class="card-body">
                        <h2 class="card-title text-2xl mb-4 pb-2 border-b-2 border-primary">
                            <span class="badge badge-primary badge-lg mr-2">{service.service}</span>
                        </h2>
                        <div class="overflow-x-auto">
                            <table class="table table-zebra">
                                <thead>
                                    <tr class="bg-base-300">
                                        <th class="w-1/6 text-base">환경</th>
                                        <th class="w-1/4 text-base">사용자</th>
                                        <th class="w-1/3 text-base">사용여부</th>
                                        <th class="w-1/4 text-base">수정일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each service.environments as env}
                                        {@const key = getServerKey(service.service, env.name)}
                                        {@const status = serverStatus[key] || { inUse: false, assignedTo: '', updatedAt: null }}
                                        <tr class="{status.inUse ? 'bg-success/10 hover:bg-success/20' : 'hover:bg-base-200'} transition-colors duration-200">
                                            <td class="font-bold text-base">
                                                {#if env.url}
                                                    <a
                                                        href={env.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="link link-primary text-lg hover:text-primary-focus"
                                                    >
                                                        🔗 {env.name}
                                                    </a>
                                                {:else}
                                                    <span class="text-lg">📦 {env.name}</span>
                                                {/if}
                                            </td>
                                            <td>
                                                <select
                                                    class="select select-bordered w-full font-semibold {status.assignedTo ? 'select-success' : ''}"
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
                                                <div class="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        class="toggle toggle-success toggle-lg"
                                                        checked={status.inUse}
                                                        on:click={(e) => toggleInUse(service.service, env.name, e)}
                                                    />
                                                    <div class="flex items-center gap-2">
                                                        {#if status.inUse}
																													사용중
                                                        {:else}
                                                          사용가능
                                                        {/if}
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="text-sm font-medium">
                                                {#if status.updatedAt}
                                                    <div class="flex items-center gap-1 text-base-content/80">
                                                        {new Date(status.updatedAt).toLocaleString('ko-KR', {
                                                            month: '2-digit', 
                                                            day: '2-digit', 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </div>
                                                {:else}
                                                    <span class="text-base-content/40">-</span>
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
            <div class="alert alert-error">
                <span>{toastMessage}</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .table th {
        background-color: hsl(var(--b3));
        font-weight: 700;
    }
    
    .shadow-3xl {
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .badge-lg {
        padding: 0.75rem 1rem;
        font-size: 0.95rem;
    }
    
    .toggle-lg {
        transform: scale(1.3);
    }
</style>
