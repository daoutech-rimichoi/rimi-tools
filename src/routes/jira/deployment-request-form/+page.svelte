<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { SvelteDate } from 'svelte/reactivity';

	// --- State Variables using Writable Store ---
	const service = writable('bizsales');
	const deploymentType = writable('deploy');
	const developer = writable('최경림');
	const selectedProcesses = writable([]); // Changed to array
	const workDescription = writable('');
	const workTime = writable('');
	const remarks = writable('');
	let copiedTitle = false;
	let copiedBody = false;

	// --- Options for Selects ---
	const services = [
		{ value: 'bizsales', label: '영업관리시스템' },
		{ value: 'bizpp', label: '비즈뿌리오' },
		{ value: 'JavaASP', label: 'JavaASP' },
		{ value: 'ufit', label: '유핏' },
		{ value: 'numball', label: '번호자원관리시스템' }
	]; // Updated to match processOptions keys
	const deploymentTypes = [
		{ value: 'deploy', label: '재기동' },
		{ value: 'filetransfer', label: '파일이동' }
	];
	const developers = ['최경림', '김준혁', '김지웅', '전하라', '오용상', '배윤희', '한수찬'];

	// --- Process Options based on Service and Deployment Type ---
	const processOptions = {
		bizsales: {
			deploy: [
				'영업관리시스템 웹 (sales-integration-web) / lucy01a, lucy02a',
				'영업관리시스템 배치 (sales-integration-batch) / lucy01a (+lucy02a는 파일만 복사)',
				'영업관리시스템 모니터링 (sales-integration-monitor) / lucy01a (+lucy02a는 파일만 복사)'
			],
			filetransfer: ['영업관리시스템 API (sales-integration-api) / stella01, stella02']
		},
		bizpp: {
			// Key changed from '비즈뿌리오 웹'
			deploy: [
				'비즈뿌리오 웹 (bizweb) / stella01, stella02',
				'비즈뿌리오 발송 배치 (bizBatchApi) / stella01, stella02, stella03'
			],
			filetransfer: [
				'비즈뿌리오 KAPI (kapi) / stella01, stella02',
				'비즈뿌리오 NAPI (napi) / stella01, stella02',
				'비즈뿌리오 RAPI (rapi) / stella01, stella02',
				'비즈뿌리오 팩스 발송 데몬 (web-fax-daemon) / stella01, stella02, stella03',
				'비즈뿌리오 팩스 포워드 데몬 (web-fax-forward-daemon) / stella01, stella02, stella03',
				'080수신거부시나리오 (ivr) / stella01, stella02'
			]
		},
		JavaASP: {
			// Key changed from 'JavaASP 웹'
			deploy: [
				'JavaASP 웹 (asp) / ares01a, ares02a',
				'JavaASP 중간 관리자 웹 (asp-admin) / ares01a, ares02a',
				'JavaASP 최고 관리자 웹 (asp-manager) / ares01a, ares02a',
				'JavaASP 배치 (asp-batch) / ares01a (+ares02a는 파일만 복사)',
				'JavaASP API (asp-service-api) / acis01a',
				'JavaASP 스팸 (asp-spam) / acis01a',
				'JavaASP 주소록 데몬 (asp-address-daemon) / acis01a, acis02a',
				'JavaASP SMS 발송 데몬 (asp-sms-send-daemon) / acis01a, acis02a',
				'JavaASP SMS 리포트 데몬 (asp-sms-report-daemon) / acis01a',
				'JavaASP MMS 발송 데몬 (asp-mms-send-daemon) / acis01a, acis02a',
				'JavaASP MMS 리포트 데몬 (asp-mms-report-daemon) / acis01a',
				'JavaASP RCS 발송 데몬 (asp-rcs-send-daemon) / acis01a, acis02a',
				'JavaASP RCS 리포트 데몬 (asp-rcs-report-daemon) / acis01a',
				'JavaASP 데몬 모니터링 (daemon-monitor) / acis01a',
				'JavaASP 팩스 브릿지 (faxBridge) / acis01a'
			],
			filetransfer: [] // No specific file move processes mentioned for JavaASP
		},
		ufit: {
			// Key changed from '유핏 웹'
			deploy: ['유핏 웹 (ufit-web) / mare01a, mare02a'],
			filetransfer: ['유핏 정산 배치 (ufit-bill-batch) / mare01a (+mare02a는 파일만 복사)']
		},
		numball: {
			deploy: [], // No specific restart processes mentioned
			filetransfer: ['번호자원관리시스템 (numball-api) / lucy01a, lucy02a']
		}
	};

	// Reactive variable for available processes
	$: availableProcesses = processOptions[$service]?.[$deploymentType] || [];

	// Reset selected processes when service or deployment type changes
	$: {
		// Filter out selected processes that are no longer available
		selectedProcesses.set($selectedProcesses.filter((p) => availableProcesses.includes(p)));
	}

	// --- Initial Data Loading ---
	onMount(() => {
		// Only set initial workTime if it's not already set (e.g., by user input)
		if (!$workTime) {
			const now = new SvelteDate();
			now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
			// Set default time to 18:00
			const year = now.getFullYear();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const day = now.getDate().toString().padStart(2, '0');
			workTime.set(`${year}-${month}-${day}T18:00`);
		}
	});

	// --- Helper function for formatting lists ---
	// Now takes an array of strings
	function formatToList(items, prefix = '- ') {
		if (!items || items.length === 0) return '';
		return items
			.filter((item) => item.trim() !== '')
			.map((item) => prefix + item.trim())
			.join('\n');
	}

	const serviceMap = {
		bizsales: '영업관리시스템',
		bizpp: '비즈뿌리오',
		JavaASP: 'JavaASP',
		ufit: '유핏',
		numball: '번호자원관리시스템'
	};

	const deploymentTypeMap = {
		deploy: '재기동',
		filetransfer: '파일이동'
	};

	// --- Reactive Output Generation ---
	$: formattedWorkTime = $workTime ? $workTime.replace('T', ' ') : '';
	$: outputTitle = `[배포요청] ${serviceMap[$service]} 배포 요청`;
	$: outputBody = (() => {
		const sections = [];
		if ($selectedProcesses && $selectedProcesses.length > 0) {
			sections.push(
				`■ 대상 프로세스 (${deploymentTypeMap[$deploymentType]})\n${formatToList($selectedProcesses)}`
			); // Added deploymentType
		}
		if ($workDescription && $workDescription.trim()) {
			sections.push(`■ 작업 내용\n${formatToList($workDescription.split('\n'))}`);
		}
		if ($workTime) {
			sections.push(`■ 작업 시간\n- ${formattedWorkTime}`);
		}
		if ($remarks && $remarks.trim()) {
			sections.push(`■ 비고\n${formatToList($remarks.split('\n'))}`);
		}

		return `안녕하세요. 시스템코어개발팀 ${$developer}입니다.
아래 내용으로 서비스 배포 요청드립니다.

{noformat}
${sections.join('\n\n')}
{noformat}

감사합니다.`;
	})();

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

	// --- Warn user before leaving the page ---
	function handleBeforeUnload(event) {
		// Only warn if there's some input that might be lost
		if ($workDescription.trim() !== '' || $remarks.trim() !== '') {
			event.preventDefault();
			event.returnValue = '변경사항이 저장되지 않을 수 있습니다. 정말로 나가시겠습니까?';
			return event.returnValue;
		}
	}
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />

<div class="container mx-auto p-4">
	<h1 class="mb-4 text-2xl font-bold">배포 요청 양식</h1>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Input Section -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<h2 class="card-title">입력</h2>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="form-control w-full">
						<label for="service" class="label"><span class="label-text">서비스</span></label>
						<select id="service" bind:value={$service} class="select-bordered select w-full">
							{#each services as s (s.value)}
								<option value={s.value}>{s.label}</option>
							{/each}
						</select>
					</div>

					<div class="form-control w-full">
						<label for="deploymentType" class="label"
							><span class="label-text">배포 타입</span></label
						>
						<select
							id="deploymentType"
							bind:value={$deploymentType}
							class="select-bordered select w-full"
						>
							{#each deploymentTypes as dt (dt.value)}
								<option value={dt.value}>{dt.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<!-- Combined Developer and Work Time -->
					<div class="form-control w-full">
						<label for="developer" class="label"><span class="label-text">담당자</span></label>
						<select id="developer" bind:value={$developer} class="select-bordered select w-full">
							{#each developers as d (d)}
								<option value={d}>{d}</option>
							{/each}
						</select>
					</div>

					<div class="form-control w-full">
						<label for="workTime" class="label"><span class="label-text">작업 시간</span></label>
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
					<h3 class="label"><span class="label-text">대상 프로세스</span></h3>
					<div class="block space-y-2 rounded-lg border border-base-300 bg-base-200 p-2">
						{#if availableProcesses.length > 0}
							{#each availableProcesses as process (process)}
								<label class="flex cursor-pointer items-center">
									<input
										type="checkbox"
										value={process}
										bind:group={$selectedProcesses}
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
					<label for="workDescription" class="label"
						><span class="label-text">작업 내용 (한 줄에 하나씩)</span></label
					>
					<textarea
						id="workDescription"
						bind:value={$workDescription}
						rows="4"
						class="textarea-bordered textarea w-full"
						placeholder="[비즈뿌리오] RCS 대표 발신번호 변경 기능 추가 (NBIZPPURIO-2771)&#13;배치잡 시작/종료 로그 추가 (NUFIT-566)"
					></textarea>
				</div>

				<div class="form-control w-full">
					<label for="remarks" class="label"><span class="label-text">비고</span></label>
					<textarea
						id="remarks"
						bind:value={$remarks}
						rows="3"
						class="textarea-bordered textarea w-full"
						placeholder="DB 선작업 이후 진행 (NSVCOPS-3233)"
					></textarea>
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
