// ════════════════════════════════════════════════════════════════
// gemini-proxy Worker v7 (2026-06-23) — 모델 404 자동 회피(카스케이드)
// ════════════════════════════════════════════════════════════════
// 변경 이유: 구글이 옛 모델(gemini-2.0-flash 등) 종료 / 계정별 모델 접근 변경 시
//   기존 v6은 모델 1개만 부르고 404를 그대로 반환 → 앱이 GPT(낮은 정확도)로만 떨어짐.
// v7: 살아있는 Gemini 모델을 "정확도 높은 순"으로 차례로 시도 → 첫 성공 모델 사용.
//   404(모델 없음/접근불가)면 다음 모델로, 그 외 오류(429·503·400)는 즉시 반환.
//   → 사장님 구글 키가 되는 모델을 자동으로 찾아 Gemini 유지(GPT 백업은 최후).
//
// 클라이언트 body: { contents, generationConfig, _model, _provider }
// 응답: Gemini 형식 ({ candidates, usageMetadata, _modelUsed, _provider, _costWon })
// 환경 변수: GEM_ES_KEY, OPENAI_KEY
// ════════════════════════════════════════════════════════════════

const PRICING = {
  'gemini-2.5-flash':       { in:  420, out: 3500 },
  'gemini-2.5-flash-lite':  { in:  140, out:  560 },
  'gemini-3.5-flash':       { in:  420, out: 3500 },
  'gemini-3-flash':         { in:  420, out: 3500 },
  'gemini-3.1-flash-lite':  { in:  140, out:  560 },
  'gemini-flash-latest':    { in:  420, out: 3500 },
  'gpt-4o':                 { in: 3500, out:14000 },
  'gpt-4o-mini':            { in:  210, out:  840 },
};

function calcCostWon(model, promptTokens, outputTokens, thinkingTokens){
  const rates = PRICING[model] || PRICING['gemini-2.5-flash-lite'];
  const input = (promptTokens||0) * rates.in / 1000000;
  const output = ((outputTokens||0) + (thinkingTokens||0)) * rates.out / 1000000;
  return Math.round((input + output) * 10000) / 10000;
}

// 살아있는 Gemini 모델 — 정확도(영수증 OCR) 높은 순. 구글이 옛 모델 죽여도 다음 걸로 자동 시도.
const GEMINI_CASCADE = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

function geminiModelsToTry(req){
  const list = [];
  if(req) list.push(req);              // 앱이 지정한 모델 먼저
  for(const m of GEMINI_CASCADE) if(!list.includes(m)) list.push(m);
  return list;
}

function gptModelOf(req){
  if(req === 'gpt-4o-mini') return 'gpt-4o-mini';
  return 'gpt-4o';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if(request.method === 'OPTIONS'){
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if(request.method !== 'POST'){
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let body;
    try { body = await request.json(); }
    catch(e){ return jsonError('Invalid JSON', 400); }

    const provider = body._provider || 'gemini';
    const reqModel = body._model || '';

    try {
      if(provider === 'gpt'){
        return await callGPTVision(body, env, gptModelOf(reqModel));
      }
      return await callGeminiCascade(body, env, geminiModelsToTry(reqModel));
    } catch(e){
      return jsonError(e.message || 'Worker error', 500);
    }
  }
};

function jsonError(msg, status){
  return new Response(JSON.stringify({ error: { message: msg } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// 모델 카스케이드: 404면 다음 모델, 그 외 오류는 즉시 반환
async function callGeminiCascade(body, env, models){
  let lastText = '모든 Gemini 모델 호출 실패';
  let lastStatus = 502;
  for(const model of models){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEM_ES_KEY}`;
    const payload = {
      contents: body.contents,
      generationConfig: {
        ...(body.generationConfig || {}),
        maxOutputTokens: 4000,
        temperature: 0.1,
      },
    };
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch(e){
      lastText = String(e.message || e); lastStatus = 502; continue;
    }
    const text = await res.text();
    if(res.ok){
      const data = JSON.parse(text);
      const usage = data.usageMetadata || {};
      data._modelUsed = model;
      data._provider = 'gemini';
      data._costWon = calcCostWon(model, usage.promptTokenCount, usage.candidatesTokenCount, usage.thoughtsTokenCount);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    lastText = text; lastStatus = res.status;
    // 404 = 이 모델 없음/접근불가 → 다음 모델. 그 외(429·503·400 등)는 즉시 반환(재시도 무의미).
    if(res.status !== 404){
      return new Response(text, {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
  // 전부 404
  return new Response(JSON.stringify({ error: { message: `Gemini 모델 전부 404 — 사용 가능한 모델 확인 필요: ${String(lastText).slice(0,300)}` } }), {
    status: lastStatus,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function callGPTVision(body, env, model){
  const userContent = [];
  for(const block of (body.contents?.[0]?.parts || [])){
    if(block.text){
      userContent.push({ type: 'text', text: block.text });
    } else if(block.inline_data){
      const mime = block.inline_data.mime_type || 'image/jpeg';
      const data = block.inline_data.data;
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${data}` }
      });
    }
  }
  const payload = {
    model,
    messages: [{ role: 'user', content: userContent }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 4000,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if(!res.ok){
    return new Response(JSON.stringify({
      error: { message: `OpenAI ${res.status}: ${text.slice(0,500)}` }
    }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const oai = JSON.parse(text);
  const answer = oai.choices?.[0]?.message?.content || '';
  const u = oai.usage || {};
  const costWon = calcCostWon(model, u.prompt_tokens, u.completion_tokens, 0);

  const adapted = {
    candidates: [{ content: { parts: [{ text: answer }] } }],
    usageMetadata: {
      promptTokenCount: u.prompt_tokens || 0,
      candidatesTokenCount: u.completion_tokens || 0,
      totalTokenCount: u.total_tokens || 0,
    },
    _modelUsed: model,
    _provider: 'gpt',
    _costWon: costWon,
  };
  return new Response(JSON.stringify(adapted), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
