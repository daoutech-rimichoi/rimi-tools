<script>
	/**
	 * 표 형태 화면의 로딩 자리표시자.
	 * 스피너 대신 실제 표와 비슷한 형태를 그려서 로드 후 레이아웃이 튀지 않게 한다.
	 *
	 * @property cards 카드(표) 개수
	 * @property rows  카드당 행 수
	 * @property cols  행당 칸 수
	 */
	let { cards = 1, rows = 4, cols = 5 } = $props();

	// 칸마다 폭을 다르게 줘서 진짜 표처럼 보이게
	const WIDTHS = ['w-1/6', 'w-1/4', 'w-20', 'flex-1', 'w-32', 'w-24'];
</script>

<div class="space-y-6" aria-busy="true" aria-label="불러오는 중">
	{#each Array.from({ length: cards }, (_, i) => i) as card (card)}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body gap-4">
				<div class="h-7 w-48 skeleton"></div>
				{#each Array.from({ length: rows }, (_, i) => i) as row (row)}
					<div class="flex items-center gap-4">
						{#each Array.from({ length: cols }, (_, i) => i) as col (col)}
							<div class="h-8 skeleton {WIDTHS[col % WIDTHS.length]}"></div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
