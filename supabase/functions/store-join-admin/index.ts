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
const PUBLIC_KEY = "sb_publishable_7QoW2WkSQE4WA4w7uFughA_GXQMkMUe";
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
function normPhone(p: string) { return (p || "").replace(/[^0-9]/g, ""); }
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
// 솔라피 문자 발송 (승인/거절 알림) — 키 없거나 실패해도 본 작업엔 영향 없음
async function sendSms(phone: string, text: string) {
  try {
    const ph = normPhone(phone);
    if (ph.length < 10) return;
    const apiKey = Deno.env.get("SOLAPI_API_KEY");
    const apiSecret = Deno.env.get("SOLAPI_API_SECRET");
    const sender = Deno.env.get("SOLAPI_SENDER");
    if (!apiKey || !apiSecret || !sender) return;
    const date = new Date().toISOString();
    const salt = crypto.randomUUID().replaceAll("-", "");
    const enc = new TextEncoder();
    const keyObj = await crypto.subtle.importKey("raw", enc.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBuf = await crypto.subtle.sign("HMAC", keyObj, enc.encode(date + salt));
    const signature = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
    await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { to: ph, from: normPhone(sender), text } }),
    });
  } catch (_e) { /* 문자 실패 무시 */ }
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

    if (action === "issue") {
      const { data: existing } = await admin.from("store_join_codes")
        .select("code").eq("store_id", storeId).eq("is_active", true).limit(1).maybeSingle();
      if (existing) return json({ ok: true, code: existing.code });
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
      // 직원에게 승인 문자
      const { data: store } = await admin.from("stores").select("name").eq("id", storeId).maybeSingle();
      if (person?.phone) await sendSms(person.phone, `[${store?.name || "매장"}] 가입이 승인됐어요! 이제 앱에서 전화번호+비밀번호로 로그인하세요.`);
      return json({ ok: true });
    }

    if (action === "reject") {
      if (!pending_id) return json({ ok: false, error: "대상 없음" }, 400);
      const { data: pj } = await admin.from("pending_joins")
        .select("person_id").eq("id", pending_id).eq("store_id", storeId).eq("status", "pending").maybeSingle();
      const { error: re } = await admin.from("pending_joins").update({
        status: "rejected", decided_by: requester.id, decided_at: new Date().toISOString(),
      }).eq("id", pending_id).eq("store_id", storeId).eq("status", "pending");
      if (re) throw re;
      await broadcast(storeId, "reject");
      // 직원에게 거절 문자
      if (pj?.person_id) {
        const { data: person } = await admin.from("persons").select("phone").eq("id", pj.person_id).maybeSingle();
        const { data: store } = await admin.from("stores").select("name").eq("id", storeId).maybeSingle();
        if (person?.phone) await sendSms(person.phone, `[${store?.name || "매장"}] 죄송해요, 가입 신청이 거절됐어요. 사장님께 문의해주세요.`);
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "알 수 없는 action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
