import { REPO_SERVICE_NAMES } from '$lib/config/services.js';

// 저장소(repo) 이름 → 한글 서비스명 매핑.
// 목록 자체는 $lib/config/services.js 의 PROCESSES 하나에서 파생된다.
export const repoServiceNameMap = REPO_SERVICE_NAMES;

// 소문자 키 사본.
// Bitbucket PR 주소의 저장소 부분은 소문자 슬러그(.../repos/bizbatchapi/...)로 내려오는데
// 카탈로그는 실제 저장소 표기(bizBatchApi, faxBridge)를 들고 있어 그대로 찾으면 빗나간다.
const lowerCaseKeyMap = Object.fromEntries(
	Object.entries(REPO_SERVICE_NAMES).map(([repo, name]) => [repo.toLowerCase(), name])
);

// repo 이름을 한글 서비스명으로 변환한다. 매핑이 없으면 원래 repo 이름을 그대로 반환한다.
export function toServiceName(repoName) {
	if (!repoName) return repoName;
	return repoServiceNameMap[repoName] ?? lowerCaseKeyMap[repoName.toLowerCase()] ?? repoName;
}
