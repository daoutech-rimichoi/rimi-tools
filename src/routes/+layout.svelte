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
    let etcItems = [];

    onMount(async () => {
        await loadEtcItems();
    });

    async function loadEtcItems() {
        const {data, error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .select('*')
            .order('display_order', {ascending: true});
        if (error) {
            console.error('quick_links load error:', error);
            return;
        }
        etcItems = data ?? [];
    }

    $: quickLinks = [
        {
            name: 'Redmine',
            items: [
                {name: '초기화면', path: 'https://buly.kr/FsJakS2'},
                {name: '일감', prompt: true},
            ]
        },
        {
            name: 'Jenkins',
            items: [
                {name: '개발', path: 'https://zrr.kr/u64YGw'},
                {name: '검수', path: 'https://zrr.kr/DSkoA0'},
            ]
        },
        {
            name: 'GoogleDrive',
            items: [
                {name: '시코팀', path: 'https://drive.google.com/drive/u/1/folders/0AMJi1znV6czKUk9PVA'},
            ]
        },
        {
            name: 'ClipShare', path: 'https://clipshare.bizppurio.com:9875/'
        },
        {
            name: '기타',
            items: etcItems,
            editable: true,
        },
    ];

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

    // --- 기타 링크 관리 다이얼로그 ---
    let etcDialogEl;
    let newName = '';
    let newPath = '';

    function openEtcDialog() {
        newName = '';
        newPath = '';
        etcDialogEl?.showModal();
    }

    async function addEtcItem() {
        const name = newName.trim();
        const path = newPath.trim();
        if (!name || !path) return;
        const nextOrder = etcItems.length > 0
            ? Math.max(...etcItems.map(i => i.display_order ?? 0)) + 1
            : 0;
        const {data, error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .insert({name, path, display_order: nextOrder})
            .select()
            .single();
        if (error) {
            console.error('quick_links insert error:', error);
            return;
        }
        etcItems = [...etcItems, data];
        newName = '';
        newPath = '';
    }

    async function removeEtcItem(id) {
        const {error} = await supabase
            .from(QUICK_LINKS_TABLE)
            .delete()
            .eq('id', id);
        if (error) {
            console.error('quick_links delete error:', error);
            return;
        }
        etcItems = etcItems.filter(i => i.id !== id);
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
            <li class="menu-title mt-auto cursor-default"><span>바로가기 링크</span></li>
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
                                {#if link.editable}
                                    <div class="divider my-0.5"></div>
                                    <div role="menuitem"><button class="w-full text-left text-sm opacity-70 hover:bg-primary hover:text-primary-content hover:opacity-100 rounded px-3 py-1.5" on:click={openEtcDialog}>+ 링크 관리</button></div>
                                {/if}
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

<dialog bind:this={etcDialogEl} class="modal">
    <div class="modal-box">
        <h3 class="mb-4 font-bold text-lg">기타 링크 관리</h3>

        <div class="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
            {#each etcItems as item (item.id)}
                <div class="flex gap-2 items-center border border-base-300 rounded px-3 py-2">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">{item.name}</div>
                        <div class="text-xs opacity-60 truncate">{item.path}</div>
                    </div>
                    <button class="btn btn-sm btn-error btn-outline" on:click={() => removeEtcItem(item.id)}>삭제</button>
                </div>
            {/each}
            {#if etcItems.length === 0}
                <div class="text-sm opacity-60 text-center py-4">등록된 링크가 없습니다.</div>
            {/if}
        </div>

        <div class="divider my-2 text-xs">새 링크 추가</div>
        <div class="flex flex-col gap-2">
            <input class="input input-bordered input-sm w-full" placeholder="이름" bind:value={newName}
                   on:keydown={(e) => e.key === 'Enter' && addEtcItem()}/>
            <input class="input input-bordered input-sm w-full" placeholder="https://..." bind:value={newPath}
                   on:keydown={(e) => e.key === 'Enter' && addEtcItem()}/>
            <button class="btn btn-sm btn-primary" on:click={addEtcItem}
                    disabled={!newName.trim() || !newPath.trim()}>추가
            </button>
        </div>

        <div class="modal-action">
            <button class="btn" on:click={() => etcDialogEl?.close()}>닫기</button>
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
