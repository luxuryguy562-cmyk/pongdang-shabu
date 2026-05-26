/*
  쿠팡 크롤링 가능성 검증 도구 (Phase 2 사전 조사)
  ─────────────────────────────────────────────────────────
  사용법 (사장님 PC에서, 1분 안 끝남)

  1) 크롬에서 쿠팡 로그인
  2) 주문내역 페이지 열기:
     https://mc.coupang.com/ssr/desktop/order/list  (PC)
     또는 https://www.coupang.com/np/mypage/orderlist
  3) F12 (또는 우클릭 → 검사) → 위쪽 [Console] 탭
  4) 본 파일 내용 전체 복사 → 콘솔에 붙여넣기 → Enter
  5) 출력 결과 캡처해서 CTO에게 전달

  검증 항목 6개:
   A. 현재 페이지 URL · 로그인 여부
   B. 봇 차단(Akamai/CF) 흔적
   C. 주문 항목 DOM 셀렉터 후보 자동 탐색
   D. 페이지네이션 / 무한 스크롤 구조
   E. 2FA 요구 흔적
   F. API 직접 호출 가능성 (XHR 캡처 힌트)
*/

(() => {
  const log = (...a) => console.log('%c[쿠팡검증]', 'color:#e91e63;font-weight:bold', ...a);
  const ok  = (...a) => console.log('%c✅', 'color:#0a0', ...a);
  const bad = (...a) => console.log('%c❌', 'color:#c00', ...a);
  const warn= (...a) => console.log('%c⚠️', 'color:#e80', ...a);

  log('검증 시작:', new Date().toLocaleString('ko-KR'));

  // A. URL · 로그인
  const url = location.href;
  log('A. 현재 URL:', url);
  const looksOrder = /order|mypage/i.test(url);
  looksOrder ? ok('주문/마이페이지로 보입니다') : warn('주문내역 페이지가 아닐 수 있음 — 위 가이드 2번 URL로 이동하세요');

  const loginHints = document.querySelectorAll('a[href*="login"], button[onclick*="login"], .login');
  const looksLogged = !document.title.toLowerCase().includes('login') && loginHints.length < 3;
  looksLogged ? ok('로그인 상태로 추정') : bad('로그아웃 상태로 보임 — 먼저 로그인하세요');

  // B. 봇 차단 흔적
  const html = document.documentElement.outerHTML.slice(0, 5000).toLowerCase();
  const botMarks = ['akamai', 'pixel_', 'reference #', 'access denied', '_abck', 'datadome', 'cloudflare', 'captcha', '로봇이 아닙니다'];
  const hits = botMarks.filter(m => html.includes(m));
  if (hits.length) bad('봇 차단 흔적:', hits);
  else ok('봇 차단 표면 흔적 없음 (쿠키 _abck 등은 따로 확인 필요)');

  const cookies = document.cookie;
  const abck = /_abck=/.test(cookies);
  const bm = /bm_sz=|bm_sv=/.test(cookies);
  if (abck || bm) warn(`Akamai Bot Manager 쿠키 감지 (_abck=${abck} bm_sz=${bm}) — 확장에서 헤더 위장 어려움`);
  else ok('Akamai 쿠키 표면 흔적 없음');

  // C. 주문 항목 셀렉터 후보
  const candidates = [
    '.order-item', '.order-list', '.OrderListItem',
    '[class*="order"]', '[class*="Order"]',
    'li[data-order-id]', 'div[data-order-id]',
    '.mp-order-list', '.np-order-list'
  ];
  log('C. 셀렉터 후보 탐색:');
  let bestSelector = null, bestCount = 0;
  candidates.forEach(sel => {
    try {
      const n = document.querySelectorAll(sel).length;
      if (n > 0) {
        console.log(`   ${sel} → ${n}개`);
        if (n > bestCount && n < 200) { bestCount = n; bestSelector = sel; }
      }
    } catch(e) {}
  });
  bestSelector
    ? ok(`주문 행 후보: ${bestSelector} (${bestCount}개)`)
    : warn('주문 행 자동 탐색 실패 — DOM 보고 수동 셀렉터 필요');

  // 상품명/금액 자동 탐색
  const priceNodes = Array.from(document.querySelectorAll('*')).filter(el =>
    el.children.length === 0 && /^[\d,]+\s*원$/.test(el.textContent.trim())
  ).slice(0, 5);
  log('금액 표시 노드 샘플 (위에서 5개):', priceNodes.map(n => n.textContent.trim()));

  // D. 페이지네이션
  const pager = document.querySelector('.pagination, .paging, [class*="ageination"], [class*="ager"]');
  if (pager) ok('페이지네이션 발견:', pager.className);
  else warn('페이지네이션 미발견 — 무한 스크롤일 가능성 (스크롤 끝까지 내려서 추가 로드되는지 확인)');

  // E. 2FA 흔적
  const otpHints = /OTP|문자\s*인증|2단계|two[- ]?factor/i.test(document.body.textContent);
  otpHints ? warn('2FA 요구 흔적 — 정기 자동화 어려움') : ok('2FA 흔적 없음 (지금 페이지 한정)');

  // F. API 직접 호출 가능성 (사용자가 다음 페이지 클릭하게 안내)
  log('F. API 캡처 안내: F12 → [Network] 탭 → 페이지네이션 다음 페이지 클릭 → "주문" 또는 "order" 들어간 XHR 응답을 찾으세요. JSON으로 떨어지면 직접 호출 가능.');

  // 요약
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('요약 (CTO 전달용):');
  console.table({
    'A 로그인': looksLogged ? 'OK' : 'NO',
    'B 봇차단': hits.length ? `위험(${hits.join(',')})` : 'OK',
    'B Akamai쿠키': abck || bm ? '있음(주의)' : '없음',
    'C 주문셀렉터': bestSelector || '미발견',
    'C 주문개수': bestCount,
    'D 페이지네이션': pager ? '있음' : '없음(스크롤?)',
    'E 2FA': otpHints ? '요구' : '없음',
  });
  log('이 표 스크린샷을 CTO에게 보내주세요.');
})();
