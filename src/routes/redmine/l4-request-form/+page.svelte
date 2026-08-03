<script>
	import { onMount } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import ToolPage from '$lib/components/ToolPage.svelte';
	import { USER_NAMES } from '$lib/config/users.js';
	import { resolveCurrentUser } from '$lib/stores/currentUser.js';

	// --- 입력 상태 ---
	let developer = $state('최경림');
	// 접속 IP 로 담당자를 추정해 한 번만 채운다. 직접 고른 뒤에는 건드리지 않는다.
	let developerPicked = $state(false);
	onMount(async () => {
		const me = await resolveCurrentUser();
		if (me && !developerPicked) developer = me;
	});
	let selectedTargets = $state([]);
	let workTime = $state('');

	// --- Options for Selects and Checkboxes ---
	const developers = USER_NAMES;
	const workTargets = [
		{
			code: 'kapi',
			name: 'KAPI',
			text: '<tr><td>kapi</td><td>27.102.215.47</td><td>80,443</td><td>8091,8447</td><td>stella01, stella02</td></tr>'
		},
		{
			code: 'rapi',
			name: 'RAPI',
			text: '<tr><td>rapi</td><td>115.71.53.22</td><td>80,443</td><td>8092,8448</td><td>stella01, stella02</td></tr>'
		},
		{
			code: 'napi',
			name: 'NAPI',
			text: '<tr><td>napi</td><td>115.71.53.19</td><td>80,443</td><td>8093,8449</td><td>stella01, stella02</td></tr>'
		},
		{
			code: 'salesApi',
			name: 'SAPI',
			text: '<tr><td>salesApi</td><td>115.71.53.20</td><td>80,443</td><td>8089,8445</td><td>stella01, stella02</td></tr>'
		},
		{
			code: 'ivr',
			name: 'IVR',
			text: '<tr><td>ivr</td><td>115.71.53.23</td><td>80,443</td><td>8090,8446</td><td>stella01, stella02</td></tr>'
		},
		{
			code: 'forward',
			name: '팩스포워드',
			text: '<tr><td>forward</td><td>115.71.53.25</td><td>9000,19000</td><td>9000,19000</td><td>stella01, stella02, stella03 (Apache 미사용)</td></tr>'
		},
		{
			code: 'numball',
			name: '번자관',
			text: '<tr><td>numball</td><td>115.71.53.232</td><td>443</td><td>14119</td><td>lucy01a, lucy02a</td></tr>'
		}
	];

	const numballText = workTargets.find((t) => t.code === 'numball')?.text ?? '';
	const isNumballSelected = $derived(numballText ? selectedTargets.includes(numballText) : false);
	const hasOtherSelections = $derived(selectedTargets.some((t) => t !== numballText));

	// --- Fixed Content ---
	const workContent = 'L4 disable/enable 및 Apache LB worker 작업 요청';

	// --- Initial Data Loading ---
	onMount(() => {
		if (!workTime) {
			const now = new SvelteDate();
			now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
			const year = now.getFullYear();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const day = now.getDate().toString().padStart(2, '0');
			workTime = `${year}-${month}-${day}T18:00`;
		}
	});

	// --- Helper function for formatting HTML table ---
	function formatToHtmlTable(items) {
		if (!items || items.length === 0) return '';
		const header = `<table>
<thead>
<tr>
<th>서비스명</th>
<th>Virtual IP</th>
<th>Virtual Port</th>
<th>Real Port</th>
<th>대상 서버</th>
</tr>
</thead>
<tbody>`;
		const footer = `</tbody>
</table>`;
		const rows = items.filter((item) => item.trim() !== '').join('\n');
		return [header, rows, footer].join('\n');
	}

	// --- Reactive Output Generation ---
	const formattedWorkTime = $derived(workTime ? workTime.replace('T', ' ') : '');
	const outputTitle = $derived(
		isNumballSelected
			? '[번호자원관리시스템] lucy L4 작업 요청'
			: hasOtherSelections
				? '[비즈뿌리오] stella L4 작업 요청'
				: '[서비스명] L4 작업 요청'
	);
	const outputBody = $derived(`<p>안녕하세요. 시스템코어개발팀 ${developer}입니다.<br />
아래 내용으로 작업 요청 드립니다.</p>
<p>■ 작업 내용<br />
&nbsp;- ${workContent}</p>
<p>■ 작업 대상</p>
${formatToHtmlTable(selectedTargets)}
<p>■ 작업 시나리오</p>
<ol>
<li>아파치 설정 작업 (1~N 전부)
<blockquote>cd /home/service/apache/\\{서비스명}/conf/<br />
cp worker.properties.deploy ./worker.properties<br />
/home/service/apache/\\{서비스명}/bin/apachectl graceful<br />
</blockquote>
</li>
<li>1번 L4 제외</li>
<li>1번 서비스 배포</li>
<li>1번 L4 포함</li>
<li>2~4 서버별 반복</li>
<li>L4 모두 허용 시 아파치 설정 원복
<blockquote>cd /home/service/apache/\\{서비스명}/conf/<br />
cp worker.properties.org ./worker.properties<br />
/home/service/apache/\\{서비스명}/bin/apachectl graceful
</blockquote>
</li>
</ol>
<p>■ 작업 일시<br />
&nbsp;- ${formattedWorkTime}</p>
<p>감사합니다.</p>`);
</script>

<ToolPage>
	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Input Section -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<h2 class="card-title">입력</h2>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="form-control w-full">
						<label for="developer" class="label">
							<span class="label-text">담당자</span>
						</label>
						<select
							id="developer"
							bind:value={developer}
							onchange={() => (developerPicked = true)}
							class="select-bordered select w-full"
						>
							{#each developers as d (d)}
								<option value={d}>{d}</option>
							{/each}
						</select>
					</div>

					<div class="form-control w-full">
						<label for="workTime" class="label">
							<span class="label-text">작업 일시</span>
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
						<span class="label-text">작업 대상</span>
					</h3>
					<div class="block space-y-2 rounded-lg border border-base-300 bg-base-200 p-2">
						{#each workTargets as target (target.code)}
							<label class="flex cursor-pointer items-center">
								<input
									type="checkbox"
									value={target.text}
									bind:group={selectedTargets}
									class="checkbox checkbox-primary"
									disabled={(target.code !== 'numball' && isNumballSelected) ||
										(target.code === 'numball' && hasOtherSelections)}
								/>
								<span class="label-text ml-2">{target.name}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<ResultPanel title={outputTitle} body={outputBody} rows={20} />
	</div>
</ToolPage>
