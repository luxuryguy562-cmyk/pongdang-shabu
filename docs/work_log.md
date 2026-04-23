# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

---

## [2026-04-23 말미] #58 매출 관리 페이지 1단계 (sales_records 신설)

### 상태: 구현완료 (브랜치 푸시 + main 머지 예정)
### 브랜치: claude/apply-gstack-repo-24Y4m
### 규모: 대형 (새 테이블 + 새 페이지 + 마감정산 연계)
### critic v2 실전 가동 첫 건

### 배경
사장님 요청: "매출을 마감정산에서 수기 입력만 가능 → 매출 관리 페이지 별도 필요, 미래 API 연동 대비"
critic v2 발동 결과:
- Q1 "API 연동"은 핑계, 진짜는 입력 UX 고통 — 목표 재정의
- Q4 옵션 B(별도 페이지) 사장님 직관 존중 + 단계 분할 (1단계 raw 입력/조회/편집, 2단계 API·분류·집계)
- 입력방식은 **표 형식 1개로 통합** (행 추가 + 엑셀 paste)

### 변경 내역
1. **[신규 테이블]** `sales_records`
   - 컬럼: store_id, date, payment_method, category_id(FK→expense_categories), amount, memo, source, created_at, updated_at
   - source: 'manual' / 'closing' / 'excel' / 'pos_api' / 'card_api' — 미래 API 대비
   - 인덱스: (store_id, date DESC) + (store_id, date, payment_method)
   - updated_at 자동 갱신 트리거
   - SQL: `docs/sql/migrate_sales_records_2026_04_23.sql` (+ rollback)

2. **[UI] 사이드메뉴 → "💰 매출 관리" 그룹 추가**
   - 지출내역 그룹 바로 아래

3. **[UI] 매출 관리 페이지 (`salesCont`)**
   - 월 선택 input (기본 이번달)
   - 5열 표: 날짜 / 결제수단 / 카테고리 / 금액 / 🗑
   - 인라인 편집 (date/select/input all inline)
   - 색상 구분: 회색=closing, 노랑=excel, 흰=manual, 파란줄=변경됨, 초록줄=새 행
   - 버튼: + 행 추가 / 📋 엑셀 붙여넣기 / 💾 변경 저장
   - 엑셀 paste 시트: 탭/쉼표 구분, 첫 줄 제목 자동 감지, normalizeDate + parseSalesAmount

4. **[JS] 신규 함수 11개**
   - `loadSalesRecords` — 월별 조회 + income 카테고리 병렬 로드
   - `renderSalesTable` — 표 렌더 (tabular-nums + escapeHtml)
   - `addSalesRow` / `onSalesEdit` / `onSalesEditAmt` / `onSalesRowDelete`
   - `saveAllSalesChanges` — UPDATE + INSERT 일괄
   - `openSalesPaste` / `applySalesPaste` / `parseSalesPaste` / `normalizeDate` / `parseSalesAmount`
   - `onSalesMonthChange` — 미저장 변경 경고
   - `syncClosingToSalesRecords` — 마감정산 → sales_records 동기화

5. **[JS] 연결부 수정**
   - `nav()` actions 매핑에 `sales: loadSalesRecords` 추가
   - `selectStore()` Promise.all 후 salesRecords/salesEditing/salesNewRows 캐시 클리어
   - 마감정산 저장 함수: settlements upsert 성공 후 `await syncClosingToSalesRecords()` 호출
     (sync 실패해도 마감정산은 성공 처리 — try/catch + console.error)

6. **[CSS]** `.sales-table` + `.sales-row[data-src]` + `.sales-del-btn` 등 18줄 추가 (table-layout:fixed + tabular-nums)

7. **[docs]** `db_schema.md`에 sales_records 섹션 / `plan.md`에 #58 항목 추가

### 매장 격리 (dev_lessons #28 준수)
모든 sales_records 쿼리에 `.eq('store_id', currentStore.id)` 강제:
- SELECT (loadSalesRecords) ✅
- INSERT (saveAllSalesChanges, syncClosing) ✅ store_id 페이로드에 포함
- UPDATE (saveAllSalesChanges) ✅ .eq 추가
- DELETE (onSalesRowDelete, syncClosing) ✅ .eq 추가

### FK 전수 점검 (dev_lessons #36 준수)
`sales_records.category_id → expense_categories.id`:
- ON DELETE SET NULL (카테고리 삭제 시 안전)
- 앱 레벨 필터: category_type='income' 만 드롭다운에 노출
- 삭제된 카테고리 데이터: category_id=null로 남음 (집계 가능)

### 검증
- ✅ node --check 구문 통과
- ✅ grep 잔재 없음
- ✅ data-action/data-change 인라인 핸들러 X (dev_lessons #1 준수)
- ✅ `<table>` + tabular-nums 준수 (dev_lessons #22)
- ✅ table-layout:fixed + colgroup (dev_lessons #15 횡스크롤 방지)
- ⚠️ 사장님 실제 사용 검증 필요 (추후 피드백)

### 다음 단계 (2단계, 별도 작업)
- POS/카드사 API 연동 (source='pos_api' 등)
- 대시보드 매출 차트 — settlements 대신 sales_records 집계로 전환
- 매출 카테고리 자동 분류 규칙

### 롤백 절차
1. 앱: git revert + 배포 재트리거
2. DB: `migrate_sales_records_2026_04_23_rollback.sql` 실행
3. 마감정산은 원래 그대로 동작 (settlements만 쓰던 흐름 복귀)

---

## [2026-04-23 후반] critic v2 — 퐁당샤브 3대 질문 + 사전 스캔 자동화

### 상태: 배포완료 (브랜치 푸시 + main 머지)
### 브랜치: claude/apply-gstack-repo-24Y4m
### 규모: 중형 (critic.md ~120줄 추가)

### 배경
critic v1 역적용 테스트 중 사장님 피드백:
> "기능은 다 쓸모 있어. 문제는 데이터 UX·FK 구조를 자꾸 뒤엎어야 돼."

→ v1의 6강제질문은 **스타트업 피봇용**이라 퐁당샤브의 실제 리스크(근본 없이 덧칠 반복)를 못 짚음.
→ 사장님이 "기능 선별을 못할 수도 있다"는 추가 지적 → v1 폐기 아닌 **병행**.

### 변경 요약
1. **[v2 3대 질문 추가]** `agents/critic.md`:
   - **PD1. FK 근본 체크** — UI 먼저 / DB 나중에 패턴 차단
   - **PD2. 개편 회차 체크** — 3회차 이상이면 보류 처방 권장
   - **PD3. 유령 데이터 체크** — dev_lessons #36 자동 링크
2. **[라우팅 표 확장]** 요청 유형별 v1/v2 우선순위 매핑
   - 새 기능 → v1 먼저
   - 개편/리디자인 → v2 먼저
   - FK·DB 스키마 → v2 PD1, PD3 필수
3. **[사전 스캔 자동화]** 묻기 전 bash 3종 자동 실행:
   - `git log`로 개편 회차 자동 카운트
   - `work_log.md` grep으로 유사 작업 자동 탐지
   - `dev_lessons.md` grep으로 관련 교훈 자동 링크
   - 결과를 2~3줄 요약해서 질문에 **증거로 첨부**
4. **[보고서 양식 업데이트]** 사전 스캔 결과 섹션 + v2 PD1/PD2/PD3 추가

### 이 변경이 해결하는 것
- 사장님이 과거 겪은 **"거래내역 N번째 개편"** 패턴을 숫자로 자각
- FK 먼저 확정 안 하고 UI부터 건드리는 패턴 차단
- **critic이 빈손 질문 안 함** — 항상 숫자·근거 들고 물음

### 다음 단계
- 실제 중형 요청 1건에서 v2 + 사전 스캔 실전 시험
- 겉돌면 즉시 재설계 (critic 자신도 탈출구 카운터 도입 고려)

---

## [2026-04-23] gstack 흡수 — `critic` 에이전트 신설 (기획 빈틈 비평가)

### 상태: 배포완료 (main 591b431)
### 브랜치: claude/apply-gstack-repo-24Y4m
### 규모: 대형 (새 에이전트 + 헌법 워크플로우 변경)

### 배경
사장님 요청: garrytan/gstack 레포의 좋은 부분만 흡수. 특히 `/office-hours`(6강제질문)와 `/plan-ceo-review`(4모드 검토)의 **기획 비평 로직**을 우리 `agents/`에 이식 — "내 기획의 빈틈을 네가 먼저 찾아내게" 하는 게 목적.

### 변경 요약
1. **신규**: `agents/critic.md` — 기획 빈틈 비평가
   - 6강제질문 (식당 버전): 수요현실 / 현재우회법 / 절박한한명 / 가장작은버전 / 관찰놀라움 / 미래적합성
   - 반-아부 규칙 + 5개 푸시백 패턴
   - 4가지 검토 모드 (확장/선별확장/유지/축소)
   - 탈출구: "그냥 해" 2번이면 즉시 통과 (위험 신호만 한 줄 경고)
2. **수정**: `CLAUDE.md` 4-1 표 + 4-2 순서도 → 중형/대형 워크플로우에 `critic` 단계 추가 (context_reader → **critic** → advisor → planner → …). 소형은 스킵.
3. **수정**: `CLAUDE.md` 부칙 파일구조에 `agents/critic.md` 추가
4. **수정**: `agents/advisor.md` depends_on: `critic`, 역할 경계 명시 (advisor=HOW, critic=WHY)
5. **신규**: `docs/dev_lessons.md` #44 "외부 프레임워크 흡수 시 인프라 버리고 사고법만" 교훈 추가

### 인프라 코드 제거 원칙 (dev_lessons #44)
- gstack 원본 SKILL.md ~2100줄 중 ~800줄이 telemetry/config/세션 관리 bash — **전부 제외**
- 가져온 것: 사고법·질문·패턴만 한국어로 번역
- 버린 것: `~/.claude/skills/gstack/bin/` 경로, preamble bash, WRITING_STYLE/LAKE_INTRO 등 gstack 전용 state

### 영향
- 코드(index.html) 무변경
- 다음 중형/대형 작업부터 critic 단계 자동 발동

### 다음 단계
- 사장님이 실제 중형 작업 요청 시 critic 1차 시험 가동
- 너무 깐깐하면 질문 수/푸시백 강도 조정

---

## [2026-04-22 후반] #57 거래내역 UI 전면 개편 + 분류 선택 바텀시트

### 상태: 배포완료 (main 1de7615)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 대형 (약 300줄 수정, 다중 커밋)

### 배경
사장님 스크린샷 기반 피드백 — "계좌/카드 내역 테이블이 정신없다",
"드롭다운 옵션 많으면 잘린다", "대/소분류 셀 분리 필요", "날짜 모르겠다" 등 연속적 UX 이슈.

### 변경 요약 (12가지)

**거래내역 테이블 (renderBankTxTable/renderCardTxTable)**
1. 컬럼 구조 재설계: 날짜/액션 제거 → 4열(내용 30% / 대분류 18% / 소분류 24% / 금액 28%)
2. 날짜 그룹 헤더 신설: '📅 04-20 (목) · 4건' + sticky(top:0, z-index:2)
3. 금액 통합 컬럼: +파랑/-빨강 부호, tabular-nums 정렬
4. 컬러 도트 추가: expense_categories.color 기반
5. 행 탭 → 편집 시트 (✎✕ 버튼 제거)
6. cat===sub UI 방어 (중복값 1줄로 표시)
7. 평면 모드(금액/내용 정렬) — 각 행에 MM-DD 표시
8. 헤더 가운데정렬, 데이터: 내용 좌측 / 대분류·소분류 가운데 / 금액 우측

**정렬 UX**
9. 3단계 토글: 오름 ↑ → 내림 ↓ → 해제 (원상태로)
10. 활성 헤더 강조: 파란색 + 굵게 + 연한 파랑 배경

**필터 팝업**
11. z-index 1100 (네비바 1000 위) + box margin-bottom:72px (네비바 가림 회피)
12. 적용 버튼 강조: flex:2, 파란 그림자, '✓ 적용' 아이콘

**분류 선택 바텀시트 (NEW — 공통 openCatPicker)**
13. 확인필요 시트 + 편집 시트 둘 다 드롭다운/칩 UI 제거 → 버튼 1개 + 바텀시트
14. 3단계 드릴다운: 타입(1) → 대분류(2) → 소분류(3)
    - 지출/매출/제외: 3단계까지 (자식 있는 대분류만 3단계 진입)
    - 영수증 참조: 1단계에서 바로 선택
    - 예비비 사용: 1단계 탭 → 메모 prompt → 바로 선택
    - 미분류: 1단계에서 바로 선택
15. sheet-overlay 패턴 (body append 대신 HTML 미리 정의)
    - z-index 7000/7001 (기존 sheet 6000/6001 위)
    - 기존 openSheet/closeSheet 로직 재사용
    - 애니메이션·containing block 이슈 해결

**FK 정합성**
16. resolveCatPair에 '>' 분리 로직 추가
    - '식자재>육류' 입력 → {mainId:식자재id, mainName:'식자재', subName:'육류'}
    - 모든 저장 경로(applyReviewChoice/saveTxEdit/saveExcelBatch) 일관성
    - 결과: mydata_transactions.category_id = 대분류 id 고정 ✅

### 주요 커밋 (이번 세션 후반)
- 9f85e42 거래내역 테이블 B안 (날짜 그룹 + 분류 한줄 + 금액 통합)
- f546ea3 4열 분리 (대/소분류 별도 셀)
- 4bb4617 헤더 가운데 + 소분류 폭 확대
- 4b8449a 분류 셀 가운데 정렬
- 3232672 정렬 강조 + 적용 버튼 강조
- 370ec7d 날짜 헤더 sticky + 평면 모드 날짜
- 0509072 정렬 해제 + 필터 네비바 회피
- d51a946 분류 선택 바텀시트 (확인필요+편집)
- ad18caf 바텀시트 z-index 7000 (.sheet 6001 위로)
- f9ea4b6 getCatType 함수 복원 (ReferenceError)
- 12b9ad2 바텀시트 2단계 드릴다운
- 11ae9c2 3단계 드릴다운 + FK 보강
- 1de7615 sheet-overlay 패턴 통일 (중간에 뜨던 문제)

### DB 변경
- 없음 (코드/UI만)

### 사장님 확인 후 정상 동작
- 거래내역 테이블: 날짜 그룹, 컬러 도트, 금액 색상, 4열 분리
- 정렬: 3단계 토글, 활성 헤더 강조
- 필터: 네비바 위로 적용 버튼 보임
- 분류 바텀시트: 3단계 드릴다운 정상 작동

---

## [2026-04-22] #56 영수증참조+예비비 linked 카테고리 분리 (#54 구조 변경)

### 상태: 구현완료 (배포 대기, SQL 실행 필요)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 중형 (SQL 2개 + 코드 약 100줄)

### 배경
- #54에서 "식자재 > 영수증 참조" 소분류로 만들었는데 사장님 지적:
  - 한 영수증에 식자재+비품 섞여있으면 비품도 식자재로 집계됨 (같은 문제 재발)
  - 영수증 참조/예비비는 지출 카테고리가 아니라 "다른 시스템 연결용" 플래그
  - 둘을 하나의 "linked" 타입으로 묶지 말고 분리 (예비비는 메모 필요)

### 변경
1. **category_type 확장**: expense/income/exclude → + **receipt_ref** + **reserve** (5종)
2. **#54 구조 취소**: 식자재 > 영수증 참조 소분류 삭제
3. **신규 대분류 2개 INSERT**:
   - "영수증 참조" (category_type='receipt_ref', 시스템 상수)
   - "예비비 사용" (category_type='reserve', 시스템 상수)
4. **reserve_fund_logs.source_tx_id** 컬럼 추가 (FK→mydata_transactions, ON DELETE SET NULL)
5. **관리 화면 탭 3개 유지** (지출/매출/제외만 사장님 관리)
6. **리뷰 드롭다운 optgroup 5개**: 📸 영수증참조, 🏦 예비비 추가
7. **예비비 선택 시 메모 입력 필드** (확인필요 시트, 거래 편집 시트)
8. **자동 동기화**: 예비비 거래 저장 시 reserve_fund_logs INSERT (source_tx_id 연결)
9. **exclude_from_settlement 자동**: receipt_ref/reserve/exclude 타입은 자동 true
10. **saveTxEdit**: 예비비로 분류 변경 시 log 동기화(INSERT/UPDATE), 다른 분류로 변경 시 기존 log 삭제

### DB 변경
- 마이그레이션: `docs/sql/migrate_linked_categories_2026_04_22.sql`
  1. 백업 3개 (expense_categories_bak_20260422_c 등)
  2. reserve_fund_logs.source_tx_id 컬럼 추가
  3. 영수증 참조 + 예비비 사용 대분류 INSERT
  4. classification_rules UPDATE: sub_category='영수증 참조' → category='영수증 참조', sub=''
  5. mydata_transactions UPDATE: 기존 '식자재>영수증 참조' → 새 대분류로 이동
  6. 식자재 자식 '영수증 참조' DELETE
- 롤백 SQL: `migrate_linked_categories_2026_04_22_rollback.sql`

### 사장님 남은 할 일
1. Supabase SQL Editor에서 `migrate_linked_categories_2026_04_22.sql` 실행 (Run without RLS)
2. 앱 하드 리프레시
3. 확인필요 드롭다운에서 📸 영수증참조 / 🏦 예비비 그룹 확인
4. 예비비 사용 건 테스트: 메모 입력 → 현황>예비비에서 자동 차감 확인

---

## [2026-04-22] #54 "영수증 참조" 소분류 + 영수증 기반 집계 대체

### 상태: 구현완료 (배포 대기, SQL 실행 필요)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 중형 (약 50줄 수정 + SQL 2건)
### 배경
- 카드 거래 1건 = 카테고리 1개 제약 → 이마트 45,000원에 야채/공산품/비품 섞여있을 때 애매
- 사장님 제안: 카드 거래는 "영수증 참조"로 두고, 실제 집계는 영수증(품목별 분류)에서

### 변경
1. **expense_categories**: 식자재 대분류 아래 "영수증 참조" 소분류 INSERT (마이그레이션 SQL)
2. **classification_rules**: sub_category='직구상세' → '영수증 참조' UPDATE (일괄)
3. **mydata_transactions**: 기존 저장된 sub_category='직구상세' 건도 '영수증 참조'로 UPDATE
4. **집계 로직** (calcExpenseByCategories + reconcileRender):
   - `mydata_transactions.sub_category='영수증 참조'` 건은 **지출 집계에서 제외**
   - 영수증(receipts)은 정상 집계 → 이중 집계 방지
5. **UI 배지**: 거래내역 테이블에서 "📸 영수증 참조" 파란색 강조 표시

### DB 변경
- 스키마 변경 없음
- 마이그레이션 SQL: `docs/sql/migrate_receipt_ref_2026_04_22.sql`
  1. 백업 (classification_rules_bak_20260422_b)
  2. 식자재 자식으로 "영수증 참조" INSERT
  3. classification_rules + mydata_transactions sub_category UPDATE
- 롤백 SQL: `docs/sql/migrate_receipt_ref_2026_04_22_rollback.sql`

### 사장님 남은 할 일
1. Supabase SQL Editor에서 `migrate_receipt_ref_2026_04_22.sql` 실행 (Run without RLS)
2. 앱 하드 리프레시 (Ctrl+Shift+R)
3. 거래내역 → 쿠팡/이마트/하나로마트 등 건에 📸 영수증 참조 표시 확인
4. 영수증 촬영해서 품목별 분류 입력 → 실제 집계에 반영
5. 대시보드 4월 지출에서 "이마트 45,000" 카드건이 더 이상 식자재로 집계되지 않는지 확인

### 주의사항
- 영수증 참조 건은 **영수증 촬영 안 하면 집계 누락됨** → 향후 알림 기능 필요 (별도 작업)

---

## [2026-04-22] 매출/제외 카테고리 분리 (#53 category_type 컬럼 추가)

### 상태: 구현완료 (배포 대기)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 중형 (약 100줄 수정, DB ALTER 1건)
### 배경
- 2차 개편 후 리뷰 드롭다운에 '매출/카드대금/배당금' 하드코딩 남아있음
- 사장님 지적: "매출은 지출이 아닌데 지출카테고리에서 하면 안되지 않아?"
- 내 틀린 제안: 매출 소분류 4개 미리 INSERT
- 사장님 올바른 방향: 하드코딩/미리INSERT 금지, DB 관리 UI로 사장님이 직접 추가

### 변경
1. **expense_categories.category_type 컬럼 추가** (ALTER TABLE, default 'expense')
   - 사장님이 Supabase SQL Editor에서 이미 실행 완료:
     ALTER TABLE + UPDATE NULL → 'expense'
2. **편집 시트**: category_type 드롭다운 (지출/매출/제외) 추가
3. **지출카테고리 화면**: 상단 탭 3개 (💸 지출 / 💰 매출 / 🚫 제외)
   - 탭 전환 시 해당 타입 카테고리만 표시
   - + 추가 시 현재 탭 타입 기본값
   - 소분류 추가는 부모 타입 상속
4. **리뷰 드롭다운 하드코딩 제거**:
   - 기존 '매출/카드대금/배당금' 3개 option 삭제
   - DB 기반 optgroup 3개 (지출/매출/제외) 동적 생성
   - '미분류'만 유지
5. **집계 필터**: calcExpenseByCategories + reconcileRender에 category_type='expense' 필터
   - income/exclude 카테고리는 지출 집계에서 자동 제외

### DB 변경
- ALTER TABLE expense_categories ADD COLUMN category_type text DEFAULT 'expense' (사장님 실행 완료)
- 롤백: ALTER TABLE DROP COLUMN category_type (필요 시)
- 실제 매출/제외 카테고리 INSERT는 **하지 않음** — 사장님이 UI에서 직접 추가

### 사장님 남은 할 일
1. 앱 하드 리프레시 (Ctrl+Shift+R)
2. 사이드메뉴 → 지출 카테고리 → 상단 탭 확인 (지출/매출/제외)
3. 필요시 💰 매출 탭 → + 추가 (예: "매출" 대분류 → "QR결제/카드결제/현금입금/송금결제" 소분류)
4. 필요시 🚫 제외 탭 → + 추가 (예: "카드대금", "배당금")
5. 엑셀 업로드 후 확인필요 시트에서 드롭다운 그룹 구분 확인

### 제11조 절차
- [x] 사전 스캔 (기존 하드코딩 위치 확인)
- [x] 계획서 제출 + 사장님 지적 (하드코딩 금지 원칙 확립)
- [x] 수정 (DB 미리 INSERT 제거)
- [x] 3단 검증: node --check ✅ + 잔재 grep ✅
- [x] docs 업데이트 (db_schema + business_rules + work_log + dev_lessons)
- [ ] 배포 후 사장님 테스트

---

## [2026-04-22] 지출카테고리 2차 개편 (B+가 안 구현완료)

### 상태: 구현완료 (배포 대기 — 사장님 SQL 실행 + 재분류 도우미 사용 + 대시보드 숫자 확인)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 대형 (약 150줄 추가/수정 + 마이그레이션 SQL 2개)
### 승인: 사장님 "네 일단 해봐요" (B 풀패키지 + 가 주류별도 확정)

### 배경
- 기존 구조 `식자재(거래처)/식자재(직구)/식자재(주류)` 3분할 → 사장님 "식자재 얼마?" 물으면 3개 더해야 함
- 사장님 원하는 구조: **식자재 대분류 하나 + 육류/야채/공산품 소분류**
- "직구" 개념 삭제 — 쿠팡에서 사든 대봄에서 사든 "야채"는 야채, 품목으로 분류
- 주류는 별도 대분류 유지 (주세·매출비중 별도 추적 필요)
- 기존 expense_categories.vendor_category 컬럼이 이미 있어서 마이그레이션 단순화됨

### 구조 최종
```
식자재 (composite, 자식 합산)
  ├ 육류    (composite: vendor_category='육류' + receipts.category_id=소분류 id)
  ├ 야채    (composite: vendor_category='야채' + 동일)
  └ 공산품  (composite: vendor_category='공산품' + 동일)
주류 (vendor_orders, vendor_category='주류')
인건비/공과금·고정비/비품/마케팅/기타 (그대로 유지)
```

### 변경 요약 (8가지)
1. **드롭다운 4곳 옵션 교체**: 식자재/주류/직구 → 육류/야채/공산품/주류 (vendorCatFilter, vendorCatInput, expCatVendorCat)
2. **expCatSourceInput 신규 옵션**: `composite` (🍱 거래처+영수증 합산)
3. **calcExpenseByCategories composite 분기**: 대/소분류별 vendor_orders+receipts 합산. composite 소분류는 루프 스킵(중복 방지)
4. **reconcileRender composite 분기**: 자식 소분류별 details 생성 (sub_key='comp_<id>'). 대분류 자체 receipts는 'comp_direct_<id>'
5. **groupMap 재편**: `식자재(직구/영수증)` 그룹 삭제, `composite:'식자재'` 추가, 주류는 이름 기반 별도 그룹
6. **seedDefaultRules 카테고리명 통일**: `물품대금`(16건) + `직구`(14건) = 30건 → `식자재`로 일괄 치환 (Python 스크립트)
7. **OCR 프롬프트 예시 갱신**: `식자재>거래처` → `식자재>야채/육류/공산품` 3건 예시
8. **거래처 재분류 도우미 시트 신규**: 사이드메뉴 거래처 → 🔄 재분류 버튼 → 기존 식자재/직구 거래처를 육류/야채/공산품 일괄 재지정

### DB 변경
- 스키마 변경 없음 (기존 vendor_category 컬럼 활용, composite는 data_source text 값)
- 마이그레이션 SQL: `docs/sql/migrate_food_composite_2026_04_22.sql`
  - 1단계: 백업테이블 4개 (expense_categories/vendors/receipts/classification_rules)
  - 2단계: expense_categories 재편 (식자재(거래처/직구) 비활성, 식자재(주류)→주류 리네임, 식자재+자식 3개 INSERT)
  - 3단계: receipts 그대로 유지 (재분류 UI로 사장님이 업데이트)
  - 4단계: classification_rules 이름 일치화 ('물품대금'/'직구' → '식자재')
- 롤백 SQL: `docs/sql/migrate_food_composite_2026_04_22_rollback.sql`

### 제11조 절차 준수
- [x] 사전 스캔 (FK 6군데 grep + vendor_category 발견)
- [x] 백업 커밋 (ede8291)
- [x] 스크립트 치환 (Python: 물품대금 16 + 직구 14 = 30건, 실패 0)
- [x] 3단 검증: node --check ✅ + grep 잔재 0 ✅ + 샘플 육안 ✅
- [x] docs 5개 동기화 (본 항목 + db_schema + business_rules + dev_lessons + plan)
- [ ] 배포 체크 (push 후 사장님 앱 테스트)

### 사장님 남은 할 일
1. **Supabase SQL Editor**에서 `migrate_food_composite_2026_04_22.sql` 실행
2. 앱 하드 리프레시 (Ctrl+Shift+R)
3. **거래처 탭 → 🔄 재분류 버튼** → 기존 "식자재" 거래처 목록 → 육류/야채/공산품 중 선택 → 일괄 저장
4. 영수증 테스트 촬영 → AI가 "식자재>야채" 등으로 응답하는지 확인
5. 대시보드 4월 지출 아코디언 확인:
   - 식자재 1개 + 주류 1개 (이전: 식자재(거래처)/식자재(직구)/식자재(주류) 3개)
   - 숫자 합이 이전 3개 합과 같은지 (±0원)
6. 문제 시 즉시 롤백 SQL 실행 → 알려주시면 원인 분석

---

## [2026-04-21 말미] 후속 논의 — 지출카테고리 2차 개편 (**새 세션에서 진행**)

### 상태: **논의·설계 단계 (미구현)**
### 브랜치: claude/improve-category-ui-TQloc (현 브랜치 유지)

### 배경 (사장님 요구)
현재 지출카테고리 구조가 **구매경로별 분리**(식자재(거래처)/식자재(직구)/식자재(주류))라 사장님이 혼란스러움. 사장님 원하는 구조:
```
식자재 (대분류 하나)
 ├ 육류
 ├ 야채
 └ 공산품
```
거래처/직구 구분은 **이미 거래처 탭·영수증 탭**에서 보이므로 대분류 레벨에서 가를 필요 없음.

### FK 영향 점검 — 6군데 (새 세션에서 반드시 전부 검토)

| # | 대상 | 이슈 |
|---|------|------|
| 1 | `vendors.category` (`식자재/주류/직구/기타`) | 선택지 변경 시 기존 "식자재" 저장값 무효화 → 집계 깨짐 위험. 호환 유지 + 재분류 도우미 필요 |
| 2 | `expense_categories.data_source` | 현재 단일값. "거래처+영수증 합산"은 신규 분기 필요 → `food_composite` 소스 추가 or 집계함수 분기 |
| 3 | `mydata_transactions.category_id` | 오늘 규칙 확립 (dev_lessons #33): **항상 대분류 id**. 유지 필요 |
| 4 | `receipts.category_id` | 현재 소분류 id도 허용. mydata와 규칙 다름 → **통일 필요** (대분류 id + sub_category text) + 기존 데이터 마이그레이션 |
| 5 | `classification_rules` 시드 + 학습 | `category='물품대금'` 등 기존 명칭이 expense_categories.name과 어긋남. 이름 변경 시 UPDATE SQL 필요 |
| 6 | `expense_category_amounts` / `reconciliation` | 대분류 단위 저장·매칭. 소분류 수동 입력/대조는 **1차에서 제외** (대분류 단위 유지) |

### 제안 단계 옵션 (새 세션에서 사장님이 선택)

- **1단계만 (소형)**: `vendors.category` 선택지 확장 + 거래처 일괄 재분류 도우미 UI. 지출카테고리 구조는 그대로
- **2단계 풀패키지 (대형)**: 위 FK 6군데 전부 손봄. `food_composite` 집계 로직 추가
- **하이브리드 (추천)**: 1단계 먼저 배포 → 사용 체감 후 2단계 필요 여부 재판단

### 기술 메모
- `food_composite` data_source: 대시보드 집계 시 `vendors.category IN (육류,야채,공산품,...)`인 주문 + `receipts.category_id IN (자식 소분류들)` 합산
- `resolveCatPair` 이미 있음 → receipts.category_id 규칙 통일에도 그대로 활용
- 마이그레이션 SQL은 반드시 백업테이블 + 롤백 SQL 쌍으로 제출 (제8조)
- classification_rules 시드 수정 시 기존 저장된 규칙도 UPDATE 필요

### 주류 처리 미결
- 별도 대분류 `주류`로 유지할지, `식자재` 아래 소분류로 넣을지 사장님 결정 대기
- 권장: 별도 대분류 (주류세·매출비중 별도 추적 편의)

---

### 🚀 다음 세션 시작 방법 (복붙용)
```
docs 전부 읽고 (CLAUDE.md 제11조 특히, business_rules.md, dev_lessons.md,
plan.md, db_schema.md, work_log.md 최상단 "지출카테고리 2차 개편" 항목,
services.md) 절대 무시·생략 없이 준수.

세션 시작 필수: git fetch --all 먼저 실행 (dev_lessons #29).

현재 상태:
- main 최신 커밋 0fab804 (거래내역 분류 2줄 + 1글자 약자 매칭)
- 브랜치: claude/improve-category-ui-TQloc
- 미완료: 지출카테고리 2차 개편 (식자재 대분류 통합 + 품목 기반 소분류)

이어서 할 일:
1. work_log.md "지출카테고리 2차 개편" 항목의 FK 6군데 전수 재확인
2. 사장님께 단계 선택 확인 (1단계 소형 / 2단계 대형 / 하이브리드 중)
3. planner가 계획서 작성 → 승인 게이트
4. 승인 후 context_reader → advisor → reviewer → coder → tester → deployer

반드시:
- CLAUDE.md 제1조 1-1 승인 게이트 준수 (계획서 OK 전 코드 한 줄도 건드리지 말 것)
- 제11조 대규모 변경 안전 절차 6단계 (사전 스캔→백업→스크립트→3단 검증→기록→배포체크)
- 데이터 마이그레이션 SQL 실행/롤백 SQL 쌍 필수 (제8조)
- FK 점검은 work_log의 6군데 표 그대로 전부 확인:
  vendors.category · expense_categories.data_source ·
  mydata_transactions.category_id · receipts.category_id ·
  classification_rules · expense_category_amounts/reconciliation
- 대시보드 집계 함수(loadDashboard 5524~, reconcileRender 7298~) 영향도 확인

주류 처리 미결: 별도 대분류 유지 vs 식자재 아래 소분류 → 사장님 확인 먼저.
```

---

## [2026-04-21] 거래내역 분류 2줄 표시 + 5필드 편집 시트 + 소분류 FK 정합성

### 상태: 구현완료 (배포 대기 — 사장님 앱 테스트 + SQL 2·3단계 실행)
### 브랜치: claude/improve-category-ui-TQloc
### 규모: 대형 (약 180줄 추가/수정 + 데이터 마이그레이션 SQL)

### 배경
- 엑셀 업로드 거래내역에서 분류 컬럼이 대분류만 보이거나 소분류만 보여서 혼란
- 분류 셀 탭으로만 수정 가능했는데 날짜/내용/금액은 수정 불가
- `openCatEdit` 저장 로직(6051행)이 `category=selected, sub_category=selected` 동일 덮어쓰기로 대분류 정보 소실
- 확인필요 시트(6948행)의 `<input placeholder="소분류">` 자유 입력이 DB에 없는 소분류명 주입 → FK 깨짐
- `resolveCatId`가 이름만 매칭 → 소분류 선택 시 `category_id`에 소분류 id 저장 → 대시보드 집계(5474행) 누락
- 사장님 진단 핵심: "소분류 fk 안돼있음 → 계산수식 틀어짐"

### 승인 이력
- 계획서 제출: 2026-04-21
- 사장님 결정: A안(분류 2줄 표시, 세로 최소) + C안(tx_hash 원본 보존)
- 승인 커밋: (본 커밋)

### 변경 요약
1. 분류 셀 2줄 표시 (대분류 9px gray + 소분류 11px, line-height 1.1 → 행 +8px)
2. 통합 편집 시트 신설 (날짜/내용/분류/입금/출금/정산제외)
3. 분류 FK 규칙 확립: `category_id` = 항상 대분류 id, `sub_category` = 소분류명(text)
4. 확인필요 시트 수기 입력 `<input>` 제거 → select만 사용
5. 기존 거래내역 데이터 마이그레이션 SQL (백업테이블 + 2단계 UPDATE)
6. tx_hash C안: 수정 시 원본 지문 유지 (재업로드 중복 차단 정상 작동)

### DB 변경
- 스키마 변경 없음
- 데이터 마이그레이션: `docs/sql/migrate_tx_category_id_to_parent.sql`
  - 1단계: `mydata_transactions_bak_20260421` 백업테이블 (사장님 실행 완료, RLS enabled)
  - 2단계: sub_category 비어있는 건 소분류명 채움 (대기)
  - 3단계: category_id를 부모(대분류) id로 치환 (대기)
- 롤백: `docs/sql/migrate_tx_category_id_to_parent_rollback.sql`

### 주요 구현 요소
- `resolveCatPair(catName)` — 이름 → {mainId, mainName, subName} 분리
- `buildCatChipsHtml(currentCat)` — 분류 칩 UI 재사용 가능 헬퍼
- `openTxEditSheet(txId, type)` — 편집 시트 오픈
- `saveTxEdit()` — 5필드 저장, tx_hash 원본 유지
- `closeTxEdit()` — 시트 닫기
- `applyReviewChoice(item, selected)` — 확인필요 시트 선택값 → category/sub_category 분리
- `saveExcelBatch.resolveCatPayload` — 엑셀 배치 저장 시 규칙 적용

### 검증
- [x] node --check 통과
- [x] 잔재 grep 0건 (tx-cat-edit, openCatEdit, catEditPopup, rvSub)
- [x] 데이터 마이그레이션 SQL + 롤백 SQL 준비

### 사장님 남은 할 일
1. 브랜치 푸시 → main 자동 머지 후 앱 하드 리프레시 (Ctrl+Shift+R)
2. Supabase SQL Editor에서 `docs/sql/migrate_tx_category_id_to_parent.sql` 2·3단계 실행
3. 골든패스 테스트:
   - 엑셀 업로드 후 분류 셀 2줄 표시 확인
   - ✎ 편집 버튼 → 5필드 수정 → 저장 → 반영 확인
   - 확인필요 시트에서 select 한 개로 분류 선택 (수기 입력 input 제거됨)
   - 대시보드 집계 수치 정합성 확인

---

## [2026-04-20] 로그인 시 기기 등록 팝업

### 상태: 배포대기 (브랜치 push → main 자동 머지)
### 브랜치: claude/device-registration-feedback-CIjP4
### 규모: 중형

### 배경
기존: `첫 출근` 버튼 누를 때만 기기 자동 등록 + 2초 토스트 → 사장님/직원이 등록됐는지 모름.
요청: 로그인 시 기기 상태 팝업으로 명확히 알림 + 관리자 초기화 후 재로그인 시 자동 재등록.

### 변경
- 신규 시트 `#deviceStatusSheet` (sheet-overlay, dev_lessons #3 준수)
- 신규 함수: `showDeviceStatusPopup(emp)`, `registerDeviceFromPopup()`, `closeDevicePopup()`
- `completeLogin(emp)` 끝에 `if(!isManager) setTimeout(...showDeviceStatusPopup, 400)` 추가
- `resetDeviceFingerprint` 토스트 문구: "다음 출근" → "다음 로그인" 교체, 편집 시트 상태 라벨 즉시 갱신

### 팝업 3상태
| 상태 | 제목 | 버튼 |
|---|---|---|
| 미등록 | 📱 기기 등록이 필요해요 | [이 기기로 등록] / [나중에] |
| 일치 | ✅ 등록된 기기입니다 | [확인] (3초 자동 닫힘) |
| 불일치 | ⚠️ 다른 기기에서 로그인했어요 | [확인] + 해결방법 안내 |

### 영향 범위
- DB: 변경 없음 (기존 `employees.device_fingerprint` 재사용)
- 기존 `checkDeviceForAttendance()` 자동 등록 로직 유지 (팝업 "나중에" 선택 시 fallback)
- staff 로그인 시만 팝업 (관리자 스킵 — 여러 기기 사용)

### 검증
- node --check 통과
- 기존 출퇴근 플로우 영향 없음 (추가 레이어만)

---

## [2026-04-17] 코드 구조 개선 로드맵 Phase 2b — RLS 1차 활성화

### 상태: 배포완료
### 브랜치: claude/review-docs-sync-main-3aqxI → main (커밋 aa7b3cf)
### SQL 파일: docs/sql/phase2b_rls_enable.sql, phase2b_rls_rollback.sql

### 배경
Phase 2a에서 코드 레이어 `store_id` 필터 26곳 추가 완료(커밋 f5fc304). 이제 DB 레이어 RLS 활성화로 2중 방어망 구축. 1차는 **느슨한 정책**(USING true) + **스키마 정합성 강제**(WITH CHECK store_id IS NOT NULL)로 무중단 활성화. 2차(Phase 2c 이후) Cloudflare Worker 프록시 + auth.uid 기반 엄격화.

### 절차 (제11조 6단계, DB 변경 버전)

**11-1 사전 스캔**:
- db_schema.md + index.html 쿼리 교차 검증 → store_id 컬럼 보유 테이블 22개 확정
- 대상: store_settings, employees, roles, attendance_logs, caps_upload_staging, work_schedules, daily_sales, receipts, settlements, vendors, vendor_orders, expense_categories, expense_category_amounts, fixed_costs, fixed_cost_amounts, special_wages, mydata_accounts, mydata_transactions, reconciliation, reserve_fund_logs, classification_rules, vendor_diffs
- 유보: stores, franchises (부모 테이블, store_id 없음)

**11-2 백업**: Supabase 자동 스냅샷 + 롤백 SQL 사전 준비

**11-3 스크립트화**: 단일 `.sql` 파일 BEGIN/COMMIT 트랜잭션 (enable + rollback 대칭)

**11-4 사후 검증 (3단 게이트)**:
1. 검증 쿼리: `SELECT tablename, rowsecurity FROM pg_tables WHERE ...` — 사장님 실행
2. 앱 동작 확인: 사장님이 `pongdang-shabu.pages.dev` 접속 후 정상 동작 확인 ✅
3. Claude 샌드박스 직접 테스트 시도 → Supabase IP allowlist에 막힘 (→ dev_lessons #31 신설)

**11-5 기록**: 본 항목 + dev_lessons #30 신설 (RLS 1차 활성 교훈) + db_schema.md + services.md 갱신

**11-6 배포 전 체크**: SQL 파일 커밋 + 헌법 1-2 업데이트(브랜치 push → main 자동 머지)

### 정책 설계
```
USING (true)                       -- 모든 SELECT 허용 (anon key 앱 무중단)
WITH CHECK (store_id IS NOT NULL)  -- INSERT/UPDATE 시 store_id 필수 (스키마 정합성)
FOR ALL TO public                  -- anon + authenticated 포함
```

### DB 변경
- 22개 매장별 테이블 RLS ON + `pd_phase2b_all` 정책 생성
- 코드 변경 0줄

### 다음 단계 (Phase 2c — 별도 세션)
- Cloudflare Worker 프록시로 anon key 서버측 보호
- JWT 기반 `auth.uid()` 세션 도입 → RLS 정책 엄격화 (`USING (store_id = auth.store_id())` 등)

---

## [2026-04-17] 코드 구조 개선 로드맵 Phase 2a — store_id 필터 누락 감사 + 수정

### 상태: 배포완료
### 브랜치: claude/review-docs-deployment-JjQkV → main
### 백업 커밋: 12d7a70
### 수정 커밋: 9f6a30d

### 배경
Supabase RLS 비활성 상태이므로 클라이언트 레이어 `.eq('store_id', currentStore.id)` 필터가 다매장 데이터 격리의 유일한 방어선. 다음 매장 추가 시(예: 대전점) 누락 곳에서 데이터 혼입·노출 위험. 본 작업은 사장님 B안(방어적) 승인하에 진행.

### 절차 (제11조 6단계 준수)

**11-1 사전 스캔**:
- /tmp/phase2a/audit.py 작성 → sb.from(...) 호출 136개 전수 추출 후 체인 분석
- 분류 결과 (1차): A=97 / B=1 / C=17 / D=21
- 사장님 중간 리포트 + 재승인 (B안: C+D 전부 수정)
- C 17건 수동 검증 → **11건 false positive 발견** (payload 변수가 sb.from 위에 정의돼 있어 audit script 한계). 진짜 C는 5건.
- 최종 수정 대상: D 21 + C 5 = **26건**

**11-2 백업 커밋**: 12d7a70 (빈 커밋, 롤백 지점)

**11-3 스크립트화**: 
- /tmp/phase2a/patch.py — 라인번호 + 패턴타입(eq_id/in_id/select_eq) + store 변수명 매핑
- 변환 결과: 성공 26 / 실패 0
- /tmp/phase2a/index.html.bak 보존

**11-4 사후 검증 (3단 게이트)**:
1. 구문: node --check (script 블록 추출) 통과
2. 잔재: audit 재실행 → D 21→0, C 17→12 (12건은 검증 완료 false positive)
3. 샘플: diff 26줄 전수 육안 — 패턴 일관성 확인

**11-5 기록**: 본 항목 + dev_lessons #28 신설

**11-6 배포 전 체크**: 6항목 전부 통과 후 main 머지

### 수정 카테고리
| 분류 | 패턴 | 건수 |
|------|------|------|
| D | `.eq('id', X).update/.delete` → `.eq('id', X).eq('store_id', currentStore.id)` 추가 | 21 |
| C-eq | `.eq('id', X)` 단일 행 update | 1 (5016) |
| C-in | `.in('id', list).update/.delete` → `.eq('store_id')` 추가 | 2 (5014, 5776) |
| C-select | `.select(...).eq('category_id', ...)` → `.eq('store_id', sid)` 추가 | 3 (5477, 5484, 7147) |

### False Positive 12건 (수정 불필요 — 이미 안전)
- payload/rows 변수에 `store_id:currentStore.id` 사전 포함:
  receipts(2356), attendance_logs(2990), caps_upload_staging(2992), work_schedules(3028), 
  vendor_orders(4233), fixed_cost_amounts(4301), store_settings(4615/4641), 
  special_wages(4673), classification_rules(6471/6550), mydata_transactions(6967)

### DB 변경
- 없음 (코드만)

### 다음 단계 (Phase 2b — 별도 세션)
- RLS 활성화 SQL + 롤백 SQL 준비
- store_settings 등 모든 테이블에 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (true)` 1차 (방어막 2중화 후 점진적 강화)
- Cloudflare Worker 프록시 검토 (anon key 노출 대안)

### 다음 세션 시작 방법 (복붙용)
```
docs 전부 읽고 (CLAUDE.md 제11조 특히, business_rules.md, dev_lessons.md,
plan.md, db_schema.md, work_log.md 최상단 Phase 2a 항목, services.md)
절대 무시·생략 없이 준수.

세션 시작 필수: git fetch --all 먼저 실행 (dev_lessons #29 참조).
로컬 main이 뒤처져 있을 수 있음.

현재 상태: Phase 2a 배포완료 (커밋 9f6a30d, main 머지 완료)
Phase 2b (RLS 활성화 준비)부터 이어서 진행.

Phase 2b 작업 범위:
- Supabase 모든 매장별 테이블 21개 RLS 활성화
- 1차 정책: USING (true) + WITH CHECK (store_id IS NOT NULL)
  (코드 레이어 필터가 이미 있으므로 점진적 강화)
- 실행 SQL + 롤백 SQL 작성
- 사장님 Supabase 콘솔(Dashboard → Authentication → Policies)에서 실행
- 실행 후 앱 골든패스 5가지 재테스트

반드시:
- CLAUDE.md 제11조 "대규모 변경 안전 절차" 6단계 따를 것
- 계획서 먼저 제출하고 승인 받은 후 SQL 실행 (제1조 1-1)
- DB 변경은 실행 SQL + 롤백 SQL 모두 제출 (제8조)
- RLS 활성화는 DB 변경 = 대형 + 승인 게이트 강화 (제4-3조)
```

### 남은 로드맵 (Phase 2b, 2c, 3~5)
- **Phase 2b (대형, DB/보안)**: RLS 활성화 — 사장님 Supabase 콘솔 실행 필요
- **Phase 2c (중형, 인프라)**: Cloudflare Worker 프록시 (anon key 서버측 보호)
- **Phase 3 (중형)**: loadDashboard 583줄 분할 (3485~4067행)
- **Phase 4 (중형)**: openAdd/Edit*Sheet 6곳 중복 → 제너릭화
- **Phase 5 (중형)**: 전역 가변 상태 20+개 → state.* 네임스페이스

---

## [2026-04-17] 코드 구조 개선 로드맵 Phase 0·1 — 인라인 핸들러 제거

### 상태: 구현완료 (배포 대기)
### 브랜치: claude/review-code-structure-scaDn

### 배경
전수 리뷰 결과 index.html이 3,400줄 → 7,535줄로 비대화. dev_lessons #1(CSP 인라인 핸들러 금지) 규칙이 있음에도 onclick 208개·onchange 28개가 방치돼 있어, CSP 강화 시 대규모 장애 위험. 6개 구조 개선 과제를 4단계 로드맵으로 분할.

### 로드맵 (4단계)
- **Phase 0 (소형)**: CLAUDE.md / plan.md / work_log.md 실제치 동기화 — 이번 세션
- **Phase 1 (중형)**: onclick 208·onchange 28 → data-action + 중앙 이벤트 위임 — 이번 세션
- **Phase 2 (대형)**: store_id 누락 감사 + RLS 준비 — 사장님 승인 후 별도 세션
- **Phase 3 (중형)**: loadDashboard 583줄 분할
- **Phase 4 (중형)**: openAdd/Edit*Sheet 제너릭화
- **Phase 5 (중형)**: 전역 상태 네임스페이스 state.*

### Phase 0 내용
- CLAUDE.md 제6조 라인수 "3400줄" → "약 7,500줄 (CSS 434 · HTML 1,461 · JS 5,629)"
- plan.md 최종 업데이트일 갱신
- 본 항목 추가

### Phase 1 내용
- 중앙 이벤트 위임 라우터 추가 (index.html 1961~2008행): `_parseActionArg` / `_dispatchAction`
- DOMContentLoaded 최상단에 click/change/input 3개 전역 리스너 등록
- 치환 결과: `onclick 211개 + onchange 25개 + oninput 15개 = 251개` 전부 data-* 속성으로 전환, **미변환 0건**
- 인라인 onclick → `data-action`, onchange → `data-change`, oninput → `data-input`
- 단순 호출: `foo('a',1)` → `foo|a|1`
- 복합 호출(다중 호출·JS 표현식) 14개는 래퍼 함수로 등록:
  `navFromSide`, `navHome`, `editEmpAfterClose`, `setGanttDay`, `setGanttAllDays`,
  `removeParent`, `openEditAttByIdx`, `saveVendorUploadGlobal`,
  `setFcAmount`, `setSpecialWageDate`, `setSpecialWageAmount`,
  `toggleRolePermEvt`, `toggleEmpPermEvt`, `resetCurrentEmpDevice`
- `event.stopPropagation()` 제거 — `closest('[data-action]')`가 innermost 자동 선택
- node --check 구문 검증 통과
- dev_lessons.md #1 해결 표시 + 현재 구조 설명 추가

### DB 변경
- 없음

### 다음 세션 시작 방법 (복붙용)
```
docs 전부 읽고 (CLAUDE.md 제11조 특히, business_rules.md, dev_lessons.md,
plan.md, db_schema.md, work_log.md 최상단 Phase 0·1 항목, services.md)
절대 무시·생략 없이 준수.

현재 브랜치: claude/review-code-structure-scaDn
마지막 커밋: Phase 1 인라인 핸들러 251개 제거 (커밋 912042b)
Phase 0·1 배포 확인 완료 가정하에,
Phase 2 (store_id 필터 누락 58곳 감사 + RLS 준비)부터 이어서 진행.

반드시:
- CLAUDE.md 제11조 "대규모 변경 안전 절차" 6단계 따를 것
- 계획서 먼저 제출하고 승인 받은 후 코드 수정 (제1조 1-1)
- DB 변경은 실행 SQL + 롤백 SQL 모두 제출 (제8조)
```

### 이번 세션에서 얻은 교훈 → 헌법·교훈 반영 완료
- CLAUDE.md 제11조 신설: "대규모 변경 안전 절차" (사전 스캔→백업→스크립트→3단 검증→기록)
- dev_lessons.md #27 신설: 일괄 치환 스크립트화 원칙
- dev_lessons.md #5 보강: 대규모 변경은 제11조 참조하도록 링크

### 남은 로드맵 (Phase 2~5, 별도 세션 진행)
- **Phase 2 (대형, 보안)**: store_id 누락 58곳 감사 + RLS 활성화 SQL + Cloudflare Worker 프록시 검토
  - 전제: 사장님 Supabase 콘솔 접근 필요
- **Phase 3 (중형)**: loadDashboard 583줄 분할 (3485~4067행)
- **Phase 4 (중형)**: openAdd/Edit*Sheet 6곳 중복 → 제너릭화
- **Phase 5 (중형)**: 전역 가변 상태 20+개 → state.* 네임스페이스

---

## [2026-04-17] 엑셀 분류 DB 범용화 + 직원 서류 + 영수증 학습 + 버그 수정

### 상태: 배포완료
### 브랜치: claude/review-excel-matching-axdTW → main

### 작업 내용
1. **엑셀 분류 규칙 DB 범용화**: BANK_RULES/CARD_RULES 하드코딩 → classification_rules(매장별 DB) + COMMON 공통 규칙 분리
2. **자동 학습**: 수동 분류 시 DB에 키워드 저장 → 다음부터 자동 매칭 (은행/카드/영수증 공통)
3. **CAT_NAME_MAP 완전 제거**: 하드코딩 카테고리 매핑 폐기 → DB expense_categories.name 직접 FK
4. **분류 변경 UI 개선**: 하드코딩 10개 칩 → DB 대분류>소분류 트리 표시
5. **카드매출 공통규칙 수정**: 매장전용 가맹점번호(741961 등) 제거, 카드사 약자만 유지
6. **직원 서류 관리**: 파일 첨부 방식 (Supabase Storage), 근로계약서/보건증/법대동의서/외국인등록증
7. **미성년자 자동 감지**: 주민번호 → 만 18세 미만 판단 → 법대동의서 배지
8. **외국인 비자 관리**: 비자 유형 드롭박스(E-9/E-7 등) + 만료일 + 상태별 배지 색상
9. **직원 카드 UI**: 3줄 구조 (이름+직급 / 전화번호 / 서류 배지 줄), 시급+입사일 5:5
10. **매장 IP 다중 등록**: WiFi 여러 대 지원 (+IP 추가/삭제 버튼)
11. **계좌 입금/출금 정렬 분리**: data-col="amount" 공유 → deposit/withdraw 분리
12. **거래내역 삭제 기능**: 월 일괄 삭제 + 건별 삭제 (✕ 버튼)
13. **지출 카테고리 독립 화면**: 설정에서 분리 → expcatCont 독립 컨테이너 + nav('expcat')
14. **카테고리 삭제 버튼**: 대분류에도 삭제 추가 + 소분류 연쇄 비활성화
15. **비활성 카테고리 집계**: 삭제해도 거래 있는 달엔 대시보드/정산에 표시
16. **사이드메뉴 정리**: 중복 네비게이션 제거, 그룹 구조 복원
17. **영수증 OCR 개선**: 해상도 800→1600, 품질 0.7→0.85, 프롬프트 전면 개편
18. **영수증 품목 학습**: 힌트 방식 폐기 → 규칙 덮어쓰기 방식 (AI 결과 → DB 규칙으로 확정 오버라이드)
19. **직원 편집 birth_date 버그 수정**: 주민번호 없으면 birth_date가 주민번호 칸에 들어가는 버그

### DB 변경
- classification_rules: 신규 테이블 (매장별 분류 규칙)
- employees: visa_type, visa_expires_at, doc_contract, doc_health_cert, doc_health_expires, doc_minor_consent, doc_foreigner_id 추가
- receipts: category_id FK 추가
- Supabase Storage: employee-docs 버킷 생성

### 기술 메모
- 분류 체계: 공통 규칙(코드) → 매장 DB 규칙 → 미분류 (3단계)
- 학습: learnClassification() — 값 변경 시 UPDATE, 신규 시 INSERT
- 비활성 카테고리: 대시보드/정산에서 해당 월 거래 있으면 포함
- 영수증 학습: AI 응답 → applyRulesToReceipt() → DB 규칙 덮어쓰기 → ✨마크

---

## [2026-04-16] 엑셀 분류 규칙 DB 범용화 + 자동 학습

### 상태: 구현완료
### 브랜치: claude/review-excel-matching-axdTW

### 작업 내용
1. **하드코딩 규칙 → 2단계 분류**: BANK_RULES/CARD_RULES 폐기 → COMMON_BANK_RULES(공통) + classification_rules(매장별 DB)
2. **공통 규칙**: 카드사 정산코드, 이체코드, 세금, 카드대금 → 코드 유지 (어떤 매장이든 동일)
3. **매장별 규칙**: 거래처, 가맹점, 고정비 등 → DB 테이블(classification_rules)로 이전
4. **자동 학습**: 수동 분류(리뷰 확인/분류변경) 시 키워드를 DB에 자동 저장 → 다음부터 자동 매칭
5. **시드 마이그레이션**: 퐁당샤브 기존 규칙 → 첫 업로드 시 자동 DB INSERT (seedDefaultRules)
6. **범용성**: 새 매장은 빈 규칙으로 시작 → 사용하면서 규칙 축적

### DB 변경
- classification_rules: 신규 테이블 (keyword, match_type, category, sub_category, priority 등)
- docs/db_schema.md 업데이트 완료

### 수익화 포인트
- 무료: 공통 규칙만 / 유료: 매장별 자동 학습 무제한

### 다음 TODO
- [ ] Supabase에서 CREATE TABLE SQL 실행 (사장님)
- [ ] 실제 엑셀 업로드 테스트

---

## [2026-04-16] 대시보드 전월대비 문구 추가 (클로브 스타일)

### 상태: 배포완료
### 브랜치: claude/review-docs-assessment-WDrDx → main

### 작업 내용
1. **월 요약 전월대비 문구**: 실수익 아래 "지난달보다 매출 120만(▲12%) 늘고, 지출 20만(▼3%) 줄었어요 👍" 자동 생성
2. **지출 아코디언 MoM**: 식자재+인건비 2개 항상 표시, "매출대비" 문구 포함, ⚠️/✅ 아이콘
3. **주별 카드 MoM**: 전월 동일주차 대비 매출/지출/식자재/인건비 4항목, 컴팩트 1줄
4. **색상 규칙**: 매출↑파랑/↓빨강, 지출↑빨강/↓파랑 (좋으면 파랑, 나쁘면 빨강)
5. **전월 데이터 병렬 조회**: Promise.all에 전월 매출/고정비/식자재/인건비/영수증 5개 쿼리 추가
6. **전월 주차 자동 생성**: 전월도 월~일 기준 주차 그룹핑하여 동일주차 비교

### DB 변경
- 없음 (SELECT만)

### 기술 메모
- 전월 데이터 없으면 문구 자체 안 보임 (기존 UI 100% 유지)
- ±2% 이내 변동은 "비슷" 처리
- momTxt 헬퍼 함수로 통일 (isRevType 파라미터로 색상 방향 제어)

### 다음 TODO
- [ ] 카드 엑셀 실제 업로드 테스트

---

## [2026-04-15] 대시보드 안정성 + UI 전면 개선

### 상태: 배포완료
### 브랜치: claude/review-docs-design-BjzwH → main

### 작업 내용
1. **CORS/502 쿼리 최적화**: getMydataAmount() N×2회 → 2회 단일쿼리. loadDashboard() 3개 순차 → Promise.all 병렬. 로열티도 병렬 합류
2. **디버그 console.log 제거**: 엑셀업로드 11개 삭제, console.error 9개 유지
3. **catNames 동적화**: 하드코딩 → expense_categories DB data_source 기반 동적 생성
4. **기준% DB 저장**: store_settings.expense_thresholds(jsonb), 1.5초 디바운스 자동 저장
5. **마감예상 카드 색상**: 매출 파랑, 지출 빨강, 순수익 조건색, 예비비 회색
6. **주카드 개선**: 전체 카테고리 표시(0원 포함) + 컬러도트 + 순수익 라벨 + 2열 그리드
7. **상세비교 모달**: 총누계 행(파란배경) + 주별 접기/펼치기(▶/▼) + 셀 높이 통일
8. **모바일 좌우 스크롤 방지**: html overflow-x:hidden + min-width 제거 + container overflow
9. **라벨 변경**: 일별정산→주단위 요약, 상세비교→일별 상세비교
10. **월정산 상세 → 지출 상세 아코디언**: 독립 카드 제거, 지출 라벨 옆 버튼 → 아코디언(도넛차트+카테고리 테이블)
11. **매출 상세 아코디언**: 매출 라벨 옆 버튼 → 도넛(카드/현금 비율) + 결제수단 테이블 + 일평균/영업일수
12. **월 요약 table 전환**: flex→table + tabular-nums, 마감예상도 동일 구조. 숫자 자릿수 완벽 정렬
13. **영업일수 수정**: receiptCount(입력일수) → passedDays(경과일) 기준으로 변경
14. **docs 수정**: plan.md "네이버 클로브"→"Clobe", dev_lessons #22 행열 정렬 규칙 추가

### DB 변경
- store_settings: expense_thresholds (jsonb, default '{}') 컬럼 추가 — 실행 완료

### 다음 TODO
- [ ] 카드 엑셀 실제 업로드 테스트

---

## [2026-04-15] 대시보드 재설계 + 예비비 관리

### 상태: 배포완료
### 브랜치: claude/redesign-dashboard-settlement-fGMHI → main

### 작업 내용
1. **대시보드 전면 재설계 (토스 스타일)**:
   - 월 요약: 매출/지출/순수익/예비비/실수익 + 매출대비 비율% + 마감예상 별도 블록
   - 일별 정산: 토스 카드형 (주차 카드 + 일별 카드), 카테고리 컬러도트+비율
   - 주차: 월~일 기준, 현재주만 펼침, 나머지 접힘
   - 일별 카드 터치 → 카테고리 상세 펼침
   - 월정산 상세: 토스 스타일 카테고리별 컬러도트+금액+비율%
   - 일별 차트: 매출 + 순이익 동시 표시
2. **상세 비교 풀스크린 모달**:
   - "상세 비교" 버튼 → 풀스크린 모달 (가로 자동 전환)
   - 날짜=행, 항목=열 (엑셀 방향)
   - 카테고리별 금액+비율%, 주계행 다크 배경
   - 데이터 없는 날도 전체 표시 (빈 날 '-')
   - 카테고리별 기준% 설정 바: 초과 빨강 / 적정 파랑 즉시 반영
3. **예비비 관리 화면** (사이드메뉴 > 현황 > 예비비):
   - 예비비 잔고 카드 (총적립/총사용/현재잔고)
   - 예비비 설정 (비율/고정액/초기잔고)
   - 예비비 사용 등록 (바텀시트) + 이력 리스트
4. **예비비 잔고 미니**: 월 요약 하단에 잔고 + 클릭→예비비 화면
5. **인라인 핸들러 제거**: 대시보드 버튼 전체 addEventListener 전환

### DB 변경
- store_settings: reserve_rate, reserve_fixed, reserve_initial_balance 컬럼 추가
- reserve_fund_logs: 신규 테이블 (예비비 적립/사용 이력)

### 다음 TODO
- [x] 일별정산 catNames를 expense_categories DB에서 동적 로드 → 2026-04-15 완료
- [x] 상세비교 기준% 값을 store_settings에 저장 → 2026-04-15 완료
- [x] Supabase mydata_transactions CORS/502 에러 — 병렬 쿼리 최적화 → 2026-04-15 완료

---

## [2026-04-14] 기기인증 + 정산수정 + 직원관리 + 카테고리 + UX개선

### 상태: 배포완료
### 브랜치: main

### 작업 내용
1. **기기 기반 출퇴근 인증**: Device Fingerprint, 최초 자동등록, 관리자 초기화
2. **근태 기록 수정/삭제**: 전체조회에서 터치→편집 시트
3. **내 기록 간트 개선**: 오늘상태카드 제거, 근무시간 표시, 출근만도 바 표시
4. **마감정산 일별카드**: undefined 수정 + 수정/삭제 기능
5. **탭 전환 초기화**: 스크롤·서브탭·입력폼 리셋
6. **급여 0원 방지**: 퇴근<출근 검증, 자정 퇴근 fallback, 이상 표시
7. **직원관리**: 주민번호(마스킹)/외국인등록번호, 신고구분(외국인만), 전화 바로걸기
8. **카테고리 2단계**: parent_id로 대분류→소분류 트리 구조
9. **홈화면 분리**: 관리자→대시보드, 직원→근태, 로고 클릭 홈 이동
10. **UX**: 시간 24h 통일, 횡스크롤 제거, 메뉴명 정리, 하단 지출리스트 제거

### DB 변경
- employees: device_fingerprint, id_number, is_foreign, report_status
- expense_categories: parent_id

---

## [2026-04-14] 기기 기반 출퇴근 인증 + 근태 수정 + 간트 개선

### 상태: 구현완료
### 브랜치: claude/device-based-attendance-n9GRH

### 작업 내용
1. **기기 지문(Device Fingerprint) 인증**: canvas+screen+UA 조합 해시로 기기 고유 식별
   - 최초 출근 시 자동 등록, 이후 불일치 시 차단 (관리자 우회 가능)
   - 직원 편집 시트에 "등록 기기 초기화" 버튼 추가
2. **근태 기록 수정/삭제**: 전체조회 테이블 행 터치 → 편집 시트
   - 출근/퇴근 시간 수정, 휴게시간 조정, 급여 자동 재계산
   - 기록 삭제 기능 (관리자만)
3. **내 기록 간트차트 개선**:
   - 오늘 근태 상태 카드 제거 (중복 정보)
   - 날짜 라벨에 근무시간 직접 표시 (예: 8h30m)
   - 출근만 찍어도 바 표시 (오늘=현재시간까지 파란색, 과거 퇴근누락=주황색 짧은바)

### DB 변경
- employees.device_fingerprint (text, nullable) 추가

---

## [2026-04-14] 권한 체계 재설계 + 로그인 보안 + UI 개선

### 상태: 배포완료
### 브랜치: main (claude/review-account-verification-XigL3 → main 머지)

### 작업 내용
1. **계좌이체 사람이름 자동 분류**: 적요(desc) 재시도 + 입금+한글이름 → 매출/송금결제
2. **BANK_RULES 패턴 확장**: 타행PC/FB자금/BZ뱅크 등 커버
3. **간식/중식 자동 분류 확장**: 메가커피, 스타벅스, 이디야, 식당, 치킨 등
4. **배지 겹침 수정**: 확인/제외/취소 동시 표시
5. **마감정산 날짜 선택**: 관리자만 과거 날짜 정산 추가/수정 가능
6. **근태 주간 간트차트**: 내 기록에 근무계획 스타일 간트 + 오늘 상태 카드 + 누락 경고
7. **권한 체계 재설계 (auth_level 4단계)**:
   - DB: franchises 테이블, stores.franchise_id, employees.auth_level
   - owner / franchise_admin / store_manager / staff
   - owner만 자동 로그인, 나머지 PIN 필수
8. **로그인 화면 재설계**: 직원 리스트 → 드롭박스+PIN 입력 방식, 개발모드 삭제
9. **직원관리 통합**: 3탭(직원/직급/권한) → 1탭, 편집 시트에서 권한 드롭박스 직접 설정
10. **직원 카드형 UI**: 토스 스타일, 시급/은행/입사일 분리
11. **직원 편집폼 라벨 추가 + 자동 하이픈** (전화번호, 날짜)
12. **PIN 필수 강제**: 미설정 시 저장/로그인 차단
13. **권한 보안**: 일반 직원은 편집/추가/권한변경/퇴사 버튼 숨김, 로그아웃 시 화면 초기화
14. **급여 집계**: 시급 컬럼 + 미산출 감지 + 재계산 기능
15. **초기 로딩 최적화**: 5개 API → 1개(employees)만 먼저, 나머지 백그라운드

### DB 변경
- franchises 테이블 신규
- stores.franchise_id 추가
- employees.auth_level 추가 (text, default 'staff')

---

## [2026-04-09] 카드 엑셀 업로드 버그 수정 + 거래내역 리스트 UI

### 상태: 배포완료
### 브랜치: claude/debug-card-upload-V4DBL

### 작업 내용
1. **카드 .xls 파싱 버그 수정**: 카드사 .xls 파일은 실제 HTML 테이블 → SheetJS가 요약만 읽는 문제 → DOMParser로 직접 파싱
2. **거래내역 테이블 UI**: 마이데이터 연결 빈 화면 제거 → 항상 테이블로 거래내역 표시
3. **컬럼 정렬**: 헤더 터치 → 오름/내림차순 토글
4. **필터 버튼**: 날짜 범위(date picker) + 분류(바텀시트 체크리스트) + 입금만/출금만
5. **적요 코드 분리**: 업로드 시 내용만 description 저장, 표시 시 적요 자동 제거
6. **분류 수정 기능**: 분류 셀 터치 → 카테고리 선택 → category + category_id FK 동기화
7. **테이블 압축**: 내용 6글자 + 말풍선 툴팁, 날짜 YY-MM-DD, 금액 nowrap
8. **합계 위치**: 테이블 아래 → 위로 이동 (스크롤 없이 확인)
9. docs/plan.md에 클로브(clobe.ai) UI 참조 추가

---

## [2026-04-09] 엑셀 업로드 수정 + 대시보드 연동

### 상태: 배포완료
### 브랜치: claude/fix-excel-upload-errors-dKfoz

### 작업 내용
1. Gemini AI 프록시 500 에러 → AI 제거, 컬럼 키워드 매칭으로 대체
2. Cloudflare CSP inline 핸들러 차단 → addEventListener 방식 전환 (→ dev_lessons.md #1)
3. DOMContentLoaded return 순서 버그 → bindFile을 return 위로 이동 (→ dev_lessons.md #2)
4. sheet-overlay 이중 구조 → openSheet/closeSheet 분기 처리 (→ dev_lessons.md #3)
5. category 이름 불일치 → CAT_NAME_MAP 매핑 추가 (→ business_rules.md #5)
6. mydata_transactions → 대시보드/지출대조 FK 연동
7. 가마감/진마감 토글 추가
8. 귀속월(attribution_month) 자동 추출
9. 매출 엑셀 업로드 추가 (마감정산 탭)

### 은행/카드 호환
- 은행 13개사, 카드 8개사 검증 완료 (→ plan.md #3)

---

## [2026-04-09] docs 전체 정리

### 상태: 완료

### 작업 내용
1. plan2.md → plan.md 이름 변경 + 전면 재작성 (excel-upload-plan 통합)
2. excel-upload-plan.md 삭제
3. services.md 신규 생성 (외부 URL/키/배포 정보 분리)
4. work_log.md 축소 (중복 제거 → dev_lessons/business_rules 참조)
5. dev_lessons.md 정리 (중복 제거)
6. db_schema.md 업데이트 (mydata_transactions, reconciliation, vendor_diffs 추가)
7. CLAUDE.md에 추가:
   - 새 세션 시작 시 필독 순서
   - docs 자동 기록 규칙 (모든 docs 파일 해당 이벤트 시 즉시 업데이트)

### 반성
- 사장님 지시사항(인건비 익월지급) 같은 변수를 코드 구현에 바로 반영하지 않았음
- docs 기록을 수동으로만 하다 보니 누락 발생 → 자동 기록 규칙으로 방지

---

### 다음 TODO
- [ ] 디버그 console.log 제거
- [ ] 카드 엑셀 실제 업로드 테스트
