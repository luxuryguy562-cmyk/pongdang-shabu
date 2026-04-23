# 퐁당샤브 Supabase DB 스키마

> **Supabase URL**: `https://ruytgygjwnbtzmtofopg.supabase.co`
> **store_id**: `4ae03341-e5dc-4933-b746-29728cbc685f` (퐁당샤브 논산점)
> **최종 업데이트**: 2026-04-22 (#53 매출/제외 카테고리 분리 — category_type 컬럼 추가)

## 테이블 관계도

```
franchises (프랜차이즈/브랜드)
  └── stores (매장) ─ 1:N (franchise_id FK)
  ├── store_settings (매장 설정) ─ 1:1
  ├── employees (직원) ─ 1:N
  │     ├── attendance_logs (출퇴근) ─ 1:N
  │     ├── work_schedules (스케줄) ─ 1:N
  │     └── caps_upload_staging (CAPS) ─ 1:N
  ├── roles (직급) ─ 1:N
  ├── receipts (영수증) ─ 1:N
  ├── daily_sales (일별 매출) ─ 1:N
  ├── settlements (정산) ─ 1:N
  ├── vendors (거래처) ─ 1:N
  │     └── vendor_orders (주문) ─ 1:N
  ├── expense_categories (지출 카테고리) ─ 1:N
  │     └── expense_category_amounts (카테고리 금액) ─ 1:N
  ├── fixed_costs (고정비 항목) ─ 1:N
  │     └── fixed_cost_amounts (고정비 금액) ─ 1:N
  └── special_wages (특별 수당) ─ 1:N
```

## 테이블 상세 (18개 + franchises 1개 + classification_rules 1개 = 23개)

### franchises (신규)
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 프랜차이즈 ID |
| name | 브랜드명 (퐁당샤브, 유림대패 등) |
| is_active (bool, default true) | 활성 여부 |
| created_at (timestamptz) | 생성일 |

### stores
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 매장 고유 ID |
| name | 매장명 |
| franchise_id (FK→franchises) | 소속 프랜차이즈 |
| is_active | 활성 여부 |

### store_settings
| 컬럼 | 용도 |
|------|------|
| store_id (FK→stores, unique) | 매장 ID (1:1) |
| ups_store_code | 업솔루션 매장 코드 |
| ups_id / ups_pw | 업솔루션 로그인 정보 |
| expense_thresholds (jsonb, default '{}') | 상세비교 기준% (카테고리명→%) |
- upsert onConflict: `store_id`

### employees
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 직원 ID |
| store_id (FK→stores) | 소속 매장 |
| name | 이름 |
| role | 직급명 (**문자열**, roles.name 참조, FK 아님) |
| id_number (text, nullable) | 주민번호 or 외국인등록번호 |
| is_foreign (bool, default false) | 외국인 여부 |
| report_status (text, default '미신고') | 신고 구분 (신고/미신고) |
| birth_date, phone, address | 개인정보 |
| bank_name, account_number | 급여 계좌 |
| base_wage (int) | 시급 |
| pin | 로그인 PIN |
| caps_id | CAPS 지문인식기 ID |
| device_fingerprint (text, nullable) | 기기 지문 해시 (출퇴근 기기 인증용) |
| hire_date, resign_date | 입퇴사일 |
| is_active, is_approved, is_manager | 상태 플래그 |
| auth_level (text, default 'staff') | 권한: owner/franchise_admin/store_manager/staff |
| visa_type (text, nullable) | 비자 유형 (E-9, F-2 등) |
| visa_expires_at (date, nullable) | 비자 만료일 |
| doc_contract (text, nullable) | 근로계약서 파일 URL (null=미첨부) |
| doc_health_cert (text, nullable) | 보건증 파일 URL |
| doc_health_expires (date, nullable) | 보건증 만료일 |
| doc_minor_consent (text, nullable) | 법대동의서 파일 URL (미성년자) |
| doc_foreigner_id (text, nullable) | 외국인등록증 파일 URL |

### roles
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 직급 ID |
| store_id (FK→stores) | 매장 |
| name | 직급명 |
| level (int) | 우선순위 (낮을수록 상위) |
| is_manager_role (bool) | 관리자 직급 여부 |

### attendance_logs
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 기록 ID |
| store_id, employee_id, work_date | 매장/직원/날짜 (사실상 unique) |
| app_in, app_out (timestamptz) | 앱 출퇴근 |
| caps_in, caps_out | CAPS 출퇴근 |
| rest_min, total_work_min (int) | 휴게/총 근무시간(분) |
| calculated_wage (int) | 계산 급여 |
| weekend_flag (bool) | 주말 여부 |
| caps_match_status | 매칭 상태 |
| time_diff_min | 앱-CAPS 시간차 |
| check_in_ip, check_out_ip | IP 기록 |

### work_schedules
| 컬럼 | 용도 |
|------|------|
| store_id, employee_id, work_date | 복합 unique |
| start_time, end_time | 시작/종료 (HH:MM) |
| is_off (bool) | 휴무 |
- upsert onConflict: `store_id, employee_id, work_date`

### daily_sales
| 컬럼 | 용도 |
|------|------|
| store_id, sale_date | 매장/날짜 |
| total_sales, card_sales, cash_sales (int) | 매출 |

### sales_daily (신규 2026-04-23)
⚠️ 이전 설계 `sales_records` (세로 raw)는 **폐기**. 세로로 풀면 월 180행 → 결산 비효율 + 모바일 짤림. **가로형 피벗**으로 재설계 (하루 1행, 결제수단 컬럼 7개).

| 컬럼 | 타입 | 용도 |
|------|------|------|
| id | UUID PK | |
| store_id | UUID FK→stores (CASCADE) | 매장 격리 |
| date | DATE | 매출일 |
| card | NUMERIC | 💳 신용카드 (POS pos_card) |
| cash | NUMERIC | 💵 현금 (cash_detail_cash = 순수 현금) |
| cash_receipt | NUMERIC | 🧾 현금영수증 (pos_cash_receipt) |
| qr | NUMERIC | 📱 QR (cash_detail_qr) |
| etc | NUMERIC | 📲 기타결제 (pos_etc + cash_detail_transfer) |
| extra_large | NUMERIC | 🎰 뽑기(대형) (extra_draw_large) |
| extra_small | NUMERIC | 🎲 뽑기(소형) (extra_draw_small) |
| memo | TEXT | 비고 |
| source | TEXT | 'manual'/'closing'/'closing_edited'/'pos_api'/'card_api' — `closing_edited`는 마감자동 행을 사장님이 손으로 고친 후. 이후 마감정산 재저장 시 **보호(skip)** |
| created_at, updated_at | TIMESTAMPTZ | |
| **UNIQUE(store_id, date)** | | 하루 1행 강제 |

**인덱스**: `(store_id, date DESC)`
**합계 계산**: 앱 레벨 — `total = card + cash + cash_receipt + qr + etc + extra_large + extra_small`
**settlements ↔ sales_daily 매핑** (마감정산 저장 시 `syncClosingToSalesDaily()`):
- items.pos_card → card
- items.cash_detail_cash → cash (순수 현금)
- items.pos_cash_receipt → cash_receipt
- items.cash_detail_qr → qr
- items.pos_etc + items.cash_detail_transfer → etc (POS 기타 + 계좌이체 합)
- items.extra_draw_large → extra_large
- items.extra_draw_small → extra_small

**UI**: 매출 관리 페이지는 **카드형** (각 일자 1카드, 세로 스크롤). 월 합계 sticky 상단. 카드 탭 → 편집 시트 (7개 결제수단 입력 + 합계 자동).
**매장 격리**: 모든 쿼리에 `.eq('store_id', currentStore.id)` 필수.

### receipts
| 컬럼 | 용도 |
|------|------|
| store_id | 매장 |
| receipt_date, vendor, category, item | 날짜/거래처/분류(문자열)/품목 |
| **category_id** (FK→expense_categories) | **소분류 id 저장 규칙** (2026-04-22 확립). 품목이 명시돼 있어 소분류 추론 가능. mydata는 대분류 id. 집계 시 parent 조인으로 대분류 합산 |
| price, count, total_price (int) | 단가/수량/합계 |
| note | 정상/오답/반품 등 |
| created_at | 등록일시 |

### settlements
| 컬럼 | 용도 |
|------|------|
| store_id, settle_date | 매장/정산일 (unique) |
| items_json, vault_json (jsonb) | 정산항목/금고 상세 |
| actual_total, expected_total, diff_amount (int) | 실제/예상/차이 |
| diff_status | 과부족 상태 |
| sales_total (int) | 매출 합계 |
- upsert onConflict: `store_id, settle_date`

### vendors / vendor_orders
| vendors | vendor_orders |
|---------|---------------|
| id, store_id, name, category, is_active | store_id, vendor_id(FK), order_date |
| | item, amount, memo, source |

### expense_categories / expense_category_amounts
| expense_categories | expense_category_amounts |
|-------------------|--------------------------|
| id, store_id, name, color | expense_category_id(FK) |
| parent_id (FK→self, nullable) | year_month, amount |
| data_source, source_filter, is_active | |
| **vendor_category** (text, nullable) — vendors.category 필터 매핑 (예: '육류') | |
| **category_type** (text, default 'expense') — 'expense'/'income'/'exclude' (2026-04-22 #53) | |

**category_type 규칙 (2026-04-22 #53 + #55)**:
- `expense` — 지출 카테고리 (사장님 관리)
- `income` — 매출 카테고리 (사장님 관리, 은행 입금 분류. 실제 매출은 settlements POS)
- `exclude` — 정산제외 (사장님 관리, 카드대금/배당금)
- `receipt_ref` — **영수증 참조** (시스템 상수, 관리 탭 X). 카드/은행 거래 1건이 여러 품목 섞인 경우 이 분류로 두고 영수증에서 품목별 집계
- `reserve` — **예비비 사용** (시스템 상수, 관리 탭 X). 거래 저장 시 `reserve_fund_logs`에 자동 INSERT (source_tx_id 연결)
- 관리 화면 탭 3개: expense/income/exclude만 (receipt_ref/reserve는 시스템 연결용 상수)
- 리뷰 드롭다운은 5 타입 optgroup으로 구분 표시
- expense/income/exclude만 사장님이 UI에서 편집 가능, receipt_ref/reserve는 DB에 고정 1건씩 INSERT된 상태

**data_source 값 정의 (2026-04-22 확장)**:
- `vendor_orders` — 거래처 주문(vendor_orders)만 집계. `vendor_category` 필터 적용
- `receipts` — 영수증만 집계. 소분류 id 또는 대분류 id인 receipts 포함
- `composite` — 거래처+영수증 **합산** (식자재 대분류 및 육류/야채/공산품 소분류용).
  - 대분류 composite: 자식 소분류들의 vendor_category 총합 + 자식 id로 된 receipts + 본인 id receipts
  - 소분류 composite: 본인 vendor_category + 본인 id receipts
  - ⚠️ 대분류만 집계 루프 참여, 소분류는 `details`로 하위 표시됨 (중복 방지)
- `attendance` — attendance_logs.calculated_wage 합 (인건비)
- `fixed_costs` — fixed_cost_amounts (고정비)
- `manual` — expense_category_amounts 수동 입력

### fixed_costs / fixed_cost_amounts
| fixed_costs | fixed_cost_amounts |
|------------|-------------------|
| id, store_id, name, category | fixed_cost_id(FK) |
| sort_order, is_active, is_variable | year_month, amount, estimated_amount, is_confirmed |
- upsert onConflict: `fixed_cost_id, year_month`

### special_wages
| 컬럼 | 용도 |
|------|------|
| store_id, target_date | 매장/적용일 |
| extra_amount (int) | 추가 금액 |
| memo | 메모 |

### caps_upload_staging
- CAPS 지문인식 파일 파싱 후 임시 저장 테이블
- stagingData 배열을 bulk insert

### mydata_accounts
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 계좌/카드 ID |
| store_id (FK→stores) | 매장 |
| account_type | 'bank' / 'card' |
| bank_name | 은행/카드사명 |
| account_number | 계좌/카드번호 |

### mydata_transactions
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 거래 ID |
| store_id (FK→stores) | 매장 |
| account_id | 계좌/카드 ID |
| tx_type | 'bank' / 'card' |
| tx_date, tx_time | 거래 일시 |
| description | 적요+내용 (은행) |
| merchant_name | 가맹점명 (카드) |
| amount (int) | 금액 (입금 양수, 출금 음수) |
| balance (int) | 잔액 |
| source | 'excel_bank' / 'excel_card' |
| **category** | 분류명 문자열 (대분류명 저장, 예: 식자재(거래처)) |
| **category_id (FK→expense_categories)** | **항상 대분류 id** (parent_id IS NULL인 카테고리) — 2026-04-21 규칙 확립 |
| sub_category | 소분류명 (text, FK 아님). resolveCatPair로 분리 저장 |
| confidence | 'high' / 'medium' / 'low' |
| needs_review (bool) | 확인 필요 여부 |
| review_reason | 확인 필요 사유 |
| exclude_from_settlement (bool) | 정산 제외 (카드대금, 배당 등) |
| attribution_month | 귀속월 (YYYY-MM, 출금월과 다를 수 있음) |
| supply_amount, vat_amount | 공급가/부가세 |
| raw_description | 원본 적요 |
| upload_batch_id | 업로드 배치 ID |
| tx_hash | 중복 방지 해시 (UNIQUE) |
| is_cancelled (bool) | 취소 건 |
| original_amount | 취소 전 원금액 |
| raw_data (jsonb) | 원본 데이터 전체 |

### reconciliation
| 컬럼 | 용도 |
|------|------|
| store_id (FK→stores) | 매장 |
| year_month | 정산월 (YYYY-MM) |
| category_id (FK→expense_categories) | 지출 카테고리 |
| sub_key | 하위 항목 키 (vendor_id, employee_id 등) |
| sub_label | 하위 항목명 |
| recorded_total | 기록 금액 |
| actual_total | 실제 출금 |
| diff_amount | 차이 |
| status | 'pending' / 'matched' / 'overpaid' / 'underpaid' |
| confirmed_by, confirmed_at | 확인자/일시 |
| memo | 메모 |
- UNIQUE(store_id, year_month, sub_key)

### vendor_diffs
| 컬럼 | 용도 |
|------|------|
| store_id (FK→stores) | 매장 |
| vendor_id (FK→vendors) | 거래처 |
| year_month | 정산월 |
| expected_amount | 기록 금액 |
| actual_amount | 실제 출금 |
| diff_amount | 차이 |
| status | 'pending' / 'resolved' |
| resolved_at | 해결일 |
| memo | 메모 |

### reserve_fund_logs (신규)
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 기록 ID |
| store_id (FK→stores) | 매장 |
| log_date (date) | 발생일 |
| year_month (text) | 귀속월 (YYYY-MM) |
| type (text) | 'deposit' / 'withdrawal' |
| amount (int) | 금액 |
| memo (text) | 사유 (예비비 사용 상세, 예: "에어컨 수리") |
| source_tx_id (uuid, FK→mydata_transactions, nullable) | 자동 동기화 연결 (2026-04-22 #55) |
| created_at (timestamptz) | 생성일 |

**source_tx_id 규칙 (2026-04-22 #55)**:
- 엑셀 업로드 or 거래 편집 시 category='예비비 사용' 선택하면 이 log에 자동 INSERT
- 거래 삭제·분류 변경 시 ON DELETE SET NULL (log는 유지, 연결만 해제)
- 거래 편집 시 이미 log 존재하면 UPDATE, 없으면 INSERT

### classification_rules (신규)
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 규칙 ID |
| store_id (FK→stores) | 매장 (매장별 규칙) |
| keyword (text, NOT NULL) | 매칭 키워드 ("양두현", "쿠팡") |
| match_type (text, default 'contains') | 'contains' / 'exact' / 'regex' |
| tx_type (text, default 'both') | 'bank' / 'card' / 'both' |
| category (text, NOT NULL) | 대분류 (물품대금, 직구, 고정비...) |
| sub_category (text, default '') | 소분류 (행복한정육점, 직구상세...) |
| exclude_from_settlement (bool, default false) | 정산 제외 여부 |
| priority (int, default 100) | 우선순위 (낮을수록 먼저) |
| created_at (timestamptz) | 생성일 |
- UNIQUE(store_id, keyword, tx_type)
- 용도: 매장별 엑셀 업로드 자동 분류 규칙. 수동 분류 시 자동 학습(INSERT)

### store_settings 추가 컬럼
| 컬럼 | 용도 |
|------|------|
| reserve_rate (numeric, default 0.05) | 예비비 비율 (%) |
| reserve_fixed (int, default 400000) | 예비비 고정액 |
| reserve_initial_balance (int, default 0) | 예비비 초기 이월 잔고 |

## 주의사항
- **RLS 1차 활성 (2026-04-17 Phase 2b)**: 매장별 22개 테이블 RLS ON + `pd_phase2b_all` 정책
  - 정책: `USING(true) WITH CHECK(store_id IS NOT NULL) FOR ALL TO public`
  - 의미: 읽기 전부 허용 + 쓰기 시 store_id 필수. **느슨함 — 코드 레이어 필터와 2중 방어**
  - 향후 Phase 2c에서 Cloudflare Worker + JWT auth 도입 후 엄격화 예정
  - SQL 파일: `docs/sql/phase2b_rls_enable.sql` / `phase2b_rls_rollback.sql`
- **RLS 비활성 테이블**: stores, franchises (부모 테이블, store_id 없음)
- **store_id 필수**: 모든 쿼리에 빠뜨리면 타 매장 데이터 노출
- **role 문자열 연결**: employees.role = roles.name (FK 아님), 직급명 변경 시 employees도 업데이트 필요
- **category_id FK 규칙 (2가지)**:
  - `mydata_transactions.category_id` = **대분류 id 고정** (은행/카드 출금, 소분류 추론 불가, dev_lessons #33)
  - `receipts.category_id` = **소분류 id 저장** (영수증 품목 명시, 소분류 확정 가능, 2026-04-22 확립)
  - 집계 시 대분류는 자식(소분류) 합산 or 본인 id receipts 포함
- **DB 변경 시**: 이 파일 즉시 업데이트할 것 (→ dev_lessons.md #7)
