export const REDMINE_ISSUE_URL = 'https://task.daou.co.kr/issues/';

/**
 * 코드에서 유지하는 특수 동작 항목(일감 번호 입력 프롬프트 등).
 * quick_links 테이블에 같은 이름의 그룹이 있으면 해당 그룹의 DB 링크 뒤에 병합된다.
 */
export const SPECIAL_QUICK_LINKS = {
	Redmine: [{ name: '일감', prompt: true }]
};
