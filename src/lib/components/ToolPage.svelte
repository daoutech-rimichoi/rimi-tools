<script>
	import { page } from '$app/state';
	import { getTool } from '$lib/config/tools.js';
	import ToolHeader from './ToolHeader.svelte';

	/**
	 * 모든 도구 페이지의 공통 헤더 + 폭 규격.
	 * title / description / tagline 을 넘기지 않으면 도구 레지스트리(tools.js)에서 가져온다.
	 */
	let { title, description, tagline, wide, children } = $props();

	const isWide = $derived(wide ?? getTool(page.url.pathname)?.wide ?? false);
</script>

<!-- 사내 도구라 화면을 넓게 쓰는 편이 낫다. 초광폭 모니터에서만 최대 폭이 걸린다. -->
<div class="mx-auto w-full px-4 py-8 sm:px-6 {isWide ? 'max-w-[1800px]' : 'max-w-3xl'}">
	<ToolHeader {title} {description} {tagline} />
	{@render children?.()}
</div>
