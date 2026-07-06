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

    // DB 링크 + 특수 항목을 사이드바 그룹 구조로 조립.
    // group_name 이 비어있는 행은 단독(직접 이동) 버튼으로 렌더링된다.
    function buildQuickLinks(rows) {
        const result = [];
        const groupIndex = new Map();
        for (const row of rows) {
            const g = row.group_name?.trim();
            if (!g) {
                result.push({name: row.name, path: row.path});
            } else {
                if (!groupIndex.has(g)) {
                    groupIndex.set(g, result.length);
                    result.push({name: g, items: []});
                }
                result[groupIndex.get(g)].items.push({name: row.name, path: row.path});
            }
        }
        for (const [g, items] of Object.entries(specialItems)) {
            if (groupIndex.has(g)) {
                result[groupIndex.get(g)].items.push(...items);
            } else {
                groupIndex.set(g, result.length);
                result.push({name: g, items: [...items]});
            }
        }
        return result;
    }

    $: quickLinks = buildQuickLinks(links);
    $: existingGroups = [...new Set(links.map(l => l.group_name?.trim()).filter(Boolean))];

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
    const NEW_GROUP = '__new__'; // 그룹 select 에서 '새 그룹 입력' 선택값

    let linkDialogEl;

    // 새 링크 추가 폼 ('' = 단독, NEW_GROUP = 새 그룹 입력, 그 외 = 기존 그룹명)
    let newGroup = '';
    let newGroupCustom = '';
    let newName = '';
    let newPath = '';

    // 인라인 수정
    let editingId = null;
    let editBuffer = {group: '', groupCustom: '', name: '', path: ''};

    function openLinkDialog() {
        newGroup = '';
        newGroupCustom = '';
        newName = '';
        newPath = '';
        editingId = null;
        linkDialogEl?.showModal();
    }

    // select 값 + 새 그룹 입력값 → 최종 group_name (없으면 null)
    function resolveGroup(sel, custom) {
        if (sel === NEW_GROUP) return custom.trim() || null;
        return sel.trim() || null;
    }

    async function addLink() {
        const group_name = resolveGroup(newGroup, newGroupCustom);
        const name = newName.trim();
        const path = newPath.trim();
        if (!name || !path) return;
        const nextOrder = links.length > 0
            ? Math.max(...links.map(i => i.display_order ?? 0)) + 1
            : 0;
        const {data, error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .insert({group_name, name, path, display_order: nextOrder})
            .select()
            .single();
        if (error) {
            console.error('quick_links insert error:', error);
            return;
        }
        links = [...links, data];
        newGroup = '';
        newGroupCustom = '';
        newName = '';
        newPath = '';
    }

    function startEditLink(item) {
        editingId = item.id;
        editBuffer = {
            group: item.group_name?.trim() || '',
            groupCustom: '',
            name: item.name,
            path: item.path,
        };
    }

    function cancelEditLink() {
        editingId = null;
    }

    async function saveEditLink(id) {
        const group_name = resolveGroup(editBuffer.group, editBuffer.groupCustom);
        const name = editBuffer.name.trim();
        const path = editBuffer.path.trim();
        if (!name || !path) return;
        const {error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .update({group_name, name, path})
            .eq('id', id);
        if (error) {
            console.error('quick_links update error:', error);
            return;
        }
        links = links.map(l => (l.id === id ? {...l, group_name, name, path} : l));
        editingId = null;
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

    // 위(-1)/아래(+1) 순서 이동 → display_order 를 배열 순서로 재부여 후 저장
    async function moveLink(index, dir) {
        const j = index + dir;
        if (j < 0 || j >= links.length) return;
        const arr = [...links];
        [arr[index], arr[j]] = [arr[j], arr[index]];
        arr.forEach((l, i) => (l.display_order = i));
        links = arr;
        try {
            await Promise.all(
                arr.map((l, i) =>
                    supabase.from(QUICK_LINKS_TABLE).update({display_order: i}).eq('id', l.id)
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
                                    <div role="menuitem"><button class="w-full text-left font-medium hover:bg-primary hover:text-primary-content rounded px-3 py-1.5" on:click={() => handleSubItemClick(item)}>{item.name}</button></div>
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

        <div class="flex flex-col gap-2 mb-4 max-h-80 overflow-y-auto">
            {#each links as item, index (item.id)}
                {#if editingId === item.id}
                    <!-- 수정 모드 -->
                    <div class="flex flex-col gap-1 border border-primary/40 bg-primary/5 rounded px-2 py-2">
                        <select class="select select-bordered select-sm w-full" bind:value={editBuffer.group}>
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
                        <input class="input input-bordered input-sm w-full" placeholder="이름" bind:value={editBuffer.name}/>
                        <input class="input input-bordered input-sm w-full" placeholder="https://..." bind:value={editBuffer.path}/>
                        <div class="flex gap-1 justify-end">
                            <button class="btn btn-xs btn-primary" on:click={() => saveEditLink(item.id)}
                                    disabled={!editBuffer.name.trim() || !editBuffer.path.trim()}>저장</button>
                            <button class="btn btn-xs btn-ghost" on:click={cancelEditLink}>취소</button>
                        </div>
                    </div>
                {:else}
                    <!-- 조회 모드 -->
                    <div class="flex gap-2 items-center border border-base-300 rounded px-2 py-2">
                        <div class="flex flex-col text-base-content/40">
                            <button class="leading-none hover:text-primary disabled:opacity-20"
                                    on:click={() => moveLink(index, -1)} disabled={index === 0} title="위로">▲</button>
                            <button class="leading-none hover:text-primary disabled:opacity-20"
                                    on:click={() => moveLink(index, 1)} disabled={index === links.length - 1} title="아래로">▼</button>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                {#if item.group_name?.trim()}
                                    <span class="badge badge-sm badge-neutral shrink-0">{item.group_name}</span>
                                {:else}
                                    <span class="badge badge-sm badge-ghost shrink-0">단독</span>
                                {/if}
                                <span class="font-medium truncate">{item.name}</span>
                            </div>
                            <div class="text-xs opacity-60 truncate">{item.path}</div>
                        </div>
                        <button class="btn btn-xs btn-outline btn-primary" on:click={() => startEditLink(item)}>수정</button>
                        <button class="btn btn-xs btn-outline btn-error" on:click={() => removeLink(item.id)}>삭제</button>
                    </div>
                {/if}
            {/each}
            {#if links.length === 0}
                <div class="text-sm opacity-60 text-center py-4">등록된 링크가 없습니다.</div>
            {/if}
        </div>

        <div class="divider my-2 text-xs">새 링크 추가</div>
        <div class="flex flex-col gap-2">
            <select class="select select-bordered select-sm w-full" bind:value={newGroup}>
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
