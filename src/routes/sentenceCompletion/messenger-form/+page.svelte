<script>
    import {onMount} from 'svelte';
    import {browser} from '$app/environment';
    import {copyToClipboard} from '$lib/utils/clipboard.js';
    import {supabase} from '$lib/supabaseClient.js';

    const STORAGE_KEY_PEER = 'messenger-form-peer-items';
    const STORAGE_KEY_INSPECT = 'messenger-form-inspect-items';

    function defaultPeerItem() {
        return {id: crypto.randomUUID(), issue: '', prLinks: ''};
    }


    // --- 동료검토 요청 ---
    let peerItems = $state([defaultPeerItem()]);

    function addPeerItem() {
        peerItems = [...peerItems, defaultPeerItem()];
    }

    function resetPeerItems() {
        peerItems = [defaultPeerItem()];
    }

    function removePeerItem(id) {
        peerItems = peerItems.filter((item) => item.id !== id);
    }

    function parsePrLines(prLinks) {
        return prLinks
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
                try {
                    const url = new URL(line.trim());
                    const pathParts = url.pathname.split('/').filter(Boolean);
                    const repoName = pathParts.length >= 4 ? pathParts[3] : '서비스명';
                    return `- ${repoName}: ${line.trim()}`;
                } catch {
                    return `- ${line.trim()}`;
                }
            })
            .join('\n');
    }

    let peerReviewResult = $derived.by(() => {
        const body = peerItems
            .filter((item) => item.issue.trim() !== '' || item.prLinks.trim() !== '')
            .map((item) => {
                const prSection = parsePrLines(item.prLinks);
                return `${item.issue.trim()}\n${prSection}`;
            })
            .join('\n\n');

        return `아래 내용으로 동료검토 요청드립니다.\n\n${body}\n\n감사합니다.`;
    });

    // --- 검수 요청 ---
    let devServers = $state([]);
    let stgServers = $state([]);
    let isLoadingServers = $state(true);

    function defaultInspectInfo() {
        return {id: crypto.randomUUID(), inspectType: '', service: '', environment: '', customUrl: ''};
    }

    let inspectItems = $state([{id: crypto.randomUUID(), issue: '', infos: [defaultInspectInfo()]}]);

    function addInspectItem() {
        inspectItems = [...inspectItems, {id: crypto.randomUUID(), issue: '', infos: [defaultInspectInfo()]}];
    }

    function resetInspectItems() {
        inspectItems = [{id: crypto.randomUUID(), issue: '', infos: [defaultInspectInfo()]}];
    }

    function removeInspectItem(id) {
        inspectItems = inspectItems.filter((item) => item.id !== id);
    }

    function addInspectInfo(item) {
        item.infos = [...item.infos, defaultInspectInfo()];
    }

    function removeInspectInfo(item, infoId) {
        item.infos = item.infos.filter((info) => info.id !== infoId);
    }

    function getServersForType(type) {
        if (type === '개발장비') return devServers;
        if (type === '검수장비') return stgServers;
        return [];
    }

    function getEnvironments(info) {
        return getServersForType(info.inspectType).find((s) => s.service === info.service)?.environments ?? [];
    }

    function getUrl(info) {
        if (info.inspectType === '직접입력') return info.customUrl;
        return getEnvironments(info).find((e) => e.name === info.environment)?.url ?? '';
    }

    function onInspectTypeChange(info) {
        info.service = '';
        info.environment = '';
        info.customUrl = '';
    }

    function onServiceChange(info) {
        info.environment = '';
    }

    let inspectResult = $derived.by(() => {
        const body = inspectItems
            .filter((item) => item.issue.trim() !== '')
            .map((item) => {
                const urls = item.infos
                    .map((info) => getUrl(info))
                    .filter((url) => url)
                    .map((url) => `ㄴ ${url}`)
                    .join('\n');
                return `${item.issue.trim()}\n${urls}`;
            })
            .join('\n\n');

        return `[검수 요청]\n아래 개발 건 검수 요청드립니다.\n\n${body}\n\n감사합니다.`;
    });

    // --- localStorage 저장 ---
    let initialized = $state(false);

    $effect(() => {
        if (browser && initialized) {
            localStorage.setItem(STORAGE_KEY_PEER, JSON.stringify(peerItems));
        }
    });

    $effect(() => {
        if (browser && initialized) {
            localStorage.setItem(STORAGE_KEY_INSPECT, JSON.stringify(inspectItems));
        }
    });

    onMount(async () => {
        // localStorage 복원 후 저장 활성화
        try {
            const savedPeer = localStorage.getItem(STORAGE_KEY_PEER);
            if (savedPeer) peerItems = JSON.parse(savedPeer);

            const savedInspect = localStorage.getItem(STORAGE_KEY_INSPECT);
            if (savedInspect) {
                const parsed = JSON.parse(savedInspect);
                inspectItems = parsed.map((item) => ({
                    id: item.id ?? crypto.randomUUID(),
                    issue: item.issue ?? '',
                    infos: Array.isArray(item.infos) ? item.infos : [defaultInspectInfo()],
                }));
            }
        } catch {
            // 복원 실패 시 기본값 유지
        }
        initialized = true;

        // 서버 데이터 로드
        try {
            const {data, error} = await supabase
                .from('server_status')
                .select('service_name, environment_name, url, env_type, display_order')
                .in('env_type', ['dev', 'stg'])
                .order('display_order', {ascending: true})
                .order('service_name', {ascending: true})
                .order('environment_name', {ascending: true});

            if (!error && data) {
                const buildList = (rows) => {
                    const map = new Map();
                    rows.forEach((item) => {
                        if (!item.url) return;
                        if (!map.has(item.service_name)) map.set(item.service_name, []);
                        map.get(item.service_name).push({name: item.environment_name, url: item.url});
                    });
                    return Array.from(map.entries()).map(([service, environments]) => ({service, environments}));
                };
                devServers = buildList(data.filter((d) => d.env_type === 'dev'));
                stgServers = buildList(data.filter((d) => d.env_type === 'stg'));
            }
        } finally {
            isLoadingServers = false;
        }
    });
</script>

<div class="container mx-auto space-y-12 p-4">
    <!-- 동료검토 요청 -->
    <div>
        <h1 class="mb-4 text-2xl font-bold">동료검토 요청 양식</h1>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <!-- 입력 -->
            <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">입력</h2>
                        <div class="flex gap-1">
                            <button class="btn btn-xs btn-error" onclick={resetPeerItems}>초기화</button>
                            <button class="btn btn-xs btn-outline btn-primary" onclick={addPeerItem}>+ 추가</button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-4">
                        {#each peerItems as item, index (item.id)}
                            <div class="rounded-box border border-base-300 p-4">
                                <div class="mb-2 flex items-center justify-between">
                                    <span class="text-sm font-semibold text-base-content/60">#{index + 1}</span>
                                    {#if peerItems.length > 1}
                                        <button
                                            class="btn btn-xs btn-outline btn-error"
                                            onclick={() => removePeerItem(item.id)}
                                        >삭제</button>
                                    {/if}
                                </div>
                                <div class="form-control w-full">
                                    <label class="label" for="peer-issue-{item.id}">
                                        <span class="label-text">일감</span>
                                    </label>
                                    <input
                                        id="peer-issue-{item.id}"
                                        type="text"
                                        class="input-bordered input w-full"
                                        placeholder="[서비스] 제목 (일감)"
                                        bind:value={item.issue}
                                    />
                                </div>
                                <div class="form-control mt-2 w-full">
                                    <label class="label" for="pr-{item.id}">
                                        <span class="label-text">PR 링크 (한 줄에 하나씩)</span>
                                    </label>
                                    <textarea
                                        id="pr-{item.id}"
                                        class="textarea-bordered textarea h-24 w-full"
                                        placeholder="https://repo.daou.co.kr/projects/BIZ/repos/bizweb/pull-requests/1304/overview"
                                        bind:value={item.prLinks}
                                    ></textarea>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- 결과 -->
            <div class="card bg-base-200 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">결과</h2>
                        <button class="btn btn-sm btn-primary" onclick={() => copyToClipboard(peerReviewResult)}>
                            복사하기
                        </button>
                    </div>
                    <div class="form-control">
                        <textarea
                            class="textarea-bordered textarea h-96 w-full"
                            readonly
                            value={peerReviewResult}
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- 검수 요청 -->
    <div>
        <h1 class="mb-4 text-2xl font-bold">검수 요청 양식</h1>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <!-- 입력 -->
            <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">입력</h2>
                        <div class="flex gap-1">
                            <button class="btn btn-xs btn-error" onclick={resetInspectItems}>초기화</button>
                            <button class="btn btn-xs btn-outline btn-primary" onclick={addInspectItem}>+ 추가</button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-4">
                        {#each inspectItems as item, index (item.id)}
                            <div class="rounded-box border border-base-300 p-4">
                                <div class="mb-2 flex items-center justify-between">
                                    <span class="text-sm font-semibold text-base-content/60">#{index + 1}</span>
                                </div>
                                <div class="form-control w-full">
                                    <label class="label" for="inspect-issue-{item.id}">
                                        <span class="label-text">일감</span>
                                    </label>
                                    <input
                                        id="inspect-issue-{item.id}"
                                        type="text"
                                        class="input-bordered input w-full"
                                        placeholder="[서비스] 제목 (일감)"
                                        bind:value={item.issue}
                                    />
                                </div>
                                <div class="form-control mt-2 w-full">
                                    <label class="label">
                                        <span class="label-text">검수정보</span>
                                    </label>
                                    <div class="flex flex-col gap-2">
                                        {#each item.infos as info (info.id)}
                                            <div class="flex items-center gap-2">
                                                <select
                                                    class="select-bordered select w-40 shrink-0"
                                                    bind:value={info.inspectType}
                                                    onchange={() => onInspectTypeChange(info)}
                                                >
                                                    <option value="">검수정보 선택</option>
                                                    <option value="개발장비">개발장비</option>
                                                    <option value="검수장비">검수장비</option>
                                                    <option value="직접입력">직접입력</option>
                                                </select>

                                                {#if info.inspectType === '직접입력'}
                                                    <input
                                                        type="text"
                                                        class="input-bordered input flex-1"
                                                        placeholder=""
                                                        bind:value={info.customUrl}
                                                    />
                                                {:else}
                                                    <select
                                                        class="select-bordered select flex-1"
                                                        bind:value={info.service}
                                                        onchange={() => onServiceChange(info)}
                                                        disabled={!info.inspectType || isLoadingServers}
                                                    >
                                                        <option value="">장비명 선택</option>
                                                        {#each getServersForType(info.inspectType) as server}
                                                            <option value={server.service}>{server.service}</option>
                                                        {/each}
                                                    </select>

                                                    <select
                                                        class="select-bordered select flex-1"
                                                        bind:value={info.environment}
                                                        disabled={!info.service || isLoadingServers}
                                                    >
                                                        <option value="">서버 선택</option>
                                                        {#each getEnvironments(info) as env}
                                                            <option value={env.name}>{env.name}</option>
                                                        {/each}
                                                    </select>
                                                {/if}
                                                <button
                                                    class="btn btn-xs btn-outline btn-primary shrink-0"
                                                    onclick={() => addInspectInfo(item)}
                                                >+ 추가</button>
                                                {#if item.infos.length > 1}
                                                    <button
                                                        class="btn btn-xs btn-outline btn-error shrink-0"
                                                        onclick={() => removeInspectInfo(item, info.id)}
                                                    >삭제</button>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- 결과 -->
            <div class="card bg-base-200 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">결과</h2>
                        <button class="btn btn-sm btn-primary" onclick={() => copyToClipboard(inspectResult)}>
                            복사하기
                        </button>
                    </div>
                    <div class="form-control">
                        <textarea
                            class="textarea-bordered textarea h-96 w-full"
                            readonly
                            value={inspectResult}
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
