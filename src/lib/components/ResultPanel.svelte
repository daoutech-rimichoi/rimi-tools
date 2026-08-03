<script>
	import CopyButton from './CopyButton.svelte';
	import Icon from './Icon.svelte';

	/**
	 * 생성기 도구의 공통 결과 패널.
	 * 제목 필드는 title 을 넘길 때만, 미리보기 탭은 preview 가 true 일 때만 나온다.
	 *
	 * @property title        제목 결과값 (없으면 제목 필드 미노출)
	 * @property body         본문 결과값
	 * @property rows         본문 textarea 줄 수
	 * @property heightClass  rows 대신 높이를 클래스로 줄 때 (예: 'h-96')
	 * @property preview      HTML 미리보기 탭 노출 여부
	 * @property heading      카드 제목
	 * @property sticky       스크롤 시 결과 패널을 따라오게 할지
	 */
	let {
		title = null,
		body,
		rows = 20,
		heightClass = '',
		preview = true,
		heading = '결과',
		sticky = true
	} = $props();

	let tab = $state('source'); // 'source' | 'preview'

	// 붙여넣기 전에 채워야 할 자리표시자가 남아 있는지.
	// 대괄호형만 본다 — 본문 시나리오의 `\{서비스명}` 은 작업자에게 주는 안내 문구라 대상이 아니다.
	const PLACEHOLDER = /\[서비스명\]|\[대상\]|\[선택\]/g;
	const leftovers = $derived([
		...new Set([...`${title ?? ''}\n${body ?? ''}`.matchAll(PLACEHOLDER)].map((m) => m[0]))
	]);
</script>

<div class="card bg-base-200 shadow-xl {sticky ? 'lg:sticky lg:top-20' : ''}">
	<div class="card-body">
		{#if title === null}
			<!-- 본문만 있을 때는 카드 제목 줄에 버튼을 둔다 -->
			<div class="mb-3 flex items-center justify-between gap-2">
				<h2 class="card-title">{heading}</h2>
				<CopyButton text={body} label="복사하기" />
			</div>
		{:else}
			<h2 class="mb-4 card-title">{heading}</h2>

			<div class="form-control mb-5 w-full">
				<div class="label mb-2 flex items-center justify-between gap-2">
					<span class="label-text">제목</span>
					<CopyButton text={title} label="제목 복사하기" />
				</div>
				<input
					type="text"
					readonly
					value={title}
					class="input-bordered input w-full font-mono"
					aria-label="생성된 제목"
				/>
			</div>

			<div class="label mb-2 flex items-center justify-between gap-2">
				<span class="label-text">본문</span>
				<CopyButton text={body} label="본문 복사하기" />
			</div>
		{/if}

		{#if leftovers.length > 0}
			<div
				class="mb-2 flex items-start gap-2 rounded-field bg-warning/10 px-3 py-2 text-xs text-warning"
			>
				<Icon name="alert" size={15} class="mt-px shrink-0" />
				<span>
					아직 채우지 않은 항목이 있어요 — <span class="font-mono">{leftovers.join(', ')}</span>
				</span>
			</div>
		{/if}

		{#if preview}
			<!-- 소스 / 미리보기 전환. 모달 없이 이 자리에서 바로 확인한다. -->
			<div role="tablist" class="tabs tabs-box mb-2 w-fit">
				<button
					role="tab"
					class="tab gap-1.5 {tab === 'source' ? 'tab-active' : ''}"
					onclick={() => (tab = 'source')}
				>
					<Icon name="code" size={14} /> 소스
				</button>
				<button
					role="tab"
					class="tab gap-1.5 {tab === 'preview' ? 'tab-active' : ''}"
					onclick={() => (tab = 'preview')}
				>
					<Icon name="eye" size={14} /> 미리보기
				</button>
			</div>
		{/if}

		{#if preview && tab === 'preview'}
			<div
				class="redmine-preview overflow-auto rounded-box border border-base-300 p-4 {heightClass ||
					'min-h-80'}"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- 이 도구가 직접 만든 HTML 미리보기 -->
				{@html body}
			</div>
		{:else}
			<textarea
				readonly
				value={body}
				rows={heightClass ? undefined : rows}
				class="textarea-bordered textarea w-full font-mono {heightClass}"
				aria-label="생성된 본문"
			></textarea>
		{/if}
	</div>
</div>

<style>
	/*
	 * Redmine 에 붙여넣었을 때와 같게 보이도록, Redmine 의 실제 렌더 스타일을 옮겨 놓는다.
	 * 출처: redmine/public/stylesheets/application.css (body, blockquote, div.wiki *)
	 * Tailwind preflight 가 p/blockquote/ul/table 기본 스타일을 지우므로 여기서 복원해야 한다.
	 * {@html} 로 넣은 내용에는 Svelte 스코프가 안 붙어 :global() 이 필요하다.
	 */
	.redmine-preview {
		background: #fff;
		color: #333;
		font-family: Verdana, 'Malgun Gothic', '맑은 고딕', sans-serif;
		font-size: 12px;
		line-height: 1.5;
	}

	.redmine-preview :global(p) {
		margin: 1em 0;
	}
	.redmine-preview :global(p:first-child) {
		margin-top: 0;
	}
	.redmine-preview :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Redmine 은 italic 이지만, 한글은 합성 기울임이 지저분해 세우고 나머지는 동일하게 맞춘다 */
	.redmine-preview :global(blockquote) {
		margin: 1em 0;
		border-left: 3px solid #e0e0e0;
		padding-left: 0.6em;
	}

	.redmine-preview :global(ul),
	.redmine-preview :global(ol) {
		margin: 0 0 1em;
		padding-left: 40px;
	}
	.redmine-preview :global(ul) {
		list-style: disc;
	}
	.redmine-preview :global(ol) {
		list-style: decimal;
	}
	.redmine-preview :global(li > ul),
	.redmine-preview :global(li > ol) {
		margin-bottom: 0;
	}

	.redmine-preview :global(table) {
		border-collapse: collapse;
		margin-bottom: 1em;
	}
	.redmine-preview :global(table),
	.redmine-preview :global(td),
	.redmine-preview :global(th) {
		border: 1px solid #bbb;
		padding: 4px;
	}
	.redmine-preview :global(th) {
		font-weight: bold;
		text-align: center;
	}

	.redmine-preview :global(h1) {
		margin: 0.67em 0;
		font-size: 2em;
		font-weight: bold;
	}
	.redmine-preview :global(h2) {
		margin: 0.75em 0;
		font-size: 1.8em;
		font-weight: bold;
	}
	.redmine-preview :global(h3) {
		margin: 0.83em 0;
		font-size: 1.5em;
		font-weight: bold;
	}
	.redmine-preview :global(h4) {
		margin: 1em 0;
		font-size: 1.2em;
		font-weight: bold;
	}

	.redmine-preview :global(pre) {
		margin: 1em 1em 1em 1.6em;
		border: 1px solid #e2e2e2;
		border-radius: 3px;
		background-color: #fafafa;
		padding: 8px;
		overflow-x: auto;
		font-family: monospace;
	}
	.redmine-preview :global(code) {
		border-radius: 0.1em;
		background: rgba(62, 91, 118, 0.08);
		padding: 0.1em;
		font-family: monospace;
	}

	.redmine-preview :global(a) {
		color: #169;
		text-decoration: none;
	}
	.redmine-preview :global(strong) {
		font-weight: bold;
	}
	.redmine-preview :global(em) {
		font-style: italic;
	}
</style>
