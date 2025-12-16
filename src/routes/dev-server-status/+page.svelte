<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabaseClient.js';

    const users = ['최경림', '김준혁', '김지웅', '전하라', '오용상', '배윤희', '한수찬'];

    const servers = [
        {
            service: '비즈뿌리오',
            environments: [
                { name: 'test0', url: 'https://dev.bizppurio.com:14119/' },
                { name: 'test1', url: 'https://dev-test1.bizppurio.com:14119/' },
                { name: 'test2', url: 'https://dev-test2.bizppurio.com:14119/' }
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

    onMount(async () => {
        await loadServerStatus();
    });

    async function loadServerStatus() {
        isLoading = true;
        try {
            const { data, error } = await supabase
                .from('dev_server_status')
                .select('*');

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading server status:', error);
            } else if (data && data.length > 0) {
                serverStatus = {};
                data.forEach(item => {
                    serverStatus[item.server_key] = {
                        inUse: item.in_use,
                        assignedTo: item.assigned_to
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
                    assignedTo: ''
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
            serverStatus[key] = { inUse: false, assignedTo: '' };
        }
        
        // 사용중으로 변경하려고 할 때 사용자 선택 확인
        if (!serverStatus[key].inUse && !serverStatus[key].assignedTo) {
            event.preventDefault();
            alert('사용자를 먼저 선택해주세요.');
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

    function updateAssignedTo(serviceName, envName, user) {
        const key = getServerKey(serviceName, envName);
        if (!serverStatus[key]) {
            serverStatus[key] = { inUse: false, assignedTo: '' };
        }
        serverStatus[key].assignedTo = user;
        serverStatus = { ...serverStatus };
    }

    async function saveToDb(serviceName, envName) {
        try {
            const key = getServerKey(serviceName, envName);
            const status = serverStatus[key] || { inUse: false, assignedTo: '' };
            const env = servers
                .find(s => s.service === serviceName)
                ?.environments.find(e => e.name === envName);
            
            if (!env) return;

            const { error } = await supabase
                .from('dev_server_status')
                .upsert({
                    server_key: key,
                    service_name: serviceName,
                    environment_name: envName,
                    url: env.url,
                    in_use: status.inUse,
                    assigned_to: status.assignedTo,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'server_key' });

            if (error) {
                console.error('Error saving:', error);
                alert('저장 중 오류가 발생했습니다.');
            }
        } catch (err) {
            console.error('Failed to save:', err);
            alert('저장 중 오류가 발생했습니다.');
        }
    }
</script>

<div class="container mx-auto p-4">
    <div class="mb-6">
        <h1 class="text-3xl font-bold">개발장비 현황판</h1>
    </div>

    {#if isLoading}
        <div class="flex justify-center p-12">
            <span class="loading loading-spinner loading-lg"></span>
        </div>
    {:else}
        <div class="space-y-6">
            {#each servers as service}
                <div class="card bg-base-100 shadow-xl">
                    <div class="card-body">
                        <h2 class="card-title text-2xl">{service.service}</h2>
                        <div class="overflow-x-auto">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>환경</th>
                                        <th>사용자</th>
                                        <th>사용여부</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each service.environments as env}
                                        {@const key = getServerKey(service.service, env.name)}
                                        {@const status = serverStatus[key] || { inUse: false, assignedTo: '' }}
                                        <tr>
                                            <td class="font-semibold">
                                                <a
                                                    href={env.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="link link-primary"
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
                                            </td>
                                            <td>
                                                <select
                                                    class="select select-bordered w-full max-w-xs"
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
</div>

<style>
    .table th {
        background-color: hsl(var(--b3));
    }
</style>
