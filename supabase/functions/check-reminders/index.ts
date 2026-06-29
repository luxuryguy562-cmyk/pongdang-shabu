// check-reminders — 정해진 시각 자동 알림 (2026-06-29)
// pg_cron이 x-cron-secret 헤더로 호출. verify_jwt=false + 자체 시크릿 인증.
// mode=night: 오늘 마감 안 한 매장 → 마감 미완료 알림 (밤 22:00, 23:30)
// mode=morning: 어제 마감 빠짐 + 어제 퇴근 미기록 → 알림 (오전 09:00)
// 발송은 send-push 함수를 service_role로 호출 (코드 중복 방지).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SRK);

    // cron 시크릿 검증
    const secret = req.headers.get("x-cron-secret") || "";
    const { data: sec } = await supabase.from("app_secrets").select("value").eq("key", "cron_secret").maybeSingle();
    if (!sec || secret !== sec.value) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "morning" ? "morning" : "night";

    // KST 날짜 (UTC+9)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600 * 1000);
    const todayKst = kst.toISOString().slice(0, 10);
    const yKst = new Date(kst.getTime() - 86400000).toISOString().slice(0, 10);

    // 구독(켜짐) 있는 매장만 대상
    const { data: subStores } = await supabase.from("push_subscriptions").select("store_id").eq("enabled", true);
    const storeIds = [...new Set((subStores || []).map((s: any) => s.store_id))];

    async function push(store_id: string, payload: any) {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
        body: JSON.stringify({ store_id, payload }),
      }).catch(() => {});
    }

    let acted = 0;
    for (const sid of storeIds) {
      if (mode === "night") {
        const { data: s } = await supabase.from("settlements").select("id").eq("store_id", sid).eq("settle_date", todayKst).maybeSingle();
        if (!s) {
          await push(sid, { title: "마감 미완료 ⚠️", body: "오늘 마감이 아직 안 됐어요. 잊지 말고 마감해 주세요.", url: "/" });
          acted++;
        }
      } else {
        const { data: s } = await supabase.from("settlements").select("id").eq("store_id", sid).eq("settle_date", yKst).maybeSingle();
        if (!s) {
          await push(sid, { title: "어제 마감 빠짐 ⚠️", body: `어제(${yKst}) 마감 기록이 없어요. 직접 입력해 주세요.`, url: "/" });
          acted++;
        }
        const { data: att } = await supabase.from("attendance_logs").select("app_in,caps_in,app_out,caps_out,employees(name)").eq("store_id", sid).eq("work_date", yKst);
        const noOut = (att || []).filter((a: any) => (a.app_in || a.caps_in) && !a.app_out && !a.caps_out);
        if (noOut.length) {
          const names = noOut.map((a: any) => (a.employees && a.employees.name) || "직원").join("·");
          await push(sid, { title: `어제 퇴근 미기록 ⏰ ${noOut.length}명`, body: `${names} — 어제 퇴근 기록이 없어요. 급여 계산에 영향이 있어요.`, url: "/" });
          acted++;
        }
      }
    }
    return new Response(JSON.stringify({ mode, stores: storeIds.length, acted }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
