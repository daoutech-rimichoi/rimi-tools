import { json } from '@sveltejs/kit';
import { getUserByIp } from '$lib/config/users.js';

/**
 * 접속 IP로 담당자를 추정한다. 브라우저는 자기 IP를 알 수 없어 서버가 알려줘야 한다.
 * 사내 IP 명단(users.js)에 없으면 name 은 null 이고, 화면은 기존 기본값을 그대로 쓴다.
 * 인증 수단이 아니라 입력 편의 기능이다.
 */
// 루트 레이아웃의 prerender=true 를 상속하면 빌드 시점 IP 가 굳어버린다. 항상 요청 시점에 실행.
export const prerender = false;

export function GET({ getClientAddress }) {
	const ip = getClientAddress();
	return json({ name: getUserByIp(ip)?.name ?? null });
}
