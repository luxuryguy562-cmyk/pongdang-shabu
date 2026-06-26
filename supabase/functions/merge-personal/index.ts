// 개인기록 편입 — 직원이 연결 전 혼자 찍은 개인 근태를 사장이 검토 후 매장 출근부로 편입.
// 2026-06-26 신설. 사장(매니저) 세션 토큰으로 권한 확인.
//  - preview: 그 사람(person)의 당월 미편입 개인기록 목록 (사장이 날짜별 검토)
//  - mark_merged: 사장이 attendance_logs에 넣은 뒤(앱에서 급여계산) 개인기록에 편입 완료 표시
// 급여 계산은 앱(calcWageData 단일 함수)에서 — 회계 단일 진실(헌법 7-7) 유지.
// ⚠️ verify_jwt=false 로 배포 — 자체 세션토큰 검증.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MANAGER_LEVELS = ["owner", "franchise_admin", "store_manager"];
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    const { token, action, person_id, month, merges } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) 요청자 = 매니저(사장) 확인
    const { data: sess } = await admin.from("emp_sessions").select("*").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음" });
    if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료" });
    if (!sess.employee_id) return json({ ok: false, error: "권한 없음" });
    const { data: requester } = await admin.from("employees")
      .select("id, store_id, auth_level, is_manager").eq("id", sess.employee_id).maybeSingle();
    if (!requester) return json({ ok: false, error: "요청자 없음" });
    const isManager = MANAGER_LEVELS.includes(requester.auth_level) || requester.is_manager === true;
    if (!isManager) return json({ ok: false, error: "권한 없음" });
    const storeId = requester.store_id;

    // 2) 대상 person 이 이 매장 직원으로 등록(승인)됐는지 확인 — 아무 사람 기록이나 못 봄
    async function ensureMember(pid: string) {
      const { data: emp } = await admin.from("employees")
        .select("id").eq("store_id", storeId).eq("person_id", pid).eq("is_active", true).maybeSingle();
      return emp || null;
    }

    // ── 미리보기: 당월 미편입 개인기록 ──
    if (action === "preview") {
      if (!person_id) return json({ ok: false, error: "대상 없음" }, 400);
      const member = await ensureMember(person_id);
      if (!member) return json({ ok: false, error: "이 매장 직원이 아니에요" }, 403);
      // 당월(month: 'YYYY-MM', 없으면 이번달)
      const mk = month || new Date().toISOString().slice(0, 7);
      const from = mk + "-01";
      const [y, m] = mk.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${mk}-${String(lastDay).padStart(2, "0")}`;
      const { data: rows, error } = await admin.from("personal_attendance_logs")
        .select("*").eq("person_id", person_id).gte("work_date", from).lte("work_date", to)
        .is("merged_at", null).order("work_date");
      if (error) throw error;
      // 이미 매장 출근부에 같은 날 기록이 있는지 표시(중복 방지)
      const dates = (rows || []).map((r: any) => r.work_date);
      let dupDates = new Set<string>();
      if (dates.length) {
        const { data: existing } = await admin.from("attendance_logs")
          .select("work_date").eq("store_id", storeId).eq("employee_id", member.id).in("work_date", dates);
        dupDates = new Set((existing || []).map((e: any) => e.work_date));
      }
      const out = (rows || []).map((r: any) => ({ ...r, already_in_store: dupDates.has(r.work_date) }));
      return json({ ok: true, employee_id: member.id, rows: out });
    }

    // ── 편입 완료 표시: 앱이 attendance_logs insert 후 호출 ──
    if (action === "mark_merged") {
      if (!Array.isArray(merges) || !merges.length) return json({ ok: false, error: "편입 대상 없음" }, 400);
      const now = new Date().toISOString();
      for (const mg of merges) {
        if (!mg.personal_id) continue;
        await admin.from("personal_attendance_logs").update({
          merged_store_id: storeId,
          merged_attendance_id: mg.attendance_id || null,
          merged_at: now,
          updated_at: now,
        }).eq("id", mg.personal_id);
      }
      return json({ ok: true, merged: merges.length });
    }

    return json({ ok: false, error: "알 수 없는 action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
