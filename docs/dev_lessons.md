# 개발 교훈 (Dev Lessons)

> 같은 실수 반복 방지. **새 세션 시작 시 필독.**

---

## 58. 금액 입력란은 무조건 세자리 콤마 자동 (2026-05-06)

**사건**: 고정비 편집 시트의 예상 월 금액 입력란을 `type="number"`로 만들어 `3190000` 그대로 표시. 사장님 "금액은 세자리쉼표가 필수인데 왜 자꾸 이런식으로 하는지 모르겠어".

**원인**:
- `type="number"`는 콤마 입력 거부 → 미적용
- dev_lessons #22가 "**리스트 표시**는 tabular-nums + table" 명시 — 입력란 콤마 자동은 별도 규칙으로 못박혀있지 않았음
- 마감정산 입력란들은 이미 `type="text" inputmode="numeric" data-input="onSInput|this"` 패턴으로 콤마 자동 (line 1050~) — 알고 있었지만 새 입력란에 재적용 누락

**규칙 (이후 모든 금액 입력란에 적용)**:
1. **`type="number"` 금지** — 콤마 표시 못 함
2. **표준 패턴**:
   ```html
   <input type="text" inputmode="numeric" data-input="formatNumberInput|this" placeholder="예: 2,000,000">
   ```
3. **공용 함수** `formatNumberInput(el)` (index.html line 2800 부근):
   ```js
   function formatNumberInput(el){
     const raw=(el.value||'').replace(/[^\d]/g,'');
     el.value=raw?parseInt(raw).toLocaleString():'';
   }
   ```
4. **값 set 시 콤마 적용**: `el.value = fmt(num)` (예: openEditFcSheet)
5. **저장 시 콤마 제거**: `unFmt(el.value)` (예: saveFc)
6. **금액 외 숫자(예정일·일수·등)는 `type="number"` OK** — 콤마 불필요한 작은 숫자

**체크리스트 (입력란 만들 때)**:
- [ ] 이 입력란이 **금액**(원·만원·천원 등)인가
- [ ] 그렇다면 `type="text" + inputmode="numeric" + data-input="formatNumberInput|this"`
- [ ] 초기값 set 시 `fmt()` 거쳤나
- [ ] 저장 로직에서 `unFmt()` 거쳤나
- [ ] placeholder에 콤마 포함 (예: "2,000,000")

**관련**: dev_lessons #22(금액 리스트는 tabular-nums + table), #57(사장님께 코드 용어 금지). 사장님 분노 트리거: "왜 자꾸 이런식으로 하는지" — 같은 류 실수 반복 신호.

---

## 57. 사장님께는 코드 용어 금지, 화면 단어 + 비유로 설명 (2026-05-06)

**사건**: 고정비 집계 진단 보고 시 `fixed_cost_amounts.year_month`, `default_amount INT`, `loadFixedCosts`, "fallback 우선순위 1번" 같은 DB 테이블명·컬럼명·함수명·영어 IT 용어를 그대로 사장님께 노출 → 사장님 "전문가 아니라 가독성 떨어진다"고 지적.

**원인**:
- 헌법 제3조 "초등학생도 이해하게 쉬운 비유로" 규정이 있는데도 critic/planner 출력 그대로 카피 → 사장님이 보는 화면 단어로 치환 안 함
- DB 컬럼명·SQL·함수명을 "정확함"이라 착각, 사장님 입장에선 외계어

**규칙 (이후 모든 보고에 적용)**:
1. **DB 테이블/컬럼명 노출 금지** — 사장님 앱에서 보는 단어로 치환
   - `fixed_cost_amounts.year_month` → "고정비 월별 금액 입력 시트"
   - `default_amount INT 컬럼` → "고정비 항목 옆에 '평소 금액' 칸"
2. **함수명 노출 금지** — 화면 위치/버튼명으로 치환
   - `loadFixedCosts` → "사이드메뉴 → 고정비 화면"
3. **영어 IT 용어 → 한국어 비유**
   - fallback → "비어있으면 대신 쓸 값"
   - override → "그 달만 다른 값으로 덮어쓰기"
   - 우선순위 1번/2번 → "먼저 보는 값/없으면 쓰는 값"
4. **SQL/코드 블록은 사장님 응답에 절대 안 보임** — 계획서 "DB 변경" 항목은 코드는 적되, 사장님 본문 설명에는 한 줄 풀어 쓰기 ("고정비 항목에 평소 금액 칸 1개 추가")
5. **비유 우선** — 기술 설명 전에 일상 비유 1줄 ("매달 월세 200만원 똑같은데 매번 새로 적게 만들어놨던 셈")

**체크리스트 (모든 답변 발송 전)**:
- [ ] DB 테이블·컬럼명 영어로 그대로 쓴 곳 없나
- [ ] 함수명 백틱(`)으로 감싼 곳 없나
- [ ] 영어 IT 용어(fallback/override/upsert 등) 한국어로 풀었나
- [ ] 첫 줄에 비유 또는 결론을 사장님 단어로 넣었나
- [ ] 정밀한 기술 보고가 필요하면 "기술 상세" 접기 섹션으로 분리

**관련**: 헌법 제3조(페르소나 — 초등학생도 이해), dev_lessons #6(사장님 힌트는 금이다 — 사장님 단어 그대로 듣는 것의 반대 방향)

---

## 56. 앱 개발자는 매장 직원 테이블에 없어야 한다 (2026-05-05)

**사건**: 가입 시 owner 직원 row 자동 생성 로직(`Phase 1-A1`)이 "앱 운영자(=김은성=사용자) 본인을 첫 매장의 owner 직원으로 등록"하는 구조였음. 사용자가 "어플 만든 사람이 매장에 들어가서 데이터 수정해줄 일이 없는데 왜 매장 직원에 박혀있냐, 매장마다 또 박을 거냐"라고 지적 → super_admins 테이블 신설 제안도 사용자가 "의미 없다"고 일축 ("시스템 고칠 일 있으면 코드 수정하지 매장 UI 들어갈 일 없다").

**원인**:
- `auth_level='owner'`라는 단일 권한이 두 가지 다른 개념을 섞어버림
  - (a) 매장 운영 최상위 권한자 (매장 사장)
  - (b) 앱 시스템 운영자 (개발자)
- 가입 플로우가 가입자 본인을 자동으로 (a)로 등록 → 사용자(앱 개발자)도 매장 owner가 됨 → 호칭 충돌(사장 vs 총관리자)

**해결**:
1. owner = **매장 운영 사장 1명**으로 의미 단일화 (UI 라벨 "👑 사장")
2. 앱 개발자(김은성) row 삭제, 매장 운영 사장(이송은) owner 승격
3. super_admin 메커니즘 신설 X — 앱 운영자가 매장 UI에 로그인할 메커니즘 자체가 불필요
4. 시스템 디버깅·수정은 Supabase 콘솔 직접 SQL 또는 코드 수정으로 처리

**체크리스트** (가입 플로우 손볼 때):
- [ ] 가입자 본인을 매장 employees.owner로 등록하는 게 적절한가?
- [ ] 가입자 = 진짜 매장 운영자인가? (개발자/운영자가 가입자가 되면 안 됨)
- [ ] 매장 직원 테이블에 들어가야 할 사람만 들어가나?

**재발 방지**: business_rules.md #7 호칭 절대 규칙 + 이력 박음.

---

## 55. 호칭 절대 금지: owner ≠ 사장 (2026-05-05)

**사건**: 김은성(=총관리자=owner=사용자)이 "난 사장이 아니다, 매장 사장은 이송은이고 나는 앱 총관리자다"라고 명확히 한 후에도 클로드가 두 번째 응답에서 또 "사장님(=owner)" 표현을 사용 → 사용자 분노.

**원인**:
- 헌법 제3조에 "사장님 회사의 CTO 대행" 페르소나 표현이 있어 "사장님"이라는 호칭을 무비판적으로 owner와 동일시함
- owner는 **앱의 시스템 권한**이고, 매장 운영 사장(=업주)과는 분리된 개념인데 코드/문서/대화에서 혼용
- 가입 화면 placeholder "사장님 이름", 에러 메시지 "직원(사장님) 생성 실패", 코드 주석 다수

**해결**:
1. UI 노출 "사장님" → "총관리자"로 통일
   - 가입 placeholder/에러 메시지 3곳 변경
   - 코드 주석은 그대로 (사용자 노출 X)
2. `business_rules.md` #7에 "호칭 절대 규칙" 명시 (owner=총관리자=김은성, 매장사장=이송은=store_manager)
3. 헌법 제3조의 "사장님" 호칭은 페르소나 비유일 뿐 → owner를 "사장"으로 부르는 근거 아님

**체크리스트** (auth_level 표시 코드 작성 시):
- [ ] owner 라벨에 "사장" 단어 안 들어감 ("총관리자" / "👑 총관리자")
- [ ] store_manager 라벨에 "사장" 단어 OK (매장 운영의 사장 = 점장 = store_manager 가능)
- [ ] 신규 가입 입력란/에러: "사장님" 단어 금지, "총관리자"로 통일

**재발 방지**: docs/business_rules.md #7에 못박음 + 본 항목 등재.

---

## 54. 기기 식별은 변동 요소 빼라 — localStorage UUID가 정답 (2026-05-04)

**사건**: 사장님 "출퇴근 오류 난다, 기기초기화 해도 되다가 또 오류". 점검해보니 `getDeviceFingerprint`가 canvas 픽셀 + `screen.width/height` + `navigator.userAgent` + `hardwareConcurrency` 조합 해시. 같은 폰에서도 **화면 회전**(가로↔세로), **브라우저 자동 업데이트**(UA 버전 변경), GPU 캐시 변동으로 해시가 달라져 "등록 안 된 기기" 차단. 관리자가 초기화 → 새 해시로 등록 → 또 변동 → 또 차단. **무한 반복**.

**원인**:
- "기기 고유성"을 **불안정한 환경 변수**로 만들려 함 — fingerprint.js 류 진보적 알고리즘은 광고 추적용이지 출퇴근 식별용이 아님
- dev_lessons #32에서 등록 UX(팝업)는 개선했으나 **fingerprint 자체의 안정성**은 그대로 둠 → 후속 사고
- 사용자가 보고한 "오류" 패턴(되다 안 되다)은 **fingerprint 변동성의 명확한 signal**이었지만 즉각 못 짚음

**해법 패턴 (재사용)**:
1. **localStorage UUID 우선**: 첫 호출 시 `crypto.randomUUID()` 1회 생성 → 영구 보관. 이후 항상 동일값
   - 화면 회전·브라우저 업데이트·GPU 변동 영향 0
2. **fallback fingerprint**(localStorage 차단 환경): canvas 제거, UA 버전 숫자 제거, screen 정렬해서 회전 무관화
3. **옛 형식 호환**: 기존 DB 등록값(`DF…`)이 있으면 첫 시도에서 자동으로 새 형식(`UUID-…`)으로 silent migration. 사용자·관리자 별도 조작 0
4. **`reset` 시 localStorage는 보존**: DB만 null → 같은 폰에서 재등록 시 동일 UUID 유지(다른 직원이 이 폰을 쓰는 경우도 자연스럽게 처리)

**체크리스트 (기기/세션 식별 만들 때)**:
- [ ] 식별자 구성요소 중 사용자가 의도하지 않게 변하는 게 있나? (화면 회전, 브라우저 업데이트, OS 폰트 변경)
- [ ] localStorage/IndexedDB로 영구 저장 가능한 환경인가? → 가능하면 **무조건 우선**
- [ ] fingerprint류는 fallback **2순위**로만 사용
- [ ] 사용자가 "되다 안 되다"라고 호소하면 → **변동성 의심**이 1순위
- [ ] 형식 전환 시 기존 데이터 자동 마이그레이션 경로(silent migration) 있나

**관련**: dev_lessons #32(기기 등록 UX), 헌법 10조-3(자가 치유 — 사용자에게 반복 오류 떠넘기지 말 것)

---

## 53. main 브랜치 직접 작업 실수 → claude 브랜치 fast-forward로 정리 (2026-04-30)

**사건**: 사용자 편의성 Phase 1(A+D+E) 작업 중 직전 main 머지 흐름 때문에 `git checkout` 안 한 상태로 코드 수정·커밋 → 헌법 1-2 위반(main 직접 커밋). 다행히 `git push origin claude/...`는 "Everything up-to-date"로 차단됨 (local main에만 새 커밋, claude 브랜치엔 변경 없음).

**원인**:
- 직전 main 머지 후 `git checkout claude/...` 누락
- 작업 시작 전 `git branch --show-current` 점검 안 함

**해법 패턴 (재사용, destructive op 없이)**:
```bash
# 1. claude 브랜치로 이동 + main의 새 커밋 fast-forward
git checkout claude/store-testing-checklist-XXX
git merge main --ff-only
# 2. claude push (정상)
git push origin claude/store-testing-checklist-XXX
# 3. main도 그대로 push (이미 같은 커밋)
git checkout main && git push origin main
```

**체크리스트 (모든 코드 작업 시작 전)**:
- [ ] `git branch --show-current` 출력이 `claude/...`인가
- [ ] 아니면 `git checkout claude/...` 먼저
- [ ] 커밋 직전 `git status`로 브랜치 한 번 더 확인

**교훈**: `reset --hard`/`push --force` 같은 destructive op 안 쓰고도 정리 가능. 새 커밋이 다른 브랜치에 보존되는 한, fast-forward 머지로 깔끔하게 흡수.

**관련**: 헌법 1-2(main 직접 push 금지), 헌법 11-2(백업 커밋), CLAUDE.md "Executing actions with care"

---

## 52. "분리 관리" 요청 받으면 차액 검증이 깨지는지 먼저 확인 (2026-04-29 기타매출)

**사건**: 사장님이 "마감정산에서 뽑기 매출 합산되면 안 될 것 같다, 따로 관리하자"고 요청. 즉시 코드 짜기 전에 **critic으로 모순 짚기**: "현금이 금고에 들어오는 매출인데 장부에서 빼면 차액이 항상 +가 됨". → 사장님이 설명 → "뽑기는 **기계 안 현금**이라 금고와 별개" → 모순 해소.

**교훈**:
- "합산 안 한다" = 차액 계산 로직과 직결. 무조건 분리 X. **현금 흐름이 어디로 가는지** 먼저 확인.
- 본 매출(POS) = 금고에 도착 → 장부합계 검증 대상
- 기타매출(뽑기) = 기계 안에 머무름 → 장부와 무관, 별도 패널
- 사장님이 비즈니스 의도를 정확히 말하지 않을 때, **숫자가 어디로 흘러가는지 한 번 더 묻는 게** 빠른 길.

**적용 패턴**:
```
"X를 분리하자" 요청 → critic 6질문 중 #2 "차액/합계가 깨지지 않나?" → 사장님 설명 → 진짜 의도 발견
```

---

## 51-A. ✅ 2026-04-29 추가 적용 — payment_methods 패턴 재사용

**계기**: 기타매출 동적 항목 작업.
- `payment_methods` 구조(매장별 동적, sort_order, legacy_key, soft-delete) 그대로 차용 → 99% 복붙으로 **2시간 안에 완성**.
- 시트 구조 + `loadXxx`/`renderXxxList`/`openXxxEdit`/`saveXxx`/`deleteXxx` 5종 함수 그대로 변수만 치환.
- 신규 가입 시 시드도 동일 패턴.

**교훈**: 한 번 검증된 동적화 패턴이 있으면 **새 도메인에 그대로 복제**. 새 패턴 발명하지 말 것.

---

## 51. 기존 데이터 있는 앱에 신규 가입 플로우 추가할 땐 하위호환 사수 (2026-04-24 Phase 1-A1)

> ⚠️ **2026-05-05 보완**: 본 항목의 "추가만, 수정 금지"는 **하위 호환 위험이 큰 특수 상황의 권고**이지, **잘못된 설계까지 영구 보존하라는 일반 원칙이 아니다**. 잘못된 전제·사용 모델 오해·잔재 누적이 분기를 폭증시킨 경우엔 **헌법 1-6(정당한 갈아엎기)에 따라 통째로 정리**한다. 본 항목 무한 적용으로 5월 5일 로그인 화면이 분기 5개 괴물이 됐고 사장님이 "왜 이렇게 헷갈리게 됐냐"고 분노 → 헌법 1-6 신설로 시정.

**사건**: Phase 1-A1에서 Supabase Auth 기반 신규 가입 플로우 추가. 사장님 첫 반응은 **"지금 논산에 등록해놓은 직원들은 어떻게 되는데?"** 기존 데이터 보호 여부에 대한 불안.

**원칙**:
1. **"추가만, 수정 금지"** — 신규 기능은 **기존 로그인·데이터 경로를 한 줄도 건드리지 않고** 별도 경로로 추가
2. 기존 owner/employee 데이터 **그대로 유지** (auth_user_id는 nullable)
3. 로그인 화면 **하단에만** 새 버튼 추가, 기존 매장 드롭다운·PIN 입력은 100% 유지
4. DB 마이그레이션도 **`ADD COLUMN IF NOT EXISTS`** — 기존 컬럼·데이터 안 건드림

**해법 패턴 (재사용)**:
1. 신규 가입은 `auth_user_id NOT NULL`, 기존 사용자는 `auth_user_id NULL` — 둘 다 공존 OK
2. `submitLogin`(PIN) 경로와 `submitOwnerLogin`(이메일) 경로를 **분리된 함수**로 (하나 망가져도 다른 쪽 영향 없음)
3. 기존 owner 계정 업그레이드는 **강제 아님** — 본인 원할 때 UI로 (별도 작업)
4. 마이그레이션 SQL은 **여러 번 실행 안전** (IF NOT EXISTS + DO 블록)

**체크리스트 (기존 서비스에 가입/auth 추가할 때)**:
- [ ] 기존 로그인 함수를 **한 글자도 수정하지 않았나**
- [ ] 기존 사용자가 기존 방식으로 계속 로그인되나
- [ ] 신규 필드는 nullable인가 (기존 행에 default 값 강제 없음)
- [ ] 마이그레이션 SQL이 실행돼 있든 안 돼 있든 **앱이 안 깨지는가**
- [ ] 사장님 불안 선제적 설명 (구현 전 "기존 데이터 그대로 둡니다" 명시)

**관련**: dev_lessons #46(자동 sync는 수동 수정본 덮지 말 것), #47(소스 통일), #50(공식 통일)과 함께 "**기존 데이터 절대 보호**" 4대 원칙 완성.

---

## 50. 같은 지표는 공식까지 동일해야 (순이익·적립금 사례) (2026-04-24)

**사건**: 수식 검수 중 `calcReserveBalance`(예비비 잔고)가 순이익을 **`매출 − 고정비` 근사**로 계산. 대시보드 `reserveAmt`는 **`매출 − 모든 비용`** 으로 계산. 같은 "적립금"인데 화면 2곳에서 **30~50% 차이**. 가상 시나리오(매출 33M)에서 193만 vs 130만.

**원인**:
- dev_lessons #47로 "**소스**는 단일 진실의 원천"이 정착됐지만, **수식** 자체는 각 화면에서 독립 구현
- 복잡한 순이익 계산(vendor+receipt+att+fixed+roy+cardFee) 대신 "그냥 매출-고정비로 근사하자" 타협이 코드에 박힘
- 대시보드와 잔고 계산이 **같은 데이터·다른 공식** 사용

**해법 패턴 (재사용)**:
1. **"소스 통일 + 공식 통일" 둘 다** 필요. dev_lessons #47에 공식 통일 명시 안 됨 → 이번 추가
2. 헬퍼 함수 추출 고려: `calcMonthlyNetProfit(ym, store)` 같은 공통 함수로 순이익 산출
3. 진행중 월은 고정비 일할, 완료 월은 전체 고정비 — **동일 규칙** 적용
4. 시나리오 대입 테스트로 두 화면 결과 **숫자 일치** 검증

**체크리스트 (같은 지표가 여러 화면에 있을 때)**:
- [ ] 동일 테이블·컬럼에서 읽나 (소스 통일)
- [ ] 동일 수식 사용하나 (공식 통일)
- [ ] 가상 데이터 1세트 투입 시 두 화면 숫자 일치하나
- [ ] 복잡한 계산은 공통 함수로 추출하나
- [ ] 진행중/완료 월의 일할 규칙 일관되나

**관련**: dev_lessons #47(소스 통일) + 이번(#50 공식 통일)로 "**단일 진실의 원천** 원칙" 완성.

---

## 49. 학습 규칙 keyword는 짧게 정규화 — contains 매칭 성립 조건 (2026-04-24)

**사건**: 영수증 저장 시 `saveReceipt`가 품목 전체 문자열("양파 10kg 2봉")을 그대로 `learnClassification` keyword로 저장. `classification_rules.match_type='contains'`라 다음 영수증에 "양파 5kg" 찍히면 `itemText.includes("양파 10kg 2봉")` → **false** → 학습 규칙이 **실질적으로 무력화**. 사장님은 "학습 안 된다"만 체감, 원인 오랫동안 미발견.

**원인**:
- 학습 로직(쓰기)과 적용 로직(읽기)이 **서로 다른 전제**를 가짐
- 학습: "구체적 품목 그대로 저장이 정확" (잘못된 가정)
- 적용: `contains` — keyword가 부분 일치해야 함
- 둘 사이 일관성 체크 없음

**해법 패턴 (재사용)**:
1. **`normalizeItemKeyword(item)`** 신규 — 품목의 첫 한글/영문 덩어리(2자 이상) 추출
   - "양파 10kg 2봉" → "양파", "삼겹살2kg" → "삼겹살", "생수500ml 12입" → "생수"
2. 학습 호출부에서 **반드시 이 함수 경유**
3. 적용(`applyRulesToReceipt`)은 **기존 contains** 그대로 — 이제 성립

**체크리스트 (학습/적용 쌍이 있는 곳)**:
- [ ] 저장하는 keyword와 매칭 로직의 전제가 일치하나
- [ ] 학습 데이터 **샘플 1건**을 실제 매칭에 넣어보는 유닛 테스트
- [ ] 사용자 "학습 안 된다" 보고는 keyword 내용부터 dump 확인 (적용 로직부터 보지 말 것)

**관련**: dev_lessons #25 "영수증 학습은 힌트가 아니라 규칙 덮어쓰기" — 그때 구조는 맞았지만 keyword 전략에서 이번 버그 내재. 오래 살아남음.

---

## 1. inline 핸들러 금지 (Cloudflare CSP) ✅ 2026-04-17 전수 제거
Cloudflare Pages가 `onchange="..."`, `onclick="..."` **조용히 차단**. 에러도 안 뜸.

```
❌ <input onchange="doSomething(this)">
❌ <div onclick="event.stopPropagation()">
✅ <div data-action="함수명|인자1|인자2">   ← 중앙 라우터가 처리
✅ <input data-change="함수명|this"> / data-input=...
```

**현재 구조 (index.html 1961~2008행, DOMContentLoaded 최상단)**:
- `_dispatchAction(attr, el)` 파서: `data-action="fnName|arg1|arg2"` 파싱
- 특수 토큰: `this` → 요소, `true`/`false`/`null`/`undefined` → 그대로,
  숫자(정수/소수/음수) → 자동 파싱, 그 외 → 문자열
- 복합 동작(다중 호출)은 래퍼로 등록 (navFromSide, editEmpAfterClose, setGanttDay 등)
- 인자에 `|` 문자가 들어가지 않도록 주의 (이름·라벨·UUID 모두 안전)
- `event.stopPropagation()`은 불필요 — `closest('[data-action]')`가 innermost 자동 선택

---

## 2. DOMContentLoaded에서 return 순서
`completeLogin(emp); return;`이 이벤트 바인딩보다 위에 있으면, 로그인된 사용자는 바인딩 안 됨.

```
DOMContentLoaded 안 순서:
1. 초기화 코드
2. 이벤트 바인딩 ← return보다 위에!
3. 로그인 복원 (return 가능)
```

---

## 3. sheet-overlay 이중 구조
두 가지 시트 구조가 공존:
- 일반: `<div class="sheet" id="...">`
- 오버레이: `<div class="sheet-overlay" id="..."><div class="sheet">`

`openSheet`/`closeSheet`이 둘 다 처리해야 함. sheet-overlay는 `#overlay` 안 켜야 함 (자체 배경).

---

## 4. category 이름 매핑
키워드 분류 결과와 expense_categories.name이 다르면 category_id가 null.
새 카테고리 추가 시 `CAT_NAME_MAP`도 업데이트. → `business_rules.md #5` 참조

---

## 5. 배포 전 체크리스트
1. `node --check` 구문 검사 (HTML은 `<script>` 블록만 awk로 추출)
2. main 머지 + push (브랜치만 push 아님!)
3. Ctrl+Shift+R 안내
4. 콘솔에서 `typeof 함수명` 확인
5. 실제 동작 테스트
6. **대규모 변경은 CLAUDE.md 제11조 절차 필수** (사전 스캔→백업 커밋→스크립트화→3단 검증→기록)

---

## 6. 사장님 힌트는 금이다
사장님이 증상 묘사 → 문자 그대로 해석할 것.
- "화면 어두워져" → overlay/배경 문제
- "클릭하면 사라져" → 이벤트 전파 문제
- "아무것도 안 돼" → 함수가 안 불리는 문제

---

## 7. DB 스키마 변경 시 자동 기록
테이블/컬럼 추가·변경 시 `db_schema.md` 즉시 업데이트.
코드에서 새 테이블 쓰는데 문서에 없으면 → 다음 세션에서 혼란.

---

## 8. 카드사 .xls는 HTML 위장 파일
카드사 다운로드 .xls 파일은 실제 HTML 테이블. SheetJS가 요약 테이블만 읽음.
```
해결: 파일 앞부분이 <html/<table이면 DOMParser로 파싱.
금융 키워드(이용일, 가맹점 등)로 실제 거래내역 테이블 자동 탐색.
```

---

## 9. 은행 엑셀 description = 적요+내용 합침 문제
기존 코드가 `적요 + ' ' + 내용`을 합쳐서 description에 저장.
적요(타행PC, FB자금 등)는 분류 코드라 표시에 불필요.
```
해결: 업로드 시 내용(content)만 description에 저장.
기존 데이터: cleanDesc()로 적요 패턴 제거 후 표시.
```

---

## 10. auth_level과 is_manager 동기화
`auth_level='staff'`인데 `is_manager=true`인 경우 권한이 무시됨.
`completeLogin`에서 반드시 is_manager를 보조 체크해야 함.
```
authLevel = emp.auth_level || 'staff';
if(authLevel === 'staff' && emp.is_manager) authLevel = 'store_manager';
```

---

## 11. 권한 변경은 반드시 UI에서
SQL 하드코딩으로 auth_level 설정하면 불일치 발생.
직원 편집 시트의 권한 드롭박스 → saveEmployee에서 auth_level + is_manager 동시 저장.
owner만 최초 1회 SQL 설정, 나머지는 앱에서.

---

## 12. 로그아웃 시 화면 초기화 필수
`doLogout()`에서 `closeAllSheets()` + 모든 컨테이너 리셋 + `applyPermissionUI()` 필수.
안 하면 이전 세션 화면이 그대로 남아서 권한 없는 사용자가 관리 화면 접근 가능.

---

## 13. 첫 방문 시 매장 선택 버튼
`currentStore`가 null이면 매장 선택 버튼 항상 표시.
`pd_auth_level` localStorage만으로 판단하면 첫 방문자가 매장 선택 불가.

---

## 14. 시간 표시는 24시간 형식
`toLocaleTimeString('ko')` 기본값은 "오후 04:16" (12시간). 모바일에서 공간 낭비.
```
❌ toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit'})  → "오후 04:16"
✅ toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})  → "16:16"
```

---

## 15. 횡스크롤 금지 — 한 화면에 표시
모바일 테이블에 `min-width`, `overflow-x:auto` 사용 금지.
`table-layout:fixed` + `colgroup`으로 칼럼 비율 고정.

---

## 16. 탭 전환 시 상태 초기화
다른 탭 갔다가 돌아오면 이전 상태(스크롤, 서브탭, 입력값)가 남아있음.
`nav()` 함수에서: `window.scrollTo(0,0)` + 첫 번째 서브탭 자동 선택 + 입력폼 리셋.

---

## 19. 모바일 다수 컬럼 문제 → 카드 요약 + 풀스크린 모달
모바일에서 엑셀처럼 다수 컬럼을 한 테이블에 넣으면 횡스크롤 or 글자 깨짐.
해결: 평소에는 토스 스타일 카드 요약(매출/지출/순이익), 상세 비교가 필요할 때
풀스크린 모달에서 피벗 테이블(항목=행, 날짜=열) 제공.
토스 스타일: 격자선 없음, 여백과 색상(컬러도트)으로 구분, 카드형.

---

## 18. 대시보드는 비율(%)이 생명
대시보드 수치에는 반드시 매출 대비 비율(%)을 함께 표시.
고정 금액만 보여주면 "많다/적다" 판단 불가.
비율이 있어야 "식자재 30% → 줄여야겠네" 같은 의사결정 가능.
월요약, 일별 카테고리, 주계 모두 비율 필수.

---

## 20. CSS rotate로 모바일 가로 전환 시 주의
`transform:rotate(90deg)` + `transform-origin:top left` + `left:vw px`.
CSS 클래스로 하면 vw/vh 단위가 부정확 → JS로 `window.innerWidth/Height` 직접 읽어서 px 설정.
풀스크린 모달은 body 직하위에 배치 (컨테이너 안에 넣으면 transform 좌표 꼬임).

---

## 21. 일별정산 catNames 하드코딩 문제 ✅ 해결됨
~~현재 `['식자재','직구/영수증','인건비','고정비','로열티/수수료']` 고정.~~
→ 2026-04-15 해결: expense_categories의 data_source 기반으로 동적 생성.
`srcToCat` 매핑으로 vendor_orders→카테고리명 자동 연결.

---

## 22. 금액/비율 리스트는 반드시 행열 정렬 (tabular-nums + table)
**⚠️ 최우선 규칙 — 사장님 강조사항**

숫자가 2행 이상 나열되면 **무조건 `<table>`** 사용. flex/div 금지.
세자리 콤마를 쓰는 이유가 끝자리를 맞춰서 한눈에 비교하기 위한건데,
flex로 하면 자릿수가 안 맞아서 의미 없음.

```
❌ flex + text-align:right → 항목마다 금액 위치가 들쭉날쭉
✅ <table> + font-variant-numeric:tabular-nums → 금액/비율 컬럼 완벽 정렬
```

**적용 대상 (빠짐없이)**:
- 월 요약 (매출/지출/순수익/예비비/실수익)
- 마감예상
- 지출 상세 아코디언 (카테고리별)
- 매출 상세 아코디언 (결제수단별)
- 급여 집계, 거래내역, 정산 등 모든 금액 리스트

**필수 규칙**:
- 이름 컬럼: 왼쪽 정렬 (`text-align:left`)
- 금액 컬럼: 오른쪽 정렬 + `font-variant-numeric:tabular-nums`
- 비율 컬럼: 오른쪽 정렬 + 고정 width
- 새 금액 리스트 만들 때 **말 안 해도 자동으로 table 적용**

---

## 23. 카테고리 하드코딩 금지 — DB expense_categories 직접 매칭
CAT_NAME_MAP 같은 매핑 테이블 하드코딩하면 카테고리명 변경 시 FK 깨짐.
```
❌ CAT_NAME_MAP = {'물품대금':'식자재(거래처)'}
✅ expense_categories.name 직접 매칭 (findCatId)
```
분류 변경 UI, 리뷰 드롭다운, saveExcelBatch 모두 DB에서 동적 생성.

---

## 24. 비활성 카테고리도 거래 있으면 집계에 포함
카테고리 삭제(is_active=false) 시 해당 월 거래 데이터가 사라지면 안 됨.
```
loadExpCategories: is_active 필터 없이 전체 로드
관리 UI/분류 변경: is_active 필터 적용
대시보드/정산: 활성 + 비활성(거래있는 달만) 포함
```

---

## 25. 영수증 학습은 "힌트"가 아니라 "규칙 덮어쓰기"
AI에 과거 데이터를 프롬프트로 넘기면(힌트): 무시할 수 있음, 프롬프트 비대, 비예측적.
```
❌ 프롬프트에 "바나나우유→간식" 힌트 삽입 (AI가 무시 가능)
✅ AI 응답 후 classification_rules 조회 → 카테고리 강제 덮어쓰기
```

---

## 26. birth_date를 주민번호 칸에 넣지 마라
직원 편집에서 `id_number || birth_date` fallback 사용하면,
birth_date("2025-06-01")를 주민번호로 파싱 → "1920-25-06" → DB 에러.
주민번호 없으면 빈칸. 절대 다른 필드로 fallback 금지.

---

## 17. HTML 요소 제거 후 JS 참조 확인
HTML에서 `empBirthInput` 제거 → JS의 `autoFormatDate(empBirthInput)` 에서 null 에러.
요소 ID 변경/삭제 시 JS에서 해당 ID 참조하는 곳 전부 grep 확인 필수.

---

## 27. 대규모 일괄 치환은 스크립트 + 3단 검증 (2026-04-17 Phase 1 교훈)
인라인 핸들러 251개를 수작업 Edit 반복 = 지옥. 스크립트화가 정답.
```
❌ Edit 200회 반복 → 실수·누락·토큰 소모 폭발
✅ /tmp/phaseN/convert.py 한 번 → 변환 카운트 자동 출력 → 3단 검증
```
**절차 (CLAUDE.md 제11조)**:
1. 사전 스캔: `grep -c`로 총수·`sort -u`로 유니크 패턴 측정
2. 백업 커밋 먼저 (롤백 지점)
3. Python 스크립트: 성공/실패 카운트 반드시 출력
4. 사후 3단 검증: 구문(`node --check`) + 잔재 grep + 샘플 육안
5. `work_log.md`에 수치 기록 + `dev_lessons` 갱신

---

## 28. RLS 비활성 상태에선 모든 쿼리에 store_id 필터 필수 (2026-04-17 Phase 2a 교훈)
Supabase RLS 비활성 + anon key 클라이언트 노출 = 매장 격리는 **코드 레이어가 유일한 방어선**.

```
❌ sb.from('attendance_logs').update(payload).eq('id', x)        ← 다른 매장 id로 위조 시 뚫림
✅ sb.from('attendance_logs').update(payload).eq('id', x).eq('store_id', currentStore.id)
```

**감사 자동화의 한계**:
- audit 스크립트가 `sb.from(...)` 다음 N줄만 보면 **payload 정의가 위에 있는 case는 false positive**
  (예: `const payload={store_id:currentStore.id,...}` 후 한참 아래에서 `.insert(payload)`)
- 1차 grep 결과는 사장님 중간 리포트 + 수동 검증 단계로 **반드시** 재확인
- Phase 2a 사례: audit 1차 C=17 → 수동 검증 후 진짜 C=5 (false positive 12건)

**원칙**:
1. insert/upsert payload — 변수 정의에 `store_id:currentStore.id` 명시 (관용)
2. select/update/delete — 무조건 `.eq('store_id', currentStore.id)` 또는 `sid` (간접 보호되더라도 명시적 추가)
3. PK `.eq('id', X).update/.delete` — 그래도 `.eq('store_id', ...)` 추가 (이론적 위조 차단)
4. 다음 단계: Supabase 콘솔에서 RLS 활성화 → DB 레이어 2차 방어 (Phase 2b)

---

## 31. Claude 샌드박스는 Supabase 직접 테스트 불가 (2026-04-17 Phase 2b 사고)
Claude 샌드박스 IP가 Supabase API allowlist에 없어서 curl로 RLS 동작 직접 검증 불가.
```
❌ curl /rest/v1/... → 403 "Host not in allowlist" (Origin 위조도 안 먹힘)
✅ 사장님이 앱에서 직접 동작 확인 → 유일한 검증 경로
```
**역설적 이점**: anon key 탈취돼도 Supabase 허용 도메인 밖에선 못 씀 → 이미 보안 방어막 존재.
**교훈**: 골든패스 "앱 테스트"는 Claude가 대체 불가. 역할 분담 명확히:
- Claude: 브랜치 작업/SQL 작성/docs/코드 정적 검증
- 사장님: 앱 버튼 누르기 (실제 동작)

---

## 30. RLS 1차 활성화는 USING(true) + WITH CHECK로 무중단 (2026-04-17 Phase 2b)
Supabase RLS를 갑자기 엄격하게 켜면 anon key 앱이 전부 정지. 점진적 강화 전략.

**1차 정책** (Phase 2b):
```sql
ALTER TABLE public.X ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.X
  FOR ALL TO public
  USING (true)                        -- 읽기 전부 허용 (앱 무중단)
  WITH CHECK (store_id IS NOT NULL);  -- 쓰기 시 store_id 필수 (스키마 정합성)
```

**효과**:
- 코드 레이어 `store_id` 필터(Phase 2a 완료)와 2중 방어망
- store_id 누락 INSERT는 DB에서 차단 → 다음 매장 추가 시 실수 방지
- 앱 재배포 불필요, 기존 세션도 정상 동작

**주의**:
- `FOR ALL` = SELECT/INSERT/UPDATE/DELETE 단일 정책으로 커버
- `TO public` = anon + authenticated 둘 다. `TO authenticated` 쓰면 anon 접근 막힘 → 앱 정지
- 부모 테이블(store_id 없는 stores, franchises)은 유보
- 자식 테이블(expense_category_amounts, fixed_cost_amounts)도 store_id 있음 확인 후 포함

**2차 정책** (Phase 2c 이후):
- Cloudflare Worker 프록시 + JWT 인증 도입 후
- `USING (store_id = (auth.jwt() ->> 'store_id')::uuid)` 식 엄격화

**롤백**:
- 실패 시 즉시 `phase2b_rls_rollback.sql` 실행 (DROP POLICY + DISABLE RLS)
- 정책 네이밍 `pd_phase2b_all` 컨벤션으로 향후 찾기 쉬움

---

## 32. 백그라운드 상태 변화는 명시적 피드백 필수 (2026-04-20)
기기 지문 자동 등록 같이 **사용자 모르게 일어나는 상태 변화**는 2초 토스트로는 부족.
사장님조차 "등록됐는지 안됐는지 모름"이라고 불만. 팝업으로 강제 인지시키는 게 UX 정답.

```
❌ 첫 출근 시 조용히 자동 등록 + 2초 toast → 못 봄
✅ 로그인 직후 팝업 3상태(미등록/일치/불일치) + 명시적 버튼
```

**원칙**:
- 보안/권한/식별자 같은 "중요한 자동 상태 변화"는 토스트 금지 → 팝업
- 일치(정상) 상태는 자동 닫힘(3초)으로 흐름 방해 최소화
- 불일치 상태는 **해결 방법 명시**(재로그인 or 관리자 초기화 요청)
- 관리자 계정은 여러 기기 쓰므로 **팝업 스킵** 필요

**구현 위치**: index.html `showDeviceStatusPopup` (6250~6329), `completeLogin` 끝에 staff 한정 호출.

---

## 33. mydata_transactions.category_id = 항상 대분류 id (2026-04-21)
`expense_categories`가 parent_id로 2단계 트리인데, mydata_transactions.category_id가
소분류 id인지 대분류 id인지 **규칙이 없었음** → 혼용 → 대시보드 집계 5474행
`t.category_id === cat.id` 1:1 매칭이 소분류 건을 누락 → 수치 틀어짐.

**사장님 진단**: "소분류 fk 안돼있는듯 / 계산수식 틀어짐"

**범인 3곳**:
1. `saveExcelBatch.resolveCatId` (구버전): 이름만 매칭 → 소분류 선택 시 소분류 id 저장
2. `openCatEdit` 저장(구버전 6051): `category=selected, sub_category=selected` 동일 덮어씀
3. 확인필요 시트 `<input placeholder="소분류">` 자유 입력 → DB에 없는 소분류명 주입

**해결 규칙 (2026-04-21 확립)**:
```
mydata_transactions.category_id = 항상 대분류 id (parent_id IS NULL인 카테고리)
mydata_transactions.sub_category = 소분류명 text (FK 아님, 참고용)
```

**구현**:
- `resolveCatPair(catName)` — 대분류/소분류 이름 구분해서 `{mainId, mainName, subName}` 반환
- `saveExcelBatch.resolveCatPayload` — "A>B" 합쳐진 포맷 + 소분류명만 있는 포맷 양쪽 처리
- `openTxEditSheet/saveTxEdit` — 편집 저장 시 pair.mainId를 category_id에 고정
- 확인필요 시트 `<input>` 제거 → `<select>` 한 개로 통일

**마이그레이션**: `docs/sql/migrate_tx_category_id_to_parent.sql` (기존 소분류 id 박힌 거래 → 부모 id로 치환 + sub_category에 소분류명 채움)

**교훈**: DB 컬럼 2개(category_id + sub_category)로 계층을 표현할 때는 **어느 쪽이 어느 레벨을 담는지** 처음부터 못 박을 것. 이름 기반 매칭은 계층 혼동 사각지대.

---

## 34. 분류 셀 세로 2줄 표시 (2026-04-21)
모바일 테이블은 가로 폭 부족 → "대분류>소분류" 한 줄 동시 표시 불가.
분류 셀을 **세로 2줄**로 쌓는 편이 공간 효율 최고.

```
❌ 분류 셀 탭 → 말풍선 → 확인하려면 매번 탭 (피곤)
❌ 내용 칸 줄이고 분류 칸 늘림 → 내용이 잘려서 뭐가 뭔지 모름
✅ 대분류 9px gray + 소분류 11px 진하게, line-height:1.1 → 행 +8px만
```

소분류 없는 행은 자연스럽게 1줄(대분류만). 폭 증가 0.

---

## 35. 거래 편집은 분류만이 아니라 5필드 전체 (2026-04-21)
분류만 수정 가능하게 만들면 **금액 오타·날짜 오류는 수정 경로 없음**. 사장님 불만.
```
❌ 분류 셀 탭 → 분류만 수정 (금액/날짜 수정 불가)
✅ ✎ 편집 버튼 → 날짜/내용/분류/입금/출금/정산제외 6필드 통합 시트
```

**tx_hash C안 원칙**: 편집해도 원본 지문 **그대로 둠**. 지문은 "이 엑셀 거래가 이미 들어왔다"는 사실을 표시하는 것이지, 현재 값이 아니라 **원본 값의 고유번호**. 재업로드 중복 차단 정상 작동.

---

## 36. 제안 전 FK 전수 점검 필수 (2026-04-21 회고)
사장님이 "지출카테고리 구조 바꾸자"고 하실 때 바로 방법론 3가지 제시했으나 **FK 정합성은 건너뜀**. 사장님 "지금 fk 고려 됐어요?" 한 마디에 검토하니 **6군데 미점검**이 드러남.

**범인 (점검 누락)**:
- `vendors.category` 선택지 변경 시 기존 저장값 무효화
- `expense_categories.data_source` 단일값 → 다중 소스 합산 불가
- `receipts.category_id` 규칙이 mydata와 다름 (통일 안 됨)
- `classification_rules` 시드 명칭이 카테고리명과 어긋남
- `expense_category_amounts` / `reconciliation` 소분류 지원 여부

**교훈**:
```
❌ 사장님 요구 → 방법론 3안 제시 → 추천 → 바로 구현
✅ 사장님 요구 → FK 영향 테이블 전수 나열 → 각 대응안 포함 → 방법론 제시 → 추천
```

**원칙**:
1. 카테고리/태그/상태 같은 **분류 체계 변경**은 무조건 관련 테이블·컬럼 전수 나열부터
2. 다중 `data_source` 집계가 끼면 대시보드·정산 집계 함수 **전체 분기 재검토**
3. 이전 세션에서 확립한 규칙(예: dev_lessons #33)과 **일관성 유지** 확인 — 기존 규칙을 깨는 제안이면 명시적으로 표시
4. **사장님이 "고려됐어?"라고 묻기 전에** 내가 먼저 나열해야 함

---

## 37. composite data_source — 대분류만 루프, 소분류는 details로 (2026-04-22)
식자재 대분류가 거래처(vendor_orders) + 영수증(receipts) 둘 다 합산하는 구조에서,
대분류/소분류 둘 다 집계 루프에 참여하면 **이중 집계** 발생.

```
❌ catsForAggregation = 모든 expense_categories (대+소 둘 다)
   → 식자재 = 300만 (대분류) + 육류 100 + 야채 80 + 공산품 120 = 총 600만 (이중)
✅ catsForAggregation = composite 소분류는 스킵
   if(c.data_source==='composite' && c.parent_id) return false;
   → 대분류만 집계 + 소분류는 reconcileRender의 details로 펼침
```

**집계 로직 (calcExpenseByCategories, reconcileRender 동일)**:
- 대분류 composite: 자식들 `vendor_category` 전부 + 자식 id로 된 receipts + 본인 id receipts
- 소분류 composite: 본인 `vendor_category` + 본인 id receipts (단, 소분류는 loop skip)

**장점**:
- 대분류 집계는 자식 합과 **반드시 일치** (자식 vendor_category들을 모두 포함하므로)
- 소분류 세부 금액은 `details` 배열에서 표시 (아코디언 펼칠 때)

**교훈**: 부모-자식 구조에서 집계 루프 설계할 때 **이중 집계 방지 필터** 반드시 적용. 설계 단계부터 점검.

---

## 38. receipts.category_id = 소분류 id (mydata와 규칙 다름) (2026-04-22)
`mydata_transactions.category_id` = 대분류 id (dev_lessons #33). 그런데 receipts는 **소분류 id**.
왜 규칙이 다른가? 데이터 출처 특성이 다름.

```
mydata: 은행/카드 출금. description = "양두현" (거래처명만). 품목 알 수 없음 → 대분류가 맞음
receipts: 영수증 직접 촬영. item = "양파 10kg" (품목 명시) → 소분류까지 확정 가능
```

**집계 처리 (calcExpenseByCategories receipts 분기)**:
```
// 대분류 receipts면 자식 id도 포함 (소분류 미지정 receipts까지 잡기)
const childIds = expCategories.filter(c=>c.parent_id===cat.id).map(c=>c.id);
const targetIds = [cat.id, ...childIds];
// category_id IN targetIds
```

**교훈**: FK 저장 규칙은 **테이블별로 다를 수 있음**. 모든 FK를 "대분류 id 고정" 같은 단일 규칙으로 통일하려 하지 말 것. 데이터 특성에 맞게 규칙 분화.

---

## 39. 하드코딩/미리-INSERT 금지, DB UI 관리 원칙 (2026-04-22 사장님 지적)
카테고리 신설 기능 만들면서 매출 소분류 4개(카드결제/QR결제/현금입금/송금결제)를 SQL로 미리 INSERT 하자고 제안 → **사장님 반려**.

```
❌ 제안: 예상되는 소분류를 미리 DB에 박음
   → 사장님이 필요 없는 항목까지 들어감
   → 코드 수정 없이 데이터 변경 불가능 (제10조 2번 위반)
✅ 올바름: 관리 UI만 만들고, 사장님이 필요할 때 필요한 만큼 추가
   → DB 편집 = 앱 UI로만 (하드코딩/SQL INSERT 최소화)
```

**원칙 (헌법 제10조 2번 "관리 편의성")**:
1. 카테고리/태그/분류 같은 **사용자 관리 대상** 데이터는 **절대 SQL로 시드 INSERT 하지 말 것**
2. 관리 UI(추가/편집/삭제) 먼저 만들고, 사장님이 직접 입력
3. 스키마 변경(ALTER TABLE)은 필요, 데이터 변경은 UI로
4. 내가 "편의를 위해 기본값 몇 개 미리 넣어둘게요"는 유혹 → **참아야 함**
5. 사장님이 "기본값 넣어주세요"라고 **명시 요청**할 때만 INSERT

**예외** (INSERT 해도 되는 경우):
- 마이그레이션 필수 (기존 데이터 구조 보존): 2026-04-22 식자재 개편의 '식자재/육류/야채/공산품' 
- 시스템 상수 (사용자 편집 불필요): country 코드, 통화 코드 등

**교훈**: 사장님은 "내가 틀릴 수도 있음을 항상 감안해라"고 하셨지만, 이번은 내가 확실히 틀렸고 사장님이 맞았다. 동일 지적 반복되지 않도록 주의.

---

## 40. 동적 DOM 바텀시트는 sheet-overlay 패턴 사용 (2026-04-22)
`document.body.appendChild(sheet)` + 인라인 `position:fixed; top:0; bottom:0;`로 바텀시트 만들면 **화면 중간에 떠버리는 버그** 발생.

```
❌ const sheet=document.createElement('div');
   sheet.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;...';
   document.body.appendChild(sheet);
   → containing block 이슈로 중간에 뜸
✅ HTML에 미리 <div class="sheet-overlay" id="..."><div class="sheet">...</div></div> 정의
   → 기존 openSheet/closeSheet 호출
```

**원인 추정**:
- body에 `overflow-x:hidden; overflow-y:auto; position:relative; max-width:100vw`
- 기존 `.sheet`의 transform 조상이 자손 position:fixed의 containing block을 바꿈
- 이론적으로 body 직접 append면 영향 없어야 하지만, 모바일 브라우저에서 전체 화면 안 덮음

**해결**:
1. `<div class="sheet-overlay" id="catPickerSheet" style="z-index:7000;"><div class="sheet" id="catPickerBox" style="z-index:7001;...">...</div></div>` HTML에 미리
2. 동적 함수는 `.sheet` 내부 innerHTML만 갱신
3. `openSheet('catPickerSheet')` / `closeSheet('catPickerSheet')` 호출

**z-index 위계 (2026-04-22 확정)**:
- `.bottom-nav`: 1000
- 필터 팝업: 1100 + margin-bottom:72px (네비바 회피)
- `.sheet-overlay`: 6000, `.sheet`: 6001 (기본 바텀시트)
- 중첩 바텀시트 (예: 분류 선택): 7000 / 7001

---

## 41. 정렬 UX는 3단계 토글 (오름 → 내림 → 해제) (2026-04-22)
사장님 "정렬 걸었을 때 원상태로 가는 방법 없다" 지적.

```
❌ 2단계: 오름↑ ↔ 내림↓ (해제 불가, 계속 정렬 유지)
✅ 3단계: 오름↑ → 내림↓ → 해제 (sortCol=null, 원상태)
```

**구현**:
```js
if(sortCol===col){
  if(sortAsc){sortAsc=false;}        // 오름 → 내림
  else{sortCol=null;sortAsc=true;}   // 내림 → 해제
}else{sortCol=col;sortAsc=true;}
```

**UX 보강**:
- 활성 헤더 색상 강조 (파란색 + 굵게 + 연한 파랑 배경)
- 화살표 △▽ → ↑↓ (굵고 명확)
- title 툴팁: '한 번 더 누르면 정렬 해제'

---

## 42. 카테고리 선택은 3단계 드릴다운 + 시스템 카테고리는 바로 선택 (2026-04-22)
바텀시트에 모든 카테고리 다 펼치면 가시성 떨어짐. 타입별 드릴다운으로 분리.

```
1단계: 타입 선택
  ├ 💸 지출 › (드릴다운)
  ├ 💰 매출 ›
  ├ 🚫 정산제외 ›
  ├ 📸 영수증 참조 (바로 선택)
  └ 🏦 예비비 사용 (메모 prompt 후 바로 선택)

2단계: 대분류 리스트 (선택한 타입)
  - 자식 있음 → '›' 표시, 탭 시 3단계
  - 자식 없음 → 바로 선택

3단계: 소분류 리스트
  - 최상단 '대분류 (소분류 없이)' 옵션 포함
  - 각 소분류 선택 → '대분류>소분류' 반환
```

**교훈**:
- 시스템 카테고리(영수증 참조/예비비)는 하위 구조 불필요 → 1단계에서 즉시 선택
- 사용자 관리 카테고리(지출/매출/제외)는 드릴다운으로 정리
- 개수 힌트("11개") 같은 건 사장님이 불필요하다고 판단 → 제거

---

## 43. resolveCatPair에 '>' 분리 로직 필수 (FK 일관성) (2026-04-22)
바텀시트가 `대분류>소분류` 형식의 문자열 반환. applyReviewChoice/saveTxEdit/saveExcelBatch 모두 resolveCatPair 호출.

**문제**: resolveCatPair('식자재>육류') → DB에 그 이름 카테고리 없음 → `{mainId:null, mainName:'식자재>육류'}`
→ item.category='식자재>육류'로 저장 → FK 깨짐 + UI 표시 이상

**해결**: resolveCatPair 입력에 '>' 있으면 **분리 후 DB 조회**:
```js
if(catName.includes('>')){
  const parts=catName.split('>').map(s=>s.trim());
  const subName=parts.pop();
  const mainName=parts.join('>');
  const mainCat=expCategories.find(c=>c.name===mainName&&!c.parent_id);
  const subCat=mainCat?expCategories.find(c=>c.name===subName&&c.parent_id===mainCat.id):null;
  return {mainId:mainCat?.id||null, mainName:mainCat?.name||mainName, subName:subCat?.name||subName};
}
```

→ 모든 저장 경로에서 **대분류 id 고정** 규칙(dev_lessons #33) 자동 준수.

---

## 29. 세션 시작 시 `git fetch --all` 필수 (2026-04-17 Phase 2a 사고)
새 Claude Code 세션이 시작되면 **로컬 git은 이전 세션의 snapshot**. 원격에서 다른 세션/사장님이 push한 커밋은 모른다.

**실제 사고**:
- 사장님이 "Phase 0·1 main 머지 완료 (커밋 8453bbd)"라고 알림
- Claude는 로컬 main(`d57cd11`) 기준으로 "8453bbd 존재하지 않음"이라고 **잘못 단정**
- 사장님이 `git fetch --all` 지시 후 확인 → 로컬이 **54커밋 behind**였음
- 두 번 반복됨 (사과 후에도 같은 실수)

**교훈**:
```
❌ git log --all --oneline | grep XXX  → 없으면 단정
✅ git fetch --all 먼저 → 그다음 판단
```

**절차**:
1. 세션 시작 첫 bash 명령에 `git fetch --all` 포함
2. 로컬 브랜치 behind/ahead 확인 (`git status`, `git log HEAD..origin/main`)
3. 사장님이 "X 커밋 있음"이라 하면 grep 없으면 **fetch 먼저 의심**
4. MCP GitHub 도구(`mcp__github__get_file_contents`, `list_commits`)도 원격 fresh 상태 보여줌 — 적극 활용

---

## 48. todo/메모의 진단을 검증 없이 전달 금지 (2026-04-23 ⑫ 오진단 사건)

**사건**: `todo_next_session.md` ⑫에 "거래내역 테이블에 📸 영수증 배지 추가 — 마감정산엔 있고 거래내역엔 빠짐"이라 적혀있어 그대로 사장님께 "쉽게 설명" 요청 시 **상상한 UX 시나리오**로 답함. 사장님 반박("마감정산 탭에 영수증 거래내역이 어딨어")으로 3분 이상 시간 낭비. grep 돌려보니 거래내역에 이미 `📸 영수증 참조` 표시 존재, todo 진단 자체가 틀림.

**원인**:
- todo 메모는 과거 세션의 **초안/가설**인데 **사실**로 취급함
- "쉽게 설명"하라는 요청에 `grep` 1초면 확인될 걸 **추측으로 시나리오 지어냄**
- 사장님 반박 받고 나서야 처음으로 코드 확인 — 선제적 검증 누락

**원칙 위반**:
- CLAUDE.md 제3조 "**작동하는 결과물로 답한다**" → 추측으로 답함
- dev_lessons #45 "**critic v2 만들어놓고 본인이 안 지킴**" → 같은 패턴 반복

**해법 패턴 (새 세션·재확인 시 무조건)**:
1. todo/이전 세션 메모의 기술 진단은 **항상 `grep`으로 현재 코드와 대조** 후 전달
2. "이미 있다", "빠져있다", "N곳 있다" 같은 **수치·존재 주장은 grep 결과로만** 말하기
3. 사장님께 "쉽게 설명" 요청 받아도 **코드 확인 먼저 → 그 다음 설명**
4. 검증 안 된 진단은 "**todo 메모이지 사실 확인은 안 했습니다**" 명시

**체크리스트 (todo 기반 계획 전)**:
- [ ] 각 항목의 "이미 있다/없다" 주장을 grep으로 검증
- [ ] 함수명/라인 번호가 현재 코드와 일치하는지 확인
- [ ] 설명할 UX 시나리오가 **실제 화면 구조와 맞는지** 확인 (상상 금지)
- [ ] todo 작성 시점 이후 변경사항 있는지 work_log 크로스체크

**재발 방지 문구 (작업 전 속으로 읊기)**:
> "메모는 힌트일 뿐. 코드가 진실이다. grep 안 돌렸으면 사실로 말하지 말자."

---

## 47. 같은 지표는 단 하나의 소스에서만 (2026-04-23 대시보드 sales_daily 통합)

**사건**: 대시보드는 `settlements.items_json` 조회, 매출 관리는 `sales_daily` 조회. 사장님이 매출 관리에서 금액 고쳐도 대시보드는 **원본 마감정산 기준**이라 영원히 안 맞음.

**원인**:
- `syncClosingToSalesDaily`는 settlements → sales_daily 단방향 복사
- sales_daily 수정본은 settlements로 역류하지 않음 (의도적, 원본 보존)
- 결과: 두 테이블이 "한 번은 같고 그 뒤는 다름"

**해법 패턴 (재사용)**:
1. **파생 데이터는 하향 전용**: 원본(settlements) → 파생(sales_daily)으로만 흐름. 양쪽 조회 금지.
2. **UI/보고는 최종 파생 테이블만 조회**: 대시보드, 리포트, 집계는 모두 sales_daily 같은 최종 소스에서.
3. **원본 테이블(settlements)은 입력 로그/감사 용도**: 마감정산 탭에서만 표시.
4. **전환 시 백필 SQL 필수**: `NOT EXISTS` 가드로 기존 파생 행 보호.
5. **롤백 SQL은 memo/source 조합으로 식별**: 백필로 생긴 행만 지워지도록.

**체크리스트 (같은 지표가 여러 테이블에 있을 때)**:
- [ ] 소스 → 파생 관계 명확히 문서화 (db_schema.md)
- [ ] UI는 **파생만** 조회, 원본은 입력/감사에만
- [ ] 파생 테이블에 수동 편집 흔적(`source='..._edited'`) 구분 컬럼
- [ ] 원본 재저장 시 파생 수정본 보호 로직 (#46과 연결)
- [ ] 전환 시 백필 + 롤백 SQL 세트 필수

**관련**: dev_lessons #46 (수정본 보호) + 이번 통합으로 sales_daily가 **매출 단일 진실의 원천**으로 확정.

---

## 46. 자동 sync는 수동 수정본을 덮어쓰지 말 것 (2026-04-23 closing_edited 도입)

**사건**: `sales_daily` 행을 사장님이 손으로 고쳐도, 같은 날 마감정산 재저장 시 `syncClosingToSalesDaily`가 **upsert onConflict**로 무조건 덮어씀 → 수동 수정 사라짐.

**원인**:
- sync 함수가 `source` 컬럼을 **쓰기만** 하고 **읽지 않음**
- upsert는 편하지만 "이미 있는 행의 상태"를 고려하지 않는 blind write

**해법 패턴 (재사용)**:
1. 자동 sync 전에 기존 행의 `source`(또는 `edited_at`, `user_locked` 플래그) **먼저 조회**
2. 사용자 편집 흔적이 있으면 **스킵** + `{skipped:true}` 반환 (throw 금지)
3. 호출부에서 skipped 여부로 토스트 메시지 분기
4. 수동 편집 시 저장 쪽에서 `source` 를 `edited` 변종으로 자동 승격 (사장님 별도 조작 불필요)

**체크리스트 (자동-수동 데이터 혼재 테이블 다룰 때)**:
- [ ] 자동 소스(`closing` 등)와 수동 편집을 구분할 컬럼 있나
- [ ] 수동 편집 저장 시 source 승격 로직 있나
- [ ] 자동 sync에서 기존 행 조회 후 분기 있나
- [ ] sync 실패/스킵을 **사용자에게 토스트로 알림** (console.error만 → 금지)
- [ ] 뱃지/아이콘으로 수정본 여부 시각화

**관련**: 이번 수정으로 `source='closing_edited'` 값 추가 (db_schema.md sales_daily 컬럼 주석 갱신).

---

## 45. 사용자 UX 는 DB 스키마보다 강하다 (2026-04-23 sales_records 폐기 사건)

**사건**: sales_records 세로 raw 설계 (`payment_method` 컬럼) → 사장님 즉각 반발:
- 월 180행 쌓여 "결산 비효율"
- 결제수단 드롭다운 12개 자의적 하드코딩 → "직관적이지 못함"
- 모바일에서 "짤려 안 짤려" 걱정
- 사장님 제안: "날짜 현금 현금영수증 카드 QR 기타 총금액 이렇게 하는게 안 나음?"

**원인**:
- DB 정규화(3NF)에 집착 → `payment_method` 컬럼에 모든 결제수단 값 묶기
- 엔지니어 관점에서는 "확장성/미래 API 유리"
- **사장님(도메인 전문가) 관점에서는 "매일 본다는데 눈 아픔"**

**교훈**:
1. 사장님이 **"엑셀처럼"** 이라고 하시면 → **가로형 피벗**이 맞다. 세로 raw는 DB 정석이지만 사람 눈엔 무거움
2. 컬럼 7개 = 모바일 표 불가. **카드형 UI**(세로 스크롤 + 그리드 내부)가 모바일 정답
3. 하루 1행 보장(UNIQUE) = upsert 1번으로 끝. 세로 raw는 DELETE+INSERT N번
4. 미래 API 대비는 `source` 컬럼 1개로 충분. 스키마까지 추상화하면 오버엔지니어링
5. **critic v2 PD1 (FK 근본) / PD3 (유령 데이터) 제가 만들어놓고 본인이 안 지킴** — 기존 마감정산 UI 라벨·구조 재확인 안 하고 items_json 키만 보고 설계
6. 사장님 제안 무시하지 말 것. 엔지니어적 "옳음"보다 **사용자 일상 루틴에 맞는 것**이 이긴다

**체크리스트 (다음 매출/거래 관련 작업 전)**:
- [ ] 기존 마감정산 / 거래내역 UI의 **실제 화면 라벨** 재확인 (HTML grep)
- [ ] 사장님이 **"한 눈에 본다"** 맥락이면 피벗/카드형 검토
- [ ] 월 N행 쌓이는 설계는 모바일 불리 (스크롤 무한)
- [ ] 컬럼 수가 모바일 375px에 안 맞으면 카드형 전환
- [ ] DB 스키마 결정 전 **사장님에게 목업 1장 보여주고 OK** 받기

---

## 44. 외부 프레임워크 흡수는 "사고법만, 인프라는 버린다" (2026-04-23 gstack critic 도입)

**삽질 직전 멈춤:** gstack(garrytan/gstack) 적용 요청 시 원본 `SKILL.md` 2100줄 중 약 800줄이 telemetry/config check/세션 관리 bash 코드. 그걸 그대로 가져왔다면 `~/.claude/skills/gstack/bin/gstack-config` 같은 존재하지 않는 경로 참조로 **전부 실패**.

**원칙**:
- 외부 AI 프레임워크 흡수 시 **사고법·질문·패턴**만 한국어로 번역해 가져온다.
- **버릴 것**: preamble bash, telemetry 로깅, config check, 세션 관리, 설치 경로 참조, 외부 CLI 호출
- **가져올 것**: 6강제질문, 반-아부 규칙, 푸시백 패턴, 4가지 검토 모드, CEO 사고 패턴
- 비즈니스 맥락도 번역 필요: "founder" → "사장님", "enterprise" → "매장", "waitlist" → "관심 있다고 말만 하는 직원/점장"

**확인 체크리스트**:
- [ ] 흡수한 문서에 존재하지 않는 경로 참조 있나? (grep `~/.claude`, `bin/`)
- [ ] 외부 CLI 호출 코드 남아있나? (grep `curl`, `source <(`, `eval`)
- [ ] 비즈니스 용어가 식당/매장 맥락에 맞게 번역됐나?
- [ ] 기존 에이전트 역할과 겹치지 않게 경계가 명확한가?

**교훈**: 외부 도구의 **실행 인프라**는 그 도구의 세계에서만 돌아간다. 우리 세계에선 **사고법**만 쓸모 있다.
