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
// ─── 거래처별 오늘 지출 캐싱 (2026-06-03 바텀시트로 전환) ───
const _VE_COLORS=['#22C55E','#3B82F6','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#94A3B8'];
function renderTodayVendorExp(veMap, hasSale, dayExp){
  // 기존 카드는 항상 숨김 — 데이터만 캐싱 (바텀시트에서 사용)
  const card=document.getElementById('dashTodayVendorCard');
  if(card) card.style.display='none';
  _todayVendorDataCache = (hasSale && veMap && Object.keys(veMap).length) ? {veMap, dayExp} : null;
}
// ─── 어디에 썼나 바텀시트 열기 (2026-06-03 카테고리별 그룹핑) ───
function openTodayVendorSheet(){
  const d = _todayVendorDataCache;
  if(!d){ toast('지출 데이터가 없습니다.'); return; }
  const {veMap, dayExp} = d;
  // veMap = { '쿠팡|비품': {name, cat, amt}, ... } → 거래처+카테고리 단위
  const rows = Object.values(veMap).map(o=>({name:o.name, cat:o.cat||'기타', amt:o.amt}));
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

  const sumEl = document.getElementById('vendorExpSheetSum');
  const listEl = document.getElementById('vendorExpSheetList');
  // '곳' = 고유 거래처 수 (쿠팡이 비품·식자재로 쪼개져도 1곳)
  const vendorCount = new Set(rows.map(r=>r.name)).size;
  if(sumEl) sumEl.innerText = `${vendorCount}곳 · ${fmt(total)}원`;
  if(listEl){
    const groupsHtml = groups.map((g,i)=>{
      const color = _VE_COLORS[i % _VE_COLORS.length];
      const pct = total>0 ? Math.round(g.sum/total*100) : 0;
      const itemsHtml = g.items.map(it=>
        `<div class="ve-row"><span class="vname">${esc(it.name)}</span><span class="vamt">${fmt(it.amt)}원</span></div>`
      ).join('');
      return `<div class="ve-group">`
        + `<div class="ve-cat-head"><span class="ve-cat-dot" style="background:${color};"></span>`
        + `<span class="ve-cat-name">${esc(g.cat)}</span>`
        + `<span class="ve-cat-pct">${pct}%</span>`
        + `<span class="ve-cat-sum">${fmt(g.sum)}원</span></div>`
        + itemsHtml
        + `</div>`;
    }).join('');
    const totalHtml = `<div class="ve-total"><span class="ve-total-lb">전체 합계</span><span class="ve-total-vl">${fmt(total)}원</span></div>`;
    listEl.innerHTML = groupsHtml + totalHtml;
  }
  openSheet('vendorExpSheet');
}
// 바텀시트 내 더보기 토글 — 카테고리 그룹핑 전환으로 더보기 폐기 (호환 유지, 2026-06-03)
function toggleVendorMoreSheet(btn){ /* 더보기 없음 (전부 표시) */ }
// ─── 홈 매출 카드 날짜 네비 (2026-06-03) ───
function topCardDayMove(dir){
  if(!_topCardCtx || !_topCardDay) return;
  const d = parseInt(_topCardDay.slice(8), 10);
  const newD = d + Number(dir);
  if(newD < 1) return;
  if(newD > new Date().getDate()) return;
  renderTopCardForDay(_topCardCtx.ym + '-' + String(newD).padStart(2,'0'));
}
function renderTopCardForDay(dayStr){
  if(!_topCardCtx) return;
  const ctx = _topCardCtx;
  _topCardDay = dayStr;
  const dayPad = dayStr.slice(8);
  const d = parseInt(dayPad, 10);
  const todayD = new Date().getDate();
  const isTodayShown = d === todayD;

  const topAmtEl = document.getElementById('dashTopSalesAmt');
  const topModeEl = document.getElementById('dashTopSalesMode');
  const topUpdEl = document.getElementById('dashTopSalesUpdated');
  const peEl = document.getElementById('dashTopSalesProfitExpense');
  const emptyCtaEl = document.getElementById('dashTopSalesEmptyCta');

  const saleAmt = ctx.dailySalesMap[dayPad] || 0;
  const dayExp = ctx.dailyExpTotal[dayPad] || 0;
  const dayProfit = saleAmt - dayExp;
  const prevExp = ctx.prevDailyExpTotal[dayPad] || 0;
  const prevSale = ctx.prevDailySalesMap[dayPad] || 0;
  const prevProfit = prevSale - prevExp;

  // 라벨
  const dow = ['일','월','화','수','목','금','토'][new Date(ctx.ym+'-'+dayPad+'T00:00:00').getDay()];
  const moStr = String(ctx.mo).padStart(2,'0');
  const titleLabel = isTodayShown ? '오늘 매출' : '어제 매출';
  const modeLabel = ctx.isUpsMode ? '실시간' : (isTodayShown ? '(준비중)' : '마감');
  document.getElementById('dashTopSalesLabel').innerText = `${titleLabel} · ${moStr}.${dayPad}(${dow})`;
  topModeEl.innerText = modeLabel;
  topModeEl.className = 't7-mode' + (ctx.isUpsMode ? ' live' : '');

  if(saleAmt > 0){
    topAmtEl.classList.remove('empty');
    topAmtEl.innerHTML = fmt(saleAmt) + '<span class="won">원</span>';
    if(ctx.isUpsMode && isTodayShown){
      const now = new Date();
      topUpdEl.innerHTML = `업데이트 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} <span class="refresh">↻</span>`;
      topUpdEl.style.display = '';
    } else { topUpdEl.style.display = 'none'; }
    emptyCtaEl.style.display = 'none';
    const _isP = dayProfit >= 0;
    document.getElementById('dashTopExpenseAmt').innerText = '-' + fmt(dayExp) + '원';
    const profitEl = document.getElementById('dashTopProfitAmt');
    profitEl.innerText = (_isP?'+':'-') + fmt(Math.abs(dayProfit)) + '원';
    profitEl.classList.toggle('red', !_isP);
    profitEl.classList.toggle('green', _isP);
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
    topAmtEl.innerText = '아직 입력 안 됨';
    topUpdEl.style.display = 'none';
    emptyCtaEl.style.display = 'block';
    peEl.style.display = 'none';
    renderTodayVendorExp(null, false, 0);
  }

  // 네비 버튼 상태 업데이트
  const prevBtn = document.getElementById('dashTopNavPrev');
  const nextBtn = document.getElementById('dashTopNavNext');
  if(prevBtn) prevBtn.disabled = (d <= 1);
  if(nextBtn) nextBtn.disabled = (d >= todayD);
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
    toast(`${ctx.ym} 외 다른 달은 곧 추가됩니다. 대시보드에서 월을 먼저 바꿔주세요.`, 'warn');
    // picker 값은 원래대로 되돌림
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
  const _todayStr = new Date().toISOString().slice(0,10);
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
  else if(isToday) stateLabel = ctx.isUpsMode ? '실시간' : '아직 마감 전';
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
  const _yesterdayStr = (()=>{ const y=new Date(); y.setDate(y.getDate()-1); return y.toISOString().slice(0,10); })();
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
    {key:'extra_large',  name:'뽑기(대형)', color:'#EC4899'},
    {key:'extra_small',  name:'뽑기(소형)', color:'#06B6D4'},
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
  // 기타매출 누적 카드는 백그라운드로 갱신 (대시보드 메인 흐름 차단 안 함)
  renderExtraRevenueDashboard().catch(e=>console.warn('[dashExtraRevenue]',e.message));
  try{
    const ym=dashMonthStr;
    document.getElementById('dashMonthLabel').innerText=ym;
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
    let settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2;
    if(_dashPack){
      ({settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2} = _dashPack);
    } else {
      [settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2]=await Promise.all([
        // 당월 매출 ('settle' = sales_daily 기준 / 'ups' = 업솔루션 daily_sales)
        // Part F Phase 2: select('*') — paymentMethods amounts jsonb + 레거시 7컬럼 모두 수용
        dashSaleSource==='ups'
          ?sb.from('daily_sales').select('sale_date,total_sales,card_sales,cash_sales').eq('store_id',sid).gte('sale_date',start).lte('sale_date',end).order('sale_date')
          :sb.from('sales_daily').select('*').eq('store_id',sid).gte('date',start).lte('date',end).order('date'),
        // 고정비 — 항목별 예상 월 금액 1회 입력 (모든 달 동일 적용)
        sb.from('fixed_costs').select('estimated_monthly,is_active,category').eq('store_id',sid),
        // 진마감 로열티 (병렬 조회, 가마감이면 빈 결과)
        dashMode==='final'
          ?sb.from('mydata_transactions').select('amount').eq('store_id',sid).eq('exclude_from_settlement',false).like('description','%유림에퐁당%').gte('tx_date',start).lte('tx_date',end)
          :Promise.resolve({data:null}),
        // ── 전월 매출 ──
        dashSaleSource==='ups'
          ?sb.from('daily_sales').select('sale_date,total_sales').eq('store_id',sid).gte('sale_date',pStart).lte('sale_date',pEnd)
          :sb.from('sales_daily').select('*').eq('store_id',sid).gte('date',pStart).lte('date',pEnd),
        // ── 일별 카테고리(아래) + 가마감 지출 집계 공유 ──
        sb.from('vendor_orders').select('amount,order_date,vendor_id,vendors(name,category,category_id)').eq('store_id',sid).gte('order_date',start).lte('order_date',end),
        sb.from('receipts').select('total_price,category_id,receipt_date,vendor_id,vendors(name)').eq('store_id',sid).eq('note','정상').gte('receipt_date',start).lte('receipt_date',end),
        sb.from('attendance_logs').select('work_date,calculated_wage,employee_id').eq('store_id',sid).gte('work_date',start).lte('work_date',end),
        // ── 전월 일별 식자재/영수증/인건비 ──
        sb.from('vendor_orders').select('order_date,amount').eq('store_id',sid).gte('order_date',pStart).lte('order_date',pEnd),
        sb.from('receipts').select('receipt_date,total_price').eq('store_id',sid).eq('note','정상').gte('receipt_date',pStart).lte('receipt_date',pEnd),
        sb.from('attendance_logs').select('work_date,calculated_wage,employee_id').eq('store_id',sid).gte('work_date',pStart).lte('work_date',pEnd),
        sb.from('settlements').select('settle_date,items_json').eq('store_id',sid).gte('settle_date',start).lte('settle_date',end)
      ]);
      cacheSet(_dashKey, {settleRes, fcRes, royaltyTxRes, prevSettleRes, voRes2, rcRes2, attRes2, prevVoRes, prevRcRes, prevAttRes, setRes2});
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
    const settle=settleRes.data||[];

    if(dashSaleSource==='ups'){
      settle.forEach(s=>{
        const day=s.sale_date?.slice(8);
        const ds=s.total_sales||0;
        totalRevenue+=ds;dailySalesMap[day]=ds;
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

    // 고정비 일할계산 — 항목별 예상 월 금액 합산 (활성 항목만)
    const fixedMonthly=fcRows.filter(r=>r.is_active!==false).reduce((a,r)=>a+(r.estimated_monthly||0),0);
    const fixedProrated=Math.round(fixedMonthly/lastDay*passedDays);
    // 카테고리별 일할 (차트 그룹 분리용: 고정비/공과금/마케팅/세금 등)
    const fcByCatMonthly={};
    fcRows.filter(r=>r.is_active!==false).forEach(r=>{
      const c=r.category||'고정비';
      fcByCatMonthly[c]=(fcByCatMonthly[c]||0)+(r.estimated_monthly||0);
    });
    const fixedProratedByCat={};
    Object.keys(fcByCatMonthly).forEach(c=>{
      fixedProratedByCat[c]=Math.round(fcByCatMonthly[c]/lastDay*passedDays);
    });

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
    const cardSales=(cardMethod?salesBreakdown[cardMethod.name]:0)||salesBreakdown['신용카드']||salesBreakdown['카드']||0;

    // 로열티/카드수수료 (로열티 쿼리는 위 Promise.all에서 병렬 완료)
    let royalty,cardFee;
    if(dashMode==='final'){
      royalty=(royaltyTxRes.data||[]).reduce((a,r)=>a+Math.abs(r.amount||0),0);
      cardFee=Math.round(cardSales*cardFeeRate);
    } else {
      royalty=Math.round(totalRevenue*royaltyRate);
      cardFee=Math.round(cardSales*cardFeeRate);
    }

    // ══ 핵심 수치 계산 ══
    const totalCostFull=totalCost+royalty+cardFee;
    const netProfit=totalRevenue-totalCostFull;
    // 예비비 / 실수익 폐기 (2026-05-22)

    // 마감예상 계산
    const variableCost=totalCost-fixedProrated;
    const estRevenue=isCurrent&&passedDays>0?Math.round(totalRevenue/passedDays*lastDay):totalRevenue;
    const estVariableCost=isCurrent&&passedDays>0?Math.round(variableCost/passedDays*lastDay):variableCost;
    const estTotalCost=fixedMonthly+estVariableCost;
    const estCardSales=isCurrent&&passedDays>0?Math.round(cardSales/passedDays*lastDay):cardSales;
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

    const expRows=Object.entries(expByGroup)
      .filter(([g,amt])=>amt>=0)
      .map(([g,amt])=>{
        const catObj=(expCategories||[]).find(c=>c.name===g && !c.parent_id);
        return {g, amt, id: catObj?.id || null, color: groupMeta[g]?.color || '#94A3B8', order: groupMeta[g]?.order ?? 999};
      })
      .sort((a,b)=>a.order-b.order || a.g.localeCompare(b.g));
    const expRowsTotal=expRows.reduce((a,r)=>a+r.amt,0);

    // 자식 카테고리 합산 — calcExpenseByCategories에서 받은 childAmounts 그대로 사용 (2026-05-18 통일)
    // 자식 amt = 자체 자동 (attendance_hourly 시급제, attendance_monthly 월급분배) + 모든 소스 매칭 (mydata/receipts/vendor/eca/deductSum)
    // 0원도 표시 (사장님: 카테고리 존재하면 행 등장, FK 잘못 박힘 자기치유)
    const childExpByCat={}; // {부모id: [{name, amt, color, order}]}
    Object.values(calcChildAmounts).forEach(c=>{
      if(!childExpByCat[c.parent_id]) childExpByCat[c.parent_id]=[];
      childExpByCat[c.parent_id].push({name:c.name, amt:c.amount, color:c.color, order:c.sort_order});
    });

    // 세그먼트 바 (전체 카테고리 비율, sort_order 정렬)
    let expSegHtml='<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--gray-100);">';
    expRows.forEach(r=>{
      const w=expRowsTotal>0?(r.amt/expRowsTotal*100):0;
      expSegHtml+=`<div style="width:${w.toFixed(2)}%;background:${r.color};" title="${r.g} ${pctOf(r.amt)}%"></div>`;
    });
    expSegHtml+='</div>';

    // 카테고리: 금액 큰 순 상위 3 + 더보기 (사장님 합의 — top3 = 비중 큰 항목 의사결정용)
    // 2026-05-15 정정: sort_order 적용 시도했으나 top3 합의와 충돌 — 원복 (헌법 3-1 critic 의무)
    // 지출카테고리 화면 드래그 순서는 세그먼트 바 색 순서·관리 화면 시각에만 반영
    const expRowsSorted=[...expRows].sort((a,b)=>b.amt-a.amt);
    const expTop=expRowsSorted.slice(0,3);
    const expRest=expRowsSorted.slice(3);
    const buildCatRow=(r,isMore)=>{
      const children=r.id?(childExpByCat[r.id]||[]).sort((a,b)=>b.amt-a.amt):[];
      const hasChild=children.length>0;
      const hideAttr=isMore?'style="display:none;"':'';
      const moreAttr=isMore?'data-more="1"':'';
      const clickAttr=hasChild?`data-action="toggleExpCatChildren|${r.id}"`:'';
      // 우측 끝(월말예상 컬럼 자리) = "+ 상세보기" 텍스트 (자식 있는 경우)
      const detailCell=hasChild?`<span class="cat-detail-btn">+ 상세보기</span>`:'';
      let h=`<tr class="cat-row" data-row-type="parent" data-cat="${r.id||''}" ${moreAttr} ${hasChild?'data-has-child="1"':''} ${clickAttr} ${hideAttr}>
        <td class="c-name"><span class="cat-dot" style="background:${r.color};"></span>${r.g}</td>
        <td class="c-amt">${fmt(r.amt)}</td>
        <td class="c-pct">${pctOf(r.amt)}%</td>
        <td class="c-detail">${detailCell}</td>
      </tr>`;
      if(hasChild){
        children.forEach(c=>{
          h+=`<tr class="cat-child" data-row-type="child" data-cat="${r.id}" ${moreAttr} style="display:none;">
            <td class="c-name"><span class="cat-dot" style="background:${c.color};"></span>${c.name}</td>
            <td class="c-amt">${fmt(c.amt)}</td>
            <td class="c-pct">${pctOf(c.amt)}%</td>
            <td></td>
          </tr>`;
        });
      }
      return h;
    };

    // 매출대비 비교 자리 — 전월 데이터(prevTotalRevenue 등)는 아래에서 계산되므로
    // placeholder만 두고 후속 코드에서 DOM 삽입 (momSummaryText 패턴)

    // 예상 컬럼 텍스트 (현재 월만)
    const estRevTxt = isCurrent ? fmt(estRevenue) : '';
    const estExpTxt = isCurrent ? fmt(estTotalCostFull) : '';
    const estNetTxt = isCurrent ? ((estNetProfit>=0?'':'-')+fmt(Math.abs(estNetProfit))) : '';

    // ── 단일 표 빌드 (모든 행을 하나의 table에 → column width 자동 일치) ──
    let summHtml='<table class="summ-tbl">';
    summHtml+='<colgroup><col style="width:22%"/><col style="width:36%"/><col style="width:14%"/><col style="width:28%"/></colgroup>';
    if(isCurrent){
      summHtml+='<thead><tr><th class="h-lb"></th><th>지금</th><th></th><th>월말 예상</th></tr></thead>';
    }
    summHtml+='<tbody>';
    // 매출
    summHtml+=`<tr class="summ-link" data-action="nav|sales"><td class="ds-lb">📊 매출 ›</td><td class="ds-amt amt-blue">${fmt(totalRevenue)}</td><td class="ds-pc"></td><td class="ds-est">${estRevTxt}</td></tr>`;
    // 지출
    summHtml+=`<tr><td class="ds-lb">지출</td><td class="ds-amt amt-red">${fmt(totalCostFull)}</td><td class="ds-pc">${pctR(totalCostFull)}</td><td class="ds-est">${estExpTxt}</td></tr>`;
    // 세그먼트 바
    summHtml+=`<tr class="exp-seg-row"><td colspan="4">${expSegHtml}</td></tr>`;
    // 카테고리 상위 3
    expTop.forEach(r=>{summHtml+=buildCatRow(r,false);});
    if(expRest.length){
      // 더보기 행 (가운데 정렬, 사장님 안)
      summHtml+=`<tr id="expMoreToggleRow" class="exp-toggle-row"><td colspan="4" style="text-align:center;"><button class="exp-more-btn" data-action="toggleExpMoreCategories"><span id="expMoreLabel">+ 더보기 ${expRest.length}개 ▾</span></button></td></tr>`;
      // 숨김 카테고리들 + 자식 (default 숨김)
      expRest.forEach(r=>{summHtml+=buildCatRow(r,true);});
      // 접기 행 (펼침 시만 표시, 카테고리 맨 아래 가운데 정렬)
      summHtml+=`<tr id="expCollapseRow" class="exp-toggle-row" data-more="1" style="display:none;"><td colspan="4" style="text-align:center;"><button class="exp-more-btn" data-action="toggleExpMoreCategories">− 접기 ▴</button></td></tr>`;
    }
    // 매출대비 비교 placeholder (카테고리 끝, 순수익 직전 — 전월 데이터 후 채움)
    summHtml+=`<tr id="momCatRow" class="mom-cat-row" style="display:none;"><td colspan="4" id="momCatBody"></td></tr>`;
    // 순수익 (예비비/실수익 폐기 2026-05-22 — summ-total 행으로 격상)
    summHtml+=`<tr class="summ-total"><td class="ds-lb">순수익</td><td class="ds-amt ${netProfit>=0?'amt-blue':'amt-red'}">${netProfit>=0?'':'-'}${fmt(Math.abs(netProfit))}</td><td class="ds-pc">${pctR(netProfit)}</td><td class="ds-est">${estNetTxt}</td></tr>`;
    summHtml+='</tbody></table>';

    // 전월대비 문구 (표 끝, 매출/지출 종합)
    summHtml+=`<p id="momSummaryText" class="mom-text" style="display:none;"></p>`;

    // 옛 dashSummaryGrid null safe (Phase 2 후 DOM 없음)
    const _sgEl = document.getElementById('dashSummaryGrid');
    if(_sgEl) _sgEl.innerHTML = summHtml;

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
    // 로열티/수수료 가상 카테고리 (expense_categories에 없음)
    catNames.push('로열티/수수료');
    catColors['로열티/수수료']='#EF4444';
    shortNames['로열티/수수료']='로열티';
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
    const _catIdToChild={};
    (expCategories||[]).forEach(c=>{
      if(!c.parent_id)return;
      const parent=(expCategories||[]).find(p=>p.id===c.parent_id);
      if(!parent)return;
      _catIdToChild[c.id]={parentName:parent.name,childName:c.name,childColor:c.color||'#94A3B8'};
    });
    const _addChild=(catId,amt)=>{
      if(!catId||!amt||amt<=0)return;
      const m=_catIdToChild[catId];if(!m)return;
      if(!monthChildMap[m.parentName])monthChildMap[m.parentName]={};
      if(!monthChildMap[m.parentName][m.childName])monthChildMap[m.parentName][m.childName]={amt:0,color:m.childColor};
      monthChildMap[m.parentName][m.childName].amt+=amt;
    };
    // ─── 새 기능: 거래처별 일별 지출 집계 (홈 "어디에 썼나", 2026-06-02 / 2026-06-03 카테고리+거래처 분리) ───
    // FK: vendor_id→vendors(name). 직구(vendor_id NULL)·거래처 삭제(ON DELETE SET NULL)는 '직접 구매'
    // 키 = '거래처명|카테고리' 조합 → 쿠팡(비품)·쿠팡(식자재) 별도 집계 (카테고리 섞임 방지)
    const dailyVendorExp={}; // { '02': { '쿠팡|비품': {name, cat, amt}, ... } }
    const _addVE=(d,name,amt,catName)=>{
      if(!amt||amt<=0||!d)return;
      if(!dailyVendorExp[d])dailyVendorExp[d]={};
      const nm=name||'기타', ct=catName||'기타';
      const key=nm+'|'+ct;
      if(!dailyVendorExp[d][key])dailyVendorExp[d][key]={name:nm,cat:ct,amt:0};
      dailyVendorExp[d][key].amt+=amt;
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
      _addVE(d, v.vendors?.name||'거래처', v.amount, k);
      _addChild(v.vendors?.category_id, v.amount);
    });
    (rcDaily||[]).forEach(r=>{
      const d=r.receipt_date?.slice(8);if(!d)return;
      const k = (r.category_id && _catIdToName[r.category_id])
        || srcToCat['receipts'] || '비품';
      if(!dailyCatMap[d])dailyCatMap[d]={};
      dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+(r.total_price||0);
      _addVE(d, r.vendors?.name||'직접 구매', r.total_price, k);
      _addChild(r.category_id, r.total_price);
    });
    (attDaily||[]).forEach(a=>{
      if(monthlyEmpIds.has(a.employee_id)) return; // 월급제는 별도 분배
      const d=a.work_date?.slice(8);if(!d)return;
      if(!dailyCatMap[d])dailyCatMap[d]={};
      const k=srcToCat['attendance'];dailyCatMap[d][k]=(dailyCatMap[d][k]||0)+(a.calculated_wage||0);
      _addVE(d, '직원 급여', a.calculated_wage, '인건비');
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
        });
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
      if(!hasSale) return;
      if(!dailyCatMap[d])dailyCatMap[d]={};
      fixedCats.forEach(cat=>{
        if(dailyFixedShareByCat[cat.name]>0){ dailyCatMap[d][cat.name]=dailyFixedShareByCat[cat.name]; _addVE(d, cat.name, dailyFixedShareByCat[cat.name], '고정비'); }
      });
      // 로열티/수수료: 해당일 매출 기준
      const daySale=dailySalesMap[d]||0;
      const dayRoyalty=Math.round(daySale*royaltyRate);
      const dayCardFee=Math.round(daySale*cardFeeRate);
      if(dayRoyalty+dayCardFee>0){ dailyCatMap[d]['로열티/수수료']=dayRoyalty+dayCardFee; _addVE(d, '로열티·수수료', dayRoyalty+dayCardFee, '로열티/수수료'); }
      // 일별 지출 합계
      let dayExp=0;
      catNames.forEach(c=>{dayExp+=(dailyCatMap[d]?.[c]||0);});
      dailyExpTotal[d]=dayExp;
    });

    // ══ 전월 데이터 처리 (MoM 비교용) ══
    const prevSettle=prevSettleRes.data||[];
    let prevTotalRevenue=0;const prevDailySalesMap={};
    if(dashSaleSource==='ups'){
      prevSettle.forEach(s=>{const d=s.sale_date?.slice(8);prevTotalRevenue+=(s.total_sales||0);if(d)prevDailySalesMap[d]=s.total_sales||0;});
    } else {
      // sales_daily 기준 (본 매출만 — 기타매출 분리)
      prevSettle.forEach(s=>{
        const d=s.date?.slice(8);
        const ds=salesRowTotal(s);
        prevTotalRevenue+=ds;if(d)prevDailySalesMap[d]=ds;
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
    const prevCardFee=Math.round(prevTotalRevenue*cardFeeRate);
    const prevTotalCostFull=prevVendorTotal+prevReceiptTotal+prevAttTotal+prevFcMonthly+prevRoyalty+prevCardFee;
    // 전월 주차별 매출/지출/식자재/인건비
    const prevWeekData=prevWeekGroups.map(wk=>{
      let wS=0,wV=0,wA=0,wR=0;
      wk.forEach(d=>{wS+=(prevDailySalesMap[d]||0);wV+=(prevDailyVendor[d]||0);wA+=(prevDailyAtt[d]||0);wR+=(prevDailyReceipt[d]||0);});
      const wFx=Math.round(prevFcMonthly/pLastDay*wk.length);
      const wRoy=Math.round(wS*royaltyRate),wCf=Math.round(wS*cardFeeRate);
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
        const exp = vendor + att + receipt + fixed + royalty;
        if(sale > 0 || exp > 0){
          // 2026-05-22 byCat 추가 (동적 카테고리 비교용)
          const byCat = {
            '식자재': vendor,
            '인건비': att,
            '비품': receipt,
            '고정비': fixed,
            '공과금': 0,
            '로열티/수수료': royalty,
          };
          prevDailyMap[k] = {sale, vendor, att, fixed, receipt, royalty, exp, profit: sale-exp, byCat};
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
      });
      v17RenderAll();
    } catch(e){ console.error('v17 렌더 오류:', e); }
    // ═══ v17 끝 ═══

    // ══ A-4. 지출 카테고리 — 월 요약 단일 표로 통합됨 (위 빌더 참조, 2026-05-15) ══
    // ══ A-1b. 매출 결제수단별 분해 제거 (2026-05-15) ══
    // ══ A-5. 일별 차트 제거 (2026-05-15) — 주단위 요약 카드와 정보 중복 ══
    destroyChart('dailyChart');

    // ─── 새 기능: 1순위 매출 통합 카드 (매출+지출+순수익, 2026-05-15) ─── //
    // 현재 월일 때만 카드 표시 (다른 월에서 "오늘 매출" 의미 X)
    const isCurMonth=today.toISOString().slice(0,7)===dashMonthStr;
    const topCard=document.getElementById('dashTopSalesCard');
    const emptyCtaEl=document.getElementById('dashTopSalesEmptyCta');
    const peEl=document.getElementById('dashTopSalesProfitExpense');
    const topModeEl=document.getElementById('dashTopSalesMode');
    const topAmtEl=document.getElementById('dashTopSalesAmt');
    const topUpdEl=document.getElementById('dashTopSalesUpdated');
    if(isCurMonth){
      // 전월 일별 지출 맵 (% 비교용, 변동성 큰 vendor/receipt/attendance만)
      const prevDailyExpTotal={};
      (prevVoRes.data||[]).forEach(v=>{const d=v.order_date?.slice(8);if(!d)return;prevDailyExpTotal[d]=(prevDailyExpTotal[d]||0)+(v.amount||0);});
      (prevRcRes.data||[]).forEach(r=>{const d=r.receipt_date?.slice(8);if(!d)return;prevDailyExpTotal[d]=(prevDailyExpTotal[d]||0)+(r.total_price||0);});
      (prevAttRes.data||[]).forEach(a=>{if(monthlyEmpIds.has(a.employee_id))return;const d=a.work_date?.slice(8);if(!d)return;prevDailyExpTotal[d]=(prevDailyExpTotal[d]||0)+(a.calculated_wage||0);});

      // 최근 매출일 찾기 (passedDays까지, source='closed'는 매출 0이라 자동 제외됨)
      const sortedDays=Object.keys(dailySalesMap).filter(d=>parseInt(d)<=passedDays && dailySalesMap[d]>0).sort();
      const lastSaleDay=sortedDays[sortedDays.length-1]||null;
      const todayDayStr=String(today.getDate()).padStart(2,'0');
      const isTodayShown=lastSaleDay===todayDayStr;
      const isUpsMode=(dashSaleSource==='ups');

      // ─── 홈 매출 카드 날짜 네비 컨텍스트 저장 + 렌더 (2026-06-03) ─── //
      _topCardCtx={
        ym, mo,
        dailySalesMap, dailyExpTotal, dailyVendorExp,
        prevDailySalesMap, prevDailyExpTotal,
        isUpsMode, momTxt,
      };
      topCard.style.display='block';
      const _initDay=lastSaleDay
        ? ym+'-'+String(lastSaleDay).padStart(2,'0')
        : new Date().toISOString().slice(0,10);
      renderTopCardForDay(_initDay);

      // ─── 홈 v7 드릴다운: today-detail 화면 채우기 (2026-05-22, 2026-05-25 일자 네비 지원) ───
      try {
        _tdContext = {
          ym, mo, lastDay,
          dailySalesMap, dailyExpTotal, settle, dailyVendorExp,
          lastSaleDay, isUpsMode, isTodayShown, isCurMonth
        };
        renderTodayDetailForDay(_initDay);
      } catch(e){ console.warn('[dashTodayDetail]', e.message); }
    } else {
      topCard.style.display='none';
      _topCardCtx = null;
      _topCardDay = null;
      // today-detail도 빈 상태 (다른 월 보기)
      const _ddAmtX=document.getElementById('dashTodayDetailAmt');
      if(_ddAmtX){
        _ddAmtX.classList.add('empty');
        _ddAmtX.innerText='다른 달은 오늘 매출 없음';
        const _ddDateX=document.getElementById('dashTodayDetailDate');
        const _ddSubX=document.getElementById('dashTodayDetailSub');
        if(_ddDateX) _ddDateX.innerHTML='다른 달 보기 중';
        if(_ddSubX) _ddSubX.innerText='‹ 홈으로 돌아가 이번 달 보기';
      }
      const _pmWrapX=document.getElementById('dashPmCardWrap');
      if(_pmWrapX) _pmWrapX.style.display='none';
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
        _hd.innerText=`${_t.getMonth()+1}월 ${_t.getDate()}일 ${_dowN}요일 · ${_ampm} ${_h12}:${_mm}`;
      }
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
        // ─── 새 기능: 예상마감 (이대로 가면 월말 예상) — 2026-06-02 ───
        // estRevenue/estNetProfit = loadDashboard 399~406줄 기계산값 (변동비만 일할 추정)
        const _fcBlock=document.getElementById('dashHomeFcBlock');
        if(_fcBlock){
          if(isCurMonth && passedDays>0 && passedDays<lastDay){
            const _fcSaleEl=document.getElementById('dashHomeFcSale');
            const _fcProfitEl=document.getElementById('dashHomeFcProfit');
            const _fcSaleMom=document.getElementById('dashHomeFcSaleMom');
            const _fcProfitMom=document.getElementById('dashHomeFcProfitMom');
            // 예상 매출
            if(_fcSaleEl) _fcSaleEl.innerText=fmt(estRevenue)+'원';
            // 예상 수익 (라벨 '예상 수익' 고정, 음수는 -, 색상 동적)
            const _isFcP=estNetProfit>=0;
            if(_fcProfitEl){
              _fcProfitEl.innerText=(_isFcP?'':'-')+fmt(Math.abs(estNetProfit))+'원';
              _fcProfitEl.classList.toggle('red',!_isFcP);
              _fcProfitEl.classList.toggle('green',_isFcP);
            }
            // 지난달 마감 대비 증감 칩 (예상 월말값 vs 전월 전체 마감)
            const _prevNet=prevTotalRevenue-prevTotalCostFull;
            if(_fcSaleMom){
              if(prevTotalRevenue>0){
                const _d=Math.round((estRevenue-prevTotalRevenue)/prevTotalRevenue*100);
                _fcSaleMom.innerText=(_d>=0?'▲':'▼')+Math.abs(_d)+'%';
                _fcSaleMom.classList.remove('red','green');
                _fcSaleMom.classList.add(_d>=0?'green':'red');
                _fcSaleMom.style.display='';
              } else { _fcSaleMom.style.display='none'; }
            }
            if(_fcProfitMom){
              // 수익은 늘면 좋음(초록▲) / 줄면 나쁨(빨강▼). 분모는 절대값
              if(prevTotalRevenue>0 && _prevNet!==0){
                const _d=Math.round((estNetProfit-_prevNet)/Math.abs(_prevNet)*100);
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
const V17_DEFAULT_THRESH = {'식자재':30, '주류':10, '음료':10, '인건비':25, '비품':5, '마케팅':10, '고정비':15, '공과금':15, '세금':10, '기타':10, '로열티/수수료':0};
const V17_COLOR_PALETTE = ['#F59E0B','#8B5CF6','#6B7684','#10B981','#EC4899','#3B82F6','#EF4444','#84CC16','#F97316','#06B6D4','#A855F7','#14B8A6'];

// 옛 srcToCat 매핑 활용 — 옛 한글 카테고리명 ↔ 옛 5키 (호환용, v17SumMonth 옛 키 유지)
function v17MapCatKey(srcToCat){
  return {
    vendor:   srcToCat?.['vendor_orders'] || '식자재',
    att:      srcToCat?.['attendance']    || '인건비',
    fixed:    srcToCat?.['fixed_costs']   || '공과금/고정비',
    receipt:  srcToCat?.['receipts']      || '비품',
    royalty:  '로열티/수수료',
  };
}

// v17 데이터 컨텍스트 (loadDashboard에서 setV17Context로 채움)
let _v17Ctx = null;
let _v17CurrentCat = 'default'; // 캘린더 모드
let _v17CurrentWeekIdx = 0;
let _v17AllWeekData = [];
let _v17AllWeekHtml = [];

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
    }
  });
  return {s,e,vendor,att,fixed,receipt,royalty,lastDay,byCat};
}

// 전월 마지막 회계주 합산 (1주 vs 비교용)
function v17CalcPrevMonthLastWeek(ctx){
  const WEEKS = ctx.WEEKS;
  if(!WEEKS.length) return null;
  const w1start = WEEKS[0][0];
  const startDate = new Date(ctx.YEAR, w1start.m-1, w1start.d);
  const prevDays = [];
  for(let i=7;i>=1;i--){
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() - i);
    prevDays.push({m: dt.getMonth()+1, d: dt.getDate()});
  }
  let s=0,e=0,vendor=0,att=0;
  prevDays.forEach(day=>{
    const key = `${day.m}-${String(day.d).padStart(2,'0')}`;
    const data = ctx.DAYS[key];
    if(!data) return;
    s += data.sale||0; e += data.exp||0;
    vendor += data.vendor||0; att += data.att||0;
  });
  return {s, e, vendor, att, days:prevDays};
}

// 주차 날짜 범위 라벨
function v17WeekRangeLabel(ref){
  const arr = (ref && (ref.wk || ref.days)) || null;
  if(!arr || arr.length<7) return '';
  const s = arr[0], e = arr[6];
  return `${s.m}/${s.d}~${s.m===e.m ? e.d : e.m+'/'+e.d}`;
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
    name: (nm === '로열티/수수료') ? '로열티' : nm,
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
    if(isHoliday && sale===0){
      ctx.DAYS[key] = {holiday:true, sale:0, vendor:0, att:0, fixed:fxd, receipt:0, royalty:0, exp:fxd, profit:-fxd, byCat};
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

// ─── 월 카드 렌더 (v6: 매출/예상 + 순수익/예상 + 간트 두 줄 + 상위3 + 상세보기) ───
function v17RenderMonthCard(){
  const ctx = _v17Ctx; if(!ctx) return;
  const el = document.getElementById('v17MonthCard'); if(!el) return;
  const cur = v17SumMonth(ctx, ctx.TARGET_MONTH, 31);
  const prev = v17SumMonth(ctx, ctx.TARGET_MONTH-1, cur.lastDay);
  const profit = cur.s - cur.e;
  const expPctNum = cur.s>0 ? Math.round(cur.e/cur.s*100) : 0;

  // 월말 예상 계산
  const monthLastDay = new Date(ctx.YEAR, ctx.TARGET_MONTH, 0).getDate();
  const progressDays = cur.lastDay;
  const progressPct = monthLastDay>0 ? Math.round(progressDays/monthLastDay*100) : 0;
  let fcSale = null, fcProfit = null;
  if(progressDays > 0 && progressDays < monthLastDay){
    const ratio = monthLastDay / progressDays;
    fcSale = Math.round(cur.s * ratio);
    const fcExp = Math.round(cur.e * ratio);
    fcProfit = fcSale - fcExp;
  }

  // 자동 폰트 (큰 매장 9자리 대비)
  const maxLen = Math.max(
    Math.abs(cur.s).toLocaleString().length,
    Math.abs(cur.e).toLocaleString().length,
    Math.abs(profit).toLocaleString().length + 1,
    fcSale!==null ? Math.abs(fcSale).toLocaleString().length : 0,
    fcProfit!==null ? Math.abs(fcProfit).toLocaleString().length + 1 : 0
  );
  let cls = '';
  if(maxLen >= 12) cls = 'fs-xs';
  else if(maxLen >= 11) cls = 'fs-s';
  else if(maxLen >= 10) cls = 'fs-m';

  // 매출 전월 대비 % (delta 라벨용)
  let saleDeltaHtml = '';
  if(prev.s > 0){
    const dS = Math.round((cur.s - prev.s)/prev.s*100);
    if(dS === 0) saleDeltaHtml = `<span class="delta" style="color:var(--gray-400);">━</span>`;
    else if(dS > 0) saleDeltaHtml = `<span class="delta up">▲${Math.abs(dS)}%</span>`;
    else saleDeltaHtml = `<span class="delta dn">▼${Math.abs(dS)}%</span>`;
  }

  // 카테고리 정렬 (매출 점유율 내림차순, 사용된 것만)
  const cats = ctx.cats || [];
  const sortedCats = [...cats].sort((a,b)=>(cur.byCat[b.key]||0)-(cur.byCat[a.key]||0)).filter(c=>(cur.byCat[c.key]||0)>0);
  const topCats = sortedCats.slice(0,3);

  // 도넛: 지출 카테고리 분포 (conic-gradient 누적, 2026-06-03 막대→도넛 전환)
  let donutAcc = 0;
  const donutStops = [];
  cats.forEach(c=>{
    const v = cur.byCat[c.key]||0;
    if(v<=0) return;
    const pct = cur.e>0 ? (v/cur.e*100) : 0;  // 지출 대비 (분포)
    if(pct < 0.5) return;
    donutStops.push(`${c.color} ${donutAcc.toFixed(2)}% ${(donutAcc+pct).toFixed(2)}%`);
    donutAcc += pct;
  });
  const donutBg = donutStops.length ? `conic-gradient(${donutStops.join(',')})` : '#F2F4F6';
  // 수익률 막대 (도넛 폭에 맞춤, 도넛 아래 — 매출 대비 순수익)
  const profitPctSale = cur.s>0 ? (profit/cur.s*100) : 0;
  const expPctSale = cur.s>0 ? (cur.e/cur.s*100) : 0;
  let profitBarHtml = '';
  if(profit>=0){
    profitBarHtml = `<span style="background:#10B981;width:${profitPctSale}%;">+${profitPctSale.toFixed(0)}%</span><span style="background:var(--gray-200);width:${expPctSale}%;color:var(--gray-500);">지출</span>`;
  } else {
    const lossPct = Math.abs(profitPctSale);
    profitBarHtml = `<span style="background:#EF4444;width:${Math.min(lossPct,100)}%;">-${lossPct.toFixed(0)}%</span><span style="background:var(--gray-200);width:${Math.max(100-lossPct,0)}%;color:var(--gray-500);">지출</span>`;
  }


  // 6줄: 상세 보기 패널 (전체 카테고리)
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
      ${detailRowsHtml}
      <div class="v17-detail-sum">
        <span class="lb">합계</span>
        <span class="amt">${v17FmtNoWon(cur.e)}원</span>
        <span class="pct">${expPctNum}%</span>
      </div>
    </div>` : '';

  // 7줄: 전월 동일 대비 + 문어체
  let momHtml = '';
  if(prev.s>0){
    const sI = v17MomTag(cur.s, prev.s, 'sale');
    const eI = v17MomTag(cur.e, prev.e, 'expense');
    const compareLabel = `${ctx.TARGET_MONTH-1}/${cur.lastDay}`;
    const dS = prev.s>0 ? Math.round((cur.s-prev.s)/prev.s*100) : 0;
    const dE = prev.e>0 ? Math.round((cur.e-prev.e)/prev.e*100) : 0;
    const comment = v17MomComment(dS, dE);
    momHtml = `<div class="wk-mom">
      <div class="mom-lb">전월 동일(${compareLabel}) 대비 증감률</div>
      <div class="mom-line">매출 ${sI||'━'} · 지출 ${eI||'━'}</div>
      ${comment?`<div class="mom-comment">${comment}</div>`:''}
    </div>`;
  }

  // 예상마감 표시값
  const fcSaleStr = fcSale!==null ? `${v17FmtNoWon(fcSale)}원` : '—';
  const fcProfitStr = fcProfit!==null ? `${fcProfit>=0?'+':''}${v17FmtNoWon(fcProfit)}원` : '—';

  // 순수익률 (매출 대비) 표시
  const profitRateStr = `${profit>=0?'+':''}${profitPctSale.toFixed(0)}%`;
  const profitRateColor = profit>=0 ? '#10B981' : '#EF4444';
  const donutHtml = donutStops.length
    ? `<div class="m6-donut" style="background:${donutBg};"></div>
       <div class="m6-donut-center">
         <span class="dc-pct" style="color:${expPctNum>100?'#EF4444':'#191F28'};">${expPctNum}%</span>
         <span class="dc-lb">매출 대비 지출</span>
       </div>`
    : `<div class="m6-donut" style="background:#F2F4F6;"></div>
       <div class="m6-donut-center"><span class="dc-lb">지출 없음</span></div>`;

  el.innerHTML = `
    <div class="v17-card-v6">
      <div class="v6-ttl-row">
        <div class="v6-ttl"><b>${ctx.TARGET_MONTH}월</b>${progressDays}일 진행</div>
        <span class="v6-progress-tag">${progressPct}%</span>
      </div>
      <div class="m6-top">
        <div class="m6-left">
          <div class="m6-metric">
            <div class="lb">매출</div>
            <div class="vl sale ${cls}">${v17FmtNoWon(cur.s)}원${saleDeltaHtml}</div>
            <div class="est-line"><span class="tag">예상</span>마감 ${fcSaleStr}</div>
          </div>
          <div class="m6-metric profit">
            <div class="lb">순수익</div>
            <div class="vl ${profit<0?'neg':''} ${cls}">${v17FmtNoWonSigned(profit)}원</div>
            <div class="est-line"><span class="tag">예상</span>마감 ${fcProfitStr}</div>
          </div>
        </div>
        <div class="m6-right">
          <div class="m6-donut-wrap">${donutHtml}</div>
          <div class="m6-rate-wrap">
            <div class="rate-lb"><span>순수익률</span><b style="color:${profitRateColor};">${profitRateStr}</b></div>
            <div class="v6-bar profit-bar">${profitBarHtml}</div>
          </div>
        </div>
      </div>
      ${detailPanelHtml}
      ${momHtml}
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

// ─── 주별 카드 5개 렌더 (모달용) + _v17AllWeekHtml 캐시 ───
function v17RenderWeekCards(){
  const ctx = _v17Ctx; if(!ctx) return;
  const weekData = [];
  ctx.WEEKS.forEach((wk,i)=>{
    let s=0,e=0,vendor=0,att=0,fixed=0,receipt=0,royalty=0;
    let hasData=false, isCurrent=false;
    let firstDaysOutCount=0, lastDaysOutCount=0;
    let firstOutDays=[], lastOutDays=[];
    let outsideMonths = new Set();
    const byCat = {};
    (ctx.cats||[]).forEach(c=>{ byCat[c.key]=0; });
    wk.forEach((day,di)=>{
      const key = `${day.m}-${String(day.d).padStart(2,'0')}`;
      const data=ctx.DAYS[key];
      if(day.m===ctx.TARGET_MONTH && day.d>ctx.TODAY && ctx.IS_CURRENT) return;
      if(day.m>ctx.TARGET_MONTH) return;
      const isOutsideMonth = (day.m !== ctx.TARGET_MONTH);
      if(isOutsideMonth){
        outsideMonths.add(day.m);
        if(di<3){firstDaysOutCount++; firstOutDays.push(day);}
        else {lastDaysOutCount++; lastOutDays.push(day);}
      }
      if(!data) return;
      hasData=true;
      if(day.m===ctx.TARGET_MONTH && day.d===ctx.TODAY) isCurrent=true;
      s += data.sale||0; e += data.exp||0;
      vendor += data.vendor||0; att += data.att||0;
      fixed += data.fixed||0; receipt += data.receipt||0; royalty += data.royalty||0;
      (ctx.cats||[]).forEach(c=>{ byCat[c.key] += (data.byCat?.[c.key])||0; });
    });
    weekData.push({wi:i, wk, hasData, isCurrent, s,e,vendor,att,fixed,receipt,royalty,byCat,
      firstDaysOutCount, lastDaysOutCount, firstOutDays, lastOutDays, outsideMonths:[...outsideMonths]});
  });
  const prevMonthLast = v17CalcPrevMonthLastWeek(ctx);

  let html = '';
  _v17AllWeekData = weekData;
  _v17AllWeekHtml = [];
  weekData.forEach((w,idx)=>{
    if(!w.hasData){ _v17AllWeekHtml.push(null); return; }
    const profit = w.s - w.e;
    const profitCls = profit>=0?'pos':'neg';
    const isCurClass = w.isCurrent ? ' current' : '';
    const startDay = w.wk[0], endDay = w.wk[6];
    const startLabel = `${startDay.m}/${startDay.d}`;
    const endLabel = startDay.m===endDay.m ? `${endDay.d}` : `${endDay.m}/${endDay.d}`;
    const fullRangeLabel = `${startLabel} ~ ${endLabel}`;

    // 끼임 박스
    let crossNote = '';
    if(w.firstDaysOutCount > 0){
      const otherM = w.firstOutDays[0].m;
      const fd = w.firstOutDays[0].d;
      const ld = w.firstOutDays[w.firstOutDays.length-1].d;
      const range = fd===ld ? `${otherM}/${fd}` : `${otherM}/${fd}~${ld}`;
      crossNote = `<div class="cross-note">📌 이 주는 ${otherM}월 끝(${range})이 같이 들어있어요. 그래서 카드 매출이 ${ctx.TARGET_MONTH}월 매출 합계와 달라요.</div>`;
    } else if(w.lastDaysOutCount > 0){
      const otherM = w.lastOutDays[0].m;
      const fd = w.lastOutDays[0].d;
      const ld = w.lastOutDays[w.lastOutDays.length-1].d;
      const range = fd===ld ? `${otherM}/${fd}` : `${otherM}/${fd}~${ld}`;
      crossNote = `<div class="cross-note">📌 이 주는 ${otherM}월 시작(${range})이 같이 들어있어요. 그래서 카드 매출이 ${ctx.TARGET_MONTH}월 매출 합계와 달라요.</div>`;
    }

    // 전주 참조
    const prevWeekRef = idx>0 ? weekData[idx-1] : (prevMonthLast && prevMonthLast.s>0 ? prevMonthLast : null);
    const expPctNum = w.s>0 ? Math.round(w.e/w.s*100) : 0;
    const profitPctNum = w.s>0 ? Math.round(profit/w.s*100) : 0;
    let prevExp = prevWeekRef ? (prevWeekRef.e || 0) : 0;

    // 주별 예상마감 (진행 중 주만 계산)
    let fcSaleWk = null, fcProfitWk = null;
    if(w.isCurrent){
      // 이 주 안에서 오늘까지 진행된 일수 (TARGET_MONTH 안에 한정)
      let progressInWeek = 0;
      w.wk.forEach(day=>{
        if(day.m===ctx.TARGET_MONTH && day.d<=ctx.TODAY) progressInWeek++;
      });
      if(progressInWeek > 0 && progressInWeek < 7){
        const ratioWk = 7 / progressInWeek;
        fcSaleWk = Math.round(w.s * ratioWk);
        const fcExpWk = Math.round(w.e * ratioWk);
        fcProfitWk = fcSaleWk - fcExpWk;
      }
    }

    // 자동 폰트 (예상마감까지 포함)
    const maxLenWk = Math.max(
      Math.abs(w.s).toLocaleString().length,
      Math.abs(w.e).toLocaleString().length,
      Math.abs(profit).toLocaleString().length + 1,
      fcSaleWk!==null ? Math.abs(fcSaleWk).toLocaleString().length : 0,
      fcProfitWk!==null ? Math.abs(fcProfitWk).toLocaleString().length + 1 : 0
    );
    let wkFs = '';
    if(maxLenWk >= 12) wkFs = 'fs-xs';
    else if(maxLenWk >= 11) wkFs = 'fs-s';
    else if(maxLenWk >= 10) wkFs = 'fs-m';

    // 매출 전주 대비 % (delta 라벨)
    let saleDeltaHtmlWk = '';
    if(prevWeekRef && prevWeekRef.s > 0){
      const dS = Math.round((w.s - prevWeekRef.s)/prevWeekRef.s*100);
      if(dS === 0) saleDeltaHtmlWk = `<span class="delta" style="color:var(--gray-400);">━</span>`;
      else if(dS > 0) saleDeltaHtmlWk = `<span class="delta up">▲${Math.abs(dS)}%</span>`;
      else saleDeltaHtmlWk = `<span class="delta dn">▼${Math.abs(dS)}%</span>`;
    }

    // 카테고리 정렬
    const cats = ctx.cats || [];
    const wkSorted = [...cats].sort((a,b)=>(w.byCat[b.key]||0)-(w.byCat[a.key]||0)).filter(c=>(w.byCat[c.key]||0)>0);
    const topCats = wkSorted.slice(0,3);

    // 4줄: 간트 두 줄 (지출 분포 / 매출 대비)
    let expStackHtmlWk = '';
    cats.forEach(c=>{
      const v = w.byCat[c.key]||0;
      if(v<=0) return;
      const pct = w.e>0 ? (v/w.e*100) : 0;  // 지출 대비
      if(pct < 0.5) return;
      const overSalePct = w.s>0 ? (v/w.s*100) : 0;
      const overCls = (c.threshold && overSalePct>c.threshold) ? ' over' : '';
      const showText = pct >= 8;
      expStackHtmlWk += `<span class="${overCls.trim()}" style="background:${c.color};width:${pct}%;">${showText?c.name+' '+pct.toFixed(0)+'%':''}</span>`;
    });
    const profitPctSaleWk = w.s>0 ? (profit/w.s*100) : 0;
    const expPctSaleWk = w.s>0 ? (w.e/w.s*100) : 0;
    let profitBarHtmlWk = '';
    if(profit>=0){
      profitBarHtmlWk = `<span style="background:#10B981;width:${profitPctSaleWk}%;">+${profitPctSaleWk.toFixed(0)}%</span><span style="background:var(--gray-200);width:${expPctSaleWk}%;color:var(--gray-500);">지출 ${expPctSaleWk.toFixed(0)}%</span>`;
    } else {
      const lossPctWk = Math.abs(profitPctSaleWk);
      profitBarHtmlWk = `<span style="background:#EF4444;width:${lossPctWk}%;">-${lossPctWk.toFixed(0)}%</span><span style="background:var(--gray-200);width:${expPctSaleWk}%;color:var(--gray-500);">지출 ${expPctSaleWk.toFixed(0)}%</span>`;
    }

    // 5줄: 상위 카테고리 3개 가로
    let catsRowHtmlWk = '';
    topCats.forEach(c=>{
      const v = w.byCat[c.key]||0;
      const prevV = prevWeekRef ? (prevWeekRef.byCat?.[c.key]||0) : 0;
      const pct = w.s>0 ? (v/w.s*100) : 0;
      const overCls = (c.threshold && pct>c.threshold) ? ' over' : '';
      const warnIcon = (c.threshold && pct>c.threshold) ? `<span class="warn">⚠️</span>` : '';
      let momMini = '';
      if(prevV>0){
        const d = Math.round((v-prevV)/prevV*100);
        if(d===0) momMini = `<span class="mom same">━</span>`;
        else if(d>0) momMini = `<span class="mom up">▲${Math.abs(d)}%</span>`;
        else momMini = `<span class="mom dn">▼${Math.abs(d)}%</span>`;
      }
      catsRowHtmlWk += `<div class="v6-cat-chip${overCls}">
        <div class="top"><span class="dot" style="background:${c.color};"></span><span class="nm">${c.name}</span>${warnIcon}</div>
        <div class="bot"><span class="pct">${pct.toFixed(1)}%</span>${momMini}</div>
      </div>`;
    });

    // 6줄: 상세 보기 패널
    let detailRowsHtmlWk = '';
    wkSorted.forEach(c=>{
      const v = w.byCat[c.key]||0;
      const prevV = prevWeekRef ? (prevWeekRef.byCat?.[c.key]||0) : 0;
      const pct = w.s>0 ? (v/w.s*100) : 0;
      const warnIcon = (c.threshold && pct>c.threshold) ? ' ⚠️' : '';
      let momMini = '<span class="mom same">-</span>';
      if(prevV>0){
        const d = Math.round((v-prevV)/prevV*100);
        if(d===0) momMini = `<span class="mom same">━</span>`;
        else if(d>0) momMini = `<span class="mom up">▲${Math.abs(d)}%</span>`;
        else momMini = `<span class="mom dn">▼${Math.abs(d)}%</span>`;
      }
      detailRowsHtmlWk += `<div class="v17-detail-row">
        <div class="nm-side"><span class="dot" style="background:${c.color};"></span><span class="nm">${c.name}${warnIcon}</span></div>
        <span class="amt">${v17FmtNoWon(v)}원</span>
        <span class="pct">${pct.toFixed(1)}%</span>
        ${momMini}
      </div>`;
    });
    const detailPanelHtmlWk = wkSorted.length>0 ? `
      <div class="v17-detail-panel" data-rest-detail="w${w.wi}" style="display:none;">
        <div class="pan-ttl">카테고리별 지출 (전체)</div>
        ${detailRowsHtmlWk}
        <div class="v17-detail-sum">
          <span class="lb">합계</span>
          <span class="amt">${v17FmtNoWon(w.e)}원</span>
          <span class="pct">${expPctNum}%</span>
        </div>
      </div>` : '';

    // 7줄: 저번주 대비 + 문어체
    let momHtml = '';
    if(prevWeekRef){
      const sI = v17MomTag(w.s, prevWeekRef.s, 'sale');
      const eI = v17MomTag(w.e, prevExp, 'expense');
      if(sI || eI){
        const prevRange = v17WeekRangeLabel(prevWeekRef);
        const dS = prevWeekRef.s>0 ? Math.round((w.s-prevWeekRef.s)/prevWeekRef.s*100) : 0;
        const dE = prevExp>0 ? Math.round((w.e-prevExp)/prevExp*100) : 0;
        const comment = v17MomComment(dS, dE);
        momHtml = `<div class="wk-mom">
          <div class="mom-lb">저번주(${prevRange}) 대비 증감률</div>
          <div class="mom-line">매출 ${sI||'━'} · 지출 ${eI||'━'}</div>
          ${comment?`<div class="mom-comment">${comment}</div>`:''}
        </div>`;
      }
    }

    // 예상마감 표시
    const fcSaleStrWk = fcSaleWk!==null ? `${v17FmtNoWon(fcSaleWk)}원` : '—';
    const fcProfitStrWk = fcProfitWk!==null ? `${fcProfitWk>=0?'+':''}${v17FmtNoWon(fcProfitWk)}원` : '—';

    const cardHtml = `
      <div class="v17-card-v6 wk-card${isCurClass}" data-wk="${w.wi}">
        <div class="v6-ttl-row">
          <div class="v6-ttl"><b>${w.wi+1}주</b>${fullRangeLabel}</div>
          ${w.isCurrent ? '<span class="v6-progress-tag">진행중</span>' : '<span class="v6-progress-tag" style="background:var(--gray-100);color:var(--gray-600);">지난주</span>'}
        </div>
        ${crossNote}
        <div class="v6-row2">
          <div>
            <div class="lb">매출</div>
            <div class="vl sale ${wkFs}">${v17FmtNoWon(w.s)}원${saleDeltaHtmlWk}</div>
          </div>
          <div>
            <div class="lb est">예상마감 매출 <span class="est-tag">예상</span></div>
            <div class="vl est-val ${wkFs}">${fcSaleStrWk}</div>
          </div>
        </div>
        <div class="v6-row2 profit-row">
          <div>
            <div class="lb">순수익</div>
            <div class="vl ${profit<0?'neg':''} ${wkFs}">${v17FmtNoWonSigned(profit)}원</div>
          </div>
          <div>
            <div class="lb est">예상마감 순수익 <span class="est-tag">예상</span></div>
            <div class="vl est-val ${wkFs}">${fcProfitStrWk}</div>
          </div>
        </div>
        <div class="v6-exp-row">
          <span class="lb">💸 지출</span>
          <span><span class="vl">${v17FmtNoWon(w.e)}원</span><span class="ratio">(${expPctNum}%)</span></span>
        </div>
        <div class="v6-gantt">
          <div class="gantt-lb"><span>지출 분포</span><span style="color:#EF4444;">${expPctNum}%</span></div>
          <div class="v6-bar">${expStackHtmlWk || '<span style="width:100%;color:var(--gray-400);background:transparent;">지출 데이터 없음</span>'}</div>
          <div class="gantt-lb"><span>매출 대비 순수익</span><span style="color:${profit>=0?'#10B981':'#EF4444'};">${profit>=0?'+':''}${profitPctSaleWk.toFixed(0)}%</span></div>
          <div class="v6-bar profit-bar">${profitBarHtmlWk}</div>
        </div>
        <div class="v6-cats-row">${catsRowHtmlWk || '<div style="grid-column:1/-1;text-align:center;font-size:11px;color:var(--gray-400);padding:6px;">지출 카테고리 없음</div>'}</div>
        ${wkSorted.length>0 ? `<button class="v17-detail-btn" data-rest-toggle="w${w.wi}">상세 보기 <span class="arr">▾</span></button>` : ''}
        ${detailPanelHtmlWk}
        ${momHtml}
      </div>`;
    html += cardHtml;
    _v17AllWeekHtml.push(cardHtml);
  });
  const cont = document.getElementById('v17WeekCardsContainer');
  if(cont) cont.innerHTML = html;
  // 진행중 주차 인덱스
  const ci = _v17AllWeekData.findIndex(w=>w.isCurrent);
  _v17CurrentWeekIdx = ci>=0 ? ci : 0;
}

// ─── 주차 보기 (카드 1개 + 한 줄 달력 + 끼임 박스 이동) ───
function v17RenderWeekViewSingle(){
  const ctx = _v17Ctx; if(!ctx) return;
  const w = _v17AllWeekData[_v17CurrentWeekIdx];
  const cardEl = document.getElementById('v17SingleWeekCard');
  const noteEl = document.getElementById('v17WeekCrossNote');
  const calEl = document.getElementById('v17WeekCalRow');
  const lbl = document.getElementById('v17WeekNavLabel');
  if(!w){
    if(cardEl) cardEl.innerHTML = '<div class="card" style="text-align:center;color:var(--gray-400);padding:30px;">데이터 없음</div>';
    if(noteEl) noteEl.innerHTML = '';
    if(calEl) calEl.innerHTML = '';
    if(lbl) lbl.textContent = '-';
    return;
  }
  const start = w.wk[0], end = w.wk[6];
  const startLb = `${start.m}/${start.d}`;
  const endLb = start.m===end.m ? `${end.d}` : `${end.m}/${end.d}`;
  if(lbl) lbl.textContent = `${ctx.TARGET_MONTH}월 ${w.wi+1}주차 (${startLb}~${endLb})`;
  if(cardEl) cardEl.innerHTML = _v17AllWeekHtml[_v17CurrentWeekIdx] || '';
  // 끼임 박스 카드 밖 → 달력 위로 이동
  const innerCross = cardEl ? cardEl.querySelector('.cross-note') : null;
  if(innerCross && noteEl){
    noteEl.innerHTML = innerCross.outerHTML;
    noteEl.style.marginTop = '10px';
    innerCross.remove();
  } else if(noteEl){
    noteEl.innerHTML = '';
    noteEl.style.marginTop = '';
  }
  // 한 줄 달력 (7개 셀)
  if(calEl){
    let calHtml = '';
    const wkNames = ['월','화','수','목','금','토','일'];
    w.wk.forEach((day, di)=>{
      const key = `${day.m}-${String(day.d).padStart(2,'0')}`;
      const data = ctx.DAYS[key];
      const dt = new Date(ctx.YEAR, day.m-1, day.d);
      const dow = dt.getDay();
      const wkCls = dow===0?'sun':(dow===6?'sat':'');
      const isToday = (day.m===ctx.TARGET_MONTH && day.d===ctx.TODAY);
      const isFuture = (day.m===ctx.TARGET_MONTH && day.d>ctx.TODAY && ctx.IS_CURRENT) || day.m>ctx.TARGET_MONTH;
      const isOutside = (day.m !== ctx.TARGET_MONTH);
      let cls = wkCls;
      if(isToday) cls += ' today';
      if(isFuture) cls += ' future';
      if(isOutside) cls += ' outside';
      if(data && data.holiday) cls += ' closed';
      let inner = `<div class="wc-wk">${wkNames[di]}</div><div class="wc-day">${day.d}</div>`;
      if(isFuture){
        // 빈
      } else if(data && data.holiday){
        inner += `<div style="font-size:13px;text-align:center;line-height:1;">🏖</div>`;
        const fxdLoss = -(data.fixed||0);
        if(fxdLoss) inner += `<div class="wc-profit neg">${v17FmtCompact(fxdLoss)}</div>`;
      } else if(data){
        inner += `<div class="wc-sale">${v17FmtCompact(data.sale)}</div>`;
        inner += `<div class="wc-profit ${data.profit>=0?'pos':'neg'}">${data.profit>=0?'+':''}${v17FmtCompact(data.profit)}</div>`;
      }
      calHtml += `<div class="wc-cell ${cls}" ${data&&!data.holiday&&!isFuture?`data-day="${day.d}" data-month="${day.m}"`:''}>${inner}</div>`;
    });
    calEl.innerHTML = calHtml;
    calEl.querySelectorAll('.wc-cell[data-day]').forEach(cell=>{
      cell.addEventListener('click',()=>{
        if(parseInt(cell.dataset.month) === ctx.TARGET_MONTH){
          v17OpenDailySheet(parseInt(cell.dataset.day));
        }
      });
    });
  }
}

function v17MoveWeek(dir){
  const next = _v17CurrentWeekIdx + dir;
  if(next<0 || next>=_v17AllWeekData.length) return;
  if(!_v17AllWeekData[next].hasData){
    let i = next;
    while(i>=0 && i<_v17AllWeekData.length && !_v17AllWeekData[i].hasData) i += dir;
    if(i<0 || i>=_v17AllWeekData.length) return;
    _v17CurrentWeekIdx = i;
  } else {
    _v17CurrentWeekIdx = next;
  }
  v17RenderWeekViewSingle();
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

function v17OpenWeekModal(){
  const m = document.getElementById('v17WeekModal');
  if(m){ m.classList.add('open'); m.style.display='flex'; }
}
function v17CloseWeekModal(){
  const m = document.getElementById('v17WeekModal');
  if(m){ m.classList.remove('open'); m.style.display='none'; }
}

// ─── v17 진입 (loadDashboard에서 호출) ───
function v17RenderAll(){
  if(!_v17Ctx) return;
  v17RenderMonthCard();
  v17RenderCalendar();
  v17RenderWeekCards(); // _v17AllWeekData/_v17AllWeekHtml 캐시
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
    if(document.getElementById('salesCalendarSheet').style.display!=='none')await renderSalesCalendar();
    await loadDashboard(true);
  }catch(e){
    console.error('휴무 저장:',e);
    toast('저장 실패: '+e.message,'error');
  }finally{
    setLoad(false);
  }
}

// ─── 달력 버튼: 홈 v17 캘린더로 스크롤 (2026-06-03 사장님 지시 — 중복 달력 제거) ─── //
let _salesCalendarMonth=null;
async function openSalesCalendarSheet(){
  // salesCalendarSheet 대신 홈에 있는 v17CalGrid로 스크롤
  const calEl = document.getElementById('v17CalGrid');
  if(calEl) calEl.scrollIntoView({behavior:'smooth', block:'start'});
}
function moveSalesCalendarMonth(dir){
  if(!_salesCalendarMonth)return;
  const d=new Date(_salesCalendarMonth+'-01');d.setMonth(d.getMonth()+dir);
  _salesCalendarMonth=d.toISOString().slice(0,7);
  renderSalesCalendar();
}
async function renderSalesCalendar(){
  const ym=_salesCalendarMonth;
  document.getElementById('salesCalendarMonthLabel').innerText=ym;
  document.getElementById('salesCalendarGrid').innerHTML='<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--gray-500);">불러오는 중...</div>';
  document.getElementById('salesCalendarSummary').innerText='-';
  const[y,mo]=ym.split('-').map(Number);
  const lastDay=new Date(y,mo,0).getDate();
  const start=ym+'-01',end=ym+'-'+String(lastDay).padStart(2,'0');
  const sid=currentStore.id;
  try{
    const[salesRes,voRes,rcRes,attRes]=await Promise.all([
      sb.from('sales_daily').select('*').eq('store_id',sid).gte('date',start).lte('date',end),
      sb.from('vendor_orders').select('amount,order_date').eq('store_id',sid).gte('order_date',start).lte('order_date',end),
      sb.from('receipts').select('total_price,receipt_date').eq('store_id',sid).eq('note','정상').gte('receipt_date',start).lte('receipt_date',end),
      sb.from('attendance_logs').select('work_date,calculated_wage,employee_id').eq('store_id',sid).gte('work_date',start).lte('work_date',end)
    ]);
    // 일별 매출 + source 메타 (휴무 표시용)
    const dailySales={};
    const dailySource={};
    (salesRes.data||[]).forEach(s=>{const d=s.date?.slice(8);if(d){dailySales[d]=salesRowTotal(s);dailySource[d]=s.source||'';}});
    // 일별 지출 (변동 비용만 — 고정비/로열티 일할 생략. 캘린더는 시각적 추세 비교 본질)
    const dailyExp={};
    (voRes.data||[]).forEach(v=>{const d=v.order_date?.slice(8);if(!d)return;dailyExp[d]=(dailyExp[d]||0)+(v.amount||0);});
    (rcRes.data||[]).forEach(r=>{const d=r.receipt_date?.slice(8);if(!d)return;dailyExp[d]=(dailyExp[d]||0)+(r.total_price||0);});
    const monthlyEmpIds=new Set((employees||[]).filter(e=>e.wage_type==='monthly').map(e=>e.id));
    (attRes.data||[]).forEach(a=>{if(monthlyEmpIds.has(a.employee_id))return;const d=a.work_date?.slice(8);if(!d)return;dailyExp[d]=(dailyExp[d]||0)+(a.calculated_wage||0);});

    // 그리드 그리기
    const firstDayOfWeek=new Date(y,mo-1,1).getDay();
    const todayDate=new Date();
    const todayYm=todayDate.toISOString().slice(0,7);
    const todayDay=todayYm===ym?todayDate.getDate():-1;

    let html='';
    ['일','월','화','수','목','금','토'].forEach((wk,i)=>{
      const cls=i===0?'sun':(i===6?'sat':'');
      html+=`<div class="sales-cal-wkh ${cls}">${wk}</div>`;
    });
    for(let i=0;i<firstDayOfWeek;i++)html+=`<div class="sales-cal-cell empty"></div>`;
    let totalSale=0,totalProfit=0,saleDays=0;
    const compactWon=v=>{const a=Math.abs(v);if(a>=10000)return(v<0?'-':'')+Math.round(a/10000)+'만';return fmt(v);};
    for(let d=1;d<=lastDay;d++){
      const dd=String(d).padStart(2,'0');
      const sale=dailySales[dd]||0;
      const exp=dailyExp[dd]||0;
      const profit=sale-exp;
      const isToday=d===todayDay;
      const isFuture=todayDay>0&&d>todayDay;
      const dayOfWeek=(firstDayOfWeek+d-1)%7;
      const wkCls=dayOfWeek===0?'sun':(dayOfWeek===6?'sat':'');
      const isClosed=(dailySource[dd]==='closed');
      if(isFuture){
        html+=`<div class="sales-cal-cell future ${wkCls}"><span class="sc-day">${d}</span></div>`;
      }else if(isClosed){
        html+=`<div class="sales-cal-cell closed ${isToday?'today':''} ${wkCls}" data-day="${dd}">
          <span class="sc-day">${d}</span>
          <span style="font-size:14px;text-align:center;">🏖</span>
          <span style="font-size:9px;text-align:center;color:#92400E;font-weight:800;">휴무</span>
        </div>`;
      }else if(sale){
        html+=`<div class="sales-cal-cell ${isToday?'today':''} ${wkCls}" data-day="${dd}">
          <span class="sc-day">${d}</span>
          <span class="sc-sale">${compactWon(sale)}</span>
          <span class="sc-profit ${profit>=0?'pos':'neg'}">${profit>=0?'+':''}${compactWon(profit)}</span>
        </div>`;
        totalSale+=sale;totalProfit+=profit;saleDays++;
      }else{
        html+=`<div class="sales-cal-cell noSale ${isToday?'today':''} ${wkCls}" data-day="${dd}">
          <span class="sc-day">${d}</span>
          <span style="font-size:9px;color:var(--gray-400);margin-top:auto;text-align:center;">+</span>
        </div>`;
      }
    }
    document.getElementById('salesCalendarGrid').innerHTML=html;
    document.getElementById('salesCalendarSummary').innerHTML=
      `<div style="display:flex;justify-content:space-between;align-items:center;">
        <span>📊 매출 합계 <span style="color:var(--gray-400);font-size:11px;">(${saleDays}일)</span></span>
        <b style="color:var(--blue);">${fmt(totalSale)}원</b>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        <span>💵 순수익 합계</span>
        <b style="color:${totalProfit>=0?'#10B981':'#EF4444'};">${totalProfit>=0?'+':''}${fmt(totalProfit)}원</b>
      </div>`;
  }catch(e){
    console.error('캘린더 오류:',e);
    document.getElementById('salesCalendarGrid').innerHTML='<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--danger);">불러오기 실패</div>';
  }
}

