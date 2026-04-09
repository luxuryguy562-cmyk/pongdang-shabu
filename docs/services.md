# 외부 서비스 / 배포 정보

> URL·키·서비스 변경 시 이 파일 즉시 업데이트.
> 코드에서 해당 값이 어디 있는지 `위치` 컬럼 참조.

---

## 서비스 목록

| 서비스 | URL / 값 | 위치 (index.html 변수) | 비고 |
|--------|----------|----------------------|------|
| **Supabase** | `https://ruytgygjwnbtzmtofopg.supabase.co` | `SUPABASE_URL` | DB + REST API |
| **Supabase Key** | `sb_publishable_7QoW2WkSQE4WA4w7uFughA_GXQMkMUe` | `SUPABASE_ANON_KEY` | anon key (RLS 비활성) |
| **Gemini 프록시** | `https://gemini-proxy.luxuryguy562.workers.dev` | `GEMINI_URL` | 영수증/POS AI용. 2026-04 기준 500 에러 |
| **XLSX 라이브러리** | `cdn.jsdelivr.net/npm/xlsx@0.18.5` | `<script>` 태그 | 엑셀 파싱용 |
| **Chart.js** | `cdn.jsdelivr.net/npm/chart.js@4.4.0` | `<script>` 태그 | 대시보드 차트 |

## 배포 정보

| 항목 | 값 |
|------|---|
| **플랫폼** | Cloudflare Pages |
| **도메인** | `pongdang-shabu.pages.dev` |
| **배포 브랜치** | `main` (push 시 자동 배포) |
| **레포** | `luxuryguy562-cmyk/pongdang-shabu` |
| **CSP 주의** | inline 이벤트 핸들러 차단됨 → addEventListener 사용 (→ dev_lessons.md #1) |

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
