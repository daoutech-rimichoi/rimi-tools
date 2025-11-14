<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	const menus = [
		{
			name: '배포 요청 양식',
			path: '/deployment-request-form'
		},
		{
			name: 'L4 작업 요청 양식',
			path: '/l4-request-form'
		},
		{
			name: 'JIRA 코멘트 양식',
			path: '/jira-comment-form'
		},
		{
			name: '배포 현황 공유 양식',
			path: '/deployment-status-sharing-form'
		},
		{
			name: 'DB 업무 요청 양식',
			path: '/db-request-form'
		}
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="drawer lg:drawer-open">
	<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col items-center justify-center">
		<!-- Page content here -->
		<slot />
		<label for="my-drawer-2" class="drawer-button btn btn-primary lg:hidden">Open drawer</label>
	</div>
	<div class="drawer-side">
		<label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
			<!-- Sidebar content here -->
			{#each menus as menu (menu.name)}
				<li>
					<a
						href={menu.path}
						class:menu-active={page.url.pathname.startsWith(menu.path)}
						data-sveltekit-reload>{menu.name}</a
					>
				</li>
			{/each}
		</ul>
	</div>
</div>
