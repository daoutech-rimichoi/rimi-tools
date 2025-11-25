<script>
    import {toast} from '$lib/stores/common.js';
</script>

{#if $toast.show}
    <div class="toast toast-center toast-top z-50">
        <div class="alert alert-{$toast.type === 'error'? 'error' : $toast.type === 'info'? 'info': 'success'}">
            <span>{$toast.message}</span>
        </div>
    </div>
{/if}
