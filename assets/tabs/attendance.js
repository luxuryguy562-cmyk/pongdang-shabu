// ══════════════════════════════════════════
// 근태관리
// ══════════════════════════════════════════
function attTab(tab,el){
  document.querySelectorAll('#attendanceCont .sub-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  // 호환: 'list'(F안 폐기됨) / 'sched'(2026-05-21 통합 폐기됨) → 'all' 통합 매핑
  if(tab==='list' || tab==='sched') tab='all';
  // att 카드 안 패널 토글 (List 패널은 F안에서 폐기됨)
  ['Manual','Caps','All'].forEach(t=>{const d=document.getElementById('att'+t);if(d)d.style.display='none';});
  const panel = document.getElementById('att'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(panel) panel.style.display='block';
  if(tab==='all'){
    document.getElementById('vAllMonth').innerText = attAllMonth;
    loadAttAll(); // 안에서 본인 모드면 주간 간트도 호출. work_schedules 동시 로드 → 계획+실제 통합 표시
  }
}
function initAttDate(){
  const el=document.getElementById('vDate');
  if(el){el.innerText=ymdLocal(new Date());el.classList.remove('empty');}
  const rEl=document.getElementById('vRest');
  if(rEl) rEl.value=settings.auto_rest_min||0;
  // 현재 시간 시계 시작
  startAttClock();
  // 오늘 출퇴근 상태 로드
  if(currentStore) loadTodayRecord();
  // 직원 홈 요약 (이번 달 번 돈 + 다음 근무 + 이번 주)
  renderEmpHome();
}

// ─── 새 기능: 직원 홈 요약 (2026-06-09, staff-only) ───
async function renderEmpHome(){
  const box=document.getElementById('empHomeSummary');
  if(!box) return;
  if(isManager || !currentEmp || !currentStore){ box.style.display='none'; return; }
  box.style.display='block';
  const empId=currentEmp.id, now=new Date();
  const monthStart=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const dow=(now.getDay()+6)%7;                       // 월=0
  const ws=new Date(now); ws.setDate(now.getDate()-dow);
  const weekStartStr=ymdLocal(ws);
  const today=ymdLocal(now);
  // 이번 달 출퇴근 → 급여·시간
  const { data: logs } = await sb.from('attendance_logs')
    .select('work_date,total_work_min,calculated_wage')
    .eq('store_id',currentStore.id).eq('employee_id',empId)
    .gte('work_date',monthStart);
  let monthWage=0, weekMin=0, weekDays=0;
  (logs||[]).forEach(r=>{
    monthWage += r.calculated_wage||0;
    if(r.work_date>=weekStartStr){ weekMin += r.total_work_min||0; if((r.total_work_min||0)>0) weekDays++; }
  });
  const amtEl=document.getElementById('empHomeMonthAmt'); if(amtEl) amtEl.innerText=_empWon(monthWage);
  const subEl=document.getElementById('empHomeMonthSub'); if(subEl) subEl.innerText=`${now.getMonth()+1}월 · 지금까지`;
  const wd=document.getElementById('empHomeWeekDays'); if(wd) wd.innerText=weekDays+'일';
  const wh=document.getElementById('empHomeWeekHours'); if(wh) wh.innerText=fmtHourDecimal(weekMin);
  // 다음 근무 (work_schedules)
  const { data: sched } = await sb.from('work_schedules')
    .select('work_date,wish_start,wish_end,is_off,memo')
    .eq('store_id',currentStore.id).eq('employee_id',empId)
    .gte('work_date',today).eq('is_off',false)
    .order('work_date').limit(1);
  const nextEl=document.getElementById('empHomeNext');
  if(nextEl){
    const s=(sched&&sched.length)?sched[0]:null;
    if(s && s.wish_start){
      const tmr=ymdLocal(new Date(now.getTime()+86400000));
      const dlabel = s.work_date===today?'오늘':s.work_date===tmr?'내일':s.work_date.slice(5).replace('-','.');
      const st=(s.wish_start||'').slice(0,5), en=(s.wish_end||'').slice(0,5);
      nextEl.innerHTML=`<span style="font-size:15px;font-weight:900;color:var(--text);">${dlabel} · ${st}${en?' ~ '+en:''}</span>${s.memo?`<span style="font-size:12px;color:var(--gray-600);"> · ${s.memo}</span>`:''}`;
    } else {
      nextEl.innerHTML=`<span style="font-size:14px;color:var(--gray-400);">예정된 근무가 없어요</span>`;
    }
  }
}
let attClockTimer=null;
function startAttClock(){
  if(attClockTimer) clearInterval(attClockTimer);
  function update(){
    const now=new Date();
    const timeEl=document.getElementById('attNowTime');
    const dateEl=document.getElementById('attTodayDate');
    if(timeEl) timeEl.innerText=now.toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false});
    if(dateEl){
      const days=['일','월','화','수','목','금','토'];
      dateEl.innerText=`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]})`;
    }
  }
  update();attClockTimer=setInterval(update,60000);
}
async function loadTodayRecord(){
  if(!currentStore) return;
  const empId=currentEmp?.id||(isManager&&selectedEmpId?selectedEmpId:null);
  if(!empId&&!isManager) return;
  const today=ymdLocal(new Date());
  const query=isManager&&selectedEmpId
    ?sb.from('attendance_logs').select('*,employees(name)').eq('store_id',currentStore.id).eq('employee_id',selectedEmpId).eq('work_date',today).maybeSingle()
    :currentEmp
      ?sb.from('attendance_logs').select('*,employees(name)').eq('store_id',currentStore.id).eq('employee_id',currentEmp.id).eq('work_date',today).maybeSingle()
      :null;
  if(!query) return;
  const{data}=await query;
  updateCheckInOutUI(data);
}
function updateCheckInOutUI(record){
  // G안: 상태 변환 카드 (before / during / after)
  // 2026-05-25 mockup ② 적용: 아바타 + 펄스 점 + 정보 그리드
  const card  = document.getElementById('attStatusCard');
  const badge = document.getElementById('attStatusBadge');
  const meta  = document.getElementById('attStatusMeta');
  const avatar= document.getElementById('attStatusAvatar');
  const nameEl= document.getElementById('attStatusName');
  const inBtn = document.getElementById('btnCheckIn');
  const outBtn= document.getElementById('btnCheckOut');
  if(!card) return;
  // 아바타 글자 + 이름 (selectedEmp가 있으면 우선, 없으면 currentEmp)
  const empObj = (selectedEmpId && (employees||[]).find(e=>e.id===selectedEmpId)) || currentEmp || null;
  const empName = empObj?.name || '사장님';
  if(avatar) avatar.innerText = (empName || '?').slice(0,1);
  if(nameEl) nameEl.innerText = empName;
  card.classList.remove('before','during','after');
  meta.classList.remove('grid');
  const fmtT = d => d.toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false});
  if(!record || !record.app_in){
    card.classList.add('before');
    if(badge) badge.innerText = '⚪ 아직 출근 안 했어요';
    if(meta)  meta.innerHTML  = '';
    if(inBtn){ inBtn.style.display=''; inBtn.disabled=false; }
    if(outBtn){ outBtn.style.display='none'; }
  } else if(record.app_in && !record.app_out){
    card.classList.add('during');
    const inT = new Date(record.app_in);
    const elapsedMin = Math.max(0, Math.round((new Date()-inT)/60000));
    const eh = Math.floor(elapsedMin/60), em = elapsedMin%60;
    if(badge) badge.innerText = `🔵 근무 중  ${eh>0?eh+'시간 ':''}${em}분 째`;
    if(meta){
      meta.classList.add('grid');
      meta.innerHTML = `
        <div class="cell"><div class="lbl">출근</div><div class="vl">${fmtT(inT)}</div></div>
        <div class="cell"><div class="lbl">경과</div><div class="vl">${eh>0?eh+'h ':''}${em}m</div></div>`;
    }
    if(inBtn){ inBtn.style.display='none'; }
    if(outBtn){ outBtn.style.display=''; outBtn.disabled=false; }
  } else {
    card.classList.add('after');
    const inT  = new Date(record.app_in);
    const outT = new Date(record.app_out);
    const work = record.total_work_min || 0;
    const wh = Math.floor(work/60), wm = work%60;
    const wageStr = record.calculated_wage!=null ? fmt(record.calculated_wage)+'원' : '-';
    if(badge) badge.innerText = `🟢 오늘 수고하셨어요  ${wh}시간 ${wm}분`;
    if(meta){
      meta.classList.add('grid');
      meta.innerHTML = `
        <div class="cell"><div class="lbl">근무</div><div class="vl">${fmtT(inT)}~${fmtT(outT)}</div></div>
        <div class="cell wage"><div class="lbl">오늘 일당</div><div class="vl">${wageStr}</div></div>`;
    }
    if(inBtn){ inBtn.style.display='none'; }
    if(outBtn){ outBtn.style.display='none'; }
  }
}

// ─── 새 기능: 출퇴근 사후 등록 시트 (관리자) ───
function openAttManualSheet(date, empId){
  if(!isManager){ toast('출퇴근 누락 시 관리자에게 등록을 요청하세요.','warn'); return; }
  // 직원 자동 채우기 (있으면)
  if(empId){
    const e = (employees||[]).find(x=>x.id===empId);
    selectedEmpId = empId;
    const empEl = document.getElementById('vEmpName');
    if(empEl){ empEl.innerText = e?.name || '직원'; empEl.classList.remove('empty'); }
  } else {
    selectedEmpId = null;
    const empEl = document.getElementById('vEmpName');
    if(empEl){ empEl.innerText = '선택'; empEl.classList.add('empty'); }
  }
  // 날짜
  const dateEl = document.getElementById('vDate');
  if(dateEl){ dateEl.innerText = date || new Date().toISOString().slice(0,10); dateEl.classList.remove('empty'); }
  // 시간 리셋
  ['vStart','vEnd'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.innerText='-'; el.classList.add('empty'); }
  });
  const rEl = document.getElementById('vRest');
  if(rEl) rEl.value = (typeof settings!=='undefined' && settings.auto_rest_min) || 0;
  selectedEmpCtx='att'; // 직원 선택 시 vEmpName 갱신용
  openSheet('attManualSheet');
}
let _checkInBusy=false; // 출근 버튼 연타 방지 (경쟁조건 중복 저장 차단)
async function checkIn(){
  if(_checkInBusy){toast('출근 처리 중입니다...','warn');return;}
  if(!guardStore()) return;
  const empId=currentEmp?.id||(isManager&&selectedEmpId?selectedEmpId:null);
  if(!empId) return toast('직원을 선택하거나 로그인하세요.','warn');
  _checkInBusy=true;
  try{
  // WiFi IP 검증
  setLoad(true,'위치 확인 중...');
  const ipCheck=await checkIPForAttendance();
  if(!ipCheck.ok){
    setLoad(false);
    if(isManager){
      if(!confirm(ipCheck.msg+'\n\n관리자 권한으로 출근 처리하시겠습니까?')) return;
    } else {
      toast(ipCheck.msg+' 매장 WiFi에서 다시 시도하세요.','error');return;
    }
  }
  // 기기 지문 검증
  setLoad(true,'기기 확인 중...');
  const devCheck=await checkDeviceForAttendance(empId);
  setLoad(false);
  if(!devCheck.ok){
    if(isManager){
      if(!confirm(devCheck.msg+'\n\n관리자 권한으로 출근 처리하시겠습니까?')) return;
    } else {
      toast(devCheck.msg,'error');return;
    }
  }
  if(devCheck.firstReg) toast('이 기기가 출퇴근 기기로 등록됐습니다.','success');
  const now=new Date();const today=ymdLocal(now);
  // 2026-06-01: maybeSingle()은 이미 중복(2개+)이면 에러나 검사가 무력화됨 → limit(1) 배열로 강화
  const{data:existRows}=await sb.from('attendance_logs').select('id,app_in').eq('store_id',currentStore.id).eq('employee_id',empId).eq('work_date',today).order('created_at').limit(1);
  const exist=existRows&&existRows[0];
  if(exist?.app_in){toast('이미 출근 처리됐습니다. 출근: '+new Date(exist.app_in).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false}),'warn');return;}
  setLoad(true,'출근 처리 중...');
  const{error}=await sb.from('attendance_logs').insert({store_id:currentStore.id,employee_id:empId,work_date:today,app_in:now.toISOString(),caps_match_status:'앱전용',check_in_ip:ipCheck.ip||null});
  setLoad(false);
  if(error) return errToast('출근 처리', error);
  // ─── 새 기능: 출근 즉시 피드백 ───
  const _t=now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
  toast(`🌅 출근 완료! ${_t} · 좋은 하루 보내세요`,'success',3500);
  await loadTodayRecord();
  }finally{_checkInBusy=false;}
}
async function checkOut(){
  if(!guardStore()) return;
  const empId=currentEmp?.id||(isManager&&selectedEmpId?selectedEmpId:null);
  if(!empId) return toast('직원을 선택하거나 로그인하세요.','warn');
  // WiFi IP 검증
  setLoad(true,'위치 확인 중...');
  const ipCheck=await checkIPForAttendance();
  if(!ipCheck.ok){
    setLoad(false);
    if(isManager){
      if(!confirm(ipCheck.msg+'\n\n관리자 권한으로 퇴근 처리하시겠습니까?')) return;
    } else {
      toast(ipCheck.msg+' 매장 WiFi에서 다시 시도하세요.','error');return;
    }
  }
  // 기기 지문 검증
  setLoad(true,'기기 확인 중...');
  const devCheck=await checkDeviceForAttendance(empId);
  setLoad(false);
  if(!devCheck.ok){
    if(isManager){
      if(!confirm(devCheck.msg+'\n\n관리자 권한으로 퇴근 처리하시겠습니까?')) return;
    } else {
      toast(devCheck.msg,'error');return;
    }
  }
  const now=new Date();const today=ymdLocal(now);
  let{data:record}=await sb.from('attendance_logs').select('*').eq('store_id',currentStore.id).eq('employee_id',empId).eq('work_date',today).maybeSingle();
  // 자정 넘긴 경우: 오늘 기록 없으면 어제 기록 확인
  if(!record?.app_in){
    const yd=new Date(now);yd.setDate(yd.getDate()-1);
    const yesterday=ymdLocal(yd);
    const{data:yRecord}=await sb.from('attendance_logs').select('*').eq('store_id',currentStore.id).eq('employee_id',empId).eq('work_date',yesterday).maybeSingle();
    if(yRecord?.app_in&&!yRecord?.app_out) record=yRecord;
  }
  if(!record?.app_in){toast('출근 기록이 없습니다.','warn');return;}
  if(record.app_out){toast('이미 퇴근 처리됐습니다.','warn');return;}
  const appIn=new Date(record.app_in);
  const w=await calcWageData(empId, appIn, now, today, null);
  setLoad(true,'퇴근 처리 중...');
  const{error}=await sb.from('attendance_logs').update({app_out:now.toISOString(),rest_min:w.restMin,total_work_min:w.totalMin,weekend_flag:w.isWeekend,calculated_wage:w.wage,check_out_ip:ipCheck.ip||null}).eq('id',record.id).eq('store_id',currentStore.id);
  setLoad(false);
  if(error) return errToast('퇴근 처리', error);
  // ─── 새 기능: 퇴근 즉시 피드백 (근무시간 + 일급) ───
  const _totalMin=w.totalMin||0;
  const _h=Math.floor(_totalMin/60), _m=_totalMin%60;
  const _wageStr=w.wage?` · 오늘 ${fmt(w.wage)}원`:'';
  toast(`👏 오늘 ${_h}시간 ${_m}분 일하셨어요${_wageStr}. 수고하셨습니다!`,'success',4500);
  await loadTodayRecord();
}
async function openEmpSheet(ctx='att'){
  if(!guardStore()) return;
  selectedEmpCtx=ctx;
  document.getElementById('empSheetList').innerHTML=employees.filter(e=>e.is_active).map(e=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--gray-100);border-radius:13px;margin-bottom:9px;cursor:pointer;" data-action="selectEmpFromSheet|${e.id}|${e.name}">
      <div><div style="font-size:14px;font-weight:700;">${e.name}</div><div style="font-size:12px;color:var(--gray-600);">${e.role||''} · 시급 ${fmt(e.base_wage)}원</div></div>
    </div>`).join('')||'<div class="empty-state"><p>등록된 직원이 없습니다</p></div>';
  openSheet('empSheet');
}
function selectEmpFromSheet(id,name){
  if(selectedEmpCtx==='att'){
    // 사후 등록 시트에서 호출된 경우: 직원 시트만 닫고 사후 등록 시트는 유지
    selectedEmpId=id;
    const el=document.getElementById('vEmpName');el.innerText=name;el.classList.remove('empty');
    closeSheet('empSheet');
    return;
  } else if(selectedEmpCtx==='sched'){
    // 근무 계획 시트에서 호출된 경우: 직원 시트만 닫고 sched 시트는 유지 (2026-05-12 fix)
    schedEmpId=id;
    const el=document.getElementById('vSchedEmp');el.innerText=name;el.classList.remove('empty');
    closeSheet('empSheet');
    return;
  } else if(selectedEmpCtx==='wp'){
    // 주단위 일괄 입력 시트에서 호출: wpEmpId 채우고 기존 일정 자동 로드
    wpEmpId=id;
    const el=document.getElementById('wpEmp');
    if(el){el.innerText=name; el.classList.remove('empty');}
    closeSheet('empSheet');
    renderWpDayCards(); // 옛 일정 자동 채움
    return;
  }
  closeAllSheets();
}
async function saveAttendance(){
  if(!guardStore()||!selectedEmpId) return toast('직원을 선택하세요.','warn');
  const date=document.getElementById('vDate').innerText;
  const sStr=document.getElementById('vStart').innerText;
  const eStr=document.getElementById('vEnd').innerText;
  if(sStr==='-') return toast('출근 시간을 입력하세요.','warn');
  const appIn=new Date(date+'T'+sStr+':00');
  let appOut=eStr!=='-'?new Date(date+'T'+eStr+':00'):null;
  // 자정 넘는 근무 자동 처리: 퇴근 시각이 출근보다 같거나 빠르면 = 다음날 퇴근
  let crossedMidnight=false;
  if(appOut&&appOut<=appIn){appOut=new Date(appOut.getTime()+24*60*60*1000);crossedMidnight=true;}
  if(appOut&&(appOut-appIn)>24*60*60*1000) return toast('근무 시간이 24시간을 초과합니다. 시각 확인해주세요.','error');
  const restMin=parseInt(document.getElementById('vRest').value)||0;
  const w=await calcWageData(selectedEmpId, appIn, appOut, date, restMin);
  // 2026-06-01: 같은 직원+날짜 기존 기록 있으면 중복 저장 차단 (사장님: 한 명 하루 한 번)
  const{data:dup}=await sb.from('attendance_logs').select('id').eq('store_id',currentStore.id).eq('employee_id',selectedEmpId).eq('work_date',date).limit(1);
  if(dup&&dup.length){return toast('이미 이 날짜 근태 기록이 있습니다. 기존 기록을 수정하세요.','warn');}
  setLoad(true,'근태 기록 중...');
  const {error}=await sb.from('attendance_logs').insert({
    store_id:currentStore.id,employee_id:selectedEmpId,work_date:date,
    app_in:appIn.toISOString(),app_out:appOut?.toISOString()||null,
    rest_min:w.restMin,total_work_min:w.totalMin,night_min:w.nightMin,
    weekend_flag:w.isWeekend,calculated_wage:w.wage,caps_match_status:'앱전용'
  });
  setLoad(false);
  if(error) return errToast('저장', error);
  toast(crossedMidnight?`기록됐어요 (익일 ${eStr} 퇴근으로 처리)`:'기록됐어요','success');
  selectedEmpId=null;
  ['vEmpName','vStart','vEnd'].forEach(id=>{const el=document.getElementById(id);if(el){el.innerText=id==='vEmpName'?'선택':'-';el.classList.add('empty');}});
  closeAllSheets();
  // 📋 근무 기록 캘린더 갱신 (사후 등록 후 즉시 반영)
  if(typeof loadAttList==='function') loadAttList();
}
function calcNightMin(inT,outT,date,ns,ne){
  const [nh,nm]=ns.split(':').map(Number);const [eh,em]=ne.split(':').map(Number);
  const nsD=new Date(date);nsD.setHours(nh,nm,0);
  const neD=new Date(date);neD.setHours(eh,em,0);
  return Math.max(0,Math.round((Math.min(outT,neD)-Math.max(inT,nsD))/60000));
}
// 급여 계산 공통 헬퍼
async function calcWageData(empId, appIn, appOut, date, restMinOverride){
  const emp=employees.find(e=>e.id===empId);
  const restMin=restMinOverride!=null?restMinOverride:(settings.auto_rest_min||0);
  const isWeekend=[0,6].includes(new Date(date).getDay());
  const{data:sw}=await sb.from('special_wages').select('extra_amount').eq('store_id',currentStore.id).eq('target_date',date).maybeSingle();
  let totalMin=null,nightMin=0,wage=null;
  if(appIn&&appOut){
    totalMin=Math.max(0,Math.round((appOut-appIn)/60000)-restMin);
    const ns=settings.night_extra_start,ne=settings.night_extra_end;
    nightMin=ns&&ne?calcNightMin(appIn,appOut,date,ns,ne):0;
    const wE=isWeekend?(settings.weekend_extra||0):0;
    const nE=settings.night_extra_amount||0; // 시간당 야간 추가시급
    const spE=sw?.extra_amount||0;
    // 2026-05-25 버그 수정: 야간수당은 nightMin 부분만 적용 (옛 식은 totalMin 전체에 곱해 과지급)
    //  · 정상식: (총근무h) × (시급 + 주말추가 + 특별가산) + (야간h) × 야간추가
    const baseRate=(emp?.base_wage||10030)+wE+spE;
    wage=Math.round((totalMin/60)*baseRate + (nightMin/60)*nE);
  }
  return{restMin,isWeekend,totalMin,nightMin,wage};
}
// 근태 조회 월 상태 (F안 통합: attAllMonth 단일)
let attAllMonth = new Date().toISOString().slice(0,7);
// ─── 새 기능: 근태 전체조회 E안 (월 캘린더 + 일별 간트) ───
let attAllSelectedDate = null;
let attAllDayMap = {};
const EMP_COLORS = ['#0050FF','#05C072','#FF9500','#F04452','#8E5AFF','#00BCD4','#FFC107','#4E5968'];
function empColor(empId){
  if(!empId) return '#B0B8C1';
  let h=0; const s=String(empId);
  for(let i=0;i<s.length;i++) h = ((h<<5)-h+s.charCodeAt(i))|0;
  return EMP_COLORS[Math.abs(h)%EMP_COLORS.length];
}
function fmtHourDecimal(min){
  if(min==null||min<=0) return '0h';
  // 2026-05-25 사장님 호소: 0.5h 단위 반올림 부정확 → 소수점 한 자리 정확 표시
  //             + 천 단위 콤마 (1234.5h → 1,234.5h, 큰 매장 대응)
  const h = min/60;
  const v = Number.isInteger(h) ? h.toFixed(0) : h.toFixed(1);
  const [intP, decP] = v.split('.');
  const intFormatted = Number(intP).toLocaleString('ko-KR');
  return (decP ? intFormatted + '.' + decP : intFormatted) + 'h';
}
// ─── 월급제 직원 일할 계산 헬퍼 (2026-05-25 신설) ─────────────────────
//  · 3개 화면 공통 사용: 근태기록 KPI / 지출관리 인건비 카드 / 급여 집계
//  · 사장님 호소: 월급제(탁성현) 인건비 누락 → 시급+월급 합산 통일
//  · 이번달 = 진행일까지, 지난달 = lastDay까지 누적 (hire/resign 고려)
//  · 반환: [{empId, name, monthly_wage(만원), daily(원), daysCovered, total(원)}]
function calcMonthlyProratedWages(ym){
  if(!ym) return [];
  const [y,m] = ym.split('-').map(Number);
  const lastDay = new Date(y,m,0).getDate();
  const today = new Date();
  const isCurMonth = today.toISOString().slice(0,7) === ym;
  const passedDays = isCurMonth ? today.getDate() : lastDay;
  const result = [];
  const monthlyEmps = (employees||[]).filter(e=>e.is_active && e.wage_type==='monthly' && e.monthly_wage>0);
  monthlyEmps.forEach(emp=>{
    const dailyWage = Math.round((emp.monthly_wage*10000)/lastDay);
    const hire = emp.hire_date ? new Date(emp.hire_date+'T00:00:00') : null;
    const resign = emp.resign_date ? new Date(emp.resign_date+'T00:00:00') : null;
    let daysCovered = 0;
    for(let day=1; day<=passedDays; day++){
      const date = new Date(ym+'-'+String(day).padStart(2,'0')+'T00:00:00');
      if(hire && date < hire) continue;
      if(resign && date > resign) continue;
      daysCovered++;
    }
    result.push({
      empId: emp.id,
      name: emp.name,
      monthly_wage: emp.monthly_wage, // 만원
      daily: dailyWage, // 원
      daysCovered,
      total: dailyWage * daysCovered,
      lastDay, passedDays
    });
  });
  return result;
}
// 인건비 컴팩트 표기: 10만 이상이면 만 단위 반올림 "385만", 미만이면 "9,500원"
function fmtMan(won){
  if(!won) return '0';
  if(won >= 100000) return Math.round(won/10000).toLocaleString('ko')+'만';
  return won.toLocaleString('ko')+'원';
}

function moveAttMonth(dir, mode){
  // F안 통합: mode 인자 무시, attAllMonth 단일 사용
  const d = new Date(attAllMonth+'-01'); d.setMonth(d.getMonth()+dir);
  attAllMonth = d.toISOString().slice(0,7);
  const lbl=document.getElementById('vAllMonth'); if(lbl) lbl.innerText=attAllMonth;
  attAllSelectedDate=null;
  loadAttList();
}

async function loadAttList(/* allMode 인자는 무시 — F안 통합 */){
  if(!currentStore){ toast('매장을 먼저 선택하세요.','warn'); openStoreSheet(); return; }
  const monthStr = attAllMonth;
  const labelEl = document.getElementById('vAllMonth');
  if(labelEl) labelEl.innerText = monthStr;

  // staff 자동 본인 필터 잠금
  const sel = document.getElementById('attEmpFilter');
  if(sel && currentEmp && !isManager){
    if(sel.value !== currentEmp.id) sel.value = currentEmp.id;
    sel.disabled = true;
  } else if(sel){
    sel.disabled = false;
  }

  // 해당 월 말일
  const [y,m] = monthStr.split('-').map(Number);
  const lastDay = new Date(y,m,0).getDate();
  const startDate = monthStr+'-01';
  const endDate   = monthStr+'-'+String(lastDay).padStart(2,'0');

  let query = sb.from('attendance_logs')
    .select('*, employees(name)')
    .eq('store_id', currentStore.id)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', {ascending:false})
    .limit(500);

  // 필터값 = 1인 모드 키
  const empF = (sel?.value) || (currentEmp && !isManager ? currentEmp.id : '');
  if(empF) query = query.eq('employee_id', empF);

  // ─── 새 기능: 근무계획(work_schedules) 동시 로드 (계획+실제 통합 표시용) ───
  let schedQuery = sb.from('work_schedules')
    .select('*, employees(name)')
    .eq('store_id', currentStore.id)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .limit(500);
  if(empF) schedQuery = schedQuery.eq('employee_id', empF);

  setLoad(true,'조회 중...');
  const [{data, error}, {data:schedData, error:schedErr}] = await Promise.all([query, schedQuery]);
  setLoad(false);
  if(error) console.error('근태 조회 오류:',error);
  if(schedErr) console.error('근무계획 조회 오류:',schedErr);

  // 편집용 인덱스 데이터
  window._attListData = data||[];

  // dayMap 빌드 (실제)
  attAllDayMap = {};
  (data||[]).forEach(r=>{
    if(!r.work_date) return;
    (attAllDayMap[r.work_date] = attAllDayMap[r.work_date]||[]).push(r);
  });
  // 계획 dayMap (renderAttDayDetail에서 참조)
  window._attSchedDayMap = {};
  (schedData||[]).forEach(s=>{
    if(!s.work_date) return;
    (window._attSchedDayMap[s.work_date] = window._attSchedDayMap[s.work_date]||[]).push(s);
  });
  window._attSchedListData = schedData||[];

  // 모드 판정
  const isSingleView = !!empF;
  const isOwnView    = !!currentEmp && empF === currentEmp.id;

  // KPI 3분할
  const kpiEl = document.getElementById('attKpi');
  if(kpiEl){
    if(data && data.length){
      const totalDays = Object.keys(attAllDayMap).length;
      const totalMin  = data.reduce((a,r)=>a+(r.total_work_min||0),0);
      // 2026-05-25 인건비 통일: 시급제 calculated_wage + 월급제 일할 누적 (사장님 호소: 월급 누락)
      //  · 직원 필터 모드(empF)면 그 직원 1명만 계산. 전체 모드면 모든 직원.
      const monthlyEmpIds = new Set((employees||[]).filter(e=>e.wage_type==='monthly').map(e=>e.id));
      const hourlyWage = data.filter(r=>!monthlyEmpIds.has(r.employee_id)).reduce((a,r)=>a+(r.calculated_wage||0),0);
      const monthlyList = calcMonthlyProratedWages(monthStr).filter(m=>!empF || m.empId===empF);
      const monthlyWage = monthlyList.reduce((a,m)=>a+m.total,0);
      const totalWage = hourlyWage + monthlyWage;
      kpiEl.style.display='grid';
      // 2026-05-25 갈아엎기: 3분할 → 2분할 (사장님 호소: 출근일+근무 합치고 인건비 넓게)
      //  · 보조 칸: 📅 출근일 + ⏱ 근무 두 줄 (세로 가운데 정렬 — CSS justify-content:center)
      //  · 인건비 칸: 좌측 정렬 + 큰 숫자 + 시급·월급 분기
      // 2026-06-02 사장님 호소: 만원 압축 → 원 단위 진짜 숫자 (인건비·시급·월급 통일)
      const splitHtml = (monthlyWage>0)
        ? `<div class="att-kpi-split"><span class="h">⏰ 시급 ${hourlyWage.toLocaleString('ko-KR')}원</span><span class="m">💼 월급 ${monthlyWage.toLocaleString('ko-KR')}원</span></div>`
        : '';
      kpiEl.innerHTML = `
        <div class="att-kpi-cell aux">
          <div class="item"><span class="l">📅 출근일</span><span class="v">${totalDays}일</span></div>
          <div class="item"><span class="l">⏱ 근무시간</span><span class="v">${fmtHourDecimal(totalMin)}</span></div>
        </div>
        <div class="att-kpi-cell wage">
          <div class="att-kpi-lbl">인건비</div>
          <div class="att-kpi-val">${totalWage.toLocaleString('ko-KR')}원</div>
          ${splitHtml}
        </div>`;
    } else {
      kpiEl.style.display='none';
    }
  }

  // 주간 간트 — 본인 모드에서 중복 정보(달력+일별과 겹침)라 사장님 요청으로 항상 숨김.
  // 살리려면: weeklyEl.style.display='block' + loadMyAttGantt() 호출 복원.
  const weeklyEl = document.getElementById('attWeeklySection');
  if(weeklyEl) weeklyEl.style.display='none';

  // 선택일: 다른 달이면 리셋, 비었으면 오늘(이번달+데이터) > 가장 최근 근무일
  if(attAllSelectedDate && !attAllSelectedDate.startsWith(monthStr)) attAllSelectedDate = null;
  if(!attAllSelectedDate){
    const todayStr = new Date().toISOString().slice(0,10);
    if(todayStr.startsWith(monthStr) && attAllDayMap[todayStr]) attAllSelectedDate = todayStr;
    else {
      const dates = Object.keys(attAllDayMap).sort();
      if(dates.length) attAllSelectedDate = dates[dates.length-1];
    }
  }
  renderAttCalendar(monthStr, attAllDayMap, attAllSelectedDate, isSingleView);
  renderAttDayDetail(attAllSelectedDate, attAllSelectedDate ? (attAllDayMap[attAllSelectedDate]||[]) : null, isSingleView);
}
function loadAttAll(){ loadAttList(); }

// ─── 새 기능: 근태 전체조회 E안 — 월 캘린더 ───
function renderAttCalendar(monthStr, dayMap, selectedDate, isSingleView){
  const target = document.getElementById('attCalendar');
  if(!target) return;
  const empF = document.getElementById('attEmpFilter')?.value || (currentEmp && !isManager ? currentEmp.id : '');
  const [y,m] = monthStr.split('-').map(Number);
  const lastDay  = new Date(y,m,0).getDate();
  const startDow = new Date(y,m-1,1).getDay(); // 0=일
  const todayStr = new Date().toISOString().slice(0,10);
  const dows = ['일','월','화','수','목','금','토'];
  let html = '<div class="att-cal">';
  dows.forEach((d,i)=>{
    const cls = i===0?'sun':(i===6?'sat':'');
    html += `<div class="att-cal-head ${cls}">${d}</div>`;
  });
  for(let i=0;i<startDow;i++) html += `<div class="att-cal-cell empty"></div>`;
  for(let d=1; d<=lastDay; d++){
    const dateStr = `${monthStr}-${String(d).padStart(2,'0')}`;
    const dow = (startDow+d-1)%7;
    const logs = dayMap[dateStr]||[];
    const totalMin = logs.reduce((a,r)=>a+(r.total_work_min||0),0);
    const cls = [];
    if(dow===0) cls.push('sun');
    if(dow===6) cls.push('sat');
    if(dateStr===todayStr) cls.push('today');
    if(dateStr===selectedDate) cls.push('active');
    let dotsHtml = '<div class="att-cal-dots"></div>';
    // 1인 모드: 색점 숨기고 시간을 크게 / 다인 모드: 실제 색점 + 계획 점(연한)
    if(isSingleView){
      dotsHtml = '<div class="att-cal-dots"></div>';
    } else {
      const schedRows = (window._attSchedDayMap && window._attSchedDayMap[dateStr]) || [];
      const actualEmpIds = new Set(logs.map(r=>r.employee_id));
      const planOnlyEmpIds = schedRows.filter(s=>s.employee_id && !s.is_off && !actualEmpIds.has(s.employee_id)).map(s=>s.employee_id);
      const dotItems = [];
      // 실제 (진한 색 점)
      const sortedLogs = [...logs].sort((a,b)=>(b.total_work_min||0)-(a.total_work_min||0));
      sortedLogs.slice(0,3).forEach(r=>{
        dotItems.push(`<span class="att-cal-dot" style="background:${empColor(r.employee_id)}"></span>`);
      });
      // 계획만 (연한 색 점 — 윤곽선만)
      planOnlyEmpIds.slice(0, Math.max(0, 3-dotItems.length)).forEach(eid=>{
        dotItems.push(`<span class="att-cal-dot" style="background:transparent;border:1.5px dashed ${empColor(eid)};"></span>`);
      });
      const totalDistinct = sortedLogs.length + planOnlyEmpIds.length;
      const more = totalDistinct - dotItems.length;
      let dots = dotItems.join('');
      if(more>0) dots += `<span class="att-cal-more">+${more}</span>`;
      if(dots) dotsHtml = `<div class="att-cal-dots">${dots}</div>`;
    }
    // 빈 날도 일별 상세로 이동 — '+' 별도 표시 없이 통일 (사장님 의견 2026-05-12)
    const isEmpty = !logs.length;
    const sumHtml = totalMin>0
      ? `<div class="att-cal-sum" style="${isSingleView?'font-size:13px;':''}">${fmtHourDecimal(totalMin)}</div>`
      : `<div class="att-cal-sum">&nbsp;</div>`;
    html += `<div class="att-cal-cell ${cls.join(' ')}" data-action="pickAttDay|${dateStr}">
      <div class="att-cal-day">${d}</div>
      ${dotsHtml}
      ${sumHtml}
    </div>`;
  }
  html += '</div>';
  target.innerHTML = html;
}

// ─── 새 기능: 근태 일별 간트 눈금 시간축 (2026-05-28 사장님: 선이 숫자 정중앙, 짝수 실선/홀수 점선) ───
// 시간축 숫자 — 짝수만, 선과 같은 위치(가운데 정렬). 끝점(GANTT_END)은 숫자 생략.
function attAxisTicks(){
  let out='';
  for(let h=GANTT_START; h<GANTT_END; h+=2){
    const label = h>=24 ? h-24 : h;
    const left = (h-GANTT_START)/GANTT_SPAN*100;
    out += `<span class="att-tk${h===24?' mid':''}" style="left:${left.toFixed(2)}%">${label}</span>`;
  }
  return out;
}
// 구분선 — 매 시간 시각 정위치. 짝수 실선 / 홀수 점선 / 자정 빨강.
function attGridLines(){
  let out='';
  for(let h=GANTT_START; h<=GANTT_END; h++){
    const cls = h===24 ? 'mid' : (h%2===0 ? 'major' : 'minor');
    const left = (h-GANTT_START)/GANTT_SPAN*100;
    out += `<span class="att-gl ${cls}" style="left:${left.toFixed(2)}%"></span>`;
  }
  return out;
}

// ─── 새 기능: 근태 전체조회 E안 — 일별 간트 상세 ───
function renderAttDayDetail(date, logs, isSingleView){
  const target = document.getElementById('attDayDetail');
  if(!target) return;
  if(!date){
    target.innerHTML = '<div class="att-day-empty">위 캘린더에서 날짜를 선택하세요</div>';
    return;
  }
  const dow = ['일','월','화','수','목','금','토'][new Date(date+'T00:00:00').getDay()];
  const empF = document.getElementById('attEmpFilter')?.value || (currentEmp && !isManager ? currentEmp.id : '');
  // 계획만 있고 실제 없는 경우는 아래 통합 렌더 로직에서 처리하도록 logs 비어도 계획 있으면 계속 진행
  const planRowsCheck = (window._attSchedDayMap && window._attSchedDayMap[date]) || [];
  const hasPlanOnly = !((logs||[]).length) && planRowsCheck.some(p=>p.employee_id && !p.is_off);
  if((!logs || !logs.length) && !hasPlanOnly){
    // 2026-05-25 헤더 갈아엎기 (사장님 호소: 한 줄 안 들어가고 엉망)
    //  · 1행: 날짜(좌) · "기록 없음"(우)
    //  · 2행: [주 일정] [+ 실제 입력] 칩 (한 줄 wrap)
    const chipBtns = `
      <span class="att-day-add-btn" data-action="openWeeklyPlanSheet|${date}">📅 주 일정</span>
      ${isManager ? `<span class="att-day-add-btn" data-action="openAttManualSheet|${date}${empF?'|'+empF:''}">＋ 실제 입력</span>` : ''}
    `;
    const note = isManager
      ? ''
      : `<div style="margin-top:10px;text-align:center;font-size:11px;color:var(--gray-400);">출퇴근 누락 시 관리자에게 등록을 요청하세요</div>`;
    target.innerHTML = `<div class="gantt-day-label">
      <div class="row-top">
        <span class="ttl">📅 ${date.slice(5)} (${dow})</span>
        <span style="font-size:10px;color:var(--gray-400);">기록 없음</span>
      </div>
      <div class="row-chips">${chipBtns}</div>
    </div>${note}`;
    return;
  }
  const safeLogs = logs || [];
  const totalMin  = safeLogs.reduce((a,r)=>a+(r.total_work_min||0),0);
  const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false}) : '-';
  const allData = window._attListData || [];
  // 2026-05-25 헤더 갈아엎기 (사장님 호소: 한 줄 안 들어가고 엉망)
  //  · 1행: 날짜(좌) · 41.4h · 496,600원 (우, nowrap)
  //  · 2행: [주 일정] [+ 실제 입력] 칩 그룹
  const chipBtns = `
    <span class="att-day-add-btn" data-action="openWeeklyPlanSheet|${date}">📅 주 일정</span>
    ${isManager ? `<span class="att-day-add-btn" data-action="openAttManualSheet|${date}">＋ 실제 입력</span>` : ''}
  `;

  let html = `<div class="gantt-day-label">
    <div class="row-top">
      <span class="ttl">📅 ${date.slice(5)} (${dow})</span>
      <span class="sum"><span class="h">${fmtHourDecimal(totalMin)}</span></span>
    </div>
    <div class="row-chips">${chipBtns}</div>
  </div>`;
  html += `<div class="att-axis"><div class="att-row-label" style="visibility:hidden;">x</div><div class="att-axis-ticks">${attAxisTicks()}</div></div>`;

  // ─── 새 기능: 계획(work_schedules) + 실제(attendance_logs) 통합 렌더 ───
  // 케이스: 계획O 실제O = 점선+보라 겹침 / 계획X 실제O = 보라만 / 계획O 실제X = 점선+빗금(결근)
  const planRows = (window._attSchedDayMap && window._attSchedDayMap[date]) || [];
  // (직원ID) → 계획 (1직원당 하루 1개 가정, 옛 upsert onConflict와 동일)
  const planByEmp = {};
  planRows.forEach(p=>{ if(p.employee_id) planByEmp[p.employee_id]=p; });
  // 실제는 직원별 여러 행 가능 → 직원ID 기반 매칭 사용 후 매칭된 계획 제거
  const usedPlanEmpIds = new Set();

  const sorted = [...safeLogs].sort((a,b)=>{
    const ta = a.app_in?new Date(a.app_in).getTime():9e15;
    const tb = b.app_in?new Date(b.app_in).getTime():9e15;
    return ta-tb;
  });
  sorted.forEach(r=>{
    const idx   = allData.indexOf(r);
    const color = empColor(r.employee_id);
    const inT   = r.app_in  ? new Date(r.app_in)  : null;
    const outT  = r.app_out ? new Date(r.app_out) : null;

    // 계획 막대 (있으면)
    let planBar = '';
    const plan = planByEmp[r.employee_id];
    if(plan && !plan.is_off){
      const psH = parseHour(plan.wish_start || plan.start_time);
      let peH   = parseHour(plan.wish_end   || plan.end_time);
      if(psH!=null && peH!=null){
        if(peH<psH) peH += 24;
        if(peH>psH){
          const pLeft  = Math.max(0,(psH-GANTT_START)/GANTT_SPAN*100);
          const pWidth = Math.min(100-pLeft,(peH-psH)/GANTT_SPAN*100);
          const psLbl  = String(Math.floor(psH)).padStart(2,'0')+':'+(psH%1?'30':'00');
          const pe24   = peH>=24?peH-24:peH;
          const peLbl  = String(Math.floor(pe24)).padStart(2,'0')+':'+(pe24%1?'30':'00')+(peH>=24?'(익)':'');
          planBar = `<div class="att-bar plan" style="left:${pLeft.toFixed(1)}%;width:${pWidth.toFixed(1)}%;"></div>`;
          usedPlanEmpIds.add(r.employee_id);
        }
      }
    }

    // 실제 막대 (텍스트 없음)
    let bar = '';
    if(inT){
      const sH = inT.getHours()+inT.getMinutes()/60;
      let eH = outT ? (outT.getHours()+outT.getMinutes()/60) : (sH+0.3);
      if(eH<sH) eH += 24; // 자정 넘는 근무
      if(eH>sH){
        const left  = Math.max(0,(sH-GANTT_START)/GANTT_SPAN*100);
        const width = Math.min(100-left,(eH-sH)/GANTT_SPAN*100);
        bar = `<div class="att-bar" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:${color};"></div>`;
      }
    }
    const timeLabel = inT ? `${fmtTime(r.app_in)}~${outT?fmtTime(r.app_out):'?'}` : '미출근';
    const clickable = isManager && idx>=0;
    html += `<div class="att-grow" ${clickable?`data-action="openEditAttByIdx|${idx}" style="cursor:pointer;"`:''}>
      <div class="att-row-label"><span class="dot" style="background:${color}"></span>${(r.employees?.name||'?').slice(0,4)}</div>
      <div class="att-track">${attGridLines()}${planBar}${bar}</div>
    </div>
    <div class="att-row-meta">
      <span class="time">${timeLabel}</span>
      <span class="hours">${fmtHourDecimal(r.total_work_min||0)}</span>
    </div>`;
  });

  // 계획만 있고 실제 없는 직원 (결근) = 빗금 전용 행
  const todayStr = new Date().toISOString().slice(0,10);
  const isPast = date < todayStr;
  planRows.forEach(p=>{
    if(!p.employee_id) return;
    if(usedPlanEmpIds.has(p.employee_id)) return;
    if(p.is_off) return; // 휴무는 행 자체 안 그림
    const empName = p.employees?.name || '?';
    const color = empColor(p.employee_id);
    const psH = parseHour(p.wish_start || p.start_time);
    let peH   = parseHour(p.wish_end   || p.end_time);
    let planBar = '', absentBar = '';
    if(psH!=null && peH!=null){
      if(peH<psH) peH += 24;
      if(peH>psH){
        const pLeft  = Math.max(0,(psH-GANTT_START)/GANTT_SPAN*100);
        const pWidth = Math.min(100-pLeft,(peH-psH)/GANTT_SPAN*100);
        const psLbl  = String(Math.floor(psH)).padStart(2,'0')+':'+(psH%1?'30':'00');
        const pe24   = peH>=24?peH-24:peH;
        const peLbl  = String(Math.floor(pe24)).padStart(2,'0')+':'+(pe24%1?'30':'00')+(peH>=24?'(익)':'');
        planBar = `<div class="att-bar plan" style="left:${pLeft.toFixed(1)}%;width:${pWidth.toFixed(1)}%;"></div>`;
        // 결근: 과거 날짜인 경우만 빗금
        if(isPast){
          absentBar = `<div class="att-bar absent" style="left:${pLeft.toFixed(1)}%;width:${pWidth.toFixed(1)}%;"></div>`;
        }
      }
    }
    const planClick = isManager ? `data-action="openSchedSheet|${date}|${p.id}" style="cursor:pointer;"` : '';
    html += `<div class="att-grow" ${planClick}>
      <div class="att-row-label"><span class="dot" style="background:${color}"></span>${empName.slice(0,4)}</div>
      <div class="att-track">${attGridLines()}${planBar}${absentBar}</div>
    </div>
    <div class="att-row-meta">
      <span class="time">${isPast?'결근':'예정'}</span>
      <span class="hours" style="color:${isPast?'var(--danger)':'var(--gray-500)'};">${isPast?'미출근':''}</span>
    </div>`;
  });

  target.innerHTML = html;
}

// ─── 새 기능: 캘린더 셀 탭 → 선택일 갱신 ───
function pickAttDay(date){
  attAllSelectedDate = date;
  const sel = document.getElementById('attEmpFilter');
  const empF = (sel?.value) || (currentEmp && !isManager ? currentEmp.id : '');
  const isSingleView = !!empF;
  renderAttCalendar(attAllMonth, attAllDayMap, attAllSelectedDate, isSingleView);
  renderAttDayDetail(date, attAllDayMap[date]||[], isSingleView);
  document.getElementById('attDayDetail')?.scrollIntoView({behavior:'smooth',block:'start'});
}

// ─── 새 기능: 근태 기록 편집 ───
function openEditAttSheet(record){
  if(!isManager) return toast('관리자만 수정할 수 있습니다.','warn');
  const empName=record.employees?.name||'직원';
  document.getElementById('editAttInfo').innerText=`${empName} · ${record.work_date}`;
  document.getElementById('editAttId').value=record.id;
  document.getElementById('editAttDate').value=record.work_date;
  document.getElementById('editAttEmpId').value=record.employee_id;
  // 일시 파싱 (datetime-local 포맷: YYYY-MM-DDTHH:MM, 자정 넘는 근무 지원)
  const toDTStr=ts=>{if(!ts)return'';const d=new Date(ts);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;};
  document.getElementById('editAttIn').value=toDTStr(record.app_in);
  document.getElementById('editAttOut').value=toDTStr(record.app_out);
  document.getElementById('editAttRest').value=record.rest_min||0;
  openSheet('editAttSheet');
}
async function saveEditAttendance(){
  const attId=document.getElementById('editAttId').value;
  const date=document.getElementById('editAttDate').value;
  const empId=document.getElementById('editAttEmpId').value;
  const inStr=document.getElementById('editAttIn').value;
  const outStr=document.getElementById('editAttOut').value;
  const restMin=parseInt(document.getElementById('editAttRest').value)||0;
  if(!inStr) return toast('출근 일시를 입력하세요.','warn');
  const appIn=new Date(inStr);
  const appOut=outStr?new Date(outStr):null;
  if(appOut&&appOut<=appIn) return toast('퇴근 일시가 출근보다 빠릅니다. 확인해주세요.','error');
  const w=await calcWageData(empId,appIn,appOut,date,restMin);
  setLoad(true,'수정 중...');
  const payload={app_in:appIn.toISOString(),app_out:appOut?.toISOString()||null,rest_min:w.restMin,total_work_min:w.totalMin,weekend_flag:w.isWeekend,calculated_wage:w.wage};
  const{error}=await sb.from('attendance_logs').update(payload).eq('id',attId).eq('store_id',currentStore.id);
  setLoad(false);
  if(error) return errToast('수정', error);
  toast('근태 기록 수정됐어요','success');
  closeAllSheets();loadAttList();
}
async function deleteAttendance(){
  const attId=document.getElementById('editAttId').value;
  if(!confirm('이 근태 기록을 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.')) return;
  setLoad(true,'삭제 중...');
  const{error}=await sb.from('attendance_logs').delete().eq('id',attId).eq('store_id',currentStore.id);
  setLoad(false);
  if(error) return errToast('삭제', error);
  toast('기록 삭제됐어요','success');
  closeAllSheets();loadAttList();
}

// ─── 내 기록: 주간 간트차트 뷰 ───
let myAttWeekStart='';
function moveMyAttWeek(dir){
  const d=new Date(myAttWeekStart);d.setDate(d.getDate()+dir*7);
  myAttWeekStart=ymdLocal(d);
  loadMyAttGantt();
}
async function loadMyAttGantt(){
  if(!currentStore||!currentEmp) return;
  if(!myAttWeekStart) myAttWeekStart=getWeekStart(ymdLocal(new Date()));
  const days=getWeekDays(myAttWeekStart);
  const todayStr=ymdLocal(new Date());
  document.getElementById('myAttWeekLabel').innerText=`${days[0].label} ~ ${days[6].label}`;

  // 이번 주 내 근태 데이터 조회
  const{data}=await sb.from('attendance_logs').select('*')
    .eq('store_id',currentStore.id)
    .eq('employee_id',currentEmp.id)
    .gte('work_date',days[0].date)
    .lte('work_date',days[6].date)
    .order('work_date');

  // 이번 주 근무계획도 조회 (비교용)
  const{data:schedData}=await sb.from('work_schedules').select('*')
    .eq('store_id',currentStore.id)
    .eq('employee_id',currentEmp.id)
    .gte('work_date',days[0].date)
    .lte('work_date',days[6].date);
  const schedMap={};(schedData||[]).forEach(s=>schedMap[s.work_date]=s);

  const logs=data||[];
  const logMap={};logs.forEach(r=>logMap[r.work_date]=r);

  // 오늘 근태 상태 카드 제거 — 간트차트에 근무시간 직접 표시
  document.getElementById('myAttTodayStatus').innerHTML='';

  // 근무시간 포맷 헬퍼
  const fmtWorkTime=(min)=>{if(min==null)return'';const h=Math.floor(min/60);const m=min%60;return h>0?(m>0?h+'h'+m+'m':h+'h'):(m+'m');};

  // 주간 간트차트 (근무계획 스타일)
  const bgCols=renderGanttBgCols();
  let ganttHtml='';
  days.forEach(day=>{
    const log=logMap[day.date];
    const sched=schedMap[day.date];
    const isToday=day.date===todayStr;
    const isPast=day.date<todayStr;

    // 근무시간 계산 (출근만 찍은 경우: 현재까지 경과시간)
    let workTimeLabel='';
    if(log?.app_in){
      if(log.total_work_min!=null){
        workTimeLabel=fmtWorkTime(log.total_work_min);
      } else if(!log.app_out&&isToday){
        // 출근만 찍고 퇴근 안 한 오늘 — 현재까지 경과
        const elapsed=Math.round((new Date()-new Date(log.app_in))/60000);
        workTimeLabel=fmtWorkTime(elapsed);
      }
    }

    ganttHtml+=`<div class="gantt-day-section">
      <div class="gantt-day-label" style="${isToday?'color:var(--blue);font-weight:800;':''}">
        <span>${day.label}${isToday?' (오늘)':''}</span>`;

    // 상태 + 근무시간 표시
    if(log?.app_in&&log?.app_out) ganttHtml+=`<span style="font-size:10px;color:var(--success);font-weight:700;">${workTimeLabel}</span>`;
    else if(log?.app_in&&!log?.app_out&&isToday) ganttHtml+=`<span style="font-size:10px;color:var(--blue);font-weight:700;">${workTimeLabel} 근무중</span>`;
    else if(log?.app_in&&!log?.app_out&&isPast) ganttHtml+=`<span style="font-size:10px;color:var(--warn);font-weight:700;">퇴근누락</span>`;
    else if(isPast&&sched&&!sched.is_off&&!log) ganttHtml+=`<span style="font-size:10px;color:var(--danger);font-weight:700;">누락</span>`;
    else if(sched?.is_off) ganttHtml+=`<span style="font-size:10px;color:var(--gray-400);">휴무</span>`;
    else if(!isPast&&!isToday) ganttHtml+=`<span style="font-size:10px;color:var(--gray-400);">${sched?'예정':''}</span>`;

    ganttHtml+=`</div>
      <div class="gantt-header"><div class="gantt-emp-col"></div>${renderGanttHourCells()}</div>`;

    // 바 그리기
    let bars='';
    // 계획 바 (연한색)
    if(sched&&!sched.is_off){
      const sH=parseHour(sched.wish_start||sched.start_time);
      let eH=parseHour(sched.wish_end||sched.end_time);
      if(sH!=null&&eH!=null){
        if(eH<sH) eH+=24; // 자정 넘는 일정
        if(eH>sH){
          const left=Math.max(0,(sH-GANTT_START)/GANTT_SPAN*100);
          const width=Math.min(100-left,(eH-sH)/GANTT_SPAN*100);
          bars+=`<div style="position:absolute;height:14px;top:2px;left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:var(--gray-300);opacity:0.5;border-radius:3px;"></div>`;
        }
      }
    }
    // 실제 근무 바 (진한색) — 출근만 찍어도 표시
    if(log?.app_in){
      const inTime=new Date(log.app_in);
      const sH=inTime.getHours()+inTime.getMinutes()/60;
      let eH;
      if(log.app_out){const outTime=new Date(log.app_out);eH=outTime.getHours()+outTime.getMinutes()/60;}
      else if(isToday){const now=new Date();eH=now.getHours()+now.getMinutes()/60;}
      else{eH=sH+0.5;} // 과거 퇴근누락 — 최소 바 표시
      if(eH<sH) eH += 24; // 자정 넘는 근무
      if(eH>sH){
        const left=Math.max(0,(sH-GANTT_START)/GANTT_SPAN*100);
        const width=Math.min(100-left,(eH-sH)/GANTT_SPAN*100);
        const sLabel=String(Math.floor(sH)).padStart(2,'0')+':'+(sH%1>=0.5?'30':'00');
        const eLabel=log.app_out?(String(Math.floor(eH)).padStart(2,'0')+':'+(eH%1>=0.5?'30':'00')):isToday?'지금':'?';
        const barColor=log.app_out?'var(--success)':isToday?'var(--blue)':'var(--warn)';
        bars+=`<div class="gantt-bar" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:${barColor};"><span style="font-size:8px;color:#fff;padding:0 2px;white-space:nowrap;">${sLabel}~${eLabel}</span></div>`;
      }
    }

    if(!log&&!sched) ganttHtml+=`<div style="padding:4px 0;text-align:center;font-size:10px;color:var(--gray-300);">—</div>`;
    else ganttHtml+=`<div class="gantt-row"><div class="gantt-name" style="font-size:10px;">내 근무</div><div class="gantt-bar-area">${bgCols}${bars}</div></div>`;

    ganttHtml+=`</div>`;
  });
  document.getElementById('myAttGantt').innerHTML=ganttHtml;

  // 누락 경고
  const missing=days.filter(day=>{
    const isPast=day.date<todayStr;
    const sched=schedMap[day.date];
    const log=logMap[day.date];
    return isPast&&sched&&!sched.is_off&&!log;
  });
  if(missing.length>0){
    document.getElementById('myAttWarning').innerHTML=`<div style="background:var(--danger-light);border-radius:12px;padding:12px 14px;margin-top:10px;">
      <div style="font-size:12px;font-weight:700;color:var(--danger);margin-bottom:4px;">이번 주 누락 ${missing.length}일</div>
      <div style="font-size:11px;color:var(--danger);">${missing.map(d=>d.label).join(', ')} — 근무계획은 있지만 출퇴근 기록이 없습니다</div>
    </div>`;
  } else {
    document.getElementById('myAttWarning').innerHTML='';
  }
}

// ══════════════════════════════════════════
// 캡스 업로드
// ══════════════════════════════════════════
async function handleCapsUpload(input){
  if(!guardStore()||!input.files[0]) return;
  setLoad(true,'캡스 파일 분석 중...');
  try{
    const buf=await input.files[0].arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    stagingData=rows.map(r=>{
      const rawName=String(r['이름']||'').trim();
      const rawCapsId=String(r['사용자ID']||'').trim();
      const rawDate=r['발생일자'],rawTime=r['발생시각'],rawMode=String(r['모드']||'').trim(),rawAuth=String(r['인증결과']||'').trim();
      let parsedDate=null;if(rawDate){const d=new Date(rawDate);if(!isNaN(d))parsedDate=ymdLocal(d);}
      let parsedTime=null;if(rawTime){const t=String(rawTime).trim();if(/^\d{1,2}:\d{2}/.test(t))parsedTime=t.slice(0,5)+':00';}
      const isValidAuth=rawAuth.includes('O');
      const matchedEmp=employees.find(e=>e.caps_id===rawCapsId);
      let matchStatus='미매칭';if(!rawCapsId)matchStatus='ID없음';else if(!isValidAuth)matchStatus='인증실패';else if(matchedEmp)matchStatus='매칭완료';
      return{store_id:currentStore.id,raw_name:rawName||null,raw_caps_id:rawCapsId||null,raw_date:parsedDate,raw_time:parsedTime,raw_mode:rawMode,raw_auth_result:rawAuth,is_valid_auth:isValidAuth,matched_employee_id:matchedEmp?.id||null,match_status:matchStatus,dedup_status:'정상',processed:false};
    });
    // 중복 처리
    const grp={};
    stagingData.forEach((row,idx)=>{if(!row.raw_date||!row.matched_employee_id||!row.is_valid_auth)return;const k=`${row.matched_employee_id}_${row.raw_date}_${row.raw_mode}`;if(!grp[k])grp[k]=[];grp[k].push({idx,time:row.raw_time});});
    Object.values(grp).forEach(g=>{if(g.length<=1)return;g.sort((a,b)=>a.time<b.time?-1:1);const keepIdx=stagingData[g[0].idx].raw_mode==='출근'?g[0].idx:g[g.length-1].idx;g.forEach(x=>stagingData[x.idx].dedup_status=x.idx===keepIdx?'중복-채택':'중복-무시');});
    // 누락 판정
    const dm={};
    stagingData.forEach(row=>{if(row.match_status!=='매칭완료'||row.dedup_status==='중복-무시')return;const k=`${row.matched_employee_id}_${row.raw_date}`;if(!dm[k])dm[k]={in:false,out:false};if(row.raw_mode==='출근')dm[k].in=true;if(row.raw_mode==='퇴근')dm[k].out=true;});
    stagingData.forEach(row=>{if(row.match_status!=='매칭완료'||row.dedup_status==='중복-무시')return;const k=`${row.matched_employee_id}_${row.raw_date}`;const p=dm[k];if(p&&!p.out&&row.raw_mode==='출근')row.dedup_status='퇴근누락';if(p&&!p.in&&row.raw_mode==='퇴근')row.dedup_status='출근누락';});
    renderStaging();
  }catch(e){toast('파일 분석 실패: '+e.message,'error');}finally{setLoad(false);}
}
function renderStaging(){
  const c=document.getElementById('stagingList');if(!stagingData.length){c.innerHTML='<div class="empty-state"><p>데이터가 없습니다</p></div>';return;}
  const sc={'매칭완료':'badge-green','미매칭':'badge-red','인증실패':'badge-gray','ID없음':'badge-gray','중복-채택':'badge-blue','출근누락':'badge-red','퇴근누락':'badge-warn'};
  const visible=stagingData.filter(r=>r.dedup_status!=='중복-무시'&&r.match_status!=='인증실패');
  const problems=visible.filter(r=>['미매칭','ID없음'].includes(r.match_status)||['출근누락','퇴근누락'].includes(r.dedup_status));
  const ok=visible.filter(r=>r.match_status==='매칭완료'&&r.dedup_status==='정상');
  let html=`<div style="background:var(--blue-light);border-radius:12px;padding:13px;margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:var(--blue);">파싱 결과</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px;text-align:center;"><div><div style="font-size:19px;font-weight:800;">${stagingData.length}</div><div style="font-size:11px;color:var(--gray-600);">전체</div></div><div><div style="font-size:19px;font-weight:800;color:var(--success);">${ok.length}</div><div style="font-size:11px;color:var(--gray-600);">정상</div></div><div><div style="font-size:19px;font-weight:800;color:var(--danger);">${problems.length}</div><div style="font-size:11px;color:var(--gray-600);">검수필요</div></div></div></div>`;
  if(problems.length){html+=`<div style="font-size:12px;font-weight:700;color:var(--danger);margin-bottom:7px;">⚠️ 검수 필요 (${problems.length}건)</div>`;
    problems.forEach(row=>{const ri=stagingData.indexOf(row);const sk=row.dedup_status!=='정상'?row.dedup_status:row.match_status;
      html+=`<div class="staging-row"><div class="sr-top2"><span class="sr-name2">${row.raw_name||row.raw_caps_id||'이름없음'} · ${row.raw_mode}</span><span class="badge ${sc[sk]||'badge-gray'}">${sk}</span></div><div class="sr-info2">${row.raw_date||'-'} ${row.raw_time||''}</div><div class="sr-actions2">${row.match_status==='미매칭'?`<button class="btn btn-primary btn-sm" data-action="openMatchSheet|${ri}">직원 연결</button>`:''} ${row.dedup_status==='퇴근누락'?`<button class="btn btn-secondary btn-sm" data-action="manualSetOut|${ri}">퇴근 입력</button>`:''}<button class="btn btn-danger btn-sm" data-action="removeStaging|${ri}">무시</button></div></div>`;
    });
  }
  if(ok.length){html+=`<div style="font-size:12px;font-weight:700;color:var(--success);margin:10px 0 7px;">✅ 정상 (${ok.length}건)</div>`;ok.forEach(row=>{const emp=employees.find(e=>e.id===row.matched_employee_id);html+=`<div class="staging-row"><div class="sr-top2"><span class="sr-name2">${emp?.name||row.raw_name} · ${row.raw_mode}</span><span class="badge badge-green">정상</span></div><div class="sr-info2">${row.raw_date} ${row.raw_time}</div></div>`;});}
  if(stagingData.some(r=>r.match_status==='매칭완료'&&r.dedup_status!=='중복-무시')) html+=`<button class="btn btn-primary btn-full" style="margin-top:10px;" data-action="commitCaps">📋 근태에 반영하기</button>`;
  c.innerHTML=html;
}
function removeStaging(idx){stagingData[idx].dedup_status='중복-무시';renderStaging();}
function openMatchSheet(idx){
  currentMatchStagingIdx=idx;const row=stagingData[idx];
  document.getElementById('matchInfo').innerText=`캡스ID: ${row.raw_caps_id||'-'} / 이름: ${row.raw_name||'-'} / ${row.raw_date} ${row.raw_mode}`;
  document.getElementById('matchEmpList').innerHTML=employees.filter(e=>e.is_active).map(e=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--gray-100);border-radius:13px;margin-bottom:9px;cursor:pointer;" data-action="confirmMatch|${e.id}"><div><div style="font-size:14px;font-weight:700;">${e.name}</div><div style="font-size:12px;color:var(--gray-600);">${e.role||''} · 캡스ID: ${e.caps_id||'미설정'}</div></div></div>`).join('');
  openSheet('matchSheet');
}
function confirmMatch(empId){const row=stagingData[currentMatchStagingIdx];row.matched_employee_id=empId;row.match_status='수동연결';row.dedup_status='정상';closeAllSheets();renderStaging();}
function manualSetOut(idx){const time=prompt('퇴근 시간 입력 (HH:MM)');if(!time||!/^\d{2}:\d{2}$/.test(time))return;stagingData[idx].caps_out_manual=time;stagingData[idx].dedup_status='정상';renderStaging();}
async function commitCaps(){
  if(!guardStore()||!confirm('검수된 데이터를 근태 기록에 반영합니다.'))return;
  setLoad(true,'근태 반영 중...');
  try{
    const grp={};
    stagingData.filter(r=>r.match_status!=='인증실패'&&r.match_status!=='ID없음'&&r.dedup_status!=='중복-무시').forEach(r=>{if(!r.matched_employee_id)return;const k=`${r.matched_employee_id}_${r.raw_date}`;if(!grp[k])grp[k]={empId:r.matched_employee_id,date:r.raw_date,inTime:null,outTime:null,outSource:null};if(r.raw_mode==='출근')grp[k].inTime=r.raw_time;if(r.raw_mode==='퇴근')grp[k].outTime=r.raw_time;if(r.caps_out_manual){grp[k].outTime=r.caps_out_manual;grp[k].outSource='manual';}});
    for(const[,g] of Object.entries(grp)){
      const capsIn=g.inTime?new Date(g.date+'T'+g.inTime):null;
      let capsOut=g.outTime?new Date(g.date+'T'+g.outTime):null;
      let capsOutSource=g.outSource||(capsOut?'caps':null);
      if(!capsOut){const{data:al}=await sb.from('attendance_logs').select('app_out').eq('store_id',currentStore.id).eq('employee_id',g.empId).eq('work_date',g.date).maybeSingle();if(al?.app_out){capsOut=new Date(al.app_out);capsOutSource='app';}}
      const w=await calcWageData(g.empId, capsIn, capsOut, g.date, null);
      const{data:ex}=await sb.from('attendance_logs').select('id,app_in,app_out').eq('store_id',currentStore.id).eq('employee_id',g.empId).eq('work_date',g.date).maybeSingle();
      const payload={store_id:currentStore.id,employee_id:g.empId,work_date:g.date,caps_in:capsIn?.toISOString()||null,caps_out:capsOut?.toISOString()||null,caps_out_source:capsOutSource,rest_min:w.restMin,total_work_min:w.totalMin,night_min:w.nightMin,weekend_flag:w.isWeekend,calculated_wage:w.wage,caps_match_status:capsIn&&capsOut?'정상매칭':(capsIn?'퇴근누락':'출근누락')};
      if(ex){payload.app_in=ex.app_in;payload.app_out=ex.app_out;if(capsIn&&ex.app_in){const df=Math.round((capsIn-new Date(ex.app_in))/60000);payload.time_diff_min=df;payload.caps_match_status=Math.abs(df)>10?'시간오차':'정상매칭';}await sb.from('attendance_logs').update(payload).eq('id',ex.id).eq('store_id',currentStore.id);}
      else await sb.from('attendance_logs').insert(payload);
    }
    await sb.from('caps_upload_staging').insert(stagingData.map(r=>({...r})));
    setLoad(false);toast('근태 반영됐어요','success');stagingData=[];renderStaging();
  }catch(e){setLoad(false);toast('반영 실패: '+e.message,'error');}
}

// ─── 새 기능: 직원 본인 급여 탭 (2026-06-09) — attendance_logs.calculated_wage 기반 ───
let _empPayLogs = [];
let _empPayView = 'summary';
let _empPayCalMonth = null;
function _empWon(n){ return (Math.round(n||0)).toLocaleString('ko-KR')+'원'; }
function _empMonthKey(d){ return (d||'').slice(0,7); }

async function loadEmpPay(){
  if(!currentStore || !currentEmp) return;
  const chip=document.getElementById('empPayStoreChip');
  if(chip){ chip.innerText=(currentStore.name||'매장')+' ›'; chip.style.display='inline-flex'; }
  const yearStart = new Date().getFullYear()+'-01-01';
  const { data } = await sb.from('attendance_logs')
    .select('work_date,total_work_min,calculated_wage,app_in,app_out')
    .eq('store_id',currentStore.id).eq('employee_id',currentEmp.id)
    .gte('work_date', yearStart).order('work_date');
  _empPayLogs = data||[];
  if(!_empPayCalMonth){ const t=new Date(); _empPayCalMonth=new Date(t.getFullYear(),t.getMonth(),1); }
  empPaySwitch(_empPayView);
  renderEmpPay();
}

function renderEmpPay(){
  const nowMonth = new Date().toISOString().slice(0,7);
  const byMonth = {}; let cum = 0;
  _empPayLogs.forEach(r=>{
    const mk=_empMonthKey(r.work_date);
    if(!byMonth[mk]) byMonth[mk]={wage:0,min:0,days:0};
    byMonth[mk].wage += r.calculated_wage||0;
    byMonth[mk].min += r.total_work_min||0;
    if((r.total_work_min||0)>0||(r.calculated_wage||0)>0) byMonth[mk].days++;
    cum += r.calculated_wage||0;
  });
  const cur = byMonth[nowMonth]||{wage:0,min:0,days:0};
  const m = parseInt(nowMonth.split('-')[1]);
  document.getElementById('empPayHeroLabel').innerText = `${m}월 (지금까지)`;
  document.getElementById('empPayHeroAmt').innerText = _empWon(cur.wage);
  document.getElementById('empPayHeroSub').innerText = `${fmtHourDecimal(cur.min)} 일했어요 · ${cur.days}일 근무`;
  const pastMonths = Object.keys(byMonth).filter(k=>k<nowMonth).sort().reverse();
  const histEl = document.getElementById('empPayHistory');
  if(pastMonths.length===0){
    histEl.innerHTML = '<div style="text-align:center;color:var(--gray-400);font-size:13px;padding:24px 0;">아직 받은 급여 내역이 없어요.</div>';
  } else {
    histEl.innerHTML = pastMonths.map(k=>{
      const v=byMonth[k]; const mm=parseInt(k.split('-')[1]);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 2px;border-bottom:1px solid var(--gray-100);">
        <span style="font-size:14px;font-weight:800;">${mm}월</span>
        <span><b style="font-size:15px;">${_empWon(v.wage)}</b><span style="font-size:10px;background:var(--success);color:#fff;padding:2px 7px;border-radius:10px;font-weight:800;margin-left:7px;">받음</span></span>
      </div>`;
    }).join('');
  }
  document.getElementById('empPayCumAmt').innerText = _empWon(cum);
  renderEmpPayCalendar();
}

function renderEmpPayCalendar(){
  const d=_empPayCalMonth, y=d.getFullYear(), mo=d.getMonth();
  document.getElementById('empPayCalMonth').innerText = `${y}.${mo+1}`;
  const mk=`${y}-${String(mo+1).padStart(2,'0')}`;
  const dayMap={}; let monthTotal=0;
  _empPayLogs.forEach(r=>{
    if(_empMonthKey(r.work_date)===mk){ dayMap[r.work_date]={min:r.total_work_min||0,wage:r.calculated_wage||0}; monthTotal += r.calculated_wage||0; }
  });
  document.getElementById('empPayCalTotal').innerText = _empWon(monthTotal);
  const startDow=new Date(y,mo,1).getDay(), daysIn=new Date(y,mo+1,0).getDate();
  const todayStr=new Date().toISOString().slice(0,10);
  let html='<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>';
  ['일','월','화','수','목','금','토'].forEach((w,i)=>{ const c=i===0?'var(--danger)':i===6?'#1E88E5':'var(--gray-400)'; html+=`<th style="font-size:11px;color:${c};font-weight:700;padding-bottom:6px;">${w}</th>`; });
  html+='</tr><tr>';
  for(let i=0;i<startDow;i++) html+='<td></td>';
  for(let day=1;day<=daysIn;day++){
    const dow=(startDow+day-1)%7;
    const ds=`${mk}-${String(day).padStart(2,'0')}`;
    const rec=dayMap[ds]; const isToday=ds===todayStr;
    const dcol=dow===0?'var(--danger)':dow===6?'#1E88E5':'var(--text)';
    const dStyle = isToday?`background:var(--blue);color:#fff;border-radius:50%;padding:1px 5px;`:`color:${dcol};`;
    html+=`<td style="vertical-align:top;height:54px;border-top:1px solid var(--gray-100);padding:4px 2px 0;cursor:${rec?'pointer':'default'};" ${rec?`data-action="empPayDay|${ds}"`:''}>`;
    html+=`<span style="font-size:12px;font-weight:800;${dStyle}display:inline-block;">${day}</span>`;
    if(rec){
      html+=`<div style="background:var(--blue-light);color:var(--blue);font-size:9px;font-weight:800;border-radius:4px;padding:1px;text-align:center;margin-top:2px;">${fmtHourDecimal(rec.min)}</div>`;
      html+=`<div style="font-size:9px;color:var(--gray-600);text-align:right;font-weight:700;">${(rec.wage||0).toLocaleString('ko-KR')}</div>`;
    }
    html+='</td>';
    if(dow===6 && day<daysIn) html+='</tr><tr>';
  }
  html+='</tr></table>';
  document.getElementById('empPayCalGrid').innerHTML=html;
}

function empPaySwitch(view){
  _empPayView=view;
  const sV=document.getElementById('empPaySummaryView'), cV=document.getElementById('empPayCalView');
  const sT=document.getElementById('empPayTabSummary'), cT=document.getElementById('empPayTabCal');
  if(!sV||!cV) return;
  if(view==='calendar'){ sV.style.display='none'; cV.style.display=''; if(cT){cT.style.color='var(--text)';cT.style.background='#fff';} if(sT){sT.style.color='var(--gray-400)';sT.style.background='';} }
  else { sV.style.display=''; cV.style.display='none'; if(sT){sT.style.color='var(--text)';sT.style.background='#fff';} if(cT){cT.style.color='var(--gray-400)';cT.style.background='';} }
}

function empPayCalNav(delta){
  _empPayCalMonth = new Date(_empPayCalMonth.getFullYear(), _empPayCalMonth.getMonth()+parseInt(delta), 1);
  renderEmpPayCalendar();
}

function empPayDay(ds){
  const r=_empPayLogs.find(x=>x.work_date===ds);
  if(!r) return;
  const inT=r.app_in?new Date(r.app_in).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false}):'-';
  const outT=r.app_out?new Date(r.app_out).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false}):'-';
  toast(`${ds} · 출근 ${inT} ~ 퇴근 ${outT} · ${fmtHourDecimal(r.total_work_min||0)} · ${_empWon(r.calculated_wage||0)}`,'success',5000);
}

