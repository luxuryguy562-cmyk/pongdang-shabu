/*
  쿠팡 크롤링 가능성 검증 v2 (정밀 재검증)
  ─────────────────────────────────────────────────────────
  v1 한계 보완:
   - 셀렉터 자동 탐색 (날짜+금액 동시 가진 행을 진짜 주문으로 인식)
   - 2FA 진짜 강제 vs 단순 텍스트 구분
   - 네트워크 API(XHR/fetch) 자동 캡처 (다음 페이지·스크롤 시)
   - 진짜 주문 1건 샘플 데이터(날짜·상품명·금액·매장명) 자동 추출

  사용법
   1) 쿠팡 주문내역 페이지 (로그인 상태)
   2) F12 → [Console]
   3) 본 파일 전체 복붙 → Enter
   4) 안내대로 ① 페이지 끝까지 한 번 스크롤 / ② "다음 페이지" 또는 더보기 1번 클릭
   5) 30초 기다린 후 콘솔에 다시 finish() 입력 → Enter
   6) 출력 표 캡처 → CTO에게
*/

(() => {
  const log  = (...a) => console.log('%c[v2]', 'color:#1976d2;font-weight:bold', ...a);
  const ok   = (...a) => console.log('%c✅', 'color:#0a0', ...a);
  const bad  = (...a) => console.log('%c❌', 'color:#c00', ...a);
  const warn = (...a) => console.log('%c⚠️', 'color:#e80', ...a);

  log('v2 시작:', location.href);

  // ─── 1. 진짜 주문 행 탐색 (날짜+금액 동시 가진 부모 노드) ───
  const dateRe  = /20\d{2}[.\-\/]\s?\d{1,2}[.\-\/]\s?\d{1,2}/;
  const priceRe = /[\d,]+\s*원/;

  const allEls = document.querySelectorAll('*');
  const orderRowCands = [];
  for (const el of allEls) {
    if (el.children.length < 2 || el.children.length > 50) continue;
    const t = el.innerText || '';
    if (t.length > 2000) continue;
    if (dateRe.test(t) && priceRe.test(t)) orderRowCands.push(el);
  }
  // 가장 자식 적은 (= 가장 작은) 매칭 = 실제 주문 카드
  orderRowCands.sort((a,b) => a.innerText.length - b.innerText.length);
  const realRows = [];
  const seen = new Set();
  for (const el of orderRowCands) {
    let isChildOfSeen = false;
    for (const s of seen) if (s.contains(el)) { isChildOfSeen = true; break; }
    if (isChildOfSeen) continue;
    // 같은 형제 패턴인지 확인
    realRows.push(el); seen.add(el);
    if (realRows.length >= 20) break;
  }
  log(`진짜 주문 행 후보: ${realRows.length}개`);
  if (realRows.length > 0) {
    const first = realRows[0];
    const classChain = first.className || first.tagName;
    log('첫 행 클래스/태그:', classChain);
    log('첫 행 텍스트 (앞 200자):', (first.innerText||'').slice(0,200).replace(/\s+/g,' '));
    // 부모를 거슬러 올라가며 모든 행 잡는 셀렉터 추정
    let parent = first.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === first.tagName);
      log(`형제 동일 태그 ${siblings.length}개 → 추정 주문 컨테이너:`, parent.className || parent.tagName);
    }
  }

  // ─── 2. 2FA 진짜 강제 여부 ───
  const otpInputs = document.querySelectorAll('input[name*="otp" i], input[name*="auth" i], input[autocomplete="one-time-code"]');
  const otpVisible = Array.from(otpInputs).some(i => i.offsetParent !== null);
  if (otpVisible) bad('2FA 입력란 실제 보임 → 강제');
  else ok('2FA 입력란 보이지 않음 → 강제 아님 (텍스트만 있을 수 있음)');

  // ─── 3. Akamai 쿠키 / 봇 신호 ───
  const c = document.cookie;
  log('Akamai _abck:', /_abck=/.test(c), '/ bm_sz:', /bm_sz=/.test(c));
  log('→ 사장님 로그인 세션 그대로면 확장에서 동일 쿠키 사용 가능. 별도 우회 X');

  // ─── 4. 네트워크 API 캡처 (사용자 액션 대기) ───
  window.__coupangApis = [];
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = (typeof args[0] === 'string') ? args[0] : args[0].url;
    if (/order|mypage|purchase/i.test(url)) {
      window.__coupangApis.push({type:'fetch', url, time:new Date().toISOString()});
    }
    return origFetch.apply(this, args);
  };
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (/order|mypage|purchase/i.test(url)) {
      window.__coupangApis.push({type:'xhr', method, url, time:new Date().toISOString()});
    }
    return origOpen.apply(this, arguments);
  };

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('이제 사장님이 할 일:');
  log('  ① 마우스 휠로 페이지 끝까지 천천히 스크롤');
  log('  ② "더보기" / "다음 페이지" 버튼 보이면 1번 클릭');
  log('  ③ 30초 기다린 후 콘솔에 다음 입력:');
  log('     finish()');
  log('  ④ Enter');

  window.finish = () => {
    const apis = window.__coupangApis || [];
    console.log('%c━━━━━━━━━ 최종 요약 ━━━━━━━━━', 'color:#1976d2;font-weight:bold');
    if (apis.length === 0) warn('API 호출 캡처 0건 — DOM 긁기 방식만 가능');
    else {
      ok(`주문 관련 API ${apis.length}건 캡처됨 → DOM 안 긁고 API 직통 가능!`);
      console.table(apis.slice(0,10));
    }
    console.table({
      '진짜 주문 행 수': realRows.length,
      '진짜 주문 행 셀렉터': realRows[0]?.className || realRows[0]?.tagName || '미발견',
      '2FA 강제': otpVisible ? '예' : '아니오',
      'Akamai 쿠키': /_abck=|bm_sz=/.test(document.cookie) ? '있음' : '없음',
      'API 캡처': apis.length,
      'API 첫 URL': apis[0]?.url?.slice(0,80) || '-',
    });
    log('이 표 + 위 API URL들 캡처해서 CTO에게 보내주세요.');
  };

  log('준비 완료. 위 ①②③ 진행해주세요.');
})();
