# 퐁당샤브 관리 시스템 — 전체 설계 현황

> 최종 업데이트: 2026-04-08
> 세션: session_01L6iQdw3tZS66cppu9mVVNu

---

## 1. 정산/검수 시스템 ✅ 구현 완료

### 목적
매장의 **모든 지출**이 기록과 실제 출금이 일치하는지 검증하는 시스템.

### 대조 대상 (9개 항목 전수 커버)
| # | 항목 | 기록 소스 | 대조 대상 |
|---|------|----------|-----------|
| 1 | 거래처 매입 | vendor_orders (거래처별 소계) | mydata_transactions |
| 2 | 인건비(급여) | attendance_logs.calculated_wage (직원별) | mydata_transactions |
| 3 | 인건비(수당) | special_wages.extra_amount | mydata_transactions |
| 4 | 고정비 | fixed_cost_amounts (항목별) | mydata_transactions |
| 5 | 소모품/비품 | receipts | mydata_transactions |
| 6 | 로열티 | 매출 × royalty_rate | mydata_transactions |
| 7 | 카드수수료 | 카드매출 × card_fee_rate | mydata_transactions |
| 8 | 수동 카테고리 | expense_category_amounts | mydata_transactions |
| 9 | 기타/미분류 | — | mydata_transactions 미매칭 건 |

### UI 위치
- 사이드 메뉴 → 정산/검수 → 지출 대조표
- 서브탭: 총괄표 / 항목별 상세 / 미매칭

### FK 설계
- `reconciliation.category_id` → `expense_categories.id` (FK)
- 지출 항목 추가/삭제 시 코드 수정 없이 자동 반영

### Supabase 테이블
```sql
reconciliation (store_id, year_month, category_id FK, sub_key, sub_label, recorded_total, actual_total, diff_amount, status, confirmed_by, confirmed_at)
UNIQUE(store_id, year_month, sub_key)
```

---

## 2. 엑셀 업로드 + AI 자동분류 시스템 ✅ 구현 완료

### 목적
은행/카드 거래내역 엑셀을 업로드하면 AI가 건별로 자동 분류.

### 업로드 흐름
```
사용자: "📎 엑셀 업로드" 버튼 (은행/카드 각각)
  → 파일 선택 (xlsx, xls, csv)
  → XLSX 라이브러리로 CSV 변환
  → Gemini AI에 전송 (학습 힌트 포함)
  → AI 분류 결과 미리보기
  → 확인 필요 건 리뷰 (confidence low)
  → 저장 (mydata_transactions)
```

### AI 분류 학습 데이터
사용자 제공 엑셀(6~4월, 약 1500건)에서 추출한 매핑 규칙:

**은행 (적요 → 대분류/소분류)**
- 카드사 코드(NH*, KB*, SHC* 등) → 매출/카드결제
- 거래처명(양두현, 대봄야채 등) → 물품대금/거래처명
- 급여*월* → 인건비
- 한국전력공사, 유림에퐁당 등 → 고정비/항목명
- 등등 (전체 규칙은 index.html 내 BANK_CLASSIFY_HINTS 참조)

**카드 (가맹점명 → 대분류/소분류)**
- 논산농협, 쿠팡, 다이소 등 → 직구/직구상세
- NICE(빌링)_(주)마켓보로 → 물품대금/맛사랑
- 에스케이쉴더스 → 고정비/캡스
- 등등 (전체 규칙은 index.html 내 CARD_CLASSIFY_HINTS 참조)

### 특수 처리
1. **중복 방지**: tx_hash (날짜+시간+금액+내용 해시) 기반
2. **카드 취소/환불**: is_cancelled, original_amount로 차감 처리
3. **정산 제외**: 카드대금, 배당금, 개인결제 → exclude_from_settlement
4. **월 귀속**: 내용에 월 정보 있으면 attribution_month 자동 추출
5. **학습 자산**: raw_data jsonb에 원장 원본 전체 보존
6. **확인 필요**: AI 확신 낮으면 needs_review + review_reason 표시

### Supabase 테이블
```sql
mydata_transactions (
  -- 기본
  store_id, account_id, tx_type, tx_date, tx_time, description, merchant_name, amount, balance, source,
  -- AI 분류
  category_id FK→expense_categories, sub_category, confidence, needs_review, review_reason,
  -- 정산
  exclude_from_settlement, attribution_month,
  -- 세무
  supply_amount, vat_amount,
  -- 원본/중복
  raw_description, upload_batch_id, tx_hash,
  -- 취소
  is_cancelled, original_amount,
  -- 학습 자산
  raw_data jsonb
)
```

---

## 3. 공과금 미납 알림 (부분 구현)

### 목적
매월 정해진 날짜에 자동이체되는 공과금이 안 빠졌으면 알림.

### 구현 상태
- ✅ fixed_costs 테이블에 expected_day, tolerance_days 필드 추가
- ✅ 고정비 추가/편집 UI에 예정일 입력란 추가
- ❌ 체크 로직 (정산/검수 로드 시 미납 감지) — 다음 세션

### 체크 로직 (미구현)
```
매 정산/검수 로드 시:
1. fixed_costs에서 expected_day 설정된 항목 조회
2. 해당 월 mydata_transactions에서 매칭 출금 검색
3. 예정일 + 유예일수 경과 + 출금 없음 → "⚠️ 미납 의심" 표시
4. 주말이면 다음 영업일까지 유예
```

---

## 4. 거래처 차액 추적 (미구현)

### 목적
거래처 월정산 시 기록 금액과 실제 출금 금액의 차이를 추적.
반품/상계 등으로 차액이 발생할 수 있음.

### Supabase 테이블 (생성 완료)
```sql
vendor_diffs (store_id, vendor_id FK, year_month, expected_amount, actual_amount, diff_amount, status, resolved_at, memo)
```

### 로직 (미구현)
- vendor_orders 월 합계 vs mydata_transactions 해당 거래처 출금 비교
- 차액 있으면 vendor_diffs에 기록
- 다음 달 거래에서 상계 건 발견 시 resolved 처리
- 미해결 차액 → 정산/검수에서 목록 표시

---

## 5. 월 귀속 판단 로직 (미구현)

### 판단 우선순위
```
1차: 내용에 월 정보 + 금액 평소 범위 → 자동 귀속
1차-b: 내용에 월 정보 + 금액 이상 → 귀속하되 확인 요청
2차: 고정비 + 예정일 기반 → 전월분 제안
3차: 거래처 월정산 + 금액 대조 → 일치/차액 분석
4차: 해당 없음 → 출금월 = 귀속월 (사용자 변경 가능)
```

---

## 6. 범용 대량 입력 (계획만)

### 하나의 업로드 엔진, 대상만 교체
```
EXCEL_TARGETS = {
  bank: { prompt, saver, table: 'mydata_transactions' },     ← 구현 완료
  card: { prompt, saver, table: 'mydata_transactions' },     ← 구현 완료
  employee: { prompt, saver, table: 'employees' },           ← 미구현
  vendor_order: { prompt, saver, table: 'vendor_orders' },   ← 기존 기능 있음
  fixed_cost: { prompt, saver, table: 'fixed_costs' },       ← 미구현
}
```

---

## 7. Codef API 연동 (대기)

### 상태
- Codef에 유료 견적 문의 완료 → 답변 대기 중
- Sandbox(3개월 무료, 일 100건, 테스트 데이터)는 사용 가능
- 실서비스 전환 시 유료 구독 필요

### 구현 시 필요
- Cloudflare Workers 프록시 (codef-proxy.js)
- Connected ID 발급 + 토큰 관리
- 은행+카드 둘 다 지원

---

## 8. 기존 시스템 현황

### 구현 완료 기능
- 영수증 AI 분석 (Gemini)
- 근태 관리 (출퇴근, CAPS 연동)
- 근무계획 (간트차트)
- 마감정산 (현금 vs 장부)
- 대시보드 (매출/지출/순이익)
- 급여 집계
- 거래처 관리 + 파일 업로드
- 고정비 관리 (항목 + 월별 금액)
- 직원/직급/권한 관리
- 지출 카테고리 (expense_categories)
- 지출리스트 (계좌/카드/마이데이터)

### Supabase 테이블 목록
- stores, store_settings
- employees, roles, attendance_logs, work_schedules, special_wages
- vendors, vendor_orders
- receipts
- settlements, daily_sales
- fixed_costs, fixed_cost_amounts
- expense_categories, expense_category_amounts
- mydata_accounts, mydata_transactions ← 확장됨
- reconciliation ← 신규
- vendor_diffs ← 신규
- caps_upload_staging

### 기술 스택
- 프론트: 단일 index.html (Vanilla JS + Supabase JS SDK + XLSX.js + Chart.js)
- 백엔드: Supabase (PostgreSQL + RLS + REST API)
- AI: Gemini API (프록시 경유)
- 크롤러: Cloudflare Workers (upsolution-crawler.js)
- 배포: GitHub Pages 또는 직접 호스팅

---

## 9. 다음 세션 TODO

1. ❌ 공과금 미납 알림 체크 로직 구현
2. ❌ 거래처 차액 추적 로직 구현
3. ❌ 월 귀속 판단 고도화
4. ❌ 실제 엑셀 데이터로 AI 분류 테스트
5. ❌ 이중기록 관련 — 원장 데이터 학습 구조 확장
6. ❌ Codef 답변 오면 연동 진행
