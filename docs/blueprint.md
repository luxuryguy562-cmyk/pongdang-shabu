# 청사진 — Blueprint (화면별 기능 설계도)

> Tier 3. `docs/vision.md` 1순위 가치 (정산 손 까딱 X) + `docs/db_schema.md` FK 매핑.
> **각 화면이 무엇을 보여주고 / 왜 / 어디서 왔고 / 어디로 가는지** — agent들이 매번 grep 안 해도 되도록 정리.
> 작성: 2026-05-24 (index.html 7,500줄 + db_schema 23개 테이블 통합)

---

## 📐 전체 화면 지도

```
🏠 홈화면 (역할별 라우팅)
  ├─ 관리자 → 📊 대시보드 (v17 월/주 카드 v6)
  └─ 직원 → ⏰ 근태 (출퇴근)

5개 메인 탭 (네비 하단)
  ├─ 🧾 영수증
  ├─ ⏰ 근태
  ├─ 📅 근무계획
  ├─ 💰 마감정산
  └─ 📊 대시보드

🏪 사이드메뉴 (햄버거)
  ├─ 💸 지출 관리
  │   ├─ 거래처 관리 (vendors + vendor_orders)
  │   ├─ 고정비 관리 (fixed_costs)
  │   ├─ 지출 카테고리 (expense_categories)
  │   └─ 급여 집계 (attendance_logs)
  ├─ 💰 매출 관리 (sales_daily + payment_methods + extra_revenue_*)
  ├─ 🔍 정산/검수 (reconciliation + vendor_diffs)
  ├─ 📥 엑셀 업로드 (mydata_transactions + classification_rules)
  ├─ 🏦 예비비 (reserve_fund_logs)
  ├─ 👥 직원관리 (employees + roles)
  ├─ 🏯 본사 연결 (franchises)
  └─ ⚙️ 설정 (store_settings)

🔒 관리자 대시보드 (#admin, 김은성 전용 — PIN 게이트)
  ├─ AI 비용 (ai_usage_logs)
  ├─ DB 사용량
  ├─ 학습 규칙 (classification_rules)
  └─ 에러 로그
```

---

## 🎯 vision 5-1 라벨링 (모든 화면 자동 적용)

| 화면 | 🟢/🟡/🔴 | 이유 |
|---|---|---|
| 홈/대시보드 | 🟢 | 순익 한 화면 (vision 무기 1순위) |
| 영수증 | 🟢 | 지출 자동화 (vision 무기 2순위) |
| 마감정산 | 🟢 | 정산 자동화 (vision 1조) |
| 근태/근무계획/급여 | 🟢 | 인건비 = 지출 1대 카테고리 |
| 거래처 관리 | 🟢 | 거래처 명세 자동화 (사장님 1순위 답) |
| 매출 관리 | 🟢 | 매출 = 순익의 절반 |
| 정산/검수 | 🟢 | 가마감 ↔ 진마감 대조 (정산 정확성) |
| 엑셀 업로드 | 🟢 | 자동 분류 = vision 1조 직속 |
| 예비비 | 🟢 | 순익 정확화 |
| 직원관리 | 🟡 | 식당 도메인 정통이지만 정산 외 부분 |
| 본사 연결 | 🟡 | 다점포·프차 (Phase 2 B2B 전용) |
| 관리자 대시보드 | 🟢 | vision 6-3 운영 효율성 |

---

# 📊 화면 1. 대시보드 (홈 + 메인 탭)

## 보여주는 것 (사장님 시각)
> **"이번 달 얼마 벌었고 / 얼마 썼고 / 얼마 남았나"**

| 카드 | 무엇 |
|---|---|
| **v17 월 카드 v6** | 매출/예상마감매출 + 순수익/예상마감순수익 + 지출 + 간트(분포/매출대비) + 상위 카테고리 3 + 상세보기 ▾ + 전월대비 |
| **주별 카드** | 월 카드와 동일 구조, 주 단위 |
| **달력 시트** | 일별 매출·지출 캘린더 (휴무 표시) |
| **예비비 잔고** | 매장 비상금 |

## 왜 (vision 일치)
- **vision 무기 1순위** = "순익 한 화면" 직격
- **헌장 1조** = 사장님이 한눈에 보고 끝

## 데이터 어디서
| 표시 항목 | 소스 테이블 (FK) |
|---|---|
| 매출 (월/주) | `sales_daily` (UNIQUE store_id+date) — `dashSaleSource='settle'` |
| 매출 (POS 자동) | `daily_sales` — `dashSaleSource='ups'` |
| 지출 거래처 | `vendor_orders` → vendors → expense_categories (composite) |
| 지출 영수증 | `receipts` → expense_categories (소분류 id) |
| 지출 인건비 | `attendance_logs.calculated_wage` + `employees.monthly_wage` |
| 지출 고정비 | `fixed_costs.estimated_monthly` (활성만, fixed_cost_amounts 사용 중단) |
| 지출 매출연동 | 매출 × `store_settings.royalty_rate` (로열티) + 카드매출 × `card_fee_rate` |
| 예비비 잔고 | `reserve_fund_logs` 합 (deposit - withdrawal) + `reserve_initial_balance` |
| 카테고리 임계 % | `store_settings.expense_thresholds` jsonb (매장별) |

## 어디로 (사용자 흐름)
- 카테고리 카드 탭 → 해당 카테고리 상세 (vendor_orders / receipts 등)
- 캘린더 셀 탭 → 일별 정산 시트
- "상세보기 ▾" → 자식 카테고리 (parent_id) 펼침
- 예비비 → 사이드메뉴 예비비 화면

## 핵심 함수 (헌법 제6조)
- `loadDashboard()` — 메인 진입점
- `v17RenderMonthCard()` / `v17RenderWeekCards()` — v6 카드 양식
- `calcReserveBalance()` — 예비비 (소스: sales_daily)
- `calcExpenseByCategories()` — 카테고리 합산
- `monthSummary()` — 월 요약

## 위험 자리 (FK 깨지면 끝)
- `expense_categories.parent_id` 자식 카테고리 끊김 → "+ 상세보기" 빈 칸
- `vendors.category_id` NULL → calcExpense 매칭 X (옛 거래처 재분류 필요)
- `receipts.category_id` NULL → 카테고리 합계 0

---

# 🧾 화면 2. 영수증 탭

## 보여주는 것
> **사진 1장 찍으면 → AI가 거래처·품목·금액·분류 자동 인식 → DB 자동 저장**

| 서브탭 | 무엇 |
|---|---|
| 📸 새 영수증 | 사진 입력 분기 (거래처 / 직구) + 수동 입력 |
| 📋 기록 내역 | 월별 그룹 카드 + 카드 탭 = 편집 |

## 왜 (vision 일치)
- **vision 무기 2순위** = "지출 자동화 압도" 직격
- **사장님 1순위 답** = "거래처 거래명세 자동화" (Phase 1 핵심)

## 데이터 어디서·어디로
| 입력 모드 | DB 저장 |
|---|---|
| 📸 사진 → AI OCR | Gemini/GPT/Clova → `receipts` 행 |
| 거래처 모드 | `receipts.vendor_id` FK + 거래처 `category_id` 자동 박힘 |
| 직구 모드 | `receipts.vendor_id = NULL` + AI 품목별 분류 + 학습 (classification_rules) |
| 수동 입력 | `receipts.input_method='manual'` |
| 영수증 그룹 | `receipts.receipt_group_id` UUID (1 사진 = 1 그룹) |
| 단가·수량 | `receipts.unit_price`, `qty` (가격 추세 분석용) |
| 학습 정정 | `classification_rules.display_item` (사장님 정정 → 다음 OCR 자동 교체) |

## 어디로 (다른 화면 연결)
- 대시보드 지출 카테고리 합계 (composite/receipts data_source)
- 거래처 관리 → 단가 추세 (`unit_price × receipt_date`)
- 정산/검수 → mydata 카드 출금과 대조

## 핵심 함수
- `handleImg()` — 사진 입력
- `manualReceipt()` — 수동
- `saveReceipt()` — INSERT + 학습 갱신
- `applyRulesToReceipt()` — classification_rules 자동 적용
- `normalizeItemKeyword()` — 학습 키워드 정규화

## 위험 자리
- `receipts.category_id`가 소분류 id 저장 규칙 깨짐 → 집계 X
- `unit_price/qty` 옛 컬럼(`price/count`) 잔재 → 이미 제거됨 (2026-05-15)
- 1장 영수증에 식자재+비품 섞임 → `category_type='receipt_ref'` 처리

---

# ⏰ 화면 3. 근태 탭

## 보여주는 것
> **사장님 손 안 가게 직원이 직접 출퇴근 / 사장님은 캘린더+간트로 일별 확인**

| 서브탭 | 무엇 |
|---|---|
| ⏱️ 출퇴근 | 본인 출근/근무중/퇴근 상태 변환 카드 (.before/.during/.after) |
| 📋 근무 기록 | 월 캘린더 + 일별 간트 + KPI 3분할 (출근일/근무시간/인건비) |

## 왜 (vision 일치)
- 인건비 = 외식업 매출 25~35% (지출 1대 카테고리)
- 사장님 자동 인사이트 (vision 7-4) — "이번 달 인건비 35%, 평균 +5%"

## 데이터 어디서·어디로
| 항목 | DB |
|---|---|
| 출근/퇴근 | `attendance_logs.app_in/app_out` |
| CAPS 지문 | `attendance_logs.caps_in/caps_out` + `caps_upload_staging` |
| 휴게/총 시간 | `attendance_logs.rest_min`, `total_work_min` |
| 급여 계산 | `attendance_logs.calculated_wage` (시급 × 시간) |
| 시급/월급 | `employees.base_wage` (시급) / `monthly_wage` (월급, 만원 단위) |
| 기기 인증 | `employees.device_fingerprint` (localStorage UUID) |
| 영업일 경계 | `store_settings.business_day_start_hour` (자정 넘는 마감조 동일 영업일) |

## 어디로
- 대시보드 인건비 카테고리 (data_source=`attendance`)
- 자식 카테고리: `attendance_hourly` (시급제) + `attendance_monthly` (월급제)
- 정산/검수 → mydata 인건비 출금과 대조 (귀속월)
- 노무 제출 엑셀 다운로드 (§41/§42/§48)

## 핵심 함수
- `checkIn()` / `checkOut()` — 출퇴근
- `calcWageData()` — 급여 계산
- `getDeviceFingerprint()` — 기기 인증
- `downloadLaborExport()` — 노무 엑셀

## 위험 자리
- `employees.role` (문자열) ↔ `roles.name` 매칭 끊김 = 직급 표시 깨짐
- `monthly_wage` 만원 단위 ↔ 원 단위 혼동 (×10000 변환 필수)
- 자정 넘는 마감조 영업일 경계 (business_day_start_hour)

---

# 📅 화면 4. 근무계획 탭

## 보여주는 것
> **주간 간트차트 + 직원 희망 출퇴근 + 사장님 확정**

(2026-05-21 근태 `📋 기록`으로 통합. 단독 탭 X)

## 데이터
| 항목 | DB |
|---|---|
| 희망 시간 | `work_schedules.wish_start`, `wish_end` (time) |
| 휴무 | `work_schedules.is_off` boolean |
| 상태 | `work_schedules.status` ('희망'/'확정') |

## 어디로
- 근태 캘린더 (계획 vs 실제 바)
- 인건비 예측 (다음 달 가마감)

---

# 💰 화면 5. 마감정산 탭

## 보여주는 것
> **하루 끝 = 매출(POS) 입력 + 금고 계수 + 차이 확인**

| 입력 항목 | DB |
|---|---|
| 전일 이월금 | `settlements.items_json.opening` |
| 매출 4칸 (POS) | `pos_cash` / `pos_cash_receipt` / `pos_card` / `pos_etc` |
| 현금 분해 | `cash_detail_cash` / `cash_detail_qr` / `cash_detail_transfer` |
| 차감 (인출·송금) | `deductions: [{type, amount, memo, category_id, category_name}, ...]` |
| 금고 계수 | `vault_json` (5만원·1만원·5천·1천 장수) |
| 기타매출 | `extra_revenue_logs` (뽑기 등, settlement_id 연결) |

## 왜 (vision 일치)
- **vision 1조 직격** = 매일 정산 자동화 (월 20시간 → 30분)
- 매출/지출/순익 = 이 화면 입력이 대시보드 데이터 시작점

## 어디로 (자동 동기화)
- `syncClosingToSalesDaily()` — settlements 저장 시 sales_daily 자동 upsert
  - `items.pos_card → card`
  - `items.cash_detail_cash → cash`
  - `items.pos_cash_receipt → cash_receipt`
  - `items.cash_detail_qr → qr`
  - `items.pos_etc + items.cash_detail_transfer → etc`
  - `items.extra_draw_large/small → extra_large/small`
- `extra_revenue_logs` 백필 (옛 settlements.items_json → 분리 테이블)

## 핵심 함수
- `finishSettlement2()` — 저장 진입점
- `syncClosingToSalesDaily()` — 매출 동기화
- `refreshSettleEmptyHighlight()` — 공란 가드 (빨간 강조)
- `validateSettleInputs()` — 필수 8칸 검증
- `fillEmptyWithZero()` — "⚡ 공란 0으로 채우기"

## 위험 자리
- 매출 단일 진실의 원천 = `sales_daily` (settlements 직접 조회 X)
- 차감 `category_id` 없으면 가마감 카테고리 합계 누락
- 같은 매장+날짜 중복 저장 → confirm 가드

---

# 🏪 화면 6. 사이드메뉴 — 지출 관리

## 6-1. 거래처 관리 (vendors + vendor_orders)
- **보여주는 것**: 거래처 카드 + 매입 명세 + 단가 추세 + 대조
- **사장님 1순위 답** = 이 화면이 거래처 명세 자동화의 본진
- **DB**: `vendors` (category_id FK 자식 우선), `vendor_orders` (order_group_id 그룹)
- **자동화**: 영수증 → vendor 자동 박힘 / 단가×수량 자동 곱셈
- **대조 서브탭**: 거래처 장표 ↔ mydata 출금 일별 + 품목별 단가 변화율

## 6-2. 고정비 관리 (fixed_costs)
- **보여주는 것**: 항목별 카드 (월세·인터넷·보험 등)
- **DB**: `fixed_costs.estimated_monthly` (모든 달 가마감 자동)
- **카테고리**: 고정비 / 공과금 / 마케팅 / 세금
- **공과금 미납 알림** (⏳ 부분 구현): expected_day + tolerance_days → mydata 출금 검색

## 6-3. 지출 카테고리 (expense_categories)
- **보여주는 것**: 대분류·소분류 트리 + 드래그 정렬 (SortableJS) + 임계% 설정
- **DB**: 5 타입 (expense / income / exclude / receipt_ref / reserve)
- **data_source**: 8종 (vendor_orders / receipts / composite / attendance / attendance_hourly / attendance_monthly / fixed_costs / manual)
- **위험**: parent_id 깨지면 자식 카테고리 펼침 X

## 6-4. 급여 집계
- **보여주는 것**: 월별 직원 시급/월급/총 인건비
- **DB**: `attendance_logs` + `employees.monthly_wage` 분배
- **노무 엑셀 3종**: 출퇴근부(§42) / 임금대장(§48) / 근로자명부(§41)

---

# 💵 화면 7. 사이드메뉴 — 매출 관리

## 보여주는 것
> **일별 매출 카드 (세로 스크롤, 모바일 짤림 없음)** + 월 합계 sticky

## DB
- `sales_daily` (단일 진실의 원천) — UNIQUE(store_id, date)
- `payment_methods` (동적 결제수단 CRUD) — 기본 seed 7개
- `extra_revenue_items` + `extra_revenue_logs` (뽑기 등 기타매출)

## 결제수단 동적 관리
- 사장님이 UI에서 추가/수정/삭제 (예: 카카오페이 추가)
- `sales_daily.amounts` jsonb → 동적 결제수단 합산
- `legacy_key` = 옛 컬럼 호환 (안전망)

## 왜
- **vision 무기 1순위** = 순익의 절반 (매출 정확화)
- Phase 3 양면 시장 leads 데이터 = 익명화 통계

---

# 🔍 화면 8. 사이드메뉴 — 정산/검수

## 보여주는 것
> **가마감 (장부) vs 진마감 (실제 출금) 자동 대조**

## 대조 9개 항목
| # | 기록 (가마감) | 실제 (진마감) |
|---|---|---|
| 1 | vendor_orders 거래처별 소계 | mydata 출금 |
| 2 | attendance_logs.calculated_wage | mydata (귀속월) |
| 3 | special_wages 추가 수당 | mydata |
| 4 | fixed_costs estimated_monthly | mydata |
| 5 | receipts 소모품/비품 | mydata |
| 6 | 매출 × royalty_rate (로열티) | mydata |
| 7 | 카드매출 × card_fee_rate (수수료) | mydata |
| 8 | expense_category_amounts 수동 | mydata |
| 9 | (미분류) | mydata 미매칭 |

## DB
- `reconciliation` (UNIQUE store_id+year_month+sub_key)
- `vendor_diffs` (거래처 차액 추적, 다음 달 상계)
- `mydata_transactions` (출금 원본)
- `mydata_accounts` (계좌·카드)

## 핵심 규칙
- `mydata_transactions.category_id` = **대분류 id 고정** (dev_lessons #33)
- `receipts.category_id` = **소분류 id 저장** (2026-04-22 확립)
- `attribution_month` = 귀속월 (인건비 익월 지급 → 3월 근무 = 4월 출금이지만 3월 비용)

---

# 📥 화면 9. 사이드메뉴 — 엑셀 업로드

## 보여주는 것
> **계좌·카드 엑셀 → AI 분류 → mydata_transactions 저장**

## 흐름
```
파일 선택 (xlsx, xls, csv)
  ↓
parseExcelFile (SheetJS)
  ↓
matchColumns (헤더 키워드 자동)
  ↓
classifyByKeyword (적요/내용 → category)
  ↓
classification_rules 적용 (매장별 학습)
  ↓
renderExcelPreview (사장님 검증)
  ↓
saveExcelBatch → mydata_transactions
```

## DB
- `mydata_transactions` (tx_hash UNIQUE 중복 방지)
- `classification_rules` (매장별 키워드 → 카테고리 매핑, 학습됨)

## 호환
- **은행 13개사** (신한/KB/NH/우리/하나/카카오/토스/IBK/SC/새마을/수협/신협/대구)
- **카드 8개사** (신한/삼성/현대/KB/롯데/하나/BC/NH)

---

# 🏦 화면 10. 사이드메뉴 — 예비비

## DB
- `reserve_fund_logs` (deposit/withdrawal)
- `store_settings.reserve_rate` / `reserve_fixed` / `reserve_initial_balance`

## 자동 연결 (#55)
- mydata 거래 category='예비비 사용' 선택 → `reserve_fund_logs` 자동 INSERT
- `source_tx_id` FK (거래 삭제 시 SET NULL, 로그는 보존)

## 수식
- 잔고 = `reserve_initial_balance` + Σ(deposit) - Σ(withdrawal)
- 자동 적립 = (매출-vendor-receipt-att-fixed일할-royalty-cardFee) × reserve_rate (수정 2026-04-24 #62)

---

# 👥 화면 11. 사이드메뉴 — 직원관리

## DB
- `employees` (개인정보·시급·PIN·CAPS·서류 등)
- `roles` (직급, FK 아닌 문자열 매칭)

## 권한 (auth_level 4단계)
- owner — 어플 주인 (관리자 대시보드)
- franchise_admin — 본사 관리자
- store_manager — 매장 관리자
- staff — 직원

## 서류 (Phase 2 노무 통합 준비)
- `doc_contract` — 근로계약서
- `doc_health_cert` + `doc_health_expires` — 보건증
- `doc_minor_consent` — 법정대리인 동의서
- `doc_foreigner_id` — 외국인등록증
- `visa_type` + `visa_expires_at` — 비자

---

# 🏯 화면 12. 사이드메뉴 — 본사 연결 (프차)

## DB
- `franchises` (신규 — 브랜드별 그룹)
- `stores.franchise_id` FK
- 가맹점주 가입 시 초대 코드(`F-XXXXXX`) 입력 → 자동 연결

## 본사 홈 (franchise_admin 자동 라우팅)
- 브랜드명·초대코드 + 전체 매출 + 가맹점 순위 + 매장 전환

## Phase 2 B2B 영업의 진입점
- 사장님 한 마디 → 초대 코드 → 매장 일괄 가입

---

# ⚙️ 화면 13. 사이드메뉴 — 설정 (store_settings)

## DB (`store_settings` 1:1 stores)
| 컬럼 | 용도 |
|---|---|
| `ups_store_code`, `ups_id`, `ups_pw` | 업솔루션 POS 로그인 |
| `expense_thresholds` jsonb | 카테고리별 매출 대비 경고 % |
| `sales_recon_mapping` jsonb | 매출 대조 매핑 |
| `business_day_start_hour` | 영업일 시작 시각 (default 6) |
| `vendor_order` text | 거래처 카드 순서 |
| `reserve_rate` / `reserve_fixed` / `reserve_initial_balance` | 예비비 |
| `royalty_rate` / `card_fee_rate` | 로열티·카드수수료 % |

---

# 🔒 화면 14. 관리자 대시보드 (#admin)

## 김은성 (어플 주인) 전용
- PIN 게이트 (SHA-256 hash, 3회 실패 60초 잠금)
- 풀스크린 오버레이, `location.hash === '#admin'` 진입

## DB
- `ai_usage_logs` — AI API 비용·토큰 추적
- `classification_rules` — 학습 규칙 CRUD

## 카드
- 메인 (이번 달 사용액 30px)
- AI 모델별 분포 + 실패율 + 평균 응답
- 누적 + 시뮬 슬라이더
- Chart.js 시간별/일별 추이
- CSV 다운로드 (BOM + 매장명 매핑)
- Supabase DB 사용량 (주요 6 테이블 행수+추정MB+500MB 대비 %)
- 에러 로그 (최근 5건)

## 시점 네비
- 일별 / 월별 토글 + 데이트피커 + ◀▶ + "오늘로"
- 매장 그룹핑 (🏯 프차 / 🏢 다매장 / 🏪 개인)

## 왜 (vision 6-3 직격)
- 운영 효율성 = 최소 직원
- 직원 부르기 전 4단계 중 4번 (운영 대시보드)
- AI 비용·DB 비용·에러·QnA·매출·구독자 — 6개 신호등 (vision 6-3 목표)

---

# 🚨 가장 위험한 FK 5개 (사장님이 짚으신 "또 깨짐" 자리)

| 우선 | FK | 깨지면 |
|---|---|---|
| 🥇 | `expense_categories.parent_id` | 대시보드 "+ 상세보기" 빈 칸 / 자식 카테고리 펼침 X |
| 🥇 | `vendors.category_id` | 거래처 매입이 카테고리 합계 미반영 |
| 🥈 | `receipts.category_id` | 영수증 → 카테고리 합산 0 / "소분류 id 규칙" 위반 |
| 🥈 | `mydata_transactions.category_id` | 진마감 카테고리 합산 X / "대분류 id 규칙" 위반 |
| 🥉 | `extra_revenue_logs.settlement_id` SET NULL | 마감 삭제 시 기타매출 보존 보장 |

→ 매 작업 시 자문: "이 작업이 위 5개 FK에 영향 주는가?"

---

# 📊 vision 7-4 자동 인사이트 (어디서 데이터 옴)

| 인사이트 예시 | 데이터 소스 |
|---|---|
| "인건비 35%, 업계 평균 +5%" | `attendance_logs` + `sales_daily` 비율 + (외부 평균 통계) |
| "식자재 ○○ 단가 5% 인상" | `receipts.unit_price` + `vendor_orders.unit_price` 추세 |
| "이번 달 전월 동요일 -20%" | `sales_daily` 주별 비교 |
| "공과금 미납 의심" | `fixed_costs.expected_day` + `mydata_transactions` 미매칭 |
| "예비비 1개월 미만" | `reserve_fund_logs` 잔고 ÷ 월 평균 지출 |

---

# 🎯 모든 agent에게 (blueprint 자문 의무 추가)

기존 vision 5개 자문에 추가:

6. **이 작업이 위 위험 FK 5개에 영향 있는가?** → 있으면 reviewer 재호출 + 영향 받는 화면 다 점검
7. **이 작업이 어느 화면에 닿는가?** → 위 14개 화면 중 매핑 후 진입
8. **데이터 소스 단일 진실의 원천 어겼는가?** → 매출은 sales_daily / 인건비는 attendance_logs / 고정비는 fixed_costs.estimated_monthly

---

# ⚠️ 사장님 검증 필요 (1가지)

**관리자 대시보드 (#admin) 김은성 = 사장님 본인 맞나요?**
- 헌법·docs 곳곳에 "김은성" 표기 (PIN 1260)
- 같은 분이면 그대로 / 다른 분이면 ⚠️ 정정 필요

---

## 동반 문서 (완성)

- ✅ `vision.md` (Tier 0)
- ✅ `persona.md`
- ✅ `pricing.md`
- ✅ `marketing.md`
- ✅ `roadmap.md`
- ✅ `team.md`
- ✅ `blueprint.md` (이 문서)

**7개 문서 완성 = vision-driven 구조 100% 박힘.**
