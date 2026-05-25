# CTO 도구 사용 가이드

> 매 세션 시작 시 `session-start.sh` hook이 환경 자가 점검 결과를 박음.
> 이 가이드는 그 도구를 **어떻게 사용할지** 박힌 규칙.

---

## 🚨 절대 규칙 (헌법 1-7-B)

**"없다", "한계다", "불가능" 단정 금지.**
시도 안 해본 상태에서 단정 → 헌법 1-7 추측 금지 위반 + 사장님 부담 떠넘김 빙산.

자가 점검 결과(`session-start.sh` 출력) 본 후:
- 도구 있으면 → **시도 후 결과 보고**
- 도구 없으면 → **MCP 또는 우회 방법 찾기**
- 다 안 되면 → "X·Y·Z 시도했고 다 안 됨" 정직 보고 (그제서야 "한계" 박기)

---

## 🔧 도구별 사용 표준 절차

### Playwright (자동 화면 테스트)

**용도**: 코드 변경 후 화면이 깨졌는지 자동 검증.
**위치**: `/opt/node22/lib/node_modules/playwright`
**런타임**: `require('/opt/node22/lib/node_modules/playwright')` (글로벌 모듈)

**기본 검증 스크립트 (Mock CDN 우회 포함)**:
```javascript
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // 외부 CDN 차단 우회 — Mock 라이브러리 박음
  await context.route('**/cdn.jsdelivr.net/**', route => {
    const url = route.request().url();
    if (url.includes('supabase-js')) {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: `
        window.supabase = { createClient: () => ({
          from: () => ({ select: () => ({ eq: () => ({ data:null, error:null }), data:null, error:null }), insert: async()=>({}), update: async()=>({}), delete: async()=>({}) }),
          auth: { signInWithPassword: async()=>({data:null,error:null}), signOut: async()=>({error:null}) },
          storage: { from: () => ({ upload: async()=>({}), getPublicUrl: ()=>({data:{publicUrl:''}}) }) },
          channel: () => ({ on: ()=>{}, subscribe: ()=>{} }),
        })};
      `});
    } else if (url.includes('xlsx')) {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.XLSX = {utils:{}, read:()=>{}, write:()=>{}};` });
    } else if (url.includes('chart.js')) {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.Chart = function(){this.update=()=>{};this.destroy=()=>{};};` });
    } else if (url.includes('Sortable')) {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.Sortable = function(){this.destroy=()=>{};};` });
    } else {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mock */' });
    }
  });
  await context.route('**/sentry-cdn.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.Sentry = {init:()=>{}, captureException:()=>{}};` });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  await page.goto(`file://${path.resolve('index.html')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 검증할 함수·DOM 박기
  const result = await page.evaluate(() => ({
    // 예: fmt 함수 호출
    fmtTest: typeof fmt === 'function' ? fmt(12345) : 'MISSING',
    // 예: 핵심 셀렉터 존재
    headerExists: !!document.querySelector('.header'),
  }));

  console.log(result);
  console.log('에러:', errors.length === 0 ? '없음' : errors);

  await page.screenshot({ path: '/tmp/check.png' });
  await browser.close();
})();
```

### Supabase MCP (DB 접근)

**용도**: DB 표 구조 확인·SELECT·SQL 실행.
**🔴 안전 규칙**: 헌법 8조-A 준수 (3색 신호등 + "실행 승인" 4글자).
**기본 절차**:
1. `list_tables` 먼저 (표 구조 확인)
2. SELECT는 자율 OK
3. INSERT/UPDATE/DELETE는 사장님 "실행 승인" 4글자 명시 필요
4. DDL(CREATE/ALTER/DROP)은 절대 자동 금지

### GitHub MCP

**용도**: PR 생성·머지·이슈 관리.
**🟢 자율 OK**:
- `create_pull_request`, `merge_pull_request` (헌법 1-2 사장님 권한 위임)
- `get_file_contents`, `list_pull_requests`
**🔴 제약**: `luxuryguy562-cmyk/pongdang-shabu` repo만 (다른 repo 시도 금지)

### Sentry / Cloudflare / Slack MCP

**용도**: 에러 로그 / 배포 / 알림
**🟢 자율 OK**: 조회 도구만
**🟡 사장님 확인**: 설정 변경

### curl / Python / Node / Bash 도구

**용도**: 자체 스크립트, 검증, 분석
**🟢 자율 OK**

---

## 🌐 외부 호스트 차단 대응

`session-start.sh` 출력에서 ❌ 박힌 호스트:
- `cdn.jsdelivr.net` → **Playwright Mock 우회** (위 스크립트 참조)
- `pongdang-shabu.pages.dev` → 실제 배포 검증 불가, 로컬 `file://` + Mock으로 검증
- `api.github.com` → **GitHub MCP 도구로 우회**

---

## 📋 매 작업 시작 자가 자문

1. 이 작업 검증에 어떤 도구 필요? (`session-start.sh` 결과 확인)
2. 그 도구 환경에 있나? (있으면 시도, 없으면 우회 찾기)
3. "없다" 단정 전에 다 시도했나?
4. 사장님 부담 떠넘기는 답이 아닌가?

---

## 옛 빙산 사례 (반복 방지)

| 시점 | CTO 실수 | 진실 |
|---|---|---|
| Phase 1 검증 | "CTO 환경 한계, 사장님 눈만 가능" | Playwright 있었음 (1.56.1) |
| cert 우회 | 처음엔 "샌드박스 차단" | Mock 우회 가능했음 |

→ 둘 다 자가 점검 의무 누락. 본 가이드 + `session-start.sh` 박힌 후 자동 인지.
