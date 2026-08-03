<script>
	import { onMount, onDestroy } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
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

	// 서비스 목록 (배포요청용)

	// 비고용 타입 옵션

	// 비고용 서비스 옵션

	// 행 데이터 구조
	let approvedRows = $state([{ id: crypto.randomUUID(), value: '' }]);
	let pendingRows = $state([{ id: crypto.randomUUID(), value: '' }]);
	let redmineRows = $state([
		{
			id: crypto.randomUUID(),
			status: '대기',
			service: '서비스선택',
			customService: '',
			redmine: ''
		}
	]);
	let scenarioRows = $state([
		{
			id: crypto.randomUUID(),
			status: '대기',
			type: '작업선택',
			customText: '',
			service: '서비스선택',
			customService: ''
		}
	]);
	let deployOrderRows = $state([
		{ id: crypto.randomUUID(), service: '서비스선택', customService: '' }
	]);

	let title = $state('');
	let isSaving = $state(false);
	let isLoading = $state(true);

	// 드래그 상태
	let draggedItem = $state(null);
	let draggedFrom = $state(null);

	// Presence tracking for real-time collaboration
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
								approvedRows = parsed;
							}
						} catch (e) {
							console.error('Error parsing approved rows:', e);
						}
					} else if (item.key === 'deployment2_pending_rows' && item.value) {
						try {
							const parsed = JSON.parse(item.value);
							if (Array.isArray(parsed) && parsed.length > 0) {
								pendingRows = parsed;
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
								scenarioRows = parsed;
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
				approvedRows = [{ id: crypto.randomUUID(), value: '' }];
				pendingRows = [{ id: crypto.randomUUID(), value: '' }];
				redmineRows = [
					{
						id: crypto.randomUUID(),
						status: '대기',
						service: '서비스선택',
						customService: '',
						redmine: ''
					}
				];
				scenarioRows = [
					{
						id: crypto.randomUUID(),
						status: '대기',
						type: '작업선택',
						customText: '',
						service: '서비스선택',
						customService: ''
					}
				];
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
		setRows([...rows, { id: crypto.randomUUID(), value: '' }]);
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
		scenarioRows = [
			...scenarioRows,
			{
				id: crypto.randomUUID(),
				status: '대기',
				type: '작업선택',
				customText: '',
				service: '서비스선택',
				customService: ''
			}
		];
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
			scenarioRows = [
				{
					id: crypto.randomUUID(),
					status: '대기',
					type: '작업선택',
					customText: '',
					service: '서비스선택',
					customService: ''
				}
			];
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
								if (Array.isArray(parsed)) approvedRows = parsed;
							} catch {
								// 저장된 값이 깨졌으면 기본값 유지
							}
						} else if (key === 'deployment2_pending_rows' && value) {
							try {
								const parsed = JSON.parse(value);
								if (Array.isArray(parsed)) pendingRows = parsed;
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
								if (Array.isArray(parsed)) scenarioRows = parsed;
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
							<button
								onclick={() => addRow(approvedRows, (v) => (approvedRows = v))}
								class="btn mb-1 btn-outline btn-primary btn-xs">+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each approvedRows as row, index (row.id)}
								<div
									class="flex items-center gap-1"
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
							<button
								onclick={() => addRow(pendingRows, (v) => (pendingRows = v))}
								class="btn mb-1 btn-outline btn-primary btn-xs">+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each pendingRows as row, index (row.id)}
								<div
									class="flex items-center gap-1"
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
							<button onclick={addRedmineRow} class="btn mb-1 btn-outline btn-primary btn-xs"
								>+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each redmineRows as row, index (row.id)}
								<div
									class="flex items-center gap-1"
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
							<button onclick={addScenarioRow} class="btn mb-1 btn-outline btn-primary btn-xs"
								>+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each scenarioRows as row, index (row.id)}
								<div
									class="flex items-center gap-1"
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
									{:else if row.type !== '직접입력'}
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
							<button onclick={addDeployOrderRow} class="btn mb-1 btn-outline btn-primary btn-xs"
								>+ 추가</button
							>
						</label>
						<div class="space-y-2">
							{#each deployOrderRows as row, index (row.id)}
								<div
									class="flex items-center gap-1"
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
