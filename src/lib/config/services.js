/**
 * 서비스 · 배포 프로세스 카탈로그.
 *
 * 예전에는 배포 요청 / 배포 예정 현황 / 코멘트 양식 / 일일 점검이 각자 목록을 들고 있었다.
 * 서비스가 추가되면 여러 파일을 동시에 고쳐야 했고 실제로 서로 어긋나 있었다.
 * 이제 이 파일 하나만 고치면 된다.
 *
 * 아직 남은 표기 불일치는 아래 ⚠️ 주석으로 표시해 두었다.
 *
 * 여기로 합치지 않은 목록 (성격이 달라서 억지로 합치면 오히려 헷갈린다):
 *  - l4-request-form 의 workTargets : L4 전용 식별자 + Virtual IP/Port 라 축이 다르다
 *  - db-request-form 의 systemOptions : 서비스가 아니라 DB 인스턴스 목록
 *  - daily-check-form 의 FIXED_SERVICES : 점검 단위(080수신거부시나리오가 최상위) + 담당자/점검항목이 붙는다
 */

/** 제품군. deployment-request-form 의 서비스 select 값이자 processOptions 의 키 */
export const SERVICE_GROUPS = [
	{ key: 'bizsales', name: '영업관리시스템' },
	{ key: 'bizpp', name: '비즈뿌리오' },
	{ key: 'JavaASP', name: 'JavaASP' },
	{ key: 'ufit', name: '유핏' },
	{ key: 'numball', name: '번호자원관리시스템' }
];

/** 배포 유형 */
export const DEPLOY_TYPES = [
	{ key: 'deploy', name: '재기동' },
	{ key: 'filetransfer', name: '파일이동' }
];

/**
 * 배포 단위 프로세스.
 *
 * @property group      SERVICE_GROUPS 의 key
 * @property name       배포 요청 양식에 찍히는 이름
 * @property deployName 배포/인프라상의 이름 (배포 요청 양식 괄호 안, L4 양식의 서비스명과 같은 체계)
 * @property repo       Bitbucket 저장소명 (코멘트 양식에서 PR 링크 → 서비스명 변환에 사용)
 * @property type       'deploy' | 'filetransfer'
 * @property servers    배포 대상 서버 표기
 * @property listName   배포 예정 현황 select 에 쓰는 이름 (없으면 name)
 *
 * ⚠️ deployName 과 repo 가 다른 항목이 있다(kapi↔bizexternalapi 등).
 *    인프라상의 이름과 저장소명이 실제로 다른 것으로 보여 두 필드를 따로 둔다.
 */
export const PROCESSES = [
	// --- 영업관리시스템 ---
	{
		group: 'bizsales',
		name: '영업관리시스템 웹',
		deployName: 'sales-integration-web',
		repo: 'sales-integration-web',
		type: 'deploy',
		servers: 'lucy01a, lucy02a'
	},
	// 배포 대상은 아니지만 PR 변환에는 필요한 저장소
	{ group: 'bizsales', name: '영업관리시스템 공통', repo: 'sales-integration-commons' },
	{
		group: 'bizsales',
		name: '영업관리시스템 배치',
		deployName: 'sales-integration-batch',
		repo: 'sales-integration-batch',
		type: 'deploy',
		servers: 'lucy01a (+lucy02a는 파일만 복사)'
	},
	{
		group: 'bizsales',
		name: '영업관리시스템 모니터링',
		deployName: 'sales-integration-monitor',
		repo: 'sales-integration-monitor',
		type: 'deploy',
		servers: 'lucy01a (+lucy02a는 파일만 복사)'
	},
	{
		group: 'bizsales',
		name: '영업관리시스템 API',
		deployName: 'sales-integration-api',
		repo: 'sales-integration-api',
		type: 'filetransfer',
		servers: 'stella01, stella02'
	},
	// --- 비즈뿌리오 ---
	{
		group: 'bizpp',
		name: '비즈뿌리오 웹',
		deployName: 'bizweb',
		repo: 'bizweb',
		type: 'deploy',
		servers: 'stella01, stella02'
	},
	{
		group: 'bizpp',
		name: '비즈뿌리오 배치',
		deployName: 'bizBatchApi',
		repo: 'bizBatchApi',
		type: 'deploy',
		servers: 'stella01, stella02, stella03'
	},
	{
		group: 'bizpp',
		name: '비즈뿌리오 KAPI',
		deployName: 'kapi',
		repo: 'bizexternalapi',
		repoName: 'KAPI', // ⚠️ 표기 불일치: 코멘트 양식은 'KAPI' 로 출력해 왔다
		type: 'filetransfer',
		servers: 'stella01, stella02'
	},
	{
		group: 'bizpp',
		name: '비즈뿌리오 NAPI',
		deployName: 'napi',
		repo: 'web-napi',
		repoName: 'NAPI',
		type: 'filetransfer',
		servers: 'stella01, stella02'
	},
	{
		group: 'bizpp',
		name: '비즈뿌리오 RAPI',
		deployName: 'rapi',
		repo: 'bizexternalrcsapi',
		repoName: 'RAPI',
		type: 'filetransfer',
		servers: 'stella01, stella02'
	},
	{
		group: 'bizpp',
		name: '비즈뿌리오 팩스 발송 데몬',
		deployName: 'web-fax-daemon',
		repo: 'web-fax-daemon',
		repoName: '팩스 발송 데몬', // ⚠️ 표기 불일치
		type: 'filetransfer',
		servers: 'stella01, stella02, stella03'
	},
	{
		group: 'bizpp',
		name: '비즈뿌리오 팩스 포워드 데몬',
		deployName: 'web-fax-forward-daemon',
		repo: 'web-fax-forward-daemon',
		repoName: '팩스 포워드 데몬', // ⚠️ 표기 불일치
		type: 'filetransfer',
		servers: 'stella01, stella02, stella03'
	},
	{
		group: 'bizpp',
		name: '080수신거부시나리오',
		deployName: 'ivr',
		repo: 'ivr-scenario-web',
		type: 'filetransfer',
		servers: 'stella01, stella02'
	},

	// --- JavaASP ---
	...[
		['JavaASP 웹', 'asp', 'ares01a, ares02a'],
		['JavaASP 중간 관리자 웹', 'asp-admin', 'ares01a, ares02a'],
		['JavaASP 최고 관리자 웹', 'asp-manager', 'ares01a, ares02a'],
		['JavaASP 배치', 'asp-batch', 'ares01a (+ares02a는 파일만 복사)'],
		['JavaASP API', 'asp-service-api', 'acis01a'],
		['JavaASP 스팸', 'asp-spam', 'acis01a'],
		['JavaASP 주소록 데몬', 'asp-address-daemon', 'acis01a, acis02a'],
		['JavaASP SMS 발송 데몬', 'asp-sms-send-daemon', 'acis01a, acis02a'],
		['JavaASP SMS 리포트 데몬', 'asp-sms-report-daemon', 'acis01a'],
		['JavaASP MMS 발송 데몬', 'asp-mms-send-daemon', 'acis01a, acis02a'],
		['JavaASP MMS 리포트 데몬', 'asp-mms-report-daemon', 'acis01a'],
		['JavaASP RCS 발송 데몬', 'asp-rcs-send-daemon', 'acis01a, acis02a'],
		['JavaASP RCS 리포트 데몬', 'asp-rcs-report-daemon', 'acis01a'],
		['JavaASP 데몬 모니터링', 'daemon-monitor', 'acis01a'],
		['JavaASP 팩스 브릿지', 'faxBridge', 'acis01a']
	].map(([name, repo, servers]) => ({
		group: 'JavaASP',
		name,
		deployName: repo,
		repo,
		type: 'deploy',
		servers
	})),

	// --- 유핏 ---
	{
		group: 'ufit',
		name: '유핏 웹',
		deployName: 'ufit-web', // ⚠️ 식별자 불일치: 저장소는 'ufit'
		repo: 'ufit',
		type: 'deploy',
		servers: 'mare01a, mare02a'
	},
	{
		group: 'ufit',
		name: '유핏 정산 배치',
		deployName: 'ufit-bill-batch',
		repo: 'ufit-bill-batch',
		type: 'filetransfer',
		servers: 'mare01a (+mare02a는 파일만 복사)'
	},

	// --- 번호자원관리시스템 ---
	{
		group: 'numball',
		name: '번호자원관리시스템',
		deployName: 'numball-api',
		repo: 'numball-api',
		type: 'filetransfer',
		servers: 'lucy01a, lucy02a'
	}
];

// --- 화면별 파생 목록 -------------------------------------------------------

/** key 로 이름 찾기. 목록이 짧아 맵을 따로 만들지 않는다. */
const nameOf = (list, key) => list.find((x) => x.key === key)?.name ?? key;

/** 제품군 key -> 이름 (배포 요청서 제목 등) */
export const serviceGroupName = (key) => nameOf(SERVICE_GROUPS, key);

/** 배포 유형 key -> 이름 */
export const deployTypeName = (key) => nameOf(DEPLOY_TYPES, key);

/** 배포 요청 양식: `{서비스}.{배포유형}` -> 프로세스 문구 목록 */
export const PROCESS_OPTIONS = SERVICE_GROUPS.reduce((acc, { key }) => {
	acc[key] = DEPLOY_TYPES.reduce((byType, { key: type }) => {
		byType[type] = PROCESSES.filter((p) => p.group === key && p.type === type).map(
			(p) => `${p.name} (${p.deployName}) / ${p.servers}`
		);
		return byType;
	}, {});
	return acc;
}, {});

/** 코멘트 양식: Bitbucket 저장소명 -> 한글 서비스명 */
export const REPO_SERVICE_NAMES = Object.fromEntries(
	PROCESSES.filter((p) => p.repo).map((p) => [p.repo, p.repoName ?? p.name])
);

/**
 * 배포 예정 현황: 서비스 select 목록.
 * PROCESSES 에서 자동 생성하지 않는다 — JavaASP 는 프로세스별이 아니라 한 항목으로 고르고,
 * 노출 순서도 배포 요청 양식과 다르게 실제 사용 빈도에 맞춰 둔 선별 목록이기 때문이다.
 */
export const DEPLOY_TARGET_NAMES = [
	'비즈뿌리오 웹',
	'비즈뿌리오 배치',
	'비즈뿌리오 KAPI',
	'비즈뿌리오 NAPI',
	'비즈뿌리오 RAPI',
	'비즈뿌리오 팩스 발송 데몬',
	'비즈뿌리오 팩스 포워드 데몬',
	'080수신거부시나리오',
	'영업관리시스템 웹',
	'영업관리시스템 배치',
	'영업관리시스템 모니터링',
	'영업관리시스템 API',
	'번호자원관리시스템',
	'JavaASP',
	'유핏 웹',
	'유핏 정산 배치'
];

/**
 * 배포 예정 현황 비고: 제품군 단위 목록.
 * ⚠️ 표기 불일치: 번호자원관리시스템이 빠져 있다 (기존 동작 유지)
 */
export const SCENARIO_SERVICE_NAMES = ['비즈뿌리오', '영업관리시스템', 'JavaASP', '유핏'];

/** 배포 예정 현황 비고: 작업 종류 */
export const SCENARIO_TYPE_NAMES = ['운영작업시나리오', 'DB'];

/** select 목록 앞뒤에 붙는 공통 항목 */
export const PLACEHOLDER_SERVICE = '서비스선택';
export const PLACEHOLDER_TASK = '작업선택';
export const CUSTOM_INPUT = '직접입력';
