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
        serverStatus[key].assignedTo = user;
        
        // 사용자 변경 시 사용여부 자동으로 false로 변경
        if (serverStatus[key].inUse) {
            serverStatus[key].inUse = false;
        }
        
        serverStatus = { ...serverStatus };
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

<div class="container mx-auto p-4">
	<div class="mb-8 text-center bg-gradient-to-r from-blue-500 to-purple-600 text-white py-8 rounded-2xl shadow-2xl">
		<h1 class="text-4xl font-bold mb-2">🔫 개발장비 현황판 🔫</h1>
		<p class="text-lg opacity-90">싸우지 말고 사용합시다~</p>
		<p class="text-lg opacity-90">👊 사용 전 꼭 새로고침 👊</p>
	</div>

    {#if isLoading}
        <div class="flex justify-center p-12">
            <span class="loading loading-spinner loading-lg"></span>
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
                                                    class="select select-bordered w-full max-w-xs {status.assignedTo ? 'select-primary' : ''}"
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
                                                    class="toggle toggle-primary"
                                                    checked={status.inUse}
                                                    on:click={(e) => toggleInUse(service.service, env.name, e)}
                                                />
                                                <span class="ml-2 {status.inUse ? 'text-primary font-semibold' : 'text-base-content/50'}">
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
            <div class="alert alert-error">
                <span>{toastMessage}</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .table th {
        background-color: hsl(var(--b3));
    }
</style>
