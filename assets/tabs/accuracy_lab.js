// ════════════════════════════════════════════════════════
// 영수증 정확도 측정실 (#admin 서브탭) — 2026-05-28 신설
// 명세서 사진 업로드 → 진짜 Gemini(callGemini 재사용) → 답지 1:1 채점
// 답지·로그는 브라우저 localStorage (DB 도입은 다음 단계)
// ════════════════════════════════════════════════════════

// ─── 거래처 분석 프롬프트 (receipt.js 거래처 모드와 동일) ───
const ACC_PROMPT = `한국 영수증을 JSON으로만 응답. 설명·주석 X.
[모드:거래처] vendor="순창국제" 이미 선택. 영수증 1장 = 같은 날짜.
[BOX/EA] q=(BOX×단위)+EA. ⚠️ BOX=0이면 단위 무시, EA가 q.
  · 단위20·BOX1·EA10→q=30
  · 단위8·BOX1·EA0→q=8
  · 단위40·BOX0·EA5→q=5  ← BOX 0
  · 단위12·BOX0·EA5→q=5  ← BOX 0
[멀티페이지] 사진 여러 장 = 같은 영수증 다른 페이지. 모든 행 items 통합. date·total_sum 1번만.

[응답]
{"date":"YYYY-MM-DD","items":[{i,u,q,p} 행 배열],"total_sum":영수증 박스값(정수,없으면null),"page_info":{"current":N,"total":M}}

[필드]
- i:품목명
- u:단가 (없으면 null)
- q:수량 — BOX/EA 정확히 적용. BOX 0 = EA만.
- p:합계 컬럼 인쇄값 그대로 정수. u×q 계산 X — 1~2원 차이도 인쇄 우선

[규칙]
- 합계행·소계·부가세·할인전·외상행·용기보증금 = 제외
- 숫자 쉼표·원 제거, 음수·빈배열 X. 흐릿해도 근접 추정
- total_sum 우선순위: 금일합계>합계액>결제금액. 전미수·총합계·잔액·누계 무시

[예시]
{"date":"2026-04-09","items":[{"i":"위즈복대-날치알 500g","u":9400,"q":30,"p":282000},{"i":"넙적분모자 250g","u":1100,"q":5,"p":5500}],"total_sum":1416049,"page_info":{"current":1,"total":2}}`;

// ─── 답지 (순창국제 6건, 사장님 정정 반영 2026-05-28) ───
const ACC_SHEETS = [
  {id:'①',date:'2026-05-26',pages:1,totalSum:190100,complete:true,items:[
    {no:1,name:'샌드위치 피쉬볼-세미원 500g',u:12,b:0,e:10,qty:10,price:5750,sum:57500},
    {no:2,name:'넙적분모자(야만) 훠궈분 250g',u:40,b:0,e:10,qty:10,price:1100,sum:11000},
    {no:3,name:'연근모양 분모자 500g',u:20,b:0,e:10,qty:10,price:2151,sum:21500},
    {no:4,name:'(흑백)공모양분모자/판다 500g',u:20,b:0,e:7,qty:7,price:3300,sum:23100},
    {no:5,name:'부산어묵 나무꼬치-오양 960g',u:10,b:1,e:0,qty:10,price:6500,sum:65000},
    {no:6,name:'택배비B',u:1,b:0,e:3,qty:3,price:4000,sum:12000},
  ]},
  {id:'②',date:'2026-01-22',pages:2,totalSum:1272099,complete:false,
    note:'1페이지(1~16행) 흐림 — 한 페이지씩 따로 재촬영 후 채점.',items:[]},
  {id:'③',date:'2026-01-29',pages:1,totalSum:283000,complete:true,items:[
    {no:1,name:'⑥어두부완자(코리아) 魚豆腐 400g',u:20,b:0,e:10,qty:10,price:2750,sum:27500},
    {no:2,name:'물고기모양어묵 魚豆腐 1kg',u:10,b:0,e:2,qty:2,price:7800,sum:15600},
    {no:3,name:'아만일자 냉장 뉴진면(샤브면) 250g',u:40,b:0,e:10,qty:10,price:1500,sum:15000},
    {no:4,name:'백목이버섯 白木耳 1kg',u:6,b:0,e:2,qty:2,price:13500,sum:27000},
    {no:5,name:'치즈떡(요리인) 1kg',u:8,b:0,e:4,qty:4,price:3700,sum:14800},
    {no:6,name:'고구마떡(요리인) 1kg',u:8,b:0,e:3,qty:3,price:3700,sum:11100},
    {no:7,name:'부산어묵 나무꼬치-오양 960g',u:10,b:1,e:0,qty:10,price:6500,sum:65000},
    {no:8,name:'구정선물/영광굴비',u:1,b:1,e:0,qty:0,price:0,sum:0},
    {no:9,name:'마향주이 텅죠유 1.8L 마유',u:6,b:0,e:1,qty:1,price:17500,sum:17500},
    {no:10,name:'마향주이 화죠유 1.8L 花椒油',u:6,b:0,e:1,qty:1,price:17500,sum:17500},
    {no:11,name:'이삼보 즈마장 2.5kg',u:6,b:0,e:4,qty:4,price:18000,sum:72000},
  ]},
  {id:'④',date:'2026-02-02',pages:1,totalSum:683750,complete:true,items:[
    {no:1,name:'샌드위치 피쉬볼-세미원 500g',u:12,b:0,e:5,qty:5,price:5750,sum:28750},
    {no:2,name:'하이단샌툴 海旦鮮桃(성게/멍게)완자 500g',u:20,b:1,e:0,qty:20,price:6100,sum:122000},
    {no:3,name:'위즈복대 魚子福袋(날치알) 500g',u:20,b:1,e:0,qty:20,price:9400,sum:188000},
    {no:4,name:'①장위완자(코리아) 문어 400g',u:20,b:1,e:0,qty:20,price:2750,sum:54000},
    {no:5,name:'⑤샤완/새우완자(코리아) 蝦丸 400g',u:20,b:1,e:0,qty:20,price:2750,sum:54000},
    {no:6,name:'스위트콘치즈볼(완자) 1kg',u:8,b:1,e:0,qty:8,price:4500,sum:36000},
    {no:7,name:'물고기모양어묵 魚豆腐 1kg',u:10,b:0,e:5,qty:5,price:7800,sum:39000},
    {no:8,name:'⑦룽샤츄(코리아) 가재완자 400g',u:20,b:1,e:0,qty:20,price:3400,sum:65000},
    {no:9,name:'부산어묵 나무꼬치-오양 960g',u:10,b:1,e:0,qty:10,price:6500,sum:65000},
    {no:10,name:'택배비B',u:1,b:0,e:8,qty:8,price:4000,sum:32000},
  ]},
  {id:'⑤',date:'2026-02-19',pages:2,totalSum:1334050,complete:true,items:[
    {no:1,name:'⑨치즈볼(완자) 芝士包 코리아 400g',u:20,b:1,e:0,qty:20,price:4150,sum:82000},
    {no:2,name:'샌드위치 피쉬볼-세미원 500g',u:12,b:1,e:5,qty:17,price:5750,sum:97750},
    {no:3,name:'하이단샌툴 (성게/멍게)완자 500g',u:20,b:1,e:0,qty:20,price:6100,sum:122000},
    {no:4,name:'위즈복대 (날치알) 500g',u:20,b:1,e:10,qty:30,price:9400,sum:282000},
    {no:5,name:'①장위완자(코리아) 문어 400g',u:20,b:1,e:0,qty:20,price:2900,sum:58000},
    {no:6,name:'⑧위즈볼(완자)날치알 400g',u:20,b:1,e:0,qty:20,price:3500,sum:69000},
    {no:7,name:'스위트콘치즈볼(완자) 1kg',u:8,b:1,e:0,qty:8,price:4500,sum:36000},
    {no:8,name:'물고기모양어묵 魚豆腐 1kg',u:10,b:0,e:6,qty:6,price:7800,sum:46800},
    {no:9,name:'⑦룽샤츄(코리아) 가재완자 400g',u:20,b:1,e:0,qty:20,price:3500,sum:69000},
    {no:10,name:'(원)련화푸주 太糊蓮花 A급 1kg',u:10,b:1,e:0,qty:10,price:7200,sum:72000},
    {no:11,name:'백목이버섯 白木耳 1kg',u:6,b:0,e:4,qty:4,price:13500,sum:54000},
    {no:12,name:'설기네치즈떡 1kg',u:10,b:1,e:0,qty:10,price:3900,sum:39000},
    {no:13,name:'두부포(이삼보) 油豆泡 400g',u:12,b:1,e:0,qty:12,price:3000,sum:35000},
    {no:14,name:'고구마떡(요리인) 1kg',u:8,b:0,e:5,qty:5,price:3700,sum:18500},
    {no:15,name:'부산어묵 나무꼬치-오양 960g',u:10,b:2,e:0,qty:20,price:6500,sum:130000},
    {no:16,name:'이삼보 즈마장 2.5kg',u:6,b:1,e:0,qty:6,price:18000,sum:108000},
  ]},
  {id:'⑥',date:'2026-01-15',pages:2,totalSum:1324949,complete:true,items:[
    {no:1,name:'⑨치즈볼(완자) 芝士包 코리아 400g',u:20,b:0,e:15,qty:15,price:3801,sum:57000},
    {no:2,name:'샌드위치 피쉬볼-세미원 500g',u:12,b:1,e:0,qty:12,price:5750,sum:69000},
    {no:3,name:'위즈복대 (날치알) 500g',u:20,b:2,e:0,qty:40,price:9400,sum:376000},
    {no:4,name:'①장위완자(코리아) 문어 400g',u:20,b:0,e:10,qty:10,price:2750,sum:27500},
    {no:5,name:'⑥어두부완자(코리아) 魚豆腐 400g',u:20,b:0,e:15,qty:15,price:2750,sum:41250},
    {no:6,name:'⑧위즈볼(완자)날치알 400g',u:20,b:2,e:0,qty:40,price:3400,sum:130000},
    {no:7,name:'스위트콘치즈볼(완자) 1kg',u:8,b:0,e:7,qty:7,price:4500,sum:31500},
    {no:8,name:'물고기모양어묵 魚豆腐 1kg',u:10,b:0,e:6,qty:6,price:7800,sum:46800},
    {no:9,name:'집게모양피쉬볼-랜지푸드 500g',u:12,b:1,e:0,qty:12,price:5800,sum:69599},
    {no:10,name:'아만일자 냉장 뉴진면(샤브면) 250g',u:40,b:1,e:0,qty:40,price:1500,sum:60000},
    {no:11,name:'미경원 푸주환 1kg',u:6,b:1,e:0,qty:6,price:8500,sum:51000},
    {no:12,name:'녹두당면 綠豆寬粉 180g',u:60,b:0,e:10,qty:10,price:1250,sum:12500},
    {no:13,name:'흑목이버섯 黑木耳 1kg',u:10,b:0,e:2,qty:2,price:16000,sum:32000},
    {no:14,name:'백목이버섯 白木耳 1kg',u:6,b:0,e:6,qty:6,price:13500,sum:81000},
    {no:15,name:'치즈떡(요리인) 1kg',u:8,b:1,e:4,qty:12,price:3700,sum:44400},
    {no:16,name:'고구마떡(요리인) 1kg',u:8,b:0,e:1,qty:1,price:3700,sum:3700},
    {no:17,name:'부산어묵 나무꼬치-오양 960g',u:10,b:1,e:7,qty:17,price:6500,sum:110500},
    {no:18,name:'진공자숙 연근 450g',u:20,b:0,e:10,qty:10,price:1900,sum:19000},
    {no:19,name:'이삼보 즈마장 2.5kg',u:6,b:0,e:3,qty:3,price:18000,sum:54000},
    {no:20,name:'단단 피현두반장 1.3kg',u:8,b:0,e:1,qty:1,price:8201,sum:8200},
  ]},
];
const ACC_ENGINES = [
  {id:'gemini',name:'Gemini 2.5 Flash',meta:'구글 · 현재 사용',cost:'~6원/장',tag:'연결됨',cls:'acc-tag-ok',on:true},
  {id:'clova-doc',name:'클로바 문서전용',meta:'네이버 · 표 인식',tag:'키 발급 필요',cls:'acc-tag-key',on:false},
  {id:'upstage',name:'업스테이지',meta:'한국 문서 특화',tag:'키 발급 필요',cls:'acc-tag-key',on:false},
  {id:'clova-gen',name:'클로바 일반',meta:'글자만+GPT',tag:'기록 62.5%',cls:'acc-tag-old',on:false},
];
let _accCurEngine = 'gemini';
let _accResults = {};   // {si: 채점결과}
let _accFileBuf = {};   // {si: [File...]}
let _accStyleInjected = false;

// ─── 이미지 → base64 (1280px 리사이즈, 우리 앱 동일) ───
function accFileToB64(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const cvs=document.createElement('canvas');
        let w=img.width,h=img.height; if(w>1280){h*=1280/w;w=1280;}
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
  const parts=[{text:ACC_PROMPT}];
  b64list.forEach(b=>parts.push({inline_data:{mime_type:'image/jpeg',data:b}}));
  const raw = await callGemini(parts, 30+(b64list.length-1)*5, 'accuracy_test', 'gemini-2.5-flash', 'gemini');
  const cost = (typeof lastAIUsage!=='undefined' && lastAIUsage) ? lastAIUsage.costWon : null;
  return {raw, cost};
}
function accAiToAnswer(raw){
  return {totalSum:raw.total_sum, items:(raw.items||[]).map(it=>({name:it.i,price:it.u,qty:it.q,sum:it.p}))};
}

// ─── 품목명 느슨 비교 (얼추 맞으면 정답) ───
function accNameNorm(s){return String(s||'').replace(/[\s()\[\]\/·,]/g,'').replace(/\d+(g|kg|L|ml)/gi,'').replace(/[①-⑨]/g,'').replace(/코리아|완자/g,'').slice(0,5);}
function accNameMatch(a,b){const x=accNameNorm(a),y=accNameNorm(b);if(!x||!y)return false;return x===y||x.includes(y)||y.includes(x);}

function accGradeSheet(ans,ai){
  const items=ans.items,n=items.length;
  let qtyHit=0,nameHit=0;
  const rows=items.map((a,i)=>{
    const r=(ai.items||[])[i]||{};
    const qOk=Number(r.qty)===Number(a.qty);
    const nOk=accNameMatch(r.name,a.name);
    if(qOk)qtyHit++; if(nOk)nameHit++;
    return {a,r,qOk,nOk};
  });
  const sumOk=Number(ai.totalSum)===Number(ans.totalSum);
  const rowPass=rows.filter(x=>x.qOk&&x.nOk).length;
  return {rows,n,rowPass,sumOk,qtyHit,nameHit,
    qtyPct:Math.round(qtyHit/n*100),namePct:Math.round(nameHit/n*100),
    overall:Math.round(((sumOk?1:0)*0.4+(qtyHit/n)*0.4+(nameHit/n)*0.2)*100)};
}

function _accFmt(x){return x==null?'-':Number(x).toLocaleString('ko-KR');}

// ─── 스타일 주입 (1회) ───
function _accInjectStyle(){
  if(_accStyleInjected) return;
  _accStyleInjected = true;
  const css = `
  .acc-engines{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:6px;}
  .acc-engine{border:2px solid var(--gray-200);border-radius:10px;padding:9px;cursor:pointer;}
  .acc-engine.on{border-color:var(--primary,#6D28D9);background:var(--primary-light,#EDE9FE);}
  .acc-engine.off{opacity:.55;}
  .acc-engine .en{font-weight:700;font-size:12.5px;}
  .acc-engine .me{font-size:10px;color:var(--gray-500);margin-top:2px;}
  .acc-tag{font-size:9px;border-radius:5px;padding:1px 5px;margin-top:4px;display:inline-block;}
  .acc-tag-ok{background:#ECFDF5;color:#10B981;} .acc-tag-key{background:#FEF3C7;color:#92400E;} .acc-tag-old{background:var(--gray-100);color:var(--gray-500);}
  .acc-score{text-align:center;padding:4px 0;}
  .acc-big{font-size:42px;font-weight:800;color:var(--primary,#6D28D9);line-height:1;font-variant-numeric:tabular-nums;}
  .acc-big small{font-size:16px;color:var(--gray-500);}
  .acc-slabel{font-size:11px;color:var(--gray-500);margin-top:4px;}
  .acc-axes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px;}
  .acc-axis{background:var(--gray-50,#F9FAFB);border-radius:9px;padding:7px 3px;text-align:center;}
  .acc-axn{font-size:9.5px;color:var(--gray-500);} .acc-axv{font-size:15px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;}
  .acc-bar{height:5px;background:var(--gray-200);border-radius:3px;margin-top:4px;overflow:hidden;} .acc-bar>i{display:block;height:100%;border-radius:3px;width:0;transition:width .5s;}
  .acc-sheet{border:1px solid var(--gray-200);border-radius:11px;margin-top:9px;overflow:hidden;}
  .acc-sh{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:8px;}
  .acc-sno{font-weight:800;color:var(--primary,#6D28D9);font-size:15px;}
  .acc-sd{font-size:13px;font-weight:600;} .acc-sm{font-size:10px;color:var(--gray-500);}
  .acc-vb{font-size:11px;border-radius:7px;padding:3px 8px;white-space:nowrap;font-weight:700;}
  .acc-v-ok{background:#ECFDF5;color:#10B981;} .acc-v-mid{background:#FEF3C7;color:#92400E;} .acc-v-none{background:var(--gray-100);color:var(--gray-500);font-weight:600;}
  .acc-body{display:none;border-top:1px solid var(--gray-100);padding:10px 12px;} .acc-sheet.open .acc-body{display:block;}
  .acc-up{display:flex;gap:8px;align-items:center;margin-bottom:9px;}
  .acc-flabel{flex:1;border:1.5px dashed var(--gray-300);border-radius:9px;padding:9px;text-align:center;font-size:12px;color:var(--gray-600);cursor:pointer;}
  .acc-flabel.has{border-color:var(--primary,#6D28D9);color:var(--primary,#6D28D9);background:var(--primary-light,#EDE9FE);}
  .acc-flabel input{display:none;}
  .acc-upb{border:none;border-radius:9px;padding:9px 14px;font-size:12.5px;font-weight:700;background:var(--primary,#6D28D9);color:#fff;cursor:pointer;white-space:nowrap;}
  .acc-upb:disabled{opacity:.6;}
  .acc-tbl{width:100%;border-collapse:collapse;font-size:11.5px;} .acc-tbl th,.acc-tbl td{padding:5px 4px;text-align:left;border-bottom:1px solid var(--gray-100);}
  .acc-tbl th{color:var(--gray-500);font-weight:600;font-size:10px;} .acc-tbl .n{text-align:right;font-variant-numeric:tabular-nums;}
  .acc-rbad{background:#FEE2E2;} .acc-aibad{color:#EF4444;font-weight:700;} .acc-aiok{color:var(--gray-400);}
  .acc-ox{text-align:center;font-weight:800;} .acc-o{color:#10B981;} .acc-x{color:#EF4444;}
  .acc-rs{font-size:10px;color:#F59E0B;}
  .acc-note{font-size:11px;color:#92400E;background:#FEF3C7;border-radius:8px;padding:8px 10px;}
  .acc-err{font-size:11.5px;color:#EF4444;background:#FEE2E2;border-radius:8px;padding:9px 10px;margin-top:8px;}
  .acc-mini{font-size:10.5px;color:var(--gray-500);}
  .acc-logrow{display:grid;grid-template-columns:auto 1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:11px;align-items:center;}
  .acc-pill{font-size:10px;border-radius:5px;padding:2px 6px;background:var(--gray-100);color:var(--gray-600);}`;
  const st=document.createElement('style'); st.id='accStyle'; st.textContent=css; document.head.appendChild(st);
}

// ─── 메인 렌더 (adminAccuracyPanel 채우기) ───
function renderAccuracyLab(){
  _accInjectStyle();
  const el = document.getElementById('adminAccuracyPanel');
  if(!el) return;
  el.innerHTML = `
    <div class="card" style="margin-bottom:10px;padding:12px;">
      <div style="font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:8px;">⚙️ 분석 엔진</div>
      <div class="acc-engines" id="accEngines"></div>
    </div>
    <div class="card" style="margin-bottom:10px;padding:14px;">
      <div style="font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:6px;">📊 순창국제 종합 <span class="acc-mini" id="accEngNow"></span></div>
      <div class="acc-score"><div class="acc-big" id="accBig">—<small>%</small></div>
        <div class="acc-slabel" id="accLabel">아래 명세서별로 사진을 올려 채점하세요</div></div>
      <div class="acc-axes">
        <div class="acc-axis"><div class="acc-axn">합계</div><div class="acc-axv" id="accAx-sum">—</div><div class="acc-bar"><i id="accBar-sum"></i></div></div>
        <div class="acc-axis"><div class="acc-axn">수량</div><div class="acc-axv" id="accAx-qty">—</div><div class="acc-bar"><i id="accBar-qty"></i></div></div>
        <div class="acc-axis"><div class="acc-axn">품목명</div><div class="acc-axv" id="accAx-name">—</div><div class="acc-bar"><i id="accBar-name"></i></div></div>
        <div class="acc-axis"><div class="acc-axn">분류</div><div class="acc-axv">고정</div><div class="acc-bar"><i style="background:var(--gray-300);width:100%"></i></div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:10px;padding:12px;">
      <div style="font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:6px;">🧾 명세서별 — 사진 올려 채점</div>
      <div id="accSheets"></div>
    </div>
    <div class="card" style="margin-bottom:10px;padding:12px;">
      <div style="font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:6px;">📜 분석 로그</div>
      <div id="accLogs"></div>
    </div>`;
  _accRenderEngines(); _accRenderScore(); _accRenderSheets(); _accRenderLogs();
}

function _accRenderEngines(){
  const box=document.getElementById('accEngines'); if(!box) return;
  box.innerHTML = ACC_ENGINES.map(e=>`<div class="acc-engine ${e.id===_accCurEngine?'on':''} ${e.on?'':'off'}" data-eng="${e.id}">
    <div class="en">${e.name}</div><div class="me">${e.meta}${e.cost?' · '+e.cost:''}</div><span class="acc-tag ${e.cls}">${e.tag}</span></div>`).join('');
  box.querySelectorAll('.acc-engine').forEach(d=>d.addEventListener('click',()=>{
    const e=ACC_ENGINES.find(x=>x.id===d.dataset.eng);
    if(!e.on){ alert(e.name+'\n\n키(접속 열쇠) 발급 후 연결됩니다.\n사장님이 키 주시면 측정실에 꽂아 바로 채점합니다.'); return; }
    _accCurEngine=e.id; _accRenderEngines();
  }));
  const now=document.getElementById('accEngNow'); if(now) now.textContent='· '+ACC_ENGINES.find(e=>e.id===_accCurEngine).name;
}

function _accRenderScore(){
  const done=Object.entries(_accResults).filter(([si,r])=>r&&!r._error);
  const big=document.getElementById('accBig'), lab=document.getElementById('accLabel');
  if(!big) return;
  if(!done.length){
    big.innerHTML='—<small>%</small>'; lab.textContent='아래 명세서별로 사진을 올려 채점하세요';
    ['sum','qty','name'].forEach(k=>{document.getElementById('accAx-'+k).textContent='—';document.getElementById('accBar-'+k).style.width='0';});
    return;
  }
  let sumOk=0,qtyHit=0,nameHit=0,total=0,ov=0;
  done.forEach(([si,r])=>{if(r.sumOk)sumOk++; qtyHit+=r.qtyHit; nameHit+=r.nameHit; total+=r.n; ov+=r.overall;});
  const g=done.length, overall=Math.round(ov/g);
  big.innerHTML=overall+'<small>%</small>';
  big.style.color = overall>=90?'#10B981':overall>=70?'#F59E0B':'#EF4444';
  lab.textContent=`${ACC_ENGINES.find(e=>e.id===_accCurEngine).name} · 채점 ${g}건 · 총 ${total}행 중 ${qtyHit}행 수량 정확`;
  const set=(k,v)=>{document.getElementById('accAx-'+k).textContent=v+'%';const b=document.getElementById('accBar-'+k);b.style.width=v+'%';b.style.background=v>=90?'#10B981':v>=70?'#F59E0B':'#EF4444';};
  set('sum',Math.round(sumOk/g*100)); set('qty',Math.round(qtyHit/total*100)); set('name',Math.round(nameHit/total*100));
}

function _accRenderSheets(){
  const box=document.getElementById('accSheets'); if(!box) return;
  box.innerHTML = ACC_SHEETS.map((s,si)=>{
    const r=_accResults[si];
    let badge;
    if(!s.complete) badge='<span class="acc-vb acc-v-none">재촬영 대기</span>';
    else if(r&&r._error) badge='<span class="acc-vb acc-v-mid">분석 실패</span>';
    else if(r) badge=`<span class="acc-vb ${r.rowPass===r.n?'acc-v-ok':'acc-v-mid'}">${r.overall}점</span>`;
    else badge='<span class="acc-vb acc-v-none">미채점</span>';
    const fileN=(_accFileBuf[si]||[]).length;
    let body;
    if(!s.complete){ body=`<div class="acc-note">📷 ${s.note}</div>`; }
    else {
      let res='';
      if(r&&r._error){ res=`<div class="acc-err">⚠️ ${r._error}</div>`; }
      else if(r){
        const rows=s.items.map((it,ri)=>{
          const rr=r.rows[ri]; const bad=rr&&(!rr.qOk||!rr.nOk);
          const aiQty=rr?(rr.qOk?`<span class="acc-aiok">${it.qty}</span>`:`<span class="acc-aibad">${rr.r.qty==null?'?':rr.r.qty}</span>`):'-';
          const ox=rr?(rr.qOk&&rr.nOk?'<span class="acc-o">O</span>':'<span class="acc-x">X</span>'):'';
          const nm=(rr&&!rr.nOk)?`${it.name}<br><span class="acc-rs">AI: ${rr.r.name||'?'}</span>`:it.name;
          return `<tr class="${bad?'acc-rbad':''}"><td>${it.no}</td><td>${nm}</td><td class="n">${it.u}/${it.b}/${it.e}</td><td class="n">${it.qty===0?'-':it.qty}</td><td class="n">${aiQty}</td><td class="acc-ox">${ox}</td></tr>`;
        }).join('');
        res=`<div class="acc-mini" style="margin-bottom:6px;">합계 ${r.sumOk?'✅ 일치':'❌ 불일치'} · 수량 ${r.qtyHit}/${r.n}행 · ${r._pages}장${r._cost!=null?' · '+r._cost.toFixed(1)+'원':''}</div>
          <table class="acc-tbl"><tr><th>No</th><th>품목</th><th class="n">단/박/낱</th><th class="n">답지</th><th class="n">AI</th><th class="acc-ox">판정</th></tr>${rows}</table>`;
      }
      body=`<div class="acc-up">
          <label class="acc-flabel ${fileN?'has':''}" id="accLbl-${si}">${fileN?`📷 ${fileN}장 선택됨`:'📷 사진 고르기 (여러 장 OK)'}<input type="file" accept="image/*" multiple data-si="${si}"></label>
          <button class="acc-upb" id="accUpb-${si}">분석·채점</button></div>${res}`;
    }
    return `<div class="acc-sheet ${r&&!r._error?'open':''}" data-si="${si}">
      <div class="acc-sh"><div style="display:flex;align-items:center;gap:9px;min-width:0;"><span class="acc-sno">${s.id}</span>
        <div><div class="acc-sd">${s.date}</div><div class="acc-sm">${s.complete?s.items.length+'행':'미완'} · 합계 ${_accFmt(s.totalSum)}원${s.pages>1?' · '+s.pages+'장':''}</div></div></div>
        ${badge}</div><div class="acc-body">${body}</div></div>`;
  }).join('');
  box.querySelectorAll('.acc-sh').forEach(h=>h.addEventListener('click',e=>{ if(e.target.closest('.acc-up'))return; h.parentElement.classList.toggle('open'); }));
  box.querySelectorAll('input[type=file]').forEach(inp=>inp.addEventListener('change',()=>{
    const si=+inp.dataset.si; _accFileBuf[si]=[...inp.files];
    const lbl=document.getElementById('accLbl-'+si);
    if(lbl){lbl.classList.toggle('has',!!inp.files.length); lbl.childNodes[0].textContent=inp.files.length?`📷 ${inp.files.length}장 선택됨`:'📷 사진 고르기 (여러 장 OK)';}
  }));
  box.querySelectorAll('.acc-upb').forEach(b=>b.addEventListener('click',()=>accAnalyze(+b.id.split('-')[1])));
}

// ─── 업로드 → 분석 → 채점 ───
async function accAnalyze(si){
  const files=_accFileBuf[si]||[];
  if(!files.length){ alert('먼저 사진을 고르세요'); return; }
  const btn=document.getElementById('accUpb-'+si);
  if(btn){ btn.disabled=true; btn.textContent='분석 중…'; }
  try{
    const b64s=[]; for(const f of files){ b64s.push(await accFileToB64(f)); }
    const {raw, cost}=await accCallGemini(b64s);
    const r=accGradeSheet(ACC_SHEETS[si], accAiToAnswer(raw));
    r._cost=cost; r._pages=files.length;
    _accResults[si]=r;
    _accAddLog(ACC_SHEETS[si].id, r, cost);
    _accRenderScore(); _accRenderSheets();
  }catch(e){
    _accResults[si]={_error:(e&&e.message)||'분석 실패'};
    _accRenderScore(); _accRenderSheets();
  }
}

// ─── 로그 (localStorage) ───
function _accGetLogs(){ try{return JSON.parse(localStorage.getItem('accLabLogs')||'[]');}catch{return[];} }
function _accAddLog(sheetId,r,cost){
  const logs=_accGetLogs();
  logs.unshift({t:new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
    eng:ACC_ENGINES.find(e=>e.id===_accCurEngine).name,sheet:sheetId,overall:r.overall,
    sum:r.sumOk?'O':'X',qty:`${r.qtyHit}/${r.n}`,cost:cost!=null?cost.toFixed(1)+'원':'-'});
  localStorage.setItem('accLabLogs',JSON.stringify(logs.slice(0,40))); _accRenderLogs();
}
function _accRenderLogs(){
  const el=document.getElementById('accLogs'); if(!el) return;
  const logs=_accGetLogs();
  if(!logs.length){ el.innerHTML='<div class="acc-mini" style="text-align:center;padding:12px;">아직 채점 기록이 없습니다.</div>'; return; }
  el.innerHTML=logs.map(l=>`<div class="acc-logrow"><span class="acc-mini">${l.t}</span>
    <span><b>${l.sheet} ${l.overall}%</b> <span class="acc-pill">${l.eng}</span> <span class="acc-mini">합${l.sum} 수${l.qty}</span></span>
    <span class="acc-mini">${l.cost}</span></div>`).join('');
}
