# 외부 서비스 / 배포 정보

> URL·키·서비스 변경 시 이 파일 즉시 업데이트.
> 코드에서 해당 값이 어디 있는지 `위치` 컬럼 참조.

---

## 서비스 목록

| 서비스 | URL / 값 | 위치 (index.html 변수) | 비고 |
|--------|----------|----------------------|------|
| **Supabase** | `https://ruytgygjwnbtzmtofopg.supabase.co` | `SUPABASE_URL` | DB + REST API |
| **Supabase Key** | `sb_publishable_7QoW2WkSQE4WA4w7uFughA_GXQMkMUe` | `SUPABASE_ANON_KEY` | anon key (RLS 1차 활성 — Phase 2b 2026-04-17, USING true + WITH CHECK store_id) |
| **Gemini 프록시** | `https://gemini-proxy.luxuryguy562.workers.dev` | `GEMINI_URL` | 영수증/POS AI용. 2026-04 기준 500 에러 |
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
| **업솔루션 크롤러** | — | 매출 자동 수집 | `upsolution-crawler.js` |

## 매장 정보

| 항목 | 값 |
|------|---|
| **Store ID** | `4ae03341-e5dc-4933-b746-29728cbc685f` |
| **매장명** | 퐁당샤브 논산점 |
