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

// ─── 새 기능: 매장 격리용 Supabase Auth 신분증(세션) 발급 ───
// PIN 검증을 이미 통과한 직원에게 store_id 도장이 박힌 Supabase 세션을 발급한다.
// 앱이 이 세션을 부착하면 RLS(매장 격리 잠금)가 "이 매장 것만" 보여줄 수 있다.
// app_metadata 는 JWT에 실리고 사용자가 못 고치므로 위조 불가 = 안전.
// ⚠️ 실패해도 로그인은 안 깨지게 호출부에서 try/catch 로 감싼다.
async function mintStoreSession(admin: any, employeeId: string, storeId: string) {
  const email = `emp.${employeeId}@pongdang.local`;
  // 결정적 비번(서버만 앎): service_role + employeeId 해시. 어디에도 저장 안 함.
  const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! + ":" + employeeId;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const password = "Pd1!" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // 1) 유저 확보 + store_id 도장 (없으면 생성)
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { store_id: storeId },
    user_metadata: { employee_id: employeeId },
  });
  // 이미 있으면(에러) 그대로 둠 — 비번/도장은 기존 것 사용(매장 변경은 별도 처리 예정).

  // 2) Supabase가 직접 서명한 세션 발급 (anon 클라이언트로 비번 로그인)
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signed, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !signed?.session) throw se || new Error("세션 발급 실패");
  void created;
  return { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token };
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

    // 5) 매장 격리용 Supabase 신분증 발급 (실패해도 로그인은 그대로) — 새 기능
    let session = null;
    try { session = await mintStoreSession(admin, matched.id, store_id); } catch (_se) { /* 신분증 실패 무시 */ }

    return json({ ok: true, emp: safe, token, session });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
