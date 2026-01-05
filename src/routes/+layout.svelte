<script>
    import '../app.css';
    import favicon from '$lib/assets/favicon.svg';
    import {page} from '$app/state';
    import Toast from '$lib/components/Toast.svelte';

    const menus = [
        {
            category: '현황판',
            items: [
                {name: '개발장비 사용 현황', path: '/statusSharing/devServer'},
                {name: '검수장비 사용 현황', path: '/statusSharing/stgServer'},
            ]
        },
        {
            category: '문장완성',
            items: [
                {name: '배포 현황 공유 양식', path: '/statusSharing/deployment-status-sharing-form'},
                {name: '배포 현황 공유 양식2', path: '/statusSharing/deployment-status-sharing-form-v2'},
            ]
        },
        {
            category: 'JIRA',
            desc: '입력 시 "텍스트" 모드에서 붙여넣으세염',
            items: [
                {name: 'L4 작업 요청 양식', path: '/jira/l4-request-form'},
                {name: '배포 요청 양식', path: '/jira/deployment-request-form'},
                {name: '코멘트 양식', path: '/jira/comment-form'},
                {name: 'DB 업무 요청 양식', path: '/jira/db-request-form'},
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
            category: '바로가기 링크',
            type: 'link',
            items: [
                {
                    name: 'Redmine', path: 'https://buly.kr/FsJakS2'
                },
                {name: 'Jenkins - 개발', path: 'https://zrr.kr/u64YGw'},
                {name: 'Jenkins - 검수', path: 'https://zrr.kr/DSkoA0'},
                {
                    name: 'SharePoint - 시코팀',
                    path: 'https://buly.kr/2qZWA4P'
                },
                {
                    name: 'SharePoint - 일일점검',
                    path: 'https://buly.kr/AwgNHam'
                },
                {
                    name: '서비스운영팀 - 주차별 배포 예정 현황',
                    path: 'https://buly.kr/2felBGG'
                },
            ]
        },
    ];

</script>

<svelte:head>
    <link rel="icon" href={favicon}/>
</svelte:head>

<Toast/>

<div class="drawer lg:drawer-open">
    <input id="my-drawer-2" type="checkbox" class="drawer-toggle"/>
    <div class="drawer-content flex flex-col items-center justify-center">
        <!-- Page content here -->
        <slot/>
        <label for="my-drawer-2" class="drawer-button btn btn-primary lg:hidden">Open drawer</label>
    </div>
    <div class="drawer-side">
        <label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
        <ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content flex flex-col">
            <!-- Sidebar content here -->
            {#each menus as group (group.category)}
                <li class="menu-title relative group cursor-default {group.type === 'link' ? 'mt-auto' : ''}">
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
                                target={group.type === 'link' ? '_blank' : null}
                                rel={group.type === 'link' ? 'noopener noreferrer' : null}
                                data-sveltekit-reload>{menu.name}</a>
                    </li>
                {/each}
            {/each}
        </ul>
    </div>
</div>

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