<script>
    import HtmlPreviewModal from '$lib/components/HtmlPreviewModal.svelte';
    import {copyToClipboard} from '$lib/utils/clipboard.js';
    import {SvelteDate} from 'svelte/reactivity';

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
    let system = '';
    let table = '';
    let impact = '';
    let backup = '';
    let deploymentDateTime = getDefaultDateTime();

    const assignees = ['최경림', '김준혁', '김지웅', '전하라', '오용상', '배윤희', '한수찬'];

    // Formatting logic
    $: output = (() => {
        const date = new SvelteDate(deploymentDateTime);
        const formattedDate = `${date.getFullYear()}년도 ${
            date.getMonth() + 1
        }월 ${date.getDate()}일 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        const fields = [
            {label: '작업 사유', value: reason},
            {label: '작업 내용 (상세)', value: details},
            {label: '작업 구분', value: type},
            {label: '대상 시스템', value: system},
            {label: '대상 테이블명', value: table},
            {label: '운영 작업 예상 영향도', value: impact},
            {label: '운영(검수) 반영일시', value: formattedDate},
            {label: '백업 및 롤백계획', value: backup}
        ];

        const body = fields
            .map(
                (
                    field
                ) => `<tr><td><p style="text-align: center;"><strong>${field.label}</strong></p></td>
<td><p>${formatToList(field.value.split('\n')) || '-'}</p></td></tr>`
            )
            .join('\n');

        return `<p>안녕하세요. 시스템코어개발팀 ${assignee}입니다.<br />
아래 내용으로 DB 작업 요청드립니다.</p>

<table>
	<tbody>
		${body}
	</tbody>
</table>

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
    <h1 class="mb-4 text-2xl font-bold">DB 업무 요청 양식</h1>

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

                <div class="form-control w-full">
                    <label for="system" class="label">
                        <span class="label-text">대상 시스템</span>
                    </label>
                    <textarea
                            id="system"
                            bind:value={system}
                            rows="2"
                            class="textarea-bordered textarea w-full"
                            placeholder="검수: 123.2.134.46:3306/nextasp_db&#10;운영: 172.16.72.43:3306/nextasp_db"
                    ></textarea>
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

