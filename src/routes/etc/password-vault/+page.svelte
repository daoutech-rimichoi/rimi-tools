<script>
    import {onDestroy} from 'svelte';
    import {supabase} from '$lib/supabaseClient.js';
    import {copyToClipboard} from '$lib/utils/clipboard.js';

    const CORRECT_PASSWORD = 'tlzhqlqjs123@!';
    const AUTH_TTL = 3 * 60 * 1000; // 3분
    const TABLE = 'password_vault';
    const GROUP_TABLE = 'password_vault_groups';

    let expireTimer = null;

    let isAuthenticated = $state(false);
    let passwordInput = $state('');
    let authError = $state('');
    let isLoading = $state(false);
    let isSaving = $state(false);

    // 토스트
    let toastMessage = $state('');
    let toastType = $state('success');
    let showToast = $state(false);

    function showToastMessage(message, type = 'success') {
        toastMessage = message;
        toastType = type;
        showToast = true;
        setTimeout(() => (showToast = false), 3000);
    }

    // 그룹
    let groups = $state([]);
    let selectedGroupId = $state(null); // null = 전체
    let newGroupName = $state('');
    let createGroupDialogEl;
    let deleteGroupTargetId = $state(null);
    let deleteGroupDialogEl;
    let editGroupTarget = $state(null); // {id, name}
    let editGroupDialogEl;
    let draggedGroup = $state(null);

    function handleGroupDragStart(e, index) {
        draggedGroup = index;
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleGroupDragEnd() {
        draggedGroup = null;
    }

    function handleGroupDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    async function handleGroupDrop(e, targetIndex) {
        e.preventDefault();
        if (draggedGroup === null || draggedGroup === targetIndex) return;

        const reordered = [...groups];
        const [removed] = reordered.splice(draggedGroup, 1);
        reordered.splice(targetIndex, 0, removed);
        groups = reordered;
        draggedGroup = null;

        try {
            await Promise.all(
                reordered.map((g, index) =>
                    supabase.from(GROUP_TABLE).update({display_order: index}).eq('id', g.id)
                )
            );
        } catch (e) {
            showToastMessage('그룹 순서 저장 실패: ' + e.message, 'error');
        }
    }

    async function loadGroups() {
        const {data, error} = await supabase
            .from(GROUP_TABLE)
            .select('*')
            .order('display_order', {ascending: true});
        if (!error && data) groups = data;
    }

    async function createGroup() {
        if (!newGroupName.trim()) return;
        isSaving = true;
        try {
            const {error} = await supabase.from(GROUP_TABLE).insert({
                name: newGroupName.trim(),
                display_order: groups.length,
            });
            if (error) throw error;
            newGroupName = '';
            createGroupDialogEl?.close();
            await loadGroups();
            showToastMessage('그룹이 생성됐습니다.');
        } catch (e) {
            showToastMessage('그룹 생성 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function openEditGroupDialog(g) {
        editGroupTarget = {id: g.id, name: g.name};
        editGroupDialogEl?.showModal();
    }

    async function saveEditGroup() {
        if (!editGroupTarget?.name.trim()) return;
        isSaving = true;
        try {
            const {error} = await supabase
                .from(GROUP_TABLE)
                .update({name: editGroupTarget.name.trim()})
                .eq('id', editGroupTarget.id);
            if (error) throw error;
            editGroupDialogEl?.close();
            editGroupTarget = null;
            await loadGroups();
            showToastMessage('그룹명이 수정됐습니다.');
        } catch (e) {
            showToastMessage('그룹 수정 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function openDeleteGroupDialog(id) {
        deleteGroupTargetId = id;
        deleteGroupDialogEl?.showModal();
    }

    async function deleteGroup() {
        isSaving = true;
        try {
            const {error} = await supabase.from(GROUP_TABLE).delete().eq('id', deleteGroupTargetId);
            if (error) throw error;
            if (selectedGroupId === deleteGroupTargetId) selectedGroupId = null;
            deleteGroupDialogEl?.close();
            deleteGroupTargetId = null;
            await Promise.all([loadData(), loadGroups()]);
            showToastMessage('그룹이 삭제됐습니다.');
        } catch (e) {
            showToastMessage('그룹 삭제 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function getGroupName(groupId) {
        return groups.find((g) => g.id === groupId)?.name ?? '-';
    }

    // 데이터
    let rows = $state([]);
    let editingIds = $state(new Set());
    let editBuffers = $state(new Map());
    let newRows = $state(null);
    let revealedIds = $state(new Set());

    let filteredRows = $derived(
        selectedGroupId === null ? rows : rows.filter((r) => r.group_id === selectedGroupId)
    );

    // 드래그앤드롭 (전체 보기일 때만 활성화)
    let draggedItem = $state(null);

    function handleDragStart(e, index) {
        draggedItem = index;
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd() {
        draggedItem = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    async function handleDrop(e, targetIndex) {
        e.preventDefault();
        if (draggedItem === null || draggedItem === targetIndex) return;

        const newRowsArr = [...rows];
        const [removed] = newRowsArr.splice(draggedItem, 1);
        newRowsArr.splice(targetIndex, 0, removed);
        rows = newRowsArr;
        draggedItem = null;

        await saveOrder(newRowsArr);
    }

    async function saveOrder(orderedRows) {
        try {
            await Promise.all(
                orderedRows.map((row, index) =>
                    supabase.from(TABLE).update({display_order: index}).eq('id', row.id)
                )
            );
        } catch (e) {
            showToastMessage('순서 저장 실패: ' + e.message, 'error');
        }
    }

    // 삭제 다이얼로그
    let deleteTargetId = $state(null);
    let deleteDialogEl;

    function scheduleExpiry(delay) {
        clearTimeout(expireTimer);
        expireTimer = setTimeout(() => {
            isAuthenticated = false;
            passwordInput = '';
        }, delay);
    }

    function authenticate() {
        if (passwordInput === CORRECT_PASSWORD) {
            isAuthenticated = true;
            authError = '';
            scheduleExpiry(AUTH_TTL);
            loadAll();
        } else {
            authError = '삐빅. 탈락입니다.';
        }
    }

    async function loadAll() {
        await Promise.all([loadData(), loadGroups()]);
    }

    async function loadData() {
        isLoading = true;
        try {
            const {data, error} = await supabase
                .from(TABLE)
                .select('*')
                .order('display_order', {ascending: true})
                .order('category', {ascending: true});

            if (error) throw error;
            rows = data ?? [];
        } catch (e) {
            showToastMessage('데이터 로드 실패: ' + e.message, 'error');
        } finally {
            isLoading = false;
        }
    }

    function startEdit(row) {
        const next = new Set(editingIds);
        next.add(row.id);
        editingIds = next;
        const map = new Map(editBuffers);
        map.set(row.id, {...row});
        editBuffers = map;
    }

    function cancelEdit(id) {
        const next = new Set(editingIds);
        next.delete(id);
        editingIds = next;
        const map = new Map(editBuffers);
        map.delete(id);
        editBuffers = map;
    }

    async function saveEdit(id) {
        const buf = editBuffers.get(id);
        if (!buf) return;
        if (!buf.category?.trim() || !buf.username?.trim()) {
            showToastMessage('카테고리와 아이디는 필수입니다.', 'error');
            return;
        }
        isSaving = true;
        try {
            const {error} = await supabase
                .from(TABLE)
                .update({
                    category: buf.category.trim(),
                    username: buf.username.trim(),
                    password: buf.password ?? '',
                    group_id: buf.group_id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) throw error;
            cancelEdit(id);
            showToastMessage('저장됐습니다.');
            await loadData();
        } catch (e) {
            showToastMessage('저장 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function defaultNewRow() {
        return {_key: crypto.randomUUID(), category: '', username: '', password: '', group_id: selectedGroupId ?? ''};
    }

    function startAdd() {
        newRows = newRows ? [...newRows, defaultNewRow()] : [defaultNewRow()];
        editingId = null;
        editBuffer = {};
    }

    function removeNewRow(key) {
        newRows = newRows.filter((r) => r._key !== key);
        if (newRows.length === 0) newRows = null;
    }

    async function saveNewRow(key) {
        const r = newRows.find((r) => r._key === key);
        if (!r) return;
        if (!r.category.trim() || !r.username.trim()) {
            showToastMessage('카테고리와 아이디는 필수입니다.', 'error');
            return;
        }
        isSaving = true;
        try {
            const {error} = await supabase.from(TABLE).insert({
                category: r.category.trim(),
                username: r.username.trim(),
                password: r.password ?? '',
                group_id: r.group_id || null,
                updated_at: new Date().toISOString(),
                display_order: rows.length,
            });

            if (error) throw error;
            removeNewRow(key);
            showToastMessage('추가됐습니다.');
            await loadData();
        } catch (e) {
            showToastMessage('추가 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function openDeleteDialog(id) {
        deleteTargetId = id;
        deleteDialogEl?.showModal();
    }

    async function deleteRow() {
        isSaving = true;
        try {
            const {error} = await supabase.from(TABLE).delete().eq('id', deleteTargetId);

            if (error) throw error;
            deleteDialogEl?.close();
            deleteTargetId = null;
            showToastMessage('삭제됐습니다.');
            await loadData();
        } catch (e) {
            showToastMessage('삭제 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function toggleReveal(id) {
        const next = new Set(revealedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        revealedIds = next;
    }

    function formatDateTime(val) {
        if (!val) return '-';
        const d = new Date(val);
        return d.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    onDestroy(() => {
        clearTimeout(expireTimer);
    });
</script>

<div class="container mx-auto p-4">
    {#if !isAuthenticated}
        <!-- 잠금 화면 -->
        <div class="flex min-h-[70vh] items-center justify-center">
            <div class="card w-96 bg-base-100 shadow-xl">
                <div class="card-body">
                    <h2 class="card-title mb-2 justify-center text-xl">🥷 비밀번호 모음집 🥷</h2>
                    <p class="mb-4 text-center text-sm text-base-content/60">비번을 입력하라!</p>
                    <div class="form-control">
                        <input
                            type="password"
                            class="input input-bordered w-full"
                            class:input-error={authError}
                            placeholder="비밀번호"
                            bind:value={passwordInput}
                            onkeydown={(e) => e.key === 'Enter' && authenticate()}
                            autofocus
                        />
                        {#if authError}
                            <label class="label">
                                <span class="label-text-alt text-error">{authError}</span>
                            </label>
                        {/if}
                    </div>
                    <div class="card-actions mt-4">
                        <button class="btn btn-primary w-full" onclick={authenticate}>확인</button>
                    </div>
                </div>
            </div>
        </div>
    {:else}
        <!-- 메인 콘텐츠 -->
        <div class="mb-8 rounded-xl bg-neutral py-5 text-center shadow">
            <h1 class="text-2xl font-bold text-neutral-content">🥷 비밀번호 모음집 🥷</h1>
        </div>

        <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
                <!-- 그룹 탭 -->
                <div class="mb-4">
                    <div class="flex flex-wrap items-center gap-1">
                        <button
                            class="btn btn-sm border border-white/30"
                            class:btn-neutral={selectedGroupId === null}
                            class:btn-ghost={selectedGroupId !== null}
                            onclick={() => (selectedGroupId = null)}
                        >전체 <span class="badge badge-sm">{rows.length}</span></button>
                        {#each groups as g, gi (g.id)}
                            <div
                                class="flex items-center"
                                class:opacity-50={draggedGroup === gi}
                                ondragover={handleGroupDragOver}
                                ondrop={(e) => handleGroupDrop(e, gi)}
                            >
                                <span
                                    class="flex cursor-move items-center self-stretch rounded-l border border-r-0 border-white/30 bg-base-200 px-1 text-base-content/30 select-none"
                                    draggable="true"
                                    ondragstart={(e) => handleGroupDragStart(e, gi)}
                                    ondragend={handleGroupDragEnd}
                                >⠿</span>
                                <button
                                    class="btn btn-sm rounded-none border border-x-0 border-white/30"
                                    class:btn-neutral={selectedGroupId === g.id}
                                    class:btn-ghost={selectedGroupId !== g.id}
                                    onclick={() => (selectedGroupId = g.id)}
                                >
                                    {g.name}
                                    <span class="badge badge-sm">{rows.filter((r) => r.group_id === g.id).length}</span>
                                </button>
                                <button
                                    class="btn btn-sm btn-ghost rounded-none border border-x-0 border-white/30 px-1 text-base-content/30 hover:text-primary"
                                    onclick={() => openEditGroupDialog(g)}
                                    title="그룹 수정"
                                >✎</button>
                                <button
                                    class="btn btn-sm btn-ghost rounded-l-none border border-l-0 border-white/30 px-1 text-base-content/30 hover:text-error"
                                    onclick={() => openDeleteGroupDialog(g.id)}
                                    title="그룹 삭제"
                                >✕</button>
                            </div>
                        {/each}
                        <button
                            class="btn btn-sm btn-outline ml-auto"
                            onclick={() => createGroupDialogEl?.showModal()}
                        >+ 그룹</button>
                    </div>
                </div>

                <div class="mb-4 flex items-center justify-between">
                    <h2 class="card-title text-base">
                        {selectedGroupId === null ? '전체' : getGroupName(selectedGroupId)}
                    </h2>
                    <button class="btn btn-sm btn-primary" onclick={startAdd}>+ 추가</button>
                </div>

                {#if isLoading}
                    <div class="flex justify-center p-12">
                        <span class="loading loading-spinner loading-lg"></span>
                    </div>
                {:else}
                    <div class="overflow-x-auto">
                        <table class="table table-zebra w-full">
                            <thead>
                                <tr>
                                    {#if selectedGroupId === null}
                                        <th class="w-6"></th>
                                    {/if}
                                    <th class="w-10">NO</th>
                                    <th class="w-28">그룹</th>
                                    <th class="w-32">카테고리</th>
                                    <th class="w-44">아이디</th>
                                    <th class="w-56">비밀번호</th>
                                    <th class="w-44">수정일</th>
                                    <th class="w-28">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each filteredRows as row, index (row.id)}
                                    {#if editingIds.has(row.id)}
                                        {@const buf = editBuffers.get(row.id)}
                                        <tr class="bg-base-200/50">
                                            {#if selectedGroupId === null}<td></td>{/if}
                                            <td class="text-sm text-base-content/50">{index + 1}</td>
                                            <td>
                                                <select
                                                    class="select select-bordered select-sm w-full"
                                                    bind:value={buf.group_id}
                                                >
                                                    <option value="">-</option>
                                                    {#each groups as g}
                                                        <option value={g.id}>{g.name}</option>
                                                    {/each}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={buf.category}
                                                    placeholder="카테고리"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={buf.username}
                                                    placeholder="아이디"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full font-mono"
                                                    bind:value={buf.password}
                                                    placeholder="비밀번호"
                                                />
                                            </td>
                                            <td class="text-sm text-base-content/50">
                                                {formatDateTime(row.updated_at)}
                                            </td>
                                            <td>
                                                <div class="flex gap-1">
                                                    <button
                                                        class="btn btn-xs btn-primary"
                                                        onclick={() => saveEdit(row.id)}
                                                        disabled={isSaving}
                                                    >저장</button>
                                                    <button class="btn btn-xs btn-ghost" onclick={() => cancelEdit(row.id)}>취소</button>
                                                </div>
                                            </td>
                                        </tr>
                                    {:else}
                                        <tr
                                            class:opacity-50={draggedItem === index && selectedGroupId === null}
                                            ondragover={selectedGroupId === null ? handleDragOver : undefined}
                                            ondrop={selectedGroupId === null ? (e) => handleDrop(e, index) : undefined}
                                        >
                                            {#if selectedGroupId === null}
                                                <td>
                                                    <span
                                                        class="cursor-move select-none text-base-content/40"
                                                        draggable="true"
                                                        ondragstart={(e) => handleDragStart(e, index)}
                                                        ondragend={handleDragEnd}
                                                    >⠿</span>
                                                </td>
                                            {/if}
                                            <td class="text-sm text-base-content/50">{index + 1}</td>
                                            <td>
                                                {#if row.group_id}
                                                    <span class="badge badge-sm whitespace-nowrap">{getGroupName(row.group_id)}</span>
                                                {:else}
                                                    <span class="text-sm text-base-content/30">-</span>
                                                {/if}
                                            </td>
                                            <td>{row.category}</td>
                                            <td class="font-mono">{row.username}</td>
                                            <td>
                                                <div class="flex items-start gap-2">
                                                    <span class="break-all font-mono text-sm">
                                                        {revealedIds.has(row.id) ? row.password : '••••••••'}
                                                    </span>
                                                    <button
                                                        class="btn btn-xs btn-ghost"
                                                        onclick={() => toggleReveal(row.id)}
                                                    >{revealedIds.has(row.id) ? '숨김' : '보기'}</button>
                                                    <button
                                                        class="btn btn-xs btn-outline btn-success"
                                                        onclick={() => copyToClipboard(row.password)}
                                                    >복사</button>
                                                </div>
                                            </td>
                                            <td class="text-sm text-base-content/50">
                                                {formatDateTime(row.updated_at)}
                                            </td>
                                            <td>
                                                <div class="flex gap-1">
                                                    <button
                                                        class="btn btn-xs btn-outline btn-primary"
                                                        onclick={() => startEdit(row)}
                                                    >수정</button>
                                                    <button
                                                        class="btn btn-xs btn-outline btn-error"
                                                        onclick={() => openDeleteDialog(row.id)}
                                                    >삭제</button>
                                                </div>
                                            </td>
                                        </tr>
                                    {/if}
                                {/each}

                                {#if newRows !== null}
                                    {#each newRows as nr (nr._key)}
                                        <tr class="bg-primary/5">
                                            {#if selectedGroupId === null}<td></td>{/if}
                                            <td></td>
                                            <td>
                                                <select
                                                    class="select select-bordered select-sm w-full"
                                                    bind:value={nr.group_id}
                                                >
                                                    <option value="">-</option>
                                                    {#each groups as g}
                                                        <option value={g.id}>{g.name}</option>
                                                    {/each}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={nr.category}
                                                    placeholder="카테고리"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={nr.username}
                                                    placeholder="아이디"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full font-mono"
                                                    bind:value={nr.password}
                                                    placeholder="비밀번호"
                                                />
                                            </td>
                                            <td class="text-sm text-base-content/50">-</td>
                                            <td>
                                                <div class="flex gap-1">
                                                    <button
                                                        class="btn btn-xs btn-primary"
                                                        onclick={() => saveNewRow(nr._key)}
                                                        disabled={isSaving}
                                                    >저장</button>
                                                    <button
                                                        class="btn btn-xs btn-ghost"
                                                        onclick={() => removeNewRow(nr._key)}
                                                    >취소</button>
                                                </div>
                                            </td>
                                        </tr>
                                    {/each}
                                {/if}
                            </tbody>
                        </table>

                        {#if filteredRows.length === 0 && newRows === null}
                            <div class="py-12 text-center text-base-content/40">등록된 항목이 없습니다.</div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<!-- 그룹 만들기 다이얼로그 -->
<dialog bind:this={createGroupDialogEl} class="modal">
    <div class="modal-box">
        <h3 class="mb-4 text-lg font-bold">그룹 만들기</h3>
        <div class="form-control">
            <input
                type="text"
                class="input input-bordered w-full"
                placeholder="그룹 이름"
                bind:value={newGroupName}
                onkeydown={(e) => e.key === 'Enter' && createGroup()}
            />
        </div>
        <div class="modal-action">
            <button class="btn" onclick={() => { createGroupDialogEl?.close(); newGroupName = ''; }}>취소</button>
            <button class="btn btn-primary" onclick={createGroup} disabled={!newGroupName.trim() || isSaving}>생성</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<!-- 그룹 수정 다이얼로그 -->
<dialog bind:this={editGroupDialogEl} class="modal">
    <div class="modal-box">
        <h3 class="mb-4 text-lg font-bold">그룹 수정</h3>
        {#if editGroupTarget}
            <div class="form-control">
                <input
                    type="text"
                    class="input input-bordered w-full"
                    placeholder="그룹 이름"
                    bind:value={editGroupTarget.name}
                    onkeydown={(e) => e.key === 'Enter' && saveEditGroup()}
                />
            </div>
        {/if}
        <div class="modal-action">
            <button class="btn" onclick={() => { editGroupDialogEl?.close(); editGroupTarget = null; }}>취소</button>
            <button class="btn btn-primary" onclick={saveEditGroup} disabled={!editGroupTarget?.name.trim() || isSaving}>저장</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<!-- 그룹 삭제 확인 다이얼로그 -->
<dialog bind:this={deleteGroupDialogEl} class="modal">
    <div class="modal-box">
        <h3 class="mb-4 text-lg font-bold">그룹 삭제</h3>
        <p>그룹을 삭제하면 해당 그룹에 속한 항목들은 미카테고리 상태가 됩니다.</p>
        <div class="modal-action">
            <button class="btn" onclick={() => deleteGroupDialogEl?.close()}>취소</button>
            <button class="btn btn-error" onclick={deleteGroup} disabled={isSaving}>삭제</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<!-- 항목 삭제 확인 다이얼로그 -->
<dialog bind:this={deleteDialogEl} class="modal">
    <div class="modal-box">
        <h3 class="mb-4 text-lg font-bold">삭제 확인</h3>
        <p>진짜 삭제한다?</p>
        <div class="modal-action">
            <button class="btn" onclick={() => deleteDialogEl?.close()}>취소</button>
            <button class="btn btn-error" onclick={deleteRow} disabled={isSaving}>삭제</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<!-- 토스트 -->
{#if showToast}
    <div class="toast toast-top toast-end z-50">
        <div class="alert {toastType === 'error' ? 'alert-error' : 'alert-success'}">
            <span>{toastMessage}</span>
        </div>
    </div>
{/if}
