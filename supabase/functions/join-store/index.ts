// 매장 합류 — 직원이 매장 코드 입력 → 코드 검증 → 가입 대기(pending_joins) 등록.
// verify_jwt=false — 로그인 전 호출(자체 가입증표 검증).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// 실시간 종 알림용 공개키 (client와 동일, 공개키라 노출 무방)
const PUBLIC_KEY = "sb_publishable_YuKpf2bsq72vo4N9Qm2GEQ_p2HivKgu";
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
function normCode(c: string) { return (c || "").trim().toUpperCase(); }
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
    const body = await req.json();
    const { token, code, action } = body;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ─── 내가 신청한 미승인 연결 목록 (로그인 후 설정 화면·개인 홈용) ───
    if (action === "list_my_pending") {
      if (!token) return json({ ok: false, error: "증표 없음" }, 400);
      const { data: sess } = await admin.from("emp_sessions").select("employee_id, person_id, expires_at").eq("token", token).maybeSingle();
      if (!sess) return json({ ok: false, error: "세션 없음" });
      if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료" });
      // 개인 모드 세션 = person_id 직접 사용 / 매장 세션 = employee → person_id
      let pid: string | null = sess.person_id || null;
      if (!pid && sess.employee_id) {
        const { data: emp } = await admin.from("employees").select("person_id").eq("id", sess.employee_id).maybeSingle();
        pid = emp?.person_id || null;
      }
      if (!pid) return json({ ok: true, rows: [] });
      const { data: rows } = await admin.from("pending_joins")
        .select("id, status, created_at, stores(name)")
        .eq("person_id", pid)
        .eq("status", "pending");
      return json({ ok: true, rows: rows || [] });
    }

    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const cd = normCode(code);
    if (!cd) return json({ ok: false, error: "매장 코드를 입력해주세요" }, 400);

    // 증표 = 가입 증표(signup_tokens) 또는 로그인 세션(emp_sessions) 둘 다 허용
    //  · 가입 직후 연결 = signup_token / 혼자 쓰다 나중에 연결 = 로그인 세션(pd_token)
    let personId: string | null = null;
    const { data: st } = await admin.from("signup_tokens").select("person_id, expires_at").eq("token", token).maybeSingle();
    if (st) {
      if (new Date(st.expires_at) < new Date()) return json({ ok: false, error: "인증이 만료됐어요. 다시 받아주세요" });
      personId = st.person_id;
    } else {
      const { data: sess } = await admin.from("emp_sessions").select("person_id, expires_at").eq("token", token).maybeSingle();
      if (!sess) return json({ ok: false, error: "인증을 다시 받아주세요" });
      if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "로그인이 만료됐어요. 다시 로그인해주세요" });
      if (!sess.person_id) return json({ ok: false, error: "사용자 확인 불가" });
      personId = sess.person_id;
    }

    const { data: person } = await admin.from("persons").select("id, name, pin").eq("id", personId).maybeSingle();
    if (!person || !person.name || !person.pin) return json({ ok: false, error: "이름·PIN을 먼저 설정해주세요" });

    const { data: jc } = await admin.from("store_join_codes").select("*").eq("code", cd).maybeSingle();
    if (!jc || jc.is_active !== true) return json({ ok: false, error: "없는 매장 코드예요" });
    if (jc.expires_at && new Date(jc.expires_at) < new Date()) return json({ ok: false, error: "만료된 코드예요" });

    const { data: existEmp } = await admin.from("employees")
      .select("id").eq("store_id", jc.store_id).eq("person_id", personId).maybeSingle();
    if (existEmp) return json({ ok: false, error: "이미 등록된 매장이에요" });

    const { error: ie } = await admin.from("pending_joins")
      .insert({ person_id: personId, store_id: jc.store_id, join_code_id: jc.id, status: "pending" });
    if (ie) {
      if ((ie as any).code === "23505") return json({ ok: false, error: "이미 신청한 매장이에요. 사장님 승인 대기 중" });
      throw ie;
    }

    // 사장님 종 배지 즉시 갱신
    await broadcast(jc.store_id, "join");

    // 사장님에게 푸시 알림 (매장 연결 신청 — 2026-06-29) — 실패해도 신청엔 영향 없음
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: jc.store_id, payload: { title: "매장 연결 신청 🔔", body: `${person.name}님이 매장 연결을 신청했어요. 승인해 주세요.`, url: "/" } }),
      });
    } catch (_e) { /* 푸시 실패 무시 */ }

    const { data: store } = await admin.from("stores").select("name").eq("id", jc.store_id).maybeSingle();
    return json({ ok: true, store_name: store?.name || "매장", status: "pending" });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
