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

function setRcpMode(mode){
  if(!guardStore()) return;
  rcpMode = mode;
  // 이전 영수증 입력 방식 잔재 방지 (사용자가 photo/manual 선택 시 그때 박힘)
  rcpInputMethod = null;
  if(mode === 'vendor'){
    openRcpVendorPicker();
    return;
  }
  // 직구·수동: vendor 정보 초기화
  rcpVendorId = null; rcpVendorName = ''; rcpCatId = null; rcpCatName = '';
  renderRcpModeBadge();
  if(mode === 'manual'){
    // 수동 입력: 사진 단계 건너뜀 → 모드 배지·가이드만 + 빈 행 1개
    document.getElementById('rcpModeSelect').style.display = 'none';
    document.getElementById('rcpModeBadge').style.display = 'flex';
    document.getElementById('rcpGuideBox').style.display = 'block';
    document.getElementById('uploadGroup').style.display = 'none';
    manualReceipt();
  } else {
    showRcpUploadUI();
  }
}

function resetRcpMode(){
  rcpMode = '';
  rcpVendorId = null; rcpVendorName = ''; rcpCatId = null; rcpCatName = '';
  rcpInputMethod = null;
  document.getElementById('rcpModeSelect').style.display = 'block';
  document.getElementById('rcpModeBadge').style.display = 'none';
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
}

function showRcpUploadUI(){
  document.getElementById('rcpModeSelect').style.display = 'none';
  document.getElementById('rcpModeBadge').style.display = 'flex';
  document.getElementById('rcpGuideBox').style.display = 'block';
  // ⚠️ uploadGroup 은 block (안에 .action-group flex + 수동 입력 button 2단 레이아웃). flex 박으면 깨짐
  document.getElementById('uploadGroup').style.display = 'block';
}

function renderRcpModeBadge(){
  const icon = document.getElementById('rcpModeBadgeIcon');
  const label = document.getElementById('rcpModeBadgeLabel');
  const value = document.getElementById('rcpModeBadgeValue');
  const guide = document.getElementById('rcpGuideBox');
  if(!icon || !label || !value) return;
  if(rcpMode === 'vendor'){
    icon.textContent = '📦';
    label.textContent = '거래처 영수증';
    value.textContent = rcpVendorName;
    if(guide) guide.innerHTML = `🎯 카테고리는 <b>${esc(rcpCatName || '미지정')}</b>로 자동 분류돼요.`;
  } else if(rcpMode === 'direct'){
    icon.textContent = '🛒';
    label.textContent = '직구 영수증';
    value.textContent = '마트·일반';
    if(guide) guide.innerHTML = `🤖 AI가 품목별로 분류해드려요. 한 영수증에 식자재·비품이 섞여도 따로 잡아드려요.`;
  } else if(rcpMode === 'manual'){
    icon.textContent = '✏️';
    label.textContent = '사진 없이 직접 입력';
    value.textContent = '수동 입력';
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
        actionsHtml = `<div class="grp-hdr-actions">
            <button type="button" class="btn btn-secondary" data-action="openReceiptGroupEdit|${editKey}">✏</button>
            <button type="button" class="btn btn-danger" data-action="deleteReceiptGroup|${editKey}">🗑</button>
          </div>`;
      }
      html += `<tr class="grp-hdr${firstGroup?' first':''}">
        <td colspan="5"><div class="grp-hdr-row">
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
    renderRcpModeBadge();
    if(rcpInputMethod === 'manual'){
      const ms = document.getElementById('rcpModeSelect'); if(ms) ms.style.display='none';
      const mb = document.getElementById('rcpModeBadge'); if(mb) mb.style.display='flex';
      const gb = document.getElementById('rcpGuideBox'); if(gb) gb.style.display='block';
      const ug = document.getElementById('uploadGroup'); if(ug) ug.style.display='none';
      manualReceipt();
    } else {
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
  showRcpUploadUI();
}

// 사진 1장 추가 — 멀티페이지 영수증 지원 (2026-05-19 (4))
// 해상도 1600 → 1280 다운사이즈 (Gemini 768px tile 단위라 영향 작음, ~20% 토큰 ↓)
// b64Pages 배열에 append (1장이든 5장이든 동일 흐름)
function handleImg(input) {
  if(!input.files[0]) return;
  rcpInputMethod = 'photo';
  const fr = new FileReader();
  fr.onload = e => {
    const img = new Image();
    img.onload = () => {
      const cvs = document.createElement('canvas');
      let w=img.width,h=img.height; if(w>1280){h*=1280/w;w=1280;}
      cvs.width=w;cvs.height=h;cvs.getContext('2d').drawImage(img,0,0,w,h);
      const dataUrl = cvs.toDataURL('image/jpeg',0.85);
      const b64Part = dataUrl.split(',')[1];
      b64Pages.push(b64Part);
      _renderRcpPages();
      // 미리보기 = 항상 마지막 추가된 사진 (사장님이 방금 찍은 것 확인용)
      document.getElementById('imgPreview').src=dataUrl;
      document.getElementById('imgPreview').style.display='block';
      // uploadGroup 유지 — 사장님이 추가 페이지 더 찍을 수 있음
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
  document.getElementById('actionGroup').style.display='none';
  document.getElementById('uploadGroup').style.display='block';
  _updateRcpActionLabel();
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
function _renderRcpSumCheck(receiptTotalSum, list, pageInfo, photoCount){
  const sumBox = document.getElementById('rcpSumCheck');
  const pageBox = document.getElementById('rcpPageInfoBox');
  const rowSum = (list||[]).reduce((a,r)=>a+(parseInt(r.totalPrice)||0),0);
  const hasReceiptSum = receiptTotalSum!=null && receiptTotalSum>0;
  const pageTotal = (pageInfo && pageInfo.total) ? pageInfo.total : 1;
  const photos = photoCount || 0;
  const pagesMissing = pageInfo && pageInfo.total>1 && photos < pageTotal;
  // 1️⃣ 페이지 감지 박스
  if(pageBox){
    if(pagesMissing){
      const missing = pageTotal - photos;
      pageBox.innerHTML = `⚠️ <b>${pageTotal}페이지 영수증 감지 (${photos}/${pageTotal})</b><br>지금까지 행 <b>${list.length}개</b>, ${fmt(rowSum)}원 분석${hasReceiptSum?` · 영수증 박스 ${fmt(receiptTotalSum)}원`:''}<br><b style="color:#92400E;">→ 남은 ${missing}장 사진 추가하면 완성됩니다</b>`;
      pageBox.style.display='block';
      pageBox.style.background='#FEF3C7';
      pageBox.style.borderColor='#F59E0B';
      pageBox.style.color='#92400E';
    } else if(pageInfo && pageInfo.total>1 && !pagesMissing){
      pageBox.innerHTML = `✅ <b>${pageTotal}/${pageTotal} 페이지 모두 분석 완료</b> · 행 ${list.length}개 · ${fmt(rowSum)}원`;
      pageBox.style.display='block';
      pageBox.style.background='#ECFDF5';
      pageBox.style.borderColor='#10B981';
      pageBox.style.color='#065F46';
    } else {
      pageBox.style.display='none';
    }
  }
  // 2️⃣ 합계 박스
  if(!sumBox) return;
  if(!hasReceiptSum){
    sumBox.innerHTML = `<div style="font-size:11px;color:var(--gray-600);">📊 AI 추출 ${list.length}건 · 합계 <b style="font-variant-numeric:tabular-nums;color:var(--text);">${fmt(rowSum)}원</b><br><span style="color:var(--gray-500);">영수증 원본 합계와 직접 비교하세요</span></div>`;
    sumBox.style.background = '#F3F4F6';
    return;
  }
  const diff = Math.abs(receiptTotalSum - rowSum);
  const diffPct = receiptTotalSum>0 ? (diff/receiptTotalSum*100) : 0;
  const ok = diff <= 10 || diffPct < 0.5;
  if(pagesMissing){
    // 페이지 누락 = 행 합계 < 영수증 박스 정상. ⏳ 대기 표시
    sumBox.innerHTML = `<div style="font-size:11px;color:#92400E;line-height:1.6;">📊 영수증 원본 <b style="font-variant-numeric:tabular-nums;">${fmt(receiptTotalSum)}원</b> · AI 행 합계 <b style="font-variant-numeric:tabular-nums;">${fmt(rowSum)}원</b><br>⏳ ${pageTotal}페이지 중 ${photos}장 분석 — 남은 페이지 추가하면 일치 예정</div>`;
    sumBox.style.background = '#FEF3C7';
  } else if(ok){
    sumBox.innerHTML = `<div style="font-size:11px;color:var(--success);line-height:1.6;">📊 영수증 원본 <b style="font-variant-numeric:tabular-nums;">${fmt(receiptTotalSum)}원</b> · AI 행 합계 <b style="font-variant-numeric:tabular-nums;">${fmt(rowSum)}원</b><br>✅ 일치${diff>0?` (차이 ${fmt(diff)}원, 반올림)`:''}</div>`;
    sumBox.style.background = '#ECFDF5';
  } else {
    sumBox.innerHTML = `<div style="font-size:11px;color:var(--danger);line-height:1.6;">📊 영수증 원본 <b style="font-variant-numeric:tabular-nums;">${fmt(receiptTotalSum)}원</b> · AI 행 합계 <b style="font-variant-numeric:tabular-nums;">${fmt(rowSum)}원</b><br>⚠️ 차이 <b style="font-variant-numeric:tabular-nums;">${fmt(diff)}원</b> (${diffPct.toFixed(1)}%) — 행별 확인 필요</div>`;
    sumBox.style.background = '#FEE2E2';
  }
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
        // 학습된 표시명이 있으면 자동 교체 (2026-05-19 사장님 호소 "위즈복대 → 날치알" 학습)
        if(r.display_item) item.item = r.display_item;
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
    const modeHint = isVendorModeAI
      ? `[모드:거래처] vendor="${rcpVendorName}" 이미 선택. v·c·d 출력 X. 영수증 1장 = 같은 날짜 (date 최상위 1번).
[BOX/EA] q=(BOX×단위)+EA. ⚠️ BOX=0이면 단위 무시, EA가 q.
  · 단위20·BOX1·EA10→q=30
  · 단위8·BOX1·EA0→q=8
  · 단위40·BOX0·EA5→q=5  ← BOX 0
  · 단위12·BOX0·EA5→q=5  ← BOX 0`
      : `[모드:직구] 마트·배민. d 출력 X. vendor 최상위 1번. 영수증 1장 = 같은 날짜·매장.
품목별 c를 [${catList}]에서 선택.`;
    const multiPageHint = pageCount>1
      ? `\n[멀티페이지] 사진 ${pageCount}장 = 같은 영수증의 다른 페이지. 모든 페이지 행을 items에 통합. date·vendor·total_sum은 1번만.`
      : '';
    const prompt=`한국 영수증을 JSON으로만 응답. 설명·주석 X.
${modeHint}${multiPageHint}

[응답]
{${isVendorModeAI ? '' : `
  "vendor": "상호명",`}
  "date": "영수증 발행일 YYYY-MM-DD",
  "items": [ ${isVendorModeAI ? '{i,u,q,p}' : '{i,u,q,p,c}'} 행 배열 ],
  "total_sum": 영수증 박스값(정수,없으면 null) — 우선순위: 금일합계>합계액>결제금액. 전미수·총합계·잔액·누계·채권 무시,
  "page_info": {"current":현재페이지,"total":총페이지수} — 영수증에 "Page (N/M)" 인쇄 시. 없으면 {"current":1,"total":1}
}

[필드]
- i:품목명
- u:단가 (없으면 null)
- q:수량 (없으면 1) ${isVendorModeAI ? '— BOX/EA 정확히 적용. BOX 0 = EA만.' : ''}
- p:영수증 [합계] 컬럼 인쇄값 그대로 정수. u×q 계산 X — 1~2원 차이도 영수증 인쇄 우선 (회계 증빙)${isVendorModeAI ? '' : `
- c:카테고리 [${catList}]`}

[규칙]
- 합계행·소계·부가세·할인전·외상행·용기보증금 = 제외
- 숫자 쉼표·원 제거, 음수·빈배열 X
- 흐릿해도 근접 추정
- 면세(*)/과세 무시 — p만

[예시 — 거래명세서 (BOX/EA 박힘)]
{"date":"2026-04-09","items":[{"i":"위즈복대-날치알 500g","u":9400,"q":30,"p":282000},{"i":"넙적분모자 250g","u":1100,"q":5,"p":5500},{"i":"두부피쉬볼 500g","u":5800,"q":5,"p":29000}],"total_sum":1416049,"page_info":{"current":1,"total":2}}
(넙적분모자 = 단위40·BOX0·EA5 → q=5 / 두부피쉬볼 = 단위12·BOX0·EA5 → q=5. BOX 0이면 EA만)`;
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
        raw = await callGemini(parts, timeoutSec+15, 'receipt_ocr', 'gpt-4o', 'gpt');
        usedFallback = true;
      } else {
        throw geminiErr;
      }
    }
    // 응답 호환: 옛 배열 형식과 새 객체 형식 둘 다 받음
    // 2026-05-19 (4)+ 출력 다이어트: date·vendor 최상위 1번 → 행 fallback
    const itemsRaw = Array.isArray(raw) ? raw : (raw?.items || []);
    const receiptTotalSum = Array.isArray(raw) ? null : (raw?.total_sum || null);
    const pageInfo = (raw && raw.page_info && typeof raw.page_info.total==='number') ? raw.page_info : null;
    const respDate = (!Array.isArray(raw) && raw?.date) ? raw.date : null;
    const respVendor = (!Array.isArray(raw) && raw?.vendor) ? raw.vendor : '';
    const defaultCat = isVendorModeAI ? (rcpCatName || '식자재') : '';
    let list = itemsRaw.map(x => ({
      date: x.d || x.date || respDate || ymdLocal(new Date()),
      vendor: x.v ?? x.vendor ?? respVendor ?? '',
      item: x.i || x.item || '',
      unitPrice: x.u ?? x.unitPrice ?? null,
      qty: x.q ?? x.qty ?? null,
      totalPrice: x.p ?? x.totalPrice ?? 0,
      category: x.c || x.category || defaultCat
    }));
    // DB 규칙으로 카테고리 + display_item 덮어쓰기 (학습된 품목은 AI 판단 무시)
    list=await applyRulesToReceipt(list);
    // 임계값 = max(100원, 0.5%) — 2026-05-19 (4) 사장님 호소: 회계 기준 5% 너무 느슨
    // 1원 차이(반올림) = 자동 통과, 100원 이내·0.5% 이내 = 정상, 그 외 = ⚠️ catch
    // 예: 116,000 vs 115,999 (1원) → 통과 / 282,000 vs 28,200 (253,800원) → catch
    // 2026-05-19 (4)+ 시각화: 의심행을 it._suspect에 박아 표 행 자체에 ⚠️ 표시 (토스트 사라져도 영구)
    const suspectRows = [];
    list.forEach((it,idx)=>{
      const u = parseFloat(it.unitPrice)||0;
      const q = parseFloat(it.qty)||0;
      const p = parseFloat(it.totalPrice)||0;
      if(u>0 && q>0 && p>0){
        const calc = u*q;
        const diff = Math.abs(calc-p);
        const threshold = Math.max(100, Math.max(calc,p) * 0.005);
        if(diff > threshold){
          const calcInt = Math.round(calc);
          suspectRows.push({idx:idx+1, item:it.item, u, q, p, calc:calcInt, diff});
          it._suspect = {calc:calcInt, diff};
        }
      }
    });
    if(suspectRows.length){
      const detail = suspectRows.slice(0,3).map(s=>`${s.idx}행 "${s.item.slice(0,12)}": ${fmt(s.u)}×${s.q}=${fmt(s.calc)} ≠ ${fmt(s.p)} (차이 ${fmt(s.diff)}원)`).join('\n');
      const more = suspectRows.length>3?`\n외 ${suspectRows.length-3}건`:'';
      toast(`⚠️ 단가×수량 ≠ 합계 의심 ${suspectRows.length}건\n${detail}${more}\n저장 전 확인하세요`, 'warn', 8000);
    }
    rowCount=0;
    document.getElementById('resTable').innerHTML=list.map(i=>buildReceiptRow(i)).join('');
    rowCount=list.length;
    // 📊 합계 + 📄 페이지 박스 (pageInfo + photoCount 함께 전달)
    _renderRcpSumCheck(receiptTotalSum, list, pageInfo, pageCount);
    // 거래처 모드 = vendor 컬럼 숨김 + 상단 배지 표시
    const resultArea=document.getElementById('resultArea');
    const isVendor = rcpMode==='vendor' && rcpVendorId;
    resultArea.classList.toggle('vendor-mode', isVendor);
    const vendorBadge=document.getElementById('rcpResultVendorBadge');
    const vendorNameEl=document.getElementById('rcpResultVendorName');
    if(vendorBadge){ vendorBadge.style.display = isVendor ? 'block' : 'none'; }
    if(vendorNameEl && isVendor){ vendorNameEl.textContent = rcpVendorName || '-'; }
    resultArea.style.display='block';
    // 토큰·비용 토스트 + 페이지 통합 + fallback 표시 (2026-05-19 (4))
    if(lastAIUsage){
      const u=lastAIUsage;
      const c=u.costWon;
      const costStr = c<1 ? `약 ${Math.round(c*100)/100}원 (1원 미만)` : (c<10 ? `약 ${c.toFixed(1)}원` : `약 ${fmt(Math.round(c))}원`);
      const thinkLabel = u.thinkingTokens>0 ? ` · thinking ${fmt(u.thinkingTokens)}` : '';
      const modelShort = _shortModelName(u.model);
      const fbMark = usedFallback ? '🔄 GPT-4o 백업 ' : '';
      const pageMark = pageCount>1 ? `, ${pageCount}장 통합` : '';
      toast(`✨ ${fbMark}분석 완료 (${modelShort}, ${(u.durationMs/1000).toFixed(1)}초${pageMark})\n토큰: 입력 ${fmt(u.promptTokens)} · 출력 ${fmt(u.outputTokens)}${thinkLabel}\n💰 ${costStr}`, 'success', 6000);
    }
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
        btn.innerHTML=formatRcpCatLabel(cat);
        btn.classList.toggle('empty',!cat);
      }
      // ✨ 뱃지 동적 갱신 + 페이드인 (사장님 호소: 학습 시그널 명확화)
      const cell=tr.querySelector('.rcp-cat-cell');
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
  const rowStyle = suspect ? ' style="background:#FEF3C7;"' : '';
  const suspectMark = suspect ? `<span title="단가×수량(${fmt(suspect.calc)}) ≠ 합계 — ${fmt(suspect.diff)}원 차이. 수량 확인 필요" style="display:inline-block;margin-left:3px;font-size:13px;cursor:help;vertical-align:middle;">⚠️</span>` : '';
  return `<tr id="row-${idx}"${rowStyle} data-cat="${cat}" data-cat-id="${catId}" data-orig-item="${origItem}">
    <td><button style="width:24px;height:24px;border-radius:50%;border:none;background:var(--danger-light);color:var(--danger);font-weight:800;cursor:pointer;" class="x-btn" data-action="openReasonSheet|${idx}">X</button>${suspectMark}</td>
    <td class="col-vendor"><input type="text" class="c-v" value="${esc(i.vendor||'')}"></td>
    <td><input type="text" class="c-i" value="${esc(i.item||'')}"></td>
    <td><input type="text" class="c-u" inputmode="numeric" value="${i.unitPrice?fmt(i.unitPrice):''}" placeholder="-" data-input="onRcpUnitPriceInput|this|${idx}"></td>
    <td><input type="text" class="c-q" inputmode="decimal" value="${i.qty||''}" placeholder="-" data-input="onRcpQtyInput|this|${idx}"></td>
    <td><input type="text" class="c-p" inputmode="numeric" value="${fmt(i.totalPrice||0)}" data-input="onReceiptAmountInput|this"></td>
    <td class="col-cat"><span class="rcp-cat-cell">${learnBadge}<button type="button" class="c-cBtn${emptyCls}" data-action="openReceiptCatPicker|${idx}">${label}</button></span></td>
    <input type="hidden" class="c-d" value="${i.date||ymdLocal(new Date())}">
  </tr>`;
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
  const digits=String(before).replace(/[^0-9]/g,'');
  const formatted=digits?fmt(parseInt(digits,10)):'';
  if(formatted===before) return;
  inputEl.value=formatted;
  // 커서 위치 보정 (콤마 삽입으로 위치 어긋남)
  const diff=formatted.length-before.length;
  try{ inputEl.setSelectionRange(pos+diff, pos+diff); }catch(e){}
}
function addReceiptRow(){document.getElementById('resultArea').style.display='block';document.getElementById('resTable').insertAdjacentHTML('beforeend',buildReceiptRow({date:ymdLocal(new Date())}));}
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
function selectReason(r){
  const tr=document.getElementById('row-'+currentTargetRowIdx);
  const btn=tr.querySelector('.x-btn');
  if(r==='cancel'){tr.classList.remove('row-off');btn.style.background='var(--danger-light)';btn.style.color='var(--danger)';btn.innerText='X';}
  else{tr.classList.add('row-off');btn.style.background='var(--gray-200)';btn.style.color='var(--gray-600)';btn.innerText='＋';tr.dataset.reason=r;}
  closeAllSheets();
}
async function saveReceipt(){
  if(!guardStore()) return;
  // ─── 새 기능: 거래처 모드면 vendor_id + 카테고리 자동 박힘, 직구 모드면 vendor_id NULL + AI 분류 그대로 ───
  const isVendorMode = rcpMode === 'vendor' && rcpVendorId;
  // 영수증 1장 = 그룹 UUID 1개 (2026-05-19 사장님 호소 "각각 산 것처럼 보임" 해결)
  // 모든 행에 동일 group_id 박음 → 기록내역 그룹 묶음 표시 + 그룹 편집·삭제 가능
  const groupId = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : null;
  const rows=Array.from(document.querySelectorAll('#resTable tr')).map((tr,idx)=>{
    // 거래처 모드: 사용자가 사전 선택한 카테고리 강제 사용 (AI 분류 무시)
    const cat = isVendorMode
      ? (rcpCatName || (tr.dataset.cat||'').trim())
      : (tr.dataset.cat||'').trim();
    // dataset.catId가 비어있으면 picker가 안 거쳐진 케이스 → 재계산. 거래처 모드면 rcpCatId 우선
    const category_id = isVendorMode
      ? (rcpCatId || tr.dataset.catId || resolveReceiptCatId(cat) || null)
      : (tr.dataset.catId ? tr.dataset.catId : (resolveReceiptCatId(cat) || null));
    const amtRaw=(tr.querySelector('.c-p')?.value||'').replace(/[^0-9]/g,'');
    // 거래처 모드면 vendor 텍스트도 거래처명으로 통일 (AI 추출 vendor가 누락이거나 다를 때 보호)
    const vendorText = isVendorMode
      ? (rcpVendorName || tr.querySelector('.c-v').value)
      : (tr.querySelector('.c-v')?.value || '');
    // 단가/수량 추출 (2026-05-19 부활) — 가격 추세 분석 기반
    const unitRaw=(tr.querySelector('.c-u')?.value||'').replace(/[^0-9]/g,'');
    const qtyRaw=parseFloat((tr.querySelector('.c-q')?.value||'').replace(/[^0-9.]/g,''))||null;
    const itemText = tr.querySelector('.c-i')?.value || '';
    // AI 원본 텍스트 보존 (사장님이 수정 시 학습용)
    const origItem = tr.dataset.origItem || itemText;
    return {
      _idx:idx+1, _cat:cat, _origItem: origItem, // 학습용 메타 (DB 저장 X)
      store_id:currentStore.id,receipt_date:tr.querySelector('.c-d').value,
      vendor:vendorText,item:itemText,
      vendor_id: isVendorMode ? rcpVendorId : null,
      unit_price: unitRaw ? parseInt(unitRaw,10) : null,
      qty: qtyRaw,
      total_price:parseInt(amtRaw,10)||0,
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
  // 임시 진단 필드 제거 후 insert (_idx/_cat/_origItem은 DB 컬럼 X → 학습 전 분리)
  const learnMeta = rows.map(r => ({ item: r.item, origItem: r._origItem, category: r.category, note: r.note }));
  const cleaned=rows.map(({_idx,_cat,_origItem,...rest})=>rest);
  setLoad(true,'저장 중...');
  const {error}=await sb.from('receipts').insert(cleaned);
  setLoad(false);
  if(error) return errToast('저장', error);
  // 자동 학습: 품목→(카테고리 + display_item) 규칙 저장 (정상 행만, 매장별)
  // 키워드 = AI 원본 텍스트의 첫 단어 (origItem) — 사장님이 정정해도 다음 OCR 매칭 가능
  // display_item = 사장님이 저장한 정정 텍스트 (item) — 매칭 시 자동 교체
  // 거래처 모드는 학습 스킵 — 카테고리는 거래처 설정대로 자동
  let learnedCount=0;
  if(!isVendorMode){
    learnMeta.filter(m=>m.note==='정상'&&m.item&&m.category).forEach(m=>{
      const parts=String(m.category).split('>').map(s=>s.trim());
      const mainCat=parts[0]||'';
      const subCat=parts[1]||'';
      // 키워드: AI 원본의 첫 단어 (사장님 정정 X 시 = item 첫 단어)
      const kw=normalizeItemKeyword(m.origItem||m.item);
      // display_item: 사장님이 수정한 경우만 박음 (원본과 다를 때)
      const displayItem = (m.origItem && m.origItem !== m.item) ? m.item : null;
      if(mainCat&&kw){ learnClassification(kw,mainCat,subCat,'receipt',false,displayItem).catch(()=>{}); learnedCount++; }
    });
  }
  const successMsg=learnedCount>0?`저장됐어요. ✨ ${learnedCount}건 AI 학습됐어요`:'저장됐어요';
  // 진입 컨텍스트 따라 흐름 분기 (2026-05-19 사장님 결정 A안)
  if(rcpEntryReturn){
    // 거래처(vendors:<id>) 또는 카테고리(catReceipt:<mode>) 진입 = 기존 reload + 자동 복귀
    try{ localStorage.setItem('pd_rcp_return', rcpEntryReturn); }catch(e){}
    // reload 직전 토스트는 사라지므로 localStorage로 전달 → 로그인 후 자동복귀에서 학습 토스트 표시
    try{ if(learnedCount>0) localStorage.setItem('pd_rcp_learned', String(learnedCount)); }catch(e){}
    toast(successMsg,'success');
    location.reload();
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
        <td colspan="6"><div class="grp-hdr-row">
          <div class="grp-hdr-info">
            ${photoBadge?`<span class="emoji">${photoBadge} 🧾</span>`:`<span class="emoji">🧾</span>`}
            <span class="name">${esc(g.vendor||'(거래처 없음)')}</span>
            <span class="sum">· ${fmt(g.total)}원</span>
            ${errBadge}
          </div>
          <div class="grp-hdr-actions">
            <button type="button" class="btn btn-secondary" data-action="openReceiptGroupEdit|${editKey}">✏</button>
            <button type="button" class="btn btn-danger" data-action="deleteReceiptGroup|${editKey}">🗑</button>
          </div>
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
  renderRgeTable();
  openSheet('receiptGroupEditSheet');
}
function renderRgeTable(){
  const tbody=document.getElementById('rgeTable');
  if(!tbody) return;
  let html='';
  rgeRows.forEach((row,idx)=>{
    if(row._deleted) return; // 삭제 표시 행은 렌더 X
    const off=row.note!=='정상';
    const offBtn=off
      ? `<button type="button" class="c-cBtn" style="background:var(--gray-200);color:var(--gray-600);" data-action="toggleRgeRowOff|${idx}">＋</button>`
      : `<button type="button" class="c-cBtn" style="background:var(--danger-light);color:var(--danger);" data-action="toggleRgeRowOff|${idx}">X</button>`;
    const catLabel=row.cat?esc(row.cat):'미분류';
    html+=`<tr${off?' class="row-off"':''}>
      <td>${offBtn}</td>
      <td><input type="text" class="c-i" value="${esc(row.item)}" data-input="setRgeRowField|${idx}|item|this" placeholder="품목"></td>
      <td><input type="text" class="c-u" value="${row.unitPrice?fmt(row.unitPrice):''}" inputmode="numeric" placeholder="-" data-input="setRgeRowUnitPrice|${idx}|this"></td>
      <td><input type="text" class="c-q" value="${row.qty||''}" inputmode="decimal" placeholder="-" data-input="setRgeRowQty|${idx}|this"></td>
      <td><input type="text" class="c-p" value="${fmt(row.amount)}" inputmode="numeric" data-input="setRgeRowAmount|${idx}|this"></td>
      <td><button type="button" class="c-cBtn empty" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;" data-action="openRgeCatPicker|${idx}">${catLabel} ▸</button></td>
    </tr>`;
  });
  tbody.innerHTML=html;
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
    // 해당 행의 금액 input 갱신
    const tbody=document.getElementById('rgeTable');
    if(!tbody) return;
    const trs=Array.from(tbody.querySelectorAll('tr'));
    // 렌더 시 _deleted 제외되므로 인덱스 맞추기 위해 visible 카운트
    let visible=0;
    for(let j=0;j<rgeRows.length;j++){
      if(rgeRows[j]._deleted) continue;
      if(j===i){ const tr=trs[visible]; if(tr){ const pEl=tr.querySelector('.c-p'); if(pEl) pEl.value=fmt(r.amount); } break; }
      visible++;
    }
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
      category:r.cat||null, category_id:r.catId||null, note:r.note
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
      note:r.note, receipt_group_id:groupId
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

