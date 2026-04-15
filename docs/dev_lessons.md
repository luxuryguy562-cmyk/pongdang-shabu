# 개발 교훈 (Dev Lessons)

> 같은 실수 반복 방지. **새 세션 시작 시 필독.**

---

## 1. inline 핸들러 금지 (Cloudflare CSP)
Cloudflare Pages가 `onchange="..."`, `onclick="..."` **조용히 차단**. 에러도 안 뜸.

```
❌ <input onchange="doSomething(this)">
❌ <div onclick="event.stopPropagation()">
✅ element.addEventListener('change', function(){ ... });
✅ DOMContentLoaded에서 바인딩
```

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

## 18. 대시보드는 비율(%)이 생명
대시보드 수치에는 반드시 매출 대비 비율(%)을 함께 표시.
고정 금액만 보여주면 "많다/적다" 판단 불가.
비율이 있어야 "식자재 30% → 줄여야겠네" 같은 의사결정 가능.
월요약, 일별 카테고리, 주계 모두 비율 필수.

---

## 17. HTML 요소 제거 후 JS 참조 확인
HTML에서 `empBirthInput` 제거 → JS의 `autoFormatDate(empBirthInput)` 에서 null 에러.
요소 ID 변경/삭제 시 JS에서 해당 ID 참조하는 곳 전부 grep 확인 필수.
