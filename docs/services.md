# 외부 서비스 / 배포 정보

> URL·키·서비스 변경 시 이 파일 즉시 업데이트.
> 코드에서 해당 값이 어디 있는지 `위치` 컬럼 참조.

---

## 서비스 목록

| 서비스 | URL / 값 | 위치 (index.html 변수) | 비고 |
|--------|----------|----------------------|------|
| **SOLAPI(문자)** | `https://api.solapi.com/messages/v4/send` | Edge Function 환경변수 `SOLAPI_API_KEY`/`SOLAPI_API_SECRET`/`SOLAPI_SENDER` | 직원 문자 인증(OTP). 계정명 '김은성님의 계정', 발신번호 010-5242-1260(인증완료, 만료 2026-12-09). HMAC-SHA256 인증. 2026-06-09 실발송 테스트 성공. 키는 Supabase Edge Function Secrets에 저장(레포 커밋 X) |
| **Supabase** | `https://ruytgygjwnbtzmtofopg.supabase.co` | `SUPABASE_URL` | DB + REST API |
| **Supabase Key** | `sb_publishable_7QoW2WkSQE4WA4w7uFughA_GXQMkMUe` | `SUPABASE_ANON_KEY` | anon key (RLS 1차 활성 — Phase 2b 2026-04-17, USING true + WITH CHECK store_id) |
| **AI 프록시** (구 Gemini) | `https://gemini-proxy.luxuryguy562.workers.dev` | `GEMINI_URL` | **2026-05-19부터 Multi-Provider** (Clova+GPT / GPT / Gemini). 이름은 호환 유지. body._provider로 분기. |
| **Naver Clova OCR** | `xxxxxxxxxx.apigw.ntruss.com/custom/v1/.../general` | Worker `env.CLOVA_URL` | 한국 영수증·세금계산서 OCR 1위. **API Gateway 자동 연동 필수** (수동 연동 URL은 외부 호출 차단, dev_lessons #96). 도메인명 `cashflow-receipt`. Premium 플랜. |
| **Naver Clova OCR Secret** | (Secret Key) | Worker `env.CLOVA_SECRET` | 자동 연동 화면에서 생성된 키 (Domain Secret과 별개). 헤더 `X-OCR-SECRET`. |
| **OpenAI GPT-4o** | `https://api.openai.com/v1/chat/completions` | Worker `env.OPENAI_KEY` | GPT-4o (정확도) / GPT-4o-mini (직구·POS 저렴). 영수증 1장 ~5~10원 (full) / ~1원 (mini). |
| **Gemini API** | `https://generativelanguage.googleapis.com/v1beta/models/...` | Worker `env.GEM_ES_KEY` | 폴백용. gemini-2.5-flash / gemini-2.5-flash-lite. |
| **XLSX 라이브러리** | `cdn.jsdelivr.net/npm/xlsx@0.18.5` | `<script>` 태그 | 엑셀 파싱용 |
| **Chart.js** | `cdn.jsdelivr.net/npm/chart.js@4.4.0` | `<script>` 태그 | 대시보드 차트 |
| **SortableJS** | `cdn.jsdelivr.net/npm/sortablejs@1.15.0` | `<script>` 태그 | 카테고리 드래그 정렬 (모바일 터치 지원) |

## 배포 정보

| 항목 | 값 |
|------|---|
| **플랫폼** | Cloudflare Pages |
| **운영 도메인** | `pongdang-shabu.pages.dev` (main 브랜치) |
| **테스트 미리보기** | `<branch>.pongdang-shabu.pages.dev` (claude/* 등 비-main 브랜치 자동 생성) |
| **배포 브랜치** | `main` (push 시 자동 배포) |
| **레포** | `luxuryguy562-cmyk/pongdang-shabu` |
| **CSP 주의** | inline 이벤트 핸들러 차단됨 → addEventListener 사용 (→ dev_lessons.md #1) |

### 테스트 → 운영 흐름 (2026-05-06 결정)
1. claude/<task> 브랜치에 push
2. 1~2분 후 자동 미리보기 URL 생성 (`<branch>.pongdang-shabu.pages.dev`)
3. 사장님이 미리보기에서 검증
4. OK → main 머지 → 운영 반영
5. 별로 → 미리보기에서 추가 수정 (운영 안전)
6. **DB(Supabase)는 같음** — UI/UX 변경에는 충분, DB 작업 시점에 staging 환경 도입 검토

### Capacitor 전환 대비 자산 (2026-05-06)
| 자산 | 위치 | 용도 |
|---|---|---|
| `icon.svg` | `/icon.svg` | 앱 아이콘 (벡터, Capacitor가 모든 사이즈 자동 변환) |
| `manifest.json` | `/manifest.json` | PWA + 앱스토어 메타 |
| `sw.js` | `/sw.js` | Service Worker (현재 OFF, 안정화 후 재도입) |
| `<meta theme-color>` | `index.html` head | iOS 상태바·앱스토어 splash 색 |
| `safe-area-inset` CSS | `.header`, `.bottom-nav` | iOS 노치/홈 인디케이터 자동 회피 |

### Phase 1 끝 후 안드 네이티브 진입 자산 (2026-05-24 사장님 정정)
> ⚠️ **2026-05-24 정정**: Capacitor 1~2주 작업은 Phase 1 PoC 완성 후로 미룸. 지금 수식 정확성 우선.

| 자산 | 상태 | 시점 |
|---|---|---|
| **Capacitor 6.x 래핑** (npm install + android 폴더) | ⏸️ 미래 | **Phase 1 PoC 완성 직후** (베타 직전) |
| **Capacitor Community SMS Plugin** (`@capacitor-community/sms-receive`) | ⏸️ 미래 | Capacitor 진입과 동시 |
| **Google Play 개발자 계정** ($25 1회) | 🔴 미래 사장님 결정 | 베타 배포 전 |
| **SMS 권한 정당화 문서** (Google Play 정책) | ⏸️ 미래 | Play Store 등록 시 |
| **Gmail API OAuth Client ID** | ⏸️ Phase 2 | Phase 2 진입 시 |
| **POS API 자동 동기화** (`upsolution-crawler.js` 강화) | ⏳ **Phase 1 안 가능** | PWA에서 가능 |
| **iOS 진입** | ⏸️ Phase 2+ | 이메일·POS만 |

## Supabase MCP (Claude 자동화, 2026-05-17)

| 항목 | 값 |
|------|---|
| **설정 파일** | `.mcp.json` (레포 루트) |
| **MCP 서버 패키지** | `@supabase/mcp-server-supabase@latest` (npx 자동 실행) |
| **모드** | `--read-only` (조회 전용, 쓰기 차단) |
| **프로젝트 한정** | `--project-ref=ruytgygjwnbtzmtofopg` (퐁당샤브 전용) |
| **인증 방식** | Personal Access Token, 환경변수 `SUPABASE_ACCESS_TOKEN` 참조 |
| **토큰 등록 위치** | 데스크탑 클로드 → "기본값" 클라우드 환경 → 환경 변수 (사장님 본인만) |
| **토큰 폐기** | https://supabase.com/dashboard/account/tokens → Revoke |
| **쓰기 모드 전환** | `.mcp.json`에서 `--read-only` 제거 + 계획서/승인 (헌법 8조) |

> ⚠️ 토큰은 GitHub 레포에 절대 커밋 X — `.mcp.json`은 `${SUPABASE_ACCESS_TOKEN}` 참조만 함.

## Cloudflare Workers

| 워커 | URL | 용도 | 파일 |
|------|-----|------|------|
| **Gemini 프록시** | `gemini-proxy.luxuryguy562.workers.dev` | Gemini API 중계 | (별도 레포) |

> **gemini-proxy worker 상태 (2026-06-10 롤백)**: 6/9 15:25 "생각기능(thinking) 켜기" 배포 후부터 Gemini 전체가 `User location is not supported`(한국 위치 차단) 400 오류 → 영수증 분석 전체 다운. **5/19 정상 버전(version_id `eeebdb0a-301e-45f4-880b-28d6b7079543`)으로 롤백**(deployment 5f3ec012)해서 복구. 롤백 방법: `POST .../workers/scripts/gemini-proxy/deployments` body `{"strategy":"percentage","versions":[{"version_id":"...","percentage":100}]}` (CLOUDFLARE_API_TOKEN env). thinkingBudget:0 (thinking 영구 OFF — 한국 차단). 코드 GET은 `api.cloudflare.com` 통과(workers.dev 실행 엔드포인트만 샌드박스 차단).
> **옛 상태 (2026-06-09, 무효)**: `thinkingBudget: 0` (한국 location 차단으로 thinking OFF — dev_lessons #201). placement: `smart` (원래 targeted[94]였으나 배포 중 날아가 복원 불가). secret 4개: CLOVA_SECRET·CLOVA_URL·GEM_ES_KEY·OPENAI_KEY. 배포: Cloudflare API 토큰(env) + `curl PUT` multipart + `keep_bindings:["secret_text","plain_text"]`. 현재 배포 코드 백업: 다음 세션 위해 worker 별도 레포 또는 docs/worker_v6_snippet.js 참조.
| **업솔루션 크롤러** | — | 매출 자동 수집 | `upsolution-crawler.js` |

## 매장 정보

| 항목 | 값 |
|------|---|
| **Store ID** | `4ae03341-e5dc-4933-b746-29728cbc685f` |
| **매장명** | 퐁당샤브 논산점 |
