// 가입 완료 — 문자 인증 증표(signup_tokens) 검증 후 본인 이름 + 로그인 PIN 저장(persons).
// 증표는 join-store(매장 합류)에도 쓰므로 여기서 소진하지 않음(시간 만료로만 무효).
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { token, name, pin } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const nm = (name || "").trim();
    if (!nm) return json({ ok: false, error: "이름을 입력해주세요" }, 400);
    if (!/^[0-9]{4,6}$/.test(String(pin || ""))) return json({ ok: false, error: "PIN은 숫자 4~6자리" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 증표 검증 (존재·미만료)
    const { data: st } = await admin.from("signup_tokens").select("*").eq("token", token).maybeSingle();
    if (!st) return json({ ok: false, error: "인증을 다시 받아주세요" });
    if (new Date(st.expires_at) < new Date()) return json({ ok: false, error: "인증이 만료됐어요. 다시 받아주세요" });

    const { error: ue } = await admin.from("persons").update({ name: nm, pin: String(pin) }).eq("id", st.person_id);
    if (ue) throw ue;

    return json({ ok: true, person_id: st.person_id });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
