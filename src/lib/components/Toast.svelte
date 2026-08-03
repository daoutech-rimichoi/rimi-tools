<script>
	import { toast } from '$lib/stores/common.js';

	// Tailwind 는 소스를 문자열로 스캔하므로 `alert-{type}` 처럼 런타임에 조합하면
	// 해당 CSS 가 아예 생성되지 않는다(=배경색 없음). 반드시 완성된 클래스명을 리터럴로 둘 것.
	const ALERT_CLASS = {
		success: 'alert-success',
		error: 'alert-error',
		info: 'alert-info'
	};

	const alertClass = $derived(ALERT_CLASS[$toast.type] ?? ALERT_CLASS.success);
</script>

{#if $toast.show}
	<div class="toast toast-end toast-top z-50">
		<div class="alert {alertClass} shadow-lg" role="status">
			<span>{$toast.message}</span>
		</div>
	</div>
{/if}
