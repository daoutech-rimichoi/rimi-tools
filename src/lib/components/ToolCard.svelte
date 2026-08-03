<script>
	import Icon from './Icon.svelte';
	import FavoriteButton from './FavoriteButton.svelte';

	let { tool } = $props();
</script>

<a
	href={tool.path}
	class="group flex flex-col gap-3 rounded-box border border-base-100 bg-base-200 p-5 transition-colors hover:border-primary/50 hover:bg-base-100"
>
	<div class="flex items-start">
		<span class="text-base-content/45 transition-colors group-hover:text-primary">
			<Icon name={tool.icon} size={30} />
		</span>
		<FavoriteButton path={tool.path} class="-mt-1 -mr-1 ml-auto" />
	</div>
	<div>
		<h3 class="text-lg font-medium">{tool.name}</h3>
		<p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-base-content/55">
			{tool.description}
		</p>
	</div>
</a>
