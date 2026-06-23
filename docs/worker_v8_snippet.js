// ════════════════════════════════════════════════════════════════
// gemini-proxy Worker v8 (2026-06-23) — Vertex AI 전환
// ════════════════════════════════════════════════════════════════
// Gemini를 AI Studio(generativelanguage) 대신 Vertex AI로 호출.
//  · 지역 고정(us-central1) → "User location is not supported" 지역 차단 해결
//  · Vertex 높은 할당량 → 과부하(503) 대폭 감소
// 인증: 서비스 계정 JSON(env.GCP_SA_JSON) → RS256 JWT → OAuth access_token (1h 캐시)
// gpt provider는 기존대로 OpenAI 직접 호출(백업).
//
// 클라이언트 body: { contents, generationConfig, _model, _provider }
// 응답: Gemini 형식 ({ candidates, usageMetadata, _modelUsed, _provider, _costWon })
// 환경 변수(secret): GCP_SA_JSON(신규, 서비스계정 JSON 전체), OPENAI_KEY. (GEM_ES_KEY·CLOVA_*는 미사용·보존)
// ════════════════════════════════════════════════════════════════

const PRICING = {
  'gemini-2.5-flash':       { in:  420, out: 3500 },
  'gemini-2.5-flash-lite':  { in:  140, out:  560 },
  'gpt-4o':                 { in: 3500, out:14000 },
  'gpt-4o-mini':            { in:  210, out:  840 },
};
function calcCostWon(model, promptTokens, outputTokens, thinkingTokens){
  const rates = PRICING[model] || PRICING['gemini-2.5-flash-lite'];
  const input = (promptTokens||0) * rates.in / 1000000;
  const output = ((outputTokens||0) + (thinkingTokens||0)) * rates.out / 1000000;
  return Math.round((input + output) * 10000) / 10000;
}

const VERTEX_LOCATION = 'us-central1'; // 미국 중부 — Gemini 전 모델 지원·지역 고정
const GEMINI_CASCADE = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']; // 404면 다음 모델 자동 시도

function gptModelOf(req){ return req === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o'; }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
function jsonHeaders(){ return { 'Content-Type': 'application/json', ...corsHeaders }; }
function jsonError(msg, status){ return new Response(JSON.stringify({ error: { message: msg } }), { status, headers: jsonHeaders() }); }

// ── 서비스계정 JWT → OAuth access_token (isolate 단위 1h 캐시) ──
let _tokenCache = { token: null, exp: 0 };
function b64urlBytes(bytes){ let s=''; for(const b of bytes) s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64urlStr(str){ return b64urlBytes(new TextEncoder().encode(str)); }
function pemToDer(pem){
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'').replace(/\s+/g,'');
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return bytes.buffer;
}
async function getAccessToken(sa){
  const now = Math.floor(Date.now()/1000);
  if(_tokenCache.token && _tokenCache.exp - 60 > now) return _tokenCache.token;
  const header = { alg:'RS256', typ:'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  };
  const signingInput = b64urlStr(JSON.stringify(header)) + '.' + b64urlStr(JSON.stringify(claims));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = signingInput + '.' + b64urlBytes(new Uint8Array(sig));
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.access_token) throw new Error('토큰 발급 실패('+res.status+'): '+JSON.stringify(data).slice(0,300));
  _tokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

export default {
  async fetch(request, env) {
    if(request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if(request.method !== 'POST')   return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    let body;
    try { body = await request.json(); } catch(e){ return jsonError('Invalid JSON', 400); }
    const provider = body._provider || 'gemini';
    try {
      if(provider === 'gpt') return await callGPTVision(body, env, gptModelOf(body._model||''));
      return await callVertexCascade(body, env);
    } catch(e){ return jsonError(e.message || 'Worker error', 500); }
  }
};

// ── Vertex AI Gemini 호출 (모델 카스케이드) ──
async function callVertexCascade(body, env){
  if(!env.GCP_SA_JSON) return jsonError('GCP_SA_JSON 비밀 미설정', 500);
  let sa;
  try { sa = JSON.parse(env.GCP_SA_JSON); } catch(e){ return jsonError('GCP_SA_JSON 파싱 실패', 500); }
  const token = await getAccessToken(sa);
  const project = sa.project_id;
  // Vertex는 contents 각 항목에 role(user/model) 필수 — 앱이 안 보내면 'user' 자동 부여 (AI Studio는 생략 허용, Vertex는 엄격)
  const contents = (body.contents || []).map(c => (c && c.role) ? c : { ...c, role: 'user' });
  let lastText = 'Vertex 호출 실패', lastStatus = 502;
  for(const model of GEMINI_CASCADE){
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${project}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:generateContent`;
    const payload = { contents, generationConfig: { ...(body.generationConfig || {}), maxOutputTokens: 4000, temperature: 0.1 } };
    let res;
    try {
      res = await fetch(url, { method:'POST', headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    } catch(e){ lastText = String(e.message||e); lastStatus = 502; continue; }
    const text = await res.text();
    if(res.ok){
      const data = JSON.parse(text);
      const usage = data.usageMetadata || {};
      data._modelUsed = model + ' (vertex)';
      data._provider = 'gemini';
      data._costWon = calcCostWon(model, usage.promptTokenCount, usage.candidatesTokenCount, usage.thoughtsTokenCount);
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders() });
    }
    lastText = text; lastStatus = res.status;
    if(res.status !== 404) return new Response(text, { status: res.status, headers: jsonHeaders() }); // 404만 다음 모델, 그 외 즉시 반환
  }
  return new Response(JSON.stringify({ error: { message: `Vertex 모델 전부 404: ${String(lastText).slice(0,300)}` } }), { status: lastStatus, headers: jsonHeaders() });
}

// ── OpenAI GPT-4o Vision (백업, 기존과 동일) ──
async function callGPTVision(body, env, model){
  const userContent = [];
  for(const block of (body.contents?.[0]?.parts || [])){
    if(block.text) userContent.push({ type: 'text', text: block.text });
    else if(block.inline_data){
      const mime = block.inline_data.mime_type || 'image/jpeg';
      userContent.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${block.inline_data.data}` } });
    }
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: userContent }], response_format: { type: 'json_object' }, temperature: 0, max_tokens: 4000 }),
  });
  const text = await res.text();
  if(!res.ok) return new Response(JSON.stringify({ error: { message: `OpenAI ${res.status}: ${text.slice(0,500)}` } }), { status: res.status, headers: jsonHeaders() });
  const oai = JSON.parse(text);
  const answer = oai.choices?.[0]?.message?.content || '';
  const u = oai.usage || {};
  const adapted = {
    candidates: [{ content: { parts: [{ text: answer }] } }],
    usageMetadata: { promptTokenCount: u.prompt_tokens||0, candidatesTokenCount: u.completion_tokens||0, totalTokenCount: u.total_tokens||0 },
    _modelUsed: model, _provider: 'gpt', _costWon: calcCostWon(model, u.prompt_tokens, u.completion_tokens, 0),
  };
  return new Response(JSON.stringify(adapted), { status: 200, headers: jsonHeaders() });
}
