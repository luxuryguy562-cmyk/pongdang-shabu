// 개인 근태(나의 근무 일지) — 매장 연결 전 직원이 혼자 찍는 기록.
// 2026-06-26 신설. person 세션 토큰으로 본인 확인 → personal_attendance_logs 접근.
// store_id 없음 = 급여 계산 안 함(시급 없음). 총 근무시간만 기록.
// RLS 차단(service_role만)이므로 반드시 이 함수 경유 = 남의 개인 기록 못 봄.
// ⚠️ verify_jwt=false 로 배포 — 자체 세션토큰 검증.
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
// 총 근무(분) = (퇴근-출근)/60000 - 휴게. 퇴근 없으면 null.
function calcWorkMin(appIn: string | null, appOut: string | null, restMin: number) {
  if (!appIn || !appOut) return null;
  const ms = new Date(appOut).getTime() - new Date(appIn).getTime();
  if (ms <= 0) return 0;
  return Math.max(0, Math.round(ms / 60000) - (restMin || 0));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    const { token, action, work_date, app_in, app_out, rest_min, note, id } = await req.json();
    if (!token) return json({ ok: false, error: "증표 없음" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 세션 → person 확인
    const { data: sess } = await admin.from("emp_sessions").select("*").eq("token", token).maybeSingle();
    if (!sess) return json({ ok: false, error: "세션 없음" });
    if (new Date(sess.expires_at) < new Date()) return json({ ok: false, error: "세션 만료" });
    // person_id 우선, 없으면 직원의 person_id 역추적
    let personId = sess.person_id;
    if (!personId && sess.employee_id) {
      const { data: e } = await admin.from("employees").select("person_id").eq("id", sess.employee_id).maybeSingle();
      personId = e?.person_id || null;
    }
    if (!personId) return json({ ok: false, error: "사람 정보 없음" });

    // ── 조회: 기간 내 개인 기록 ──
    if (action === "list") {
      const from = work_date?.from, to = work_date?.to;
      let q = admin.from("personal_attendance_logs").select("*").eq("person_id", personId).order("work_date", { ascending: false });
      if (from) q = q.gte("work_date", from);
      if (to) q = q.lte("work_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, rows: data || [] });
    }

    // ── 출근(오늘) ── 같은 날 행 있으면 app_in만 갱신(이미 있으면 막음)
    if (action === "clock_in") {
      const date = work_date || new Date().toISOString().slice(0, 10);
      const nowIso = app_in || new Date().toISOString();
      const { data: exist } = await admin.from("personal_attendance_logs")
        .select("id, app_in, app_out").eq("person_id", personId).eq("work_date", date).maybeSingle();
      if (exist && exist.app_in && !exist.app_out) return json({ ok: false, error: "이미 출근 기록이 있어요" });
      if (exist) {
        const { error } = await admin.from("personal_attendance_logs")
          .update({ app_in: nowIso, app_out: null, total_work_min: null, updated_at: new Date().toISOString() }).eq("id", exist.id);
        if (error) throw error;
        return json({ ok: true, id: exist.id });
      }
      const { data, error } = await admin.from("personal_attendance_logs")
        .insert({ person_id: personId, work_date: date, app_in: nowIso }).select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }

    // ── 퇴근(오늘) ──
    if (action === "clock_out") {
      const date = work_date || new Date().toISOString().slice(0, 10);
      const { data: exist } = await admin.from("personal_attendance_logs")
        .select("*").eq("person_id", personId).eq("work_date", date).maybeSingle();
      if (!exist || !exist.app_in) return json({ ok: false, error: "출근 기록이 없어요" });
      const nowIso = app_out || new Date().toISOString();
      const total = calcWorkMin(exist.app_in, nowIso, exist.rest_min || 0);
      const { error } = await admin.from("personal_attendance_logs")
        .update({ app_out: nowIso, total_work_min: total, updated_at: new Date().toISOString() }).eq("id", exist.id);
      if (error) throw error;
      return json({ ok: true, total_work_min: total });
    }

    // ── 수동 추가/수정 (직원이 빠진 날 직접 입력) ──
    if (action === "save") {
      if (!work_date) return json({ ok: false, error: "날짜를 입력해주세요" }, 400);
      const rm = parseInt(rest_min) || 0;
      const total = calcWorkMin(app_in || null, app_out || null, rm);
      const row: any = { person_id: personId, work_date, app_in: app_in || null, app_out: app_out || null, rest_min: rm, total_work_min: total, note: note || null, updated_at: new Date().toISOString() };
      if (id) {
        const { error } = await admin.from("personal_attendance_logs").update(row).eq("id", id).eq("person_id", personId);
        if (error) throw error;
        return json({ ok: true, id });
      }
      // upsert (하루 1행)
      const { data, error } = await admin.from("personal_attendance_logs")
        .upsert(row, { onConflict: "person_id,work_date" }).select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }

    // ── 삭제 ── (편입된 기록은 삭제 금지)
    if (action === "delete") {
      if (!id) return json({ ok: false, error: "대상 없음" }, 400);
      const { data: row } = await admin.from("personal_attendance_logs").select("merged_at").eq("id", id).eq("person_id", personId).maybeSingle();
      if (!row) return json({ ok: false, error: "기록 없음" });
      if (row.merged_at) return json({ ok: false, error: "매장에 편입된 기록은 삭제할 수 없어요" });
      const { error } = await admin.from("personal_attendance_logs").delete().eq("id", id).eq("person_id", personId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: "알 수 없는 action" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
