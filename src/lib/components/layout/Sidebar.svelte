<script>
	import { page } from '$app/state';
	import { TOOL_CATEGORIES, getTool } from '$lib/config/tools.js';
	import { favorites } from '$lib/stores/favorites.js';
	import Icon from '../Icon.svelte';
	import QuickLinks from './QuickLinks.svelte';

	let { onNavigate } = $props();

	// 카테고리 접기/펼치기 (기본 펼침)
	let collapsed = $state({});
	// note 안내 말풍선을 띄울 카테고리 (마우스오버 / 키보드 포커스)
	let tipCategoryId = $state(null);

	const favoriteTools = $derived($favorites.map(getTool).filter(Boolean));
	const currentPath = $derived(page.url.pathname);
</script>

<aside class="flex h-full w-64 flex-col border-r border-base-100 bg-base-200">
	<!-- 브랜드 -->
	<a
		href="/"
		class="relative block shrink-0 overflow-hidden bg-gradient-to-br from-primary to-accent px-5 pt-6 pb-9"
	>
		<h1 class="text-xl font-bold tracking-widest text-primary-content">RIMI · TOOLS</h1>
		<p class="mt-1 text-xs text-primary-content/75">시스템코어개발팀 업무 도구 모음</p>
		<svg
			class="absolute inset-x-0 bottom-0 h-6 w-full text-base-200"
			viewBox="0 0 100 20"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<path d="M0 12c25 10 45-10 70-4 12 3 22 6 30 4v8H0z" fill="currentColor" />
		</svg>
	</a>

	<!-- 도구 메뉴: 이 영역만 스크롤 -->
	<nav class="min-h-0 flex-1 overflow-y-auto px-3 py-4">
		{#if favoriteTools.length > 0}
			<section class="mb-5">
				<div
					class="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold tracking-wide text-base-content/40"
				>
					<Icon name="heart" size={13} filled />
					<span>즐겨찾기</span>
				</div>
				<div class="flex flex-col gap-0.5">
					{#each favoriteTools as tool (tool.path)}
						<a
							href={tool.path}
							onclick={onNavigate}
							class="flex items-center gap-2.5 rounded-field px-2.5 py-2 text-sm transition-colors {currentPath ===
							tool.path
								? 'bg-primary/15 font-medium text-primary'
								: 'text-base-content/75 hover:bg-base-100'}"
						>
							<Icon name={tool.icon} size={17} class="shrink-0" />
							<span class="truncate">{tool.name}</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#each TOOL_CATEGORIES as category (category.id)}
			<section class="mb-4">
				<!-- note 가 있으면 마우스오버 시 말풍선으로 안내 (스크롤 영역이라 라벨 아래에 표시) -->
				<div class="relative">
					<button
						type="button"
						class="mb-1.5 flex w-full items-center gap-1 px-2 text-xs font-semibold tracking-wide text-base-content/40 transition-colors hover:text-base-content/70"
						onclick={() => (collapsed = { ...collapsed, [category.id]: !collapsed[category.id] })}
						onmouseenter={() => (tipCategoryId = category.id)}
						onmouseleave={() => (tipCategoryId = null)}
						onfocus={() => (tipCategoryId = category.id)}
						onblur={() => (tipCategoryId = null)}
					>
						<span
							class="transition-transform duration-150 {collapsed[category.id] ? '' : 'rotate-90'}"
						>
							<Icon name="chevron" size={12} />
						</span>
						<span>{category.name}</span>
					</button>
					{#if category.note && tipCategoryId === category.id}
						<div class="tip-bubble" role="tooltip">
							<div class="tip-arrow"></div>
							{category.note}
						</div>
					{/if}
				</div>

				{#if !collapsed[category.id]}
					<div class="flex flex-col gap-0.5">
						{#each category.tools as tool (tool.path)}
							<a
								href={tool.path}
								onclick={onNavigate}
								class="flex items-center gap-2.5 rounded-field px-2.5 py-2 text-sm transition-colors {currentPath ===
								tool.path
									? 'bg-primary/15 font-medium text-primary'
									: 'text-base-content/75 hover:bg-base-100'}"
							>
								<Icon name={tool.icon} size={17} class="shrink-0" />
								<span class="truncate">{tool.name}</span>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</nav>

	<!-- 바로가기 링크: 스크롤 없이 하단 고정 -->
	<div class="shrink-0 border-t border-base-100 px-3 py-3">
		<QuickLinks />
	</div>
</aside>

<style>
	.tip-bubble {
		position: absolute;
		top: 100%;
		left: 0.5rem;
		right: 0.5rem;
		z-index: 60;
		padding: 6px 10px;
		border-radius: 6px;
		background: rgba(20, 20, 24, 0.96);
		color: #fff;
		font-size: 0.75rem;
		line-height: 1.4;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		pointer-events: none;
		animation: tip-in 0.15s ease;
	}

	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	.tip-arrow {
		position: absolute;
		top: -5px;
		left: 14px;
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-bottom: 5px solid rgba(20, 20, 24, 0.96);
	}
</style>
