<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import CommandPalette from '$lib/components/layout/CommandPalette.svelte';
	import { loadLinks, subscribeLinks } from '$lib/stores/quickLinks.js';
	import { favorites } from '$lib/stores/favorites.js';

	let { children } = $props();

	// 모바일은 오버레이 드로어, 데스크톱은 항상 펼침(햄버거로 접기)
	let mobileOpen = $state(false);
	let desktopCollapsed = $state(false);
	let searchOpen = $state(false);

	onMount(() => {
		favorites.hydrate();
		loadLinks();
		// 다른 사용자가 바로가기 링크를 바꾸면 새로고침 없이 반영
		return subscribeLinks();
	});

	function toggleSidebar() {
		if (window.matchMedia('(min-width: 1024px)').matches) desktopCollapsed = !desktopCollapsed;
		else mobileOpen = !mobileOpen;
	}

	function onWindowKeydown(e) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			searchOpen = !searchOpen;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onkeydown={onWindowKeydown} />

<Toast />
<CommandPalette bind:open={searchOpen} />

<div class="flex min-h-screen bg-base-300 text-base-content">
	{#if mobileOpen}
		<button
			type="button"
			class="fixed inset-0 z-30 cursor-default bg-black/60 lg:hidden"
			aria-label="사이드바 닫기"
			onclick={() => (mobileOpen = false)}
		></button>
	{/if}

	<div
		class="fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
                {mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                {desktopCollapsed ? 'lg:hidden' : ''}"
	>
		<Sidebar onNavigate={() => (mobileOpen = false)} />
	</div>

	<div class="flex min-w-0 flex-1 flex-col">
		<TopBar onToggleSidebar={toggleSidebar} onOpenSearch={() => (searchOpen = true)} />
		<main class="flex-1">
			{@render children?.()}
		</main>
	</div>
</div>
