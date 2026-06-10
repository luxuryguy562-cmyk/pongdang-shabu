// ════════════════════════════════════════════════════════
// 영수증 정확도 측정실 (#admin 서브탭)
// 2026-06-10 전면 재설계 — 프롬프트 변형(A/B/C) 비교 실험실
//   사장님 결정: "모델은 안 바꿔도 됨. 프롬프트 문제. 이것저것 프롬프트 바꿔보자."
//   흐름: 채널(거래처/주류) 선택 → 비교할 프롬프트 변형 선택 → 사진 올림
//        → 사진 × 변형 동시 분석 → 실제합계 입력 → 변형별 오차 자동 + 품목 펼침
//   ★ 모델 = Gemini Flash 고정. 변형만 비교.
//   ★ 분석 결과(품목·금액·합계·보증금) 통째를 accuracy_lab_logs.ai_raw에 저장
//     → CTO가 DB에서 꺼내 본 어플 영수증처럼 한 줄씩 검수 (사장님: "DB는 본어플 찍히는 것처럼")
// ════════════════════════════════════════════════════════

// ─── 분석 채널 (사진 종류에 맞는 프롬프트 묶음 선택) ───
const ACC_CHANNELS = [
  {id:'vendor', name:'📦 거래처(공산품 등)', sample:'순창국제 거래명세서'},
  {id:'liquor', name:'🍶 주류(공병 보증금)',  sample:'대명주류 주류판매계산서'},
];
let _accChannel='vendor';

// ─── 프롬프트 변형 정의 ───
//   변형 A = 현재 실제 앱 프롬프트(buildReceiptPrompt) 그대로 = 기준선(baseline)
//   변형 B·C = 측정실 실험용(base + 추가 강화). 측정 후 이긴 변형만 common.js에 반영.
//   ⚠️ base는 항상 common.js 최신을 따라감(buildReceiptPrompt 호출) → 변형은 "추가분"만 책임.
function _accBaseLiquor(v){ return buildReceiptPrompt({ isLiquorMode:true, vendorName:v||'주류거래처' }); }
function _accBaseVendor(v){ return buildReceiptPrompt({ isVendorMode:true, vendorName:v||'거래처' }); }

// 주류 변형 B — 비주류 행·거래대금합계 구분 강화 (탄산가스 p=0, total_sum=거래대금합계)
function _accLiquorB(v){
  return _accBaseLiquor(v) + `

[변형B 추가 강화 — 반드시 지켜라]
- 탄산가스·생수 등 "비주류" 행: 공급가·부가세 칸이 0이면 p=0. 용기대만 찍힌 값은 deposit_in에 합산(p에 넣지 마라).
- total_sum = "거래대금합계" 줄의 값만. "매출합계"(=공급가액+부가세+용기보증금)를 total_sum에 쓰지 마라. 거래대금합계 = 매출합계 − 빈용기보증금.`;
}
// 주류 변형 C — 표 칸 위치(공급가|부가세|용기대|합계)를 좌표로 명시
function _accLiquorC(v){
  return _accBaseLiquor(v) + `

[변형C 추가 강화 — 표 칸 위치]
- 각 품목 줄의 숫자 칸 순서는 왼쪽부터: ①공급가 ②부가세 ③용기대(보증금) ④합계.
- p = ①공급가 + ②부가세 (두 칸 합). ③용기대·④합계 칸은 p에 절대 쓰지 마라.
- 예: "81,273 8,127 11,000 100,400" → p=81,273+8,127=89,400. (11,000=용기대 제외, 100,400=합계 제외)`;
}
// 거래처 변형 B — 금일합계 최우선(총합계=전미수 포함 무시) 강화
function _accVendorB(v){
  return _accBaseVendor(v) + `

[변형B 추가 강화 — 합계 함정]
- total_sum = "금일합계" 칸의 값만. "총합계"는 전미수(이전 외상)+금일합계라서 절대 total_sum에 쓰지 마라.
- "전미수"가 0보다 크면 총합계 ≠ 금일합계 — 이때 반드시 금일합계를 골라라.`;
}
// 거래처 변형 C — 금일합계 + 수량(BOX/EA) 강화 조합
function _accVendorC(v){
  return _accBaseVendor(v) + `

[변형C 추가 강화 — 합계+수량]
- total_sum = "금일합계" 칸. "총합계"(전미수 포함) 금지.
- 수량 q: BOX 칸이 0이면 EA 칸이 곧 수량. BOX≥1이면 q=BOX×단위. (예 단위20·BOX0·EA15 → q=15 / 단위20·BOX1·EA0 → q=20)
- 검산: 단가 × q = 합계 칸과 맞아야 함.`;
}

const ACC_VARIANTS = {
  vendor: {
    A: {name:'A 현재(기준)',     build:_accBaseVendor},
    B: {name:'B 금일합계강화',   build:_accVendorB},
    C: {name:'C 합계+수량강화',  build:_accVendorC},
  },
  liquor: {
    A: {name:'A 현재(기준)',     build:_accBaseLiquor},
    B: {name:'B 비주류·합계강화', build:_accLiquorB},
    C: {name:'C 칸위치명시',     build:_accLiquorC},
  },
};
let _accSelectedVariants=['A','B','C']; // 비교할 변형들 (기본 3개)

// 모델 = Gemini Flash 고정 (변형 비교가 목적 — 사장님: 모델 안 바꿈)
const ACC_FIXED_MODEL = {model:'gemini-2.5-flash', provider:'gemini', name:'Gemini Flash', timeout:35};

// 사진 화질 선택 (높을수록 작은 글자 잘 읽힘 · 입력 토큰만 늘어 비용 소폭 ↑)
const ACC_RES_OPTS = [
  {v:1280, name:'1280px', meta:'현재 기본'},
  {v:2000, name:'2000px', meta:'중간'},
  {v:2400, name:'2400px', meta:'고화질'},
];
let _accRes=2000;
let _accFileBuf=[];
// 사진별 분석 결과 누적 — 사진 1장 = 영수증 1개
//   [{name, b64, truthSum, channel, results:{variantId:{ok,pending,raw,items,cost,ms,sum,itemCount,error,depIn,depOut}}}]
let _accShots=[];
let _accStyleInjected=false;

// ─── 이미지 → base64 (화질 선택값으로 리사이즈) ───
function accFileToB64(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const cvs=document.createElement('canvas');
        let w=img.width,h=img.height; if(w>_accRes){h*=_accRes/w;w=_accRes;}
        cvs.width=w; cvs.height=h; cvs.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cvs.toDataURL('image/jpeg',0.85).split(',')[1]);
      };
      img.onerror=reject; img.src=e.target.result;
    };
    fr.onerror=reject; fr.readAsDataURL(file);
  });
}

// ─── 변형 1개 호출 → 결과 객체 반환 (모델 Gemini Flash 고정) ───
//   실패해도 throw 안 하고 결과 객체로 → 한 변형 실패가 전체를 안 막음.
async function _accRunOneVariant(b64list, channel, variantId){
  const vdef = ACC_VARIANTS[channel] && ACC_VARIANTS[channel][variantId];
  if(!vdef) return {ok:false, error:'알 수 없는 변형'};
  const m = ACC_FIXED_MODEL;
  const parts=[{text:vdef.build('')}]; // 측정실 — 거래처명 없이 분석
  b64list.forEach(b=>parts.push({inline_data:{mime_type:'image/jpeg',data:b}}));
  const t0=Date.now();
  try{
    const raw=await callGemini(parts, m.timeout+(b64list.length-1)*5, 'accuracy_test', m.model, m.provider);
    const cost=(typeof lastAIUsage!=='undefined'&&lastAIUsage)?lastAIUsage.costWon:null;
    const items=(raw && Array.isArray(raw.items))?raw.items:[];
    return {ok:true, raw, items, cost, ms:Date.now()-t0,
      sum:(raw&&raw.total_sum!=null)?raw.total_sum:null, itemCount:items.length,
      depIn:(raw&&raw.deposit_in!=null)?raw.deposit_in:null, depOut:(raw&&raw.deposit_out!=null)?raw.deposit_out:null};
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
  .acc-flabel{display:block;border:1.5px dashed var(--gray-300);border-radius:10px;padding:14px;text-align:center;font-size:13px;color:var(--gray-600);cursor:pointer;}
  .acc-flabel.has{border-color:var(--primary,#6D28D9);color:var(--primary,#6D28D9);background:var(--primary-light,#EDE9FE);}
  .acc-flabel input{display:none;}
  .acc-engines{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
  .acc-eng{font-size:11px;padding:5px 9px;border-radius:8px;border:1.5px solid var(--gray-200);cursor:pointer;}
  .acc-eng.on{border-color:var(--primary,#6D28D9);background:var(--primary-light,#EDE9FE);color:var(--primary,#6D28D9);font-weight:700;}
  .acc-btn{display:block;width:100%;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;background:var(--primary,#6D28D9);color:#fff;margin-top:4px;}
  .acc-btn:disabled{opacity:.55;}
  .acc-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;}
  .acc-tbl th,.acc-tbl td{padding:5px 4px;border-bottom:1px solid var(--gray-100);text-align:left;}
  .acc-tbl th{font-size:10px;color:var(--gray-500);font-weight:600;}
  .acc-tin{width:100%;border:1px solid transparent;border-radius:6px;padding:4px;font-size:12px;background:var(--gray-50,#F9FAFB);box-sizing:border-box;}
  .acc-tin:focus{border-color:var(--primary,#6D28D9);background:#fff;outline:none;}
  .acc-tin.num{text-align:right;font-variant-numeric:tabular-nums;}
  .acc-mini{font-size:11px;color:var(--gray-500);}
  .acc-hint{font-size:11px;color:#92400E;background:#FEF3C7;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.6;}
  .num{font-variant-numeric:tabular-nums;}`;
  const st=document.createElement('style'); st.id='accStyle'; st.textContent=css; document.head.appendChild(st);
}

// ─── 메인 렌더 ───
function renderAccuracyLab(){
  _accInjectStyle();
  const el=document.getElementById('adminAccuracyPanel'); if(!el) return;
  el.innerHTML=`
    <div class="card acc-sec" style="padding:14px;">
      <div class="acc-lbl">① 분석 채널 (사진 종류에 맞게)</div>
      <div class="acc-engines" id="accChannelSel"></div>
      <div class="acc-lbl" style="margin-top:10px;">② 비교할 프롬프트 변형 (여러 개 = 한 번에 비교)</div>
      <div class="acc-engines" id="accVariantSel"></div>
      <div class="acc-mini">모델은 Gemini Flash 고정. 변형만 비교합니다.</div>
      <div class="acc-lbl" style="margin-top:10px;">③ 사진 화질 (높을수록 작은 글자 잘 읽힘 · 비용 소폭 ↑)</div>
      <div class="acc-engines" id="accResSel"></div>
      <div class="acc-lbl" style="margin-top:10px;">④ 명세서 사진 — 여러 장 = 각각 따로 분석돼 아래에 쌓임</div>
      <label class="acc-flabel" id="accFlabel">📷 사진 고르기<input type="file" accept="image/*" multiple id="accFileInput"></label>
      <div class="acc-mini" style="margin-top:6px;">같은 채널 사진끼리 올리세요. 사진 1장 = 영수증 1개로 따로 분석합니다.</div>
      <button class="acc-btn" id="accAnalyzeBtn" style="margin-top:10px;">🤖 변형별 비교 분석</button>
      <div class="acc-hint">분석 결과(품목·금액·보증금)는 DB(accuracy_lab_logs)에 변형별로 저장됩니다. CTO가 읽고 검수합니다.</div>
    </div>
    <div id="accResult"></div>`;
  _accRenderChannel(); _accRenderVariants(); _accRenderRes(); _accRenderCompare();
  const fi=document.getElementById('accFileInput');
  if(fi) fi.addEventListener('change',()=>{ _accFileBuf=[...fi.files]; const l=document.getElementById('accFlabel'); if(l){l.classList.toggle('has',!!fi.files.length); l.childNodes[0].textContent=fi.files.length?`📷 ${fi.files.length}장 선택됨`:'📷 사진 고르기';} });
  const ab=document.getElementById('accAnalyzeBtn');
  if(ab) ab.addEventListener('click', accCompareAnalyze);
}

// 채널 선택 렌더 (단일 선택)
function _accRenderChannel(){
  const box=document.getElementById('accChannelSel'); if(!box) return;
  box.innerHTML=ACC_CHANNELS.map(c=>`<span class="acc-eng ${c.id===_accChannel?'on':''}" data-c="${c.id}" title="${c.sample}">${c.name}</span>`).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{ _accChannel=d.dataset.c; _accRenderChannel(); _accRenderVariants(); }));
}
// 변형 선택 렌더 (현재 채널의 변형들 — 다중 선택)
function _accRenderVariants(){
  const box=document.getElementById('accVariantSel'); if(!box) return;
  const vs=ACC_VARIANTS[_accChannel]||{};
  box.innerHTML=Object.keys(vs).map(id=>{
    const sel=_accSelectedVariants.includes(id);
    return `<span class="acc-eng ${sel?'on':''}" data-v="${id}">${sel?'☑':'☐'} ${vs[id].name}</span>`;
  }).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{
    const id=d.dataset.v;
    if(_accSelectedVariants.includes(id)) _accSelectedVariants=_accSelectedVariants.filter(x=>x!==id);
    else _accSelectedVariants=[..._accSelectedVariants, id];
    _accRenderVariants();
  }));
}
// 화질 선택 렌더
function _accRenderRes(){
  const box=document.getElementById('accResSel'); if(!box) return;
  box.innerHTML=ACC_RES_OPTS.map(o=>`<span class="acc-eng ${o.v===_accRes?'on':''}" data-r="${o.v}" title="${o.meta}">${o.name}</span>`).join('');
  box.querySelectorAll('.acc-eng').forEach(d=>d.addEventListener('click',()=>{ _accRes=parseInt(d.dataset.r,10); _accRenderRes(); }));
}

// ─── 사진별 변형 비교 분석 (사진 1장 = 영수증 1개, 변형별로 분석돼 누적) ───
async function accCompareAnalyze(){
  if(!_accFileBuf.length){ alert('명세서 사진을 먼저 고르세요'); return; }
  if(!_accSelectedVariants.length){ alert('비교할 변형을 1개 이상 선택하세요'); return; }
  const btn=document.getElementById('accAnalyzeBtn');
  if(btn) btn.disabled=true;
  _accShots=[];
  const variants=_accSelectedVariants.slice();
  const channel=_accChannel;
  try{
    for(let fi=0; fi<_accFileBuf.length; fi++){
      const b64=await accFileToB64(_accFileBuf[fi]);
      const shot={name:_accFileBuf[fi].name||`사진 ${fi+1}`, b64, truthSum:null, channel, results:{}};
      _accShots.push(shot);
      const batchId = shot.name + '|' + Date.now();
      shot._batch = batchId;
      variants.forEach(id=>{ shot.results[id]={pending:true}; });
      if(btn) btn.textContent=`사진 ${fi+1}/${_accFileBuf.length} 분석 중… (변형 ${variants.length}개 동시)`;
      _accRenderCompare();
      // 한 사진의 변형들을 동시(병렬) 호출 → 대기 단축. 사진은 순차(503 폭주 방지).
      await Promise.all(variants.map(async id=>{
        const res = await _accRunOneVariant([b64], channel, id);
        shot.results[id]=res;
        _accRenderCompare();
        await _accSaveShotResult(shot, id);
      }));
      _accRenderCompare();
    }
  }catch(e){
    console.warn('[acc compare]', e);
  }finally{
    setLoad(false);
    if(btn){ btn.disabled=false; btn.textContent='🤖 변형별 비교 분석'; }
  }
}

// ─── 변형별 분석 결과(품목·금액·합계·보증금 전체)를 accuracy_lab_logs에 저장 ───
//   engine 칸에 "Gemini Flash | 채널:변형X" 박아 변형 구분. CTO가 DB에서 꺼내 본 어플 영수증처럼 검수.
async function _accSaveShotResult(shot, variantId){
  const r=shot && shot.results ? shot.results[variantId] : null;
  if(!r || !r.ok || !r.raw) return;
  const vname=(ACC_VARIANTS[shot.channel]&&ACC_VARIANTS[shot.channel][variantId])?ACC_VARIANTS[shot.channel][variantId].name:variantId;
  try{
    if(typeof sb==='undefined' || !sb) return;
    await sb.from('accuracy_lab_logs').insert({
      store_id: (typeof currentStore!=='undefined' && currentStore) ? currentStore.id : null,
      vendor: (shot.name||'') + (shot._batch?(' @'+shot._batch):''),
      receipt_date: (r.raw && r.raw.date) || null,
      engine: `${ACC_FIXED_MODEL.name} | ${shot.channel}:${vname}`,
      ai_raw: r.raw,          // {items:[{i,q,p,...}], total_sum, deposit_in, deposit_out, ...} 통째
      cost_won: r.cost
    });
  }catch(e){ console.warn('[accuracy_lab_logs] 저장 실패:', e); }
}

// ─── 특정 사진의 특정 변형만 재시도 (호출 실패 시) ───
async function accRetryShot(si, variantId){
  const shot=_accShots[si]; if(!shot||!shot.b64){ alert('사진을 다시 올린 뒤 분석하세요'); return; }
  shot.results[variantId]={pending:true};
  _accRenderCompare();
  try{
    shot.results[variantId]=await _accRunOneVariant([shot.b64], shot.channel, variantId);
    await _accSaveShotResult(shot, variantId);
  } finally {
    setLoad(false);
  }
  _accRenderCompare();
}

// ─── 비교 결과 렌더 (사진별 카드 누적: 미리보기 + 변형 비교표 + 실제합계 + 재시도 + 품목 펼침) ───
function _accRenderCompare(){
  const box=document.getElementById('accResult'); if(!box) return;
  if(!_accShots.length){ box.innerHTML=''; return; }
  const fmtN=x=>x==null?'-':Number(x).toLocaleString('ko-KR');
  const cards=_accShots.map((shot,si)=>{
    const vdefs=ACC_VARIANTS[shot.channel]||{};
    const ids=Object.keys(shot.results);
    const isLiquor=shot.channel==='liquor';
    const rows=ids.map(id=>{
      const r=shot.results[id]; const name=(vdefs[id]&&vdefs[id].name)||id;
      if(r.pending) return `<tr><td><b>${name}</b></td><td colspan="${isLiquor?5:4}" class="acc-mini">⏳ 분석 중…</td></tr>`;
      if(!r.ok) return `<tr><td><b>${name}</b></td><td colspan="${isLiquor?4:3}" style="color:#EF4444;">❌ ${(r.error||'').slice(0,28)}</td>
        <td><button class="acc-retry" data-si="${si}" data-v="${id}" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--gray-300);background:#fff;cursor:pointer;">🔄</button></td></tr>`;
      let last = r.ms?(r.ms/1000).toFixed(1)+'초':'-';
      if(shot.truthSum!=null && r.sum!=null){
        const diff=r.sum-shot.truthSum;
        last = diff===0 ? '<b style="color:#10B981;">정확 ✅</b>' : `<span style="color:#EF4444;">${diff>0?'+':''}${fmtN(diff)}</span>`;
      }
      const depCol = isLiquor ? `<td class="num" style="text-align:right;">${r.depIn!=null?fmtN(r.depIn):'-'}/${r.depOut!=null?fmtN(r.depOut):'-'}</td>` : '';
      return `<tr>
        <td><b>${name}</b></td>
        <td class="num" style="text-align:right;">${fmtN(r.sum)}</td>
        <td class="num" style="text-align:center;">${r.itemCount}개</td>
        ${depCol}
        <td class="num" style="text-align:right;">${r.cost!=null?r.cost.toFixed(1)+'원':'-'}</td>
        <td class="num" style="text-align:right;">${last}</td>
      </tr>`;
    }).join('');
    const details=ids.map(id=>{
      const r=shot.results[id]; if(!r||!r.ok||!r.items) return '';
      const name=(vdefs[id]&&vdefs[id].name)||id;
      const li=r.items.map((it,i)=>`<tr><td>${i+1}</td><td>${(it.i||'').replace(/</g,'&lt;')}</td><td class="num" style="text-align:right;">${it.q==null?'-':it.q}</td><td class="num" style="text-align:right;">${fmtN(it.p)}</td></tr>`).join('');
      const depLine = isLiquor ? `<div class="acc-mini" style="margin-top:4px;">보증금 입금 ${fmtN(r.depIn)} · 빈병 회수 ${fmtN(r.depOut)}</div>` : '';
      return `<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--gray-700);">${name} 품목 ${r.items.length}개</summary>
        <table class="acc-tbl"><tr><th>No</th><th>품목</th><th class="num" style="text-align:right">수량</th><th class="num" style="text-align:right">합계</th></tr>${li}</table>${depLine}</details>`;
    }).join('');
    const diffHeader = shot.truthSum!=null ? '오차' : '시간';
    const depHeader = isLiquor ? `<th class="num" style="text-align:right">입금/회수</th>` : '';
    const truthVal=shot.truthSum==null?'':Number(shot.truthSum).toLocaleString('ko-KR');
    const chLabel=(ACC_CHANNELS.find(c=>c.id===shot.channel)||{}).name||shot.channel;
    return `<div class="card acc-sec" style="padding:14px;">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <img src="data:image/jpeg;base64,${shot.b64}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--gray-200);flex-shrink:0;">
        <div class="acc-lbl" style="margin:0;">영수증 ${si+1} <span class="acc-mini">${(shot.name||'').replace(/</g,'')} · ${chLabel}</span></div>
      </div>
      <table class="acc-tbl">
        <tr><th>변형</th><th class="num" style="text-align:right">합계</th><th class="num" style="text-align:center">품목수</th>${depHeader}<th class="num" style="text-align:right">비용</th><th class="num" style="text-align:right">${diffHeader}</th></tr>
        ${rows}
      </table>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <span class="acc-mini" style="min-width:96px;">실제 영수증 합계</span>
        <input class="acc-tin num acc-truth" data-si="${si}" value="${truthVal}" inputmode="numeric" placeholder="입력 → 변형별 오차 자동" style="flex:1;">
      </div>
      ${details}
    </div>`;
  }).join('');
  box.innerHTML=cards;
  box.querySelectorAll('.acc-retry').forEach(b=>b.addEventListener('click',()=>accRetryShot(+b.dataset.si, b.dataset.v)));
  box.querySelectorAll('.acc-truth').forEach(ti=>ti.addEventListener('input',()=>{
    if(typeof formatNumberInput==='function') formatNumberInput(ti);
    const si=+ti.dataset.si;
    _accShots[si].truthSum = ti.value===''?null:Number(ti.value.replace(/[^0-9]/g,''));
    _accRenderCompare();
    const ti2=document.querySelector(`.acc-truth[data-si="${si}"]`); if(ti2){ ti2.focus(); const v=ti2.value; ti2.setSelectionRange(v.length,v.length); }
  }));
}
