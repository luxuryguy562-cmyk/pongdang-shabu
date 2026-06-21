// "내 매장들" 집계 — 한 사람(person_id)이 접근 가능한 매장들의 매출을 모아 반환한다.
//
// 보안 설계 (헌법·blueprint 2026-06-18):
//   - 매장 격리 RLS는 그대로 둔다(JWT app_metadata.store_id = 단일 매장만). 절대 안 건드림.
//   - 본사/다매장은 RLS로는 여러 매장을 못 보므로, 이 함수가 service_role로 우회하되
//     "이 사람이 그 매장 사장(owner/franchise_admin)인지"를 함수가 직접 검증한 매장만 집계한다.
//   - 즉 권한 검증은 코드가 책임지고, 검증 통과한 매장 매출만 돌려준다.
//
// 접근 가능 매장 = (같은 person_id 이고 auth_level owner/franchise_admin 인 employees 의 store)
//                ∪ (이 사용자가 owner_user_id 인 franchise 의 active store)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// sales_daily 한 행의 매출 합 (amounts jsonb 우선, 없으면 레거시 컬럼 폴백 — 클라이언트 salesRowTotal과 동일)
function rowTotal(r: any): number {
  if (r?.amounts && typeof r.amounts === "object" && Object.keys(r.amounts).length) {
    return Object.values(r.amounts).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  }
  return (Number(r?.card) || 0) + (Number(r?.cash) || 0) + (Number(r?.cash_receipt) || 0)
       + (Number(r?.qr) || 0) + (Number(r?.etc) || 0);
}

// ────────────────────────────────────────────────────────────────────
// 순익(net_profit) 계산 헬퍼 — 대시보드 loadDashboard 공식을 그대로 옮김
//   (헌법 7-7 회계 단일 진실. dashboard.js 650~697 / calcExpenseByCategories /
//    attendance.js sumHourlyWage·calcMonthlyProratedWages·calcMonthlyHolidayPay /
//    sidemenu.js prorateByDay / common.js fcEffectiveMonthly 와 동일 로직)
//   dashMode='auto'(가마감) 기준. 진마감(통장 로열티)는 추후.
// ────────────────────────────────────────────────────────────────────

// sidemenu.js prorateByDay 그대로: 일별 (매출×요율 반올림)을 진행일까지 합산
function prorateByDay(dailyMap: Record<string, number>, rate: number, passedDay: number): number {
  if (!rate) return 0;
  return Object.entries(dailyMap || {}).reduce(
    (a, [k, v]) => (parseInt(k, 10) <= passedDay ? a + Math.round((v || 0) * rate) : a),
    0,
  );
}

// common.js fcEffectiveMonthly 그대로: 실제 납부액(is_confirmed) 우선, 없으면 예상(estimated_monthly)
function fcEffectiveMonthly(fc: any, actualMap: Record<string, number>): number {
  const a = actualMap && actualMap[fc.id];
  return (a != null) ? a : (Number(fc.estimated_monthly) || 0);
}

// 날짜 문자열(YYYY-MM-DD) → 요일(0=월 … 6=일). UTC 고정으로 서버 TZ 무관하게 클라와 동일.
//   클라(attendance.js)는 (date.getDay()+6)%7 로 0=월요일. 여기선 UTC 기준으로 같은 값을 만든다.
function dowMon0(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return (d.getUTCDay() + 6) % 7; // 0=월요일
}
// 날짜 문자열에 일수 더하기 (UTC) → YYYY-MM-DD
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 한 매장의 순익 계산. 필요한 모든 원천 데이터를 인자로 받아 메모리 처리(추가 DB 호출 0).
function calcStoreNetProfit(ctx: {
  ym: string;
  y: number;
  m: number;
  lastDay: number;
  passedDays: number;     // 현재월=오늘, 과거월=lastDay
  totalRevenue: number;   // 이미 집계된 매출
  dailySalesMap: Record<string, number>;     // 일(2자리 문자열) → 매출
  dailyCardSalesMap: Record<string, number>; // 일 → 카드매출
  settings: any;          // store_settings 1행
  employees: any[];       // 이 매장 employees
  expCategories: any[];   // 이 매장 expense_categories
  vendorOrders: any[];    // 당월 vendor_orders (vendors 조인)
  receipts: any[];        // 당월 receipts (note='정상', is_deposit=false)
  attLogs: any[];         // 당월 attendance_logs
  schedules: any[];       // 당월 work_schedules
  fixedCosts: any[];      // fixed_costs (활성)
  fcActualMap: Record<string, number>; // fixed_cost_amounts 실제 납부액 맵
  ecaMap: Record<string, number>;      // expense_category_amounts (category_id→amount)
  deductSumByCatId: Record<string, number>; // settlements 차감 합 (category_id→amount)
}): number {
  const {
    ym, lastDay, passedDays, totalRevenue, dailySalesMap, dailyCardSalesMap,
    settings, employees, expCategories, vendorOrders, receipts, attLogs, schedules,
    fixedCosts, fcActualMap, ecaMap, deductSumByCatId,
  } = ctx;

  const settingsObj = settings || {};
  const emps = employees || [];
  const cats = expCategories || [];

  // ── 인건비 1) 시급제 합 (sumHourlyWage) — 월급제 제외, calculated_wage 합 ──
  const monthlyIds = new Set(emps.filter((e) => e.wage_type === "monthly").map((e) => e.id));
  const hourlySum = (attLogs || [])
    .filter((r) => !monthlyIds.has(r.employee_id))
    .reduce((a, r) => a + (Number(r.calculated_wage) || 0), 0);

  // ── 인건비 2) 월급 일할 (calcMonthlyProratedWages) — monthly_wage*10000/lastDay × 재직일수 ──
  let monthlyDistSum = 0;
  emps.filter((e) => e.is_active && e.wage_type === "monthly" && Number(e.monthly_wage) > 0).forEach((emp) => {
    const dailyWage = Math.round((Number(emp.monthly_wage) * 10000) / lastDay);
    const hire = emp.hire_date || null;
    const resign = emp.resign_date || null;
    let daysCovered = 0;
    for (let day = 1; day <= passedDays; day++) {
      const dateStr = `${ym}-${String(day).padStart(2, "0")}`;
      if (hire && dateStr < hire) continue;
      if (resign && dateStr > resign) continue;
      daysCovered++;
    }
    monthlyDistSum += dailyWage * daysCovered;
  });

  // ── 인건비 3) 주휴수당 (calcMonthlyHolidayPay) — 시급제, 주15h+ 개근(설정 시) ──
  let holidayPaySum = 0;
  if (settingsObj.weekly_holiday_pay_enabled) {
    const attByEmpDate: Record<string, Record<string, any>> = {};
    (attLogs || []).forEach((r) => {
      (attByEmpDate[r.employee_id] ||= {})[r.work_date] = r;
    });
    const schedByEmpDate: Record<string, Record<string, any>> = {};
    (schedules || []).forEach((s) => {
      (schedByEmpDate[s.employee_id] ||= {})[s.work_date] = s;
    });
    const empIds = [...new Set((attLogs || []).map((r) => r.employee_id))];
    empIds.forEach((empId) => {
      if (monthlyIds.has(empId)) return; // 월급제 제외
      const emp = emps.find((e) => e.id === empId);
      if (!emp) return;
      const baseWage = Number(emp.base_wage) || 10030;
      const empAtt = attByEmpDate[empId] || {};
      const empSched = schedByEmpDate[empId] || {};
      const processedWeeks = new Set<string>();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${ym}-${String(d).padStart(2, "0")}`;
        const dow = dowMon0(dateStr); // 0=월
        const weekStart = addDaysStr(dateStr, -dow);
        if (processedWeeks.has(weekStart)) continue;
        processedWeeks.add(weekStart);
        const weekDays: string[] = [];
        for (let i = 0; i < 7; i++) weekDays.push(addDaysStr(weekStart, i));
        let weekMin = 0;
        weekDays.forEach((wd) => { if (empAtt[wd]) weekMin += Number(empAtt[wd].total_work_min) || 0; });
        if (weekMin < 15 * 60) continue; // 주 15시간 미만
        if (settingsObj.weekly_holiday_pay_deduct_absent) {
          const schedDays = weekDays.filter((wd) => {
            const s = empSched[wd];
            return s && !s.is_off && s.status === "확정";
          });
          if (schedDays.length > 0 && schedDays.some((wd) => !empAtt[wd])) continue; // 결근 → 없음
        }
        const hours = Math.min(weekMin / 60 / 5, 8);
        holidayPaySum += Math.round(hours * baseWage);
      }
    });
  }
  // (인건비 시급+월급 부모합은 expData의 attendance 부모에서 자동 합산됨. 주휴는 아래서 별도 합산)

  // ── 식자재 + 변동지출 (calcExpenseByCategories 가마감) ──
  //   부모 카테고리별 amount 합 = expData.reduce. 대시보드 totalCostRaw 과 동일하게 만든 뒤
  //   고정비 카테고리를 일할로 교체한다.
  const allCats = cats;
  const childByParent: Record<string, any[]> = {};
  allCats.forEach((c) => { if (c.parent_id) (childByParent[c.parent_id] ||= []).push(c); });

  // 모든 소스 매칭 합산 (sumAllSourcesByCatId). mydata는 서버 미반영(추후) — receipts/vendor/eca/deduct만.
  const sumAllSourcesByCatId = (catId: string, skipAuto = false): number => {
    if (!catId) return 0;
    let s = 0;
    if (!skipAuto) {
      s += (receipts || []).filter((r) => r.category_id === catId).reduce((a, r) => a + (Number(r.total_price) || 0), 0);
      s += (vendorOrders || []).filter((o) => o.vendors?.category_id === catId).reduce((a, o) => a + (Number(o.amount) || 0), 0);
    }
    s += ecaMap[catId] || 0;
    s += deductSumByCatId[catId] || 0;
    return s;
  };

  // 자식 amount (childAmounts) — 인건비 자식(시급/월급) 자동 + 모든 소스
  const childAmount = (child: any): number => {
    let cAmt = 0;
    if (child.data_source === "attendance_hourly") {
      cAmt = hourlySum;
    } else if (child.data_source === "attendance_monthly") {
      emps.filter((e) => e.is_active && e.wage_type === "monthly" && Number(e.monthly_wage) > 0).forEach((emp) => {
        cAmt += Math.round((Number(emp.monthly_wage) * 10000) / lastDay) * passedDays;
      });
    }
    cAmt += sumAllSourcesByCatId(child.id);
    return cAmt;
  };

  // 집계 대상 = 활성 expense 부모 카테고리
  const fcActive = (fixedCosts || []).filter((r) => r.is_active !== false);
  const catsForAggregation = allCats.filter((c) => {
    const t = c.category_type || "expense";
    if (t !== "expense") return false;
    if (c.is_active === false) return false; // 서버: mydata 미반영이라 "이번달 거래" 판정 생략, 비활성 제외
    if (c.parent_id) return false;
    return true;
  });

  // expData (대시보드 expResults 대응)
  const expData = catsForAggregation.map((cat) => {
    let amount = 0;
    const ds = cat.data_source;
    if (ds === "vendor_orders") {
      amount = (vendorOrders || []).filter((o) => o.vendors?.category_id === cat.id).reduce((a, o) => a + (Number(o.amount) || 0), 0);
      // 이 카테고리로 분류된 영수증도 합산 — 대시보드 v17(도넛/순익)이 영수증을 소스 구분 없이 전부 계상하므로 동일하게.
      //   (calcExpenseByCategories 표는 거래처 소스 영수증을 누락하지만, 사장님이 보는 순익은 v17 기준)
      amount += (receipts || []).filter((r) => r.category_id === cat.id).reduce((a, r) => a + (Number(r.total_price) || 0), 0);
      amount += sumAllSourcesByCatId(cat.id, true);
    } else if (ds === "receipts") {
      const childIds = (childByParent[cat.id] || []).map((c) => c.id);
      const targetIds = [cat.id, ...childIds];
      amount = (receipts || []).filter((r) => targetIds.includes(r.category_id)).reduce((a, r) => a + (Number(r.total_price) || 0), 0);
      amount += sumAllSourcesByCatId(cat.id, true);
    } else if (ds === "composite") {
      const targetIds = [cat.id, ...(childByParent[cat.id] || []).map((c) => c.id)];
      const voSum = (vendorOrders || []).filter((o) => targetIds.includes(o.vendors?.category_id)).reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const rcpSum = (receipts || []).filter((r) => targetIds.includes(r.category_id)).reduce((a, r) => a + (Number(r.total_price) || 0), 0);
      amount = voSum + rcpSum;
      amount += sumAllSourcesByCatId(cat.id, true);
      (childByParent[cat.id] || []).forEach((ch) => { amount += sumAllSourcesByCatId(ch.id, true); });
    } else if (ds === "attendance") {
      amount = sumAllSourcesByCatId(cat.id);
      (childByParent[cat.id] || []).filter((c) => c.is_active !== false).forEach((child) => { amount += childAmount(child); });
    } else if (ds === "fixed_costs") {
      amount = fcActive.filter((r) => (r.category || "고정비") === cat.name).reduce((a, r) => a + fcEffectiveMonthly(r, fcActualMap), 0);
      amount += sumAllSourcesByCatId(cat.id);
    } else if (ds === "manual") {
      const fcMatchSum = fcActive.filter((r) => (r.category || "") === cat.name).reduce((a, r) => a + fcEffectiveMonthly(r, fcActualMap), 0);
      amount = fcMatchSum + sumAllSourcesByCatId(cat.id);
      (childByParent[cat.id] || []).filter((c) => c.is_active !== false).forEach((child) => { amount += childAmount(child); });
    } else {
      amount += sumAllSourcesByCatId(cat.id);
    }
    return { id: cat.id, name: cat.name, source: ds, amount };
  });

  // ── 고정비 일할 (dashboard.js 650~665) — 카테고리별 round(월합/lastDay)×passedDays ──
  const fcByCatMonthly: Record<string, number> = {};
  fcActive.forEach((r) => {
    const c = r.category || "고정비";
    fcByCatMonthly[c] = (fcByCatMonthly[c] || 0) + fcEffectiveMonthly(r, fcActualMap);
  });
  let fixedProrated = 0;
  Object.keys(fcByCatMonthly).forEach((c) => {
    fixedProrated += Math.round(fcByCatMonthly[c] / lastDay) * passedDays;
  });

  // 지출에서 고정비를 일할로 교체 (대시보드 totalCost)
  const totalCostRaw = expData.reduce((a, e) => a + e.amount, 0);
  const fixedCatAmt = expData.filter((e) => e.source === "fixed_costs").reduce((a, e) => a + e.amount, 0);
  const totalCost = totalCostRaw - fixedCatAmt + fixedProrated;

  // ── 주휴수당은 대시보드에서 expByGroup 인건비에 별도 합산(692~744) → 순익 비용에 포함됨 ──
  //   expData의 attendance 부모는 시급+월급만 잡으므로, 주휴수당을 비용에 더해 totalCost 보정.
  const totalCostWithHoliday = totalCost + holidayPaySum;

  // ── 로열티 / 카드수수료 (dashboard.js 688~693, 가마감) ──
  const royaltyRate = parseFloat(settingsObj.royalty_rate || 0) / 100;
  const cardFeeRate = parseFloat(settingsObj.card_fee_rate || 0) / 100;
  const royalty = prorateByDay(dailySalesMap, royaltyRate, passedDays);
  const cardFee = prorateByDay(dailyCardSalesMap, cardFeeRate, passedDays);

  // ── 핵심 수치 (dashboard.js 696~697) ──
  const totalCostFull = totalCostWithHoliday + royalty + cardFee;
  const netProfit = totalRevenue - totalCostFull;
  return Math.round(netProfit);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    // 1) 로그인 신분증(JWT)에서 사용자 확인
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "인증 정보가 없어요" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: udata, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !udata?.user) return json({ ok: false, error: "세션이 만료됐어요" }, 401);
    const user = udata.user;
    const empId = (user.user_metadata as any)?.employee_id;
    const jwtStoreId = (user.app_metadata as any)?.store_id;
    if (!empId) return json({ ok: false, error: "직원 정보를 찾을 수 없어요" }, 400);

    // 2) 이 직원의 person_id 확보
    const { data: me } = await admin.from("employees")
      .select("id, person_id, auth_level, store_id").eq("id", empId).maybeSingle();
    if (!me) return json({ ok: false, error: "직원을 찾을 수 없어요" }, 404);

    // 3) 접근 가능한 매장 모으기 (권한 검증)
    const storeIdSet = new Set<string>();

    // (a) 직영 다매장 — 같은 사람(person_id)이 사장인 매장들
    if (me.person_id) {
      const { data: mine } = await admin.from("employees")
        .select("store_id")
        .eq("person_id", me.person_id)
        .in("auth_level", ["owner", "franchise_admin"]);
      (mine || []).forEach((r: any) => r.store_id && storeIdSet.add(r.store_id));
    }

    // (b) 프랜차이즈 — 이 사용자가 본사 관리자인 franchise 의 가맹점들
    const { data: frs } = await admin.from("franchises").select("id").eq("owner_user_id", user.id);
    if (frs && frs.length) {
      const frIds = frs.map((f: any) => f.id);
      const { data: frStores } = await admin.from("stores")
        .select("id").in("franchise_id", frIds).eq("is_active", true);
      (frStores || []).forEach((s: any) => storeIdSet.add(s.id));
    }

    // 안전망: 최소한 현재 로그인한 매장은 본인 것이므로 포함
    if (jwtStoreId) storeIdSet.add(jwtStoreId);

    const storeIds = [...storeIdSet];
    if (!storeIds.length) return json({ ok: true, stores: [] });

    // 4) 대상 월 (없으면 이번달)
    let ym = "";
    try { ym = ((await req.json()) || {}).ym || ""; } catch (_e) { /* 본문 없음 */ }
    if (!/^\d{4}-\d{2}$/.test(ym)) ym = new Date().toISOString().slice(0, 7);
    const [y, m] = ym.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${ym}-01`;
    const end = `${ym}-${String(lastDay).padStart(2, "0")}`;

    // 5) 매장 정보 + 매출 집계
    const { data: stores } = await admin.from("stores")
      .select("id, name, store_code").in("id", storeIds);

    // settle 소스 (sales_daily — 단일 진실)
    const { data: sd } = await admin.from("sales_daily")
      .select("*").in("store_id", storeIds).gte("date", start).lte("date", end);
    const revSettle: Record<string, number> = {};
    (sd || []).forEach((r: any) => { revSettle[r.store_id] = (revSettle[r.store_id] || 0) + rowTotal(r); });

    // ups 소스 (daily_sales — 업솔루션 POS 연동 매장)
    const { data: dsUps } = await admin.from("daily_sales")
      .select("store_id, sale_date, total_sales, card_sales").in("store_id", storeIds).gte("sale_date", start).lte("sale_date", end);
    const revUps: Record<string, number> = {};
    (dsUps || []).forEach((r: any) => { revUps[r.store_id] = (revUps[r.store_id] || 0) + (Number(r.total_sales) || 0); });

    // 매장별: settle 데이터 있으면 settle, 없으면 ups — 중복 합산 방지(한 매장은 보통 한 소스)
    const rev: Record<string, number> = {};
    storeIds.forEach((sid) => { rev[sid] = revSettle[sid] || revUps[sid] || 0; });

    // ─────────────────────────────────────────────────────────────────
    // 매장별 일별 매출맵 + 일별 카드매출맵 (순익 prorate용)
    //   대시보드: settle 매장은 sales_daily, ups 매장은 daily_sales 기준.
    //   카드매출: settle는 결제수단(legacy_key='card') 동적칸 → 폴백 card 컬럼,
    //             ups는 daily_sales.card_sales.
    // ─────────────────────────────────────────────────────────────────
    const passedDays = (() => {
      const todayYm = new Date().toISOString().slice(0, 7);
      return todayYm === ym ? new Date().getUTCDate() : lastDay;
    })();

    // 결제수단 — legacy_key='card' 칸 식별용 (매장별)
    const { data: payMethods } = await admin.from("payment_methods")
      .select("id, store_id, legacy_key, is_active").in("store_id", storeIds);
    const cardMethodByStore: Record<string, any> = {};
    (payMethods || []).forEach((m: any) => {
      if (m.legacy_key === "card") cardMethodByStore[m.store_id] = m;
    });
    const getMethodAmount = (row: any, method: any): number => {
      if (!method) return 0;
      if (row.amounts && typeof row.amounts === "object" && row.amounts[method.id] != null) {
        return Number(row.amounts[method.id]) || 0;
      }
      // 레거시 폴백: legacy_key 컬럼 직접
      if (method.legacy_key && row[method.legacy_key] != null) return Number(row[method.legacy_key]) || 0;
      return 0;
    };

    const dailySalesMapByStore: Record<string, Record<string, number>> = {};
    const dailyCardMapByStore: Record<string, Record<string, number>> = {};
    storeIds.forEach((sid) => { dailySalesMapByStore[sid] = {}; dailyCardMapByStore[sid] = {}; });

    // settle 매장 (sales_daily)
    (sd || []).forEach((r: any) => {
      const sid = r.store_id;
      if (revSettle[sid] == null) return; // 이 매장은 ups 소스
      const day = (r.date || "").slice(8);
      if (!day) return;
      dailySalesMapByStore[sid][day] = rowTotal(r);
      const cm = cardMethodByStore[sid];
      dailyCardMapByStore[sid][day] = (cm ? (getMethodAmount(r, cm) || 0) : 0) || (Number(r.card) || 0);
    });
    // ups 매장 (daily_sales)
    (dsUps || []).forEach((r: any) => {
      const sid = r.store_id;
      if (revSettle[sid] != null) return; // settle 우선
      const day = (r.sale_date || "").slice(8);
      if (!day) return;
      dailySalesMapByStore[sid][day] = Number(r.total_sales) || 0;
      dailyCardMapByStore[sid][day] = Number(r.card_sales) || 0;
    });

    // ── 매장별 순익 원천 데이터 일괄 조회 (각 테이블 1쿼리, store_id IN) ──
    const [
      { data: ssAll }, { data: empAll }, { data: ecAll }, { data: voAll },
      { data: rcAll }, { data: attAll }, { data: schedAll }, { data: fcAll },
      { data: fcaAll }, { data: ecaAll }, { data: setlAll },
    ] = await Promise.all([
      admin.from("store_settings").select("*").in("store_id", storeIds),
      admin.from("employees").select("id,store_id,wage_type,monthly_wage,base_wage,hire_date,resign_date,is_active").in("store_id", storeIds),
      admin.from("expense_categories").select("id,store_id,name,parent_id,data_source,category_type,is_active").in("store_id", storeIds),
      admin.from("vendor_orders").select("store_id,amount,order_date,vendors(category_id)").in("store_id", storeIds).gte("order_date", start).lte("order_date", end),
      admin.from("receipts").select("store_id,total_price,category_id,receipt_date").in("store_id", storeIds).eq("note", "정상").eq("is_deposit", false).gte("receipt_date", start).lte("receipt_date", end),
      admin.from("attendance_logs").select("store_id,work_date,total_work_min,calculated_wage,employee_id").in("store_id", storeIds).gte("work_date", start).lte("work_date", end),
      admin.from("work_schedules").select("store_id,employee_id,work_date,is_off,status").in("store_id", storeIds).gte("work_date", start).lte("work_date", end),
      admin.from("fixed_costs").select("id,store_id,estimated_monthly,is_active,category").in("store_id", storeIds),
      admin.from("fixed_cost_amounts").select("store_id,fixed_cost_id,amount,is_confirmed,year_month").in("store_id", storeIds).eq("year_month", ym),
      admin.from("expense_category_amounts").select("store_id,category_id,amount,year_month").in("store_id", storeIds).eq("year_month", ym),
      admin.from("settlements").select("store_id,items_json,settle_date").in("store_id", storeIds).gte("settle_date", start).lte("settle_date", end),
    ]);

    // store_id 별로 묶기
    const byStore = <T extends { store_id: string }>(rows: T[] | null): Record<string, T[]> => {
      const map: Record<string, T[]> = {};
      (rows || []).forEach((r) => { (map[r.store_id] ||= []).push(r); });
      return map;
    };
    const ssByStore: Record<string, any> = {};
    (ssAll || []).forEach((r: any) => { ssByStore[r.store_id] = r; });
    const empByStore = byStore(empAll as any);
    const ecByStore = byStore(ecAll as any);
    const voByStore = byStore(voAll as any);
    const rcByStore = byStore(rcAll as any);
    const attByStore = byStore(attAll as any);
    const schedByStore = byStore(schedAll as any);
    const fcByStore = byStore(fcAll as any);

    // fixed_cost_amounts → 매장별 실제납부 맵 (is_confirmed)
    const fcActualByStore: Record<string, Record<string, number>> = {};
    (fcaAll || []).forEach((a: any) => {
      if (a.is_confirmed && a.amount != null) {
        (fcActualByStore[a.store_id] ||= {})[a.fixed_cost_id] = a.amount;
      }
    });
    // expense_category_amounts → 매장별 (category_id→amount)
    const ecaByStore: Record<string, Record<string, number>> = {};
    (ecaAll || []).forEach((a: any) => {
      (ecaByStore[a.store_id] ||= {})[a.category_id] = Number(a.amount) || 0;
    });
    // settlements 차감 → 매장별 (category_id→amount 합)
    const deductByStore: Record<string, Record<string, number>> = {};
    (setlAll || []).forEach((s: any) => {
      const deductions = s.items_json?.deductions || [];
      deductions.forEach((d: any) => {
        if (d.category_id && d.amount) {
          (deductByStore[s.store_id] ||= {});
          deductByStore[s.store_id][d.category_id] = (deductByStore[s.store_id][d.category_id] || 0) + Number(d.amount);
        }
      });
    });

    // 매장별 순익 계산
    const profitByStore: Record<string, number> = {};
    storeIds.forEach((sid) => {
      profitByStore[sid] = calcStoreNetProfit({
        ym, y, m, lastDay, passedDays,
        totalRevenue: rev[sid] || 0,
        dailySalesMap: dailySalesMapByStore[sid] || {},
        dailyCardSalesMap: dailyCardMapByStore[sid] || {},
        settings: ssByStore[sid] || {},
        employees: empByStore[sid] || [],
        expCategories: ecByStore[sid] || [],
        vendorOrders: voByStore[sid] || [],
        receipts: rcByStore[sid] || [],
        attLogs: attByStore[sid] || [],
        schedules: schedByStore[sid] || [],
        fixedCosts: fcByStore[sid] || [],
        fcActualMap: fcActualByStore[sid] || {},
        ecaMap: ecaByStore[sid] || {},
        deductSumByCatId: deductByStore[sid] || {},
      });
    });

    const result = (stores || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.store_code,
      revenue: rev[s.id] || 0,
      net_profit: profitByStore[s.id] || 0,
    })).sort((a, b) => b.revenue - a.revenue);

    return json({
      ok: true,
      ym,
      stores: result,
      total_revenue: result.reduce((a, r) => a + r.revenue, 0),
      total_profit: result.reduce((a, r) => a + r.net_profit, 0),
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
