<script>
	import ToolPage from '$lib/components/ToolPage.svelte';
	import ServerStatusBoard from '$lib/components/ServerStatusBoard.svelte';
</script>

<ToolPage>
	<ServerStatusBoard envType="stg" accent="success" onUseNotice="🚨실발송 주의🚨" />
</ToolPage>
