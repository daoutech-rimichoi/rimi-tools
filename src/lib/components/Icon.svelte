<script>
	/**
	 * 프로젝트 전역 아이콘. 외부 아이콘 라이브러리 없이 stroke 스타일 24x24 SVG 로 통일한다.
	 * 새 아이콘은 아래 {#if} 분기에 name 을 추가하면 된다.
	 */
	let { name, size = 20, filled = false, class: className = '' } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	{#if name === 'server'}
		<rect x="3" y="4" width="18" height="7" rx="2" />
		<rect x="3" y="13" width="18" height="7" rx="2" />
		<path d="M7 7.5h.01M7 16.5h.01" />
	{:else if name === 'alert'}
		<path d="M10.3 4.6 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" />
		<path d="M12 9v4M12 17h.01" />
	{:else if name === 'send'}
		<path d="M21 3 3 10.5l7 2.5 2.5 7z" />
		<path d="M10 13 21 3" />
	{:else if name === 'message'}
		<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 4v-4H6a2 2 0 0 1-2-2z" />
	{:else if name === 'clipboard'}
		<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
		<rect x="9" y="2.5" width="6" height="3.5" rx="1" />
		<path d="M9 13.5 11 15.5 15 11.5" />
	{:else if name === 'network'}
		<circle cx="12" cy="5" r="2.5" />
		<circle cx="5" cy="19" r="2.5" />
		<circle cx="19" cy="19" r="2.5" />
		<path d="M12 7.5v2" />
		<path d="M5 16.5v-2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" />
	{:else if name === 'package'}
		<path d="M12 3 21 7.5v9L12 21 3 16.5v-9z" />
		<path d="M3 7.5 12 12l9-4.5M12 12v9" />
	{:else if name === 'comment'}
		<path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6l-5 4v-4H5a1 1 0 0 1-1-1z" />
		<path d="M8 8h8M8 11.5h5" />
	{:else if name === 'database'}
		<ellipse cx="12" cy="6" rx="8" ry="3" />
		<path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
		<path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
	{:else if name === 'lock'}
		<rect x="4" y="10" width="16" height="11" rx="2" />
		<path d="M8 10V7a4 4 0 0 1 8 0v3" />
		<circle cx="12" cy="15.5" r="1.2" />
	{:else if name === 'search'}
		<circle cx="10.5" cy="10.5" r="6.5" />
		<path d="M15.5 15.5 21 21" />
	{:else if name === 'home'}
		<path d="M4 11 12 4l8 7" />
		<path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
	{:else if name === 'menu'}
		<path d="M4 7h16M4 12h16M4 17h16" />
	{:else if name === 'heart'}
		<path
			d="M12 20 4.8 12.9a4.5 4.5 0 0 1 6.4-6.3l.8.8.8-.8a4.5 4.5 0 0 1 6.4 6.3z"
			fill={filled ? 'currentColor' : 'none'}
		/>
	{:else if name === 'chevron'}
		<path d="M9 6l6 6-6 6" />
	{:else if name === 'external'}
		<path d="M14 4h6v6" />
		<path d="M20 4 11 13" />
		<path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
	{:else if name === 'sliders'}
		<path d="M4 6h14M4 12h4M14 12h6M4 18h10" />
		<circle cx="20" cy="6" r="2" />
		<circle cx="11" cy="12" r="2" />
		<circle cx="17" cy="18" r="2" />
	{:else if name === 'ticket'}
		<path
			d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5z"
		/>
		<path d="M12 9v1M12 14v1" />
	{:else if name === 'folder'}
		<path d="M4 7a2 2 0 0 1 2-2h3.5l2 2.5H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
	{:else if name === 'check'}
		<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
	{:else if name === 'eye'}
		<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
		<circle cx="12" cy="12" r="3" />
	{:else if name === 'code'}
		<path d="M9 7 4 12l5 5M15 7l5 5-5 5" />
	{:else if name === 'tool'}
		<path
			d="M14.5 4.5a4.5 4.5 0 0 0-6 5.9L4 15v4.5h4.5l4.6-4.6a4.5 4.5 0 0 0 5.9-6l-3 3-2.4-2.4z"
		/>
	{/if}
</svg>
