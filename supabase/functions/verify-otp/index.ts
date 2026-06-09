// 문자 인증번호 확인 → 맞으면 person(사람 계정) 찾기/생성 + 가입 증표(signup_tokens) 저장.
// 가입 증표는 이후 본인 PIN 설정(complete-signup)·매장 코드 합류(join-store)에 사용. 유효 30분.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
function normPhone(p: string) { return (p || "").replace(/[^0-9]/g, ""); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { phone, code } = await req.json();
    const ph = normPhone(phone);
    if (!ph || !code) return json({ ok: false, error: "입력 확인" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: otp } = await admin.from("otp_codes").select("*").eq("phone", ph).maybeSingle();
    if (!otp) return json({ ok: false, error: "인증번호를 먼저 받아주세요" });
    if (new Date(otp.expires_at) < new Date()) { await admin.from("otp_codes").delete().eq("phone", ph); return json({ ok: false, error: "인증번호가 만료됐어요" }); }
    if ((otp.attempts || 0) >= 5) { await admin.from("otp_codes").delete().eq("phone", ph); return json({ ok: false, error: "시도 초과 — 다시 받아주세요" }); }
    if (String(otp.code) !== String(code)) {
      await admin.from("otp_codes").update({ attempts: (otp.attempts || 0) + 1 }).eq("phone", ph);
      return json({ ok: false, error: "인증번호가 달라요" });
    }

    // 인증 성공 → person 찾기/생성
    let { data: person } = await admin.from("persons").select("*").eq("phone", ph).maybeSingle();
    let isNew = false;
    if (!person) {
      const { data: np, error } = await admin.from("persons").insert({ phone: ph }).select().single();
      if (error) throw error;
      person = np; isNew = true;
    }
    await admin.from("otp_codes").delete().eq("phone", ph);

    // 가입 증표 발급 + 저장 (complete-signup·join-store 검증용). 30분 유효.
    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error: te } = await admin.from("signup_tokens").insert({ token, person_id: person.id, expires_at: expiresAt });
    if (te) throw te;

    return json({ ok: true, person_id: person.id, is_new: isNew, has_name: !!person.name, token });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
