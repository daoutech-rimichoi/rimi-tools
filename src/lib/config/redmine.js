/** 레드마인 접속 정보. 주소는 비밀이 아니므로 클라이언트에서도 쓴다. (API 키는 서버 전용) */
export const REDMINE_BASE_URL = 'https://task.daou.co.kr';

/** 커스텀필드 '작업 담당자' 의 ID. 레드마인 인스턴스마다 다르다. */
const WORKER_FIELD = 'cf_4';

/** 로드맵(버전) URL 이든 번호든 받아 버전 번호만 뽑는다 */
export function parseVersionId(text) {
	const value = String(text ?? '').trim();
	const fromUrl = value.match(/\/versions\/(\d+)/);
	if (fromUrl) return Number(fromUrl[1]);
	return /^\d+$/.test(value) ? Number(value) : null;
}

/** 로드맵 페이지 주소 */
export const versionUrl = (id) => `${REDMINE_BASE_URL}/versions/${id}`;

/**
 * 로드맵에 묶인 일감 CSV 내려받기 주소.
 * 브라우저의 레드마인 로그인 세션으로 인증되므로 API 키가 필요 없고,
 * 다운로드라서 CORS 제약도 받지 않는다.
 */
export function issuesCsvUrl(id) {
	const p = new URLSearchParams({ fixed_version_id: String(id), status_id: '*' });
	for (const c of ['id', 'subject', 'status', WORKER_FIELD]) p.append('c[]', c);
	return `${REDMINE_BASE_URL}/issues.csv?${p}`;
}

// --- 배포 요청 일감 (운영기술부 > 배포) -------------------------------------
//
// 저장된 쿼리(query_id)로도 되지만 그건 만든 사람만 열 수 있는 비공개 쿼리라
// 팀원이 쓸 수 없다. 그래서 같은 조건을 필터 파라미터로 직접 조립한다.
// 조건: 상태 진행중 + 유형 운영배포 + 등록자 시스템코어개발팀

/** 배포 요청 일감이 모여 있는 프로젝트 식별자 */
const DEPLOY_PROJECT = 'deploy';

/** 유형 '운영배포' 의 tracker id */
const DEPLOY_TRACKER_ID = 8;

/** 커스텀필드 '서비스분류' 의 ID */
const CATEGORY_FIELD = 'cf_13';

/**
 * 등록자 필터에 쓰는 시스템코어개발팀 계정 id.
 *
 * 레드마인의 등록자 필터는 그룹을 고를 수 없어 사람을 하나씩 지정해야 한다.
 * (기존에 쓰던 비공개 저장 쿼리도 실제로는 이 8명을 나열하고 있었다)
 * ⚠️ 팀원이 들어오거나 나가면 여기를 고쳐야 한다.
 */
const TEAM_AUTHOR_IDS = [
	1186, // 김준혁
	1187, // 김지웅
	1188, // 배윤희
	1189, // 오용상
	1190, // 전하라
	1191, // 진금식
	1192, // 최경림
	1193 // 한수찬
];

/** 배포 요청 일감을 추리는 필터 파라미터 */
function deployRequestParams() {
	const p = new URLSearchParams({ set_filter: '1', sort: 'id:desc' });
	// 상태: 진행중 — 특정 상태값이 아니라 '미완료 전체'를 뜻하는 연산자 o 다
	p.append('f[]', 'status_id');
	p.append('op[status_id]', 'o');
	// 유형: 운영배포
	p.append('f[]', 'tracker_id');
	p.append('op[tracker_id]', '=');
	p.append('v[tracker_id][]', String(DEPLOY_TRACKER_ID));
	// 등록자: 시스템코어개발팀
	p.append('f[]', 'author_id');
	p.append('op[author_id]', '=');
	for (const id of TEAM_AUTHOR_IDS) p.append('v[author_id][]', String(id));
	// 저장된 쿼리와 달리 필터 URL 은 컬럼 지정(c[])이 먹으므로 필요한 열만 받는다.
	// (query_id 를 쓰면 저장된 쿼리의 컬럼 설정이 c[] 를 덮어쓴다)
	for (const c of ['id', 'subject', 'status', CATEGORY_FIELD, 'assigned_to']) p.append('c[]', c);
	return p;
}

/** 배포 요청 일감 CSV 내려받기 주소 */
export const deployRequestCsvUrl = () =>
	`${REDMINE_BASE_URL}/projects/${DEPLOY_PROJECT}/issues.csv?${deployRequestParams()}`;
