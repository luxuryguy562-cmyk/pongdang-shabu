// upsolution-crawler v6 - 정확한 API 기반
// Workers 환경변수: CRAWLER_SECRET, SUPABASE_URL, SUPABASE_KEY

const BASE = 'https://asp.upsolution.co.kr';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;
    const auth = request.headers.get('Authorization') || '';
    if (env.CRAWLER_SECRET && auth !== `Bearer ${env.CRAWLER_SECRET}`) return resp({ error: '인증 실패' }, 401);

    try {
      if (path === '/') return resp({ status: 'ok', version: '6.0', mode: 'auto-login-exact-api' });

      if (path === '/test-login') {
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);
        const creds = await getStoreCredentials(env, storeId);
        if (!creds) return resp({ error: 'Store Code/User ID/Password를 앱 설정에서 입력하세요' }, 400);
        const cookie = await login(creds.id, creds.pw);
        if (!cookie) return resp({ error: '로그인 실패 - ID/PW 확인' }, 401);
        return resp({ success: true, message: '로그인 성공', store_code: creds.storeCode });
      }

      if (path === '/crawl/daily') {
        const date = url.searchParams.get('date') || todayKST();
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);
        const creds = await getStoreCredentials(env, storeId);
        if (!creds) return resp({ error: '계정 미설정' }, 400);
        const cookie = await login(creds.id, creds.pw);
        if (!cookie) return resp({ error: '로그인 실패' }, 401);
        const result = await fetchDailySales(cookie, creds.storeCode, date, date);
        if (result.length > 0) {
          for (const r of result) await upsertSales(env, storeId, r);
        }
        return resp({ success: true, date, days: result.length, data: result });
      }

      if (path === '/crawl/monthly') {
        const ym = url.searchParams.get('year_month') || todayKST().slice(0, 7);
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);
        const creds = await getStoreCredentials(env, storeId);
        if (!creds) return resp({ error: '계정 미설정' }, 400);
        const cookie = await login(creds.id, creds.pw);
        if (!cookie) return resp({ error: '로그인 실패' }, 401);
        const [y, m] = ym.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const frDate = ym.replace('-', '') + '01';
        const toDate = ym.replace('-', '') + String(lastDay).padStart(2, '0');
        const result = await fetchDailySales(cookie, creds.storeCode, frDate, toDate);
        for (const r of result) await upsertSales(env, storeId, r);
        return resp({ success: true, year_month: ym, saved_days: result.length, total: result.reduce((a, r) => a + r.total, 0) });
      }

      return resp({ error: '잘못된 경로' }, 404);
    } catch (e) {
      return resp({ error: e.message }, 500);
    }
  },

  async scheduled(event, env) {
    const stores = await getAllStores(env);
    for (const s of stores) {
      try {
        const cookie = await login(s.ups_id, s.ups_pw);
        if (!cookie) continue;
        const date = todayKST().replace(/-/g, '');
        const result = await fetchDailySales(cookie, s.ups_store_code, date, date);
        for (const r of result) await upsertSales(env, s.store_id, r);
      } catch (e) { console.error(s.store_id, e.message); }
    }
  },
};

// ── Supabase 조회 ──
async function getStoreCredentials(env, storeId) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/store_settings?store_id=eq.${storeId}&select=ups_store_code,ups_id,ups_pw`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } }
  );
  const d = await res.json();
  if (!d?.[0]?.ups_id || !d?.[0]?.ups_pw) return null;
  return { storeCode: d[0].ups_store_code || '', id: d[0].ups_id, pw: d[0].ups_pw };
}

async function getAllStores(env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/store_settings?ups_id=not.is.null&ups_pw=not.is.null&select=store_id,ups_store_code,ups_id,ups_pw`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } }
  );
  return await res.json() || [];
}

// ── 업솔루션 로그인 ──
async function login(id, pw) {
  if (!id || !pw) return null;
  try {
    const res = await fetch(`${BASE}/Account/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', Referer: `${BASE}/Account/Login` },
      body: `UserId=${encodeURIComponent(id)}&Password=${encodeURIComponent(pw)}&RememberMe=true`,
      redirect: 'manual',
    });
    const raw = res.headers.get('Set-Cookie') || '';
    const cookieStr = raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    if (cookieStr && (cookieStr.includes('.ASPX') || cookieStr.includes('ASP.NET') || res.status === 302)) return cookieStr;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location');
      if (loc && !loc.includes('Login')) return cookieStr || 'session';
    }
    return null;
  } catch { return null; }
}

// ── 매출 조회 (정확한 API) ──
async function fetchDailySales(cookie, storeCode, frDate, toDate) {
  // frDate, toDate: YYYYMMDD 또는 YYYY-MM-DD
  const fr = frDate.replace(/-/g, '');
  const to = toDate.replace(/-/g, '');
  try {
    const res = await fetch(
      `${BASE}/SalesReport/GetDailySalesList?FR_DATE=${fr}&TO_DATE=${to}&STORE_CODE=${encodeURIComponent(storeCode)}&POS_ID=&STORE_GROUP_CODE=`,
      {
        method: 'POST',
        headers: { Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded', Referer: BASE, 'User-Agent': 'Mozilla/5.0' },
      }
    );
    if (res.url?.includes('/Account/Login')) return [];
    const json = await res.json();
    const rows = json.rows || json.data || (Array.isArray(json) ? json : []);
    return rows.map(r => {
      const hd = String(r.HDATE || '');
      const date = hd.length === 8 ? `${hd.slice(0,4)}-${hd.slice(4,6)}-${hd.slice(6,8)}` : hd;
      return {
        date,
        total: r.TAMT || r.PAYAMT || 0,
        card: r.CARDAMT || 0,
        cash: r.CASHAMT || 0,
        cash_receipt: r.CASHAMT_T || 0,
        other: r.OTHER || 0,
        receipt_count: r.CNT || 0,
        customer_count: r.PERSON || 0,
        tax: r.TAX || 0,
        supply_amount: r.RAMT || 0,
        sales_amount: r.SALES_AMOUNT || 0,
      };
    }).filter(r => r.total > 0);
  } catch (e) {
    console.error('fetchDailySales error:', e.message);
    return [];
  }
}

// ── Supabase 저장 ──
async function upsertSales(env, storeId, data) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/daily_sales`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      store_id: storeId,
      sale_date: data.date,
      total_sales: Math.round(data.total),
      card_sales: Math.round(data.card),
      cash_sales: Math.round(data.cash),
      source: 'upsolution',
      updated_at: new Date().toISOString(),
    }),
  });
}

const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().split('T')[0];
const resp = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: CORS });
