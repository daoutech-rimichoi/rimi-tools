<script>
	import { page } from '$app/state';
	import { getTool } from '$lib/config/tools.js';
	import FavoriteButton from './FavoriteButton.svelte';

	/**
	 * 도구 페이지 공통 헤더. 값을 넘기지 않으면 도구 레지스트리(tools.js)에서 가져온다.
	 * 보통은 ToolPage 가 감싸서 쓰고, 페이지 구조가 특수한 경우에만 직접 사용한다.
	 */
	let { title, description, tagline } = $props();

	const tool = $derived(getTool(page.url.pathname));
	const headline = $derived(title ?? tool?.name ?? '');
	const desc = $derived(description ?? tool?.description ?? '');
	const sub = $derived(tagline ?? tool?.tagline ?? '');
</script>

<!-- 즐겨찾기 하트는 제목 가운데 정렬에 영향을 주지 않도록 오른쪽에 겹쳐 둔다 -->
<header class="relative mb-8 text-center">
	<h1 class="text-3xl font-semibold tracking-tight">{headline}</h1>
	{#if tool}
		<FavoriteButton path={tool.path} class="absolute top-0 right-0" />
	{/if}
	<div class="mx-auto mt-3 h-px w-40 bg-base-content/25"></div>
	{#if desc}
		<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-base-content/60">{desc}</p>
	{/if}
	{#if sub}
		<p class="mt-1.5 text-sm text-accent">{sub}</p>
	{/if}
</header>
