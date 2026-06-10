// 직원 로그인 서버 검증 — PIN 비교를 서버(service_role)에서 수행.
// 성공 시 '본인' 정보만 반환(PIN 제외) + 로그인 증표(세션 토큰) 발급.
// ⚠️ verify_jwt=false 로 배포 — 로그인 전에 호출되는 공개 엔드포인트(자체 PIN 검증). true면 401.
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
    const { store_id, name, pin } = await req.json();
    if (!store_id || !name || !pin) return json({ ok: false, error: "필수 정보 누락" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) 매장+이름으로 재직 직원 조회 (동명이인 가능)
    const { data: emps, error } = await admin.from("employees").select("*")
      .eq("store_id", store_id).eq("name", name).eq("is_active", true);
    if (error) throw error;
    if (!emps || emps.length === 0) return json({ ok: false, error: "등록되지 않은 직원입니다" });

    // 2) 금고에서 PIN 조회 후 서버에서 비교 (동명이인 방어)
    const ids = emps.map((e: any) => e.id);
    const { data: privs, error: pe } = await admin.from("employee_private")
      .select("employee_id, pin, id_number, bank_name, account_number, phone, address, birth_date").in("employee_id", ids);
    if (pe) throw pe;
    const privMap = new Map((privs || []).map((p: any) => [p.employee_id, p]));
    const matched = emps.find((e: any) => (privMap.get(e.id)?.pin) === String(pin));
    if (!matched) return json({ ok: false, error: "PIN이 일치하지 않습니다" });

    // 3) 본인 정보 조립: 비민감(employees) + 본인 민감(금고, PIN 제외)
    const mine: any = privMap.get(matched.id) || {};
    const safe: any = {};
    for (const k of Object.keys(matched)) if (!SENSITIVE.includes(k)) safe[k] = matched[k];
    safe.id_number = mine.id_number ?? null;
    safe.bank_name = mine.bank_name ?? null;
    safe.account_number = mine.account_number ?? null;
    safe.phone = mine.phone ?? null;
    safe.address = mine.address ?? null;
    safe.birth_date = mine.birth_date ?? null;

    // 4) 로그인 증표(세션 토큰) 발급 — 자동 로그인용 (90일)
    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("emp_sessions").insert({ token, employee_id: matched.id, store_id, expires_at: expires });

    return json({ ok: true, emp: safe, token });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
