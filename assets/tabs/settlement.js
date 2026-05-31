// ══════════════════════════════════════════
// 마감정산
// ══════════════════════════════════════════
// ── 마감정산 로직 ──
// ─── 정산 날짜 선택 (관리자용) ───
function initSettleDate(){
  const picker=document.getElementById('settleDatePicker');
  const group=document.getElementById('settleDateGroup');
  const today=ymdLocal(new Date());
  picker.value=today;
  picker.max=today; // 미래 날짜 차단
  if(isManager){
    group.style.display='block';
    picker.addEventListener('change',function(){
      // 날짜 변경 시 전일 마감금액 다시 로드
      loadOpeningForDate(this.value);
    });
  }
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
  // 기존 마감 없음 → 빈 폼 + 전일 마감 금고(이월금)만
  resetSettleView();
  const d=new Date(dateStr+'T00:00:00');d.setDate(d.getDate()-1);
  const yd=ymdLocal(d);
  const{data}=await sb.from('settlements').select('actual_total').eq('store_id',currentStore.id).eq('settle_date',yd).maybeSingle();
  const el=document.getElementById('siOpening');
  const statusEl=document.getElementById('openingStatus');
  if(data?.actual_total!=null){
    el.value=parseInt(data.actual_total).toLocaleString();
    statusEl.innerText='전일('+yd+') 마감 금고';
  } else {
    el.value='';
    statusEl.innerText='전일 마감 데이터 없음';
  }
  recalcSettle2();
  const statusEl2=document.getElementById('settleDateStatus');
  if(statusEl2) statusEl2.innerText='새 정산';
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
    const fillExtra=(legacyKey,val)=>{
      if(!val) return;
      const it=extraItems.find(x=>x.legacy_key===legacyKey);
      if(!it) return;
      const inp=document.querySelector('.s-extra-input[data-extra-id="'+it.id+'"]');
      if(inp) inp.value=parseInt(val).toLocaleString();
    };

    // 매출 필드 채우기
    fill('siPosCash',getVal(colMap.pos_cash));
    fill('siPosCashReceipt',getVal(colMap.pos_cash_receipt));
    fill('siPosCard',getVal(colMap.pos_card));
    fill('siPosEtc',getVal(colMap.pos_etc));
    fillExtra('draw_large',getVal(colMap.draw_large));
    fillExtra('draw_small',getVal(colMap.draw_small));
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

  // 매출합계 (본 매출만 — 기타매출은 장부와 별개)
  const salesTotal=posCash+posCR+posCard+posEtc;
  document.getElementById('calcSalesTotal').innerText=fmt(salesTotal)+'원';

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

  // 장부 합계 (금고에 있어야 할 금액) — 기타매출 제외
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

  // 기타매출 패널 (오늘 입력 + 누적)
  recalcExtraRevenuePanel();

  refreshSaveButtonState(diff);
}
// 차액 0이면 저장 버튼 초록 강조 (sticky 차액 패널과 동기)
function refreshSaveButtonState(diff){
  const saveBtn=document.querySelector('[data-action="finishSettlement2"]');
  if(!saveBtn) return;
  saveBtn.classList.toggle('settle-ready', diff===0);
}

// 기타매출 입력칸 동적 렌더링
function renderExtraRevenueInputs(){
  const c=document.getElementById('extraRevenueInputs');
  if(!c) return;
  if(!extraItems.length){
    c.innerHTML='<div style="text-align:center;padding:14px 0;color:var(--gray-500);font-size:12px;">등록된 항목 없음 — 사이드메뉴 ▸ 매출 관리 ▸ 기타매출 항목 관리</div>';
    document.getElementById('extraRevenuePanel').style.display='none';
    return;
  }
  c.innerHTML=extraItems.map(it=>{
    const sum=extraItemSums[it.id]||0;
    return `<div class="settle-item">
      <span class="si-icon">${it.icon||'🎰'}</span>
      <span class="si-label">${it.name}<br><span style="font-size:10px;color:var(--gray-500);font-weight:500;">누적 ${fmt(sum)}원</span></span>
      <input type="text" class="s-input s-extra-input" data-extra-id="${it.id}" placeholder="0" inputmode="numeric" data-input="onSInput|this" data-change="recalcSettle2">
    </div>`;
  }).join('');
}

// 기타매출 결과 패널 갱신 (오늘 합계 + 항목별 누적)
function recalcExtraRevenuePanel(){
  const panel=document.getElementById('extraRevenuePanel');
  const summary=document.getElementById('extraRevenueSummary');
  if(!panel||!summary) return;
  if(!extraItems.length){panel.style.display='none';return;}
  let todayTotal=0;
  const rows=extraItems.map(it=>{
    const inp=document.querySelector('.s-extra-input[data-extra-id="'+it.id+'"]');
    const today=inp?(parseInt((inp.value||'').replace(/,/g,''))||0):0;
    todayTotal+=today;
    const cum=(extraItemSums[it.id]||0)+today;
    return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;">
      <span style="color:#6B21A8;">${it.icon||'🎰'} ${it.name}</span>
      <span style="font-weight:700;color:#6B21A8;">오늘 ${fmt(today)} · 누적 ${fmt(cum)}원</span>
    </div>`;
  }).join('');
  summary.innerHTML=rows+`<div style="display:flex;justify-content:space-between;border-top:1px dashed #C084FC;padding-top:5px;margin-top:5px;font-size:13px;font-weight:800;color:#6B21A8;">
    <span>오늘 기타매출 합계</span><span>${fmt(todayTotal)}원</span></div>`;
  panel.style.display='block';
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
      <div style="display:flex;justify-content:space-between;padding:10px 0 4px;border-top:2px solid var(--text);margin-top:4px;"><span style="font-size:14px;font-weight:800;">마감 금고</span><span style="font-size:18px;font-weight:900;color:var(--blue);">${fmt(opPrevCloseTotal)}원</span></div>
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
function addSettleDeductRow(type, amount, memo, catName, catId){
  type = (type==='bank') ? 'bank' : 'etc';
  // ── 부호 정책 (2026-05-17 갈아엎기) ──
  // 옛 의미 보존: amount 양수 = 금고에서 빠짐 (book 차감), 음수 = 들어옴 (book 증가, -(-)=+)
  // UI 토글: '−' = 빠짐 (sign=1, default), '+' = 들어옴 (sign=-1)
  amount = parseInt(amount)||0;
  const sign = (amount<0) ? -1 : 1; // 음수 amount면 들어옴 (sign=-1, UI '+')
  const absAmt = Math.abs(amount);
  memo = memo || '';
  catName = catName || ''; catId = catId || '';
  const cont = _settleDeductContainerFor(type);
  if(!cont) return;
  const id = 'stDed_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const catLabel = catName ? `🏷️ ${catName}` : '🏷️ 분류 선택';
  const catColor = catName ? 'var(--text)' : 'var(--gray-500)';
  // etc 행만 ± 토글. bank은 항상 빠짐(통장 입금)
  // sign=1(빠짐) → '−' 빨강 / sign=-1(들어옴) → '+' 초록
  const signBtnHtml = type==='etc'
    ? `<button class="st-ded-sign" data-action="toggleStDedSign|${id}" title="빠짐/들어옴 토글" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--gray-200);background:${sign>0?'var(--danger-light)':'#DCFCE7'};color:${sign>0?'var(--danger)':'#15803D'};font-size:16px;font-weight:900;cursor:pointer;padding:0;">${sign>0?'−':'+'}</button>`
    : '';
  const gridCols = type==='etc' ? '32px 1fr 28px' : '1fr 28px';
  cont.insertAdjacentHTML('beforeend', `
    <div class="st-deduct-row" data-id="${id}" data-type="${type}" data-sign="${sign}" data-cat-id="${catId}" data-cat-name="${catName.replace(/"/g,'&quot;')}" style="display:grid;grid-template-columns:${gridCols};gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100);">
      ${signBtnHtml}
      <input type="text" class="st-ded-amount" placeholder="금액" value="${absAmt?fmt(absAmt):''}" inputmode="numeric" style="padding:8px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:right;min-width:0;" data-input="onStDedAmountInput|this">
      <button class="x-btn" data-action="removeSettleDeductRow|${id}" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--danger-light);color:var(--danger);font-size:14px;font-weight:800;cursor:pointer;padding:0;">×</button>
      <button class="st-ded-cat" data-action="pickStDedCategory|${id}" style="grid-column:1 / -1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:8px;font-size:12px;background:#fff;text-align:left;cursor:pointer;color:${catColor};">${catLabel}</button>
      <input type="text" class="st-ded-memo" placeholder="메모 (선택)" value="${memo.replace(/"/g,'&quot;')}" style="grid-column:1 / -1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:8px;font-size:12px;">
    </div>
  `);
  recalcSettle2();
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
        btn.textContent=catName?`🏷️ ${catName}`:'🏷️ 분류 선택';
        btn.style.color=catName?'var(--text)':'var(--gray-500)';
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
    const memo = row.querySelector('.st-ded-memo').value || '';
    const category_id = row.dataset.catId || null;
    const category_name = row.dataset.catName || '';
    if(abs>0) out.push({type, amount, memo, category_id, category_name});
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
  if(!confirm(`${headLabel}\n어제 마감: ${fmt(opPrevCloseTotal)}원\n오늘 실제: ${fmt(actual)}원\n결과: ${diffStatus}\n\n저장하시겠습니까?`)) return;
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
  // 수정 모드면 리스트로 돌아감, 신규는 그대로
  if(isEdit){
    openingTab('list', null);
  }
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
        <span>어제 마감</span><span>${fmt(r.previous_close_total||0)}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-600);padding:3px 0;">
        <span>오늘 실제</span><span>${fmt(r.actual_total||0)}원</span>
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
  // 리스트로 돌아감
  openingTab('list', null);
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
  // 2026-05-14: picker.value(settle_date) 기준 전날 마감 로드.
  // 옛 버그: 시스템 today-1 고정이라 사장님이 settle_date 변경해도 전일이월금이 항상 가장 최근 마감으로 갔음.
  const picker=document.getElementById('settleDatePicker');
  const settleDate=picker?.value||ymdLocal(new Date());
  const d=new Date(settleDate+'T00:00:00');d.setDate(d.getDate()-1);
  const yd=ymdLocal(d);
  const{data} = await sb.from('settlements').select('actual_total').eq('store_id',currentStore.id).eq('settle_date',yd).maybeSingle();
  const el=document.getElementById('siOpening');
  const statusEl=document.getElementById('openingStatus');
  if(data?.actual_total!=null){
    el.value=parseInt(data.actual_total).toLocaleString();
    statusEl.innerText='전일('+yd+') 마감금액';
    if(!isManager) el.readOnly=true;
  } else {
    el.value='';
    statusEl.innerText='전일('+yd+') 마감 데이터 없음';
  }
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
  ['siPosCash','siPosCashReceipt','siPosCard','siPosEtc','siCashCash','siCashQr','siCashTransfer'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.querySelectorAll('.v-input').forEach(i=>i.value='');
  document.querySelectorAll('.s-extra-input').forEach(i=>i.value='');
  // 지출 행 초기화 → 통장입금·현금지출 각각 기본 1행
  const bankCont=document.getElementById('settleDeductBankRows');
  const etcCont=document.getElementById('settleDeductEtcRows');
  if(bankCont){bankCont.innerHTML='';addSettleDeductRow('bank',0,'');}
  if(etcCont){etcCont.innerHTML='';addSettleDeductRow('etc',0,'');}
  const statusEl=document.getElementById('settleDateStatus');if(statusEl)statusEl.innerText='관리자 전용';
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
  // 기타매출 입력값 수집 (legacy_key='draw_large/small'는 items_json에도 호환용 저장)
  const extraInputs={};  // {item_id: amount}
  let extraTotal=0;
  document.querySelectorAll('.s-extra-input').forEach(inp=>{
    const v=parseInt((inp.value||'').replace(/,/g,''))||0;
    if(v>0) extraInputs[inp.dataset.extraId]=v;
    extraTotal+=v;
  });
  // 호환용: 기존 items_json에 extra_draw_* 키도 채움 (마감 카드 itemDefs가 본 옛 형태)
  extraItems.forEach(it=>{
    const v=extraInputs[it.id]||0;
    if(it.legacy_key==='draw_large') items.extra_draw_large=v;
    if(it.legacy_key==='draw_small') items.extra_draw_small=v;
  });
  // 장부 합계 (기타매출 제외)
  const book=items.opening+items.cash_detail_cash-items.deduct_etc-items.deduct_bank;
  // 매출 합계 (본 매출만 — 기타매출은 별도 패널에서 표시)
  const salesTotal=items.pos_cash+items.pos_cash_receipt+items.pos_card+items.pos_etc;
  let vault=0;const vMap={};document.querySelectorAll('.v-input').forEach(i=>{const val=parseInt(i.value)||0;vMap[i.dataset.unit]=val;vault+=parseInt(i.dataset.unit)*val;});
  const diff=vault-book;const diffStatus=diff===0?'일치':`차액 ${diff>0?'+':''}${fmt(diff)}원`;
  const extraLine=extraTotal>0?`\n기타매출: ${fmt(extraTotal)}원 (별도 관리)`:'';
  if(!confirm(`매출: ${fmt(salesTotal)}원${extraLine}\n장부: ${fmt(book)}원\n금고: ${fmt(vault)}원\n결과: ${diffStatus}\n\n저장하시겠습니까?`)) return;
  setLoad(true,'마감 저장 중...');
  const settleDate=getSettleDate();
  const{data:savedRow,error}=await sb.from('settlements').upsert({
    store_id:currentStore.id,settle_date:settleDate,
    items_json:items,vault_json:vMap,
    actual_total:vault,expected_total:book,
    diff_amount:diff,diff_status:diffStatus,
    sales_total:salesTotal
  },{onConflict:'store_id,settle_date'}).select('id').maybeSingle();
  if(error){setLoad(false);return errToast('저장', error);}
  // ─── 새 기능: 기타매출 로그 기록 (extra_revenue_logs) ───
  // 같은 마감의 기존 로그는 삭제 후 새로 INSERT (재저장 안전)
  if(savedRow?.id){
    try{
      await sb.from('extra_revenue_logs').delete().eq('settlement_id',savedRow.id);
      const logRows=Object.entries(extraInputs)
        .filter(([itemId,])=>!itemId.startsWith('legacy_'))  // 레거시 가짜 ID는 DB에 INSERT 불가
        .map(([itemId,amount])=>({
          store_id:currentStore.id, item_id:itemId, log_date:settleDate,
          amount, settlement_id:savedRow.id, memo:'마감자동'
        }));
      if(logRows.length){
        const{error:elErr}=await sb.from('extra_revenue_logs').insert(logRows);
        if(elErr) console.warn('[extra_revenue_logs] 저장 실패:',elErr.message);
      }
    } catch(e){ console.warn('[extra_revenue_logs] skip:',e.message); }
  }
  // ─── 새 기능: sales_daily 동시 기록 (매출 관리 페이지용) ───
  let syncResult={skipped:false};
  try{ syncResult=await syncClosingToSalesDaily(settleDate, items)||{skipped:false}; }
  catch(e){
    console.error('[sales_daily sync]',e);
    toast('매출 관리 동기화 실패: '+e.message+' — 매출 관리 탭에서 수동 확인하세요','warn',4000);
  }
  setLoad(false);
  if(syncResult.skipped){
    toast('마감이 저장됐어요 (해당 날짜는 수동 수정본이라 매출 관리는 건너뜀)','info',4000);
  } else {
    toast('마감 저장됐어요','success');
  }
  // 저장 후 기록 조회 탭으로 이동 (방금 저장한 마감 확인 가능). location.reload() 제거로
  // 자동 로그인 → 대시보드 점프 현상 방지.
  const listTab=document.querySelector('#settleCont .sub-tab[data-action*="settleTab|list"]');
  if(listTab) listTab.click();
  else resetSettleView();
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
    etc:items.pos_etc||0,
    extra_large:0,
    extra_small:0
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
        const label = d.type==='bank' ? '통장입금' : '기타사용';
        dedRows.push({icon, label, amt, memo:d.memo||''});
      });
    } else {
      const dEtc = items.deduct_etc||0;
      const dBank = items.deduct_bank||0;
      if(dBank>0) dedRows.push({icon:'🏧', label:'통장입금', amt:dBank, memo:items.deduct_bank_memo||''});
      if(dEtc>0) dedRows.push({icon:'📤', label:'기타사용', amt:dEtc, memo:items.deduct_etc_memo||''});
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
  html += row('💰 전일 이월금', items.opening||0);

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
    if(deductEtc>0) html += dedRow('📤 기타사용', deductEtc, deductEtcMemo);
    if(deductBank>0) html += dedRow('🏧 통장입금', deductBank, deductBankMemo);
  }

  // 5) 기타매출 (기존 함수)
  const extraHtml = await renderSettleCardExtraSection(data);
  if(extraHtml && extraHtml.trim()) {
    html += sectionHead('🎰','기타매출','장부와 별도 관리');
    html += extraHtml;
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
  html += `<div style="background:var(--${diff===0?'success':'danger'}-light);border-radius:12px;padding:14px;margin-top:14px;text-align:center;"><div style="font-size:12px;color:var(--gray-600);font-weight:600;">📊 마감 차액</div><div style="font-size:22px;font-weight:800;color:var(--${diff===0?'success':'danger'});margin-top:4px;">${diff===0?'✅ 일치':(diff>0?'+':'')+fmt(diff)+'원'}</div><div style="font-size:12px;color:var(--gray-600);margin-top:4px;">장부 ${fmt(data.expected_total)} · 금고 ${fmt(data.actual_total)}</div></div>`;

  // 관리자: 수정/삭제 버튼
  if(isManager){
    html+=`<div class="action-group" style="margin-top:12px;">
      <button class="btn btn-primary" style="flex:2;padding:14px;" data-action="editSettlement|${d}">수정하기</button>
      <button class="btn btn-danger" style="flex:1;padding:14px;" data-action="deleteSettlement|${d}">삭제</button>
    </div>`;
  }
  c.innerHTML=html;
}

// ─── 새 기능: 마감 카드 기타매출 섹션 ───
// settlement_id로 logs 조회 → 항목별 표시. logs 없으면 items_json 폴백(옛 마감).
async function renderSettleCardExtraSection(data){
  if(!data) return '';
  let logs=[];
  if(data.id){
    try{
      const{data:lg}=await sb.from('extra_revenue_logs')
        .select('item_id,amount').eq('settlement_id',data.id);
      logs=lg||[];
    }catch(e){ /* 테이블 미존재 폴백 */ }
  }
  // logs 있으면 신규 형식, 없으면 items_json의 extra_draw_* 폴백
  let entries=[];  // [{name, icon, amount}]
  if(logs.length){
    const itemMap={};
    extraItems.forEach(it=>{itemMap[it.id]=it;});
    logs.forEach(l=>{
      const it=itemMap[l.item_id];
      if(it && l.amount>0) entries.push({name:it.name,icon:it.icon||'🎰',amount:l.amount});
    });
  } else if(data.items_json){
    const lg=data.items_json.extra_draw_large||0;
    const sm=data.items_json.extra_draw_small||0;
    if(lg>0) entries.push({name:'뽑기(대형)',icon:'🎰',amount:lg});
    if(sm>0) entries.push({name:'뽑기(소형)',icon:'🎲',amount:sm});
  }
  if(!entries.length) return '';
  const total=entries.reduce((s,e)=>s+e.amount,0);
  let h='<div style="margin-top:8px;background:#F3E8FF;border:1px solid #D8B4FE;border-radius:10px;padding:10px 12px;">'
    +'<div style="font-size:12px;font-weight:700;color:#6B21A8;margin-bottom:6px;">기타매출 (장부 별도)</div>';
  entries.forEach(e=>{
    h+=`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#6B21A8;"><span>${e.icon} ${e.name}</span><span style="font-weight:700;">${fmt(e.amount)}원</span></div>`;
  });
  h+=`<div style="display:flex;justify-content:space-between;border-top:1px dashed #C084FC;padding-top:5px;margin-top:5px;font-size:13px;font-weight:800;color:#6B21A8;"><span>합계</span><span>${fmt(total)}원</span></div></div>`;
  return h;
}

// ─── 새 기능: 정산 수정 ───
async function editSettlement(dateStr, silent){
  // 기존 정산 데이터를 입력 폼에 로드하고 입력 탭으로 전환
  // silent=true: 날짜 화살표 이동 시 재사용 (안내 토스트 생략)
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
  // 지출 행 복원 (deductions 신규 우선, 없으면 옛 deduct_etc/bank+memo 로 변환)
  // 두 컨테이너(통장입금·현금지출) 각각 비우고 type별로 분기 채움
  const bankCont=document.getElementById('settleDeductBankRows');
  const etcCont=document.getElementById('settleDeductEtcRows');
  if(bankCont || etcCont){
    if(bankCont) bankCont.innerHTML='';
    if(etcCont) etcCont.innerHTML='';
    if(Array.isArray(items.deductions) && items.deductions.length){
      items.deductions.forEach(d=>addSettleDeductRow(d.type||'etc', d.amount||0, d.memo||'', d.category_name||'', d.category_id||''));
    } else {
      // 옛 데이터: 단일 값 → type별 1행씩
      addSettleDeductRow('etc', items.deduct_etc||0, items.deduct_etc_memo||'', '', '');
      addSettleDeductRow('bank', items.deduct_bank||0, items.deduct_bank_memo||'', '', '');
    }
  }
  // 기타매출 입력칸 동적 렌더링 + 기존 logs 채우기
  renderExtraRevenueInputs();
  if(data.id){
    try{
      const{data:lg}=await sb.from('extra_revenue_logs')
        .select('item_id,amount').eq('settlement_id',data.id);
      (lg||[]).forEach(l=>{
        const inp=document.querySelector('.s-extra-input[data-extra-id="'+l.item_id+'"]');
        if(inp && l.amount>0) inp.value=parseInt(l.amount).toLocaleString();
      });
    }catch(e){ /* 테이블 미존재 폴백 */ }
  }
  // 폴백: logs가 없고 items_json에 옛 extra_draw_*가 있으면 → legacy_key로 매핑
  const lg=items.extra_draw_large||0, sm=items.extra_draw_small||0;
  if(lg>0 || sm>0){
    extraItems.forEach(it=>{
      if(it.legacy_key==='draw_large' && lg>0){
        const inp=document.querySelector('.s-extra-input[data-extra-id="'+it.id+'"]');
        if(inp && !inp.value) inp.value=parseInt(lg).toLocaleString();
      }
      if(it.legacy_key==='draw_small' && sm>0){
        const inp=document.querySelector('.s-extra-input[data-extra-id="'+it.id+'"]');
        if(inp && !inp.value) inp.value=parseInt(sm).toLocaleString();
      }
    });
  }
  // vault_json → 금고 입력
  const vault=data.vault_json||{};
  document.querySelectorAll('.v-input').forEach(i=>{i.value=vault[i.dataset.unit]||'';});
  // 전일 마감금액 상태
  const statusEl=document.getElementById('settleDateStatus');
  if(statusEl) statusEl.innerText='기존 데이터 수정 중';
  recalcSettle2();
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
  loadSettleList();
}
async function moveCardDate(dir){const d=new Date(cardDateStr);d.setDate(d.getDate()+dir);await loadSettleCard(ymdLocal(d));}
async function onCardDateChange(el){const v=el.value;if(v) await loadSettleCard(v);}

