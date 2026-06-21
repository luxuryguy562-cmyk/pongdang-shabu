// 매장 전환 — "내 매장들"에서 다른 매장 카드를 누르면 그 매장 신분증(세션)을 새로 발급한다.
//
// 보안 핵심:
//   - 아무 매장이나 못 넘어간다. 요청자(현재 로그인 JWT)의 person_id 가 target 매장의
//     사장(owner/franchise_admin)으로 등록돼 있을 때만 그 매장 세션을 발급한다.
//   - 발급 방식은 emp-login 과 동일(매장 도장 박힌 Supabase 세션). RLS 격리는 그대로.
//   - 권한 없으면 403. 즉 다른 사람 매장으로는 절대 못 넘어간다.
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

// emp-login 과 동일한 방식으로 'store_id 도장' 박힌 세션 발급 (결정적 비번, 어디에도 저장 안 함)
async function mintStoreSession(admin: any, employeeId: string, storeId: string) {
  const email = `emp.${employeeId}@pongdang.local`;
  const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! + ":" + employeeId;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const password = "Pd1!" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // 유저 확보 + store_id 도장 (없으면 생성, 있으면 그대로 — 각 직원=고정 매장이라 도장 이미 그 매장)
  await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { store_id: storeId },
    user_metadata: { employee_id: employeeId },
  });
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signed, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !signed?.session) throw se || new Error("세션 발급 실패");
  return signed.session;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    // 1) 현재 로그인 신분증 확인
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "인증 정보가 없어요" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: udata, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !udata?.user) return json({ ok: false, error: "세션이 만료됐어요" }, 401);
    const empId = (udata.user.user_metadata as any)?.employee_id;
    if (!empId) return json({ ok: false, error: "직원 정보를 찾을 수 없어요" }, 400);

    // 2) target 매장
    let body: any = {};
    try { body = (await req.json()) || {}; } catch (_e) { /* 없음 */ }
    const targetStoreId = body.target_store_id;
    if (!targetStoreId) return json({ ok: false, error: "이동할 매장이 지정되지 않았어요" }, 400);

    // 3) 요청자의 person_id
    const { data: me } = await admin.from("employees")
      .select("id, person_id").eq("id", empId).maybeSingle();
    if (!me || !me.person_id) return json({ ok: false, error: "직원 정보를 찾을 수 없어요" }, 404);

    // 4) ⭐ 권한 검증 — target 매장에 "같은 사람"이 사장으로 등록돼 있어야만 통과
    const { data: targetEmp } = await admin.from("employees")
      .select("id, store_id, name")
      .eq("store_id", targetStoreId)
      .eq("person_id", me.person_id)
      .in("auth_level", ["owner", "franchise_admin"])
      .eq("is_active", true)
      .maybeSingle();
    if (!targetEmp) {
      return json({ ok: false, error: "이 매장에 들어갈 권한이 없어요" }, 403);
    }

    // 5) 그 매장 신분증(세션) 발급
    const session = await mintStoreSession(admin, targetEmp.id, targetStoreId);

    return json({
      ok: true,
      store_id: targetStoreId,
      employee_id: targetEmp.id,
      employee_name: targetEmp.name,
      session: { access_token: session.access_token, refresh_token: session.refresh_token },
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
