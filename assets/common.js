// ══════════════════════════════════════════
// 설정
// ══════════════════════════════════════════
const SUPABASE_URL      = 'https://ruytgygjwnbtzmtofopg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7QoW2WkSQE4WA4w7uFughA_GXQMkMUe';
const GEMINI_URL        = 'https://gemini-proxy.luxuryguy562.workers.dev';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Gemini AI 호출 헬퍼 (타임아웃 + 과부하 자동 재시도 + 토큰·비용 로깅) ───
// 2026-05-18: high demand 에러 자주 발생 → 지수 백오프 재시도 (1s/2s/4s, 최대 3회)
// 2026-05-19: usageMetadata 추출 + ai_usage_logs DB 저장 + window.lastAIUsage 글로벌 박음
//             → 토스트로 토큰·비용 즉시 표시 + 관리자 대시보드 데이터 누적
let lastAIUsage = null; // 최근 AI 호출 토큰·비용 (토스트용)
// Gemini 모델별 가격 (환율 1400원/$ 기준, 2026-05 공식 가격)
// 2026-05-19 사장님 결정 B안: 동적 모델 — 거래처(복잡) = flash, 직구(단순) = flash-lite
// 2026-05-19 (2): Multi-Provider 도입 — Clova+GPT-4o / GPT-mini / Gemini 3중 경로 (Worker가 분기)
// 2026-05-19 (3): 거래명세서 정확도 = GPT-4o full + 이미지 Hybrid (사장님 핵심 무기)
// 2026-05-19 (4): OCR 제거 — Clova+GPT 행 시프트 사고 (4차 6%, 6차 62.5%).
//                 사장님 가설 채택 + 데이터 검증됨: AI 단독(1·2·3차) 80~95% > OCR+AI Hybrid 6~62.5%
//                 Gemini Flash/Lite 단독 (3차 best ~95%+) + High demand 시 GPT-4o vision fallback
const _DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const _GEMINI_PRICING = {
  'gemini-2.5-flash':       { in:  420, out: 3500 },
  'gemini-2.5-flash-lite':  { in:  140, out:  560 },
  'gemini-2.0-flash':       { in:  140, out:  560 },
  'gemini-2.0-flash-lite':  { in:  105, out:  420 },
  'gemini-1.5-flash':       { in:  105, out:  420 },
  'gemini-1.5-flash-8b':    { in:  52.5,out:  210 },
  'gpt-4o-mini':            { in:  210, out:  840 },
  'gpt-4o':                 { in: 3500, out:14000 },
};
function _calcGeminiCostWon(promptTokens, outputTokens, thinkingTokens, model){
  const rates = _GEMINI_PRICING[model] || _GEMINI_PRICING[_DEFAULT_GEMINI_MODEL] || _GEMINI_PRICING['gemini-2.5-flash-lite'];
  const input = (promptTokens||0) * rates.in / 1000000;
  const output = ((outputTokens||0) + (thinkingTokens||0)) * rates.out / 1000000;
  return Math.round((input + output) * 10000) / 10000;
}
// 모델 이름 짧게 (토스트용)
function _shortModelName(model){
  if(!model) return '?';
  if(model.startsWith('clova+gpt-4o')) return 'Clova+GPT-4o';
  if(model.startsWith('clova+gpt')) return 'Clova+GPT';
  if(model === 'gpt-4o') return 'GPT-4o';
  if(model.startsWith('gpt-')) return 'GPT-mini';
  if(model.startsWith('gemini-2.5-flash-lite')) return 'Gemini-Lite';
  if(model.startsWith('gemini-2.5-flash')) return 'Gemini-Flash';
  return model.replace('gemini-','');
}
function _logAIUsage(feature, usage, durationMs, success, errorMsg, modelUsed, costWonOverride){
  try{
    if(!currentStore) return;
    const model = modelUsed || _DEFAULT_GEMINI_MODEL;
    // Worker가 _costWon 박아 보내면 그거 우선 (Clova+GPT는 고정 비용 포함이라 정확)
    const cost = (typeof costWonOverride === 'number')
      ? costWonOverride
      : _calcGeminiCostWon(usage?.promptTokenCount, usage?.candidatesTokenCount, usage?.thoughtsTokenCount, model);
    sb.from('ai_usage_logs').insert({
      store_id: currentStore.id,
      feature: feature || 'unknown',
      model,
      prompt_tokens: usage?.promptTokenCount || 0,
      output_tokens: usage?.candidatesTokenCount || 0,
      thinking_tokens: usage?.thoughtsTokenCount || 0,
      total_tokens: usage?.totalTokenCount || 0,
      estimated_cost_won: cost,
      duration_ms: durationMs,
      success: !!success,
      error_msg: errorMsg || null
    }).then(({error})=>{ if(error) console.warn('[ai_usage_logs] insert failed:', error.message); });
  }catch(e){ console.warn('[ai_usage_logs] exception:', e); }
}
async function callGemini(parts, timeoutSec=30, feature='unknown', model, provider){
  // 503(구글 서버 과부하) 스파이크는 보통 10~30초 지속 → 재시도 4번, 백오프 2·4·8초로 강화 (2026-06-08)
  // 짧은 1·2·4초로는 16:34 503이 20초간 다 실패. 총 ~14초 버티며 스파이크 통과 노림. 그래도 실패 시 호출부에서 GPT 백업.
  const MAX_RETRY = 4;
  const BACKOFF_MS = [2000, 4000, 8000];
  let lastErr = null;
  const startedAt = Date.now();
  const requestModel = model || _DEFAULT_GEMINI_MODEL;
  const requestProvider = provider || 'gemini'; // 'clova+gpt' | 'gpt' | 'gemini'
  // Clova+GPT는 응답 시간 길어서 타임아웃 ↑
  const effectiveTimeout = (requestProvider === 'clova+gpt') ? Math.max(timeoutSec, 45) : timeoutSec;
  for(let attempt=0; attempt<MAX_RETRY; attempt++){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(), effectiveTimeout*1000);
    try{
      if(attempt>0) setLoad(true, `AI 다시 시도 중... (${attempt+1}/${MAX_RETRY})`);
      const res=await fetch(GEMINI_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts}],generationConfig:{response_mime_type:'application/json'},_model:requestModel,_provider:requestProvider}),
        signal:ctrl.signal
      });
      if(!res.ok){
        const errText=await res.text().catch(()=>'');
        // 충전금 소진/할당량 초과 = 재시도해도 안 풀림 → 즉시 명확 안내 (무한로딩 방지, 2026-06-05)
        if(/RESOURCE_EXHAUSTED|credit.{0,15}deplet|prepayment credit|insufficient_quota|exceeded your current quota|quota.{0,15}exceed/i.test(errText)){
          _logAIUsage(feature, null, Date.now()-startedAt, false, 'quota_exhausted', requestModel);
          throw new Error('AI 충전금(사용 크레딧)이 떨어졌어요. 결제·충전 후 다시 시도해주세요.');
        }
        // 모델 과부하 감지 (429/503 또는 high demand 텍스트) — 일시적, 재시도 대상
        const isOverload = (res.status===429 || res.status===503 || /high demand|overload|currently experiencing/i.test(errText));
        if(isOverload && attempt < MAX_RETRY-1){
          await new Promise(r=>setTimeout(r, BACKOFF_MS[attempt]));
          continue;
        }
        throw new Error(`서버 오류 (${res.status}): ${errText.slice(0,500)||res.statusText}`);
      }
      const data=await res.json();
      if(data.error){
        const errMsg = data.error.message||'';
        // 충전금 소진/할당량 초과 = 즉시 명확 안내 (재시도 X)
        if(/RESOURCE_EXHAUSTED|credit.{0,15}deplet|prepayment credit|insufficient_quota|exceeded your current quota|quota.{0,15}exceed/i.test(errMsg)){
          _logAIUsage(feature, null, Date.now()-startedAt, false, 'quota_exhausted', requestModel);
          throw new Error('AI 충전금(사용 크레딧)이 떨어졌어요. 결제·충전 후 다시 시도해주세요.');
        }
        const isOverload = /high demand|overload|currently experiencing/i.test(errMsg);
        if(isOverload && attempt < MAX_RETRY-1){
          await new Promise(r=>setTimeout(r, BACKOFF_MS[attempt]));
          continue;
        }
        throw new Error(errMsg||'AI 응답 오류');
      }
      const txt=data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(!txt) throw new Error('AI 응답이 비어있습니다');
      // 토큰·비용 추출 + 글로벌 박음 + DB 저장 (성공 시)
      // Worker가 _modelUsed, _provider, _costWon 박아 보냄 (Clova+GPT 포함 정확한 비용)
      const usage = data?.usageMetadata || {};
      const modelUsed = data?._modelUsed || requestModel;
      const providerUsed = data?._provider || requestProvider;
      const durationMs = Date.now() - startedAt;
      const costWon = (typeof data?._costWon === 'number')
        ? data._costWon
        : _calcGeminiCostWon(usage.promptTokenCount, usage.candidatesTokenCount, usage.thoughtsTokenCount, modelUsed);
      lastAIUsage = {
        feature,
        model: modelUsed,
        provider: providerUsed,
        promptTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
        thinkingTokens: usage.thoughtsTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
        costWon,
        durationMs
      };
      _logAIUsage(feature, usage, durationMs, true, null, modelUsed, costWon);
      return JSON.parse(txt.replace(/```json|```/g,'').trim());
    }catch(e){
      lastErr = e;
      if(e.name==='AbortError'){
        _logAIUsage(feature, null, Date.now()-startedAt, false, 'timeout', requestModel);
        throw new Error(`AI 응답 시간 초과 (${effectiveTimeout}초). 다시 시도해주세요.`);
      }
      // 네트워크 오류 등도 재시도 대상
      if(attempt < MAX_RETRY-1){
        await new Promise(r=>setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }
      _logAIUsage(feature, null, Date.now()-startedAt, false, (e&&e.message)||'unknown', requestModel);
      throw e;
    }finally{clearTimeout(timer);}
  }
  throw lastErr || new Error('AI 호출 실패');
}

// ═══════════════════════════════════════════════════════════════
// 영수증/거래명세서 분석 프롬프트 — 거래채널별 완전 분리 (2026-06-09)
//   사장님 결정: "충돌 안 나게 거래채널마다 프롬프트를 따로 놓자"
//   한 채널 수정해도 다른 채널 프롬프트는 안 건드림 → 동시 작업 충돌·회귀 차단.
//   ┌ buildReceiptPrompt  ← 입구(채널 판정 → 채널 빌더로 분배). 호출 인터페이스 불변.
//   ├ _rcpPromptVendor    ← 거래처(정기 거래명세서) 전용
//   ├ _rcpPromptOnline    ← 온라인(쿠팡·네이버 등 웹 주문) 전용
//   ├ _rcpPromptDirect    ← 직구(마트·시장 영수증) 전용
//   └ _rcpCommonRules / _rcpCommonRespTail  ← 채널 무관 공통(검산·세액별도·함정 등)
//   ⚠️ 영수증 탭(receipt.js)·측정실(accuracy_lab.js) 둘 다 buildReceiptPrompt만 호출 → 검증=실제 동일 보장
// ═══════════════════════════════════════════════════════════════
function buildReceiptPrompt({isVendorMode=true, isOnlineMode=false, vendorName='', catList='', pageCount=1}={}){
  const multiPageHint = pageCount>1
    ? `\n[멀티페이지] 사진 ${pageCount}장 = 같은 영수증의 다른 페이지. 모든 페이지 행을 items에 통합. date·vendor·total_sum은 1번만.`
    : '';
  // 채널 판정: 온라인 > 거래처 > 직구
  if(isOnlineMode) return _rcpPromptOnline({vendorName, catList, multiPageHint});
  if(isVendorMode) return _rcpPromptVendor({vendorName, catList, multiPageHint});
  return _rcpPromptDirect({catList, multiPageHint});
}

// ─── 공통: 응답 JSON 꼬리 필드 (total_supply ~ page_info) — 채널 무관 ───
function _rcpCommonRespTail(){
  return `  "total_supply": 세전 공급가액 소계(정수). 행마다 세액 칸이 별도인 양식만, 아니면 null,
  "total_tax": 세액 소계(정수). 없으면 null,
  "total_sum": 이번 거래 결제합(세후,정수,없으면 null) — 금일합계>합계액>총합계액>결제금액. ⚠️전미수·전잔액·당일입금·현잔액·누계·채권 = 무시(이번 거래분 아님),
  "multi_receipt": 사진 여러 장이 서로 다른 거래처·합계의 독립 영수증이면 true (같은 영수증 연속 페이지 Page N/M면 false). 사진 1장이면 false,
  "needs_review": 품목명을 확실히 못 읽었거나 흐릿·낯선 약어·외국어(한자 음차 등)가 많아 자신 없으면 true (또렷이 읽었으면 false),
  "page_info": {"current":현재페이지,"total":총페이지수} — 영수증에 "Page (N/M)" 인쇄 시. 없으면 {"current":1,"total":1}`;
}

// ─── 공통: 채널 무관 규칙 (검산·소계제외·세액별도·함정·숫자·면세) — 수정 시 3채널 동시 반영(의도) ───
function _rcpCommonRules(){
  return `- [회계 검산] 두 등식이 반드시 맞아야 함: ①단가(u)×수량(q)=공급가(p−t) ②공급가+세액(t)=합계(p). 안 맞으면 u·q·t·p를 다시 읽어라 — 특히 공급가를 단가나 합계 칸에 잘못 넣는 실수 주의.
- 합계행·소계·부가세행·할인전소계·총할인액합계행·외상행·용기보증금 = items에서 제외 (공급가액/세액 소계는 total_supply/total_tax로만)
- [세액 별도 양식] 행에 공급가·세액·합계 칸 따로면: p=합계(세후) 칸, t=세액 칸, total_supply=공급가액 소계, total_tax=세액 소계, total_sum=총합계액(세후). 세액 칸 없으면 t=0 + total_supply·total_tax=null
- [함정] total_sum·total_supply에 전미수·전잔액·당일입금·현잔액·누계·채권 절대 X. "이번 거래분(금일)"만
- 숫자 쉼표·원 제거, 빈배열 X
- 흐릿해도 근접 추정
- 면세(*)/과세 표시는 무시 — p는 인쇄값 그대로`;
}

// 공통: 날짜 필드 힌트
function _rcpDateField(){
  return `"date": "영수증 발행일 YYYY-MM-DD (영수증에 연도가 명확히 안 보이면 ${new Date().getFullYear()}년으로)"`;
}

// ═══ 채널 1: 거래처 (정기 거래처 거래명세서 — spec·og 분리, BOX/EA, 품목별 카테고리) ═══
function _rcpPromptVendor({vendorName, catList, multiPageHint}){
  return `한국 영수증을 JSON으로만 응답. 설명·주석 X.
[모드:거래처] vendor="${vendorName}" 이미 선택. v·d 출력 X. 품목별 c를 [${catList}]에서 선택 — 한 거래처라도 품목마다 분류가 다를 수 있다(예: 육류·공산품 섞임). 영수증 1장 = 같은 날짜 (date 최상위 1번).
[수량 칸 우선] ⚠️표에 "수량" 칸이 따로 있으면 q=그 "수량" 칸 값 그대로. "Box입수량"·"박스입수"·"입수" 칸은 한 박스에 든 개수(메타)일 뿐이니 q에 절대 쓰지 마라.
  · Box입수량5·단위EA·수량2 → q=2 (5 아님)
  · Box입수량10·단위EA·수량2 → q=2
  · Box입수량1·단위BOX·수량3 → q=3
[BOX/EA] 위처럼 별도 "수량" 칸이 없고 BOX·EA 칸만 있으면: q=(BOX×단위)+EA. ⚠️ BOX=0이면 단위 무시, EA가 q.
  · 단위20·BOX1·EA10→q=30
  · 단위8·BOX1·EA0→q=8
  · 단위40·BOX0·EA5→q=5  ← BOX 0
  · 단위12·BOX0·EA5→q=5  ← BOX 0${multiPageHint}

[응답]
{
  ${_rcpDateField()},
  "items": [ {i,spec,og,u,q,p,t,f,c} 행 배열 ],
${_rcpCommonRespTail()}
}

[필드]
- i:품목명만 (규격·꼬리표 → spec·og 분리 — 규칙 참조)
- spec:규격·포장 규격(괄호 안 포함, 예 "F0용 슬라이스 1Kg/EA", "500g"). 없으면 null
- og:원산지(예 "외국산", "국내산", "중국산"). 없으면 null. ⚠️쉼표로 품명에 자연스럽게 섞인 원산지(예 "고기손만두,돈육:국내산")는 i 그대로, og X
- u:단가 (없으면 null)
- q:수량 (없으면 1) — BOX/EA 정확히 적용(수량 칸 없을 때). BOX 0 = EA만. 중량거래(kg·g)면 q=중량값(소수점 허용).
- p:행 [합계/금액] 칸 인쇄값 그대로 정수(세후=실제 낸 돈). 행마다 [공급가·세액·합계] 칸 따로면 [합계] 칸. u×q 계산 X — 1~2원 차이도 인쇄 우선
- t:행 [세액] 칸 값(정수). 세액 칸이 따로 있으면 그 값, 없거나 면세면 0
- f:면세 여부(true/false). t>0이면 false. 면세표시(*)·면세 칸·미가공 농축수산물(육류·생선·야채·과일·쌀)이면 true
- c:카테고리 [${catList}] — 품목 성격대로 행마다. 못 정하면 가장 가까운 것. 빈 값 X

[규칙]
${_rcpCommonRules()}
- i:품목명만. 규격(괄호 포함)→spec, 원산지→og 분리. "박스입수:N"·"입수:N" → 버림(뒤의 "/원산지"·"※주석" 포함). ⚠️쉼표로 품명에 자연스럽게 섞인 원산지(예 "고기손만두,돈육:국내산")는 i 그대로, og X. 예) "이츠웰 유부(F0용 슬라이스 1Kg/EA) 박스입수:8/외국산 ※대두(미국산)" → i:"이츠웰 유부", spec:"F0용 슬라이스 1Kg/EA", og:"외국산". 꼬리표 없으면 그대로. 못 읽으면 보이는 대로, 지어내지 마라.
- p·u·q는 양수만 — 할인 행 제외
- [할인 행] 할인·쿠폰·에누리 라인(예: "500원할인@비엔나", "[카드쿠폰] 시금치")은 items에 별도 행으로. ⚠️인쇄된 마이너스(-) 부호 그대로 — p·u 음수 그대로(예 -500). i=원문, q=인쇄 수량(없으면 1), t=0, f=false, c=바로 위 품목과 동일. "할인전소계"·"총할인액" 요약행은 제외(이중차감 방지).

[예시 — 거래명세서 (BOX/EA + spec/og 분리)]
{"date":"2026-04-09","items":[{"i":"위즈복대-날치알","spec":"500g","og":null,"u":9400,"q":30,"p":282000,"c":"식자재"},{"i":"넙적분모자","spec":"250g","og":null,"u":1100,"q":5,"p":5500,"c":"식자재"},{"i":"이츠웰 유부","spec":"F0용 슬라이스 1Kg/EA","og":"외국산","u":9400,"q":8,"p":75200,"c":"식자재"}],"total_sum":1416049,"page_info":{"current":1,"total":2}}
(규격→spec 분리, 원산지→og 분리. 쉼표 원산지는 i 그대로: {"i":"고기손만두,돈육:국내산","spec":null,"og":null,...}. 넙적분모자 = 단위40·BOX0·EA5 → q=5)

[예시 — 세액 별도 거래명세서 (공급가·세액·합계 칸이 따로)]
{"items":[{"i":"가위바위보뉴진면","u":3800,"q":6,"p":25080,"t":2280,"c":"식자재"},{"i":"투명뉴진면","u":3750,"q":6,"p":24750,"t":2250,"c":"식자재"}],"total_supply":212840,"total_tax":20000,"total_sum":232840}
(행 p=합계 칸(세후), t=세액 칸. 검산 u×q=p−t=공급가: 3800×6=22800=25080−2280. 공급가 소계 212840 + 세액 20000 = 총합계액 232840)

[예시 — 중량거래 거래명세서 (박스+중량 동시)]
{"items":[{"i":"냉동돈육 돈목살","u":9400,"q":90.54,"p":851076,"c":"식자재"},{"i":"냉동우육 설도","u":14800,"q":97.80,"p":1447440,"c":"식자재"}]}
(돈목살 = 11Box·90.54kg → 박스 q=11이면 9400×11=10만 ≠ 851076, 중량 q=90.54면 9400×90.54≈851076 → q=90.54. 박스 무시, 중량을 q로)`;
}

// ═══ 채널 2: 온라인 (쿠팡·네이버 등 웹 주문 — 할인 이미 반영·분리배송 중복 주의) ═══
function _rcpPromptOnline({vendorName, catList, multiPageHint}){
  return `한국 영수증을 JSON으로만 응답. 설명·주석 X.
[모드:온라인주문] vendor="${vendorName}" 이미 선택. v 출력 X. 영수증 1장 = 같은 날짜 (date 최상위 1번).
품목별 c를 [${catList}]에서 선택.
[온라인주문 특징 — 쿠팡·네이버쇼핑 등 — 반드시 지켜라]
① 할인 제외: 상품 가격은 이미 할인 적용된 금액. "할인"·"쿠폰"·"적립금" 등 별도 할인/음수 행 = items 완전 제외(이중차감 방지).
② 분리배송 중복 제거: 배송그룹이 여러 개면 같은 상품명+금액이 반복 표시됨. 동일 상품명+금액 조합은 items에 1번만.
③ 소계·구분행 제외: "소계"·"합계"·"배송지"·"쿠팡 직접판매" 등 집계/구분 행 = items 제외.
④ ⚠️배송비 포함: "배송비"가 금액(>0)으로 있으면 items에 별도 행으로 꼭 넣어라 — i="배송비", q=1, p=배송비 금액, t=0, f=false, c=가장 가까운 분류. 무료배송·0원이면 넣지 마라.
⑤ total_sum = 페이지 하단 "결제금액"/"총 결제금액" 최종값(상품+배송비 포함). 배송그룹별 소계 X.
⑥ 검산: 모든 items의 p 합 = total_sum 이어야 함(상품들 + 배송비). 안 맞으면 배송비 행을 빠뜨렸는지 다시 확인.${multiPageHint}

[응답]
{
  ${_rcpDateField()},
  "items": [ {i,u,q,p,t,f,c} 행 배열 ],
${_rcpCommonRespTail()}
}

[필드]
- i:상품명 화면에 보이는 글자 전체 그대로(셀러명은 품목명 앞에). 자르지 마라
- u:단가 (없으면 null)
- q:수량 (없으면 1)
- p:행 [상품금액/주문금액] 인쇄값 그대로 정수(할인 이미 반영된 실결제 단위). u×q 계산 X — 인쇄값 우선
- t:0 (온라인 주문 화면은 행별 세액 분리 안 됨)
- f:면세 여부(true/false). 보통 false
- c:카테고리 [${catList}] — 품목 성격대로 행마다. 못 정하면 가장 가까운 것. 빈 값 X

[규칙]
${_rcpCommonRules()}
- i:상품명 화면 글자 전체 그대로 — 자르지 마라. 못 읽으면 보이는 대로, 지어내지 마라.
- p·u·q는 양수만. 할인·음수 행은 items에 넣지 마라(위 특징 ① — 이미 상품가에 반영됨).

[예시 — 온라인 주문 (쿠팡, 상품 + 배송비)]
{"date":"2026-06-08","items":[{"i":"[철물인] 서랍레일 유신 3단 35폭 200mm","u":3730,"q":5,"p":18650,"c":"식자재"},{"i":"배송비","q":1,"p":3000,"t":0,"f":false,"c":"식자재"}],"total_sum":21650}
(상품 18,650 + 배송비 3,000 = total_sum 21,650. ⚠️배송비를 빠뜨리면 합이 안 맞음. 별도 "할인" 행은 items 제외 — 상품가에 이미 반영됨. 분리배송으로 같은 상품이 배송그룹마다 반복돼도 items엔 1번만)`;
}

// ═══ 채널 3: 직구 (마트·시장 영수증 — vendor 추출, 품목별 카테고리) ═══
function _rcpPromptDirect({catList, multiPageHint}){
  return `한국 영수증을 JSON으로만 응답. 설명·주석 X.
[모드:직구] 마트·시장. d 출력 X. vendor 최상위 1번(영수증에 찍힌 가게명). 영수증 1장 = 같은 날짜·매장.
품목별 c를 [${catList}]에서 선택.${multiPageHint}

[응답]
{
  "vendor": "상호명",
  ${_rcpDateField()},
  "items": [ {i,u,q,p,t,f,c} 행 배열 ],
${_rcpCommonRespTail()}
}

[필드]
- i:품목명+규격 (포장·원산지 꼬리표 제외 — 규칙 참조)
- u:단가 (없으면 null)
- q:수량 (없으면 1)
- p:행 [합계/금액] 칸 인쇄값 그대로 정수(세후=실제 낸 돈). 행마다 [공급가·세액·합계] 칸 따로면 [합계] 칸. u×q 계산 X — 1~2원 차이도 인쇄 우선
- t:행 [세액] 칸 값(정수). 세액 칸이 따로 있으면 그 값, 없거나 면세면 0
- f:면세 여부(true/false). t>0이면 false. 면세표시(*)·면세 칸·미가공 농축수산물(육류·생선·야채·과일·쌀)이면 true
- c:카테고리 [${catList}] — 품목 성격대로 행마다. 못 정하면 가장 가까운 것. 빈 값 X

[규칙]
${_rcpCommonRules()}
- i:품목명+규격(괄호 규격 포함)만. 품목명 끝에 붙은 포장·원산지 메타꼬리표는 제외 — "박스입수:N"·"입수:N"이 나오면 그 단어부터 끝까지 전부 버려라(뒤의 "/원산지"·"※주석" 포함). ⚠️단, 품명 안에 쉼표로 자연스럽게 섞인 원산지(예 "고기손만두,돈육:국내산", "냉동감자튀김,중국산")는 품명의 일부이니 그대로 둬라. 예) "이츠웰 유부(F0용 슬라이스 1Kg/EA) 박스입수:8/외국산 ※대두(미국산,캐나다산)" → "이츠웰 유부(F0용 슬라이스 1Kg/EA)". 꼬리표 없으면 그대로. 못 읽으면 보이는 대로, 지어내지 마라.
- p·u·q는 양수만 — 할인 행 제외
- [할인 행] 실물 영수증의 할인·쿠폰·에누리 라인(예: "500원할인@비엔나", "[카드쿠폰] 시금치", "에누리(쿠폰)")은 items에 별도 행으로. ⚠️인쇄된 마이너스(-) 부호 그대로 — p·u 음수 그대로(예 -500, -1500). i=원문, q=인쇄 수량(없으면 1), t=0, f=false, c=바로 위 품목과 동일. "할인전소계"·"총할인액" 요약행은 제외(이중차감 방지).

[예시 — 마트·시장 영수증]
{"date":"2026-04-09","vendor":"이마트 성수점","items":[{"i":"양파 1.5kg망","u":3980,"q":2,"p":7960,"c":"식자재"},{"i":"종이컵 100입","u":2500,"q":1,"p":2500,"c":"비품"}],"total_sum":10460}

[예시 — 세액 별도 양식 (공급가·세액·합계 칸이 따로)]
{"vendor":"○○상회","items":[{"i":"가위바위보뉴진면","u":3800,"q":6,"p":25080,"t":2280,"c":"식자재"}],"total_supply":22800,"total_tax":2280,"total_sum":25080}
(행 p=합계 칸(세후), t=세액 칸. 검산 u×q=p−t: 3800×6=22800=25080−2280)`;
}

// ══════════════════════════════════════════
// 전역 상태
// ══════════════════════════════════════════
let currentStore = null;
let employees = [], roles = [], vendors = [], fixedCosts = [];
// 고정비 화면 진입 시 카테고리 필터 (null=전체, '공과금'/'고정비'/'공과금/고정비'/'마케팅'/'세금')
// '/'로 묶인 통합형은 split해서 매칭 → 옛 통합 카드 동작 보존
let currentFcFilter = null;
let vendorMonthTotals = {}; // {vendor_id: {total, count}} — 이번달 거래처별 주문 합계 (카드 표시용)
let settings = {};
let selectedEmpId = null, selectedEmpCtx = 'att';
let currentTargetRowIdx = -1, currentMatchStagingIdx = -1;
let datePickerCtx = '', timePickerCtx = '';
let b64Pages = []; // 멀티페이지 영수증 (2026-05-19 (4)) — 각 항목 = canvas → toDataURL split[1]
let rowCount = 0, stagingData = [];
let cardDateStr = ymdLocal(new Date());
let currentEmp = null, isManager = false, isOwner = false;
// auth_level: 'owner' | 'franchise_admin' | 'store_manager' | 'staff'
// ─── VIEWAS-START — 시점 미리보기 격리 (제거 가이드: dev_lessons.md #46) ───
let realAuthLevel = 'staff';  // DB에서 받은 실제 권한 (변하지 않음)
let viewAsLevel = null;       // 미리보기 권한 (null이면 실제 권한 사용)
// ─── VIEWAS-END ────────────────────────────────────────────
let authLevel = 'staff';       // 화면에 적용되는 권한 (viewAsLevel 반영)
// 권한 단일 진입점: realAuthLevel + viewAsLevel → authLevel/isManager/isOwner 갱신
function recalcPermissions(){
  // VIEWAS 제거 시 → authLevel = realAuthLevel 한 줄로 단순화
  authLevel = viewAsLevel || realAuthLevel;
  isOwner = (authLevel === 'owner');
  isManager = ['owner','franchise_admin','store_manager'].includes(authLevel);
}
let dashMonthStr = new Date().toISOString().slice(0,7);
let schedEmpId = null;
let chartInstances = {};

// ══════════════════════════════════════════
// 이벤트 위임 라우터 (CSP 인라인 핸들러 대체 — dev_lessons #1)
// ══════════════════════════════════════════
// 규칙: data-action="fnName|arg1|arg2" 형식. (파이프 '|' 구분)
//   특수 토큰: 'this' → 해당 요소, 'true'/'false'/'null'/'undefined' → 그대로,
//              숫자 → parseInt/parseFloat, 그 외 → 문자열.
//   change/input 이벤트용 변형: data-change=, data-input=
//   복합 동작(다중 호출·JS 표현식)은 아래 "인라인 대체용 래퍼"로 등록.
function _parseActionArg(a, el){
  if(a==='this') return el;
  if(a==='true') return true;
  if(a==='false') return false;
  if(a==='null') return null;
  if(a==='undefined') return undefined;
  if(/^-?\d+$/.test(a)) return parseInt(a,10);
  if(/^-?\d*\.\d+$/.test(a)) return parseFloat(a);
  return a;
}
function _dispatchAction(attr, el){
  const raw=el.getAttribute(attr);
  if(!raw) return;
  const parts=raw.split('|');
  const fnName=parts[0];
  const args=parts.slice(1).map(a=>_parseActionArg(a, el));
  const fn=window[fnName];
  if(typeof fn==='function'){ try{ return fn.apply(null, args); }catch(err){ console.error('[dispatch]',fnName,err); } }
  else console.error('[dispatch]',attr,'→ unknown action:',fnName);
}

// ─── 인라인 핸들러 대체용 래퍼 ───
function navFromSide(tab){ closeSideMenu(); nav(tab); }
function navHome(){ nav(isManager?'dashboard':'attendance'); }
function editEmpAfterClose(id){ closeAllSheets(); openEditEmpSheet(id); }
function setGanttDay(date){ ganttSelectedDay=date; renderGanttFiltered(); }
function setGanttAllDays(){ ganttSelectedDay='all'; renderGanttFiltered(); }
function removeParent(el){ el.parentElement&&el.parentElement.remove(); }
function openEditAttByIdx(i){ openEditAttSheet(window._attListData[i]); }
function saveVendorUploadGlobal(){ saveVendorUpload(window._vendorUploadList, window._vendorUploadVendorId); }
function setSpecialWageDate(i, el){ specialWageRows[i].date=el.value; }
function setSpecialWageAmount(i, el){ specialWageRows[i].amount=parseInt(el.value)||0; }
function toggleRolePermEvt(roleId, roleName, el){ toggleRolePerm(roleId, roleName, el.checked); }
function toggleEmpPermEvt(empId, el){ toggleEmpPerm(empId, el.checked); }
function resetCurrentEmpDevice(){ resetDeviceFingerprint(document.getElementById('editEmpId').value); }

// 월 요약 카드 — 지출 카테고리 소분류 드릴다운 (2026-05-15)
// 우측 끝 "+ 상세보기" ↔ "− 접기" 텍스트 토글 (사장님 안: ▾ 표시 모호함)
function toggleExpCatChildren(catId){
  if(!catId) return;
  const root=document.getElementById('dashSummaryGrid'); if(!root) return;
  const safe=String(catId).replace(/"/g,'\\"');
  const children=root.querySelectorAll(`tr.cat-child[data-cat="${safe}"]`);
  if(!children.length) return;
  const parent=root.querySelector(`tr.cat-row[data-cat="${safe}"]`);
  if(parent && parent.style.display==='none') return;
  const willShow=children[0].style.display==='none';
  children.forEach(c=>{c.style.display=willShow?'':'none';});
  const btn=parent?.querySelector('.cat-detail-btn');
  if(btn) btn.innerText=willShow?'− 접기':'+ 상세보기';
}
function toggleExpMoreCategories(){
  const root=document.getElementById('dashSummaryGrid'); if(!root) return;
  const moreParents=root.querySelectorAll('tr.cat-row[data-more="1"]');
  const collapseRow=document.getElementById('expCollapseRow');
  const moreToggleRow=document.getElementById('expMoreToggleRow');
  if(!moreParents.length) return;
  const willShow=moreParents[0].style.display==='none';
  moreParents.forEach(r=>{
    r.style.display=willShow?'':'none';
    if(!willShow){
      // 접힐 때 자식도 강제 접힘 + 상세보기 라벨 리셋
      const cat=r.dataset.cat;
      root.querySelectorAll(`tr.cat-child[data-cat="${String(cat).replace(/"/g,'\\"')}"]`).forEach(ch=>{ch.style.display='none';});
      const btn=r.querySelector('.cat-detail-btn');
      if(btn) btn.innerText='+ 상세보기';
    }
  });
  // 더보기 행/접기 행 교대 (펼치면 더보기 자리 사라지고 맨 아래 접기 등장)
  if(moreToggleRow) moreToggleRow.style.display=willShow?'none':'';
  if(collapseRow) collapseRow.style.display=willShow?'':'none';
}

// ══════════════════════════════════════════
// 공통 유틸
// ══════════════════════════════════════════
function toast(msg, type='info', duration=2500){
  const c=document.getElementById('toastContainer');
  const el=document.createElement('div');
  el.className='toast '+type;el.textContent=msg;c.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300);},duration);
}
// 에러 토스트 공용 — 사용자에겐 친근한 한국어, 원본 에러는 콘솔 백업 (dev_lessons #5)
function errToast(action, err){
  if(err) console.error(action+'하지 못함:', err);
  // 진단용: Supabase 에러 코드와 짧은 메시지를 토스트에도 노출 (디버깅 추적용)
  const code=err?.code||err?.status||'';
  const msg=err?.message||err?.error_description||'';
  const tag=code?` [${code}]`:'';
  const detail=msg?` ${String(msg).slice(0,60)}`:'';
  toast(action+'하지 못했어요'+tag+detail+(tag||detail?'':' 잠시 후 다시 시도해주세요'),'error',7000);
}
const setLoad = (on, t='처리 중...') => {
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
  document.getElementById('loadText').innerText = t;
};
function nav(tab, el) {
  // 서브탭 분리: staffRoles → staff 컨테이너 + roles 서브탭
  let subTab = null;
  const subTabMap = {
    vendorUpload: { container: 'vendors', sub: 'upload' },
    settingsBasic: { container: 'settings', sub: null },
    settingsWage: { container: 'settings', sub: null },
    settingsSettle: { container: 'settings', sub: null },
    attendanceRecord: { container: 'attendance', sub: 'all' },
  };
  if (subTabMap[tab]) {
    subTab = subTabMap[tab].sub;
    tab = subTabMap[tab].container;
  }
  // 대시보드 벗어날 때 차트 메모리 해제
  Object.keys(chartInstances).forEach(id=>destroyChart(id));
  // 컨테이너 전환
  document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
  const target = document.getElementById(tab + 'Cont');
  if (target) target.classList.add('active');
  // 스크롤 최상단으로 초기화
  window.scrollTo(0, 0);
  // 하단 탭 active 표시 (허브 카드에서 진입한 경우 부모 탭이 active 유지)
  const parentTabMap = {
    opening:'busHub', settle:'busHub',
    // sales는 홈 매출 행에서만 진입 (영업 탭 카드는 제거됨) → 홈 탭 active 유지
    sales:'dashboard',
    receipt:'expHub', vendors:'expHub', fixedcost:'expHub', wage:'expHub',
    explist:'expHub', recon:'expHub', expcat:'expHub',
    royalty:'expHub', catReceipt:'expHub', manualCat:'expHub',
  };
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el && el.classList) el.classList.add('active');
  else {
    // 1순위: 보이는 nav-item 직접 매칭
    let navEl = document.querySelector(`.nav-item[data-tab="${tab}"]:not([style*="display:none"]):not([style*="display: none"])`);
    // 2순위: 부모 탭 (허브 카드에서 진입한 경우 부모 탭 active 유지)
    if (!navEl && parentTabMap[tab]) {
      navEl = document.querySelector(`.nav-item[data-tab="${parentTabMap[tab]}"]:not([style*="display:none"]):not([style*="display: none"])`);
    }
    // 3순위: 숨겨진 nav-item 매칭 (fallback)
    if (!navEl) navEl = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    if (navEl) navEl.classList.add('active');
  }
  // 페이지별 초기 로딩
  const actions = {
    staff: loadEmployees,
    settings: loadAllSettings,
    dashboard: loadDashboard,
    franchiseHome: loadFranchiseHome,
    // reserve 탭 폐기 (2026-05-22)
    vendors: loadVendors,
    fixedcost: loadFixedCosts,
    attendance: initAttDate,
    // schedule: 2026-05-21 폐기 (근태 서브탭으로 통합). schedule 라우트 호출 시 attendance로 흡수.
    schedule: initAttDate,
    wage: loadWageSummary,
    explist: initExplist,
    expcat: loadExpCategories,
    royalty: loadRoyaltyPage,
    recon: initRecon,
    sales: loadSalesDaily,
    opening: loadOpeningPage,
    myinfo: loadMyInfo,
    busHub: loadBusHubData,
    expHub: loadExpHubData,
    catReceipt: loadCatReceiptData,
    manualCat: loadManualCatView,
  };
  if (actions[tab]) actions[tab]();
  // 홈 v7: dashboard 진입 시 home stage로 리셋 (2026-05-22)
  if (tab === 'dashboard') { try { dashGoStage('home'); } catch(_){} }
  if (tab === 'settle') { resetSettleView(); ensureSettleDeductDefaultRows(); renderExtraRevenueInputs(); recalcSettle2(); initSettleDate(); loadOpeningAmount(); }
  if (tab === 'opening') { initOpeningDate(); openingTab('input', null); }
  // 거래처 진입 시 항상 목록으로 초기화 (상세→하단네비 재진입 시 이전 거래처 남는 버그 방지, dev_lessons #16)
  if (tab === 'vendors' && typeof vendorTab === 'function') vendorTab('list', null);
  // 서브탭 초기화: 탭 진입 시 첫 번째 서브탭을 active로
  if (!subTab) {
    const firstSub = document.querySelector(`#${tab}Cont .sub-tabs .sub-tab:first-child`);
    if (firstSub && !firstSub.classList.contains('active')) firstSub.click();
  }
  // 서브탭 전환 — 동기 즉시 처리 (지연 시 기본 서브탭 화면이 깜빡 보이는 잔상 방지)
  if (subTab) {
    const subBtn = document.querySelector(`#${tab}Cont .sub-tab[data-sub="${subTab}"]`);
    if (subBtn) subBtn.click();
  }
}
function openSheet(id) {
  const el=document.getElementById(id);
  if(el.classList.contains('sheet-overlay')){
    // sheet-overlay는 자체 배경이 있으므로 #overlay 불필요
    el.style.display='flex';
    const inner=el.querySelector('.sheet');
    if(inner) setTimeout(()=>inner.classList.add('show'),10);
  } else {
    document.getElementById('overlay').style.display='block';
    el.classList.add('show');
  }
}
function closeSheet(id) {
  const el=document.getElementById(id);if(!el)return;
  if(el.classList.contains('sheet-overlay')){
    const inner=el.querySelector('.sheet');if(inner)inner.classList.remove('show');
    setTimeout(()=>{el.style.display='none';},300);
  } else {
    el.classList.remove('show');
    setTimeout(()=>{
      if(!document.querySelector('.sheet.show')) document.getElementById('overlay').style.display='none';
    },350);
  }
}
function closeAllSheets() {
  document.querySelectorAll('.sheet.show').forEach(s=>s.classList.remove('show'));
  document.querySelectorAll('.sheet-overlay').forEach(s=>{s.style.display='none';const inner=s.querySelector('.sheet');if(inner)inner.classList.remove('show');});
  setTimeout(()=>document.getElementById('overlay').style.display='none',300);
}
const fmt = n => (n||0).toLocaleString();
const unFmt = s => parseInt((s||'0').replace(/,/g,''))||0;
// ─── 데이터 캐시 (속도 개선 2026-05-21) ─── //
// stale-while-revalidate 패턴 인프라: 메모리 + sessionStorage dual
// 사용: cacheGet(key, ttlMs) / cacheSet(key, data) / cacheInvalidate(prefix)
const _pdCacheMem = {};
const PD_CACHE_VERSION = 1; // 코드 배포 시 버전 ↑ = 옛 캐시 자동 무효화
function cacheGet(key, ttlMs=300000){
  const m=_pdCacheMem[key];
  if(m && Date.now()-m.t<ttlMs && m.v===PD_CACHE_VERSION) return m.d;
  try{
    const raw=sessionStorage.getItem('pd_cache_'+key);
    if(raw){
      const p=JSON.parse(raw);
      if(p && p.v===PD_CACHE_VERSION && Date.now()-p.t<ttlMs){
        _pdCacheMem[key]={t:p.t,d:p.d,v:p.v};
        return p.d;
      }
    }
  }catch(_){}
  return null;
}
function cacheSet(key, data){
  const obj={t:Date.now(),d:data,v:PD_CACHE_VERSION};
  _pdCacheMem[key]=obj;
  try{ sessionStorage.setItem('pd_cache_'+key, JSON.stringify(obj)); }catch(_){}
}
function cacheInvalidate(prefix){
  Object.keys(_pdCacheMem).forEach(k=>{ if(k.startsWith(prefix)) delete _pdCacheMem[k]; });
  try{
    const rm=[];
    for(let i=0;i<sessionStorage.length;i++){
      const k=sessionStorage.key(i);
      if(k && k.startsWith('pd_cache_'+prefix)) rm.push(k);
    }
    rm.forEach(k=>sessionStorage.removeItem(k));
  }catch(_){}
}
// 로컬(한국) 시간 기준 YYYY-MM-DD 문자열 — toISOString().split('T')[0] 시간대 버그 회피용 (2026-05-15 #69)
function ymdLocal(date){
  const d=date instanceof Date?date:new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// 금액 입력란 공용: 입력 중 세자리 콤마 자동 (dev_lessons #58)
function formatNumberInput(el){const raw=(el.value||'').replace(/[^\d]/g,'');el.value=raw?parseInt(raw).toLocaleString():'';}
const guardStore = () => { if(!currentStore){toast('매장을 먼저 선택하세요.','warn');openStoreSheet();return false;}return true; };
function maskAccount(a) { const c=a.replace(/[^0-9]/g,''); return c.length>=4?'****-****-'+c.slice(-4):a; }
function applyPermissionUI() {
  // manager-only: store_manager 이상 (owner, franchise_admin, store_manager)
  document.querySelectorAll('.manager-only').forEach(el => {
    el.style.display = isManager ? '' : 'none';
  });
  // staff-only: staff만 (관리자는 안 보임)
  document.querySelectorAll('.staff-only').forEach(el => {
    el.style.display = (!isManager && currentEmp) ? '' : 'none';
  });
  // owner-only: owner만
  document.querySelectorAll('.owner-only').forEach(el => {
    el.style.display = isOwner ? '' : 'none';
  });
  // franchise-admin-only: franchise_admin만
  document.querySelectorAll('.franchise-admin-only').forEach(el => {
    el.style.display = (authLevel==='franchise_admin') ? '' : 'none';
  });
  // 네비바 탭: 권한별 표시 (manager-only / staff-only 분기)
  document.querySelectorAll('.bottom-nav .nav-item').forEach(el => {
    if(el.classList.contains('manager-only')) el.style.display = isManager ? '' : 'none';
    else if(el.classList.contains('staff-only')) el.style.display = (!isManager && currentEmp) ? '' : 'none';
    else el.style.display='';
  });
  // 내 정보 배지 업데이트
  const badge=isOwner?'👑 사장':isManager?'🔑 관리자':'';
  const badgeEl=document.getElementById('authBadge');
  if(badgeEl) badgeEl.innerHTML=badge?`<span class="badge badge-warn">${badge}</span>`:'';
}
function daysInMonth(ym) { const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }

// ══════════════════════════════════════════
// 내 정보
// ══════════════════════════════════════════
function openMyInfoSheet() {
  const emp = currentEmp;
  let html = '';
  if (!emp) {
    html = `<div style="font-size:18px;font-weight:800;margin-bottom:8px;">개발 모드</div>
      <p style="font-size:13px;color:var(--gray-600);">로그인 없이 관리자 권한으로 진입 중입니다.</p>
      <button class="btn btn-secondary btn-full" style="margin-top:20px;" data-action="closeAllSheets">닫기</button>`;
  } else {
    html = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
        <div class="emp-avatar">${emp.name?.charAt(0)||'?'}</div>
        <div><div style="font-size:19px;font-weight:800;">${emp.name}</div>
          <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;" id="authBadge">
            ${emp.role?`<span class="badge badge-blue">${emp.role}</span>`:''}
            ${isOwner?'<span class="badge badge-warn">👑 사장</span>':isManager?'<span class="badge badge-warn">🔑 관리자</span>':''}
          </div>
        </div>
      </div>
      <div class="my-info-row"><span style="font-size:13px;color:var(--gray-600);font-weight:600;">전화번호</span><span style="font-size:13px;font-weight:700;">${emp.phone||'-'}</span></div>
      <div class="my-info-row"><span style="font-size:13px;color:var(--gray-600);font-weight:600;">생년월일</span><span style="font-size:13px;font-weight:700;">${emp.birth_date||'-'}</span></div>
      <div class="my-info-row"><span style="font-size:13px;color:var(--gray-600);font-weight:600;">은행/계좌</span><span style="font-size:13px;font-weight:700;">${emp.bank_name||'-'} ${emp.account_number?maskAccount(emp.account_number):''}</span></div>
      <div class="my-info-row"><span style="font-size:13px;color:var(--gray-600);font-weight:600;">시급</span><span style="font-size:13px;font-weight:700;">${fmt(emp.base_wage)}원</span></div>
      <div class="action-group" style="margin-top:16px;">
        ${isManager?`<button class="btn btn-secondary" style="flex:1;padding:14px;" data-action="editEmpAfterClose|${emp.id}">✏️ 수정</button>`:''}
        <button class="btn btn-danger" style="flex:1;padding:14px;" data-action="doLogout">로그아웃</button>
      </div>`;
  }
  document.getElementById('myInfoContent').innerHTML = html;
  openSheet('myInfoSheet');
}
// doLogout는 PIN 로그인 섹션에서 정의됨

// ══════════════════════════════════════════
// 매장 선택 — 검색 + 브랜드 그룹 (2026-05-06: SaaS 확장 대비)
// ══════════════════════════════════════════
let _storeListCache = []; // 검색용 원본 캐시
async function openStoreSheet() {
  openSheet('storeSheet');
  // 검색 입력창 비우고 시작
  const searchEl = document.getElementById('storeSearchInput');
  if(searchEl) searchEl.value = '';
  const {data} = await sb.from('stores').select('*, franchises(name)').eq('is_active',true).order('name');
  _storeListCache = data || [];
  renderStoreList(_storeListCache);
}
function renderStoreList(stores){
  const listEl = document.getElementById('storeList');
  if(!stores.length){
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🏪</div><p>등록된 매장이 없습니다</p></div>';
    return;
  }
  // 브랜드별 그룹 (franchises.name 없으면 '기타')
  const grouped = {};
  stores.forEach(s => {
    const brand = s.franchises?.name || '기타';
    if(!grouped[brand]) grouped[brand] = [];
    grouped[brand].push(s);
  });
  const brands = Object.keys(grouped).sort((a,b)=>a==='기타'?1:b==='기타'?-1:a.localeCompare(b,'ko'));
  // 매장 1개고 브랜드도 1개면 단순 리스트 (그룹 헤더 생략)
  const flatMode = stores.length<=3 && brands.length===1;
  listEl.innerHTML = brands.map(brand=>{
    const items = grouped[brand].map(s=>`
      <div class="store-item" data-action="selectStore|${s.id}|${s.name}">
        <div class="store-dot"></div>
        <div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;">${s.name}</div><div style="font-size:12px;color:var(--gray-600);">${s.address||''}</div></div>
      </div>`).join('');
    if(flatMode) return items;
    return `<div style="margin-bottom:14px;">
      <div style="font-size:12px;font-weight:800;color:var(--gray-500);padding:6px 4px;letter-spacing:-0.3px;">${brand} <span style="color:var(--gray-400);font-weight:600;">${grouped[brand].length}</span></div>
      ${items}
    </div>`;
  }).join('');
}
function filterStoreList(el){
  const q = (el.value||'').trim().toLowerCase();
  if(!q) return renderStoreList(_storeListCache);
  const filtered = _storeListCache.filter(s => {
    const name = (s.name||'').toLowerCase();
    const brand = (s.franchises?.name||'').toLowerCase();
    const addr = (s.address||'').toLowerCase();
    return name.includes(q) || brand.includes(q) || addr.includes(q);
  });
  renderStoreList(filtered);
}
async function selectStore(id, name) {
  currentStore = {id, name};
  document.getElementById('headerStore').innerText = name;
  localStorage.setItem('pd_store', JSON.stringify({id,name}));
  closeAllSheets();
  // 로그인 전이면 직원만 로드, 로그인 후면 전부 로드
  if(document.getElementById('loginOverlay').style.display!=='none'){
    await loadEmployees();
    showLoginScreen();
  } else {
    await Promise.all([loadEmployees(), loadAllSettings(), loadVendors(), loadFixedCosts(), loadExpCategories(), loadPaymentMethods(), loadExtraItems()]);
    // 매출 캐시 클리어 (매장 바꾸면 새로 로드)
    salesDaily = []; salesEditCtx = null;
    recalcSettle2();
  }
}

