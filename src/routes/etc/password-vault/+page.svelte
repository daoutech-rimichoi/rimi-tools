<script>
    import {onDestroy} from 'svelte';
    import {supabase} from '$lib/supabaseClient.js';

    const CORRECT_PASSWORD = 'tlzhqlqjs123@!';
    const AUTH_TTL = 3 * 60 * 1000; // 3분
    const TABLE = 'password_vault';

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

    // 데이터
    let rows = $state([]);
    let editingId = $state(null);
    let editBuffer = $state({});
    let newRows = $state(null);
    let revealedIds = $state(new Set());

    // 드래그앤드롭
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

        const newRows = [...rows];
        const [removed] = newRows.splice(draggedItem, 1);
        newRows.splice(targetIndex, 0, removed);
        rows = newRows;
        draggedItem = null;

        await saveOrder(newRows);
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
            loadData();
        } else {
            authError = '비밀번호가 올바르지 않습니다.';
        }
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
        editingId = row.id;
        editBuffer = {...row};
        newRows = null;
    }

    function cancelEdit() {
        editingId = null;
        editBuffer = {};
    }

    async function saveEdit() {
        if (!editBuffer.category?.trim() || !editBuffer.username?.trim()) {
            showToastMessage('분류와 아이디는 필수입니다.', 'error');
            return;
        }
        isSaving = true;
        try {
            const {error} = await supabase
                .from(TABLE)
                .update({
                    category: editBuffer.category.trim(),
                    username: editBuffer.username.trim(),
                    password: editBuffer.password ?? '',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', editBuffer.id);

            if (error) throw error;
            editingId = null;
            editBuffer = {};
            showToastMessage('저장됐습니다.');
            await loadData();
        } catch (e) {
            showToastMessage('저장 실패: ' + e.message, 'error');
        } finally {
            isSaving = false;
        }
    }

    function defaultNewRow() {
        return {_key: crypto.randomUUID(), category: '', username: '', password: ''};
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
            showToastMessage('분류와 아이디는 필수입니다.', 'error');
            return;
        }
        isSaving = true;
        try {
            const {error} = await supabase.from(TABLE).insert({
                category: r.category.trim(),
                username: r.username.trim(),
                password: r.password ?? '',
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
                <div class="mb-4 flex items-center justify-between">
                    <h2 class="card-title">목록</h2>
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
                                    <th class="w-6"></th>
                                    <th class="w-10">NO</th>
                                    <th class="w-32">분류</th>
                                    <th class="w-44">아이디</th>
                                    <th class="w-56">비밀번호</th>
                                    <th class="w-44">수정일</th>
                                    <th class="w-28">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each rows as row, index (row.id)}
                                    {#if editingId === row.id}
                                        <tr class="bg-base-200/50">
                                            <td></td>
                                            <td class="text-sm text-base-content/50">{index + 1}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={editBuffer.category}
                                                    placeholder="분류"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={editBuffer.username}
                                                    placeholder="아이디"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full font-mono"
                                                    bind:value={editBuffer.password}
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
                                                        onclick={saveEdit}
                                                        disabled={isSaving}
                                                    >저장</button>
                                                    <button class="btn btn-xs btn-ghost" onclick={cancelEdit}>취소</button>
                                                </div>
                                            </td>
                                        </tr>
                                    {:else}
                                        <tr
                                            class:opacity-50={draggedItem === index}
                                            ondragover={handleDragOver}
                                            ondrop={(e) => handleDrop(e, index)}
                                        >
                                            <td>
                                                <span
                                                    class="cursor-move select-none text-base-content/40"
                                                    draggable="true"
                                                    ondragstart={(e) => handleDragStart(e, index)}
                                                    ondragend={handleDragEnd}
                                                >⠿</span>
                                            </td>
                                            <td class="text-sm text-base-content/50">{index + 1}</td>
                                            <td>{row.category}</td>
                                            <td class="font-mono">{row.username}</td>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <span class="font-mono text-sm">
                                                        {revealedIds.has(row.id) ? row.password : '••••••••'}
                                                    </span>
                                                    <button
                                                        class="btn btn-xs btn-ghost"
                                                        onclick={() => toggleReveal(row.id)}
                                                    >{revealedIds.has(row.id) ? '숨김' : '보기'}</button>
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
                                            <td></td>
                                            <td></td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="input input-bordered input-sm w-full"
                                                    bind:value={nr.category}
                                                    placeholder="분류"
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

                        {#if rows.length === 0 && newRows === null}
                            <div class="py-12 text-center text-base-content/40">등록된 항목이 없습니다.</div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<!-- 삭제 확인 다이얼로그 -->
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
