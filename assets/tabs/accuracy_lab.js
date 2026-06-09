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
let _accFileBuf=[];
// 사진별 분석 결과 누적 — 사진 1장 = 영수증 1개 (2026-06-09 사장님: 거래처 입력 X, 사진별 독립 분석·누적)
//   [{name, b64, truthSum, models:{engineId:{ok,pending,raw,items,cost,ms,sum,itemCount,error}}}]
let _accShots=[];
let _accStyleInjected=false;

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

// ─── 모델 1개 호출 → 결과 객체 반환 (호출부가 사진별로 저장) ───
//   공통 callGemini 재사용(ai_usage_logs 자동 기록). 실패해도 throw 안 하고 결과 객체로 → 한 모델 실패가 전체를 안 막음.
async function _accRunOneModel(b64list, engineId){
  const m = ACC_MODEL_MAP[engineId]; if(!m) return {ok:false, error:'알 수 없는 모델'};
  const parts=[{text:accBuildPrompt('')}]; // 거래처명 없이 분석 (측정실 — 사장님 입력 X)
  b64list.forEach(b=>parts.push({inline_data:{mime_type:'image/jpeg',data:b}}));
  const t0=Date.now();
  try{
    const raw=await callGemini(parts, m.timeout+(b64list.length-1)*5, 'accuracy_test', m.model, m.provider);
    const cost=(typeof lastAIUsage!=='undefined'&&lastAIUsage)?lastAIUsage.costWon:null; // 순차 호출이라 직전=이 모델
    const items=(raw && Array.isArray(raw.items))?raw.items:[];
    return {ok:true, raw, items, cost, ms:Date.now()-t0,
      sum:(raw&&raw.total_sum!=null)?raw.total_sum:null, itemCount:items.length};
  }catch(e){
    return {ok:false, error:(e&&e.message)||String(e), ms:Date.now()-t0};
  }
}

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
      <div class="acc-lbl">① 비교할 모델 (여러 개 선택 = 한 번에 비교)</div>
      <div class="acc-engines" id="accEngines"></div>
      <div class="acc-lbl" style="margin-top:10px;">①-2 사진 화질 (높을수록 작은 글자 잘 읽힘 · 비용 소폭 ↑)</div>
      <div class="acc-engines" id="accResSel"></div>
      <div class="acc-lbl" style="margin-top:10px;">② 명세서 사진 — 여러 장 = 각각 따로 분석돼 아래에 쌓임</div>
      <label class="acc-flabel" id="accFlabel">📷 사진 고르기<input type="file" accept="image/*" multiple id="accFileInput"></label>
      <div class="acc-mini" style="margin-top:6px;">거래처명은 입력 안 해도 됩니다. 사진 1장 = 영수증 1개로 따로 분석합니다.</div>
      <button class="acc-btn" id="accAnalyzeBtn" style="margin-top:10px;">🤖 사진별 비교 분석</button>
    </div>
    <div id="accResult"></div>`;
  _accRenderEngines(); _accRenderRes(); _accRenderCompare();
  const fi=document.getElementById('accFileInput');
  if(fi) fi.addEventListener('change',()=>{ _accFileBuf=[...fi.files]; const l=document.getElementById('accFlabel'); if(l){l.classList.toggle('has',!!fi.files.length); l.childNodes[0].textContent=fi.files.length?`📷 ${fi.files.length}장 선택됨`:'📷 사진 고르기';} });
  const ab=document.getElementById('accAnalyzeBtn');
  if(ab) ab.addEventListener('click', accCompareAnalyze);
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

// ─── 사진별 비교 분석 (사진 1장 = 영수증 1개, 각각 분석돼 누적) ───
async function accCompareAnalyze(){
  if(!_accFileBuf.length){ alert('명세서 사진을 먼저 고르세요'); return; }
  if(!_accSelectedEngines.length){ alert('비교할 모델을 1개 이상 선택하세요'); return; }
  const btn=document.getElementById('accAnalyzeBtn');
  if(btn) btn.disabled=true;
  _accShots=[];
  try{
    for(let fi=0; fi<_accFileBuf.length; fi++){
      const b64=await accFileToB64(_accFileBuf[fi]);
      const shot={name:_accFileBuf[fi].name||`사진 ${fi+1}`, b64, truthSum:null, models:{}};
      _accShots.push(shot);
      // 비교 세션 식별 — 같은 [비교 분석] 1회 = 같은 batch (DB에서 묶어 분석용)
      const batchId = shot.name + '|' + Date.now();
      shot._batch = batchId;
      // 한 사진의 선택 모델들을 동시(병렬) 호출 → 5분 대기 단축 (2026-06-09).
      //  ⚠️비용(cost_won 화면값)은 lastAIUsage 전역이라 병렬 시 섞일 수 있음(대략치).
      //   정확 비용은 ai_usage_logs에 각 호출이 정확히 기록됨(_logAIUsage) → CTO는 그걸로 분석.
      //  사진은 순차(동시 호출 폭주 시 503 ↑ 방지).
      _accSelectedEngines.forEach(id=>{ shot.models[id]={pending:true}; });
      if(btn) btn.textContent=`사진 ${fi+1}/${_accFileBuf.length} 분석 중… (${_accSelectedEngines.length}개 모델 동시)`;
      _accRenderCompare();
      await Promise.all(_accSelectedEngines.map(async id=>{
        const res = await _accRunOneModel([b64], id);
        shot.models[id]=res;
        _accRenderCompare();
        await _accSaveShotResult(shot, id); // 모델별 결과(품목·금액·합계) DB 저장 → CTO 정확도 분석
      }));
      _accRenderCompare();
    }
  }catch(e){
    console.warn('[acc compare]', e);
  }finally{
    setLoad(false); // callGemini 재시도 중 켠 전체화면 로딩 끔
    if(btn){ btn.disabled=false; btn.textContent='🤖 사진별 비교 분석'; }
  }
}

// ─── 모델별 분석 결과(품목·금액·합계 전체)를 accuracy_lab_logs에 저장 ───
//   CTO가 DB에서 vendor(사진)별·engine(모델)별 ai_raw를 꺼내 품목·합계 정확도 비교 (2026-06-09)
async function _accSaveShotResult(shot, engineId){
  const r=shot && shot.models ? shot.models[engineId] : null;
  if(!r || !r.ok || !r.raw) return;
  try{
    if(typeof sb==='undefined' || !sb) return;
    await sb.from('accuracy_lab_logs').insert({
      store_id: (typeof currentStore!=='undefined' && currentStore) ? currentStore.id : null,
      vendor: (shot.name||'') + (shot._batch?(' @'+shot._batch):''),
      receipt_date: (r.raw && r.raw.date) || null,
      engine: ACC_MODEL_MAP[engineId]?.name || engineId,
      ai_raw: r.raw,          // {items:[{i,q,p,...}], total_sum, ...} 통째 — 품목·금액·합계 분석용
      cost_won: r.cost
    });
  }catch(e){ console.warn('[accuracy_lab_logs] 저장 실패:', e); }
}

// ─── 특정 사진의 특정 모델만 재시도 (호출 실패 시) ───
async function accRetryShot(si, engineId){
  const shot=_accShots[si]; if(!shot||!shot.b64){ alert('사진을 다시 올린 뒤 분석하세요'); return; }
  shot.models[engineId]={pending:true};
  _accRenderCompare();
  try{
    shot.models[engineId]=await _accRunOneModel([shot.b64], engineId);
    await _accSaveShotResult(shot, engineId); // 재시도 성공분도 DB 저장
  } finally {
    setLoad(false); // callGemini가 재시도("2/4") 중 켠 전체화면 로딩 끔 — 안 끄면 분석 끝나도 화면 가림(무한로딩처럼 보임)
  }
  _accRenderCompare();
}

// ─── 비교 결과 렌더 (사진별 카드 누적: 사진 미리보기 + 모델 비교표 + 실제합계 + 재시도 + 품목 펼침) ───
function _accRenderCompare(){
  const box=document.getElementById('accResult'); if(!box) return;
  if(!_accShots.length){ box.innerHTML=''; return; }
  const fmtN=x=>x==null?'-':Number(x).toLocaleString('ko-KR');
  const cards=_accShots.map((shot,si)=>{
    const ids=_accSelectedEngines.filter(id=>shot.models[id]);
    const rows=ids.map(id=>{
      const r=shot.models[id]; const name=ACC_MODEL_MAP[id]?.name||id;
      if(r.pending) return `<tr><td><b>${name}</b></td><td colspan="4" class="acc-mini">⏳ 분석 중…</td></tr>`;
      if(!r.ok) return `<tr><td><b>${name}</b></td><td colspan="3" style="color:#EF4444;">❌ ${(r.error||'').slice(0,30)}</td>
        <td><button class="acc-retry" data-si="${si}" data-e="${id}" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--gray-300);background:#fff;cursor:pointer;">🔄</button></td></tr>`;
      let last = r.ms?(r.ms/1000).toFixed(1)+'초':'-';
      if(shot.truthSum!=null && r.sum!=null){
        const diff=r.sum-shot.truthSum;
        last = diff===0 ? '<b style="color:#10B981;">정확 ✅</b>' : `<span style="color:#EF4444;">${diff>0?'+':''}${fmtN(diff)}</span>`;
      }
      return `<tr>
        <td><b>${name}</b></td>
        <td class="num" style="text-align:right;">${fmtN(r.sum)}</td>
        <td class="num" style="text-align:center;">${r.itemCount}개</td>
        <td class="num" style="text-align:right;">${r.cost!=null?r.cost.toFixed(1)+'원':'-'}</td>
        <td class="num" style="text-align:right;">${last}</td>
      </tr>`;
    }).join('');
    const details=ids.map(id=>{
      const r=shot.models[id]; if(!r||!r.ok||!r.items) return '';
      const name=ACC_MODEL_MAP[id]?.name||id;
      const li=r.items.map((it,i)=>`<tr><td>${i+1}</td><td>${(it.i||'').replace(/</g,'&lt;')}</td><td class="num" style="text-align:right;">${it.q==null?'-':it.q}</td><td class="num" style="text-align:right;">${fmtN(it.p)}</td></tr>`).join('');
      return `<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--gray-700);">${name} 품목 ${r.items.length}개</summary>
        <table class="acc-tbl"><tr><th>No</th><th>품목</th><th class="num" style="text-align:right">수량</th><th class="num" style="text-align:right">합계</th></tr>${li}</table></details>`;
    }).join('');
    const diffHeader = shot.truthSum!=null ? '오차' : '시간';
    const truthVal=shot.truthSum==null?'':Number(shot.truthSum).toLocaleString('ko-KR');
    return `<div class="card acc-sec" style="padding:14px;">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <img src="data:image/jpeg;base64,${shot.b64}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--gray-200);flex-shrink:0;">
        <div class="acc-lbl" style="margin:0;">영수증 ${si+1} <span class="acc-mini">${(shot.name||'').replace(/</g,'')}</span></div>
      </div>
      <table class="acc-tbl">
        <tr><th>모델</th><th class="num" style="text-align:right">합계</th><th class="num" style="text-align:center">품목수</th><th class="num" style="text-align:right">비용</th><th class="num" style="text-align:right">${diffHeader}</th></tr>
        ${rows}
      </table>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <span class="acc-mini" style="min-width:96px;">실제 영수증 합계</span>
        <input class="acc-tin num acc-truth" data-si="${si}" value="${truthVal}" inputmode="numeric" placeholder="입력 → 모델별 오차 자동" style="flex:1;">
      </div>
      ${details}
    </div>`;
  }).join('');
  box.innerHTML=cards;
  // 재시도 버튼 (사진+모델 지정)
  box.querySelectorAll('.acc-retry').forEach(b=>b.addEventListener('click',()=>accRetryShot(+b.dataset.si, b.dataset.e)));
  // 실제 합계 입력 → 그 사진 오차 갱신
  box.querySelectorAll('.acc-truth').forEach(ti=>ti.addEventListener('input',()=>{
    if(typeof formatNumberInput==='function') formatNumberInput(ti);
    const si=+ti.dataset.si;
    _accShots[si].truthSum = ti.value===''?null:Number(ti.value.replace(/[^0-9]/g,''));
    _accRenderCompare();
    const ti2=document.querySelector(`.acc-truth[data-si="${si}"]`); if(ti2){ ti2.focus(); const v=ti2.value; ti2.setSelectionRange(v.length,v.length); }
  }));
}
