<script>
	import { favorites } from '$lib/stores/favorites.js';
	import Icon from './Icon.svelte';

	let { path, size = 20, class: className = '' } = $props();

	const isFavorite = $derived($favorites.includes(path));
</script>

<button
	type="button"
	class="rounded-selector p-1.5 transition-colors {isFavorite
		? 'text-secondary'
		: 'text-base-content/25 hover:text-base-content/60'} {className}"
	title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
	aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
	aria-pressed={isFavorite}
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		favorites.toggle(path);
	}}
>
	<Icon name="heart" {size} filled={isFavorite} />
</button>
