<script>
	import { goto } from '$app/navigation';
	import { TOOLS } from '$lib/config/tools.js';
	import { links } from '$lib/stores/quickLinks.js';
	import { REDMINE_ISSUE_URL } from '$lib/config/quickLinks.js';
	import { flattenForSearch } from '$lib/utils/quickLinkTree.js';
	import Icon from '../Icon.svelte';

	let { open = $bindable(false) } = $props();

	let query = $state('');
	let cursor = $state(0);
	let inputEl = $state(null);
	let listEl = $state(null);

	const toolEntries = $derived(
		TOOLS.map((tool) => ({
			kind: 'tool',
			icon: tool.icon,
			name: tool.name,
			sub: tool.categoryName,
			haystack: `${tool.name} ${tool.description} ${tool.categoryName} ${tool.path}`.toLowerCase(),
			path: tool.path,
			external: false
		}))
	);

	const linkEntries = $derived(
		flattenForSearch($links).map((link) => ({
			kind: 'link',
			icon: 'external',
			name: link.name,
			sub: link.group || '바로가기',
			haystack: `${link.name} ${link.group} ${link.path}`.toLowerCase(),
			path: link.path,
			external: true
		}))
	);

	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const matched = [...toolEntries, ...linkEntries].filter(
			(entry) => !q || entry.haystack.includes(q)
		);
		// 숫자만 입력하면 Redmine 일감 바로가기를 최상단에 제안
		if (/^\d+$/.test(q)) {
			matched.unshift({
				kind: 'issue',
				icon: 'ticket',
				name: `Redmine 일감 #${q} 열기`,
				sub: 'Redmine',
				path: `${REDMINE_ISSUE_URL}${q}`,
				external: true
			});
		}
		return matched.slice(0, 30);
	});

	// 검색어가 바뀌면 선택 위치를 처음으로
	$effect(() => {
		query;
		cursor = 0;
	});

	$effect(() => {
		if (open) {
			query = '';
			cursor = 0;
			inputEl?.focus();
		}
	});

	// 키보드로 이동할 때 선택 항목이 보이도록 스크롤
	$effect(() => {
		listEl?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	function run(entry) {
		if (!entry) return;
		open = false;
		if (entry.external) window.open(entry.path, '_blank');
		else goto(entry.path);
	}

	function onKeydown(e) {
		if (e.key === 'Escape') {
			open = false;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			cursor = results.length === 0 ? 0 : (cursor + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			cursor = results.length === 0 ? 0 : (cursor - 1 + results.length) % results.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			run(results[cursor]);
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
			aria-label="검색 닫기"
			onclick={() => (open = false)}
		></button>

		<div
			class="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-box border border-base-100 bg-base-200 shadow-2xl"
		>
			<div class="flex items-center gap-3 border-b border-base-100 px-4">
				<Icon name="search" size={18} class="shrink-0 text-base-content/40" />
				<input
					bind:this={inputEl}
					bind:value={query}
					onkeydown={onKeydown}
					type="text"
					autocomplete="off"
					placeholder="도구 이름, 바로가기 링크, 일감 번호…"
					class="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-base-content/30"
				/>
				<kbd class="kbd kbd-sm">ESC</kbd>
			</div>

			<div bind:this={listEl} class="flex-1 overflow-y-auto p-2">
				{#each results as entry, i (entry.kind + entry.path)}
					<button
						type="button"
						data-index={i}
						class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors {i ===
						cursor
							? 'bg-primary/15 text-primary'
							: 'text-base-content/80 hover:bg-base-100'}"
						onmouseenter={() => (cursor = i)}
						onclick={() => run(entry)}
					>
						<Icon name={entry.icon} size={18} class="shrink-0" />
						<span class="truncate text-sm">{entry.name}</span>
						<span class="ml-auto shrink-0 text-xs text-base-content/35">{entry.sub}</span>
					</button>
				{:else}
					<p class="px-3 py-8 text-center text-sm text-base-content/40">검색 결과가 없습니다.</p>
				{/each}
			</div>

			<div
				class="flex items-center gap-3 border-t border-base-100 px-4 py-2 text-[11px] text-base-content/35"
			>
				<span><kbd class="kbd kbd-xs">↑</kbd> <kbd class="kbd kbd-xs">↓</kbd> 이동</span>
				<span><kbd class="kbd kbd-xs">↵</kbd> 열기</span>
				<span class="ml-auto">숫자만 입력하면 Redmine 일감으로 이동</span>
			</div>
		</div>
	</div>
{/if}
