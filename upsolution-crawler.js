// upsolution-crawler v4 - 자동 로그인 + 매출 수집
// Cloudflare Workers 환경변수:
//   CRAWLER_SECRET  - API 인증 시크릿
//   UPS_ID          - 업솔루션 로그인 ID
//   UPS_PW          - 업솔루션 로그인 PW
//   SUPABASE_URL    - Supabase URL
//   SUPABASE_KEY    - Supabase anon key

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

    // 인증
    const auth = request.headers.get('Authorization') || '';
    if (env.CRAWLER_SECRET && auth !== `Bearer ${env.CRAWLER_SECRET}`) {
      return resp({ error: '인증 실패' }, 401);
    }

    try {
      if (path === '/') {
        return resp({
          status: 'ok',
          version: '4.0',
          mode: 'auto-login',
          endpoints: ['/crawl/daily?date=YYYY-MM-DD&store_id=UUID', '/crawl/monthly?year_month=YYYY-MM&store_id=UUID', '/test-login'],
          has_credentials: !!(env.UPS_ID && env.UPS_PW),
        });
      }

      // 로그인 테스트
      if (path === '/test-login') {
        if (!env.UPS_ID || !env.UPS_PW) return resp({ error: 'UPS_ID, UPS_PW 환경변수가 설정되지 않았습니다' }, 400);
        const cookie = await loginUpsolution(env.UPS_ID, env.UPS_PW);
        if (!cookie) return resp({ error: '로그인 실패 - ID/PW를 확인하세요' }, 401);
        return resp({ success: true, message: '로그인 성공', cookie_length: cookie.length });
      }

      // 일별 수집
      if (path === '/crawl/daily') {
        const date = url.searchParams.get('date') || todayKST();
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);

        const cookie = await loginUpsolution(env.UPS_ID, env.UPS_PW);
        if (!cookie) return resp({ error: '업솔루션 로그인 실패' }, 401);

        const result = await fetchSales(cookie, date);
        if (result.error) return resp(result, 500);

        if (result.total > 0) {
          await upsertSales(env, storeId, date, result);
        }
        return resp({ success: true, date, ...result });
      }

      // 월별 수집
      if (path === '/crawl/monthly') {
        const ym = url.searchParams.get('year_month') || todayKST().slice(0, 7);
        const storeId = url.searchParams.get('store_id');
        if (!storeId) return resp({ error: 'store_id 필요' }, 400);

        const cookie = await loginUpsolution(env.UPS_ID, env.UPS_PW);
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
      return resp({ error: e.message, stack: e.stack?.slice(0, 200) }, 500);
    }
  },

  // 매일 자동 수집 (Cron Trigger - 매일 23:30 KST)
  async scheduled(event, env, ctx) {
    if (!env.UPS_ID || !env.UPS_PW || !env.DEFAULT_STORE_ID) return;
    const cookie = await loginUpsolution(env.UPS_ID, env.UPS_PW);
    if (!cookie) return;
    const date = todayKST();
    const result = await fetchSales(cookie, date);
    if (result.total > 0) {
      await upsertSales(env, env.DEFAULT_STORE_ID, date, result);
    }
  },
};

// ── 업솔루션 자동 로그인 ──
async function loginUpsolution(id, pw) {
  if (!id || !pw) return null;
  try {
    const res = await fetch(`${BASE}/Account/Login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `${BASE}/Account/Login`,
      },
      body: `UserId=${encodeURIComponent(id)}&Password=${encodeURIComponent(pw)}&RememberMe=true`,
      redirect: 'manual', // 리다이렉트 따라가지 않음
    });

    // 로그인 성공 시 Set-Cookie 헤더에서 쿠키 추출
    const cookies = res.headers.getAll?.('Set-Cookie') || [];
    // Cloudflare Workers에서는 getAll이 없을 수 있음
    const rawCookies = res.headers.get('Set-Cookie') || '';

    // 여러 쿠키를 하나의 문자열로 합침
    let cookieStr = '';
    if (cookies.length > 0) {
      cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
    } else if (rawCookies) {
      cookieStr = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    // 로그인 성공 확인: 리다이렉트(302) 또는 쿠키에 .ASPXAUTH 포함
    if (cookieStr && (cookieStr.includes('.ASPX') || cookieStr.includes('ASP.NET') || res.status === 302 || res.status === 301)) {
      return cookieStr;
    }

    // 다른 방식 시도: GET으로 리다이렉트된 페이지 확인
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location');
      if (location && !location.includes('Login')) {
        return cookieStr || 'session-active';
      }
    }

    return null;
  } catch (e) {
    console.error('로그인 에러:', e.message);
    return null;
  }
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
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: BASE,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: ep.body,
      });

      // 세션 만료 체크
      if (res.url && res.url.includes('/Account/Login')) {
        return { error: '세션 만료' };
      }

      const text = await res.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html')) continue;
      if (!text || text.length < 3) continue;

      try {
        const json = JSON.parse(text);
        return parseSalesJson(json, date);
      } catch {
        const nums = text.match(/\d{5,}/g);
        if (nums && nums.length > 0) {
          return { date, total: Math.max(...nums.map(Number)), card: 0, cash: 0 };
        }
      }
    } catch {
      continue;
    }
  }
  return { date, total: 0, card: 0, cash: 0, note: '데이터 없음' };
}

function parseSalesJson(json, date) {
  if (Array.isArray(json)) {
    const sum = json.reduce((a, r) => {
      a.total += r.totalSales || r.TotalSales || r.total || r.Total || 0;
      a.card += r.cardSales || r.CardSales || r.card || r.Card || 0;
      a.cash += r.cashSales || r.CashSales || r.cash || r.Cash || 0;
      return a;
    }, { total: 0, card: 0, cash: 0 });
    return { date, ...sum };
  }
  if (json.data && Array.isArray(json.data)) return parseSalesJson(json.data, date);
  return {
    date,
    total: json.totalSales || json.TotalSales || json.total || json.Total || 0,
    card: json.cardSales || json.CardSales || json.card || json.Card || 0,
    cash: json.cashSales || json.CashSales || json.cash || json.Cash || 0,
  };
}

// ── Supabase 저장 ──
async function upsertSales(env, storeId, date, data) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/daily_sales`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      store_id: storeId,
      sale_date: date,
      total_sales: data.total || 0,
      card_sales: data.card || 0,
      cash_sales: data.cash || 0,
      source: 'upsolution',
      updated_at: new Date().toISOString(),
    }),
  });
}

function todayKST() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().split('T')[0];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resp = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: CORS });
