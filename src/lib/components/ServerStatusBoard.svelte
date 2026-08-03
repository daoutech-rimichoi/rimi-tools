<script>
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { supabase } from '$lib/supabaseClient.js';
	import { toast } from '$lib/stores/common.js';
	import { USER_NAMES } from '$lib/config/users.js';
	import Icon from './Icon.svelte';
	import TableSkeleton from './TableSkeleton.svelte';

	/**
	 * 개발/검수 장비 사용 현황판. env_type 만 다르고 동작은 동일하다.
	 *
	 * @property envType    server_status.env_type ('dev' | 'stg')
	 * @property accent     daisyUI 시맨틱 컬러 이름 (사용중 표시에 사용)
	 * @property onUseNotice 사용중으로 켤 때 띄울 안내 문구 (없으면 안내 없음)
	 */
	let { envType, accent = 'primary', onUseNotice = '' } = $props();

	// Tailwind 는 소스를 문자열로 스캔하므로 `select-{accent}` 같은 런타임 조합은 CSS 가 생성되지 않는다.
	// 반드시 완성된 클래스명을 리터럴로 적어둘 것.
	const ACCENT = {
		primary: {
			select: 'select-primary',
			toggle: 'toggle-primary',
			text: 'text-primary',
			btn: 'btn-primary',
			row: 'border-l-primary bg-primary/5'
		},
		success: {
			select: 'select-success',
			toggle: 'toggle-success',
			text: 'text-success',
			btn: 'btn-success',
			row: 'border-l-success bg-success/5'
		},
		warning: {
			select: 'select-warning',
			toggle: 'toggle-warning',
			text: 'text-warning',
			btn: 'btn-warning',
			row: 'border-l-warning bg-warning/5'
		}
	};
	const color = $derived(ACCENT[accent] ?? ACCENT.primary);

	const TABLE = 'server_status';
	const EMPTY_STATUS = { inUse: false, assignedTo: '', remarks: '', updatedAt: null };
	// 본인이 방금 저장한 변경은 되돌려 받을 필요가 없다
	const SELF_WRITE_WINDOW = 2000;
	// 남이 바꾼 행을 잠깐 강조하는 시간
	const FLASH_MS = 2500;
	// 비고 자동저장 대기 시간
	const REMARKS_DEBOUNCE_MS = 800;

	let servers = $state([]);
	let serverStatus = $state({});
	let isLoading = $state(true);
	let lastSavedAt = 0;

	// 방금 남이 바꾼 행 / 저장 중인 행 / 막 저장된 행
	let flashedKeys = new SvelteSet();
	let savingKeys = new SvelteSet();
	let savedKeys = new SvelteSet();
	// 반응형 상태가 아니라 디바운스 타이머 보관용이라 일반 Map 을 쓴다
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const remarksTimers = new Map();

	const serverKey = (serviceName, envName) => `${serviceName}_${envName}`;
	const statusOf = (serviceName, envName) =>
		serverStatus[serverKey(serviceName, envName)] ?? EMPTY_STATUS;

	// 상단 요약: 전체 대수와 사용중 현황
	const totalCount = $derived(servers.reduce((n, s) => n + s.environments.length, 0));
	const inUseCount = $derived(
		servers.reduce(
			(n, s) => n + s.environments.filter((env) => statusOf(s.service, env.name).inUse).length,
			0
		)
	);

	function flash(key) {
		flashedKeys.add(key);
		setTimeout(() => flashedKeys.delete(key), FLASH_MS);
	}

	onMount(() => {
		loadServerStatus();

		const channel = supabase
			.channel(`${TABLE}_${envType}_changes`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: TABLE, filter: `env_type=eq.${envType}` },
				(payload) => {
					if (Date.now() - lastSavedAt < SELF_WRITE_WINDOW) return;
					applyRemoteChange(payload);
				}
			)
			.subscribe();

		return () => {
			for (const t of remarksTimers.values()) clearTimeout(t);
			supabase.removeChannel(channel);
		};
	});

	/** 다른 사용자의 변경을 새로고침 없이 해당 행에만 반영한다 */
	function applyRemoteChange(payload) {
		const row = payload.new;
		if (!row?.service_name) {
			// 삭제 등 행 단위로 못 맞추는 변경은 전체를 다시 읽는다
			loadServerStatus();
			return;
		}
		const key = serverKey(row.service_name, row.environment_name);
		// 아직 화면에 없는 서비스/환경이 추가된 경우
		if (!(key in serverStatus)) {
			loadServerStatus();
			return;
		}
		serverStatus = {
			...serverStatus,
			[key]: {
				inUse: row.in_use,
				assignedTo: row.assigned_to || '',
				remarks: row.remarks || '',
				updatedAt: row.updated_at
			}
		};
		flash(key);
		toast.show(`${row.service_name} · ${row.environment_name} 변경사항이 반영되었습니다.`, 'info');
	}

	// --- 조회 ---

	async function loadServerStatus() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from(TABLE)
				.select(
					'service_name, environment_name, url, in_use, assigned_to, remarks, updated_at, display_order'
				)
				.eq('env_type', envType)
				.order('display_order', { ascending: true })
				.order('service_name', { ascending: true })
				.order('environment_name', { ascending: true });

			if (error && error.code !== 'PGRST116') {
				console.error(`${TABLE}(${envType}) load error:`, error);
				return;
			}
			if (!data?.length) return;

			// 서비스별로 환경을 묶어 표 단위(카드)로 구성 (객체는 문자열 키 삽입 순서를 유지한다)
			const byService = {};
			const nextStatus = {};
			for (const item of data) {
				(byService[item.service_name] ??= []).push({
					name: item.environment_name,
					url: item.url
				});
				nextStatus[serverKey(item.service_name, item.environment_name)] = {
					inUse: item.in_use,
					assignedTo: item.assigned_to || '',
					remarks: item.remarks || '',
					updatedAt: item.updated_at
				};
			}

			servers = Object.entries(byService).map(([service, environments]) => ({
				service,
				environments
			}));
			serverStatus = nextStatus;
		} catch (err) {
			console.error(`${TABLE}(${envType}) load failed:`, err);
		} finally {
			isLoading = false;
		}
	}

	// --- 상태 변경 ---

	function patchStatus(serviceName, envName, patch) {
		const key = serverKey(serviceName, envName);
		serverStatus = {
			...serverStatus,
			[key]: { ...(serverStatus[key] ?? EMPTY_STATUS), ...patch }
		};
	}

	async function toggleInUse(serviceName, envName, event) {
		const status = statusOf(serviceName, envName);

		// 사용중으로 바꾸려면 사용자를 먼저 골라야 한다
		if (!status.inUse && !status.assignedTo) {
			event.preventDefault();
			toast.show('사용자를 먼저 선택해주세요.', 'error');
			return;
		}

		const inUse = !status.inUse;
		// 사용가능으로 되돌릴 때는 사용자/비고를 비운다
		patchStatus(serviceName, envName, inUse ? { inUse } : { inUse, assignedTo: '', remarks: '' });

		if (!(await saveToDb(serviceName, envName))) return;

		// 별도 저장 없이 즉시 반영되므로 반영됐다는 신호를 준다
		// (검수장비처럼 안내 문구가 있으면 그쪽이 우선)
		if (inUse && onUseNotice) toast.show(onUseNotice, 'success');
		else
			toast.show(inUse ? '사용중으로 적용되었습니다.' : '사용가능으로 적용되었습니다.', 'success');
	}

	// 사용자를 바꾸면 사용여부는 해제된다 (인수인계 전 상태로)
	function updateAssignedTo(serviceName, envName, assignedTo) {
		patchStatus(serviceName, envName, { assignedTo, inUse: false });
	}

	// 비고는 타이핑이 멎으면 자동 저장한다 (저장 버튼 없음)
	function updateRemarks(serviceName, envName, remarks) {
		patchStatus(serviceName, envName, { remarks });
		const key = serverKey(serviceName, envName);
		clearTimeout(remarksTimers.get(key));
		remarksTimers.set(
			key,
			setTimeout(() => saveRemarks(serviceName, envName), REMARKS_DEBOUNCE_MS)
		);
	}

	async function saveRemarks(serviceName, envName) {
		const key = serverKey(serviceName, envName);
		clearTimeout(remarksTimers.get(key));
		remarksTimers.delete(key);

		savingKeys.add(key);
		const ok = await saveToDb(serviceName, envName);
		savingKeys.delete(key);
		if (!ok) return;

		savedKeys.add(key);
		setTimeout(() => savedKeys.delete(key), 1600);
		toast.show('비고가 적용되었습니다.', 'success');
	}

	async function saveToDb(serviceName, envName) {
		lastSavedAt = Date.now();
		const env = servers
			.find((s) => s.service === serviceName)
			?.environments.find((e) => e.name === envName);
		if (!env) return false;

		const status = statusOf(serviceName, envName);
		const now = new Date().toISOString();

		try {
			const { error } = await supabase.from(TABLE).upsert(
				{
					env_type: envType,
					service_name: serviceName,
					environment_name: envName,
					url: env.url,
					in_use: status.inUse,
					assigned_to: status.assignedTo,
					remarks: status.remarks,
					updated_at: now
				},
				{ onConflict: 'env_type,service_name,environment_name' }
			);
			if (error) throw error;
			patchStatus(serviceName, envName, { updatedAt: now });
			return true;
		} catch (err) {
			console.error(`${TABLE}(${envType}) save failed:`, err);
			toast.show('저장 중 오류가 발생했습니다.', 'error');
			return false;
		}
	}

	function formatUpdatedAt(value) {
		if (!value) return '-';
		return new Date(value).toLocaleString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if isLoading}
	<TableSkeleton cards={3} rows={2} cols={5} />
{:else}
	<!-- 상단 요약: 몇 대가 쓰이는지 한눈에 -->
	<div class="mb-5">
		<span class="badge badge-ghost badge-lg">
			전체 {totalCount}대 중 <span class="ml-1 font-bold {color.text}">{inUseCount}대</span>
			<span class="ml-1">사용중</span>
		</span>
	</div>

	<div class="space-y-6">
		{#each servers as service (service.service)}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title text-2xl">{service.service}</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr>
									<th class="w-1/6">환경</th>
									<th class="w-1/4">사용자</th>
									<th class="w-px whitespace-nowrap">사용여부</th>
									<th class="w-80">비고</th>
									<th>수정일</th>
								</tr>
							</thead>
							<tbody>
								{#each service.environments as env (env.name)}
									{@const status = statusOf(service.service, env.name)}
									{@const key = serverKey(service.service, env.name)}
									<!-- 사용중이면 좌측 보더 강조, 남이 방금 바꾼 행은 잠깐 하이라이트 -->
									<tr
										class="border-l-4 transition-colors {flashedKeys.has(key)
											? 'border-l-info bg-info/15'
											: status.inUse
												? color.row
												: 'border-l-transparent'}"
									>
										<td class="font-semibold">
											{#if env.url}
												<a href={env.url} target="_blank" rel="noopener noreferrer" class="link">
													{env.name}
													<Icon name="external" size={15} class="inline" />
												</a>
											{:else}
												{env.name}
											{/if}
										</td>
										<td>
											<select
												class="select-bordered select w-full max-w-xs {status.assignedTo
													? color.select
													: ''}"
												value={status.assignedTo}
												onchange={(e) =>
													updateAssignedTo(service.service, env.name, e.currentTarget.value)}
											>
												<option value="">사용자 선택</option>
												{#each USER_NAMES as user (user)}
													<option value={user}>{user}</option>
												{/each}
											</select>
										</td>
										<td class="whitespace-nowrap">
											<input
												type="checkbox"
												class="toggle {color.toggle}"
												checked={status.inUse}
												onclick={(e) => toggleInUse(service.service, env.name, e)}
											/>
											<span
												class="ml-2 {status.inUse
													? `${color.text} font-semibold`
													: 'text-base-content/50'}"
											>
												{status.inUse ? '사용중' : '사용가능'}
											</span>
										</td>
										<td class="whitespace-nowrap">
											{#if status.inUse}
												<div class="flex items-center gap-2">
													<input
														type="text"
														class="input-bordered input w-64 input-sm"
														placeholder="비고를 입력하세요 (자동 저장)"
														value={status.remarks}
														oninput={(e) =>
															updateRemarks(service.service, env.name, e.currentTarget.value)}
														onkeydown={(e) =>
															e.key === 'Enter' && saveRemarks(service.service, env.name)}
													/>
													<!-- 저장 버튼 대신 상태만 알려준다 -->
													<span class="w-14 text-xs text-base-content/45">
														{#if savingKeys.has(key)}
															저장 중…
														{:else if savedKeys.has(key)}
															<span class="inline-flex items-center gap-0.5 text-success">
																<Icon name="check" size={13} /> 저장됨
															</span>
														{/if}
													</span>
												</div>
											{:else}
												<span class="text-base-content/30">-</span>
											{/if}
										</td>
										<td class="text-sm whitespace-nowrap text-base-content/70">
											{formatUpdatedAt(status.updatedAt)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.table th {
		background-color: var(--color-base-300);
	}
</style>
