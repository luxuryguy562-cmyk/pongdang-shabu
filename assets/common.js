// ══════════════════════════════════════════
// 설정
// ══════════════════════════════════════════
const SUPABASE_URL      = 'https://ecfjkfqlnqfxovlwhdtx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YuKpf2bsq72vo4N9Qm2GEQ_p2HivKgu';
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
  // 2.5 Pro 단가 추가 (2026-06-09) — 누락 시 flash-lite 단가로 과소계산(측정실 Pro 1.1원 버그).
  // 2026-01 지식 기준 추정: 입력 $1.25 / 출력 $10 per 1M, 환율 1400원. 실제는 Worker _costWon 우선.
  'gemini-2.5-pro':         { in: 1750, out:14000 },
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
  // (옛 6번째 인자 thinking 제거 2026-06-10 — Gemini thinking은 한국 차단(dev_lessons #201), worker도 무시. 켜지 마라.)
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
//   ├ _rcpPromptLiquor    ← 주류(공병 보증금 분리 — deposit_in/out 추출) 전용
//   ├ _rcpPromptVendor    ← 거래처(정기 거래명세서) 전용
//   ├ _rcpPromptOnline    ← 온라인(쿠팡·네이버 등 웹 주문) 전용
//   ├ _rcpPromptDirect    ← 직구(마트·시장 영수증) 전용
//   └ _rcpCommonRules / _rcpCommonRespTail  ← 채널 무관 공통(검산·세액별도·함정 등)
//   ⚠️ 영수증 탭(receipt.js)·측정실(accuracy_lab.js) 둘 다 buildReceiptPrompt만 호출 → 검증=실제 동일 보장
// ═══════════════════════════════════════════════════════════════
function buildReceiptPrompt({isVendorMode=true, isOnlineMode=false, isLiquorMode=false, vendorName='', catList='', pageCount=1}={}){
  const multiPageHint = pageCount>1
    ? `\n[멀티페이지] 사진 ${pageCount}장 = 같은 영수증의 다른 페이지. 모든 페이지 행을 items에 통합. date·vendor·total_sum은 1번만.`
    : '';
  // 채널 판정: 주류 > 온라인 > 거래처 > 직구
  if(isLiquorMode) return _rcpPromptLiquor({vendorName, catList, multiPageHint});
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
  "page_info": {"current":현재페이지,"total":총페이지수} — 영수증에 "Page (N/M)" 인쇄 시. 없으면 {"current":1,"total":1}`;
}

// ─── 공통: 채널 무관 규칙 (검산·소계제외·세액별도·함정·숫자·면세) — 수정 시 3채널 동시 반영(의도) ───
function _rcpCommonRules(){
  return `- [회계 검산] 두 등식이 반드시 맞아야 함: ①단가(u)×수량(q)=공급가(p−t) ②공급가+세액(t)=합계(p). 안 맞으면 u·q·t·p를 다시 읽어라 — 특히 공급가를 단가나 합계 칸에 잘못 넣는 실수 주의.
- [그대로 옮겨 적기] i는 인쇄된 글자를 한 글자씩 그대로 옮겨 적기(transcribe). ⚠️못 읽은 글자를 그럴듯한 다른 상품명으로 창작 절대 금지 — "쇠고기다시다"를 "최고기다시마"로, "스위트콘"을 "스페셜김치"로, "사골농축액"을 "오븐용닭"으로 바꾸는 식의 추측·창작 = 최악의 오류. 낯선 단어·사전에 없는 단어여도 보이는 글자 그대로. 일부만 보이면 보이는 부분만 적어라.
- 합계행·소계·부가세행·외상행·용기보증금 = items에서 제외 (공급가액/세액 소계는 total_supply/total_tax로만). 할인 요약줄(이벤트할인·총할인액 등)은 [할인 한 번만] 규칙 따름
- [할인 한 번만] 할인·쿠폰·에누리는 영수증에 여러 번 적혀 있어도 실제로는 한 번만 차감된다. items에도 딱 한 번만 음수 행으로 넣어라. 판단: ⓐ품목표 안 인라인 할인(예 "2개구매시2,000원할인")과 합계구역 요약줄(예 "이벤트 할인 −6,000"·"총할인액 −6,000")이 같은 금액으로 둘 다 있으면 = 같은 할인의 중복 표시 → 인라인 1번만 넣고 합계구역 줄은 제외. ⓑ품목표에 할인이 없고 합계구역에만 할인이 있으면 = 누락 금지, 그 할인을 음수 행으로 넣어라. ⓒ확신 안 서면 아래 [영수증 검산]으로 맞춰라.
- [영수증 검산] 모든 items의 p 합(할인 음수 포함) = total_sum(실제 낸 돈: 내실금액·신용액·결제금액·금일합계). 안 맞으면 할인을 빠뜨렸거나(합계구역 할인 누락) 두 번 넣은 것(인라인+요약 중복) — 위 [할인 한 번만]으로 다시 맞춰라.
- [요약 페이지] 품목 행 없이 합계·소계만 인쇄된 페이지(연속 명세서의 마지막 장 등)는 items에 아무 행도 만들지 마라 — total_sum·total_supply·total_tax만 읽어라.
- [세액 별도 양식] 행에 공급가·세액·합계 칸 따로면: p=합계(세후) 칸, t=세액 칸, total_supply=공급가액 소계, total_tax=세액 소계, total_sum=총합계액(세후). 세액 칸 없으면 t=0 + total_supply·total_tax=null
- [함정] total_sum·total_supply에 전미수·전잔액·당일입금·현잔액·누계·채권 절대 X. "이번 거래분(금일)"만
- 숫자 쉼표·원 제거, 빈배열 X
- 흐릿해도 근접 추정 (숫자 칸만 — 품목명은 창작 금지, 위 규칙)
- [면세/과세 — f] 영수증에 면세 표시(*·면세합 등)면 f=true, 과세면 f=false. 불확실하면 f 생략. (참고용 — 앱은 부가세 자동계산 안 함. 2026-06-24)
- [규격 표준형] spec의 중량·용량 단위는 소문자로 통일(kg·g·ml·l). 포장 꼬리표 "/EA"·"/PAC"·"/BOX"는 제거. 예) "1KG/PAC"→"1kg", "500G/EA"→"500g", "700ML"→"700ml". 단 제조사·괄호 상세가 붙은 복합 규격(예 "1.3KG(30G*약43EA)")은 단위만 소문자로 바꾸고 나머지는 그대로.
- [원산지는 og로 분리] 영수증 어디든(품명 앞뒤·괄호·※주석·쉼표) 산지(국내산·외국산·중국산·미국산·수입산 등)가 보이면 반드시 og로 빼고 i(품목명)에서는 제거. "재료명:산지"로 적힌 것도 og로(예 "돈육:국내산"). 원재료가 여럿이면 쉼표로 og에 다 담아라(예 og="닭고기:국내산, 돈지방:국내산"). ⚠️산지 표기가 전혀 없으면 og=null — 없는 산지를 지어내지 마라.`;
}

// 공통: 날짜 필드 힌트
function _rcpDateField(){
  return `"date": "영수증 발행일 YYYY-MM-DD (영수증에 연도가 명확히 안 보이면 ${new Date().getFullYear()}년으로)"`;
}

// ═══ 채널 1: 주류 (공병 보증금 분리 — deposit_in/out 추출, 술값만 items.p) ═══
function _rcpPromptLiquor({vendorName, catList, multiPageHint}){
  return `한국 주류 거래명세서를 JSON으로만 응답. 설명·주석 X.
[모드:주류] vendor="${vendorName}" 이미 선택. v·d 출력 X. 영수증 1장 = 같은 날짜 (date 최상위 1번).
[주류 핵심 규칙 — 반드시 지켜라]
① 각 품목 p = 공급가+부가세만. ⚠️ 용기대(보증금) 칸은 p에 절대 포함 X. 합계 칸(공급가+부가세+용기대)을 쓰면 안 됨.
①-2 ⚠️탄산가스·생수 등 비주류 행: 공급가·부가세 칸이 0이면 p=0. 용기대 칸에만 찍힌 값(예 90,000)은 보증금이니 deposit_in에 합산하고 p에는 절대 넣지 마라.
② 소계에서 "용기보증금" → deposit_in(양수). "빈용기보증금"·"회수보증금" → deposit_out(양수). 없으면 null.
③ total_sum = "거래대금합계" 줄의 값만 (실제 외상 단 돈). ⚠️"매출합계"(=공급가액+부가세+용기보증금)를 total_sum에 쓰지 마라. 거래대금합계 = 매출합계 − 빈용기보증금.
[수량 칸 우선] 수량 칸 있으면 q=그 값. "수량C/S"·"수량EA" 둘 다 있으면 q=수량C/S(케이스 수). 수량EA(낱개수) q 금지.
  · 수량C/S=4·수량EA=96·출고가=19,000·금액=76,000 → q=4. 19,000×4=76,000 ✅
[BOX/EA] 수량 칸 없고 BOX·EA만 있으면 q=(BOX×단위)+EA. BOX=0이면 EA만.
[행 정렬 — 가로선] 표는 가로선으로 행이 나뉜다. 한 품목의 품목명·규격·단가·수량·금액은 같은 가로줄 안에 있다. 인쇄가 선에 딱 안 맞아도 같은 행끼리 묶어 읽고, 윗줄/아랫줄 값을 섞지 마라.${multiPageHint}

[응답]
{
  ${_rcpDateField()},
  "items": [ {i,spec,og,u,q,p,t,f,c} 행 배열 ],
  "deposit_in": 용기보증금 소계(정수,양수). 없으면 null,
  "deposit_out": 빈용기보증금 회수(정수,양수). 없으면 null,
${_rcpCommonRespTail()}
}

[필드]
- i:품목명만 (규격→spec, 원산지→og 분리)
- spec:규격 (예 "(유)", "355ml캔 24CSR", "500ml"). 없으면 null
- og:원산지. 없으면 null
- u:단가(출고가). 없으면 null
- q:수량 — 위 [수량 칸 우선] 적용
- p:공급가+부가세만 (용기대 제외). u×q 계산 X — 인쇄된 공급가+부가세 합산값 우선
- t:행 세액. 세액 칸 있으면 그 값, 없으면 0
- f:면세 여부(true/false). 주류는 보통 false
- c:카테고리 [${catList}] — 주류·음료 등 품목 성격대로. ⚠️반드시 목록에 있는 이름 그대로만, 목록에 없는 새 분류명 생성 금지

[규칙]
${_rcpCommonRules()}
- i:품목명만. 규격(괄호 포함)→spec, 원산지→og 분리. "박스입수:N"·"입수:N" → 버림.
- 합계행·소계(매출합계·공급가액·부가세 소계 등)·용기보증금행·빈용기보증금행 = items 제외 (deposit_in·deposit_out·total_sum으로만)

[예시 — 주류 거래명세서 형태 (가공 숫자)]
{"date":"2026-06-09","items":[{"i":"참이슬","spec":"(유)","og":null,"u":72000,"q":2,"p":79200,"t":7200,"f":false,"c":"식자재>주류"},{"i":"카스","spec":"(유)","og":null,"u":110000,"q":3,"p":121000,"t":11000,"f":false,"c":"식자재>주류"},{"i":"탄산가스","spec":null,"og":null,"u":null,"q":1,"p":0,"t":0,"f":true,"c":"식자재>주류"}],"deposit_in":150000,"deposit_out":120000,"total_supply":182000,"total_tax":18200,"total_sum":230200}
(참이슬 p=72000+7200=79200. 용기대 칸 제외. deposit_in=용기보증금 소계 150,000. deposit_out=빈용기보증금 120,000. total_sum=거래대금합계 230,200 = 매출합계 350,200 − 빈용기 120,000)`;
}

// ═══ 채널 2: 거래처 (정기 거래처 거래명세서 — spec·og 분리, BOX/EA, 품목별 카테고리) ═══
function _rcpPromptVendor({vendorName, catList, multiPageHint}){
  return `한국 영수증을 JSON으로만 응답. 설명·주석 X.
[모드:거래처] vendor="${vendorName}" 이미 선택. v·d 출력 X. 품목별 c를 [${catList}]에서 선택 — 한 거래처라도 품목마다 분류가 다를 수 있다(예: 육류·공산품 섞임). 영수증 1장 = 같은 날짜 (date 최상위 1번).
[합계 함정 — 반드시] total_sum = "금일합계" 칸의 값만. ⚠️"총합계"는 전미수(이전 외상)+금일합계라서 total_sum에 절대 쓰지 마라. "전미수"가 0보다 크면 총합계 ≠ 금일합계 — 이때 반드시 금일합계를 골라라.
[수량 칸 우선] ⚠️표에 "수량" 칸이 따로 있으면 q=그 "수량" 칸 값 그대로. "Box입수량"·"박스입수"·"입수" 칸은 한 박스에 든 개수(메타)일 뿐이니 q에 절대 쓰지 마라.
  · Box입수량5·단위EA·수량2 → q=2 (5 아님)
  · Box입수량10·단위EA·수량2 → q=2
  · Box입수량1·단위BOX·수량3 → q=3
  · "수량C/S"와 "수량EA" 칸이 둘 다 있으면 q=수량C/S(케이스 수). 수량EA(낱개수=C/S×단위본수)는 q 절대 X.
    수량C/S=4·수량EA=96·출고가=19,000·금액=76,000 → q=4. 19,000×4=76,000 ✅ / EA=96 사용 시 19,000×96=1,824,000 ❌
[BOX/EA] 위처럼 별도 "수량" 칸이 없고 BOX·EA 칸만 있으면: q=(BOX×단위)+EA. ⚠️ BOX=0이면 단위 무시, EA가 q.
  · 단위20·BOX1·EA10→q=30
  · 단위8·BOX1·EA0→q=8
  · 단위40·BOX0·EA5→q=5  ← BOX 0
  · 단위12·BOX0·EA5→q=5  ← BOX 0
[행 정렬 — 가로선] 표는 가로선으로 행이 나뉜다. 한 품목의 품목명·규격·단가·수량·금액은 같은 가로줄 안에 있다. 인쇄가 선에 딱 안 맞아도 같은 행끼리 묶어 읽고, 윗줄/아랫줄 값을 섞지 마라. ⚠️특히 규격(spec, 중량·용량)은 그 행 안에서만 읽어라 — 윗줄·아랫줄 규격을 끌어오지 마라.
[품목코드 칼럼] 품목/상품코드 칼럼의 긴 숫자(6자리 이상, 예 1000528094)는 상품 코드일 뿐 — i에 절대 X. 코드 오른쪽/다음 칼럼의 글자가 품명이다.
[두 줄 품명 칸] 품명 칸 안에 글자가 두 줄이면: 첫째 줄=i(품목명), 둘째 줄(제조사·중량·포장, 예 "대림,1.3KG(30G*약43EA)/PAC")=spec. ⚠️둘째 줄을 별도 품목 행으로 만들거나 다른 행의 품명으로 옮기지 마라.${multiPageHint}

[응답]
{
  ${_rcpDateField()},
  "items": [ {i,spec,og,u,q,p,t,f,c} 행 배열 ],
${_rcpCommonRespTail()}
}

[필드]
- i:품목명만 (규격·꼬리표 → spec·og 분리 — 규칙 참조)
- spec:규격·포장 규격(괄호 안 포함, 예 "F0용 슬라이스 1kg", "500g"). 없으면 null
- og:원산지(예 "외국산", "국내산", "중국산", "돈육:국내산"). 없으면 null. 품명에 쉼표로 섞인 산지도 og로 빼라 — 공통규칙 [원산지는 og로 분리] 참조
- u:단가 (없으면 null)
- q:수량 (없으면 1) — BOX/EA 정확히 적용(수량 칸 없을 때). BOX 0 = EA만. 중량거래(kg·g)면 q=중량값(소수점 허용).
- p:행 [합계/금액] 칸 인쇄값 그대로 정수(세후=실제 낸 돈). 행마다 [공급가·세액·합계] 칸 따로면 [합계] 칸. u×q 계산 X — 1~2원 차이도 인쇄 우선
- t:행 [세액] 칸 값(정수). 세액 칸이 따로 있으면 그 값, 없거나 면세면 0
- f:면세 여부(true/false) — 부가가치세법 기준. 세액(t)>0 또는 영수증 과세표시면 false. 면세(true)=①미가공 농축수산물(생채소·생과일·정육·생선·쌀·곡물) ②1차가공(건조·냉동·염장·정육·제분·데침 등 본래성질 유지) ③단순가공식료품(데친채소·김치·단무지·장아찌·젓갈·게장·두부·메주·간장·된장·고추장) ④종량제봉투(종량제 쓰레기봉투)·도서·신문. 과세(false)=본질가공식품(소시지·어묵·맛살·햄·과자·라면·소스·드레싱·통조림 등)·공산품·비품·주방용품·생활용품·주류·음료·생수·커피
- c:카테고리 [${catList}] — 품목 성격대로 행마다. ⚠️반드시 이 목록에 있는 이름 그대로만 사용. 목록에 없는 새 분류명 절대 만들지 마라. 못 정하면 목록 중 가장 가까운 것. 빈 값 X

[규칙]
${_rcpCommonRules()}
- i:품목명만. 규격(괄호 포함)→spec, 원산지→og 분리. "박스입수:N"·"입수:N" → 버림(뒤의 "/원산지"·"※주석" 포함). 쉼표로 품명에 섞인 산지(예 "고기손만두,돈육:국내산")도 og로 빼라 → i:"고기손만두", og:"돈육:국내산". 예) "이츠웰 유부(F0용 슬라이스 1Kg/EA) 박스입수:8/외국산 ※대두(미국산)" → i:"이츠웰 유부", spec:"F0용 슬라이스 1kg", og:"외국산". 꼬리표 없으면 그대로. 못 읽으면 보이는 대로, 지어내지 마라.
- [한자 제거] i(품목명)에 한자(漢字)가 섞여 있으면 그 한자 글자는 모두 빼고 한글만 남겨라. ⚠️뺀 한자를 spec(규격)으로 옮기지도 마라 — 그냥 버려라. 예) "위즈복대-魚子福袋"→"위즈복대" / "흑목이버섯 1kg-黑木耳"→"흑목이버섯 1kg" / "호스 쌀국수-春絲 米線"→"호스 쌀국수" / "행사/가재완자/홍샤쥬/龍蝦球"→"행사/가재완자/홍샤쥬". 읽기 어려운 글자를 비슷한 한국어 음식 이름으로 추측·창작하지 마라. 안 보이면 보이는 한글만 남겨라.
- p·u·q는 양수만 — 할인 행 제외
- [할인 행] 할인·쿠폰·에누리(예: "500원할인@비엔나", "[카드쿠폰] 시금치", "금토일N개구매시N원할인@상품명")은 items에 음수 행으로. ⚠️인쇄된 마이너스(-) 부호 그대로 — p·u 음수 그대로(예 -500). i=원문, q=인쇄 수량(없으면 1), t=0, f=false, c=바로 위 품목과 동일(합계구역 할인이면 c="기타" 또는 가장 가까운 분류). ⚠️같은 할인이 품목표·합계구역에 중복 표기되면 한 번만 — 공통 [할인 한 번만]·[영수증 검산] 따름.

[예시 — 거래명세서 (BOX/EA + spec/og 분리, 가공 숫자)]
{"date":"2026-04-09","items":[{"i":"새우볼(완자)","spec":"500g","og":null,"u":8200,"q":30,"p":246000,"c":"식자재"},{"i":"납작당면","spec":"250g","og":null,"u":1200,"q":5,"p":6000,"c":"식자재"},{"i":"이츠웰 유부","spec":"F0용 슬라이스 1kg","og":"외국산","u":9000,"q":8,"p":72000,"c":"식자재"}],"total_sum":324000,"page_info":{"current":1,"total":2}}
(규격→spec 분리(단위 소문자), 원산지→og 분리. 쉼표 원산지도 og로: {"i":"고기손만두","spec":null,"og":"돈육:국내산",...}. 납작당면 = 단위40·BOX0·EA5 → q=5)

[예시 — 세액 별도 거래명세서 (공급가·세액·합계 칸이 따로)]
{"items":[{"i":"가위바위보뉴진면","u":3800,"q":6,"p":25080,"t":2280,"c":"식자재"},{"i":"투명뉴진면","u":3750,"q":6,"p":24750,"t":2250,"c":"식자재"}],"total_supply":212840,"total_tax":20000,"total_sum":232840}
(행 p=합계 칸(세후), t=세액 칸. 검산 u×q=p−t=공급가: 3800×6=22800=25080−2280. 공급가 소계 212840 + 세액 20000 = 총합계액 232840)

[예시 — 중량거래 거래명세서 (박스+중량 동시)]
{"items":[{"i":"냉동돈육 돈목살","u":9400,"q":90.54,"p":851076,"c":"식자재"},{"i":"냉동우육 설도","u":14800,"q":97.80,"p":1447440,"c":"식자재"}]}
(돈목살 = 11Box·90.54kg → 박스 q=11이면 9400×11=10만 ≠ 851076, 중량 q=90.54면 9400×90.54≈851076 → q=90.54. 박스 무시, 중량을 q로)

[예시 — C/S 명세서 (수량C/S·수량EA 칸 둘 다 존재)]
{"items":[{"i":"칠성사이다","spec":"355ml캔(업소) 24CSR","og":null,"u":19000,"q":4,"p":76000,"t":0,"f":false,"c":"식자재>주류"}],"total_sum":76000}
(수량C/S=4·수량EA=96·출고가=19,000·금액=76,000 → q=4. 19,000×4=76,000 ✅. EA=96은 24본×4케이스=낱개수이므로 q 절대 X)`;
}

// ═══ 채널 3: 온라인 (쿠팡·네이버 등 웹 주문 — 할인 이미 반영·분리배송 중복 주의) ═══
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
  "items": [ {i,spec,og,u,q,p,t,f,c,vu} 행 배열 ],
${_rcpCommonRespTail()}
}

[필드]
- i:상품명(셀러명 [○○] 은 앞에 그대로). ⚠️규격·옵션은 i에서 빼서 spec으로 — 규칙 참조. 못 읽으면 보이는 대로, 지어내지 마라
- spec:규격·옵션(개수·색상·치수·용량·단수 등. 예 "1000개, 화이트", "3단 35폭 200mm", "500ml 24입"). 없으면 null
- og:원산지(쿠팡·네이버 화면에 "원산지: ○○"로 명시된 경우만, 예 "국내산"·"중국산"). 없으면 null
- u:단가 (없으면 null)
- q:수량 (없으면 1)
- p:행 [상품금액/주문금액] 인쇄값 그대로 정수(할인 이미 반영된 실결제 단위). u×q 계산 X — 인쇄값 우선
- t:0 (온라인 주문 화면은 행별 세액 분리 안 됨 — 부가세는 앱이 과세분에서 자동 계산)
- f:면세 여부(true/false) — 부가가치세법 기준. 면세(true)=①미가공 농축수산물(생채소·생과일·정육·생선·쌀·곡물) ②1차가공(건조·냉동·염장·데침 등 본래성질 유지) ③단순가공식료품(데친채소·김치·단무지·장아찌·젓갈·게장·두부·메주·간장·된장·고추장)·종량제봉투·도서·신문. 과세(false)=본질가공식품(소시지·어묵·맛살·과자·라면·소스·통조림 등)·공산품·비품·생활용품·주방용품·생수·음료·커피. 못 정하면 false
- vu:면세/과세 판단이 애매하면 true (미가공인지 가공인지 헷갈리는 식품 — 냉동·반가공·손질·절임·양념·세트 등). 명확하면 false 또는 생략. ⚠️공산품·비품 등 명백한 과세나 생야채·생과일 등 명백한 미가공은 vu=false
- c:카테고리 [${catList}] — 품목 성격대로 행마다. ⚠️반드시 이 목록에 있는 이름 그대로만 사용. 목록에 없는 새 분류명 절대 만들지 마라. 못 정하면 목록 중 가장 가까운 것. 빈 값 X

[규칙]
${_rcpCommonRules()}
- [규격 분리] 상품명 끝/중간의 명확한 규격·옵션(숫자+단위·개수·색상·치수·단수, 예 "1000개"·"화이트"·"35폭 200mm"·"3단")만 spec으로 빼라. 상품 설명·용도(예 "업소용 손님용 식당 부직포 방수")는 i에 그대로 둬라. 어디까지가 규격인지 애매하면 자르지 말고 i 그대로 + spec=null. 배송비 행은 spec·og 둘 다 null.
- p·u·q는 양수만. 할인·음수 행은 items에 넣지 마라(위 특징 ① — 이미 상품가에 반영됨).

[예시 — 온라인 주문 (쿠팡, 규격 분리 + 할인 반영)]
{"date":"2026-06-07","items":[{"i":"프로덕트랩 일회용 앞치마 업소용 손님용 식당 부직포 방수","spec":"1000개, 화이트","og":null,"u":28300,"q":2,"p":56600,"c":"비품"}],"total_sum":56600}
(상품명 끝 "1000개, 화이트"→spec. 용도설명 "업소용 손님용 식당 부직포 방수"는 i 그대로. 화면 단가 28300은 이미 할인반영(28300×2=56600=결제금액) → 별도 "할인 -4000" 행 제외. 분리배송 중복은 1번만)

[예시 — 온라인 주문 (쿠팡, 규격 중간 + 배송비)]
{"date":"2026-06-08","items":[{"i":"[철물인] 서랍레일 유신 서랍장 가구레일","spec":"3단 35폭 200mm","og":null,"u":3730,"q":5,"p":18650,"c":"비품"},{"i":"배송비","spec":null,"og":null,"q":1,"p":3000,"t":0,"f":false,"c":"비품"}],"total_sum":21650}
(상품명 중간 "3단 35폭 200mm"→spec, 나머지는 i. 상품 18,650 + 배송비 3,000 = 21,650. ⚠️배송비 빠뜨리면 합 안 맞음)`;
}

// ═══ 채널 4: 직구 (마트·시장 영수증 — vendor 추출, 품목별 카테고리) ═══
function _rcpPromptDirect({catList, multiPageHint}){
  return `한국 영수증을 JSON으로만 응답. 설명·주석 X.
[모드:직구] 마트·시장. d 출력 X. vendor 최상위 1번(영수증에 찍힌 가게명). 영수증 1장 = 같은 날짜·매장.
품목별 c를 [${catList}]에서 선택.${multiPageHint}

[응답]
{
  "vendor": "상호명",
  ${_rcpDateField()},
  "items": [ {i,spec,og,u,q,p,t,f,c} 행 배열 ],
${_rcpCommonRespTail()}
}

[필드]
- i:품목명만 (규격·꼬리표 → spec·og 분리 — 규칙 참조)
- spec:규격·포장 규격(괄호 안 포함. 예 "1.5kg망"·"100입"·"500ml"). 없으면 null
- og:원산지(예 "국내산"·"중국산"·"미국산"·"돈육:국내산"). 없으면 null. 품명에 쉼표로 섞인 산지도 og로 빼라 — 공통규칙 [원산지는 og로 분리] 참조
- u:단가 (없으면 null)
- q:수량 (없으면 1)
- p:행 [합계/금액] 칸 인쇄값 그대로 정수(세후=실제 낸 돈). 행마다 [공급가·세액·합계] 칸 따로면 [합계] 칸. u×q 계산 X — 1~2원 차이도 인쇄 우선
- t:행 [세액] 칸 값(정수). 세액 칸이 따로 있으면 그 값, 없거나 면세면 0
- f:면세 여부(true/false) — 부가가치세법 기준. 세액(t)>0 또는 영수증 과세표시면 false. 면세(true)=①미가공 농축수산물(생채소·생과일·정육·생선·쌀·곡물) ②1차가공(건조·냉동·염장·정육·제분·데침 등 본래성질 유지) ③단순가공식료품(데친채소·김치·단무지·장아찌·젓갈·게장·두부·메주·간장·된장·고추장) ④종량제봉투(종량제 쓰레기봉투)·도서·신문. 과세(false)=본질가공식품(소시지·어묵·맛살·햄·과자·라면·소스·드레싱·통조림 등)·공산품·비품·주방용품·생활용품·주류·음료·생수·커피
- c:카테고리 [${catList}] — 품목 성격대로 행마다. ⚠️반드시 이 목록에 있는 이름 그대로만 사용. 목록에 없는 새 분류명 절대 만들지 마라. 못 정하면 목록 중 가장 가까운 것. 빈 값 X

[규칙]
${_rcpCommonRules()}
- i:품목명만. 규격(괄호·용량·치수 예 "1.5kg망"·"100입")→spec, 원산지→og 분리. "박스입수:N"·"입수:N" → 버림(뒤의 "/원산지"·"※주석" 포함). 쉼표로 품명에 섞인 산지(예 "고기손만두,돈육:국내산", "냉동감자튀김,중국산")도 og로 빼라 → i:"고기손만두", og:"돈육:국내산". 예) "이츠웰 유부(F0용 슬라이스 1Kg/EA) 박스입수:8/외국산 ※대두(미국산)" → i:"이츠웰 유부", spec:"F0용 슬라이스 1kg", og:"외국산". 어디까지가 규격인지 애매하면 자르지 말고 i 그대로 + spec=null. 못 읽으면 보이는 대로, 지어내지 마라.
- p·u·q는 양수만 — 할인 행 제외
- [할인 행] 할인·쿠폰·에누리(예: "500원할인@비엔나", "[카드쿠폰] 시금치", "에누리(쿠폰)", "금토일N개구매시N원할인@상품명")은 items에 음수 행으로. ⚠️인쇄된 마이너스(-) 부호 그대로 — p·u 음수 그대로(예 -500, -1500). i=원문, spec·og=null, q=인쇄 수량(없으면 1), t=0, f=false, c=바로 위 품목과 동일(합계구역 할인이면 c="기타" 또는 가장 가까운 분류). ⚠️같은 할인이 품목표·합계구역에 중복 표기되면 한 번만 — 공통 [할인 한 번만]·[영수증 검산] 따름.

[예시 — 마트·시장 영수증 (규격·원산지 분리)]
{"date":"2026-04-09","vendor":"이마트 성수점","items":[{"i":"양파","spec":"1.5kg망","og":"국내산","u":3980,"q":2,"p":7960,"c":"식자재"},{"i":"종이컵","spec":"100입","og":null,"u":2500,"q":1,"p":2500,"c":"비품"}],"total_sum":10460}
(규격→spec, 원산지→og 분리. 쉼표 산지도 og로: "대파, 국내산" → i:"대파", og:"국내산")

[예시 — 세액 별도 양식 (공급가·세액·합계 칸이 따로)]
{"vendor":"○○상회","items":[{"i":"가위바위보뉴진면","spec":null,"og":null,"u":3800,"q":6,"p":25080,"t":2280,"c":"식자재"}],"total_supply":22800,"total_tax":2280,"total_sum":25080}
(행 p=합계 칸(세후), t=세액 칸. 검산 u×q=p−t: 3800×6=22800=25080−2280)

[예시 — 할인 중복 표기 (품목표 인라인 할인 + 합계구역 요약이 같은 금액)]
{"vendor":"논산농협","items":[{"i":"삼립 아침미소 샌드위치식빵","spec":"790g","og":null,"u":4580,"q":2,"p":9160,"c":"식자재"},{"i":"상천 사각꼬치","spec":"600g","og":null,"u":6980,"q":7,"p":48860,"c":"식자재"},{"i":"금토일2개구매시2,000원할인","spec":null,"og":null,"u":-6000,"q":1,"p":-6000,"t":0,"f":false,"c":"식자재"},{"i":"동원 부산어묵 진꼬치어묵","spec":"660g","og":null,"u":8980,"q":2,"p":17960,"c":"식자재"}],"total_sum":69980}
(품목표 안 인라인 할인 -6,000 1번만. 합계구역 "이벤트 할인 -6,000"·"총할인액 -6,000"은 같은 할인의 중복 표기라 items 제외. 검산: 9160+48860-6000+17960=69980=내실금액(실결제). 만약 인라인 할인이 없고 합계구역에만 -6,000 있었다면 그걸 음수 행으로 넣어야 69,980 맞음)`;
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
let authLevel = 'staff';       // 화면에 적용되는 권한 (DB 실제 권한)
let _myWorkMode = false;       // '내 근무' 모드 (관리자가 본인 직원 화면 볼 때, 2026-06-15) — 화면만, DB권한 불변
// 직급 화면권한 설정(role_permissions)이 있으면 관리자 (어떤 직급이든 설정하면 관리자급 권한)
function _roleIsManager(){
  if(!currentEmp || !currentEmp.role) return false;
  const perms = settings && settings.role_permissions;
  return !!(perms && perms[currentEmp.role] && perms[currentEmp.role].length > 0);
}
// 권한 진입점: authLevel 또는 관리자 직급 → isManager/isOwner 갱신
function recalcPermissions(){
  if(_myWorkMode){ isOwner=false; isManager=false; return; } // 내 근무 모드 = 직원처럼 (화면용, 실제 권한 아님)
  isOwner = (authLevel === 'owner');
  isManager = ['owner','franchise_admin','store_manager'].includes(authLevel) || _roleIsManager();
}
// 실제 관리자 권한 여부 (_myWorkMode 무관 — 역할 전환 토글 표시용)
function isRealManager(){ return ['owner','franchise_admin','store_manager'].includes(authLevel) || _roleIsManager(); }
// 관리 ↔ 내 근무 전환 (화면만 바뀜, 권한 그대로)
function setMyWorkMode(on){
  _myWorkMode = !!on;
  recalcPermissions();
  applyPermissionUI();
  if(typeof closeAllSheets==='function') closeAllSheets(); // 이름 메뉴 닫고 화면 이동
  // 이동 탭: 내 근무=출퇴근 / 관리 복귀=권한 있는 첫 탭 (홈 권한 없으면 홈으로 안 감 — 2026-06-15)
  let target='attendance';
  if(!on && isManager){
    const order=['dashboard','attendance','busHub','expHub'];
    const perms=(settings && settings.role_permissions) ? settings.role_permissions[(currentEmp&&currentEmp.role)] : null;
    target = Array.isArray(perms) ? (order.find(t=>perms.includes(t))||'attendance') : 'dashboard';
  }
  const el=document.querySelector(`.bottom-nav .nav-item[data-tab="${target}"]`);
  if(typeof nav==='function') nav(target, el||undefined);
}
function enterMyWork(){ setMyWorkMode(true); }   // 내 근무 모드
function exitMyWork(){ setMyWorkMode(false); }   // 관리 모드 복귀
// ─── 헤더 이름 메뉴 (2026-06-16): 모드 전환 토글 + 내 정보 + 매장 변경 + 로그아웃 ───
function openHeaderMenu(){
  if(!currentEmp){ if(typeof openMyInfoSheet==='function') openMyInfoSheet(); return; } // 미로그인=기존
  // 기존 열린 시트 직접 닫기 (openSheet는 기존 시트 안 닫음 → 중첩 방지, 2026-06-16). closeAllSheets의 overlay 타임아웃 충돌 피해 즉시 처리
  document.querySelectorAll('.sheet.show').forEach(s=>{ if(s.id!=='headerMenuSheet') s.classList.remove('show'); });
  document.querySelectorAll('.sheet-overlay').forEach(s=>{ s.style.display='none'; const inn=s.querySelector('.sheet'); if(inn) inn.classList.remove('show'); });
  const who=document.getElementById('hmWho');
  if(who){
    const roleLabel = currentEmp.role || (isManager?'관리자':'직원');
    const storeName = (typeof currentStore!=='undefined' && currentStore) ? currentStore.name : '';
    who.innerHTML = `${currentEmp.name} <span style="font-size:12px;color:var(--gray-500);font-weight:600;">${roleLabel}${storeName?' · '+storeName:''}</span>`;
  }
  const tog=document.getElementById('hmToggle');
  if(tog) tog.style.display = isRealManager() ? 'flex' : 'none';
  updateRoleSwitchUI();
  if(typeof openSheet==='function') openSheet('headerMenuSheet');
}
// 메뉴 → 다른 화면: 메뉴 닫고(즉시) 이동. closeAllSheets 타임아웃 충돌 피해 직접 닫음
function goMyInfoFromMenu(){
  document.querySelectorAll('.sheet.show').forEach(s=>s.classList.remove('show'));
  const ov=document.getElementById('overlay'); if(ov) ov.style.display='none';
  setTimeout(()=>{ if(typeof openMyInfoHub==='function') openMyInfoHub(); }, 40);
}
function goStoreFromMenu(){
  document.querySelectorAll('.sheet.show').forEach(s=>s.classList.remove('show'));
  const ov=document.getElementById('overlay'); if(ov) ov.style.display='none';
  setTimeout(()=>{ if(typeof openStoreSheet==='function') openStoreSheet(); }, 40);
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

// ─── 새 기능: 공과금/고정비 해당월 실제 납부액 반영 (2026-06-14, 2단계) ───
// 실제 납부액(fixed_cost_amounts, is_confirmed)이 있으면 그 금액, 없으면 예상(estimated_monthly).
// 가마감 집계·대시보드·요약이 모두 이 헬퍼를 써서 화면 간 값이 어긋나지 않게 함.
async function loadFcActualMap(sid, ym){
  try{
    const{data}=await sb.from('fixed_cost_amounts').select('fixed_cost_id,amount,is_confirmed')
      .eq('store_id',sid).eq('year_month',ym);
    const map={};
    (data||[]).forEach(a=>{ if(a.is_confirmed && a.amount!=null) map[a.fixed_cost_id]=a.amount; });
    return map;
  }catch(_){ return {}; }
}
// fixed_costs 한 행 → 유효 월 금액 (실제 납부액 우선, 없으면 예상)
function fcEffectiveMonthly(fc, actualMap){
  const a = actualMap && actualMap[fc.id];
  return (a!=null) ? a : (fc.estimated_monthly||0);
}
// 납기일 → 해당 연·월의 실제 납기 '일'. expected_day가 99(말일) 또는 그 달 마지막날보다 크면 말일로 보정 (2026-06-15)
function fcDueDay(fc, year, month1){ // month1 = 1~12
  const ed = fc && fc.expected_day;
  if(!ed) return null;
  const lastDay = new Date(year, month1, 0).getDate();
  return (ed>=99 || ed>lastDay) ? lastDay : ed;
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
const setLoad = (on, t='처리 중...', scanImg=false) => {
  const ld=document.getElementById('loading');
  ld.style.display = on ? 'flex' : 'none';
  document.getElementById('loadText').innerText = t;
  // 영수증 AI 분석: 올린 사진(scanImg=base64)을 크게 띄우고 그 위를 스캔선이 훑는 스캐너 모드 (2026-06-18)
  const sp=document.getElementById('loadSpinner'), sc=document.getElementById('loadScan'), im=document.getElementById('loadScanImg');
  const scanOn = on && !!scanImg;
  if(sc) sc.style.display = scanOn ? 'block' : 'none';
  if(sp) sp.style.display = scanOn ? 'none' : 'block';
  ld.classList.toggle('scan-mode', scanOn);
  if(scanOn && im && typeof scanImg==='string') im.src='data:image/jpeg;base64,'+scanImg;
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
  // franchise_admin은 franchiseHome 외 다른 화면 진입 차단
  if(typeof authLevel !== 'undefined' && authLevel === 'franchise_admin' && tab !== 'franchiseHome') tab = 'franchiseHome';
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
    empSched:'attendance',   // 직원 근무표 → 홈(근태) 탭 active 유지
    empPay:'empPay',
    // sales는 홈 매출 행에서만 진입 (영업 탭 카드는 제거됨) → 홈 탭 active 유지
    sales:'dashboard',
    receipt:'expHub', vendors:'expHub', fixedcost:'expHub', wage:'expHub',
    expcat:'expHub',
    royalty:'expHub', cardfee:'expHub', catReceipt:'expHub', manualCat:'expHub',
    expHubVendor:'expHub',
    myWorkplaces:'myWorkplaces',
    empCommunity:'empCommunity',
    ownerCommunity:'ownerCommunity',
    empSettings:'empSettings',
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
    myStores: loadMyStores,
    myWorkplaces: loadMyWorkplaces,
    empCommunity: loadEmpCommunity,
    ownerCommunity: loadOwnerCommunity,
    empSettings: loadEmpSettings,
    // reserve 탭 폐기 (2026-05-22)
    vendors: loadVendors,
    fixedcost: loadFixedCosts,
    attendance: initAttDate,
    // schedule: 2026-05-21 폐기 (근태 서브탭으로 통합). schedule 라우트 호출 시 attendance로 흡수.
    schedule: initAttDate,
    wage: loadWageSummary,
    expcat: loadExpCategories,
    royalty: loadRoyaltyPage,
    cardfee: loadCardFeePage,
    sales: loadSalesDaily,
    opening: loadOpeningPage,
    myinfo: loadMyInfo,
    empPay: loadEmpPay,
    empSched: loadEmpSched,
    busHub: loadBusHubData,
    expHub: loadExpHubData,
    expHubVendor: loadVendors, // loadVendors 끝에서 renderExpHubVendorView 자동 호출 (거래처 관리 통합, 2026-06-21)
    catReceipt: loadCatReceiptData,
    manualCat: loadManualCatView,
  };
  if (actions[tab]) actions[tab]();
  // 홈 v7: dashboard 진입 시 home stage로 리셋 (2026-05-22)
  if (tab === 'dashboard') { try { dashGoStage('home'); } catch(_){} }
  if (tab === 'settle') { resetSettleView(); ensureSettleDeductDefaultRows(); recalcSettle2(); initSettleDate(); loadOpeningAmount(); }
  if (tab === 'opening') { initOpeningDate(); openingTab('input', null); }
  // 거래처 진입 시 항상 목록으로 초기화 (상세→하단네비 재진입 시 이전 거래처 남는 버그 방지, dev_lessons #16)
  if (tab === 'vendors' && typeof vendorTab === 'function') vendorTab('list', null);
  // 영수증 진입 시 어정쩡 상태(모드만 고르고 거래처 미선택) 청소 — 거래처 #16의 영수증판 (2026-06-16)
  if (tab === 'receipt' && typeof _rcpOnTabEnter === 'function') _rcpOnTabEnter();
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
  // 내 매장들·본사 홈 화면: 하단 관리자 탭 숨기기 / 그 외: 권한 기준 복원
  const _noNavTabs = tab === 'myStores' || tab === 'franchiseHome' || authLevel === 'franchise_admin';
  document.querySelectorAll('.bottom-nav .nav-item.manager-only').forEach(el => {
    el.style.display = _noNavTabs ? 'none' : (isManager ? '' : 'none');
  });
  if(!_noNavTabs && typeof applyRoleTabLimit === 'function') applyRoleTabLimit();
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
// ─── 새 기능: 영업일 기준 날짜 (2026-06-16) ───
// store_settings.business_day_start_hour(영업일 시작 시각, 기본 6시) 전에 입력/마감하면 전날 영업으로 침.
// 자정 넘는 심야·24시간 매장용. settings 전역 객체 사용(loadAllSettings에서 select '*'로 로드됨).
function bizStartHour(){
  const h=(typeof settings==='object'&&settings&&settings.business_day_start_hour!=null)?Number(settings.business_day_start_hour):6;
  return (Number.isInteger(h)&&h>=0&&h<=23)?h:6;
}
// 영업일 기준 'YYYY-MM-DD' — 영업일 시작 시각 전이면 전날
function bizDateStr(dateObj){
  const d=new Date((dateObj||new Date()).getTime());
  if(d.getHours()<bizStartHour()) d.setDate(d.getDate()-1);
  return ymdLocal(d);
}
// 'YYYY-MM-DD' + n일
function ymdAddDays(ymd,n){
  const d=new Date(ymd+'T00:00:00');
  d.setDate(d.getDate()+n);
  return ymdLocal(d);
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
  // franchise-admin-hide: franchise_admin에게는 숨기기 (사이드메뉴 대시보드 등)
  document.querySelectorAll('.franchise-admin-hide').forEach(el => {
    el.style.display = (authLevel==='franchise_admin') ? 'none' : '';
  });
  // 네비바 탭: 권한별 표시
  document.querySelectorAll('.bottom-nav .nav-item').forEach(el => {
    if(el.classList.contains('manager-only')) {
      // franchise_admin은 하단 탭 전부 숨기기 (본사 홈 전용 화면)
      if(authLevel === 'franchise_admin') el.style.display = 'none';
      else el.style.display = isManager ? '' : 'none';
    }
    else if(el.classList.contains('staff-only')) el.style.display = (!isManager && currentEmp) ? '' : 'none';
    else el.style.display='';
  });
  // 내 정보 배지 업데이트
  const badge = isOwner ? '👑 사장' : authLevel === 'franchise_admin' ? '👁 본사' : isManager ? '🔑 관리자' : '';
  const badgeEl=document.getElementById('authBadge');
  if(badgeEl) badgeEl.innerHTML=badge?`<span class="badge badge-warn">${badge}</span>`:'';
  // 역할 전환(관리 ↔ 내 근무) 토글 UI + 모드 배너 (2026-06-15)
  updateRoleSwitchUI();
  // 직급별 화면 권한 (2026-06-15): 사장 제외 관리자 직급에 store_settings.role_permissions 적용
  applyRoleTabLimit();
}
// 역할 전환 토글 표시 + 현재 모드 강조 + '내 근무' 배너 (관리자 직원만)
function updateRoleSwitchUI(){
  // 토글은 이제 헤더 이름 메뉴 안에만 존재 (rsMgr/rsMe). 현재 모드 강조만 갱신
  const mBtn=document.getElementById('rsMgr'), wBtn=document.getElementById('rsMe');
  if(mBtn) mBtn.classList.toggle('on', !_myWorkMode);
  if(wBtn) wBtn.classList.toggle('on', !!_myWorkMode);
}
// ─── 새 기능: 직급별 화면(하단 탭) 권한 (2026-06-15) ───
// 사장(owner)=전체 / 직원(staff)=기존 staff-only / 그 외 관리자 직급(점장·팀장 등)=role_permissions 제한
// role_permissions[직급명] = 허용 탭키 배열. 키: dashboard/attendance/busHub/expHub/more. 설정 없으면 기존대로 전체.
function applyRoleTabLimit(){
  if(!isManager || isOwner || !currentEmp) return;
  const role = currentEmp.role;
  if(!role) return;
  const perms = (settings && settings.role_permissions) ? settings.role_permissions[role] : null;
  if(!Array.isArray(perms)) return; // 설정 없으면 기존 동작(관리자 전체)
  document.querySelectorAll('.bottom-nav .nav-item.manager-only').forEach(el=>{
    let key = el.getAttribute('data-tab');
    if(!key && el.getAttribute('data-action')==='toggleSideMenu') key='more';
    if(!key) return;
    el.style.display = perms.includes(key) ? '' : 'none';
  });
  // 현재 보고 있는 탭이 숨겨졌으면 허용된 첫 탭으로 이동 (빈 화면 방지)
  const activeNav = document.querySelector('.bottom-nav .nav-item.active');
  if(activeNav && activeNav.style.display==='none'){
    const order=['dashboard','attendance','busHub','expHub'];
    const first = order.find(t=>perms.includes(t));
    if(first){ const el=document.querySelector(`.bottom-nav .nav-item[data-tab="${first}"]`); if(el && typeof nav==='function') nav(first, el); }
  }
}
// 현재 직원이 특정 화면(탭) 권한 있는지 (2026-06-15): 사장·설정없음=전체허용, 그 외=role_permissions
function hasTabPerm(tabKey){
  if(isOwner) return true;
  if(!currentEmp || !currentEmp.role) return true;
  const perms=(settings && settings.role_permissions) ? settings.role_permissions[currentEmp.role] : null;
  if(!Array.isArray(perms)) return true; // 설정 없으면 기존대로 전체 허용
  return perms.includes(tabKey);
}
function daysInMonth(ym) { const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }

// ══════════════════════════════════════════
// 내 정보
// ══════════════════════════════════════════
// 헤더 이름 배지 탭: 직원이면 내 정보 화면(myinfo), 매니저면 기존 시트
function openMyInfoHub() {
  if (currentEmp && !isManager) { nav('myinfo'); return; }
  openMyInfoSheet();
}
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
  // 이미 받아둔 목록 있으면 즉시 보여줌(재오픈 빠름), 없으면 '불러오는 중' 표시 → 빈 화면 방지
  const listEl = document.getElementById('storeList');
  if(_storeListCache.length){ renderStoreList(_storeListCache); }
  else if(listEl){ listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>매장 목록 불러오는 중…</p></div>'; }
  // 로그인 전이라 신분증 없음 → 공개 통로(login-meta)로 매장 목록만 안전하게 받음 (RLS 잠금 후에도 동작)
  let list = [];
  try{ const {data} = await sb.functions.invoke('login-meta',{body:{action:'stores'}}); if(data&&data.ok) list = data.stores||[]; }catch(_e){}
  if(list.length){ _storeListCache = list; }
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
  // 로그인 전이면 이름·직급만(비민감) 로드 — PIN·계좌·주민번호는 휴대폰에 안 내림. 로그인 후면 전부 로드
  if(document.getElementById('loginOverlay').style.display!=='none'){
    await loadLoginNames();
    showLoginScreen();
  } else {
    await Promise.all([loadEmployees(), loadAllSettings(), loadVendors(), loadFixedCosts(), loadExpCategories(), loadPaymentMethods()]);
    // 매출 캐시 클리어 (매장 바꾸면 새로 로드)
    salesDaily = []; salesEditCtx = null;
    recalcSettle2();
  }
}

// ─── 새 기능: 내 매장들 통합 홈 (my-stores edge function 연결, Phase 1-B) ───
// 만원 단위 압축 표기: 12500000 → "1,250만", 120000000 → "1.2억"
function msCompactMoney(won){
  const n = Number(won)||0;
  if(n >= 100000000){
    const eok = n/100000000;
    return (eok>=10 ? Math.round(eok) : eok.toFixed(1).replace(/\.0$/,'')) + '억';
  }
  const man = Math.round(n/10000);
  return fmt(man) + '만';
}

async function loadMyStores(){
  const listEl = document.getElementById('msStoreList');
  // 월 초기화 (없으면 이번달)
  const mEl = document.getElementById('msMonth');
  // 폰의 '오늘'을 로컬(한국시간) 기준으로 만들어 서버에 전달 → 대시보드와 '며칠째'(진행일수) 일치 (서버 UTC 어긋남 방지)
  const _now = new Date();
  const _todayLocal = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
  const ym = (mEl && mEl.value) || _todayLocal.slice(0,7);
  if(mEl && !mEl.value) mEl.value = ym;

  setLoad(true, '내 매장들 불러오는 중...');
  try{
    const { data, error } = await sb.functions.invoke('my-stores', { body:{ ym, today: _todayLocal } });
    if(error) throw error;
    if(!data || !data.ok) throw new Error((data && data.error) || '불러오기 실패');

    const stores = Array.isArray(data.stores) ? data.stores : [];
    const totalRev = Number(data.total_revenue)||0;
    const totalProfit = Number(data.total_profit)||0;

    document.getElementById('msTotalRev').innerText = fmt(totalRev) + '원';
    // 전체 순익 — 서버(my-stores)가 대시보드 공식대로 매장별 계산한 합 (헌법 7-7 단일 진실)
    const profEl = document.getElementById('msTotalProfit');
    if(profEl){
      profEl.innerText = (totalProfit<0 ? '-' : '') + fmt(Math.abs(totalProfit)) + '원';
      profEl.style.color = totalProfit<0 ? 'var(--red,#e74c3c)' : '';
    }

    if(!stores.length){
      listEl.innerHTML = '<div class="ms-empty">아직 매장이 없어요.<br>아래 [+ 매장 추가]로 첫 매장을 만들어보세요.</div>';
    } else {
      listEl.innerHTML = stores.map((s,i)=>{
        const rev = Number(s.revenue)||0;
        const prof = Number(s.net_profit)||0;
        const pct = totalRev>0 ? (rev/totalRev*100).toFixed(1) : '0';
        const rankColor = i<3 ? 'var(--blue)' : 'var(--gray-500)';
        const name = (s.name||'').replace(/</g,'&lt;');
        const profColor = prof<0 ? 'var(--red,#e74c3c)' : 'var(--green,#27ae60)';
        const profTxt = (prof<0?'-':'') + msCompactMoney(Math.abs(prof));
        return `
        <div class="ms-store" data-action="enterStoreFromList|${s.id}|${s.name}">
          <div class="ms-rank" style="color:${rankColor};">${i+1}</div>
          <div class="ms-store-info">
            <div class="ms-store-name">${name}</div>
            <div class="ms-store-code">순익 <b style="color:${profColor};">${profTxt}</b></div>
          </div>
          <div class="ms-store-rev">
            <div class="ms-rev-val">${msCompactMoney(rev)}</div>
            <div class="ms-rev-pct">매출 ${pct}%</div>
          </div>
          <div class="ms-chev">›</div>
        </div>`;
      }).join('');
    }
    setLoad(false);
  }catch(e){
    setLoad(false);
    if(listEl) listEl.innerHTML = '<div class="ms-empty">매장 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</div>';
    console.error('[my-stores]', e);
    toast('내 매장들 불러오기 실패','error');
  }
}

// 매장 전환 — switch-store 서버 함수가 권한 확인 후 그 매장 세션 발급 → setSession → 그 매장으로
async function enterStoreFromList(storeId, storeName){
  if(currentStore && currentStore.id===storeId){ nav('dashboard'); return; } // 이미 그 매장이면 그냥 이동
  setLoad(true, '매장 전환 중...');
  try{
    const { data, error } = await sb.functions.invoke('switch-store', { body:{ target_store_id: storeId } });
    if(error) throw error;
    if(!data || !data.ok || !data.session){
      setLoad(false);
      toast((data && data.error) || '이 매장에 들어갈 권한이 없어요', 'warn');
      return;
    }
    // 새 매장 신분증으로 교체 → 이후 모든 조회가 그 매장 것으로(RLS 격리 그대로)
    await sb.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    if(typeof currentEmp === 'object' && currentEmp && data.employee_id){
      currentEmp.id = data.employee_id;
      if(data.employee_name) currentEmp.name = data.employee_name;
    }
    await selectStore(storeId, storeName); // currentStore 변경 + 그 매장 데이터 재로드
    setLoad(false);
    nav('dashboard');
    toast(storeName + '(으)로 전환했어요', 'success');
  }catch(e){
    setLoad(false);
    console.error('[switch-store]', e);
    toast('매장 전환에 실패했어요', 'error');
  }
}

// 자리만 (동작은 다음 단계)
function msAddStore(){ toast('매장 추가는 다음 단계에서 연결됩니다','info'); }
function msInviteFranchise(){ toast('가맹점 초대는 다음 단계에서 연결됩니다','info'); }

// ─── 새 기능: 직원 내 근무처들 대시보드 ───
async function loadMyWorkplaces(){
  const listEl = document.getElementById('mwWorkplaceList');
  const mEl = document.getElementById('mwMonth');
  const _now = new Date();
  const _todayLocal = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
  const ym = (mEl && mEl.value) || _todayLocal.slice(0,7);
  if(mEl && !mEl.value) mEl.value = ym;

  if(!currentEmp || !currentEmp.id){
    if(listEl) listEl.innerHTML = '<div class="ms-empty">로그인이 필요해요.</div>';
    return;
  }

  setLoad(true, '근무처 현황 불러오는 중...');
  try{
    const [y, m] = ym.split('-').map(Number);
    const startDate = ym + '-01';
    const nextYM = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;

    // 이번 달 출퇴근 완료 기록 (헌법 7 단일 진실 — calculated_wage 재사용)
    const { data: logs, error } = await sb
      .from('attendance_logs')
      .select('total_work_min, calculated_wage')
      .eq('employee_id', currentEmp.id)
      .gte('check_in', startDate)
      .lt('check_in', nextYM)
      .not('check_out', 'is', null);

    if(error) throw error;

    const totalMin = (logs||[]).reduce((s,r)=> s + (Number(r.total_work_min)||0), 0);
    const totalWage = (logs||[]).reduce((s,r)=> s + (Number(r.calculated_wage)||0), 0);
    const hh = Math.floor(totalMin / 60);
    const mm = Math.round(totalMin % 60);
    const totalH = mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;

    document.getElementById('mwTotalHours').innerText = totalH;
    document.getElementById('mwTotalWage').innerText = fmt(totalWage) + '원';

    if(listEl){
      if(!logs || logs.length === 0){
        listEl.innerHTML = '<div class="ms-empty">이번 달 근무 기록이 없어요.</div>';
      } else {
        const storeName = (currentStore && currentStore.name) || '현재 근무처';
        listEl.innerHTML = `
        <div class="ms-store" data-action="nav|attendance|this">
          <div class="ms-rank" style="color:var(--blue);">1</div>
          <div class="ms-store-info">
            <div class="ms-store-name">${storeName.replace(/</g,'&lt;')}</div>
            <div class="ms-store-code">예상 급여 <b style="color:var(--toss-green,#0CAB6C);">${fmt(totalWage)}원</b></div>
          </div>
          <div class="ms-store-rev">
            <div class="ms-rev-val">${totalH}</div>
            <div class="ms-rev-pct">전체 100%</div>
          </div>
          <div class="ms-chev">›</div>
        </div>`;
      }
    }
    setLoad(false);
  }catch(e){
    setLoad(false);
    if(listEl) listEl.innerHTML = '<div class="ms-empty">근무처 현황을 불러오지 못했어요.</div>';
    console.error('[loadMyWorkplaces]', e);
    toast('근무처 현황 불러오기 실패','error');
  }
}

function mwAddWorkplace(){ toast('근무처 추가는 다음 단계에서 연결됩니다','info'); }
function mwCheckInvites(){ toast('연결 요청 확인은 다음 단계에서 연결됩니다','info'); }

// ─── 직원 커뮤니티 (공간 오픈) ───
function loadEmpCommunity(){ /* 준비 중 화면은 정적 HTML — 로딩 불필요 */ }

// ─── 사장 커뮤니티 (공간 오픈) ───
function loadOwnerCommunity(){ /* 준비 중 화면은 정적 HTML — 로딩 불필요 */ }

// ─── 직원 설정 ───
async function loadEmpSettings(){
  const nameEl = document.getElementById('empSettingsName');
  const phoneEl = document.getElementById('empSettingsPhone');
  const listEl = document.getElementById('empSettingsWorkplaces');
  if(!currentEmp){ return; }
  if(nameEl) nameEl.textContent = currentEmp.name || '—';
  if(phoneEl) phoneEl.textContent = currentEmp.phone || '—';
  if(!listEl) return;
  try {
    // 직원이 연결된 매장 목록 조회 (employees 테이블에서 본인 레코드의 store 정보)
    const { data, error } = await sb
      .from('employees')
      .select('stores(id,name)')
      .eq('phone', currentEmp.phone)
      .eq('is_active', true);
    if(error) throw error;
    if(!data || data.length === 0){
      listEl.innerHTML = '<div class="ms-empty">연결된 근무처가 없어요.</div>';
      return;
    }
    listEl.innerHTML = data.map(r => {
      const s = r.stores;
      if(!s) return '';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;">${s.name.slice(0,1)}</div>
        <div style="font-size:14px;font-weight:700;">${s.name}</div>
      </div>`;
    }).join('');
  } catch(e){
    if(listEl) listEl.innerHTML = '<div class="ms-empty">불러오기 실패</div>';
    console.error('[loadEmpSettings]', e);
  }
  // 승인 대기 중인 연결 요청 조회
  const pendingEl = document.getElementById('empSettingsPending');
  const pendingSection = document.getElementById('empSettingsPendingSection');
  if(pendingEl && pendingSection){
    try {
      const token = localStorage.getItem('pd_token');
      if(token){
        const { data: pd } = await sb.functions.invoke('join-store', { body: { token, action: 'list_my_pending' } });
        const rows = pd?.rows || [];
        if(rows.length > 0){
          pendingEl.innerHTML = rows.map(r => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--orange,#f97316);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;">${(r.stores?.name||'매').slice(0,1)}</div>
            <div>
              <div style="font-size:14px;font-weight:700;">${r.stores?.name||'매장'}</div>
              <div style="font-size:11px;color:var(--gray-500);">사장님 승인 대기 중</div>
            </div>
          </div>`).join('');
          pendingSection.style.display = '';
        } else {
          pendingSection.style.display = 'none';
        }
      }
    } catch(e){ console.warn('[empSettings pending]', e); }
  }
}

// ─── 직원 설정 — 새 근무처 연결 버튼 ───
function openJoinStore(){
  const ov = document.getElementById('joinOverlay');
  if(ov){ ov.style.display='block'; }
}

// ─── 실시간 (Supabase Realtime broadcast) + 가입 알림 종 배지 (2026-06-09) ───
let _storeChannel = null;
function subscribeStoreRealtime(storeId){
  if(!storeId || !sb || typeof sb.channel!=='function') return;
  try{
    if(_storeChannel){ sb.removeChannel(_storeChannel); _storeChannel=null; }
    _storeChannel = sb.channel('store-'+storeId, { config:{ broadcast:{ self:false } } })
      .on('broadcast', { event:'change' }, (msg)=>{ try{ onStoreRealtime(msg.payload||{}); }catch(e){} })
      .subscribe();
  }catch(e){ console.warn('[realtime] subscribe 실패', e); }
}
function broadcastStoreChange(kind, extra){
  try{ if(_storeChannel) _storeChannel.send({ type:'broadcast', event:'change', payload:Object.assign({kind:kind}, extra||{}) }); }catch(e){}
}
// 운영 데이터 변경 시 자동 갱신할 화면 → 로더 (시트 안 떠있을 때만)
const _RT_REFRESH = { dashboard:'loadDashboard', sales:'loadSalesDaily', vendors:'loadVendors', attendance:'loadAttList', busHub:'loadBusHubData' };
function _rtSheetOpen(){
  if([...document.querySelectorAll('.sheet-overlay')].some(s=>s.style.display && s.style.display!=='none')) return true;
  for(const id of ['signupOverlay','joinOverlay']){ const el=document.getElementById(id); if(el && el.style.display==='block') return true; }
  return false;
}
let _rtRefreshTimer=null;
function _rtRefreshActive(){
  if(_rtSheetOpen()) return;   // 사장님이 입력 중(시트 열림)이면 방해 안 함
  const active=document.querySelector('.container.active'); if(!active) return;
  const tab=active.id.replace(/Cont$/,'');
  const fn=window[_RT_REFRESH[tab]]; if(typeof fn!=='function') return;
  clearTimeout(_rtRefreshTimer);
  _rtRefreshTimer=setTimeout(()=>{ try{ if(typeof cacheInvalidate==='function') cacheInvalidate(''); fn(true); }catch(e){} }, 600); // 캐시 비우고 최신 로드, 디바운스
}
function onStoreRealtime(payload){
  const k=payload&&payload.kind;
  // 모든 변경에 종 배지 갱신 (가입·근무신청·승인 등 — 2026-06-16 사장님: 전부 실시간)
  if(typeof refreshJoinBadge==='function') refreshJoinBadge();
  // 직원관리 화면이면 가입 대기 목록도 갱신
  if(k==='join'||k==='approve'||k==='reject'){
    const staffCont=document.getElementById('staffCont');
    if(staffCont&&staffCont.classList.contains('active')&&typeof loadJoinAdmin==='function') loadJoinAdmin();
  }
  // 보던 화면 자동 갱신 (지출·매출·정산·거래처·근태·개시마감)
  _rtRefreshActive();
}
function initRealtimeAndBadge(){
  if(!currentStore) return;
  subscribeStoreRealtime(currentStore.id);
  if(typeof refreshJoinBadge==='function') refreshJoinBadge();
}
// 앱이 다시 보일 때(다른 화면/앱 갔다 옴) 배지 갱신 — 실시간 폴백
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && typeof refreshJoinBadge==='function') refreshJoinBadge(); });

// ─── 새 기능: 기간 선택 피커 (거래처 상세 · 지출카테고리 공통) ───
let periodPickerCtx = null; // 'vendorOrder' | 'catReceipt'

function openPeriodPicker(ctx){
  periodPickerCtx = ctx;
  const now = new Date();
  const curM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  let fromInit = curM, toInit = curM;
  if(ctx === 'vendorOrder'){
    fromInit = (typeof vOrderRangeFrom!=='undefined' && vOrderRangeFrom) ? vOrderRangeFrom
             : (typeof vOrderCurrentMonth!=='undefined' ? vOrderCurrentMonth : curM);
    toInit   = (typeof vOrderRangeTo!=='undefined' && vOrderRangeTo) ? vOrderRangeTo : fromInit;
  } else if(ctx === 'catReceipt'){
    fromInit = (typeof catReceiptRangeFrom!=='undefined' && catReceiptRangeFrom) ? catReceiptRangeFrom
             : (typeof catReceiptMonth!=='undefined' ? catReceiptMonth : curM);
    toInit   = (typeof catReceiptRangeTo!=='undefined' && catReceiptRangeTo) ? catReceiptRangeTo : fromInit;
  }
  const fromEl = document.getElementById('periodPickerFrom');
  const toEl   = document.getElementById('periodPickerTo');
  if(fromEl) fromEl.value = fromInit;
  if(toEl)   toEl.value   = toInit;
  openSheet('periodPickerSheet');
}

function applyPeriodQuick(preset){
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth()+1;
  const thisM = `${y}-${String(mo).padStart(2,'0')}`;
  let from = thisM, to = thisM;
  if(preset === 'thisMonth'){
    from = to = thisM;
  } else if(preset === 'lastMonth'){
    const d = new Date(y, mo-2, 1);
    from = to = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  } else if(preset === '3months'){
    const d = new Date(y, mo-3, 1);
    from = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    to = thisM;
  }
  closeAllSheets();
  if(periodPickerCtx === 'vendorOrder' && typeof _applyVOrderPeriod==='function') _applyVOrderPeriod(from, to);
  else if(periodPickerCtx === 'catReceipt' && typeof _applyCatReceiptPeriod==='function') _applyCatReceiptPeriod(from, to);
}

function applyPeriodRange(){
  const from = document.getElementById('periodPickerFrom')?.value;
  const to   = document.getElementById('periodPickerTo')?.value;
  if(!from || !to){ alert('시작월과 종료월을 모두 선택해주세요.'); return; }
  if(from > to){ alert('시작월이 종료월보다 늦습니다.'); return; }
  closeAllSheets();
  if(periodPickerCtx === 'vendorOrder' && typeof _applyVOrderPeriod==='function') _applyVOrderPeriod(from, to);
  else if(periodPickerCtx === 'catReceipt' && typeof _applyCatReceiptPeriod==='function') _applyCatReceiptPeriod(from, to);
}

