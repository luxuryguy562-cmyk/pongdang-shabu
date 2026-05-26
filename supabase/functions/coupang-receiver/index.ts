// Supabase Edge Function: coupang-receiver
// 북마클릿이 보내는 쿠팡 주문 JSON을 받아 coupang_inbox 표에 박음
// 인증: Authorization: Bearer <COUPANG_SECRET>
// 환경변수 (Supabase secrets): COUPANG_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY(옵션)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Store-Id, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
};

const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: CORS });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const COUPANG_SECRET = Deno.env.get("COUPANG_SECRET") || "";
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

  // 인증
  const auth = req.headers.get("Authorization") || "";
  if (!COUPANG_SECRET || auth !== `Bearer ${COUPANG_SECRET}`) {
    return resp({ error: "인증 실패" }, 401);
  }
  const storeId = req.headers.get("X-Store-Id") || "";
  if (!storeId) return resp({ error: "X-Store-Id 필요" }, 400);

  const url = new URL(req.url);
  if (url.pathname.endsWith("/health")) return resp({ ok: true, version: "1.0" });

  if (req.method !== "POST") return resp({ error: "POST만 허용" }, 405);

  try {
    const body = await req.json();
    if (!Array.isArray(body.orders)) return resp({ error: "orders 배열 필요" }, 400);

    const vendorId = await findCoupangVendor(SUPABASE_URL, SERVICE_KEY, storeId);
    const categories = await fetchCategories(SUPABASE_URL, SERVICE_KEY, storeId);

    let inserted = 0, skipped = 0, errors = 0;
    for (const o of body.orders) {
      const item = String(o.item || "").trim();
      const amount = Math.round(Number(o.amount) || 0);
      const orderId = String(o.external_order_id || o.id || "");
      const date = String(o.order_date || todayKST()).slice(0, 10);
      if (!item || !amount || !orderId) { skipped++; continue; }

      let aiCat: string | null = null, aiConf: number | null = null;
      if (ANTHROPIC_API_KEY && categories.length) {
        try {
          const r = await classifyItem(ANTHROPIC_API_KEY, item, categories);
          aiCat = r.aiCat; aiConf = r.aiConf;
        } catch { /* AI 실패는 무시 */ }
      }

      const r = await fetch(`${SUPABASE_URL}/rest/v1/coupang_inbox`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          store_id: storeId,
          vendor_id: vendorId,
          external_order_id: orderId,
          order_date: date,
          item,
          amount,
          unit_price: o.unit_price || null,
          quantity: o.quantity || null,
          raw_json: o.raw || null,
          ai_suggested_category_id: aiCat,
          ai_confidence: aiConf,
          status: "pending",
        }),
      });
      if (r.ok) inserted++; else errors++;
    }
    return resp({ success: true, inserted, skipped, errors, vendorId });
  } catch (e) {
    return resp({ error: (e as Error).message }, 500);
  }
});

async function findCoupangVendor(url: string, key: string, storeId: string) {
  const r = await fetch(
    `${url}/rest/v1/vendors?store_id=eq.${storeId}&name=eq.쿠팡&is_active=eq.true&select=id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const arr = await r.json().catch(() => []);
  return arr[0]?.id || null;
}

async function fetchCategories(url: string, key: string, storeId: string) {
  const r = await fetch(
    `${url}/rest/v1/expense_categories?store_id=eq.${storeId}&is_active=eq.true&category_type=eq.expense&select=id,name,parent_id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  return r.json().catch(() => []);
}

async function classifyItem(apiKey: string, item: string, categories: any[]) {
  const tree = categories.map(c => `- ${c.id} : ${c.name}${c.parent_id ? "" : " (대분류)"}`).join("\n");
  const prompt = `사장님 식당 지출 카테고리 중 다음 쿠팡 상품에 가장 맞는 카테고리 id 골라줘.

상품명: ${item}

카테고리:
${tree}

JSON만: {"id": "<id>", "confidence": 0~1}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) return { aiCat: null, aiConf: null };
  const j = await r.json();
  const text = j.content?.[0]?.text || "";
  const m = text.match(/\{[^}]+\}/);
  if (!m) return { aiCat: null, aiConf: null };
  try {
    const o = JSON.parse(m[0]);
    return { aiCat: o.id || null, aiConf: Number(o.confidence) || null };
  } catch { return { aiCat: null, aiConf: null }; }
}

const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().split("T")[0];
