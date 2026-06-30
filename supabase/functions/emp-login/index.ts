// 로그인 서버 검증 — 2026-06-26 전화번호+PIN 방식으로 재설계.
// 사람(persons) 기준 로그인. PIN 비교를 서버(service_role)에서 수행.
//  - 개인 모드: 매장 연결 전(employees 0개) → person 세션만 발급(매장 도장 없음).
//  - 매장 모드: 매장 연결됨(employees 1개+) → 기본 매장 세션 발급 + 투잡이면 매장 목록 반환.
//  - 무차별 대입(brute force) 방어: PIN 5회 연속 틀림 → 점진적 잠금(1분→5분→10분).
//  - 하위호환: 옛 앱이 {store_id, name, pin} 보내면 옛 방식으로도 처리.
// ⚠️ verify_jwt=false 로 배포 — 로그인 전에 호출되는 공개 엔드포인트.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SENSITIVE = ["pin", "id_number", "bank_name", "account_number", "phone", "address", "birth_date"];
const LOCK_MINUTES = [1, 5, 10]; // 잠금 단계: 1차 1분, 2차 5분, 3차+ 10분
const MAX_TRIES = 5;             // 연속 5회 틀리면 잠금 발동

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function normPhone(p: string) { return (p || "").replace(/[^0-9]/g, ""); }
// PIN 암호화 — HMAC-SHA256(pin, PIN_SECRET). 저장은 암호화, 비교 시 입력도 같이 암호화해 대조 (2026-06-30)
async function hashPin(pin: string): Promise<string> {
  const secret = Deno.env.get("PIN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(pin)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function lockMinutesFor(stage: number) { return LOCK_MINUTES[Math.min(stage, LOCK_MINUTES.length) - 1]; }

// ─── 매장 격리용 Supabase Auth 신분증(세션) 발급 ───
// PIN 검증을 통과한 직원에게 store_id 도장이 박힌 Supabase 세션을 발급한다.
// app_metadata 는 JWT에 실리고 사용자가 못 고치므로 위조 불가 = 안전.
async function mintStoreSession(admin: any, employeeId: string, storeId: string) {
  const email = `emp.${employeeId}@pongdang.local`;
  const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! + ":" + employeeId;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const password = "Pd1!" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { store_id: storeId },
    user_metadata: { employee_id: employeeId },
  });
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signed, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !signed?.session) throw se || new Error("세션 발급 실패");
  return { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token };
}

// 직원 1명의 안전한 본인 정보 조립 (비민감 + 본인 민감, PIN 제외)
function assembleEmp(emp: any, priv: any) {
  const safe: any = {};
  for (const k of Object.keys(emp)) if (!SENSITIVE.includes(k)) safe[k] = emp[k];
  const m = priv || {};
  safe.id_number = m.id_number ?? null;
  safe.bank_name = m.bank_name ?? null;
  safe.account_number = m.account_number ?? null;
  safe.phone = m.phone ?? null;
  safe.address = m.address ?? null;
  safe.birth_date = m.birth_date ?? null;
  return safe;
}

// 로그인 성공 시 공통 처리: 세션토큰 + (매장모드면)매장 신분증 + 매장 목록 조립
async function buildLoginResult(admin: any, person: any, emps: any[]) {
  // 로그인 증표(세션 토큰) 90일
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // 개인 모드 — 매장에 연결된 직원이 하나도 없음
  if (!emps || emps.length === 0) {
    await admin.from("emp_sessions").insert({ token, person_id: person.id, expires_at: expires });
    return {
      ok: true, mode: "personal",
      person: { id: person.id, name: person.name, phone: person.phone },
      token, stores: [],
    };
  }

  // 매장 모드 — 기본 매장 = 첫 번째(활성). 투잡이면 stores 목록 함께 반환.
  const primary = emps[0];
  await admin.from("emp_sessions").insert({
    token, person_id: person.id, employee_id: primary.id, store_id: primary.store_id, expires_at: expires,
  });

  // 본인 민감정보(금고) 조회
  const ids = emps.map((e) => e.id);
  const { data: privs } = await admin.from("employee_private")
    .select("employee_id, id_number, bank_name, account_number, phone, address, birth_date").in("employee_id", ids);
  const privMap = new Map((privs || []).map((p: any) => [p.employee_id, p]));

  // 매장 이름 조회 (투잡 전환 UI용)
  const storeIds = [...new Set(emps.map((e) => e.store_id))];
  const { data: stores } = await admin.from("stores").select("id, name").in("id", storeIds);
  const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));

  let session = null;
  try { session = await mintStoreSession(admin, primary.id, primary.store_id); } catch (_se) { /* 신분증 실패 무시 */ }

  const emp = assembleEmp(primary, privMap.get(primary.id));
  const storeList = emps.map((e) => ({
    employee_id: e.id, store_id: e.store_id,
    store_name: storeMap.get(e.store_id) || "매장",
    auth_level: e.auth_level, is_manager: e.is_manager,
  }));

  return { ok: true, mode: "store", emp, person: { id: person.id, name: person.name, phone: person.phone }, token, session, stores: storeList };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST만 허용" }, 405);

  try {
    const body = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ 옛 방식 하위호환: {store_id, name, pin} ═══
    if (body.store_id && body.name && !body.phone) {
      const { store_id, name, pin } = body;
      if (!pin) return json({ ok: false, error: "필수 정보 누락" }, 400);
      const { data: emps } = await admin.from("employees").select("*")
        .eq("store_id", store_id).eq("name", name).eq("is_active", true);
      if (!emps || emps.length === 0) return json({ ok: false, error: "등록되지 않은 직원입니다" });
      const ids = emps.map((e: any) => e.id);
      const { data: privs } = await admin.from("employee_private")
        .select("employee_id, pin, id_number, bank_name, account_number, phone, address, birth_date").in("employee_id", ids);
      const privMap = new Map((privs || []).map((p: any) => [p.employee_id, p]));
      const matched = emps.find((e: any) => (privMap.get(e.id) as any)?.pin === String(pin));
      if (!matched) return json({ ok: false, error: "PIN이 일치하지 않습니다" });
      const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("emp_sessions").insert({ token, employee_id: matched.id, store_id, person_id: matched.person_id, expires_at: expires });
      let session = null;
      try { session = await mintStoreSession(admin, matched.id, store_id); } catch (_se) { /* 무시 */ }
      return json({ ok: true, mode: "store", emp: assembleEmp(matched, privMap.get(matched.id)), token, session });
    }

    // ═══ 새 방식: {phone, pin} ═══
    const ph = normPhone(body.phone);
    const pin = String(body.pin || "");
    if (!ph || !pin) return json({ ok: false, error: "전화번호와 PIN을 입력해주세요" }, 400);

    // 1) 사람(person) 찾기 — 무차별 대입 방어 위해 "전화번호 또는 PIN" 모호 메시지
    const { data: person } = await admin.from("persons").select("*").eq("phone", ph).maybeSingle();
    if (!person) return json({ ok: false, error: "전화번호 또는 PIN이 일치하지 않습니다" });

    // 2) 잠금 확인
    if (person.pin_lock_until && new Date(person.pin_lock_until) > new Date()) {
      const sec = Math.ceil((new Date(person.pin_lock_until).getTime() - Date.now()) / 1000);
      const min = Math.floor(sec / 60), s = sec % 60;
      const left = min > 0 ? `${min}분 ${s}초` : `${s}초`;
      return json({ ok: false, locked: true, error: `PIN을 여러 번 틀렸어요. ${left} 후 다시 시도해주세요.` });
    }

    // 3) 기대 PIN — persons.pin 우선, 없으면 레거시(employee_private.pin) 대체
    const { data: empsAll } = await admin.from("employees").select("*").eq("person_id", person.id).eq("is_active", true);
    let expectedPin: string | null = person.pin ? String(person.pin) : null;
    if (!expectedPin && empsAll && empsAll.length) {
      const ids = empsAll.map((e: any) => e.id);
      const { data: pr } = await admin.from("employee_private").select("pin").in("employee_id", ids).not("pin", "is", null).limit(1);
      if (pr && pr.length) expectedPin = String(pr[0].pin);
    }

    // 4) PIN 비교 — 옛 평문 + 새 암호화 둘 다 인정 (무잠금 전환)
    const pinHashed = await hashPin(pin);
    const matchedPlain = !!expectedPin && expectedPin === pin;       // 옛 평문 PIN (업그레이드 대상)
    const match = matchedPlain || (!!expectedPin && expectedPin === pinHashed);
    if (!match) {
      // 실패 누적 → 5회 도달 시 점진적 잠금
      const fail = (person.pin_fail_count || 0) + 1;
      if (fail >= MAX_TRIES) {
        const stage = (person.pin_lock_stage || 0) + 1;
        const lockUntil = new Date(Date.now() + lockMinutesFor(stage) * 60 * 1000).toISOString();
        await admin.from("persons").update({ pin_fail_count: 0, pin_lock_stage: stage, pin_lock_until: lockUntil }).eq("id", person.id);
        return json({ ok: false, locked: true, error: `PIN을 ${MAX_TRIES}회 틀려서 ${lockMinutesFor(stage)}분간 잠겼어요.` });
      }
      await admin.from("persons").update({ pin_fail_count: fail }).eq("id", person.id);
      return json({ ok: false, error: `전화번호 또는 PIN이 일치하지 않습니다 (남은 시도 ${MAX_TRIES - fail}회)` });
    }

    // 5) 성공 — 잠금 카운터 리셋 + 옛 평문 PIN이면 암호화로 자동 업그레이드 (한 번 로그인하면 평문 사라짐)
    const _resetPatch: any = {};
    if (person.pin_fail_count || person.pin_lock_stage || person.pin_lock_until) {
      _resetPatch.pin_fail_count = 0; _resetPatch.pin_lock_stage = 0; _resetPatch.pin_lock_until = null;
    }
    if (matchedPlain) _resetPatch.pin = pinHashed; // 평문 → 암호화 업그레이드
    if (Object.keys(_resetPatch).length) {
      await admin.from("persons").update(_resetPatch).eq("id", person.id);
    }

    // 5.5) 기기 신뢰 확인 — 처음 보는 기기면 문자 인증(OTP) 요구 (토스식, 2026-06-30)
    //  - 기존 직원(신뢰 기기 0개) = 첫 로그인 기기 자동 신뢰(grandfather) → 아무도 안 잠김
    //  - 신뢰된 기기 = 조용히 통과 / 새 기기 + 유효한 문자증표(otp_token) = 신뢰 등록 후 통과
    //  - 새 기기 + 증표 없음 = need_otp 반환 (프론트가 문자 인증 진행 후 재호출)
    const deviceId = String(body.device_id || "").slice(0, 200);
    if (deviceId) {
      const { data: dev } = await admin.from("trusted_devices")
        .select("id").eq("person_id", person.id).eq("device_id", deviceId).maybeSingle();
      if (dev) {
        await admin.from("trusted_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", dev.id);
      } else {
        const { count } = await admin.from("trusted_devices")
          .select("id", { count: "exact", head: true }).eq("person_id", person.id);
        let trust = (count || 0) === 0; // 신뢰 기기 0개 = 기존 직원 → 첫 기기 자동 신뢰
        if (!trust && body.otp_token) {
          // 문자 인증 증표 검증 (verify-otp가 발급한 것, 본인·미만료)
          const { data: tok } = await admin.from("signup_tokens").select("person_id, expires_at").eq("token", body.otp_token).maybeSingle();
          if (tok && tok.person_id === person.id && new Date(tok.expires_at) >= new Date()) trust = true;
        }
        if (!trust) return json({ ok: false, need_otp: true, error: "처음 보는 기기예요. 문자 인증이 필요해요." });
        await admin.from("trusted_devices").insert({ person_id: person.id, device_id: deviceId });
      }
    }

    // 6) 결과 조립 (개인/매장/투잡)
    const result = await buildLoginResult(admin, person, empsAll || []);
    return json(result);
  } catch (_e) {
    return json({ ok: false, error: "서버 오류" }, 500);
  }
});
