<script>
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import Icon from './Icon.svelte';

	/**
	 * 복사 버튼. 누른 버튼 자체가 잠깐 "복사됨"으로 바뀌어
	 * 여러 복사 버튼 중 무엇을 눌렀는지 바로 알 수 있다.
	 */
	let { text, label = '복사하기', class: className = 'btn btn-primary btn-sm' } = $props();

	const FEEDBACK_MS = 1500;
	let copied = $state(false);
	let timer;

	async function handleClick() {
		if (!(await copyToClipboard(text))) return;
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), FEEDBACK_MS);
	}
</script>

<button class="{className} {copied ? 'btn-success' : ''}" onclick={handleClick} disabled={!text}>
	{#if copied}
		<Icon name="check" size={15} />
		복사됨
	{:else}
		{label}
	{/if}
</button>
