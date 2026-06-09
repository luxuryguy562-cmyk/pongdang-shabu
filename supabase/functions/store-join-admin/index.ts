// 매장 합류 관리 (사장/매니저용) — 로그인 증표(emp_sessions)로 매니저 권한 확인 후:
//   issue: 매장 코드 발급(고정 — 이미 있으면 그대로 반환) / list_codes: 코드 목록
//   list_pending: 가입 대기 목록 / approve: 승인(employees 생성) / reject: 거절
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MANAGER_LEVELS = ["owner", "franchise_admin", "store_manager"];
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
// 헷갈리는 글자(0/O/1/I) 뺀 6자리 코드
function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) s += alphabet[buf[i] % alphabet.length];
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { token, action, pending_id } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) 증표으로 요청자 확인
    const { data: sess } = await admin.from("emp_sessions").select("*").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음" });
    if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료" });
    const { data: requester } = await admin.from("employees")
      .select("id, store_id, auth_level, is_manager").eq("id", sess.employee_id).maybeSingle();
    if (!requester) return json({ ok: false, error: "요청자 없음" });

    // 2) 매니저 권한 확인
    const isManager = MANAGER_LEVELS.includes(requester.auth_level) || requester.is_manager === true;
    if (!isManager) return json({ ok: false, error: "권한 없음" });
    const storeId = requester.store_id;

    // 3) action
    if (action === "issue") {
      // 고정 코드 — 이미 활성 코드 있으면 그대로 반환
      const { data: existing } = await admin.from("store_join_codes")
        .select("code").eq("store_id", storeId).eq("is_active", true).limit(1).maybeSingle();
      if (existing) return json({ ok: true, code: existing.code });
      // 없으면 새로 발급 (충돌 시 재시도)
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { error } = await admin.from("store_join_codes")
          .insert({ store_id: storeId, code, created_by: requester.id });
        if (!error) return json({ ok: true, code });
        if ((error as any).code !== "23505") throw error;
      }
      return json({ ok: false, error: "코드 발급 실패 — 다시 시도해주세요" });
    }

    if (action === "list_codes") {
      const { data: rows } = await admin.from("store_join_codes")
        .select("id, code, is_active, expires_at, created_at").eq("store_id", storeId).order("created_at", { ascending: false });
      return json({ ok: true, rows: rows || [] });
    }

    if (action === "list_pending") {
      const { data: rows } = await admin.from("pending_joins")
        .select("id, person_id, status, created_at, persons(name, phone)")
        .eq("store_id", storeId).eq("status", "pending").order("created_at", { ascending: false });
      return json({ ok: true, rows: rows || [] });
    }

    if (action === "approve") {
      if (!pending_id) return json({ ok: false, error: "대상 없음" }, 400);
      const { data: pj } = await admin.from("pending_joins")
        .select("*").eq("id", pending_id).eq("store_id", storeId).maybeSingle();
      if (!pj) return json({ ok: false, error: "신청 없음" });
      if (pj.status !== "pending") return json({ ok: false, error: "이미 처리됨" });

      const { data: person } = await admin.from("persons").select("name, phone").eq("id", pj.person_id).maybeSingle();

      // 이미 직원이면 중복 생성 안 함
      const { data: existEmp } = await admin.from("employees")
        .select("id").eq("store_id", storeId).eq("person_id", pj.person_id).maybeSingle();
      if (!existEmp) {
        const { error: ce } = await admin.from("employees").insert({
          store_id: storeId,
          name: person?.name || "직원",
          person_id: pj.person_id,
          auth_level: "staff",
          is_manager: false,
          is_approved: true,
          is_active: true,
        });
        if (ce) throw ce;
      }
      await admin.from("pending_joins").update({
        status: "approved", decided_by: requester.id, decided_at: new Date().toISOString(),
      }).eq("id", pending_id);
      return json({ ok: true });
    }

    if (action === "reject") {
      if (!pending_id) return json({ ok: false, error: "대상 없음" }, 400);
      const { error: re } = await admin.from("pending_joins").update({
        status: "rejected", decided_by: requester.id, decided_at: new Date().toISOString(),
      }).eq("id", pending_id).eq("store_id", storeId).eq("status", "pending");
      if (re) throw re;
      return json({ ok: true });
    }

    return json({ ok: false, error: "알 수 없는 action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
