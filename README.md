# rimi-tools

효율적인 업무 보조를 위한 사내 도구 모음 프로젝트입니다. Svelte 5와 Netlify 환경을 기반으로 구축되었습니다.

## 🚀 기술 스택

- **Frontend**: [Svelte 5](https://svelte.dev/) (Runes 사용), [SvelteKit](https://kit.svelte.dev/)
- **UI/Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [daisyUI v5](https://daisyui.com/)
- **Backend/DB**: [Supabase](https://supabase.com/)
- **Deployment**: [Netlify](https://www.netlify.com/) (Functions)
- **Tooling**: Vite, ESLint, Prettier, Playwright, Vitest

## 📂 프로젝트 구조

- `src/routes/`: 각 도구의 페이지 엔드포인트
  - `statusBoard/`: 개발/검수 장비 사용 현황판
  - `sentenceCompletion/`: 배포 예정 현황 · 메신저 문구 · 일일 점검 양식
  - `redmine/`: L4 / 배포 / 코멘트 / DB 업무 요청 양식
  - `etc/`: 비밀번호 모음집
- `src/lib/config/tools.js`: **도구 레지스트리.** 사이드바 · 홈 카드 · ⌘K 팔레트 · 페이지 헤더가
  모두 이 파일 하나를 바라본다. 도구를 추가·수정할 때는 여기에만 등록하면 된다.
- `src/lib/components/`: 공통 컴포넌트
  - `ToolPage` / `ToolHeader`: 모든 도구 페이지의 헤더와 폭 규격
  - `ResultPanel`: 생성기 도구의 결과 패널(제목/본문 + 복사 + 미리보기)
  - `ServerStatusBoard`: 개발/검수 현황판 공용 (env_type 만 다름)
  - `Icon`: 외부 라이브러리 없는 stroke 아이콘 모음
  - `layout/`: 사이드바 · 상단바 · 커맨드 팔레트 · 바로가기 링크
- `src/lib/stores/`: 전역 상태 (`common.js` 토스트, `favorites.js`, `quickLinks.js`)
- `netlify/functions/`: URL Shortener
- `sql/`: 데이터베이스 설정을 위한 SQL 스크립트

## 🛠️ 로컬 개발 환경 구축

이 프로젝트는 Netlify CLI를 사용하여 로컬에서 Functions 및 환경 변수를 시뮬레이션합니다.

### 1. 필수 요소 설치

- Node.js (LTS 권장)
- Netlify CLI: `npm install -g netlify-cli`

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 값을 입력합니다. (Supabase URL, Key)

```bash
cp .env.example .env
```

### 4. 로컬 서버 실행

Netlify CLI를 통해 실행하면 Functions와 Vite 개발 서버가 함께 구동됩니다.

```bash
# 기본 Vite 개발 서버 (포트 5173)
npm run dev

# Netlify 환경 시뮬레이션 (포트 8888) - 추천
netlify dev
```

## 🧪 테스트 및 품질 관리

- **Lint/Format**: `npm run lint` / `npm run format`
- **Unit Test**: `npm run test:unit`
- **E2E Test**: `npm run test:e2e`
