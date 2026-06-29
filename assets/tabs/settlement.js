// ══════════════════════════════════════════
// 마감정산
// ══════════════════════════════════════════
// ── 마감정산 로직 ──
// ─── 정산 날짜 선택 (관리자용) ───
let _isEditingSettle=false; // editSettlement(수정) 진입 시 true — 자동날짜가 수정 날짜를 덮는 경쟁 방지 (2026-06-16)

// ─── 새 기능: 마감정산 단계 마법사 (2026-06-24) ───
let _swStep = 1;

function _renderSettleStep(){
  for(let i=1;i<=4;i++){const el=document.getElementById('swStep'+i);if(el)el.style.display=(i===_swStep)?'block':'none';}
  const prevBtn=document.getElementById('swPrevBtn');
  const nextBtn=document.getElementById('swNextBtn');
  const saveBtn=document.getElementById('swSaveBtn');
  if(prevBtn) prevBtn.style.display=_swStep>1?'flex':'none';
  if(nextBtn) nextBtn.style.display=_swStep<4?'flex':'none';
  if(saveBtn) saveBtn.style.display=_swStep===4?'flex':'none';
  for(let i=1;i<=4;i++){
    const dot=document.getElementById('swDotA'+i);
    const lbl=document.getElementById('swLblA'+i);
    if(!dot) continue;
    if(i<_swStep){
      dot.style.background='#e8f0fe';dot.style.color='#0050FF';dot.textContent='✓';dot.style.boxShadow='';
      if(lbl){lbl.style.color='#0050FF';}
    } else if(i===_swStep){
      dot.style.background='#0050FF';dot.style.color='#fff';dot.textContent=String(i);dot.style.boxShadow='0 0 0 3px rgba(0,80,255,.18)';
      if(lbl){lbl.style.color='#0050FF';}
    } else {
      dot.style.background='#f0f0f0';dot.style.color='#bbb';dot.textContent=String(i);dot.style.boxShadow='';
      if(lbl){lbl.style.color='#bbb';}
    }
  }
  for(let i=1;i<=3;i++){
    const line=document.getElementById('swLineA'+i);
    if(line) line.style.background=i<_swStep?'#0050FF':'#e5e7eb';
  }
  _updateSwBarDate();
  _updateSwTopbar();
  if(_swStep===1) _renderSnapWarn();
}
function settleWizardNext(){
  if(_swStep<4){_swStep++;_renderSettleStep();const c=document.getElementById('settleCont');if(c)c.scrollTop=0;}
}
// ─── 새 기능: 중간 기록 경고 (2026-06-26) ───
function _renderSnapWarn(){
  const warnEl = document.getElementById('swSnapWarn');
  if(!warnEl) return;
  // _snapCache는 dashboard.js에서 관리. 오늘 마감 날짜가 아니면 경고 숨김
  const dateStr = document.getElementById('settleDatePicker')?.value;
  const todayStr = typeof ymdLocal === 'function' ? ymdLocal(new Date()) : new Date().toLocaleDateString('sv-SE');
  if(!dateStr || dateStr !== todayStr || typeof _snapCache === 'undefined' || !_snapCache){
    warnEl.style.display = 'none'; return;
  }
  const snapAmt = _snapCache.amount;
  const posTotal = (typeof gv === 'function')
    ? gv('siPosCash') + gv('siPosCashReceipt') + gv('siPosCard') + gv('siPosEtc')
    : 0;
  if(posTotal > 0 && posTotal < snapAmt){
    warnEl.style.display = '';
    const snapEl = document.getElementById('swSnapWarnSnap');
    const posEl  = document.getElementById('swSnapWarnPos');
    if(snapEl) snapEl.textContent = (typeof fmt==='function' ? fmt(snapAmt) : snapAmt.toLocaleString()) + '원';
    if(posEl)  posEl.textContent  = (typeof fmt==='function' ? fmt(posTotal) : posTotal.toLocaleString()) + '원';
  } else {
    warnEl.style.display = 'none';
  }
}
function settleWizardPrev(){
  if(_swStep>1){_swStep--;_renderSettleStep();const c=document.getElementById('settleCont');if(c)c.scrollTop=0;}
}
function _updateSwBarDate(){
  const el=document.getElementById('swBarDate');if(!el)return;
  const dateStr=document.getElementById('settleDatePicker')?.value;
  if(!dateStr){el.textContent='-';return;}
  const d=new Date(dateStr+'T00:00:00');
  el.textContent=(d.getMonth()+1)+'월 '+d.getDate()+'일 ('+'일월화수목금토'[d.getDay()]+')';
}
function _updateSwTopbar(){
  const tb=document.getElementById('swBarContent');if(!tb)return;
  const opening=gv('siOpening');
  const posCash=gv('siPosCash'),posCR=gv('siPosCashReceipt');
  const cashCash=gv('siCashCash'),cashQr=gv('siCashQr'),cashTr=gv('siCashTransfer');
  const _ded=getSettleDeductTotals();
  const fmtW=n=>fmt(n)+'원';
  const scItem=(lbl,val,color)=>`<div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex:1;"><span style="font-size:9px;color:rgba(255,255,255,0.45);font-weight:700;white-space:nowrap;">${lbl}</span><span style="font-size:12px;font-weight:900;color:${color};font-variant-numeric:tabular-nums;">${fmtW(val)}</span></div>`;
  const scOp=t=>`<span style="font-size:13px;color:rgba(255,255,255,0.3);padding:0 2px;flex-shrink:0;">${t}</span>`;
  const row=`display:flex;align-items:center;justify-content:space-between;width:100%;gap:2px;`;
  if(_swStep===1){
    const posSum=posCash+posCR;const presumed=opening+posSum;
    tb.innerHTML=`<div style="${row}">${scItem('영업개시',opening,'#fff')}${scOp('+')}${scItem('POS현금+현영',posSum,posSum>0?'#4ade80':'rgba(255,255,255,0.5)')}${scOp('=')}${scItem('금고예상(잠정)',presumed,'rgba(255,255,255,0.8)')}</div>`;
  }else if(_swStep===2){
    const posSum=posCash+posCR;const detailSum=cashCash+cashQr+cashTr;
    const ok=posSum>0&&posSum===detailSum;const bad=posSum>0&&detailSum>0&&posSum!==detailSum;
    const statusHtml=ok?`<span style="font-size:11px;color:#4ade80;font-weight:800;flex-shrink:0;">✅ 일치</span>`:bad?`<span style="font-size:11px;color:#f87171;font-weight:800;flex-shrink:0;">❌ ${(detailSum-posSum>0?'+':'')+fmt(detailSum-posSum)}원</span>`:'';
    tb.innerHTML=`<div style="${row}">${scItem('POS현금+현영',posSum,'#fff')}${scOp('vs')}${scItem('상세합계',detailSum,ok?'#4ade80':'rgba(255,255,255,0.7)')}${statusHtml}</div>`;
  }else if(_swStep===3){
    const book=opening+cashCash-_ded.etcSum-_ded.bankSum;
    tb.innerHTML=`<div style="${row}">${scItem('금고합계',opening+cashCash,'#fff')}${scOp('−')}${scItem('이동·지출',_ded.total,'rgba(255,255,255,0.7)')}${scOp('=')}${scItem('금고예상잔액',book,book>0?'#4ade80':'rgba(255,255,255,0.5)')}</div>`;
  }else if(_swStep===4){
    let vault=0;document.querySelectorAll('.v-input').forEach(i=>vault+=parseInt(i.dataset.unit)*(parseInt(i.value)||0));
    const book=opening+cashCash-_ded.etcSum-_ded.bankSum;
    const diff=vault-book;const diffOk=vault>0&&diff===0;const diffBad=vault>0&&diff!==0;
    tb.innerHTML=`<div style="${row}">${scItem('장부잔액',book,'#fff')}${scOp('vs')}${scItem('실계수',vault,diffOk?'#4ade80':'rgba(255,255,255,0.7)')}<div style="width:1px;height:28px;background:rgba(255,255,255,0.12);flex-shrink:0;"></div><div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex:1;"><span style="font-size:9px;color:rgba(255,255,255,0.45);font-weight:700;">차액</span><span style="font-size:12px;font-weight:900;color:${diffOk?'#4ade80':diffBad?'#f87171':'rgba(255,255,255,0.5)'};font-variant-numeric:tabular-nums;">${vault===0?'입력 중':diffOk?'0원 🎯':((diff>0?'+':'')+fmtW(diff))}</span></div></div>`;
    const vs=document.getElementById('swVaultSum');if(vs)vs.textContent=fmtW(vault);
  }
}

function initSettleDate(){
  const picker=document.getElementById('settleDatePicker');
  const group=document.getElementById('settleDateGroup');
  // 2026-06-16: 영업일 기준 오늘 (영업일 시작 시각 전이면 전날 — 새벽 마감 정확)
  const bizToday=bizDateStr(new Date());
  picker.value=bizToday;
  picker.max=bizToday; // 미래(영업일 기준) 차단
  _renderSettleStep(); // 마법사 초기 상태 렌더링
  if(isManager){
    group.style.display='block';
    picker.addEventListener('change',function(){
      // 날짜 변경 시 전일 마감금액 다시 로드
      loadOpeningForDate(this.value);
    });
  }
  // 안 끝낸 영업일 자동 선택 (빠뜨린 마감이 있으면 그날 우선)
  applySettleAutoDate(picker, bizToday);
}
// ─── 새 기능: 안 끝낸 영업일 자동 선택 (2026-06-16) ───
// 마지막 마감 다음날이 영업일 오늘보다 이르면 = 빠뜨린 영업일 → 그날을 자동 선택.
// 사장님이 날짜 안 보고 눌러도 빠진 날이 잡히게.
async function applySettleAutoDate(picker, bizToday){
  if(!currentStore||!picker) return;
  const{data}=await sb.from('settlements').select('settle_date')
    .eq('store_id',currentStore.id).lte('settle_date',bizToday)
    .order('settle_date',{ascending:false}).limit(1);
  if(_isEditingSettle) return; // 수정 모드면 editSettlement가 picker를 그 날짜로 잡음 — 자동날짜로 덮지 않음
  let target=bizToday;
  if(data&&data[0]){
    const next=ymdAddDays(data[0].settle_date,1); // 마지막 마감 다음날
    if(next<bizToday) target=next;                // 밀린 영업일이 있으면 그날 우선
  }
  picker.value=target;
  if(target!==bizToday){
    const st=document.getElementById('settleDateStatus');
    if(st) st.innerText='⏳ 안 끝낸 영업일 자동';
  }
  loadOpeningForDate(target);
}
function moveSettleDate(dir){
  const picker=document.getElementById('settleDatePicker');
  const d=new Date(picker.value+'T00:00:00');d.setDate(d.getDate()+dir);
  const today=ymdLocal(new Date());
  const newDate=ymdLocal(d);
  if(newDate>today) return; // 미래 차단
  picker.value=newDate;
  loadOpeningForDate(newDate);
}
async function loadOpeningForDate(dateStr){
  if(!currentStore) return;
  // ── 2026-05-31: 날짜 이동 시 그 날 마감 전체 복원 ──
  // 옛 버그: 기존 마감이 있어도 "기존 데이터 있음" 안내만 하고 입력칸은 공란이었음.
  // → 그 날짜에 저장된 마감이 있으면 editSettlement로 매출·통장·현금지출·금고 전부 복원.
  const{data:existing}=await sb.from('settlements').select('id').eq('store_id',currentStore.id).eq('settle_date',dateStr).maybeSingle();
  if(existing){
    await editSettlement(dateStr, true); // silent: 화살표 이동이라 안내 토스트 생략
    const st=document.getElementById('settleDateStatus');
    if(st) st.innerText='저장된 마감 — 불러옴';
    return;
  }
  // 기존 마감 없음 → 빈 폼 + 시작 금고(영업개시 우선 → 전일 마감, 금고 사슬 규칙)
  resetSettleView();
  await applySettleStartVault(dateStr);
  recalcSettle2();
  const statusEl2=document.getElementById('settleDateStatus');
  if(statusEl2) statusEl2.innerText='새 정산';
}
// ─── 마감 시작 금고 결정 (금고 사슬 규칙, 2026-06-01 사장님 정의) ───
// 그 날 영업개시 했으면 영업개시 금고, 안 했으면 전일 마감 금고. (마감→영업개시→마감 사슬)
async function applySettleStartVault(dateStr){
  const el=document.getElementById('siOpening');
  const statusEl=document.getElementById('openingStatus');
  if(!el) return;
  // 1) 그 날 영업개시 금고 우선
  const{data:op}=await sb.from('daily_opening').select('actual_total').eq('store_id',currentStore.id).eq('opening_date',dateStr).maybeSingle();
  if(op?.actual_total!=null){
    el.value=parseInt(op.actual_total).toLocaleString();
    if(statusEl) statusEl.innerText='오늘 영업개시 금고';
    if(!isManager) el.readOnly=true;
    return;
  }
  // 2) 영업개시 없음 → 전일 마감 금고
  const d=new Date(dateStr+'T00:00:00');d.setDate(d.getDate()-1);
  const yd=ymdLocal(d);
  const{data}=await sb.from('settlements').select('actual_total').eq('store_id',currentStore.id).eq('settle_date',yd).maybeSingle();
  if(data?.actual_total!=null){
    el.value=parseInt(data.actual_total).toLocaleString();
    if(statusEl) statusEl.innerText='전일('+yd+') 마감 금고';
    if(!isManager) el.readOnly=true;
  } else {
    el.value='';
    if(statusEl) statusEl.innerText='전일('+yd+') 마감 데이터 없음';
  }
}
function getSettleDate(){
  const picker=document.getElementById('settleDatePicker');
  return picker?.value||ymdLocal(new Date());
}
function onSInput(el){const raw=el.value.replace(/,/g,'');if(/^\d*$/.test(raw))el.value=raw?parseInt(raw).toLocaleString():'';recalcSettle2();}

// ── POS 마감 사진 AI 인식 ──
let posB64='';
function handlePosImg(input){
  if(!input.files[0]) return;
  const fr=new FileReader();
  fr.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const cvs=document.createElement('canvas');
      let w=img.width,h=img.height;if(w>1200){h*=1200/w;w=1200;}
      cvs.width=w;cvs.height=h;cvs.getContext('2d').drawImage(img,0,0,w,h);
      posB64=cvs.toDataURL('image/jpeg',0.8).split(',')[1];
      document.getElementById('posPreview').src=cvs.toDataURL('image/jpeg');
      document.getElementById('posPreview').style.display='block';
      document.getElementById('posUploadGroup').style.display='none';
      document.getElementById('posAiGroup').style.display='flex';
    };
    img.src=e.target.result;
  };
  fr.readAsDataURL(input.files[0]);
}
function resetPosImg(){
  posB64='';
  document.getElementById('posPreview').style.display='none';
  document.getElementById('posUploadGroup').style.display='flex';
  document.getElementById('posAiGroup').style.display='none';
}
async function runPosAI(){
  if(!posB64) return toast('사진을 먼저 촬영하세요.','warn');
  setLoad(true,'POS 장표 인식 중...');
  try{
    const parsed=await callGemini([
      // POS 매출 장표 = 단순 숫자 추출 → lite로 충분
      {text:`이 POS 마감 장표 사진에서 매출 항목을 추출해주세요.
다음 필드를 가진 JSON 객체로 응답해주세요 (숫자만, 없으면 0):
{
  "cash": 현금 금액,
  "cash_receipt": 현금영수증 금액,
  "card": 신용카드/카드 금액,
  "other": 기타결제 금액,
  "total": 합계/총매출 금액,
  "receipt_count": 전표수/영수건수,
  "customer_count": 손님수/고객수
}
반드시 순수 JSON만 출력하세요.`},
      {inline_data:{mime_type:'image/jpeg',data:posB64}}
    ], 30, 'pos_ocr', 'gemini-2.5-flash-lite', 'gpt'); // POS = GPT Vision (단순 표, 안정성 우선)

    // 인식된 값을 마감정산 필드에 채움
    const fill=(id,val)=>{const el=document.getElementById(id);if(el&&val)el.value=parseInt(val).toLocaleString();};
    fill('siPosCash',parsed.cash);
    fill('siPosCashReceipt',parsed.cash_receipt);
    fill('siPosCard',parsed.card);
    fill('siPosEtc',parsed.other);
    recalcSettle2();
    // AI 인식 후 수기 입력창 자동 노출 (값 확인·수정 가능하게)
    const mg=document.getElementById('swManualGroup');const mt=document.getElementById('swManualToggle');
    if(mg) mg.style.display='block';if(mt) mt.style.display='none';

    // 인식 결과 안내
    const total=parseInt(parsed.total)||0;
    toast(`POS 매출 인식 완료! 합계: ${fmt(total)}원`,'success',4000);
    resetPosImg();
  }catch(e){
    toast('인식 실패: '+e.message,'error');
  }finally{setLoad(false);}
}
function gv(id){return unFmt(document.getElementById(id)?.value||'0');}

// ─── 매출 엑셀 업로드 ───
async function handleSalesUpload(input){
  if(!guardStore()||!input.files[0])return;
  setLoad(true,'매출 엑셀 분석 중...');
  try{
    const rows=await parseExcelFile(input.files[0]);
    if(!rows.length) throw new Error('데이터가 없습니다.');
    const headers=Object.keys(rows[0]);
    const colMap=matchColumns(headers,'sales');

    // 날짜 컬럼 있으면 오늘 날짜와 일치하는 행 찾기, 없으면 첫 행 사용
    let targetRow=rows[0];
    const today=ymdLocal(new Date());
    if(colMap.settle_date!=null){
      const todayRow=rows.find(row=>{
        const vals=Object.values(row);
        return parseDate(String(vals[colMap.settle_date]||''))===today;
      });
      if(todayRow) targetRow=todayRow;
      else {
        // 가장 최근 날짜 행 사용
        const sorted=[...rows].sort((a,b)=>{
          const da=parseDate(String(Object.values(a)[colMap.settle_date]||''))||'';
          const db=parseDate(String(Object.values(b)[colMap.settle_date]||''))||'';
          return db.localeCompare(da);
        });
        targetRow=sorted[0];
      }
    }

    const vals=Object.values(targetRow);
    const getVal=idx=>idx!=null?parseNum(String(vals[idx]||'')):0;
    const fill=(id,val)=>{const el=document.getElementById(id);if(el&&val)el.value=parseInt(val).toLocaleString();};

    // 매출 필드 채우기
    fill('siPosCash',getVal(colMap.pos_cash));
    fill('siPosCashReceipt',getVal(colMap.pos_cash_receipt));
    fill('siPosCard',getVal(colMap.pos_card));
    fill('siPosEtc',getVal(colMap.pos_etc));
    recalcSettle2();

    const dateStr=colMap.settle_date!=null?parseDate(String(vals[colMap.settle_date]||''))||'':'';
    toast(`매출 데이터 입력 완료!${dateStr?' ('+dateStr+')':''}`,'success');
  }catch(e){
    toast('매출 엑셀 실패: '+e.message,'error');
  }finally{setLoad(false);input.value='';}
}

function recalcSettle2(){
  const opening=gv('siOpening');
  const posCash=gv('siPosCash'), posCR=gv('siPosCashReceipt'), posCard=gv('siPosCard'), posEtc=gv('siPosEtc');
  const cashCash=gv('siCashCash'), cashQr=gv('siCashQr'), cashTr=gv('siCashTransfer');
  // 차감: 동적 행에서 합산
  const _ded=getSettleDeductTotals();
  const deductEtc=_ded.etcSum, deductBank=_ded.bankSum;
  const _bankEl=document.getElementById('settleBankTotal');
  const _etcEl=document.getElementById('settleEtcTotal');
  const _dedTotalEl=document.getElementById('settleDeductTotal');
  if(_bankEl) _bankEl.innerText=fmt(_ded.bankSum)+'원';
  if(_etcEl) _etcEl.innerText=fmt(_ded.etcSum)+'원';
  if(_dedTotalEl) _dedTotalEl.innerText=fmt(_ded.total)+'원';

  // 매출합계 (POS 매출 4칸)
  const salesTotal=posCash+posCR+posCard+posEtc;
  document.getElementById('calcSalesTotal').innerText=fmt(salesTotal)+'원';
  _renderSnapWarn(); // 중간 기록 경고 갱신

  // 현금 검증: POS(현금+현금영수증) vs 상세(현금+QR+이체)
  const posSum=posCash+posCR;
  const detailSum=cashCash+cashQr+cashTr;
  document.getElementById('cvPosSum').innerText=fmt(posSum)+'원';
  document.getElementById('cvDetailSum').innerText=fmt(detailSum)+'원';
  const cvEl=document.getElementById('cvResult');
  const cvBox=document.getElementById('cashVerify');
  if(posSum===0&&detailSum===0){
    cvEl.innerText='-';cvBox.style.background='var(--gray-100)';
  } else if(posSum===detailSum){
    cvEl.innerText='✅ 일치';cvEl.style.color='var(--success)';cvBox.style.background='var(--success-light)';
  } else {
    const d=detailSum-posSum;
    cvEl.innerText='❌ 차액 '+(d>0?'+':'')+fmt(d)+'원';cvEl.style.color='var(--danger)';cvBox.style.background='var(--danger-light)';
  }

  // 장부 합계 (금고에 있어야 할 금액)
  const book=opening+cashCash-deductEtc-deductBank;
  document.getElementById('calcBook').innerText=fmt(book)+'원';

  // 금고 합계
  let vault=0;document.querySelectorAll('.v-input').forEach(i=>vault+=parseInt(i.dataset.unit)*(parseInt(i.value)||0));
  document.getElementById('calcVault').innerText=fmt(vault)+'원';
  document.getElementById('vaultTotal').innerText=fmt(vault)+'원';

  // 차액 (입력 전 = 모두 0이면 중립 '-' 유지, 그 외엔 일치/불일치 강조)
  const diff=vault-book;const diffEl=document.getElementById('calcDiff');
  const calcBox=document.getElementById('diffRow');  // 금고 계수 카드 안 .vault-calc
  const inputStarted=salesTotal>0||vault>0||opening>0;
  if(!inputStarted){
    diffEl.innerText='-';
    if(calcBox) calcBox.classList.remove('diff-ok','diff-bad');
  } else {
    diffEl.innerText=diff===0?'✅ 일치':`❌ ${diff>0?'+':''}${fmt(diff)}원`;
    if(calcBox){calcBox.classList.toggle('diff-ok',diff===0);calcBox.classList.toggle('diff-bad',diff!==0);}
  }

  refreshSaveButtonState(diff);
  if(typeof _updateSwTopbar==='function') _updateSwTopbar();
}
// 차액 0이면 저장 버튼 초록 강조 (sticky 차액 패널과 동기)
function refreshSaveButtonState(diff){
  const saveBtn=document.querySelector('[data-action="finishSettlement2"]');
  if(!saveBtn) return;
  saveBtn.classList.toggle('settle-ready', diff===0);
}

document.addEventListener('input',e=>{
  if(e.target.classList.contains('v-input')) recalcSettle2();
  if(e.target.classList.contains('op-v-input')) recalcOpening();
});

// ══════════════════════════════════════════
// 영업개시 보고 (B안: 익일 검증)
// ══════════════════════════════════════════
let opPrevCloseTotal = 0;  // 어제 마감 금고 (스냅샷용)
let openingEditDate = null; // 수정 모드: 'YYYY-MM-DD' / 오늘 입력: null

// 입력 폼 초기화 + 해당 날짜 데이터 로드 (dateStr 없으면 오늘)
async function loadOpeningPage(dateStr){
  if(!guardStore()) return;
  const today = ymdLocal(new Date());
  const targetDate = dateStr || today;
  openingEditDate = (dateStr && dateStr!==today) ? dateStr : null;
  // 어제 날짜 = targetDate -1 (로컬 한국 시간 기준, 시간대 버그 회피)
  const t = new Date(targetDate+'T00:00:00');
  const yest = new Date(t); yest.setDate(yest.getDate()-1);
  const yestStr = ymdLocal(yest);
  // 어제 마감 + 그 날 영업개시 병렬 조회
  const [{data: prev}, {data: rec}] = await Promise.all([
    sb.from('settlements').select('actual_total,settle_date,sales_total,diff_amount').eq('store_id',currentStore.id).eq('settle_date',yestStr).maybeSingle(),
    sb.from('daily_opening').select('vault_json,actual_total,previous_close_total,created_at').eq('store_id',currentStore.id).eq('opening_date',targetDate).maybeSingle()
  ]);
  // 수정 모드면 저장 당시 previous_close_total 스냅샷 사용 (수정 후 어제 마감 변경 영향 차단)
  opPrevCloseTotal = (rec?.previous_close_total!=null) ? rec.previous_close_total : (prev?.actual_total || 0);
  // 어제 마감 결과 카드 채우기
  const sum = document.getElementById('opPrevSummary');
  if(prev){
    sum.innerHTML = `<div style="padding:4px 0;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100);"><span style="font-size:13px;color:var(--gray-600);">날짜</span><span style="font-size:14px;font-weight:700;">${prev.settle_date}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100);"><span style="font-size:13px;color:var(--gray-600);">매출</span><span style="font-size:14px;font-weight:700;">${fmt(prev.sales_total||0)}원</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100);"><span style="font-size:13px;color:var(--gray-600);">마감 차액</span><span style="font-size:14px;font-weight:700;color:${prev.diff_amount===0?'var(--success)':'var(--danger)'};">${prev.diff_amount===0?'✅ 일치':(prev.diff_amount>0?'+':'')+fmt(prev.diff_amount||0)+'원'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:10px 0 4px;border-top:2px solid var(--text);margin-top:4px;"><span style="font-size:14px;font-weight:800;">전일 마감 금고</span><span style="font-size:18px;font-weight:900;color:var(--blue);">${fmt(opPrevCloseTotal)}원</span></div>
    </div>`;
  } else {
    sum.innerHTML = `<div class="empty-state" style="padding:14px;"><p style="margin:0;font-size:13px;">어제 마감 기록이 없어요. (오늘 시작 금고만 기록됩니다)</p></div>`;
  }
  document.getElementById('opPrevClose').innerText = fmt(opPrevCloseTotal)+'원';
  // 금고 화폐 입력 복원
  const vMap = rec?.vault_json || {};
  document.querySelectorAll('.op-v-input').forEach(i=>{ i.value = vMap[i.dataset.unit] || ''; });
  // 삭제 버튼: 기록이 있고 수정 모드일 때만
  const delBtn = document.getElementById('opDeleteBtn');
  if(delBtn) delBtn.style.display = (rec && openingEditDate) ? '' : 'none';
  // 라벨 통합: rec 있으면 "수정 중", 없으면 "신규 보고" (사장님 요청 — 영업개시 생략 많음)
  const statusEl = document.getElementById('openingDateStatus');
  if(statusEl){
    if(targetDate === today) statusEl.innerText = '오늘 영업개시';
    else if(rec) statusEl.innerText = `${targetDate} 영업개시 수정 중`;
    else statusEl.innerText = `${targetDate} (영업개시 기록 없음 · 신규 보고)`;
  }
  recalcOpening();
}

// ─── 마감정산 지출 — 통장입금(bank) / 현금지출(etc) 카드 분리 ───
// 2026-05-14: 옛 단일 컨테이너(#settleDeductRows) → 두 컨테이너로 분리.
//   #settleDeductBankRows · #settleDeductEtcRows
//   type select 제거 — 컨테이너로 자동 결정 (row data-type 보존).
function _settleDeductContainerFor(type){
  return document.getElementById(type==='bank' ? 'settleDeductBankRows' : 'settleDeductEtcRows');
}
function addSettleDeductRow(type, amount, memo, catName, catId, empId, empName){
  type = (type==='bank') ? 'bank' : 'etc';
  // ── 부호 정책: amount 양수 = 빠짐, 음수 = 들어옴 (etc만 토글) ──
  amount = parseInt(amount)||0;
  const sign = (amount<0) ? -1 : 1;
  const absAmt = Math.abs(amount);
  memo = memo || '';
  catName = catName || ''; catId = catId || '';
  const cont = _settleDeductContainerFor(type);
  if(!cont) return;
  const id = 'stDed_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  // 공통 카드/입력 스타일 (B안 2줄 카드)
  const cardStyle='background:var(--gray-100);border-radius:14px;padding:12px 13px;margin-bottom:8px;';
  const amtStyle='flex:1;border:none;background:transparent;font-size:20px;font-weight:900;color:var(--text);min-width:0;';
  const memoStyle='flex:1;border:none;background:#fff;border-radius:8px;padding:9px 10px;font-size:12px;min-width:0;';
  if(type==='bank'){
    // ── 통장 입금: 금액 + 입금자만 (메모 제거 — 2026-06-16 사장님: 현금 이동은 메모 불필요, 헷갈림 유발) ──
    empId = empId || (currentEmp?.id||'');
    if(empId && !empName){ const e=(employees||[]).find(x=>x.id===empId); empName = e?e.name:''; }
    empName = empName || (currentEmp?.name||'');
    const empLabel = empName ? `👤 ${empName}` : '👤 입금자';
    cont.insertAdjacentHTML('beforeend', `
      <div class="st-deduct-row" data-id="${id}" data-type="bank" data-sign="1" data-emp-id="${empId}" data-emp-name="${empName.replace(/"/g,'&quot;')}" style="${cardStyle}">
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="text" class="st-ded-amount" placeholder="입금 금액" value="${absAmt?fmt(absAmt):''}" inputmode="numeric" style="${amtStyle}" data-input="onStDedAmountInput|this">
          <button class="st-ded-emp" data-action="pickDepositor|${id}" title="입금자 (탭하면 변경)" style="flex:0 0 auto;padding:9px 11px;border:1px solid var(--blue);border-radius:8px;font-size:11px;font-weight:700;background:var(--blue-light);color:var(--blue);cursor:pointer;white-space:nowrap;">${empLabel}</button>
        </div>
      </div>
    `);
  } else {
    // ── 현금 지출: 2줄 카드, 부호 토글 + 지출 분류 칩 ──
    const catLabel = catName ? catName : '🏷️ 지출 분류';
    const catStyle = catName
      ? 'border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);'
      : 'border:1px dashed var(--gray-300);background:#fff;color:var(--gray-500);';
    cont.insertAdjacentHTML('beforeend', `
      <div class="st-deduct-row" data-id="${id}" data-type="etc" data-sign="${sign}" data-cat-id="${catId}" data-cat-name="${catName.replace(/"/g,'&quot;')}" style="${cardStyle}">
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="st-ded-sign" data-action="toggleStDedSign|${id}" title="빠짐/들어옴 토글" style="flex:0 0 26px;height:26px;border-radius:50%;border:none;background:${sign>0?'var(--danger-light)':'#DCFCE7'};color:${sign>0?'var(--danger)':'#15803D'};font-size:15px;font-weight:900;cursor:pointer;padding:0;">${sign>0?'−':'+'}</button>
          <input type="text" class="st-ded-amount" placeholder="금액" value="${absAmt?fmt(absAmt):''}" inputmode="numeric" style="${amtStyle}" data-input="onStDedAmountInput|this" data-change="recalcSettle2">
          <button class="x-btn" data-action="removeSettleDeductRow|${id}" style="flex:0 0 24px;height:24px;border-radius:50%;border:none;background:#fff;color:var(--gray-400);font-size:14px;cursor:pointer;padding:0;">×</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <input type="text" class="st-ded-memo" placeholder="메모 (선택)" value="${memo.replace(/"/g,'&quot;')}" style="${memoStyle}">
          <button class="st-ded-cat" data-action="pickStDedCategory|${id}" style="flex:0 0 auto;padding:9px 11px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;${catStyle}">${catLabel}</button>
        </div>
      </div>
    `);
  }
  recalcSettle2();
}
// ─── 통장 입금 입금자 선택 (목록에서 고르기 — 2026-06-16 사장님 요청, 순환→드롭박스) ───
function pickDepositor(rowId){
  const row=document.querySelector('.st-deduct-row[data-id="'+rowId+'"]');
  if(!row) return;
  if(!employees || !employees.length){ toast('등록된 직원이 없어요','warn'); return; }
  const cur=row.dataset.empId;
  const sheet=document.createElement('div');
  sheet.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3000;display:flex;align-items:flex-end;';
  sheet.innerHTML=`<div style="background:#fff;width:100%;border-radius:18px 18px 0 0;padding:18px 18px 28px;max-height:70vh;overflow:auto;">
    <div style="font-size:16px;font-weight:800;margin-bottom:14px;">입금자 선택</div>
    ${employees.map(e=>`<button data-eid="${e.id}" data-en="${(e.name||'').replace(/"/g,'&quot;')}" style="width:100%;text-align:left;padding:14px;margin-bottom:8px;border:1px solid ${e.id===cur?'var(--blue)':'var(--gray-200)'};border-radius:12px;background:${e.id===cur?'var(--blue-light)':'#fff'};font-size:15px;font-weight:${e.id===cur?'800':'600'};color:${e.id===cur?'var(--blue)':'var(--text)'};cursor:pointer;">👤 ${e.name}${e.id===cur?' ✓':''}</button>`).join('')}
  </div>`;
  sheet.addEventListener('click',ev=>{
    if(ev.target===sheet){ sheet.remove(); return; }
    const btn=ev.target.closest('[data-eid]');
    if(btn){
      row.dataset.empId=btn.dataset.eid;
      row.dataset.empName=btn.dataset.en;
      const lbl=row.querySelector('.st-ded-emp');
      if(lbl) lbl.textContent='👤 '+btn.dataset.en;
      sheet.remove();
    }
  });
  document.body.appendChild(sheet);
}
// ─── 부호 토글 (etc 행만, 양방향) ───
// sign=1: 빠짐 (UI '−'), sign=-1: 들어옴 (UI '+')
function toggleStDedSign(rowId){
  const row=document.querySelector('.st-deduct-row[data-id="'+rowId+'"]');
  if(!row) return;
  const cur=parseInt(row.dataset.sign)||1;
  const next=cur*-1;
  row.dataset.sign=String(next);
  const btn=row.querySelector('.st-ded-sign');
  if(btn){
    btn.textContent=next>0?'−':'+';
    btn.style.background=next>0?'var(--danger-light)':'#DCFCE7';
    btn.style.color=next>0?'var(--danger)':'#15803D';
  }
  recalcSettle2();
}
// ─── 차감 행 분류 선택 (모든 타입 노출 — 사장님 짚음: FK 다 가능) ───
function pickStDedCategory(rowId){
  const row=document.querySelector('.st-deduct-row[data-id="'+rowId+'"]');
  if(!row) return;
  const currentName=row.dataset.catName||'';
  openCatPicker({
    current:currentName,
    onlyTypes:['expense'], // 차감(현금지출)은 지출 카테고리만 (사장님 짚음: FK 일관성)
    onSelect:(val,memo)=>{
      let catId='', catName=val||'';
      if(val && val!=='미분류'){
        const parts=String(val).split('>');
        const parentName=parts[0], childName=parts[1]||null;
        const childCat=childName?(expCategories||[]).find(c=>c.name===childName&&c.parent_id):null;
        const parentCat=(expCategories||[]).find(c=>c.name===parentName&&!c.parent_id);
        catId=childCat?childCat.id:(parentCat?parentCat.id:'');
        catName=val;
      } else { catName='미분류'; catId=''; }
      row.dataset.catId=catId;
      row.dataset.catName=catName;
      const btn=row.querySelector('.st-ded-cat');
      if(btn){
        const isSet = catName && catName!=='미분류';
        btn.textContent = isSet ? catName : '🏷️ 지출 분류';
        if(isSet){ btn.style.border='1px solid var(--blue)'; btn.style.background='var(--blue-light)'; btn.style.color='var(--blue)'; }
        else { btn.style.border='1px dashed var(--gray-300)'; btn.style.background='#fff'; btn.style.color='var(--gray-500)'; }
      }
    }
  });
}
function removeSettleDeductRow(id){
  const row = document.querySelector(`.st-deduct-row[data-id="${id}"]`);
  if(row){row.remove();recalcSettle2();}
}
function onStDedAmountInput(el){
  const raw = (el.value||'').replace(/,/g,'');
  if(/^\d*$/.test(raw)) el.value = raw ? parseInt(raw).toLocaleString() : '';
  recalcSettle2();
}
function _allSettleDeductRows(){
  return document.querySelectorAll('#settleDeductBankRows .st-deduct-row, #settleDeductEtcRows .st-deduct-row');
}
function getSettleDeductTotals(){
  // 2026-05-17 양방향 — etc 행은 sign 반영 (부호 포함 amount), bank은 항상 양수 (=빠짐)
  // 옛 book 계산은 sum을 -로 빼므로, etc의 양수입력(빠짐)이 -로 작용하도록 sum>0 유지
  let etcSum=0, bankSum=0;
  _allSettleDeductRows().forEach(row=>{
    const t = row.getAttribute('data-type')||'etc';
    const sign = parseInt(row.dataset.sign)||1;
    const abs = parseInt((row.querySelector('.st-ded-amount').value||'').replace(/,/g,''))||0;
    const signed = (t==='etc') ? sign*abs : abs; // bank은 항상 양수(= 빠짐)
    if(t==='bank') bankSum += abs; else etcSum += signed;
  });
  return {etcSum, bankSum, total: etcSum+bankSum};
}
function getSettleDeductRows(){
  // 2026-05-17 양방향 — etc 행 amount에 부호 포함 (-/+). bank은 양수만.
  const out = [];
  _allSettleDeductRows().forEach(row=>{
    const type = row.getAttribute('data-type')||'etc';
    const sign = parseInt(row.dataset.sign)||1;
    const abs = parseInt((row.querySelector('.st-ded-amount').value||'').replace(/,/g,''))||0;
    const amount = (type==='etc') ? sign*abs : abs;
    const memo = row.querySelector('.st-ded-memo')?.value || ''; // bank 행은 메모칸 없음 → ''
    const category_id = row.dataset.catId || null;
    const category_name = row.dataset.catName || '';
    const employee_id = (type==='bank') ? (row.dataset.empId || null) : null; // 통장입금 입금자
    if(abs>0) out.push({type, amount, memo, category_id, category_name, employee_id});
  });
  return out;
}
function ensureSettleDeductDefaultRows(){
  const bankCont = document.getElementById('settleDeductBankRows');
  const etcCont = document.getElementById('settleDeductEtcRows');
  if(bankCont && bankCont.children.length===0) addSettleDeductRow('bank', 0, '');
  if(etcCont && etcCont.children.length===0) addSettleDeductRow('etc', 0, '');
}

function recalcOpening(){
  let actual = 0;
  document.querySelectorAll('.op-v-input').forEach(i=>{
    actual += parseInt(i.dataset.unit) * (parseInt(i.value)||0);
  });
  document.getElementById('opActualTotal').innerText = fmt(actual)+'원';
  document.getElementById('opVaultTotal').innerText = fmt(actual)+'원';
  // 영업개시 차액 = 오늘 실제 - 어제 마감 (단순)
  const diff = actual - opPrevCloseTotal;
  const diffEl = document.getElementById('opDiff');
  const box = document.getElementById('opDiffRow');
  if(actual===0 && opPrevCloseTotal===0){
    diffEl.innerText = '-';
    box.classList.remove('diff-ok','diff-bad');
  } else {
    diffEl.innerText = diff===0 ? '✅ 일치' : `❌ ${diff>0?'+':''}${fmt(diff)}원`;
    box.classList.toggle('diff-ok', diff===0);
    box.classList.toggle('diff-bad', diff!==0);
  }
}

async function saveOpening(){
  if(!guardStore()) return;
  // 저장 대상 날짜 = picker 값 (수정 모드) 또는 오늘
  const picker = document.getElementById('openingDatePicker');
  const today = ymdLocal(new Date());
  const targetDate = (picker && picker.value) ? picker.value : today;
  let actual = 0;
  const vMap = {};
  document.querySelectorAll('.op-v-input').forEach(i=>{
    const cnt = parseInt(i.value)||0;
    const unit = parseInt(i.dataset.unit);
    if(cnt>0) vMap[unit] = cnt;
    actual += unit * cnt;
  });
  const diff = actual - opPrevCloseTotal;
  const diffStatus = diff===0 ? '일치' : `차액 ${diff>0?'+':''}${fmt(diff)}원`;
  const isEdit = (targetDate !== today);
  const headLabel = isEdit ? `[${targetDate} 영업개시 수정]` : '영업개시 보고';
  if(!confirm(`${headLabel}\n전일 마감 금고: ${fmt(opPrevCloseTotal)}원\n금고 현황: ${fmt(actual)}원\n결과: ${diffStatus}\n\n저장하시겠습니까?`)) return;
  setLoad(true,'영업개시 저장 중...');
  const {error} = await sb.from('daily_opening').upsert({
    store_id: currentStore.id,
    opening_date: targetDate,
    vault_json: vMap,
    actual_total: actual,
    previous_close_total: opPrevCloseTotal,
    created_by: currentEmp?.id || null
  }, { onConflict: 'store_id,opening_date' });
  setLoad(false);
  if(error) return errToast('영업개시 저장', error);
  toast(isEdit?'영업개시 수정 완료':'영업개시 보고 완료','success');
  // 2026-06-01: 기록조회 서브탭 제거 → 저장 후 개시마감 첫화면(차액 표)로 이동
  if(typeof nav==='function') nav('busHub');
}

// 영업개시 서브탭 전환
function openingTab(tab, el){
  const tabs = document.querySelectorAll('#openingCont .sub-tab');
  if(el){
    tabs.forEach(t=>t.classList.remove('active'));
    el.classList.add('active');
  } else {
    tabs.forEach((t,i)=>t.classList.toggle('active', (tab==='input' && i===0) || (tab==='list' && i===1)));
  }
  document.getElementById('openingInput').style.display = tab==='input' ? 'block' : 'none';
  document.getElementById('openingList').style.display = tab==='list' ? 'block' : 'none';
  if(tab==='list') loadOpeningList();
  if(tab==='input' && !el){
    // 외부 전환(수정 진입 등)이 아니면 폼 리셋
  }
}

// 영업개시 기록 리스트 (60일)
async function loadOpeningList(){
  if(!guardStore()) return;
  const c = document.getElementById('openingListData');
  c.innerHTML = '<div class="empty-state"><p>조회 중...</p></div>';
  const{data, error} = await sb.from('daily_opening')
    .select('opening_date,actual_total,previous_close_total')
    .eq('store_id', currentStore.id)
    .order('opening_date',{ascending:false}).limit(60);
  if(error){ c.innerHTML='<div class="empty-state"><p>조회 실패</p></div>'; return; }
  if(!data || !data.length){
    c.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>영업개시 기록이 없습니다</p></div>';
    return;
  }
  c.innerHTML = data.map(r=>{
    const diff = (r.actual_total||0) - (r.previous_close_total||0);
    const dow=['일','월','화','수','목','금','토'][new Date(r.opening_date+'T00:00:00').getDay()];
    const diffColor = diff===0 ? 'var(--success)' : 'var(--danger)';
    const diffTxt = diff===0 ? '✅ 일치' : `${diff>0?'+':''}${fmt(diff)}원`;
    return `<div style="border:1px solid var(--gray-200);border-radius:12px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:14px;font-weight:800;">${r.opening_date} <span style="color:var(--gray-500);font-size:11px;font-weight:400;">(${dow})</span></div>
        <div style="font-size:14px;font-weight:800;color:${diffColor};">${diffTxt}</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-600);padding:3px 0;">
        <span>전일 마감 금고</span><span>${fmt(r.previous_close_total||0)}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-600);padding:3px 0;">
        <span>금고 현황</span><span>${fmt(r.actual_total||0)}원</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;padding:8px;font-size:12px;" data-action="editOpening|${r.opening_date}">✏️ 수정</button>
        <button class="btn" style="flex:1;padding:8px;font-size:12px;background:var(--danger-light);color:var(--danger);" data-action="deleteOpening|${r.opening_date}">🗑 삭제</button>
      </div>
    </div>`;
  }).join('');
}

// 영업개시 수정 진입
async function editOpening(dateStr){
  if(!currentStore){toast('매장이 선택되지 않았어요','warn');return;}
  // 입력 탭으로 전환 + 날짜 picker 표시 + 그 날 데이터 로드
  const tabs = document.querySelectorAll('#openingCont .sub-tab');
  tabs.forEach((t,i)=>t.classList.toggle('active', i===0));
  document.getElementById('openingInput').style.display='block';
  document.getElementById('openingList').style.display='none';
  const picker = document.getElementById('openingDatePicker');
  if(picker) picker.value = dateStr;
  // status 라벨은 loadOpeningPage가 rec 받은 후 통합 설정
  await loadOpeningPage(dateStr);
  toast(`${dateStr} 데이터 불러왔어요`,'success');
}

// 영업개시 삭제 (리스트 카드 / 수정 화면 둘 다)
async function deleteOpening(dateStr){
  if(!guardStore()) return;
  // 인자 없으면 picker 값 사용 (수정 화면 삭제 버튼)
  const picker = document.getElementById('openingDatePicker');
  const target = dateStr || (picker && picker.value);
  if(!target){toast('삭제할 날짜가 없어요','warn');return;}
  if(!confirm(`${target} 영업개시 기록을 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
  setLoad(true,'삭제 중...');
  const{error} = await sb.from('daily_opening').delete().eq('store_id',currentStore.id).eq('opening_date',target);
  setLoad(false);
  if(error) return errToast('영업개시 삭제', error);
  toast(`${target} 영업개시 삭제 완료`,'success');
  // 2026-06-01: 기록조회 서브탭 제거 → 삭제 후 개시마감 첫화면으로
  if(typeof nav==='function') nav('busHub');
}

// 영업개시 날짜 picker init (관리자만 표시)
function initOpeningDate(){
  const picker = document.getElementById('openingDatePicker');
  const group = document.getElementById('openingDateGroup');
  if(!picker || !group) return;
  const today = ymdLocal(new Date());
  picker.value = today;
  picker.max = today; // 미래 차단
  // status 라벨은 loadOpeningPage가 통합 처리
  const status = document.getElementById('openingDateStatus');
  if(status) status.innerText = '오늘 영업개시';
  openingEditDate = null;
  if(isManager){
    group.style.display = 'block';
    picker.addEventListener('change', function(){
      loadOpeningPage(this.value);
      // 라벨은 loadOpeningPage 안에서 rec 기반으로 통합 설정
    });
  } else {
    group.style.display = 'none';
  }
}

// 영업개시 날짜 이동 (‹ / ›) — 로컬(한국) 시간 기준, 시간대 버그 회피
function moveOpeningDate(dir){
  const picker = document.getElementById('openingDatePicker');
  if(!picker) return;
  const d = new Date(picker.value+'T00:00:00'); d.setDate(d.getDate()+dir);
  const today = ymdLocal(new Date());
  const newDate = ymdLocal(d);
  if(newDate > today) return;
  picker.value = newDate;
  loadOpeningPage(newDate);
  // 라벨은 loadOpeningPage 안에서 rec 기반으로 통합 설정
}

// 영업개시보고서 자동 로드 (전일 마감금액)
async function loadOpeningAmount(){
  if(!currentStore) return;
  // 2026-06-01: 금고 사슬 규칙 — 그 날 영업개시 했으면 영업개시 금고, 안 했으면 전일 마감 금고
  const picker=document.getElementById('settleDatePicker');
  const settleDate=picker?.value||ymdLocal(new Date());
  await applySettleStartVault(settleDate);
  recalcSettle2();
}
function settleTab(tab,el){
  document.querySelectorAll('#settleCont .sub-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  document.getElementById('settleInput').style.display=tab==='input'?'block':'none';
  document.getElementById('settleList').style.display=tab==='list'?'block':'none';
  if(tab==='list')loadSettleList();
}
// 마감정산 입력폼 초기화 (탭 진입 시)
function resetSettleView(){
  _isEditingSettle=false; // 신규 마감 진입 기준선 — 자동날짜 허용 (수정은 editSettlement가 다시 true)
  ['siPosCash','siPosCashReceipt','siPosCard','siPosEtc','siCashCash','siCashQr','siCashTransfer'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.querySelectorAll('.v-input').forEach(i=>i.value='');
  // 지출 행 초기화 → 통장입금·현금지출 각각 기본 1행
  const bankCont=document.getElementById('settleDeductBankRows');
  const etcCont=document.getElementById('settleDeductEtcRows');
  if(bankCont){bankCont.innerHTML='';addSettleDeductRow('bank',0,'');}
  if(etcCont){etcCont.innerHTML='';addSettleDeductRow('etc',0,'');}
  const statusEl=document.getElementById('settleDateStatus');if(statusEl)statusEl.innerText='관리자 전용';
  // 마법사 초기화 — 1단계, 수기입력 숨김
  const mg=document.getElementById('swManualGroup');const mt=document.getElementById('swManualToggle');
  if(mg) mg.style.display='none';if(mt) mt.style.display='';
  _swStep=1;if(typeof _renderSettleStep==='function') _renderSettleStep();
}
async function finishSettlement2(){
  if(!guardStore()) return;
  // ─── 새 기능: 마감 중복 저장 가드 ───
  // 같은 매장+날짜에 마감이 이미 있으면 사용자에게 인지+동의 후 덮어쓰기 (upsert)
  const _settleDate=getSettleDate();
  const{data:_existSettle}=await sb.from('settlements')
    .select('id,actual_total,sales_total').eq('store_id',currentStore.id).eq('settle_date',_settleDate).maybeSingle();
  if(_existSettle){
    const dateStr=new Date(_settleDate).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
    const msg=`⚠️ 이미 ${dateStr} 마감 기록이 있습니다.\n저장된 매출: ${fmt(_existSettle.sales_total||0)}원\n저장된 금고: ${fmt(_existSettle.actual_total||0)}원\n\n새 입력으로 덮어쓸까요?`;
    if(!confirm(msg)) return;
  } else {
    // 빈 영업일 경고 (2026-06-16): 안 끝낸 이전 영업일 건너뛰고 저장하면 정산이 빠짐
    const{data:_lastDone}=await sb.from('settlements').select('settle_date')
      .eq('store_id',currentStore.id).lt('settle_date',_settleDate)
      .order('settle_date',{ascending:false}).limit(1);
    if(_lastDone&&_lastDone[0]){
      const _gap=ymdAddDays(_lastDone[0].settle_date,1); // 마지막 마감 다음날
      if(_gap<_settleDate){
        const _gStr=new Date(_gap+'T00:00:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric'});
        if(!confirm(`⚠️ ${_gStr} 마감이 아직 비어있어요.\n그 날을 건너뛰고 저장하면 그 날 정산이 빠집니다.\n\n그래도 진행할까요?`)) return;
      }
    }
  }
  // 차감: 동적 행 → deductions[] + 호환 합산값(deduct_etc/bank)
  const _stDed=getSettleDeductTotals();
  const _stDedRows=getSettleDeductRows();
  const items={
    opening:gv('siOpening'),
    pos_cash:gv('siPosCash'), pos_cash_receipt:gv('siPosCashReceipt'),
    pos_card:gv('siPosCard'), pos_etc:gv('siPosEtc'),
    cash_detail_cash:gv('siCashCash'), cash_detail_qr:gv('siCashQr'), cash_detail_transfer:gv('siCashTransfer'),
    deductions:_stDedRows,
    deduct_etc:_stDed.etcSum, deduct_bank:_stDed.bankSum
  };
  // 장부 합계
  const book=items.opening+items.cash_detail_cash-items.deduct_etc-items.deduct_bank;
  // 매출 합계 (POS 매출 4칸)
  const salesTotal=items.pos_cash+items.pos_cash_receipt+items.pos_card+items.pos_etc;
  let vault=0;const vMap={};document.querySelectorAll('.v-input').forEach(i=>{const val=parseInt(i.value)||0;vMap[i.dataset.unit]=val;vault+=parseInt(i.dataset.unit)*val;});
  const diff=vault-book;const diffStatus=diff===0?'일치':`차액 ${diff>0?'+':''}${fmt(diff)}원`;
  const _dateLabel=new Date(_settleDate+'T00:00:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
  if(!confirm(`📅 ${_dateLabel} 영업 마감\n\n매출: ${fmt(salesTotal)}원\n장부상 금고: ${fmt(book)}원\n금고 현황: ${fmt(vault)}원\n결과: ${diffStatus}\n\n저장하시겠습니까?`)) return;
  setLoad(true,'마감 저장 중...');
  const settleDate=getSettleDate();
  const{data:savedRow,error}=await sb.from('settlements').upsert({
    store_id:currentStore.id,settle_date:settleDate,
    items_json:items,vault_json:vMap,
    actual_total:vault,expected_total:book,
    diff_amount:diff,diff_status:diffStatus,
    sales_total:salesTotal,
    created_by:(typeof currentEmp!=='undefined'&&currentEmp)?currentEmp.id:null
  },{onConflict:'store_id,settle_date'}).select('id').maybeSingle();
  if(error){setLoad(false);return errToast('저장', error);}
  // ─── 새 기능: sales_daily 동시 기록 (매출 관리 페이지용) ───
  let syncResult={skipped:false};
  try{ syncResult=await syncClosingToSalesDaily(settleDate, items)||{skipped:false}; }
  catch(e){
    console.error('[sales_daily sync]',e);
    toast('매출 관리 동기화 실패: '+e.message+' — 매출 관리 탭에서 수동 확인하세요','warn',4000);
  }
  setLoad(false);
  // 다른 기기 실시간 갱신 (마감·매출 변경)
  if(typeof broadcastStoreChange==='function') broadcastStoreChange('settle');
  if(syncResult.skipped){
    toast('마감이 저장됐어요 (해당 날짜는 수동 수정본이라 매출 관리는 건너뜀)','info',4000);
  } else {
    toast('마감 저장됐어요','success');
  }
  // 2026-06-01: 기록조회 서브탭 제거 → 저장 후 개시마감 첫화면(차액 표)로 이동
  resetSettleView();
  if(typeof nav==='function') nav('busHub');
}

// ─── 새 기능: 마감정산 → sales_daily 동기화 (하루 1행 upsert) ───
// POS 현금 = (순수)현금 + QR + 계좌이체 합친 값이므로, 상세 입력값으로 분리 저장
// 수동 편집본(source='closing_edited')은 보호 — 스킵하고 {skipped:true} 반환
async function syncClosingToSalesDaily(settleDate, items){
  if(!currentStore) return {skipped:false};
  // 기존 행의 source 먼저 확인 — 수정본이면 덮어쓰지 않음
  const{data:existing}=await sb.from('sales_daily').select('source')
    .eq('store_id',currentStore.id).eq('date',settleDate).maybeSingle();
  if(existing && existing.source==='closing_edited'){
    return {skipped:true};
  }
  // 2026-05-12: 매출 = 마감 매출 4칸(현금/현금영수증/신용카드/기타결제) 그대로.
  // 현금 상세(cash_detail_*)는 금고 검증용이라 매출에 포함 안 함.
  // 옛 코드는 현금상세를 분해해서 cash/qr 컬럼에 넣었으나, 직원이 매출 4칸 안 채우고
  // 현금상세만 채우면 가짜 매출이 잡히는 문제 발생 → 매출 4칸 기준으로 단순화.
  const legacyVals={
    card:items.pos_card||0,
    cash:items.pos_cash||0,
    cash_receipt:items.pos_cash_receipt||0,
    qr:0,
    etc:items.pos_etc||0
  };
  // Part F: amounts jsonb에도 동시 저장 (legacy_key 매핑된 결제수단만)
  const amounts={};
  (paymentMethods||[]).forEach(m=>{
    if(m.legacy_key && legacyVals.hasOwnProperty(m.legacy_key)){
      const v=legacyVals[m.legacy_key];
      if(v>0) amounts[m.id]=v;
    }
  });
  const payload={
    store_id:currentStore.id,
    date:settleDate,
    ...legacyVals,
    amounts,
    memo:'마감정산 자동',
    source:'closing'
  };
  const{error}=await sb.from('sales_daily').upsert(payload,{onConflict:'store_id,date'});
  if(error) throw error;
  return {skipped:false};
}
// ─── 새 기능: 마감 기록 = 미니 카드 리스트 (2026-05-18 영업개시 패턴 통일) ───
// 통합 추적(이번달 이상 발생 합)은 시트 진입 시 상단에 표시 — 여기 리스트에는 카드만
let _settleListMonthCache = null;  // 시트 상단 월 요약용 캐시
async function loadSettleList(){
  if(!guardStore()) return;
  setLoad(true,'조회 중...');
  // 마감(items_json 포함) + 영업개시 60일 — 영업개시는 시트 상단 월 요약에서만 쓰임
  const [{data:settles}, {data:openings}] = await Promise.all([
    sb.from('settlements').select('settle_date,actual_total,expected_total,diff_amount,sales_total,items_json').eq('store_id',currentStore.id).order('settle_date',{ascending:false}).limit(60),
    sb.from('daily_opening').select('opening_date,actual_total,previous_close_total').eq('store_id',currentStore.id).order('opening_date',{ascending:false}).limit(60)
  ]);
  setLoad(false);
  const c=document.getElementById('settleListData');
  if(!settles || !settles.length){
    _settleListMonthCache = null;
    c.innerHTML='<div class="empty-state"><div class="empty-icon">📭</div><p>마감 기록이 없습니다</p></div>';
    return;
  }
  // 이번달 통합 추적 합 (시트 상단에서 사용)
  const calcOpDiff = (op) => op ? ((op.actual_total||0) - (op.previous_close_total||0)) : 0;
  const nowYM = (new Date()).toISOString().slice(0,7);
  const opMap={};
  (openings||[]).forEach(r=>{ opMap[r.opening_date]=r; });
  let sumOp=0, sumSt=0, sumAbs=0;
  settles.forEach(r=>{
    if(!r.settle_date.startsWith(nowYM)) return;
    const op = calcOpDiff(opMap[r.settle_date]);
    const st = r.diff_amount || 0;
    sumOp += op; sumSt += st;
    sumAbs += Math.abs(op) + Math.abs(st);
  });
  Object.keys(opMap).forEach(d=>{
    // 마감 없는 날의 영업개시도 합산 (도난 추적 누락 방지)
    if(!d.startsWith(nowYM)) return;
    const hasSettle = settles.some(s=>s.settle_date===d);
    if(hasSettle) return;
    const op = calcOpDiff(opMap[d]);
    sumOp += op; sumAbs += Math.abs(op);
  });
  _settleListMonthCache = { ym: nowYM, sumOp, sumSt, sumAbs };
  // 카드 렌더
  c.innerHTML = settles.map(r=>{
    const dow=['일','월','화','수','목','금','토'][new Date(r.settle_date+'T00:00:00').getDay()];
    const diff = r.diff_amount||0;
    const diffColor = diff===0 ? 'var(--success)' : 'var(--danger)';
    const diffTxt = diff===0 ? '✅ 일치' : `🌙 ${diff>0?'+':''}${fmt(diff)}원`;
    // 차감 행 (신규 deductions 우선, 없으면 옛 deduct_etc/bank)
    const items = r.items_json || {};
    const dedRows = [];
    if(Array.isArray(items.deductions) && items.deductions.length){
      items.deductions.forEach(d=>{
        const amt = d.amount||0;
        if(amt<=0) return;
        const icon = d.type==='bank' ? '🏧' : '📤';
        const label = d.type==='bank' ? '통장 입금' : '현금 지출';
        dedRows.push({icon, label, amt, memo:d.memo||''});
      });
    } else {
      const dEtc = items.deduct_etc||0;
      const dBank = items.deduct_bank||0;
      if(dBank>0) dedRows.push({icon:'🏧', label:'통장 입금', amt:dBank, memo:items.deduct_bank_memo||''});
      if(dEtc>0) dedRows.push({icon:'📤', label:'현금 지출', amt:dEtc, memo:items.deduct_etc_memo||''});
    }
    const dedHtml = dedRows.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--gray-200);">${dedRows.map(d=>`
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:var(--gray-600);">
        <span>${d.icon} ${d.label}${d.memo?` <span style="color:var(--gray-400);">· ${d.memo}</span>`:''}</span>
        <span style="font-weight:700;color:var(--danger);">−${fmt(d.amt)}원</span>
      </div>`).join('')}</div>` : '';
    return `<div class="settle-list-item" data-action="gotoCard|${r.settle_date}" style="display:block;cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:14px;font-weight:800;">${r.settle_date} <span style="color:var(--gray-500);font-size:11px;font-weight:400;">(${dow})</span></div>
        <div style="font-size:13px;font-weight:800;color:${diffColor};">${diffTxt}</div>
      </div>
      ${dedHtml}
    </div>`;
  }).join('');
}
// 카드 클릭 → 풀 상세 시트 열기 (영업개시 패턴 — 카드에 모든 행위가 모임)
function gotoCard(d){
  cardDateStr = d;
  openSheet('settleDetailSheet');
  renderSettleSheetMonthSummary();
  loadSettleCard(d);
}
// 시트 상단 "이번달 이상 발생" 요약 (loadSettleList 에서 캐시한 값 사용)
function renderSettleSheetMonthSummary(){
  const el = document.getElementById('settleSheetMonthSummary');
  if(!el) return;
  const c = _settleListMonthCache;
  if(!c){ el.style.display='none'; return; }
  const fmtCell = (v)=>{
    if(v===0) return '<span style="color:var(--gray-500);">0원</span>';
    const color = v>0 ? 'var(--success)' : 'var(--danger)';
    return `<span style="color:${color};font-weight:800;">${v>0?'+':''}${fmt(v)}원</span>`;
  };
  el.style.display='block';
  el.innerHTML = `<div style="font-size:11px;font-weight:800;color:var(--gray-600);margin-bottom:6px;">📊 ${c.ym} 이상 발생 추적</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--gray-600);">🏁 영업개시 차액 합</span>${fmtCell(c.sumOp)}</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--gray-600);">🌙 마감 차액 합</span>${fmtCell(c.sumSt)}</div>
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;margin-top:4px;border-top:1px solid var(--gray-200);">
      <span style="color:var(--gray-700);font-weight:700;">⚠️ 이상 발생 합</span>
      <span style="font-weight:900;color:${c.sumAbs>0?'var(--danger)':'var(--gray-500)'};">${c.sumAbs>0?fmt(c.sumAbs)+'원':'0원'}</span>
    </div>`;
}
async function loadSettleCard(d){
  cardDateStr=d;
  const picker=document.getElementById('cardDatePicker');
  if(picker) picker.value=d;
  const navDateEl=document.getElementById('cardNavDate');
  if(navDateEl) navDateEl.innerText=d;
  if(!currentStore) return;
  const{data}=await sb.from('settlements').select('*').eq('store_id',currentStore.id).eq('settle_date',d).maybeSingle();
  const c=document.getElementById('settleCardData');
  if(!data){c.innerHTML='<div class="empty-state"><div class="empty-icon">📅</div><p>기록이 없습니다</p></div>';return;}
  const items=data.items_json||{};
  // 섹션 헤더 헬퍼
  const sectionHead = (icon, title, sub) => `<div style="margin-top:14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:13px;font-weight:800;color:var(--text);">${icon} ${title}</span>${sub?`<span style="font-size:11px;color:var(--gray-500);">${sub}</span>`:''}</div>`;
  // 행 렌더 헬퍼
  const row = (label, val, opts={}) => {
    const v = val||0;
    const c2 = opts.color || 'var(--text)';
    const sz = opts.bold ? '14px' : '13px';
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-100);font-size:${sz};"><span style="color:var(--gray-600);">${label}</span><span style="font-weight:${opts.bold?800:700};color:${c2};">${fmt(v)}원</span></div>`;
  };
  // 매출/현금분해 합산
  const salesSum = (items.pos_cash||0)+(items.pos_cash_receipt||0)+(items.pos_card||0)+(items.pos_etc||0);
  const cashDetailSum = (items.cash_detail_cash||0)+(items.cash_detail_qr||0)+(items.cash_detail_transfer||0);

  let html='';

  // 1) 영업개시
  html += sectionHead('🏁','영업개시');
  html += row('💰 전일 마감 금고', items.opening||0);

  // 2) 매출 (4칸)
  html += sectionHead('💵','매출','현금+현금영수증+신용카드+기타결제');
  html += row('💵 현금', items.pos_cash||0);
  html += row('🧾 현금영수증', items.pos_cash_receipt||0);
  html += row('💳 신용카드', items.pos_card||0);
  html += row('📲 기타결제', items.pos_etc||0);
  html += `<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--blue);margin-top:4px;"><span style="font-size:14px;font-weight:800;color:var(--blue);">매출 합계</span><span style="font-size:16px;font-weight:900;color:var(--blue);">${fmt(salesSum)}원</span></div>`;

  // 3) 현금 결제 분해 (검증용)
  html += sectionHead('💱','현금 결제 분해','매출 검증용 (합산 X)');
  html += row('💵 순수 현금', items.cash_detail_cash||0);
  html += row('📱 QR', items.cash_detail_qr||0);
  html += row('🏦 계좌이체', items.cash_detail_transfer||0);
  html += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--gray-200);"><span style="font-size:13px;font-weight:700;color:var(--gray-600);">분해 합계</span><span style="font-size:14px;font-weight:800;">${fmt(cashDetailSum)}원</span></div>`;
  // 불일치 시 ⚠️ 안내
  // 마감정산 입력 화면 검증식과 동일: POS(현금+현금영수증) vs 상세(현금+QR+이체)
  const posCashReceiptSum = (items.pos_cash||0)+(items.pos_cash_receipt||0);
  if(cashDetailSum !== posCashReceiptSum){
    const diffCD = cashDetailSum - posCashReceiptSum;
    html += `<div style="background:var(--danger-light);border-radius:10px;padding:10px;margin-top:6px;font-size:12px;color:var(--danger);font-weight:600;">⚠️ 매출 현금+현금영수증 ${fmt(posCashReceiptSum)}원과 분해 합 ${fmt(cashDetailSum)}원이 ${diffCD>0?'+':''}${fmt(diffCD)}원 차이입니다. 직원 입력 누락 가능성 — 확인 필요.</div>`;
  }

  // 4) 차감
  const deductEtc = items.deduct_etc||0;
  const deductBank = items.deduct_bank||0;
  const deductEtcMemo = items.deduct_etc_memo||'';
  const deductBankMemo = items.deduct_bank_memo||'';
  const dedRow = (label, val, memo) => `<div style="padding:8px 0;border-bottom:1px solid var(--gray-100);">
    <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--gray-600);">${label}</span><span style="font-weight:700;color:var(--danger);">−${fmt(val)}원</span></div>
    ${memo?`<div style="font-size:11px;color:var(--gray-500);margin-top:2px;padding-left:4px;">↳ ${memo}</div>`:''}
  </div>`;
  if(deductEtc>0 || deductBank>0){
    html += sectionHead('📤','차감');
    if(deductEtc>0) html += dedRow('📤 현금 지출', deductEtc, deductEtcMemo);
    if(deductBank>0) html += dedRow('🏧 통장 입금', deductBank, deductBankMemo);
  }

  // 6) 금고 계수
  if(data.vault_json && Object.values(data.vault_json).some(v=>v>0)){
    html += sectionHead('💰','금고 계수');
    Object.entries(data.vault_json).filter(([,v])=>v>0).sort((a,b)=>parseInt(b[0])-parseInt(a[0])).forEach(([unit,cnt])=>{
      html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100);font-size:13px;"><span style="color:var(--gray-600);">${parseInt(unit).toLocaleString()}원권</span><span style="font-weight:700;">${cnt}장 = ${fmt(parseInt(unit)*cnt)}원</span></div>`;
    });
  }

  // 7) 최종 결과
  const diff=data.diff_amount||0;
  html += `<div style="background:var(--${diff===0?'success':'danger'}-light);border-radius:12px;padding:14px;margin-top:14px;text-align:center;"><div style="font-size:12px;color:var(--gray-600);font-weight:600;">📊 마감 차액</div><div style="font-size:22px;font-weight:800;color:var(--${diff===0?'success':'danger'});margin-top:4px;">${diff===0?'✅ 일치':(diff>0?'+':'')+fmt(diff)+'원'}</div><div style="font-size:12px;color:var(--gray-600);margin-top:4px;">장부상 금고 ${fmt(data.expected_total)} · 금고 현황 ${fmt(data.actual_total)}</div></div>`;

  // 관리자: 수정/삭제 버튼
  if(isManager){
    html+=`<div class="action-group" style="margin-top:12px;">
      <button class="btn btn-primary" style="flex:2;padding:14px;" data-action="editSettlement|${d}">수정하기</button>
      <button class="btn btn-danger" style="flex:1;padding:14px;" data-action="deleteSettlement|${d}">삭제</button>
    </div>`;
  }
  c.innerHTML=html;
}

// ─── 새 기능: 정산 수정 ───
async function editSettlement(dateStr, silent){
  // 기존 정산 데이터를 입력 폼에 로드하고 입력 탭으로 전환
  // silent=true: 날짜 화살표 이동 시 재사용 (안내 토스트 생략)
  _isEditingSettle=true; // 수정 모드 — 자동날짜가 이 날짜를 덮지 않게 (2026-06-16)
  if(!currentStore){toast('매장이 선택되지 않았어요','warn');return;}
  if(!currentEmp){toast('로그인 정보가 없어요. 다시 로그인 해주세요','warn');return;}
  let data, error;
  try{
    setLoad(true,'기존 마감 불러오는 중...');
    const res = await sb.from('settlements').select('*').eq('store_id',currentStore.id).eq('settle_date',dateStr).maybeSingle();
    data = res.data; error = res.error;
    setLoad(false);
  }catch(e){
    setLoad(false);
    console.error('[editSettlement] catch:', e);
    toast('수정 불러오기 실패: '+(e?.message||String(e)).slice(0,60),'error',7000);
    return;
  }
  if(error){errToast('수정 불러오기', error); return;}
  if(!data) return toast('정산 데이터를 찾을 수 없습니다.','warn');
  // 날짜 설정
  const picker=document.getElementById('settleDatePicker');
  if(picker) picker.value=dateStr;
  // 시트 열려있으면 닫고 입력 탭으로 전환
  closeSheet('settleDetailSheet');
  const tabs=document.querySelectorAll('#settleCont .sub-tab');
  tabs.forEach((t,i)=>t.classList.toggle('active',i===0));
  document.getElementById('settleInput').style.display='block';
  document.getElementById('settleList').style.display='none';
  // items_json → 입력 필드에 채우기 (차감 제외, 차감은 동적 행으로 별도 처리)
  const fieldMap={
    opening:'siOpening',pos_cash:'siPosCash',pos_cash_receipt:'siPosCashReceipt',
    pos_card:'siPosCard',pos_etc:'siPosEtc',
    cash_detail_cash:'siCashCash',cash_detail_qr:'siCashQr',cash_detail_transfer:'siCashTransfer'
  };
  const items=data.items_json||{};
  Object.entries(fieldMap).forEach(([key,elId])=>{
    const el=document.getElementById(elId);
    if(el) el.value=items[key]?parseInt(items[key]).toLocaleString():'';
  });
  // 🔧 개시 금고 최신 반영 (금고 사슬: 마감→개시→마감). 저장 당시 opening 박제 대신 현재 개시/전일마감 다시 읽음
  //    — 개시 수정이 마감 수정 화면에 반영 안 되던 버그 (2026-06-15 사장님 지적)
  await applySettleStartVault(dateStr);
  // 지출 행 복원 (deductions 신규 우선, 없으면 옛 deduct_etc/bank+memo 로 변환)
  // 두 컨테이너(통장입금·현금지출) 각각 비우고 type별로 분기 채움
  const bankCont=document.getElementById('settleDeductBankRows');
  const etcCont=document.getElementById('settleDeductEtcRows');
  if(bankCont || etcCont){
    if(bankCont) bankCont.innerHTML='';
    if(etcCont) etcCont.innerHTML='';
    if(Array.isArray(items.deductions) && items.deductions.length){
      items.deductions.forEach(d=>addSettleDeductRow(d.type||'etc', d.amount||0, d.memo||'', d.category_name||'', d.category_id||'', d.employee_id||'', ''));
    } else {
      // 옛 데이터: 단일 값 → type별 1행씩
      addSettleDeductRow('etc', items.deduct_etc||0, items.deduct_etc_memo||'', '', '');
      addSettleDeductRow('bank', items.deduct_bank||0, items.deduct_bank_memo||'', '', '');
    }
    // 🔧 통장입금(시재입금) 행이 없으면 빈 행 보장 — 수정 화면에서 입금 입력 못 하던 버그 (2026-06-15)
    ensureSettleDeductDefaultRows();
  }
  // vault_json → 금고 입력
  const vault=data.vault_json||{};
  document.querySelectorAll('.v-input').forEach(i=>{i.value=vault[i.dataset.unit]||'';});
  // 전일 마감금액 상태
  const statusEl=document.getElementById('settleDateStatus');
  if(statusEl) statusEl.innerText='기존 데이터 수정 중';
  recalcSettle2();
  // 마법사: 수정 시 매출 입력창 보이게 + 1단계로 리셋
  const mg=document.getElementById('swManualGroup');const mt=document.getElementById('swManualToggle');
  if(mg) mg.style.display='block';if(mt) mt.style.display='none';
  _swStep=1;if(typeof _renderSettleStep==='function') _renderSettleStep();
  if(!silent) toast('정산 데이터를 불러왔어요. 수정 후 저장하세요.','success');
}
async function deleteSettlement(dateStr){
  if(!confirm(dateStr+' 정산 기록을 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.')) return;
  setLoad(true,'삭제 중...');
  const{error}=await sb.from('settlements').delete().eq('store_id',currentStore.id).eq('settle_date',dateStr);
  setLoad(false);
  if(error) return errToast('삭제', error);
  toast('정산 기록 삭제됐어요','success');
  closeSheet('settleDetailSheet');
  // 2026-06-01: 기록조회 서브탭 제거 → 삭제 후 개시마감 첫화면(차액 표)로
  if(typeof nav==='function') nav('busHub');
}
async function moveCardDate(dir){const d=new Date(cardDateStr);d.setDate(d.getDate()+dir);await loadSettleCard(ymdLocal(d));}
async function onCardDateChange(el){const v=el.value;if(v) await loadSettleCard(v);}

