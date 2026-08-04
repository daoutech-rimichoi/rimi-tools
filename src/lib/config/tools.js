/**
 * 도구 레지스트리 — 사이드바 / 홈 카드 / 커맨드 팔레트 / 도구 페이지 헤더가
 * 모두 이 한 곳을 바라본다. 도구를 추가할 때 여기에만 등록하면 된다.
 *
 * tagline : 페이지 상단에 노출되는 팀 문구 (없으면 미노출)
 * wide    : 2단 그리드/표처럼 넓은 화면이 필요한 도구
 */
export const TOOL_CATEGORIES = [
	{
		id: 'statusBoard',
		name: '현황판',
		tools: [
			{
				path: '/statusBoard/devServer',
				name: '개발장비 사용 현황',
				tagline: '🔫 싸우지 말고 사용합시다~ 🔫',
				icon: 'server',
				wide: true
			},
			{
				path: '/statusBoard/stgServer',
				name: '검수장비 사용 현황',
				tagline: '🧨 검수장비는 항시 실발송 주의!! 🧨',
				icon: 'alert',
				wide: true
			}
		]
	},
	{
		id: 'sentenceCompletion',
		name: '문장완성',
		tools: [
			{
				path: '/sentenceCompletion/upcoming-deployment-status-form',
				name: '배포 예정 현황 양식',
				tagline: '🚀 "저장"은 선택이 아닌 필수임당 🚀',
				icon: 'send',
				wide: true
			},
			{
				path: '/sentenceCompletion/messenger-form',
				name: '메신저 문구 양식',
				description: '동료검토 요청 / 검수 요청 메신저 문구를 자동으로 완성합니다.',
				icon: 'message',
				wide: true
			},
			{
				path: '/sentenceCompletion/daily-check-form',
				name: '일일 점검 양식',
				description: '일일 점검 진행 상태를 공유하고 점검 결과 표를 만듭니다.',
				icon: 'clipboard',
				wide: true
			}
		]
	},
	{
		id: 'redmine',
		name: 'REDMINE',
		note: '입력 시 편집모드에서 "소스" 선택 후 붙여넣으세염',
		tools: [
			{
				path: '/redmine/l4-request-form',
				name: 'L4 작업 요청 양식',
				description: 'L4 disable/enable 및 Apache LB worker 작업 요청 본문을 생성합니다.',
				icon: 'network',
				wide: true
			},
			{
				path: '/redmine/deployment-request-form',
				name: '배포 요청 양식',
				description: '서비스 배포 요청 일감의 제목과 본문을 생성합니다.',
				icon: 'package',
				wide: true
			},
			{
				path: '/redmine/comment-form',
				name: '코멘트 양식',
				description: '개발 승인 요청 / 개발 완료 승인 요청 코멘트를 생성합니다.',
				icon: 'comment',
				wide: true
			},
			{
				path: '/redmine/db-request-form',
				name: 'DB 업무 요청 양식',
				description: 'DB 업무 요청 일감 본문을 생성합니다.',
				icon: 'database',
				wide: true
			}
		]
	},
	{
		id: 'etc',
		name: '기타',
		tools: [
			{
				path: '/etc/password-vault',
				name: '비밀번호 모음집',
				description: '팀 공용 계정 비밀번호를 그룹별로 보관하고 바로 복사합니다.',
				icon: 'lock',
				wide: true
			}
		]
	}
];

/** 카테고리 구분 없는 전체 도구 목록 */
export const TOOLS = TOOL_CATEGORIES.flatMap((category) =>
	category.tools.map((tool) => ({ ...tool, categoryId: category.id, categoryName: category.name }))
);

const TOOL_BY_PATH = new Map(TOOLS.map((tool) => [tool.path, tool]));

/**
 * 경로 표기 차이를 흡수한다. 호스팅에 따라 트레일링 슬래시가 붙어 들어올 수 있고,
 * 그때 도구를 못 찾으면 제목이 사라지고 폭이 좁아지는 식으로 화면이 깨진다.
 */
function normalizePath(path) {
	if (typeof path !== 'string') return '';
	const trimmed = path.replace(/\/+$/, '');
	return trimmed || '/';
}

/** 경로로 도구 조회 (없으면 undefined) */
export function getTool(path) {
	return TOOL_BY_PATH.get(normalizePath(path));
}
