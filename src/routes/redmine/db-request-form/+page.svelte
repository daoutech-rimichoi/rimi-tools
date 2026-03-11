<script>
    import HtmlPreviewModal from '$lib/components/HtmlPreviewModal.svelte';
    import {copyToClipboard} from '$lib/utils/clipboard.js';
    import {SvelteDate} from 'svelte/reactivity';
    import { USER_NAMES } from '$lib/config/users.js';

    // Function to get today's date at 18:00 in YYYY-MM-DDTHH:mm format
    function getDefaultDateTime() {
        const now = new SvelteDate();
        now.setHours(18, 0, 0, 0);
        // Adjust for timezone offset
        const timezoneOffset = now.getTimezoneOffset() * 60000;
        return new SvelteDate(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
    }

    function formatToList(items) {
        if (!items || items.length === 0) return '';
        return items
            .filter((item) => item.trim() !== '')
            .map((item) => item.trim())
            .join('<br />\n');
    }

    // State variables for form inputs
    let assignee = '최경림';
    let reason = '';
    let details = '';
    let type = '';
    let environment = 'custom'; // 검수, 운영, 직접입력
    let selectedSystems = [];
    let customSystem = '';
    let table = '';
    let impact = '';
    let backup = '';
    let deploymentDateTime = getDefaultDateTime();

    const assignees = USER_NAMES;
    
    const environmentOptions = [
				{value: 'custom', label: '직접입력'},
        {value: 'select', label: '검수/운영'},
    ];
    
    const systemOptions = {
				select: ['advance', 'nextasp_db', 'orient_db', 'optimus_db', 'alice_db', 'spamcop', 'yard01a', 'mercury', 'dr_db'],
    };
    
    // Reactive variable for available systems
    $: availableSystems = systemOptions[environment] || [];
    
    // Reset selected systems when environment changes
    $: {
        if (environment !== 'custom') {
            selectedSystems = selectedSystems.filter((s) => availableSystems.includes(s));
        }
    }

    // Calculate system value for output
    $: system = (() => {
        if (environment === 'custom') {
            return customSystem;
        }
        return selectedSystems.join(', ');
    })();

    // Formatting logic
    $: output = (() => {
        const date = new SvelteDate(deploymentDateTime);
        const formattedDate = `${date.getFullYear()}년도 ${
            date.getMonth() + 1
        }월 ${date.getDate()}일 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        function wrapLabel(text) {
            return `<span style="font-size:10pt"><span style="font-weight:700"><span style="color:black"><span style="font-style:normal"><span style="text-decoration:none"><span style="font-family:&quot;맑은 고딕&quot;,monospace">${text}</span></span></span></span></span></span>`;
        }

        function wrapValue(text) {
            return `<span style="font-size:10pt"><span style="color:black"><span style="font-weight:400"><span style="font-style:normal"><span style="text-decoration:none"><span style="font-family:&quot;맑은 고딕&quot;,monospace">${text}</span></span></span></span></span></span>`;
        }

        const rows = [
            {label: '작업 사유',          value: reason,        trHeight: 33,  trHeightPt: '24.75pt', isFirst: true,  multiline: false},
            {label: '작업 내용 (상세)',    value: details,       trHeight: 102, trHeightPt: '77.25pt', isFirst: false, multiline: true},
            {label: '작업 구분',          value: type,          trHeight: 29,  trHeightPt: '21.75pt', isFirst: false, multiline: false},
            {label: '대상 시스템',        value: system,        trHeight: 29,  trHeightPt: '21.75pt', isFirst: false, multiline: false},
            {label: '대상 테이블명',      value: table,         trHeight: 29,  trHeightPt: '21.75pt', isFirst: false, multiline: false},
            {label: '운영작업 예상 영향도', value: impact,       trHeight: 29,  trHeightPt: '21.75pt', isFirst: false, multiline: false},
            {label: '운영(검수) 반영일시', value: formattedDate, trHeight: 29,  trHeightPt: '21.75pt', isFirst: false, multiline: false},
            {label: '백업 및 롤백계획',   value: backup,        trHeight: 29,  trHeightPt: '21.75pt', isFirst: false, multiline: false},
        ];

        const body = rows.map(({label, value, trHeight, trHeightPt, isFirst, multiline}) => {
            const labelTdStyle = isFirst
                ? `border:0.5pt solid windowtext; background:#d0cece; height:${trHeightPt}; width:132pt; text-align:left; padding-left:18px; padding-top:1px; padding-right:1px; vertical-align:middle; white-space:nowrap`
                : `border:0.5pt solid windowtext; background:#d0cece; height:${trHeightPt}; border-top:none; text-align:left; padding-left:18px; padding-top:1px; padding-right:1px; vertical-align:middle; white-space:nowrap`;

            const valueTdStyle = isFirst
                ? `border-top: 0.5pt solid windowtext; border-right: 0.5pt solid windowtext; border-bottom: 0.5pt solid windowtext; border-image: initial; border-left: none; width: 546px; padding-top: 1px; padding-right: 1px; padding-left: 1px; vertical-align: middle; white-space: nowrap;`
                : multiline
                    ? `border-right: 0.5pt solid windowtext; border-bottom: 0.5pt solid windowtext; border-image: initial; border-top: none; border-left: none; width: 546px; white-space: normal; padding-top: 1px; padding-right: 1px; padding-left: 1px; vertical-align: middle;`
                    : `border-right: 0.5pt solid windowtext; border-bottom: 0.5pt solid windowtext; border-image: initial; border-top: none; border-left: none; padding-top: 1px; padding-right: 1px; padding-left: 1px; vertical-align: middle; white-space: nowrap; width: 546px;`;

            const formattedValue = formatToList(value.split('\n')) || '　';

            return `<tr height="${trHeight}" style="height:${trHeightPt}">
            <td height="${trHeight}" style="${labelTdStyle}" width="176">${wrapLabel(label)}</td>
            <td style="${valueTdStyle}" width="417">${wrapValue(formattedValue)}</td>
        </tr>`;
        }).join('\n        ');

        return `<p>안녕하세요. 시스템코어개발팀 ${assignee}입니다.<br />
아래 내용으로 DB 작업 요청드립니다.</p>

<table style="border-collapse: collapse; width: 746px; border: none;" width="593">
    <colgroup>
        <col style="width:132pt" width="176" />
        <col style="width:313pt" width="417" />
    </colgroup>
    <tbody>
        ${body}
    </tbody>
</table>

<p>&nbsp;</p>

<p>감사합니다.</p>`;
    })();

    let showPreview = false;

    // --- Warn user before leaving the page ---
    function handleBeforeUnload(event) {
        // Only warn if there's some input that might be lost
        if (reason.trim() !== '' || details.trim() !== '' || type.trim() !== '' ||
            system.trim() !== '' || table.trim() !== '' || impact.trim() !== '' ||
            backup.trim() !== '') {
            event.preventDefault();
            event.returnValue = '변경사항이 저장되지 않을 수 있습니다. 정말로 나가시겠습니까?';
            return event.returnValue;
        }
    }
</script>

<svelte:window on:beforeunload={handleBeforeUnload}/>

<div class="container mx-auto p-4">
    <div class="mb-8 rounded-xl bg-neutral py-5 text-center shadow">
        <h1 class="text-2xl font-bold text-neutral-content">DB 업무 요청 양식</h1>
    </div>

    <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
        <!-- Input Section -->
        <div class="card bg-base-100 shadow-xl">
            <div class="card-body space-y-4">
                <h2 class="card-title">입력</h2>

                <div class="form-control w-full">
                    <label for="assignee" class="label">
                        <span class="label-text">담당자</span>
                    </label>
                    <select id="assignee" bind:value={assignee} class="select-bordered select w-full">
                        {#each assignees as name (name)}
                            <option value={name}>{name}</option>
                        {/each}
                    </select>
                </div>

                <div class="form-control w-full">
                    <label for="reason" class="label">
                        <span class="label-text">작업 사유</span>
                    </label>
                    <textarea
                            id="reason"
                            bind:value={reason}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="javaASP 인덱스 추가"
                    ></textarea>
                </div>

                <div class="form-control w-full">
                    <label for="details" class="label">
                        <span class="label-text">작업 내용(상세)</span>
                    </label>
                    <textarea
                            id="details"
                            bind:value={details}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="user_statistics 테이블 (asp_main_no, user_main_no, type, date) 유니크인덱스 추가"
                    ></textarea>
                </div>

                <div class="form-control w-full">
                    <label for="type" class="label">
                        <span class="label-text">작업 구분</span>
                    </label>
                    <textarea
                            id="type"
                            bind:value={type}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="인덱스 추가"
                    ></textarea>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div class="form-control w-full">
                        <label for="environment" class="label">
                            <span class="label-text">환경</span>
                        </label>
                        <select id="environment" bind:value={environment} class="select-bordered select w-full">
                            {#each environmentOptions as env (env.value)}
                                <option value={env.value}>{env.label}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="form-control w-full sm:col-span-2">
                        <label class="label" for={environment === 'custom' ? 'customSystem' : undefined}>
                            <span class="label-text">대상 시스템</span>
                        </label>
                        {#if environment === 'custom'}
                            <textarea
                                    id="customSystem"
                                    bind:value={customSystem}
                                    rows="2"
                                    class="textarea-bordered textarea w-full"
                                    placeholder="검수: 123.2.134.46:3306/nextasp_db&#10;운영: 172.16.72.43:3306/nextasp_db"
                            ></textarea>
                        {:else}
                            <div class="block space-y-2 rounded-lg border border-base-300 bg-base-200 p-2">
                                {#if availableSystems.length > 0}
                                    {#each availableSystems as systemOption (systemOption)}
                                        <label class="flex cursor-pointer items-center">
                                            <input
                                                    type="checkbox"
                                                    value={systemOption}
                                                    bind:group={selectedSystems}
                                                    class="checkbox checkbox-primary"
                                            />
                                            <span class="label-text ml-2">{systemOption}</span>
                                        </label>
                                    {/each}
                                {:else}
                                    <p class="text-sm text-base-content/70">
                                        선택된 환경에 해당하는 시스템이 없습니다.
                                    </p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="form-control w-full">
                    <label for="table" class="label">
                        <span class="label-text">대상 테이블명</span>
                    </label>
                    <textarea
                            id="table"
                            bind:value={table}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="user_statistics"
                    ></textarea>
                </div>

                <div class="form-control w-full">
                    <label for="impact" class="label">
                        <span class="label-text">운영 작업 예상 영향도</span>
                    </label>
                    <textarea
                            id="impact"
                            bind:value={impact}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="인덱스 생성을 위한 데이터 스캔 1회 (81만4381건)"
                    ></textarea>
                </div>

                <div class="form-control w-full">
                    <label for="deploymentDateTime" class="label">
                        <span class="label-text">운영(검수) 반영일시</span>
                    </label>
                    <input
                            type="datetime-local"
                            id="deploymentDateTime"
                            bind:value={deploymentDateTime}
                            class="input-bordered input w-full"
                    />
                </div>

                <div class="form-control w-full">
                    <label for="backup" class="label">
                        <span class="label-text">백업 및 롤백 계획</span>
                    </label>
                    <textarea
                            id="backup"
                            bind:value={backup}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="-"
                    ></textarea>
                </div>
            </div>
        </div>

        <!-- Output Section -->
        <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
                <div class="mb-2 flex items-center justify-between">
                    <h2 class="card-title">결과</h2>
                    <div class="flex gap-2">
                        <button on:click={() => (showPreview = true)} class="btn btn-sm btn-secondary">
                            미리보기
                        </button>
                        <button on:click={() => copyToClipboard(output)} class="btn btn-sm btn-primary">
                            복사하기
                        </button>
                    </div>
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

<HtmlPreviewModal bind:isOpen={showPreview} htmlContent={output}/>

