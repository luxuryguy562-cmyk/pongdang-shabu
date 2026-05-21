# 퐁당샤브 Supabase DB 스키마

> **Supabase URL**: `https://ruytgygjwnbtzmtofopg.supabase.co`
> **store_id**: `4ae03341-e5dc-4933-b746-29728cbc685f` (퐁당샤브 논산점)
> **최종 업데이트**: 2026-05-15 (식자재 트리 정상화 — 논산점 expense_categories 마이그레이션, receipts.price/count 컬럼 코드 제거)
>
> ⚠️ **2026-05-15 백업 테이블**: `expense_categories_backup_20260515` — 식자재 트리 마이그레이션 롤백용. 마이그레이션 안정 확인 후 삭제 가능.

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
| **sales_recon_mapping** (jsonb, default '{}') | 매출 대조 매핑 (2026-04-23 Part D). `{"card":[category_id,...], "cash_receipt":[], "qr":[], "etc":[]}`. category_type='income' 카테고리 id 배열 |
| **business_day_start_hour** (smallint, NOT NULL, default 6, CHECK 0~23) | 영업일 시작 시각 (2026-05-13 추가). 자정 자체가 의미 없는 야간 영업 매장 위해 영업일 경계 도입. 익일 06:00이 매장 영업일 종료/시작 = 자정 넘는 마감조도 같은 영업일에 묶임. SaaS 확장 대비. 매장별 변경 가능 (24h 매장은 04 등). |
| **vendor_order** (text, nullable) | 거래처 카드 사용자 지정 순서 JSON 배열 (2026-05-15 추가, **실제 DB는 2026-05-18 마이그레이션 add_store_settings_vendor_order_20260518로 적용** — 그 전엔 문서만 있고 DB 누락 상태였음, 거래처 순서 변경 시 "순서 저장 실패" 토스트 떴음). 옛 localStorage `pd_vendor_order_*`에서 마이그레이션. 다기기 동기화용. exp_hub_order와 같은 패턴. |
- upsert onConflict: `store_id`

> ⚠️ **2026-05-13**: 위 `business_day_start_hour` 컬럼 추가 시 `attendance_logs_backup_20260513` 백업 테이블 함께 생성됨. 다음 단계 (work_date 영업일 기준 재계산 마이그레이션) 시 롤백용.

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
| wage_type (text, default 'hourly') | 급여 종류: hourly(시급제) / monthly(월급제). 2026-05-05 추가 |
| monthly_wage (int, nullable) | **만원 단위** 월급액 (예: 280 = 280만원). 시급제면 NULL. 일별 분배 시 ×10000으로 원 단위 변환. 2026-05-05 추가 |
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
> 2026-05-21 갱신: 실제 DB 컬럼명으로 정정 (옛 start_time/end_time 표기는 오류). is_off 컬럼은 통합 PR #185 시 누락됐다가 PR #190에서 ALTER ADD.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| id | uuid PK | uuid_generate_v4() |
| store_id | uuid | 매장 |
| employee_id | uuid | 직원 |
| work_date | date NOT NULL | 근무일 |
| wish_start | time | 희망 출근 (HH:MM:SS) |
| wish_end | time | 희망 퇴근 |
| status | text default '희망' | '희망' / '확정' 등 |
| memo | text | 비고 |
| is_off | boolean default false | 휴무 여부 (2026-05-21 ADD) |
- upsert onConflict: `store_id, employee_id, work_date`

### daily_sales
| 컬럼 | 용도 |
|------|------|
| store_id, sale_date | 매장/날짜 |
| total_sales, card_sales, cash_sales (int) | 매출 |

### payment_methods (신규 2026-04-23 Part F)
매장별 결제수단 동적 관리 테이블. 사장님이 UI에서 추가/수정/삭제 가능.
| 컬럼 | 타입 | 용도 |
|------|------|------|
| id | UUID PK | |
| store_id | UUID FK→stores (CASCADE) | 매장 격리 |
| name | TEXT | 이름 ("신용카드", "카카오페이") |
| icon | TEXT | 이모지 ("💳") |
| color | TEXT | "#0050FF" |
| sort_order | INT | 표시 순서 (오름차순) |
| is_active | BOOL | 소프트 삭제 (false면 UI 미표시) |
| legacy_key | TEXT | 기존 sales_daily 컬럼과 매핑용. 'card'/'cash'/'cash_receipt'/'qr'/'etc'/'extra_large'/'extra_small' 또는 NULL(커스텀) |
| created_at | TIMESTAMPTZ | |
| **UNIQUE(store_id, name)** | | |

**기본 seed**: 7개 (신용카드/현금/현금영수증/QR/기타결제/뽑기대/뽑기소) — 모든 매장에 자동 생성
**레거시 호환**: `sales_daily.card/cash/...` 컬럼은 유지. amounts jsonb가 비어있으면 레거시 컬럼을 읽음 (SQL 미실행 안전망)

> ⚠️ **2026-04-29 변경**: 뽑기(대형)/뽑기(소형)은 `extra_revenue_items`로 이관. payment_methods의 `legacy_key='extra_large'/'extra_small'` 행은 `is_active=false`로 비활성화 (기존 sales_daily 데이터 보존).

### extra_revenue_items (신규 2026-04-29)
매장별 기타매출 항목 동적 관리. 뽑기·인형뽑기·오락기 등 매장마다 다른 부가 매출원.
**장부합계와 분리** — 기계 안 현금 등 금고와 무관한 매출이라 별도 패널로 표시.
| 컬럼 | 타입 | 용도 |
|------|------|------|
| id | UUID PK | |
| store_id | UUID FK→stores (CASCADE) | 매장 격리 |
| name | TEXT | 항목명 |
| icon | TEXT | 이모지 (기본 '🎰') |
| color | TEXT | (기본 '#7C3AED') |
| sort_order | INT | 표시 순서 |
| is_active | BOOL | 소프트 삭제 |
| legacy_key | TEXT | 'draw_large'/'draw_small'/NULL(커스텀) |
| created_at | TIMESTAMPTZ | |
| **UNIQUE(store_id, name)** | | |

**기본 seed**: 2개 (뽑기 대/소) — 모든 매장에 자동 생성
**인덱스**: `(store_id, sort_order)`

### extra_revenue_logs (신규 2026-04-29)
기타매출 항목별 매출 기록 (날짜/마감 단위). 누적 = `SUM(amount) GROUP BY item_id`.
| 컬럼 | 타입 | 용도 |
|------|------|------|
| id | UUID PK | |
| store_id | UUID FK→stores (CASCADE) | 매장 격리 |
| item_id | UUID FK→extra_revenue_items (CASCADE) | 항목 |
| log_date | DATE | 매출일 |
| amount | INT | 금액 (CHECK >= 0) |
| settlement_id | UUID FK→settlements (SET NULL) | 마감과 연결 (마감 삭제돼도 로그는 보존) |
| memo | TEXT | 비고 (백필 행은 '백필(2026-04-29)') |
| created_at | TIMESTAMPTZ | |

**인덱스**: `(store_id, log_date DESC)`, `item_id`, `settlement_id`
**백필**: 기존 `settlements.items_json.extra_draw_large/small` → 동일 settlement_id로 INSERT (이중 백필 방지: NOT EXISTS 가드)
**과거 기록 보존**: `settlements.items_json`의 `extra_draw_*` 키는 그대로 유지 (마감 카드 옛 형태 표시).

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
| **amounts** (신규 Part F) | JSONB | `{"<payment_method_id>": 금액, ...}`. 동적 결제수단용. 2026-04-23 기존 7 컬럼은 유지 (안전망). 앱은 amounts 우선 읽기, 비어있으면 legacy_key 컬럼 폴백 |
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

**⚠️ 단일 진실의 원천 (2026-04-23 Part B 통합)**:
- `sales_daily` = 매출 집계용 **유일한** 테이블
- 대시보드 매출 차트, 월 요약, 일별정산, MoM 비교 **모두 sales_daily 조회** (`dashSaleSource='settle'`)
- settlements = 원본 마감정산 로그 (입력/감사 전용). 대시보드는 직접 조회하지 않음
- daily_sales = 업솔루션 포스 자동 크롤링 (대조 용도, `dashSaleSource='ups'`)
- 과거 settlements → sales_daily 백필: `docs/sql/backfill_sales_daily_from_settlements_2026_04_23.sql` (1회 실행됨)

### receipts
| 컬럼 | 용도 |
|------|------|
| store_id | 매장 |
| receipt_date, vendor, category, item | 날짜/거래처/분류(문자열)/품목 |
| **category_id** (FK→expense_categories) | **소분류 id 저장 규칙** (2026-04-22 확립). 품목이 명시돼 있어 소분류 추론 가능. mydata는 대분류 id. 집계 시 parent 조인으로 대분류 합산 |
| **vendor_id** (FK→vendors ON DELETE SET NULL, 2026-05-18 추가) | **영수증 진입 분기** 시 거래처 모드면 박힘. 직구·옛 영수증은 NULL. 인덱스 `idx_receipts_vendor_id` |
| total_price (int) | 합계 금액 |
| note | 정상/오답/반품 등 |
| created_at | 등록일시 |

> ⚠️ **2026-05-15 정정**: 옛 문서엔 `price, count` 컬럼이 있다고 적혀있었으나 **실제 DB에는 존재하지 않음** (42703 에러로 발견). 코드에서 `price/count` SELECT/INSERT 모두 제거. 단가/수량 분리 저장이 필요해지면 추후 ALTER TABLE로 추가하고 본 문서 동기화.
>
> ⚠️ **2026-05-18 추가**: `vendor_id` FK 도입 (영수증 진입 분기 거래처/직구). 거래처 모드 = vendor_id + 거래처.category_id 자동 박힘 + 학습 스킵. 직구 모드 = vendor_id NULL + AI 품목별 분류 + 학습 작동. 마이그레이션: `add_receipts_vendor_id_20260518`. 롤백: `DROP INDEX idx_receipts_vendor_id; ALTER TABLE receipts DROP COLUMN vendor_id;`.
>
> ⚠️ **2026-05-18 추가**: `input_method` TEXT 신설 (`'photo'` | `'manual'` | NULL). 영수증 단위 입력 방식 — `handleImg` 진입 = photo, `manualReceipt` 진입 = manual. 카테고리별 목록(catReceiptCont)에서 📸/✏️ 이모지 표시용. 옛 영수증 = NULL (이모지 빈 칸 호환). 마이그레이션: `add_receipts_input_method_20260518`. 롤백: `DROP INDEX idx_receipts_input_method; ALTER TABLE receipts DROP COLUMN input_method;`.
>
> ⚠️ **2026-05-19 추가**: `receipt_group_id` UUID 신설. 영수증 사진 1장 그룹 식별자. saveReceipt 시 `crypto.randomUUID()` 1번 생성 후 모든 INSERT 행에 박음 → 기록내역 화면에서 같은 영수증 그룹 카드로 묶어 표시 + 그룹 단위 [✏ 편집]/[🗑 통째 삭제] 가능. 옛 영수증 = NULL → 1행짜리 그룹으로 호환. 인덱스 `idx_receipts_group_id`. 마이그레이션: `add_receipts_receipt_group_id_20260519`. 롤백: `DROP INDEX IF EXISTS idx_receipts_group_id; ALTER TABLE receipts DROP COLUMN IF EXISTS receipt_group_id;`.
>
> ⚠️ **2026-05-19 추가 (단가/수량 부활)**: `unit_price INT`, `qty NUMERIC(10,2)` 신설. 가격 추세 분석 기반 (사장님 호소: 거래처 주문 수동 입력과 통일 + 향후 AI 가격 상승/하락 분석). AI OCR이 거래명세서 단가·수량·합계 컬럼 정확히 추출, 사용자 수정 가능. 인덱스 `idx_receipts_item_date (item, receipt_date DESC) WHERE item NOT NULL`. 옛 영수증 = NULL 호환. 마이그레이션: `receipts_unit_price_qty_and_display_item_20260519`. 롤백: `DROP INDEX IF EXISTS idx_receipts_item_date; ALTER TABLE receipts DROP COLUMN IF EXISTS unit_price, DROP COLUMN IF EXISTS qty;`. 옛 컬럼명 `price/count`와 달리 명확하게 `unit_price/qty`로 명명.
>
> ⚠️ **2026-05-18 (6) 변경**: 사장님 매장(`4ae03341-...`) `expense_categories` 카테고리 분리 적용:
> - `'공과금/고정비'` parent → `'고정비'` rename (id=c33020f4-...)
> - `'공과금'` parent 신규 (sort_order=6, data_source='fixed_costs', id=7d0b97ff-...)
> - fixed_costs.category 텍스트 매칭 = 자동 작동 (공과금/고정비 각자)
> - 다른 매장은 기본 시드 '공과금/고정비' 통합 그대로 (사장님 매장만 적용)
> - 향후 신규 매장 시드 변경 = 별도 결정 (todo_next_session)

### settlements
| 컬럼 | 용도 |
|------|------|
| store_id, settle_date | 매장/정산일 (unique) |
| items_json, vault_json (jsonb) | 정산항목/금고 상세 |
| actual_total, expected_total, diff_amount (int) | 실제/예상/차이 |
| diff_status | 과부족 상태 |
| sales_total (int) | 매출 합계 |
- upsert onConflict: `store_id, settle_date`
- `items_json` 구조 (2026-05-12 업데이트 / 2026-05-17 차감 카테고리 FK 추가):
  - `opening` — 전일 이월금
  - `pos_cash / pos_cash_receipt / pos_card / pos_etc` — 매출 4칸
  - `cash_detail_cash / cash_detail_qr / cash_detail_transfer` — 현금 분해(검증용)
  - **`deductions: [{type, amount, memo, category_id, category_name}, ...]`** — 차감 동적 행
    - 2026-05-17: `category_id` (FK→expense_categories) + `category_name` (표시용) 추가
    - 옛 데이터(category_id 없음)는 자동 집계 무시 (옛 동작 보존)
    - 사장님이 차감 행에 카테고리 분류하면 가마감 카테고리 합계에 자동 합산 (현금지출 추적)
  - `deduct_etc / deduct_bank` — 위 deductions 의 type별 합산값 (옛 코드 호환)
  - `extra_draw_large / extra_draw_small` — 기타매출 호환 (현재는 extra_revenue_logs 로 분리)

### daily_opening (2026-05-12 신규, 2026-05-13 차감 컬럼 제거)
영업개시 보고 (아침 출근 시 금고 계수). **차감은 마감(settlements)에서만 입력.**

| 컬럼 | 용도 |
|---|---|
| id (BIGSERIAL PK) | |
| store_id (UUID FK→stores) | 매장 |
| opening_date (DATE) | 영업개시 날짜 |
| vault_json (JSONB) | 화폐별 장수 {50000:N, 10000:N, ...} |
| actual_total (INT) | 오늘 출근 시 실제 금고 합계 |
| previous_close_total (INT) | 어제 마감 금고 (스냅샷) |
| diff_amount (INT, GENERATED) | `actual_total - previous_close_total` (단순 차이) |
| memo (TEXT) | (사용 중단 2026-05-13 후반) 옛 차액 메모. UI·코드 참조 없음, 컬럼 보존만 |
| created_at, created_by | |

- UNIQUE: `(store_id, opening_date)` → upsert 가능
- RLS: `USING(true) WITH CHECK (store_id IS NOT NULL)`

**핵심 수식**:
```
영업개시 차액 = actual_total − previous_close_total
0 = 정상 / ≠0 = 진짜 사라진 돈 (도난·실수 의심)
```

> ⚠️ 옛 `deductions (JSONB)` 컬럼은 DB·코드에서 모두 제거됨 (2026-05-13). 차감은 `settlements.items_json.deduct_etc/deduct_bank`에서만 관리.

### vendors / vendor_orders
| vendors | vendor_orders |
|---------|---------------|
| id, store_id, name, **category** (text), **category_id** (FK→expense_categories ON DELETE SET NULL), is_active | store_id, vendor_id(FK), order_date |
| | item, **unit_price** (int, nullable), **quantity** (numeric, nullable), amount, memo, source, **order_group_id** (uuid, nullable) |

> ⚠️ **2026-05-15 추가** (vendor_orders): `unit_price`, `quantity` 컬럼. UI에서 단가×수량 자동 곱셈해서 amount 채우되, 사장님이 amount 직접 수정 가능 (할인/운송비 포함 등).
>
> ⚠️ **2026-05-15 추가** (vendors): `category_id` FK 도입 (PR #119). 거래처 편집창 대분류+소분류 2단 select. category_id = 자식 우선, 없으면 부모. `category` 텍스트는 UI 표시·calcExpense 호환용으로 유지 (saveVendor에서 동기화).
>
> ⚠️ **2026-05-20 추가** (vendor_orders): `order_group_id UUID` (nullable). 한 영수증/주문건의 멀티 행 묶음 ID. **receipts.receipt_group_id 패턴 동일**. 수동 입력 시트가 멀티행 accordion으로 갈아엎어지면서 1회 [✓ 저장] = 같은 group_id로 N행 INSERT. 옛 데이터·단일 입력 = NULL → (vendor_id+order_date) fallback 그룹핑(loadVendorOrders). 마이그레이션: `add_vendor_orders_order_group_id_20260520`. 인덱스 `idx_vendor_orders_group_id`. 롤백: `DROP INDEX IF EXISTS idx_vendor_orders_group_id; ALTER TABLE vendor_orders DROP COLUMN IF EXISTS order_group_id;`.
>
> **calcExpense 매칭 (2026-05-15 PR #120 갈아엎기)**:
> - `vendor_orders` source 카테고리: `o.vendors?.category_id === cat.id` (FK 직접)
> - `composite` 카테고리(식자재): `[cat.id, ...children.ids]` 매칭 (대분류면 자식 ids 포함)
> - 옛 거래처 (`category_id=NULL`) 는 매칭 X → 사장님 재분류 필요

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

**data_source 값 정의 (2026-04-22 확장 / 2026-05-17 인건비 자식 추가)**:
- `vendor_orders` — 거래처 주문(vendor_orders)만 집계. `vendor_category` 필터 적용
- `receipts` — 영수증만 집계. 소분류 id 또는 대분류 id인 receipts 포함
- `composite` — 거래처+영수증 **합산** (식자재 대분류 및 육류/야채/공산품 소분류용).
  - 대분류 composite: 자식 소분류들의 vendor_category 총합 + 자식 id로 된 receipts + 본인 id receipts
  - 소분류 composite: 본인 vendor_category + 본인 id receipts
  - ⚠️ 대분류만 집계 루프 참여, 소분류는 `details`로 하위 표시됨 (중복 방지)
- `attendance` — attendance_logs.calculated_wage 합 + 월급제 monthly_wage 분배 (부모 인건비)
- `attendance_hourly` — **시급제 직원만** attendance_logs.calculated_wage 합 (인건비 자식, 2026-05-17 추가)
- `attendance_monthly` — **월급제 직원만** monthly_wage × 10000 ÷ 월일수 분배 (인건비 자식, 2026-05-17 추가)
- `fixed_costs` — fixed_cost_amounts (고정비)
- `manual` — expense_category_amounts 수동 입력

**인건비 자식 패턴 (2026-05-17)**:
- 부모 `attendance` = 시급제 + 월급제 합 (= 자식 합과 동일)
- 자식 `attendance_hourly` / `attendance_monthly`는 `parent_id`로 부모 연결
- ⚠️ 자식은 집계 루프에서 스킵 (composite 자식과 동일 패턴, 중복 방지)
- 자식은 월 요약 카드 "+ 상세보기" 펼침에서만 표시 (식자재 패턴 일치)

### fixed_costs / fixed_cost_amounts
| fixed_costs | fixed_cost_amounts |
|------------|-------------------|
| id, store_id, name, **category** | fixed_cost_id(FK) |
| sort_order, is_active, is_variable | year_month, amount, estimated_amount, is_confirmed |
| **estimated_monthly** (int, default 0) — 항목별 예상 월 금액. 모든 달 가마감 자동 집계 (2026-05-06 신설) | |
| expected_day, tolerance_days | |
- upsert onConflict: `fixed_cost_id, year_month`
- **`category` 컬럼 값 (2026-05-14 정리)**:
  - `'고정비'` (default) — 월세·인터넷·보험 등 변동 없는 자동이체
  - `'공과금'` — 전기·가스·수도·관리비 등 매달 변동 자동이체 (2026-05-14 신규 옵션)
  - `'마케팅'` — 광고비·행사비 (variable)
  - `'세금'` — 자동이체로 빠지는 세금
  - ⚠️ `'로열티'` 옵션 제거 (`매출 × store_settings.royalty_rate` 자동 계산과 중복) — 기존 데이터 있으면 사장님이 다른 카테고리로 이동 필요
- 차트 그룹·hub 카드는 이 `category` 값으로 분기:
  - 고정비 hub 카드 = `category in ('고정비','공과금')` 합산 (사장님 결정: hub는 통합)
  - 차트(`dashboard`) = 카테고리별 분리 표시

**⚠️ 2026-05-06 변경 (`estimated_monthly` 도입)**:
- 가마감 고정비 집계는 이제 `fixed_costs.estimated_monthly` 합산 (활성 항목만)
- `fixed_cost_amounts` 테이블/UI는 **사용 중단** (월별 입력 화면 제거됨)
- 기존 `fixed_cost_amounts` 데이터는 보존 (역사용, 안 씀)
- 진마감 = `mydata_transactions` 출금 그대로 (변경 없음)
- 코드 변경: `loadDashboard`, `calcReserveBalance`, `calcExpenseByCategories`, `monthSummary` 모두 `fixed_costs.estimated_monthly` 직접 합산

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
| **display_item** (text, NULL) | 사장님이 정정한 품목 표시명 (2026-05-19 추가). 영수증 OCR 원본 "위즈복대 -魚子福袋..." → 사장님 "날치알" 정정 시 학습 → 다음 OCR에서 자동 교체 |
| created_at (timestamptz) | 생성일 |
- UNIQUE(store_id, keyword, tx_type)
- 용도: 매장별 엑셀 업로드 자동 분류 규칙. 수동 분류 시 자동 학습(INSERT)
- `display_item`: applyRulesToReceipt에서 매칭 시 `item = display_item` 자동 교체. saveReceipt/saveReceiptGroupEdit에서 사장님이 item 정정 시 박힘 (`_origItem !== item`)

### store_settings 추가 컬럼
| 컬럼 | 용도 |
|------|------|
| reserve_rate (numeric, default 0.05) | 예비비 비율 (%) |
| reserve_fixed (int, default 400000) | 예비비 고정액 |
| reserve_initial_balance (int, default 0) | 예비비 초기 이월 잔고 |

### ai_usage_logs (신규 2026-05-19)
| 컬럼 | 용도 |
|------|------|
| id (UUID, default gen_random_uuid()) | PK |
| store_id (FK→stores ON DELETE CASCADE) | 매장 |
| feature (TEXT) | `receipt_ocr` / `pos_ocr` / 기타 |
| model (TEXT) | 모델명 (예: `gemini-2.5-flash`) |
| prompt_tokens (INT) | 입력 토큰 |
| output_tokens (INT) | 출력 토큰 |
| thinking_tokens (INT) | thinking 토큰 (2.5+ 모델, OFF면 0) |
| total_tokens (INT) | 전체 |
| estimated_cost_won (NUMERIC 10,4) | 추정 원 — gemini-2.5-flash 기준 input 420원/1M, output+thinking 3500원/1M |
| duration_ms (INT) | 응답 시간 |
| success (BOOLEAN) | 성공 여부 |
| error_msg (TEXT) | 실패 메시지 |
| called_at (TIMESTAMPTZ default now()) | 호출 시각 |

- 인덱스: `idx_ai_usage_store_date (store_id, called_at DESC)`, `idx_ai_usage_feature_date (feature, called_at DESC)`
- 용도: AI API 호출 토큰·비용 추적 + 향후 관리자 대시보드 데이터 소스
- 마이그레이션: `create_ai_usage_logs_20260519`
- 롤백: `DROP INDEX idx_ai_usage_*; DROP TABLE ai_usage_logs;`

## 주의사항
- **RLS 1차 활성 (2026-04-17 Phase 2b)**: 매장별 22개 테이블 RLS ON + `pd_phase2b_all` 정책
  - 정책: `USING(true) WITH CHECK(store_id IS NOT NULL) FOR ALL TO public`
  - 의미: 읽기 전부 허용 + 쓰기 시 store_id 필수. **느슨함 — 코드 레이어 필터와 2중 방어**
  - 향후 Phase 2c에서 Cloudflare Worker + JWT auth 도입 후 엄격화 예정
  - SQL 파일: `docs/sql/phase2b_rls_enable.sql` / `phase2b_rls_rollback.sql`
- **RLS 누락 보강 (2026-05-17, MCP `apply_migration`)**: Phase 2b 이후 추가된 운영 4개 + 잔재 3개 + 백업 9개 = 16개에 RLS ENABLE.
  - 운영 4개(`sales_daily`, `payment_methods`, `extra_revenue_items`, `extra_revenue_logs`)는 `pd_phase2b_all` 동일 정책 적용 → 앱 영향 0
  - 잔재 3개(`exp_groups`, `exp_items`, `exp_item_amounts`) + 백업 9개는 RLS ON, 정책 없음 = 완전 봉인 (service_role만 접근)
  - 마이그레이션 이름: `enable_rls_on_missing_tables_20260517`
  - ⚠️ **새 운영 테이블 만들 때마다 RLS + pd_phase2b_all 정책 함께 적용 의무** (안 하면 anon key 노출)
- **RLS 비활성 테이블**: stores, franchises (부모 테이블, store_id 없음 — 의도적 OFF 유지)
- **store_id 필수**: 모든 쿼리에 빠뜨리면 타 매장 데이터 노출
- **role 문자열 연결**: employees.role = roles.name (FK 아님), 직급명 변경 시 employees도 업데이트 필요
- **category_id FK 규칙 (2가지)**:
  - `mydata_transactions.category_id` = **대분류 id 고정** (은행/카드 출금, 소분류 추론 불가, dev_lessons #33)
  - `receipts.category_id` = **소분류 id 저장** (영수증 품목 명시, 소분류 확정 가능, 2026-04-22 확립)
  - 집계 시 대분류는 자식(소분류) 합산 or 본인 id receipts 포함
- **DB 변경 시**: 이 파일 즉시 업데이트할 것 (→ dev_lessons.md #7)
