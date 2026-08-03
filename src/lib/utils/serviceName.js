import { REPO_SERVICE_NAMES } from '$lib/config/services.js';

// 저장소(repo) 이름 → 한글 서비스명 매핑.
// 목록 자체는 $lib/config/services.js 의 PROCESSES 하나에서 파생된다.
export const repoServiceNameMap = REPO_SERVICE_NAMES;

// repo 이름을 한글 서비스명으로 변환한다. 매핑이 없으면 원래 repo 이름을 그대로 반환한다.
export function toServiceName(repoName) {
	if (!repoName) return repoName;
	return repoServiceNameMap[repoName] ?? repoName;
}
