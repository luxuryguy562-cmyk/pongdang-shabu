// send-push — 푸시 알림 발송 (2026-06-29)
// 호출자 JWT의 app_metadata.store_id 구독에만 발송 (자기 매장 격리).
// service_role 호출 시 body.store_id 지정 가능 (자동 발송용 — 마감/근태 트리거).
// VAPID 비밀키는 코드에 없음 → DB app_secrets 표에서 service_role로 읽음 (깃 노출 0).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseJwt(req: Request): any {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(token.split(".")[1]));
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = parseJwt(req);
    const isService = jwt?.role === "service_role";
    let storeId = jwt?.app_metadata?.store_id || null;

    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    if (isService && body.store_id) storeId = body.store_id;

    if (!storeId) {
      return new Response(JSON.stringify({ error: "no store_id" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // VAPID 키 로드 (서버 전용 표)
    const { data: secrets } = await supabase.from("app_secrets").select("key,value").in("key", ["vapid_public", "vapid_private", "vapid_subject"]);
    const sm: Record<string, string> = {};
    (secrets || []).forEach((s: any) => { sm[s.key] = s.value; });
    if (!sm.vapid_private || !sm.vapid_public) {
      return new Response(JSON.stringify({ error: "vapid keys missing" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    webpush.setVapidDetails(sm.vapid_subject || "mailto:admin@example.com", sm.vapid_public, sm.vapid_private);

    // 해당 매장 구독 로드
    const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("store_id", storeId).eq("enabled", true);
    const payload = JSON.stringify(body.payload || { title: "캐쉬플로우", body: "테스트 알림이에요 🔔" });

    let sent = 0, failed = 0;
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e: any) {
        failed++;
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").update({ enabled: false }).eq("endpoint", s.endpoint);
        }
      }
    }
    return new Response(JSON.stringify({ sent, failed, total: (subs || []).length }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
