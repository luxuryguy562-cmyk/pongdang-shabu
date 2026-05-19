// ════════════════════════════════════════════════════════════════
// gemini-proxy Worker v6 (2026-05-19 (4))
// ════════════════════════════════════════════════════════════════
// AI 단독: Gemini Flash/Lite 메인 + GPT-4o vision fallback. OCR 회로 제거.
//
// 클라이언트 body: { contents, generationConfig, _model, _provider }
//   _provider: 'gemini' (메인) | 'gpt' (fallback)
//   _model: 'gemini-2.5-flash' / 'gemini-2.5-flash-lite' / 'gpt-4o'
//
// 응답: Gemini 형식 통일 (클라이언트 callGemini가 기대)
//   { candidates, usageMetadata, _modelUsed, _provider, _costWon }
//
// 환경 변수: GEM_ES_KEY, OPENAI_KEY 필요. CLOVA_URL·CLOVA_SECRET 사용 안 함.
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

function geminiModelOf(req){
  const allowed = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];
  return allowed.includes(req) ? req : 'gemini-2.5-flash-lite';
}

function gptModelOf(req){
  // fallback 기본 = GPT-4o full vision (mini는 정확도 부족, 6차 시점 mini는 6%였음)
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
      return await callGemini(body, env, geminiModelOf(reqModel));
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

async function callGemini(body, env, model){
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEM_ES_KEY}`;
  const payload = {
    contents: body.contents,
    generationConfig: {
      ...(body.generationConfig || {}),
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 4000,
      temperature: 0.1,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if(!res.ok){
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const data = JSON.parse(text);
  const usage = data.usageMetadata || {};
  const costWon = calcCostWon(
    model,
    usage.promptTokenCount,
    usage.candidatesTokenCount,
    usage.thoughtsTokenCount
  );
  data._modelUsed = model;
  data._provider = 'gemini';
  data._costWon = costWon;
  return new Response(JSON.stringify(data), {
    status: 200,
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

  // 클라이언트(callGemini)가 기대하는 Gemini 형식으로 변환
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
