# 개발 교훈 (Dev Lessons)

> 같은 실수 반복 방지. **새 세션 시작 시 필독.**

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
