<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { links } from '$lib/stores/quickLinks.js';
	import { buildQuickLinks } from '$lib/utils/quickLinkTree.js';
	import { REDMINE_ISSUE_URL, SPECIAL_QUICK_LINKS } from '$lib/config/quickLinks.js';
	import Icon from '../Icon.svelte';
	import QuickLinkManagerDialog from './QuickLinkManagerDialog.svelte';

	// 사이드바 하단 고정 영역이라 접으면 그만큼 도구 메뉴가 넓어진다.
	// 기본은 접힘이고, 사용자가 편 상태는 새로고침해도 유지되도록 저장한다.
	const COLLAPSE_KEY = 'rimi-tools:quick-links-collapsed';

	let managerDialog;
	let issueDialogEl;
	let issueNum = $state('');
	let collapsed = $state(true);

	const tree = $derived(buildQuickLinks($links, SPECIAL_QUICK_LINKS));

	onMount(() => {
		// 저장된 값이 없으면 기본값(접힘) 유지
		collapsed = localStorage.getItem(COLLAPSE_KEY) !== '0';
	});

	function toggleCollapsed() {
		collapsed = !collapsed;
		if (browser) localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
	}

	function handleItemClick(item) {
		if (item.prompt) {
			issueNum = '';
			issueDialogEl?.showModal();
		} else {
			window.open(item.path, '_blank');
		}
	}

	function confirmIssue() {
		const trimmed = String(issueNum).trim();
		if (!trimmed) return;
		window.open(`${REDMINE_ISSUE_URL}${trimmed}`, '_blank');
		issueDialogEl?.close();
	}
</script>

<div>
	<div class="mb-2 flex items-center gap-1 px-2 text-xs font-semibold tracking-wide">
		<button
			type="button"
			class="flex flex-1 items-center gap-1 text-base-content/40 transition-colors hover:text-base-content/70"
			aria-expanded={!collapsed}
			title={collapsed ? '펼치기' : '접기'}
			onclick={toggleCollapsed}
		>
			<span class="transition-transform duration-150 {collapsed ? '' : 'rotate-90'}">
				<Icon name="chevron" size={12} />
			</span>
			<span>바로가기 링크</span>
			{#if collapsed && tree.length > 0}
				<span class="ml-1 font-normal text-base-content/30">{tree.length}</span>
			{/if}
		</button>
		<button
			type="button"
			class="rounded p-0.5 text-base-content/40 transition-colors hover:text-base-content/70"
			aria-label="링크 관리"
			title="링크 관리"
			onclick={() => managerDialog?.open()}
		>
			<Icon name="sliders" size={14} />
		</button>
	</div>

	<div class="flex flex-col gap-1" class:hidden={collapsed}>
		{#each tree as link (link.name)}
			{#if link.path}
				<button
					class="flex items-center gap-2 rounded-field border border-base-100 px-3 py-2 text-left text-sm text-base-content/80 transition-colors hover:border-primary/40 hover:bg-base-100"
					onclick={() => window.open(link.path, '_blank')}
				>
					<span class="truncate">{link.name}</span>
					<Icon name="external" size={13} class="ml-auto shrink-0 opacity-40" />
				</button>
			{:else}
				<div class="dropdown dropdown-right dropdown-end">
					<button
						tabindex="0"
						class="flex w-full items-center gap-2 rounded-field border border-base-100 px-3 py-2 text-left text-sm text-base-content/80 transition-colors hover:border-primary/40 hover:bg-base-100"
					>
						<Icon name="folder" size={15} class="shrink-0 opacity-50" />
						<span class="truncate">{link.name}</span>
						<Icon name="chevron" size={13} class="ml-auto shrink-0 opacity-40" />
					</button>
					<div
						tabindex="0"
						role="menu"
						class="menu dropdown-content z-50 w-max min-w-52 rounded-box border border-base-100 bg-base-100 p-1 shadow-lg"
					>
						{#each link.items as item (item.name)}
							{#if item.items}
								<!-- 3단: 서브그룹 → 링크 (2단과 동일하게 클릭/focus 로 펼침) -->
								<div class="dropdown dropdown-right w-full">
									<button
										tabindex="0"
										class="flex w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-primary hover:text-primary-content"
									>
										<span class="truncate">{item.name}</span>
										<Icon name="chevron" size={13} class="shrink-0 opacity-50" />
									</button>
									<div
										tabindex="0"
										role="menu"
										class="menu dropdown-content z-50 w-max max-w-96 min-w-52 rounded-box border border-base-100 bg-base-100 p-1 shadow-lg"
									>
										{#each item.items as leaf (leaf.name)}
											<div role="menuitem">
												<button
													class="w-full rounded px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-primary hover:text-primary-content"
													onclick={() => handleItemClick(leaf)}>{leaf.name}</button
												>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<div role="menuitem">
									<button
										class="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-primary hover:text-primary-content"
										onclick={() => handleItemClick(item)}>{item.name}</button
									>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>

<QuickLinkManagerDialog bind:this={managerDialog} />

<dialog bind:this={issueDialogEl} class="modal">
	<div class="modal-box">
		<h3 class="mb-4 text-lg font-bold">Redmine 일감 번호 입력</h3>
		<input
			type="number"
			class="input-bordered input w-full"
			placeholder="일감 번호"
			bind:value={issueNum}
			onkeydown={(e) => e.key === 'Enter' && confirmIssue()}
		/>
		<div class="modal-action">
			<button class="btn" onclick={() => issueDialogEl?.close()}>취소</button>
			<button class="btn btn-primary" onclick={confirmIssue} disabled={!issueNum}>이동</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
