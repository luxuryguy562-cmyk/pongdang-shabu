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

const ACC_ENGINES = [
  {id:'gemini',name:'Gemini 2.5 Flash',meta:'구글 · 현재 사용',cost:'~4원/장',tag:'연결됨',cls:'acc-tag-ok',on:true},
  {id:'gemini-pro',name:'Gemini 2.5 Pro',meta:'구글 · 상위 모델',cost:'~15~30원/장',tag:'연결됨',cls:'acc-tag-ok',on:true},
  {id:'gpt4o',name:'GPT-4o',meta:'OpenAI · 고정밀(비쌈)',cost:'~27원/장',tag:'연결됨',cls:'acc-tag-ok',on:true},
  {id:'clova-doc',name:'클로바 문서전용',meta:'네이버 · 표 인식',tag:'키 발급 필요',cls:'acc-tag-key',on:false},
  {id:'upstage',name:'업스테이지',meta:'한국 문서 특화',tag:'키 발급 필요',cls:'acc-tag-key',on:false},
];
// 사진 화질 선택 (높을수록 작은 글자 잘 읽힘 · 입력 토큰만 늘어 비용 소폭 ↑) — 2026-06-08
const ACC_RES_OPTS = [
  {v:1280, name:'1280px', meta:'현재 기본'},
  {v:2000, name:'2000px', meta:'중간'},
  {v:2400, name:'2400px', meta:'고화질'},
];
let _accRes=1280;
let _accCurEngine='gemini';
let _accVendor='';
let _accFileBuf=[];
let _accOrig=null;     // AI 원본 (정확도 비교 기준)
let _accCur=null;      // 사장님 정정본 (= 정답)
let _accRawFull=null;  // AI 응답 통째 (total_supply/total_tax 포함 — DB 저장용)
let _accLogId=null;    // 분석 직후 자동저장된 DB 행 id (채점 시 update용)
let _accLastCost=null;
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

// ─── 진짜 Gemini 호출 (공통 callGemini 재사용 → ai_usage_logs 자동 기록) ───
async function accCallGemini(b64list){
  const parts=[{text:accBuildPrompt(_accVendor)}];
  b64list.forEach(b=>parts.push({inline_data:{mime_type:'image/jpeg',data:b}}));
  // 측정실 엔진 선택 — gemini(싸고 빠름) vs gpt4o(고정밀·비쌈) 비교용
  const isGpt = _accCurEngine==='gpt4o';
  const model = isGpt ? 'gpt-4o' : (_accCurEngine==='gemini-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash');
  const provider = isGpt ? 'gpt' : 'gemini';
  const raw=await callGemini(parts, 30+(b64list.length-1)*5, 'accuracy_test', model, provider);
  const cost=(typeof lastAIUsage!=='undefined'&&lastAIUsage)?lastAIUsage.costWon:null;
  return {raw, cost};
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
      <div class="acc-lbl">② 분석 엔진</div>
      <div class="acc-engines" id="accEngines"></div>
      <div class="acc-lbl" style="margin-top:10px;">②-2 사진 화질 (높을수록 작은 글자 잘 읽힘 · 비용 소폭 ↑)</div>
      <div class="acc-engines" id="accResSel"></div>
      <div class="acc-lbl" style="margin-top:10px;">③ 명세서 사진 (여러 장 OK)</div>
      <label class="acc-flabel" id="accFlabel">📷 사진 고르기<input type="file" accept="image/*" multiple id="accFileInput"></label>
      <button class="acc-btn" id="accAnalyzeBtn" style="margin-top:10px;">🤖 AI 분석</button>
    </div>
    <div id="accResult"></div>
    <div class="card acc-sec" style="padding:14px;">
      <div class="acc-lbl">📜 채점 로그</div>
      <div id="accLogs"></div>
    </div>`;
  _accRenderVendorChips(); _accRenderEngines(); _accRenderRes(); _accRenderResult(); _accRenderLogs();
  const vi=document.getElementById('accVendorInput');
  if(vi) vi.addEventListener('input',()=>{ _accVendor=vi.value.trim(); _accRenderVendorChips(); });
  const fi=document.getElementById('accFileInput');
  if(fi) fi.addEventListener('change',()=>{ _accFileBuf=[...fi.files]; const l=document.getElementById('accFlabel'); if(l){l.classList.toggle('has',!!fi.files.length); l.childNodes[0].textContent=fi.files.length?`📷 ${fi.files.length}장 선택됨`:'📷 사진 고르기';} });
  const ab=document.getElementById('accAnalyzeBtn');
  if(ab) ab.addEventListener('click', accAnalyze);
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
  box.innerHTML=ACC_ENGINES.map(e=>`<span class="acc-eng ${e.id===_accCurEngine?'on':''} ${e.on?'':'off'}" data-e="${e.id}" title="${e.meta}">${e.name}${e.cost?' ('+e.cost+')':''}</span>`).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{
    const e=ACC_ENGINES.find(x=>x.id===d.dataset.e);
    if(!e.on){ alert(e.name+'\n\n키(접속 열쇠) 발급 후 연결됩니다.'); return; }
    _accCurEngine=e.id; _accRenderEngines();
  }));
}
// 화질 선택 렌더 (2026-06-08)
function _accRenderRes(){
  const box=document.getElementById('accResSel'); if(!box) return;
  box.innerHTML=ACC_RES_OPTS.map(o=>`<span class="acc-eng ${o.v===_accRes?'on':''}" data-r="${o.v}" title="${o.meta}">${o.name}</span>`).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{ _accRes=parseInt(d.dataset.r,10); _accRenderRes(); }));
}

// ─── AI 분석 ───
async function accAnalyze(){
  _accVendor=(document.getElementById('accVendorInput')?.value||'').trim();
  if(!_accVendor){ alert('거래처명을 먼저 입력하세요'); return; }
  if(!_accFileBuf.length){ alert('명세서 사진을 먼저 고르세요'); return; }
  const btn=document.getElementById('accAnalyzeBtn');
  if(btn){ btn.disabled=true; btn.textContent='분석 중…'; }
  try{
    const b64s=[]; for(const f of _accFileBuf){ b64s.push(await accFileToB64(f)); }
    const {raw, cost}=await accCallGemini(b64s);
    _accRawFull = raw; // AI 원본 통째 보관 (공급가·세액 포함 → DB 저장)
    _accOrig = { date:raw.date||'', total_sum:raw.total_sum, total_supply:raw.total_supply??null, total_tax:raw.total_tax??null, items:(raw.items||[]).map(it=>({i:it.i,u:it.u,q:it.q,p:it.p})) };
    _accCur = JSON.parse(JSON.stringify(_accOrig));
    _accLastCost = cost;
    _accSaveVendor(_accVendor);
    await _accAutoSave(); // 분석 직후 DB 자동 저장 (채점 전 — CTO가 스샷 없이 AI 원본 확인)
    await _accLoadPastItems(); // 과거 품목 로드 → 품목 칸 자동완성(원터치 수정)
    _accRenderResult();
    _accAutoSave(); // 백그라운드 자동 저장 (await X — 화면 로딩 안 막음)
  }catch(e){
    const r=document.getElementById('accResult');
    if(r) r.innerHTML=`<div class="card acc-sec" style="padding:14px;"><div class="acc-err">⚠️ 분석 실패: ${(e&&e.message)||''}<br><span class="acc-mini">중계서버가 막거나 사진이 너무 큰 경우입니다.</span></div></div>`;
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='🤖 AI 분석'; }
  }
}

// ─── 결과 표 (편집 가능) + 채점 버튼 ───
function _accRenderResult(){
  const box=document.getElementById('accResult'); if(!box) return;
  if(!_accCur){ box.innerHTML=''; return; }
  const rows=_accCur.items.map((it,i)=>`<tr>
    <td>${i+1}</td>
    <td><input class="acc-tin" data-r="${i}" data-f="i" value="${(it.i||'').replace(/"/g,'&quot;')}" list="accPastItems" autocomplete="off"></td>
    <td><input class="acc-tin num" data-r="${i}" data-f="q" value="${it.q==null?'':it.q}" inputmode="numeric"></td>
    <td><input class="acc-tin num" data-r="${i}" data-f="p" value="${it.p==null?'':Number(it.p).toLocaleString('ko-KR')}" inputmode="numeric"></td>
  </tr>`).join('');
  box.innerHTML=`<div class="card acc-sec" style="padding:14px;">${_accDatalistHtml()}
    <div class="acc-lbl">④ AI가 읽은 결과 — 틀린 칸을 고치세요 (고친 만큼 노란색)${_accPastItems.length?` <span class="acc-mini">· 품목 칸 누르면 이 거래처 과거 품목 ${_accPastItems.length}개 자동완성</span>`:''}</div>
    <table class="acc-tbl"><tr><th>No</th><th>품목</th><th class="num" style="text-align:right">수량</th><th class="num" style="text-align:right">합계</th></tr>${rows}</table>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
      <span class="acc-mini" style="min-width:64px;">영수증 합계</span>
      <input class="acc-tin num" data-f="total" value="${_accCur.total_sum==null?'':Number(_accCur.total_sum).toLocaleString('ko-KR')}" inputmode="numeric" style="flex:1;">
    </div>
    <div class="acc-hint">AI가 읽은 그대로입니다. 영수증 원본과 비교해 <b>틀린 칸만</b> 고치세요. 고친 개수 = AI가 틀린 개수 = 정확도.</div>
    <button class="acc-btn acc-btn2" id="accScoreBtn" style="margin-top:10px;">✅ 채점 &amp; 정답 저장</button>
    <div id="accScoreBox"></div>
  </div>`;
  box.querySelectorAll('.acc-tin').forEach(inp=>inp.addEventListener('input',()=>{
    const f=inp.dataset.f;
    // 금액(합계·영수증합계)은 세 자리 쉼표 자동 (헌법 7조 — fmt/formatNumberInput 재사용). 수량은 쉼표 X.
    if((f==='p'||f==='total') && typeof formatNumberInput==='function') formatNumberInput(inp);
    if(f==='total'){ _accCur.total_sum = inp.value===''?null:Number(inp.value.replace(/[^0-9]/g,'')); }
    else { const r=+inp.dataset.r; _accCur.items[r][f] = (f==='i')?inp.value : (inp.value===''?null:Number(inp.value.replace(/[^0-9]/g,''))); }
    // 정정 표시
    const orig = (f==='total') ? _accOrig.total_sum : _accOrig.items[+inp.dataset.r][f];
    const cur = (f==='total') ? _accCur.total_sum : _accCur.items[+inp.dataset.r][f];
    const changed = (f==='i') ? (String(orig)!==String(cur)) : (Number(orig)!==Number(cur));
    inp.classList.toggle('acc-edited', changed);
  }));
  const sb2=document.getElementById('accScoreBtn');
  if(sb2) sb2.addEventListener('click', accScore);
}

// ─── 분석 직후 자동 저장 (채점 없이도 CTO가 DB로 AI 원본 확인 — 2026-06-04) ───
async function _accAutoSave(){
  _accLogId = null;
  try{
    if(typeof sb==='undefined' || !sb) return;
    const {data, error} = await sb.from('accuracy_lab_logs').insert({
      store_id: (typeof currentStore!=='undefined' && currentStore) ? currentStore.id : null,
      vendor: _accVendor, receipt_date: (_accOrig && _accOrig.date) || null,
      engine: ACC_ENGINES.find(e=>e.id===_accCurEngine).name + ' @' + _accRes + 'px',
      ai_raw: _accRawFull, corrected: null, cost_won: _accLastCost
    }).select('id').single();
    if(!error && data) _accLogId = data.id;
  }catch(e){ console.warn('[accuracy_lab_logs] 자동저장 실패:', e); }
}

// ─── 채점 (AI 원본 vs 사장님 정정본) ───
function accScore(){
  if(!_accOrig||!_accCur) return;
  const n=_accCur.items.length;
  let qOk=0,nOk=0;
  _accCur.items.forEach((it,i)=>{
    const o=_accOrig.items[i]||{};
    if(Number(o.q)===Number(it.q)) qOk++;
    if(accNameMatch(o.i,it.i)) nOk++;
  });
  const sumOk = Number(_accOrig.total_sum)===Number(_accCur.total_sum);
  const overall = Math.round(((sumOk?1:0)*0.4 + (qOk/n)*0.4 + (nOk/n)*0.2)*100);
  const date=_accCur.date||'(날짜미상)';
  _accSaveAnswer(_accVendor, date, _accCur);
  // 채점 결과 저장 — 분석 때 자동저장된 행(_accLogId) 있으면 update, 없으면 insert (2026-06-04)
  try{
    if(typeof sb!=='undefined' && sb){
      const payload = { corrected:_accCur, score_overall:overall, score_sum:sumOk, score_qty:`${qOk}/${n}`, score_name:`${nOk}/${n}` };
      if(_accLogId){
        sb.from('accuracy_lab_logs').update(payload).eq('id',_accLogId).then(({error})=>{ if(error) console.warn('[accuracy_lab_logs] update 실패:', error.message); });
      } else {
        sb.from('accuracy_lab_logs').insert(Object.assign({
          store_id: (typeof currentStore!=='undefined' && currentStore) ? currentStore.id : null,
          vendor:_accVendor, receipt_date:date, engine:ACC_ENGINES.find(e=>e.id===_accCurEngine).name,
          ai_raw:_accRawFull, cost_won:_accLastCost
        }, payload)).then(({error})=>{ if(error) console.warn('[accuracy_lab_logs] insert 실패:', error.message); });
      }
    }
  }catch(e){ console.warn('[accuracy_lab_logs] 예외:', e); }
  _accAddLog({t:new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
    eng:ACC_ENGINES.find(e=>e.id===_accCurEngine).name, vendor:_accVendor, date, overall,
    sum:sumOk?'O':'X', qty:`${qOk}/${n}`, name:`${nOk}/${n}`, cost:_accLastCost!=null?_accLastCost.toFixed(1)+'원':'-'});
  const box=document.getElementById('accScoreBox');
  if(box){
    const col = overall>=90?'#10B981':overall>=70?'#F59E0B':'#EF4444';
    box.innerHTML=`<div class="acc-scorebox">
      <div class="acc-big" style="color:${col};">${overall}<span style="font-size:18px;">%</span></div>
      <div class="acc-sline">${_accVendor} ${date} · ${ACC_ENGINES.find(e=>e.id===_accCurEngine).name}<br>
        합계 ${sumOk?'✅':'❌'} · 수량 <b>${qOk}/${n}행</b> 정확 · 품목 <b>${nOk}/${n}행</b><br>
        <span class="acc-mini">정답으로 저장됨 — 나중에 다른 엔진으로 같은 명세서 채점하면 비교됩니다</span></div>
    </div>`;
  }
  _accRenderLogs();
}

function _accRenderLogs(){
  const el=document.getElementById('accLogs'); if(!el) return;
  const logs=_accGetLogs();
  if(!logs.length){ el.innerHTML='<div class="acc-mini" style="text-align:center;padding:10px;">아직 채점 기록이 없습니다.</div>'; return; }
  el.innerHTML=logs.map(l=>`<div class="acc-logrow"><span class="acc-mini">${l.t}</span>
    <span><b>${l.overall}%</b> <span class="acc-pill">${l.vendor||''} ${l.date||''}</span> <span class="acc-mini">${l.eng} 합${l.sum} 수${l.qty}</span></span>
    <span class="acc-mini">${l.cost}</span></div>`).join('');
}
