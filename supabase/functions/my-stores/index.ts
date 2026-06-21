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
      .select("store_id, total_sales").in("store_id", storeIds).gte("sale_date", start).lte("sale_date", end);
    const revUps: Record<string, number> = {};
    (dsUps || []).forEach((r: any) => { revUps[r.store_id] = (revUps[r.store_id] || 0) + (Number(r.total_sales) || 0); });

    // 매장별: settle 데이터 있으면 settle, 없으면 ups — 중복 합산 방지(한 매장은 보통 한 소스)
    const rev: Record<string, number> = {};
    storeIds.forEach((sid) => { rev[sid] = revSettle[sid] || revUps[sid] || 0; });

    const result = (stores || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.store_code,
      revenue: rev[s.id] || 0,
    })).sort((a, b) => b.revenue - a.revenue);

    return json({ ok: true, ym, stores: result, total_revenue: result.reduce((a, r) => a + r.revenue, 0) });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
