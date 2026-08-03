// 사용자 정보 설정
export const USERS = [
	{ name: '최경림', ip: '172.21.25.25' },
	{ name: '김준혁', ip: '172.21.24.18' },
	{ name: '김지웅', ip: '172.21.25.57' },
	{ name: '전하라', ip: '172.21.25.37' },
	{ name: '오용상', ip: '172.21.25.48' },
	{ name: '배윤희', ip: '172.21.25.61' },
	{ name: '한수찬', ip: '172.21.25.13' }
];

// 사용자 이름 목록
export const USER_NAMES = USERS.map((user) => user.name);

/**
 * 접속 IP로 사용자를 찾는다. 담당자 자동 선택에만 쓰며, 못 찾으면 undefined.
 * IPv6 매핑(::ffff:1.2.3.4)이나 프록시 체인으로 들어오는 경우도 처리한다.
 */
export function getUserByIp(ip) {
	if (!ip) return undefined;
	const normalized = String(ip)
		.split(',')[0]
		.trim()
		.replace(/^::ffff:/, '');
	return USERS.find((user) => user.ip === normalized);
}
