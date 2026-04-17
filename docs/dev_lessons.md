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
1. `node --check` 구문 검사
2. main 머지 + push (브랜치만 push 아님!)
3. Ctrl+Shift+R 안내
4. 콘솔에서 `typeof 함수명` 확인
5. 실제 동작 테스트

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
