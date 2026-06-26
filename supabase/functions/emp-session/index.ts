// 자동 로그인 복원 — 로그인 증표(세션 토큰)으로 본인 증명 후 본인 정보만 반환(PIN 제외).
// 2026-06-26 개인 모드 지원: person_id만 있는 세션(매장 연결 전)도 복원.
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

// ─── 매장 격리용 Supabase Auth 신분증(세션) 발급 (emp-login 과 동일) ───
async function mintStoreSession(admin: any, employeeId: string, storeId: string) {
  const email = `emp.${employeeId}@pongdang.local`;
  const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! + ":" + employeeId;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const password = "Pd1!" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { store_id: storeId },
    user_metadata: { employee_id: employeeId },
  });
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signed, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !signed?.session) throw se || new Error("세션 발급 실패");
  return { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token };
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
    await admin.from("emp_sessions").update({ last_used_at: new Date().toISOString() }).eq("token", token);

    // ═══ 개인 모드 세션 (매장 연결 전) ═══
    if (!sess.employee_id && sess.person_id) {
      const { data: person } = await admin.from("persons").select("id, name, phone").eq("id", sess.person_id).maybeSingle();
      if (!person) return json({ ok: false, error: "사람 정보 없음" });
      // 그 사이 매장에 승인됐는지 확인 — 됐으면 매장 모드로 자동 승격
      const { data: emps } = await admin.from("employees").select("*").eq("person_id", person.id).eq("is_active", true);
      if (emps && emps.length) {
        return await restoreStoreMode(admin, person, emps, sess, token);
      }
      return json({ ok: true, mode: "personal", person, stores: [] });
    }

    // ═══ 매장 모드 세션 ═══
    const { data: emp } = await admin.from("employees").select("*").eq("id", sess.employee_id).eq("is_active", true).maybeSingle();
    if (!emp) return json({ ok: false, error: "직원 없음" });
    const personId = emp.person_id || sess.person_id;
    const { data: person } = personId
      ? await admin.from("persons").select("id, name, phone").eq("id", personId).maybeSingle()
      : { data: null };
    // 같은 사람의 모든 매장 (투잡 전환 UI용)
    const { data: emps } = personId
      ? await admin.from("employees").select("*").eq("person_id", personId).eq("is_active", true)
      : { data: [emp] };
    return await restoreStoreMode(admin, person, (emps && emps.length ? emps : [emp]), sess, token, emp);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});

// 매장 모드 복원 — 현재 세션의 매장(sess.store_id) 기준 본인 정보 + 매장 목록 + 신분증
async function restoreStoreMode(admin: any, person: any, emps: any[], sess: any, _token: string, knownEmp?: any) {
  // 현재 세션이 가리키는 매장의 직원 행 (없으면 첫 번째)
  let cur = knownEmp || emps.find((e) => e.id === sess.employee_id) || emps.find((e) => e.store_id === sess.store_id) || emps[0];
  const { data: mine } = await admin.from("employee_private")
    .select("id_number, bank_name, account_number, phone, address, birth_date").eq("employee_id", cur.id).maybeSingle();

  const safe: any = {};
  for (const k of Object.keys(cur)) if (!SENSITIVE.includes(k)) safe[k] = cur[k];
  const m: any = mine || {};
  safe.id_number = m.id_number ?? null;
  safe.bank_name = m.bank_name ?? null;
  safe.account_number = m.account_number ?? null;
  safe.phone = m.phone ?? null;
  safe.address = m.address ?? null;
  safe.birth_date = m.birth_date ?? null;

  // 매장 목록
  const storeIds = [...new Set(emps.map((e) => e.store_id))];
  const { data: stores } = await admin.from("stores").select("id, name").in("id", storeIds);
  const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));
  const storeList = emps.map((e) => ({
    employee_id: e.id, store_id: e.store_id,
    store_name: storeMap.get(e.store_id) || "매장",
    auth_level: e.auth_level, is_manager: e.is_manager,
  }));

  let session = null;
  try { session = await mintStoreSession(admin, cur.id, cur.store_id); } catch (_se) { /* 무시 */ }

  return json({ ok: true, mode: "store", emp: safe, person, session, stores: storeList });
}
