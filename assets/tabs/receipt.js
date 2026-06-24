// ══════════════════════════════════════════
// 영수증
// ══════════════════════════════════════════

// ─── 새 기능: 영수증 진입 분기 (거래처/직구) ───
// 거래처 모드: 사용자가 거래처 선택 → vendors.category_id 자동 박힘 → AI는 양식·카테고리 알고 시작 (글자 추출만)
// 직구 모드: 사용자 분기만, 카테고리는 AI가 품목별 분류 (현재 흐름)
let rcpMode = '';        // 'vendor' | 'online' | 'direct' | 'etc' | 'manual' | ''
let rcpVendorId = null;  // 거래처 모드일 때 vendor id
let rcpVendorName = '';  // 거래처 표시명
let rcpVendorKind = '';  // 거래처 종류 'vendor' | 'online' (온라인주문 프롬프트 분기용)
let rcpCatId = null;     // 거래처 자동 박힌 category_id
let rcpCatName = '';     // 거래처 자동 박힌 category 텍스트
let rcpInputMethod = null; // 'photo' | 'manual' — 영수증 단위 입력 방식 (📸/✏️ 이모지 표시용)
let rcpEntryReturn = null; // 영수증 저장 후 자동 복귀할 화면 ('catReceipt:direct'|'catReceipt:etc'|'vendors:<id>')
let rcpPastItems = [];       // 현재 거래처 과거 품목명 — 품목명 칸 자동완성(원터치 수정)용. 프롬프트엔 안 넣음(환각 방지, 2026-06-05)
let rcpPastPriceMap = new Map(); // 단가 → Set<품목명> (단가 매칭 자동채움용, 2026-06-05)
let rcpPastUnitByName = new Map(); // 품목명 → 최근 단가 (수기입력 단가 자동채움용, 2026-06-22)
let rcpPastSheetTargetIdx = null; // 과거 품목 시트 열 때 대상 행 인덱스
let _rcpKeepOnEnter = false; // true면 이번 nav('receipt')는 거래처/카테고리 세팅 진입 = 초기화 스킵 (2026-06-18)

function setRcpMode(mode, autoPicker=true){
  if(!guardStore()) return;
  rcpMode = mode;
  rcpInputMethod = null;
  _clearRcpData(); // 새 진입 = 이전 분석(사진·결과·행) 비우기 (사장님 호소 2026-06-02)
  // 모드 바꿀 때 vendor 정보 초기화 (거래처는 행에서 다시 선택)
  rcpVendorId = null; rcpVendorName = ''; rcpVendorKind = ''; rcpCatId = null; rcpCatName = '';
  document.getElementById('rcpModeSelect').style.display = 'none';
  const modeTtl = document.getElementById('rcpModeTitle'); if(modeTtl) modeTtl.style.display = 'block';
  document.getElementById('rcpModeBadge').style.display = 'flex';
  renderRcpModeBadge();
  const vTtl = document.getElementById('rcpVendorRowTitle');
  const vRow = document.getElementById('rcpVendorRow');
  // 거래처/온라인/마트 = 선택 행 표시(미선택). 사진은 고른 뒤 활성화
  //  · vendor: 거래처 선택 / online: 플랫폼(쿠팡·네이버) 선택 / direct: 마트 선택(이름 고정용 — 2026-06-12)
  if(mode === 'vendor' || mode === 'online' || mode === 'direct'){
    if(vTtl){ vTtl.style.display = 'block'; vTtl.textContent = mode === 'direct' ? '마트' : (mode === 'online' ? '온라인 플랫폼' : '거래처'); }
    if(vRow) vRow.style.display = 'flex';
    renderRcpVendorRow(false);
    document.getElementById('rcpGuideBox').style.display = 'none';
    _setRcpUploadEnabled(false);
    if(autoPicker) setTimeout(() => openRcpVendorPicker(), 80); // 종류 선택 즉시 → 선택창 자동 열기 (직접입력 진입 시엔 autoPicker=false로 안 열기)
  } else {
    // 그 외(수동 등): 선택 행 없이 바로 사진
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
  const isOnline = rcpMode === 'online';
  const isMart = rcpMode === 'direct';
  const selIcon = isMart ? '🛒' : (isOnline ? '🌐' : '🏪');
  if(selected && rcpVendorName){
    if(icon) icon.textContent = selIcon;
    val.textContent = rcpVendorName;
    val.style.color = 'var(--toss-text-1)';
    if(sub){ sub.textContent = 'AI가 품목별 자동 분류'; sub.style.display = 'block'; }
    if(arrow) arrow.textContent = '바꾸기 ›';
  } else {
    if(icon) icon.textContent = isMart ? '🛒' : (isOnline ? '🌐' : '🏠');
    val.textContent = isMart ? '마트를 선택하세요 (농협·탑마트 등)' : (isOnline ? '플랫폼을 선택하세요 (쿠팡·네이버 등)' : '거래처를 선택하세요');
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
  // 거래처·날짜 입력칸도 비우기 — 모드 전환 시 이전 거래처명 잔류 방지 (사장님 호소 2026-06-16: 기타지출에 이전 거래처 남음)
  //   AI 분석은 이 함수 호출 뒤에 거래처/날짜를 다시 채우므로 분석 흐름엔 영향 없음
  const rv = document.getElementById('rcpReceiptVendor'); if(rv) rv.value = '';
  const rd = document.getElementById('rcpReceiptDate'); if(rd) rd.value = '';
}

// 영수증 탭 재진입 시 초기화 — 분석·결과 봤다가 나갔다 다시 오면 깨끗한 시작(종류 선택부터).
//   단, 거래처/카테고리 카드에서 진입(nav 직전 거래처·모드 세팅)은 _rcpKeepOnEnter=true라 보존.
//   그 외(하단 네비·"+영수증 추가" 등 새 진입)는 이전 분석 잔재까지 무조건 청소.
//   (옛 idle 조건은 이전 분석 잔재 rcpVendorId/b64Pages를 "작업 중"으로 오인해 잔류 — 사장님 2026-06-18 "초기화 넣었다며 왜 살아있냐")
function _rcpOnTabEnter(){
  if(_rcpKeepOnEnter){ _rcpKeepOnEnter = false; return; } // 거래처/카테고리 세팅 진입 = 보존
  _clearRcpData();   // 사진·결과 행·미리보기 비우기
  resetRcpMode();    // 모드·거래처·날짜 비우고 종류 선택 화면으로
}

function resetRcpMode(){
  rcpMode = '';
  rcpVendorId = null; rcpVendorName = ''; rcpVendorKind = ''; rcpCatId = null; rcpCatName = '';
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
    if(guide) guide.innerHTML = rcpVendorName
      ? `🤖 AI가 품목별로 분류해드려요. 한 거래처라도 식자재·비품 섞이면 따로 잡아드려요.`
      : `🏠 거래처를 먼저 골라주세요.`;
  } else if(rcpMode === 'online'){
    icon.textContent = '🌐';
    value.textContent = '온라인 영수증';
    label.textContent = '쿠팡 · 네이버 · 옥션 등';
    if(guide) guide.innerHTML = `🤖 쿠팡·네이버 주문 화면을 찍으면 상호를 플랫폼(쿠팡 등)으로, 품목별로 분류해드려요. 카드·통장 내역의 "쿠팡"과 자동으로 묶여요.`;
  } else if(rcpMode === 'direct'){
    icon.textContent = '🛒';
    value.textContent = '마트·시장 영수증';
    label.textContent = '마트 · 시장 · 동네가게';
    if(guide) guide.innerHTML = rcpVendorName
      ? `🤖 AI가 품목별로 분류해드려요. 한 영수증에 식자재·비품이 섞여도 따로 잡아드려요.`
      : `🛒 어느 마트인지 먼저 골라주세요. (농협·탑마트 등)`;
  } else if(rcpMode === 'etc'){
    icon.textContent = '🧾';
    value.textContent = '기타 지출';
    label.textContent = '직원 식대·경조사·일회성';
    if(guide) guide.innerHTML = `🤖 거래처 없이 바로 기록해요. 직원 식대·경조사 같은 일회성 지출을 사진 찍거나 직접 입력하고 분류만 골라주세요.`;
  } else if(rcpMode === 'manual'){
    icon.textContent = '✏️';
    value.textContent = '수동 입력';
    label.textContent = '사진 없이 직접';
    if(guide) guide.innerHTML = `💡 거래처·품목·금액·분류 모두 직접 입력해주세요. 다음에 같은 거 또 사면 학습돼서 빨라져요.`;
  }
}

// ─── 거래처 과거 품목+단가 로드 (사진 분석·수기입력 공통, 2026-06-22) ───
//   품목명 자동완성(📋 검색) + 단가 매칭 + 단가 자동채움용. 오답·삭제 행 제외(단가 지도 오염 방지). 프롬프트엔 안 넣음(환각 방지).
async function loadRcpPastItems(){
  rcpPastItems = [];
  rcpPastPriceMap = new Map();
  rcpPastUnitByName = new Map();
  if(!(rcpMode === 'vendor' && rcpVendorId)) return; // 거래처 모드만 (마트·온라인·기타는 과거 품목 매칭 X)
  const {data:pData} = await sb.from('receipts')
    .select('item, unit_price')
    .eq('store_id', currentStore.id)
    .eq('vendor_id', rcpVendorId)
    .not('item','is',null)
    .or('note.is.null,note.eq.정상') // 오답·삭제 표시 행 제외
    .order('created_at',{ascending:false})
    .limit(300);
  if(!(pData && pData.length)) return;
  const seen = new Set();
  pData.forEach(r => {
    const nm = (r.item||'').trim();
    if(!nm) return;
    seen.add(nm);
    const p = parseInt(r.unit_price)||0;
    if(p > 0){
      if(!rcpPastPriceMap.has(p)) rcpPastPriceMap.set(p, new Set());
      rcpPastPriceMap.get(p).add(nm);
      if(!rcpPastUnitByName.has(nm)) rcpPastUnitByName.set(nm, p); // created_at desc → 첫 등장 = 최근 단가
    }
  });
  rcpPastItems = [...seen].slice(0,120);
}
// ─── 새 기능: 수동 입력 (사진 없이 빈 행 1개로 시작) ───
async function manualReceipt(){
  if(!rcpMode) return toast('먼저 거래처 또는 마트·시장을 골라주세요','warn');
  rcpInputMethod = 'manual';
  await loadRcpPastItems(); // 수기입력도 과거 품목 후보·단가 자동채움 받게 (2026-06-22) — 빈행 만들기 전에 로드
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
    category: initCategory,
    _manual: true // 수동 입력 행 = "부가세 포함" 토글 보이게 (2026-06-22)
  });
  _setRcpVendorField(); // 거래처 칸 = 고른 거래처 고정 표시 (2026-06-22)
}

// ─── 새 기능: 거래처 칸 모드별 처리 (2026-06-22) ───
// 거래처/온라인/마트를 골랐으면 그 이름을 고정 표시(읽기전용) — 사장님 "선택한 게 곧 거래처".
// 안 골랐으면(특수) 직접 입력 가능. 저장 기준은 원래도 rcpVendorName 우선(saveReceipt 1936)이라 데이터 불변.
function _setRcpVendorField(aiVendor){
  const el = document.getElementById('rcpReceiptVendor');
  if(!el) return;
  const picked = (rcpMode==='vendor' || rcpMode==='online' || rcpMode==='direct') && rcpVendorName;
  if(picked){
    el.value = rcpVendorName;      // 고른 거래처 = 진실 (못 고침, 위 '바꾸기'로만 변경)
    el.readOnly = true;
    el.classList.add('rcp-vendor-fixed');
  } else {
    el.readOnly = false;
    el.classList.remove('rcp-vendor-fixed');
    if(aiVendor != null) el.value = aiVendor; // 거래처 미정일 때만 AI가 읽은 값 채움
  }
}

// XSS 방지 헬퍼 (가이드 박스용)
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ─── 새 기능: 카테고리별 영수증 목록 (직구·식자재·비품·기타 진입 공통) ───
let catReceiptMode = null;   // 'direct' | 'food' | 'supplies' | 'etc'
let catReceiptMonth = (new Date()).toISOString().slice(0,7);
let catReceiptFilter = 'all'; // 'all' | 'direct' | 'vendor:<id>'
let catReceiptRowsCache = []; // 거래처별 합계 계산용
let catReceiptSubFilter = 'all'; // 소분류 필터: 'all' | <소분류 id> | '__none__'(미분류=상위로만 달림)
let catReceiptParentId = null;   // 현재 진입한 상위 카테고리 id (cat: 모드에서만)

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
  catReceiptSubFilter = 'all';
  nav('catReceipt');
  const mEl = document.getElementById('catReceiptMonth');
  if(mEl && !mEl.value) mEl.value = catReceiptMonth;
  // 직구 모드일 때만 영수증 등록 버튼 표시 (카테고리 모드는 조회 전용)
  const addBtns = document.getElementById('catRcpAddBtns');
  if(addBtns) addBtns.style.display = (mode === 'direct') ? 'flex' : 'none';
}

// ─── 새 기능: 지출 기록 통합 진입 (홈 "어디에 썼나" 거래처 클릭 — 2026-06-11) ───
// 화면은 catReceipt 하나만 쓰고, 진입에 따라 거래처 칩 필터만 바꿈 (행형 통일 디자인)
// vendorNameEnc = encodeURIComponent된 거래처명 (없으면 전체)
function openExpenseRecords(vendorNameEnc){
  if(!guardStore()) return;
  if(typeof closeAllSheets==='function') closeAllSheets();
  catReceiptMode = 'all';
  const name = vendorNameEnc ? decodeURIComponent(String(vendorNameEnc)) : '';
  catReceiptFilter = name ? ('v:'+encodeURIComponent(name)) : 'all';
  // 홈에서 보던 달 그대로 (날짜 필터는 거래처 필터와 별개로 동작)
  if(typeof dashMonthStr==='string' && dashMonthStr) catReceiptMonth = dashMonthStr;
  const mEl = document.getElementById('catReceiptMonth');
  if(mEl) mEl.value = catReceiptMonth;
  const addBtns = document.getElementById('catRcpAddBtns');
  if(addBtns) addBtns.style.display = 'none';
  nav('catReceipt'); // nav가 loadCatReceiptData 자동 호출
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
        <button class="btn btn-primary btn-sm" style="margin-top:16px;padding:8px 16px;" data-action="nav|expHub">지출관리로 ›</button>
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
  // 헤더 (모드 = 'direct' / 'all' / 'cat:<id>')
  let title = '', iconEmoji = '🛒';
  let catParent = null;
  if(catReceiptMode === 'direct'){
    title = '마트·시장'; iconEmoji = '🛒';
  } else if(catReceiptMode === 'all'){
    // 2026-06-11 신설: 전체 지출 기록 (홈 "어디에 썼나" 거래처 클릭 진입 — 카테고리 제한 없음)
    title = '지출 기록'; iconEmoji = '🧾';
  } else if(catReceiptMode.startsWith('cat:')){
    const cid = catReceiptMode.split(':')[1];
    catParent = (expCategories||[]).find(c=>c.id===cid);
    title = catParent?.name || '카테고리';
    // 카테고리 이름별 이모지 매핑 (없으면 폴더)
    const iconEmojiMap = {'식자재':'🥬','비품':'📦','기타':'📂','주류':'🍶','음료':'🥤','마케팅':'📢','세금':'💰','인건비':'⏰','고정비':'📅','공과금/고정비':'📅'};
    iconEmoji = iconEmojiMap[title] || '📂';
  }
  // 소분류 필터 기준 상위 카테고리 (cat: 모드에서만 소분류 칩 노출)
  catReceiptParentId = (catParent && catReceiptMode && catReceiptMode.startsWith('cat:')) ? catParent.id : null;
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
    .select('id,receipt_date,vendor,vendor_id,item,total_price,category,category_id,input_method,note,receipt_group_id,unit_price,qty,seq,spec,origin')
    .eq('store_id', currentStore.id)
    .gte('receipt_date', start).lte('receipt_date', end)
    .order('receipt_date', {ascending:false});
  let oq = null;
  let catIdSet = null; // 카테고리 모드일 때 vendor_orders 메모리 필터용 (식자재 + 자식 ids)
  if(catReceiptMode === 'direct'){
    // 마트·시장 모드: 직접구매(vendor_id NULL) + 마트(kind='mart') 영수증 둘 다 (2026-06-16 버그수정)
    //   옛: vendor_id IS NULL만 조회 → 마트 통일 작업으로 vendor_id 박힌 마트 영수증이 빠짐
    const {data:_martV} = await sb.from('vendors')
      .select('id').eq('store_id', currentStore.id).eq('kind','mart');
    const _martIds = (_martV||[]).map(v=>v.id);
    if(_martIds.length){
      rq = rq.or(`vendor_id.is.null,vendor_id.in.(${_martIds.join(',')})`);
    } else {
      rq = rq.is('vendor_id', null);
    }
    // vendor_orders 조회 안 함
  } else if(catReceiptMode === 'all'){
    // 'all' 모드: 영수증 전체 + 거래처 주문 전체 (변동 지출 — 고정비·인건비 제외)
    // mydata(통장·카드)는 세금 등 고정성 포함이라 제외 (홈 "어디에 썼나" isVar 기준과 일관)
    oq = sb.from('vendor_orders')
      .select('id,order_date,vendor_id,item,amount,unit_price,quantity,memo,order_group_id,vendors(name,category)')
      .eq('store_id', currentStore.id)
      .gte('order_date', start).lte('order_date', end)
      .order('order_date', {ascending:false});
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
  // 'all' 모드는 카테고리 제한 없음 → 주문 전체 그대로 (2026-06-11)
  const normReceipts = (rRes.data||[]).map(r=>_normalizeExpenseRow(r,'receipt'));
  const normOrders = catIdSet
    ? (oRes.data||[]).filter(r=>r.vendors && catIdSet.has(r.vendors.category_id)).map(r=>_normalizeExpenseRow(r,'order'))
    : (catReceiptMode==='all' ? (oRes.data||[]).map(r=>_normalizeExpenseRow(r,'order')) : []);
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

function pickCatReceiptChip(val){
  catReceiptFilter=String(val);
  renderCatReceiptList(catReceiptRowsCache);
}

// ─── 새 기능: 소분류 필터 (식자재 진입 시 공산품·야채·육류·미분류) — 2026-06-22 ───
// 행의 카테고리 id (영수증/거래처주문/통장)
function _rowCatId(r){
  if(!r) return null;
  if(r._source==='order') return (r._origin && r._origin.vendors && r._origin.vendors.category_id) || null;
  return (r._origin && r._origin.category_id) || null; // receipt / mydata
}
// 현재 상위(catReceiptParentId) 기준 소분류 키. 상위로만 달림/미지정 = '__none__'(미분류)
function _subCatKeyOf(r){
  if(!catReceiptParentId) return null;
  const cid = _rowCatId(r);
  if(!cid || cid===catReceiptParentId) return '__none__';
  const c = (expCategories||[]).find(x=>x.id===cid);
  // DB에 "미분류" 하위분류가 따로 있어도 = 분류 안 된 것(__none__)과 동일 취급 (시트에 미분류 2줄 방지)
  if(c && c.parent_id===catReceiptParentId) return c.name==='미분류' ? '__none__' : cid;
  return '__none__';
}
// 소분류 금액 집계 (만원) — 드롭다운/시트 공용
function _catRcpSubAmounts(rows){
  const amt={}; let noneAmt=0, allAmt=0;
  (rows||[]).forEach(r=>{
    if(r.note!=='정상') return;
    const a=r.amount||0; allAmt+=a;
    const k=_subCatKeyOf(r);
    if(k==='__none__') noneAmt+=a; else amt[k]=(amt[k]||0)+a;
  });
  return {amt, noneAmt, allAmt};
}
function _catRcpSubLabel(){
  if(catReceiptSubFilter==='__none__') return '미분류';
  if(catReceiptSubFilter==='all') return '전체';
  const c=(expCategories||[]).find(x=>x.id===catReceiptSubFilter);
  return c ? c.name : '전체';
}
// 소분류 필터 = 접힌 드롭다운 1개 (사장님: 칩 다 펼치지 말 것). 탭하면 시트로 펼침
function _renderCatRcpSubChips(rows){
  const el = document.getElementById('catReceiptSubChips');
  if(!el) return;
  const children = catReceiptParentId
    ? (expCategories||[]).filter(c=>c.parent_id===catReceiptParentId && c.is_active!==false && c.name!=='미분류')
    : [];
  if(!children.length){ el.innerHTML=''; return; }
  const active = catReceiptSubFilter!=='all';
  el.innerHTML = `<button type="button" class="rcl-filterbtn${active?' on':''}" data-action="openCatReceiptSubSheet">`
    +`<span class="rfb-ic">🏷️</span><span class="rfb-tx">분류: ${esc(_catRcpSubLabel())}</span><span class="rfb-cv">▾</span></button>`;
}
// 소분류 선택 시트 (전체 / 소분류들 / 미분류 + 각 금액)
function openCatReceiptSubSheet(){
  const list = document.getElementById('catReceiptSubList');
  if(!list) return;
  const children = catReceiptParentId
    ? (expCategories||[]).filter(c=>c.parent_id===catReceiptParentId && c.is_active!==false && c.name!=='미분류')
    : [];
  const {amt, noneAmt, allAmt} = _catRcpSubAmounts(catReceiptRowsCache||[]);
  const _man=n=>{ const v=Math.round((n||0)/10000); return v>=1?(fmt(v)+'만'):(n>0?'<1만':'0'); };
  const mkRow=(val,label,sub,checked)=>`<button type="button" class="rcl-fsheet-row${checked?' active':''}" data-action="pickCatReceiptSub|${val}"><span class="rfs-nm">${label}</span><span class="rfs-sub">${sub}</span></button>`;
  let html=mkRow('all','전체',_man(allAmt),catReceiptSubFilter==='all');
  children.forEach(c=>{ html+=mkRow(c.id, esc(c.name), _man(amt[c.id]||0), catReceiptSubFilter===c.id); });
  html+=mkRow('__none__','미분류',_man(noneAmt),catReceiptSubFilter==='__none__');
  list.innerHTML=html;
  openSheet('catReceiptSubSheet');
}
function pickCatReceiptSub(val){
  catReceiptSubFilter = val || 'all';
  closeSheet('catReceiptSubSheet');
  renderCatReceiptList(catReceiptRowsCache);
}

function renderCatReceiptList(rows){
  // 2026-06-11 행형 갈아엎기: 표(grp-tbl) → 행형 2줄 구조 (_rclListHtml 공통 렌더 — 영수증 기록 내역과 동일 컴포넌트)
  //  · rows = _normalizeExpenseRow 정규화 행 배열 ({_source, id, date, vendor, vendor_id, item, unit, qty, amount, group_id, ...})
  //  · 거래처 필터 = 상단 칩(rcl-chips, 데이터에서 동적 생성). 옛 거래방법 시트 값(direct/vendor:/shop:)도 호환 (_rclApplyFilter)
  //  · 카드 헤더·행 클릭 동작 기존 유지: receipt=openReceiptGroupEdit·openReceiptEdit / order=openEditOrderSheet / mydata=openTxEditSheet
  // rcpRecords는 loadCatReceiptData에서 receipts 원본만 박았음 (openReceiptEdit 호환)
  const body = document.getElementById('catReceiptBody');
  const totalEl = document.getElementById('catReceiptTotal');
  const chipsEl = document.getElementById('catReceiptChips');
  if(chipsEl) chipsEl.innerHTML = _rclFilterBtnHtml(catReceiptFilter, 'cat');
  _renderCatRcpSubChips(rows||[]);
  let _subRows = rows||[];
  if(catReceiptParentId && catReceiptSubFilter && catReceiptSubFilter!=='all'){
    _subRows = _subRows.filter(r=>_subCatKeyOf(r)===catReceiptSubFilter);
  }
  const filtered = _rclApplyFilter(_subRows, catReceiptFilter);
  // 'all' 모드(홈 "어디에 썼나" 진입) = 영수증+거래처주문 변동 지출만이라 라벨에 명시
  const scopeTag = (catReceiptMode==='all') ? ' · 고정비·인건비 제외' : '';
  if(!filtered.length){
    body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--gray-500);font-size:13px;line-height:1.6;">조건에 맞는 내역이 없어요.<br>필터를 [전체]로 바꿔보세요.</div>';
    totalEl.textContent = '이번달 0원 · 0건' + scopeTag;
    return;
  }
  const total = filtered.reduce((s,r)=>s+(r.note==='정상'?(r.amount||0):0),0);
  totalEl.textContent = `이번달 ${fmt(total)}원 · ${filtered.length}건${scopeTag}`;
  body.innerHTML = _rclListHtml(filtered);
}

// 거래처 영수증 등록 진입 (거래처 카드 미니 📸 / 거래처 상세 헤더 버튼 둘 다 처리)
async function openRcpReceiptFromVendor(vendorId, method){
  if(!guardStore()) return;
  // vendor-card 미니 진입 = vendorId 직접 전달 / 거래처 상세 헤더 = '' → currentVendorDetailId fallback
  const vid = (vendorId && vendorId !== '') ? vendorId : (typeof currentVendorDetailId !== 'undefined' ? currentVendorDetailId : null);
  if(!vid){ toast('거래처 정보를 찾을 수 없어요','error'); return; }
  const {data, error} = await sb.from('vendors').select('id,name,category,category_id,kind').eq('id', vid).eq('store_id', currentStore.id).maybeSingle();
  if(error || !data){ toast('거래처 정보를 못 가져왔어요','error'); return; }
  // setRcpMode는 picker를 자동으로 열어 우회 — 모드·카테고리 직접 박기
  // 주류 거래처 자동 인식 — 카테고리에 "주류" 포함이면 liquor 모드 (음료 겸업 등 변수 대응)
  const _isLiquorVendor = (data.category || '').includes('주류');
  rcpVendorKind = _isLiquorVendor ? 'liquor' : (data.kind || 'vendor');
  rcpMode = (rcpVendorKind === 'online') ? 'online' : 'vendor';
  rcpVendorId = data.id;
  rcpVendorName = data.name || '';
  // 온라인·주류 = AI 품목별 자율 분류 (카테고리 고정 X)
  if(rcpVendorKind === 'online'){
    rcpCatId = null; rcpCatName = '';
  } else if(rcpVendorKind === 'liquor'){
    // 주류는 카테고리 기본값 "주류"로 박음 (AI 분류 대부분 주류이므로 — 품목별 override 허용)
    rcpCatId = data.category_id || null;
    rcpCatName = data.category || '';
  } else {
    rcpCatId = data.category_id || null;
    rcpCatName = data.category || '';
  }
  rcpInputMethod = (method === 'manual') ? 'manual' : 'photo';
  rcpEntryReturn = 'vendors:' + vid; // 저장 후 거래처 상세로 복귀
  _rcpKeepOnEnter = true; // 거래처 세팅 후 진입 — 재진입 초기화 스킵
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
  _rcpKeepOnEnter = true; // 수동 모드 세팅 진입 — 재진입 초기화 스킵
  nav('receipt');
  setTimeout(()=>setRcpMode('manual'), 60);
}

// 카테고리 화면에서 [📸 영수증 사진] 또는 [✏️ 수동 입력] 버튼 → 영수증 탭으로 이동
function openCatReceiptInput(method){
  // 모드 = 직구·기타 카드에서 진입 → 모두 직구 모드 (vendor_id NULL). 기타는 카테고리 선택 별도.
  // 기타 카드에서 진입한 경우 = 사장님이 카테고리 picker에서 "기타" 선택해야 [기타] 카드에 합산됨.
  // 진입 즉시 모드를 'direct'로 박고, 기타 카드면 안내.
  rcpEntryReturn = 'catReceipt:' + catReceiptMode; // 저장 후 복귀
  _rcpKeepOnEnter = true; // 카테고리 세팅 후 진입 — 재진입 초기화 스킵
  nav('receipt');
  setTimeout(()=>{
    // 기타 카드 진입 = 'etc' 모드(거래처 없음), 직구·식자재 = 'direct'. 직접입력이면 거래처 선택창 자동오픈 X (사장님 호소 2026-06-16)
    const _mode = catReceiptMode === 'etc' ? 'etc' : 'direct';
    setRcpMode(_mode, method !== 'manual');
    if(method === 'manual'){
      // 모드 선택 화면 → uploadGroup 노출. manualReceipt 호출하여 빈 행 진입.
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
  // 모드별 종류: online=플랫폼 / direct=마트 / 그 외=거래처 (2026-06-12 마트 추가)
  const pickKind = rcpMode === 'online' ? 'online' : (rcpMode === 'direct' ? 'mart' : 'vendor');
  const kindLabel = pickKind === 'online' ? '온라인 플랫폼' : (pickKind === 'mart' ? '마트' : '거래처');
  const {data, error} = await sb.from('vendors')
    .select('id,name,category,category_id,kind')
    .eq('store_id', currentStore.id)
    .eq('is_active', true)
    .order('name');
  if(error){
    list.innerHTML = '<div style="text-align:center;padding:24px;color:#EF4444;font-size:13px;">불러오기 실패</div>';
    return;
  }
  let filtered = (data||[]).filter(v => (v.kind||'vendor') === pickKind);
  // 마트 = 자주 쓴 순 정렬 (일회성은 아래로 밀려 자연히 사라짐 — 사장님 결정 2026-06-12)
  if(pickKind === 'mart' && filtered.length){
    const {data:rc} = await sb.from('receipts').select('vendor_id')
      .eq('store_id', currentStore.id).not('vendor_id','is',null);
    const useCnt = {};
    (rc||[]).forEach(r=>{ useCnt[r.vendor_id]=(useCnt[r.vendor_id]||0)+1; });
    filtered = [...filtered].sort((a,b)=>(useCnt[b.id]||0)-(useCnt[a.id]||0) || a.name.localeCompare(b.name));
  }
  // 즉석 추가 버튼 (마트는 이름만 받는 간편 추가, 거래처·온라인은 정식 시트)
  const addBtn = pickKind === 'mart'
    ? `<button type="button" class="btn btn-secondary" style="width:100%;margin-top:8px;color:var(--toss-blue);font-weight:700;" data-action="addMartInline">➕ 새 마트 추가</button>`
    : `<button type="button" class="btn btn-secondary" style="width:100%;margin-top:8px;color:var(--toss-blue);font-weight:700;" data-action="openAddVendorSheet|${pickKind}">➕ ${kindLabel} 추가</button>`;
  if(!filtered.length){
    const guide = pickKind === 'online'
      ? '등록된 온라인 플랫폼이 없어요.<br>아래 ➕ 버튼으로 쿠팡·네이버 등을 추가해주세요.'
      : (pickKind === 'mart'
        ? '등록된 마트가 없어요.<br>아래 ➕ 버튼으로 농협·탑마트 등을 추가해주세요.'
        : '등록된 거래처가 없어요.<br>사이드 메뉴 → 거래처 관리에서 먼저 등록해주세요.');
    list.innerHTML = `<div style="text-align:center;padding:24px 16px;color:var(--gray-500);font-size:13px;line-height:1.6;">${guide}</div>${addBtn}`;
    return;
  }
  const esc = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  list.innerHTML = filtered.map(v => `
    <button type="button" class="btn btn-secondary" style="text-align:left;padding:14px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;" data-action="pickRcpVendor|${v.id}">
      <span style="font-size:14px;font-weight:700;">${esc(v.name)}</span>
      <span style="font-size:11px;color:var(--gray-500);">${pickKind==='online'?'온라인':(pickKind==='mart'?'마트':esc(v.category || '카테고리 미지정'))}</span>
    </button>
  `).join('') + addBtn;
}

// ─── 새 마트 즉석 추가 (이름만) — 영수증 picker에서 호출 (2026-06-12) ───
async function addMartInline(){
  if(!currentStore) return;
  const name = (prompt('마트 이름을 입력하세요\n(예: 논산농협 하나로마트, 광성탑마트)')||'').trim();
  if(!name) return;
  setLoad(true,'마트 추가 중...');
  // 같은 이름 마트 이미 있으면 그걸 선택 (중복 방지)
  const {data:exist} = await sb.from('vendors').select('id').eq('store_id',currentStore.id).eq('kind','mart').eq('name',name).maybeSingle();
  let martId = exist?.id;
  if(!martId){
    const {data:ins, error} = await sb.from('vendors')
      .insert({store_id:currentStore.id, name, kind:'mart', is_active:true})
      .select('id').single();
    if(error){ setLoad(false); return toast('마트 추가 실패','error'); }
    martId = ins.id;
    if(typeof loadVendors === 'function') await loadVendors(); // 전역 vendors 캐시 갱신
  }
  setLoad(false);
  pickRcpVendor(martId);
}

async function pickRcpVendor(vendorId){
  if(!currentStore) return;
  const {data, error} = await sb.from('vendors').select('id,name,category,category_id,kind').eq('id', vendorId).eq('store_id', currentStore.id).maybeSingle();
  if(error || !data) return toast('거래처 정보를 못 가져왔어요', 'error');
  rcpVendorId = data.id;
  rcpVendorName = data.name || '';
  // 주류 거래처 자동 인식 — 분류에 "주류" 포함이면 liquor 모드 (openRcpReceiptFromVendor와 동일 로직 — 진입로 일관성 버그 수정 2026-06-16)
  //   영수증 탭 거래처 목록으로 진입 시 분류를 무시하고 kind만 봐서 주류 프롬프트(빈용기보증금 추출)를 안 타던 버그.
  const _isLiquorVendor = (data.category || '').includes('주류');
  rcpVendorKind = _isLiquorVendor ? 'liquor' : (data.kind || 'vendor');
  // 온라인·마트는 취급품목 없이 자율 분류 → 카테고리 고정 안 함 (마트 2026-06-12)
  if(rcpVendorKind === 'online' || rcpVendorKind === 'mart'){
    rcpCatId = null; rcpCatName = '';
  } else {
    rcpCatId = data.category_id || null;
    rcpCatName = data.category || '';
  }
  closeSheet('rcpVendorPickSheet');
  renderRcpModeBadge();
  renderRcpVendorRow(true);   // 선택 행에 이름 표시
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
// 인쇄된 영수증 합계·세액 보관 — 품목 수정 시 합계 카드 실시간 재계산용 (2026-06-23)
let _rcpPrinted = { sum:0, tax:0, pagesMissing:false, pageLabel:'' };
// 합계 카드 그리기 (합계 + 영수증일치 + 공급가/부가세 + 대조경고) — 최초 분석·수정 공통 함수
function _rcpSumCardRender(rowSum, rowTax, cnt){
  const sumBox = document.getElementById('rcpSumCheck');
  if(!sumBox) return;
  const rowSupply = rowSum - rowTax;
  const printedSum = _rcpPrinted.sum;
  let cls = 'rcp-sumcard', okLine = `${cnt}개 품목`;
  if(printedSum > 0){
    const diff = Math.abs(printedSum - rowSum);
    const diffPct = printedSum>0 ? (diff/printedSum*100) : 0;
    const ok = diff <= 10 || diffPct < 0.5;
    if(_rcpPrinted.pagesMissing){ cls += ' warn'; okLine = _rcpPrinted.pageLabel; }
    else if(ok){ okLine = `✅ 영수증 원본과 일치 · ${cnt}개 품목${diff>0?` (${fmt(diff)}원 반올림)`:''}`; }
    else { cls += ' danger'; okLine = `⚠️ 영수증 원본 ${fmt(printedSum)}원과 ${fmt(diff)}원 차이 (${diffPct.toFixed(1)}%) — 확인`; }
  }
  // 공급가+부가세 줄은 품목이 있으면 항상 표시 (면세 영수증도 "공급가 X + 부가세 0" — 사장님 호소: 왜 안 나오냐. 2026-06-24)
  const vatLine = cnt>0
    ? `<div style="font-size:12px;color:var(--toss-text-3);font-weight:600;margin-top:3px;">공급가 ${fmt(rowSupply)} + 부가세 ${fmt(rowTax)}</div>`
    : '';
  let warnLine = '';
  const pt = _rcpPrinted.tax;
  if(pt > 0 && Math.abs(pt - rowTax) > Math.max(50, pt*0.03)){ // ±50원·3% 허용(반올림 헛경고 방지)
    warnLine = `<div style="font-size:12px;color:#C77700;font-weight:700;margin-top:3px;">⚠️ 영수증 부가세 ${fmt(pt)}원 ≠ 분석 ${fmt(rowTax)}원 — 면세/과세 확인</div>`;
  }
  sumBox.className = cls;
  sumBox.innerHTML = `<div class="rsc-big">${fmt(rowSum)}원</div><div class="rsc-ok">${okLine}</div>${vatLine}${warnLine}`;
}
function _renderRcpSumCheck(receiptTotalSum, list, pageInfo, photoCount, supplySum, taxSum){
  const pageBox = document.getElementById('rcpPageInfoBox');
  const rowSum = (list||[]).reduce((a,r)=>a+(parseInt(r.totalPrice)||0),0);
  const rowTax = (list||[]).reduce((a,r)=>a+(parseInt(r.taxAmount)||0),0);
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
      pageBox.style.display='block'; pageBox.style.background='#FEF3C7'; pageBox.style.borderColor='#F59E0B'; pageBox.style.color='#92400E';
    } else if(pageInfo && pageInfo.total>1 && !pagesMissing){
      pageBox.innerHTML = `✅ <b>${pageTotal}/${pageTotal} 페이지 모두 분석 완료</b> · 품목 ${cnt}개 · ${fmt(rowSum)}원`;
      pageBox.style.display='block'; pageBox.style.background='#ECFDF5'; pageBox.style.borderColor='#10B981'; pageBox.style.color='#065F46';
    } else { pageBox.style.display='none'; }
  }
  // 2️⃣ 인쇄 영수증 값 보관 후 합계 카드 그리기 (수정 시 _rcpRefreshSum이 같은 보관값으로 재계산)
  _rcpPrinted = {
    sum: hasReceiptSum ? receiptTotalSum : 0,
    tax: parseInt(taxSum)||0,
    pagesMissing: !!pagesMissing,
    pageLabel: pagesMissing ? `⏳ ${pageTotal}페이지 중 ${photos}장 — 남은 페이지 추가 시 일치 예정` : ''
  };
  _rcpSumCardRender(rowSum, rowTax, cnt);
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
  setLoad(true, pageCount>1 ? `AI 분석 중... (${pageCount}장 페이지별 동시 분석)` : 'AI 분석 중...', b64Pages[0]);
  try {
    let catList = getCatListForPrompt();
    const isVendorModeAI = rcpMode === 'vendor';
    const isOnlineModeAI = rcpMode === 'online';
    const isLiquorModeAI = rcpVendorKind === 'liquor'; // 주류 채널 판정
    // (옛 thinking 플래그 제거 2026-06-10 — Gemini thinking은 한국 차단(dev_lessons #201), worker도 무시. 죽은 코드 정리)
    // 거래처 모드(온라인·주류 제외) = 그 거래처 취급품목만 AI 후보로 — 후보 좁힘 → 정확도↑·검수↓
    // 온라인·마트(직구)·주류는 전체 자율(getCatListForPrompt 그대로)
    let vendorCatNames = []; // 거래처 지정 취급분류 — "부모>자식" 전체 경로 (강제·표시용. 사장님 수정 표기와 통일)
    if(isVendorModeAI && !isOnlineModeAI && !isLiquorModeAI && rcpVendorId){
      const _v = (typeof vendors!=='undefined') ? vendors.find(x=>x.id===rcpVendorId) : null;
      const _handled = _v && Array.isArray(_v.handled_category_ids) ? _v.handled_category_ids : [];
      if(_handled.length){
        const _cats = _handled.map(id=>(expCategories||[]).find(c=>c.id===id)).filter(Boolean);
        if(_cats.length){
          catList = _cats.map(c=>c.name).join(','); // AI 후보엔 말단(소분류) 이름만 — 단순
          // 표시·강제용은 부모>자식 전체 경로 (예: 식자재>공산품) — 사장님 수동 수정과 똑같은 표기. 부모 없으면 자기 이름만.
          vendorCatNames = _cats.map(c=>{
            const _p = c.parent_id ? (expCategories||[]).find(x=>x.id===c.parent_id) : null;
            return _p ? `${_p.name}>${c.name}` : c.name;
          });
        }
      }
    }
    // ─── 통합 개선 (2026-05-19 (4)) ───
    //  · 프롬프트 다이어트 (11규칙→핵심만, 예시 단축) → 입력 토큰 ~30% ↓
    //  · p = 영수증 [합계] 컬럼 인쇄값 그대로 (사장님 호소 ② 116,000 vs 115,999 catch)
    //  · total_sum 우선순위 정정: 금일합계 > 합계액 > 결제금액 (전미수/총합계/잔액/누계 무시)
    //  · page_info: {current, total} 신설 — 영수증 "Page (N/M)" 인쇄 감지
    //  · 멀티페이지: parts에 inline_data 여러 개 → AI가 통합 분석
    // 거래처 과거 품목 로드 — 품목명 자동완성 + 단가 매칭 자동채움용 (사진 분석·수기입력 공통). 프롬프트엔 안 넣음(환각 방지, 2026-06-05)
    await loadRcpPastItems();
    // 프롬프트 = common.js 공통 함수 (측정실과 100% 동일 — 검증=실제 보장)
    const prompt = buildReceiptPrompt({ isVendorMode:isVendorModeAI, isOnlineMode:isOnlineModeAI, isLiquorMode:isLiquorModeAI, vendorName:rcpVendorName, catList, pageCount });
    // AI 단독 (2026-05-19 (4)): OCR 제거 — Gemini Flash 단독 (3차 best ~95%+) + High demand 시 GPT-4o fallback
    // 2026-06-09: 전 채널 flash 통일 (측정실 5/5 1등 + 규격 분리 정밀도). 옛 직구·온라인 flash-lite 폐기.
    const aiModel = 'gemini-2.5-flash';
    // 모든 페이지를 parts에 박음 (Gemini multi-image 지원)
    const parts = [{text:prompt}];
    b64Pages.forEach(b64Part=>{
      parts.push({inline_data:{mime_type:'image/jpeg',data:b64Part}});
    });
    // 타임아웃 = 기본 30초 + 페이지당 +5초
    const timeoutSec = 30 + (pageCount-1)*5;
    // 백업 사슬 (2026-06-10 사장님 승인 — 13:03 GPT-4o 오독 사고 재발 방지):
    //   Flash 과부하(503) → ①Gemini 2.0 Flash(같은 회사·세대 다른 모델 = 혼잡 회선 분리) → ②GPT-4o(최후 — 한국어 명세서 약함 #97).
    //   gemini-2.5-pro는 worker(중계 서버) 허용 목록 밖이라 조용히 lite로 강등됨 → 못 씀 (worker 수정 = 전체 장애 전력, 보류).
    //   백업 결과엔 빨간 고정 경고 + 재검산(Self-Reflection)도 그 모델로 적용.
    let raw, usedFallback = false, fallbackModel = '', fallbackProvider = '';
    if(pageCount > 1){
      // ─── 페이지별 독립 분석 → 병합 (2026-06-11) ───
      // 여러 장을 한 호출에 던지면 페이지끼리 섞여 품목명 오독 폭증 (사장님 실측 — 삼성웰스토리 2장).
      // 페이지마다 따로 분석 = 1장 정확도 그대로. 요약 페이지(품목 0 + 합계만)는 합계 기준으로만 쓰임.
      setLoad(true, `AI 분석 중... (${pageCount}장 페이지별 동시 분석)`, b64Pages[0]);
      const singlePrompt = buildReceiptPrompt({ isVendorMode:isVendorModeAI, isOnlineMode:isOnlineModeAI, isLiquorMode:isLiquorModeAI, vendorName:rcpVendorName, catList, pageCount:1 });
      const results = await Promise.all(b64Pages.map(b64 =>
        _rcpAICallWithFallback([{text:singlePrompt},{inline_data:{mime_type:'image/jpeg',data:b64}}], 30, 1)
      ));
      // 한 장 안에 서로 다른 영수증 섞임 감지 → 중단 + 안내 (2026-06-04 유지)
      if(results.some(r => !Array.isArray(r.raw) && r.raw?.multi_receipt===true)){
        setLoad(false);
        toast('📄 서로 다른 거래처 영수증이 섞여 있어요.\n거래처별로 한 번에 한 곳씩 올려주세요.', 'warn', 7000);
        return;
      }
      raw = _rcpMergePages(results.map(r => r.raw));
      const _fb = results.find(r => r.usedFallback);
      if(_fb){ usedFallback = true; fallbackModel = _fb.fallbackModel; fallbackProvider = _fb.fallbackProvider; }
    } else {
      const _res = await _rcpAICallWithFallback(parts, timeoutSec, pageCount);
      raw = _res.raw; usedFallback = _res.usedFallback;
      fallbackModel = _res.fallbackModel; fallbackProvider = _res.fallbackProvider;
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
    // 주류 채널: 보증금 입금/회수 추출
    const depositIn  = isLiquorModeAI ? (parseInt(raw?.deposit_in)||0)  : 0;
    const depositOut = isLiquorModeAI ? (parseInt(raw?.deposit_out)||0) : 0;
    const defaultCat = isVendorModeAI ? (rcpCatName || '식자재') : '';
    // ─── 거래처 지정분류 강제 (2026-06-23 사장님 호소: 순창국제=공산품인데 AI가 부모 "식자재"로 → 미분류 떨어짐) ───
    //   거래처에 취급분류 지정돼 있으면 AI 추측보다 사장님 지정이 우선.
    //   · 1개(예: 공산품) → 전 품목 그 분류로 고정 (AI가 "식자재"라 해도 무시)
    //   · 여러 개(예: 육류·공산품) → AI가 그 목록 안에서 고른 것만 인정, 목록 밖이면 첫 분류로 스냅(부모 "식자재" 같은 미분류 방지)
    const _enforceVendorCat = (aiCat) => {
      if(!vendorCatNames.length) return aiCat || defaultCat; // 거래처 지정분류 없음 → 기존대로 AI 분류
      if(vendorCatNames.length===1) return vendorCatNames[0]; // 단일 지정분류 = 전 품목 그 경로로 고정
      // AI는 말단 이름("공산품")으로 줌 → 지정분류 말단끼리 비교해 매칭, 결과는 전체 경로로 반환
      const _leaf = s => String(s||'').split('>').pop().trim();
      const _aiLeaf = _leaf(aiCat);
      return vendorCatNames.find(n => _leaf(n)===_aiLeaf) || vendorCatNames[0];
    };
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
      _vatUncertain: (x.vu===true || x.vu==='true'), // 면세/과세 애매 — 카드에 "부가세 확인?" 표시 (2026-06-22)
      category: _enforceVendorCat(x.c || x.category)
    }));
    // 주류 채널: 보증금 입금(+) / 회수(−) 행 추가
    if(isLiquorModeAI){
      const _depDate = respDate || ymdLocal(new Date());
      if(depositIn > 0)  list.push({ date:_depDate, vendor:rcpVendorName, item:'보증금 입금', spec:null, origin:null, unitPrice:null, qty:1, totalPrice:depositIn,   taxAmount:0, isTaxFree:true,  category:rcpCatName||'주류', _isDeposit:true, _depositLabel:'입금' });
      if(depositOut > 0) list.push({ date:_depDate, vendor:rcpVendorName, item:'빈병 회수',  spec:null, origin:null, unitPrice:null, qty:1, totalPrice:-depositOut, taxAmount:0, isTaxFree:true,  category:rcpCatName||'주류', _isDeposit:true, _depositLabel:'회수' });
    }
    // 공급가(세전) = 합계(세후) − 세액. 세후 통일(2026-06-04) 후 검산·저장용
    list.forEach(it=>{ it.supplyPrice = (parseInt(it.totalPrice)||0) - (parseInt(it.taxAmount)||0); });
    // 주류: 단가 = 공급가 ÷ 수량(병). 영수증엔 1병 단가 없고 공급가 합계만 찍힘 → 나눠서 1병 단가 표시 (사장님 방식 2026-06-10).
    //   단가×수량=공급가 맞아떨어져 ⚠️ 경고도 자동 사라짐. AI 분석·저장 금액은 안 건드림(단가 표시값만 계산).
    if(isLiquorModeAI) _rcpLiquorUnitPrice(list);
    // 거래처(비주류): 수량 = 공급가 ÷ 단가. AI가 BOX수만 읽고 BOX×단위 못 곱할 때 역산 교정 (2026-06-10).
    if(isVendorModeAI && !isLiquorModeAI) _rcpVendorQtyFix(list);
    // 부가세 처리 (주류 제외): 품목마다 따로 — 과세 품목만 ÷11, 면세는 0. 영수증에 줄별 세액이 찍혀 있으면 그 값 그대로.
    //   ⚠️ 과세합 분배(나눠 넣기) 금지 — 비엔나 혼자 과세인데 연근에 부가세 나눠 넣던 사고 (2026-06-23 사장님 지적)
    const _hadPrintedTax = list.some(it=>(parseInt(it.taxAmount)||0)>0);
    if(!isLiquorModeAI && !_hadPrintedTax) _rcpDeriveVatNoTaxLine(list); // 줄별 세액 없으면 과세 품목만 ÷11
    // 세액이 생겼으면 = 공급가·부가세 줄 표시 (세액 0 행은 면세)
    const _hasAnyTax = list.some(it=>(parseInt(it.taxAmount)||0)>0);
    list.forEach(it=> it._taxFormat = _hasAnyTax);
    // DB 규칙으로 카테고리 + display_item 덮어쓰기 (학습된 품목은 AI 판단 무시)
    list=await applyRulesToReceipt(list);
    // ─── Self-Reflection: 합계 불일치 시 AI 재검산 최대 2회 (2026-06-05) ───
    //   2026-06-10: 백업 모델 결과에도 적용 (옛 !usedFallback 제외 → GPT 오독이 교정 기회 0인 채 통과하던 구멍).
    //   재검산은 분석에 실제 쓴 모델로 — Gemini 죽어서 백업 간 건데 재검산을 Gemini로 보내면 또 죽음.
    if(receiptTotalSum){
      const _refModel = usedFallback ? (fallbackProvider==='gpt' ? 'gpt-4o' : 'gemini-2.5-flash-lite') : aiModel; // 2.0-flash 종료(404) → lite
      const _refProvider = usedFallback ? fallbackProvider : 'gemini';
      const _refTimeout = _refProvider==='gpt' ? 60+(pageCount-1)*5 : timeoutSec+10;
      for(let _ref=0; _ref<2; _ref++){
        const _rowSum=list.reduce((s,it)=>s+(parseInt(it.totalPrice)||0),0);
        const _diff=Math.abs(_rowSum-receiptTotalSum);
        if(_diff<=Math.max(500, receiptTotalSum*0.005)) break; // 0.5% 또는 500원 이내 = 통과
        setLoad(true,`합계 ${fmt(_diff)}원 차이 — AI 재검산 중... (${_ref+1}/2)`, b64Pages[0]);
        try{
          const _rParts=[{text:`이전 분석 수정 요청. 품목 합산 ${_rowSum}원인데 영수증 합계가 ${receiptTotalSum}원 (차이 ${_diff}원).\n이전 응답: ${JSON.stringify(raw)}\n이미지를 다시 확인해 수량(q)·금액(p)·단가(u)·세액(t) 오류만 찾아 수정된 JSON만 반환.\n⚠️품목명(i)·규격(spec)·원산지(og)는 이전 응답 그대로 복사 — 절대 다시 읽거나 바꾸지 마라(이름 수정은 숫자 검산과 무관).`},...parts.slice(1)];
          const _fixRaw=await callGemini(_rParts,_refTimeout,'receipt_reflection',_refModel,_refProvider);
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
            _vatUncertain:(x.vu===true||x.vu==='true'),
            category:x.c||x.category||defaultCat
          }));
          // 주류 보증금 행 복원 — 재검산 rebuild가 보증금 입금/빈병 회수 행을 날려먹던 버그 수정 (2026-06-10)
          //   재검산 응답에 갱신된 보증금 있으면 그 값, 없으면 1차 분석 값 유지.
          if(isLiquorModeAI){
            const _dIn  = parseInt(_fixRaw?.deposit_in)||depositIn;
            const _dOut = parseInt(_fixRaw?.deposit_out)||depositOut;
            const _dd = respDate || ymdLocal(new Date());
            if(_dIn > 0)  list.push({ date:_dd, vendor:rcpVendorName, item:'보증금 입금', spec:null, origin:null, unitPrice:null, qty:1, totalPrice:_dIn,   taxAmount:0, isTaxFree:true, category:rcpCatName||'주류', _isDeposit:true, _depositLabel:'입금' });
            if(_dOut > 0) list.push({ date:_dd, vendor:rcpVendorName, item:'빈병 회수',  spec:null, origin:null, unitPrice:null, qty:1, totalPrice:-_dOut, taxAmount:0, isTaxFree:true, category:rcpCatName||'주류', _isDeposit:true, _depositLabel:'회수' });
          }
          list.forEach(it=>{it.supplyPrice=(parseInt(it.totalPrice)||0)-(parseInt(it.taxAmount)||0);});
          if(isLiquorModeAI) _rcpLiquorUnitPrice(list); // 재검산 후에도 주류 단가=공급가÷수량 재계산
          if(isVendorModeAI && !isLiquorModeAI) _rcpVendorQtyFix(list); // 재검산 후에도 거래처 수량 역산
          const _hpt2=list.some(it=>(parseInt(it.taxAmount)||0)>0);
          if(!isLiquorModeAI && !_hpt2) _rcpDeriveVatNoTaxLine(list); // 줄별 세액 없으면 과세 품목만 ÷11 (분배 X)
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
      if(it._isDeposit) return; // 보증금 행은 검산 제외
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
    list.forEach(it=>{
      const r=_rcpNameSuspect(it.item);
      if(r) it._nameSuspect=r;
      // 규격(spec)으로 한자가 이사하는 케이스도 잡음 (2026-06-10 본앱 실측 — "魚子福袋(날치알)" 규격 잔재)
      else if(/[一-鿿]/.test(String(it.spec||''))) it._nameSuspect='규격에 한자가 남아 있어요 — 확인 필요';
    });
    // ─── 단가 재쪼개기 + 단가 매칭 자동채움 (2026-06-05 / 2026-06-11) ───
    // 과거 영수증 단가가 등록된 거래처에서: 이번 행 단가 → 과거 단가 목록 대조 → 품목명 자동채움
    // 🟢 정확 일치 + 후보 1개 → 자동 채움 (빨간불 해제)
    // 🟡 정확 일치 후보 여럿 또는 ±15% 근접 → _nameCandidates 저장 (원터치 선택 추천)
    // 🔴 일치 없음 → 기존 nameSuspect 유지
    if(isVendorModeAI && rcpPastPriceMap.size){
      // ① 단가 재쪼개기 (2026-06-11): AI가 단가를 잘못 읽은 행을 과거 단가 지도로 교정
      //    금액(totalPrice) 절대 불변 — 단가·수량만 재계산 (순창국제 씨앗 데이터 기반 작동)
      //    위험 케이스 = 단가·수량 둘 다 일관 오독(16000×2 → 3200×10): 산수가 맞아 검산으로 못 잡음
      //    → 산수 맞아도 단가가 과거에 없고, 과거 단가의 품목명과 이름이 일치할 때만 재쪼개기 (이름 대조 = 안전핀)
      //    주류 제외 — 주류 단가는 공급가÷병 계산값(_rcpLiquorUnitPrice)이라 재쪼개기 무의미 + 출고가 변동 시 오발동 위험
      if(!isLiquorModeAI) list.forEach(it => {
        if(it._isDeposit) return;
        const sp = parseInt(it.supplyPrice)||parseInt(it.totalPrice)||0;
        if(!sp) return;
        const currentU = parseInt(it.unitPrice)||0;
        const currentQ = parseFloat(it.qty)||0;
        const mathOk = currentU > 0 && currentQ > 0 && Math.abs(Math.round(currentU*currentQ)-sp) <= Math.max(100,sp*0.005);
        // 단가×수량=금액 산수가 맞으면 AI가 명세서를 제대로 읽은 것 → 그대로 신뢰, 통과.
        //   ⚠️ 옛 코드는 단가가 과거에 없으면 재쪼개기 → 명세서 박스수량(1)을 과거 다른 구매로 멋대로 분할(쑥갓 24,000→8,000×3,
        //   적근대 13,000→6,500×2 등 엑셀 명세서 오작동). 산수 깨진 행(진짜 오독)만 아래에서 교정. (2026-06-24 사장님 호소)
        if(mathOk) return;
        // 단가 칸이 비어있으면(명세서 단가 공란) = 박스 수량 그대로, 단가=금액÷수량. 과거 단가로 쪼개지 않음.
        //   ⚠️ 이게 쑥갓 24,000→8,000×3 변조의 진짜 원인. 단가 0이라 위 산수체크를 못 지나 Case B로 빠져 과거 8,000을 빌려옴.
        //   박스 수량(AI가 박스칸에서 읽은 q, 없으면 1)을 신뢰. (2026-06-24 사장님 호소 — 엑셀 명세서)
        if(currentU <= 0){
          const q = currentQ > 0 ? currentQ : 1;
          it.qty = q;
          it.unitPrice = Math.round(sp / q);
          return;
        }
        // Case A: 단가는 과거 등록값인데 산수 틀림 = 수량만 오독 → 수량 역산
        if(!mathOk && currentU > 0 && rcpPastPriceMap.has(currentU)){
          const ratio = sp / currentU;
          const rounded = Math.round(ratio);
          if(rounded > 0 && rounded <= 200 && Math.abs(ratio-rounded) < 0.01){
            it._origQty = it.qty;
            it.qty = rounded;
            it._unitPriceFixed = true;
            delete it._suspect;
            return;
          }
        }
        // Case B: 단가 자체가 틀림 — 과거 단가 중 금액÷단가=깔끔한 정수인 후보 탐색
        const nm = String(it.item||'').trim();
        const fits = [];
        rcpPastPriceMap.forEach((names, pastU) => {
          if(pastU === currentU || pastU <= 0) return;
          const ratio = sp / pastU;
          const rounded = Math.round(ratio);
          if(rounded <= 0 || rounded > 200) return;
          if(Math.abs(ratio-rounded) >= 0.01) return;
          // 이름 대조: 그 과거 단가에 등록된 품목명과 정확/퍼지(1~2자) 일치 여부
          let nameD = 99;
          if(nm) names.forEach(c => { const d=_levDist(nm,c); if(d<nameD) nameD=d; });
          fits.push({ pastU, rounded, nameD });
        });
        if(!fits.length) return;
        const maxD = nm.length >= 8 ? 2 : 1;
        // 이름 일치 후보 우선 (일치 중에선 가장 비슷한 이름) → 없으면 산수 깨진 행만 단가 근접 후보 허용
        const named = fits.filter(f=>f.nameD<=maxD).sort((a,b)=>a.nameD-b.nameD)[0];
        const bestFit = named || (!mathOk ? fits.sort((a,b)=>Math.abs(a.pastU-currentU)-Math.abs(b.pastU-currentU))[0] : null);
        if(bestFit){
          it._origUnitPrice = currentU;
          it._origQty = it.qty;
          it.unitPrice = bestFit.pastU;
          it.qty = bestFit.rounded;
          it._unitPriceFixed = true;
          delete it._suspect;
        }
      });
      // ② 이름 자동채움 (교정된 단가 포함해 대조)
      list.forEach(it => {
        if(it._isDeposit) return;
        const u = parseInt(it.unitPrice)||0;
        if(!u) return;
        const nm = String(it.item||'').trim();
        const exact = rcpPastPriceMap.has(u) ? [...rcpPastPriceMap.get(u)] : [];
        if(nm && exact.includes(nm)) return; // 과거와 단가·이름 모두 일치 = 확정, 통과
        if(it._nameSuspect){
          // 🔴 의심 행(주소·전화·한자 등): 단가 정확 일치 후보로 자동채움/추천 (기존 2026-06-08 동작)
          if(exact.length === 1){
            it.item = exact[0];
            it._nameSuspect = null;
            it._autoFilled = true;
          } else if(exact.length > 1){
            it._nameCandidates = exact;
            it._nameSuspect = null;
          } else {
            // ±15% 근접 후보 탐색 (정확 일치 없을 때만)
            const nearby = [];
            rcpPastPriceMap.forEach((names, pastPrice) => {
              if(Math.abs(pastPrice - u) / u <= 0.15) nearby.push(...names);
            });
            if(nearby.length) it._nameCandidates = [...new Set(nearby)];
          }
        } else if(nm && exact.length){
          // 🟡 멀쩡해 보이는 행도: 같은 단가의 과거 품목명과 글자 1~2개만 다르면 = 오독 의심 → 과거 이름으로 자동 교정 (2026-06-10)
          //   예: "(유자)" ↔ 과거 "(완자)" 단가 동일·한 글자 차이. AI한테 안 보내고 코드가 결정적 대조 — 환각 위험 0 (#454 프롬프트 주입과 다름).
          //   거래할수록 과거 데이터가 쌓여 정확도 누적 — 어느 가게·거래처든 그 집 데이터로 작동 (하드코딩 아님).
          const scored = exact.map(c=>({c, d:_levDist(nm, c)})).sort((a,b)=>a.d-b.d);
          const best = scored[0];
          const maxD = nm.length >= 8 ? 2 : 1; // 짧은 이름은 1글자 차이까지만 (과교정 방지)
          if(best.d > 0 && best.d <= maxD && (scored.length < 2 || scored[1].d > best.d)){
            it._origBeforeFix = nm; // AI 원본 보존 (검수용)
            it.item = best.c;
            it._autoFilled = true;
          } else if(best.d > 0 && best.d <= 3){
            it._nameCandidates = exact; // 차이 큼 — 자동 변경 X, 원터치 후보로만 추천
          }
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
    const nameSuspectCnt    = list.filter(it => it._nameSuspect).length;
    const autoFilledCnt     = list.filter(it => it._autoFilled).length;
    const unitPriceFixedCnt = list.filter(it => it._unitPriceFixed).length;
    if(unitPriceFixedCnt){
      toast(`🔄 단가·수량 재교정 ${unitPriceFixedCnt}건 — 확인 후 저장하세요`, 'warn', 6000);
    }
    if(autoFilledCnt){
      toast(`✅ 단가로 품목명 ${autoFilledCnt}건 자동 채움 — 맞는지 확인하세요`, 'success', 5000);
    }
    if(nameSuspectCnt){
      toast(`🔴 품목명 확인 필요 ${nameSuspectCnt}건 — 📋 눌러 고쳐주세요`, 'warn', 7000);
    }
    rowCount=0;
    document.getElementById('resTable').innerHTML=_rcpDatalistHtml()+list.map(i=>buildReceiptRow(i)).join('');
    rowCount=list.length;
    requestAnimationFrame(autoGrowAllNames); // 품목명 칸 높이 자동 맞춤 (긴 이름 다 보이게)
    // 영수증 날짜 상단 입력칸에 AI 인식 날짜 표시 + 이상 경고 (2026-06-02: 날짜 hidden 문제 해결)
    const _rcpDateEl=document.getElementById('rcpReceiptDate');
    if(_rcpDateEl){ _rcpDateEl.value=(list[0]&&list[0].date)||ymdLocal(new Date()); _checkRcpDateWarn(_rcpDateEl.value); }
    _setRcpVendorField((list[0]&&list[0].vendor)||''); // 거래처 칸 = 고른 거래처 고정 (미정 시 AI값) (2026-06-22)
    // 📊 합계 + 📄 페이지 박스 (pageInfo + photoCount 함께 전달)
    _renderRcpSumCheck(receiptTotalSum, list, pageInfo, pageCount, receiptSupplySum, receiptTaxSum);
    // 🔄 백업 모델 고정 경고 — 토스트는 사라지니 결과 맨 위에 빨간 띠로 박음 (2026-06-10 GPT 오독 사고)
    const _fbWarn=document.getElementById('rcpFallbackWarn');
    if(_fbWarn){
      if(usedFallback){
        _fbWarn.innerHTML=`🔄 <b>${fallbackModel} 백업 분석 결과</b> — 평소 모델(Gemini Flash)이 혼잡해 대체 분석했어요.<br>정확도가 낮을 수 있으니 <b>품목·수량·합계를 꼭 확인</b> 후 저장하세요.`;
        _fbWarn.style.display='block';
      } else {
        _fbWarn.style.display='none';
      }
    }
    const resultArea=document.getElementById('resultArea');
    resultArea.style.display='block';
    // 분석 완료 알림 (토큰·비용 표시는 제거 — 사장님 2026-06-02). 백업 모델 전환 시만 추가 안내.
    const pageMark = pageCount>1 ? ` (${pageCount}장 통합)` : '';
    toast(`✨ 분석 완료${pageMark}${usedFallback ? ` · 🔄 ${fallbackModel} 백업` : ''}`, 'success', 2500);
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
    // 1) 대분류(최상위) 이름 매칭
    const main=(expCategories||[]).find(c=>c.name===mainCat&&!c.parent_id);
    if(main) return main.id;
    // 2) 폴백: 소분류(자식) 이름으로도 매칭 (2026-06-09)
    //    취급품목이 leaf(말단) 이름 "야채"만 AI 후보로 줄 때, AI가 "식자재 >" 접두 없이 "야채"만 반환 → 자식에서 찾음.
    //    활성 우선, 동명 자식 여럿이면 첫 번째.
    const child=(expCategories||[]).find(c=>c.name===mainCat&&c.parent_id&&c.is_active!==false)
             || (expCategories||[]).find(c=>c.name===mainCat&&c.parent_id);
    if(child) return child.id;
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
  // 한자 잔재 (2026-06-10) — 프롬프트가 "한자 빼라"인데 남았다 = AI가 지시 어김 → 기계적으로 잡힘
  if(/[一-鿿]/.test(s)) return '한자가 남아 있어요 — 품목명 확인 필요';
  // 길이 규칙 없음 — 프레시원 등 거래명세서 품목명 원래 40-50자, 길이로 잡으면 오탐 남발. 주소·전화 패턴으로 충분.
  return '';
}
// 편집 거리(Levenshtein) — 두 문자열이 몇 글자 다른지(삽입·삭제·교체 각 1). 품목명 오독 대조용 (2026-06-10)
function _levDist(a, b){
  a=String(a); b=String(b);
  if(a===b) return 0;
  const la=a.length, lb=b.length;
  if(!la) return lb;
  if(!lb) return la;
  if(Math.abs(la-lb) > 3) return 99; // 길이 차 크면 다른 품목 — 비교 생략 (과교정·성능 방지)
  let prev = Array.from({length: lb+1}, (_,j)=>j);
  for(let i=1; i<=la; i++){
    const cur=[i];
    for(let j=1; j<=lb; j++){
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + (a[i-1]===b[j-1]?0:1));
    }
    prev=cur;
  }
  return prev[lb];
}
// 주류 단가 재계산 — 단가 = 공급가 ÷ 수량(병). 영수증에 1병 단가가 없어 공급가 합계만 찍히는 주류 명세서용.
//   비주류(공급가 0=탄산가스 등)·보증금 행은 제외. 반올림 1원 오차는 ⚠️ 검산 threshold(100원) 안이라 통과.
function _rcpLiquorUnitPrice(list){
  (list||[]).forEach(it=>{
    if(it._isDeposit) return;
    const sp=parseInt(it.supplyPrice)||0;
    const q=parseFloat(it.qty)||0;
    if(sp>0 && q>0) it.unitPrice = Math.round(sp/q);
  });
}
// ─── AI 호출 + 백업 사슬 (Flash → Gemini 2.0 → GPT-4o) — 페이지 단위 재사용 (2026-06-11 분리) ───
async function _rcpAICallWithFallback(parts, timeoutSec, pageCount){
  try {
    const raw = await callGemini(parts, timeoutSec, 'receipt_ocr', 'gemini-2.5-flash', 'gemini');
    return { raw, usedFallback:false, fallbackModel:'', fallbackProvider:'' };
  } catch(geminiErr){
    const m = String(geminiErr?.message || '');
    // 충전금(크레딧) 소진은 백업해도 무의미 → 즉시 안내. 그 외 모든 오류(404·503·500·429·타임아웃·네트워크 등)는 백업 사슬 시도.
    //   (2026-06-23 버그 수정: 404가 백업 조건에서 빠져 Gemini 404 시 GPT로 안 넘어가고 그냥 실패하던 문제)
    if(/충전금|크레딧/.test(m)) throw geminiErr;
    try {
      setLoad(true, 'Gemini Flash 혼잡 → Gemini Lite로 재시도 중...', b64Pages[0]);
      const raw = await callGemini(parts, timeoutSec+10, 'receipt_ocr', 'gemini-2.5-flash-lite', 'gemini'); // gemini-2.0-flash는 2026-06-01 구글 종료(404) → 살아있는 lite로 교체
      return { raw, usedFallback:true, fallbackProvider:'gemini', fallbackModel:(_shortModelName(lastAIUsage?.model) || 'Gemini Lite') }; // worker가 강등시켜도 실제 쓴 모델 정직 표시
    } catch(e2){
      setLoad(true, 'Gemini 전체 혼잡 → GPT-4o로 재시도 중...', b64Pages[0]);
      toast('⚠️ Gemini 혼잡 — GPT-4o 백업 분석', 'warn', 2500);
      const raw = await callGemini(parts, 60+(pageCount-1)*5, 'receipt_ocr', 'gpt-4o', 'gpt'); // GPT-4o 느림 → 60초 (2026-06-08 실측)
      return { raw, usedFallback:true, fallbackProvider:'gpt', fallbackModel:'GPT-4o' };
    }
  }
}
// ─── 페이지별 응답 병합 (2026-06-11) ───
// 페이지마다 독립 분석한 응답을 하나로 합침. 요약 페이지(품목 0 + 합계만)가 있으면 그 합계가 기준.
function _rcpMergePages(raws){
  let objs = raws.map(r => Array.isArray(r) ? {items:r} : (r||{}));
  // 중복 페이지 감지 — 같은 장을 실수로 2번 올리면 품목이 2배로 들어가는 사고 방지 (2026-06-11)
  // 품목 시그니처(i|u|q|p 전체)가 똑같은 페이지는 1개만 남김
  {
    const seen = new Set();
    objs = objs.filter(o => {
      const its = o.items||[];
      if(!its.length) return true; // 요약 페이지는 중복 검사 제외
      const sig = its.map(x=>`${x.i??x.item}|${x.u??''}|${x.q??''}|${x.p??x.totalPrice??''}`).join('§');
      if(seen.has(sig)){ toast('📄 같은 페이지가 2번 올라가 있어 한 장만 반영했어요', 'warn', 5000); return false; }
      seen.add(sig);
      return true;
    });
  }
  const merged = { items: [] };
  objs.forEach(o => { (o.items||[]).forEach(it => merged.items.push(it)); });
  // 요약 페이지 = 품목 행 없이 합계만 있는 페이지 (연속 명세서 마지막 장)
  const summary = objs.find(o => (!o.items || !o.items.length) && (o.total_sum || o.total_supply || o.total_tax || o.deposit_in || o.deposit_out));
  // 품목합 기준값 — 여러 페이지에 합계가 찍힐 때 "페이지 소계 양식(합산=품목합)"인지 "최종 누계 양식(최대값)"인지 판별용
  const _expected = {
    total_sum:    merged.items.reduce((a,x)=>a+(parseInt(x.p ?? x.totalPrice)||0),0),
    total_tax:    merged.items.reduce((a,x)=>a+(parseInt(x.t ?? x.taxAmount)||0),0),
    total_supply: merged.items.reduce((a,x)=>a+((parseInt(x.p ?? x.totalPrice)||0)-(parseInt(x.t ?? x.taxAmount)||0)),0),
  };
  const pick = (key) => {
    if(summary && summary[key]!=null && summary[key]!=='') return summary[key];
    const vals = objs.map(o => o[key]).filter(v => v!=null && v!=='');
    if(!vals.length) return null;
    if(vals.length===1) return vals[0];
    if(key in _expected){
      const nums = vals.map(v=>parseInt(v)||0);
      const itemsSum = _expected[key];
      const tol = Math.max(500, itemsSum*0.005);
      const max = Math.max(...nums), sumAll = nums.reduce((a,b)=>a+b,0);
      if(Math.abs(max-itemsSum)<=tol) return max;
      if(Math.abs(sumAll-itemsSum)<=tol) return sumAll;
      return max;
    }
    return vals[vals.length-1];
  };
  merged.date = objs.map(o=>o.date).find(v=>v) || null;
  merged.vendor = objs.map(o=>o.vendor).find(v=>v) || '';
  merged.total_sum = pick('total_sum');
  merged.total_supply = pick('total_supply');
  merged.total_tax = pick('total_tax');
  merged.deposit_in = pick('deposit_in');   // 주류 보증금 (요약 페이지 우선)
  merged.deposit_out = pick('deposit_out');
  const _pTotals = objs.map(o=>o.page_info?.total).filter(t=>typeof t==='number');
  merged.page_info = _pTotals.length ? { current: objs.length, total: Math.max(..._pTotals) } : null;
  merged.multi_receipt = false;
  return merged;
}
// 거래처 수량 역산 — 수량 = 공급가 ÷ 단가. AI가 BOX수만 읽고 BOX×단위를 못 곱하는 경우 교정 (2026-06-10).
//   단가·공급가는 정확히 읽히는데 수량만 틀린 케이스(BOX표기 명세서). 이미 맞으면 변경 없음.
//   역산값이 0.05 오차 이내 정수/0.5단위일 때만 적용 (비정상 역산 방지).
function _rcpVendorQtyFix(list){
  (list||[]).forEach(it=>{
    if(it._isDeposit) return;
    const u=parseInt(it.unitPrice)||0;
    const sp=parseInt(it.supplyPrice)||0;
    if(u<=0 || sp<=0) return;
    const existingQ=parseFloat(it.qty)||0;
    const existingDiff=Math.abs(u*existingQ-sp);
    const threshold=Math.max(100, sp*0.005);
    if(existingDiff<=threshold) return; // 이미 맞음 — 건드리지 않음
    const newQ=sp/u;
    const rounded=Math.round(newQ*2)/2; // 0.5 단위 반올림
    if(rounded>0 && Math.abs(rounded-newQ)<=0.05){
      it._origQty=it.qty; // 교정 전 값 보존 (🔄 뱃지 툴팁용, 2026-06-11)
      it.qty=rounded;
      it._unitPriceFixed=true;
      delete it._suspect;
    }
  });
}
// 세액 칸 없는 과세 매입 부가세 자동 분리 — 쿠팡·순창국제 등 부가세가 영수증에 안 찍히는 명세서용 (2026-06-22 사장님 "찍힌 금액만큼만 이체 = 부가세 포함").
//   결제금액(p)은 부가세 포함값 → 과세 행: 부가세 = round(p÷11), 공급가 = p − 부가세 (예: 11,000 → 공급가 10,000 + 부가세 1,000).
//   면세 행(쌀·정육·야채 등 AI f=true)은 부가세 0. 단가(u)는 세전 공급가 기준으로 맞춰 검산(u×q=공급가) 유지. 금액(p)·순익은 불변.
//   ⚠️ 영수증에 세액이 이미 찍혀 있으면(_hadPrintedTax) 호출 안 함 — 인쇄된 세액을 신뢰.
function _rcpDeriveVatNoTaxLine(list){
  (list||[]).forEach(it=>{
    if(it._isDeposit) return;
    const p=parseInt(it.totalPrice)||0;
    if(p<=0){ it.taxAmount=0; it.supplyPrice=p; return; } // 할인(음수)·0원 행 제외
    if(it.isTaxFree){ it.taxAmount=0; it.supplyPrice=p; return; } // 면세 = 부가세 0
    const tax=Math.round(p/11);  // 부가세 포함 결제금액 ÷ 11 = 부가세
    it.taxAmount=tax;
    it.supplyPrice=p-tax;
    const q=parseFloat(it.qty)||0;
    if(q>0) it.unitPrice=Math.round(it.supplyPrice/q); // 세전 단가 — 검산 u×q=공급가 유지
  });
}
function buildReceiptRow(i={}) {
  const idx=rowCount++;
  // 보증금 행 — 별도 카드로 렌더링 (색상 구분, 분류·규격·원산지 칸 없음)
  if(i._isDeposit){
    const depCls = i._depositLabel === '회수' ? ' deposit-row deposit-out' : ' deposit-row deposit-in';
    const depAmt = i.totalPrice < 0 ? `-${fmt(Math.abs(i.totalPrice))}` : `+${fmt(i.totalPrice)}`;
    return `<div class="rcp-item-card${depCls}" id="row-${idx}" data-cat="${esc(i.category||'')}" data-cat-id="${resolveReceiptCatId(i.category)||''}" data-orig-item="${esc(i.item||'')}">
      <div class="ric-l1">
        <input type="text" class="c-i" value="${esc(i.item||'')}" placeholder="보증금" style="flex:1">
        <input type="text" class="c-p" inputmode="numeric" value="${depAmt}" data-input="onReceiptAmountInput|this" style="width:90px">
        <button class="ric-x x-btn" data-action="openReasonSheet|${idx}" title="오답/삭제">×</button>
      </div>
      <input type="hidden" class="c-d" value="${i.date||ymdLocal(new Date())}">
      <input type="hidden" class="c-v" value="${esc(i.vendor||'')}">
      <input type="hidden" class="c-t" value="0">
      <input type="hidden" class="c-f" value="1">
      <input type="hidden" class="c-spec" value="">
      <input type="hidden" class="c-og" value="">
      <input type="hidden" class="c-is-deposit" value="1">
    </div>`;
  }
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
  const _tax = parseInt(i.taxAmount)||0;
  const freeBadge = ''; // 부가세 화면 숨김 (2026-06-21)
  // 면세/과세 애매 표시 — AI가 미가공/가공 헷갈린 식품에 "부가세 확인?" (2026-06-22 사장님 요청). 세부의 "부가세 포함" 토글로 고침.
  const vatCheckBadge = i._vatUncertain ? `<span class="rcp-guess-tag" title="면세인지 과세인지 애매해요 — 아래 세부에서 '부가세 포함'을 확인·수정해주세요">💧 부가세 확인?</span>` : '';
  // 📋 버튼 — 과거 품목 원터치 선택 (거래처 모드 + 과거 품목 있을 때만)
  const pastBtn = rcpPastItems.length ? `<button type="button" class="ric-past-btn" data-action="openRcpPastSheet|${idx}" title="과거 품목 선택">📋</button>` : '';
  // 단가 매칭 뱃지 (2026-06-05)
  const _fixTitle = i._unitPriceFixed
    ? (i._origUnitPrice ? `단가 ${fmt(i._origUnitPrice)}→${fmt(i.unitPrice)}, 수량 ${i._origQty||'?'}→${i.qty} 교정` : `수량 ${i._origQty||'?'}→${i.qty} 교정`)
    : '';
  const autoTag = i._unitPriceFixed
    ? `<span class="rcp-fix-tag" title="${_fixTitle}">🔄 단가 재교정</span>`
    : (i._autoFilled
        ? `<span class="rcp-auto-tag">✅ 단가 자동채움</span>`
        : (i._nameCandidates?.length ? `<span class="rcp-guess-tag" data-action="openRcpPastSheet|${idx}">🟡 후보 ${i._nameCandidates.length}개</span>` : ''));
  // 규격·원산지·단가·수량·부가세 = 세부(접기) 영역. 평소엔 품목·금액·분류만 보임 (2026-06-15 통일·정리)
  //   AI가 읽은 값(spec·u·q·tax)은 input에 채워두고 접음 → 저장 시 querySelector로 다 읽힘(회귀 없음, display:none이어도 값 보존)
  //   전 채널(거래처·온라인·마트·기타·직접입력) 동일 카드 구조 — 사장님 "싹 다 통일" (2026-06-15)
  const _total = parseInt(i.totalPrice)||0;
  const _supply = _total - _tax;        // 공급가(세전)
  const _vatOn = _tax>0;                 // AI가 세액 읽었으면 토글 켜진 상태로 시작
  const vatSplitTxt = _vatOn ? `공급가 ${fmt(_supply)} + 부가세 ${fmt(_tax)} = ${fmt(_total)}` : '';
  // 단가 표기 = 세전 단가(공급가÷수량) — 과세는 부가세 줄로 따로 보여줌(아래 vat-split), 면세는 세전=세후라 단가×수량=금액 (2026-06-22 사장님 "과세는 부가세 나오게").
  //   과세: 단가×수량=공급가 + "공급가+부가세=합계" 줄 표시. 면세: 단가×수량=금액, 부가세 줄 없음.
  const _dispQty = parseFloat(i.qty)||0;
  const _dispUnit = (_dispQty>0 && _supply) ? Math.round(_supply/_dispQty) : (parseInt(i.unitPrice)||0);
  const detailWrap = `
    <div class="rcp-detail" id="detail-${idx}" style="display:block;">
      <div class="det-row">
        <div class="det-half">
          <div class="det-cell txtcell"><span>규격</span><input type="text" class="c-spec" value="${esc(i.spec||'')}" placeholder="없음"></div>
          <div class="det-cell txtcell"><span>원산지</span><input type="text" class="c-og" value="${esc(i.origin||'')}" placeholder="없음"></div>
        </div>
      </div>
      <div class="det-row">
        <div class="det-half">
          <div class="det-cell"><span>단가</span><input type="text" class="c-u" inputmode="numeric" value="${_dispUnit?fmt(_dispUnit):''}" placeholder="-" data-input="onRcpUnitPriceInput|this|${idx}"></div>
          <div class="det-cell"><span>수량</span><input type="text" class="c-q" inputmode="decimal" value="${i.qty||''}" placeholder="-" data-input="onRcpQtyInput|this|${idx}"></div>
        </div>
      </div>
      <div class="vat-row">
        <button type="button" class="vat-toggle" data-action="onRcpVatToggle|${idx}"><span class="sw${_vatOn?'':' off'}"></span> 부가세 포함</button>
        <span class="vat-amt">부가세 <input type="text" class="c-t" inputmode="numeric" value="${_tax||0}" data-input="onRcpVatInput|this|${idx}"></span>
      </div>
      <div class="vat-split" id="vatsplit-${idx}" style="display:${_vatOn?'block':'none'}">${vatSplitTxt}</div>
    </div>`;
  return `<div class="rcp-item-card${suspectCls}${nameSuspectCls}" id="row-${idx}" data-cat="${cat}" data-cat-id="${catId}" data-orig-item="${origItem}" data-manual="${i._manual?'1':''}">
    <button class="ric-x x-btn" data-action="openReasonSheet|${idx}" title="오답/삭제">×</button>
    <div class="ric-l1">
      ${nameSuspectMark}
      <div class="ric-name-inner">
        <div class="ric-name-label">품목</div>
        <textarea class="c-i" rows="1" placeholder="품목명 입력" data-input="autoGrowName|this">${esc(i.item||'')}</textarea>
      </div>
    </div>
    <div class="ric-l2">
      ${suspectMark}
      <button type="button" class="c-cBtn ric-chip${cat?'':' empty'}" data-action="openReceiptCatPicker|${idx}">${cat?label:'🏷️ 분류'}</button>
      ${autoTag}
      ${learnBadge}
      ${freeBadge}
      ${vatCheckBadge}
      ${pastBtn}
      <span class="ric-l2-right">
        <input type="text" class="c-p" inputmode="numeric" value="${fmt(i.totalPrice||0)}" data-input="onReceiptAmountInput|this">
      </span>
    </div>
    ${detailWrap}
    <button type="button" class="rcp-more-btn" id="morebtn-${idx}" data-action="toggleRcpDetail|${idx}">세부 ▴</button>
    <input type="hidden" class="c-d" value="${i.date||ymdLocal(new Date())}">
    <input type="hidden" class="c-v" value="${esc(i.vendor||'')}">
    <input type="hidden" class="c-f" value="${(i.isTaxFree || (i._taxFormat && (parseInt(i.taxAmount)||0)===0))?'1':'0'}">
    <input type="hidden" class="c-is-deposit" value="0">
  </div>`;
}
// ─── 새 기능: 품목명 칸 자동 높이 (긴 이름 줄바꿈으로 다 보이게, 2026-06-19 사장님) ───
function autoGrowName(el){ if(!el) return; el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,84)+'px'; }
function autoGrowAllNames(){ try{ document.querySelectorAll('#resTable .c-i').forEach(autoGrowName); }catch(_e){} }
// ─── 세부 펼침/접힘 토글 (2026-06-15 통일·정리) ───
function toggleRcpDetail(idx){
  const d=document.getElementById('detail-'+idx);
  const btn=document.getElementById('morebtn-'+idx);
  if(!d) return;
  const open=d.style.display==='none';
  d.style.display=open?'block':'none';
  if(btn) btn.textContent=open?'세부 접기 ▴':'세부 펼치기 ▾';
}
// ─── 부가세 "포함" 토글 — 합계에서 부가세 자동 역산(합계÷11) 또는 0 (2026-06-15) ───
function onRcpVatToggle(idx){
  const tr=document.getElementById('row-'+idx); if(!tr) return;
  const tEl=tr.querySelector('.c-t');
  const fEl=tr.querySelector('.c-f');
  const pEl=tr.querySelector('.c-p');
  const uEl=tr.querySelector('.c-u');
  const sw=tr.querySelector('.vat-toggle .sw');
  const total=parseInt(String(pEl?.value||'').replace(/[^0-9]/g,''),10)||0;
  const u=parseInt(String(uEl?.value||'').replace(/[^0-9]/g,''),10)||0;
  const q=parseFloat(tr.querySelector('.c-q')?.value||'0')||0;
  const curTax=parseInt(String(tEl?.value||'0').replace(/[^0-9]/g,''),10)||0;
  const isManual = tr.dataset.manual==='1'; // 수동 입력 = 쌓기(금액=공급가+부가세). 분석 영수증 = 금액 고정(낸 돈 불변)
  if(isManual){
    // 수동: 단가·수량 있으면 공급가×10% 쌓기, 없으면 합계÷11. 금액은 단가×수량+부가세로 재계산.
    if(curTax>0){ if(tEl) tEl.value='0'; if(sw) sw.classList.add('off'); }
    else { const vat=(u>0&&q>0)?Math.round(u*q*0.1):Math.round(total/11); if(tEl) tEl.value=String(vat); if(fEl) fEl.value='0'; if(sw) sw.classList.remove('off'); }
    _rcpRecalcAmount(tr);
  } else {
    // 분석 영수증: 금액(낸 돈) 고정. 과세/면세만 바꾸고 단가(공급가÷수량) 재계산.
    if(curTax>0){
      // 끄기(면세) → 부가세 0, 공급가=금액, 단가=금액÷수량
      if(tEl) tEl.value='0';
      if(sw) sw.classList.add('off');
      if(uEl && q>0) uEl.value=fmt(Math.round(total/q));
    } else {
      // 켜기(과세) → 부가세=금액÷11(포함), 공급가=금액−부가세, 단가=공급가÷수량
      const vat=Math.round(total/11);
      if(tEl) tEl.value=String(vat);
      if(fEl) fEl.value='0';
      if(sw) sw.classList.remove('off');
      if(uEl && q>0) uEl.value=fmt(Math.round((total-vat)/q));
    }
  }
  _rcpUpdateVatSplit(tr, idx);
}
// ─── 부가세 직접 입력 (천단위 콤마) + 분리표시 갱신 (2026-06-15) ───
function onRcpVatInput(el, idx){
  const digits=String(el.value||'').replace(/[^0-9]/g,'');
  el.value=digits?fmt(parseInt(digits,10)):'0';
  const tr=document.getElementById('row-'+idx); if(!tr) return;
  // 직접 입력으로 부가세 생기면 토글도 켜진 상태로 맞춤
  const sw=tr.querySelector('.vat-toggle .sw');
  const tax=parseInt(digits||'0',10)||0;
  if(sw){ if(tax>0) sw.classList.remove('off'); else sw.classList.add('off'); }
  if(tr.dataset.manual==='1'){
    _rcpRecalcAmount(tr); // 수동: 금액 = 단가×수량 + 부가세 (쌓기)
  } else {
    // 분석 영수증: 금액(낸 돈) 고정 → 단가만 재계산 (공급가=금액−부가세, 단가=공급가÷수량)
    const total=parseInt(String(tr.querySelector('.c-p')?.value||'').replace(/[^0-9]/g,''),10)||0;
    const q=parseFloat(tr.querySelector('.c-q')?.value||'0')||0;
    const uEl=tr.querySelector('.c-u');
    if(uEl && q>0) uEl.value=fmt(Math.round((total-tax)/q));
  }
  _rcpUpdateVatSplit(tr, idx);
}
// ─── 공급가/부가세/합계 분리표시 갱신 ───
function _rcpUpdateVatSplit(tr, idx){
  const total=parseInt(String(tr.querySelector('.c-p')?.value||'').replace(/[^0-9]/g,''),10)||0;
  const tax=parseInt(String(tr.querySelector('.c-t')?.value||'0').replace(/[^0-9]/g,''),10)||0;
  const supply=total-tax;
  const splitEl=document.getElementById('vatsplit-'+idx);
  if(splitEl) splitEl.textContent = tax>0 ? `공급가 ${fmt(supply)} + 부가세 ${fmt(tax)} = ${fmt(total)}` : '';
  _rcpRefreshSum(); // 부가세 토글·수정 → 위 합계 카드 실시간 갱신
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
  const t=parseInt(String(tr.querySelector('.c-t')?.value||'0').replace(/[^0-9]/g,''),10)||0; // 부가세
  if(u>0 && q>0){
    // 단가(세전 공급가) × 수량 + 부가세 = 금액(낸 돈, 세후). 부가세 빠뜨리던 버그 수정 (2026-06-23)
    const amt=Math.round(u*q)+t;
    const pEl=tr.querySelector('.c-p');
    if(pEl) pEl.value=fmt(amt);
  }
  _rcpRefreshSum(); // 단가·수량 수정 → 위 합계 카드 실시간 갱신
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
  _rcpRefreshSum(); // 금액 직접 수정 → 위 합계 카드 실시간 갱신
}
function addReceiptRow(){document.getElementById('resultArea').style.display='block';document.getElementById('resTable').insertAdjacentHTML('beforeend',buildReceiptRow({date:document.getElementById('rcpReceiptDate')?.value||ymdLocal(new Date()),_manual:true}));}
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
// 저장·취소 모두 reload 없이 in-page 전환 (2026-06-08 reload 잔재 전면 제거, 교훈 #141)
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
    // 단가 자동채움 — 고른 품목의 최근 단가 (단가 비어 있을 때만, 사장님이 고칠 수 있음 2026-06-22). 수기입력 단가 흐트러짐 방지.
    const uEl = row.querySelector('.c-u');
    if(uEl && !String(uEl.value||'').trim() && rcpPastUnitByName.has(name)){
      uEl.value = fmt(rcpPastUnitByName.get(name));
      // 금액도 비어 있을 때만 단가×수량 계산 (AI가 읽은 금액 덮어쓰기 방지). 수량은 나중에 넣어도 onRcpQtyInput이 계산.
      const pEl = row.querySelector('.c-p');
      if(pEl && !String(pEl.value||'').replace(/[^0-9]/g,'')) _rcpRecalcAmount(row);
    }
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
  _rcpRefreshSum(); // row-off 토글 후 합계 카드 재계산
}

// 품목 수정(금액·부가세·토글·단가·삭제) 시 합계 카드 실시간 재계산 — DOM이 진실 (2026-06-23 단일 함수화)
function _rcpRefreshSum(){
  let rowSum=0, rowTax=0, cnt=0;
  document.querySelectorAll('#resTable .rcp-item-card').forEach(tr=>{
    if(tr.classList.contains('row-off')) return;
    cnt++;
    rowSum+=parseInt((tr.querySelector('.c-p')?.value||'').replace(/[^0-9-]/g,''))||0;
    rowTax+=parseInt((tr.querySelector('.c-t')?.value||'').replace(/[^0-9]/g,''))||0;
  });
  _rcpSumCardRender(rowSum, rowTax, cnt); // 최초 분석과 똑같은 그림(공급가+부가세·대조경고 포함)
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
  // 온라인 = 플랫폼(쿠팡 등) vendor_id·이름 고정. 카테고리는 AI 품목별 자율(거래처와 차이)
  const isOnlineMode = rcpMode === 'online' && rcpVendorId;
  // 마트 = 선택한 마트(농협 등) vendor_id·이름 고정 → OCR 상호 제각각 방지. 카테고리는 AI 자율 (2026-06-12)
  const isMartMode = rcpMode === 'direct' && rcpVendorId;
  // 영수증 1장 = 그룹 UUID 1개 (2026-05-19 사장님 호소 "각각 산 것처럼 보임" 해결)
  // 모든 행에 동일 group_id 박음 → 기록내역 그룹 묶음 표시 + 그룹 편집·삭제 가능
  const groupId = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : null;
  const rows=Array.from(document.querySelectorAll('#resTable .rcp-item-card')).map((tr,idx)=>{
    // 카테고리 = 모드 무관 행(품목)별 AI 분류 사용. picker 수정 존중. AI 못 읽은 행은 defaultCat fallback
    const cat = (tr.dataset.cat||'').trim();
    const category_id = tr.dataset.catId ? tr.dataset.catId : (resolveReceiptCatId(cat) || null);
    const amtRaw=(tr.querySelector('.c-p')?.value||'').replace(/[^0-9-]/g,''); // 마이너스(-) 보존 — 할인 행(-500 등) 음수 유지
    const taxRaw=(tr.querySelector('.c-t')?.value||'').replace(/[^0-9]/g,''); // 행 세액(부가세) — 합계는 세후
    const isFree=(tr.querySelector('.c-f')?.value||'0')==='1'; // 면세 여부
    // 거래처·온라인·마트 모드면 vendor 텍스트를 선택한 이름으로 통일 (AI 추출 상호 제각각 방지)
    const vendorText = (isVendorMode || isOnlineMode || isMartMode)
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
      seq:idx, // 품목 순서(분석 순서) 고정 — 기록 표시 시 이 번호로 정렬 (2026-06-09)
      spec:specText, origin:originText,
      vendor_id: (isVendorMode || isOnlineMode || isMartMode) ? rcpVendorId : null,
      unit_price: unitRaw ? parseInt(unitRaw,10) : null,
      qty: qtyRaw,
      total_price:parseInt(amtRaw,10)||0,
      tax_amount: parseInt(taxRaw,10)||0,
      supply_price: (parseInt(amtRaw,10)||0) - (parseInt(taxRaw,10)||0), // 공급가(세전)
      is_tax_free: isFree, // 면세 여부 (의제매입세액공제용)
      is_deposit: (tr.querySelector('.c-is-deposit')?.value || '0') === '1', // 보증금 행 여부 (주류)
      category:cat||null,category_id:category_id||null,
      input_method: rcpInputMethod || null,
      receipt_group_id: groupId,
      note:tr.classList.contains('row-off')?(tr.dataset.reason||'오답'):'정상'
    };
  });
  // 사전 가드: 정상 행에 분류번호(category_id) 없으면 저장 차단 (사장님 명시 2026-06-16: 분류 없거나 번호 안 잡히면 지출 저장 X)
  //   category 텍스트만 있고 목록 매칭 실패(AI가 목록 밖 분류 생성) + category 자체 빈 행 둘 다 차단 → 집계 누락 원천 차단
  const missing=rows.filter(r=>r.note==='정상'&&!r.category_id);
  if(missing.length){
    const detail=missing.map(r=>`${r._idx}행 "${r.item||r._cat||'품목'}"${r._cat?` (분류 "${r._cat}")`:' (분류 미선택)'}`).join('\n• ');
    alert(`아래 품목은 분류가 정해지지 않아 저장할 수 없어요:\n• ${detail}\n\n각 품목의 "분류"를 목록에서 골라주신 뒤 다시 저장해주세요.\n분류가 있어야 지출 집계에 정확히 잡혀요.`);
    return; // 분류번호 없으면 저장 차단 (집계 무결성)
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
      // 거래처/온라인 진입 → 종류 맞춰 화면 + 상세 자동 열기
      const vid = _ret.slice('vendors:'.length);
      const _v = (typeof vendors!=='undefined') ? vendors.find(x=>x.id===vid) : null;
      if(typeof vendorListKind!=='undefined') vendorListKind = (_v && _v.kind==='online') ? 'online' : 'vendor';
      nav('vendors');
      if(typeof _applyVendorViewKind==='function') _applyVendorViewKind();
      if(vid && vid !== 'null'){
        // 목록 깜빡임 제거 (2026-06-09): 300ms 지연 점프(목록 보였다 상세로) 대신
        // 상세 패널을 먼저 켜고 바로 데이터 로드 — 목록 화면 안 거침.
        // 필터값을 먼저 vid로 맞춰 vendorTab('orders')의 자동 로드가 올바른 거래처를 읽게 함.
        if(typeof currentVendorDetailId!=='undefined') currentVendorDetailId = vid;
        const _ovf=document.getElementById('orderVendorFilter'); if(_ovf) _ovf.value=vid;
        if(typeof vendorTab==='function') vendorTab('orders');
        await openVendorDetail(vid);
      }
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
    rcpListFilter='all'; // 서브탭 새 진입 = 거래처 칩 [전체]로 초기화 (편집 후 새로고침은 필터 유지)
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
    .select('id,receipt_date,vendor,item,unit_price,qty,total_price,category,category_id,note,receipt_group_id,input_method,vendor_id,created_at,seq,spec,origin')
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
      memo:row.memo||'',
      category:row.vendors?.category||null // 거래처 단위 분류 (주문은 4단계 전까지 거래처 카테고리)
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
    memo:'',
    seq:(row.seq!=null)?row.seq:null, // 품목 순서(분석 순서). 옛 영수증은 null
    category:row.category||null // 품목별 분류 (2026-06-10 기록 표시용)
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
  // 그룹 내 품목을 seq(분석 순서)로 고정 정렬 — 매번 순서 섞이던 버그 해결 (2026-06-09)
  // seq 없는 옛 영수증(null)은 뒤로, 원래 순서 유지(안정 정렬)
  groups.forEach(g=>{
    g.rows.forEach((r,i)=>{ r._origIdx=i; });
    g.rows.sort((a,b)=>{
      const sa=(a.seq!=null)?a.seq:Number.MAX_SAFE_INTEGER;
      const sb2=(b.seq!=null)?b.seq:Number.MAX_SAFE_INTEGER;
      return sa!==sb2 ? sa-sb2 : a._origIdx-b._origIdx;
    });
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
  // 그룹 내 품목을 seq(분석 순서)로 고정 정렬 (2026-06-09). seq 없는 옛 영수증은 원래 순서 유지
  groups.forEach(g=>{
    g.rows.forEach((r,i)=>{ r._origIdx=i; });
    g.rows.sort((a,b)=>{
      const sa=(a.seq!=null)?a.seq:Number.MAX_SAFE_INTEGER;
      const sb2=(b.seq!=null)?b.seq:Number.MAX_SAFE_INTEGER;
      return sa!==sb2 ? sa-sb2 : a._origIdx-b._origIdx;
    });
  });
  return groups;
}

// ══════════════════════════════════════════
// 행형 기록 내역 공통 렌더 (2026-06-11 통일 디자인)
// 영수증 기록·카테고리 화면·거래처 주문 기록이 같은 함수 하나로 그림
// (진입 경로마다 화면 다르게 생기던 문제 해소 — 컴포넌트 하나 + 거래처 필터만 다름)
// ══════════════════════════════════════════

// 분류 배지 색 — 분류명→색 매핑 단일 설정 객체 (코드 곳곳 하드코딩 금지)
// 미정의 분류는 회색 기본값. 새 분류 추가 시 같은 톤(연한 배경 + 진한 동일계열 글자)으로 여기만 추가
const EXP_BADGE_COLORS={
  '육류':  {bg:'#FFF0EF',fg:'#C2554F'},
  '공산품':{bg:'#EEF3FA',fg:'#5578A0'},
  '야채':  {bg:'#EFF6EF',fg:'#55804F'},
  '주류':  {bg:'#F5F0FA',fg:'#7E5AA6'},
  '음료':  {bg:'#EEF7F6',fg:'#3F8A82'},
  '기타':  {bg:'#F0F2F5',fg:'#7A828C'},
};
const EXP_BADGE_DEFAULT={bg:'#F0F2F5',fg:'#7A828C'};

// 분류 배지 HTML ('식자재>육류' → 소분류 '육류'만 표시). 분류 없으면 빈 문자열
function _expBadgeHtml(category){
  if(!category) return '';
  const s=String(category);
  const short=(s.includes('>')?s.split('>').pop():s).trim();
  if(!short) return '';
  const c=EXP_BADGE_COLORS[short]||EXP_BADGE_DEFAULT;
  return `<span class="rcl-badge" style="background:${c.bg};color:${c.fg};" title="${esc(s)}">${esc(short)}</span>`;
}

// 정규화 행의 거래처 표시 이름 (칩 필터 키로도 사용)
function _rclVendorName(r){
  const n=(r.vendor||'').trim();
  if(n) return n;
  return (r._source==='receipt'&&!r.vendor_id)?'직접 구매':'(이름 없음)';
}

// 거래처 필터칩 한 줄 — 거래처 목록은 데이터에서 동적 생성 (금액 큰 순)
// pickFn = 칩 클릭 시 부를 함수 이름 (화면별 상태 갱신용)
function _rclChipsHtml(rows, activeFilter, pickFn){
  const agg={};
  (rows||[]).forEach(r=>{
    if(r.note&&r.note!=='정상') return;
    const n=_rclVendorName(r);
    agg[n]=(agg[n]||0)+(r.amount||0);
  });
  const names=Object.entries(agg).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
  let html=`<button type="button" class="rcl-chip${(!activeFilter||activeFilter==='all')?' active':''}" data-action="${pickFn}|all">전체</button>`;
  names.forEach(n=>{
    const val='v:'+encodeURIComponent(n);
    html+=`<button type="button" class="rcl-chip${activeFilter===val?' active':''}" data-action="${esc(pickFn+'|'+val)}" title="${esc(n)}">${esc(n)}</button>`;
  });
  return html;
}

// ─── 거래처 필터 버튼 + 바텀시트 (2026-06-20 가로 칩 폐기 — 거래처 많아도 깔끔) ───
// 칩 영역에 버튼 1개만 표시 → 누르면 거래처 목록 바텀시트. 거래처 5개·20개 무관하게 동작 (SaaS 범용)
//   which = 'cat'(지출관리 거래처별/카테고리 화면) | 'rcp'(영수증 기록 내역 화면)
function _rclFilterBtnHtml(activeFilter, which){
  const on=activeFilter&&activeFilter!=='all';
  const label=on?_rclFilterName(activeFilter):'전체 거래처';
  return `<button type="button" class="rcl-filterbtn${on?' on':''}" data-action="openRclFilterSheet|${which}">`
    +`<span class="rfb-ic">🏪</span><span class="rfb-tx">${esc(label)}</span><span class="rfb-cv">▾</span></button>`;
}
let _rclFilterSheetWhich='cat';
function openRclFilterSheet(which){
  _rclFilterSheetWhich = (which==='rcp') ? 'rcp' : 'cat';
  let rows, activeFilter;
  if(_rclFilterSheetWhich==='rcp'){
    rows=(rcpRecords||[]).map(r=>_normalizeExpenseRow(r,'receipt'));
    activeFilter=rcpListFilter;
  } else {
    rows=catReceiptRowsCache||[];
    activeFilter=catReceiptFilter;
  }
  // 거래처별 집계 (금액 큰 순)
  const agg={};
  (rows||[]).forEach(r=>{
    if(r.note&&r.note!=='정상') return;
    const n=_rclVendorName(r);
    if(!agg[n]) agg[n]={total:0,count:0};
    agg[n].total+=(r.amount||0); agg[n].count++;
  });
  const names=Object.entries(agg).sort((a,b)=>b[1].total-a[1].total);
  const totalCount=names.reduce((s,e)=>s+e[1].count,0);
  const totalAmt=names.reduce((s,e)=>s+e[1].total,0);
  const mkRow=(val,label,sub,active)=>`<button type="button" class="rcl-fsheet-row${active?' active':''}" data-action="pickRclFilter|${val}">`
    +`<span class="rfs-nm">${esc(label)}</span><span class="rfs-sub">${esc(sub)}</span></button>`;
  let html=mkRow('all','전체',`${totalCount}건 · ${fmt(totalAmt)}원`,(!activeFilter||activeFilter==='all'));
  names.forEach(([n,v])=>{
    html+=mkRow('v:'+encodeURIComponent(n), n, `${v.count}건 · ${fmt(v.total)}원`, activeFilter==='v:'+encodeURIComponent(n));
  });
  const listEl=document.getElementById('rclFilterSheetList');
  if(listEl) listEl.innerHTML=html;
  openSheet('rclFilterSheet');
}
function pickRclFilter(val){
  closeSheet('rclFilterSheet');
  if(_rclFilterSheetWhich==='rcp') pickRcpListChip(val);
  else pickCatReceiptChip(val);
}

// 거래처 필터 적용 — 새 칩 형식('v:<이름>') + 옛 거래방법 시트 형식(direct/vendor:/shop:) 호환
function _rclApplyFilter(rows, filter){
  const list=rows||[];
  if(!filter||filter==='all') return list;
  if(filter.startsWith('v:')){
    const name=decodeURIComponent(filter.slice(2));
    return list.filter(r=>_rclVendorName(r)===name);
  }
  if(filter==='direct') return list.filter(r=>r._source==='receipt'&&!r.vendor_id);
  if(filter.startsWith('vendor:')) return list.filter(r=>r.vendor_id===filter.split(':')[1]);
  if(filter.startsWith('shop:')){
    const name=decodeURIComponent(filter.split(':')[1]);
    return list.filter(r=>r._source==='receipt'&&(((r.vendor||'').trim()||'(이름 없음)')===name));
  }
  return list;
}

// 필터 값 → 사람 읽는 라벨 (상단 라벨 "거래처명 · …" 용)
function _rclFilterName(filter){
  if(!filter||filter==='all') return '전체';
  if(filter.startsWith('v:')) return decodeURIComponent(filter.slice(2));
  if(filter==='direct') return '직접 구매';
  if(filter.startsWith('shop:')) return decodeURIComponent(filter.split(':')[1]);
  return '필터';
}

// 거래처 그룹 카드 1장 (_groupExpenseRows 그룹 → 행형 카드)
// 카드 헤더 클릭·액션은 기존 로직 유지: receipt=그룹 편집 / order=✏🗑 / mydata=✏
function _rclStoreCardHtml(g){
  const isOrder=g.source==='order', isMydata=g.source==='mydata';
  let icon;
  if(isMydata) icon=(g.rows[0]?.txType==='card'?'💳':'🏦');
  else if(isOrder) icon='🏪';
  else icon=(g.inputMethod==='photo'?'📸':(g.inputMethod==='manual'?'✏️':'🧾'));
  const subBits=[`품목 ${g.rows.length}개`];
  if(g.hasErr) subBits.push('일부 오답');
  // 2026-06-20 아코디언: 헤더(summary)=펼치기/접기 전용. 편집·삭제는 펼친 영역 하단으로 이동 (헤더 클릭 충돌 방지)
  let cardActs='';
  if(isMydata){
    const txId=g.rows[0]?.id||g.recId, txType=g.rows[0]?.txType||'bank';
    cardActs=`<div class="rcl-cardacts"><button type="button" class="btn btn-secondary" data-action="openTxEditSheet|${txId}|${txType}">✏ 편집</button></div>`;
  } else if(isOrder){
    const editId=g.rows[0]?.id||g.recId;
    const delKey=g.groupId?('g:'+g.groupId):('s:'+g.recId);
    cardActs=`<div class="rcl-cardacts"><button type="button" class="btn btn-secondary" data-action="openEditOrderSheet|${editId}">✏ 편집</button><button type="button" class="btn btn-danger" data-action="deleteOrderGroupFromCard|${delKey}">🗑 삭제</button></div>`;
  } else {
    const editKey=g.groupId?('grp:'+g.groupId):('rec:'+g.recId);
    cardActs=`<div class="rcl-cardacts"><button type="button" class="btn btn-secondary" data-action="openReceiptGroupEdit|${editKey}">✏ 묶음 편집</button></div>`;
  }
  const itemsHtml=g.rows.map(r=>{
    const cls=['rcl-item'];
    if(r.note!=='정상') cls.push('err');
    if(r._origin&&r._origin._suspect) cls.push('suspect');
    const clickAction=r._source==='order'
      ? `openEditOrderSheet|${r.id}`
      : (r._source==='mydata' ? `openTxEditSheet|${r.id}|${r.txType||'bank'}` : `openReceiptEdit|${r.id}`);
    const itemRaw=r.item||'(품목 없음)';
    const memoFlag=(r._source==='order'&&r.memo)?' 💬':'';
    const itemTitle=(r._source==='order'&&r.memo)?esc(itemRaw+' · 메모: '+r.memo):esc(itemRaw);
    const hasQty=(r.qty!=null&&r.qty!=='');
    // 2줄째 좌측 = 단가 × 수량 계산식 (둘 다 있을 때만 ×, 단가만 있으면 단가만)
    // 단가 = 부가세 포함 단가(금액÷수량) — 단가×수량=금액 곱셈 일치 + 부가세 숨김 (2026-06-22 사장님 결정)
    const _listQ=parseFloat(r.qty)||0;
    const _listU=(hasQty && _listQ>0 && r.amount) ? Math.round(r.amount/_listQ) : (r.unit||0);
    const calcTxt=_listU?(hasQty?`${fmt(_listU)} × ${esc(String(r.qty))}`:fmt(_listU)):'';
    const badge=_expBadgeHtml(r.category);
    return `<div class="${cls.join(' ')}" data-action="${clickAction}">`
      +`<div class="r1"><span class="nm" title="${itemTitle}">${esc(itemRaw)}${memoFlag}</span>${badge?`<span class="bw">${badge}</span>`:''}</div>`
      +`<div class="r2"><span class="calc">${calcTxt}</span><span class="amt">${fmt(r.amount||0)}원</span></div>`
      +`</div>`;
  }).join('');
  // 거래처명 없는 영수증 = '직접 구매' (칩 필터 이름과 통일)
  const cardName=g.vendor||((!isOrder&&!isMydata)?'직접 구매':'(거래처 없음)');
  // 헤더(summary) 탭 = 펼치기/접기. 품목·편집은 펼쳐야 보임 (사장님 호소 2026-06-20: "묶음이 뭔지 모르겠음")
  return `<details class="rcl-store"><summary class="rcl-storehd">`
    +`<div class="ic">${icon}</div>`
    +`<div class="nm">${esc(cardName)}<small>${subBits.join(' · ')}</small></div>`
    +`<div class="amt">${fmt(g.total)}원</div>`
    +`<span class="rcl-acc-chev">›</span>`
    +`</summary><div class="rcl-rows">${itemsHtml}${cardActs}</div></details>`;
}

// 정규화 행 배열 → 행형 리스트 전체 HTML (날짜 구분줄 + 카드들)
function _rclListHtml(normRows){
  const groups=_groupExpenseRows(normRows);
  const byDate={};
  groups.forEach(g=>{
    const d=g.date||'-';
    if(!byDate[d]) byDate[d]=[];
    byDate[d].push(g);
  });
  const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  let html='';
  dates.forEach(d=>{
    const daySum=byDate[d].reduce((s,g)=>s+g.total,0);
    const dTxt=/^\d{4}-\d{2}-\d{2}$/.test(d)?d.replace(/-/g,'. '):d;
    html+=`<div class="rcl-dayhd"><span class="d">${esc(dTxt)}</span><span class="line"></span><span class="dsum">${fmt(daySum)}원</span></div>`;
    byDate[d].forEach(g=>{ html+=_rclStoreCardHtml(g); });
  });
  return html;
}

let rcpListFilter='all'; // 영수증 기록 내역 거래처 칩 필터 ('all' | 'v:<인코딩 이름>')
function pickRcpListChip(val){
  rcpListFilter=String(val);
  renderReceiptList();
}

function renderReceiptList(){
  // 2026-06-11 행형 갈아엎기: 표(grp-tbl D안) → 행형 2줄 구조 (_rclListHtml 공통 렌더)
  const body=document.getElementById('rcpListBody');
  const totalEl=document.getElementById('rcpListTotal');
  const labelEl=document.getElementById('rcpListLabel');
  const chipsEl=document.getElementById('rcpListChips');
  const mo=parseInt((rcpListMonth||'').split('-')[1],10)||'';
  if(!rcpRecords.length){
    body.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--gray-500);font-size:13px;line-height:1.6;">이번 달 영수증이 없어요.<br>위 [📸 새 영수증] 탭에서 등록해주세요.</div>';
    totalEl.innerText='0원';
    if(labelEl) labelEl.innerText=mo?`${mo}월 전체 · 영수증 기록`:'';
    if(chipsEl) chipsEl.innerHTML='';
    return;
  }
  const norm=rcpRecords.map(r=>_normalizeExpenseRow(r,'receipt'));
  if(chipsEl) chipsEl.innerHTML=_rclFilterBtnHtml(rcpListFilter, 'rcp');
  const filtered=_rclApplyFilter(norm, rcpListFilter);
  const total=filtered.reduce((s,r)=>s+(r.note==='정상'?(r.amount||0):0),0);
  totalEl.innerText=fmt(total)+'원';
  if(labelEl) labelEl.innerText=(rcpListFilter==='all')
    ? (mo?`${mo}월 전체 · 영수증 기록`:'')
    : `${_rclFilterName(rcpListFilter)}${mo?` · ${mo}월`:''}`;
  body.innerHTML=filtered.length
    ? _rclListHtml(filtered)
    : '<div style="text-align:center;padding:40px 20px;color:var(--gray-500);font-size:13px;line-height:1.6;">조건에 맞는 내역이 없어요.<br>필터를 [전체]로 바꿔보세요.</div>';
}

// 단가 직접 수정 → 합계 자동계산 차단 플래그 (사장님 직접 입력 합계 보호 — 2026-06-12)
let _reEditAmountManual=false;
function openReceiptEdit(id){
  const r=rcpRecords.find(x=>String(x.id)===String(id));
  if(!r){toast('영수증을 찾을 수 없어요','error');return;}
  rcpEditingId=r.id;
  rcpEditingCategory=r.category||'';
  document.getElementById('reDate').value=r.receipt_date||ymdLocal(new Date());
  document.getElementById('reVendor').value=r.vendor||'';
  document.getElementById('reItem').value=r.item||'';
  // 단가 = 세전(공급가) 단가, 부가세 별도. 합계 = 단가×수량 + 부가세 (분석카드와 통일, 2026-06-23)
  const _q=parseFloat(r.qty)||0, _t=r.total_price||0, _tax=parseInt(r.tax_amount)||0;
  const _u=parseInt(r.unit_price)||0;
  document.getElementById('reUnitPrice').value=_u?fmt(_u):'';
  document.getElementById('reQty').value=(r.qty!=null&&r.qty!=='')?r.qty:'';
  document.getElementById('reTax').value=_tax?fmt(_tax):'';
  document.getElementById('reAmount').value=r.total_price?fmt(r.total_price):'';
  // 단가×수량+부가세가 합계와 맞으면 자동계산 허용(수량 수정 편의), 안 맞으면(OCR 오독) 합계 보호 → 단가만 고침
  _reEditAmountManual = _t>0 && !(_u>0 && _q>0 && Math.round(_u*_q)+_tax===_t);
  document.getElementById('reCatBtn').innerHTML=(r.category?'🏷️ '+getCatLabel(r.category,''):'미분류 ▸');
  const noteVal=(r.note==='정상')?'정상':'오답';
  document.querySelectorAll('input[name="reNote"]').forEach(i=>{i.checked=(i.value===noteVal);});
  openSheet('receiptEditSheet');
}
// 단가·수량 입력 → 합계 자동계산 (합계 직접 입력 전까지만)
function onReEditUnitQty(el){
  const pos=el.selectionStart;
  const raw=String(el.value||'').replace(/[^0-9.]/g,'');
  el.value = el.id==='reUnitPrice' ? (raw?fmt(parseInt(raw,10)||0):'') : raw;
  if(el.id==='reUnitPrice' && pos!=null){ try{ el.setSelectionRange(el.value.length, el.value.length); }catch(e){} }
  if(_reEditAmountManual) return; // 합계 직접 고쳤으면 자동계산 안 함
  const u=parseInt((document.getElementById('reUnitPrice').value||'').replace(/[^0-9]/g,''),10)||0;
  const q=parseFloat((document.getElementById('reQty').value||'').replace(/[^0-9.]/g,''))||0;
  const tax=parseInt((document.getElementById('reTax').value||'').replace(/[^0-9]/g,''),10)||0;
  if(u>0&&q>0) document.getElementById('reAmount').value=fmt(Math.round(u*q)+tax); // 단가×수량 + 부가세 = 합계
}
// 부가세 직접 입력 → 합계 재계산 (단가×수량 + 부가세). 2026-06-23
function onReEditTax(el){
  const raw=String(el.value||'').replace(/[^0-9]/g,'');
  el.value = raw?fmt(parseInt(raw,10)):'';
  if(_reEditAmountManual) return;
  const u=parseInt((document.getElementById('reUnitPrice').value||'').replace(/[^0-9]/g,''),10)||0;
  const q=parseFloat((document.getElementById('reQty').value||'').replace(/[^0-9.]/g,''))||0;
  const tax=parseInt(raw||'0',10)||0;
  if(u>0&&q>0) document.getElementById('reAmount').value=fmt(Math.round(u*q)+tax);
}
// 합계 직접 입력 → 이후 단가·수량 변경해도 합계 보호 (지우면 자동계산 재허용)
function onReEditAmount(el){
  formatNumberInput(el);
  _reEditAmountManual=(unFmt(el.value)||0)>0;
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
  const unitPrice=parseInt((document.getElementById('reUnitPrice').value||'').replace(/[^0-9]/g,''),10)||null;
  const qtyRaw=(document.getElementById('reQty').value||'').replace(/[^0-9.]/g,'');
  const qty=qtyRaw?parseFloat(qtyRaw):null;
  const amount=unFmt(document.getElementById('reAmount').value)||0;
  const taxAmount=parseInt((document.getElementById('reTax').value||'').replace(/[^0-9]/g,''),10)||0; // 부가세 (2026-06-23)
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

  // 분류번호 없으면 저장 차단 (신규 저장과 동일 — 사장님 명시 2026-06-16, 집계 무결성)
  if(note==='정상' && !resolveRcpCatId(cat)){
    alert('분류가 정해지지 않아 저장할 수 없어요.\n"분류"를 목록에서 골라주신 뒤 다시 저장해주세요.');
    return;
  }
  setLoad(true,'저장 중...');
  const {error}=await sb.from('receipts').update({
    receipt_date:date,vendor,item,total_price:amount,
    unit_price:unitPrice,qty:qty,tax_amount:taxAmount,
    is_tax_free: taxAmount>0 ? false : undefined, // 부가세 넣으면 과세로 (면세 해제). 0이면 기존값 유지
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
  // seq(분석 순서)로 정렬 후 행 구성 — 편집 시트도 순서대로 열림 (2026-06-09)
  const sorted=[...records].map((r,i)=>({_r:r,_i:i})).sort((a,b)=>{
    const sa=(a._r.seq!=null)?a._r.seq:Number.MAX_SAFE_INTEGER;
    const sb=(b._r.seq!=null)?b._r.seq:Number.MAX_SAFE_INTEGER;
    return sa!==sb ? sa-sb : a._i-b._i;
  }).map(x=>x._r);
  return sorted.map(r=>({
    id:r.id, vendor:r.vendor||'', item:r.item||'',
    unitPrice:r.unit_price||null, qty:r.qty||null,
    amount:r.total_price||0,
    cat:r.category||'', catId:r.category_id||null, note:r.note||'정상',
    spec:r.spec||null, origin:r.origin||null,
    _isNew:false, _deleted:false, _origItem:r.item||'',
    _amountManual:true // DB에서 불러온 합계는 사용자 직접 입력값 — 단가×수량 자동계산이 덮어쓰지 않음
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
    // 단가 = 부가세 포함 단가(금액÷수량) — 단가×수량=금액 곱셈 일치 + 부가세 숨김 (2026-06-22 사장님 결정, 분석카드와 통일)
    const _rgeQ=parseFloat(row.qty)||0;
    const _rgeU=(_rgeQ>0 && row.amount) ? Math.round(row.amount/_rgeQ) : (parseInt(row.unitPrice)||0);
    html+=`<div class="rcp-item-card${offCls}" id="rge-row-${idx}">
      <div class="ric-l1">
        <button type="button" class="ric-x x-btn" style="${off?'background:#E5E8EB;color:#8B95A1;':'background:#FFE5E5;color:#DC2626;'}" data-action="toggleRgeRowOff|${idx}" title="오답/정상 토글">×</button>
        <input type="text" class="c-i" value="${esc(row.item)}" placeholder="품목" data-input="setRgeRowField|${idx}|item|this">
        <input type="text" class="c-p" inputmode="numeric" value="${fmt(row.amount)}" data-input="setRgeRowAmount|${idx}|this">
      </div>
      ${specRow}
      <div class="ric-l2">
        <button type="button" class="c-cBtn ric-chip${row.cat?'':' empty'}" data-action="openRgeCatPicker|${idx}">${catLabel}</button>
        <span class="ric-mini">단가 <input type="text" class="c-u" inputmode="numeric" value="${_rgeU?fmt(_rgeU):''}" placeholder="-" data-input="setRgeRowUnitPrice|${idx}|this"></span>
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
  // 마이너스(할인·환불) 입력 허용 — 맨 앞 - 1개만 인정 (옛 [^0-9]는 부호 떼어 할인 못 적던 버그)
  const cleaned=String(el.value||'').replace(/[^0-9-]/g,'');
  const neg=cleaned.startsWith('-');
  const digits=cleaned.replace(/-/g,'');
  rgeRows[i].amount=(neg?-1:1)*(parseInt(digits,10)||0);
  rgeRows[i]._amountManual=rgeRows[i].amount!==0; // 금액 입력하면 자동계산 차단, 0으로 지우면 다시 허용
  el.value=rgeRows[i].amount?fmt(rgeRows[i].amount):'';
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
  if(r._amountManual) return; // 직접 입력 합계 보호 — 단가·수량 변경해도 덮어쓰기 금지
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
  // 마이너스(할인·환불)는 정상 금액 — 빈칸(0/null)만 막음. 옛 r.amount<=0은 할인행 저장 막던 버그 (2026-06-24)
  const invalid=rgeRows.filter(r=>!r._deleted&&r.note==='정상'&&(r.amount==null||r.amount===0||isNaN(r.amount)));
  if(invalid.length) return toast('정상 행은 금액이 필요해요','warn');
  // 분류번호 없으면 저장 차단 (신규·단건편집과 동일 — 사장님 명시 2026-06-16, 집계 무결성)
  const noCat=rgeRows.filter(r=>!r._deleted&&r.note==='정상'&&!r.catId);
  if(noCat.length){
    alert('분류가 정해지지 않은 품목이 있어 저장할 수 없어요.\n각 품목의 "분류"를 목록에서 골라주신 뒤 다시 저장해주세요.');
    return;
  }
  setLoad(true,'저장 중...');
  // 화면에 보이는 순서대로 seq 재부여 — 편집 후에도 품목 순서 고정 (2026-06-09)
  let _seqCounter=0;
  rgeRows.forEach(r=>{ if(!r._deleted) r._seq=_seqCounter++; });
  // 1) 기존 행 UPDATE
  const updates=rgeRows.filter(r=>r.id&&!r._isNew&&!r._deleted);
  for(const r of updates){
    const {error}=await sb.from('receipts').update({
      receipt_date:date, vendor, item:r.item,
      unit_price:r.unitPrice||null, qty:r.qty||null, total_price:r.amount,
      category:r.cat||null, category_id:r.catId||null, note:r.note,
      spec:r.spec||null, origin:r.origin||null, seq:r._seq
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
      spec:r.spec||null, origin:r.origin||null, seq:r._seq
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

