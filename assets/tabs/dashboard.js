// ══════════════════════════════════════════
// 대시보드
// ══════════════════════════════════════════
function moveDashMonth(dir){
  const d=new Date(dashMonthStr+'-01');d.setMonth(d.getMonth()+dir);
  // 미래 월 차단 (오늘이 속한 월까지만 이동 가능)
  if(dir>0){
    const now=new Date();
    const curYm=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const newYm=d.toISOString().slice(0,7);
    if(newYm>curYm){ toast('아직 오지 않은 달이에요','info'); return; }
  }
  dashMonthStr=d.toISOString().slice(0,7);
  loadDashboard();
}
function destroyChart(id){
  if(chartInstances[id]){
    try{chartInstances[id].destroy();}catch(_){} // 2026-05-21 Phase C: destroy throw 보호
    delete chartInstances[id];
  }
}
function toggleTooltip(id){const el=document.getElementById(id);if(el)el.style.display=el.style.display==='none'?'block':'none';}

// 만원 단위 포맷 헬퍼
function fmtMan(v){return v>=0?fmt(Math.round(v/10000)):'-'+fmt(Math.round(Math.abs(v)/10000));}

// ─── 홈 v7 드릴다운 — stage 토글 (2026-05-22) ───
// 사장님 OK: 토스 스타일 1단계(큰 박스) ↔ 2단계(상세). nav('dashboard') 진입 시 자동 home 리셋.
function dashGoStage(stage){
  if(!stage) stage = 'home';
  // 홈 복귀 시 항상 이번 달로 (홈 월요약 = 이번 달 고정. 세부화면에서 과거 봤어도 홈은 현재월)
  if(stage==='home' && typeof dashMonthStr!=='undefined'){
    const nowYm=new Date().toISOString().slice(0,7);
    if(dashMonthStr!==nowYm){ dashMonthStr=nowYm; loadDashboard(); }
  }
  const stages = document.querySelectorAll('#dashboardCont .dash-stage');
  stages.forEach(s=>s.classList.toggle('active', s.dataset.dashStage===stage));
  window.scrollTo({top:0, behavior:'instant'});
}

// ─── today-detail 일자 네비 (2026-05-25 신설 — 사장님 호소: 다른 날짜도 보고 싶음) ───
//  · _tdContext = loadDashboard 끝에서 박는 컨텍스트 (월 데이터 + 헬퍼)
//  · _tdDay = 현재 표시 중인 'YYYY-MM-DD'
//  · 같은 월 안 = 메모리만 사용. 다른 월 = 1차 미지원 (토스트 안내)
let _tdContext = null;
let _tdDay = null;
let _todayVendorDataCache = null;
let _topCardCtx = null;   // 홈 매출 카드 날짜 네비 컨텍스트 (2026-06-03)
let _topCardDay = null;   // 현재 표시 중인 날짜 'YYYY-MM-DD'
let _pendingTopCardDay = null; // 월 경계 넘을 때 로드 후 표시할 날짜 (2026-06-03 통합 흐름)
// ─── 거래처별 오늘 지출 캐싱 (2026-06-03 바텀시트로 전환) ───
const _VE_COLORS=['#22C55E','#3B82F6','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#94A3B8'];

// ─── 새 기능: 지금 근무 인원 카드 (2026-06-04) ───
//  · 위치: 인사말 바로 아래 compact 카드, 항상 표시
//  · 오늘 기록 없음 = "아직 출근 기록이 없어요" / 근무 중 N명 = 초록 + 동그라미 / 전원 퇴근 = "오늘 N명 근무 완료"
async function renderWorkingNow(){
  const card=document.getElementById('dashWorkingNow');
  if(!card) return;
  const noData=()=>{
    card.innerHTML=`<span class="wn-live off"></span>`
      +`<span class="wn-tt wait">아직 출근한 직원이 없어요</span>`
      +`<span class="wn-arr go">›</span>`;
  };
  if(!currentStore?.id){ noData(); return; }
  const today=ymdLocal(new Date());
  const {data,error}=await sb.from('attendance_logs')
    .select('employee_id,app_in,app_out,employees(name)')
    .eq('store_id',currentStore.id).eq('work_date',today)
    .not('app_in','is',null);
  if(error){ console.warn('[renderWorkingNow]', error.message); noData(); return; }
  const allToday=(data||[]);
  const working=allToday.filter(r=>!r.app_out);
  if(!working.length){
    if(allToday.length){
      // 오늘 출근 기록은 있지만 전원 퇴근 완료
      const names=allToday.map(r=>r.employees?.name||'직원');
      const n=allToday.length;
      const nameTxt=n<=3?names.join(' · '):`${names.slice(0,3).join(' · ')} 외 ${n-3}명`;
      card.innerHTML=`<span class="wn-live off"></span>`
        +`<div><div class="wn-tt off">오늘 ${n}명 근무 완료</div><div class="wn-nm">${esc(nameTxt)}</div></div>`
        +`<span class="wn-arr">›</span>`;
    } else {
      noData();
    }
    return;
  }
  const names=working.map(r=>r.employees?.name||'직원');
  const n=working.length;
  const avCls=['wn-c0','wn-c1','wn-c2'];
  const shown=names.slice(0,3);
  const avs=shown.map((nm,i)=>`<div class="wn-av ${avCls[i%3]}">${esc(nm.slice(0,1))}</div>`).join('');
  const more=n>3?`<div class="wn-av wn-more">+${n-3}</div>`:'';
  const nameTxt=n<=3?names.join(' · '):`${shown.join(' · ')} 외 ${n-3}명`;
  card.innerHTML=`<span class="wn-live"></span>`
    +`<div class="wn-avstk">${avs}${more}</div>`
    +`<div><div class="wn-tt">지금 ${n}명 근무 중</div><div class="wn-nm">${esc(nameTxt)}</div></div>`
    +`<span class="wn-arr">›</span>`;
}

function renderTodayVendorExp(veMap, hasSale, dayExp){
  const card=document.getElementById('dashTopVendorSection');  // 오늘 카드 안 통합 섹션 (A안)
  const listEl=document.getElementById('dashTodayVendorList');
  // 바텀시트용 데이터 캐싱 (오늘매출 카드 지출 줄 탭 → 전체 상세)
  _todayVendorDataCache = (veMap && Object.keys(veMap||{}).length) ? {veMap, dayExp} : null;
  if(!card) return;
  // 영수증·거래처로 등록하는 변동 지출만 (고정비·인건비·로열티 등 고정성 자동 제외), 거래처별로 쭉 나열
  // veMap 키는 '거래처명|카테고리'라 → 거래처명으로 재합산 (홈은 거래처별, 2026-06-08)
  const _byVendor={};
  Object.values(veMap||{}).forEach(o=>{
    if(!(o.amt>0 && o.isVar)) return;
    if(!_byVendor[o.name]) _byVendor[o.name]={name:o.name, amt:0, _g:new Set()};
    _byVendor[o.name].amt+=o.amt;
    if(o._g) o._g.forEach(k=>_byVendor[o.name]._g.add(k)); // 영수증 묶음 키 합산 → N건
  });
  const items = Object.values(_byVendor).sort((a,b)=>b.amt-a.amt);
  if(!items.length){
    // 데이터 없어도 섹션은 항상 표시 — height:160px 고정이라 아래 월요약 카드 위치 안 튐 (2026-06-04)
    if(listEl) listEl.innerHTML=`<div class="t7-ve-dash2">`
      +`<span class="ve-d2-tx">🧾 지출 내역이 여기 나와요</span>`
      +`<div class="ghost-rows">`
      +`<div class="ghost-row"><span class="ghost-dot"></span><span class="ghost-bar" style="width:90px;"></span><span class="ghost-bar" style="width:50px;margin-left:auto;"></span></div>`
      +`<div class="ghost-row"><span class="ghost-dot"></span><span class="ghost-bar" style="width:70px;"></span><span class="ghost-bar" style="width:45px;margin-left:auto;"></span></div>`
      +`<div class="ghost-row"><span class="ghost-dot"></span><span class="ghost-bar" style="width:80px;"></span><span class="ghost-bar" style="width:55px;margin-left:auto;"></span></div>`
      +`</div></div>`;
    card.style.display='';
    return;
  }
  if(listEl){
    listEl.innerHTML = items.map(it=>{
      // 거래처 클릭 → 지출 기록 통합 화면 + 그 거래처 칩 필터 (행형 통일 2026-06-11)
      // 줄 모양 = 사장님 목업: 거래처명(굵게) + 아래 "영수증 N건 ›" + 우측 금액 (2026-06-11)
      const cnt=it._g?it._g.size:0;
      const sub=cnt>0?`<span class="vsub">영수증 ${cnt}건 ›</span>`:'';
      return `<div class="ve-item" style="cursor:pointer;" data-action="openExpenseRecords|${encodeURIComponent(it.name)}">`
        +`<div class="ve-info"><span class="vname">${esc(it.name)}</span>${sub}</div>`
        +`<span class="vamt">${fmt(it.amt)}원</span></div>`;
    }).join('');
    // 하단 흐리기: 스크롤 더 있을 때만 + 끝까지 내리면 제거 (2026-06-08)
    const _applyVeMask=()=>{
      const atBottom=listEl.scrollTop+listEl.clientHeight>=listEl.scrollHeight-4;
      const msk=(!atBottom && listEl.scrollHeight>listEl.clientHeight+2)
        ?'linear-gradient(to bottom,black 55%,rgba(0,0,0,.15) 82%,transparent 100%)':'';
      listEl.style.webkitMaskImage=msk;
      listEl.style.maskImage=msk;
    };
    listEl.onscroll=_applyVeMask;
    requestAnimationFrame(_applyVeMask);
  }
  card.style.display='';
}
// ─── 지출 상세 바텀시트 열기 (카테고리별 그룹: 카테고리 합계 + 아래 거래처 상세, 2026-06-08 복원) ───
function openTodayVendorSheet(){
  const d = _todayVendorDataCache;
  if(!d){ toast('지출 데이터가 없습니다.'); return; }
  const {veMap, dayExp} = d;
  // veMap = { '쿠팡|비품': {name, cat, amt}, ... } → 거래처+카테고리 단위
  const rows = Object.values(veMap).map(o=>({name:o.name, cat:o.cat||'기타', amt:o.amt, cnt:(o._g?o._g.size:0)}));
  const total = dayExp || rows.reduce((s,r)=>s+r.amt, 0);

  // 카테고리별 그룹 묶기
  const catGroups = {};
  rows.forEach(r=>{
    if(!catGroups[r.cat]) catGroups[r.cat]={cat:r.cat, sum:0, items:[]};
    catGroups[r.cat].sum += r.amt;
    catGroups[r.cat].items.push(r);
  });
  // 카테고리는 합계 큰 순, 카테고리 내 거래처도 금액 큰 순
  const groups = Object.values(catGroups).sort((a,b)=>b.sum-a.sum);
  groups.forEach(g=>g.items.sort((a,b)=>b.amt-a.amt));

  const listEl = document.getElementById('vendorExpSheetList');
  const totalEl = document.getElementById('vendorExpSheetTotal');
  const titleEl = document.querySelector('#vendorExpSheet .sheet-title');
  if(titleEl) titleEl.textContent = '💸 지출 내역';
  if(listEl){
    const groupsHtml = groups.map((g,i)=>{
      const color = _VE_COLORS[i % _VE_COLORS.length];
      const pct = total>0 ? Math.round(g.sum/total*100) : 0;
      const itemsHtml = g.items.map(it=>
        // 거래처 클릭 → 지출 기록 통합 화면 + 그 거래처 칩 필터 (openExpenseRecords가 시트 자동 닫음)
        `<div class="ve-row" style="cursor:pointer;" data-action="openExpenseRecords|${encodeURIComponent(it.name)}">`
        +`<div class="ve-info"><span class="vname">${esc(it.name)}</span>${it.cnt>0?`<span class="vsub">영수증 ${it.cnt}건 ›</span>`:''}</div>`
        +`<span class="vamt">${fmt(it.amt)}원</span></div>`
      ).join('');
      return `<div class="ve-group">`
        + `<div class="ve-cat-head"><span class="ve-cat-dot" style="background:${color};"></span>`
        + `<span class="ve-cat-name">${esc(g.cat)}</span>`
        + `<span class="ve-cat-pct">${pct}%</span>`
        + `<span class="ve-cat-sum">${fmt(g.sum)}원</span></div>`
        + itemsHtml
        + `</div>`;
    }).join('');
    listEl.innerHTML = groupsHtml || `<div style="text-align:center;padding:20px 0;color:var(--gray-400);font-size:12px;">내역 없음</div>`;
  }
  if(totalEl) totalEl.innerHTML = `<span class="ve-total-lb">전체 합계</span><span class="ve-total-vl">${fmt(total)}원</span>`;
  openSheet('vendorExpSheet');
}
// 바텀시트 내 더보기 토글 — 카테고리 그룹핑 전환으로 더보기 폐기 (호환 유지, 2026-06-03)
function toggleVendorMoreSheet(btn){ /* 더보기 없음 (전부 표시) */ }
// ─── 홈 매출 카드 날짜 네비 (2026-06-03) ───
function topCardDayMove(dir){
  if(!_topCardDay) return;
  const cur = new Date(_topCardDay + 'T00:00:00');
  cur.setDate(cur.getDate() + Number(dir));
  const newStr = ymdLocal(cur);            // 한국 시간 기준 (toISOString는 UTC라 하루 어긋남)
  const _todayStr = ymdLocal(new Date());
  if(newStr > _todayStr) return; // 미래 막기
  const newMonth = newStr.slice(0,7);
  if(newMonth === dashMonthStr){
    // 같은 달 안 → 카드만 갱신
    renderTopCardForDay(newStr);
  } else {
    // 월 경계 넘음 → 그 달 데이터 로드 후 그 날짜 표시 (월카드·달력 자동 연동)
    _pendingTopCardDay = newStr;
    dashMonthStr = newMonth;
    loadDashboard();
  }
}
function renderTopCardForDay(dayStr){
  if(!_topCardCtx) return;
  const ctx = _topCardCtx;
  _topCardDay = dayStr;
  const dayPad = dayStr.slice(8);
  const d = parseInt(dayPad, 10);
  const _todayStr = ymdLocal(new Date());
  const _yest = (()=>{ const y=new Date(); y.setDate(y.getDate()-1); return ymdLocal(y); })();
  const isTodayShown = dayStr === _todayStr;
  const isYesterday = dayStr === _yest;

  const topAmtEl = document.getElementById('dashTopSalesAmt');
  const topModeEl = document.getElementById('dashTopSalesMode');
  const topUpdEl = document.getElementById('dashTopSalesUpdated');
  const peEl = document.getElementById('dashTopSalesProfitExpense');

  const saleAmt = ctx.dailySalesMap[dayPad] || 0;
  const dayExp = ctx.dailyExpTotal[dayPad] || 0;
  const dayProfit = saleAmt - dayExp;
  const prevExp = ctx.prevDailyExpTotal[dayPad] || 0;
  const prevSale = ctx.prevDailySalesMap[dayPad] || 0;
  const prevProfit = prevSale - prevExp;

  // 헤더 안 A — 날짜 메인 + 상대표현 배지 + 상태 보조줄 (2026-06-04)
  const dow = ['일','월','화','수','목','금','토'][new Date(ctx.ym+'-'+dayPad+'T00:00:00').getDay()];
  const dayN = parseInt(dayPad, 10);
  // 메인: "6월 4일 (목)"
  document.getElementById('dashTopSalesLabel').innerText = `${ctx.mo}월 ${dayN}일 (${dow})`;
  // 상대표현 배지: 오늘=초록, 어제=회색, 그 외=숨김
  const relEl = document.getElementById('dashTopSalesRel');
  if(relEl){
    if(isTodayShown){ relEl.innerText='오늘'; relEl.className='t7-day-badge today'; relEl.style.display=''; }
    else if(isYesterday){ relEl.innerText='어제'; relEl.className='t7-day-badge'; relEl.style.display=''; }
    else { relEl.style.display='none'; }
  }
  // 상태 보조줄: 오늘 실시간/영업 중/마감, 과거 마감 (항상 표시 — 줄 높이 안정)
  const subLabel = (ctx.isUpsMode && isTodayShown) ? '실시간'
    : (isTodayShown && !ctx.isTodaySettled) ? '영업 중'
    : '마감';
  // 영업 중·실시간 = 초록 점 + 퍼지는 원 깜빡임 / 마감 = 회색 정적 점 (2026-06-05)
  const _isLive = isTodayShown && !ctx.isTodaySettled;
  const _subDot = _isLive
    ? `<span class="live-dot-wrap"><span class="live-dot-ring"></span><span class="live-dot-inner"></span></span>`
    : `<span class="t7-sub-dot"></span>`;
  topModeEl.innerHTML = _subDot + `<span class="t7-sub-tx">${subLabel}</span>`;
  topModeEl.className = 't7-day-sub' + (_isLive ? ' live' : '');

  if(saleAmt > 0){
    topAmtEl.classList.remove('empty');
    topAmtEl.innerHTML = fmt(saleAmt) + '<span class="won">원</span>';
    if(ctx.isUpsMode && isTodayShown){
      const now = new Date();
      topUpdEl.innerHTML = `업데이트 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} <span class="refresh">↻</span>`;
      topUpdEl.style.display = '';
    } else { topUpdEl.style.display = 'none'; }
    const _isP = dayProfit >= 0;
    document.getElementById('dashTopExpenseAmt').innerText = '-' + fmt(dayExp) + '원';
    const profitEl = document.getElementById('dashTopProfitAmt');
    profitEl.innerText = (_isP?'+':'-') + fmt(Math.abs(dayProfit)) + '원';
    // className 통째 재설정 — 매출 없던 날의 gray(작은 회색) 잔재 제거 (2026-06-04)
    profitEl.className = 'r-amt ' + (_isP ? 'green' : 'red');
    const _pDot = document.getElementById('dashTopProfitDot');
    if(_pDot){ _pDot.classList.toggle('green',_isP); _pDot.classList.toggle('red',!_isP); }
    const renderDelta = (el, m) => {
      if(!el) return;
      if(!m){ el.innerText=''; el.style.color=''; return; }
      if(m.text==='비슷'){ el.innerText='비슷'; el.style.color='#8B95A1'; return; }
      el.innerText = `${m.arrow}${m.pct}%`;
      el.style.color = m.cls==='mom-good'?'#0CAB6C':(m.cls==='mom-bad'?'#F04452':'#B0B8C1');
    };
    renderDelta(document.getElementById('dashTopExpenseDelta'), ctx.momTxt(dayExp, prevExp, false));
    renderDelta(document.getElementById('dashTopProfitDelta'), ctx.momTxt(dayProfit, prevProfit, true));
    peEl.style.display = 'block';
    renderTodayVendorExp(ctx.dailyVendorExp[dayPad], true, dayExp);
  } else {
    topAmtEl.classList.add('empty');
    if(isTodayShown){
      topAmtEl.innerHTML = '0원<div class="t7-amt-hint">아직 오늘 매출 없음</div>';
    } else {
      topAmtEl.innerHTML = '0원<div class="t7-amt-hint">아직 입력 안 됨</div>';
    }
    topUpdEl.style.display = 'none';
    if(isTodayShown){
      // 오늘 기준: 지출 실시간, 수익 마감 후 확인 (2026-06-04)
      document.getElementById('dashTopExpenseAmt').innerText = '-'+fmt(dayExp)+'원';
      document.getElementById('dashTopExpenseDelta').innerText = '';
      const profitEl = document.getElementById('dashTopProfitAmt');
      profitEl.innerText = '마감 후 확인';
      profitEl.className = 'r-amt';
      profitEl.style.cssText = 'font-size:13px;font-weight:600;color:#B0B8C1;letter-spacing:-0.3px;text-align:right;';
      // 매출 기록 전이어도 수익 점은 초록 유지 — 매출·지출·수익 점 통일 (2026-06-04)
      const _pDot = document.getElementById('dashTopProfitDot');
      if(_pDot){ _pDot.classList.remove('red','gray'); _pDot.classList.add('green'); }
      document.getElementById('dashTopProfitDelta').innerText = '';
      peEl.style.display = 'block';
      renderTodayVendorExp(ctx.dailyVendorExp[dayPad]||{}, false, dayExp);
    } else {
      peEl.style.display = 'none';
      renderTodayVendorExp(null, false, 0);
    }
  }

  // 네비 버튼 상태 — ‹ 과거는 항상 가능(월 넘김), › 미래(오늘 이후)만 막기
  const prevBtn = document.getElementById('dashTopNavPrev');
  const nextBtn = document.getElementById('dashTopNavNext');
  if(prevBtn) prevBtn.disabled = false;
  if(nextBtn) nextBtn.disabled = (dayStr >= _todayStr);
}
// 거래처별 지출 더보기 토글 — 구 카드용 (호환 유지)
function toggleVendorMore(btn){
  toggleVendorMoreSheet(btn);
}
function renderTodayDetailForDay(dayStr){
  if(!_tdContext) return;
  const ctx = _tdContext;
  const sameMonth = dayStr.slice(0,7) === ctx.ym;
  if(!sameMonth){
    // 날짜 선택기(tdDayPicker) min/max가 해당 달로 제한돼 사용자가 다른 달을 직접 고를 수 없음.
    // 화면 전환 중 이전 달 값이 남아 발동하는 경우뿐이라 토스트 없이 조용히 무시 (2026-06-05)
    const _p = document.getElementById('tdDayPicker');
    if(_p && _tdDay) _p.value = _tdDay;
    return;
  }
  _tdDay = dayStr;
  const d = dayStr.slice(8);
  const dayInt = parseInt(d, 10);
  const dow = ['일','월','화','수','목','금','토'][new Date(dayStr+'T00:00:00').getDay()];
  const hasSale = ctx.dailySalesMap.hasOwnProperty(d);
  const _amt = ctx.dailySalesMap[d] || 0;
  const _dexp = ctx.dailyExpTotal[d] || 0;
  const _dprofit = _amt - _dexp;
  const _todayStr = ymdLocal(new Date());
  const isFuture = dayStr > _todayStr;
  const isToday = dayStr === _todayStr;

  const _ddAmt=document.getElementById('dashTodayDetailAmt');
  const _ddDate=document.getElementById('dashTodayDetailDate');
  const _ddSub=document.getElementById('dashTodayDetailSub');
  const _ddExp=document.getElementById('dashTodayDetailExp');
  const _ddProfit=document.getElementById('dashTodayDetailProfit');
  const _ddPeRow=document.getElementById('dashTodayDetailPeRow');

  let stateLabel;
  if(hasSale) stateLabel = (ctx.isUpsMode && isToday) ? '실시간' : '마감';
  else if(isFuture) stateLabel = '미래';
  else if(isToday) stateLabel = ctx.isUpsMode ? '실시간' : '영업 중';
  else stateLabel = '마감 안 됨';

  if(_ddDate) _ddDate.innerHTML = `${ctx.mo}월 ${dayInt}일 (${dow}) · ${stateLabel}`;
  if(_ddAmt){
    if(hasSale){
      _ddAmt.classList.remove('empty');
      _ddAmt.innerHTML = `${fmt(_amt)}<span class="won">원</span>`;
    } else {
      _ddAmt.classList.add('empty');
      _ddAmt.innerText = isFuture ? '아직 안 온 날' : (isToday ? '아직 입력 안 됨' : '마감 안 됨');
    }
  }
  if(_ddSub){
    if(hasSale) _ddSub.innerText = (ctx.isUpsMode && isToday) ? '방금 갱신됨' : '마감 기준';
    else if(isToday) _ddSub.innerText = '오늘 첫 매출인가요? 아래에서 입력하세요.';
    else if(isFuture) _ddSub.innerText = '미래 날짜는 데이터가 없어요';
    else _ddSub.innerText = '이 날은 마감이 안 됐어요';
  }
  if(_ddPeRow){
    if(hasSale){
      _ddPeRow.style.display = 'grid';
      if(_ddExp) _ddExp.innerText = '-'+fmt(_dexp)+'원';
      if(_ddProfit) _ddProfit.innerText = (_dprofit>=0?'+':'-')+fmt(Math.abs(_dprofit))+'원';
    } else {
      _ddPeRow.style.display = 'none';
    }
  }
  // 결제수단별 — 해당일 settle 행
  const _row = (ctx.settle||[]).find(s=>s.date?.slice(8)===d);
  renderTodayPaymentMethods(_row, _amt);

  // 일자 네비 라벨·picker·화살표 활성 상태
  const lblText = document.getElementById('tdDayLabelText');
  const prevBtn = document.getElementById('tdDayPrev');
  const nextBtn = document.getElementById('tdDayNext');
  const picker = document.getElementById('tdDayPicker');
  const _yesterdayStr = (()=>{ const y=new Date(); y.setDate(y.getDate()-1); return ymdLocal(y); })();
  let relativeLabel = '';
  if(isToday) relativeLabel = ' · 오늘';
  else if(dayStr === _yesterdayStr) relativeLabel = ' · 어제';
  if(lblText) lblText.innerText = `${ctx.mo}월 ${dayInt}일 (${dow})${relativeLabel}`;
  if(picker){
    picker.value = dayStr;
    picker.min = ctx.ym + '-01';
    picker.max = ctx.ym + '-' + String(ctx.lastDay).padStart(2,'0');
  }
  if(prevBtn){ prevBtn.disabled = (dayInt <= 1); prevBtn.style.opacity = (dayInt<=1?'0.3':'1'); }
  if(nextBtn){ nextBtn.disabled = (dayInt >= ctx.lastDay); nextBtn.style.opacity = (dayInt>=ctx.lastDay?'0.3':'1'); }
}
function tdDayMove(dir){
  if(!_tdContext || !_tdDay) return;
  const ctx = _tdContext;
  const d = parseInt(_tdDay.slice(8), 10) + Number(dir);
  if(d < 1 || d > ctx.lastDay) return;
  renderTodayDetailForDay(ctx.ym + '-' + String(d).padStart(2,'0'));
}
function tdOpenDayPicker(){
  const picker = document.getElementById('tdDayPicker');
  if(!picker) return;
  if(typeof picker.showPicker === 'function'){
    try { picker.showPicker(); return; } catch(e){ /* fallback below */ }
  }
  picker.click();
  picker.focus();
}
function tdDayPickerChange(el){
  if(!el || !el.value) return;
  renderTodayDetailForDay(el.value);
}

// 결제수단별 분해 (sales_daily 레거시 7컬럼 + amounts JSONB 폴백)
// paymentMethods 동적이라 레거시 0이면 amounts.<pm.id>에서 보충
function renderTodayPaymentMethods(row, totalSale){
  const wrap = document.getElementById('dashPmCardWrap');
  const barEl = document.getElementById('dashPmBar');
  const listEl = document.getElementById('dashPmList');
  const cntEl = document.getElementById('dashPmCount');
  if(!wrap||!barEl||!listEl||!cntEl) return;
  if(!row || !totalSale || totalSale<=0){
    wrap.style.display = 'none';
    return;
  }
  const pmDefs = [
    {key:'card',         name:'카드 결제',  color:'#3182F6'},
    {key:'cash',         name:'현금',       color:'#0CAB6C'},
    {key:'cash_receipt', name:'현금영수증', color:'#F5A11E'},
    {key:'qr',           name:'QR',         color:'#8B5CF6'},
    {key:'etc',          name:'기타결제',   color:'#8B95A1'},
  ];
  const pmList = (typeof paymentMethods!=='undefined' && Array.isArray(paymentMethods)) ? paymentMethods : [];
  const items = pmDefs.map(p=>{
    let amt = Number(row[p.key]||0);
    // amounts JSONB 폴백: 같은 legacy_key의 동적 결제수단 id로 amounts 조회
    if(amt===0 && row.amounts && pmList.length){
      const pm = pmList.find(m=>m.legacy_key===p.key);
      if(pm) amt = Number(row.amounts[pm.id]||0);
    }
    return {...p, amt};
  }).filter(p=>p.amt>0).sort((a,b)=>b.amt-a.amt);
  if(items.length===0){ wrap.style.display='none'; return; }
  wrap.style.display = '';
  cntEl.innerText = items.length + '개 결제수단';
  barEl.innerHTML = items.map(p=>`<div class="seg" style="width:${(p.amt/totalSale*100).toFixed(2)}%;background:${p.color};"></div>`).join('');
  listEl.innerHTML = items.map(p=>`
    <div class="pm-row">
      <div class="lcol"><span class="dot" style="background:${p.color};"></span><span class="nm">${p.name}</span></div>
      <div class="vl">${fmt(p.amt)}원</div>
    </div>
  `).join('');
}


async function loadDashboard(force){
  if(!currentStore){
    const _sg = document.getElementById('dashSummaryGrid');
    if(_sg) _sg.innerHTML = '<div class="empty-state"><p>매장을 먼저 선택하세요</p></div>';
    return;
  }
  // 2026-05-21 Phase B: SWR — force=true는 백그라운드 fresh, 사장님 화면 무음
  if(!force) setLoad(true,'데이터 조회 중...');
  try{
    const ym=dashMonthStr;
    const _dml=document.getElementById('dashMonthLabel'); if(_dml)_dml.innerText=ym; // 홈 월네비 제거됨(2026-06-03), 세부화면은 mdMonthLabel
    // 매출 달력 시트 월 라벨도 동기화 (시트 안 ‹ › 네비 → 라벨 갱신, 2026-06-03)
    const _calSheetLbl=document.getElementById('salesCalSheetMonth');
    if(_calSheetLbl) _calSheetLbl.innerText=ym;
    const[y,mo]=ym.split('-').map(Number);
    const lastDay=new Date(y,mo,0).getDate();
    const start=ym+'-01',end=ym+'-'+String(lastDay).padStart(2,'0');
    const today=new Date();
    const passedDays=today.toISOString().slice(0,7)===ym?today.getDate():lastDay;
    const isCurrent=passedDays<lastDay;

    // ── 전월 기간 계산 ──
    const pMo=mo===1?12:mo-1, pY=mo===1?y-1:y;
    const pYm=pY+'-'+String(pMo).padStart(2,'0');
    const pLastDay=new Date(pY,pMo,0).getDate();
    const pStart=pYm+'-01', pEnd=pYm+'-'+String(pLastDay).padStart(2,'0');

    // v17: 옛 dashPassedLabel 폐기 (월 카드의 mc-label로 대체)
    const _dplEl = document.getElementById('dashPassedLabel');
    if(_dplEl) _dplEl.innerText = `${lastDay}일 중 ${passedDays}일 경과`;

    // ══ 병렬 데이터 로드 ══
    // N+1 정리: 두 Promise.all 통합. vendor_orders/receipts/attendance_logs/fixed_costs 1번씩만 받아
    //          calcExpenseByCategories(prefetched)에 전달 + 일별 분배에 재사용
    await loadExpCategories();
    const sid=currentStore.id;

    // ─── 자동 모드 판별 (토글 제거됨, 2026-05-15) ─── //
    // daily_sales에 최근 3일 내 데이터 있으면 ups(영구 모드), 없으면 settle(임시 모드)
    // 2026-05-21 Phase A: 5분 캐시 (매번 sb fetch 낭비 방지 — 사장님 매장은 0행이라 결과 뻔함)
    try{
      const _upsKey=`upsCheck_${sid}`;
      let _upsCached=cacheGet(_upsKey, 300000);
      if(_upsCached===null){
        const _y3=new Date(today.getTime()-3*24*3600e3).toISOString().slice(0,10);
        const{data:_upsCheck}=await sb.from('daily_sales').select('sale_date').eq('store_id',sid).gte('sale_date',_y3).limit(1);
        _upsCached=(_upsCheck&&_upsCheck.length>0)?'ups':'settle';
        cacheSet(_upsKey, _upsCached);
      }
      dashSaleSource=_upsCached;
    }catch(_){dashSaleSource='settle';}

    // 2026-05-21 Phase B: SWR 캐시 (5분 TTL). 캐시 hit이면 즉시 렌더 + 5초 후 백그라운드 fresh
    const _dashKey=`dashv2_${sid}_${ym}_${dashSaleSource}_${dashMode||'auto'}`;
    let _dashPack = !force ? cacheGet(_dashKey, 300000) : null;
    let settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2, schedRes2;
    if(_dashPack){
      ({settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2, schedRes2} = _dashPack);
    } else {
      const _runDashQueries=()=>Promise.all([
        // 당월 매출 ('settle' = sales_daily 기준 / 'ups' = 업솔루션 daily_sales)
        // Part F Phase 2: select('*') — paymentMethods amounts jsonb + 레거시 7컬럼 모두 수용
        dashSaleSource==='ups'
          ?sb.from('daily_sales').select('sale_date,total_sales,card_sales,cash_sales').eq('store_id',sid).gte('sale_date',start).lte('sale_date',end).order('sale_date')
          :sb.from('sales_daily').select('*').eq('store_id',sid).gte('date',start).lte('date',end).order('date'),
        // 고정비 — 항목별 예상 월 금액 1회 입력 (모든 달 동일 적용)
        sb.from('fixed_costs').select('id,estimated_monthly,is_active,category').eq('store_id',sid),
        // (옛 진마감 통장 로열티 조회 제거 2026-06-22 — 통장 기준 마감 폐기. Promise.all 자리 유지용 null)
        Promise.resolve({data:null}),
        // ── 전월 매출 ──
        dashSaleSource==='ups'
          ?sb.from('daily_sales').select('sale_date,total_sales,card_sales').eq('store_id',sid).gte('sale_date',pStart).lte('sale_date',pEnd)
          :sb.from('sales_daily').select('*').eq('store_id',sid).gte('date',pStart).lte('date',pEnd),
        // ── 일별 카테고리(아래) + 가마감 지출 집계 공유 ──
        sb.from('vendor_orders').select('id,order_group_id,amount,order_date,vendor_id,vendors(name,category,category_id)').eq('store_id',sid).gte('order_date',start).lte('order_date',end),
        sb.from('receipts').select('id,receipt_group_id,total_price,category_id,receipt_date,vendor_id,vendor,vendors(name)').eq('store_id',sid).eq('note','정상').eq('is_deposit',false).gte('receipt_date',start).lte('receipt_date',end),
        sb.from('attendance_logs').select('work_date,total_work_min,calculated_wage,employee_id,rest_start,rest_end,rest_status').eq('store_id',sid).gte('work_date',start).lte('work_date',end),
        // ── 전월 일별 식자재/영수증/인건비 ──
        sb.from('vendor_orders').select('order_date,amount').eq('store_id',sid).gte('order_date',pStart).lte('order_date',pEnd),
        sb.from('receipts').select('receipt_date,total_price').eq('store_id',sid).eq('note','정상').eq('is_deposit',false).gte('receipt_date',pStart).lte('receipt_date',pEnd),
        sb.from('attendance_logs').select('work_date,total_work_min,calculated_wage,employee_id').eq('store_id',sid).gte('work_date',pStart).lte('work_date',pEnd),
        sb.from('settlements').select('settle_date,items_json').eq('store_id',sid).gte('settle_date',start).lte('settle_date',end),
        // ── 당월 근무계획 (주휴수당 결근 차감 판정용 — 2026-06-17 직원 급여화면과 두 화면 통일) ──
        sb.from('work_schedules').select('employee_id,work_date,is_off,status').eq('store_id',sid).gte('work_date',start).lte('work_date',end)
      ]);
      // ── 자동 재시도 (2026-06-12 사장님 호소: 일시 500/제한시간 초과) ──
      //   서버가 잠깐 바빠 일부 조회 실패하면 짧게 쉬고 다시 시도 (최대 3번). 사장님 눈엔 안 보이게.
      let _packArr, _packOk=false;
      for(let _try=0; _try<3 && !_packOk; _try++){
        try{
          _packArr = await _runDashQueries();
          // 결과 중 하나라도 error 있으면(500/timeout) 재시도. 마지막 시도는 그대로 진행(아래 ||[] 가드가 받음)
          if(_packArr.some(r=>r && r.error) && _try<2){
            await new Promise(r=>setTimeout(r, 500*(_try+1)));
            continue;
          }
          _packOk=true;
        }catch(e){
          if(_try>=2) throw e;             // 3번째도 실패 = 바깥 catch로
          await new Promise(r=>setTimeout(r, 500*(_try+1)));
        }
      }
      [settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2, schedRes2] = _packArr;
      cacheSet(_dashKey, {settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2, schedRes2});
    }
    // SWR: 캐시 hit이면 5초 후 백그라운드로 fresh 호출 (force=true → setLoad 무음)
    if(_dashPack && !force){
      setTimeout(()=>loadDashboard(true).catch(_=>{}), 5000);
    }

    // 지출 카테고리 집계는 prefetch한 데이터로 메모리 처리 (calcExpenseByCategories 내부 DB 호출 0번)
    // 2026-05-18: 반환 객체화 {results, childAmounts} — 자식 amount도 함께
    const _calcExpRet=await calcExpenseByCategories(ym, dashMode, {
      vendor_orders: { data: voRes2.data },
      receipts: { data: rcRes2.data },
      attendance_logs: { data: attRes2.data },
      fixed_costs: { data: fcRes.data }
    });
    const expResults=_calcExpRet.results;
    const calcChildAmounts=_calcExpRet.childAmounts||{};

    // ══ 1. 일별 매출 맵 + 매출 집계 ══
    let salesBreakdown={},totalRevenue=0,dailySalesMap={},receiptCount=0;
    // 일별 카드매출 — 카드수수료를 카드매출 기준으로 일별 정확 계산 (2026-06-11 분리·보정)
    const dailyCardSalesMap={};
    const _cardMethodObj=(paymentMethods||[]).find(m=>m.legacy_key==='card');
    const settle=settleRes.data||[];

    if(dashSaleSource==='ups'){
      settle.forEach(s=>{
        const day=s.sale_date?.slice(8);
        const ds=s.total_sales||0;
        totalRevenue+=ds;dailySalesMap[day]=ds;
        if(day) dailyCardSalesMap[day]=s.card_sales||0;
      });
      salesBreakdown={'카드':settle.reduce((a,s)=>a+(s.card_sales||0),0),'현금':settle.reduce((a,s)=>a+(s.cash_sales||0),0)};
      salesBreakdown['기타']=totalRevenue-salesBreakdown['카드']-salesBreakdown['현금'];
    } else {
      // sales_daily 기준 (매출 관리 페이지와 동일 소스 — 수동 수정본 반영)
      // Part F Phase 2: paymentMethods 동적 집계. 신규 결제수단 자동 노출. (salesRowTotal+getMethodAmount 재사용)
      settle.forEach(s=>{
        const day=s.date?.slice(8);
        const ds=salesRowTotal(s);
        totalRevenue+=ds;dailySalesMap[day]=ds;
        // 카드매출: 결제수단 목록 의존 X — 목록 비어있어도 레거시 card 칸 직접 폴백 (2026-06-11 카드수수료 0 실종 보강)
        if(day) dailyCardSalesMap[day]=(_cardMethodObj?(getMethodAmount(s,_cardMethodObj)||0):0)||Number(s.card)||0;
        (paymentMethods||[]).forEach(m=>{
          const v=getMethodAmount(s,m);
          if(v) salesBreakdown[m.name]=(salesBreakdown[m.name]||0)+v;
        });
      });
    }
    receiptCount=Object.keys(dailySalesMap).length;

    // ══ 2. 지출 집계 ══
    const expData=expResults;
    const fcRows=fcRes.data||[];
    // 2단계: 이번 달 실제 납부액 반영 — 실제액 입력됐으면 예상 대신 실제 (2026-06-14)
    const _fcActualMap=await loadFcActualMap(sid, ym);

    // 고정비 일할계산 — 항목별 유효 월 금액(실제 납부액 우선) 합산 (활성 항목만)
    const fixedMonthly=fcRows.filter(r=>r.is_active!==false).reduce((a,r)=>a+fcEffectiveMonthly(r,_fcActualMap),0);
    // 카테고리별 일할 (차트 그룹 분리용: 고정비/공과금/마케팅/세금 등)
    const fcByCatMonthly={};
    fcRows.filter(r=>r.is_active!==false).forEach(r=>{
      const c=r.category||'고정비';
      fcByCatMonthly[c]=(fcByCatMonthly[c]||0)+fcEffectiveMonthly(r,_fcActualMap);
    });
    // 고정비 일할 — 캘린더(월카드)와 동일하게 '일별 카테고리별 반올림 × 경과일' 누적 (2026-06-16 수익 일치)
    //   옛: round(월합/lastDay*passedDays) 1회 반올림 → 캘린더(일별 반올림 누적, 1084줄)와 수십원 어긋남
    //   새: 일별 share(round(카테고리월합/lastDay)) × passedDays → 홈요약=캘린더=월카드 일치
    const fixedProratedByCat={};
    Object.keys(fcByCatMonthly).forEach(c=>{
      fixedProratedByCat[c]=Math.round(fcByCatMonthly[c]/lastDay)*passedDays;
    });
    const fixedProrated=Object.values(fixedProratedByCat).reduce((a,v)=>a+v,0);

    // 지출에서 고정비를 일할계산으로 교체
    const totalCostRaw=expData.reduce((a,e)=>a+e.amount,0);
    const fixedCatAmt=expData.filter(e=>e.source==='fixed_costs').reduce((a,e)=>a+e.amount,0);
    const totalCost=totalCostRaw-fixedCatAmt+fixedProrated;

    // 비용 비율
    const royaltyRate=parseFloat(settings.royalty_rate||0)/100;
    const cardFeeRate=parseFloat(settings.card_fee_rate||0)/100;
    // reserveRate / reserveFixed 폐기 (2026-05-22) — DB 컬럼은 보존
    // Part F Phase 2: 카드 매출은 legacy_key==='card' 결제수단 이름으로 찾기 (이름 변경 내성)
    // 'ups' 경로 호환을 위해 '카드' 폴백 유지
    const cardMethod=(paymentMethods||[]).find(m=>m.legacy_key==='card');
    // 마지막 폴백 = 일별 카드매출 합 (결제수단 목록 로드 전이어도 카드수수료 살아있게 — 2026-06-11)
    const _dailyCardSum=Object.values(dailyCardSalesMap).reduce((a,v)=>a+(v||0),0);
    const cardSales=(cardMethod?salesBreakdown[cardMethod.name]:0)||salesBreakdown['신용카드']||salesBreakdown['카드']||_dailyCardSum||0;

    // 로열티/카드수수료 — 진행일까지 일별 반올림 누적 (가마감 단일. 통장 기준 마감 폐기 2026-06-22)
    //   prorateByDay 정의: sidemenu.js. 캘린더(월카드)와도 동일 식이라 합 일치.
    const royalty=prorateByDay(dailySalesMap, royaltyRate, passedDays);
    const cardFee=prorateByDay(dailyCardSalesMap, cardFeeRate, passedDays);

    // ══ 핵심 수치 계산 ══
    const totalCostFull=totalCost+royalty+cardFee;
    const netProfit=totalRevenue-totalCostFull;
    // 예비비 / 실수익 폐기 (2026-05-22)

    // 마감예상 계산
    // 매출 분모 = 매출이 실제 입력된 마지막 날 (오늘 매출 0인데 지출만 있으면 오늘까지로 나누는 버그 방지, 2026-06-08)
    const _saleLastDay=Object.entries(dailySalesMap).reduce((mx,[k,v])=>((+v)>0?Math.max(mx,parseInt(k,10)):mx),0);
    const _saleDiv=(isCurrent && _saleLastDay>0)?_saleLastDay:passedDays;
    const variableCost=totalCost-fixedProrated;
    const estRevenue=isCurrent&&_saleDiv>0?Math.round(totalRevenue/_saleDiv*lastDay):totalRevenue;
    const estVariableCost=isCurrent&&passedDays>0?Math.round(variableCost/passedDays*lastDay):variableCost;
    const estTotalCost=fixedMonthly+estVariableCost;
    const estCardSales=isCurrent&&_saleDiv>0?Math.round(cardSales/_saleDiv*lastDay):cardSales;
    const estRoyalty=Math.round(estRevenue*royaltyRate);
    const estCardFee=Math.round(estCardSales*cardFeeRate);
    const estTotalCostFull=estTotalCost+estRoyalty+estCardFee;
    const estNetProfit=estRevenue-estTotalCostFull;
    // 마감예상 예비비 / 실수익 폐기 (2026-05-22)

    // ══ A-1. 월 요약 단일 표 (2026-05-15 갈아엎기) ══
    // 사장님 요청 — 매출/지출/카테고리/순수익/예비비/실수익 모두 한 표 + 월말예상 컬럼 통합
    //   - 행 정렬 일치: table-layout:fixed + colgroup 4컬럼
    //   - 카테고리 상위 3 + 우측 끝(월말예상 자리)에 "+ 더보기" → 펼치면 맨 아래 "− 접기"
    //   - 자식 카테고리 0원도 표시 (사장님 짚음 "카테고리 존재하면 보여야지")
    //   - 비율 = 매출 대비 (카테고리 % 합 = 지출 %, 정합)
    //   - ▾ 이름 우측 (도트 옆 짜침 해소)
    //   - 메인 숫자 크기 보존 — 메인/카테고리 위계 명확 (사장님 지시)
    const pctR=v=>totalRevenue>0?((v/totalRevenue)*100).toFixed(1)+'%':'–';
    const pctOf=v=>totalRevenue>0?(v/totalRevenue*100).toFixed(1):'0';

    // ── 지출 카테고리 데이터 계산 (한 표 빌드 위해 위로 이동) ──
    const expByGroup={};
    expData.forEach(e=>{
      if(e.source==='fixed_costs') return; // 고정비는 fixedProratedByCat에서 일할 합산
      expByGroup[e.name]=(expByGroup[e.name]||0)+(e.amount||0);
    });
    Object.entries(fixedProratedByCat).forEach(([cat,amt])=>{
      expByGroup[cat]=(expByGroup[cat]||0)+(amt||0);
    });
    if(royalty>0) expByGroup['로열티']=(expByGroup['로열티']||0)+royalty;
    if(cardFee>0) expByGroup['카드수수료']=(expByGroup['카드수수료']||0)+cardFee;
    // 주휴수당 월 집계 → expByGroup 인건비 항목에 합산 (summHtml 빌드 전이라 표에 반영됨)
    // 2026-06-21 회계 단일 진실: 근태·지출관리와 똑같은 calcMonthlyHolidayPay 함수로 통일 (결근 차감 포함)
    if(settings.weekly_holiday_pay_enabled){
      const _hpLaborKey=(expCategories||[]).find(c=>!c.parent_id&&c.data_source==='attendance')?.name||'인건비';
      const _hpMap=calcMonthlyHolidayPay(ym, attRes2.data||[], (schedRes2&&schedRes2.data)||[]);
      const _dashHp=Object.values(_hpMap).reduce((a,b)=>a+b,0);
      if(_dashHp>0) expByGroup[_hpLaborKey]=(expByGroup[_hpLaborKey]||0)+_dashHp;
    }

    const groupMeta={};
    (expCategories||[]).forEach(c=>{
      if(c.parent_id) return;
      groupMeta[c.name]={color:c.color||'#94A3B8', order:c.sort_order??999};
    });
    const SYS_META={
      '고정비':{color:'#FF9500',order:90},
      '공과금':{color:'#FB923C',order:91},
      '로열티':{color:'#EF4444',order:95},
      '카드수수료':{color:'#DC2626',order:96}
    };
    Object.entries(SYS_META).forEach(([k,v])=>{ if(!groupMeta[k]) groupMeta[k]=v; });

    // (옛 월요약 "표"(summHtml→#dashSummaryGrid) 빌드 제거 2026-06-21 — 화면 개편 때 DOM 삭제돼 안 뜨던 죽은 코드.
    //  홈 순익은 도넛 카드(v17)가 표시. 살아있는 값 expByGroup/totalCostFull/netProfit/예상값은 위에서 계산되어 유지됨.)

    // 예비비 잔고 미니 폐기 (2026-05-22)

    // ══ A-2. 일별 정산 테이블 ══
    const allDays=Array.from({length:lastDay},(_,i)=>String(i+1).padStart(2,'0'));
    // 일별 카테고리별 지출 맵 구축
    const dailyCatMap={}; // { '15': { '식자재': 520000, '인건비': 380000, ... } }
    const dailyExpTotal={}; // { '15': 1200000 }

    // ── 일별정산 카테고리 (DB 동적 생성) — 2026-05-22 갈아엎기 ──
    // 옛: 옛 _dailySrcs 3개 첫 매치만 잡음 → 주류/음료/마케팅/세금/기타 누락
    // 새: 활성 expense 부모 카테고리 전부 등록 (헌법 1-6 정당한 갈아엎기)
    const _COLOR_PALETTE=['#F59E0B','#8B5CF6','#6B7684','#10B981','#EC4899','#3B82F6','#EF4444','#84CC16','#F97316','#06B6D4','#A855F7','#14B8A6'];
    const _activeExpCats=(expCategories||[])
      .filter(c=>c.is_active&&c.category_type==='expense'&&!c.parent_id)
      .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    const catNames=[],catColors={},shortNames={},srcToCat={};
    _activeExpCats.forEach((cat,i)=>{
      catNames.push(cat.name);
      catColors[cat.name]=cat.color||_COLOR_PALETTE[i%_COLOR_PALETTE.length];
      if(cat.name.includes('/'))shortNames[cat.name]=cat.name.split('/')[0];
      else if(cat.name.includes('('))shortNames[cat.name]=cat.name.split('(')[0];
      else shortNames[cat.name]=cat.name.length>4?cat.name.slice(0,3):cat.name;
      // 첫 매치만 srcToCat에 박음 (옛 호환용 — vendor_orders는 vendor.category_id로 정확 분리하므로 fallback)
      if(cat.data_source && !srcToCat[cat.data_source]) srcToCat[cat.data_source]=cat.name;
    });
    // fixed_costs source 카테고리 목록 (옛 호환: 고정비 + 공과금 둘 다)
    const fixedCats=_activeExpCats.filter(c=>c.data_source==='fixed_costs');
    // 로열티·카드수수료 가상 카테고리 (expense_categories에 없음)
    // 2026-06-11 사장님 지시로 분리 — 옛 '로열티/수수료' 합산 폐기 (카드수수료가 로열티 줄에 숨어 보였음)
    catNames.push('로열티');
    catColors['로열티']='#EF4444';
    shortNames['로열티']='로열티';
    catNames.push('카드수수료');
    catColors['카드수수료']='#DC2626';
    shortNames['카드수수료']='수수료';
    // vendor_id → 카테고리명 매핑 (vendors.category_id 기반 — 주류/음료 정확 분리)
    const _vendorIdToCatName={};
    (vendors||[]).forEach(v=>{
      if(!v.category_id) return;
      const cat=(expCategories||[]).find(c=>c.id===v.category_id);
      if(!cat) return;
      // 자식이면 부모 카테고리명 (식자재>육류 → '식자재')
      const parent=cat.parent_id ? (expCategories||[]).find(c=>c.id===cat.parent_id) : cat;
      _vendorIdToCatName[v.id]=parent?.name||cat.name;
    });
    // category_id → 카테고리명 매핑 (receipts.category_id 기반)
    const _catIdToName={};
    (expCategories||[]).forEach(c=>{
      const parent=c.parent_id?(expCategories||[]).find(p=>p.id===c.parent_id):c;
      _catIdToName[c.id]=parent?.name||c.name;
    });

    // 일별 카테고리 데이터는 위 통합 Promise.all에서 이미 받음 (voRes2/rcRes2/attRes2/prevVoRes/prevRcRes/prevAttRes 재사용)
    const voDaily=voRes2.data,rcDaily=rcRes2.data,attDaily=attRes2.data;
    // ─── 새 기능: 월 소분류 집계 (월 보기 상세 패널 — 식자재>육류 등, 2026-06-03) ───
    const monthChildMap={}; // { '식자재': { '육류': {amt:120000,color:'#F00'}, ... }, ... }
    // ─── 새 기능: 일별 소분류 집계 (월 세부 화면 주차별 매트릭스 — 2026-06-03) ───
    // dailyChildMap[일][부모명][자식명] = 금액. 주차별로 합산해 식자재>육류 등 표시.
    // 인건비 고정급/시급은 카테고리 자식이 아니라 급여방식 기반 → 아래 별도 _addChildDayNamed로 박음.
    const dailyChildMap={}; // { '02': { '식자재': {'육류':12000,'야채':5000}, '인건비': {'고정급':...,'시급':...} } }
    const _childColorMap={}; // { '육류': '#F00', '고정급': '#3B82F6', ... } — 매트릭스 점 색
    const _addChildDayNamed=(d, parentName, childName, amt, color)=>{
      if(!d||!parentName||!childName||!amt||amt<=0)return;
      if(!dailyChildMap[d])dailyChildMap[d]={};
      if(!dailyChildMap[d][parentName])dailyChildMap[d][parentName]={};
      dailyChildMap[d][parentName][childName]=(dailyChildMap[d][parentName][childName]||0)+amt;
      if(color&&!_childColorMap[childName])_childColorMap[childName]=color;
    };
    const _catIdToChild={};
    (expCategories||[]).forEach(c=>{
      if(!c.parent_id)return;
      const parent=(expCategories||[]).find(p=>p.id===c.parent_id);
      if(!parent)return;
      _catIdToChild[c.id]={parentName:parent.name,childName:c.name,childColor:c.color||'#94A3B8'};
    });
    const _addChild=(catId,amt,d)=>{
      if(!catId||!amt||amt<=0)return;
      const m=_catIdToChild[catId];if(!m)return;
      if(!monthChildMap[m.parentName])monthChildMap[m.parentName]={};
      if(!monthChildMap[m.parentName][m.childName])monthChildMap[m.parentName][m.childName]={amt:0,color:m.childColor};
      monthChildMap[m.parentName][m.childName].amt+=amt;
      // 일별도 같이 박음 (주차별 매트릭스용)
      if(d)_addChildDayNamed(d, m.parentName, m.childName, amt, m.childColor);
    };
    // ─── 새 기능: 거래처별 일별 지출 집계 (홈 "어디에 썼나", 2026-06-02 / 2026-06-08 거래처+카테고리 키)
    // FK: vendor_id→vendors(name). 직구(vendor_id NULL)·거래처 삭제(ON DELETE SET NULL)는 '직접 구매'
    // 키 = '거래처명|카테고리' → 지출 시트 카테고리별 그룹핑 정확. 홈 미리보기는 renderTodayVendorExp에서 거래처명으로 재합산
    const dailyVendorExp={}; // { '02': { '농협|식자재': {name, cat, amt, isVar}, ... } }
    // isVar=true = 영수증·거래처 표에서 온 변동 지출 (어디에 썼나 표시 대상)
    // isVar=false = 고정비·인건비·로열티 등 자동 고정성 (어디에 썼나 제외)
    const _addVE=(d,name,amt,catName,isVar=false,groupKey=null)=>{
      if(!amt||amt<=0||!d)return;
      if(!dailyVendorExp[d])dailyVendorExp[d]={};
      const nm=name||'기타', ct=catName||'기타';
      const key=nm+'|'+ct;
      if(!dailyVendorExp[d][key])dailyVendorExp[d][key]={name:nm,cat:ct,amt:0,isVar:false,_g:new Set()};
      dailyVendorExp[d][key].amt+=amt;
      if(isVar)dailyVendorExp[d][key].isVar=true;
      // 영수증/주문 묶음 키 수집 → "영수증 N건" 표시용 (2026-06-11 사장님 목업)
      if(groupKey)dailyVendorExp[d][key]._g.add(groupKey);
    };
    // 월급제 직원 ID 셋 (attendance_logs 합산 시 제외 — 월급제는 매일 1/N 분배 별도)
    const monthlyEmpIds=new Set((employees||[]).filter(e=>e.wage_type==='monthly').map(e=>e.id));
    // 2026-05-22: vendor.category_id 기반 정확 분리 (주류/음료/식자재 따로)
    (voDaily||[]).forEach(v=>{
      const d=v.order_date?.slice(8);if(!d)return;
      const k = (v.vendors?.category_id && _catIdToName[v.vendors.category_id])
        || srcToCat['vendor_orders'] || '식자재';
      if(!dailyCatMap[d])dailyCatMap[d]={};
      dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+(v.amount||0);
      _addVE(d, v.vendors?.name||'거래처', v.amount, k, true, 'o:'+(v.order_group_id||v.id));
      _addChild(v.vendors?.category_id, v.amount, d);
    });
    (rcDaily||[]).forEach(r=>{
      const d=r.receipt_date?.slice(8);if(!d)return;
      const k = (r.category_id && _catIdToName[r.category_id])
        || srcToCat['receipts'] || '비품';
      if(!dailyCatMap[d])dailyCatMap[d]={};
      dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+(r.total_price||0);
      // 이름 우선순위: 등록 거래처(vendors.name) > 영수증 상호 텍스트(vendor) > '직접 구매'
      // 직구(vendor_id NULL)도 영수증에 찍힌 상호명 그대로 표시 (2026-06-05 '논산농협 하나로마트')
      _addVE(d, r.vendors?.name||r.vendor||'직접 구매', r.total_price, k, true, 'r:'+(r.receipt_group_id||r.id));
      _addChild(r.category_id, r.total_price, d);
    });
    // 인건비 부모 이름 (srcToCat 기준) — 월급/시급 하위는 이 부모 아래로 박음
    const _laborParentName = srcToCat['attendance'] || '인건비';
    // 인건비 자식을 월 집계(monthChildMap)에도 동시 박음 — 월상세 아코디언·주간 표 표시용 (2026-06-11 사장님 호소)
    // 옛: dailyChildMap에만 박아서 월상세 "카테고리별 지출" 펼침과 주간 표 자식 줄에 인건비가 안 나왔음
    // 이름은 DB 자식 분류(월급/시급)와 통일 — 홈 월요약 "+상세보기"(calcChildAmounts)와 같은 이름
    const _addLaborChild=(d, childName, amt, color)=>{
      if(!amt||amt<=0)return;
      if(!monthChildMap[_laborParentName])monthChildMap[_laborParentName]={};
      if(!monthChildMap[_laborParentName][childName])monthChildMap[_laborParentName][childName]={amt:0,color};
      monthChildMap[_laborParentName][childName].amt+=amt;
      _addChildDayNamed(d, _laborParentName, childName, amt, color);
    };
    (attDaily||[]).forEach(a=>{
      if(monthlyEmpIds.has(a.employee_id)) return; // 월급제는 별도 분배
      const d=a.work_date?.slice(8);if(!d)return;
      if(!dailyCatMap[d])dailyCatMap[d]={};
      const k=srcToCat['attendance'];dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+(a.calculated_wage||0);
      _addVE(d, '직원 급여', a.calculated_wage, '인건비');
      // 시급제 → 인건비 하위 '시급' (월 집계 + 일별 둘 다 — 2026-06-11)
      _addLaborChild(d, '시급', a.calculated_wage||0, '#60A5FA');
    });
    // ─── 마감 차감 일자별 분배 — 카테고리 매칭 → 해당 카테고리 키 (2026-05-18 통일) ───
    // 인건비 부모/자식 → 인건비 키, 식자재 부모/자식 → 식자재 키 등
    const _dailyCatIdToKey={};
    Object.keys(srcToCat).forEach(src=>{
      const parent=(expCategories||[]).find(c=>c.data_source===src&&!c.parent_id);
      if(parent){
        _dailyCatIdToKey[parent.id]=srcToCat[src];
        (expCategories||[]).filter(c=>c.parent_id===parent.id).forEach(ch=>{
          _dailyCatIdToKey[ch.id]=srcToCat[src];
        });
      }
    });
    (setRes2.data||[]).forEach(s=>{
      const d=s.settle_date?.slice(8);if(!d)return;
      (s.items_json?.deductions||[]).forEach(deduct=>{
        if(deduct.category_id && deduct.amount){
          const key=_dailyCatIdToKey[deduct.category_id];
          if(key){
            if(!dailyCatMap[d])dailyCatMap[d]={};
            dailyCatMap[d][key]=(dailyCatMap[d][key]||0)+Number(deduct.amount);
          }
        }
      });
    });
    // ─── 새 기능: 월급제 직원 일별 인건비 분배 (헌법 1-6, 2026-05-05) ───
    // 시급제는 attendance_logs.calculated_wage 그대로(위), 월급제는 매일 monthly_wage(만원)*10000/해당월일수
    // 쉬는 날도 1/N 박음 (월급은 변동 없음). hire_date/resign_date 고려.
    const monthlyEmps=(employees||[]).filter(e=>e.is_active&&e.wage_type==='monthly'&&e.monthly_wage>0);
    if(monthlyEmps.length){
      monthlyEmps.forEach(emp=>{
        const dailyWage=Math.round((emp.monthly_wage*10000)/lastDay); // 만원→원, 월급/N
        const hire=emp.hire_date?new Date(emp.hire_date+'T00:00:00'):null;
        const resign=emp.resign_date?new Date(emp.resign_date+'T00:00:00'):null;
        allDays.forEach(d=>{
          const dayNum=parseInt(d);
          if(dayNum>passedDays) return; // 미래 날짜 제외
          const date=new Date(ym+'-'+d+'T00:00:00');
          if(hire&&date<hire) return; // 입사 전
          if(resign&&date>resign) return; // 퇴사 후
          if(!dailyCatMap[d])dailyCatMap[d]={};
          const k=srcToCat['attendance'];
          dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+dailyWage;
          _addVE(d, '직원 급여', dailyWage, '인건비');
          // 월급제 → 인건비 하위 '월급' (DB 자식 분류명 통일, 월 집계 + 일별 둘 다 — 2026-06-11)
          _addLaborChild(d, '월급', dailyWage, '#3B82F6');
        });
      });
    }
    // 주휴수당 일별 배분 — 해당 주 마지막 근무일에 집중 (시급제만)
    // 2026-06-17: 결근 차감 설정 반영 — 직원 급여화면(calcMonthlyHolidayPay)과 동일 기준으로 두 화면 통일
    if(settings.weekly_holiday_pay_enabled){
      const _hpMEmpIds2=new Set((employees||[]).filter(e=>e.wage_type==='monthly').map(e=>e.id));
      // 출근 있은 날 집합(직원별) + 근무계획(직원별 날짜→행) — 결근 차감 판정용
      const _attPresent={}, _schedByEmp={};
      (attDaily||[]).forEach(a=>{ (_attPresent[a.employee_id]||(_attPresent[a.employee_id]=new Set())).add(a.work_date); });
      ((schedRes2&&schedRes2.data)||[]).forEach(s=>{ (_schedByEmp[s.employee_id]||(_schedByEmp[s.employee_id]={}))[s.work_date]=s; });
      const _hp2Map={};
      (attDaily||[]).forEach(a=>{
        if(_hpMEmpIds2.has(a.employee_id)||!(a.total_work_min>0)) return;
        const dt=new Date(a.work_date+'T00:00:00');
        const wsKey=ymdLocal(new Date(dt.getTime()-((dt.getDay()+6)%7)*86400000));
        const k=a.employee_id+'_'+wsKey;
        if(!_hp2Map[k]) _hp2Map[k]={empId:a.employee_id,min:0,lastDay:null,wsKey};
        _hp2Map[k].min+=a.total_work_min;
        if(!_hp2Map[k].lastDay||a.work_date>_hp2Map[k].lastDay) _hp2Map[k].lastDay=a.work_date;
      });
      Object.values(_hp2Map).forEach(({empId,min,lastDay,wsKey})=>{
        if(min<15*60||!lastDay||!lastDay.startsWith(ym)) return;
        // 결근 차감 ON → 그 주 근무예정일(근무계획 is_off=false)에 출근 없으면 주휴수당 없음 (급여화면 attendance.js:629-631과 동일)
        if(settings.weekly_holiday_pay_deduct_absent){
          const _ws=new Date(wsKey+'T00:00:00');
          const weekDays=[]; for(let i=0;i<7;i++) weekDays.push(ymdLocal(new Date(_ws.getTime()+i*86400000)));
          const empSched=_schedByEmp[empId]||{}, empAtt=_attPresent[empId]||new Set();
          const schedDays=weekDays.filter(wd=>{ const s=empSched[wd]; return s&&!s.is_off&&s.status==='확정'; }); // 확정 근무계획만 (미승인 신청 제외 — 직원 보호)
          if(schedDays.length>0 && schedDays.some(wd=>!empAtt.has(wd))) return; // 결근 → 주휴수당 스킵
        }
        const emp=(employees||[]).find(e=>e.id===empId);
        if(!emp) return;
        const hp=Math.round(Math.min(min/60/5,8)*(emp.base_wage||10030));
        const d=lastDay.slice(8);
        if(!dailyCatMap[d]) dailyCatMap[d]={};
        const k=srcToCat['attendance']||'인건비';
        dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+hp;
        _addVE(d,'주휴수당',hp,'인건비');
        _addLaborChild(d,'주휴수당',hp,'#34D399');
      });
    }
    // 고정비 카테고리별 일할 (고정비/공과금 분리)
    const dailyFixedShareByCat={};
    fixedCats.forEach(cat=>{
      dailyFixedShareByCat[cat.name]=Math.round((fcByCatMonthly[cat.name]||0)/lastDay);
    });

    // 일별 합계 계산
    allDays.forEach(d=>{
      const dayNum=parseInt(d);
      if(dayNum>passedDays) return;
      const hasSale=dailySalesMap.hasOwnProperty(d);
      // hasSale 여부와 무관하게 지출은 항상 계산 (매출 미입력일에도 실시간 지출 표시 — 2026-06-05)
      if(!dailyCatMap[d])dailyCatMap[d]={};
      fixedCats.forEach(cat=>{
        if(dailyFixedShareByCat[cat.name]>0){ dailyCatMap[d][cat.name]=dailyFixedShareByCat[cat.name]; _addVE(d, cat.name, dailyFixedShareByCat[cat.name], '고정비'); }
      });
      // 로열티 = 해당일 전체 매출 × 요율 / 카드수수료 = 해당일 카드매출 × 요율 (2026-06-11 분리 + 과대 계상 보정)
      // 옛: 카드수수료도 전체 매출 기준 → 현금·송금 매출에까지 1.5% 곱해 홈 월요약과 어긋났음
      const daySale=dailySalesMap[d]||0;
      const dayRoyalty=Math.round(daySale*royaltyRate);
      const dayCardFee=Math.round((dailyCardSalesMap[d]||0)*cardFeeRate);
      if(dayRoyalty>0){ dailyCatMap[d]['로열티']=dayRoyalty; _addVE(d, '로열티', dayRoyalty, '로열티'); }
      if(dayCardFee>0){ dailyCatMap[d]['카드수수료']=dayCardFee; _addVE(d, '카드수수료', dayCardFee, '카드수수료'); }
      // 일별 지출 합계
      let dayExp=0;
      catNames.forEach(c=>{dayExp+=(dailyCatMap[d]?.[c]||0);});
      dailyExpTotal[d]=dayExp;
    });

    // ══ 전월 데이터 처리 (MoM 비교용) ══
    const prevSettle=prevSettleRes.data||[];
    let prevTotalRevenue=0;const prevDailySalesMap={};
    // 전월 일별 카드매출 (카드수수료 분리 계산용 — 2026-06-11)
    let prevCardTotal=0;const prevDailyCardSalesMap={};
    if(dashSaleSource==='ups'){
      prevSettle.forEach(s=>{
        const d=s.sale_date?.slice(8);prevTotalRevenue+=(s.total_sales||0);if(d)prevDailySalesMap[d]=s.total_sales||0;
        const cv=s.card_sales||0;prevCardTotal+=cv;if(d)prevDailyCardSalesMap[d]=cv;
      });
    } else {
      // sales_daily 기준 (본 매출)
      prevSettle.forEach(s=>{
        const d=s.date?.slice(8);
        const ds=salesRowTotal(s);
        prevTotalRevenue+=ds;if(d)prevDailySalesMap[d]=ds;
        // 결제수단 목록 비어있어도 레거시 card 칸 직접 폴백 (2026-06-11)
        const cv=((_cardMethodObj?(getMethodAmount(s,_cardMethodObj)||0):0)||Number(s.card)||0);
        prevCardTotal+=cv;if(d)prevDailyCardSalesMap[d]=cv;
      });
    }
    // 전월 일별 식자재/인건비/영수증 (월급제 직원은 별도 분배)
    let prevVendorTotal=0,prevAttTotal=0,prevReceiptTotal=0;
    const prevDailyVendor={},prevDailyAtt={},prevDailyReceipt={};
    (prevVoRes.data||[]).forEach(v=>{const d=v.order_date?.slice(8);if(!d)return;prevVendorTotal+=(v.amount||0);prevDailyVendor[d]=(prevDailyVendor[d]||0)+(v.amount||0);});
    (prevAttRes.data||[]).forEach(a=>{
      if(monthlyEmpIds.has(a.employee_id)) return; // 월급제는 별도 분배
      const d=a.work_date?.slice(8);if(!d)return;
      prevAttTotal+=(a.calculated_wage||0);prevDailyAtt[d]=(prevDailyAtt[d]||0)+(a.calculated_wage||0);
    });
    (prevRcRes.data||[]).forEach(r=>{const d=r.receipt_date?.slice(8);if(!d)return;prevReceiptTotal+=(r.total_price||0);prevDailyReceipt[d]=(prevDailyReceipt[d]||0)+(r.total_price||0);});
    // 전월 주차 그룹 + 일자 배열
    const prevAllDays=Array.from({length:pLastDay},(_,i)=>String(i+1).padStart(2,'0'));
    const prevWeekGroups=[];let pCurW=[];
    prevAllDays.forEach(d=>{const dt=new Date(pY,pMo-1,parseInt(d));pCurW.push(d);if(dt.getDay()===0||d===prevAllDays[prevAllDays.length-1]){prevWeekGroups.push([...pCurW]);pCurW=[];}});
    // 전월 월급제 분배 (이번달과 동일 로직, pLastDay 기준)
    if(monthlyEmps.length){
      monthlyEmps.forEach(emp=>{
        const dailyWage=Math.round((emp.monthly_wage*10000)/pLastDay);
        const hire=emp.hire_date?new Date(emp.hire_date+'T00:00:00'):null;
        const resign=emp.resign_date?new Date(emp.resign_date+'T00:00:00'):null;
        prevAllDays.forEach(d=>{
          const date=new Date(`${pY}-${String(pMo).padStart(2,'0')}-${d}T00:00:00`);
          if(hire&&date<hire) return;
          if(resign&&date>resign) return;
          prevAttTotal+=dailyWage;
          prevDailyAtt[d]=(prevDailyAtt[d]||0)+dailyWage;
        });
      });
    }
    // 전월 고정비/로열티/카드수수료 — 모든 달 동일한 예상 월 금액 사용
    const prevFcMonthly=fixedMonthly;
    const prevRoyalty=Math.round(prevTotalRevenue*royaltyRate);
    // 카드수수료 = 카드매출 기준 (2026-06-11 보정 — 옛: 전체매출 기준 과대 계상)
    const prevCardFee=Math.round(prevCardTotal*cardFeeRate);
    const prevTotalCostFull=prevVendorTotal+prevReceiptTotal+prevAttTotal+prevFcMonthly+prevRoyalty+prevCardFee;
    // 전월 주차별 매출/지출/식자재/인건비
    const prevWeekData=prevWeekGroups.map(wk=>{
      let wS=0,wV=0,wA=0,wR=0,wCS=0;
      wk.forEach(d=>{wS+=(prevDailySalesMap[d]||0);wV+=(prevDailyVendor[d]||0);wA+=(prevDailyAtt[d]||0);wR+=(prevDailyReceipt[d]||0);wCS+=(prevDailyCardSalesMap[d]||0);});
      const wFx=Math.round(prevFcMonthly/pLastDay*wk.length);
      const wRoy=Math.round(wS*royaltyRate),wCf=Math.round(wCS*cardFeeRate);
      return{sales:wS,expense:wV+wR+wA+wFx+wRoy+wCf,vendor:wV,att:wA};
    });
    // ── 전월대비 문구 헬퍼 ──
    const momTxt=(curr,prev,isRevType)=>{
      if(!prev||prev===0)return null;
      const diff=curr-prev,pct=Math.round(Math.abs(diff)/prev*100),up=diff>0;
      if(pct<=2)return{text:'비슷',cls:'',arrow:'',pct:0};
      const cls=isRevType?(up?'mom-good':'mom-bad'):(up?'mom-bad':'mom-good');
      return{text:`${fmt(Math.abs(diff))}(${up?'▲':'▼'}${pct}%)`,cls,arrow:up?'▲':'▼',pct,up};
    };

    // ── 매출대비 비교 (식자재/인건비 vs 전월) — DOM 삽입 ──
    // 카테고리 데이터 빌더가 위로 옮겨졌으나 prev*은 여기서 정의되므로 분리 처리 (TDZ 회피)
    if(prevTotalRevenue>0 && totalRevenue>0){
      const currVendor=expByGroup['식자재']||0,currAtt=expByGroup['인건비']||0;
      const mV=momTxt(currVendor,prevVendorTotal,false),mA=momTxt(currAtt,prevAttTotal,false);
      let h='';
      if(mV){const ic=mV.text==='비슷'?'✅':mV.up?'⚠️':'✅';
        h+=`<div class="mom-text">${ic} 식자재 지난달보다 매출대비 ${mV.text==='비슷'?'비슷해요':`<span class="${mV.cls}">${mV.text}</span> ${mV.up?'늘었어요':'줄었어요'}`}</div>`;}
      if(mA){const ic=mA.text==='비슷'?'✅':mA.up?'⚠️':'✅';
        h+=`<div class="mom-text">${ic} 인건비 지난달보다 매출대비 ${mA.text==='비슷'?'비슷해요':`<span class="${mA.cls}">${mA.text}</span> ${mA.up?'늘었어요':'줄었어요'}`}</div>`;}
      if(h){
        const row=document.getElementById('momCatRow'),body=document.getElementById('momCatBody');
        if(row && body){body.innerHTML=h; row.style.display='';}
      }
    }

    // ── AI 인사이트 직원 자동 브리핑은 아래(홈 월요약 계산 후)로 이동 ──
    //    월요약(_v17MonthStats fcProfit)과 동일 계산으로 통일 위해 setV17Context 이후에 호출

    // ── 전월대비 문구 (월 요약) — DOM 삽입 ──
    // 당월 매출 0이면 비교 의미 없음 → 숨김 (사장님 요청 2026-05-06)
    if(prevTotalRevenue>0 && totalRevenue>0){
      const mRev=momTxt(totalRevenue,prevTotalRevenue,true);
      const mExp=momTxt(totalCostFull,prevTotalCostFull,false);
      let momLine='지난달보다 ';
      if(mRev&&mRev.text==='비슷'&&mExp&&mExp.text==='비슷'){momLine+='매출·지출 모두 비슷해요 ✅';}
      else{
        const parts=[];
        if(mRev&&mRev.text!=='비슷')parts.push(`매출 <span class="${mRev.cls}">${mRev.text}</span> ${mRev.up?'늘고':'줄고'}`);
        if(mExp&&mExp.text!=='비슷')parts.push(`지출 <span class="${mExp.cls}">${mExp.text}</span> ${mExp.up?'늘었어요':'줄었어요'}`);
        momLine+=parts.join(', ');
        const revUp=mRev&&mRev.up,expUp=mExp&&mExp.up;
        momLine+=' '+(revUp&&!expUp?'👍':(!revUp&&expUp)?'⚠️':revUp&&expUp?'📈':'📉');
      }
      const momEl=document.getElementById('momSummaryText');
      if(momEl){momEl.innerHTML=momLine;momEl.style.display='';}
    }

    // 주차 구분 (월~일 기준: 평일/주말 패턴 유지)
    const weekGroups=[];
    let curWeek=[];
    allDays.forEach(d=>{
      const dt=new Date(y,mo-1,parseInt(d));
      const dow=dt.getDay(); // 0=일
      curWeek.push(d);
      if(dow===0||d===allDays[allDays.length-1]){
        weekGroups.push([...curWeek]);
        curWeek=[];
      }
    });

    // 토스 카드 스타일 일별정산
    const weekSummaries=[];
    const pctS=(v,base)=>base>0?((v/base)*100).toFixed(1):'0';
    // catColors, shortNames는 위에서 DB 기반 동적 생성됨

    let dailyHtml='';
    for(let wi=0;wi<weekGroups.length;wi++){
      const week=weekGroups[wi];
      let wS=0,wE=0,wP=0,wHas=false;
      const wC={};catNames.forEach(c=>{wC[c]=0;});

      // 일별 카드 모으기
      let dayCardsHtml='';
      for(let di=0;di<week.length;di++){
        const d=week[di];
        const dayNum=parseInt(d);
        if(dayNum>passedDays) continue;
        const has=dailySalesMap.hasOwnProperty(d);
        const s=dailySalesMap[d]||0;
        const e=has?(dailyExpTotal[d]||0):0;
        const p=s-e;
        if(has){wS+=s;wE+=e;wP+=p;wHas=true;catNames.forEach(c=>{wC[c]+=(dailyCatMap[d]?.[c]||0);});}
        if(!has) continue;

        // 카테고리 도트 리스트
        let catDotsHtml='';
        catNames.forEach(c=>{
          const v=dailyCatMap[d]?.[c]||0;
          if(!v) return;
          const color=catColors[c]||'#4E5968';
          const pct=s>0?pctS(v,s)+'%':'';
          catDotsHtml+=`<span class="dc-item"><span class="dc-dot" style="background:${color};"></span>${shortNames[c]} <span class="dc-val">${fmt(v)}</span> <span class="dc-pct" style="color:${color};">${pct}</span></span>`;
        });

        const profitCls=p>=0?'amt-green':'amt-red';
        dayCardsHtml+=`<div class="dt-day-item" style="cursor:pointer;">
          <div class="dt-day-top">
            <span class="dt-day-date">${mo}/${dayNum}</span>
            <span class="dt-day-profit ${profitCls}">${p>=0?'+':''}${fmt(p)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);font-weight:600;">
            <span>매출 <b style="color:var(--blue);">${fmt(s)}</b></span>
            <span>지출 <b style="color:var(--danger);">${fmt(e)}</b></span>
          </div>
          <div class="dt-day-cats" style="display:none;margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-100);">${catDotsHtml}</div>
        </div>`;
      }

      if(!wHas) continue;

      // 주계 카테고리 바 (전체 카테고리 표시, 0원도 포함)
      let wCatsHtml='';
      catNames.forEach(c=>{
        const color=catColors[c]||'#4E5968';
        const pct=wS>0?pctS(wC[c]||0,wS)+'%':'0%';
        wCatsHtml+=`<span class="wc-item"><span class="wc-dot" style="background:${color};"></span>${shortNames[c]} <span class="wc-amt">${fmt(wC[c]||0)}</span> <span class="wc-pct" style="color:${color};">${pct}</span></span>`;
      });

      const wProfitCls=wP>=0?'amt-green':'amt-red';
      // 현재 주인지 판단 (passedDays가 이 주에 포함되면 현재 주)
      const isCurrentWeek=week.some(d=>parseInt(d)===passedDays);
      const collapsed=!isCurrentWeek;
      dailyHtml+=`<div class="dt-week-card">
        <div class="dt-week-header" data-week="${wi}">
          <span class="wk-title">${collapsed?'▶':'▼'} ${wi+1}주 <span style="font-size:11px;font-weight:600;color:var(--gray-400);">${mo}/${parseInt(week[0])}~${mo}/${parseInt(week[week.length-1])}</span></span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:var(--gray-600);">
          <span>매출 <b style="color:var(--blue);">${fmt(wS)}</b></span>
          <span>지출 <b style="color:var(--danger);">${fmt(wE)}</b></span>
          <span>순수익 <b class="${wProfitCls}">${wP>=0?'+':''}${fmt(wP)}</b></span>
        </div>
        <div class="dt-week-cats">${wCatsHtml}</div>
        ${(()=>{
          const pw=prevWeekData[wi];
          if(!pw||pw.sales<=0)return '';
          const vendorCat=srcToCat['vendor_orders'],attCat=srcToCat['attendance'];
          const mS=momTxt(wS,pw.sales,true),mE=momTxt(wE,pw.expense,false);
          const mV=momTxt(wC[vendorCat]||0,pw.vendor,false),mA=momTxt(wC[attCat]||0,pw.att,false);
          const pts=[];
          if(mS&&mS.text!=='비슷')pts.push(`매출<span class="${mS.cls}">${mS.arrow}${mS.pct}%</span>`);
          if(mE&&mE.text!=='비슷')pts.push(`지출<span class="${mE.cls}">${mE.arrow}${mE.pct}%</span>`);
          const cats=[];
          if(mV&&mV.text!=='비슷')cats.push(`식자재<span class="${mV.cls}">${mV.arrow}${mV.pct}%</span>`);
          if(mA&&mA.text!=='비슷')cats.push(`인건비<span class="${mA.cls}">${mA.arrow}${mA.pct}%</span>`);
          if(!pts.length&&!cats.length)return `<div class="mom-text mom-week">vs전월 비슷해요 ✅</div>`;
          let txt='vs전월 ';
          if(pts.length)txt+=pts.join(' ');
          if(cats.length)txt+=(pts.length?' ｜매출대비 ':' 매출대비 ')+cats.join(' ');
          return `<div class="mom-text mom-week">${txt}</div>`;
        })()}
        <div class="dt-day-list" data-wkbody="${wi}" ${collapsed?'style="display:none;"':''}>${dayCardsHtml}</div>
      </div>`;

      const isCompleteWeek=(wi<weekGroups.length-1)||!isCurrent;
      weekSummaries.push({week:wi+1,profit:wP,done:isCompleteWeek});
    }

    // 옛 dashDailyTable null safe (Phase 2 후 DOM 없음)
    const _dtEl = document.getElementById('dashDailyTable');
    if(_dtEl) _dtEl.innerHTML = dailyHtml || '';

    // ═══ v17 정산현황 (2026-05-22) ═══
    // 옛 dailySalesMap/dailyExpTotal/dailyCatMap → v17 컨텍스트로 변환 + 호출
    try{
      // 전월 (4월) 데이터를 v17 DAYS에 추가 (동일 기준일 비교 + 1주 vs 전월 마지막주)
      const prevDailyMap = {};
      const prevYM = `${y}-${String(mo-1).padStart(2,'0')}`;
      const prevLast = new Date(y, mo-1, 0).getDate();
      for(let d=1; d<=prevLast; d++){
        const dd = String(d).padStart(2,'0');
        const k = `${mo-1}-${dd}`;
        const sale = prevDailySalesMap[dd] || 0;
        const vendor = prevDailyVendor[dd] || 0;
        const att = prevDailyAtt[dd] || 0;
        const receipt = prevDailyReceipt[dd] || 0;
        const fixed = Math.round((prevFcMonthly||0)/prevLast); // 일할
        const royalty = Math.round(sale * royaltyRate);
        const cardFee = Math.round((prevDailyCardSalesMap[dd]||0) * cardFeeRate); // 카드매출 기준 (2026-06-11)
        const exp = vendor + att + receipt + fixed + royalty + cardFee;
        if(sale > 0 || exp > 0){
          // 2026-05-22 byCat 추가 (동적 카테고리 비교용) / 2026-06-11 로열티·카드수수료 분리
          const byCat = {
            '식자재': vendor,
            '인건비': att,
            '비품': receipt,
            '고정비': fixed,
            '공과금': 0,
            '로열티': royalty,
            '카드수수료': cardFee,
          };
          prevDailyMap[k] = {sale, vendor, att, fixed, receipt, royalty, cardFee, exp, profit: sale-exp, byCat};
        }
      }
      // 휴무 일자 set (sales_daily.source='closed')
      const holidayDays = new Set();
      (settleRes?.data||[]).forEach(s=>{
        if(s.source==='closed'){ const d=s.date?.slice(8); if(d) holidayDays.add(d); }
      });
      // fixed_costs source 카테고리 이름 목록 (사장님 매장: '고정비' + '공과금')
      const fixedCatNames = (typeof fixedCats !== 'undefined' && fixedCats) ? fixedCats.map(c=>c.name) : [];
      setV17Context({
        year: y, monthIdx: mo-1, lastDay, passedDays, today, isCurrent,
        dailySalesMap, dailyExpTotal, dailyCatMap, srcToCat, fixedCatNames,
        prevDailyMap, holidayDays,
        // 2026-05-22 동적 카테고리
        catNames, catColors,
        expCatThresholds: settings.expense_thresholds || {},
        royaltyRate,
        monthChildMap,
        dailyChildMap, childColorMap: _childColorMap,
      });
      v17RenderAll();
    } catch(e){ console.error('v17 렌더 오류:', e); }
    // ═══ v17 끝 ═══

    // ══ A-4. 지출 카테고리 — 월 요약 단일 표로 통합됨 (위 빌더 참조, 2026-05-15) ══
    // ══ A-1b. 매출 결제수단별 분해 제거 (2026-05-15) ══
    // ══ A-5. 일별 차트 제거 (2026-05-15) — 주단위 요약 카드와 정보 중복 ══
    destroyChart('dailyChart');

    // ─── 매출 통합 카드 (매출+지출+순수익) — 모든 달에서 표시, 날짜 커서로 위·아래 연동 (2026-06-03) ─── //
    const isCurMonth=today.toISOString().slice(0,7)===dashMonthStr;
    const topCard=document.getElementById('dashTopSalesCard');
    {
      // 전월 일별 지출 맵 (% 비교용, 변동성 큰 vendor/receipt/attendance만)
      const prevDailyExpTotal={};
      (prevVoRes.data||[]).forEach(v=>{const d=v.order_date?.slice(8);if(!d)return;prevDailyExpTotal[d]=(prevDailyExpTotal[d]||0)+(v.amount||0);});
      (prevRcRes.data||[]).forEach(r=>{const d=r.receipt_date?.slice(8);if(!d)return;prevDailyExpTotal[d]=(prevDailyExpTotal[d]||0)+(r.total_price||0);});
      (prevAttRes.data||[]).forEach(a=>{if(monthlyEmpIds.has(a.employee_id))return;const d=a.work_date?.slice(8);if(!d)return;prevDailyExpTotal[d]=(prevDailyExpTotal[d]||0)+(a.calculated_wage||0);});

      // 최근 매출일 찾기 (passedDays까지, source='closed'는 매출 0이라 자동 제외됨)
      const sortedDays=Object.keys(dailySalesMap).filter(d=>parseInt(d)<=passedDays && dailySalesMap[d]>0).sort();
      const lastSaleDay=sortedDays[sortedDays.length-1]||null;
      const isUpsMode=(dashSaleSource==='ups');
      // 오늘 마감 완료 여부 — settlements 테이블에 오늘 날짜 행이 있으면 마감 완료
      const _todayDD=String(passedDays).padStart(2,'0');
      const isTodaySettled=(setRes2?.data||[]).some(s=>s.settle_date?.slice(8)===_todayDD);

      _topCardCtx={
        ym, mo,
        dailySalesMap, dailyExpTotal, dailyVendorExp,
        prevDailySalesMap, prevDailyExpTotal,
        isUpsMode, isTodaySettled, momTxt,
        // 어디에 썼나 = veMap의 isVar(영수증·거래처 출처)로 필터 (renderTodayVendorExp, 2026-06-05 빙산 수정)
      };
      topCard.style.display='block';

      // ── 할 일 알림 배너: 이번 달 매출 있는데 마감(정산) 안 한 지난 날 ──
      const _todoEl=document.getElementById('dashTodoAlert');
      if(_todoEl){
        const unsettled=[];   // 미마감 일자(숫자) 목록
        if(isCurMonth){
          const settledSet=new Set((setRes2?.data||[]).map(s=>s.settle_date?.slice(8)).filter(Boolean));
          const closedSet=new Set();
          (settleRes?.data||[]).forEach(s=>{ if(s.source==='closed'){const d=s.date?.slice(8); if(d)closedSet.add(d);} });
          Object.keys(dailySalesMap).forEach(d=>{
            const di=parseInt(d,10);
            if(di>=passedDays) return;           // 오늘·미래 제외 (오늘은 아직 안 해도 정상)
            if((dailySalesMap[d]||0)<=0) return; // 매출 없는 날 제외
            if(closedSet.has(d)) return;         // 휴무 제외
            if(settledSet.has(d)) return;        // 이미 마감
            unsettled.push(di);
          });
        }
        if(unsettled.length>0){
          unsettled.sort((a,b)=>b-a);            // 최근 날 먼저
          const recent=unsettled[0];
          const isYesterday=(recent===passedDays-1);
          const dayLabel=`${mo}/${recent}`;
          const head=isYesterday ? `<b>어제(${dayLabel})</b> 마감을 안 했어요` : `<b>${dayLabel}</b> 마감을 안 했어요`;
          const more=unsettled.length>1 ? ` <span style="opacity:.75;">외 ${unsettled.length-1}일</span>` : '';
          _todoEl.innerHTML=`<span class="todo-ic">🔔</span><span class="todo-tx">${head}${more}</span><span class="todo-go">›</span>`;
          _todoEl.style.display='';
        } else { _todoEl.style.display='none'; }
      }

      // 표시할 날짜: ① 일 네비로 넘어온 특정일(같은 달) ② 현재달=오늘 / 과거달=마지막 영업일·말일
      let _initDay;
      if(_pendingTopCardDay && _pendingTopCardDay.slice(0,7)===dashMonthStr){
        _initDay=_pendingTopCardDay;
      } else if(isCurMonth){
        _initDay = ymdLocal(new Date());   // 이번 달은 항상 오늘로 고정 (오늘 기준 — 2026-06-04)
      } else {
        _initDay = lastSaleDay ? ym+'-'+String(lastSaleDay).padStart(2,'0') : ym+'-'+String(lastDay).padStart(2,'0');
      }
      _pendingTopCardDay=null;
      renderTopCardForDay(_initDay);

      // ─── today-detail 드릴다운 컨텍스트 (모든 달) ───
      try {
        _tdContext = {
          ym, mo, lastDay,
          dailySalesMap, dailyExpTotal, settle, dailyVendorExp,
          lastSaleDay, isUpsMode, isTodayShown: _initDay===ymdLocal(new Date()), isCurMonth
        };
        renderTodayDetailForDay(_initDay);
      } catch(e){ console.warn('[dashTodayDetail]', e.message); }
    }

    // ─── 홈 v7: 인사 헤더 + 이번 달 매출 박스 (isCurMonth 무관, 2026-05-22) ───
    try {
      const _hd=document.getElementById('dashHelloDate');
      if(_hd){
        const _t=new Date();
        const _dowN=['일','월','화','수','목','금','토'][_t.getDay()];
        const _hour=_t.getHours();
        const _ampm=_hour<12?'오전':'오후';
        const _h12=_hour%12||12;
        const _mm=String(_t.getMinutes()).padStart(2,'0');
        _hd.innerText=`${_t.getMonth()+1}월 ${_t.getDate()}일 (${_dowN}) · ${_ampm} ${_h12}:${_mm}`;
      }
      // 지금 근무 인원 배지 (오늘 출근자 — 비동기, 실패해도 홈 렌더 영향 X)
      renderWorkingNow();
      const _mLb=document.getElementById('dashHomeMonthLb');
      const _mSale=document.getElementById('dashHomeMonthSale');
      const _mProg=document.getElementById('dashHomeMonthProgress');
      const _mExp=document.getElementById('dashHomeMonthExp');
      const _mProfit=document.getElementById('dashHomeMonthProfit');
      const _mRate=document.getElementById('dashHomeMonthRate');
      const _mRateRow=document.getElementById('dashHomeMonthRateRow');
      if(_mSale){
        if(_mLb) _mLb.innerText=isCurMonth?'이번 달 매출':`${mo}월 매출`;
        _mSale.innerText=fmt(totalRevenue||0);
        const _profitV=(totalRevenue||0)-(totalCost||0);
        const _isP=_profitV>=0;
        // 지출 줄 (라벨-값 우측정렬, 예상마감과 통일 — 2026-06-03)
        if(_mExp) _mExp.innerText=fmt(totalCost)+'원';
        // 수익 줄 (라벨 '수익' 고정, 음수는 -, 색상 동적 — 하드코딩 X)
        if(_mProfit){
          _mProfit.innerText=(_isP?'':'-')+fmt(Math.abs(_profitV))+'원';
          _mProfit.classList.toggle('red',!_isP);
          _mProfit.classList.toggle('green',_isP);
        }
        // 진행 일자 → 라벨 우측 배지. 사장님 표현 그대로 "5월 22일 / 31일"
        if(_mProg){
          if(isCurMonth){
            _mProg.style.display='';
            _mProg.innerText=`${mo}월 ${passedDays}일 / ${lastDay}일`;
          } else {
            _mProg.style.display='';
            _mProg.innerText=`${mo}월 마감 (${lastDay}일)`;
          }
        }
        // 수익률 줄 (매출 대비, 음수는 -, 색상 동적)
        if(_mRate&&_mRateRow){
          if((totalRevenue||0)>0){
            const _rate=(_profitV/totalRevenue*100);
            _mRate.innerText=(_rate>=0?'':'-')+Math.abs(_rate).toFixed(1)+'%';
            _mRate.classList.toggle('red',_rate<0);
            _mRate.classList.toggle('green',_rate>=0);
            _mRateRow.style.display='';
          } else { _mRateRow.style.display='none'; }
        }
        // ─── 새 기능: 전월 동일 대비 (홈 이번달 카드) ───
        const _mMom=document.getElementById('dashHomeMonthMom');
        if(_mMom){
          if(prevTotalRevenue>0 && totalRevenue>0){
            const _dS=Math.round((totalRevenue-prevTotalRevenue)/prevTotalRevenue*100);
            const _dE=prevTotalCostFull>0?Math.round((totalCostFull-prevTotalCostFull)/prevTotalCostFull*100):0;
            const _sArr=_dS>=0?'▲':'▼', _eArr=_dE>=0?'▲':'▼';
            const _sCol=_dS>=0?'#0CAB6C':'#F04452', _eCol=_dE>=0?'#F04452':'#0CAB6C';
            _mMom.innerHTML=`전월대비 매출 <b style="color:${_sCol}">${_sArr}${Math.abs(_dS)}%</b> · 지출 <b style="color:${_eCol}">${_eArr}${Math.abs(_dE)}%</b>`;
            _mMom.style.display='';
          } else { _mMom.style.display='none'; }
        }
        // ─── 예상마감 (이대로 가면 월말 예상) — 2026-06-02 / 2026-06-14 월요약과 계산 통일 ───
        // ⚠️ 옛 estRevenue/estNetProfit(변동비만 일할)은 월요약 fcProfit과 446만 어긋남(사장님 호소).
        //    이번달 요약과 100% 동일하게 _v17MonthStats(fcSale/fcProfit) 사용.
        const _fcBlock=document.getElementById('dashHomeFcBlock');
        if(_fcBlock){
          const _ms = _v17Ctx ? _v17MonthStats(_v17Ctx) : null;
          const _fcSale   = (_ms && _ms.fcSale!=null)   ? _ms.fcSale   : estRevenue;
          const _fcProfit = (_ms && _ms.fcProfit!=null) ? _ms.fcProfit : estNetProfit;
          if(isCurMonth && passedDays>0 && passedDays<lastDay && _ms && _ms.fcProfit!=null){
            const _fcSaleEl=document.getElementById('dashHomeFcSale');
            const _fcProfitEl=document.getElementById('dashHomeFcProfit');
            const _fcSaleMom=document.getElementById('dashHomeFcSaleMom');
            const _fcProfitMom=document.getElementById('dashHomeFcProfitMom');
            // 예상 매출
            if(_fcSaleEl) _fcSaleEl.innerText=fmt(_fcSale)+'원';
            // 예상 수익 (라벨 '예상 수익' 고정, 음수는 -, 색상 동적)
            const _isFcP=_fcProfit>=0;
            if(_fcProfitEl){
              _fcProfitEl.innerText=(_isFcP?'':'-')+fmt(Math.abs(_fcProfit))+'원';
              _fcProfitEl.classList.toggle('red',!_isFcP);
              _fcProfitEl.classList.toggle('green',_isFcP);
            }
            // 지난달 마감 대비 증감 칩 (예상 월말값 vs 전월 전체 마감)
            const _prevNet=prevTotalRevenue-prevTotalCostFull;
            if(_fcSaleMom){
              if(prevTotalRevenue>0){
                const _d=Math.round((_fcSale-prevTotalRevenue)/prevTotalRevenue*100);
                _fcSaleMom.innerText=(_d>=0?'▲':'▼')+Math.abs(_d)+'%';
                _fcSaleMom.classList.remove('red','green');
                _fcSaleMom.classList.add(_d>=0?'green':'red');
                _fcSaleMom.style.display='';
              } else { _fcSaleMom.style.display='none'; }
            }
            if(_fcProfitMom){
              // 수익은 늘면 좋음(초록▲) / 줄면 나쁨(빨강▼). 분모는 절대값
              if(prevTotalRevenue>0 && _prevNet!==0){
                const _d=Math.round((_fcProfit-_prevNet)/Math.abs(_prevNet)*100);
                _fcProfitMom.innerText=(_d>=0?'▲':'▼')+Math.abs(_d)+'%';
                _fcProfitMom.classList.remove('red','green');
                _fcProfitMom.classList.add(_d>=0?'green':'red');
                _fcProfitMom.style.display='';
              } else { _fcProfitMom.style.display='none'; }
            }
            _fcBlock.style.display='';
          } else { _fcBlock.style.display='none'; }
        }
      }
    } catch(e){ console.warn('[dashHomeMonth]', e.message); }

    // ── 새 기능: AI 인사이트 자동 브리핑 (월요약과 동일 계산 — fcProfit 통일) ──
    // 순이익 = 이번달 요약과 똑같은 _v17MonthStats 사용 (옛 estNetProfit 폐기, 2026-06-14 사장님 호소)
    try {
      const _aiMs = _v17Ctx ? _v17MonthStats(_v17Ctx) : null;
      const _briefMomRev = (prevTotalRevenue>0 && totalRevenue>0) ? momTxt(totalRevenue, prevTotalRevenue, true) : null;
      // 3단계: 공과금 미납(late)·납기 임박(due) — 이번 달, 실제액 미입력 + 납기일 기준 (2026-06-14)
      const _fcLate=[], _fcDue=[], _fcLateManual=[], _fcDueManual=[];
      if(isCurMonth){
        const _now=new Date(), _dToday=_now.getDate();
        (fcRows||[]).filter(r=>r.is_active!==false && r.expected_day).forEach(r=>{
          if(_fcActualMap[r.id]!=null) return;             // 이미 납부(실제액 입력됨)
          const _due=fcDueDay(r, _now.getFullYear(), _now.getMonth()+1); // 말일 보정
          const _manual = r.is_auto_pay===false;           // 직접 납부 = 더 세게
          if(_dToday > _due) (_manual?_fcLateManual:_fcLate).push(r.name);          // 납기 지남 = 미납
          else if(_dToday >= _due-1) (_manual?_fcDueManual:_fcDue).push(r.name);    // 전날·당일 = 임박
        });
      }
      // ── 노무 자가점검 (AI 매니저에 얹음, 참고용 — 공인노무사법: 자문 아닌 정보 제공) ──
      const MIN_WAGE_2026 = 10320; // 2026 최저임금(시급). ⚠️ 매년 갱신 필요(법 개정 추적)
      // 사장(owner)은 근로자 아님 → 노무 점검(최저임금·휴게·5인·퇴직금) 전부 제외
      const _ownerIds = new Set((employees||[]).filter(e=>e.auth_level==='owner').map(e=>e.id));
      const _belowMin = (employees||[]).filter(e=>e.is_active && e.auth_level!=='owner' && e.wage_type!=='monthly' && e.base_wage && e.base_wage < MIN_WAGE_2026).map(e=>e.name);
      let _pendingChgCnt = 0;
      try{ const{data:_cr}=await sb.from('schedule_change_requests').select('id').eq('store_id',sid).eq('status','대기'); _pendingChgCnt=(_cr||[]).length; }catch(_){}
      // 휴게 미부여(8h+인데 확정 휴게 없음) / 상시근로자 추정(연인원÷가동일수) — 당월 근태, 사장 제외
      const _attRows=((attRes2&&attRes2.data)||[]).filter(r=>!_ownerIds.has(r.employee_id));
      // 휴게 미부여: 최근 7일 긴 근무 중 확정 휴게 없는 건 (노이즈는 알림 '지우기'로 관리)
      const _7agoStr=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
      const _noRestShifts=_attRows.filter(r=>(r.total_work_min||0)>=480 && r.work_date>=_7agoStr && !(r.rest_start && r.rest_end && r.rest_status==='확정')).length;
      const _byDate={};
      _attRows.forEach(r=>{ if(r.work_date&&r.employee_id){ (_byDate[r.work_date]=_byDate[r.work_date]||new Set()).add(r.employee_id); } });
      const _wDays=Object.keys(_byDate).length;
      const _avgHead=_wDays>0 ? Object.values(_byDate).reduce((a,s)=>a+s.size,0)/_wDays : 0;
      // 퇴직금 1년 임박 (입사 320~365일), 사장 제외
      const _nowR=new Date();
      const _retireSoon=(employees||[]).filter(e=>{ if(!e.is_active||e.auth_level==='owner'||!e.hire_date) return false; const d=(_nowR-new Date(e.hire_date))/86400000; return d>=320&&d<365; }).map(e=>e.name);
      renderAiBrief({
        totalRevenue,
        currAtt:   expByGroup['인건비'] || 0,
        currVendor:expByGroup['식자재'] || 0,
        netProfit:    _aiMs ? _aiMs.profit : netProfit,                                  // 지금까지 실제 (월요약 동일)
        estNetProfit: (_aiMs && _aiMs.fcProfit!=null) ? _aiMs.fcProfit : estNetProfit,    // 월말 예상 (월요약 동일)
        isCurrent: isCurrent && !!(_aiMs && _aiMs.fcProfit!=null),
        thresholds: settings.expense_thresholds || {},
        momRev: _briefMomRev,
        fcLate: _fcLate, fcDue: _fcDue,
        fcLateManual: _fcLateManual, fcDueManual: _fcDueManual,
        belowMinWage: _belowMin, pendingChgCnt: _pendingChgCnt,
        noRestShifts: _noRestShifts, avgHeadcount: _avgHead, is5plus: _avgHead>=5, retireSoon: _retireSoon,
      });
    } catch(e){ console.warn('[aiBrief]', e.message); }

  }catch(e){console.error('대시보드 오류:',e);}finally{if(!force) setLoad(false);}
}

// ═════════════════════════════════════════════════════════════════
// ═══ v17 정산현황 탭 전면 개편 (2026-05-22) ═══
// mockup: docs/mockups/weekly_settle_calendar_v17.html
// 사장님 결정 10가지 (mockup 17번 누적):
// 1. 월~일 7일 회계 주차 / 2. 매출 대비 % / 3. 휴무 고정비 음수
// 4. 동일 기준일 비교 / 5. 1주 vs 전월 마지막주
// 6. 원 단위 정확 / 7. 보조사 fix / 8. 강도 차별
// 9. + 그 외 event delegation / 10. 예비비 진마감 + 사이드메뉴 진입
// ═════════════════════════════════════════════════════════════════

// 카테고리 기준값 기본값 (business_rules.md, 매출 대비 %)
// 사장님이 카테고리 관리에서 store_settings.expense_thresholds로 수정 가능
// 2026-06-15: 식자재 30→40 (공식 통계 농식품부·KREI 외식업체 경영실태조사 식재료비 평균 40.4%, 샤브샤브 업종 35~45%). 인건비 25 유지(적정 목표선, 사장님 결정).
const V17_DEFAULT_THRESH = {'식자재':40, '주류':10, '음료':10, '인건비':25, '비품':5, '마케팅':10, '고정비':15, '공과금':15, '세금':10, '기타':10, '로열티':0, '카드수수료':0};
const V17_COLOR_PALETTE = ['#F59E0B','#8B5CF6','#6B7684','#10B981','#EC4899','#3B82F6','#EF4444','#84CC16','#F97316','#06B6D4','#A855F7','#14B8A6'];

// 옛 srcToCat 매핑 활용 — 옛 한글 카테고리명 ↔ 옛 5키 (호환용, v17SumMonth 옛 키 유지)
function v17MapCatKey(srcToCat){
  return {
    vendor:   srcToCat?.['vendor_orders'] || '식자재',
    att:      srcToCat?.['attendance']    || '인건비',
    fixed:    srcToCat?.['fixed_costs']   || '공과금/고정비',
    receipt:  srcToCat?.['receipts']      || '비품',
    royalty:  '로열티', // 2026-06-11 분리 (카드수수료는 byCat['카드수수료']로 별도)
  };
}

// ─── 새 기능: AI 인사이트 직원 (자동 브리핑) ───
// 홈이 이미 계산한 숫자(매출·인건비·식자재·순익)로 "오늘 볼 것"을 규칙으로 판단.
// AI 호출 0 = 비용 0. 홈엔 단추만(매출 정보 안 밀리게), 누르면 펼침. 없으면 단추도 숨김.
function renderAiBrief(a){
  const el = document.getElementById('dashAiBrief');
  const btn = document.getElementById('dashAiBriefBtn');
  if(!el || !btn) return;
  window._lastAiBriefArg = a; // '지우기' 후 가벼운 재렌더용
  const rev = a.totalRevenue||0;
  // 매출 없으면(데이터 없음) AI 매니저 숨김
  if(rev<=0){ el.style.display='none'; el.innerHTML=''; btn.style.display='none'; return; }
  const items = [];
  const th = a.thresholds||{};
  const thOf = name => (th[name]!=null ? th[name] : (V17_DEFAULT_THRESH[name]||0));
  // 기준값 안내 한 줄 — 사장님이 "기준 누가 정했나" 헷갈리지 않게 출처·수정 동선 명시 (2026-06-15)
  const _thNote = ` 외식업 평균 기준이에요 · <b>가게 관리 > 카테고리</b>에서 바꿀 수 있어요.`;
  // AI 매니저 = '조언'만 (숫자=흑자/적자는 월 요약 카드 담당 — 2026-06-15 역할 분리)

  // 🔴/🟡 인건비 비율
  const attR = Math.round((a.currAtt||0)/rev*100);
  const attTh = thOf('인건비');
  if(attTh>0 && attR > attTh){
    items.push({ key:'att', sev: attR>=attTh+5?0:1, ic:'🚨', title:'인건비가 기준보다 높아요',
      desc:`이번 달 <b>지금까지</b> 인건비가 매출의 <b>${attR}%</b>예요. 기준(${attTh}%)보다 높아요.${_thNote}` });
  }
  // 🔴/🟡 식자재 비율
  const venR = Math.round((a.currVendor||0)/rev*100);
  const venTh = thOf('식자재');
  if(venTh>0 && venR > venTh){
    items.push({ key:'vendor', sev: venR>=venTh+5?0:1, ic:'📈', title:'식자재 비중이 높아요',
      desc:`이번 달 <b>지금까지</b> 식자재가 매출의 <b>${venR}%</b>예요. 기준(${venTh}%)보다 높아요.${_thNote}` });
  }
  // 🔴/🟡 프라임코스트 — 식자재+인건비 합 (줄일 수 있는 두 비용. 한국 외식업 평균 70%, 건강 기준 65% — 2026-06-15)
  const primeR = Math.round(((a.currAtt||0)+(a.currVendor||0))/rev*100);
  if(primeR > 65){
    items.push({ key:'prime', sev: primeR>70?0:1, ic:'🔥', title:'식자재+인건비 합이 높아요',
      desc:`식자재와 인건비를 합치면 매출의 <b>${primeR}%</b>예요. 건강 기준(65%)보다 높아요. (외식업 평균 70%)` });
  }
  // ⚠️ 적자 위험만 '조언'으로 (흑자/적자 숫자는 월 요약 담당. 2026-06-15)
  if(a.isCurrent && (a.estNetProfit||0) < 0){
    items.push({ key:'deficit', sev:0, ic:'⚠️', title:'이대로면 이번 달 적자 예상',
      desc:`이대로면 월말 적자가 예상돼요. 아래 <b>이번 달 요약</b>에서 지출을 점검해 보세요.` });
  }
  // 🎉 매출 상승 칭찬 (좋은 소식 — 경고 아님, 배지엔 안 셈)
  if(a.momRev && a.momRev.up && a.momRev.text!=='비슷'){
    items.push({ key:'momup', sev:2, ic:'🎉', title:'매출이 지난달보다 올랐어요',
      desc:`매출이 지난달 같은 기간보다 <span style="color:var(--toss-blue-strong);font-weight:800;">${a.momRev.text}</span> 늘었어요.` });
  }

  // ── 노무 자가점검 (참고용 — 공인노무사법: 자문 아닌 정보 제공 + 노무사 확인 권장) ──
  if(a.belowMinWage && a.belowMinWage.length){
    items.push({ key:'minwage', sev:0, ic:'⚖️', title:'최저임금보다 낮은 시급이 있어요',
      desc:`<b>${a.belowMinWage.join(', ')}</b>님 시급이 2026년 최저임금(10,320원)보다 낮아요. 직원관리에서 확인해 주세요. <span style="color:var(--gray-400);">※ 참고용이에요. 자세한 건 노무사에게 확인하세요.</span>` });
  }
  if(a.pendingChgCnt > 0){
    items.push({ key:'changereq', sev:1, ic:'🔄', title:'근무 변경·취소 신청이 있어요',
      desc:`승인 대기 중인 근무 변경/취소 신청이 <b>${a.pendingChgCnt}건</b> 있어요. 근태 기록 화면의 <b>“🔄 근무 변경·취소 신청/이력”</b>에서 확인하세요.` });
  }
  if(a.noRestShifts > 0){
    items.push({ key:'rest', sev:1, ic:'☕', title:'휴게 기록 없는 긴 근무가 있어요',
      desc:`8시간 넘게 일했는데 휴게 기록이 없는 근무가 <b>${a.noRestShifts}건</b> 있어요. 휴게를 실제로 줬다면 기록해 주세요. <span style="color:var(--gray-400);">※ 휴게 부여는 의무예요. 참고용.</span>` });
  }
  if(a.is5plus){
    items.push({ key:'headcount', sev:1, ic:'👥', title:'상시 5인 이상으로 보여요',
      desc:`최근 출퇴근 기준 상시근로자가 <b>약 ${(a.avgHeadcount||0).toFixed(1)}명</b>으로 추정돼요. 5인 이상이면 연장·야간·휴일 가산수당이 의무일 수 있어요. <span style="color:var(--gray-400);">※ 추정값이에요. 노무사 확인 권장.</span>` });
  }
  if(a.retireSoon && a.retireSoon.length){
    items.push({ key:'retire', sev:1, ic:'🎁', title:'곧 근속 1년 직원이 있어요',
      desc:`<b>${a.retireSoon.join(', ')}</b>님이 곧 입사 1년이에요. 1년 이상·주 15시간 이상이면 퇴직금 대상이에요. <span style="color:var(--gray-400);">※ 참고용, 노무사 확인 권장.</span>` });
  }

  // 알림별 '심각도 신호'(클수록 나쁨) — ✕로 지운 뒤 더 나빠지거나 새 일 생기면 다시 뜨게
  const _sigByKey={ att:Math.floor(attR/5)*5, vendor:Math.floor(venR/5)*5, prime:Math.floor(primeR/5)*5, deficit:1, momup:1, minwage:(a.belowMinWage||[]).length, changereq:a.pendingChgCnt||0, rest:a.noRestShifts||0, headcount:1, retire:(a.retireSoon||[]).length };
  items.forEach(it=>{ it.sig = (_sigByKey[it.key]!=null?_sigByKey[it.key]:1); });
  const _dm=_aibDismissMap();
  // 지운 알림 = key가 저장돼 있고 지금 신호가 그때보다 나빠지지 않았으면 숨김
  const visItems=items.filter(it=> !(it.key && (it.key in _dm)) || (it.sig > _dm[it.key]));
  const hiddenActive=items.filter(it=> it.key && (it.key in _dm) && it.sig <= _dm[it.key]).length;
  // 심각도순 정렬(빨강→노랑→초록) 후 최대 3개
  visItems.sort((x,y)=>x.sev-y.sev);
  const top = visItems.slice(0,3);
  const sevCls = s => s===0?'red':(s===1?'warn':'green');
  // 배지 = '주의 필요'(경고) 건수만 — 칭찬(sev2)은 안 셈 (2026-06-15 사장님 안: 제목 옆 숫자 배지)
  const warnItems = visItems.filter(it=>it.sev<=1);
  const warnCnt = warnItems.length;
  const worst = warnCnt>0 ? sevCls(Math.min(...warnItems.map(it=>it.sev))) : 'green';

  // ── 홈 단추: 제목 옆 숫자 배지(경고 건수) + 서브(가장 급한 내용 / 양호) ──
  const isOpen = el.style.display==='block';
  const badgeHtml = warnCnt>0
    ? `<span class="aib-badge ${worst}">${warnCnt}</span>`
    : `<span class="aib-chk">✓</span>`;
  const subTx = warnCnt>0
    ? (warnItems[0].title + (warnCnt>1 ? ` 외 ${warnCnt-1}건` : ''))
    : '다 잘 가고 있어요 👍';
  btn.className = 'aib-btn';
  btn.innerHTML = `
    <span class="aib-btn-ic">🤖</span>
    <span class="aib-btn-tx"><span class="aib-tt-row"><b>AI 매니저</b>${badgeHtml}</span><span class="aib-btn-sub">${subTx}</span></span>
    <span class="aib-btn-arr">${isOpen?'⌄':'›'}</span>`;
  btn.style.display='flex';

  // ── 펼침 카드 내용 (표시 여부는 toggleAiBrief가 제어) — 항목 없으면 양호 메시지 ──
  const today = new Date();
  const rowsHtml = top.length
    ? top.map(it=>`
      <div class="aib-row ${sevCls(it.sev)}" data-key="${it.key||''}" style="position:relative;padding-right:38px;">
        <div class="aib-ic">${it.ic}</div>
        <div class="aib-tx"><div class="aib-title">${it.title}</div><div class="aib-desc">${it.desc}</div></div>
        ${it.key?`<button data-action="dismissAibAlert|${it.key}|${it.sig}" aria-label="지우기" style="position:absolute;top:8px;right:8px;width:22px;height:22px;border:none;background:rgba(0,0,0,.07);color:#8B95A1;border-radius:50%;font-size:12px;line-height:22px;text-align:center;padding:0;cursor:pointer;">✕</button>`:''}
      </div>`).join('')
    : `<div class="aib-row green">
        <div class="aib-ic">👍</div>
        <div class="aib-tx"><div class="aib-title">오늘 챙길 거 없어요</div><div class="aib-desc">비용·수익 모두 양호해요. 잘 가고 있어요.</div></div>
      </div>`;
  const hiddenLine = hiddenActive>0
    ? `<div data-action="clearAibDismissed" style="text-align:center;margin-top:10px;padding:8px;font-size:12px;color:var(--gray-500);cursor:pointer;">🔕 지운 알림 ${hiddenActive}개 · 다시 보기</div>`
    : '';
  el.innerHTML = `
    <div class="aib-greet">사장님, <b>${today.getMonth()+1}월 ${today.getDate()}일</b> 알려드릴 것이에요 👇</div>
    ${rowsHtml}${hiddenLine}`;
  el.style.display='none'; // 매 로드 시 접힘(단추만)
}

// ─── AI 매니저 알림 '지우기'(7일 스누즈) — 아이폰 알림 지우듯 (2026-06-18) ───
function _aibDismissMap(){
  try{ return JSON.parse(localStorage.getItem('aib_dismiss_'+((typeof currentStore!=='undefined'&&currentStore)?currentStore.id:''))||'{}'); }catch(_){ return {}; }
}
function dismissAibAlert(key, sig){
  if(!key) return;
  try{
    const k='aib_dismiss_'+((typeof currentStore!=='undefined'&&currentStore)?currentStore.id:'');
    const m=_aibDismissMap(); m[key]=(sig!=null?Number(sig):0); // 지운 시점 신호 저장 (이보다 나빠지면 다시 뜸)
    localStorage.setItem(k, JSON.stringify(m));
  }catch(_){}
  // 펼침 유지한 채 가볍게 다시 그림 (배지·목록 갱신)
  const wasOpen = (document.getElementById('dashAiBrief')||{}).style?.display==='block';
  if(window._lastAiBriefArg) renderAiBrief(window._lastAiBriefArg);
  if(wasOpen){ const el=document.getElementById('dashAiBrief'); if(el) el.style.display='block'; const arr=document.querySelector('#dashAiBriefBtn .aib-btn-arr'); if(arr) arr.textContent='⌄'; }
}

// 지운 알림 전부 다시 보기 (실수로 지웠거나 확인하고 싶을 때 — 안전장치)
function clearAibDismissed(){
  try{ localStorage.removeItem('aib_dismiss_'+((typeof currentStore!=='undefined'&&currentStore)?currentStore.id:'')); }catch(_){}
  if(window._lastAiBriefArg) renderAiBrief(window._lastAiBriefArg);
  const el=document.getElementById('dashAiBrief'); if(el) el.style.display='block';
  const arr=document.querySelector('#dashAiBriefBtn .aib-btn-arr'); if(arr) arr.textContent='⌄';
}

// AI 매니저 단추 ↔ 카드 펼침/접힘
function toggleAiBrief(){
  const el=document.getElementById('dashAiBrief');
  const btn=document.getElementById('dashAiBriefBtn');
  if(!el) return;
  const willOpen = el.style.display!=='block';
  el.style.display = willOpen?'block':'none';
  const arr = btn && btn.querySelector('.aib-btn-arr');
  if(arr) arr.textContent = willOpen?'⌄':'›';
}

// v17 데이터 컨텍스트 (loadDashboard에서 setV17Context로 채움)
let _v17Ctx = null;
let _v17CurrentCat = 'default'; // 캘린더 모드
// 2026-06-03 제거: _v17CurrentWeekIdx/_v17AllWeekData/_v17AllWeekHtml (주별 모달 캐시 — 주차 매트릭스로 통합)

// ─── 포맷터 ───
function v17FmtNoWon(v){ return v.toLocaleString('ko-KR'); }
function v17FmtNoWonSigned(v){
  return (v>=0?'+':'-') + Math.abs(v).toLocaleString('ko-KR');
}
function v17FmtCompact(v){
  const a = Math.abs(v);
  if(a >= 100000000){
    const v100m = a/100000000;
    return (v<0?'-':'') + (v100m>=10 ? v100m.toFixed(0) : v100m.toFixed(1)) + '억';
  }
  if(a >= 10000) return (v<0?'-':'') + Math.round(a/10000).toLocaleString() + '만';
  return v.toLocaleString('ko-KR');
}
function v17AutoFontClass(v){
  const len = Math.abs(v).toLocaleString().length;
  if(len >= 11) return 'fs-xs';
  if(len >= 10) return 'fs-s';
  if(len >= 9)  return 'fs-m';
  return 'fs-l';
}
function v17CellAutoFs(txt){ return txt.length > 5 ? ' cc-mini' : ''; }

// ─── 회계 주차 계산 (월~일 7일) ───
function v17BuildAccountingWeeks(year, monthIdx){
  const first = new Date(year, monthIdx, 1);
  const firstDow = first.getDay();
  let firstSunday;
  if(firstDow === 0) firstSunday = 1;
  else firstSunday = 8 - firstDow;
  const firstMondayMonth = monthIdx + 1;
  let firstMondayDay = firstSunday - 6;
  let weeks = [];
  let cursorM, cursorD;
  if(firstMondayDay <= 0){
    const prevMonthLastDay = new Date(year, monthIdx, 0).getDate();
    cursorM = monthIdx;
    cursorD = prevMonthLastDay + firstMondayDay;
  } else {
    cursorM = firstMondayMonth;
    cursorD = firstMondayDay;
  }
  while(true){
    const wk = [];
    for(let i=0;i<7;i++){
      wk.push({m:cursorM, d:cursorD});
      const lastDayThisMonth = new Date(year, cursorM, 0).getDate();
      cursorD++;
      if(cursorD > lastDayThisMonth){ cursorM++; cursorD = 1; }
    }
    weeks.push(wk);
    if(cursorM > monthIdx+1) break;
  }
  return weeks;
}

// 그 달 데이터 합산 (휴무 포함, maxDay까지)
// 2026-05-22: byCat 동적 카테고리 합계 추가
function v17SumMonth(ctx, targetM, maxDay){
  const DAYS = ctx.DAYS;
  let s=0,e=0,vendor=0,att=0,fixed=0,receipt=0,royalty=0,lastDay=0;
  // 예상마감 분모용 — 매출/지출이 실제로 발생한 마지막 날 따로 (2026-06-08)
  // 8일에 매출 0인데 지출만 있으면 → saleLastDay=7, expLastDay=8 로 각각 정확히 일평균
  let saleLastDay=0, expLastDay=0;
  const byCat = {};
  (ctx.cats||[]).forEach(c=>{ byCat[c.key]=0; });
  Object.entries(DAYS).forEach(([key,d])=>{
    const [m,day] = key.split('-').map(Number);
    if(m !== targetM) return;
    if(day > maxDay) return;
    if(d.sale!==undefined){
      s+=d.sale||0; e+=d.exp||0;
      vendor+=d.vendor||0; att+=d.att||0;
      fixed+=d.fixed||0; receipt+=d.receipt||0; royalty+=d.royalty||0;
      (ctx.cats||[]).forEach(c=>{ byCat[c.key] += (d.byCat?.[c.key])||0; });
      if(day>lastDay) lastDay=day;
      if((d.sale||0)>0 && day>saleLastDay) saleLastDay=day;
      if((d.exp||0)>0  && day>expLastDay)  expLastDay=day;
    }
  });
  return {s,e,vendor,att,fixed,receipt,royalty,lastDay,saleLastDay,expLastDay,byCat};
}

// 색상 차별 momTag (sale/profit ↑=good / expense/category ↑=bad)
function v17MomTag(curr, prev, type){
  if(!prev || prev<=0) return '';
  const d = Math.round((curr-prev)/prev*100);
  if(d===0) return '<span class="same">━</span>';
  const isUp = d>0;
  const goodWhenUp = (type==='sale' || type==='profit');
  const isGood = (isUp && goodWhenUp) || (!isUp && !goodWhenUp);
  return `<span class="${isGood?'good':'bad'}">${isUp?'▲':'▼'}${Math.abs(d)}%</span>`;
}

// 문어체 9 케이스 (보조사 fix + 강도 차별)
function v17MomComment(dS, dE){
  const SAME = 3;
  const sCat = Math.abs(dS) <= SAME ? 'same' : (dS>0?'up':'down');
  const eCat = Math.abs(dE) <= SAME ? 'same' : (dE>0?'up':'down');
  const sAbs = Math.abs(dS), eAbs = Math.abs(dE);
  if(sCat==='up' && eCat==='up')
    return `매출이 ▲${sAbs}% 늘었어요 🎉 다만 지출도 ▲${eAbs}% 늘었네요. 효율 더 챙겨봐요.`;
  if(sCat==='up' && eCat==='same')
    return `매출이 ▲${sAbs}% 늘었어요! 🎉 지출은 그대로라 정말 좋아요.`;
  if(sCat==='up' && eCat==='down')
    return `매출이 ▲${sAbs}% 늘고 지출이 ▼${eAbs}% 줄었어요! 최고의 흐름이에요 🚀`;
  if(sCat==='same' && eCat==='up')
    return `매출은 비슷한데 지출이 ▲${eAbs}% 늘었어요 😟 점검이 필요해요.`;
  if(sCat==='same' && eCat==='same')
    return `매출·지출 모두 비슷한 수준이에요. 안정적이에요 👍`;
  if(sCat==='same' && eCat==='down')
    return `매출은 비슷한데 지출이 ▼${eAbs}% 줄었어요! 효율이 좋아요 👍`;
  if(sCat==='down' && eCat==='up')
    return `매출이 ▼${sAbs}% 줄었는데 지출은 ▲${eAbs}% 늘었어요 🚨 빨리 점검이 필요해요!`;
  if(sCat==='down' && eCat==='same')
    return `매출이 ▼${sAbs}% 줄었어요 😢 지출은 그대로라 부담이 커요.`;
  if(sCat==='down' && eCat==='down')
    return `매출이 ▼${sAbs}% 줄었지만 지출도 ▼${eAbs}% 줄어 손실 방어 잘 됐어요.`;
  return '';
}

// loadDashboard 끝에서 호출 — 옛 데이터를 v17 컨텍스트로 변환
// 2026-05-22 갈아엎기: 사장님 매장 활성 카테고리 동적 등록 (헌법 1-6)
function setV17Context(args){
  const ctx = {
    YEAR: args.year, MONTH_IDX: args.monthIdx, TARGET_MONTH: args.monthIdx+1,
    LAST_DAY: args.lastDay, TODAY: args.passedDays, IS_CURRENT: args.isCurrent,
    DAYS: {}, WEEKS: [], srcToCat: args.srcToCat||{},
    catMap: v17MapCatKey(args.srcToCat),
    royaltyRate: args.royaltyRate || 0,
  };
  // 동적 카테고리 빌드 (사장님 매장 catNames + 로열티 가상)
  const userTh = args.expCatThresholds || {};
  ctx.cats = (args.catNames || []).map((nm,i)=>({
    key: nm,
    name: nm, // 2026-06-11 '로열티/수수료'→'로열티' 개명 폐기 (분리돼서 실명 그대로)
    color: args.catColors?.[nm] || V17_COLOR_PALETTE[i % V17_COLOR_PALETTE.length],
    threshold: userTh[nm] ?? V17_DEFAULT_THRESH[nm] ?? 0,
  }));
  // fixed_costs source 카테고리 이름 목록 (사장님 매장: '고정비' + '공과금' 둘 다)
  const fixedCatNames = (args.fixedCatNames && args.fixedCatNames.length) ? args.fixedCatNames : [ctx.catMap.fixed];
  const mapKey = ctx.catMap;
  function _sumFixed(cat){
    let f = 0;
    fixedCatNames.forEach(nm=>{ f += cat[nm] || 0; });
    return f;
  }
  for(let d=1; d<=args.lastDay; d++){
    const dd = String(d).padStart(2,'0');
    const key = `${ctx.TARGET_MONTH}-${dd}`;
    const sale = args.dailySalesMap[dd] || args.dailySalesMap[d] || 0;
    const exp = args.dailyExpTotal[dd] || args.dailyExpTotal[d] || 0;
    const cat = args.dailyCatMap[dd] || args.dailyCatMap[d] || {};
    const isHoliday = args.holidayDays?.has?.(dd) || args.holidayDays?.has?.(d) || false;
    const fxd = _sumFixed(cat);
    // byCat = 동적 카테고리별 일별 금액
    const byCat = {};
    ctx.cats.forEach(c=>{ byCat[c.key] = cat[c.key] || 0; });
    // byChild = 부모>자식 일별 금액 (주차 매트릭스용, 2026-06-03)
    const byChild = (args.dailyChildMap?.[dd]) || (args.dailyChildMap?.[d]) || {};
    if(isHoliday && sale===0){
      ctx.DAYS[key] = {holiday:true, sale:0, vendor:0, att:0, fixed:fxd, receipt:0, royalty:0, exp:fxd, profit:-fxd, byCat, byChild};
    } else if(sale > 0 || exp > 0) {
      ctx.DAYS[key] = {
        sale,
        vendor:  cat[mapKey.vendor]  || 0,
        att:     cat[mapKey.att]     || 0,
        fixed:   fxd,
        receipt: cat[mapKey.receipt] || 0,
        royalty: cat[mapKey.royalty] || 0,
        exp,
        profit: sale - exp,
        byCat,
        byChild,
      };
    }
  }
  // 전월 데이터 (DAYS에 추가, 동일 기준일 비교용)
  if(args.prevDailyMap){
    Object.entries(args.prevDailyMap).forEach(([k,v])=>{
      // byCat 누락 시 빈 객체 (옛 코드 호환)
      if(!v.byCat) v.byCat = {};
      ctx.DAYS[k] = v;
    });
  }
  ctx.monthChildMap = args.monthChildMap || {};
  ctx.childColorMap = args.childColorMap || {};
  // 회계 주차 빌드
  ctx.WEEKS = v17BuildAccountingWeeks(ctx.YEAR, ctx.MONTH_IDX);
  _v17Ctx = ctx;
}

// ─── 새 기능: 월 보기 상세 패널 소분류 토글 (2026-06-03) ───
function toggleMonthCatChildren(key){
  const panel=document.querySelector('.v17-detail-panel[data-rest-detail="mth"]');
  if(!panel) return;
  const children=panel.querySelectorAll(`.v17-detail-child-row[data-parent="${key}"]`);
  if(!children.length) return;
  const expanded=children[0].style.display!=='none';
  children.forEach(el=>{ el.style.display=expanded?'none':'grid'; });
  const tog=document.getElementById(`v17SubTog_${key}`);
  if(tog) tog.textContent=expanded?'▼':'▲';
}

// ─── 월 통계 계산 (요약 카드 + 세부 화면 공용, 2026-06-03 분리) ───
function _v17MonthStats(ctx){
  const cur = v17SumMonth(ctx, ctx.TARGET_MONTH, 31);
  // 전월 비교: 이달 매출 있는 마지막 날 기준 (매출 0인 날이 분모 부풀리지 않게)
  const _cmpDay = cur.saleLastDay || cur.lastDay;
  const prev = v17SumMonth(ctx, ctx.TARGET_MONTH-1, _cmpDay);
  const profit = cur.s - cur.e;
  const expPctNum = cur.s>0 ? Math.round(cur.e/cur.s*100) : 0;
  const monthLastDay = new Date(ctx.YEAR, ctx.TARGET_MONTH, 0).getDate();
  const progressDays = cur.lastDay;
  const progressPct = monthLastDay>0 ? Math.round(progressDays/monthLastDay*100) : 0;
  // 예상마감: 매출·지출 둘 다 '매출 들어온 마지막 완전한 날(saleLastDay)' 기준으로 통일 (2026-06-11 사장님 호소)
  //  · 옛: 매출은 saleLastDay, 지출은 expLastDay로 각각 나눔 → 오늘(매출 0 + 지출만)이 양쪽을 반대로 흔들어 예상 수익률 왜곡(23%)
  //  · 새: 매출 있던 마지막 날까지만 매출·지출 같이 합산(matched) → 같은 기간 대응(회계 수익·비용 대응 원칙)
  //        오늘처럼 매출 0인데 지출만 찍힌 '미마감 날'은 예상 base에서 제외 (마감되면 자동 포함)
  let fcSale = null, fcProfit = null;
  const _saleDays = cur.saleLastDay || cur.lastDay;
  if(_saleDays > 0 && _saleDays < monthLastDay){
    const matched = v17SumMonth(ctx, ctx.TARGET_MONTH, _saleDays); // 매출 마지막 날까지만 (지출도 같은 기간)
    fcSale = Math.round(matched.s * (monthLastDay / _saleDays));
    const fcExp = Math.round(matched.e * (monthLastDay / _saleDays));
    fcProfit = fcSale - fcExp;
  }
  const profitPctSale = cur.s>0 ? (profit/cur.s*100) : 0;
  const expPctSale = cur.s>0 ? (cur.e/cur.s*100) : 0;
  return {cur, prev, profit, expPctNum, monthLastDay, progressDays, progressPct, fcSale, fcProfit, profitPctSale, expPctSale};
}

// ─── 월 요약 카드 렌더 (홈 — 탭하면 세부 화면. 2026-06-03 요약 전용으로 축소) ───
function v17RenderMonthCard(){
  const ctx = _v17Ctx; if(!ctx) return;
  const el = document.getElementById('v17MonthCard'); if(!el) return;
  const st = _v17MonthStats(ctx);
  const {cur, profit, progressDays, progressPct, fcSale, fcProfit, profitPctSale, expPctSale} = st;

  // 도넛: 지출 카테고리 분포 (배경), 가운데 = 수익률
  const cats = ctx.cats || [];
  let donutAcc = 0;
  const donutStops = [];
  cats.forEach(c=>{
    const v = cur.byCat[c.key]||0;
    if(v<=0) return;
    const pct = cur.e>0 ? (v/cur.e*100) : 0;
    if(pct < 0.5) return;
    donutStops.push(`${c.color} ${donutAcc.toFixed(2)}% ${(donutAcc+pct).toFixed(2)}%`);
    donutAcc += pct;
  });
  const donutBg = donutStops.length ? `conic-gradient(${donutStops.join(',')})` : '#F2F4F6';

  const profitRateStr = `${profit>=0?'+':''}${profitPctSale.toFixed(0)}%`;
  const profitRateColor = profit>=0 ? '#0CAB6C' : '#EF4444';

  // 도넛 가운데 = 수익률 (목업 형태)
  const donutCenter = donutStops.length
    ? `<span class="dc-pct" style="color:${profitRateColor};">${profitRateStr}</span><span class="dc-lb">수익률</span>`
    : `<span class="dc-lb">지출 없음</span>`;
  // 예상마감 문장형 — "이대로 가면 이번달 ○○ 매출에 ○○ 이득/손해예요" (2026-06-05 A안)
  // fcSale=null(월 첫날·마감월)이면 배너 자체 숨김
  let fcHtml = '';
  if(fcSale!==null){
    const _isGain = fcProfit>=0;
    fcHtml = `<div class="m6-fc${_isGain?'':' neg'}" data-action="dashGoStage|month-detail" data-stop="1">`
      +`<span class="fc-tx">이대로 가면 이번달 <span class="fc-sale">${v17FmtCompact(fcSale)}</span> 매출에 `
      +`<span class="fc-gl">${v17FmtCompact(Math.abs(fcProfit))} ${_isGain?'이득':'손해'}</span>${_isGain?'이에요':'예요'}</span>`
      +`<span class="fc-more">자세히 ›</span></div>`;
  }

  // ── 월 요약 카드 — 홈 항상 노출. 흑자/적자·매출·수익 핵심 (2026-06-15 역할 분리: 숫자=월요약 / 조언=AI매니저) ──
  el.innerHTML = `
      <div class="v17-card-v6">
        ${fcHtml}
        <div class="v6-ttl-row">
          <div class="v6-ttl"><b>${ctx.TARGET_MONTH}월</b>${progressDays}일 진행</div>
          <span class="v6-progress-tag">${progressPct}%</span>
        </div>
        <div class="m6-top">
          <div class="m6-donut-wrap">
            <div class="m6-donut" style="background:${donutBg};"></div>
            <div class="m6-donut-center">${donutCenter}</div>
          </div>
          <div class="m6-mrows">
            <div class="m6-mr"><span class="k">매출</span><span class="v">${v17FmtNoWon(cur.s)}원</span></div>
            <div class="m6-mr"><span class="k">지출</span><span class="v">${v17FmtNoWon(cur.e)}원</span></div>
            <div class="m6-mr"><span class="k">수익</span><span class="v ${profit>=0?'green':'red'}">${v17FmtNoWonSigned(profit)}원</span></div>
          </div>
        </div>
      </div>`;
}

// ─── 월 세부 화면 렌더 (요약 카드 탭 진입 — 2026-06-03 신설) ───
// 구성: 큰 요약 + 예상마감 + 카테고리별(전체) + 전월대비 + 주차별 매트릭스
function v17RenderMonthDetail(){
  const ctx = _v17Ctx; if(!ctx) return;
  const el = document.getElementById('v17MonthDetailBody'); if(!el) return;
  const st = _v17MonthStats(ctx);
  const {cur, prev, profit, expPctNum, progressDays, fcSale, fcProfit, profitPctSale} = st;
  const cats = ctx.cats || [];
  const sortedCats = [...cats].sort((a,b)=>(cur.byCat[b.key]||0)-(cur.byCat[a.key]||0)).filter(c=>(cur.byCat[c.key]||0)>0);

  // ── 1. 큰 요약 (히어로) ──
  const progressLabel = ctx.IS_CURRENT
    ? `📅 ${ctx.TARGET_MONTH}월 1일 ~ ${progressDays}일 (${progressDays}일째 진행중)`
    : `📅 ${ctx.TARGET_MONTH}월 (마감)`;
  const heroHtml = `
    <div class="md-hero">
      <div class="md-hero-lb">${progressLabel}</div>
      <div class="md-hero-amt">${v17FmtNoWon(cur.s)}<span class="won">원</span></div>
      <div class="md-hero-stats">
        <div class="md-stat"><span class="k">지출</span><span class="v">${v17FmtNoWon(cur.e)}원</span></div>
        <div class="md-stat"><span class="k">순수익</span><span class="v">${v17FmtNoWonSigned(profit)}원</span></div>
        <div class="md-stat"><span class="k">수익률</span><span class="v">${profit>=0?'+':''}${profitPctSale.toFixed(0)}%</span></div>
      </div>
    </div>`;

  // ── 2. 예상마감 ──
  let fcHtml = '';
  if(fcSale!==null){
    fcHtml = `
    <div class="md-fc">
      <div class="md-fc-ttl">📈 이대로 가면 (월말 예상)</div>
      <div class="md-fc-row"><span class="k">예상 매출 <span class="md-est-tag">예상</span></span><span class="v">${v17FmtNoWon(fcSale)}원</span></div>
      <div class="md-fc-row"><span class="k">예상 순수익 <span class="md-est-tag">예상</span></span><span class="v ${fcProfit<0?'neg':'pos'}">${fcProfit>=0?'+':''}${v17FmtNoWon(fcProfit)}원</span></div>
    </div>`;
  }

  // ── 3. 카테고리별 지출 (전체) — 소분류 토글 ──
  let detailRowsHtml = '';
  sortedCats.forEach(c=>{
    const v = cur.byCat[c.key]||0;
    const prevV = prev.byCat?.[c.key]||0;
    const pct = cur.s>0 ? (v/cur.s*100) : 0;
    const warnIcon = (c.threshold && pct>c.threshold) ? ' ⚠️' : '';
    let momMini = '<span class="mom same">-</span>';
    if(prevV>0){
      const d = Math.round((v-prevV)/prevV*100);
      if(d===0) momMini = `<span class="mom same">━</span>`;
      else if(d>0) momMini = `<span class="mom up">▲${Math.abs(d)}%</span>`;
      else momMini = `<span class="mom dn">▼${Math.abs(d)}%</span>`;
    }
    const children=Object.entries(ctx.monthChildMap?.[c.name]||{}).sort((a,b)=>b[1].amt-a[1].amt);
    const hasChild=children.length>0;
    const subToggle=hasChild?`<span class="v17-sub-toggle" id="v17SubTog_${c.key}">▼</span>`:'';
    const clickAttr=hasChild?`data-action="toggleMonthCatChildren|${c.key}"`:'';
    detailRowsHtml += `<div class="v17-detail-row${hasChild?' has-child':''}" ${clickAttr}>
      <div class="nm-side"><span class="dot" style="background:${c.color};"></span><span class="nm">${c.name}${warnIcon}</span>${subToggle}</div>
      <span class="amt">${v17FmtNoWon(v)}원</span>
      <span class="pct">${pct.toFixed(1)}%</span>
      ${momMini}
    </div>`;
    children.forEach(([childName,childData])=>{
      const childPct=cur.s>0?(childData.amt/cur.s*100):0;
      detailRowsHtml+=`<div class="v17-detail-child-row" data-parent="${c.key}" style="display:none;">
        <div class="nm-side"><span class="dot" style="background:${childData.color};"></span><span class="nm">${childName}</span></div>
        <span class="amt">${v17FmtNoWon(childData.amt)}원</span>
        <span class="pct">${childPct.toFixed(1)}%</span>
        <span></span>
      </div>`;
    });
  });
  const detailPanelHtml = sortedCats.length>0 ? `
    <div class="v17-detail-panel" data-rest-detail="mth" style="display:block;">
      <div class="pan-ttl">카테고리별 지출 (전체)</div>
      <div class="v17-detail-head"><span class="h-nm">카테고리</span><span class="h-amt">금액</span><span class="h-pct">매출대비</span><span class="h-mom">전월대비</span></div>
      ${detailRowsHtml}
      <div class="v17-detail-sum">
        <span class="lb">합계</span>
        <span class="amt">${v17FmtNoWon(cur.e)}원</span>
        <span class="pct">${expPctNum}%</span>
      </div>
    </div>` : '';

  // ── 4. 전월 동일 대비 ──
  let momHtml = '';
  if(prev.s>0){
    const sI = v17MomTag(cur.s, prev.s, 'sale');
    const eI = v17MomTag(cur.e, prev.e, 'expense');
    const compareLabel = `${ctx.TARGET_MONTH-1}/${cur.saleLastDay || cur.lastDay}`;
    const dS = prev.s>0 ? Math.round((cur.s-prev.s)/prev.s*100) : 0;
    const dE = prev.e>0 ? Math.round((cur.e-prev.e)/prev.e*100) : 0;
    const comment = v17MomComment(dS, dE);
    momHtml = `<div class="wk-mom">
      <div class="mom-lb">전월 동일(${compareLabel}) 대비 증감률</div>
      <div class="mom-line">매출 ${sI||'━'} · 지출 ${eI||'━'}</div>
      ${comment?`<div class="mom-comment">${comment}</div>`:''}
    </div>`;
  }

  // ── 5. 주차별 매트릭스 (카테고리 전부 + 5주 고정, 안 A) ──
  const matrixHtml = v17BuildWeekMatrixHtml(ctx);

  el.innerHTML = heroHtml + fcHtml + detailPanelHtml + momHtml + matrixHtml;
}

// ─── 주차별 매트릭스 표 (안 A · 만원 단위) — 2026-06-03 신설 / 2026-06-03 개편 ───
// 행: 매출 / 지출 카테고리 전부(+자식 펼침, 0원도 흐리게 표시) / 지출 합계 / 순수익.
// 열: 그 달 회계주 전부(1~5주 고정, 진행 안 한 주는 -). 진행주 파랑 강조 + 배지.
// 자식·카테고리 = 동적 (설정 기반). 하드코딩 X.
function v17BuildWeekMatrixHtml(ctx){
  const WEEKS = ctx.WEEKS || [];
  const TM = ctx.TARGET_MONTH;
  // 그 달 회계주 전부 합산 (이 달 날이 하나라도 있으면 열 표시 — 미래주도 포함)
  const weekAgg = [];
  WEEKS.forEach(wk=>{
    let sale=0; const byCat={}; const byChild={};
    let isCurrent=false, hasThisMonth=false, firstD=null, lastD=null;
    wk.forEach(day=>{
      if(day.m !== TM) return;                          // 다른 달 끼임 제외
      hasThisMonth=true;
      if(firstD===null) firstD=day.d;
      lastD=day.d;
      if(ctx.IS_CURRENT && day.d===ctx.TODAY) isCurrent=true;  // 데이터 유무 무관 진행주 표시
      if(ctx.IS_CURRENT && day.d > ctx.TODAY) return;   // 미래 집계만 제외
      const key = `${day.m}-${String(day.d).padStart(2,'0')}`;
      const data = ctx.DAYS[key];
      if(!data) return;
      sale += data.sale||0;
      (ctx.cats||[]).forEach(c=>{ byCat[c.key]=(byCat[c.key]||0)+(data.byCat?.[c.key]||0); });
      Object.entries(data.byChild||{}).forEach(([pName,kids])=>{
        if(!byChild[pName]) byChild[pName]={};
        Object.entries(kids).forEach(([cName,amt])=>{ byChild[pName][cName]=(byChild[pName][cName]||0)+amt; });
      });
    });
    if(hasThisMonth) weekAgg.push({idx:weekAgg.length+1, sale, byCat, byChild, isCurrent, firstD, lastD});
  });
  if(!weekAgg.length) return '';

  const fmtMan = (won)=>{ const man = Math.round((won||0)/10000); return man>0 ? man.toLocaleString('ko-KR') : '-'; };
  // 카테고리 전부 (월 총합 큰 순, 0원도 포함 — 뒤로 감)
  const allCats = [...(ctx.cats||[])].sort((a,b)=>{
    const av=weekAgg.reduce((s,w)=>s+(w.byCat[a.key]||0),0);
    const bv=weekAgg.reduce((s,w)=>s+(w.byCat[b.key]||0),0);
    return bv-av;
  });
  // 진행주 배지
  const curWk = weekAgg.find(w=>w.isCurrent);
  const badge = (ctx.IS_CURRENT && curWk) ? `<span class="wk-badge">${curWk.idx}주차 진행중</span>` : '';

  // 헤더 (주차 + 날짜 범위, 첫 주만 월 표기)
  let head = '<th></th>';
  weekAgg.forEach(w=>{
    const wd = (w.idx===1) ? `${TM}/${w.firstD}~${w.lastD}` : `${w.firstD}~${w.lastD}`;
    head += `<th class="${w.isCurrent?'cur':''}">${w.idx}주<span class="wd">${wd}</span></th>`;
  });

  // 매출 행
  let body = `<tr class="row-sales"><td>매출</td>`;
  weekAgg.forEach(w=>{ body += `<td class="${w.isCurrent?'cur':''}">${fmtMan(w.sale)}</td>`; });
  body += `</tr>`;

  // 지출 카테고리 전부 + 자식
  allCats.forEach(c=>{
    const monthTotal = weekAgg.reduce((s,w)=>s+(w.byCat[c.key]||0),0);
    const zeroCls = monthTotal>0 ? '' : ' zero';
    const childNames = Object.keys(ctx.monthChildMap?.[c.name]||{});
    body += `<tr class="row-parent${zeroCls}"><td><span class="dot" style="background:${c.color};"></span>${c.name}</td>`;
    weekAgg.forEach(w=>{
      const v = w.byCat[c.key]||0;
      const pct = (w.sale>0 && v>0) ? Math.round(v/w.sale*100) : 0;
      const pctSub = (v>0 && pct>0) ? `<span class="ps">${pct}%</span>` : '';
      body += `<td class="${w.isCurrent?'cur':''}">${fmtMan(v)}${pctSub}</td>`;
    });
    body += `</tr>`;
    childNames.forEach(cn=>{
      body += `<tr class="row-child"><td>${cn}</td>`;
      weekAgg.forEach(w=>{
        const v = (w.byChild?.[c.name]?.[cn])||0;
        body += `<td class="${w.isCurrent?'cur':''}">${fmtMan(v)}</td>`;
      });
      body += `</tr>`;
    });
  });

  // 지출 합계 행
  let total = `<tr class="row-total"><td>지출 합계</td>`;
  weekAgg.forEach(w=>{
    let e=0; (ctx.cats||[]).forEach(c=>{ e+=w.byCat[c.key]||0; });
    total += `<td class="${w.isCurrent?'cur':''}">${fmtMan(e)}</td>`;
  });
  total += `</tr>`;

  // 순수익 행 (매출 - 지출합계) — 적자(음수)도 표시
  const fmtManSigned = (won)=>{ const man = Math.round((won||0)/10000); return man.toLocaleString('ko-KR'); };
  let profit = `<tr class="row-profit"><td>순수익</td>`;
  weekAgg.forEach(w=>{
    let e=0; (ctx.cats||[]).forEach(c=>{ e+=w.byCat[c.key]||0; });
    const p = w.sale - e;
    const hasAny = w.sale>0 || e>0;
    const cls = (w.isCurrent?'cur ':'') + (p<0?'neg':'');
    profit += `<td class="${cls.trim()}">${hasAny ? fmtManSigned(p) : '-'}</td>`;
  });
  profit += `</tr>`;

  return `
    <div class="wk-matrix">
      <div class="wk-head"><span class="ttl">📊 주차별 흐름 <span class="unit">단위: 만원</span></span>${badge}</div>
      <table class="wk-tbl">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}${total}${profit}</tbody>
      </table>
      <div class="wk-matrix-note">% 는 해당 주 매출 대비 · 진행 안 한 주는 -</div>
    </div>`;
}

// ─── v17 캘린더 렌더 ───
function v17RenderCalendar(){
  const ctx = _v17Ctx; if(!ctx) return;
  const grid = document.getElementById('v17CalGrid'); if(!grid) return;
  // 2026-05-22: chip 텍스트 동적 카테고리 (ctx.cats)
  let chipText = '📊 매출+순수익 ▾';
  if(_v17CurrentCat !== 'default'){
    const c = (ctx.cats||[]).find(c=>c.key===_v17CurrentCat);
    chipText = `📊 ${c?.name || _v17CurrentCat} 비율 ▾`;
  }
  const chip = document.getElementById('v17CalModeChip');
  if(chip) chip.textContent = chipText;
  const FIRST_DOW = new Date(ctx.YEAR, ctx.MONTH_IDX, 1).getDay();
  let html = '';
  ['일','월','화','수','목','금','토'].forEach((wk,i)=>{
    const cls = i===0?'sun':(i===6?'sat':'');
    html += `<div class="v17-cal-wkh ${cls}">${wk}</div>`;
  });
  for(let i=0;i<FIRST_DOW;i++) html += `<div class="v17-cal-cell empty"></div>`;
  for(let d=1; d<=ctx.LAST_DAY; d++){
    const dd = String(d).padStart(2,'0');
    const key = `${ctx.TARGET_MONTH}-${dd}`;
    const data = ctx.DAYS[key];
    const isToday = ctx.IS_CURRENT && d===ctx.TODAY;
    const isFuture = ctx.IS_CURRENT && d>ctx.TODAY;
    const dow = (FIRST_DOW + d - 1) % 7;
    const wkCls = dow===0?'sun':(dow===6?'sat':'');
    const todayCls = isToday?' today':'';
    if(isFuture){
      html += `<div class="v17-cal-cell future ${wkCls}"><span class="cc-day">${d}</span></div>`;
      continue;
    }
    // 명시적 휴무(sales_daily.source='closed')만 휴무 셀로 표시
    if(data && data.holiday){
      const fxdLoss = -(data.fixed||0);
      const lossTxt = fxdLoss ? v17FmtCompact(fxdLoss) : '';
      html += `<div class="v17-cal-cell closed${todayCls} ${wkCls}" data-day="${d}">
        <span class="cc-day">${d}</span>
        <span style="font-size:11px;text-align:center;line-height:1;">🏖</span>
        ${lossTxt?`<span class="cc-profit neg${v17CellAutoFs(lossTxt)}">${lossTxt}</span>`:''}
      </div>`;
      continue;
    }
    // 데이터 없음 = 깨끗한 빈 셀 (휴무 X). future 셀과 동일 디자인 + 클릭 가능 (휴무 표시 위해)
    if(!data){
      html += `<div class="v17-cal-cell${todayCls} ${wkCls}" data-day="${d}" style="background:transparent;border:1px dashed var(--gray-200);">
        <span class="cc-day" style="color:var(--gray-400);">${d}</span>
      </div>`;
      continue;
    }
    if(_v17CurrentCat!=='default'){
      // 2026-05-22: byCat 동적 카테고리
      const catVal = (data.byCat?.[_v17CurrentCat]) || 0;
      const pct = data.sale>0 ? (catVal/data.sale*100) : 0;
      const catObj = (ctx.cats||[]).find(c=>c.key===_v17CurrentCat);
      const th = catObj?.threshold || 0;
      let heatCls = '';
      if(th>0){
        heatCls = pct > th ? ' heat-bad' : (pct > th*0.85 ? ' heat-warn' : ' heat-good');
      }
      html += `<div class="v17-cal-cell${heatCls}${todayCls} ${wkCls}" data-day="${d}">
        <span class="cc-day">${d}</span>
        <span class="cc-cat${v17CellAutoFs(v17FmtCompact(catVal))}">${v17FmtCompact(catVal)}</span>
        <span class="cc-profit ${th && pct>th?'neg':'pos'}">${pct.toFixed(0)}%</span>
      </div>`;
    } else {
      html += `<div class="v17-cal-cell${todayCls} ${wkCls}" data-day="${d}">
        <span class="cc-day">${d}</span>
        <span class="cc-sale${v17CellAutoFs(v17FmtCompact(data.sale))}">${v17FmtCompact(data.sale)}</span>
        <span class="cc-profit${v17CellAutoFs((data.profit>=0?'+':'')+v17FmtCompact(data.profit))} ${data.profit>=0?'pos':'neg'}">${data.profit>=0?'+':''}${v17FmtCompact(data.profit)}</span>
      </div>`;
    }
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.v17-cal-cell[data-day]').forEach(cell=>{
    cell.addEventListener('click',()=>v17OpenDailySheet(parseInt(cell.dataset.day)));
  });
}

// ─── 일별 시트 (셀 탭) ───
let _v17SheetSelectedDate = null; // 휴무 표시/해제 버튼용
function v17OpenDailySheet(d){
  const ctx = _v17Ctx; if(!ctx) return;
  const key = `${ctx.TARGET_MONTH}-${String(d).padStart(2,'0')}`;
  const data = ctx.DAYS[key];
  // v17CloseAllSheets() 호출 X — setTimeout 경쟁 조건으로 시트 즉시 닫힘 버그
  // 셀 날짜 저장 (휴무 표시/해제 버튼용)
  _v17SheetSelectedDate = `${ctx.YEAR}-${String(ctx.TARGET_MONTH).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const isHoliday = !!(data && data.holiday);
  const isEmpty = !data;
  // 버튼 토글
  const btnMark = document.getElementById('v17ShtMarkClosedBtn');
  const btnUnmark = document.getElementById('v17ShtMarkOpenBtn');
  if(btnMark) btnMark.style.display = isHoliday ? 'none' : 'block';
  if(btnUnmark) btnUnmark.style.display = isHoliday ? 'block' : 'none';
  if(isEmpty || isHoliday){
    document.getElementById('v17ShtSale').textContent = '-';
    document.getElementById('v17ShtExp').innerHTML = '-';
    document.getElementById('v17ShtProfit').innerHTML = '-';
    const label = isHoliday ? '🏖 휴무' : '데이터 없음';
    document.getElementById('v17ShtCats').innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--gray-400);font-size:13px;">${label}</div>`;
  } else {
    const expPct = data.sale>0 ? (data.exp/data.sale*100).toFixed(0) : 0;
    const profitPct = data.sale>0 ? (data.profit/data.sale*100).toFixed(0) : 0;
    document.getElementById('v17ShtSale').textContent = v17FmtNoWon(data.sale)+'원';
    document.getElementById('v17ShtExp').innerHTML = `${v17FmtNoWon(data.exp)}원<span class="vp">${expPct}%</span>`;
    const p = data.profit;
    const pEl = document.getElementById('v17ShtProfit');
    pEl.innerHTML = `${v17FmtNoWonSigned(p)}원<span class="vp">${p>=0?'+':''}${profitPct}%</span>`;
    pEl.style.color = p>=0?'#10B981':'#EF4444';
    // 2026-05-22: 사장님 매장 카테고리 전체 동적 표시
    const cats = ctx.cats || [];
    let html = '';
    cats.forEach(c=>{
      const v = (data.byCat?.[c.key]) || 0;
      if(v <= 0) return; // 0원 카테고리 표시 X
      const pct = data.sale>0 ? (v/data.sale*100) : 0;
      let pctCls = 'pct';
      let icon = '';
      if(c.threshold){
        if(pct>c.threshold){pctCls += ' over';icon=' ⚠️';}
        else if(pct<c.threshold*0.85) pctCls += ' good';
      }
      html += `<div class="v17-sht-cat-row">
        <span class="cn"><span class="dot" style="background:${c.color};"></span>${c.name}</span>
        <span class="vl">${v17FmtNoWon(v)}원</span>
        <span class="${pctCls}">${pct.toFixed(1)}%${icon}</span>
      </div>`;
    });
    if(!html) html = `<div style="text-align:center;padding:20px 0;color:var(--gray-400);font-size:12px;">카테고리별 내역 없음</div>`;
    document.getElementById('v17ShtCats').innerHTML = html;
  }
  const dt = new Date(ctx.YEAR, ctx.MONTH_IDX, d);
  const dayName = ['일','월','화','수','목','금','토'][dt.getDay()];
  document.getElementById('v17ShtDate').textContent = `${ctx.TARGET_MONTH}/${d}`;
  document.getElementById('v17ShtDay').textContent = `(${dayName})`;
  openSheet('v17DailySheet');
}

// ─── v17 휴무 표시/해제 (2026-05-22 복원) ───
async function v17MarkClosed(){
  if(!_v17SheetSelectedDate) return;
  closeSheet('v17DailySheet');
  await markDateAsClosed(_v17SheetSelectedDate);
}
async function v17MarkOpen(){
  if(!_v17SheetSelectedDate) return;
  if(!currentStore){toast('매장 없음','error');return;}
  if(!confirm(`${_v17SheetSelectedDate} 휴무 해제할까요?`))return;
  setLoad(true,'해제 중...');
  try{
    const{error}=await sb.from('sales_daily').delete()
      .eq('store_id',currentStore.id).eq('date',_v17SheetSelectedDate).eq('source','closed');
    if(error)throw error;
    closeSheet('v17DailySheet');
    toast('휴무 해제됐어요','success');
    await loadDashboard(true);
  }catch(e){
    console.error('휴무 해제:',e);
    toast('해제 실패: '+e.message,'error');
  }finally{
    setLoad(false);
  }
}

// ─── 필터 시트 ─── 2026-05-22 동적 카테고리
function v17OpenFilterSheet(){
  // v17CloseAllSheets() 호출 X — setTimeout 경쟁 조건으로 시트 즉시 닫힘 버그
  const ctx = _v17Ctx;
  const opts = [{key:'default', name:'매출 + 순수익', color:'#0050FF'}];
  (ctx?.cats || []).forEach(c=>{
    opts.push({key:c.key, name:c.name+' 비율', color:c.color});
  });
  let html = '';
  opts.forEach(o=>{
    const active = o.key===_v17CurrentCat ? 'active' : '';
    html += `<div class="v17-filter-row ${active}" data-cat="${o.key}">
      <span><span class="dot" style="background:${o.color};"></span>${o.name}</span>
      <span class="check">✓</span>
    </div>`;
  });
  document.getElementById('v17FilterList').innerHTML = html;
  document.querySelectorAll('#v17FilterList .v17-filter-row[data-cat]').forEach(row=>{
    row.addEventListener('click',()=>{
      _v17CurrentCat = row.dataset.cat;
      v17RenderCalendar();
      v17CloseAllSheets();
    });
  });
  openSheet('v17FilterSheet');
}

function v17CloseAllSheets(){
  closeSheet('v17DailySheet');
  closeSheet('v17FilterSheet');
}

// ─── v17 진입 (loadDashboard에서 호출) ───
function v17RenderAll(){
  if(!_v17Ctx) return;
  v17RenderMonthCard();
  v17RenderCalendar();
  v17RenderMonthDetail(); // 월 세부 화면 (요약 카드 탭 진입, 2026-06-03)
  // 세부 화면 월 라벨 동기화
  const mdLabel = document.getElementById('mdMonthLabel');
  if(mdLabel) mdLabel.textContent = `${_v17Ctx.YEAR}년 ${_v17Ctx.TARGET_MONTH}월`;
}

// ═════════════════════════════════════════════════════════════════
// ═══ v17 정산현황 끝 ═══
// ═════════════════════════════════════════════════════════════════

// ─── 새 기능: 매출 빠른 입력 시트 (마감정산 형식, 2026-05-15) ─── //
// paymentMethods 버그 우회: sales_daily 레거시 컬럼 직매핑
const QUICK_SALES_METHODS=[
  {key:'card',         name:'신용카드',   icon:'💳', dot:'blue'},
  {key:'cash',         name:'현금',       icon:'💵', dot:'green'},
  {key:'cash_receipt', name:'현금영수증', icon:'🧾', dot:'orange'},
  {key:'qr',           name:'QR',         icon:'📱', dot:'purple'},
  {key:'etc',          name:'기타결제',   icon:'📲', dot:'gray'}
];
function openQuickSalesInput(initialDate){
  if(!currentStore){toast('매장을 먼저 선택하세요','error');return;}
  // 2026-05-25 사장님 호소: today-detail에서 보던 일자 인계 + 기존 데이터 자동 로드
  //  · initialDate 우선 (today-detail/캘린더 셀 → 그 날짜)
  //  · 없으면 _tdDay (오늘 매출 화면이 보고 있던 날) 폴백
  //  · 그것도 없으면 오늘
  const fallbackDay = (typeof _tdDay !== 'undefined' && _tdDay) ? _tdDay : ymdLocal(new Date());
  const day = initialDate || fallbackDay;
  document.getElementById('qsiDate').value = day;
  const cont=document.getElementById('qsiRowsContainer');
  cont.innerHTML=QUICK_SALES_METHODS.map(m=>`
    <div class="qsi-row dot-${m.dot||'gray'}">
      <span class="qsi-ic">${m.icon}</span>
      <span class="qsi-lb">${m.name}</span>
      <input type="text" inputmode="numeric" class="qsi-input" placeholder="0" data-key="${m.key}" data-input="onQuickSalesInputChange|this">
    </div>
  `).join('');
  document.getElementById('qsiMemo').value='';
  document.getElementById('qsiTotal').innerText='0원';
  openSheet('quickSalesInputSheet');
  // 시트 연 직후 기존 데이터 자동 로드 (사장님: "기존데이터가 있어야되지 않을까")
  _loadQsiDataForDate(day);
}
// 2026-05-25 신설: 선택 일자의 sales_daily 행 조회 → 결제수단 input + 메모 채우기
//  · 데이터 없으면 input 비움 (덮어쓰기 안전) + 합계 0원
//  · 호출처: 시트 첫 진입 / 날짜 input change
async function _loadQsiDataForDate(date){
  if(!currentStore || !date) return;
  // 우선 input들을 비워서 옛 날짜 잔재 제거 (다른 날 → 데이터 없는 날 점프 시 옛 값 남는 거 방지)
  document.querySelectorAll('#qsiRowsContainer .qsi-input').forEach(el=>{ el.value=''; });
  const memoEl = document.getElementById('qsiMemo');
  if(memoEl) memoEl.value = '';
  const totalEl = document.getElementById('qsiTotal');
  if(totalEl) totalEl.innerText = '0원';
  // sales_daily 조회
  const {data, error} = await sb.from('sales_daily')
    .select('*')
    .eq('store_id', currentStore.id)
    .eq('date', date)
    .maybeSingle();
  if(error){ console.warn('[qsi load]', error.message); return; }
  if(!data){
    // 데이터 없음 — input 비운 상태 그대로 (이미 위에서 처리)
    return;
  }
  // 결제수단 input 채우기
  document.querySelectorAll('#qsiRowsContainer .qsi-input').forEach(el=>{
    const k = el.dataset.key;
    const v = Number(data[k]||0);
    el.value = v ? fmt(v) : '';
  });
  if(memoEl && data.memo) memoEl.value = data.memo;
  _recalcQsiTotal();
}
function onQsiDateChange(el){
  if(!el || !el.value) return;
  _loadQsiDataForDate(el.value);
}
function onQuickSalesInputChange(el){
  const raw=unFmt(el.value);
  el.value=raw?fmt(raw):'';
  _recalcQsiTotal();
}
function _recalcQsiTotal(){
  let t=0;
  document.querySelectorAll('#qsiRowsContainer .qsi-input').forEach(el=>{t+=Number(unFmt(el.value))||0;});
  document.getElementById('qsiTotal').innerText=fmt(t)+'원';
}
async function saveQuickSalesInput(){
  if(!currentStore){toast('매장 없음','error');return;}
  const date=document.getElementById('qsiDate').value;
  if(!date){toast('날짜를 선택해주세요','error');return;}
  const memo=document.getElementById('qsiMemo').value.trim()||null;
  const row={store_id:currentStore.id,date,source:'manual',memo};
  let total=0;
  document.querySelectorAll('#qsiRowsContainer .qsi-input').forEach(el=>{
    const k=el.dataset.key;
    const v=Number(unFmt(el.value))||0;
    row[k]=v;
    total+=v;
  });
  if(total<=0){toast('금액을 1원 이상 입력해주세요','error');return;}
  setLoad(true,'저장 중...');
  try{
    const{data:existing}=await sb.from('sales_daily').select('id').eq('store_id',currentStore.id).eq('date',date).maybeSingle();
    if(existing){
      if(!confirm(`${date} 매출이 이미 있어요. 덮어쓸까요?`)){setLoad(false);return;}
      const{error}=await sb.from('sales_daily').update(row).eq('id',existing.id);
      if(error)throw error;
    }else{
      const{error}=await sb.from('sales_daily').insert(row);
      if(error)throw error;
    }
    closeSheet('quickSalesInputSheet');
    toast('매출 저장됐어요','success');
    if(typeof cacheInvalidate === 'function') cacheInvalidate('');
    await loadDashboard(true);
  }catch(e){
    console.error('매출 저장:',e);
    toast('저장 실패: '+e.message,'error');
  }finally{
    setLoad(false);
  }
}

// ─── 새 기능: 캘린더 빈 셀 액션 + 휴무 표시 (2026-05-15) ─── //
let _calCellSelectedDate=null;
function handleCalCellClick(date){
  _calCellSelectedDate=date;
  const d=new Date(date+'T00:00:00');
  const dow=['일','월','화','수','목','금','토'][d.getDay()];
  document.getElementById('calCellActionTitle').innerText=`${date.slice(5)} (${dow})`;
  openSheet('calCellActionSheet');
}
function calCellInputSales(){
  closeSheet('calCellActionSheet');
  setTimeout(()=>{
    // 2026-05-25: 캘린더 셀 클릭 = 해당 날짜로 직접 진입 (기존 데이터 자동 로드 통일)
    openQuickSalesInput(_calCellSelectedDate || null);
  },100);
}
function calCellMarkClosed(){
  if(_calCellSelectedDate)markDateAsClosed(_calCellSelectedDate);
}
function markTodayAsClosed(){
  markDateAsClosed(ymdLocal(new Date()));
}
async function markDateAsClosed(date){
  if(!currentStore){toast('매장 없음','error');return;}
  if(!confirm(`${date} 휴무로 표시할까요?`))return;
  setLoad(true,'저장 중...');
  try{
    const row={store_id:currentStore.id,date,source:'closed',memo:'휴무',card:0,cash:0,cash_receipt:0,qr:0,etc:0};
    const{data:existing}=await sb.from('sales_daily').select('id').eq('store_id',currentStore.id).eq('date',date).maybeSingle();
    if(existing){
      const{error}=await sb.from('sales_daily').update(row).eq('id',existing.id);if(error)throw error;
    }else{
      const{error}=await sb.from('sales_daily').insert(row);if(error)throw error;
    }
    closeSheet('calCellActionSheet');
    toast('휴무로 표시됐어요','success');
    await loadDashboard(true);  // v17 달력은 loadDashboard 끝 v17RenderAll에서 갱신
  }catch(e){
    console.error('휴무 저장:',e);
    toast('저장 실패: '+e.message,'error');
  }finally{
    setLoad(false);
  }
}

// ─── 달력 버튼: v17 달력 바텀시트 열기 (2026-06-03 — 인라인 달력 → 시트 이동) ─── //
function openSalesCalendarSheet(){
  // v17CalGrid는 시트 안으로 옮겨졌고, _v17Ctx로 이미 렌더됨. 시트만 열면 됨
  const lbl=document.getElementById('salesCalSheetMonth');
  if(lbl) lbl.innerText=dashMonthStr;
  if(_v17Ctx) v17RenderCalendar();
  openSheet('salesCalendarSheet');
}

