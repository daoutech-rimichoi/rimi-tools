<script>
	import { onMount, onDestroy } from 'svelte';
	import { SvelteDate, SvelteSet } from 'svelte/reactivity';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import { toast } from '$lib/stores/common.js';
	import { supabase } from '$lib/supabaseClient.js';
	import { createPresenceStore } from '$lib/stores/presenceStore.js';
	import ToolPage from '$lib/components/ToolPage.svelte';
	import TableSkeleton from '$lib/components/TableSkeleton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		CUSTOM_INPUT,
		DEPLOY_TARGET_NAMES,
		PLACEHOLDER_SERVICE,
		PLACEHOLDER_TASK,
		SCENARIO_SERVICE_NAMES,
		SCENARIO_TYPE_NAMES
	} from '$lib/config/services.js';

	// select 목록은 서비스 카탈로그에서 파생한다 (앞: 미선택 항목, 뒤: 직접입력)
	const serviceOptions = [PLACEHOLDER_SERVICE, ...DEPLOY_TARGET_NAMES, CUSTOM_INPUT];
	const scenarioTypeOptions = [PLACEHOLDER_TASK, ...SCENARIO_TYPE_NAMES, CUSTOM_INPUT];
	const scenarioServiceOptions = [PLACEHOLDER_SERVICE, ...SCENARIO_SERVICE_NAMES, CUSTOM_INPUT];
	import { beforeNavigate } from '$app/navigation';
	import {
		REDMINE_BASE_URL,
		deployRequestCsvUrl,
		issuesCsvUrl,
		parseVersionId,
		versionUrl
	} from '$lib/config/redmine.js';
	import { decodeCsv, parseRedmineCsv } from '$lib/utils/redmineCsv.js';
	import { USER_NAMES } from '$lib/config/users.js';

	/** 담당자를 안 고른 상태. 빈 문자열로 두면 select 가 안내 항목을 고른다. */
	const NO_WORKER = '';

	/** 승인 완료 / 승인 대기 행 하나 */
	const newValueRow = (value = '', worker = NO_WORKER) => ({
		id: crypto.randomUUID(),
		value,
		worker
	});

	/** 담당자 칸이 없던 시절에 저장된 행을 읽어도 select 가 깨지지 않게 한다 */
	const withWorker = (rows) => rows.map((row) => ({ worker: NO_WORKER, ...row }));

	/** 비고 행 하나. 4곳에서 같은 리터럴을 쓰던 것을 모았다. */
	const newScenarioRow = () => ({
		id: crypto.randomUUID(),
		status: '대기',
		type: '작업선택',
		customText: '',
		service: '서비스선택',
		customService: '',
		redmine: '' // 작업 종류가 DB 일 때 쓰는 일감번호
	});

	/** 일감번호 칸이 없던 시절에 저장된 비고 행을 읽어도 input 이 깨지지 않게 한다 */
	const withIssueNo = (rows) => rows.map((row) => ({ redmine: '', ...row }));

	// 서비스 목록 (배포요청용)

	// 비고용 타입 옵션

	// 비고용 서비스 옵션

	// 행 데이터 구조
	let approvedRows = $state([newValueRow()]);
	let pendingRows = $state([newValueRow()]);
	let redmineRows = $state([
		{
			id: crypto.randomUUID(),
			status: '대기',
			service: '서비스선택',
			customService: '',
			redmine: ''
		}
	]);
	let scenarioRows = $state([newScenarioRow()]);
	let deployOrderRows = $state([
		{ id: crypto.randomUUID(), service: '서비스선택', customService: '' }
	]);

	/**
	 * 담당자 select 목록.
	 * 저장된 값이나 CSV 에서 온 이름이 users.js 에 없으면 select 가 빈칸으로 보이므로 뒤에 붙여 준다.
	 */
	const workerOptions = $derived.by(() => {
		const known = new Set(USER_NAMES);
		const extra = [...approvedRows, ...pendingRows]
			.map((r) => r.worker)
			.filter((w) => w && !known.has(w));
		return [...USER_NAMES, ...new Set(extra)];
	});

	let title = $state('');
	let isSaving = $state(false);
	let isLoading = $state(true);

	// 드래그 상태
	let draggedItem = $state(null);
	let draggedFrom = $state(null);

	// Presence tracking for real-time collaboration
	// --- 레드마인에서 일감 가져오기 ---
	//
	// 레드마인은 사내망(사설 IP)에 있어 배포된 서버에서 직접 호출할 수 없고,
	// CORS 헤더도 없어 브라우저에서 fetch 로 읽을 수도 없다.
	// 반면 CSV 내려받기는 브라우저의 레드마인 로그인 세션으로 되는 일반 다운로드라
	// 두 제약을 모두 피한다. 그래서 CSV 를 유일한 경로로 쓴다. (API 키 불필요)
	//
	// 가져오는 곳이 둘이다:
	//   1. 로드맵(버전)  -> 배포 예정 일감  -> '승인 대기' 에 추가
	//   2. 고정 필터     -> 배포 요청 일감  -> '배포 요청 Redmine' 에 추가
	let redmineOpen = $state(false); // 자주 쓰는 기능이 아니라 기본은 접힘
	let redmineTab = $state('roadmap'); // 'roadmap' | 'deploy'
	let isDragOver = $state(false);
	let filePicker = $state(null); // 드롭존을 눌렀을 때 열 파일 선택 input (bind:this)

	let roadmapInput = $state('');
	let roadmapError = $state('');
	let roadmapNotice = $state('');
	let roadmapIssues = $state([]);
	const roadmapChecked = new SvelteSet();

	let deployError = $state('');
	let deployNotice = $state('');
	let deployIssues = $state([]);
	const deployChecked = new SvelteSet();

	// 입력한 로드맵 번호 (URL 을 붙여넣어도 번호만 추출)
	const roadmapId = $derived(parseVersionId(roadmapInput));

	/** 로드맵 번호는 매번 다시 입력하기 번거로워 브라우저에 남겨 둔다 */
	const ROADMAP_KEY = 'rimi-tools:roadmap-input';
	function setRoadmapInput(value) {
		roadmapInput = value;
		try {
			localStorage.setItem(ROADMAP_KEY, value);
		} catch {
			// 시크릿 모드 등에서 저장이 막혀도 입력 자체는 되어야 한다
		}
	}

	const MISSING_COLUMN_LABELS = { status: '상태', worker: '담당자' };
	const TAB_LABELS = { roadmap: '로드맵', deploy: '배포요청' };
	/** 배포요청 목록에만 '서비스분류' 열이 있다. 탭에 맞는 목록인지 가리는 기준. */
	const TAB_HAS_CATEGORY = { roadmap: false, deploy: true };

	const applyImport = {
		roadmap: ({ issues, error, notice }) => {
			roadmapIssues = issues;
			roadmapError = error;
			roadmapNotice = notice;
		},
		deploy: ({ issues, error, notice }) => {
			deployIssues = issues;
			deployError = error;
			deployNotice = notice;
		}
	};

	/**
	 * CSV 텍스트를 받아 해당 탭 목록으로 만든다.
	 * 두 CSV 가 모두 issues.csv 라는 같은 이름으로 떨어져 헷갈리기 쉬우므로
	 * 열 구성으로 탭이 맞는지 확인하고 아니면 거절한다.
	 */
	function importText(text, tab) {
		const apply = applyImport[tab];
		apply({ issues: [], error: '', notice: '' });
		checkedOf(tab).clear();
		try {
			const { issues, missing, hasCategory } = parseRedmineCsv(text);
			if (hasCategory !== TAB_HAS_CATEGORY[tab]) {
				const other = tab === 'roadmap' ? 'deploy' : 'roadmap';
				throw new Error(
					`${TAB_LABELS[tab]} 목록이 아닙니다. ${TAB_LABELS[other]} 쪽에서 받은 것 같습니다.`
				);
			}
			const notice = missing.length
				? `${missing.map((m) => MISSING_COLUMN_LABELS[m]).join('·')} 열이 없어 비어 있습니다.`
				: '';
			apply({ issues, error: '', notice });
			// 대개 전부 넣으므로 아직 안 들어간 것만 미리 체크해 둔다
			const isAdded = addedChecker(tab);
			for (const issue of issues) if (!isAdded(issue)) checkedOf(tab).add(issue.id);
			toast.show(`일감 ${issues.length}건을 가져왔습니다.`, 'success');
		} catch (e) {
			apply({ issues: [], error: e.message ?? '목록을 읽지 못했습니다.', notice: '' });
		}
	}

	/** 내려받은 CSV 파일을 읽어 목록으로 만든다 (CP949 도 처리) */
	async function importFile(file, tab) {
		if (!file) return;
		try {
			importText(decodeCsv(await file.arrayBuffer()), tab);
		} catch {
			applyImport[tab]({ issues: [], error: '파일을 읽지 못했습니다.', notice: '' });
		}
	}

	function handleFilePicked(e) {
		importFile(e.currentTarget.files?.[0], redmineTab);
		e.currentTarget.value = ''; // 같은 파일을 다시 골라도 change 가 뜨게 비운다
	}

	function handleDropFile(e) {
		e.preventDefault();
		isDragOver = false;
		importFile(e.dataTransfer?.files?.[0], redmineTab);
	}

	// --- 승인 대기로 추가 (로드맵 탭) ---

	// 승인 대기에 들어가는 문구 형태
	const pendingValueOf = (issue) => `${issue.subject} (issue-${issue.id})`;
	const pendingValues = $derived(new Set(pendingRows.map((r) => r.value.trim())));

	/**
	 * 여러 일감을 '승인 대기' 로 옮긴다. 비어 있는 행이 있으면 그 자리부터 채운다.
	 * CSV 의 작업 담당자를 담당자 select 에도 그대로 넣는다.
	 * 한 건만 넣을 때도 이 함수를 쓴다(토스트는 부르는 쪽에서 한 번만 띄운다).
	 * @returns 실제로 추가된 건수
	 */
	function addIssuesToPending(issues) {
		const rows = [...pendingRows];
		let added = 0;
		for (const issue of issues) {
			const value = pendingValueOf(issue);
			// 중복 판단은 rows 를 직접 본다. 따로 Set 을 두면 동기화가 어긋날 수 있다.
			if (rows.some((r) => r.value.trim() === value)) continue;
			const worker = issue.worker || NO_WORKER;
			const emptyIndex = rows.findIndex((r) => !r.value.trim());
			if (emptyIndex === -1) rows.push(newValueRow(value, worker));
			else rows[emptyIndex] = { ...rows[emptyIndex], value, worker };
			added++;
		}
		if (added) pendingRows = rows;
		return added;
	}

	// --- 배포 요청 Redmine 으로 추가 (배포요청 탭) ---

	/**
	 * 일감에서 서비스 select 값을 정한다.
	 * 배포 요청 일감 제목은 "[비즈뿌리오 웹] 서비스 배포 요청" 형태라 앞머리 대괄호가 서비스명이고,
	 * 비어 있을 때를 대비해 '서비스분류' 열도 본다. 목록에 없는 이름은 직접입력으로 넣는다.
	 */
	function serviceFromIssue(issue) {
		const bracket = issue.subject.match(/^\s*\[([^\]]+)\]/)?.[1]?.trim();
		const candidate = bracket || issue.category || '';
		return DEPLOY_TARGET_NAMES.includes(candidate)
			? { service: candidate, customService: '' }
			: { service: CUSTOM_INPUT, customService: candidate };
	}

	const redmineNumbers = $derived(
		new Set(redmineRows.map((r) => String(r.redmine ?? '').trim()).filter(Boolean))
	);

	/** @returns 실제로 추가된 건수 */
	function addIssuesToRedmine(issues) {
		const rows = [...redmineRows];
		let added = 0;
		for (const issue of issues) {
			const redmine = String(issue.id);
			if (rows.some((r) => String(r.redmine ?? '').trim() === redmine)) continue;
			const values = { status: '대기', ...serviceFromIssue(issue), redmine };
			const emptyIndex = rows.findIndex((r) => !String(r.redmine ?? '').trim());
			if (emptyIndex === -1) rows.push({ id: crypto.randomUUID(), ...values });
			else rows[emptyIndex] = { ...rows[emptyIndex], ...values };
			added++;
		}
		if (added) redmineRows = rows;
		return added;
	}

	// --- 탭 공통 ---

	const checkedOf = (tab) => (tab === 'roadmap' ? roadmapChecked : deployChecked);
	const addedChecker = (tab) =>
		tab === 'roadmap'
			? (issue) => pendingValues.has(pendingValueOf(issue))
			: (issue) => redmineNumbers.has(String(issue.id));

	const activeIssues = $derived(redmineTab === 'roadmap' ? roadmapIssues : deployIssues);
	const activeChecked = $derived(checkedOf(redmineTab));
	const activeIsAdded = $derived(addedChecker(redmineTab));
	const activeTarget = $derived(redmineTab === 'roadmap' ? '승인 대기' : '배포 요청 Redmine');

	/** 아직 안 들어갔고 체크된 일감 — '선택 N건 추가' 의 대상 */
	const addableIssues = $derived(
		activeIssues.filter((i) => activeChecked.has(i.id) && !activeIsAdded(i))
	);
	/** 체크할 수 있는 일감 (이미 들어간 건 제외) */
	const selectableIssues = $derived(activeIssues.filter((i) => !activeIsAdded(i)));
	const allChecked = $derived(
		selectableIssues.length > 0 && selectableIssues.every((i) => activeChecked.has(i.id))
	);

	function toggleAll() {
		const next = !allChecked;
		for (const issue of selectableIssues) {
			if (next) activeChecked.add(issue.id);
			else activeChecked.delete(issue.id);
		}
	}

	function toggleOne(issue) {
		if (activeChecked.has(issue.id)) activeChecked.delete(issue.id);
		else activeChecked.add(issue.id);
	}

	/** 체크된 일감을 현재 탭에 맞는 폼으로 옮긴다 */
	function addChecked() {
		const issues = addableIssues;
		if (!issues.length) return;
		const added =
			redmineTab === 'roadmap' ? addIssuesToPending(issues) : addIssuesToRedmine(issues);
		toast.show(
			added ? `${activeTarget}에 ${added}건 추가했습니다.` : '추가할 일감이 없습니다.',
			added ? 'success' : 'info'
		);
	}

	/** 한 건만 추가 */
	function addOne(issue) {
		const added =
			redmineTab === 'roadmap' ? addIssuesToPending([issue]) : addIssuesToRedmine([issue]);
		toast.show(
			added ? `${activeTarget}에 추가했습니다.` : `이미 ${activeTarget}에 있습니다.`,
			added ? 'success' : 'info'
		);
	}

	function clearImported() {
		applyImport[redmineTab]({ issues: [], error: '', notice: '' });
		activeChecked.clear();
	}

	// --- 미저장 변경 추적 ---
	// 저장되는 내용이 곧 아래 5개 배열이므로, 마지막으로 저장/불러온 시점의 스냅샷과 비교한다.
	const formSnapshot = $derived(
		JSON.stringify({ approvedRows, pendingRows, redmineRows, scenarioRows, deployOrderRows })
	);
	let savedSnapshot = $state(null);
	const isDirty = $derived(savedSnapshot !== null && formSnapshot !== savedSnapshot);

	/** 현재 내용을 '저장된 상태'로 표시 */
	function markSaved() {
		savedSnapshot = formSnapshot;
	}

	// --- 어느 행이 저장 안 됐는지 ---
	//
	// isDirty 는 폼 전체가 바뀌었는지만 알려 주므로, 행 단위로 짚으려면
	// 저장 시점 스냅샷을 행 id 별로 펼쳐 두고 하나씩 비교한다.
	//
	// 키 순서에 의존하지 않도록 정렬해서 비교한다. 담당자·일감번호 칸을 나중에 추가하면서
	// 정규화가 { worker: '', ...row } 처럼 키를 앞에 붙이는 곳이 생겨,
	// JSON.stringify 를 그냥 쓰면 내용이 같아도 문자열이 달라진다.
	const stableRow = (row) =>
		JSON.stringify(
			Object.keys(row ?? {})
				.sort()
				.map((k) => [k, row[k]])
		);

	/** 저장 시점의 { 섹션키: Map(행 id -> 직렬화된 행) }. 아직 저장/불러오기 전이면 null */
	const savedRowsBySection = $derived.by(() => {
		if (savedSnapshot === null) return null;
		try {
			return Object.fromEntries(
				Object.entries(JSON.parse(savedSnapshot)).map(([section, rows]) => [
					section,
					new Map((rows ?? []).map((row) => [row.id, stableRow(row)]))
				])
			);
		} catch {
			return null; // 스냅샷을 못 읽으면 표시를 포기한다(하이라이트보다 화면이 중요)
		}
	});

	/** 저장된 내용과 다른가 (스냅샷에 없는 행 = 새로 추가된 행) */
	function isRowUnsaved(section, row) {
		const saved = savedRowsBySection?.[section];
		if (!saved) return false;
		const before = saved.get(row.id);
		return before === undefined || before !== stableRow(row);
	}

	/** 저장된 뒤 지워진 행 수. 화면에 행이 없어 표시할 자리가 없으니 섹션 헤더에 알린다. */
	function deletedRowCount(section, rows) {
		const saved = savedRowsBySection?.[section];
		if (!saved) return 0;
		const alive = new Set(rows.map((r) => r.id));
		let count = 0;
		for (const id of saved.keys()) if (!alive.has(id)) count++;
		return count;
	}

	// 탭을 닫거나 새로고침할 때
	function warnIfDirty(e) {
		if (!isDirty) return;
		e.preventDefault();
		e.returnValue = '';
	}

	// 다른 도구로 이동할 때 (SPA 전환이라 beforeunload 가 뜨지 않는다)
	beforeNavigate(({ cancel, type }) => {
		if (!isDirty) return;
		// 탭 닫기/새로고침은 브라우저 기본 경고(onbeforeunload)가 맡는다.
		// 이때 confirm 은 브라우저가 무시하므로 여기서 처리하면 안 된다.
		if (type === 'leave') return;
		if (!confirm('저장하지 않은 변경사항이 있습니다.\n이동하면 사라집니다. 계속하시겠습니까?')) {
			cancel();
		}
	});

	const presence = createPresenceStore('deployment-status-sharing-form2');
	const { onlineUsers, editingUsers, setEditing, clearEditing } = presence;

	// Reactive editing indicators for each section
	let approvedEditing = $derived($editingUsers['approved']);
	let pendingEditing = $derived($editingUsers['pending']);
	let redmineEditing = $derived($editingUsers['redmine']);
	let scenarioEditing = $derived($editingUsers['scenario']);
	let deployOrderEditing = $derived($editingUsers['deployOrder']);

	// Total count of all editors across all sections
	let totalEditingCount = $derived(
		(approvedEditing?.length || 0) +
			(pendingEditing?.length || 0) +
			(redmineEditing?.length || 0) +
			(scenarioEditing?.length || 0) +
			(deployOrderEditing?.length || 0)
	);

	// 링크 추출 함수
	function extractTicketLink(value) {
		if (!value || !value.trim()) return null;

		// JIRA 티켓 패턴: 대문자로 시작하는 프로젝트코드-숫자 (예: NBIZPPURIO-3222)
		const jiraMatch = value.match(/([A-Z]+-\d+)/);
		if (jiraMatch) {
			return {
				type: 'jira',
				ticket: jiraMatch[1],
				url: `https://jira.daou.co.kr/browse/${jiraMatch[1]}`
			};
		}

		// Redmine 일감 패턴: issue-숫자 (예: issue-622)
		const redmineMatch = value.match(/issue-(\d+)/i);
		if (redmineMatch) {
			return {
				type: 'redmine',
				ticket: redmineMatch[1],
				url: `https://task.daou.co.kr/issues/${redmineMatch[1]}`
			};
		}

		return null;
	}

	// Toast 표시 함수
	// 데이터 로드 함수
	async function loadData() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('deployment_form_data')
				.select('key, value')
				.in('key', [
					'deployment2_approved_rows',
					'deployment2_pending_rows',
					'deployment2_redmine_rows',
					'deployment2_scenario_rows',
					'deployment2_deploy_order_rows'
				]);

			if (error) {
				console.error('Error loading data:', error);
				return;
			}

			if (data) {
				data.forEach((item) => {
					if (item.key === 'deployment2_approved_rows' && item.value) {
						try {
							const parsed = JSON.parse(item.value);
							if (Array.isArray(parsed) && parsed.length > 0) {
								approvedRows = withWorker(parsed);
							}
						} catch (e) {
							console.error('Error parsing approved rows:', e);
						}
					} else if (item.key === 'deployment2_pending_rows' && item.value) {
						try {
							const parsed = JSON.parse(item.value);
							if (Array.isArray(parsed) && parsed.length > 0) {
								pendingRows = withWorker(parsed);
							}
						} catch (e) {
							console.error('Error parsing pending rows:', e);
						}
					} else if (item.key === 'deployment2_redmine_rows' && item.value) {
						try {
							const parsed = JSON.parse(item.value);
							if (Array.isArray(parsed) && parsed.length > 0) {
								redmineRows = parsed;
							}
						} catch (e) {
							console.error('Error parsing redmine rows:', e);
						}
					} else if (item.key === 'deployment2_scenario_rows' && item.value) {
						try {
							const parsed = JSON.parse(item.value);
							if (Array.isArray(parsed) && parsed.length > 0) {
								scenarioRows = withIssueNo(parsed);
							}
						} catch (e) {
							console.error('Error parsing scenario rows:', e);
						}
					} else if (item.key === 'deployment2_deploy_order_rows' && item.value) {
						try {
							const parsed = JSON.parse(item.value);
							if (Array.isArray(parsed) && parsed.length > 0) {
								deployOrderRows = parsed;
							}
						} catch (e) {
							console.error('Error parsing deploy order rows:', e);
						}
					}
				});
			}
		} catch (err) {
			console.error('Failed to load data:', err);
		} finally {
			isLoading = false;
			markSaved();
		}
	}

	// 저장 함수
	async function saveAll() {
		isSaving = true;
		try {
			const updates = [
				{
					key: 'deployment2_approved_rows',
					value: JSON.stringify(approvedRows),
					updated_at: new Date().toISOString()
				},
				{
					key: 'deployment2_pending_rows',
					value: JSON.stringify(pendingRows),
					updated_at: new Date().toISOString()
				},
				{
					key: 'deployment2_redmine_rows',
					value: JSON.stringify(redmineRows),
					updated_at: new Date().toISOString()
				},
				{
					key: 'deployment2_scenario_rows',
					value: JSON.stringify(scenarioRows),
					updated_at: new Date().toISOString()
				},
				{
					key: 'deployment2_deploy_order_rows',
					value: JSON.stringify(deployOrderRows),
					updated_at: new Date().toISOString()
				}
			];

			const { error } = await supabase
				.from('deployment_form_data')
				.upsert(updates, { onConflict: 'key' });

			if (error) {
				throw error;
			}
			markSaved();
			toast.show('저장되었습니다!', 'success');
		} catch (err) {
			toast.show('저장 중 오류가 발생했습니다.', 'error');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}

	// 리셋 함수
	async function resetAll() {
		if (confirm('잘못누른게 아니죠?')) {
			isSaving = true;
			try {
				// 모든 데이터를 초기 상태로 리셋
				approvedRows = [newValueRow()];
				pendingRows = [newValueRow()];
				redmineRows = [
					{
						id: crypto.randomUUID(),
						status: '대기',
						service: '서비스선택',
						customService: '',
						redmine: ''
					}
				];
				scenarioRows = [newScenarioRow()];
				deployOrderRows = [{ id: crypto.randomUUID(), service: '서비스선택', customService: '' }];

				// DB에 초기화된 데이터 저장
				const updates = [
					{
						key: 'deployment2_approved_rows',
						value: JSON.stringify(approvedRows),
						updated_at: new Date().toISOString()
					},
					{
						key: 'deployment2_pending_rows',
						value: JSON.stringify(pendingRows),
						updated_at: new Date().toISOString()
					},
					{
						key: 'deployment2_redmine_rows',
						value: JSON.stringify(redmineRows),
						updated_at: new Date().toISOString()
					},
					{
						key: 'deployment2_scenario_rows',
						value: JSON.stringify(scenarioRows),
						updated_at: new Date().toISOString()
					},
					{
						key: 'deployment2_deploy_order_rows',
						value: JSON.stringify(deployOrderRows),
						updated_at: new Date().toISOString()
					}
				];

				const { error } = await supabase
					.from('deployment_form_data')
					.upsert(updates, { onConflict: 'key' });

				if (error) {
					throw error;
				}
				markSaved();
				toast.show('모든 내용이 초기화되었습니다!', 'success');
			} catch (err) {
				toast.show('초기화 중 오류가 발생했습니다.', 'error');
				console.error(err);
			} finally {
				isSaving = false;
			}
		}
	}

	// 공통 행 관리 함수
	function addRow(rows, setRows) {
		setRows([...rows, newValueRow()]);
	}

	function addRedmineRow() {
		redmineRows = [
			...redmineRows,
			{
				id: crypto.randomUUID(),
				status: '대기',
				service: '서비스선택',
				customService: '',
				redmine: ''
			}
		];
	}

	function addScenarioRow() {
		scenarioRows = [...scenarioRows, newScenarioRow()];
	}

	function removeRow(rows, setRows, id) {
		setRows(rows.filter((row) => row.id !== id));
	}

	function removeRedmineRow(id) {
		redmineRows = redmineRows.filter((row) => row.id !== id);
		if (redmineRows.length === 0) {
			redmineRows = [
				{
					id: crypto.randomUUID(),
					status: '대기',
					service: '서비스선택',
					customService: '',
					redmine: ''
				}
			];
		}
	}

	function removeScenarioRow(id) {
		scenarioRows = scenarioRows.filter((row) => row.id !== id);
		if (scenarioRows.length === 0) {
			scenarioRows = [newScenarioRow()];
		}
	}

	function addDeployOrderRow() {
		deployOrderRows = [
			...deployOrderRows,
			{ id: crypto.randomUUID(), service: '서비스선택', customService: '' }
		];
	}

	function removeDeployOrderRow(id) {
		deployOrderRows = deployOrderRows.filter((row) => row.id !== id);
		if (deployOrderRows.length === 0) {
			deployOrderRows = [{ id: crypto.randomUUID(), service: '서비스선택', customService: '' }];
		}
	}

	// 서비스 선택 시 마지막 행이면 자동으로 빈 선택박스 한 줄 추가
	function handleDeployOrderChange(row, index) {
		if (row.service === '서비스선택') return;
		if (index === deployOrderRows.length - 1) {
			deployOrderRows = [
				...deployOrderRows,
				{ id: crypto.randomUUID(), service: '서비스선택', customService: '' }
			];
		}
	}

	// 승인완료 → 승인대기로 이동
	function moveToPending(row) {
		approvedRows = approvedRows.filter((r) => r.id !== row.id);
		pendingRows = [...pendingRows, { ...row, id: crypto.randomUUID() }];
	}

	// 승인대기 → 승인완료로 이동
	function moveToApproved(row) {
		pendingRows = pendingRows.filter((r) => r.id !== row.id);
		approvedRows = [...approvedRows, { ...row, id: crypto.randomUUID() }];
	}

	// 상태 토글
	function toggleStatus(row) {
		row.status = row.status === '대기' ? '완료' : '대기';
	}

	// 드래그앤드롭 함수
	function handleDragStart(e, index, listName) {
		draggedItem = index;
		draggedFrom = listName;
		e.dataTransfer.effectAllowed = 'move';
		e.target.classList.add('opacity-50');
	}

	function handleDragEnd(e) {
		e.target.classList.remove('opacity-50');
		draggedItem = null;
		draggedFrom = null;
	}

	function handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(e, targetIndex, listName) {
		e.preventDefault();
		if (draggedFrom !== listName || draggedItem === null) return;

		let rows, setRows;
		if (listName === 'approved') {
			rows = approvedRows;
			setRows = (v) => (approvedRows = v);
		} else if (listName === 'pending') {
			rows = pendingRows;
			setRows = (v) => (pendingRows = v);
		} else if (listName === 'redmine') {
			rows = redmineRows;
			setRows = (v) => (redmineRows = v);
		} else if (listName === 'scenario') {
			rows = scenarioRows;
			setRows = (v) => (scenarioRows = v);
		} else if (listName === 'deployOrder') {
			rows = deployOrderRows;
			setRows = (v) => (deployOrderRows = v);
		}

		const newRows = [...rows];
		const [removed] = newRows.splice(draggedItem, 1);
		newRows.splice(targetIndex, 0, removed);
		setRows(newRows);

		draggedItem = null;
		draggedFrom = null;
	}

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
		loadData();
		presence.join();

		// 지난번에 쓴 로드맵 번호를 되살린다 (폼 내용이 아니라 조회 조건이라 DB 가 아닌 로컬에 둔다)
		try {
			roadmapInput = localStorage.getItem(ROADMAP_KEY) ?? '';
		} catch {
			// 읽기가 막혀도 그냥 빈 값으로 시작하면 된다
		}

		// Real-time subscription
		const channel = supabase
			.channel('deployment_form2_changes')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'deployment_form_data',
					filter:
						'key=in.(deployment2_approved_rows,deployment2_pending_rows,deployment2_redmine_rows,deployment2_scenario_rows,deployment2_deploy_order_rows)'
				},
				(payload) => {
					if (payload.new) {
						// 내가 편집 중인데 덮어쓰면 작업이 사라진다. 반영하지 않고 알리기만 한다.
						if (isDirty) {
							toast.show(
								'다른 사용자가 저장했습니다. 내 변경사항을 지키기 위해 화면은 그대로 둡니다.',
								'info'
							);
							return;
						}
						const { key, value } = payload.new;
						if (key === 'deployment2_approved_rows' && value) {
							try {
								const parsed = JSON.parse(value);
								if (Array.isArray(parsed)) approvedRows = withWorker(parsed);
							} catch {
								// 저장된 값이 깨졌으면 기본값 유지
							}
						} else if (key === 'deployment2_pending_rows' && value) {
							try {
								const parsed = JSON.parse(value);
								if (Array.isArray(parsed)) pendingRows = withWorker(parsed);
							} catch {
								// 저장된 값이 깨졌으면 기본값 유지
							}
						} else if (key === 'deployment2_redmine_rows' && value) {
							try {
								const parsed = JSON.parse(value);
								if (Array.isArray(parsed)) redmineRows = parsed;
							} catch {
								// 저장된 값이 깨졌으면 기본값 유지
							}
						} else if (key === 'deployment2_scenario_rows' && value) {
							try {
								const parsed = JSON.parse(value);
								if (Array.isArray(parsed)) scenarioRows = withIssueNo(parsed);
							} catch {
								// 저장된 값이 깨졌으면 기본값 유지
							}
						} else if (key === 'deployment2_deploy_order_rows' && value) {
							try {
								const parsed = JSON.parse(value);
								if (Array.isArray(parsed)) deployOrderRows = parsed;
							} catch {
								// 저장된 값이 깨졌으면 기본값 유지
							}
						}
						// 방금 받은 내용이 곧 저장된 상태다
						markSaved();
					}
				}
			)
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	});

	onDestroy(() => {
		presence.leave();
	});

	function formatRowsToList(rows, prefix = '  - ') {
		return rows
			.filter((row) => row.value && row.value.trim() !== '')
			.map((row) => prefix + row.value.trim())
			.join('\n');
	}

	function formatRedmineRowsToList(rows, prefix = '  - ') {
		return rows
			.filter((row) => row.redmine && row.redmine.trim() !== '')
			.map((row) => {
				const serviceName = row.service === '직접입력' ? row.customService : row.service;
				return `${prefix}[${row.status}] ${serviceName} (${row.redmine.trim()})`;
			})
			.join('\n');
	}

	function formatScenarioRowsToList(rows, prefix = '  - ') {
		return rows
			.filter((row) => {
				if (row.type === '직접입력') {
					return row.customText && row.customText.trim();
				}
				if (row.type === '작업선택') {
					return false;
				}
				// DB 는 서비스가 아니라 일감번호를 짝으로 쓴다
				if (row.type === 'DB') {
					return row.redmine && row.redmine.trim();
				}
				if (row.service === '직접입력') {
					return row.customService && row.customService.trim();
				}
				if (row.service === '서비스선택') {
					return false;
				}
				return row.service;
			})
			.map((row) => {
				if (row.type === '직접입력') {
					return `${prefix}[${row.status}] ${row.customText.trim()}`;
				}
				if (row.type === 'DB') {
					return `${prefix}[${row.status}] DB (${row.redmine.trim()})`;
				}
				const serviceName = row.service === '직접입력' ? row.customService : row.service;
				return `${prefix}[${row.status}] ${row.type} - ${serviceName}`;
			})
			.join('\n');
	}

	// 배포순서 — 선택된 서비스들을 화살표로 연결 (예: 비즈뿌리오 웹 -> 영업관리시스템 웹)
	function formatDeployOrderToList(rows) {
		return rows
			.map((row) => (row.service === '직접입력' ? (row.customService || '').trim() : row.service))
			.filter((name) => name && name !== '서비스선택')
			.join(' -> ');
	}

	// 라인 수 계산 함수
	function countFilledRows(rows) {
		return rows.filter((row) => row.value && row.value.trim() !== '').length;
	}

	// 행이 비어있는지 확인
	function isRowEmpty(row) {
		return !row.value || row.value.trim() === '';
	}

	let approvedCount = $derived(countFilledRows(approvedRows));
	let pendingCount = $derived(countFilledRows(pendingRows));

	let formattedApproved = $derived(formatRowsToList(approvedRows));
	let formattedPending = $derived(formatRowsToList(pendingRows));
	let formattedRedmine = $derived(formatRedmineRowsToList(redmineRows));
	let formattedScenario = $derived(formatScenarioRowsToList(scenarioRows));
	let formattedDeployOrder = $derived(formatDeployOrderToList(deployOrderRows));

	let sections = $derived([
		{ title: `■ 승인 완료 (${approvedCount}건)`, content: formattedApproved },
		{ title: `■ 승인 대기 (${pendingCount}건)`, content: formattedPending },
		{ title: '※ 배포 요청 Redmine', content: formattedRedmine },
		{ title: '※ 비고', content: formattedScenario },
		{ title: '※ 배포순서', content: formattedDeployOrder }
	]);

	let output = $derived(
		[title, ...sections.filter((s) => s.content).map((s) => `${s.title}\n${s.content}`)].join(
			'\n\n'
		)
	);
</script>

<svelte:window onbeforeunload={warnIfDirty} />

<ToolPage>
	{#if $onlineUsers.length > 0}
		<div class="mb-4 flex justify-end">
			<div class="badge gap-1 badge-info">
				<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
				{$onlineUsers.length}명 접속 중
			</div>
		</div>
	{/if}

	{#if isLoading}
		<TableSkeleton cards={3} rows={3} cols={4} />
	{:else}
		<!-- 레드마인 가져오기 (기본 접힘) -->
		<div class="mb-6 rounded-box border border-base-300 bg-base-200/40 md:w-1/2">
			<button
				type="button"
				class="flex w-full items-center gap-2 px-4 py-3 text-left"
				aria-expanded={redmineOpen}
				onclick={() => (redmineOpen = !redmineOpen)}
			>
				<span class="transition-transform duration-150 {redmineOpen ? 'rotate-90' : ''}">
					<Icon name="chevron" size={13} />
				</span>
				<Icon name="package" size={16} class="text-base-content/50" />
				<span class="text-sm font-semibold">레드마인 가져오기</span>
				{#if roadmapIssues.length + deployIssues.length}
					<span class="badge badge-ghost badge-sm"
						>{roadmapIssues.length + deployIssues.length}건</span
					>
				{/if}
			</button>

			{#if redmineOpen}
				<div class="border-t border-base-300 p-4">
					<div role="tablist" class="tabs tabs-box mb-3 w-full tabs-sm">
						{#each [{ key: 'roadmap', label: '로드맵', count: roadmapIssues.length }, { key: 'deploy', label: '배포요청', count: deployIssues.length }] as tab (tab.key)}
							<button
								role="tab"
								aria-selected={redmineTab === tab.key}
								class="tab flex-1 {redmineTab === tab.key ? 'tab-active' : ''}"
								onclick={() => (redmineTab = tab.key)}
							>
								{tab.label}
								{#if tab.count}
									<span class="ml-1 badge badge-ghost badge-xs">{tab.count}</span>
								{/if}
							</button>
						{/each}
					</div>

					<!-- ① 대상: 로드맵은 번호를 받고, 배포요청은 조건이 고정이라 표시만 한다 -->
					<div class="flex items-center gap-2">
						<span class="badge badge-sm badge-neutral">1</span>
						{#if redmineTab === 'roadmap'}
							<input
								type="text"
								class="input-bordered input min-w-0 flex-1 input-sm"
								placeholder="https://task.daou.co.kr/versions/155 또는 155"
								value={roadmapInput}
								oninput={(e) => setRoadmapInput(e.currentTarget.value)}
							/>
							<a
								class="btn btn-primary btn-sm"
								class:btn-disabled={!roadmapId}
								href={roadmapId ? issuesCsvUrl(roadmapId) : undefined}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Icon name="external" size={13} /> CSV 내려받기
							</a>
						{:else}
							<span class="min-w-0 flex-1 truncate text-xs text-base-content/60">
								진행중 · 운영배포 · 시스템코어개발팀 등록
							</span>
							<a
								class="btn btn-primary btn-sm"
								href={deployRequestCsvUrl()}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Icon name="external" size={13} /> CSV 내려받기
							</a>
						{/if}
					</div>

					<!-- ② 내려받은 CSV 파일 넣기 (끌어다 놓기 또는 눌러서 고르기) -->
					<div class="mt-2 flex items-center gap-2">
						<span class="badge badge-sm badge-neutral">2</span>
						<button
							type="button"
							class="min-w-0 flex-1 rounded-box border-2 border-dashed px-3 py-3 text-center text-xs transition-colors {isDragOver
								? 'border-primary bg-primary/10 text-primary'
								: 'border-base-300 text-base-content/50 hover:border-base-content/30'}"
							ondragover={(e) => {
								e.preventDefault();
								isDragOver = true;
							}}
							ondragleave={() => (isDragOver = false)}
							ondrop={handleDropFile}
							onclick={() => filePicker?.click()}
						>
							{#if isDragOver}
								놓으면 읽어들입니다
							{:else}
								<span class="font-medium">내려받은 CSV 를 끌어다 놓기</span>
								<span class="text-base-content/30">· 눌러서 파일 고르기</span>
							{/if}
						</button>
						<input
							bind:this={filePicker}
							type="file"
							accept=".csv,text/csv"
							class="hidden"
							onchange={handleFilePicked}
						/>
					</div>

					<p class="mt-2 text-xs text-base-content/40">
						{#if redmineTab === 'roadmap'}
							배포 예정 일감을 가져와 <strong>승인 대기</strong>에 넣습니다.
						{:else}
							배포 요청 일감을 가져와 <strong>배포 요청 Redmine</strong>에 넣습니다.
						{/if}
						레드마인에 로그인된 브라우저에서만 열립니다.
					</p>

					{#if redmineTab === 'roadmap' ? roadmapError : deployError}
						<p class="mt-2 flex items-center gap-1 text-xs text-error">
							<Icon name="alert" size={12} />
							{redmineTab === 'roadmap' ? roadmapError : deployError}
						</p>
					{/if}
					{#if redmineTab === 'roadmap' ? roadmapNotice : deployNotice}
						<p class="mt-2 flex items-center gap-1 text-xs text-warning">
							<Icon name="alert" size={12} />
							{redmineTab === 'roadmap' ? roadmapNotice : deployNotice}
						</p>
					{/if}

					{#if activeIssues.length}
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<button
								class="btn btn-primary btn-sm"
								disabled={!addableIssues.length}
								onclick={addChecked}
							>
								선택 {addableIssues.length}건 추가
							</button>
							<button class="btn btn-ghost btn-sm" onclick={clearImported}>목록 비우기</button>
							<span class="ml-auto text-xs text-base-content/60">
								{#if redmineTab === 'roadmap' && roadmapId}
									<a
										href={versionUrl(roadmapId)}
										target="_blank"
										rel="noopener noreferrer"
										class="link">로드맵 #{roadmapId}</a
									>
									·
								{/if}
								일감 {activeIssues.length}건
							</span>
						</div>

						<div class="mt-2 overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th class="w-px">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={allChecked}
												disabled={!selectableIssues.length}
												onchange={toggleAll}
												title="전체 선택"
											/>
										</th>
										<th>번호</th>
										<th>제목</th>
										<th>상태</th>
										<th>{redmineTab === 'roadmap' ? '작업 담당자' : '담당자'}</th>
										<th class="w-px"></th>
									</tr>
								</thead>
								<tbody>
									{#each activeIssues as issue (issue.id)}
										{@const added = activeIsAdded(issue)}
										<tr class={added ? 'opacity-50' : ''}>
											<td>
												<input
													type="checkbox"
													class="checkbox checkbox-sm"
													checked={activeChecked.has(issue.id)}
													disabled={added}
													onchange={() => toggleOne(issue)}
												/>
											</td>
											<td class="whitespace-nowrap">
												<a
													href={`${REDMINE_BASE_URL}/issues/${issue.id}`}
													target="_blank"
													rel="noopener noreferrer"
													class="link">#{issue.id}</a
												>
											</td>
											<td>{issue.subject}</td>
											<td class="whitespace-nowrap">
												<span class="badge badge-ghost badge-sm">{issue.status || '-'}</span>
											</td>
											<td class="whitespace-nowrap">{issue.worker || '-'}</td>
											<td class="whitespace-nowrap">
												<button
													class="btn btn-xs {added ? 'btn-ghost' : 'btn-outline btn-primary'}"
													disabled={added}
													title={added
														? `이미 ${activeTarget}에 있습니다`
														: `${activeTarget}에 추가`}
													onclick={() => addOne(issue)}
												>
													{#if added}
														<Icon name="check" size={12} /> 추가됨
													{:else}
														+ 추가
													{/if}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<!-- Input Section -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<h2 class="card-title">입력</h2>
							{#if totalEditingCount > 0}
								<span class="animate-pulse text-sm text-warning"
									>{totalEditingCount}명 수정중...</span
								>
							{/if}
						</div>
						<div class="flex flex-col items-end gap-1">
							<div class="flex items-center gap-2">
								<button onclick={resetAll} class="btn btn-error btn-sm" disabled={isSaving}>
									초기화
								</button>
								<!-- 저장할 게 없으면 누를 수 없게 해서 상태를 버튼으로 알 수 있게 한다 -->
								<button
									onclick={saveAll}
									class="btn btn-primary btn-sm"
									disabled={isSaving || !isDirty}
									title={isDirty ? '변경사항을 저장합니다' : '저장할 변경사항이 없습니다'}
								>
									{isSaving ? '저장 중...' : isDirty ? '저장하기' : '저장됨'}
								</button>
							</div>
							{#if isDirty}
								<span class="flex items-center gap-1 text-xs text-warning">
									<Icon name="alert" size={12} /> 저장하지 않은 변경사항이 있습니다
								</span>
							{/if}
						</div>
					</div>

					<!-- 승인 완료 섹션 -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text"
								>■ 승인 완료 {approvedCount > 0 ? `- ${approvedCount}건` : ''}</span
							>
							{#if deletedRowCount('approvedRows', approvedRows)}
								<span class="badge gap-1 badge-sm badge-warning">
									<Icon name="alert" size={11} />
									{deletedRowCount('approvedRows', approvedRows)}건 삭제
								</span>
							{/if}
							<button
								onclick={() => addRow(approvedRows, (v) => (approvedRows = v))}
								class="btn mb-1 btn-outline btn-primary btn-xs">+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each approvedRows as row, index (row.id)}
								<div
									class="flex items-center gap-1 border-l-2 pl-2 {isRowUnsaved('approvedRows', row)
										? 'border-warning'
										: 'border-transparent'}"
									ondragover={handleDragOver}
									ondrop={(e) => handleDrop(e, index, 'approved')}
								>
									<span
										role="button"
										tabindex="0"
										class="cursor-move text-base-content/40 select-none"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, index, 'approved')}
										ondragend={handleDragEnd}>⠿</span
									>
									<button
										onclick={() => moveToPending(row)}
										onfocus={() => setEditing('approved')}
										onblur={() => clearEditing('approved')}
										class="btn btn-outline btn-warning btn-xs"
										title="승인대기로 이동"
										disabled={isRowEmpty(row)}>대기↓</button
									>
									<input
										type="text"
										bind:value={row.value}
										class="input-bordered input w-full"
										placeholder="[서비스] 제목 (일감)"
										onfocus={() => setEditing('approved')}
										onblur={() => clearEditing('approved')}
									/>
									<!-- 담당자는 화면에서 누가 맡았는지 보려고 두는 것이고 출력 문구에는 넣지 않는다 -->
									<select
										bind:value={row.worker}
										class="select-bordered select w-32 shrink-0"
										title="담당자"
										onfocus={() => setEditing('approved')}
										onblur={() => clearEditing('approved')}
									>
										<option value={NO_WORKER}>담당자선택</option>
										{#each workerOptions as name (name)}
											<option value={name}>{name}</option>
										{/each}
									</select>
									{#if extractTicketLink(row.value)}
										<a
											href={extractTicketLink(row.value).url}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-square btn-ghost btn-xs"
											title="{extractTicketLink(row.value).type === 'jira'
												? 'JIRA'
												: 'Redmine'} 링크 열기 ({extractTicketLink(row.value).ticket})"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>
									{:else}
										<button
											class="btn btn-disabled btn-square btn-ghost btn-xs"
											title="티켓 번호를 입력하세요"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</button>
									{/if}
									<button
										onclick={() => removeRow(approvedRows, (v) => (approvedRows = v), row.id)}
										onfocus={() => setEditing('approved')}
										onblur={() => clearEditing('approved')}
										class="btn btn-outline btn-error btn-xs">삭제</button
									>
								</div>
							{/each}
						</div>
					</div>

					<!-- 승인 대기 섹션 -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text"
								>■ 승인 대기 {pendingCount > 0 ? `- ${pendingCount}건` : ''}</span
							>
							{#if deletedRowCount('pendingRows', pendingRows)}
								<span class="badge gap-1 badge-sm badge-warning">
									<Icon name="alert" size={11} />
									{deletedRowCount('pendingRows', pendingRows)}건 삭제
								</span>
							{/if}
							<button
								onclick={() => addRow(pendingRows, (v) => (pendingRows = v))}
								class="btn mb-1 btn-outline btn-primary btn-xs">+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each pendingRows as row, index (row.id)}
								<div
									class="flex items-center gap-1 border-l-2 pl-2 {isRowUnsaved('pendingRows', row)
										? 'border-warning'
										: 'border-transparent'}"
									ondragover={handleDragOver}
									ondrop={(e) => handleDrop(e, index, 'pending')}
								>
									<span
										role="button"
										tabindex="0"
										class="cursor-move text-base-content/40 select-none"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, index, 'pending')}
										ondragend={handleDragEnd}>⠿</span
									>
									<button
										onclick={() => moveToApproved(row)}
										onfocus={() => setEditing('pending')}
										onblur={() => clearEditing('pending')}
										class="btn btn-outline btn-success btn-xs"
										title="승인완료로 이동"
										disabled={isRowEmpty(row)}>완료↑</button
									>
									<input
										type="text"
										bind:value={row.value}
										class="input-bordered input w-full"
										placeholder="[서비스] 제목 (일감)"
										onfocus={() => setEditing('pending')}
										onblur={() => clearEditing('pending')}
									/>
									<!-- 담당자는 화면에서 누가 맡았는지 보려고 두는 것이고 출력 문구에는 넣지 않는다 -->
									<select
										bind:value={row.worker}
										class="select-bordered select w-32 shrink-0"
										title="담당자"
										onfocus={() => setEditing('pending')}
										onblur={() => clearEditing('pending')}
									>
										<option value={NO_WORKER}>담당자선택</option>
										{#each workerOptions as name (name)}
											<option value={name}>{name}</option>
										{/each}
									</select>
									{#if extractTicketLink(row.value)}
										<a
											href={extractTicketLink(row.value).url}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-square btn-ghost btn-xs"
											title="{extractTicketLink(row.value).type === 'jira'
												? 'JIRA'
												: 'Redmine'} 링크 열기 ({extractTicketLink(row.value).ticket})"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>
									{:else}
										<button
											class="btn btn-disabled btn-square btn-ghost btn-xs"
											title="티켓 번호를 입력하세요"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</button>
									{/if}
									<button
										onclick={() => removeRow(pendingRows, (v) => (pendingRows = v), row.id)}
										onfocus={() => setEditing('pending')}
										onblur={() => clearEditing('pending')}
										class="btn btn-outline btn-error btn-xs">삭제</button
									>
								</div>
							{/each}
						</div>
					</div>

					<!-- 배포 요청 Redmine 섹션 -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text">※ 배포 요청 Redmine</span>
							{#if deletedRowCount('redmineRows', redmineRows)}
								<span class="badge gap-1 badge-sm badge-warning">
									<Icon name="alert" size={11} />
									{deletedRowCount('redmineRows', redmineRows)}건 삭제
								</span>
							{/if}
							<button onclick={addRedmineRow} class="btn mb-1 btn-outline btn-primary btn-xs"
								>+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each redmineRows as row, index (row.id)}
								<div
									class="flex items-center gap-1 border-l-2 pl-2 {isRowUnsaved('redmineRows', row)
										? 'border-warning'
										: 'border-transparent'}"
									ondragover={handleDragOver}
									ondrop={(e) => handleDrop(e, index, 'redmine')}
								>
									<span
										role="button"
										tabindex="0"
										class="cursor-move text-base-content/40 select-none"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, index, 'redmine')}
										ondragend={handleDragEnd}>⠿</span
									>
									<button
										onclick={() => toggleStatus(row)}
										onfocus={() => setEditing('redmine')}
										onblur={() => clearEditing('redmine')}
										class="btn btn-outline btn-xs {row.status === '완료'
											? 'btn-success'
											: 'btn-warning'}"
										title="상태 토글">{row.status === '완료' ? '완료 ✓' : '대기 ✖︎'}</button
									>
									<select
										bind:value={row.service}
										onfocus={() => setEditing('redmine')}
										onblur={() => clearEditing('redmine')}
										class="select-bordered select w-52"
									>
										{#each serviceOptions as option (option)}
											<option value={option}>{option}</option>
										{/each}
									</select>
									{#if row.service === '직접입력'}
										<input
											type="text"
											bind:value={row.customService}
											class="input-bordered input w-44"
											placeholder="서비스명"
											onfocus={() => setEditing('redmine')}
											onblur={() => clearEditing('redmine')}
										/>
									{/if}
									<input
										type="text"
										bind:value={row.redmine}
										class="input-bordered input flex-1"
										placeholder="Redmine 번호"
										onfocus={() => setEditing('redmine')}
										onblur={() => clearEditing('redmine')}
									/>
									<a
										href={row.service !== '서비스선택' && row.redmine && row.redmine.trim()
											? `https://task.daou.co.kr/issues/${row.redmine.trim()}`
											: null}
										target="_blank"
										rel="noopener noreferrer"
										class="btn btn-square btn-ghost btn-xs {row.service === '서비스선택' ||
										!row.redmine ||
										!row.redmine.trim()
											? 'btn-disabled'
											: ''}"
										title="Redmine 링크 열기"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/>
										</svg>
									</a>
									<button
										onclick={() => removeRedmineRow(row.id)}
										onfocus={() => setEditing('redmine')}
										onblur={() => clearEditing('redmine')}
										class="btn btn-outline btn-error btn-xs">삭제</button
									>
								</div>
							{/each}
						</div>
					</div>

					<!-- 비고 섹션 -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text">※ 비고</span>
							{#if deletedRowCount('scenarioRows', scenarioRows)}
								<span class="badge gap-1 badge-sm badge-warning">
									<Icon name="alert" size={11} />
									{deletedRowCount('scenarioRows', scenarioRows)}건 삭제
								</span>
							{/if}
							<button onclick={addScenarioRow} class="btn mb-1 btn-outline btn-primary btn-xs"
								>+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each scenarioRows as row, index (row.id)}
								<div
									class="flex items-center gap-1 border-l-2 pl-2 {isRowUnsaved('scenarioRows', row)
										? 'border-warning'
										: 'border-transparent'}"
									ondragover={handleDragOver}
									ondrop={(e) => handleDrop(e, index, 'scenario')}
								>
									<span
										role="button"
										tabindex="0"
										class="cursor-move text-base-content/40 select-none"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, index, 'scenario')}
										ondragend={handleDragEnd}>⠿</span
									>
									<button
										onclick={() => toggleStatus(row)}
										onfocus={() => setEditing('scenario')}
										onblur={() => clearEditing('scenario')}
										class="btn btn-outline btn-xs {row.status === '완료'
											? 'btn-success'
											: 'btn-warning'}"
										title="상태 토글">{row.status === '완료' ? '완료 ✓' : '대기 ✖︎'}</button
									>
									<select
										bind:value={row.type}
										onfocus={() => setEditing('scenario')}
										onblur={() => clearEditing('scenario')}
										class="select-bordered select w-52"
									>
										{#each scenarioTypeOptions as option (option)}
											<option value={option}>{option}</option>
										{/each}
									</select>
									{#if row.type === '직접입력'}
										<input
											type="text"
											bind:value={row.customText}
											class="input-bordered input flex-1"
											placeholder="내용을 입력하세요"
											onfocus={() => setEditing('scenario')}
											onblur={() => clearEditing('scenario')}
										/>
										{#if extractTicketLink(row.customText)}
											<a
												href={extractTicketLink(row.customText).url}
												target="_blank"
												rel="noopener noreferrer"
												class="btn btn-square btn-ghost btn-xs"
												title="{extractTicketLink(row.customText).type === 'jira'
													? 'JIRA'
													: 'Redmine'} 링크 열기 ({extractTicketLink(row.customText).ticket})"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
													/>
												</svg>
											</a>
										{:else}
											<button
												class="btn btn-disabled btn-square btn-ghost btn-xs"
												title="티켓 번호를 입력하세요"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
													/>
												</svg>
											</button>
										{/if}
									{:else if row.type === 'DB'}
										<!-- DB 작업은 서비스 대신 일감번호를 받는다 -->
										<input
											type="text"
											bind:value={row.redmine}
											class="input-bordered input flex-1"
											placeholder="Redmine 번호"
											onfocus={() => setEditing('scenario')}
											onblur={() => clearEditing('scenario')}
										/>
										<a
											href={row.redmine && row.redmine.trim()
												? `${REDMINE_BASE_URL}/issues/${row.redmine.trim()}`
												: null}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-square btn-ghost btn-xs {row.redmine && row.redmine.trim()
												? ''
												: 'btn-disabled'}"
											title="Redmine 링크 열기"
										>
											<Icon name="external" size={14} />
										</a>
									{:else}
										<select
											bind:value={row.service}
											onfocus={() => setEditing('scenario')}
											onblur={() => clearEditing('scenario')}
											class="select-bordered select w-44"
										>
											{#each scenarioServiceOptions as option (option)}
												<option value={option}>{option}</option>
											{/each}
										</select>
										{#if row.service === '직접입력'}
											<input
												type="text"
												bind:value={row.customService}
												class="input-bordered input w-46"
												placeholder="서비스명"
												onfocus={() => setEditing('scenario')}
												onblur={() => clearEditing('scenario')}
											/>
										{/if}
									{/if}
									{#if row.type === '운영작업시나리오'}
										<a
											href="https://drive.google.com/drive/u/1/folders/1kY9_VlIAcJuedsZh4WKyF889gc7RnuXE"
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-square btn-ghost btn-xs"
											title="운영작업시나리오 SharePoint 열기"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>
										<!-- DB 와 직접입력은 앞에서 각자 링크 버튼을 그리므로 자리표시를 두지 않는다 -->
									{:else if row.type !== '직접입력' && row.type !== 'DB'}
										<button
											class="btn btn-disabled btn-square btn-ghost btn-xs"
											title="운영작업시나리오 선택 시 활성화"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</button>
									{/if}
									<button
										onclick={() => removeScenarioRow(row.id)}
										onfocus={() => setEditing('scenario')}
										onblur={() => clearEditing('scenario')}
										class="btn btn-outline btn-error btn-xs">삭제</button
									>
								</div>
							{/each}
						</div>
					</div>

					<!-- 배포순서 섹션 -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text">※ 배포순서</span>
							{#if deletedRowCount('deployOrderRows', deployOrderRows)}
								<span class="badge gap-1 badge-sm badge-warning">
									<Icon name="alert" size={11} />
									{deletedRowCount('deployOrderRows', deployOrderRows)}건 삭제
								</span>
							{/if}
							<button onclick={addDeployOrderRow} class="btn mb-1 btn-outline btn-primary btn-xs"
								>+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each deployOrderRows as row, index (row.id)}
								<div
									class="flex items-center gap-1 border-l-2 pl-2 {isRowUnsaved(
										'deployOrderRows',
										row
									)
										? 'border-warning'
										: 'border-transparent'}"
									ondragover={handleDragOver}
									ondrop={(e) => handleDrop(e, index, 'deployOrder')}
								>
									<span
										role="button"
										tabindex="0"
										class="cursor-move text-base-content/40 select-none"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, index, 'deployOrder')}
										ondragend={handleDragEnd}>⠿</span
									>
									<span class="w-6 text-center text-sm text-base-content/50 select-none"
										>{index + 1}</span
									>
									<select
										bind:value={row.service}
										onchange={() => handleDeployOrderChange(row, index)}
										onfocus={() => setEditing('deployOrder')}
										onblur={() => clearEditing('deployOrder')}
										class="select-bordered select flex-1"
									>
										{#each serviceOptions as option (option)}
											<option value={option}>{option}</option>
										{/each}
									</select>
									{#if row.service === '직접입력'}
										<input
											type="text"
											bind:value={row.customService}
											class="input-bordered input w-44"
											placeholder="서비스명"
											onfocus={() => setEditing('deployOrder')}
											onblur={() => clearEditing('deployOrder')}
										/>
									{/if}
									<button
										onclick={() => removeDeployOrderRow(row.id)}
										onfocus={() => setEditing('deployOrder')}
										onblur={() => clearEditing('deployOrder')}
										class="btn btn-outline btn-error btn-xs">삭제</button
									>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Output Section -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="card-title">결과</h2>
						<button onclick={() => copyToClipboard(output)} class="btn btn-primary btn-sm">
							복사하기</button
						>
					</div>
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
	{/if}
</ToolPage>
