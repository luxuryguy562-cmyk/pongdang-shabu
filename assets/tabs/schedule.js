// ══════════════════════════════════════════
// 근무계획
// ══════════════════════════════════════════
// 옛 schedTab — sub-tab 제거됨. 데드코드 (호출처 없음). 안전망으로 잔류.
function schedTab(tab,el){}

// ─── 근무 계획 단일 일정 편집용 시트 (2026-05-21 옛 월 달력·일별 상세 함수 폐기. 통합 화면에서 카드 클릭 시 진입) ─────────
let schedDayMap = {}; // legacy — 통합 화면은 window._attSchedDayMap 사용. 잔재 변수 (다른 곳 참조 안 함)
function openSchedSheet(date, schedId){
  if(!guardStore()) return;
  document.getElementById('vSchedDate').innerText=date||'-';
  // 2026-05-21: 편집 모드 분기 + 삭제 버튼 노출 (PR #185 시 누락 fix)
  const delBtn=document.getElementById('schedDeleteBtn');
  if(schedId){
    // 2026-05-21: schedDayMap 폐기, 통합 화면의 window._attSchedDayMap 사용
    const dayPlans = (window._attSchedDayMap && window._attSchedDayMap[date]) || [];
    let s = dayPlans.find(x=>String(x.id)===String(schedId));
    if(!s && window._schedGridRows) s = window._schedGridRows.find(x=>String(x.id)===String(schedId)); // 주간 그리드에서 진입
    if(s){
      document.getElementById('addSchedTitle').innerText='희망근무 편집';
      document.getElementById('vSchedEmp').innerText=s.employees?.name||((typeof employees!=='undefined'&&employees)?(employees.find(e=>e.id===s.employee_id)?.name||'-'):'-');
      schedEmpId=s.employee_id;
      document.getElementById('vSchedStart').innerText=s.wish_start?s.wish_start.slice(0,5):'-';
      document.getElementById('vSchedEnd').innerText=s.wish_end?s.wish_end.slice(0,5):'-';
      document.getElementById('vSchedMemo').value=s.memo||'';
    }
    if(delBtn){ delBtn.style.display='block'; delBtn.dataset.schedId=schedId; }
    // 직원 신청('희망')이면 사장에게 승인/거절 버튼 노출 (2026-06-15)
    const apvBtns=document.getElementById('schedApproveBtns');
    if(apvBtns) apvBtns.style.display=(s && s.status==='희망' && isManager)?'block':'none';
    window._editingSchedId=schedId;
  } else {
    document.getElementById('addSchedTitle').innerText='희망근무 등록';
    if(!isManager && currentEmp){
      document.getElementById('vSchedEmp').innerText=currentEmp.name;
      schedEmpId=currentEmp.id;
    } else {
      document.getElementById('vSchedEmp').innerText='선택';
      schedEmpId=null;
    }
    document.getElementById('vSchedStart').innerText='-';
    document.getElementById('vSchedEnd').innerText='-';
    document.getElementById('vSchedMemo').value='';
    if(delBtn){ delBtn.style.display='none'; delBtn.dataset.schedId=''; }
    const apvBtns2=document.getElementById('schedApproveBtns');
    if(apvBtns2) apvBtns2.style.display='none';
    window._editingSchedId=null;
  }
  openSheet('addSchedSheet');
}
// 2026-05-21: 시트 안 삭제 버튼 핸들러 (data-action 호환)
function deleteScheduleFromSheet(){
  const id=document.getElementById('schedDeleteBtn')?.dataset.schedId;
  if(id) deleteSchedule(id);
}
async function deleteSchedule(schedId){
  if(!guardStore()||!schedId) return;
  if(!confirm('이 일정을 삭제할까요?')) return;
  setLoad(true,'삭제 중...');
  const {error}=await sb.from('work_schedules').delete().eq('id',schedId).eq('store_id',currentStore.id);
  setLoad(false);
  if(error) return errToast('삭제', error);
  toast('삭제됐어요','success');
  closeSheet('addSchedSheet');
  await loadAttList();
}
async function saveSchedule(){
  if(!guardStore()) return;
  const empId=schedEmpId||(currentEmp?.id);
  if(!empId) return toast('직원을 선택하세요.','warn');
  const date=document.getElementById('vSchedDate').innerText;
  if(!date||date==='선택'||date==='') return toast('날짜를 선택하세요.','warn');
  const start=document.getElementById('vSchedStart').innerText;
  const end=document.getElementById('vSchedEnd').innerText;
  const memo=document.getElementById('vSchedMemo').value;
  setLoad(true,'저장 중...');
  const payload={
    store_id:currentStore.id,employee_id:empId,work_date:date,
    wish_start:(start&&start!=='-'&&start!=='선택')?start+':00':null,
    wish_end:(end&&end!=='-'&&end!=='선택')?end+':00':null,
    memo:memo||null,status:(isManager?'확정':'희망') // 사장 입력=확정, 직원 신청=희망 (2026-06-15)
  };
  const{error}=await sb.from('work_schedules').upsert(payload,{onConflict:'store_id,employee_id,work_date'});
  setLoad(false);
  if(error) return errToast('저장', error);
  document.getElementById('vSchedMemo').value='';
  closeSheet('addSchedSheet');
  // 통합 화면 갱신 — 저장한 날짜로 선택일 이동 후 근태 통합 캘린더 새로고침
  attAllMonth=date.slice(0,7);
  attAllSelectedDate=date;
  await loadAttList();
  if(typeof broadcastStoreChange==='function') broadcastStoreChange('schedule'); // 실시간: 신청→사장 화면·배지 갱신
  toast(isManager?'근무계획이 등록됐습니다!':'희망근무를 신청했어요! 사장님 승인을 기다려요','success');
}
// ─── 새 기능: 주단위 일괄 입력 (사장님 요청 2026-05-21) ───
// 한 직원의 월~일 7일치 work_schedules를 한 시트에서 일괄 등록.
// 시각은 30분 단위 (정시 or :30) 스크롤 picker.
let wpEmpId=null, wpWeekStart='';
function openWeeklyPlanSheet(date){
  if(!guardStore()) return;
  // 기본 = 클릭한 날짜의 월요일
  wpWeekStart = getWeekStart(date || ymdLocal(new Date()));
  // staff면 본인 자동 / manager면 선택
  if(!isManager && currentEmp){
    wpEmpId = currentEmp.id;
    const el=document.getElementById('wpEmp');
    if(el){el.innerText=currentEmp.name; el.classList.remove('empty');}
  } else {
    wpEmpId = null;
    const el=document.getElementById('wpEmp');
    if(el){el.innerText='선택'; el.classList.add('empty');}
  }
  renderWpDayCards();
  openSheet('weeklyPlanSheet');
}
function moveWeeklyPlan(dir){
  const d=new Date(wpWeekStart);
  d.setDate(d.getDate()+parseInt(dir)*7);
  wpWeekStart = ymdLocal(d);
  renderWpDayCards();
}
async function renderWpDayCards(){
  const days = getWeekDays(wpWeekStart);
  // 라벨: "5/19(월) ~ 5/25(일)"
  const labelEl = document.getElementById('wpWeekLabel');
  if(labelEl) labelEl.innerText = `${days[0].label} ~ ${days[6].label}`;
  // 기존 데이터 로드 (직원 선택돼 있으면)
  let existing = {};
  if(wpEmpId){
    const {data} = await sb.from('work_schedules')
      .select('work_date,wish_start,wish_end,is_off')
      .eq('store_id', currentStore.id)
      .eq('employee_id', wpEmpId)
      .gte('work_date', days[0].date)
      .lte('work_date', days[6].date);
    (data||[]).forEach(r=>{ existing[r.work_date] = r; });
  }
  const target = document.getElementById('wpDayCards');
  if(!target) return;
  let html = '';
  days.forEach((day, idx)=>{
    const ex = existing[day.date] || {};
    // 2026-05-21: 휴무 체크박스 제거 (사장님 호소 "공란 = 자동 휴무")
    // 옛 is_off=true row는 빈 칸으로 표시 → 다시 저장 시 자동 row delete (정리)
    const isOff = !!ex.is_off;
    const start = (!isOff && ex.wish_start) ? ex.wish_start.slice(0,5) : '';
    const end   = (!isOff && ex.wish_end)   ? ex.wish_end.slice(0,5)   : '';
    const dow = day.label.match(/\((.+)\)/)?.[1] || '';
    const isWeekend = dow==='토' || dow==='일';
    html += `<div class="wp-day-card" data-day-idx="${idx}" data-date="${day.date}" style="border:1px solid var(--gray-200);border-radius:10px;padding:10px 12px;background:#fff;">
      <div style="font-size:13px;font-weight:700;color:${isWeekend?(dow==='일'?'var(--danger)':'var(--blue)'):'var(--text)'};margin-bottom:6px;">${day.label}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div class="input-row" style="margin:0;padding:8px 10px;" data-action="openTimePicker|wp:${idx}:start">
          <label style="font-size:11px;">출근</label>
          <span id="wpDay${idx}Start" class="val ${start?'':'empty'}">${start||'-'}</span>
        </div>
        <div class="input-row" style="margin:0;padding:8px 10px;" data-action="openTimePicker|wp:${idx}:end">
          <label style="font-size:11px;">퇴근</label>
          <span id="wpDay${idx}End" class="val ${end?'':'empty'}">${end||'-'}</span>
        </div>
      </div>
    </div>`;
  });
  target.innerHTML = html;
}
async function saveWeeklyPlan(){
  if(!guardStore()) return;
  if(!wpEmpId) return toast('직원을 선택하세요.','warn');
  const days = getWeekDays(wpWeekStart);
  const rows = [];
  let validCount = 0;
  // 2026-05-21: 휴무 체크박스 제거. 빈 칸 = 자동 휴무 (= row delete)
  for(let idx=0; idx<7; idx++){
    const card = document.querySelector(`.wp-day-card[data-day-idx="${idx}"]`);
    if(!card) continue;
    const startTxt = document.getElementById(`wpDay${idx}Start`)?.innerText || '';
    const endTxt   = document.getElementById(`wpDay${idx}End`)?.innerText   || '';
    const date = card.getAttribute('data-date');
    // 빈 칸 = 자동 휴무 → 기존 row 있으면 삭제, 없으면 패스
    if((!startTxt || startTxt==='-') && (!endTxt || endTxt==='-')){
      rows.push({ _delete:true, work_date: date });
      continue;
    }
    // 한쪽만 입력 = 사용자 실수 방지
    if(!startTxt || startTxt==='-' || !endTxt || endTxt==='-'){
      return toast(`${days[idx].label} 출근·퇴근 시각을 모두 입력하거나 둘 다 비워주세요.`,'warn');
    }
    rows.push({
      store_id: currentStore.id, employee_id: wpEmpId, work_date: date,
      wish_start: startTxt+':00', wish_end: endTxt+':00', is_off: false, status: (isManager?'확정':'희망')
    });
    validCount++;
  }
  if(!validCount && !rows.some(r=>r._delete)){
    return toast('등록할 일정이 없습니다.','warn');
  }
  setLoad(true,'저장 중...');
  // 삭제 대상
  const deleteDates = rows.filter(r=>r._delete).map(r=>r.work_date);
  const upsertRows  = rows.filter(r=>!r._delete);
  let lastError = null;
  if(deleteDates.length){
    const {error} = await sb.from('work_schedules').delete()
      .eq('store_id', currentStore.id)
      .eq('employee_id', wpEmpId)
      .in('work_date', deleteDates);
    if(error) lastError = error;
  }
  if(upsertRows.length){
    const {error} = await sb.from('work_schedules').upsert(upsertRows, {onConflict:'store_id,employee_id,work_date'});
    if(error) lastError = error;
  }
  setLoad(false);
  if(lastError) return errToast('근무계획 저장', lastError);
  closeSheet('weeklyPlanSheet');
  // 휴무(빈 칸)는 7 - validCount. 메시지에 명시
  const offCount = 7 - validCount;
  toast(isManager?`${validCount}일 출근 / ${offCount}일 휴무 저장됐어요`:`${validCount}일 희망근무 신청! 사장님 승인을 기다려요`,'success');
  // 통합 화면 새로고침
  attAllMonth = days[0].date.slice(0,7);
  await loadAttList();
}

// 주간 간트 유틸
function getWeekStart(dateStr){
  const d=new Date(dateStr);
  const day=d.getDay();// 0=일
  const diff=day===0?-6:1-day;// 월요일 기준
  d.setDate(d.getDate()+diff);
  return ymdLocal(d);
}
function getWeekDays(startStr){
  const days=[];const d=new Date(startStr);
  const dayNames=['일','월','화','수','목','금','토'];
  for(let i=0;i<7;i++){
    const s=new Date(d);s.setDate(d.getDate()+i);
    days.push({date:ymdLocal(s),label:`${s.getMonth()+1}/${s.getDate()}(${dayNames[s.getDay()]})`});
  }
  return days;
}
let ganttWeekStart='',ganttSelectedDay='';
const parseHour=t=>{if(!t)return null;const p=String(t).split(':');return p.length>=2?parseInt(p[0])+parseInt(p[1])/60:null;};

function moveGanttWeek(dir){
  const d=new Date(ganttWeekStart);d.setDate(d.getDate()+dir*7);
  ganttWeekStart=ymdLocal(d);
  renderGanttWeek();
}
// 영업일 회전축: 매장 영업일 시작시각(06:00)부터 24시간 (06~30시 = 익일 06:00)
// 마감조처럼 자정 넘는 근무도 한 줄에 연속 표시. 24시 위치(축 75%)는 자정선.
const GANTT_START=6,GANTT_END=30,GANTT_SPAN=GANTT_END-GANTT_START;
const ganttHours=Array.from({length:GANTT_SPAN},(_,i)=>i+GANTT_START);

// ─── 새 기능: 시간그리드 v2 안 ③ 헬퍼 (3곳 동기화) ───
// 짝수 시간만 숫자, 홀수는 점(·). 자정 빨강 강조. 24 이후는 -24 (25→01).
function renderGanttHourCells(){
  return ganttHours.map(h=>{
    const isMid=h===24;
    const isEven=h%2===0;
    const display=isMid?'0':(isEven?(h>=24?String(h-24):String(h)):'<span class="dot"></span>');
    const cls=isMid?'mid':(isEven?'major':'');
    return `<div class="gantt-hour ${cls}">${display}</div>`;
  }).join('');
}
// 격자 — 짝수=메이저(실선), 홀수=마이너(점선), 자정선은 ::after로 별도
function renderGanttBgCols(){
  return ganttHours.map(h=>{
    if(h===GANTT_START) return `<div class="gantt-bg-col"></div>`; // 첫 칸 테두리 없음
    const cls=(h%2===0)?'major':'minor';
    return `<div class="gantt-bg-col ${cls}"></div>`;
  }).join('');
}

async function renderGanttWeek(){
  if(!currentStore){document.getElementById('ganttChart').innerHTML='<div class="empty-state"><p>매장을 먼저 선택하세요</p></div>';return;}
  if(!ganttWeekStart) ganttWeekStart=getWeekStart(ymdLocal(new Date()));
  const days=getWeekDays(ganttWeekStart);
  const endDate=days[6].date;
  const todayStr=ymdLocal(new Date());
  document.getElementById('ganttWeekLabel').innerText=`${days[0].label} ~ ${days[6].label}`;
  // 요일 탭 (전체 + 7일)
  if(!ganttSelectedDay) ganttSelectedDay='all';
  let tabsHtml=`<button class="sub-tab${ganttSelectedDay==='all'?' active':''}" style="flex:0 0 auto;padding:6px 10px;font-size:10px;" data-action="setGanttAllDays">전체</button>`;
  days.forEach(d=>{
    const isToday=d.date===todayStr;
    const isSel=d.date===ganttSelectedDay;
    tabsHtml+=`<button class="sub-tab${isSel?' active':''}" style="flex:0 0 auto;padding:6px 8px;font-size:10px;${isToday&&!isSel?'border-bottom:2px solid var(--blue);':''}" data-action="setGanttDay|${d.date}">${d.label}</button>`;
  });
  document.getElementById('ganttDayTabs').innerHTML=tabsHtml;
  // 주간 데이터 로드
  const{data}=await sb.from('work_schedules').select('*,employees(name)').eq('store_id',currentStore.id).neq('status','거절').gte('work_date',days[0].date).lte('work_date',endDate).not('employee_id','is',null).order('wish_start');
  window._ganttWeekData=data||[];
  window._ganttWeekDays=days;
  renderGanttFiltered();
}
function renderGanttFiltered(){
  const days=window._ganttWeekDays||[];
  const allData=window._ganttWeekData||[];
  const todayStr=ymdLocal(new Date());
  // 탭 active
  document.querySelectorAll('#ganttDayTabs button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('#ganttDayTabs button').forEach(b=>{
    const oc=b.getAttribute('onclick')||'';
    if(ganttSelectedDay==='all'&&oc.includes("'all'")) b.classList.add('active');
    else if(oc.includes("'"+ganttSelectedDay+"'")) b.classList.add('active');
  });
  const showDays=ganttSelectedDay==='all'?days:days.filter(d=>d.date===ganttSelectedDay);
  const bgCols=renderGanttBgCols();
  let html='';
  showDays.forEach(day=>{
    const dayData=allData.filter(r=>r.work_date===day.date);
    const isToday=day.date===todayStr;
    html+=`<div class="gantt-day-section">
      <div class="gantt-day-label" style="${isToday?'color:var(--blue);':''}">
        <span>${day.label}${isToday?' (오늘)':''}</span>
        <span class="day-count">${dayData.length}명</span>
      </div>
      <div class="gantt-header"><div class="gantt-emp-col"></div>${renderGanttHourCells()}</div>`;
    if(!dayData.length){
      html+=`<div style="padding:8px;text-align:center;font-size:11px;color:var(--gray-400);">등록된 근무 없음</div>`;
    } else {
      dayData.forEach(row=>{
        const name=row.employees?.name||'-';
        const sH=parseHour(row.wish_start);
        let eH=parseHour(row.wish_end);
        let bar='';
        if(sH!=null&&eH!=null){
          if(eH<sH) eH+=24; // 자정 넘는 일정 (예: 18~02)
          if(eH>sH){
            const left=Math.max(0,(sH-GANTT_START)/GANTT_SPAN*100);
            const width=Math.min(100-left,(eH-sH)/GANTT_SPAN*100);
            const sLabel=String(Math.floor(sH)).padStart(2,'0')+':'+(sH%1?'30':'00');
            const eH24=eH>=24?eH-24:eH;
            const eLabel=String(Math.floor(eH24)).padStart(2,'0')+':'+(eH24%1?'30':'00')+(eH>=24?' (익)':'');
            const confirmed=row.status==='확정';
            bar=`<div class="gantt-bar${confirmed?' confirmed':''}" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;"><span style="font-size:8px;color:#fff;padding:0 2px;white-space:nowrap;">${sLabel}~${eLabel}</span></div>`;
          }
        }
        html+=`<div class="gantt-row"><div class="gantt-name">${name}</div><div class="gantt-bar-area">${bgCols}${bar}</div></div>`;
      });
    }
    html+=`</div>`;
  });
  document.getElementById('ganttChart').innerHTML=html;
}

