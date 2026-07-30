<script>
    import '../app.css';
    import favicon from '$lib/assets/favicon.svg';
    import {page} from '$app/state';
    import {onMount} from 'svelte';
    import {supabase} from '$lib/supabaseClient.js';
    import Toast from '$lib/components/Toast.svelte';

    const menus = [
        {
            category: '현황판',
            items: [
                {name: '개발장비 사용 현황', path: '/statusBoard/devServer'},
                {name: '검수장비 사용 현황', path: '/statusBoard/stgServer'},
            ]
        },
        {
            category: '문장완성',
            items: [
                {name: '배포 예정 현황 양식', path: '/sentenceCompletion/upcoming-deployment-status-form'},
                {name: '메신저 문구 양식', path: '/sentenceCompletion/messenger-form'},
                {name: '일일 점검 양식', path: '/sentenceCompletion/daily-check-form'},
            ]
        },
        {
            category: 'REDMINE',
            desc: '입력 시 편집모드에서 "소스"선택 후 붙여넣으세염',
            items: [
                {name: 'L4 작업 요청 양식', path: '/redmine/l4-request-form'},
                {name: '배포 요청 양식', path: '/redmine/deployment-request-form'},
                {name: '코멘트 양식', path: '/redmine/comment-form'},
                {name: 'DB 업무 요청 양식', path: '/redmine/db-request-form'},
            ]
        },
			{
				category: '기타',
				items: [
					{name: '비밀번호 모음집', path: '/etc/password-vault'},
				]
			},
    ];

    const QUICK_LINKS_TABLE = 'quick_links';

    // 코드에서 유지하는 특수 동작 항목(일감 번호 입력 프롬프트 등).
    // 같은 이름의 그룹이 있으면 해당 그룹의 DB 링크 뒤에 병합된다.
    const specialItems = {
        Redmine: [{name: '일감', prompt: true}],
    };

    let links = []; // quick_links 테이블 전체 행

    onMount(async () => {
        await loadLinks();
    });

    async function loadLinks() {
        const {data, error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .select('*')
            .order('display_order', {ascending: true});
        if (error) {
            console.error('quick_links load error:', error);
            return;
        }
        links = data ?? [];
    }

    // DB 행 → 3단 트리(그룹 > 서브그룹 > 링크).
    // group_name 없음 = 단독(직접 이동), sub_group_name 없음 = 그룹 직속 링크.
    // 한 그룹 안에 직속 링크와 서브그룹이 섞일 수 있고, 등록 순서대로 배치된다.
    function buildTree(rows) {
        const tree = [];
        const groupAt = new Map(); // 그룹명 -> tree 인덱스
        const subAt = new Map();   // `그룹\0서브` -> 그룹 children 인덱스
        for (const row of rows) {
            const g = row.group_name?.trim();
            const s = row.sub_group_name?.trim();
            const leaf = {type: 'link', row};
            if (!g) {
                tree.push(leaf);
                continue;
            }
            if (!groupAt.has(g)) {
                groupAt.set(g, tree.length);
                tree.push({type: 'group', name: g, children: []});
            }
            const children = tree[groupAt.get(g)].children;
            if (!s) {
                children.push(leaf);
                continue;
            }
            const key = `${g}\u0000${s}`;
            if (!subAt.has(key)) {
                subAt.set(key, children.length);
                children.push({type: 'sub', name: s, children: []});
            }
            children[subAt.get(key)].children.push(leaf);
        }
        return {tree, groupAt};
    }

    // 트리 + 특수 항목을 사이드바 렌더 구조로 조립 (items 가 있으면 하위 메뉴)
    function buildQuickLinks(rows) {
        const {tree, groupAt} = buildTree(rows);
        const toView = (node) =>
            node.type === 'link'
                ? {name: node.row.name, path: node.row.path}
                : {name: node.name, items: node.children.map(toView)};
        const result = tree.map(toView);
        for (const [g, items] of Object.entries(specialItems)) {
            if (groupAt.has(g)) {
                result[groupAt.get(g)].items.push(...items);
            } else {
                result.push({name: g, items: [...items]});
            }
        }
        return result;
    }

    // 트리 렌더 순서대로 행을 펼침 (display_order 재부여 기준)
    function flattenRows(tree) {
        const out = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.type === 'link') out.push(node.row);
                else walk(node.children);
            }
        };
        walk(tree);
        return out;
    }

    // 링크 관리 목록용 평면 행 (그룹/서브그룹 헤더 + 들여쓰기 depth + 순서이동 path)
    // groupName = 소속 그룹명(서브그룹 이름 변경 시 대상 행을 좁히는 데 사용)
    function buildManageRows(rows) {
        const {tree} = buildTree(rows);
        const out = [];
        const walk = (nodes, depth, parentPath, groupName) => {
            nodes.forEach((node, i) => {
                const path = [...parentPath, i];
                const meta = {depth, path, index: i, siblings: nodes.length, groupName};
                if (node.type === 'link') {
                    out.push({kind: 'link', row: node.row, ...meta});
                } else {
                    const ownGroup = node.type === 'group' ? node.name : groupName;
                    out.push({kind: node.type, name: node.name, ...meta, groupName: ownGroup});
                    walk(node.children, depth + 1, path, ownGroup);
                }
            });
        };
        walk(tree, 0, [], null);
        return out;
    }

    $: quickLinks = buildQuickLinks(links);
    $: manageRows = buildManageRows(links);
    $: existingGroups = [...new Set(links.map(l => l.group_name?.trim()).filter(Boolean))];
    // 그룹명 -> 해당 그룹에 이미 존재하는 서브그룹 목록
    $: subGroupsByGroup = links.reduce((acc, l) => {
        const g = l.group_name?.trim();
        const s = l.sub_group_name?.trim();
        if (!g || !s) return acc;
        const list = acc[g] ?? (acc[g] = []);
        if (!list.includes(s)) list.push(s);
        return acc;
    }, {});

    function subGroupOptions(group) {
        return subGroupsByGroup[group] ?? [];
    }

    function handleSubItemClick(item) {
        if (item.prompt) {
            issueNum = '';
            issueDialogEl?.showModal();
        } else {
            window.open(item.path, '_blank');
        }
    }

    // --- 일감 다이얼로그 ---
    let issueNum = '';
    let issueDialogEl;

    function confirmIssue() {
        const trimmed = String(issueNum).trim();
        if (!trimmed) return;
        window.open(`https://task.daou.co.kr/issues/${trimmed}`, '_blank');
        issueDialogEl?.close();
    }

    // --- 링크 관리 다이얼로그 ---
    const NEW_GROUP = '__new__';     // 그룹 select 에서 '새 그룹 입력' 선택값
    const NEW_SUB = '__new_sub__';   // 서브그룹 select 에서 '새 서브그룹 입력' 선택값

    let linkDialogEl;

    // 새 링크 추가 폼 ('' = 단독/서브그룹 없음, NEW_* = 새로 입력, 그 외 = 기존 이름)
    let newGroup = '';
    let newGroupCustom = '';
    let newSub = '';
    let newSubCustom = '';
    let newName = '';
    let newPath = '';

    // 인라인 수정
    let editingId = null;
    let editBuffer = {group: '', groupCustom: '', sub: '', subCustom: '', name: '', path: ''};

    function openLinkDialog() {
        newGroup = '';
        newGroupCustom = '';
        newSub = '';
        newSubCustom = '';
        newName = '';
        newPath = '';
        editingId = null;
        linkDialogEl?.showModal();
    }

    // select 값 + 새 이름 입력값 → 최종 이름 (없으면 null)
    function resolveName(sel, custom, newSentinel) {
        if (sel === newSentinel) return custom.trim() || null;
        return sel.trim() || null;
    }

    const resolveGroup = (sel, custom) => resolveName(sel, custom, NEW_GROUP);
    // 그룹이 없으면(단독) 서브그룹은 무의미하므로 항상 null
    const resolveSub = (group, sel, custom) => (group ? resolveName(sel, custom, NEW_SUB) : null);

    // 그룹 선택이 바뀌면 이전 그룹의 서브그룹 선택은 무효
    function onNewGroupChange() {
        newSub = '';
        newSubCustom = '';
    }

    function onEditGroupChange() {
        editBuffer = {...editBuffer, sub: '', subCustom: ''};
    }

    async function addLink() {
        const group_name = resolveGroup(newGroup, newGroupCustom);
        const sub_group_name = resolveSub(group_name, newSub, newSubCustom);
        const name = newName.trim();
        const path = newPath.trim();
        if (!name || !path) return;
        const nextOrder = links.length > 0
            ? Math.max(...links.map(i => i.display_order ?? 0)) + 1
            : 0;
        const {data, error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .insert({group_name, sub_group_name, name, path, display_order: nextOrder})
            .select()
            .single();
        if (error) {
            console.error('quick_links insert error:', error);
            return;
        }
        links = [...links, data];
        // 새 행이 소속 그룹/서브그룹 블록 안으로 들어오도록 순서 재정렬
        await persistOrder(flattenRows(buildTree(links).tree));
        // 연속 추가 편의를 위해 그룹/서브그룹 선택은 유지
        newGroup = group_name ?? '';
        newGroupCustom = '';
        newSub = sub_group_name ?? '';
        newSubCustom = '';
        newName = '';
        newPath = '';
    }

    // --- 그룹 / 서브그룹 이름 변경 ---
    let editingGroup = null;   // {kind, name, groupName} 헤더 노드 식별용
    let groupNameBuffer = '';

    // current 를 인자로 받아야 템플릿에서 editingGroup 변경이 의존성으로 추적된다
    function isEditingGroup(current, node) {
        return current?.kind === node.kind
            && current?.name === node.name
            && current?.groupName === node.groupName;
    }

    function startEditGroup(node) {
        editingId = null;
        editingGroup = {kind: node.kind, name: node.name, groupName: node.groupName};
        groupNameBuffer = node.name;
    }

    function cancelEditGroup() {
        editingGroup = null;
    }

    // 이름 변경은 소속 행 전체의 group_name / sub_group_name 을 일괄 수정한다.
    // 기존 이름으로 바꾸면 해당 그룹과 자연스럽게 합쳐진다.
    async function saveEditGroup(node) {
        const next = groupNameBuffer.trim();
        if (!next || next === node.name) {
            editingGroup = null;
            return;
        }
        const isGroup = node.kind === 'group';
        const ids = links
            .filter(l => isGroup
                ? l.group_name?.trim() === node.name
                : l.group_name?.trim() === node.groupName && l.sub_group_name?.trim() === node.name)
            .map(l => l.id);
        if (ids.length === 0) {
            editingGroup = null;
            return;
        }
        const patch = isGroup ? {group_name: next} : {sub_group_name: next};
        const {error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .update(patch)
            .in('id', ids);
        if (error) {
            console.error('quick_links rename error:', error);
            return;
        }
        links = links.map(l => (ids.includes(l.id) ? {...l, ...patch} : l));
        editingGroup = null;
        // 합쳐진 경우 렌더 순서와 display_order 를 다시 맞춤
        await persistOrder(flattenRows(buildTree(links).tree));
    }

    function startEditLink(item) {
        editingId = item.id;
        editingGroup = null;
        editBuffer = {
            group: item.group_name?.trim() || '',
            groupCustom: '',
            sub: item.sub_group_name?.trim() || '',
            subCustom: '',
            name: item.name,
            path: item.path,
        };
    }

    function cancelEditLink() {
        editingId = null;
    }

    async function saveEditLink(id) {
        const group_name = resolveGroup(editBuffer.group, editBuffer.groupCustom);
        const sub_group_name = resolveSub(group_name, editBuffer.sub, editBuffer.subCustom);
        const name = editBuffer.name.trim();
        const path = editBuffer.path.trim();
        if (!name || !path) return;
        const {error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .update({group_name, sub_group_name, name, path})
            .eq('id', id);
        if (error) {
            console.error('quick_links update error:', error);
            return;
        }
        links = links.map(l => (l.id === id ? {...l, group_name, sub_group_name, name, path} : l));
        editingId = null;
        // 그룹이 바뀐 경우 렌더 순서와 display_order 를 다시 맞춤
        await persistOrder(flattenRows(buildTree(links).tree));
    }

    async function removeLink(id) {
        const {error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .delete()
            .eq('id', id);
        if (error) {
            console.error('quick_links delete error:', error);
            return;
        }
        links = links.filter(i => i.id !== id);
        if (editingId === id) editingId = null;
    }

    // 형제 노드끼리 위(-1)/아래(+1) 이동.
    // 그룹/서브그룹 헤더를 옮기면 하위 링크가 통째로 따라간다.
    async function moveNode(path, dir) {
        const {tree} = buildTree(links);
        const siblings = path.slice(0, -1).reduce((nodes, i) => nodes[i].children, tree);
        const i = path[path.length - 1];
        const j = i + dir;
        if (j < 0 || j >= siblings.length) return;
        [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
        await persistOrder(flattenRows(tree));
    }

    // 트리 렌더 순서대로 display_order 를 0..n-1 재부여 (변경된 행만 저장)
    async function persistOrder(ordered) {
        const changed = ordered.filter((row, i) => row.display_order !== i);
        links = ordered.map((row, i) => ({...row, display_order: i}));
        if (changed.length === 0) return;
        const nextOrder = new Map(links.map(l => [l.id, l.display_order]));
        try {
            await Promise.all(
                changed.map(row =>
                    supabase
                        .from(QUICK_LINKS_TABLE)
                        .update({display_order: nextOrder.get(row.id)})
                        .eq('id', row.id)
                )
            );
        } catch (e) {
            console.error('quick_links reorder error:', e);
        }
    }
</script>

<svelte:head>
    <link rel="icon" href={favicon}/>
</svelte:head>

<Toast/>

<div class="drawer lg:drawer-open">
    <input id="my-drawer-2" type="checkbox" class="drawer-toggle"/>
    <div class="drawer-content flex flex-col items-center justify-start">
        <!-- Page content here -->
        <slot/>
        <label for="my-drawer-2" class="drawer-button btn btn-primary lg:hidden">Open drawer</label>
    </div>
    <div class="drawer-side">
        <label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
        <ul class="menu min-h-full w-65 bg-base-200 p-4 text-base-content flex flex-col">
            <!-- Sidebar content here -->
            {#each menus as group (group.category)}
                <li class="menu-title relative group cursor-default">
                    <span>{group.category}</span>
                    <div class="tooltip-bubble">
                        {group.desc}
                        <div class="tooltip-arrow"></div>
                    </div>
                </li>
                {#each group.items as menu (menu.name)}
                    <li>
                        <a
                                href={menu.path}
                                class:menu-active={page.url.pathname === menu.path}
                                data-sveltekit-reload>{menu.name}</a>
                    </li>
                {/each}
            {/each}

            <!-- 바로가기 링크 -->
            <li class="menu-title mt-auto p-0">
                <button type="button" class="link-manage-btn" on:click={openLinkDialog} title="클릭하여 링크 관리">
                    <span>바로가기 링크</span>
                    <span aria-hidden="true" class="opacity-40 group-hover:opacity-80">⚙</span>
                </button>
            </li>
            <div class="flex flex-col gap-1 pb-2">
                {#each quickLinks as link}
                    {#if link.path}
                        <button class="btn btn-ghost border border-base-300 w-full justify-start" on:click={() => window.open(link.path, '_blank')}>{link.name}</button>
                    {:else}
                        <div class="dropdown dropdown-right dropdown-end">
                            <button tabindex="0" class="btn btn-ghost border border-base-300 w-full justify-start">{link.name}</button>
                            <div tabindex="0" role="menu" class="dropdown-content menu bg-base-100 rounded-box border border-base-300 shadow-lg z-50 w-full p-1 -ml-20">
                                {#each link.items as item}
                                    {#if item.items}
                                        <!-- 3단: 서브그룹 → 링크 -->
                                        <!-- 2단과 동일하게 클릭(focus)으로 펼침 -->
                                        <div class="dropdown dropdown-right w-full">
                                            <button tabindex="0" class="w-full flex items-center justify-between gap-2 text-left font-medium hover:bg-primary hover:text-primary-content rounded px-3 py-1.5">
                                                <span class="truncate">{item.name}</span>
                                                <span aria-hidden="true" class="opacity-50">›</span>
                                            </button>
                                            <!-- 3단은 항목 이름 길이에 맞춰 가로로 넓어짐 -->
                                            <div tabindex="0" role="menu" class="dropdown-content menu bg-base-100 rounded-box border border-base-300 shadow-lg z-50 w-max min-w-52 max-w-96 p-1">
                                                {#each item.items as leaf}
                                                    <div role="menuitem"><button class="w-full text-left font-medium whitespace-nowrap hover:bg-primary hover:text-primary-content rounded px-3 py-1.5" on:click={() => handleSubItemClick(leaf)}>{leaf.name}</button></div>
                                                {/each}
                                            </div>
                                        </div>
                                    {:else}
                                        <div role="menuitem"><button class="w-full text-left font-medium hover:bg-primary hover:text-primary-content rounded px-3 py-1.5" on:click={() => handleSubItemClick(item)}>{item.name}</button></div>
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        </ul>
    </div>
</div>

<dialog bind:this={issueDialogEl} class="modal">
    <div class="modal-box">
        <h3 class="mb-4 font-bold text-lg">Redmine 일감 번호 입력</h3>
        <input
                type="number"
                class="input input-bordered w-full"
                placeholder="일감 번호"
                bind:value={issueNum}
                on:keydown={(e) => e.key === 'Enter' && confirmIssue()}
        />
        <div class="modal-action">
            <button class="btn" on:click={() => issueDialogEl?.close()}>취소</button>
            <button class="btn btn-primary" on:click={confirmIssue} disabled={!issueNum}>이동</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog bind:this={linkDialogEl} class="modal">
    <div class="modal-box max-w-lg">
        <h3 class="mb-4 font-bold text-lg">링크 관리</h3>

        <!-- 그룹 > 서브그룹 > 링크 계층 목록. ▲▼ 는 같은 계층(형제)끼리만 이동한다. -->
        <div class="flex flex-col gap-1 mb-4 max-h-96 overflow-y-auto">
            {#each manageRows as node (node.kind === 'link' ? node.row.id : `${node.kind}-${node.path.join('-')}`)}
                <div class="flex gap-2 items-start" style="margin-left: {node.depth * 1.25}rem">
                    <div class="flex flex-col text-base-content/40 pt-1 shrink-0">
                        <button class="leading-none hover:text-primary disabled:opacity-20"
                                on:click={() => moveNode(node.path, -1)} disabled={node.index === 0} title="위로">▲</button>
                        <button class="leading-none hover:text-primary disabled:opacity-20"
                                on:click={() => moveNode(node.path, 1)} disabled={node.index === node.siblings - 1} title="아래로">▼</button>
                    </div>
                    {#if node.kind !== 'link'}
                        <!-- 그룹 / 서브그룹 헤더 (하위 항목과 함께 이동, 이름 변경 가능) -->
                        <div class="flex-1 min-w-0 flex items-center gap-2 py-1">
                            {#if node.kind === 'group'}
                                <span class="badge badge-sm badge-neutral shrink-0">그룹</span>
                            {:else}
                                <span class="badge badge-sm badge-outline shrink-0">서브</span>
                            {/if}
                            {#if isEditingGroup(editingGroup, node)}
                                <input class="input input-bordered input-xs flex-1 min-w-0"
                                       placeholder={node.kind === 'group' ? '그룹 이름' : '서브그룹 이름'}
                                       bind:value={groupNameBuffer}
                                       on:keydown={(e) => {
                                           if (e.key === 'Enter') saveEditGroup(node);
                                           if (e.key === 'Escape') cancelEditGroup();
                                       }}/>
                                <button class="btn btn-xs btn-primary" on:click={() => saveEditGroup(node)}
                                        disabled={!groupNameBuffer.trim()}>저장</button>
                                <button class="btn btn-xs btn-ghost" on:click={cancelEditGroup}>취소</button>
                            {:else}
                                <span class="font-semibold truncate">{node.name}</span>
                                <button class="btn btn-xs btn-ghost text-base-content/50" title="이름 변경"
                                        on:click={() => startEditGroup(node)}>✎</button>
                            {/if}
                        </div>
                    {:else if editingId === node.row.id}
                        <!-- 수정 모드 -->
                        <div class="flex-1 min-w-0 flex flex-col gap-1 border border-primary/40 bg-primary/5 rounded px-2 py-2">
                            <select class="select select-bordered select-sm w-full" bind:value={editBuffer.group}
                                    on:change={onEditGroupChange}>
                                <option value="">단독 (그룹 없음)</option>
                                {#each existingGroups as g}
                                    <option value={g}>{g}</option>
                                {/each}
                                <option value={NEW_GROUP}>+ 새 그룹…</option>
                            </select>
                            {#if editBuffer.group === NEW_GROUP}
                                <input class="input input-bordered input-sm w-full" placeholder="새 그룹 이름"
                                       bind:value={editBuffer.groupCustom}/>
                            {/if}
                            {#if editBuffer.group}
                                <select class="select select-bordered select-sm w-full" bind:value={editBuffer.sub}>
                                    <option value="">서브그룹 없음 (그룹 직속)</option>
                                    {#each subGroupOptions(editBuffer.group) as s}
                                        <option value={s}>{s}</option>
                                    {/each}
                                    <option value={NEW_SUB}>+ 새 서브그룹…</option>
                                </select>
                                {#if editBuffer.sub === NEW_SUB}
                                    <input class="input input-bordered input-sm w-full" placeholder="새 서브그룹 이름"
                                           bind:value={editBuffer.subCustom}/>
                                {/if}
                            {/if}
                            <input class="input input-bordered input-sm w-full" placeholder="이름" bind:value={editBuffer.name}/>
                            <input class="input input-bordered input-sm w-full" placeholder="https://..." bind:value={editBuffer.path}/>
                            <div class="flex gap-1 justify-end">
                                <button class="btn btn-xs btn-primary" on:click={() => saveEditLink(node.row.id)}
                                        disabled={!editBuffer.name.trim() || !editBuffer.path.trim()}>저장</button>
                                <button class="btn btn-xs btn-ghost" on:click={cancelEditLink}>취소</button>
                            </div>
                        </div>
                    {:else}
                        <!-- 조회 모드 -->
                        <div class="flex-1 min-w-0 flex gap-2 items-center border border-base-300 rounded px-2 py-2">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    {#if node.depth === 0}
                                        <span class="badge badge-sm badge-ghost shrink-0">단독</span>
                                    {/if}
                                    <span class="font-medium truncate">{node.row.name}</span>
                                </div>
                                <div class="text-xs opacity-60 truncate">{node.row.path}</div>
                            </div>
                            <button class="btn btn-xs btn-outline btn-primary" on:click={() => startEditLink(node.row)}>수정</button>
                            <button class="btn btn-xs btn-outline btn-error" on:click={() => removeLink(node.row.id)}>삭제</button>
                        </div>
                    {/if}
                </div>
            {/each}
            {#if links.length === 0}
                <div class="text-sm opacity-60 text-center py-4">등록된 링크가 없습니다.</div>
            {/if}
        </div>

        <div class="divider my-2 text-xs">새 링크 추가</div>
        <div class="flex flex-col gap-2">
            <select class="select select-bordered select-sm w-full" bind:value={newGroup} on:change={onNewGroupChange}>
                <option value="">단독 (그룹 없음)</option>
                {#each existingGroups as g}
                    <option value={g}>{g}</option>
                {/each}
                <option value={NEW_GROUP}>+ 새 그룹…</option>
            </select>
            {#if newGroup === NEW_GROUP}
                <input class="input input-bordered input-sm w-full" placeholder="새 그룹 이름"
                       bind:value={newGroupCustom} on:keydown={(e) => e.key === 'Enter' && addLink()}/>
            {/if}
            {#if newGroup}
                <select class="select select-bordered select-sm w-full" bind:value={newSub}>
                    <option value="">서브그룹 없음 (그룹 직속)</option>
                    {#each subGroupOptions(newGroup) as s}
                        <option value={s}>{s}</option>
                    {/each}
                    <option value={NEW_SUB}>+ 새 서브그룹…</option>
                </select>
                {#if newSub === NEW_SUB}
                    <input class="input input-bordered input-sm w-full" placeholder="새 서브그룹 이름"
                           bind:value={newSubCustom} on:keydown={(e) => e.key === 'Enter' && addLink()}/>
                {/if}
            {/if}
            <input class="input input-bordered input-sm w-full" placeholder="이름" bind:value={newName}
                   on:keydown={(e) => e.key === 'Enter' && addLink()}/>
            <input class="input input-bordered input-sm w-full" placeholder="https://..." bind:value={newPath}
                   on:keydown={(e) => e.key === 'Enter' && addLink()}/>
            <button class="btn btn-sm btn-primary" on:click={addLink}
                    disabled={!newName.trim() || !newPath.trim()}>추가
            </button>
        </div>

        <div class="modal-action">
            <button class="btn" on:click={() => linkDialogEl?.close()}>닫기</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<style>
    /* 말풍선이 잘리지 않게 */
    .drawer-side,
    .menu {
        overflow: visible;
    }

    .menu-title {
        position: relative;
        display: inline-block;
    }

    .link-manage-btn {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        width: 100%;
        padding: 0.25rem 0;
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }

    .link-manage-btn:hover {
        opacity: 0.8;
    }

    .tooltip-bubble {
        position: absolute;
        top: 50%;
        left: calc(50% + 8px); /* 글자 오른쪽에 배치 */
        transform: translateY(-50%) scale(0.95);
        background: rgba(35, 35, 35, 0.95);
        color: #fff;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 0.8rem;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: all 0.2s ease;
        z-index: 1000;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    .tooltip-arrow {
        position: absolute;
        left: -5px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-right: 5px solid rgba(35, 35, 35, 0.95);
    }

    .menu-title:hover .tooltip-bubble {
        opacity: 1;
        transform: translateY(-50%) scale(1);
    }
</style>
