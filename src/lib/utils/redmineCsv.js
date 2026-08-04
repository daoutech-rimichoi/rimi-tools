/**
 * 레드마인 일감 CSV 파서.
 *
 * 레드마인은 사내망(사설 IP)에 있어 배포된 서버에서 직접 호출할 수 없고,
 * CORS 헤더도 주지 않아 브라우저에서 fetch 로 읽을 수도 없다.
 * 대신 "CSV 내려받기"는 로그인 세션으로 동작하는 일반 다운로드라 제약이 없다.
 * 그래서 내려받은 파일을 여기서 파싱해 쓴다.
 */

/** 헤더 이름 → 우리가 쓰는 필드. 레드마인 언어설정/컬럼구성이 달라도 흡수한다. */
const HEADER_ALIASES = {
	id: ['#', 'id', '번호', '이슈'],
	subject: ['제목', 'subject'],
	status: ['상태', 'status'],
	worker: ['작업 담당자', '작업담당자', '담당자', 'assignee', 'assigned to'],
	// 배포 요청 일감에만 있는 열. 서비스 자동 선택에 쓰고, 어느 목록인지 구분하는 데도 쓴다.
	category: ['서비스분류', '서비스 분류', '분류', 'category']
};

/** 상태·담당자는 없어도 진행하되 무엇이 빠졌는지 알려 준다 */
const OPTIONAL_FIELDS = ['status', 'worker'];

/**
 * 레드마인 CSV 는 설정에 따라 CP949(euc-kr) 로 내려온다.
 * UTF-8 로 먼저 시도하고, 한글이 깨지면 euc-kr 로 다시 디코딩한다.
 */
export function decodeCsv(buffer) {
	const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
	// U+FFFD(치환 문자)가 섞이면 UTF-8 이 아니다. 선행 BOM 은 제거한다.
	// 문자를 그대로 적으면 eslint no-irregular-whitespace 에 걸리므로 이스케이프로 둔다.
	if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '');
	try {
		return new TextDecoder('euc-kr').decode(buffer);
	} catch {
		return utf8; // euc-kr 미지원 환경이면 그대로
	}
}

/** 큰따옴표 안의 쉼표·줄바꿈까지 처리하는 CSV 분해 */
function splitRows(text) {
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inQuotes) {
			if (ch !== '"') field += ch;
			else if (text[i + 1] === '"') {
				field += '"';
				i++;
			} else inQuotes = false;
			continue;
		}
		if (ch === '"') inQuotes = true;
		else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (ch !== '\r') field += ch;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** "시스템코어개발팀 전하라" → "전하라" (레드마인이 팀명을 앞에 붙여 준다) */
function nameOnly(value) {
	return String(value ?? '')
		.trim()
		.split(/\s+/)
		.at(-1);
}

/** 한 줄에서 각 필드가 몇 번째 칸인지 찾는다. 못 찾으면 -1. */
function columnsOf(cells) {
	const header = cells.map((h) => h.trim().toLowerCase());
	const indexOf = (field) => {
		for (const alias of HEADER_ALIASES[field]) {
			const i = header.indexOf(alias.toLowerCase());
			if (i !== -1) return i;
		}
		return -1;
	};
	return {
		id: indexOf('id'),
		subject: indexOf('subject'),
		status: indexOf('status'),
		worker: indexOf('worker'),
		category: indexOf('category')
	};
}

/**
 * CSV 텍스트를 받아 일감 목록으로 바꾼다.
 *
 * @returns {{
 *   issues: Array<{id:number, subject:string, status:string, worker:string, category:string}>,
 *   missing: string[],
 *   hasCategory: boolean
 * }}
 *   hasCategory 는 '서비스분류' 열이 있었는지다. 로드맵 목록인지 배포요청 목록인지 가리는 데 쓴다.
 * @throws 헤더를 못 찾거나 읽을 일감이 없으면 Error
 */
export function parseRedmineCsv(text) {
	const rows = splitRows(String(text ?? ''));
	if (rows.length < 2) throw new Error('내용이 없는 CSV 입니다.');

	const cols = columnsOf(rows[0]);
	if (cols.id === -1 || cols.subject === -1) {
		throw new Error('일감 번호 또는 제목 열을 찾을 수 없습니다. 레드마인 CSV 인지 확인해주세요.');
	}

	const issues = rows
		.slice(1)
		.map((r) => ({
			id: Number(String(r[cols.id] ?? '').replace(/[^\d]/g, '')),
			subject: (r[cols.subject] ?? '').trim(),
			status: cols.status === -1 ? '' : (r[cols.status] ?? '').trim(),
			worker: cols.worker === -1 ? '' : nameOnly(r[cols.worker]),
			category: cols.category === -1 ? '' : (r[cols.category] ?? '').trim()
		}))
		.filter((i) => Number.isInteger(i.id) && i.id > 0 && i.subject);

	if (!issues.length) throw new Error('읽어들일 일감이 없습니다.');

	return {
		issues,
		missing: OPTIONAL_FIELDS.filter((f) => cols[f] === -1),
		hasCategory: cols.category !== -1
	};
}
