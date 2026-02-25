# IP 제한 기능 가이드

이 프로젝트는 SvelteKit Server Hooks를 사용하여 특정 IP 주소에서만 접근 가능하도록 제한하는 기능을 포함하고 있습니다.

## 설정 방법

### 1. Netlify 환경 변수 설정

Netlify 대시보드에서 환경 변수를 설정합니다:

1. Netlify 사이트 대시보드 접속
2. **Site settings** > **Environment variables** 메뉴로 이동
3. **Add a variable** 클릭
4. 다음 정보 입력:
   - **Key**: `ALLOWED_IPS`
   - **Values**: 허용할 IP 주소를 쉼표로 구분하여 입력 (예: `192.168.1.100,203.0.113.50`)
   - **Scopes**: 모든 환경 선택 또는 특정 환경만 선택

### 2. IP 주소 확인 방법

현재 자신의 IP 주소를 확인하려면:
- https://www.whatismyip.com/
- https://ipinfo.io/ip
- 또는 터미널에서: `curl ifconfig.me`

### 3. 로컬 개발 환경

로컬 개발 시에는 `.env` 파일을 사용할 수 있습니다:

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일에 IP 추가
ALLOWED_IPS=YOUR_IP_ADDRESS
```

**주의**: `.env` 파일은 `.gitignore`에 포함되어 있으므로 커밋되지 않습니다.

### 4. 로컬에서 테스트

일반 개발 서버를 사용하여 테스트할 수 있습니다:

```bash
# 로컬 개발 서버 실행
npm run dev
```

**참고**: 로컬 개발 환경에서는 IP가 `::1` (IPv6 localhost) 또는 `127.0.0.1`로 표시될 수 있습니다.

## 동작 방식

1. **SvelteKit Hooks 실행**: 모든 요청은 서버에서 `hooks.server.js`를 통해 처리됩니다.
2. **IP 확인**: 클라이언트의 IP 주소를 헤더에서 추출합니다 (Netlify: `x-nf-client-connection-ip`, 일반: `x-forwarded-for`).
3. **허용 목록 확인**: `ALLOWED_IPS` 환경 변수와 비교합니다.
4. **접근 허용/거부**:
   - 허용: 정상적으로 사이트 표시
   - 거부: 403 에러 페이지 표시 (현재 IP 주소 포함)

## 주의사항

### 환경 변수가 설정되지 않은 경우

`ALLOWED_IPS` 환경 변수가 비어있으면 **모든 접근이 허용**됩니다. 이는 개발 중 실수로 자신을 차단하는 것을 방지하기 위함입니다.

### IP 주소 형식

- IPv4 주소: `123.456.789.0`
- 여러 IP 주소: `192.168.1.100,203.0.113.50`
- 공백은 자동으로 제거됩니다.

### 동적 IP 주소

ISP에서 동적 IP를 할당받는 경우, IP 주소가 변경될 수 있습니다. 이 경우:
- 고정 IP 서비스 사용
- VPN을 통한 고정 IP 사용
- IP 범위 허용 기능 추가 (추가 개발 필요)

## 커스터마이징

### 특정 경로 제외

`src/hooks.server.js` 파일에서 특정 경로를 IP 제한에서 제외할 수 있습니다:

```javascript
export async function handle({ event, resolve }) {
	// 특정 경로는 IP 제한 제외
	if (event.url.pathname.startsWith('/api/') || 
	    event.url.pathname === '/health' ||
	    event.url.pathname.startsWith('/public/')) {
		return await resolve(event);
	}
	
	// ... 기존 IP 제한 로직
}
```

### 접근 거부 페이지 커스터마이징

`src/hooks.server.js` 파일에서 HTML 템플릿을 수정하여 접근 거부 페이지를 커스터마이징할 수 있습니다.

## 문제 해결

### 자신의 IP가 차단되는 경우

1. Netlify 대시보드에서 `ALLOWED_IPS` 환경 변수를 확인
2. 현재 IP 주소를 확인하고 목록에 추가
3. 환경 변수 변경 후 사이트가 자동으로 재배포됩니다 (약 1-2분 소요)

### IP 제한이 작동하지 않는 경우

1. `src/hooks.server.js` 파일이 존재하는지 확인
2. Netlify 배포 로그에서 에러 확인
3. 환경 변수가 올바르게 설정되었는지 확인
4. 로컬 환경에서는 `npm run build` 후 `npm run preview`로 프로덕션 모드 테스트

## 보안 권장사항

1. **환경 변수 사용**: IP 주소를 코드에 하드코딩하지 마세요
2. **최소 권한 원칙**: 필요한 IP만 허용하세요
3. **정기적 검토**: 허용된 IP 목록을 정기적으로 검토하고 업데이트하세요
4. **로그 모니터링**: Netlify 로그를 모니터링하여 비정상적인 접근 시도를 확인하세요
