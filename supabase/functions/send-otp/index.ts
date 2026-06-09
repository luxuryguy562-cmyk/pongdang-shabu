// 문자 인증번호 발송 — 6자리 생성 → otp_codes 저장 → 솔라피(SOLAPI) SMS 발송.
// ⚠️ verify_jwt=false 로 배포 — 로그인 전 호출(자체 재발송 제한). true면 401.
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

// 솔라피 HMAC-SHA256 서명 인증 헤더 생성
async function solapiAuth(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replaceAll("-", "");
  const enc = new TextEncoder();
  const keyObj = await crypto.subtle.importKey("raw", enc.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", keyObj, enc.encode(date + salt));
  const signature = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { phone } = await req.json();
    const ph = normPhone(phone);
    if (ph.length < 10) return json({ ok: false, error: "전화번호를 확인해주세요" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 재발송 제한: 30초 이내 재요청 차단
    const { data: prev } = await admin.from("otp_codes").select("created_at").eq("phone", ph).maybeSingle();
    if (prev && (Date.now() - new Date(prev.created_at).getTime()) < 30000)
      return json({ ok: false, error: "잠시 후 다시 시도해주세요" });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await admin.from("otp_codes").upsert({ phone: ph, code, expires_at: expires, attempts: 0, created_at: new Date().toISOString() }, { onConflict: "phone" });

    // 솔라피 SMS 발송
    const apiKey = Deno.env.get("SOLAPI_API_KEY");
    const apiSecret = Deno.env.get("SOLAPI_API_SECRET");
    const sender = Deno.env.get("SOLAPI_SENDER");
    if (!apiKey || !apiSecret || !sender) {
      return json({ ok: false, error: "문자서비스 미설정", need_setup: true });
    }
    const authHeader = await solapiAuth(apiKey, apiSecret);
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { to: ph, from: normPhone(sender), text: `[퐁당샤브] 인증번호 ${code} (5분 이내 입력)` } }),
    });
    const out = await res.json().catch(() => ({}));
    const okSend = res.status < 400 && (out.statusCode === "2000" || out.statusCode === undefined && out.messageId);
    if (!okSend) return json({ ok: false, error: "문자 발송 실패", detail: out.statusMessage || out.errorMessage || null });
    return json({ ok: true });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
