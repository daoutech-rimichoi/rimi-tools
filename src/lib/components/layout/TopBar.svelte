<script>
	import { browser } from '$app/environment';
	import Icon from '../Icon.svelte';

	let { onToggleSidebar, onOpenSearch } = $props();

	// Mac 이면 ⌘, 그 외에는 Ctrl 로 표기 (SSR 에서는 Ctrl)
	const isMac = $derived(browser && /Mac|iPhone|iPad/.test(navigator.userAgent));
</script>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-base-100 bg-base-300/85 px-3 py-2.5 backdrop-blur sm:px-4"
>
	<button
		type="button"
		class="btn btn-square btn-ghost btn-sm"
		aria-label="사이드바 열고 닫기"
		onclick={onToggleSidebar}
	>
		<Icon name="menu" size={20} />
	</button>

	<a href="/" class="btn btn-square btn-ghost btn-sm" aria-label="홈으로">
		<Icon name="home" size={19} />
	</a>

	<button
		type="button"
		class="flex h-9 max-w-lg flex-1 items-center gap-2 rounded-field border border-base-100 bg-base-200 px-3 text-sm text-base-content/45 transition-colors hover:border-primary/40 hover:text-base-content/70"
		onclick={onOpenSearch}
	>
		<Icon name="search" size={16} />
		<span>도구·링크 검색</span>
		<kbd class="ml-auto kbd kbd-sm">{isMac ? '⌘' : 'Ctrl'} + K</kbd>
	</button>
</header>
