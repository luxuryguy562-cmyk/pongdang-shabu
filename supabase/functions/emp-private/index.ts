// 매니저(사장)용 금고 통로 — 로그인 증표(세션 토큰)으로 매니저 권한 확인 후 직원 민감정보 조회/저장.
// 퇴사자도 조회됨(사장은 급여·세무·재고용 위해 봐야 함). 직원 본인은 접근 불가.
// ⚠️ verify_jwt=false 로 배포 — 자체 세션토큰+매니저 검증. true면 401.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MANAGER_LEVELS = ["owner", "franchise_admin", "store_manager"];
const SAVE_FIELDS = ["pin", "id_number", "bank_name", "account_number", "phone", "address", "birth_date"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    const { token, action, target_employee_id, data } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) 증표으로 요청자 확인
    const { data: sess } = await admin.from("emp_sessions").select("*").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음" });
    if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료" });

    const { data: requester } = await admin.from("employees")
      .select("id, store_id, auth_level, is_manager").eq("id", sess.employee_id).maybeSingle();
    if (!requester) return json({ ok: false, error: "요청자 없음" });

    // ── 본인 정보 통로 (매니저 권한 불필요, 본인 것만) — 2026-06-30 직원 셀프 등록 ──
    const SELF_FIELDS = ["id_number", "bank_name", "account_number", "address", "birth_date"]; // pin·phone 제외(가입에서 처리)
    if (action === "get_self") {
      const { data: r } = await admin.from("employee_private")
        .select("id_number, bank_name, account_number, address, birth_date")
        .eq("employee_id", requester.id).maybeSingle();
      return json({ ok: true, row: r || {} });
    }
    if (action === "save_self") {
      const row: any = { employee_id: requester.id, store_id: requester.store_id, updated_at: new Date().toISOString() };
      for (const f of SELF_FIELDS) if (data && f in data) row[f] = data[f];
      const { error: se } = await admin.from("employee_private").upsert(row, { onConflict: "employee_id" });
      if (se) throw se;
      return json({ ok: true });
    }

    // 2) 매니저 권한 확인 (아래 list/save 는 매니저 전용)
    const isManager = MANAGER_LEVELS.includes(requester.auth_level) || requester.is_manager === true;
    if (!isManager) return json({ ok: false, error: "권한 없음" });
    const storeId = requester.store_id;

    // 3) action
    if (action === "list") {
      const { data: emps } = await admin.from("employees").select("id").eq("store_id", storeId);
      const ids = (emps || []).map((e: any) => e.id);
      if (ids.length === 0) return json({ ok: true, rows: [] });
      const { data: rows } = await admin.from("employee_private")
        .select("employee_id, pin, id_number, bank_name, account_number, phone, address, birth_date")
        .in("employee_id", ids);
      return json({ ok: true, rows: rows || [] });
    }

    if (action === "save") {
      if (!target_employee_id) return json({ ok: false, error: "대상 직원 없음" }, 400);
      const { data: target } = await admin.from("employees").select("id, store_id").eq("id", target_employee_id).maybeSingle();
      if (!target || target.store_id !== storeId) return json({ ok: false, error: "다른 매장 직원" }, 403);
      const row: any = { employee_id: target_employee_id, store_id: storeId, updated_at: new Date().toISOString() };
      for (const f of SAVE_FIELDS) if (data && f in data) row[f] = data[f];
      const { error: ue } = await admin.from("employee_private").upsert(row, { onConflict: "employee_id" });
      if (ue) throw ue;
      return json({ ok: true });
    }

    return json({ ok: false, error: "알 수 없는 action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
