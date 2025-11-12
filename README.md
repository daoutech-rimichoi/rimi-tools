# Rimi Tools

SvelteKit 기반의 웹 애플리케이션으로, Jira 댓글, 배포 요청서 등 개발 과정에서 필요한 다양한 텍스트 생성을 자동화하여 생산성을 높이는 것을 목표로 하는 도구 모음입니다.

## ✨ 주요 기능

- **Jira 댓글 생성기**: 개발 공수 및 일정, 개발 완료 보고 등 표준화된 Jira 댓글을 손쉽게 생성합니다.
  - TC 링크를 위한 URL 단축 기능이 포함되어 있습니다.
- **배포 요청서 생성기**: 정해진 양식에 맞춰 배포 요청서를 작성합니다.
- **배포 상태 공유 양식**: 배포 진행 상황을 공유하기 위한 메시지를 생성합니다.
- **L4 요청서 생성기**: L4 스위치 설정 요청 양식을 생성합니다.

## 🛠️ 기술 스택

- **프레임워크**: [SvelteKit](https://kit.svelte.dev/)
- **UI**: [Tailwind CSS](https://tailwindcss.com/), [DaisyUI](https://daisyui.com/)
- **빌드 도구**: [Vite](https://vitejs.dev/)
- **테스팅**: [Vitest](https://vitest.dev/) (유닛 테스트), [Playwright](https://playwright.dev/) (E2E 테스트)
- **배포**: [Netlify](https://www.netlify.com/)
- **코드 품질**: [ESLint](https://eslint.org/), [Prettier](https://prettier.io/)

## 🚀 시작하기

1.  **저장소 복제**
    ```bash
    git clone https://github.com/your-username/rimi-tools.git
    cd rimi-tools
    ```

2.  **의존성 설치**
    ```bash
    npm install
    ```

3.  **개발 서버 실행**
    ```bash
    npm run dev
    ```
    이제 브라우저에서 `http://localhost:5173` (또는 다른 포트)으로 접속하여 애플리케이션을 확인할 수 있습니다.

## 📜 사용 가능한 스크립트

- `npm run dev`: 개발 모드로 애플리케이션을 실행합니다.
- `npm run build`: 프로덕션용으로 애플리케이션을 빌드합니다.
- `npm run preview`: 프로덕션 빌드를 로컬에서 미리 봅니다.
- `npm run test`: 유닛 테스트와 E2E 테스트를 모두 실행합니다.
- `npm run lint`: ESLint로 코드 스타일 문제를 검사합니다.
- `npm run format`: Prettier로 전체 코드 스타일을 통일합니다.

## 🏗️ 아키텍처: URL 단축 기능

URL 단축 기능은 외부 서비스인 [cleanuri.com](https://cleanuri.com/)의 API를 사용하며, 개발 환경과 배포 환경에서 서로 다른 방식으로 API를 호출합니다.

-   **배포 환경 (Netlify)**: CORS(Cross-Origin Resource Sharing) 정책과 보안을 위해 Netlify Functions를 프록시 서버로 사용합니다.
    -   클라이언트(`+page.svelte`)는 프로젝트 내부의 `/.netlify/functions/shorten` 엔드포인트를 호출합니다.
    -   `netlify/functions/shorten.js` 함수가 요청을 받아 `cleanuri.com` API로 전달하고, 결과를 다시 클라이언트에 반환합니다.
-   **개발 환경 (로컬)**: Vite의 내장 프록시 기능을 사용하여 Netlify Functions와 유사한 환경을 구현합니다.
    -   클라이언트는 `/api/shorten` 엔드포인트를 호출합니다.
    -   `vite.config.js`의 `server.proxy` 설정이 이 요청을 가로채 `cleanuri.com` API로 전달합니다.