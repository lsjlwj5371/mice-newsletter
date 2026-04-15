# MICE Newsletter Admin

내부용 뉴스레터 운영 웹. RSS 자료를 Claude가 분석하고, 관리자가 미리보기·자연어 편집 후 Gmail로 발송하는 시스템.

## 스택

- **Framework**: Next.js 15 (App Router) + TypeScript
- **DB / Auth**: Supabase (Postgres + Auth 매직링크)
- **Styling**: Tailwind CSS
- **Email send**: Gmail API (`googleapis`) — Phase 5
- **LLM**: Anthropic Claude API — Phase 3+
- **Hosting**: Vercel (Hobby)

## 로컬 개발 시작하기

### 1. 의존성 설치
```bash
pnpm install
```

### 2. 환경변수 설정
`.env.example`을 복사해서 `.env.local`을 만든 뒤 값을 채웁니다.
```bash
copy .env.example .env.local   # Windows
# 또는
cp .env.example .env.local     # macOS/Linux
```

필요한 값:
- **Supabase**: 프로젝트 대시보드 → Settings → API
- **Google OAuth**: Google Cloud Console에서 발급한 client id/secret + OAuth Playground에서 발급한 refresh token
- **Anthropic**: console.anthropic.com → API Keys
- **TOKEN_SECRET, CRON_SECRET**: `openssl rand -hex 32` 또는 PowerShell `[System.BitConverter]::ToString((1..32 | %{Get-Random -Min 0 -Max 256})).Replace('-','').ToLower()`

### 3. Supabase 마이그레이션 실행
Supabase 대시보드 → SQL Editor → 새 쿼리 → `supabase/migrations/0001_init.sql` 내용 붙여넣기 → Run.
같은 방식으로 `0002_rls.sql`도 실행.

### 4. 개발 서버 실행
```bash
pnpm dev
```
브라우저에서 http://localhost:3000 열기 → `/login` 으로 자동 이동 → 매직링크 발송 → 메일 클릭 → 대시보드 진입.

## 배포 (Vercel)

1. https://vercel.com/new → GitHub `lsjlwj5371/mice-newsletter` import
2. Framework preset: Next.js (자동 감지)
3. **Environment Variables** 탭에서 `.env.example` 의 모든 키를 Production + Preview에 등록
4. Deploy
5. 배포 완료 후 `NEXT_PUBLIC_APP_URL`을 실제 배포 URL(예: `https://mice-newsletter.vercel.app`)로 업데이트하고 재배포

## Phase 진행 상황

- ✅ **Phase 0**: 사전 계정·OAuth 셋업
- 🚧 **Phase 1**: 프로젝트 스캐폴드 + 관리자 인증 (현재)
- ⏳ **Phase 2**: 수신자 & 구독 관리
- ⏳ **Phase 3**: RSS 수집 + Claude 분석
- ⏳ **Phase 4**: 뉴스레터 스튜디오 (미리보기 + 자연어 편집)
- ⏳ **Phase 5**: 발송 파이프라인 (Gmail API)
- ⏳ **Phase 6**: 히스토리 + 다시 보내기
- ⏳ **Phase 7**: 이벤트 + 의견 수집
- ⏳ **Phase 8**: 하드닝
