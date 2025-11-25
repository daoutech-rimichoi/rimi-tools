<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { SvelteDate } from 'svelte/reactivity';

	// Helper function to create a writable store that persists to localStorage
	const createPersistentStore = (key, startValue) => {
		const initialValue = (browser && localStorage.getItem(key)) || startValue;
		const store = writable(initialValue);

		store.subscribe((value) => {
			if (browser) {
				localStorage.setItem(key, value);
			}
		});

		return store;
	};

	// State variables for textareas using the persistent store
	const approved = createPersistentStore('deployment_approved', '');
	const pending = createPersistentStore('deployment_pending', '');
	const redmine = createPersistentStore('deployment_redmine', '');
	const scenario = createPersistentStore('deployment_scenario', '');
	let title = '';

	// Function to calculate the week number based on Wednesday
	function updateTitle() {
		const now = new SvelteDate();
		const wednesday = new SvelteDate(now);
		wednesday.setDate(now.getDate() - now.getDay() + 3);
		const month = wednesday.getMonth() + 1;
		const year = wednesday.getFullYear();
		const firstDayOfMonth = new SvelteDate(year, month - 1, 1);
		const firstWednesdayDate = 1 + ((3 - firstDayOfMonth.getDay() + 7) % 7);
		const week = Math.floor((wednesday.getDate() - firstWednesdayDate) / 7) + 1;
		title = `[${month}월 ${week}주차 정기 배포 예정건]`;
	}

	onMount(() => {
		updateTitle();
	});

	// Formatting logic
	function formatToList(text, prefix = '  - ') {
		if (!text || !text.trim()) return '';
		return text
			.split('\n')
			.filter((line) => line.trim() !== '')
			.map((line) => prefix + line.trim())
			.join('\n');
	}

	$: formattedApproved = formatToList($approved);
	$: formattedPending = formatToList($pending);
	$: formattedRedmine = formatToList($redmine, '  - ');
	$: formattedScenario = formatToList($scenario, '  - ');

	$: sections = [
		{ title: '■ 승인 완료', content: formattedApproved },
		{ title: '■ 승인 대기', content: formattedPending },
		{ title: '※ 배포 요청 Redmine', content: formattedRedmine },
		{ title: '※ 비고', content: formattedScenario }
	];

	$: output = [
		title,
		...sections.filter((s) => s.content).map((s) => `${s.title}\n${s.content}`)
	].join('\n\n');

	// Clipboard logic
	let copied = false;
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(output);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('클립보드 복사 실패:', err);
			alert('클립보드 복사에 실패했습니다.');
		}
	}
</script>

<div class="container mx-auto p-4">
	<h1 class="mb-4 text-2xl font-bold">배포 현황 공유 양식</h1>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Input Section -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<h2 class="card-title">입력</h2>
				<div class="form-control w-full">
					<label for="approved" class="label">
						<span class="label-text">■ 승인 완료 (한 줄에 하나씩)</span>
					</label>
					<textarea
						id="approved"
						bind:value={$approved}
						rows="5"
						class="textarea-bordered textarea w-full"
						placeholder="[비즈뿌리오] 카카오 브랜드 메시지 스펙변경_이미지형 (NBIZPPURIO-3097)"
					></textarea>
				</div>
				<div class="form-control w-full">
					<label for="pending" class="label">
						<span class="label-text">■ 승인 대기 (한 줄에 하나씩)</span>
					</label>
					<textarea
						id="pending"
						bind:value={$pending}
						rows="5"
						class="textarea-bordered textarea w-full"
						placeholder="[비즈뿌리오] 그룹 태그 관리 API 개발 (NBIZPPURIO-3112)"
					></textarea>
				</div>
				<div class="form-control w-full">
					<label for="redmine" class="label">
						<span class="label-text">※ 배포 요청 Redmine (한 줄에 하나씩)</span>
					</label>
					<textarea
						id="redmine"
						bind:value={$redmine}
						rows="5"
						class="textarea-bordered textarea w-full"
						placeholder="[대기] 비즈뿌리오 웹/배치 (137)"
					></textarea>
				</div>
				<div class="form-control w-full">
					<label for="scenario" class="label">
						<span class="label-text">※ 비고 (한 줄에 하나씩)</span>
					</label>
					<textarea
						id="scenario"
						bind:value={$scenario}
						rows="5"
						class="textarea-bordered textarea w-full"
						placeholder="[완료] 운영작업시나리오"
					></textarea>
				</div>
			</div>
		</div>

		<!-- Output Section -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="card-title">결과</h2>
					<button on:click={copyToClipboard} class="btn btn-sm btn-primary">
						{#if copied}복사 완료!{:else}복사하기{/if}
					</button>
				</div>
				<!--suppress HtmlUnknownAttribute -->
				<textarea
					id="output"
					readonly
					value={output}
					rows="26"
					class="textarea-bordered textarea w-full font-mono"
				></textarea>
			</div>
		</div>
	</div>
</div>
