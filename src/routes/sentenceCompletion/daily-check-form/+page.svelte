<script>
    import { USER_NAMES } from '$lib/config/users.js';
    import { toast } from '$lib/stores/common.js';
    import { copyToClipboard } from '$lib/utils/clipboard.js';
    import { supabase } from '$lib/supabaseClient.js';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

    const FIXED_SERVICES = [
        { name: '영업관리시스템',    tooltip: 'lucy01~02 > sales-integration-web',  primary: '오용상', secondary: '김준혁', log: 'O', batch: 'O',   process: 'O', fs: 'O', send: 'N/A', report: 'N/A', payment: 'N/A' },
        { name: '번호자원관리시스템', tooltip: 'lucy01~02 > numball-api',             primary: '김지웅', secondary: '한수찬', log: 'O', batch: 'N/A', process: 'O', fs: 'O', send: 'N/A', report: 'N/A', payment: 'N/A' },
        { name: '비즈뿌리오',        tooltip: 'stella01~02 > bizweb',               primary: '최경림', secondary: '김지웅', log: 'O', batch: 'O',   process: 'O', fs: 'O', send: 'O',   report: 'O',   payment: 'O'   },
        { name: '유핏',              tooltip: 'mare01~02 > ufit',                   primary: '김준혁', secondary: '오용상', log: 'O', batch: 'O',   process: 'O', fs: 'O', send: 'O',   report: 'O',   payment: 'O'   },
        { name: '080수신거부시나리오', tooltip: 'stella01~02 > ivr',                  primary: '배윤희', secondary: '최경림', log: 'O', batch: 'O',   process: 'O', fs: 'O', send: 'N/A', report: 'N/A', payment: 'N/A' },
        { name: 'Java ASP',          tooltip: 'ares01~02, asic01~02',               primary: '한수찬', secondary: '배윤희', log: 'O', batch: 'O',   process: 'O', fs: 'O', send: 'N/A', report: 'N/A', payment: 'N/A' },
    ];

    function todayDate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function nowTimeParts() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const startM5 = Math.floor(now.getMinutes() / 5) * 5;
        const endM5 = startM5 + 5;
        const endH = endM5 >= 60 ? now.getHours() + 1 : now.getHours();
        return {
            startH: pad(now.getHours()),
            startM: pad(startM5),
            endH: pad(endH % 24),
            endM: pad(endM5 % 60),
        };
    }

    function defaultRows() {
        const t = nowTimeParts();
        return FIXED_SERVICES.map(s => ({
            ...s,
            inspector: '',
            checkTimeStartH: t.startH,
            checkTimeStartM: t.startM,
            checkTimeEndH: t.endH,
            checkTimeEndM: t.endM,
            responseOver: '-',
            resultMode: 'normal',
            customResult: '',
            notes: '-',
        }));
    }

    const initTime = nowTimeParts();
    let resetKey = $state(0);
    let globalInspector = $state('');
    let globalStartH = $state(initTime.startH);
    let globalStartM = $state(initTime.startM);
    let globalEndH = $state(initTime.endH);
    let globalEndM = $state(initTime.endM);
    let rows = $state(defaultRows());
    let todayStr = $state(todayDate());

    // 점검 상태 (실시간 DB 동기화)
    let selectedInspector = $state('');
    let statuses = $state(Object.fromEntries(USER_NAMES.map(name => [name, ''])));
    let activeStatuses = $derived(USER_NAMES.filter(name => statuses[name]));
    let allDone = $derived(activeStatuses.length > 0 && activeStatuses.every(name => statuses[name] === '점검완료'));
    let hasAnyStatus = $derived(activeStatuses.length > 0);
    let channel = null;
    let midnightTimer = null;

    async function loadStatuses() {
        const today = todayDate();
        supabase.from('daily_check_status').delete().lt('check_date', today).then();

        const { data, error } = await supabase
            .from('daily_check_status')
            .select('user_name, status')
            .eq('check_date', today);

        if (error) {
            console.error('Load error:', error);
            return;
        }
        if (data) {
            for (const row of data) {
                if (row.user_name in statuses) {
                    statuses[row.user_name] = row.status;
                }
            }
        }
    }

    async function saveStatus(userName, status) {
        for (const name of USER_NAMES) {
            if (name !== userName) statuses[name] = '';
        }
        statuses[userName] = status;
        const today = todayDate();
        await supabase.from('daily_check_status').delete().eq('check_date', today).neq('user_name', userName);
        const { error } = await supabase
            .from('daily_check_status')
            .upsert(
                { check_date: today, user_name: userName, status, updated_at: new Date().toISOString() },
                { onConflict: 'check_date,user_name' }
            );
        if (error) console.error('Save error:', error);
    }

    async function resetStatus() {
        selectedInspector = '';
        for (const name of USER_NAMES) statuses[name] = '';
        const today = todayDate();
        await supabase.from('daily_check_status').delete().eq('check_date', today);
    }

    function subscribeStatuses() {
        const today = todayDate();
        channel = supabase
            .channel(`daily_check_status:${today}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'daily_check_status',
                    filter: `check_date=eq.${today}`,
                },
                (payload) => {
                    const { user_name, status } = payload.new;
                    if (user_name in statuses) {
                        statuses[user_name] = status;
                    }
                }
            )
            .subscribe();
    }

    function scheduleMidnightReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilMidnight = tomorrow - now;

        midnightTimer = setTimeout(async () => {
            if (channel) {
                await supabase.removeChannel(channel);
                channel = null;
            }
            // UI 초기화
            todayStr = todayDate();
            const t = nowTimeParts();
            selectedInspector = '';
            globalInspector = '';
            globalStartH = t.startH;
            globalStartM = t.startM;
            globalEndH = t.endH;
            globalEndM = t.endM;
            rows = defaultRows();
            statuses = Object.fromEntries(USER_NAMES.map(name => [name, '']));
            resetKey++;
            // DB 이전 날짜 정리
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            await Promise.all([
                supabase.from('daily_check_status').delete().lte('check_date', yesterdayStr),
                supabase.from('daily_check_form').delete().lte('check_date', yesterdayStr),
            ]);
            // 새 날짜로 로드 + 구독
            await loadStatuses();
            await loadRows();
            subscribeStatuses();
            scheduleMidnightReset();
        }, msUntilMidnight);
    }

    async function loadRows() {
        const today = todayDate();
        supabase.from('daily_check_form').delete().lt('check_date', today).then();
        const { data, error } = await supabase
            .from('daily_check_form')
            .select('rows')
            .eq('check_date', today)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error('Load error:', error);
            return;
        }
        if (data?.rows) {
            const t = nowTimeParts();
            rows = FIXED_SERVICES.map(svc => {
                const saved = data.rows.find(r => r.name === svc.name);
                if (saved) return { ...svc, ...saved };
                return { ...svc, inspector: '', checkTimeStartH: t.startH, checkTimeStartM: t.startM, checkTimeEndH: t.endH, checkTimeEndM: t.endM, responseOver: '-', resultMode: 'normal', customResult: '', notes: '-' };
            });
            resetKey++;
        }
    }

    async function saveRows() {
        const today = todayDate();
        const { error } = await supabase
            .from('daily_check_form')
            .upsert(
                { check_date: today, rows, updated_at: new Date().toISOString() },
                { onConflict: 'check_date' }
            );
        if (error) {
            console.error('Save error:', error);
            toast.show('저장에 실패했습니다.', 'error');
        } else {
            toast.show('저장되었습니다.', 'success');
        }
    }

    onMount(() => {
        if (!browser) return;
        loadStatuses();
        loadRows();
        subscribeStatuses();
        scheduleMidnightReset();
        return () => {
            if (channel) supabase.removeChannel(channel);
            if (midnightTimer) clearTimeout(midnightTimer);
        };
    });

    // --- UI 액션 ---
    function applyGlobal() {
        rows = rows.map(r => ({
            ...r,
            ...(globalInspector ? { inspector: globalInspector } : {}),
            checkTimeStartH: globalStartH,
            checkTimeStartM: globalStartM,
            checkTimeEndH: globalEndH,
            checkTimeEndM: globalEndM,
        }));
    }

    const DEPLOY_TEMPLATE = 'YYYY.MM.DD 배포 및 일일점검 특이사항 없음\n- 배포된 레드마인';

    function onResultModeChange(row) {
        if (row.resultMode === 'deploy') {
            row.customResult = DEPLOY_TEMPLATE;
        } else if (row.resultMode === 'normal') {
            row.customResult = '';
        }
    }

    function reset() {
        const t = nowTimeParts();
        globalInspector = '';
        globalStartH = t.startH;
        globalStartM = t.startM;
        globalEndH = t.endH;
        globalEndM = t.endM;
        rows = defaultRows();
        resetKey++;
    }

    // --- HTML 생성 ---
    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function toHtmlLines(str) {
        return esc(str).replace(/\n/g, '<br>');
    }

    let previewHtml = $derived.by(() => {
        const TH = `padding-top: 1px; padding-right: 1px; padding-left: 1px; font-size: 10pt; font-weight: 700; font-family: Arial; text-align: center; vertical-align: middle; border: 1px solid black; background: rgb(207, 226, 243);`;
        const TD_SVC = `padding-top: 1px; padding-right: 1px; padding-left: 1px; font-size: 10pt; font-weight: 700; font-family: Arial; text-align: center; vertical-align: middle; border: 1px solid black; background: rgb(239, 239, 239);`;
        const TD = `padding-top: 1px; padding-right: 1px; padding-left: 1px; font-size: 10pt; font-family: Arial; text-align: center; vertical-align: middle; border: 1px solid black;`;
        const TD_CAL = `padding-top: 1px; padding-right: 1px; padding-left: 1px; font-size: 10pt; font-family: Calibri; vertical-align: middle; border: 1px solid black;`;

        const headerRow = `<tr>
            <td style="${TH}">서비스</td>
            <td style="${TH}">담당자<br>(정)</td>
            <td style="${TH}">담당자<br>(부)</td>
            <td style="${TH}">공통 점검 대상<br>(로그 점검)</td>
            <td style="${TH}">공통 점검 대상<br>(배치 수행)</td>
            <td style="${TH}">공통 점검 대상<br>(프로세스 동작)</td>
            <td style="${TH}">공통 점검 대상<br>(파일시스템)</td>
            <td style="${TH}">기능 점검 대상<br>(발송)</td>
            <td style="${TH}">기능 점검 대상<br>(리포트)</td>
            <td style="${TH}">기능 점검 대상<br>(결제)</td>
            <td style="${TH}">점검자</td>
            <td style="${TH}">점검 시간</td>
            <td style="${TH}">응답시간 10초 초과</td>
            <td style="${TH}">점검 결과</td>
            <td style="${TH}">확인 및 조치사항</td>
        </tr>`;

        const dataRows = rows.map(r => {
            const checkTimeStr = `${r.checkTimeStartH}:${r.checkTimeStartM} ~ ${r.checkTimeEndH}:${r.checkTimeEndM}`;
            const resultStr = r.resultMode === 'normal' ? '특이사항 없음' : r.customResult;
            return `<tr>
            <td style="${TD_SVC}">${esc(r.name)}</td>
            <td style="${TD}">${esc(r.primary)}</td>
            <td style="${TD}">${esc(r.secondary)}</td>
            <td style="${TD}">${esc(r.log)}</td>
            <td style="${TD}">${esc(r.batch)}</td>
            <td style="${TD}">${esc(r.process)}</td>
            <td style="${TD}">${esc(r.fs)}</td>
            <td style="${TD}">${esc(r.send)}</td>
            <td style="${TD}">${esc(r.report)}</td>
            <td style="${TD}">${esc(r.payment)}</td>
            <td style="${TD}">${esc(r.inspector || '-')}</td>
            <td style="${TD}">${esc(checkTimeStr)}</td>
            <td style="${TD_CAL}">${toHtmlLines(r.responseOver)}</td>
            <td style="${TD_CAL}">${toHtmlLines(resultStr)}</td>
            <td style="${TD_CAL} text-align: center;">${toHtmlLines(r.notes)}</td>
        </tr>`;
        }).join('');

        return `<table style="border-collapse: collapse; width: 2027px;"><colgroup><col width="133" style="width: 133px;"><col width="68" style="width: 68px;" span="2"><col width="94" style="width: 95px;" span="7"><col width="68" style="width: 68px;"><col width="101" style="width: 101px;"><col width="363" style="width: 363px;"><col width="431" style="width: 431px;"><col width="136" style="width: 136px;"></colgroup><tbody>${headerRow}${dataRows}</tbody></table><p style="font-family: &quot;맑은 고딕&quot;; font-size: 10pt; line-height: 150%; margin-top: 0px; margin-bottom: 0px;"><br></p>`;
    });

    // --- 자동 높이 조절 ---
    function autoResize(node) {
        function resize() {
            node.style.height = 'auto';
            node.style.height = node.scrollHeight + 'px';
        }
        resize();
        node.addEventListener('input', resize);
        return { destroy: () => node.removeEventListener('input', resize) };
    }

    async function copyHtml() {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([previewHtml], { type: 'text/html' }),
                    'text/plain': new Blob([previewHtml], { type: 'text/plain' }),
                }),
            ]);
            toast.show('클립보드에 복사되었습니다.', 'success');
        } catch (err) {
            console.error(err);
            toast.show('클립보드 복사에 실패했습니다.', 'error');
        }
    }
</script>

<div class="container mx-auto p-4">
    <div class="mb-6 rounded-xl bg-neutral py-5 text-center shadow">
        <h1 class="text-2xl font-bold text-neutral-content">일일 점검 양식</h1>
    </div>

    <!-- 점검 상태 선택 -->
    <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <select class="select select-bordered select-sm w-36" bind:value={selectedInspector}>
                <option value="">점검자 선택</option>
                {#each USER_NAMES as name}
                    <option value={name}>{name}</option>
                {/each}
            </select>
            <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="status-selected" class="radio radio-sm radio-warning"
                    disabled={!selectedInspector}
                    checked={selectedInspector && statuses[selectedInspector] === '점검중'}
                    onchange={() => saveStatus(selectedInspector, '점검중')} />
                <span class="text-sm">점검중</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="status-selected" class="radio radio-sm radio-success"
                    disabled={!selectedInspector}
                    checked={selectedInspector && statuses[selectedInspector] === '점검완료'}
                    onchange={() => saveStatus(selectedInspector, '점검완료')} />
                <span class="text-sm">점검완료</span>
            </label>
        </div>
        <button class="btn btn-outline btn-error btn-sm" onclick={resetStatus}>초기화</button>
    </div>

    <!-- 점검 상태 표시 -->
    <div class="card shadow mb-4 {allDone ? 'bg-success/40' : hasAnyStatus ? 'bg-warning/40' : 'bg-info/40'}">
        <div class="card-body py-5">
            <div class="text-center">
                <p class="text-base opacity-60 mb-1">{todayStr}</p>
                <h2 class="text-2xl font-bold flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    {#if hasAnyStatus}
                        {#each activeStatuses as name}
                            <span class="inline-flex items-center gap-1.5">
                                {name}
                                <span class="font-normal text-xl {statuses[name] === '점검완료' ? 'text-success' : 'text-warning'}">{statuses[name]}</span>
                            </span>
                        {/each}
                    {:else}
                        <span>👉 현재 점검중인 본인을 꼭 기록해 주쎄렴 👈</span>
                    {/if}
                </h2>
            </div>
        </div>
    </div>

    <h2 class="text-lg font-bold mb-2">입력</h2>
    <!-- 공통 입력 (전체 적용) -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
        <select id="global-inspector" class="select select-bordered select-sm w-36" bind:value={globalInspector}>
            <option value="">점검자 선택</option>
            {#each USER_NAMES as name}
                <option value={name}>{name}</option>
            {/each}
        </select>
        <div class="flex items-center gap-1">
            <select class="select select-bordered select-sm w-16" bind:value={globalStartH}>
                {#each HOURS as h}<option value={h}>{h}</option>{/each}
            </select>
            <span class="text-sm">:</span>
            <select class="select select-bordered select-sm w-16" bind:value={globalStartM}>
                {#each MINUTES as m}<option value={m}>{m}</option>{/each}
            </select>
            <span class="text-sm px-1">~</span>
            <select class="select select-bordered select-sm w-16" bind:value={globalEndH}>
                {#each HOURS as h}<option value={h}>{h}</option>{/each}
            </select>
            <span class="text-sm">:</span>
            <select class="select select-bordered select-sm w-16" bind:value={globalEndM}>
                {#each MINUTES as m}<option value={m}>{m}</option>{/each}
            </select>
        </div>
        <button class="btn btn-outline btn-sm" onclick={applyGlobal}>전체 적용</button>
        <button class="btn btn-outline btn-error btn-sm ml-auto" onclick={reset}>초기화</button>
        <button class="btn btn-primary btn-sm" onclick={saveRows}>저장하기</button>
    </div>

    <!-- 입력 표 -->
    <div class="overflow-x-auto rounded-xl shadow mb-8">
        <table class="bg-base-100 text-center text-sm border-collapse" style="width: 2555px;">
            <colgroup>
                <col style="width: 133px;">
                <col style="width: 68px;">
                <col style="width: 68px;">
                <col style="width: 95px;">
                <col style="width: 95px;">
                <col style="width: 95px;">
                <col style="width: 95px;">
                <col style="width: 95px;">
                <col style="width: 95px;">
                <col style="width: 95px;">
                <col style="width: 144px;">
                <col style="width: 320px;">
                <col style="width: 363px;">
                <col style="width: 431px;">
                <col style="width: 363px;">
            </colgroup>
            <thead>
                <tr class="bg-base-200 text-base-content">
                    <th rowspan="2" class="border border-base-300 align-middle p-1 bg-base-200" style="position: sticky; left: 0; z-index: 2;">서비스</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">담당자<br/>(정)</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">담당자<br/>(부)</th>
                    <th colspan="4" class="border border-base-300 p-1">공통 점검 대상</th>
                    <th colspan="3" class="border border-base-300 p-1">기능 점검 대상</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">점검자</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">점검 시간</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">응답시간<br/>10초 초과</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">점검 결과</th>
                    <th rowspan="2" class="border border-base-300 align-middle p-1">확인 및<br/>조치사항</th>
                </tr>
                <tr class="bg-base-200 text-base-content">
                    <th class="border border-base-300 p-1">로그<br/>점검</th>
                    <th class="border border-base-300 p-1">배치<br/>수행</th>
                    <th class="border border-base-300 p-1">프로세스<br/>동작</th>
                    <th class="border border-base-300 p-1">파일<br/>시스템</th>
                    <th class="border border-base-300 p-1">발송</th>
                    <th class="border border-base-300 p-1">리포트</th>
                    <th class="border border-base-300 p-1">결제</th>
                </tr>
            </thead>
            <tbody>
                {#each rows as row}
                    <tr class={row.inspector ? '' : 'bg-error/20'}>
                        <!-- 서비스 (sticky) -->
                        <td class="border border-base-300 font-semibold whitespace-nowrap p-1 {row.inspector ? 'bg-base-100' : 'bg-error/20'}" style="position: sticky; left: 0; z-index: 1;">
                            <div class="flex items-center gap-1">
                                <span>{row.name}</span>
                                <div class="tooltip tooltip-right" data-tip={row.tooltip}>
                                    <span class="cursor-help text-info text-xs leading-none">❓</span>
                                </div>
                            </div>
                        </td>
                        <td class="border border-base-300 p-1">{row.primary}</td>
                        <td class="border border-base-300 p-1">{row.secondary}</td>
                        {#each [row.log, row.batch, row.process, row.fs, row.send, row.report, row.payment] as val}
                            <td class="border border-base-300 p-1">{val}</td>
                        {/each}
                        <!-- 점검자 -->
                        <td class="border border-base-300 p-1">
                            <select class="select select-bordered select-sm w-36" bind:value={row.inspector}>
                                <option value="">-</option>
                                {#each USER_NAMES as name}
                                    <option value={name}>{name}</option>
                                {/each}
                            </select>
                        </td>
                        <!-- 점검 시간 -->
                        <td class="border border-base-300 p-1">
                            <div class="flex items-center gap-1 justify-center">
                                <select class="select select-bordered select-sm w-16" bind:value={row.checkTimeStartH}>
                                    {#each HOURS as h}<option value={h}>{h}</option>{/each}
                                </select>
                                <span class="text-sm">:</span>
                                <select class="select select-bordered select-sm w-16" bind:value={row.checkTimeStartM}>
                                    {#each MINUTES as m}<option value={m}>{m}</option>{/each}
                                </select>
                                <span class="text-sm px-1">~</span>
                                <select class="select select-bordered select-sm w-16" bind:value={row.checkTimeEndH}>
                                    {#each HOURS as h}<option value={h}>{h}</option>{/each}
                                </select>
                                <span class="text-sm">:</span>
                                <select class="select select-bordered select-sm w-16" bind:value={row.checkTimeEndM}>
                                    {#each MINUTES as m}<option value={m}>{m}</option>{/each}
                                </select>
                            </div>
                        </td>
                        <!-- 응답시간 -->
                        <td class="border border-base-300 p-1">
                            {#key resetKey}
                                <textarea
                                    use:autoResize
                                    class="textarea textarea-bordered w-full resize-none"
                                    style="min-height: 2rem; padding: 0.375rem 0.5rem; font-size: 0.875rem;"
                                    bind:value={row.responseOver}
                                ></textarea>
                            {/key}
                        </td>
                        <!-- 점검 결과 -->
                        <td class="border border-base-300 p-1">
                            <select class="select select-bordered select-sm w-full" bind:value={row.resultMode}
                                onchange={() => onResultModeChange(row)}>
                                <option value="normal">특이사항 없음</option>
                                <option value="deploy">배포 후 일일점검</option>
                                <option value="custom">직접입력</option>
                            </select>
                            {#if row.resultMode === 'deploy' || row.resultMode === 'custom'}
                                {#key resetKey}
                                    <textarea
                                        use:autoResize
                                        class="textarea textarea-bordered w-full resize-none mt-1"
                                        style="min-height: 2rem; padding: 0.375rem 0.5rem; font-size: 0.875rem;"
                                        placeholder="-"
                                        bind:value={row.customResult}
                                    ></textarea>
                                {/key}
                            {/if}
                        </td>
                        <!-- 확인 및 조치사항 -->
                        <td class="border border-base-300 p-1">
                            {#key resetKey}
                                <textarea
                                    use:autoResize
                                    class="textarea textarea-bordered w-full resize-none"
                                    style="min-height: 2rem; padding: 0.375rem 0.5rem; font-size: 0.875rem;"
                                    bind:value={row.notes}
                                ></textarea>
                            {/key}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- 미리보기 -->
    <div class="mb-2 flex items-center justify-between">
        <h2 class="text-lg font-bold">결과</h2>
        <button class="btn btn-primary btn-sm" onclick={copyHtml}>표 복사</button>
    </div>
    <div class="mb-2 flex items-center gap-2">
        <span class="text-sm font-mono">{todayStr}</span>
        <button class="btn btn-outline btn-xs" onclick={() => copyToClipboard(todayStr)}>복사</button>
    </div>
    <div class="overflow-x-auto rounded-xl shadow p-4" style="background-color: white; color: black;">
        {@html previewHtml}
    </div>
</div>
