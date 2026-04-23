# 퐁당샤브 관리 시스템 — 전체 설계 현황

> 최종 업데이트: 2026-04-22 (#57 거래내역 UI 전면 개편 + 분류 선택 바텀시트 3단계 드릴다운)

---

## 0. 외부 서비스 / 배포 정보
> `docs/services.md` 참조

---

## 1. 기능별 구현 현황

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 1 | 영수증 AI 분석 | ✅ 완료 | Gemini AI 유지 |
| 2 | 근태 관리 (출퇴근/CAPS) | ✅ 완료 | |
| 3 | 근무계획 (간트차트) | ✅ 완료 | |
| 4 | 마감정산 (현금 vs 장부) | ✅ 완료 | POS AI 인식 유지 |
| 5 | 대시보드 (매출/지출/순이익) | ✅ 완료 | 일별/주별/월별 정산 + 예비비 관리 |
| 6 | 급여 집계 | ✅ 완료 | |
| 7 | 거래처 관리 + 파일 업로드 | ✅ 완료 | AI 제거 → 컬럼 매칭 |
| 8 | 고정비 관리 | ✅ 완료 | |
| 9 | 지출 카테고리 | ✅ 완료 | |
| 10 | 엑셀 업로드 (은행/카드) | ✅ 완료 | AI 제거 → 키워드 분류 |
| 11 | 매출 엑셀 업로드 | ✅ 완료 | 마감정산 탭 |
| 12 | 정산/검수 (지출대조) | ✅ 완료 | 기록 vs mydata 자동 매칭 |
| 13 | 공과금 미납 알림 | ⏳ 부분 | UI만 (체크 로직 미구현) |
| 14 | 거래처 차액 추적 | ⏳ 부분 | DB만 (로직 미구현) |
| 15 | 월 귀속 판단 고도화 | ⏳ 부분 | 기본 추출만 |
| 16 | Codef API 연동 | ❌ 대기 | 유료 견적 답변 대기 |
| 17 | 권한 체계 (auth_level) | ✅ 완료 | 4단계: owner/franchise_admin/store_manager/staff |
| 18 | 로그인 보안 | ✅ 완료 | PIN 필수, owner만 자동로그인, 드롭박스 방식 |
| 19 | 마감정산 날짜 선택 | ✅ 완료 | 관리자만 과거 날짜 정산 |
| 20 | 근태 주간 간트차트 | ✅ 완료 | 내 기록에 계획vs실제 바 표시 |
| 21 | 직원관리 통합 | ✅ 완료 | 3탭→1탭, 편집시트에서 권한 직접 설정 |
| 22 | 급여 재계산 | ✅ 완료 | 시급 변경 후 기존 기록 재계산 |
| 23 | 엑셀 사람이름 자동 분류 | ✅ 완료 | 적요 재시도 + 입금+이름패턴 |
| 24 | 기기 기반 출퇴근 인증 | ✅ 완료 | Device Fingerprint + 관리자 초기화 |
| 25 | 근태 기록 수정/삭제 | ✅ 완료 | 관리자 전체조회에서 터치→편집 |
| 26 | 내 기록 간트 개선 | ✅ 완료 | 오늘상태카드 제거, 근무시간 표시, 출근만도 바 표시 |
| 27 | 마감정산 일별카드 수정 | ✅ 완료 | undefined 수정 + 수정/삭제 기능 |
| 28 | 탭 전환 상태 초기화 | ✅ 완료 | 스크롤·서브탭·입력폼 리셋 |
| 29 | 급여 0원 방지 | ✅ 완료 | 시간 검증 + 자정 퇴근 fallback + 이상 표시 |
| 30 | 직원관리 주민번호/외국인 | ✅ 완료 | 주민번호 마스킹, 외국인등록번호, 신고구분 |
| 31 | 카테고리 대분류→소분류 | ✅ 완료 | parent_id 2단계, 트리 UI |
| 32 | 홈화면 역할별 분리 | ✅ 완료 | 관리자→대시보드, 직원→근태, 로고 클릭 홈 |
| 33 | 대시보드 재설계 (일별/주별) | ✅ 완료 | 월요약+주단위요약+월정산+차트, 매출대비 비율% |
| 34 | 예비비 관리 | ✅ 완료 | 잔고계산, 설정, 사용등록, 이력 |
| 35 | 상세비교 풀스크린 모달 | ✅ 완료 | 가로전환, 피벗테이블, 주계행, 기준% 색상, 총누계+주별접기 |
| 36 | 대시보드 쿼리 최적화 | ✅ 완료 | getMydataAmount 2회로 축소, Promise.all 병렬화, console.log 제거 |
| 37 | catNames 동적화 | ✅ 완료 | expense_categories DB data_source 기반 동적 생성 |
| 38 | 기준% DB 저장 | ✅ 완료 | store_settings.expense_thresholds jsonb |
| 39 | 매출/지출 상세 아코디언 | ✅ 완료 | 도넛차트 + 카테고리 테이블, 매출(카드/현금/일평균), 지출(카테고리별) |
| 40 | 모바일 좌우 스크롤 방지 | ✅ 완료 | html overflow-x:hidden, min-width 제거, container overflow |
| 41 | 월요약 table 정렬 | ✅ 완료 | flex→table 전환, tabular-nums, 마감예상 포함 |
| 42 | 전월대비 문구 (클로브 스타일) | ✅ 완료 | 월요약+지출아코디언+주별카드, 매출↑파랑/지출↑빨강 |
| 43 | 엑셀 분류 DB 범용화 | ✅ 완료 | 하드코딩→classification_rules DB, 매장별 학습, 공통/매장 2단계 |
| 44 | 직원 서류 관리 | ✅ 완료 | 파일 첨부(Storage), 배지 개별 표시, 미성년자 감지, 비자 관리 |
| 45 | 영수증 OCR 개선 + 학습 | ✅ 완료 | 해상도↑, 프롬프트 강화, 규칙 덮어쓰기 학습, DB 카테고리 FK |
| 46 | 매장 IP 다중 등록 | ✅ 완료 | 쉼표 구분 다중 IP, 추가/삭제 UI |
| 47 | 거래내역 삭제 | ✅ 완료 | 월 일괄 + 건별 삭제 |
| 48 | 지출 카테고리 독립 화면 | ✅ 완료 | 설정에서 분리, 삭제 버튼 추가, 비활성 집계 |
| 49 | CAT_NAME_MAP 하드코딩 제거 | ✅ 완료 | DB 카테고리 직접 FK, 분류변경 대분류>소분류 트리 UI |
| 50 | 로그인 시 기기 등록 팝업 | ✅ 완료 | staff 로그인 직후 3상태 팝업(미등록/일치/불일치), 일치 3초 자동닫힘, 관리자 스킵 |
| 51 | 거래내역 분류 2줄 + 5필드 편집 + FK 정합성 | ✅ 완료 | 분류 셀 2줄(대분류 9px/소분류 11px), ✎편집 버튼 신설(날짜/내용/분류/입금/출금), category_id=대분류 고정 규칙 확립, 확인필요 수기입력 제거, tx_hash C안(원본 지문 보존) |
| 52 | 지출카테고리 2차 개편 (식자재 통합 + 주류 분리) | ✅ 완료 | **B+가 안**. 식자재 대분류 1개(composite) + 육류/야채/공산품 소분류 3개. 직구 개념 삭제(품목 기반). 주류 별도 대분류. vendor_orders + receipts 자동 합산. receipts.category_id=소분류 id 규칙. 거래처 재분류 도우미 UI. 마이그레이션 SQL+롤백 SQL 포함 |
| 53 | 매출/제외 카테고리 분리 (category_type) | ✅ 완료 | expense_categories.category_type 컬럼(expense/income/exclude) 추가. 관리 화면 상단 탭 3개. 리뷰 드롭다운 하드코딩 제거 → DB optgroup 동적. 집계 함수 category_type='expense' 필터. 매출/제외는 사장님이 UI에서 직접 추가 (하드코딩 금지 원칙) |
| 54 | "영수증 참조" 소분류 + 영수증 기반 집계 대체 | ✅ 완료 | 한 영수증에 식자재/비품 섞인 케이스 대응. 카드 거래는 식자재>영수증참조로 분류하고 지출 집계에서 제외, receipts에서 품목별 집계 → 이중 집계 방지. 거래내역 UI에 📸 배지 표시 |
| 55 | 카테고리 드래그 정렬 (SortableJS) | ✅ 완료 | ▲▼ 버튼 → ☰ 삼선 드래그 핸들, 모바일 터치 지원. sort_order 자동 저장. 편집 시 순서 유지 (기존에 편집하면 맨 뒤로 밀리던 버그 수정) |
| 56 | linked 카테고리 분리 (영수증참조 + 예비비) | ✅ 완료 | category_type에 'receipt_ref', 'reserve' 추가. 2개 대분류 INSERT(시스템 상수). 관리 탭은 기존 3개(지출/매출/제외) 유지. 리뷰 드롭다운 optgroup 5개. 예비비 선택 시 메모 입력 필드. 저장 시 reserve_fund_logs 자동 INSERT(source_tx_id 연결). exclude_from_settlement 자동 처리 |
| 57 | 거래내역 UI 전면 개편 + 분류 선택 바텀시트 | ✅ 완료 | 테이블: 4열(내용/대분류/소분류/금액) + 날짜 그룹 헤더(sticky) + 컬러 도트 + 금액 통합(+파랑/-빨강) + 행 탭→편집. 정렬 3단계 토글(오름→내림→해제). 필터 z-index/네비바 회피. 분류 선택 바텀시트: sheet-overlay 패턴, 3단계 드릴다운(타입→대분류→소분류), 영수증참조/예비비는 1단계 바로 선택, 예비비 메모 prompt. FK 보강: resolveCatPair '>' 분리. cat===sub UI 방어 |
| 58 | 매출 관리 페이지 (sales_daily 가로형 피벗 + 카드 UI) | ✅ 완료 (2026-04-23 재설계) | **v1 폐기 → v2 가로형으로 재작성**. 이전 `sales_records`(세로 raw)는 월 180행 쌓여 결산 비효율 + 모바일 짤림. 새 테이블 `sales_daily` (하루 1행, UNIQUE(store_id,date), 컬럼 7개: card/cash/cash_receipt/qr/etc/extra_large/extra_small). UI는 **카드형** — 각 일자 1장 카드(세로 스크롤, 짤림 없음), 월 합계 sticky 상단. 카드 탭 → 편집 시트(7개 결제수단 입력, 합계 자동 계산). 마감정산 저장 시 `syncClosingToSalesDaily` 1회 upsert (items.pos_card→card, cash_detail_cash→cash, pos_cash_receipt→cash_receipt, cash_detail_qr→qr, pos_etc+cash_detail_transfer→etc, extra_draw_*→extra_*). source 컬럼 보유(미래 API 대비). 2단계(동적 결제수단 추가/삭제, 대시보드 연계, 실제 API)는 추후. dev_lessons #45 "사용자 UX는 DB 스키마보다 강하다" 추가 |

---

## 2. 정산/검수 시스템

### 대조 대상 (9개 항목)
| # | 항목 | 기록 소스 | 실제 소스 |
|---|------|----------|-----------|
| 1 | 거래처 매입 | vendor_orders (거래처별 소계) | mydata_transactions |
| 2 | 인건비(급여) | attendance_logs.calculated_wage | mydata_transactions (귀속월 기준) |
| 3 | 인건비(수당) | special_wages.extra_amount | mydata_transactions |
| 4 | 고정비 | fixed_cost_amounts (항목별) | mydata_transactions |
| 5 | 소모품/비품 | receipts | mydata_transactions |
| 6 | 로열티 | 매출 × royalty_rate | mydata_transactions |
| 7 | 카드수수료 | 카드매출 × card_fee_rate | mydata_transactions |
| 8 | 수동 카테고리 | expense_category_amounts | mydata_transactions |
| 9 | 기타/미분류 | — | mydata_transactions 미매칭 건 |

### FK 설계
- `reconciliation.category_id` → `expense_categories.id`
- `mydata_transactions.category_id` → `expense_categories.id`

---

## 3. 엑셀 업로드 시스템

### 업로드 흐름
```
파일 선택 (xlsx, xls, csv)
  → parseExcelFile (SheetJS 파싱)
  → matchColumns (헤더 키워드 자동 매칭)
  → classifyByKeyword (적요/내용으로 카테고리 분류 + 귀속월 추출)
  → renderExcelPreview (미리보기)
  → saveExcelBatch (category_id FK 매칭 → mydata_transactions 저장)
```

### 호환 현황
- **은행 13개사**: 신한/KB/NH/우리/하나/카카오/토스/IBK/SC/새마을/수협/신협/대구
- **카드 8개사**: 신한/삼성/현대/KB/롯데/하나/BC/NH

### 특수 처리
1. 중복 방지: tx_hash (날짜+시간+금액+내용 해시)
2. 취소/환불: is_cancelled, original_amount
3. 정산 제외: 카드대금, 배당금, 개인결제
4. 귀속월: "급여03월" → attribution_month='2026-03'
5. 카테고리 매핑: → `business_rules.md` 참조

---

## 4. 가마감 / 진마감

> 상세 규칙 → `business_rules.md` 참조

- **가마감**: 발생기준(예측). 기록 소스 (attendance, vendor_orders 등)
- **진마감**: 출금기준(확정). mydata_transactions 실제 출금
- 대시보드 상단 토글로 전환

---

## 5. 미구현 기능

### 5-1. 공과금 미납 알림
- fixed_costs에 expected_day, tolerance_days 필드 있음
- 매 정산/검수 로드 시: mydata에서 매칭 출금 검색
- 예정일 + 유예일수 경과 + 출금 없음 → "미납 의심"

### 5-2. 거래처 차액 추적
- vendor_orders 월 합계 vs mydata 거래처 출금 비교
- 차액 → vendor_diffs 기록, 다음 달 상계 시 resolved

### 5-3. 월 귀속 판단 고도화
현재: "XX월" 패턴만 추출. 목표:
```
1차: 내용에 월 정보 + 금액 정상 범위 → 자동 귀속
2차: 고정비 + 예정일 기반 → 전월분 제안
3차: 거래처 월정산 + 금액 대조
4차: 해당 없음 → 출금월 = 귀속월
```

### 5-4. Codef API 연동
- Sandbox 사용 가능 (3개월 무료, 일 100건)
- 실서비스: 유료 구독 필요 (견적 답변 대기)

### 5-5. 지출카테고리 2차 개편 (식자재 대분류 통합)
**논의·설계 단계** (2026-04-21) — 새 세션에서 진행 예정.
- 현 구조: `식자재(거래처)/식자재(직구)/식자재(주류)` 구매경로별 분리
- 목표 구조: `식자재` 대분류 하나 + `육류/야채/공산품` 소분류
- FK 영향 6군데 점검 필요 (상세: work_log.md "지출카테고리 2차 개편" 항목)
- 단계 옵션: 1단계 소형(vendors 확장 + 도우미) / 2단계 대형(풀패키지) / 하이브리드(추천)
- 주류 위치 미결 (별도 대분류 vs 식자재 소분류)

---

## 6. UI 참조 앱

| 앱 | 참조 포인트 |
|---|---|
| **토스** | 거래내역 리스트, 깔끔한 카드 UI, 컬러 체계 |
| **Clobe** | 데이터 테이블 UI, 필터/정렬 UX, 전체적 디자인 감각 (https://clobe.ai/) |

---

## 7. Supabase 테이블 목록

> 상세 스키마 → `db_schema.md` 참조

기존 17개 + 추가 4개 = 21개
