// 자동 로그인 복원 — 로그인 증표(세션 토큰)으로 본인 증명 후 본인 정보만 반환(PIN 제외).
// ⚠️ verify_jwt=false 로 배포 — 로그인 전 호출(자체 세션토큰 검증). true면 401.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SENSITIVE = ["pin", "id_number", "bank_name", "account_number", "phone", "address", "birth_date"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    const { token, action } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 로그아웃 — 증표 폐기
    if (action === "logout") {
      await admin.from("emp_sessions").delete().eq("token", token);
      return json({ ok: true });
    }

    const { data: sess } = await admin.from("emp_sessions").select("*").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음" });
    if (new Date(sess.expires_at) < new Date()) {
      await admin.from("emp_sessions").delete().eq("token", token);
      return json({ ok: false, error: "세션 만료" });
    }

    const { data: emp } = await admin.from("employees").select("*").eq("id", sess.employee_id).eq("is_active", true).maybeSingle();
    if (!emp) return json({ ok: false, error: "직원 없음" });
    const { data: mine } = await admin.from("employee_private")
      .select("id_number, bank_name, account_number, phone, address, birth_date").eq("employee_id", sess.employee_id).maybeSingle();

    const safe: any = {};
    for (const k of Object.keys(emp)) if (!SENSITIVE.includes(k)) safe[k] = (emp as any)[k];
    const m: any = mine || {};
    safe.id_number = m.id_number ?? null;
    safe.bank_name = m.bank_name ?? null;
    safe.account_number = m.account_number ?? null;
    safe.phone = m.phone ?? null;
    safe.address = m.address ?? null;
    safe.birth_date = m.birth_date ?? null;

    await admin.from("emp_sessions").update({ last_used_at: new Date().toISOString() }).eq("token", token);
    return json({ ok: true, emp: safe });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
