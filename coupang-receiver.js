// coupang-receiver — 크롬 확장이 쿠팡 주문 JSON 보내는 받는 통로
// 배포: Cloudflare Workers
// 환경변수: COUPANG_SECRET, SUPABASE_URL, SUPABASE_KEY (서비스 롤 키), ANTHROPIC_API_KEY (옵션)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Store-Id',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
};

const resp = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: CORS });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;

    // 인증: Authorization: Bearer <COUPANG_SECRET> + X-Store-Id
    const auth = request.headers.get('Authorization') || '';
    const storeId = request.headers.get('X-Store-Id') || '';
    if (env.COUPANG_SECRET && auth !== `Bearer ${env.COUPANG_SECRET}`) {
      return resp({ error: '인증 실패' }, 401);
    }
    if (!storeId && path !== '/') return resp({ error: 'X-Store-Id 헤더 필요' }, 400);

    try {
      if (path === '/') return resp({ status: 'ok', version: '1.0', service: 'coupang-receiver' });

      if (path === '/coupang/orders' && request.method === 'POST') {
        const body = await request.json();
        if (!Array.isArray(body.orders)) return resp({ error: 'orders 배열 필요' }, 400);

        // 쿠팡 거래처 id 찾기
        const vendorId = await findCoupangVendor(env, storeId);

        // 카테고리 트리 가져와서 AI 분류 (옵션)
        const categories = await fetchCategories(env, storeId);
        const inserted = [];
        const skipped = [];

        for (const o of body.orders) {
          const item = (o.item || '').trim();
          const amount = Math.round(Number(o.amount) || 0);
          const orderId = String(o.external_order_id || o.id || '');
          const date = (o.order_date || todayKST()).slice(0, 10);
          if (!item || !amount || !orderId) { skipped.push({ reason: '필수 누락', o }); continue; }

          // AI 추천 (env.ANTHROPIC_API_KEY 있을 때만)
          let aiCat = null, aiConf = null;
          if (env.ANTHROPIC_API_KEY && categories.length) {
            try { ({ aiCat, aiConf } = await classifyItem(env, item, categories)); } catch {}
          }

          // INSERT (UNIQUE 충돌 = 무시)
          const r = await fetch(`${env.SUPABASE_URL}/rest/v1/coupang_inbox`, {
            method: 'POST',
            headers: {
              apikey: env.SUPABASE_KEY,
              Authorization: `Bearer ${env.SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=ignore-duplicates,return=minimal',
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
              status: 'pending',
            }),
          });
          if (r.ok) inserted.push(orderId);
          else skipped.push({ reason: `db ${r.status}`, orderId });
        }
        return resp({ success: true, inserted: inserted.length, skipped: skipped.length, vendorId });
      }

      return resp({ error: 'not found' }, 404);
    } catch (e) {
      return resp({ error: e.message }, 500);
    }
  },
};

// ── 쿠팡 거래처 id 찾기 (사장님이 박은 vendors row) ──
async function findCoupangVendor(env, storeId) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/vendors?store_id=eq.${storeId}&name=eq.쿠팡&is_active=eq.true&select=id&limit=1`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } }
  );
  const arr = await r.json().catch(() => []);
  return arr[0]?.id || null;
}

// ── 카테고리 트리 조회 (AI 분류용) ──
async function fetchCategories(env, storeId) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/expense_categories?store_id=eq.${storeId}&is_active=eq.true&category_type=eq.expense&select=id,name,parent_id`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } }
  );
  return r.json().catch(() => []);
}

// ── Claude Haiku 4.5 로 상품명 분류 ──
async function classifyItem(env, item, categories) {
  const tree = categories.map(c => `- ${c.id} : ${c.name}${c.parent_id ? '' : ' (대분류)'}`).join('\n');
  const prompt = `사장님 식당의 지출 카테고리 중 다음 쿠팡 상품에 가장 맞는 카테고리 id를 골라줘.

상품명: ${item}

카테고리 목록:
${tree}

JSON으로만 응답: {"id": "<카테고리id>", "confidence": 0.0~1.0}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) return { aiCat: null, aiConf: null };
  const j = await r.json();
  const text = j.content?.[0]?.text || '';
  const m = text.match(/\{[^}]+\}/);
  if (!m) return { aiCat: null, aiConf: null };
  try {
    const o = JSON.parse(m[0]);
    return { aiCat: o.id || null, aiConf: Number(o.confidence) || null };
  } catch { return { aiCat: null, aiConf: null }; }
}

const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().split('T')[0];
