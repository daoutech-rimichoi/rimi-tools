<script>
	import {
		addLink,
		existingGroups,
		links,
		manageRows,
		moveNode,
		removeLink,
		renameGroup,
		subGroupsByGroup,
		updateLink
	} from '$lib/stores/quickLinks.js';

	let dialog;

	const NEW_GROUP = '__new__'; // 그룹 select 에서 '새 그룹 입력' 선택값
	const NEW_SUB = '__new_sub__'; // 서브그룹 select 에서 '새 서브그룹 입력' 선택값

	// 새 링크 추가 폼 ('' = 단독/서브그룹 없음, NEW_* = 새로 입력, 그 외 = 기존 이름)
	let newGroup = $state('');
	let newGroupCustom = $state('');
	let newSub = $state('');
	let newSubCustom = $state('');
	let newName = $state('');
	let newPath = $state('');

	// 링크 인라인 수정
	let editingId = $state(null);
	let editBuffer = $state({
		group: '',
		groupCustom: '',
		sub: '',
		subCustom: '',
		name: '',
		path: ''
	});

	// 그룹 / 서브그룹 이름 변경
	let editingGroup = $state(null); // {kind, name, groupName} 헤더 노드 식별용
	let groupNameBuffer = $state('');

	export function open() {
		newGroup = '';
		newGroupCustom = '';
		newSub = '';
		newSubCustom = '';
		newName = '';
		newPath = '';
		editingId = null;
		editingGroup = null;
		dialog?.showModal();
	}

	function subGroupOptions(group) {
		return $subGroupsByGroup[group] ?? [];
	}

	// select 값 + 새 이름 입력값 → 최종 이름 (없으면 null)
	function resolveName(sel, custom, newSentinel) {
		if (sel === newSentinel) return custom.trim() || null;
		return sel.trim() || null;
	}

	const resolveGroup = (sel, custom) => resolveName(sel, custom, NEW_GROUP);
	// 그룹이 없으면(단독) 서브그룹은 무의미하므로 항상 null
	const resolveSub = (group, sel, custom) => (group ? resolveName(sel, custom, NEW_SUB) : null);

	function isEditingGroup(current, node) {
		return (
			current?.kind === node.kind &&
			current?.name === node.name &&
			current?.groupName === node.groupName
		);
	}

	async function submitNewLink() {
		const group_name = resolveGroup(newGroup, newGroupCustom);
		const sub_group_name = resolveSub(group_name, newSub, newSubCustom);
		const name = newName.trim();
		const path = newPath.trim();
		if (!name || !path) return;

		const ok = await addLink({ group_name, sub_group_name, name, path });
		if (!ok) return;

		// 연속 추가 편의를 위해 그룹/서브그룹 선택은 유지
		newGroup = group_name ?? '';
		newGroupCustom = '';
		newSub = sub_group_name ?? '';
		newSubCustom = '';
		newName = '';
		newPath = '';
	}

	function startEditLink(row) {
		editingId = row.id;
		editingGroup = null;
		editBuffer = {
			group: row.group_name?.trim() || '',
			groupCustom: '',
			sub: row.sub_group_name?.trim() || '',
			subCustom: '',
			name: row.name,
			path: row.path
		};
	}

	async function saveEditLink(id) {
		const group_name = resolveGroup(editBuffer.group, editBuffer.groupCustom);
		const sub_group_name = resolveSub(group_name, editBuffer.sub, editBuffer.subCustom);
		const name = editBuffer.name.trim();
		const path = editBuffer.path.trim();
		if (!name || !path) return;
		if (await updateLink(id, { group_name, sub_group_name, name, path })) editingId = null;
	}

	function startEditGroup(node) {
		editingId = null;
		editingGroup = { kind: node.kind, name: node.name, groupName: node.groupName };
		groupNameBuffer = node.name;
	}

	async function saveEditGroup(node) {
		const next = groupNameBuffer.trim();
		if (!next || next === node.name) {
			editingGroup = null;
			return;
		}
		await renameGroup(node, next);
		editingGroup = null;
	}

	async function deleteLink(id) {
		if (await removeLink(id)) {
			if (editingId === id) editingId = null;
		}
	}
</script>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box max-w-lg">
		<h3 class="mb-4 text-lg font-bold">링크 관리</h3>

		<!-- 그룹 > 서브그룹 > 링크 계층 목록. ▲▼ 는 같은 계층(형제)끼리만 이동한다. -->
		<div class="mb-4 flex max-h-96 flex-col gap-1 overflow-y-auto">
			{#each $manageRows as node (node.kind === 'link' ? node.row.id : `${node.kind}-${node.path.join('-')}`)}
				<div class="flex items-start gap-2" style="margin-left: {node.depth * 1.25}rem">
					<div class="flex shrink-0 flex-col pt-1 text-base-content/40">
						<button
							class="leading-none hover:text-primary disabled:opacity-20"
							onclick={() => moveNode(node.path, -1)}
							disabled={node.index === 0}
							title="위로"
							>▲
						</button>
						<button
							class="leading-none hover:text-primary disabled:opacity-20"
							onclick={() => moveNode(node.path, 1)}
							disabled={node.index === node.siblings - 1}
							title="아래로"
							>▼
						</button>
					</div>

					{#if node.kind !== 'link'}
						<!-- 그룹 / 서브그룹 헤더 (하위 항목과 함께 이동, 이름 변경 가능) -->
						<div class="flex min-w-0 flex-1 items-center gap-2 py-1">
							<span
								class="badge shrink-0 badge-sm {node.kind === 'group'
									? 'badge-neutral'
									: 'badge-outline'}"
							>
								{node.kind === 'group' ? '그룹' : '서브'}
							</span>
							{#if isEditingGroup(editingGroup, node)}
								<input
									class="input-bordered input min-w-0 flex-1 input-xs"
									placeholder={node.kind === 'group' ? '그룹 이름' : '서브그룹 이름'}
									bind:value={groupNameBuffer}
									onkeydown={(e) => {
										if (e.key === 'Enter') saveEditGroup(node);
										if (e.key === 'Escape') editingGroup = null;
									}}
								/>
								<button
									class="btn btn-primary btn-xs"
									onclick={() => saveEditGroup(node)}
									disabled={!groupNameBuffer.trim()}
									>저장
								</button>
								<button class="btn btn-ghost btn-xs" onclick={() => (editingGroup = null)}
									>취소</button
								>
							{:else}
								<span class="truncate font-semibold">{node.name}</span>
								<button
									class="btn btn-ghost text-base-content/50 btn-xs"
									title="이름 변경"
									onclick={() => startEditGroup(node)}
									>✎
								</button>
							{/if}
						</div>
					{:else if editingId === node.row.id}
						<!-- 수정 모드 -->
						<div
							class="flex min-w-0 flex-1 flex-col gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-2"
						>
							<select
								class="select-bordered select w-full select-sm"
								bind:value={editBuffer.group}
								onchange={() => (editBuffer = { ...editBuffer, sub: '', subCustom: '' })}
							>
								<option value="">단독 (그룹 없음)</option>
								{#each $existingGroups as g (g)}
									<option value={g}>{g}</option>
								{/each}
								<option value={NEW_GROUP}>+ 새 그룹…</option>
							</select>
							{#if editBuffer.group === NEW_GROUP}
								<input
									class="input-bordered input w-full input-sm"
									placeholder="새 그룹 이름"
									bind:value={editBuffer.groupCustom}
								/>
							{/if}
							{#if editBuffer.group}
								<select class="select-bordered select w-full select-sm" bind:value={editBuffer.sub}>
									<option value="">서브그룹 없음 (그룹 직속)</option>
									{#each subGroupOptions(editBuffer.group) as s (s)}
										<option value={s}>{s}</option>
									{/each}
									<option value={NEW_SUB}>+ 새 서브그룹…</option>
								</select>
								{#if editBuffer.sub === NEW_SUB}
									<input
										class="input-bordered input w-full input-sm"
										placeholder="새 서브그룹 이름"
										bind:value={editBuffer.subCustom}
									/>
								{/if}
							{/if}
							<input
								class="input-bordered input w-full input-sm"
								placeholder="이름"
								bind:value={editBuffer.name}
							/>
							<input
								class="input-bordered input w-full input-sm"
								placeholder="https://..."
								bind:value={editBuffer.path}
							/>
							<div class="flex justify-end gap-1">
								<button
									class="btn btn-primary btn-xs"
									onclick={() => saveEditLink(node.row.id)}
									disabled={!editBuffer.name.trim() || !editBuffer.path.trim()}
									>저장
								</button>
								<button class="btn btn-ghost btn-xs" onclick={() => (editingId = null)}>취소</button
								>
							</div>
						</div>
					{:else}
						<!-- 조회 모드 -->
						<div
							class="flex min-w-0 flex-1 items-center gap-2 rounded border border-base-300 px-2 py-2"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									{#if node.depth === 0}
										<span class="badge shrink-0 badge-ghost badge-sm">단독</span>
									{/if}
									<span class="truncate font-medium">{node.row.name}</span>
								</div>
								<div class="truncate text-xs opacity-60">{node.row.path}</div>
							</div>
							<button
								class="btn btn-outline btn-primary btn-xs"
								onclick={() => startEditLink(node.row)}
								>수정
							</button>
							<button
								class="btn btn-outline btn-error btn-xs"
								onclick={() => deleteLink(node.row.id)}
								>삭제
							</button>
						</div>
					{/if}
				</div>
			{/each}
			{#if $links.length === 0}
				<div class="py-4 text-center text-sm opacity-60">등록된 링크가 없습니다.</div>
			{/if}
		</div>

		<div class="divider my-2 text-xs">새 링크 추가</div>
		<div class="flex flex-col gap-2">
			<select
				class="select-bordered select w-full select-sm"
				bind:value={newGroup}
				onchange={() => {
					newSub = '';
					newSubCustom = '';
				}}
			>
				<option value="">단독 (그룹 없음)</option>
				{#each $existingGroups as g (g)}
					<option value={g}>{g}</option>
				{/each}
				<option value={NEW_GROUP}>+ 새 그룹…</option>
			</select>
			{#if newGroup === NEW_GROUP}
				<input
					class="input-bordered input w-full input-sm"
					placeholder="새 그룹 이름"
					bind:value={newGroupCustom}
					onkeydown={(e) => e.key === 'Enter' && submitNewLink()}
				/>
			{/if}
			{#if newGroup}
				<select class="select-bordered select w-full select-sm" bind:value={newSub}>
					<option value="">서브그룹 없음 (그룹 직속)</option>
					{#each subGroupOptions(newGroup) as s (s)}
						<option value={s}>{s}</option>
					{/each}
					<option value={NEW_SUB}>+ 새 서브그룹…</option>
				</select>
				{#if newSub === NEW_SUB}
					<input
						class="input-bordered input w-full input-sm"
						placeholder="새 서브그룹 이름"
						bind:value={newSubCustom}
						onkeydown={(e) => e.key === 'Enter' && submitNewLink()}
					/>
				{/if}
			{/if}
			<input
				class="input-bordered input w-full input-sm"
				placeholder="이름"
				bind:value={newName}
				onkeydown={(e) => e.key === 'Enter' && submitNewLink()}
			/>
			<input
				class="input-bordered input w-full input-sm"
				placeholder="https://..."
				bind:value={newPath}
				onkeydown={(e) => e.key === 'Enter' && submitNewLink()}
			/>
			<button
				class="btn btn-primary btn-sm"
				onclick={submitNewLink}
				disabled={!newName.trim() || !newPath.trim()}
				>추가
			</button>
		</div>

		<div class="modal-action">
			<button class="btn" onclick={() => dialog?.close()}>닫기</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
