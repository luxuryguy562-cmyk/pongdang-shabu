// ════════════════════════════════════════════════════════
// 영수증 정확도 측정실 (#admin 서브탭) — 2026-05-28 전면 재설계
// 흐름: 거래처 선택 → 사진 올림 → AI 분석 → 사장님 정정 → 정확도 + 답지 저장
// ★ 하드코딩 답지 없음. 사진 올리기 전엔 빈 화면. 정확도 = 사장님이 고친 개수.
// 답지·로그는 localStorage (DB 도입은 검증 후 헌법 8조 승인 받고).
// ════════════════════════════════════════════════════════

// ─── 거래처 분석 프롬프트 = common.js 공통 함수 (영수증 탭과 100% 동일 — 2026-06-04 통일) ───
//   측정실에서 검증한 결과가 실제 영수증 탭에 그대로 반영되도록 같은 프롬프트만 사용
function accBuildPrompt(vendor){
  return buildReceiptPrompt({ isVendorMode:true, vendorName:vendor||'거래처' });
}

// 비교 대상 모델 — 다중 선택 (2026-06-09 여러 모델 동시 비교로 전환)
const ACC_ENGINES = [
  {id:'gemini',     name:'Gemini Flash', cost:'~3원'},
  {id:'gpt4o-mini', name:'GPT-4o-mini',  cost:'~1~4원'},
  {id:'gpt4o',      name:'GPT-4o',       cost:'~27원'},
  {id:'gemini-pro', name:'Gemini Pro',   cost:'~10~20원'},
];
// 엔진 id → 실제 모델명·제공자·타임아웃 매핑 (callGemini 인자)
const ACC_MODEL_MAP = {
  'gemini':     {model:'gemini-2.5-flash',     provider:'gemini', name:'Gemini Flash',  timeout:30},
  'gpt4o-mini': {model:'gpt-4o-mini',          provider:'gpt',    name:'GPT-4o-mini',   timeout:45},
  'gpt4o':      {model:'gpt-4o',               provider:'gpt',    name:'GPT-4o',        timeout:60},
  'gemini-pro': {model:'gemini-2.5-pro',       provider:'gemini', name:'Gemini Pro',    timeout:45},
};
// 사진 화질 선택 (높을수록 작은 글자 잘 읽힘 · 입력 토큰만 늘어 비용 소폭 ↑) — 2026-06-08
const ACC_RES_OPTS = [
  {v:1280, name:'1280px', meta:'현재 기본'},
  {v:2000, name:'2000px', meta:'중간'},
  {v:2400, name:'2400px', meta:'고화질'},
];
let _accRes=1280;
let _accSelectedEngines=['gemini','gpt4o-mini','gpt4o']; // 비교할 모델들 (기본 3개)
let _accVendor='';
let _accFileBuf=[];
let _accB64Cache=[];          // 이미지 b64 (재시도 시 재사용 — 다시 안 읽음)
let _accCompareResults={};    // {engineId: {ok, pending, raw, cost, ms, error}}
let _accTruthSum=null;        // 사장님이 입력한 실제 영수증 합계 (모델별 오차 계산용)
let _accStyleInjected=false;
let _accPastItems=[];  // 거래처 과거 품목명 — 품목 칸 자동완성(원터치 수정)용 (2026-06-05, 영수증 탭과 동일 방식)

// ─── 이미지 → base64 (1280px 리사이즈, 우리 앱 동일) ───
function accFileToB64(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const cvs=document.createElement('canvas');
        let w=img.width,h=img.height; if(w>_accRes){h*=_accRes/w;w=_accRes;} // 화질 선택값(_accRes)으로 다운사이즈 (2026-06-08 측정실 비교용)
        cvs.width=w; cvs.height=h; cvs.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cvs.toDataURL('image/jpeg',0.85).split(',')[1]);
      };
      img.onerror=reject; img.src=e.target.result;
    };
    fr.onerror=reject; fr.readAsDataURL(file);
  });
}

// ─── 모델 1개 호출 → 결과/비용/시간/성공여부를 _accCompareResults에 저장 ───
//   공통 callGemini 재사용(ai_usage_logs 자동 기록). 실패해도 throw 안 하고 결과에 기록 → 한 모델 실패가 비교 전체를 안 막음.
async function _accRunOneModel(engineId, b64list){
  const m = ACC_MODEL_MAP[engineId]; if(!m) return;
  const parts=[{text:accBuildPrompt(_accVendor)}];
  b64list.forEach(b=>parts.push({inline_data:{mime_type:'image/jpeg',data:b}}));
  const t0=Date.now();
  try{
    const raw=await callGemini(parts, m.timeout+(b64list.length-1)*5, 'accuracy_test', m.model, m.provider);
    // lastAIUsage는 직전 호출(이 모델) 비용 — 순차 호출이라 안전
    const cost=(typeof lastAIUsage!=='undefined'&&lastAIUsage)?lastAIUsage.costWon:null;
    const items=(raw && Array.isArray(raw.items))?raw.items:[];
    _accCompareResults[engineId]={ok:true, raw, items, cost, ms:Date.now()-t0,
      sum:(raw&&raw.total_sum!=null)?raw.total_sum:null, itemCount:items.length};
  }catch(e){
    _accCompareResults[engineId]={ok:false, error:(e&&e.message)||String(e), ms:Date.now()-t0};
  }
}

// ─── 거래처 과거 품목 로드 (품목 칸 자동완성용 — 거래처명 텍스트로 매칭) ───
//   vendors에서 이름 매칭 → vendor_id로 receipts.item 조회. 못 찾으면 vendor 텍스트로 조회.
//   자동완성은 사장님이 직접 고르는 것 → 잘못 떠도 무해 (자동 덮어쓰기 X)
async function _accLoadPastItems(){
  _accPastItems=[];
  try{
    if(typeof sb==='undefined' || !sb || typeof currentStore==='undefined' || !currentStore || !_accVendor) return;
    const {data:vs}=await sb.from('vendors').select('id').eq('store_id',currentStore.id).ilike('name',`%${_accVendor}%`).limit(1);
    const vid = (vs && vs[0]) ? vs[0].id : null;
    let q = sb.from('receipts').select('item').eq('store_id',currentStore.id).not('item','is',null).order('created_at',{ascending:false}).limit(300);
    q = vid ? q.eq('vendor_id',vid) : q.ilike('vendor',`%${_accVendor}%`);
    const {data}=await q;
    if(data && data.length) _accPastItems=[...new Set(data.map(r=>(r.item||'').trim()).filter(Boolean))].slice(0,120);
  }catch(e){ console.warn('[acc past items]', e); }
}
function _accDatalistHtml(){
  if(!_accPastItems || !_accPastItems.length) return '';
  return `<datalist id="accPastItems">${_accPastItems.map(n=>`<option value="${(n||'').replace(/"/g,'&quot;')}"></option>`).join('')}</datalist>`;
}
function accNameNorm(s){return String(s||'').replace(/[\s()\[\]\/·,]/g,'').replace(/\d+(g|kg|L|ml)/gi,'').replace(/[①-⑨]/g,'').replace(/코리아|완자/g,'').slice(0,5);}
function accNameMatch(a,b){const x=accNameNorm(a),y=accNameNorm(b);if(!x||!y)return false;return x===y||x.includes(y)||y.includes(x);}
function _accFmt(x){return x==null?'-':Number(x).toLocaleString('ko-KR');}

// ─── localStorage: 최근 거래처 / 답지 / 로그 ───
function _accGetVendors(){ try{return JSON.parse(localStorage.getItem('accVendors')||'[]');}catch{return[];} }
function _accSaveVendor(v){ if(!v)return; const list=_accGetVendors().filter(x=>x!==v); list.unshift(v); localStorage.setItem('accVendors',JSON.stringify(list.slice(0,12))); }
function _accSaveAnswer(vendor,date,cur){ try{const all=JSON.parse(localStorage.getItem('accAnswers')||'{}'); all[vendor+'|'+date]=cur; localStorage.setItem('accAnswers',JSON.stringify(all));}catch{} }
function _accGetLogs(){ try{return JSON.parse(localStorage.getItem('accLabLogs')||'[]');}catch{return[];} }
function _accAddLog(o){ const logs=_accGetLogs(); logs.unshift(o); localStorage.setItem('accLabLogs',JSON.stringify(logs.slice(0,50))); }

// ─── 스타일 (1회 주입) ───
function _accInjectStyle(){
  if(_accStyleInjected) return; _accStyleInjected=true;
  const css=`
  .acc-sec{margin-bottom:12px;}
  .acc-lbl{font-size:12px;font-weight:700;color:var(--gray-700);margin-bottom:6px;}
  .acc-vinput{width:100%;padding:11px;border:1.5px solid var(--gray-200);border-radius:10px;font-size:14px;box-sizing:border-box;}
  .acc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
  .acc-chip{font-size:12px;padding:6px 11px;border-radius:16px;background:var(--gray-100);color:var(--gray-700);cursor:pointer;border:1px solid var(--gray-200);}
  .acc-chip.on{background:var(--primary,#6D28D9);color:#fff;border-color:var(--primary,#6D28D9);}
  .acc-flabel{display:block;border:1.5px dashed var(--gray-300);border-radius:10px;padding:14px;text-align:center;font-size:13px;color:var(--gray-600);cursor:pointer;}
  .acc-flabel.has{border-color:var(--primary,#6D28D9);color:var(--primary,#6D28D9);background:var(--primary-light,#EDE9FE);}
  .acc-flabel input{display:none;}
  .acc-engines{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
  .acc-eng{font-size:11px;padding:5px 9px;border-radius:8px;border:1.5px solid var(--gray-200);cursor:pointer;}
  .acc-eng.on{border-color:var(--primary,#6D28D9);background:var(--primary-light,#EDE9FE);color:var(--primary,#6D28D9);font-weight:700;}
  .acc-eng.off{opacity:.5;}
  .acc-btn{display:block;width:100%;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;background:var(--primary,#6D28D9);color:#fff;margin-top:4px;}
  .acc-btn:disabled{opacity:.55;}
  .acc-btn2{background:#10B981;}
  .acc-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;}
  .acc-tbl th,.acc-tbl td{padding:5px 4px;border-bottom:1px solid var(--gray-100);text-align:left;}
  .acc-tbl th{font-size:10px;color:var(--gray-500);font-weight:600;}
  .acc-tin{width:100%;border:1px solid transparent;border-radius:6px;padding:4px;font-size:12px;background:var(--gray-50,#F9FAFB);box-sizing:border-box;}
  .acc-tin:focus{border-color:var(--primary,#6D28D9);background:#fff;outline:none;}
  .acc-tin.num{text-align:right;font-variant-numeric:tabular-nums;}
  .acc-edited{background:#FEF3C7 !important;}
  .acc-scorebox{text-align:center;padding:14px;border-radius:12px;background:var(--primary-light,#EDE9FE);margin-top:10px;}
  .acc-big{font-size:40px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;}
  .acc-sline{font-size:12px;color:var(--gray-600);margin-top:6px;}
  .acc-mini{font-size:11px;color:var(--gray-500);}
  .acc-logrow{display:grid;grid-template-columns:auto 1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:11px;align-items:center;}
  .acc-pill{font-size:10px;border-radius:5px;padding:2px 6px;background:var(--gray-100);color:var(--gray-600);}
  .acc-hint{font-size:11px;color:#92400E;background:#FEF3C7;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.6;}
  .acc-err{font-size:12px;color:#EF4444;background:#FEE2E2;border-radius:8px;padding:10px;margin-top:8px;}`;
  const st=document.createElement('style'); st.id='accStyle'; st.textContent=css; document.head.appendChild(st);
}

// ─── 메인 렌더 ───
function renderAccuracyLab(){
  _accInjectStyle();
  const el=document.getElementById('adminAccuracyPanel'); if(!el) return;
  el.innerHTML=`
    <div class="card acc-sec" style="padding:14px;">
      <div class="acc-lbl">① 거래처</div>
      <input class="acc-vinput" id="accVendorInput" placeholder="거래처명 입력 (예: 순창국제)" value="${_accVendor||''}">
      <div class="acc-chips" id="accVendorChips"></div>
    </div>
    <div class="card acc-sec" style="padding:14px;">
      <div class="acc-lbl">② 비교할 모델 (여러 개 선택 = 한 번에 비교)</div>
      <div class="acc-engines" id="accEngines"></div>
      <div class="acc-lbl" style="margin-top:10px;">②-2 사진 화질 (높을수록 작은 글자 잘 읽힘 · 비용 소폭 ↑)</div>
      <div class="acc-engines" id="accResSel"></div>
      <div class="acc-lbl" style="margin-top:10px;">③ 명세서 사진 (여러 장 OK)</div>
      <label class="acc-flabel" id="accFlabel">📷 사진 고르기<input type="file" accept="image/*" multiple id="accFileInput"></label>
      <button class="acc-btn" id="accAnalyzeBtn" style="margin-top:10px;">🤖 선택 모델 비교 분석</button>
    </div>
    <div id="accResult"></div>
    <div class="card acc-sec" style="padding:14px;">
      <div class="acc-lbl">📜 채점 로그</div>
      <div id="accLogs"></div>
    </div>`;
  _accRenderVendorChips(); _accRenderEngines(); _accRenderRes(); _accRenderCompare(); _accRenderLogs();
  const vi=document.getElementById('accVendorInput');
  if(vi) vi.addEventListener('input',()=>{ _accVendor=vi.value.trim(); _accRenderVendorChips(); });
  const fi=document.getElementById('accFileInput');
  if(fi) fi.addEventListener('change',()=>{ _accFileBuf=[...fi.files]; _accB64Cache=[]; const l=document.getElementById('accFlabel'); if(l){l.classList.toggle('has',!!fi.files.length); l.childNodes[0].textContent=fi.files.length?`📷 ${fi.files.length}장 선택됨`:'📷 사진 고르기';} });
  const ab=document.getElementById('accAnalyzeBtn');
  if(ab) ab.addEventListener('click', accCompareAnalyze);
}

function _accRenderVendorChips(){
  const box=document.getElementById('accVendorChips'); if(!box) return;
  const vs=_accGetVendors();
  box.innerHTML = vs.length ? vs.map(v=>`<span class="acc-chip ${v===_accVendor?'on':''}" data-v="${v}">${v}</span>`).join('')
    : '<span class="acc-mini">최근 채점한 거래처가 여기 모입니다</span>';
  box.querySelectorAll('.acc-chip').forEach(c=>c.addEventListener('click',()=>{
    _accVendor=c.dataset.v; const vi=document.getElementById('accVendorInput'); if(vi)vi.value=_accVendor; _accRenderVendorChips();
  }));
}
function _accRenderEngines(){
  const box=document.getElementById('accEngines'); if(!box) return;
  // 다중 선택 — 체크된 모델들을 한 번에 비교 (2026-06-09)
  box.innerHTML=ACC_ENGINES.map(e=>{
    const sel=_accSelectedEngines.includes(e.id);
    return `<span class="acc-eng ${sel?'on':''}" data-e="${e.id}">${sel?'☑':'☐'} ${e.name} (${e.cost})</span>`;
  }).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{
    const id=d.dataset.e;
    if(_accSelectedEngines.includes(id)) _accSelectedEngines=_accSelectedEngines.filter(x=>x!==id);
    else _accSelectedEngines=[..._accSelectedEngines, id];
    _accRenderEngines();
  }));
}
// 화질 선택 렌더 (2026-06-08)
function _accRenderRes(){
  const box=document.getElementById('accResSel'); if(!box) return;
  box.innerHTML=ACC_RES_OPTS.map(o=>`<span class="acc-eng ${o.v===_accRes?'on':''}" data-r="${o.v}" title="${o.meta}">${o.name}</span>`).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{ _accRes=parseInt(d.dataset.r,10); _accRenderRes(); }));
}

// ─── 여러 모델 동시(순차) 비교 분석 ───
async function accCompareAnalyze(){
  _accVendor=(document.getElementById('accVendorInput')?.value||'').trim();
  if(!_accVendor){ alert('거래처명을 먼저 입력하세요'); return; }
  if(!_accFileBuf.length){ alert('명세서 사진을 먼저 고르세요'); return; }
  if(!_accSelectedEngines.length){ alert('비교할 모델을 1개 이상 선택하세요'); return; }
  const btn=document.getElementById('accAnalyzeBtn');
  if(btn) btn.disabled=true;
  _accCompareResults={}; _accTruthSum=null;
  _accSaveVendor(_accVendor);
  try{
    // 이미지 b64는 1번만 만들어 모든 모델에 재사용 (재시도 때도 다시 안 읽음)
    if(!_accB64Cache.length){
      for(const f of _accFileBuf){ _accB64Cache.push(await accFileToB64(f)); }
    }
    // 선택 모델 순차 호출 (병렬이면 lastAIUsage 비용이 섞임 → 순차로 정확하게)
    for(const id of _accSelectedEngines){
      _accCompareResults[id]={pending:true};
      if(btn) btn.textContent=`${ACC_MODEL_MAP[id]?.name||id} 분석 중…`;
      _accRenderCompare();
      await _accRunOneModel(id, _accB64Cache);
      _accRenderCompare();
    }
  }catch(e){
    console.warn('[acc compare]', e);
  }finally{
    setLoad(false); // callGemini 재시도 중 켠 전체화면 로딩 끔
    if(btn){ btn.disabled=false; btn.textContent='🤖 선택 모델 비교 분석'; }
  }
}

// ─── 실패한(또는 특정) 모델 1개만 재시도 ───
async function accRetryModel(engineId){
  if(!_accB64Cache.length){ alert('사진을 다시 올린 뒤 분석하세요'); return; }
  _accCompareResults[engineId]={pending:true};
  _accRenderCompare();
  await _accRunOneModel(engineId, _accB64Cache);
  _accRenderCompare();
}

// ─── 비교 결과 렌더 (요약표 + 모델별 품목 펼침 + 실패 재시도) ───
function _accRenderCompare(){
  const box=document.getElementById('accResult'); if(!box) return;
  const ids=_accSelectedEngines.filter(id=>_accCompareResults[id]);
  if(!ids.length){ box.innerHTML=''; return; }
  const fmtN=x=>x==null?'-':Number(x).toLocaleString('ko-KR');
  // 요약 행들
  const rows=ids.map(id=>{
    const r=_accCompareResults[id]; const name=ACC_MODEL_MAP[id]?.name||id;
    if(r.pending) return `<tr><td><b>${name}</b></td><td colspan="4" class="acc-mini">⏳ 분석 중…</td></tr>`;
    if(!r.ok) return `<tr><td><b>${name}</b></td><td colspan="3" style="color:#EF4444;">❌ 실패: ${(r.error||'').slice(0,40)}</td>
      <td><button class="acc-retry" data-e="${id}" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--gray-300);background:#fff;cursor:pointer;">🔄 재시도</button></td></tr>`;
    // 정답 합계 입력됐으면 오차
    let diffCell='-';
    if(_accTruthSum!=null && r.sum!=null){
      const diff=r.sum-_accTruthSum;
      diffCell = diff===0 ? '<b style="color:#10B981;">정확 ✅</b>' : `<span style="color:#EF4444;">${diff>0?'+':''}${fmtN(diff)}</span>`;
    }
    return `<tr>
      <td><b>${name}</b></td>
      <td class="num" style="text-align:right;">${fmtN(r.sum)}</td>
      <td class="num" style="text-align:center;">${r.itemCount}개</td>
      <td class="num" style="text-align:right;">${r.cost!=null?r.cost.toFixed(1)+'원':'-'}</td>
      <td class="num" style="text-align:right;">${diffCell!=='-'?diffCell:(r.ms?(r.ms/1000).toFixed(1)+'초':'-')}</td>
    </tr>`;
  }).join('');
  // 모델별 품목 펼침
  const details=ids.map(id=>{
    const r=_accCompareResults[id]; if(!r||!r.ok||!r.items) return '';
    const name=ACC_MODEL_MAP[id]?.name||id;
    const li=r.items.map((it,i)=>`<tr><td>${i+1}</td><td>${(it.i||'').replace(/</g,'&lt;')}</td><td class="num" style="text-align:right;">${it.q==null?'-':it.q}</td><td class="num" style="text-align:right;">${fmtN(it.p)}</td></tr>`).join('');
    return `<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--gray-700);">${name} — 품목 ${r.items.length}개 펼쳐보기</summary>
      <table class="acc-tbl"><tr><th>No</th><th>품목</th><th class="num" style="text-align:right">수량</th><th class="num" style="text-align:right">합계</th></tr>${li}</table></details>`;
  }).join('');
  const truthVal=_accTruthSum==null?'':Number(_accTruthSum).toLocaleString('ko-KR');
  const diffHeader = _accTruthSum!=null ? '오차' : '소요시간';
  box.innerHTML=`<div class="card acc-sec" style="padding:14px;">
    <div class="acc-lbl">④ 모델 비교 결과</div>
    <table class="acc-tbl">
      <tr><th>모델</th><th class="num" style="text-align:right">합계</th><th class="num" style="text-align:center">품목수</th><th class="num" style="text-align:right">비용</th><th class="num" style="text-align:right">${diffHeader}</th></tr>
      ${rows}
    </table>
    <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
      <span class="acc-mini" style="min-width:96px;">실제 영수증 합계</span>
      <input class="acc-tin num" id="accTruthInput" value="${truthVal}" inputmode="numeric" placeholder="영수증 보고 입력 → 모델별 오차 자동" style="flex:1;">
    </div>
    <div class="acc-hint">영수증의 <b>실제 결제 합계</b>를 입력하면 위 표 오른쪽에 모델별 오차가 뜹니다. 합계 맞고 품목수 많은 모델이 잘 읽은 거예요. 품목 내용은 아래 펼쳐서 확인하세요.</div>
    ${details}
  </div>`;
  // 재시도 버튼
  box.querySelectorAll('.acc-retry').forEach(b=>b.addEventListener('click',()=>accRetryModel(b.dataset.e)));
  // 실제 합계 입력 → 오차 갱신
  const ti=document.getElementById('accTruthInput');
  if(ti) ti.addEventListener('input',()=>{
    if(typeof formatNumberInput==='function') formatNumberInput(ti);
    _accTruthSum = ti.value===''?null:Number(ti.value.replace(/[^0-9]/g,''));
    // 표만 다시 그리되 입력 포커스 유지 위해 최소 갱신
    _accRenderCompare();
    const ti2=document.getElementById('accTruthInput'); if(ti2){ ti2.focus(); const v=ti2.value; ti2.setSelectionRange(v.length,v.length); }
  });
}

function _accRenderLogs(){
  const el=document.getElementById('accLogs'); if(!el) return;
  const logs=_accGetLogs();
  if(!logs.length){ el.innerHTML='<div class="acc-mini" style="text-align:center;padding:10px;">아직 채점 기록이 없습니다.</div>'; return; }
  el.innerHTML=logs.map(l=>`<div class="acc-logrow"><span class="acc-mini">${l.t}</span>
    <span><b>${l.overall}%</b> <span class="acc-pill">${l.vendor||''} ${l.date||''}</span> <span class="acc-mini">${l.eng} 합${l.sum} 수${l.qty}</span></span>
    <span class="acc-mini">${l.cost}</span></div>`).join('');
}
