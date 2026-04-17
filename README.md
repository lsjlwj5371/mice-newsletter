# MICE Newsletter Admin

MICE 업계용 월간/격주 뉴스레터를 RSS 자동 수집 → Claude 분석·초안 생성 → 관리자 감수 → Gmail 발송까지 한 번에 운영하는 내부 툴.

---

## 스택

- **Framework**: Next.js 15 (App Router, typedRoutes) + TypeScript
- **UI**: Tailwind + shadcn/ui, React Email
- **DB / Auth / Storage**: Supabase (Postgres + Auth 매직링크 + Storage)
- **LLM**: Anthropic Claude (Sonnet 4.5 분석, Haiku 4.5 초안 생성)
- **Send**: Gmail API (`googleapis`) + OAuth2 refresh token
- **Scheduler**: Vercel Cron (Hobby — 일 1회 해상도)
- **Hosting**: Vercel

---

## 디렉토리 한눈에

```
src/
  app/
    (admin)/
      dashboard /newsletters /recipients /articles /rss
      history   /events     /audit       /settings
    (auth)/login
    api/
      cron/          ← collect-articles / send-queue / bounce-scan
                       image-cleanup / backup
      uploads/image  ← 이미지 업로드 (Supabase Storage)
      unsubscribe/[token]  ← RFC 8058 One-Click
    t/open/[token]   ← 오픈 트래킹 픽셀
    t/click/[token]  ← 클릭 래퍼
    u/[token]        ← 구독 해지 확인 페이지
    r/[token]        ← 추천 가입 (더블 옵트인)
    f/[token]        ← 독자용 공개 폼
  emails/            ← React Email 템플릿 (블록 단위 구성)
  lib/
    claude/          ← 기사 분석 + 블록별 초안 생성
    gmail/           ← MIME 빌더 + 바운스 스캔
    supabase/        ← client/server/admin Supabase 클라이언트
    validation/      ← zod 스키마 (블록/폼)
    audit.ts         ← 감사 로그 쓰기
    send-queue.tsx   ← 발송 큐 워커 (이미지 인라인 포함)
    tokens.ts        ← HMAC 서명 토큰 (u/o/c)
supabase/migrations/ ← 0001 ~ 0012 순차 실행
```

---

## 1. 최초 셋업

### 1.1 로컬
```bash
pnpm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
pnpm dev                      # http://localhost:3000
```

### 1.2 환경변수 (`.env.local`, Vercel도 동일 키)
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 프로젝트 → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 곳, service_role (서버에서만 사용) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 클라이언트 (Web) |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground → `gmail.send` + `gmail.readonly` 스코프로 발급 |
| `GOOGLE_SENDER_EMAIL` / `GOOGLE_SENDER_NAME` | 실제 발송 From (`groundk21@gmail.com`) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NEXT_PUBLIC_APP_URL` | 로컬: `http://localhost:3000`, 배포: `https://mice-newsletter.vercel.app` |
| `TOKEN_SECRET` | HMAC 서명. `openssl rand -hex 32` |
| `CRON_SECRET` | Vercel Cron 인증 Bearer. `openssl rand -hex 32` |
| `ADMIN_ALLOWLIST` | 쉼표 구분 이메일. 로그인 허용 목록 |

### 1.3 Supabase
1. SQL Editor → `supabase/migrations/0001_init.sql`부터 `0012_forms.sql`까지 **순서대로** 실행
2. Storage 버킷 두 개 수동 생성:
   - `newsletter-images` (Public) — 본문 이미지용. 0009 마이그레이션이 자동 생성
   - `db-backups` (Private) — 일일 DB 스냅샷. 백업 cron이 없으면 자동 생성하지만, 수동으로 만들어도 무방
3. Auth → URL Configuration → Site URL / Redirect URL에 배포 URL 추가

### 1.4 Google OAuth
- 최초에는 Testing 모드로 운영 (refresh token 7일 만료 주의)
- 안정화되면 Publishing status → **Production**으로 전환 (현재 프로젝트는 이미 Production)

### 1.5 Vercel
- GitHub 연결 → 환경변수 등록 → Deploy
- `vercel.json`의 4개 cron + 백업 cron이 자동 등록됨

---

## 2. 일일·정기 운영

### 2.1 Cron (UTC 기준, Vercel Hobby는 일 1회 해상도)
| 시각 (UTC → KST) | Path | 역할 |
|---|---|---|
| 19:30 → 04:30 | `/api/cron/backup` | 전체 테이블 JSON 스냅샷을 `db-backups` 버킷에 업로드, 30일 지난 스냅샷 삭제 |
| 20:00 → 05:00 | `/api/cron/collect-articles` | RSS 전체 피드 수집 + Claude 분석 |
| 21:00 → 06:00 | `/api/cron/send-queue` | 예약 발송 큐 드레이닝 (60초 데드라인, 한 번에 약 50건) |
| 22:00 → 07:00 | `/api/cron/bounce-scan` | Gmail 받은편지함에서 바운스 메일 파싱 → 자동 해지 |
| 23:00 → 08:00 | `/api/cron/image-cleanup` | 7일 이상 지나고 이미 인라인된 Storage 이미지 원본 삭제 |

### 2.2 수동 호출
```bash
# Bearer 인증 필요. Vercel 배포 URL 기준
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://mice-newsletter.vercel.app/api/cron/backup
```
응답에 각 테이블의 `{ count, truncated }` 요약이 포함됩니다.

### 2.3 뉴스레터 제작 플로우
1. **RSS 피드 등록** `/rss` — URL + 카테고리(news/mice_in_out/tech/theory)
2. **후보 기사 확인** `/articles` — 수집 결과가 쌓이면 new / pinned 플래그 관리
3. **새 호 만들기** `/newsletters/new` — 블록 기반 초안 생성(블록별 Claude 병렬 호출)
4. **편집 및 감수** `/newsletters/[id]` — 블록 추가/삭제/재생성, 이미지 업로드
5. **테스트 발송** — 본인 이메일로 확인
6. **즉시 발송 또는 예약** — 예약은 Hobby 특성상 ±24h 드리프트 가능 (정밀 시각이 필요하면 cron-job.org 또는 Vercel Pro 전환)
7. **히스토리·재발송** `/history` — 미오픈·실패·지정 대상만 재발송

### 2.4 구독 관리
- 수신자는 `/recipients`에서 추가/해지
- 뉴스레터 본문에는 RFC 8058 One-Click 해지 헤더가 자동 포함
- 사용자가 해지 링크 클릭 시 `/u/[token]` 확인 페이지 → 바로 `unsubscribed` 전환
- 추천 가입은 `/r/[referrerId]` 링크 공유 → 더블 옵트인 확인 메일

### 2.5 감사 로그 `/audit`
- 모든 관리자 행동(뉴스레터 생성/발송, 수신자 편집, 피드 수정, 로그인 등)이 기록
- 기간(1/7/30/90일), action 부분일치, entity, 관리자 이메일로 필터 가능
- metadata는 펼치면 전체 JSON 확인 가능

---

## 3. 트러블슈팅

### 3.1 `Gmail API has not been used in project ...`
Google Cloud Console → API & Services → Library → Gmail API → Enable.

### 3.2 OAuth refresh token 만료
Testing 모드는 7일. 재발급: OAuth Playground에서 같은 scope로 재획득 후 `GOOGLE_REFRESH_TOKEN` 갱신. 장기 운영은 Production 전환 필수.

### 3.3 발송이 안 가는 것 같다
1. `/history` → 해당 호 → send 로그에 status 확인
2. `sends.error_message`에 Gmail API 원본 에러가 담김
3. 개별 수신자가 `bounced`면 자동 해지된 상태 — 재활성화는 Supabase에서 직접 status 변경

### 3.4 Vercel 함수 타임아웃
- 현재 모든 cron은 `maxDuration=60`
- 발송 큐는 55초 데드라인 후 다음 cron에서 이어받도록 설계
- 백업이 60초를 초과하면 `sends`/`audit_logs` 기간을 줄이세요 (`src/app/api/cron/backup/route.ts` 상단 `TABLES` 배열)

### 3.5 DB 복원
1. Supabase Storage → `db-backups` → 원하는 날짜의 JSON 다운로드
2. 필요한 테이블 섹션만 `INSERT ... ON CONFLICT DO UPDATE`로 SQL Editor에서 실행
3. `articles` 테이블은 백업 대상이 아니므로 `/api/cron/collect-articles` 수동 호출로 재수집

### 3.6 Storage 이미지가 이메일에서 깨진다
- 발송 시 `inlineStorageImages`가 base64 data URI로 치환함
- 총 400KB 초과 시 원본 URL로 폴백 (Gmail 캐시로도 보통 문제 없음)
- 7일 지나 이미지 원본이 삭제되었더라도, 이미 발송된 메일은 base64라서 무관

---

## 4. 확장 시 참고

### 4.1 새 블록 타입 추가
1. `src/lib/validation/block.ts`에 discriminated union 확장
2. `src/emails/`에 해당 컴포넌트 + `newsletter.tsx`의 switch에 등록
3. `src/lib/claude/draft-*.ts`에 전용 프롬프트 추가
4. `/newsletters/new` 블록 피커에 표시

### 4.2 새 관리자 추가
`ADMIN_ALLOWLIST`에 이메일 추가 → 해당 이메일로 `/login` → 매직링크 클릭. 첫 로그인 시 `auth/callback`이 `admins` 행을 자동 생성합니다. 역할(`owner/editor/viewer`)은 Supabase Table Editor에서 수정.

### 4.3 Gmail 일 500통 한도 관리
- 개인 Gmail 한도는 하루 500통
- 기존 Apps Script weekly briefing과 동일 계정 사용 중이면 합산 모니터링 필요
- 한도 상향이 필요하면 Google Workspace 유료 플랜(2,000통/일)으로 전환

---

## 5. Phase 진행 상황

- Phase 0 — 사전 계정·OAuth 셋업
- Phase 1 — 스캐폴드 + 관리자 인증
- Phase 2 — 수신자 & 구독 관리
- Phase 3 — RSS 수집 + Claude 분석
- Phase 4 — 뉴스레터 스튜디오 (블록 기반)
- Phase 5 — 발송 파이프라인 (Gmail + 트래킹 + 바운스 + 이미지 인라인)
- Phase 6 — 히스토리 + 재발송 + 예약 발송
- Phase 7 — 공개 폼 (이벤트·의견)
- Phase 8 — 하드닝 (감사 로그 UI + DB 일일 백업)

운영 중 필요한 개선은 이슈로 쌓아가며 대응합니다.
