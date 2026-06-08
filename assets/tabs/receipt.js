// ══════════════════════════════════════════
// 영수증
// ══════════════════════════════════════════

// ─── 새 기능: 영수증 진입 분기 (거래처/직구) ───
// 거래처 모드: 사용자가 거래처 선택 → vendors.category_id 자동 박힘 → AI는 양식·카테고리 알고 시작 (글자 추출만)
// 직구 모드: 사용자 분기만, 카테고리는 AI가 품목별 분류 (현재 흐름)
let rcpMode = '';        // 'vendor' | 'direct' | 'manual' | ''
let rcpVendorId = null;  // 거래처 모드일 때 vendor id
let rcpVendorName = '';  // 거래처 표시명
let rcpCatId = null;     // 거래처 자동 박힌 category_id
let rcpCatName = '';     // 거래처 자동 박힌 category 텍스트
let rcpInputMethod = null; // 'photo' | 'manual' — 영수증 단위 입력 방식 (📸/✏️ 이모지 표시용)
let rcpEntryReturn = null; // 영수증 저장 후 자동 복귀할 화면 ('catReceipt:direct'|'catReceipt:etc'|'vendors:<id>')
let rcpPastItems = [];       // 현재 거래처 과거 품목명 — 품목명 칸 자동완성(원터치 수정)용. 프롬프트엔 안 넣음(환각 방지, 2026-06-05)
let rcpPastPriceMap = new Map(); // 단가 → Set<품목명> (단가 매칭 자동채움용, 2026-06-05)
let rcpPastSheetTargetIdx = null; // 과거 품목 시트 열 때 대상 행 인덱스

function setRcpMode(mode){
  if(!guardStore()) return;
  rcpMode = mode;
  rcpInputMethod = null;
  _clearRcpData(); // 새 진입 = 이전 분석(사진·결과·행) 비우기 (사장님 호소 2026-06-02)
  // 모드 바꿀 때 vendor 정보 초기화 (거래처는 행에서 다시 선택)
  rcpVendorId = null; rcpVendorName = ''; rcpCatId = null; rcpCatName = '';
  document.getElementById('rcpModeSelect').style.display = 'none';
  const modeTtl = document.getElementById('rcpModeTitle'); if(modeTtl) modeTtl.style.display = 'block';
  document.getElementById('rcpModeBadge').style.display = 'flex';
  renderRcpModeBadge();
  const vTtl = document.getElementById('rcpVendorRowTitle');
  const vRow = document.getElementById('rcpVendorRow');
  if(mode === 'vendor'){
    // 거래처 행 표시(미선택). 사진은 거래처 고른 뒤 활성화
    if(vTtl) vTtl.style.display = 'block';
    if(vRow) vRow.style.display = 'flex';
    renderRcpVendorRow(false);
    document.getElementById('rcpGuideBox').style.display = 'none';
    _setRcpUploadEnabled(false);
  } else {
    // 직구: 거래처 행 없이 바로 사진
    if(vTtl) vTtl.style.display = 'none';
    if(vRow) vRow.style.display = 'none';
    document.getElementById('rcpGuideBox').style.display = 'block';
    _setRcpUploadEnabled(true);
    showRcpUploadUI();
  }
  const bt = document.getElementById('rcpBackTitle'); if(bt) bt.textContent = '종류 선택';
}

// 상단 뒤로가기 — 모드 선택됐으면 종류 선택으로 복귀, 아니면 지출관리로
function rcpBack(){
  if(rcpMode){ resetRcpMode(); }
  else { nav('expHub'); }
}

// 거래처 선택 행 채우기 (미선택=파란 안내 / 선택=거래처명+자동분류)
function renderRcpVendorRow(selected){
  const icon = document.getElementById('rcpVendorRowIcon');
  const val = document.getElementById('rcpVendorRowVal');
  const sub = document.getElementById('rcpVendorRowSub');
  const arrow = document.getElementById('rcpVendorRowArrow');
  if(!val) return;
  if(selected && rcpVendorName){
    if(icon) icon.textContent = '🏪';
    val.textContent = rcpVendorName;
    val.style.color = 'var(--toss-text-1)';
    if(sub){ sub.textContent = (rcpCatName || '미지정') + ' · 자동 분류'; sub.style.display = 'block'; }
    if(arrow) arrow.textContent = '바꾸기 ›';
  } else {
    if(icon) icon.textContent = '🏠';
    val.textContent = '거래처를 선택하세요';
    val.style.color = 'var(--toss-blue)';
    if(sub) sub.style.display = 'none';
    if(arrow) arrow.textContent = '›';
  }
}

// 사진 영역 활성/비활성 (거래처 미선택 시 흐리게 + 클릭 막음)
function _setRcpUploadEnabled(on){
  const ttl = document.getElementById('rcpUploadTitle');
  const grp = document.getElementById('uploadGroup');
  if(ttl){ ttl.style.display = 'block'; ttl.style.opacity = on ? '1' : '0.45'; }
  if(grp){ grp.style.display = 'block'; grp.style.opacity = on ? '1' : '0.45'; grp.style.pointerEvents = on ? 'auto' : 'none'; }
}

// 영수증 데이터(분석 결과·사진·행)만 초기화 — 모드는 유지. 새 진입 시 이전 분석 잔류 방지 (사장님 호소 2026-06-02)
function _clearRcpData(){
  b64Pages = [];
  if(typeof _renderRcpPages === 'function') _renderRcpPages();
  rowCount = 0;
  const rt = document.getElementById('resTable'); if(rt) rt.innerHTML = '';
  const ra = document.getElementById('resultArea'); if(ra) ra.style.display = 'none';
  const ag = document.getElementById('actionGroup'); if(ag) ag.style.display = 'none';
  const ip = document.getElementById('imgPreview'); if(ip){ ip.style.display = 'none'; ip.src = ''; }
  const hint = document.getElementById('rcpImgHint'); if(hint) hint.style.display = 'none';
  const pb = document.getElementById('rcpPageInfoBox'); if(pb) pb.style.display = 'none';
  const sc = document.getElementById('rcpSumCheck'); if(sc){ sc.innerHTML = ''; sc.className = 'rcp-sumbar'; }
}

function resetRcpMode(){
  rcpMode = '';
  rcpVendorId = null; rcpVendorName = ''; rcpCatId = null; rcpCatName = '';
  rcpInputMethod = null;
  document.getElementById('rcpModeSelect').style.display = 'block';
  const modeTtl = document.getElementById('rcpModeTitle'); if(modeTtl) modeTtl.style.display = 'none';
  document.getElementById('rcpModeBadge').style.display = 'none';
  const vTtl = document.getElementById('rcpVendorRowTitle'); if(vTtl) vTtl.style.display = 'none';
  const vRow = document.getElementById('rcpVendorRow'); if(vRow) vRow.style.display = 'none';
  const uTtl = document.getElementById('rcpUploadTitle'); if(uTtl) uTtl.style.display = 'none';
  document.getElementById('rcpGuideBox').style.display = 'none';
  document.getElementById('uploadGroup').style.display = 'none';
  document.getElementById('actionGroup').style.display = 'none';
  document.getElementById('resultArea').style.display = 'none';
  const ip = document.getElementById('imgPreview');
  ip.style.display = 'none'; ip.src = '';
  b64Pages = [];
  _renderRcpPages();
  const pageBox = document.getElementById('rcpPageInfoBox');
  if(pageBox) pageBox.style.display='none';
  const bt = document.getElementById('rcpBackTitle'); if(bt) bt.textContent = '지출관리';
}

function showRcpUploadUI(){
  document.getElementById('rcpModeSelect').style.display = 'none';
  document.getElementById('rcpModeBadge').style.display = 'flex';
  document.getElementById('rcpGuideBox').style.display = 'block';
  const uTtl = document.getElementById('rcpUploadTitle'); if(uTtl) uTtl.style.display = 'block';
  // ⚠️ uploadGroup 은 block (안에 .action-group flex + 수동 입력 button 2단 레이아웃). flex 박으면 깨짐
  document.getElementById('uploadGroup').style.display = 'block';
}

function renderRcpModeBadge(){
  const icon = document.getElementById('rcpModeBadgeIcon');
  const label = document.getElementById('rcpModeBadgeLabel');
  const value = document.getElementById('rcpModeBadgeValue');
  const guide = document.getElementById('rcpGuideBox');
  if(!icon || !label || !value) return;
  // 배지는 항상 '종류명'(큰글자) + 부제(작은글자). 거래처명은 거래처 행에 표시 (위계 통일)
  if(rcpMode === 'vendor'){
    icon.textContent = '📦';
    value.textContent = '거래처 영수증';
    label.textContent = '정기 거래 · 외상';
    if(guide) guide.innerHTML = rcpCatName
      ? `🎯 카테고리는 <b>${esc(rcpCatName)}</b>로 자동 분류돼요.`
      : `🏠 거래처를 먼저 골라주세요.`;
  } else if(rcpMode === 'direct'){
    icon.textContent = '🛒';
    value.textContent = '직구 영수증';
    label.textContent = '마트 · 일반 · 배민 등';
    if(guide) guide.innerHTML = `🤖 AI가 품목별로 분류해드려요. 한 영수증에 식자재·비품이 섞여도 따로 잡아드려요.`;
  } else if(rcpMode === 'manual'){
    icon.textContent = '✏️';
    value.textContent = '수동 입력';
    label.textContent = '사진 없이 직접';
    if(guide) guide.innerHTML = `💡 거래처·품목·금액·분류 모두 직접 입력해주세요. 다음에 같은 거 또 사면 학습돼서 빨라져요.`;
  }
}

// ─── 새 기능: 수동 입력 (사진 없이 빈 행 1개로 시작) ───
function manualReceipt(){
  if(!rcpMode) return toast('먼저 거래처 또는 직구를 골라주세요','warn');
  rcpInputMethod = 'manual';
  document.getElementById('uploadGroup').style.display='none';
  document.getElementById('actionGroup').style.display='none';
  const ip = document.getElementById('imgPreview'); ip.style.display='none'; ip.src='';
  b64Pages = [];
  _renderRcpPages();
  document.getElementById('resultArea').style.display='block';
  // 거래처 모드면 행에 거래처명·카테고리 미리 박아 보여주기 (저장 시 자동 박힘 외에 UX 친절)
  const initVendor = rcpMode === 'vendor' ? (rcpVendorName || '') : '';
  const initCategory = rcpMode === 'vendor' ? (rcpCatName || '') : '';
  rowCount = 0;
  document.getElementById('resTable').innerHTML = buildReceiptRow({
    date: ymdLocal(new Date()),
    vendor: initVendor,
    category: initCategory
  });
}

// XSS 방지 헬퍼 (가이드 박스용)
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ─── 새 기능: 카테고리별 영수증 목록 (직구·식자재·비품·기타 진입 공통) ───
let catReceiptMode = null;   // 'direct' | 'food' | 'supplies' | 'etc'
let catReceiptMonth = (new Date()).toISOString().slice(0,7);
let catReceiptFilter = 'all'; // 'all' | 'direct' | 'vendor:<id>'
let catReceiptRowsCache = []; // 거래처별 합계 계산용

// 헬퍼: 카테고리 id 풀 (parent + 자식)
function _collectCatIdsByName(name){
  const parents = (expCategories||[]).filter(c=>c.name===name && !c.parent_id);
  const ids = [];
  parents.forEach(p=>{
    ids.push(p.id);
    (expCategories||[]).filter(c=>c.parent_id===p.id).forEach(ch=>ids.push(ch.id));
  });
  return ids;
}

function openCatReceipt(mode){
  if(!guardStore()) return;
  catReceiptMode = mode;
  catReceiptFilter = 'all';
  nav('catReceipt');
  const mEl = document.getElementById('catReceiptMonth');
  if(mEl && !mEl.value) mEl.value = catReceiptMonth;
  // 직구 모드일 때만 영수증 등록 버튼 표시 (카테고리 모드는 조회 전용)
  const addBtns = document.getElementById('catRcpAddBtns');
  if(addBtns) addBtns.style.display = (mode === 'direct') ? 'flex' : 'none';
}

// ══════════════════════════════════════════
// manual 카테고리 진입 화면 (세금·마케팅·기타) — 2026-05-20 신설
// data_source='manual' 카테고리 카드 클릭 → 진입
// mydata_transactions 자동 분류 거래내역 + sub_category 누적 합계
// ══════════════════════════════════════════
let currentManualCatName = null;
const MANUAL_CAT_META = {
  '세금':   {emoji:'⚖️', desc:'통장·카드 자동 분류 세금·4대보험 거래내역'},
  '마케팅': {emoji:'📢', desc:'광고·행사·홍보 비용 거래내역'},
  '기타':   {emoji:'📂', desc:'분류되지 않은 기타 지출 거래내역'},
};
function openManualCatView(catName){
  if(!guardStore()) return;
  currentManualCatName = catName || '세금';
  nav('manualCat');
}
async function loadManualCatView(){
  if(!currentStore) return;
  const cat = currentManualCatName || '세금';
  const meta = MANUAL_CAT_META[cat] || {emoji:'📂', desc:`${cat} 거래내역`};
  document.getElementById('manualCatHeaderTitle').textContent = `${meta.emoji} ${cat}`;
  document.getElementById('manualCatHeaderDesc').textContent = meta.desc;
  // mydata 조회 (해당 카테고리)
  const {data:txs, error} = await sb.from('mydata_transactions')
    .select('id, tx_date, description, merchant_name, amount, sub_category, exclude_from_settlement')
    .eq('store_id', currentStore.id)
    .eq('category', cat)
    .order('tx_date', {ascending:false});
  if(error){ console.error('[loadManualCatView]', error); errToast(cat+' 조회', error); return; }
  // 정산제외 건 분리 (환급금 등은 합계에서 제외)
  const validTxs = (txs||[]).filter(t=>!t.exclude_from_settlement);
  renderManualCatSubSummary(validTxs, cat);
  renderManualCatTxList(validTxs, cat);
}
function renderManualCatSubSummary(txs, cat){
  const container = document.getElementById('manualCatSubSummary');
  if(!container) return;
  if(!txs.length){ container.innerHTML = ''; return; }
  // 올해 누적: sub_category별 합계
  const thisYear = new Date().getFullYear();
  const subSums = {};
  let totalYear = 0;
  txs.forEach(t=>{
    const year = parseInt((t.tx_date||'').slice(0,4),10);
    if(year!==thisYear) return;
    const sub = (t.sub_category||'').trim() || '(분류없음)';
    const amt = Math.abs(t.amount||0);
    subSums[sub] = (subSums[sub]||0) + amt;
    totalYear += amt;
  });
  const subEntries = Object.entries(subSums).sort((a,b)=>b[1]-a[1]);
  if(subEntries.length===0){
    container.innerHTML = `
      <div class="card" style="padding:14px;background:var(--gray-50);">
        <div style="font-size:12px;color:var(--gray-600);">${thisYear}년 ${cat} 거래내역 없음</div>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="card" style="padding:14px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);">
      <div style="font-size:11px;color:var(--gray-600);margin-bottom:4px;">${thisYear}년 누적</div>
      <div style="font-size:22px;font-weight:700;color:var(--gray-900);margin-bottom:12px;font-variant-numeric:tabular-nums;">${fmt(totalYear)}원</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${subEntries.map(([sub,amt])=>`
          <span style="background:rgba(255,255,255,0.75);padding:6px 10px;border-radius:8px;font-size:11px;font-weight:600;color:var(--gray-700);">
            ${esc(sub)} <b style="color:var(--blue);font-variant-numeric:tabular-nums;">${fmt(amt)}</b>
          </span>
        `).join('')}
      </div>
    </div>`;
}
function renderManualCatTxList(txs, cat){
  const container = document.getElementById('manualCatTxList');
  if(!container) return;
  // 빈 상태 — 가이드 + 업로드 버튼
  if(!txs.length){
    container.innerHTML = `
      <div class="empty-state" style="padding:30px 14px;text-align:center;background:var(--gray-50);border-radius:14px;">
        <div style="font-size:48px;margin-bottom:8px;">📋</div>
        <p style="font-size:14px;color:var(--gray-800);font-weight:600;margin-bottom:8px;">아직 ${cat} 거래내역이 없습니다</p>
        <p style="font-size:12px;color:var(--gray-600);line-height:1.7;">통장·카드 엑셀을 업로드하면<br>학습 규칙으로 자동 분류돼서<br>여기에 거래내역이 쌓입니다.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:16px;padding:8px 16px;" data-action="nav|explist">엑셀 업로드 화면으로 ›</button>
      </div>`;
    return;
  }
  // 이번달 우선 표시 + 없으면 전체 최근 50건
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthTxs = txs.filter(t=>(t.tx_date||'').slice(0,7)===thisMonth);
  const showTxs = monthTxs.length ? monthTxs : txs.slice(0, 50);
  const headerLabel = monthTxs.length
    ? `이번달 ${monthTxs.length}건`
    : `이번달 없음 · 최근 ${showTxs.length}건 표시`;
  let html = `<div style="font-size:12px;color:var(--gray-700);font-weight:600;margin:6px 0 8px;padding:0 4px;">${headerLabel}</div>`;
  html += '<div style="border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">';
  html += '<colgroup><col style="width:44px;"><col><col style="width:80px;"><col style="width:80px;"></colgroup>';
  html += '<thead><tr style="background:var(--gray-100);">';
  html += '<th style="text-align:center;padding:8px 4px;font-size:11px;color:var(--gray-700);">날짜</th>';
  html += '<th style="text-align:center;padding:8px 4px;font-size:11px;color:var(--gray-700);">내용</th>';
  html += '<th style="text-align:center;padding:8px 4px;font-size:11px;color:var(--gray-700);">분류</th>';
  html += '<th style="text-align:center;padding:8px 4px;font-size:11px;color:var(--gray-700);">금액</th>';
  html += '</tr></thead><tbody>';
  showTxs.forEach(t=>{
    const date = (t.tx_date||'').slice(5).replace('-','/');
    const desc = esc(t.description || t.merchant_name || '-');
    const sub = esc((t.sub_category||'').trim() || '(분류없음)');
    const amt = Math.abs(t.amount||0);
    html += `<tr style="border-top:1px solid var(--gray-100);">
      <td style="text-align:center;padding:10px 4px;color:var(--gray-700);font-size:11px;">${date}</td>
      <td style="text-align:left;padding:10px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${desc}">${desc}</td>
      <td style="text-align:center;padding:10px 4px;color:var(--gray-600);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sub}</td>
      <td style="text-align:right;padding:10px 6px;font-variant-numeric:tabular-nums;font-weight:700;font-size:12px;">${fmt(amt)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function onCatReceiptMonthChange(el){
  catReceiptMonth = el.value || catReceiptMonth;
  loadCatReceiptData();
}

async function loadCatReceiptData(){
  if(!currentStore || !catReceiptMode) return;
  const body = document.getElementById('catReceiptBody');
  const totalEl = document.getElementById('catReceiptTotal');
  const titleEl = document.getElementById('catReceiptTitle');
  const iconEl = document.getElementById('catReceiptIcon');
  // 헤더 (모드 = 'direct' 또는 'cat:<id>')
  let title = '', iconEmoji = '🛒';
  let catParent = null;
  if(catReceiptMode === 'direct'){
    title = '직구'; iconEmoji = '🛒';
  } else if(catReceiptMode.startsWith('cat:')){
    const cid = catReceiptMode.split(':')[1];
    catParent = (expCategories||[]).find(c=>c.id===cid);
    title = catParent?.name || '카테고리';
    // 카테고리 이름별 이모지 매핑 (없으면 폴더)
    const iconEmojiMap = {'식자재':'🥬','비품':'📦','기타':'📂','주류':'🍶','음료':'🥤','마케팅':'📢','세금':'💰','인건비':'⏰','고정비':'📅','공과금/고정비':'📅'};
    iconEmoji = iconEmojiMap[title] || '📂';
  }
  titleEl.textContent = title;
  iconEl.textContent = iconEmoji;
  body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">불러오는 중...</div>';
  const [y,m] = catReceiptMonth.split('-').map(Number);
  const lastDay = new Date(y,m,0).getDate();
  const start = catReceiptMonth+'-01', end = catReceiptMonth+'-'+String(lastDay).padStart(2,'0');
  // 2026-05-21: receipts + vendor_orders 통합 조회 (사장님 호소: "거래처주문수동입력이 그리드 표에 없음")
  //  · 직구 모드 = receipts only (vendor_orders는 항상 vendor_id 있음 — 매칭 X)
  //  · 카테고리 모드 = receipts(category_id IN ids) + vendor_orders(vendors.category_id IN ids)
  let rq = sb.from('receipts')
    .select('id,receipt_date,vendor,vendor_id,item,total_price,category,category_id,input_method,note,receipt_group_id,unit_price,qty')
    .eq('store_id', currentStore.id)
    .gte('receipt_date', start).lte('receipt_date', end)
    .order('receipt_date', {ascending:false});
  let oq = null;
  let catIdSet = null; // 카테고리 모드일 때 vendor_orders 메모리 필터용 (식자재 + 자식 ids)
  if(catReceiptMode === 'direct'){
    rq = rq.is('vendor_id', null);
    // vendor_orders 조회 안 함
  } else if(catReceiptMode.startsWith('cat:')){
    if(!catParent){
      body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray-500);font-size:13px;">카테고리를 찾을 수 없어요</div>';
      totalEl.textContent = '이번달 0원 · 0건';
      return;
    }
    const childIds = (expCategories||[]).filter(c=>c.parent_id===catParent.id).map(c=>c.id);
    const ids = [catParent.id, ...childIds];
    catIdSet = new Set(ids);
    rq = rq.in('category_id', ids);
    // vendor_orders: 전체 받고 메모리에서 vendors.category_id 필터
    // (calcExpenseByCategories와 동일 패턴 — PostgREST embedded filter 회피)
    oq = sb.from('vendor_orders')
      .select('id,order_date,vendor_id,item,amount,unit_price,quantity,memo,order_group_id,vendors(name,category_id)')
      .eq('store_id', currentStore.id)
      .gte('order_date', start).lte('order_date', end)
      .order('order_date', {ascending:false});
  }
  // 2026-05-25 신설: mydata_transactions 통합 조회 (사장님 호소 "전 카테고리 통일" → 통장·카드 자동 분류도 같은 화면에)
  //  · 카테고리 모드만 (직구 모드는 vendor_id NULL 영수증만이므로 mydata 안 끼움)
  //  · category_id IN ids (대분류 + 자식들)
  //  · exclude_from_settlement=true는 환급금 등이므로 제외 (manualCat 패턴 일관)
  let mq = null;
  if(catIdSet){
    mq = sb.from('mydata_transactions')
      .select('id,tx_date,tx_type,description,merchant_name,amount,category_id,sub_category')
      .eq('store_id', currentStore.id)
      .eq('exclude_from_settlement', false)
      .in('category_id', Array.from(catIdSet))
      .gte('tx_date', start).lte('tx_date', end)
      .order('tx_date', {ascending:false});
  }
  const [rRes, oRes, mRes] = await Promise.all([
    rq,
    oq || Promise.resolve({data:[], error:null}),
    mq || Promise.resolve({data:[], error:null})
  ]);
  if(rRes.error){
    body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--danger);font-size:13px;">불러오기 실패: ${esc(rRes.error.message||'')}</div>`;
    return;
  }
  if(oRes.error){ console.error('vendor_orders 조회 실패', oRes.error); }
  if(mRes.error){ console.error('mydata_transactions 조회 실패', mRes.error); }
  // rcpRecords 글로벌은 receipts 원본만 (openReceiptEdit / openReceiptGroupEdit 호환)
  rcpRecords = rRes.data || [];
  // 정규화 + vendor_orders는 vendors.category_id IN catIdSet 메모리 필터 (좀비 거래처 자동 제외)
  const normReceipts = (rRes.data||[]).map(r=>_normalizeExpenseRow(r,'receipt'));
  const normOrders = catIdSet
    ? (oRes.data||[]).filter(r=>r.vendors && catIdSet.has(r.vendors.category_id)).map(r=>_normalizeExpenseRow(r,'order'))
    : [];
  const normMydata = (mRes.data||[]).map(r=>_normalizeExpenseRow(r,'mydata'));
  catReceiptRowsCache = normReceipts.concat(normOrders).concat(normMydata);
  renderCatReceiptList(catReceiptRowsCache);
}

// 거래방법 필터 시트 — 모드별 분기 (2026-05-21 정규화 행 기반)
//   직구 모드 = 가게별 (vendor 텍스트 그룹) — receipts only
//   식자재/주류/비품/기타 모드 = 직접구입(=receipt vendor_id NULL) + 거래처별 (receipts + vendor_orders 합산)
function openCatReceiptFilterSheet(){
  const list = document.getElementById('catReceiptFilterList');
  const mkRow = (val, label, sub, checked) => `<button class="btn btn-secondary" style="width:100%;text-align:left;padding:12px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;background:${checked?'#EBF3FF':'#fff'};border:1px solid ${checked?'var(--blue)':'var(--gray-200)'};" data-action="pickCatReceiptFilter|${val}">
    <span style="font-size:14px;font-weight:${checked?'800':'600'};">${esc(label)}</span>
    <span style="font-size:11px;color:var(--gray-500);">${esc(sub)}</span>
  </button>`;
  let html = '';
  html += mkRow('all', '전체', `${(catReceiptRowsCache||[]).length}건`, catReceiptFilter==='all');
  if(catReceiptMode === 'direct'){
    // 직구 모드: receipt 행만, vendor 텍스트 그룹 (가게별)
    const shopAgg = {}; // {name: {total, count}}
    (catReceiptRowsCache||[]).forEach(r=>{
      if(r._source !== 'receipt') return;
      if(r.note && r.note!=='정상') return;
      const name = (r.vendor||'').trim() || '(이름 없음)';
      if(!shopAgg[name]) shopAgg[name] = {total:0, count:0};
      shopAgg[name].total += r.amount||0;
      shopAgg[name].count++;
    });
    const shopList = Object.entries(shopAgg).sort((a,b)=>b[1].total-a[1].total);
    if(shopList.length){
      html += '<div style="height:1px;background:var(--gray-200);margin:10px 0;"></div>';
      shopList.forEach(([name, v])=>{
        html += mkRow('shop:'+encodeURIComponent(name), `🛒 ${name}`, `${v.count}건 · ${fmt(v.total)}원`, catReceiptFilter===('shop:'+encodeURIComponent(name)));
      });
    }
  } else {
    // 카테고리 모드: 직접구입(receipt vendor_id NULL) + 거래처별 (receipts + vendor_orders 합산)
    const vendorAgg = {}; // {vendor_id: {name, total, count}}
    let directTotal = 0, directCount = 0;
    (catReceiptRowsCache||[]).forEach(r=>{
      if(r.note && r.note!=='정상') return;
      const amt = r.amount||0;
      if(r._source==='receipt' && !r.vendor_id){
        directTotal += amt; directCount++;
      } else if(r.vendor_id){
        if(!vendorAgg[r.vendor_id]) vendorAgg[r.vendor_id] = {name:r.vendor||'(이름 없음)', total:0, count:0};
        vendorAgg[r.vendor_id].total += amt;
        vendorAgg[r.vendor_id].count++;
      }
    });
    const vendorList = Object.entries(vendorAgg).sort((a,b)=>b[1].total-a[1].total);
    html += mkRow('direct', '🛒 직접구입', `${directCount}건 · ${fmt(directTotal)}원`, catReceiptFilter==='direct');
    if(vendorList.length){
      html += '<div style="height:1px;background:var(--gray-200);margin:10px 0;"></div>';
      vendorList.forEach(([vid, v])=>{
        html += mkRow('vendor:'+vid, `🏪 ${v.name}`, `${v.count}건 · ${fmt(v.total)}원`, catReceiptFilter===('vendor:'+vid));
      });
    }
  }
  list.innerHTML = html;
  openSheet('catReceiptFilterSheet');
}

function pickCatReceiptFilter(val){
  catReceiptFilter = val;
  closeSheet('catReceiptFilterSheet');
  // 라벨 변경 (정규화 행 호환 — vendor 필드 직접 사용)
  let label = '전체';
  if(val === 'direct') label = '🛒 직접구입';
  else if(val.startsWith('vendor:')){
    const vid = val.split(':')[1];
    const r = (catReceiptRowsCache||[]).find(x=>x.vendor_id===vid);
    label = '🏪 ' + (r?.vendor || '거래처');
  } else if(val.startsWith('shop:')){
    label = '🛒 ' + decodeURIComponent(val.split(':')[1]);
  }
  document.getElementById('catReceiptFilterLabel').textContent = label;
  renderCatReceiptList(catReceiptRowsCache);
}

function renderCatReceiptList(rows){
  // 2026-05-21 갈아엎기: receipts only → receipts + vendor_orders 통합 (정규화 행 기반)
  //  · rows = _normalizeExpenseRow 정규화 행 배열 ({_source, id, date, vendor, vendor_id, item, unit, qty, amount, group_id, ...})
  //  · 거래방법 필터: 직접구입(direct) = receipt+vendor_id NULL / vendor:<id> = 같은 vendor_id 양쪽 합산
  //  · 그룹핑: 영수증과 거래처 주문은 다른 카드 (source 분리). 같은 거래처라도 채널 다르면 카드 분리
  //  · 행 클릭: receipt → openReceiptEdit, order → openEditOrderSheet
  //  · 그룹 헤더 [✏][🗑]: receipt 그룹만. order 그룹은 행 클릭으로 시트 진입(거기서 그룹 통째 편집 가능)
  // rcpRecords는 loadCatReceiptData에서 receipts 원본만 박았음 (openReceiptEdit 호환)
  const body = document.getElementById('catReceiptBody');
  const totalEl = document.getElementById('catReceiptTotal');
  // 거래방법 필터 적용
  const filtered = rows.filter(r=>{
    if(catReceiptFilter === 'all') return true;
    if(catReceiptFilter === 'direct') return r._source==='receipt' && !r.vendor_id;
    if(catReceiptFilter.startsWith('vendor:')) return r.vendor_id === catReceiptFilter.split(':')[1];
    if(catReceiptFilter.startsWith('shop:')){
      const name = decodeURIComponent(catReceiptFilter.split(':')[1]);
      return r._source==='receipt' && (((r.vendor||'').trim() || '(이름 없음)') === name);
    }
    return true;
  });
  if(!filtered.length){
    body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--gray-500);font-size:13px;line-height:1.6;">조건에 맞는 내역이 없어요.<br>필터를 [전체]로 바꿔보세요.</div>';
    totalEl.textContent = '이번달 0원 · 0건';
    return;
  }
  const groups = _groupExpenseRows(filtered);
  let total = 0;
  groups.forEach(g=>{ total += g.total; });
  totalEl.textContent = `이번달 ${fmt(total)}원 · ${filtered.length}건`;
  // 날짜 그룹핑
  const byDate = {};
  groups.forEach(g=>{
    const d = g.date || '-';
    if(!byDate[d]) byDate[d] = [];
    byDate[d].push(g);
  });
  const dates = Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  let html = `<div class="grp-tbl-wrap"><table class="grp-tbl">
    <colgroup><col/><col style="width:64px"/><col style="width:44px"/><col style="width:76px"/><col style="width:22px"/></colgroup>
    <thead><tr><th>품목</th><th>단가</th><th>수량</th><th>금액</th><th></th></tr></thead>
    <tbody>`;
  let firstDate = true;
  dates.forEach(d=>{
    html += `<tr class="grp-date${firstDate?' first':''}"><td colspan="5">📅 ${esc(d)}</td></tr>`;
    firstDate = false;
    let firstGroup = true;
    byDate[d].forEach(g=>{
      const isOrder = g.source === 'order';
      const isMydata = g.source === 'mydata';
      // 헤더 이모지: 통장 = 🏦 / 카드 = 💳 / 거래처 주문 = 🏪 / 영수증 = 📸·✏️
      let headerIcon;
      if(isMydata){
        const tx = g.rows[0]?.txType || 'bank';
        headerIcon = (tx==='card' ? '💳' : '🏦');
      } else if(isOrder){
        headerIcon = '🏪 🧾';
      } else {
        headerIcon = (g.inputMethod==='photo' ? '📸 🧾' : (g.inputMethod==='manual' ? '✏️ 🧾' : '🧾'));
      }
      const errBadge = g.hasErr?`<span style="font-size:10px;color:var(--gray-500);margin-left:4px;">· 일부 오답</span>`:'';
      // 헤더 액션: 영수증·주문·mydata 모두 [✏편집] (삭제는 편집 시트 안에서)
      //  · 영수증: openReceiptGroupEdit / deleteReceiptGroup
      //  · 거래처 주문: openEditOrderSheet / deleteOrderGroupFromCard
      //  · mydata(통장·카드): openTxEditSheet (행 1건 = 1그룹, 삭제는 시트 내부)
      let actionsHtml = '';
      let rowClickAttr = '';
      if(isMydata){
        const txId = g.rows[0]?.id || g.recId;
        const txType = g.rows[0]?.txType || 'bank';
        actionsHtml = `<div class="grp-hdr-actions">
            <button type="button" class="btn btn-secondary" data-action="openTxEditSheet|${txId}|${txType}">✏</button>
          </div>`;
      } else if(isOrder){
        const editId = g.rows[0]?.id || g.recId; // 시트는 어떤 행 id든 받으면 group_id로 그룹 전체 로드
        const delKey = g.groupId ? ('g:'+g.groupId) : ('s:'+g.recId);
        actionsHtml = `<div class="grp-hdr-actions">
            <button type="button" class="btn btn-secondary" data-action="openEditOrderSheet|${editId}">✏</button>
            <button type="button" class="btn btn-danger" data-action="deleteOrderGroupFromCard|${delKey}">🗑</button>
          </div>`;
      } else {
        const editKey = g.groupId?('grp:'+g.groupId):('rec:'+g.recId);
        actionsHtml = `<span style="font-size:18px;color:#C8CDD4;font-weight:700;flex-shrink:0;">›</span>`;
        rowClickAttr = `style="cursor:pointer;" data-action="openReceiptGroupEdit|${editKey}"`;
      }
      html += `<tr class="grp-hdr${firstGroup?' first':''}">
        <td colspan="5"><div class="grp-hdr-row" ${rowClickAttr}>
          <div class="grp-hdr-info">
            <span class="emoji">${headerIcon}</span>
            <span class="name">${esc(g.vendor||'(거래처 없음)')}</span>
            <span class="sum">· ${fmt(g.total)}원</span>
            ${errBadge}
          </div>${actionsHtml}
        </div></td>
      </tr>`;
      firstGroup = false;
      g.rows.forEach(r=>{
        const isErr = r.note!=='정상';
        const unitTxt = r.unit?fmt(r.unit):'-';
        const qtyTxt = (r.qty!=null && r.qty!=='') ? String(r.qty) : '-';
        const cls = ['grp-body'];
        if(isErr) cls.push('err');
        // 거래처 주문 행은 메모 있으면 💬 표시 (loadVendorOrders와 일관)
        const memoFlag = (r._source==='order' && r.memo) ? ' 💬' : '';
        const itemRaw = r.item || '(품목 없음)';
        const itemTxt = esc(itemRaw) + memoFlag;
        const itemTitle = (r._source==='order' && r.memo) ? esc(itemRaw + ' · 메모: ' + r.memo) : esc(itemRaw);
        // 행 클릭: source별 분기 (order / mydata / receipt)
        const clickAction = r._source === 'order'
          ? `openEditOrderSheet|${r.id}`
          : (r._source === 'mydata'
              ? `openTxEditSheet|${r.id}|${r.txType||'bank'}`
              : `openReceiptEdit|${r.id}`);
        html += `<tr class="${cls.join(' ')}" data-action="${clickAction}">`
          + `<td title="${itemTitle}">${itemTxt}</td>`
          + `<td class="gb-unit">${unitTxt}</td>`
          + `<td class="gb-qty">${qtyTxt}</td>`
          + `<td class="gb-amt">${fmt(r.amount||0)}</td>`
          + `<td class="gb-arrow">›</td>`
          + `</tr>`;
      });
    });
  });
  html += `</tbody></table></div>`;
  body.innerHTML = html;
}

// 거래처 영수증 등록 진입 (거래처 카드 미니 📸 / 거래처 상세 헤더 버튼 둘 다 처리)
async function openRcpReceiptFromVendor(vendorId, method){
  if(!guardStore()) return;
  // vendor-card 미니 진입 = vendorId 직접 전달 / 거래처 상세 헤더 = '' → currentVendorDetailId fallback
  const vid = (vendorId && vendorId !== '') ? vendorId : (typeof currentVendorDetailId !== 'undefined' ? currentVendorDetailId : null);
  if(!vid){ toast('거래처 정보를 찾을 수 없어요','error'); return; }
  const {data, error} = await sb.from('vendors').select('id,name,category,category_id').eq('id', vid).eq('store_id', currentStore.id).maybeSingle();
  if(error || !data){ toast('거래처 정보를 못 가져왔어요','error'); return; }
  // setRcpMode('vendor')는 picker를 자동으로 열어 우회 — 모드·카테고리 직접 박기
  rcpMode = 'vendor';
  rcpVendorId = data.id;
  rcpVendorName = data.name || '';
  rcpCatId = data.category_id || null;
  rcpCatName = data.category || '';
  rcpInputMethod = (method === 'manual') ? 'manual' : 'photo';
  rcpEntryReturn = 'vendors:' + vid; // 저장 후 거래처 상세로 복귀
  nav('receipt');
  setTimeout(()=>{
    _clearRcpData(); // 새 진입 = 이전 분석(사진·결과·행) 비우기 (사장님 호소 2026-06-02)
    renderRcpModeBadge();
    // 종류 선택 화면 숨기고 모드 배지 + '선택된 거래처 행'을 노출 (정상 경로와 동일 — 사장님 호소 2026-06-02)
    const ms = document.getElementById('rcpModeSelect'); if(ms) ms.style.display='none';
    const modeTtl = document.getElementById('rcpModeTitle'); if(modeTtl) modeTtl.style.display='block';
    const mb = document.getElementById('rcpModeBadge'); if(mb) mb.style.display='flex';
    const vTtl = document.getElementById('rcpVendorRowTitle'); if(vTtl) vTtl.style.display='block';
    const vRow = document.getElementById('rcpVendorRow'); if(vRow) vRow.style.display='flex';
    renderRcpVendorRow(true);   // 이미 고른 거래처를 행에 표시 (탭하면 바꾸기 가능)
    const bt = document.getElementById('rcpBackTitle'); if(bt) bt.textContent='종류 선택';
    if(rcpInputMethod === 'manual'){
      const gb = document.getElementById('rcpGuideBox'); if(gb) gb.style.display='block';
      const ug = document.getElementById('uploadGroup'); if(ug) ug.style.display='none';
      manualReceipt();
    } else {
      _setRcpUploadEnabled(true);
      showRcpUploadUI();
    }
  }, 60);
}

// 지출 허브 [✏️ 수동 입력] 큰 카드 → 영수증 탭 + 수동 모드 자동
function openManualReceiptShortcut(){
  if(!guardStore()) return;
  rcpEntryReturn = null; // 모드 선택 화면에서 시작이므로 자동 복귀 X
  nav('receipt');
  setTimeout(()=>setRcpMode('manual'), 60);
}

// 카테고리 화면에서 [📸 영수증 사진] 또는 [✏️ 수동 입력] 버튼 → 영수증 탭으로 이동
function openCatReceiptInput(method){
  // 모드 = 직구·기타 카드에서 진입 → 모두 직구 모드 (vendor_id NULL). 기타는 카테고리 선택 별도.
  // 기타 카드에서 진입한 경우 = 사장님이 카테고리 picker에서 "기타" 선택해야 [기타] 카드에 합산됨.
  // 진입 즉시 모드를 'direct'로 박고, 기타 카드면 안내.
  rcpEntryReturn = 'catReceipt:' + catReceiptMode; // 저장 후 복귀
  nav('receipt');
  setTimeout(()=>{
    setRcpMode('direct');
    if(method === 'manual'){
      // setRcpMode('direct')는 모드 선택 화면 → uploadGroup 노출. manualReceipt 호출하여 빈 행 진입.
      manualReceipt();
    }
    if(catReceiptMode === 'etc'){
      setTimeout(()=>toast('기타로 등록하려면 분류 선택에서 "기타"를 골라주세요','warn'), 300);
    }
  }, 60);
}

async function openRcpVendorPicker(){
  if(!currentStore) return;
  openSheet('rcpVendorPickSheet');
  const list = document.getElementById('rcpVendorPickList');
  list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">불러오는 중...</div>';
  const {data, error} = await sb.from('vendors')
    .select('id,name,category,category_id')
    .eq('store_id', currentStore.id)
    .eq('is_active', true)
    .order('name');
  if(error){
    list.innerHTML = '<div style="text-align:center;padding:24px;color:#EF4444;font-size:13px;">불러오기 실패</div>';
    return;
  }
  if(!data || !data.length){
    list.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--gray-500);font-size:13px;line-height:1.6;">등록된 거래처가 없어요.<br>사이드 메뉴 → 거래처 관리에서 먼저 등록해주세요.</div>';
    return;
  }
  const esc = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  list.innerHTML = data.map(v => `
    <button type="button" class="btn btn-secondary" style="text-align:left;padding:14px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;" data-action="pickRcpVendor|${v.id}">
      <span style="font-size:14px;font-weight:700;">${esc(v.name)}</span>
      <span style="font-size:11px;color:var(--gray-500);">${esc(v.category || '카테고리 미지정')}</span>
    </button>
  `).join('');
}

async function pickRcpVendor(vendorId){
  if(!currentStore) return;
  const {data, error} = await sb.from('vendors').select('id,name,category,category_id').eq('id', vendorId).eq('store_id', currentStore.id).maybeSingle();
  if(error || !data) return toast('거래처 정보를 못 가져왔어요', 'error');
  rcpVendorId = data.id;
  rcpVendorName = data.name || '';
  rcpCatId = data.category_id || null;
  rcpCatName = data.category || '';
  closeSheet('rcpVendorPickSheet');
  renderRcpModeBadge();
  renderRcpVendorRow(true);   // 거래처 행에 이름·자동분류 표시
  _setRcpUploadEnabled(true); // 사진 영역 활성
  showRcpUploadUI();
}

// 사진 1장 추가 — 멀티페이지 영수증 지원 (2026-05-19 (4))
// 해상도 2400 다운사이즈 (Gemini 768px tile 단위)
// 2026-06-08: 1280→2400 상향 — 한글 작은 글자 오인식(왕금녕→임금님, 올티슈→물티슈) 해결. 측정실 실측상 같은 영수증 비용 +1원 미만(품목 수가 비용 좌우, 화질 영향 미미). 한자 한계는 해상도 무관(#97/#136)이라 원터치 수정으로 별도 해결
// b64Pages 배열에 append (1장이든 5장이든 동일 흐름)
function handleImg(input) {
  if(!input.files[0]) return;
  rcpInputMethod = 'photo';
  const fr = new FileReader();
  fr.onload = e => {
    const img = new Image();
    img.onload = () => {
      const cvs = document.createElement('canvas');
      let w=img.width,h=img.height; if(w>2400){h*=2400/w;w=2400;} // 2400px 다운사이즈 (한글 작은 글자 정확도 ↑, 비용 영향 미미 — 2026-06-08 실측)
      cvs.width=w;cvs.height=h;cvs.getContext('2d').drawImage(img,0,0,w,h);
      const dataUrl = cvs.toDataURL('image/jpeg',0.85);
      const b64Part = dataUrl.split(',')[1];
      b64Pages.push(b64Part);
      _renderRcpPages();
      // 미리보기 = 항상 마지막 추가된 사진 (사장님이 방금 찍은 것 확인용)
      document.getElementById('imgPreview').src=dataUrl;
      document.getElementById('imgPreview').style.display='block';
      const hint = document.getElementById('rcpImgHint'); if(hint) hint.style.display='block';
      // 사진 추가 후 uploadGroup 숨김 — rcpPagesArea 안 "페이지 추가" 버튼으로 추가 가능
      document.getElementById('uploadGroup').style.display='none';
      document.getElementById('actionGroup').style.display='flex';
      _updateRcpActionLabel();
      // 같은 파일 다시 선택 가능 (input value 초기화)
      try{ input.value=''; }catch(e){}
    };
    img.src=e.target.result;
  };
  fr.readAsDataURL(input.files[0]);
}
// 썸네일 가로 스크롤 렌더 — 1/N, 2/N ... + ✕ 삭제 버튼
function _renderRcpPages(){
  const area = document.getElementById('rcpPagesArea');
  const list = document.getElementById('rcpPagesList');
  const badge = document.getElementById('rcpPagesCountBadge');
  if(!area || !list) return;
  area.style.display = b64Pages.length ? 'block' : 'none';
  if(badge) badge.textContent = b64Pages.length;
  list.innerHTML = b64Pages.map((b64Part,idx)=>`
    <div style="position:relative;flex-shrink:0;width:88px;">
      <img src="data:image/jpeg;base64,${b64Part}" style="width:88px;height:88px;object-fit:cover;border-radius:8px;border:1px solid var(--gray-300);display:block;">
      <div style="position:absolute;left:4px;top:4px;background:rgba(0,0,0,0.65);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">${idx+1}/${b64Pages.length}</div>
      <button type="button" style="position:absolute;right:-6px;top:-6px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:var(--danger);color:#fff;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;" data-action="removeRcpPage|${idx}" title="이 사진 삭제">×</button>
    </div>
  `).join('');
}
// 사진 1장 제거 (✕ 버튼)
function removeRcpPage(idx){
  if(idx<0 || idx>=b64Pages.length) return;
  b64Pages.splice(idx,1);
  _renderRcpPages();
  if(b64Pages.length){
    // 마지막 사진을 미리보기로 박음 (첫 번째도 OK, 마지막이 직관적)
    document.getElementById('imgPreview').src='data:image/jpeg;base64,'+b64Pages[b64Pages.length-1];
  } else {
    document.getElementById('imgPreview').style.display='none';
    document.getElementById('imgPreview').src='';
    document.getElementById('actionGroup').style.display='none';
  }
  _updateRcpActionLabel();
}
// AI 분석 버튼 라벨 (1장 = ✨ AI 분석 / N장 = ✨ AI 분석 (사진 N장 통합))
function _updateRcpActionLabel(){
  const lbl = document.getElementById('rcpAnalyzeLabel');
  if(!lbl) return;
  const n = b64Pages.length;
  lbl.textContent = n>1 ? `✨ AI 분석 (사진 ${n}장 통합)` : '✨ AI 분석';
}
// 사진 전체 다시 선택 (모든 페이지 초기화)
function rcpRePickImage(){
  b64Pages = [];
  _renderRcpPages();
  document.getElementById('imgPreview').style.display='none';
  document.getElementById('imgPreview').src='';
  const hint = document.getElementById('rcpImgHint'); if(hint) hint.style.display='none';
  document.getElementById('actionGroup').style.display='none';
  document.getElementById('uploadGroup').style.display='block';
  _updateRcpActionLabel();
}
// ─── 새 기능: 영수증 사진 전체화면 미리보기 ───
function openImgFullPreview(){
  const src = document.getElementById('imgPreview')?.src;
  if(!src || src.length < 10) return;
  const overlay = document.getElementById('imgFullOverlay');
  const fullImg = document.getElementById('imgFullSrc');
  if(!overlay || !fullImg) return;
  fullImg.src = src;
  overlay.style.display = 'flex';
}
function closeImgFullPreview(){
  const overlay = document.getElementById('imgFullOverlay');
  if(overlay) overlay.style.display = 'none';
}
async function getVendorHints() {
  if(!currentStore) return '';
  try {
    const {data}=await sb.from('receipts').select('vendor,category').eq('store_id',currentStore.id).not('vendor','is',null).not('category','is',null).order('created_at',{ascending:false}).limit(60);
    if(!data?.length) return '';
    const map={};
    data.forEach(r=>{if(!map[r.vendor])map[r.vendor]={};map[r.vendor][r.category]=(map[r.vendor][r.category]||0)+1;});
    const hints=Object.entries(map).map(([v,cats])=>{const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0][0];return `${v}→${top}`;}).join(', ');
    return hints?`\n\n[과거 거래처→카테고리 힌트]\n${hints}`:'';
  } catch{return '';}
}
// DB 카테고리 목록 → 프롬프트 리스트
function getCatListForPrompt(){
  const cats=(expCategories||[]).filter(c=>c.is_active!==false);
  if(!cats.length) return '식자재,비품,인건비,고정비,세금,마케팅,기타';
  // 소분류 있으면 "대분류>소분류" 형식, 없으면 대분류명만
  const parents=cats.filter(c=>!c.parent_id);
  return parents.map(p=>{
    const children=cats.filter(c=>c.parent_id===p.id);
    return children.length?children.map(ch=>`${p.name}>${ch.name}`).join(',')+`,${p.name}`:p.name;
  }).join(',');
}
// ─── 품목명 → 학습 키워드 추출 (첫 단어, 2자 이상) ───
// "양파 10kg 2봉" → "양파", "삼겹살2kg" → "삼겹살", "생수500ml 12입" → "생수"
// contains 매칭이 성립하려면 keyword가 짧고 핵심적이어야 함 (dev_lessons #49)
function normalizeItemKeyword(item){
  if(!item) return '';
  const trimmed=String(item).trim();
  // 한글/영문 연속 문자 첫 덩어리 추출 (숫자/단위/공백 앞에서 끊김)
  const m=trimmed.match(/^([가-힣a-zA-Z]{2,})/);
  if(m) return m[1];
  // 한글/영문으로 시작 안 하면 첫 공백 전까지, 최대 8자
  return trimmed.split(/\s+/)[0].slice(0,8);
}

// ─── 영수증 품목에 DB 규칙 덮어쓰기 (학습된 품목은 AI 결과 무시) ───
// 📊 합계 + 📄 페이지 감지 박스 (2026-05-19 (4) — Page(N/M) 인쇄 감지 + 페이지 누락 안내)
//   pageInfo: {current, total} (AI 응답에서 추출, 없으면 null)
//   photoCount: 사장님이 업로드한 사진 수 (b64Pages.length)
function _renderRcpSumCheck(receiptTotalSum, list, pageInfo, photoCount, supplySum, taxSum){
  const sumBox = document.getElementById('rcpSumCheck');
  const pageBox = document.getElementById('rcpPageInfoBox');
  const rowSum = (list||[]).reduce((a,r)=>a+(parseInt(r.totalPrice)||0),0);
  const cnt = (list||[]).length;
  const hasReceiptSum = receiptTotalSum!=null && receiptTotalSum>0;
  const pageTotal = (pageInfo && pageInfo.total) ? pageInfo.total : 1;
  const photos = photoCount || 0;
  const pagesMissing = pageInfo && pageInfo.total>1 && photos < pageTotal;
  // 1️⃣ 페이지 감지 박스 (멀티페이지 시만)
  if(pageBox){
    if(pagesMissing){
      const missing = pageTotal - photos;
      pageBox.innerHTML = `⚠️ <b>${pageTotal}페이지 영수증 감지 (${photos}/${pageTotal})</b><br>지금까지 품목 <b>${cnt}개</b>, ${fmt(rowSum)}원 분석${hasReceiptSum?` · 영수증 박스 ${fmt(receiptTotalSum)}원`:''}<br><b style="color:#92400E;">→ 남은 ${missing}장 사진 추가하면 완성됩니다</b>`;
      pageBox.style.display='block';
      pageBox.style.background='#FEF3C7';
      pageBox.style.borderColor='#F59E0B';
      pageBox.style.color='#92400E';
    } else if(pageInfo && pageInfo.total>1 && !pagesMissing){
      pageBox.innerHTML = `✅ <b>${pageTotal}/${pageTotal} 페이지 모두 분석 완료</b> · 품목 ${cnt}개 · ${fmt(rowSum)}원`;
      pageBox.style.display='block';
      pageBox.style.background='#ECFDF5';
      pageBox.style.borderColor='#10B981';
      pageBox.style.color='#065F46';
    } else {
      pageBox.style.display='none';
    }
  }
  // 2️⃣ 영수증 요약 카드 (가안 A — 합계 크게 + 공급가/부가세/합계 한 곳. 2026-06-04)
  if(!sumBox) return;
  const rowTax = (list||[]).reduce((a,r)=>a+(parseInt(r.taxAmount)||0),0); // 세액 합
  const rowSupply = rowSum - rowTax;                                       // 공급가(세전) 합
  let cls = 'rcp-sumcard', okLine = `${cnt}개 품목`;
  if(hasReceiptSum){
    const diff = Math.abs(receiptTotalSum - rowSum);
    const diffPct = receiptTotalSum>0 ? (diff/receiptTotalSum*100) : 0;
    const ok = diff <= 10 || diffPct < 0.5;
    if(pagesMissing){
      cls += ' warn';
      okLine = `⏳ ${pageTotal}페이지 중 ${photos}장 — 남은 페이지 추가 시 일치 예정`;
    } else if(ok){
      okLine = `✅ 영수증 원본과 일치 · ${cnt}개 품목${diff>0?` (${fmt(diff)}원 반올림)`:''}`;
    } else {
      cls += ' danger';
      okLine = `⚠️ 영수증 원본 ${fmt(receiptTotalSum)}원과 ${fmt(diff)}원 차이 (${diffPct.toFixed(1)}%) — 확인`;
    }
  }
  sumBox.className = cls;
  // 세액 있으면 공급가/부가세/합계 3줄, 없으면 합계 큰 숫자만
  const taxLines = rowTax>0
    ? `<hr class="rsc-br"><div class="rsc-ln"><span>공급가</span><b>${fmt(rowSupply)}</b></div>`
      + `<div class="rsc-ln"><span>부가세</span><b>${fmt(rowTax)}</b></div>`
      + `<div class="rsc-ln total"><span>합계</span><b>${fmt(rowSum)}</b></div>`
    : '';
  sumBox.innerHTML = `<div class="rsc-big">${fmt(rowSum)}원</div><div class="rsc-ok">${okLine}</div>${taxLines}`;
}
async function applyRulesToReceipt(list){
  if(!storeClassRules?.length) await loadClassificationRules();
  const rcpRules=(storeClassRules||[]).filter(r=>r.tx_type==='receipt'||r.tx_type==='both');
  if(!rcpRules.length) return list;
  list.forEach(item=>{
    const itemText=(item.item||'').toLowerCase();
    const vendorText=(item.vendor||'').toLowerCase();
    for(const r of rcpRules){
      const kw=r.keyword.toLowerCase();
      let matched=false;
      if(r.match_type==='exact') matched=(item.item===r.keyword||item.vendor===r.keyword);
      else if(r.match_type==='regex'){try{matched=new RegExp(r.keyword,'i').test(item.item+' '+item.vendor);}catch(e){}}
      else matched=itemText.includes(kw)||vendorText.includes(kw);
      if(matched){
        item.category=r.sub_category?`${r.category}>${r.sub_category}`:r.category;
        // 품목명 자동 덮어쓰기(display_item) 폐기 (2026-06-04) — 짧은 키워드 오염 방지. AI가 읽은 그대로 + 교정.
        item._ruleMatched=true;
        break;
      }
    }
  });
  return list;
}

async function runAI() {
  if(!b64Pages.length) return toast('이미지를 먼저 업로드해주세요.','warn');
  const pageCount = b64Pages.length;
  // 여러 장이면 AI 호출(비용 발생) 전에 확인 — 다른 거래처 섞임 방지 (2026-06-04, 비용 0으로 차단)
  if(pageCount>1 && !confirm(`사진 ${pageCount}장이 선택됐어요.\n\n같은 영수증의 여러 페이지인가요?\n거래처가 다르면 '취소' 후 한 곳씩 올려주세요.`)) return;
  setLoad(true, pageCount>1 ? `AI 분석 중... (사진 ${pageCount}장 통합)` : 'AI 분석 중...');
  try {
    const catList = getCatListForPrompt();
    const isVendorModeAI = rcpMode === 'vendor';
    // ─── 통합 개선 (2026-05-19 (4)) ───
    //  · 프롬프트 다이어트 (11규칙→핵심만, 예시 단축) → 입력 토큰 ~30% ↓
    //  · p = 영수증 [합계] 컬럼 인쇄값 그대로 (사장님 호소 ② 116,000 vs 115,999 catch)
    //  · total_sum 우선순위 정정: 금일합계 > 합계액 > 결제금액 (전미수/총합계/잔액/누계 무시)
    //  · page_info: {current, total} 신설 — 영수증 "Page (N/M)" 인쇄 감지
    //  · 멀티페이지: parts에 inline_data 여러 개 → AI가 통합 분석
    // 거래처 과거 품목 로드 — 품목명 자동완성 + 단가 매칭 자동채움용. 프롬프트엔 안 넣음(환각 방지, 2026-06-05)
    rcpPastItems = [];
    rcpPastPriceMap = new Map();
    if(isVendorModeAI && rcpVendorId){
      const {data:pData} = await sb.from('receipts')
        .select('item, unit_price')
        .eq('store_id', currentStore.id)
        .eq('vendor_id', rcpVendorId)
        .not('item','is',null)
        .order('created_at',{ascending:false})
        .limit(300);
      if(pData && pData.length){
        const seen = new Set();
        pData.forEach(r => {
          const nm = (r.item||'').trim();
          if(!nm) return;
          seen.add(nm);
          const p = parseInt(r.unit_price)||0;
          if(p > 0){
            if(!rcpPastPriceMap.has(p)) rcpPastPriceMap.set(p, new Set());
            rcpPastPriceMap.get(p).add(nm);
          }
        });
        rcpPastItems = [...seen].slice(0,120);
      }
    }
    // 프롬프트 = common.js 공통 함수 (측정실과 100% 동일 — 검증=실제 보장)
    const prompt = buildReceiptPrompt({ isVendorMode:isVendorModeAI, vendorName:rcpVendorName, catList, pageCount });
    // AI 단독 (2026-05-19 (4)): OCR 제거 — Gemini Flash 단독 (3차 best ~95%+) + High demand 시 GPT-4o fallback
    const aiModel = isVendorModeAI ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';
    // 모든 페이지를 parts에 박음 (Gemini multi-image 지원)
    const parts = [{text:prompt}];
    b64Pages.forEach(b64Part=>{
      parts.push({inline_data:{mime_type:'image/jpeg',data:b64Part}});
    });
    // 타임아웃 = 기본 30초 + 페이지당 +5초
    const timeoutSec = 30 + (pageCount-1)*5;
    let raw, usedFallback = false;
    try {
      raw = await callGemini(parts, timeoutSec, 'receipt_ocr', aiModel, 'gemini');
    } catch(geminiErr){
      const m = String(geminiErr?.message || '').toLowerCase();
      const isOverloadLike = /high demand|overload|currently|503|429|시간 초과|비어있|json|응답 오류/i.test(m);
      if(isOverloadLike){
        setLoad(true, 'Gemini 과부하 → GPT-4o로 재시도 중...');
        toast('⚠️ Gemini 과부하 감지 — GPT-4o로 재시도', 'warn', 2500);
        raw = await callGemini(parts, 60+(pageCount-1)*5, 'receipt_ocr', 'gpt-4o', 'gpt'); // GPT-4o 느림 → 60초 (2026-06-08 실측)
        usedFallback = true;
      } else {
        throw geminiErr;
      }
    }
    // 여러 장인데 서로 다른 거래처 영수증이 섞임 감지 → 중단 + 안내 (2026-06-04)
    //   엉킨 결과를 저장하는 사고 방지. 거래처별로 따로 올리도록 유도.
    if(pageCount>1 && !Array.isArray(raw) && raw?.multi_receipt===true){
      setLoad(false);
      toast('📄 서로 다른 거래처 영수증이 섞여 있어요.\n거래처별로 한 번에 한 곳씩 올려주세요.', 'warn', 7000);
      return;
    }
    // GPT-4o 자동전환 제거 (2026-06-05) — needs_review 자가판단 못 믿음(오늘 10개 틀렸는데 false) +
    // 한자 품목명은 GPT-4o가 오히려 더 나쁨(#97: GPT 62.5% < 제미나이 95%, '냉동돈육' 환각) + 비용 6배(6→35원).
    // 한자 품목 한계는 모델로 못 풀고 사장님 원터치 수정(자동완성)으로 해결. GPT 비교는 측정실 수동에만 유지.
    // 응답 호환: 옛 배열 형식과 새 객체 형식 둘 다 받음
    // 2026-05-19 (4)+ 출력 다이어트: date·vendor 최상위 1번 → 행 fallback
    const itemsRaw = Array.isArray(raw) ? raw : (raw?.items || []);
    const receiptTotalSum = Array.isArray(raw) ? null : (raw?.total_sum || null);
    const receiptSupplySum = Array.isArray(raw) ? null : (raw?.total_supply || null); // 세전 공급가액 소계 (세액 별도 양식)
    const receiptTaxSum = Array.isArray(raw) ? null : (raw?.total_tax || null);       // 세액 소계
    const pageInfo = (raw && raw.page_info && typeof raw.page_info.total==='number') ? raw.page_info : null;
    const respDate = (!Array.isArray(raw) && raw?.date) ? raw.date : null;
    const respVendor = (!Array.isArray(raw) && raw?.vendor) ? raw.vendor : '';
    const defaultCat = isVendorModeAI ? (rcpCatName || '식자재') : '';
    let list = itemsRaw.map(x => ({
      date: x.d || x.date || respDate || ymdLocal(new Date()),
      vendor: x.v ?? x.vendor ?? respVendor ?? '',
      item: x.i || x.item || '',
      spec: x.spec || null,   // 규격 (거래처 모드 분리 — 2026-06-08)
      origin: x.og || x.origin || null, // 원산지 (거래처 모드 분리 — 2026-06-08)
      unitPrice: x.u ?? x.unitPrice ?? null,
      qty: x.q ?? x.qty ?? null,
      totalPrice: x.p ?? x.totalPrice ?? 0,
      taxAmount: x.t ?? x.taxAmount ?? 0,
      isTaxFree: (x.f===true || x.f==='true' || x.isTaxFree===true), // 면세 여부 (의제매입세액공제용)
      category: x.c || x.category || defaultCat
    }));
    // 공급가(세전) = 합계(세후) − 세액. 세후 통일(2026-06-04) 후 검산·저장용
    list.forEach(it=>{ it.supplyPrice = (parseInt(it.totalPrice)||0) - (parseInt(it.taxAmount)||0); });
    // 영수증에 세액이 하나라도 있으면 = 세액 별도 양식 → 행마다 공급가·부가세 줄 표시 (세액 0 행은 면세)
    const _hasAnyTax = list.some(it=>(parseInt(it.taxAmount)||0)>0);
    list.forEach(it=> it._taxFormat = _hasAnyTax);
    // DB 규칙으로 카테고리 + display_item 덮어쓰기 (학습된 품목은 AI 판단 무시)
    list=await applyRulesToReceipt(list);
    // ─── Self-Reflection: 합계 불일치 시 AI 재검산 최대 2회 (2026-06-05) ───
    if(receiptTotalSum && !usedFallback){
      for(let _ref=0; _ref<2; _ref++){
        const _rowSum=list.reduce((s,it)=>s+(parseInt(it.totalPrice)||0),0);
        const _diff=Math.abs(_rowSum-receiptTotalSum);
        if(_diff<=Math.max(500, receiptTotalSum*0.005)) break; // 0.5% 또는 500원 이내 = 통과
        setLoad(true,`합계 ${fmt(_diff)}원 차이 — AI 재검산 중... (${_ref+1}/2)`);
        try{
          const _rParts=[{text:`이전 분석 수정 요청. 품목 합산 ${_rowSum}원인데 영수증 합계가 ${receiptTotalSum}원 (차이 ${_diff}원).\n이전 응답: ${JSON.stringify(raw)}\n이미지를 다시 확인해 수량(q)·금액(p)·단가(u) 오류를 찾아 수정된 JSON만 반환.`},...parts.slice(1)];
          const _fixRaw=await callGemini(_rParts,timeoutSec+10,'receipt_reflection',aiModel,'gemini');
          const _fixItems=Array.isArray(_fixRaw)?_fixRaw:(_fixRaw?.items||[]);
          if(!_fixItems.length) break;
          raw=_fixRaw;
          list=_fixItems.map(x=>({
            date:x.d||x.date||respDate||ymdLocal(new Date()),
            vendor:x.v??x.vendor??respVendor??'',
            item:x.i||x.item||'',
            spec:x.spec||null,
            origin:x.og||x.origin||null,
            unitPrice:x.u??x.unitPrice??null,
            qty:x.q??x.qty??null,
            totalPrice:x.p??x.totalPrice??0,
            taxAmount:x.t??x.taxAmount??0,
            isTaxFree:(x.f===true||x.f==='true'||x.isTaxFree===true),
            category:x.c||x.category||defaultCat
          }));
          list.forEach(it=>{it.supplyPrice=(parseInt(it.totalPrice)||0)-(parseInt(it.taxAmount)||0);});
          const _ht2=list.some(it=>(parseInt(it.taxAmount)||0)>0);
          list.forEach(it=>it._taxFormat=_ht2);
          list=await applyRulesToReceipt(list);
        }catch(e){break;}
      }
    }
    // 임계값 = max(100원, 0.5%) — 2026-05-19 (4) 사장님 호소: 회계 기준 5% 너무 느슨
    // 1원 차이(반올림) = 자동 통과, 100원 이내·0.5% 이내 = 정상, 그 외 = ⚠️ catch
    // 예: 116,000 vs 115,999 (1원) → 통과 / 282,000 vs 28,200 (253,800원) → catch
    // 2026-05-19 (4)+ 시각화: 의심행을 it._suspect에 박아 표 행 자체에 ⚠️ 표시 (토스트 사라져도 영구)
    const suspectRows = [];
    list.forEach((it,idx)=>{
      const u = parseFloat(it.unitPrice)||0;
      const q = parseFloat(it.qty)||0;
      // 검산은 공급가(세전=합계−세액) 기준 — u×q는 공급가와 맞음 (세후 합계와는 부가세만큼 차이날 수 있음)
      const sp = parseFloat(it.supplyPrice)||0;
      if(u>0 && q>0 && sp>0){
        const calc = u*q;
        const diff = Math.abs(calc-sp);
        const threshold = Math.max(100, Math.max(calc,sp) * 0.005);
        if(diff > threshold){
          const calcInt = Math.round(calc);
          suspectRows.push({idx:idx+1, item:it.item, u, q, p:sp, calc:calcInt, diff});
          it._suspect = {calc:calcInt, diff};
        }
      }
    });
    if(suspectRows.length){
      const detail = suspectRows.slice(0,3).map(s=>`${s.idx}행 "${s.item.slice(0,12)}": ${fmt(s.u)}×${s.q}=${fmt(s.calc)} ≠ ${fmt(s.p)} (차이 ${fmt(s.diff)}원)`).join('\n');
      const more = suspectRows.length>3?`\n외 ${suspectRows.length-3}건`:'';
      toast(`⚠️ 단가×수량 ≠ 합계 의심 ${suspectRows.length}건\n${detail}${more}\n저장 전 확인하세요`, 'warn', 8000);
    }
    // ⚠️ 품목명 의심 감지 (2026-06-05) — AI needs_review 자가판단 대신 출력값 패턴 검사 (100% 결정적)
    // 한자 칸을 못 읽으면 옆 글자(주소·전화·사업자번호)를 끌어다 채우는 환각 → 코드가 무조건 잡아 빨간 강조
    list.forEach(it=>{ const r=_rcpNameSuspect(it.item); if(r) it._nameSuspect=r; });
    // ─── 단가 매칭 자동채움 (2026-06-05) ───
    // 과거 영수증 단가가 등록된 거래처에서: 이번 행 단가 → 과거 단가 목록 대조 → 품목명 자동채움
    // 🟢 정확 일치 + 후보 1개 → 자동 채움 (빨간불 해제)
    // 🟡 정확 일치 후보 여럿 또는 ±15% 근접 → _nameCandidates 저장 (원터치 선택 추천)
    // 🔴 일치 없음 → 기존 nameSuspect 유지
    if(isVendorModeAI && rcpPastPriceMap.size){
      list.forEach(it => {
        // 품목명을 또렷이 읽은 행은 건드리지 않음 (후보 N개 과다 잡음 제거, 2026-06-08)
        // 단가 매칭(자동채움·후보 추천)은 품목명 의심(🔴) 행에만 작동
        if(!it._nameSuspect) return;
        const u = parseInt(it.unitPrice)||0;
        if(!u) return;
        if(rcpPastPriceMap.has(u)){
          const candidates = [...rcpPastPriceMap.get(u)];
          if(candidates.length === 1){
            it.item = candidates[0];
            it._nameSuspect = null;
            it._autoFilled = true;
          } else {
            it._nameCandidates = candidates;
            it._nameSuspect = null;
          }
        } else {
          // ±15% 근접 후보 탐색 (정확 일치 없을 때만)
          const nearby = [];
          rcpPastPriceMap.forEach((names, pastPrice) => {
            if(Math.abs(pastPrice - u) / u <= 0.15) nearby.push(...names);
          });
          if(nearby.length) it._nameCandidates = [...new Set(nearby)];
        }
      });
    }
    // 🔴 같은 품목명인데 단가가 다른 행 = AI 복제 오독 의심 (2026-06-08)
    // 인접한 같은 접두어 자체상품(예 "(풍당)…")을 AI가 옆줄에 이름 복붙하는 케이스 잡음
    {
      const nameGroups = {};
      list.forEach(it => {
        const nm = String(it.item||'').trim();
        if(!nm) return;
        (nameGroups[nm] = nameGroups[nm] || []).push(it);
      });
      Object.values(nameGroups).forEach(group => {
        if(group.length < 2) return;
        const prices = new Set(group.map(it => parseInt(it.unitPrice)||0));
        if(prices.size > 1){ // 같은 이름인데 단가가 제각각 → 복제 의심
          group.forEach(it => { if(!it._nameSuspect) it._nameSuspect = '같은 이름 다른 단가 — 복제 의심'; });
        }
      });
    }
    const nameSuspectCnt = list.filter(it => it._nameSuspect).length;
    const autoFilledCnt  = list.filter(it => it._autoFilled).length;
    if(autoFilledCnt){
      toast(`✅ 단가로 품목명 ${autoFilledCnt}건 자동 채움 — 맞는지 확인하세요`, 'success', 5000);
    }
    if(nameSuspectCnt){
      toast(`🔴 품목명 확인 필요 ${nameSuspectCnt}건 — 📋 눌러 고쳐주세요`, 'warn', 7000);
    }
    rowCount=0;
    document.getElementById('resTable').innerHTML=_rcpDatalistHtml()+list.map(i=>buildReceiptRow(i)).join('');
    rowCount=list.length;
    // 영수증 날짜 상단 입력칸에 AI 인식 날짜 표시 + 이상 경고 (2026-06-02: 날짜 hidden 문제 해결)
    const _rcpDateEl=document.getElementById('rcpReceiptDate');
    if(_rcpDateEl){ _rcpDateEl.value=(list[0]&&list[0].date)||ymdLocal(new Date()); _checkRcpDateWarn(_rcpDateEl.value); }
    const _rcpVenEl=document.getElementById('rcpReceiptVendor');
    if(_rcpVenEl){ _rcpVenEl.value=(list[0]&&list[0].vendor)||rcpVendorName||''; }
    // 📊 합계 + 📄 페이지 박스 (pageInfo + photoCount 함께 전달)
    _renderRcpSumCheck(receiptTotalSum, list, pageInfo, pageCount, receiptSupplySum, receiptTaxSum);
    const resultArea=document.getElementById('resultArea');
    resultArea.style.display='block';
    // 분석 완료 알림 (토큰·비용 표시는 제거 — 사장님 2026-06-02). GPT-4o 백업 전환 시만 추가 안내.
    const pageMark = pageCount>1 ? ` (${pageCount}장 통합)` : '';
    toast(`✨ 분석 완료${pageMark}${usedFallback ? ' · 🔄 GPT-4o 백업' : ''}`, 'success', 2500);
  } catch(e){toast('분석 실패: '+e.message,'error');}
  finally{setLoad(false);}
}
// ─── 분류 라벨 포맷 ("식자재>야채" → "식자재 · 야채") ───
function formatRcpCatLabel(cat){
  if(!cat) return '🏷 분류 ▸';
  const parts=String(cat).split('>').map(s=>s.trim());
  if(parts.length===1||!parts[1]) return parts[0];
  return `${parts[0]} · ${parts[1]}`;
}
// ─── 분류명 → category_id 해결 (소분류 우선, 없으면 대분류) ───
function resolveReceiptCatId(cat){
  if(!cat) return null;
  const parts=String(cat).split('>').map(s=>s.trim());
  const mainCat=parts[0]||'';
  const subCat=parts[1]||'';
  if(subCat){
    const sub=(expCategories||[]).find(c=>c.name===subCat&&c.parent_id);
    if(sub) return sub.id;
  }
  if(mainCat){
    const main=(expCategories||[]).find(c=>c.name===mainCat&&!c.parent_id);
    if(main) return main.id;
  }
  return null;
}
// ─── 영수증 행 분류 picker 호출 (행별로 tr.dataset에 결과 저장) ───
function openReceiptCatPicker(idx){
  const tr=document.getElementById('row-'+idx);
  if(!tr) return;
  openCatPicker({
    current:tr.dataset.cat||'',
    startType:'expense', // 영수증은 항상 지출 → stage1(타입선택) 생략
    onSelect:(val)=>{
      const cat=val&&val!=='미분류'?val:'';
      tr.dataset.cat=cat;
      tr.dataset.catId=resolveReceiptCatId(cat)||'';
      const btn=tr.querySelector('.c-cBtn');
      if(btn){
        btn.innerHTML=cat?formatRcpCatLabel(cat):'🏷️ 분류';
        btn.classList.toggle('empty',!cat);
      }
      // ✨ 뱃지 동적 갱신 + 페이드인 (사장님 호소: 학습 시그널 명확화)
      const cell=tr.querySelector('.ric-l2');
      if(cell){
        const oldBadge=cell.querySelector('.rcp-learn-badge');
        if(cat && !oldBadge){
          // 분류 신규 박힘 → ✨ 등장 (페이드인)
          const b=document.createElement('span');
          b.className='rcp-learn-badge rcp-learn-badge-pulse';
          b.title='저장 시 AI 학습됨';
          b.textContent='✨';
          cell.insertBefore(b, cell.firstChild);
        } else if(!cat && oldBadge){
          // 미분류로 바뀜 → ✨ 제거
          oldBadge.remove();
        } else if(cat && oldBadge){
          // 분류 바뀜 → ✨ 깜빡 (학습 갱신 시그널)
          oldBadge.classList.remove('rcp-learn-badge-pulse');
          void oldBadge.offsetWidth; // reflow trigger
          oldBadge.classList.add('rcp-learn-badge-pulse');
        }
      }
    }
  });
}
// ─── 거래처 과거 품목 자동완성 목록 (품목명 원터치 수정 — 2026-06-05) ───
//   AI가 한자 음차 품목명을 잘못 읽으면, 사장님이 품목 칸 눌러 과거 품목에서 톡 선택.
//   AI·DB 자동 덮어쓰기 X (dev_lessons #135 결론 유지) — 순수 사장님 수동 선택.
function _rcpDatalistHtml(){
  if(!rcpPastItems || !rcpPastItems.length) return '';
  return `<datalist id="rcpPastItems">${rcpPastItems.map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>`;
}
// ─── 품목명 환각 패턴 감지 (2026-06-05) — AI 자가판단(needs_review) 대신 출력값 검사 ───
//   AI가 한자 칸을 못 읽으면 옆에 보이는 주소·전화·사업자번호를 품목으로 끌어옴.
//   100% 결정적 규칙만 사용 (애매한 "처음 보는 품목"은 첫 거래처에서 전부 걸려 노이즈 → 제외).
//   의심 사유(문자열) 반환, 정상이면 '' 반환.
function _rcpNameSuspect(name){
  const s=String(name||'').trim();
  if(!s) return '품목명이 비어 있어요';
  if(/(로|길)\s*\d{1,4}/.test(s)) return '주소(도로명)가 들어간 것 같아요';           // 범지기로 189
  if(/[가-힣]{2,}(시|도)\s*[가-힣]{2,}(시|군|구)/.test(s)) return '주소가 들어간 것 같아요'; // 안산시 단원구
  if(/\d{2,4}-\d{3,4}-\d{4}/.test(s)) return '전화번호가 들어간 것 같아요';
  if(/\d{3}-\d{2}-\d{5}/.test(s)) return '사업자번호가 들어간 것 같아요';
  // 길이 규칙 없음 — 프레시원 등 거래명세서 품목명 원래 40-50자, 길이로 잡으면 오탐 남발. 주소·전화 패턴으로 충분.
  return '';
}
function buildReceiptRow(i={}) {
  const idx=rowCount++;
  const cat=String(i.category||'').trim();
  const catId=resolveReceiptCatId(cat)||'';
  const label=formatRcpCatLabel(cat);
  const emptyCls=cat?'':' empty';
  // ✨ = 학습 대상 (분류 박힌 모든 행, 저장 시 learnClassification 호출됨)
  // 2026-05-19 사장님 호소: ✨ 의미 명확화 + 분류 있는 모든 행 일관 표시
  const learnBadge=cat?`<span class="rcp-learn-badge" title="저장 시 AI 학습됨">✨</span>`:'';
  // AI 원본 텍스트 보존 (사장님 정정 학습용 — 데이터 속성)
  const origItem = String(i.item||'').replace(/"/g,'&quot;');
  // ⚠️ 의심행 시각화 (2026-05-19 (4)+) — 행 배경 노란색 + X 옆 ⚠️ + 클릭시 차이 안내 툴팁
  // 토스트는 8초면 사라지지만 행 시각화는 영구. 사장님이 어느 행이 사고인지 즉시 인지.
  const suspect = i._suspect;
  const suspectCls = suspect ? ' suspect' : '';
  const suspectMark = suspect ? `<span title="단가×수량(${fmt(suspect.calc)}) ≠ 공급가 — ${fmt(suspect.diff)}원 차이. 수량 확인 필요" style="font-size:13px;cursor:help;">⚠️</span>` : '';
  // 🔴 품목명 의심 (2026-06-05) — 주소·전화 등 환각 패턴이면 품목 칸 빨간 강조
  const nameSuspect = i._nameSuspect;
  const nameSuspectCls = nameSuspect ? ' name-suspect' : '';
  const nameSuspectMark = nameSuspect ? `<span class="rcp-ns-mark" title="${esc(nameSuspect)} — 📋 눌러 고쳐주세요" style="font-size:13px;cursor:help;">🔴</span>` : '';
  // 면세 배지 — AI 면세 판단(isTaxFree) 우선, 없으면 세액 섞인 영수증의 세액 0 행 = 면세
  const _tax = parseInt(i.taxAmount)||0;
  const freeBadge = (i.isTaxFree || (i._taxFormat && _tax===0)) ? `<span class="ric-free">면세</span>` : '';
  // 📋 버튼 — 과거 품목 원터치 선택 (거래처 모드 + 과거 품목 있을 때만)
  const pastBtn = rcpPastItems.length ? `<button type="button" class="ric-past-btn" data-action="openRcpPastSheet|${idx}" title="과거 품목 선택">📋</button>` : '';
  // 단가 매칭 뱃지 (2026-06-05)
  const autoTag = i._autoFilled
    ? `<span class="rcp-auto-tag">✅ 단가 자동채움</span>`
    : (i._nameCandidates?.length ? `<span class="rcp-guess-tag" data-action="openRcpPastSheet|${idx}">🟡 후보 ${i._nameCandidates.length}개</span>` : '');
  // 규격·원산지 칸 (거래처 모드에서만 표시 — 2026-06-08)
  const isVendorRow = rcpMode === 'vendor';
  const specRow = isVendorRow ? `
    <div class="ric-spec">
      <span class="ric-spec-lbl">규격</span>
      <input type="text" class="c-spec" value="${esc(i.spec||'')}" placeholder="규격 없음">
    </div>` : '';
  const ogChip = isVendorRow ? `<span class="ric-meta">🌍 <input type="text" class="c-og" value="${esc(i.origin||'')}" placeholder="원산지"></span>` : '';
  return `<div class="rcp-item-card${suspectCls}${nameSuspectCls}" id="row-${idx}" data-cat="${cat}" data-cat-id="${catId}" data-orig-item="${origItem}">
    <div class="ric-l1">
      ${nameSuspectMark}
      <input type="text" class="c-i" value="${esc(i.item||'')}" placeholder="품목" list="rcpPastItems" autocomplete="off">
      ${freeBadge}
      <input type="text" class="c-p" inputmode="numeric" value="${fmt(i.totalPrice||0)}" data-input="onReceiptAmountInput|this">
      ${pastBtn}
      <button class="ric-x x-btn" data-action="openReasonSheet|${idx}" title="오답/삭제">×</button>
    </div>${specRow}
    <div class="ric-l2">
      ${suspectMark}
      <span class="ric-mini">단가 <input type="text" class="c-u" inputmode="numeric" value="${i.unitPrice?fmt(i.unitPrice):''}" placeholder="-" data-input="onRcpUnitPriceInput|this|${idx}"></span>
      <span class="ric-mini">수량 <input type="text" class="c-q" inputmode="decimal" value="${i.qty||''}" placeholder="-" data-input="onRcpQtyInput|this|${idx}"></span>
      ${ogChip}
      ${autoTag}
      ${learnBadge}
      <button type="button" class="c-cBtn ric-chip${cat?'':' empty'}" data-action="openReceiptCatPicker|${idx}">${cat?label:'🏷️ 분류'}</button>
    </div>
    <input type="hidden" class="c-d" value="${i.date||ymdLocal(new Date())}">
    <input type="hidden" class="c-v" value="${esc(i.vendor||'')}">
    <input type="hidden" class="c-t" value="${parseInt(i.taxAmount)||0}">
    <input type="hidden" class="c-f" value="${(i.isTaxFree || (i._taxFormat && (parseInt(i.taxAmount)||0)===0))?'1':'0'}">
  </div>`;
}
// 단가/수량 입력 시 자동 금액 계산 (사용자 편의 — 2026-05-19)
function onRcpUnitPriceInput(el, idx){
  const tr=document.getElementById('row-'+idx); if(!tr) return;
  // 천단위 콤마 자동
  const pos=el.selectionStart;
  const digits=String(el.value||'').replace(/[^0-9]/g,'');
  const formatted=digits?fmt(parseInt(digits,10)):'';
  el.value=formatted;
  _rcpRecalcAmount(tr);
}
function onRcpQtyInput(el, idx){
  const tr=document.getElementById('row-'+idx); if(!tr) return;
  // 소수점 1자리까지 허용
  const cleaned=String(el.value||'').replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1');
  el.value=cleaned;
  _rcpRecalcAmount(tr);
}
function _rcpRecalcAmount(tr){
  const u=parseInt(String(tr.querySelector('.c-u')?.value||'').replace(/[^0-9]/g,''),10)||0;
  const q=parseFloat(tr.querySelector('.c-q')?.value||'0')||0;
  if(u>0 && q>0){
    const amt=Math.round(u*q);
    const pEl=tr.querySelector('.c-p');
    if(pEl) pEl.value=fmt(amt);
  }
}
// ─── 금액 입력: 천단위 콤마 자동 ───
function onReceiptAmountInput(inputEl){
  const pos=inputEl.selectionStart;
  const before=inputEl.value;
  const isNeg=before.startsWith('-');
  const digits=String(before).replace(/[^0-9]/g,'');
  const num=(isNeg?-1:1)*(parseInt(digits,10)||0);
  const formatted=digits?(isNeg?'-'+fmt(parseInt(digits,10)):fmt(parseInt(digits,10))):'';
  if(formatted===before) return;
  inputEl.value=formatted;
  // 커서 위치 보정 (콤마 삽입으로 위치 어긋남)
  const diff=formatted.length-before.length;
  try{ inputEl.setSelectionRange(pos+diff, pos+diff); }catch(e){}
}
function addReceiptRow(){document.getElementById('resultArea').style.display='block';document.getElementById('resTable').insertAdjacentHTML('beforeend',buildReceiptRow({date:document.getElementById('rcpReceiptDate')?.value||ymdLocal(new Date())}));}
// ─── 영수증 날짜 변경 → 모든 행 동기화 (영수증 1장 = 1날짜) + 이상 경고 (2026-06-02) ───
function onRcpDateChange(el){
  const v=el.value; if(!v) return;
  document.querySelectorAll('#resTable .c-d').forEach(c=>c.value=v);
  _checkRcpDateWarn(v);
}
// 영수증 거래처 변경 → 모든 행 c-v 동기화 (영수증 1장 = 1거래처, 2026-06-02)
function onRcpVendorChange(el){
  document.querySelectorAll('#resTable .c-v').forEach(c=>c.value=el.value);
}
function _checkRcpDateWarn(dateStr){
  const warn=document.getElementById('rcpDateWarn'); if(!warn) return;
  const today=ymdLocal(new Date());
  const yearAgo=new Date(); yearAgo.setFullYear(yearAgo.getFullYear()-1);
  const bad = !dateStr || dateStr>today || new Date(dateStr+'T00:00:00')<yearAgo;
  warn.style.display=bad?'inline':'none';
}
// in-page 초기화 (2026-05-19 사장님 호소 "취소하면 PWA 재실행" 해결)
// 옛 동작: location.reload() — saveReceipt rcpEntryReturn 분기에서 별도 처리
function resetReceipt(){
  const resTable=document.getElementById('resTable');
  if(resTable) resTable.innerHTML='';
  rowCount=0;
  rcpEntryReturn=null;
  resetRcpMode();
}
function openReasonSheet(idx){currentTargetRowIdx=idx;openSheet('reasonSheet');}

// ─── 새 기능: 과거 품목 원터치 선택 시트 (2026-06-05) ───
// 📋 버튼 → 시트 올라옴 → 과거 품목 선택 → 행 품목명 채워짐 + 빨간불 해제
function openRcpPastSheet(idx){
  rcpPastSheetTargetIdx = idx;
  const row = document.getElementById('row-'+idx);
  // 현재 행의 단가로 후보 계산
  let candidates = [];
  if(row){
    const u = parseInt(String(row.querySelector('.c-u')?.value||'').replace(/,/g,''))||0;
    if(u){
      if(rcpPastPriceMap.has(u)){
        candidates = [...rcpPastPriceMap.get(u)];
      } else {
        rcpPastPriceMap.forEach((names, p) => {
          if(Math.abs(p-u)/u <= 0.15) candidates.push(...names);
        });
        candidates = [...new Set(candidates)];
      }
    }
  }
  document.getElementById('rcpPastItemSearch').value = '';
  _renderPastItemList(candidates, '');
  openSheet('rcpPastItemSheet');
}
function _renderPastItemList(topCandidates, search){
  const listEl = document.getElementById('rcpPastItemList');
  if(!listEl) return;
  const q = search.trim().toLowerCase();
  const items = q
    ? rcpPastItems.filter(n => n.toLowerCase().includes(q))
    : (topCandidates.length ? topCandidates : rcpPastItems);
  if(!items.length){
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">' + (q ? '검색 결과 없음' : '저장된 과거 품목이 없어요') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(nm =>
    `<div class="past-item-row" data-name="${esc(nm)}" data-action="selectPastItemFromEl|this">${esc(nm)}</div>`
  ).join('');
}
function onRcpPastItemSearch(el){
  // 현재 시트에 띄워진 top 후보는 따로 저장하지 않으므로 검색 시엔 전체 목록에서 필터
  _renderPastItemList([], el.value);
}
function selectPastItemFromEl(el){
  const name = el.dataset.name;
  if(!name || rcpPastSheetTargetIdx === null) return;
  const row = document.getElementById('row-'+rcpPastSheetTargetIdx);
  if(row){
    const input = row.querySelector('.c-i');
    if(input) input.value = name;
    // 빨간불 + 배경 해제
    row.classList.remove('name-suspect');
    row.querySelector('.rcp-ns-mark')?.remove();
  }
  closeAllSheets();
  rcpPastSheetTargetIdx = null;
}

function selectReason(r){
  const tr=document.getElementById('row-'+currentTargetRowIdx);
  const btn=tr.querySelector('.x-btn');
  if(r==='cancel'){tr.classList.remove('row-off');btn.style.background='var(--danger-light)';btn.style.color='var(--danger)';btn.innerText='X';}
  else{tr.classList.add('row-off');btn.style.background='var(--gray-200)';btn.style.color='var(--gray-600)';btn.innerText='＋';tr.dataset.reason=r;}
  closeAllSheets();
}
async function saveReceipt(){
  if(!guardStore()) return;
  // 상단 영수증 날짜·거래처를 모든 행에 반영 (영수증 1장 = 1날짜·1거래처, 2026-06-02)
  const _topDate=document.getElementById('rcpReceiptDate')?.value;
  if(_topDate) document.querySelectorAll('#resTable .c-d').forEach(c=>c.value=_topDate);
  const _topVendor=document.getElementById('rcpReceiptVendor')?.value||'';
  if(_topVendor) document.querySelectorAll('#resTable .c-v').forEach(c=>c.value=_topVendor);
  // ─── 새 기능: 거래처 모드면 vendor_id + 카테고리 자동 박힘, 직구 모드면 vendor_id NULL + AI 분류 그대로 ───
  const isVendorMode = rcpMode === 'vendor' && rcpVendorId;
  // 영수증 1장 = 그룹 UUID 1개 (2026-05-19 사장님 호소 "각각 산 것처럼 보임" 해결)
  // 모든 행에 동일 group_id 박음 → 기록내역 그룹 묶음 표시 + 그룹 편집·삭제 가능
  const groupId = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : null;
  const rows=Array.from(document.querySelectorAll('#resTable .rcp-item-card')).map((tr,idx)=>{
    // 거래처 모드: 사용자가 사전 선택한 카테고리 강제 사용 (AI 분류 무시)
    const cat = isVendorMode
      ? (rcpCatName || (tr.dataset.cat||'').trim())
      : (tr.dataset.cat||'').trim();
    // dataset.catId가 비어있으면 picker가 안 거쳐진 케이스 → 재계산. 거래처 모드면 rcpCatId 우선
    const category_id = isVendorMode
      ? (rcpCatId || tr.dataset.catId || resolveReceiptCatId(cat) || null)
      : (tr.dataset.catId ? tr.dataset.catId : (resolveReceiptCatId(cat) || null));
    const amtRaw=(tr.querySelector('.c-p')?.value||'').replace(/[^0-9-]/g,''); // 마이너스(-) 보존 — 할인 행(-500 등) 음수 유지 (2026-06-08 버그수정)
    const taxRaw=(tr.querySelector('.c-t')?.value||'').replace(/[^0-9]/g,''); // 행 세액(부가세) — 합계는 세후
    const isFree=(tr.querySelector('.c-f')?.value||'0')==='1'; // 면세 여부
    // 거래처 모드면 vendor 텍스트도 거래처명으로 통일 (AI 추출 vendor가 누락이거나 다를 때 보호)
    const vendorText = isVendorMode
      ? (rcpVendorName || tr.querySelector('.c-v').value)
      : (tr.querySelector('.c-v')?.value || '');
    // 단가/수량 추출 (2026-05-19 부활) — 가격 추세 분석 기반
    const unitRaw=(tr.querySelector('.c-u')?.value||'').replace(/[^0-9-]/g,''); // 마이너스 보존 — 할인 행 단가 음수 유지 (2026-06-08)
    const qtyRaw=parseFloat((tr.querySelector('.c-q')?.value||'').replace(/[^0-9.]/g,''))||null;
    const itemText = tr.querySelector('.c-i')?.value || '';
    // AI 원본 텍스트 보존 (사장님이 수정 시 학습용)
    const origItem = tr.dataset.origItem || itemText;
    // spec·origin — 거래처 영수증 규격·원산지 분리 저장 (2026-06-08)
    const specText = tr.querySelector('.c-spec')?.value?.trim() || null;
    const originText = tr.querySelector('.c-og')?.value?.trim() || null;
    return {
      _idx:idx+1, _cat:cat, _origItem: origItem, // 학습용 메타 (DB 저장 X)
      store_id:currentStore.id,receipt_date:tr.querySelector('.c-d').value,
      vendor:vendorText,item:itemText,
      spec:specText, origin:originText,
      vendor_id: isVendorMode ? rcpVendorId : null,
      unit_price: unitRaw ? parseInt(unitRaw,10) : null,
      qty: qtyRaw,
      total_price:parseInt(amtRaw,10)||0,
      tax_amount: parseInt(taxRaw,10)||0,
      supply_price: (parseInt(amtRaw,10)||0) - (parseInt(taxRaw,10)||0), // 공급가(세전)
      is_tax_free: isFree, // 면세 여부 (의제매입세액공제용)
      category:cat||null,category_id:category_id||null,
      input_method: rcpInputMethod || null,
      receipt_group_id: groupId,
      note:tr.classList.contains('row-off')?(tr.dataset.reason||'오답'):'정상'
    };
  });
  // 사전 가드: 정상 행 중 분류가 expense_categories에 매칭 안 되는 건 안내 (오답은 통과)
  const missing=rows.filter(r=>r.note==='정상'&&r._cat&&!r.category_id);
  if(missing.length){
    const detail=missing.map(r=>`${r._idx}행 "${r._cat}"`).join('\n• ');
    if(!confirm(`아래 분류는 카테고리 목록에 없어요:\n• ${detail}\n\n그래도 저장할까요?\n(분류명은 텍스트로 들어가지만 집계가 안 잡힐 수 있어요)`)) return;
  }
  // 날짜 이상 경고 (2023 등 AI 오인식 방지, 2026-06-02)
  const _today=ymdLocal(new Date());
  const _yearAgo=new Date(); _yearAgo.setFullYear(_yearAgo.getFullYear()-1);
  const _badDates=[...new Set(rows.filter(r=>r.note==='정상'&&r.receipt_date&&(r.receipt_date>_today||new Date(r.receipt_date+'T00:00:00')<_yearAgo)).map(r=>r.receipt_date))];
  if(_badDates.length){
    if(!confirm(`⚠️ 영수증 날짜가 이상해요: ${_badDates.join(', ')}\n오늘은 ${_today}입니다.\nAI가 날짜를 잘못 읽었을 수 있어요 — 위 '📅 영수증 날짜'를 확인하세요.\n\n이대로 저장할까요?`)) return;
  }
  // 임시 진단 필드 제거 후 insert (_idx/_cat/_origItem은 DB 컬럼 X)
  const cleaned=rows.map(({_idx,_cat,_origItem,...rest})=>rest);
  setLoad(true,'저장 중...');
  const {error}=await sb.from('receipts').insert(cleaned);
  setLoad(false);
  if(error) return errToast('저장', error);
  // 영수증 품목 자동 학습 폐기 (2026-06-04) — 짧은 키워드 오염 방지. 분류·품목명은 AI가 직접 판단.
  const successMsg='저장됐어요';
  // 진입 컨텍스트 따라 흐름 분기 — 새로고침 없이 in-page로 그 화면 복귀 (2026-06-08 홈 깜빡임 제거)
  if(rcpEntryReturn){
    const _ret = rcpEntryReturn;
    toast(successMsg,'success');
    // form 초기화 (resTable 비우고 모드 선택 화면 복귀)
    const resTable=document.getElementById('resTable');
    if(resTable) resTable.innerHTML='';
    rowCount=0;
    resetRcpMode();
    rcpEntryReturn=null;
    _refreshAfterExpenseChange(); // 홈·지출관리 캐시 무효화
    if(_ret.startsWith('catReceipt:')){
      // 직구/식자재/기타 카드 진입 → 그 카테고리 화면으로 바로 복귀
      catReceiptMode = _ret.slice('catReceipt:'.length);
      nav('catReceipt');
    } else if(_ret.startsWith('vendors:')){
      // 거래처 진입 → 거래처 탭 + 상세 자동 열기
      const vid = _ret.slice('vendors:'.length);
      nav('vendors');
      if(vid && vid !== 'null') setTimeout(()=>openVendorDetail(vid), 300);
    } else {
      // 알 수 없는 복귀값 fallback → 기록 내역
      rcpTab('list');
      await loadReceiptList();
    }
  } else {
    // 모드 선택 화면에서 시작한 케이스 = in-page로 기록 내역 자동 이동
    // (reload·로그인 깜빡 X, 방금 저장한 그룹 카드 바로 확인)
    toast(successMsg,'success');
    // form 초기화 (resTable 비우고 모드 선택 화면 복귀)
    const resTable=document.getElementById('resTable');
    if(resTable) resTable.innerHTML='';
    rowCount=0;
    resetRcpMode();
    // 기록 내역 서브탭 전환 + 최신 데이터 로드
    rcpTab('list');
    await loadReceiptList();
    _refreshAfterExpenseChange(); // 홈·지출관리 캐시 무효화 + 즉시 갱신
  }
}

// ══════════════════════════════════════════
// 영수증 기록 내역 + 편집 (2026-04-24)
// ══════════════════════════════════════════
let rcpListMonth=(new Date()).toISOString().slice(0,7); // YYYY-MM
let rcpRecords=[];                                      // 현재 월 영수증 배열
let rcpEditingId=null;                                  // 편집 중 id
let rcpEditingCategory='';                              // 편집 중 카테고리 (대분류>소분류)

function rcpTab(tab,el){
  document.querySelectorAll('#receiptCont .sub-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  else {
    // el 없이 호출된 경우(예: 기록내역 상단 [➕ 새 영수증]) 해당 서브탭 강제 active
    const target=document.querySelector(`#receiptCont .sub-tab[data-action^="rcpTab|${tab}|"]`);
    if(target) target.classList.add('active');
  }
  document.getElementById('rcpNew').style.display=(tab==='new')?'block':'none';
  document.getElementById('rcpList').style.display=(tab==='list')?'block':'none';
  if(tab==='list'){
    const mEl=document.getElementById('rcpListMonth');
    if(mEl && !mEl.value) mEl.value=rcpListMonth;
    loadReceiptList();
  }
}

function onRcpListMonthChange(el){
  rcpListMonth=el.value||rcpListMonth;
  loadReceiptList();
}

async function loadReceiptList(){
  if(!guardStore()) return;
  const body=document.getElementById('rcpListBody');
  // 스켈레톤 우선 — 빈 자리 표시 (designer 규칙 9, coder 데이터 로딩 패턴)
  body.innerHTML='<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">불러오는 중...</div>';
  const [y,m]=rcpListMonth.split('-').map(Number);
  const lastDay=new Date(y,m,0).getDate();
  const start=rcpListMonth+'-01', end=rcpListMonth+'-'+String(lastDay).padStart(2,'0');
  const {data,error}=await sb.from('receipts')
    .select('id,receipt_date,vendor,item,unit_price,qty,total_price,category,category_id,note,receipt_group_id,input_method,vendor_id,created_at')
    .eq('store_id',currentStore.id)
    .gte('receipt_date',start).lte('receipt_date',end)
    .order('receipt_date',{ascending:false})
    .order('created_at',{ascending:true});
  if(error){
    console.error('[receipts] load failed:',error);
    const code=error.code||error.status||'';
    const msg=(error.message||error.error_description||'').slice(0,120);
    body.innerHTML=`<div style="text-align:center;padding:24px;color:var(--danger);font-size:13px;line-height:1.5;">불러오기 실패${code?' ['+code+']':''}<br><span style="font-size:11px;color:var(--gray-500);">${msg||'(에러 메시지 없음)'}</span></div>`;
    return;
  }
  rcpRecords=data||[];
  renderReceiptList();
}

// 영수증 그룹핑: receipt_group_id 같은 행끼리 묶음, NULL은 id별 단일 그룹 (옛 영수증 호환)
// 2026-05-21 신설: receipts ↔ vendor_orders 행을 공통 객체로 정규화
//  · _source = 'receipt' | 'order' (행 클릭·그룹 헤더 분기용)
//  · 컬럼 차이 흡수: total_price↔amount / qty↔quantity / receipt_group_id↔order_group_id / receipt_date↔order_date
//  · vendor_orders는 "정상"만 (오답 개념 없음). input_method = 'manual' 고정 (거래처 수동 입력).
function _normalizeExpenseRow(row, source){
  if(source==='order'){
    return {
      _source:'order',
      _origin:row,
      id:row.id,
      date:row.order_date||'',
      vendor:row.vendors?.name||'',
      vendor_id:row.vendor_id||null,
      item:row.item||'',
      unit:row.unit_price||null,
      qty:(row.quantity!=null&&row.quantity!=='')?row.quantity:null,
      amount:row.amount||0,
      group_id:row.order_group_id||null,
      input_method:'manual',
      note:'정상',
      memo:row.memo||''
    };
  }
  if(source==='mydata'){
    // 2026-05-25 신설: mydata_transactions(통장·카드 자동 분류) 정규화
    //  · 카테고리 화면 통합 표시용 (사장님 호소: "기타 들어가면 영수증이 안 보임" → 전 카테고리 통일)
    //  · 1행 = 1그룹 (group 개념 없음, recId=tx.id)
    //  · 헤더 라벨 = merchant_name 우선, 없으면 description
    //  · 편집: openTxEditSheet(id, tx_type) / 삭제: 시트 안에서
    const label = (row.merchant_name||'').trim() || (row.description||'').trim() || '(내역 없음)';
    return {
      _source:'mydata',
      _origin:row,
      id:row.id,
      date:row.tx_date||'',
      vendor:label,
      vendor_id:null,
      item:(row.sub_category||'').trim() || '-',
      unit:null,
      qty:null,
      amount:Math.abs(row.amount||0),
      group_id:null,
      input_method:'auto',
      note:'정상',
      memo:'',
      txType:row.tx_type||'bank' // 'bank' | 'card'
    };
  }
  // receipt
  return {
    _source:'receipt',
    _origin:row,
    id:row.id,
    date:row.receipt_date||'',
    vendor:row.vendor||'',
    vendor_id:row.vendor_id||null,
    item:row.item||'',
    unit:row.unit_price||null,
    qty:(row.qty!=null&&row.qty!=='')?row.qty:null,
    amount:row.total_price||0,
    group_id:row.receipt_group_id||null,
    input_method:row.input_method||null,
    note:row.note||'정상',
    memo:''
  };
}

// 2026-05-21 신설: 정규화 행 그룹핑 (영수증 그룹 + 거래처 주문 그룹 동시 처리)
//  · group_id 있음 = '<src>:g:<groupId>' (정확한 그룹)
//  · group_id NULL = '<src>:s:<rowId>' (옛 데이터 = 1행짜리 그룹)
//  · src 분리 = 같은 거래처·같은 날짜라도 영수증과 거래처주문은 다른 카드로 표시
function _groupExpenseRows(normRows){
  const groups=[];
  const byKey={};
  normRows.forEach(r=>{
    const key=r.group_id ? (r._source+':g:'+r.group_id) : (r._source+':s:'+r.id);
    if(!byKey[key]){
      const g={
        key,
        source:r._source,
        groupId:r.group_id,
        recId:r.group_id?null:r.id,
        date:r.date,
        vendor:r.vendor,
        vendor_id:r.vendor_id,
        rows:[],
        total:0,
        hasErr:false,
        inputMethod:r.input_method
      };
      byKey[key]=g;
      groups.push(g);
    }
    const g=byKey[key];
    g.rows.push(r);
    if(r.note==='정상') g.total+=(r.amount||0);
    if(r.note!=='정상') g.hasErr=true;
  });
  return groups;
}

function _groupReceipts(records){
  const groups=[]; // [{groupKey, groupId|null, recId|null, date, vendor, rows[], total, hasErr, inputMethod}]
  const byGroupId={};
  records.forEach(r=>{
    if(r.receipt_group_id){
      const key='g:'+r.receipt_group_id;
      if(!byGroupId[key]){
        const g={groupKey:key, groupId:r.receipt_group_id, recId:null, date:r.receipt_date, vendor:r.vendor||'', rows:[], total:0, hasErr:false, inputMethod:r.input_method||null};
        byGroupId[key]=g;
        groups.push(g);
      }
      const g=byGroupId[key];
      g.rows.push(r);
      if(r.note==='정상') g.total+=(r.total_price||0);
      if(r.note!=='정상') g.hasErr=true;
    } else {
      // NULL 그룹 = 1행짜리 그룹 (옛 영수증)
      const g={groupKey:'s:'+r.id, groupId:null, recId:r.id, date:r.receipt_date, vendor:r.vendor||'', rows:[r], total:r.note==='정상'?(r.total_price||0):0, hasErr:r.note!=='정상', inputMethod:r.input_method||null};
      groups.push(g);
    }
  });
  return groups;
}

function renderReceiptList(){
  const body=document.getElementById('rcpListBody');
  const totalEl=document.getElementById('rcpListTotal');
  // 상단 추가 버튼은 서브탭 [📸 새 영수증]과 중복이라 제거 (2026-05-19 사장님 지적)
  if(!rcpRecords.length){
    body.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--gray-500);font-size:13px;line-height:1.6;">이번 달 영수증이 없어요.<br>위 [📸 새 영수증] 탭에서 등록해주세요.</div>';
    totalEl.innerText='0원';
    return;
  }
  const groups=_groupReceipts(rcpRecords);
  let total=0;
  groups.forEach(g=>{ total+=g.total; });
  totalEl.innerText=fmt(total)+'원';
  // 날짜로 다시 묶음 (날짜 헤더 표시)
  const byDate={};
  groups.forEach(g=>{
    const d=g.date||'-';
    if(!byDate[d]) byDate[d]=[];
    byDate[d].push(g);
  });
  // 2026-05-20 D안 갈아엎기: 한 표 안 그룹 헤더 행 + 본문 행 (ERP 패턴, 사장님 호소 "따로 노는 느낌" 해소)
  const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  let html=`<div class="grp-tbl-wrap"><table class="grp-tbl">
    <colgroup><col/><col style="width:48px"/><col style="width:64px"/><col style="width:44px"/><col style="width:76px"/><col style="width:22px"/></colgroup>
    <thead><tr><th>품목</th><th>분류</th><th>단가</th><th>수량</th><th>금액</th><th></th></tr></thead>
    <tbody>`;
  let firstDate=true;
  dates.forEach(d=>{
    html+=`<tr class="grp-date${firstDate?' first':''}"><td colspan="6">📅 ${esc(d)}</td></tr>`;
    firstDate=false;
    let firstGroup=true;
    byDate[d].forEach(g=>{
      const editKey=g.groupId?('grp:'+g.groupId):('rec:'+g.recId);
      const photoBadge=g.inputMethod==='photo'?'📸':(g.inputMethod==='manual'?'✏️':'');
      const errBadge=g.hasErr?`<span style="font-size:10px;color:var(--gray-500);margin-left:4px;">· 일부 오답</span>`:'';
      html+=`<tr class="grp-hdr${firstGroup?' first':''}">
        <td colspan="6"><div class="grp-hdr-row" style="cursor:pointer;" data-action="openReceiptGroupEdit|${editKey}">
          <div class="grp-hdr-info">
            ${photoBadge?`<span class="emoji">${photoBadge} 🧾</span>`:`<span class="emoji">🧾</span>`}
            <span class="name">${esc(g.vendor||'(거래처 없음)')}</span>
            <span class="sum">· ${fmt(g.total)}원</span>
            ${errBadge}
          </div>
          <span style="font-size:18px;color:#C8CDD4;font-weight:700;flex-shrink:0;">›</span>
        </div></td>
      </tr>`;
      firstGroup=false;
      g.rows.forEach(r=>{
        const isErr=r.note!=='정상';
        const suspect=!!r._suspect;
        const catRaw=r.category||'';
        const catShort=catRaw.includes('>')?catRaw.split('>').pop().trim():catRaw||'-';
        const unitTxt=r.unit_price?fmt(r.unit_price):'-';
        const qtyTxt=(r.qty!=null&&r.qty!=='')?String(r.qty):'-';
        const cls=['grp-body'];
        if(isErr) cls.push('err');
        if(suspect) cls.push('suspect');
        const itemTxt=esc(r.item||'(품목 없음)');
        const catTxt=esc(catShort);
        html+=`<tr class="${cls.join(' ')}" data-action="openReceiptEdit|${r.id}">`
          +`<td title="${itemTxt}">${itemTxt}</td>`
          +`<td class="gb-cat" title="${esc(catRaw||'미분류')}">${catTxt}</td>`
          +`<td class="gb-unit">${unitTxt}</td>`
          +`<td class="gb-qty">${qtyTxt}</td>`
          +`<td class="gb-amt">${fmt(r.total_price||0)}</td>`
          +`<td class="gb-arrow">›</td>`
          +`</tr>`;
      });
    });
  });
  html+=`</tbody></table></div>`;
  body.innerHTML=html;
}

function openReceiptEdit(id){
  const r=rcpRecords.find(x=>String(x.id)===String(id));
  if(!r){toast('영수증을 찾을 수 없어요','error');return;}
  rcpEditingId=r.id;
  rcpEditingCategory=r.category||'';
  document.getElementById('reDate').value=r.receipt_date||ymdLocal(new Date());
  document.getElementById('reVendor').value=r.vendor||'';
  document.getElementById('reItem').value=r.item||'';
  document.getElementById('reAmount').value=r.total_price?fmt(r.total_price):'';
  document.getElementById('reCatBtn').innerHTML=(r.category?'🏷️ '+getCatLabel(r.category,''):'미분류 ▸');
  const noteVal=(r.note==='정상')?'정상':'오답';
  document.querySelectorAll('input[name="reNote"]').forEach(i=>{i.checked=(i.value===noteVal);});
  openSheet('receiptEditSheet');
}

function openReceiptEditCat(){
  openCatPicker({
    current:rcpEditingCategory,
    onSelect:(val)=>{
      rcpEditingCategory=val||'';
      document.getElementById('reCatBtn').innerHTML=val?('🏷️ '+getCatLabel(val,'')):'미분류 ▸';
    }
  });
}

async function saveReceiptEdit(){
  if(!guardStore()||!rcpEditingId) return;
  const date=document.getElementById('reDate').value;
  const vendor=document.getElementById('reVendor').value.trim();
  const item=document.getElementById('reItem').value.trim();
  const amount=unFmt(document.getElementById('reAmount').value)||0;
  const note=document.querySelector('input[name="reNote"]:checked')?.value||'정상';
  const cat=rcpEditingCategory||'';
  if(!date) return toast('날짜를 입력하세요','warn');
  if(!amount&&note==='정상') return toast('금액을 입력하세요','warn');

  // 카테고리 이름 → category_id 해결
  const catById={};
  (expCategories||[]).forEach(c=>{catById[c.name]=c.id;});
  const resolveRcpCatId=c=>{
    if(!c) return null;
    const parts=String(c).split('>').map(s=>s.trim());
    const target=parts[parts.length-1];
    return catById[target]||catById[parts[0]]||null;
  };

  setLoad(true,'저장 중...');
  const {error}=await sb.from('receipts').update({
    receipt_date:date,vendor,item,total_price:amount,
    category:cat||null,category_id:resolveRcpCatId(cat),
    note
  }).eq('id',rcpEditingId).eq('store_id',currentStore.id);
  setLoad(false);
  if(error) return errToast('저장', error);

  // 학습 규칙 갱신 (정상이면서 카테고리 있을 때만, 첫 단어 keyword)
  if(note==='정상'&&item&&cat){
    const parts=String(cat).split('>').map(s=>s.trim());
    const mainCat=parts[0]||'';
    const subCat=parts[1]||'';
    const kw=normalizeItemKeyword(item);
    if(mainCat&&kw) learnClassification(kw,mainCat,subCat,'receipt',false).catch(()=>{});
  }

  toast('저장됐어요','success');
  closeSheet('receiptEditSheet');
  rcpEditingId=null;rcpEditingCategory='';
  // 활성 컨테이너 기준 새로고침 (catReceiptCont 또는 기본 영수증 기록 내역)
  if(document.getElementById('catReceiptCont')?.classList.contains('active')){
    await loadCatReceiptData();
  } else {
    await loadReceiptList();
  }
  _refreshAfterExpenseChange();
}

async function deleteReceiptRow(){
  if(!guardStore()||!rcpEditingId) return;
  if(!confirm('이 영수증을 삭제할까요? 되돌릴 수 없어요.')) return;
  setLoad(true,'삭제 중...');
  const {error}=await sb.from('receipts').delete().eq('id',rcpEditingId).eq('store_id',currentStore.id);
  setLoad(false);
  if(error) return errToast('삭제', error);
  toast('삭제됐어요','success');
  closeSheet('receiptEditSheet');
  rcpEditingId=null;rcpEditingCategory='';
  if(document.getElementById('catReceiptCont')?.classList.contains('active')){
    await loadCatReceiptData();
  } else {
    await loadReceiptList();
  }
  _refreshAfterExpenseChange();
}

// ─── 영수증 그룹 편집 (2026-05-19 신설) — 그룹 헤더 [✏ 편집] 진입 ───
// editKey: 'grp:<uuid>' = receipt_group_id 그룹 / 'rec:<id>' = 옛 영수증 단일 행
let rgeEditingKey=null;
let rgeRows=[]; // [{id?, vendor, item, amount, cat, catId, note}]
function _parseEditKey(editKey){
  if(!editKey) return null;
  if(editKey.startsWith('grp:')) return {type:'grp', id:editKey.slice(4)};
  if(editKey.startsWith('rec:')) return {type:'rec', id:editKey.slice(4)};
  return null;
}
function _rgeRowsFromRecords(records){
  return records.map(r=>({
    id:r.id, vendor:r.vendor||'', item:r.item||'',
    unitPrice:r.unit_price||null, qty:r.qty||null,
    amount:r.total_price||0,
    cat:r.category||'', catId:r.category_id||null, note:r.note||'정상',
    _isNew:false, _deleted:false, _origItem:r.item||''
  }));
}
function openReceiptGroupEdit(editKey){
  const k=_parseEditKey(editKey); if(!k) return;
  let records=[];
  if(k.type==='grp') records=rcpRecords.filter(r=>r.receipt_group_id===k.id);
  else if(k.type==='rec') records=rcpRecords.filter(r=>String(r.id)===String(k.id));
  if(!records.length){ toast('영수증을 찾을 수 없어요','error'); return; }
  rgeEditingKey=editKey;
  rgeRows=_rgeRowsFromRecords(records);
  const first=records[0];
  document.getElementById('rgeTitle').innerText=`영수증 편집 — ${first.vendor||'(거래처 없음)'}`;
  document.getElementById('rgeDate').value=first.receipt_date||ymdLocal(new Date());
  document.getElementById('rgeVendor').value=first.vendor||'';
  const totalAmt=records.filter(r=>r.note==='정상').reduce((s,r)=>s+(r.total_price||0),0);
  const totalAmtEl=document.getElementById('rgeTotalAmt');
  if(totalAmtEl) totalAmtEl.textContent=fmt(totalAmt)+'원';
  renderRgeTable();
  openSheet('receiptGroupEditSheet');
}
function renderRgeTable(){
  const container=document.getElementById('rgeTable');
  if(!container) return;
  let html='';
  rgeRows.forEach((row,idx)=>{
    if(row._deleted) return;
    const off=row.note!=='정상';
    const catLabel=row.cat?esc(row.cat):'🏷️ 분류';
    const offCls=off?' row-off':'';
    const specRow=`<div class="ric-spec">
        <span class="ric-spec-lbl">규격</span>
        <input type="text" class="c-spec" value="${esc(row.spec||'')}" placeholder="규격 없음" data-input="setRgeRowField|${idx}|spec|this">
      </div>`;
    const ogChip=`<span class="ric-meta">🌍 <input type="text" class="c-og" value="${esc(row.origin||'')}" placeholder="원산지" data-input="setRgeRowField|${idx}|origin|this"></span>`;
    html+=`<div class="rcp-item-card${offCls}" id="rge-row-${idx}">
      <div class="ric-l1">
        <button type="button" class="ric-x x-btn" style="${off?'background:#E5E8EB;color:#8B95A1;':'background:#FFE5E5;color:#DC2626;'}" data-action="toggleRgeRowOff|${idx}" title="오답/정상 토글">×</button>
        <input type="text" class="c-i" value="${esc(row.item)}" placeholder="품목" data-input="setRgeRowField|${idx}|item|this">
        <input type="text" class="c-p" inputmode="numeric" value="${fmt(row.amount)}" data-input="setRgeRowAmount|${idx}|this">
      </div>
      ${specRow}
      <div class="ric-l2">
        <button type="button" class="c-cBtn ric-chip${row.cat?'':' empty'}" data-action="openRgeCatPicker|${idx}">${catLabel}</button>
        <span class="ric-mini">단가 <input type="text" class="c-u" inputmode="numeric" value="${row.unitPrice?fmt(row.unitPrice):''}" placeholder="-" data-input="setRgeRowUnitPrice|${idx}|this"></span>
        <span class="ric-mini">수량 <input type="text" class="c-q" inputmode="decimal" value="${row.qty||''}" placeholder="-" data-input="setRgeRowQty|${idx}|this"></span>
        ${ogChip}
      </div>
    </div>`;
  });
  container.innerHTML=html;
}
function setRgeRowField(idx,field,el){
  const i=parseInt(idx,10);
  if(!rgeRows[i]) return;
  rgeRows[i][field]=el.value;
}
function setRgeRowAmount(idx,el){
  const i=parseInt(idx,10);
  if(!rgeRows[i]) return;
  const raw=String(el.value||'').replace(/[^0-9]/g,'');
  rgeRows[i].amount=parseInt(raw,10)||0;
  el.value=fmt(rgeRows[i].amount);
}
function setRgeRowUnitPrice(idx,el){
  const i=parseInt(idx,10);
  if(!rgeRows[i]) return;
  const raw=String(el.value||'').replace(/[^0-9]/g,'');
  rgeRows[i].unitPrice=raw?parseInt(raw,10):null;
  el.value=raw?fmt(rgeRows[i].unitPrice):'';
  _rgeAutoCalcAmount(i);
}
function setRgeRowQty(idx,el){
  const i=parseInt(idx,10);
  if(!rgeRows[i]) return;
  const cleaned=String(el.value||'').replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1');
  el.value=cleaned;
  rgeRows[i].qty=cleaned?parseFloat(cleaned):null;
  _rgeAutoCalcAmount(i);
}
function _rgeAutoCalcAmount(i){
  const r=rgeRows[i]; if(!r) return;
  if(r.unitPrice>0 && r.qty>0){
    r.amount=Math.round(r.unitPrice*r.qty);
    const rowEl=document.getElementById('rge-row-'+i);
    if(rowEl){ const pEl=rowEl.querySelector('.c-p'); if(pEl) pEl.value=fmt(r.amount); }
  }
}
function toggleRgeRowOff(idx){
  const i=parseInt(idx,10);
  if(!rgeRows[i]) return;
  if(rgeRows[i].note==='정상'){
    // 오답으로 토글 → 사유 시트 (기존 reasonSheet 재활용)
    rgeRows[i].note='오답';
  } else {
    rgeRows[i].note='정상';
  }
  renderRgeTable();
}
function openRgeCatPicker(idx){
  const i=parseInt(idx,10);
  if(!rgeRows[i]) return;
  openCatPicker({
    current:rgeRows[i].cat||'',
    onSelect:(val)=>{
      rgeRows[i].cat=val||'';
      // category_id 재해결
      const catById={};
      (expCategories||[]).forEach(c=>{catById[c.name]=c.id;});
      const parts=String(val||'').split('>').map(s=>s.trim());
      const target=parts[parts.length-1];
      rgeRows[i].catId=catById[target]||catById[parts[0]]||null;
      renderRgeTable();
    }
  });
}
function addRgeRow(){
  rgeRows.push({id:null,vendor:'',item:'',unitPrice:null,qty:null,amount:0,cat:'',catId:null,note:'정상',_isNew:true,_deleted:false,_origItem:''});
  renderRgeTable();
}
async function saveReceiptGroupEdit(){
  if(!guardStore()||!rgeEditingKey) return;
  const k=_parseEditKey(rgeEditingKey); if(!k) return;
  const date=document.getElementById('rgeDate').value;
  const vendor=document.getElementById('rgeVendor').value.trim();
  if(!date) return toast('날짜를 입력하세요','warn');
  const groupId=k.type==='grp'?k.id:null;
  const invalid=rgeRows.filter(r=>!r._deleted&&r.note==='정상'&&(!r.amount||r.amount<=0));
  if(invalid.length) return toast('정상 행은 금액이 필요해요','warn');
  setLoad(true,'저장 중...');
  // 1) 기존 행 UPDATE
  const updates=rgeRows.filter(r=>r.id&&!r._isNew&&!r._deleted);
  for(const r of updates){
    const {error}=await sb.from('receipts').update({
      receipt_date:date, vendor, item:r.item,
      unit_price:r.unitPrice||null, qty:r.qty||null, total_price:r.amount,
      category:r.cat||null, category_id:r.catId||null, note:r.note,
      spec:r.spec||null, origin:r.origin||null
    }).eq('id',r.id).eq('store_id',currentStore.id);
    if(error){ setLoad(false); return errToast('저장(수정)', error); }
  }
  // 2) 새 행 INSERT
  const inserts=rgeRows.filter(r=>r._isNew&&!r._deleted&&(r.amount>0||r.note!=='정상'));
  if(inserts.length){
    const payload=inserts.map(r=>({
      store_id:currentStore.id, receipt_date:date, vendor, item:r.item,
      unit_price:r.unitPrice||null, qty:r.qty||null,
      total_price:r.amount, category:r.cat||null, category_id:r.catId||null,
      note:r.note, receipt_group_id:groupId,
      spec:r.spec||null, origin:r.origin||null
    }));
    const {error}=await sb.from('receipts').insert(payload);
    if(error){ setLoad(false); return errToast('저장(추가)', error); }
  }
  // 3) 삭제 표시된 행 DELETE
  const dels=rgeRows.filter(r=>r.id&&r._deleted);
  for(const r of dels){
    const {error}=await sb.from('receipts').delete().eq('id',r.id).eq('store_id',currentStore.id);
    if(error){ setLoad(false); return errToast('저장(삭제)', error); }
  }
  setLoad(false);
  // 학습: 정상 행만 + 원본↔정정 다르면 display_item 박음
  const learnTargets=rgeRows.filter(r=>!r._deleted&&r.note==='정상'&&r.item&&r.cat);
  learnTargets.forEach(r=>{
    const parts=String(r.cat).split('>').map(s=>s.trim());
    const mainCat=parts[0]||'';
    const subCat=parts[1]||'';
    const kw=normalizeItemKeyword(r._origItem||r.item);
    const displayItem = (r._origItem && r._origItem !== r.item) ? r.item : null;
    if(mainCat&&kw) learnClassification(kw,mainCat,subCat,'receipt',false,displayItem).catch(()=>{});
  });
  toast('저장됐어요','success');
  closeSheet('receiptGroupEditSheet');
  rgeEditingKey=null; rgeRows=[];
  if(document.getElementById('catReceiptCont')?.classList.contains('active')){
    await loadCatReceiptData();
  } else {
    await loadReceiptList();
  }
  _refreshAfterExpenseChange();
}
async function deleteReceiptGroup(editKey){
  if(!guardStore()) return;
  const k=_parseEditKey(editKey); if(!k) return;
  let records=[];
  if(k.type==='grp') records=rcpRecords.filter(r=>r.receipt_group_id===k.id);
  else if(k.type==='rec') records=rcpRecords.filter(r=>String(r.id)===String(k.id));
  if(!records.length) return;
  const n=records.length;
  if(!confirm(`이 영수증의 ${n}개 행 전부 삭제할까요? 되돌릴 수 없어요.`)) return;
  // 삭제될 영수증 item 목록 추출 (B안: 고아 학습 노트 정리용)
  const deletedItems = records.map(r=>r.item).filter(Boolean);
  setLoad(true,'삭제 중...');
  let error=null;
  if(k.type==='grp'){
    ({error}=await sb.from('receipts').delete().eq('receipt_group_id',k.id).eq('store_id',currentStore.id));
  } else {
    ({error}=await sb.from('receipts').delete().eq('id',k.id).eq('store_id',currentStore.id));
  }
  if(error){ setLoad(false); return errToast('삭제', error); }
  // B안: 영수증 삭제 후 고아 학습 노트 자동 정리 (관리자 대시보드 명세 — dev_lessons #96 연계)
  let cleanupResult = { cleaned: 0, kept: 0, cleanedKeywords: [] };
  if(typeof cleanupOrphanRulesByItems === 'function' && deletedItems.length){
    try { cleanupResult = await cleanupOrphanRulesByItems(deletedItems); } catch(e){ console.warn('[B안 cleanup]', e); }
  }
  setLoad(false);
  let msg = `${n}개 행 삭제됐어요`;
  if(cleanupResult.cleaned > 0){
    msg += `\n+ 학습 노트 ${cleanupResult.cleaned}개도 같이 정리됨 (${cleanupResult.cleanedKeywords.slice(0,3).join(', ')}${cleanupResult.cleanedKeywords.length>3?' 외':''})`;
  }
  toast(msg,'success');
  if(document.getElementById('catReceiptCont')?.classList.contains('active')){
    await loadCatReceiptData();
  } else {
    await loadReceiptList();
  }
  _refreshAfterExpenseChange();
}
async function deleteReceiptGroupFromSheet(){
  if(!rgeEditingKey) return;
  const key=rgeEditingKey;
  closeSheet('receiptGroupEditSheet');
  rgeEditingKey=null; rgeRows=[];
  await deleteReceiptGroup(key);
}

