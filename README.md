# rimi-tools

효율적인 업무 보조를 위한 사내 도구 모음 프로젝트입니다. Svelte 5와 Netlify 환경을 기반으로 구축되었습니다.

## 🚀 기술 스택

- **Frontend**: [Svelte 5](https://svelte.dev/) (Runes 사용), [SvelteKit](https://kit.svelte.dev/)
- **UI/Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [daisyUI v5](https://daisyui.com/)
- **Backend/DB**: [Supabase](https://supabase.com/)
- **Deployment**: [Netlify](https://www.netlify.com/) (Functions, Edge Functions)
- **Tooling**: Vite, ESLint, Prettier, Playwright, Vitest

## 📂 프로젝트 구조

- `src/routes/`: 각 도구의 페이지 엔드포인트
  - `redmine/`: Redmine 코멘트 생성, DB/배포/L4 요청 폼
  - `statusSharing/`: 개발/스테이징 서버 상태 공유 폼
- `src/lib/`: 공통 컴포넌트, 스토어, 유틸리티 및 Supabase 클라이언트
- `netlify/`: Netlify Functions 및 Edge Functions (IP 제한, URL Shortener 등)
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
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 값을 입력합니다. (Supabase URL, Key 등)
```bash
cp .env.example .env
```

### 4. 로컬 서버 실행
Netlify CLI를 통해 실행하면 Functions와 Vite 개발 서버가 함께 구동됩니다.
```bash
# 기본 Vite 개발 서버 (포트 5173)
npm run dev

# Netlify 환경 시뮬레이션 (포트 8888) - 추천
npm run dev:netlify
```

## 🧪 테스트 및 품질 관리

- **Lint/Format**: `npm run lint` / `npm run format`
- **Unit Test**: `npm run test:unit`
- **E2E Test**: `npm run test:e2e`
