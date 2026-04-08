# 퐁당샤브 Supabase DB 스키마

> **Supabase URL**: `https://ruytgygjwnbtzmtofopg.supabase.co`
> **store_id**: `4ae03341-e5dc-4933-b746-29728cbc685f` (퐁당샤브 논산점)
> **최종 업데이트**: 2025-04 (index.html 코드 기반 추출)

## 테이블 관계도

```
stores (매장)
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

## 테이블 상세 (17개)

### stores
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 매장 고유 ID |
| name | 매장명 |
| is_active | 활성 여부 |

### store_settings
| 컬럼 | 용도 |
|------|------|
| store_id (FK→stores, unique) | 매장 ID (1:1) |
| ups_store_code | 업솔루션 매장 코드 |
| ups_id / ups_pw | 업솔루션 로그인 정보 |
- upsert onConflict: `store_id`

### employees
| 컬럼 | 용도 |
|------|------|
| id (uuid, PK) | 직원 ID |
| store_id (FK→stores) | 소속 매장 |
| name | 이름 |
| role | 직급명 (**문자열**, roles.name 참조, FK 아님) |
| birth_date, phone, address | 개인정보 |
| bank_name, account_number | 급여 계좌 |
| base_wage (int) | 시급 |
| pin | 로그인 PIN |
| caps_id | CAPS 지문인식기 ID |
| hire_date, resign_date | 입퇴사일 |
| is_active, is_approved, is_manager | 상태 플래그 |

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

### receipts
| 컬럼 | 용도 |
|------|------|
| store_id | 매장 |
| date, vendor, category, item | 날짜/거래처/분류/품목 |
| price, count, total_price (int) | 단가/수량/합계 |
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
| data_source, source_filter, is_active | year_month, amount |

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

## 주의사항
- **RLS 비활성**: anon key로 직접 접근 가능
- **store_id 필수**: 모든 쿼리에 빠뜨리면 타 매장 데이터 노출
- **role 문자열 연결**: employees.role = roles.name (FK 아님), 직급명 변경 시 employees도 업데이트 필요
