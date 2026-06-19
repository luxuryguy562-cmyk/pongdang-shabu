// 로그인 화면 전용 공개 통로 — 잠금(RLS) 후에도 로그인 전 매장/직원 목록을 보여주기 위함.
// 로그인 전에는 신분증(JWT)이 없어서 stores/employees 를 직접 못 읽음 → 이 함수가 최소 정보만 대신 내려줌.
// 민감정보(PIN·계좌·주민번호 등)는 절대 포함 안 함. service_role 로 조회.
// ⚠️ verify_jwt=false 로 배포 — 로그인 전에 호출되는 공개 엔드포인트.
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);
  try {
    const { action, store_id } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 매장 목록 (매장 고르기) — id·이름·브랜드만
    if (action === "stores") {
      const { data, error } = await admin.from("stores")
        .select("id, name, franchise_id, franchises(name)").eq("is_active", true).order("name");
      if (error) throw error;
      return json({ ok: true, stores: data || [] });
    }

    // 직원 이름 목록 (이름 고르기) — 비민감만 (PIN·개인정보 절대 X)
    if (action === "employees") {
      if (!store_id) return json({ ok: false, error: "store_id 필요" }, 400);
      const { data, error } = await admin.from("employees")
        .select("id, name, auth_level, role, is_active").eq("store_id", store_id).eq("is_active", true).order("name");
      if (error) throw error;
      return json({ ok: true, employees: data || [] });
    }

    return json({ ok: false, error: "알 수 없는 요청" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
