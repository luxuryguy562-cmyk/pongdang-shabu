// 매장 합류 관리 (사장/매니저용) — 로그인 증표(emp_sessions)로 매니저 권한 확인 후:
//   issue / list_codes / list_pending / approve / reject. verify_jwt=false — 자체 세션토큰 검증.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MANAGER_LEVELS = ["owner", "franchise_admin", "store_manager"];
const PUBLIC_KEY = "sb_publishable_YuKpf2bsq72vo4N9Qm2GEQ_p2HivKgu";
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) s += alphabet[buf[i] % alphabet.length];
  return s;
}
// 실시간 신호 발사 (store-{id} 채널) — 실패해도 본 작업엔 영향 없음
async function broadcast(storeId: string, kind: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": PUBLIC_KEY, "Authorization": `Bearer ${PUBLIC_KEY}` },
      body: JSON.stringify({ messages: [{ topic: `store-${storeId}`, event: "change", payload: { kind } }] }),
    });
  } catch (_e) { /* 실시간 실패 무시 */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { token, action, pending_id } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: sess } = await admin.from("emp_sessions").select("*").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음" });
    if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료" });
    const { data: requester } = await admin.from("employees")
      .select("id, store_id, auth_level, is_manager").eq("id", sess.employee_id).maybeSingle();
    if (!requester) return json({ ok: false, error: "요청자 없음" });

    const isManager = MANAGER_LEVELS.includes(requester.auth_level) || requester.is_manager === true;
    if (!isManager) return json({ ok: false, error: "권한 없음" });
    const storeId = requester.store_id;

    // 7일 만료 코드 발급 (옛 코드 비활성화 후 새로) — 공통 헬퍼
    async function freshCode() {
      // 살아있는 옛 코드 전부 비활성화 (한 매장 = 활성 코드 1개 유지)
      await admin.from("store_join_codes").update({ is_active: false }).eq("store_id", storeId).eq("is_active", true);
      const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7일 후
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { error } = await admin.from("store_join_codes")
          .insert({ store_id: storeId, code, created_by: requester.id, expires_at: exp });
        if (!error) return json({ ok: true, code, expires_at: exp });
        if ((error as any).code !== "23505") throw error;
      }
      return json({ ok: false, error: "코드 발급 실패 — 다시 시도해주세요" });
    }

    if (action === "issue") {
      // 살아있고 + 아직 안 만료된 코드면 그대로 재사용
      const { data: existing } = await admin.from("store_join_codes")
        .select("code, expires_at").eq("store_id", storeId).eq("is_active", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing && existing.expires_at && new Date(existing.expires_at) > new Date()) {
        return json({ ok: true, code: existing.code, expires_at: existing.expires_at });
      }
      // 없거나 만료됨 → 새 7일 코드
      return await freshCode();
    }

    // 사장이 "코드 새로 만들기" 누름 — 옛 코드 즉시 폐기 + 새 7일 코드
    if (action === "reissue") {
      return await freshCode();
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
      await broadcast(storeId, "approve");
      return json({ ok: true });
    }

    if (action === "reject") {
      if (!pending_id) return json({ ok: false, error: "대상 없음" }, 400);
      const { error: re } = await admin.from("pending_joins").update({
        status: "rejected", decided_by: requester.id, decided_at: new Date().toISOString(),
      }).eq("id", pending_id).eq("store_id", storeId).eq("status", "pending");
      if (re) throw re;
      await broadcast(storeId, "reject");
      return json({ ok: true });
    }

    return json({ ok: false, error: "알 수 없는 action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
