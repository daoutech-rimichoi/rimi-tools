<script>
    let {isOpen = $bindable(), htmlContent = ''} = $props();

    function close() {
        isOpen = false;
    }

    function handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            close();
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            close();
        }
    }

    $effect(() => {
        if (isOpen) {
            window.addEventListener('keydown', handleKeydown);
            return () => {
                window.removeEventListener('keydown', handleKeydown);
            };
        }
    });
</script>

{#if isOpen}
    <dialog class="modal-open modal" onclick={handleBackdropClick}>
        <div class="modal-box w-11/12 max-w-5xl">
            <h3 class="text-lg font-bold">HTML 미리보기</h3>
            <button
                    class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
                    onclick={close}
                    aria-label="닫기"
            >
                ✕
            </button>
            <div class="py-4">
                <div class="rounded-lg border border-base-300 bg-base-100 p-4">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html htmlContent}
                </div>
            </div>
            <div class="modal-action">
                <button class="btn" onclick={close}>닫기</button>
            </div>
        </div>
    </dialog>
{/if}
