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

// IP로 사용자 찾기
export function getUserByIp(ip) {
return USERS.find((user) => user.ip === ip);
}

// 이름으로 사용자 찾기
export function getUserByName(name) {
return USERS.find((user) => user.name === name);
}
