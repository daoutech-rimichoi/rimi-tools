<script>
	import { TOOL_CATEGORIES, getTool } from '$lib/config/tools.js';
	import { favorites } from '$lib/stores/favorites.js';
	import ToolCard from '$lib/components/ToolCard.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const favoriteTools = $derived($favorites.map(getTool).filter(Boolean));
</script>

<div class="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6">
	<section
		class="mb-10 flex flex-col gap-2 rounded-box bg-gradient-to-br from-primary to-accent p-6 text-primary-content sm:max-w-md"
	>
		<Icon name="tool" size={28} />
		<h2 class="mt-1 text-xl font-semibold">업무용 도구 모음</h2>
		<p class="text-sm text-primary-content/80">
			아래 카드에서 도구를 고르거나, 어디서든
			<kbd class="mx-0.5 kbd kbd-sm text-base-content">⌘/Ctrl + K</kbd>
			로 바로 검색하세요.
		</p>
	</section>

	{#if favoriteTools.length > 0}
		<section class="mb-10">
			<h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-base-content/45">
				<Icon name="heart" size={15} filled />
				즐겨찾기
			</h2>
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{#each favoriteTools as tool (tool.path)}
					<ToolCard {tool} />
				{/each}
			</div>
		</section>
	{/if}

	{#each TOOL_CATEGORIES as category (category.id)}
		<section class="mb-10">
			<h2 class="mb-1 text-sm font-semibold text-base-content/45">{category.name}</h2>
			{#if category.note}
				<p class="mb-3 text-xs text-base-content/30">{category.note}</p>
			{:else}
				<div class="mb-3"></div>
			{/if}
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{#each category.tools as tool (tool.path)}
					<ToolCard {tool} />
				{/each}
			</div>
		</section>
	{/each}
</div>
