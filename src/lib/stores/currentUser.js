import { browser } from '$app/environment';
import { USER_NAMES } from '$lib/config/users.js';

/**
 * 접속 IP로 추정한 "나". 담당자/점검자 기본값을 채우는 용도다.
 * 페이지마다 호출해도 요청은 한 번만 나가도록 결과를 캐시한다.
 */
let pending = null;

export function resolveCurrentUser() {
	if (!browser) return Promise.resolve('');
	pending ??= fetch('/api/whoami')
		.then((res) => (res.ok ? res.json() : null))
		.then((data) => (USER_NAMES.includes(data?.name) ? data.name : ''))
		.catch(() => ''); // 실패하면 기존 기본값 유지
	return pending;
}
