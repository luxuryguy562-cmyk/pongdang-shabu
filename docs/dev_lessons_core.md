# 개발 교훈 핵심 (Dev Lessons Core)

> **매 세션 시작 시 필독.** 전체 아카이브는 `docs/dev_lessons.md` 참조.
> 항목당 "함정 → 해결" 2줄 원칙.

---

## #54 날짜 — `toISOString()` = 한국 자정 하루 빠짐

`toISOString().split('T')[0]` → UTC 기준이라 KST 자정(00:00~08:59) 구간에서 하루 전 날짜 반환.  
**해결**: `ymdLocal()` 헬퍼 사용 (KST 로컬 기준 YYYY-MM-DD 반환).

---

## #58 금액 입력란 — `type="number"` 금지

`type="number"` → iOS에서 숫자 키패드 안 뜸, 천단위 포맷 깨짐.  
**해결**: `type="text" inputmode="numeric"` 필수.

---

## #65 `location.reload()` — 자동 로그인 화면 점프

`reload()` 호출 시 세션 상태 재평가 → 로그인 페이지로 튀는 경우 발생.  
**해결**: 명시적 상태 갱신 (`await loadXxx()` + DOM 업데이트) 으로 대체.

---

## #68 `closeAllSheets()` — 부모 시트까지 닫힘

중첩 시트에서 `closeAllSheets()` 호출 시 부모 시트도 함께 닫힘.  
**해결**: 자식만 닫으려면 `closeSheet(id)` 사용, context 분기 필수.

---

## #71 자정 넘는 시간 — 다음 날 자동 처리

출근 23:00, 퇴근 03:00 → `datetime-local` 미처리 시 퇴근 < 출근으로 계산 오류.  
**해결**: `datetime-local` 또는 +24h 자동 보정 로직 필수.

---

## #72 거래처 화면 진입 — fresh 데이터 강제 로딩

캐시된 거래처 목록 표시 → 다른 기기 추가분 미반영.  
**해결**: 거래처 화면 진입 시 항상 `await loadVendors()` fresh 호출.

---

## #83 카테고리 드릴다운 — `parent_id` 하드코딩 금지

자식 카테고리 필터를 특정 ID 값으로 하드코딩 → 다른 매장에서 오작동.  
**해결**: `parent_id` 동적 참조 (DB에서 조회), 하드코딩 절대 금지.

---

## #91 CSS Grid `1fr` — `minmax(0,1fr)` 강제

`grid-template-columns: 1fr` → 내용물 길이에 따라 셀이 밀림.  
**해결**: `minmax(0, 1fr)` 강제 적용 (overflow 차단).

---

## #93 목업 — 텍스트 목업 → HTML 목업으로 업그레이드됨

> ⚠️ 2026-06-02 갱신: 텍스트(ASCII) 목업은 HTML 목업으로 교체됨 — `agents/designer.md` 규칙 #10 참조.

글 설명·ASCII 와이어프레임만으론 사장님이 실제 화면 예측 불가.  
**해결**: UI 변경 시 `docs/mockups/YYYY-MM-DD_<기능명>_v1.html` HTML 파일로 저장, 브라우저에서 직접 확인 후 사장님께 스크린샷 제출.

---

## #103 iOS Safari `thead th sticky` — 행 높이 0

`th { position: sticky; top: 0 }` → iOS Safari에서 sticky 헤더 행 높이 0으로 렌더링.  
**해결**: `sticky` 속성을 개별 `th`가 아닌 `<thead>` 자체에 적용.

---

## #112 통합 PR — DB 스키마 SQL 누락 체크

여러 기능 통합 PR 시 DB 스키마 추가 SQL이 누락되는 경우 발생.  
**해결**: PR 올리기 전 `docs/db_schema.md` 변경사항과 SQL 마이그레이션 파일 1:1 대조 필수.

---

## #116 갈아엎기 후 — 옛 DOM 참조 null safe 가드

기존 DOM 구조 교체 후 옛 ID 참조하는 JS 코드 남아 null 에러.  
**해결**: 대규모 DOM 변경 후 `document.getElementById` 등 참조 전수 검색 + null safe 가드 (`?.`) 확인.

---

## #118 시트 즉시 open — `closeAllSheets` → `setTimeout` 경쟁

`closeAllSheets()` 직후 바로 `openSheet()` 호출 시 타이밍 경쟁 발생.  
**해결**: `openSheet()` 먼저 호출 or `setTimeout(0)` 순서 보장.

---

## #130 카테고리 색상 — `expense_categories.color` DB 컬럼 (하드코딩 금지)

카테고리명→CSS 색상 클래스 9개 JS 하드코딩 → 사장님 관리 화면에서 바꿔도 반영 안 됨.  
**해결**: `expense_categories.color` (hex) 컬럼 직접 사용, inline style로 적용. 코드 매핑 = 빨간불.

---

## #131 저장 후 — `_refreshAfterExpenseChange()` 캐시 무효화 의무

지출 저장 후 캐시 갱신 누락 → 화면에 이전 데이터 잔류.  
**해결**: INSERT/UPDATE/DELETE 후 반드시 `_refreshAfterExpenseChange()` 호출.

---

## #132 사용자 전환 — 메모리·DOM·캐시 3중 리셋

로그아웃 후 다른 계정 로그인 시 이전 사용자 데이터 잔류.  
**해결**: `_resetUserState()` — 전역 변수, DOM 텍스트, 캐시 객체 3가지 동시 리셋 필수.

---

## #133 데이터 소스별 화면 분리 금지 — 통합 표시 필수

POS, 수동, OCR 등 소스별 탭/뷰 분리 → 사장님이 한눈에 못 봄.  
**해결**: 소스 구분 없이 통합 목록 표시, 소스 아이콘/배지로 구분.

---

## #135 자릿수 자동조정 = 전역 규칙 (화면별 하드코딩 금지)

KPI 카드 `font-size:22px` 고정 + overflow 처리 없음 → 평균 데이터는 멀쩡, 큰 매장(근무시간 천 시간·인건비 억 단위)에서 카드 밖 넘침.  
**해결**: 공통 클래스(`.kpi-val`, `.num-cell`)에 `clamp()` + `min-width:0; overflow:hidden` + `tabular-nums` 박고 모든 화면 상속. 새 화면마다 박는 건 하드코딩. `agents/designer.md` 7-A 자릿수 표 + `tester.md` 큰 값 자동조정 검증 의무 참조.

---

> 표 정렬 규칙 (옛 #79·#85) → `agents/designer.md` 절대 규칙 1번으로 교체됨 (2026-06-02).
