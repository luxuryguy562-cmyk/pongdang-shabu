// 본인 PIN 변경 — 로그인 증표(세션 토큰)으로 본인 확인 후, 현재 PIN 맞으면 새 PIN(암호화) 저장.
// 개인 모드·매장 모드 모두 동작(person 기준). 문자 인증 불필요(현재 PIN을 아는 본인만 변경).
// ⚠️ verify_jwt=false 로 배포 — 자체 세션토큰으로 검증. true면 401.
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
// PIN 암호화 — HMAC-SHA256(pin, PIN_SECRET). 다른 함수(emp-login 등)와 동일 비밀키·방식이라 서로 호환.
async function hashPin(pin: string): Promise<string> {
  const secret = Deno.env.get("PIN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(pin)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { token, old_pin, new_pin } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    if (!/^[0-9]{6}$/.test(String(new_pin || ""))) return json({ ok: false, error: "새 PIN은 숫자 6자리" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) 세션 → 본인(person) 확인
    const { data: sess } = await admin.from("emp_sessions").select("person_id, expires_at").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음. 다시 로그인해주세요" });
    if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료. 다시 로그인해주세요" });
    if (!sess.person_id) return json({ ok: false, error: "사용자 확인 불가" });

    const { data: person } = await admin.from("persons").select("id, pin").eq("id", sess.person_id).maybeSingle();
    if (!person) return json({ ok: false, error: "사용자 없음" });

    // 2) 현재 PIN 검증 — 옛 평문 + 새 암호화 둘 다 인정
    const oldStr = String(old_pin || "");
    const expected = person.pin ? String(person.pin) : null;
    const oldHash = await hashPin(oldStr);
    const ok = !!expected && (expected === oldStr || expected === oldHash);
    if (!ok) return json({ ok: false, error: "현재 PIN이 일치하지 않아요" });

    // 3) 새 PIN 암호화 저장 + 잠금 카운터 리셋
    const newHash = await hashPin(String(new_pin));
    const { error: ue } = await admin.from("persons")
      .update({ pin: newHash, pin_fail_count: 0, pin_lock_stage: 0, pin_lock_until: null }).eq("id", person.id);
    if (ue) throw ue;

    // 4) 레거시 금고(employee_private) 평문 PIN 제거 — 옛 값이 fallback으로 새는 것 방지
    const { data: emps } = await admin.from("employees").select("id").eq("person_id", person.id);
    const ids = (emps || []).map((e: any) => e.id);
    if (ids.length) await admin.from("employee_private").update({ pin: null }).in("employee_id", ids);

    return json({ ok: true });
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
