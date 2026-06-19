// 신규 매장 가입 서버 처리 — 잠금(RLS) 후에도 가입이 되게 하기 위함.
// 가입 시점엔 매장 신분증이 없어서 앱이 stores/employees 를 직접 못 만듦 → 이 함수가 service_role 로 대신 만든다.
// ① Auth 계정 ② 본사(franchise) ③ 매장 ④ 사장 직원 ⑤ 기본설정 + store_id 도장 신분증 발급.
// (⑥ 기본 데이터 seed 는 앱이 신분증 받은 뒤 처리 — 앱 상수 의존이 커서)
// ⚠️ verify_jwt=false — 로그인/가입 전 공개 엔드포인트.
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
function storeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { email, pw, storeName, ownerName, address, bizNo, inviteCode, signupType } = await req.json();
    if (!email || !pw || !storeName || !ownerName) return json({ ok: false, error: "필수 정보 누락" }, 400);
    const type = signupType || "personal";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ① Auth 계정 생성
    const cu = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { owner_name: ownerName } });
    if (cu.error || !cu.data?.user) {
      const msg = (cu.error?.message || "").includes("already") ? "이미 가입된 이메일이에요" : "계정 생성 실패";
      return json({ ok: false, error: msg }, 400);
    }
    const userId = cu.data.user.id;

    // ② 본사(franchise) 결정
    let franchiseId: string | null = null;
    let authLevelForEmp = "owner";
    let invCode: string | null = null;
    if (type === "franchise_hq") {
      invCode = "F-" + storeCode();
      const fr = await admin.from("franchises").insert({ name: storeName, invite_code: invCode, owner_user_id: userId, is_active: true }).select().single();
      if (fr.error) { await admin.auth.admin.deleteUser(userId); return json({ ok: false, error: "본사 생성 실패" }, 400); }
      franchiseId = fr.data.id;
      authLevelForEmp = "franchise_admin";
    } else if (type === "franchisee" && inviteCode) {
      const fr = await admin.from("franchises").select("id").eq("invite_code", String(inviteCode).toUpperCase()).maybeSingle();
      if (!fr.data) { await admin.auth.admin.deleteUser(userId); return json({ ok: false, error: "초대 코드가 맞지 않아요" }, 400); }
      franchiseId = fr.data.id;
    }

    // ③ 매장 생성
    const code = storeCode();
    const actualStoreName = type === "franchise_hq" ? "[" + storeName + "] 본사" : storeName;
    const st = await admin.from("stores").insert({
      name: actualStoreName, address: address || null, business_no: bizNo || null,
      store_code: code, tos_accepted_at: new Date().toISOString(),
      franchise_id: franchiseId, is_active: type !== "franchise_hq",
    }).select().single();
    if (st.error) { await admin.auth.admin.deleteUser(userId); return json({ ok: false, error: "매장 생성 실패" }, 400); }
    const storeId = st.data.id;

    // ④ 사장 직원 생성
    const ownerPin = Math.floor(1000 + Math.random() * 9000).toString();
    const em = await admin.from("employees").insert({
      store_id: storeId, name: ownerName, pin: ownerPin, auth_level: authLevelForEmp,
      auth_user_id: userId, is_active: true, is_approved: true, is_manager: true, base_wage: 0,
    }).select("id").single();
    if (em.error) return json({ ok: false, error: "사장 계정 생성 실패" }, 400);

    // ⑤ 기본 설정
    await admin.from("store_settings").upsert(
      { store_id: storeId, royalty_rate: 0, card_fee_rate: 2.5, reserve_rate: 5, reserve_fixed: 400000 },
      { onConflict: "store_id" });

    // ⑥ 매장 도장 신분증 발급 (앱이 이 세션으로 RLS 통과해 기본데이터 seed + 로그인)
    await admin.auth.admin.updateUserById(userId, { app_metadata: { store_id: storeId } });
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const signed = await anon.auth.signInWithPassword({ email, password: pw });
    const session = signed.data?.session
      ? { access_token: signed.data.session.access_token, refresh_token: signed.data.session.refresh_token }
      : null;

    return json({ ok: true, storeId, storeName: actualStoreName, storeCode: code, ownerPin, signupType: type, inviteCode: invCode, session });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
