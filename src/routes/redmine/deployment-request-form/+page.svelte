<script>
	import { onMount } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import ToolPage from '$lib/components/ToolPage.svelte';
	import { USER_NAMES } from '$lib/config/users.js';
	import {
		DEPLOY_TYPE_NAMES,
		DEPLOY_TYPE_OPTIONS,
		PROCESS_OPTIONS,
		SERVICE_SELECT_OPTIONS,
		SERVICE_TITLE_NAMES
	} from '$lib/config/services.js';

	// --- 입력 상태 ---
	let service = $state('bizsales');
	let deploymentType = $state('deploy');
	let developer = $state('최경림');
	let selectedProcesses = $state([]);
	let workDescription = $state('');
	let workTime = $state('');
	let remarks = $state('');

	const developers = USER_NAMES;

	// 서비스/배포유형에 따라 고를 수 있는 프로세스 목록
	const availableProcesses = $derived(PROCESS_OPTIONS[service]?.[deploymentType] ?? []);

	// 서비스나 배포유형이 바뀌면, 더 이상 선택할 수 없는 프로세스는 선택 해제한다
	$effect(() => {
		const kept = selectedProcesses.filter((p) => availableProcesses.includes(p));
		if (kept.length !== selectedProcesses.length) selectedProcesses = kept;
	});

	// --- Initial Data Loading ---
	onMount(() => {
		// Only set initial workTime if it's not already set (e.g., by user input)
		if (!workTime) {
			const now = new SvelteDate();
			now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
			// Set default time to 18:00
			const year = now.getFullYear();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const day = now.getDate().toString().padStart(2, '0');
			workTime = `${year}-${month}-${day}T18:00`;
		}
	});

	// --- Helper function for formatting lists ---
	// Now takes an array of strings
	function formatToList(items, prefix = '- ') {
		if (!items || items.length === 0) return '';
		return items
			.filter((item) => item.trim() !== '')
			.map((item) => prefix + item.trim())
			.join('<br />\n');
	}

	// --- Reactive Output Generation ---
	const formattedWorkTime = $derived(workTime ? workTime.replace('T', ' ') : '');
	const outputTitle = $derived(`[${SERVICE_TITLE_NAMES[service]}] 서비스 배포 요청`);
	const outputBody = $derived.by(() => {
		const sections = [];
		if (selectedProcesses && selectedProcesses.length > 0) {
			sections.push(
				`<p>■ 대상 프로세스 (${DEPLOY_TYPE_NAMES[deploymentType]})<br />\n${formatToList(selectedProcesses)}</p>`
			); // Added deploymentType
		}
		if (workDescription && workDescription.trim()) {
			sections.push(`<p>■ 작업 내용<br />\n${formatToList(workDescription.split('\n'))}</p>`);
		}
		if (workTime) {
			sections.push(`<p>■ 작업 시간<br />\n- ${formattedWorkTime}</p>`);
		}
		if (remarks && remarks.trim()) {
			sections.push(`<p>■ 비고<br />\n${formatToList(remarks.split('\n'))}</p>`);
		}

		return `<p>안녕하세요. 시스템코어개발팀 ${developer}입니다.<br />
아래 내용으로 서비스 배포 요청드립니다.</p>

<blockquote>
${sections.join('\n')}
</blockquote>

<p>감사합니다.</p>`;
	});

	// --- Warn user before leaving the page ---
	function handleBeforeUnload(event) {
		// Only warn if there's some input that might be lost
		if (workDescription.trim() !== '' || remarks.trim() !== '') {
			event.preventDefault();
			event.returnValue = '변경사항이 저장되지 않을 수 있습니다. 정말로 나가시겠습니까?';
			return event.returnValue;
		}
	}
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<ToolPage>
	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Input Section -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<h2 class="card-title">입력</h2>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="form-control w-full">
						<label for="service" class="label">
							<span class="label-text">서비스</span>
						</label>
						<select id="service" bind:value={service} class="select-bordered select w-full">
							{#each SERVICE_SELECT_OPTIONS as s (s.value)}
								<option value={s.value}>{s.label}</option>
							{/each}
						</select>
					</div>

					<div class="form-control w-full">
						<label for="deploymentType" class="label">
							<span class="label-text">배포 타입</span>
						</label>
						<select
							id="deploymentType"
							bind:value={deploymentType}
							class="select-bordered select w-full"
						>
							{#each DEPLOY_TYPE_OPTIONS as dt (dt.value)}
								<option value={dt.value}>{dt.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<!-- Combined Developer and Work Time -->
					<div class="form-control w-full">
						<label for="developer" class="label">
							<span class="label-text">담당자</span>
						</label>
						<select id="developer" bind:value={developer} class="select-bordered select w-full">
							{#each developers as d (d)}
								<option value={d}>{d}</option>
							{/each}
						</select>
					</div>

					<div class="form-control w-full">
						<label for="workTime" class="label">
							<span class="label-text">작업 시간</span>
						</label>
						<input
							id="workTime"
							type="datetime-local"
							bind:value={workTime}
							class="input-bordered input w-full"
							onkeydown={(e) => e.preventDefault()}
						/>
					</div>
				</div>

				<div class="form-control w-full">
					<h3 class="label">
						<span class="label-text">대상 프로세스</span>
					</h3>
					<div class="block space-y-2 rounded-lg border border-base-300 bg-base-200 p-2">
						{#if availableProcesses.length > 0}
							{#each availableProcesses as process (process)}
								<label class="flex cursor-pointer items-center">
									<input
										type="checkbox"
										value={process}
										bind:group={selectedProcesses}
										class="checkbox checkbox-primary"
									/>
									<span class="label-text ml-2">{process}</span>
								</label>
							{/each}
						{:else}
							<p class="text-sm text-base-content/70">
								선택된 서비스/배포 타입에 해당하는 프로세스가 없습니다.
							</p>
						{/if}
					</div>
				</div>

				<div class="form-control w-full">
					<label for="workDescription" class="label">
						<span class="label-text">작업 내용 (한 줄에 하나씩)</span>
					</label>
					<textarea
						id="workDescription"
						bind:value={workDescription}
						rows="4"
						class="textarea-bordered textarea w-full"
						placeholder="[비즈뿌리오] RCS 대표 발신번호 변경 기능 추가 (NBIZPPURIO-2771)&#13;배치잡 시작/종료 로그 추가 (NUFIT-566)"
					></textarea>
				</div>

				<div class="form-control w-full">
					<label for="remarks" class="label">
						<span class="label-text">비고</span>
					</label>
					<textarea
						id="remarks"
						bind:value={remarks}
						rows="3"
						class="textarea-bordered textarea w-full"
						placeholder="DB 선작업 이후 진행 (NSVCOPS-3233)"
					></textarea>
				</div>
			</div>
		</div>

		<ResultPanel title={outputTitle} body={outputBody} rows={20} />
	</div>
</ToolPage>
