<script>
	import { SvelteDate } from 'svelte/reactivity';

	// --- State for "개발 승인 요청" ---
	let devEffort = 1;
	let testEffort = 1;
	let detailedEffort = '';
	let remarks = '';
	const today = new SvelteDate().toISOString().split('T')[0];
	let startDate = today;
	let targetDate = today;
	let copied1 = false;

	// --- State for "개발 완료 승인 요청" ---
	let endDate = today;
	let prLink = '';
	let tcLink = '';
	let copied2 = false;
	let isShortening = false;
	$: canShortenUrl = tcLink.startsWith('https://daoucokr.sharepoint.com/:x:/r/sites/syscore/_layouts/15/Doc.aspx?sourcedoc=') && !isShortening;

	// --- Logic for "개발 승인 요청" ---
	function validateEffort(value) {
		let numValue = parseFloat(value);
		if (isNaN(numValue)) return 0;
		if (numValue > 365) return 365;
		if (numValue < 0) return 0;
		return parseFloat(numValue.toFixed(3));
	}

	$: totalEffort = (devEffort || 0) + (testEffort || 0);
	$: formattedDetailedEffort = detailedEffort
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => `- ${line.trim()}`)
		.join('\n');
	$: formattedStartDate = startDate.replace(/-/g, '/');
	$: formattedTargetDate = targetDate.replace(/-/g, '/');
	$: remarksSection = remarks.trim() ? `\n\n■ 비고\n${remarks.trim()}` : '';
	$: resultText1 = `아래와 같이 공수 및 개발 일정을 산정하였습니다.
확인 부탁 드립니다.

{noformat}
■ 총 공수: ${totalEffort}D = 개발공수(${devEffort || 0}D) + 테스트/TC(${testEffort || 0}D)

■ 상세 개발 공수
${formattedDetailedEffort}

■ 개발 일정
- 시작일: ${formattedStartDate}
- 목표일: ${formattedTargetDate}${remarksSection}
{noformat}`;

	function copyToClipboard1() {
		navigator.clipboard.writeText(resultText1).then(() => {
			copied1 = true;
			setTimeout(() => (copied1 = false), 2000);
		});
	}

	// --- Logic for "개발 완료 승인 요청" ---
	// 1. PR링크는 줄내림을 기준으로 여러개 등록이 가능하다.
	$: prLines = prLink
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => {
			try {
				const url = new URL(line.trim());
				const pathParts = url.pathname.split('/').filter(Boolean);
				const serviceName = pathParts.length >= 4 ? pathParts[3] : '서비스명';
				return `- PR(${serviceName}) : ${line.trim()}`;
			} catch {
				return `- PR(Invalid URL) : ${line.trim()}`;
			}
		})
		.join('\n');

	$: formattedEndDate = endDate.replace(/-/g, '/');
	$: resultText2 = `${prLines}
- TC : ${tcLink}

개발 완료 승인 요청 드립니다.
{noformat}
- 종료일: ${formattedEndDate}
{noformat}`;

	async function shortenUrl() {
		if (!tcLink) {
			alert('TC 링크를 입력해주세요.');
			return;
		}
		isShortening = true;
		try {
			const response = await fetch('/api/shorten', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({
					org_url: tcLink,
					customer_id: 'berryzed',
					partner_api_id: '136C8F3B1452BF8CC8536931982FD993'
				})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
				// noinspection ExceptionCaughtLocallyJS
				throw new Error(`URL 단축 실패: ${errorData.error}`);
			}
			const data = await response.json();
			if (data.result !== 'Y') {
				// noinspection ExceptionCaughtLocallyJS
				throw new Error(`URL 단축 실패: ${data.message || '알 수 없는 오류'}`);
			}
			tcLink = data.url;
		} catch (error) {
			console.error('URL Shortening Error:', error);
			alert(`URL 단축 중 오류가 발생했습니다: ${error.message}.`);
		} finally {
			isShortening = false;
		}
	}

	function copyToClipboard2() {
		navigator.clipboard.writeText(resultText2).then(() => {
			copied2 = true;
			setTimeout(() => (copied2 = false), 2000);
		});
	}

	// --- Common Logic ---
	function handleBeforeUnload(event) {
		event.preventDefault();
		event.returnValue = '변경사항이 저장되지 않을 수 있습니다. 정말로 나가시겠습니까?';
		return event.returnValue;
	}
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />

<div class="container mx-auto space-y-12 p-4">
	<!-- 개발 승인 요청 -->
	<div>
		<h1 class="mb-4 text-2xl font-bold">개발 승인 요청</h1>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">입력</h2>
					<div class="grid grid-cols-2 gap-4">
						<div class="form-control w-full">
							<label class="label" for="dev-effort"
								><span class="label-text">개발공수 (D)</span></label
							><input
								id="dev-effort"
								type="number"
								class="input-bordered input w-full"
								bind:value={devEffort}
								min="0"
								max="365"
								step="0.125"
								on:input={(e) => (devEffort = validateEffort(e.target.value))}
							/>
						</div>
						<div class="form-control w-full">
							<label class="label" for="test-effort"
								><span class="label-text">테스트 공수 (D)</span></label
							><input
								id="test-effort"
								type="number"
								class="input-bordered input w-full"
								bind:value={testEffort}
								min="0"
								max="365"
								step="0.125"
								on:input={(e) => (testEffort = validateEffort(e.target.value))}
							/>
						</div>
					</div>
					<div class="form-control relative w-full">
						<label class="label" for="detailed-effort"
							><span class="label-text">상세 개발 공수 (한 줄에 하나씩)</span></label
						>
						<textarea
							id="detailed-effort"
							class="textarea-bordered textarea h-24 w-full"
							bind:value={detailedEffort}
							placeholder="작업1 (0.5D)&#13;작업2 (0.5D)"
						></textarea>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="form-control w-full">
							<label class="label" for="start-date"><span class="label-text">시작일</span></label
							><input
								id="start-date"
								type="date"
								class="input-bordered input w-full"
								bind:value={startDate}
								on:keydown={(e) => e.preventDefault()}
							/>
						</div>
						<div class="form-control w-full">
							<label class="label" for="target-date"><span class="label-text">목표일</span></label
							><input
								id="target-date"
								type="date"
								class="input-bordered input w-full"
								bind:value={targetDate}
								on:keydown={(e) => e.preventDefault()}
							/>
						</div>
					</div>
					<div class="form-control w-full">
						<label class="label" for="remarks"><span class="label-text">비고</span></label><textarea
							id="remarks"
							class="textarea-bordered textarea h-24 w-full"
							bind:value={remarks}
							placeholder="ex) 연차 사용: 2025/01/01"
						></textarea>
					</div>
				</div>
			</div>
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="card-title">결과</h2>
						<button class="btn btn-sm btn-primary" on:click={copyToClipboard1}
							>{#if copied1}복사 완료!{:else}복사하기{/if}</button
						>
					</div>
					<div class="form-control">
						<!--suppress HtmlUnknownAttribute -->
						<textarea class="textarea-bordered textarea h-96 w-full" readonly value={resultText1}
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 개발 완료 승인 요청 -->
	<div>
		<h1 class="mb-4 text-2xl font-bold">개발 완료 승인 요청</h1>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">입력</h2>
					<div class="form-control w-full">
						<label class="label" for="end-date"><span class="label-text">종료일</span></label>
						<input
							id="end-date"
							type="date"
							class="input-bordered input w-full"
							bind:value={endDate}
							on:keydown={(e) => e.preventDefault()}
						/>
					</div>
					<div class="form-control relative w-full">
						<label class="label" for="pr-link"
							><span class="label-text">PR 링크 (한 줄에 하나씩)</span></label
						>
						<textarea
							id="pr-link"
							class="textarea-bordered textarea h-24 w-full"
							bind:value={prLink}
							placeholder="https://repo.daou.co.kr/projects/UFIT/repos/ufit-bill-batch/pull-requests/21/overview&#13;https://repo.daou.co.kr/projects/BIZ/repos/bizexternalapi/pull-requests/200/overview"
						></textarea>
					</div>
					<div class="form-control w-full">
						<label class="label" for="tc-link"><span class="label-text">TC 링크</span></label>
						<div class="join w-full">
							<input
								id="tc-link"
								type="text"
								class="input-bordered input join-item w-full"
								placeholder="https://daoucokr.sharepoint.com/:x:/r/sites/syscore/_layouts/15/Doc.aspx?sourcedoc="
								bind:value={tcLink}
							/>
							<button
								class="btn join-item btn-secondary"
								on:click={shortenUrl}
								disabled={!canShortenUrl}
							>
								{#if isShortening}<span class="loading loading-spinner"></span>{/if}
								짧은URL 변환
							</button>
						</div>
					</div>
				</div>
			</div>
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="card-title">결과</h2>
						<button class="btn btn-sm btn-primary" on:click={copyToClipboard2}
							>{#if copied2}복사 완료!{:else}복사하기{/if}</button
						>
					</div>
					<div class="form-control">
						<!--suppress HtmlUnknownAttribute -->
						<textarea class="textarea-bordered textarea h-96 w-full" readonly value={resultText2}
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
