// upsolution-crawler v5 - 매장별 자동 로그인 + 매출 수집
// Cloudflare Workers 환경변수:
//   CRAWLER_SECRET  - API 인증 시크릿
//   SUPABASE_URL    - Supabase URL
//   SUPABASE_KEY    - Supabase anon key (service_role 권장)

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
    if (env.CRAWLER_SECRET && auth !== `Bearer ${env.CRAWLER_SECRET}`) {
      return resp({ error: '인증 실패' }, 401);
    }

    try {
      if (path === '/') {
        return resp({ status: 'ok', version: '5.0', mode: 'store-based-auto-login' });
      }

      if (path === '/test-login') {
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);
        const creds = await getStoreCredentials(env, storeId);
        if (!creds) return resp({ error: '매장 설정에 업솔루션 ID/PW가 없습니다. 앱 설정에서 입력하세요.' }, 400);
        const cookie = await loginUpsolution(creds.id, creds.pw);
        if (!cookie) return resp({ error: '로그인 실패 - ID/PW를 확인하세요' }, 401);
        return resp({ success: true, message: '로그인 성공' });
      }

      if (path === '/crawl/daily') {
        const date = url.searchParams.get('date') || todayKST();
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);
        const creds = await getStoreCredentials(env, storeId);
        if (!creds) return resp({ error: '업솔루션 ID/PW 미설정' }, 400);
        const cookie = await loginUpsolution(creds.id, creds.pw);
        if (!cookie) return resp({ error: '업솔루션 로그인 실패' }, 401);
        const result = await fetchSales(cookie, date);
        if (result.error) return resp(result, 500);
        if (result.total > 0) await upsertSales(env, storeId, date, result);
        return resp({ success: true, date, ...result });
      }

      if (path === '/crawl/monthly') {
        const ym = url.searchParams.get('year_month') || todayKST().slice(0, 7);
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);
        const creds = await getStoreCredentials(env, storeId);
        if (!creds) return resp({ error: '업솔루션 ID/PW 미설정' }, 400);
        const cookie = await loginUpsolution(creds.id, creds.pw);
        if (!cookie) return resp({ error: '업솔루션 로그인 실패' }, 401);
        const [y, m] = ym.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const saved = [];
        for (let d = 1; d <= lastDay; d++) {
          const dateStr = `${ym}-${String(d).padStart(2, '0')}`;
          const result = await fetchSales(cookie, dateStr);
          if (!result.error && result.total > 0) {
            await upsertSales(env, storeId, dateStr, result);
            saved.push({ date: dateStr, total: result.total });
          }
          await sleep(300);
        }
        return resp({ success: true, year_month: ym, saved_days: saved.length, detail: saved });
      }

      return resp({ error: '잘못된 경로' }, 404);
    } catch (e) {
      return resp({ error: e.message }, 500);
    }
  },

  // 매일 자동 수집 (Cron Trigger)
  async scheduled(event, env, ctx) {
    const stores = await getAllStoresWithCredentials(env);
    const date = todayKST();
    for (const s of stores) {
      try {
        const cookie = await loginUpsolution(s.ups_id, s.ups_pw);
        if (!cookie) continue;
        const result = await fetchSales(cookie, date);
        if (result.total > 0) await upsertSales(env, s.store_id, date, result);
      } catch (e) { console.error(s.store_id, e.message); }
    }
  },
};

// ── Supabase에서 매장별 ID/PW 조회 ──
async function getStoreCredentials(env, storeId) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/store_settings?store_id=eq.${storeId}&select=ups_id,ups_pw`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } }
  );
  const data = await res.json();
  if (!data?.[0]?.ups_id || !data?.[0]?.ups_pw) return null;
  return { id: data[0].ups_id, pw: data[0].ups_pw };
}

async function getAllStoresWithCredentials(env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/store_settings?ups_id=not.is.null&ups_pw=not.is.null&select=store_id,ups_id,ups_pw`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } }
  );
  return await res.json() || [];
}

// ── 업솔루션 자동 로그인 ──
async function loginUpsolution(id, pw) {
  if (!id || !pw) return null;
  try {
    const res = await fetch(`${BASE}/Account/Login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: `${BASE}/Account/Login`,
      },
      body: `UserId=${encodeURIComponent(id)}&Password=${encodeURIComponent(pw)}&RememberMe=true`,
      redirect: 'manual',
    });
    const rawCookies = res.headers.get('Set-Cookie') || '';
    let cookieStr = rawCookies.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    if (cookieStr && (cookieStr.includes('.ASPX') || cookieStr.includes('ASP.NET') || res.status === 302)) {
      return cookieStr;
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location');
      if (loc && !loc.includes('Login')) return cookieStr || 'session';
    }
    return null;
  } catch (e) { return null; }
}

// ── 매출 데이터 수집 ──
async function fetchSales(cookie, date) {
  const dc = date.replace(/-/g, '');
  const endpoints = [
    { url: `${BASE}/Report/GetDailySalesList`, body: `sDate=${dc}&eDate=${dc}` },
    { url: `${BASE}/Sales/GetDailySalesList`, body: `sDate=${dc}&eDate=${dc}` },
    { url: `${BASE}/Home/GetDailySales`, body: `sDate=${dc}&eDate=${dc}` },
    { url: `${BASE}/Report/DailySales`, body: `sDate=${dc}&eDate=${dc}&searchType=day` },
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: BASE, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        body: ep.body,
      });
      if (res.url?.includes('/Account/Login')) return { error: '세션 만료' };
      const text = await res.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html') || !text || text.length < 3) continue;
      try {
        const json = JSON.parse(text);
        return parseSalesJson(json, date);
      } catch {
        const nums = text.match(/\d{5,}/g);
        if (nums?.length) return { date, total: Math.max(...nums.map(Number)), card: 0, cash: 0 };
      }
    } catch { continue; }
  }
  return { date, total: 0, card: 0, cash: 0, note: '데이터 없음' };
}

function parseSalesJson(json, date) {
  if (Array.isArray(json)) {
    const s = json.reduce((a, r) => ({ total: a.total + (r.totalSales || r.TotalSales || r.total || 0), card: a.card + (r.cardSales || r.CardSales || r.card || 0), cash: a.cash + (r.cashSales || r.CashSales || r.cash || 0) }), { total: 0, card: 0, cash: 0 });
    return { date, ...s };
  }
  if (json.data && Array.isArray(json.data)) return parseSalesJson(json.data, date);
  return { date, total: json.totalSales || json.TotalSales || json.total || 0, card: json.cardSales || json.CardSales || json.card || 0, cash: json.cashSales || json.CashSales || json.cash || 0 };
}

async function upsertSales(env, storeId, date, data) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/daily_sales`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ store_id: storeId, sale_date: date, total_sales: data.total || 0, card_sales: data.card || 0, cash_sales: data.cash || 0, source: 'upsolution', updated_at: new Date().toISOString() }),
  });
}

const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().split('T')[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resp = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: CORS });
