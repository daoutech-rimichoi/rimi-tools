<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { SvelteDate } from 'svelte/reactivity';

	// --- State Variables using Writable Store ---
	const developer = writable('최경림');
	const selectedTargets = writable([]);
	const workTime = writable('');
	let copiedTitle = false;
	let copiedBody = false;

	// --- Options for Selects and Checkboxes ---
	const developers = ['최경림', '김준혁', '김지웅', '전하라', '요용상', '배윤희', '한수찬'];
	const workTargets = [
		{ code: 'kapi', name: 'KAPI', text: '| kapi | 27.102.215.47 | 80,443 | 8091,8447 | stella01, stella02 |' },
		{ code: 'rapi', name: 'RAPI', text: '| rapi | 115.71.53.22 | 80,443 | 8092,8448 | stella01, stella02 |' },
		{ code: 'napi', name: 'NAPI', text: '| napi | 115.71.53.19 | 80,443 | 8093,8449 | stella01, stella02 |' },
		{ code: 'salesApi', name: 'SAPI', text: '| salesApi | 115.71.53.20 | 80,443 | 8089,8445 | stella01, stella02 |' },
		{ code: 'ivr', name: 'IVR', text: '| ivr | 115.71.53.23 | 80,443 | 8090,8446 | stella01, stella02 |' },
		{ code: 'forward', name: '팩스포워드', text: '| forward | 115.71.53.25 | 9000,19000 | 9000,19000 | stella01, stella02, stella03 (Apache 미사용) |' },
		{ code: 'numball', name: '번자관', text: '| numball | 115.71.53.232 | 443 | 14119 | lucy01a, lucy02a |' }
	];

	const numballText = workTargets.find((t) => t.code === 'numball')?.text ?? '';
	$: isNumballSelected = numballText ? $selectedTargets.includes(numballText) : false;
	$: hasOtherSelections = $selectedTargets.some((t) => t !== numballText);

	// --- Fixed Content ---
	const workContent = 'L4 disable/enable 및 Apache LB worker 작업 요청';
	const workScenario = `# 아파치 설정 작업 (1~N 전부)
cp /home/service/apache/\\{서비스명}/conf/worker.properties.deploy ./worker.properties
/home/service/apache/\\{서비스명}/bin/apachectl graceful
# 1번 L4 제외
# 1번 서비스 배포
# 1번 L4 포함 2번 L4 제외
# 2~4 서버별 반복
# L4 모두 허용 시 아파치 설정 원복
cp /home/service/apache/\\{서비스명}/conf/worker.properties.org ./worker.properties
/home/service/apache/\\{서비스명}/bin/apachectl graceful`;

	// --- Initial Data Loading ---
	onMount(() => {
		if (!$workTime) {
			const now = new SvelteDate();
			now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
			const year = now.getFullYear();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const day = now.getDate().toString().padStart(2, '0');
			workTime.set(`${year}-${month}-${day}T18:00`);
		}
	});

	// --- Helper function for formatting lists ---
	function formatToList(items, prefix = ' - ') {
		if (!items || items.length === 0) return '';
		return items
			.filter((item) => item.trim() !== '')
			.map((item) => prefix + item.trim())
			.join('\n');
	}

	// --- Reactive Output Generation ---
	$: formattedWorkTime = $workTime ? $workTime.replace('T', ' ') : '';
	const outputTitle = `[비즈뿌리오] L4 작업 요청`;
	$: outputBody = `안녕하세요. 시스템코어개발팀 ${$developer}입니다.
아래 내용으로 작업 요청 드립니다.

■ 작업 내용
 - ${workContent}

■ 작업 대상 (서비스명 / VIP / VPORT / 대상 서버)
${formatToList($selectedTargets)}

■ 작업 시나리오
${workScenario}

■ 작업 일시
 - ${formattedWorkTime}`;

	// --- Clipboard Logic ---
	async function copyTitleToClipboard() {
		try {
			await navigator.clipboard.writeText(outputTitle);
			copiedTitle = true;
			setTimeout(() => (copiedTitle = false), 2000);
		} catch (err) {
			console.error('제목 클립보드 복사 실패:', err);
			alert('제목 클립보드 복사에 실패했습니다.');
		}
	}

	async function copyBodyToClipboard() {
		try {
			await navigator.clipboard.writeText(outputBody);
			copiedBody = true;
			setTimeout(() => (copiedBody = false), 2000);
		} catch (err) {
			console.error('본문 클립보드 복사 실패:', err);
			alert('본문 클립보드 복사에 실패했습니다.');
		}
	}
</script>

<div class="container mx-auto p-4">
	<h1 class="mb-4 text-2xl font-bold">L4 작업 요청 양식</h1>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Input Section -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<h2 class="card-title">입력</h2>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="form-control w-full">
						<label for="developer" class="label"><span class="label-text">담당자</span></label>
						<select id="developer" bind:value={$developer} class="select-bordered select w-full">
							{#each developers as d (d)}
								<option value={d}>{d}</option>
							{/each}
						</select>
					</div>

					<div class="form-control w-full">
						<label for="workTime" class="label"><span class="label-text">작업 일시</span></label>
						<input
							id="workTime"
							type="datetime-local"
							bind:value={$workTime}
							class="input-bordered input w-full"
							on:keydown={(e) => e.preventDefault()}
						/>
					</div>
				</div>

				<div class="form-control w-full">
					<h3 class="label"><span class="label-text">작업 대상</span></h3>
					<div class="block space-y-2 rounded-lg border border-base-300 bg-base-200 p-2">
						{#each workTargets as target (target)}
							<label class="flex cursor-pointer items-center">
								<input
									type="checkbox"
									value={target}
									bind:group={$selectedTargets}
									class="checkbox checkbox-primary"
								/>
								<span class="label-text ml-2">{target}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Output Section -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="mb-4 card-title">결과</h2>
				<div class="form-control mb-4 w-full">
					<label for="outputTitle" class="label flex items-center justify-between">
						<span class="label-text">제목</span>
						<button on:click={copyTitleToClipboard} class="btn btn-sm btn-primary">
							{#if copiedTitle}복사 완료!{:else}제목 복사하기{/if}
						</button>
					</label>
					<input
						id="outputTitle"
						type="text"
						readonly
						value={outputTitle}
						class="input-bordered input w-full font-mono"
					/>
				</div>
				<div class="form-control w-full">
					<label for="outputBody" class="label flex items-center justify-between">
						<span class="label-text">본문</span>
						<button on:click={copyBodyToClipboard} class="btn btn-sm btn-primary">
							{#if copiedBody}복사 완료!{:else}본문 복사하기{/if}
						</button>
					</label>
					<!--suppress HtmlUnknownAttribute -->
					<textarea
						id="outputBody"
						readonly
						value={outputBody}
						rows="20"
						class="textarea-bordered textarea w-full font-mono"
					></textarea>
				</div>
			</div>
		</div>
	</div>
</div>
