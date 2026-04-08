# 엑셀 업로드 시스템 — 최종 확정 계획

## 규칙 준수 사항 (.clauderules)
- 수익화 > 안정성 > 단순함 > 자동화 우선순위
- 데이터 무결성: FK 참조, 중복 방지, 취소 건 반영
- UX: 사용자 3초 이상 고민 금지 → 은행/카드 2개 버튼만, 나머지 AI 자동
- 확장성: 다른 매장에서도 사용 가능한 범용 구조
- 세무 증빙: 모든 거래 기록, 부가세 분리 저장

## 1. 핵심 구조

### 업로드 흐름 (모든 대상 공통)
```
사용자: "은행내역" 또는 "카드내역" 선택 → 파일 업로드
  ↓
시스템: XLSX → CSV 변환 → AI에 전송
  ↓
AI: 1) 은행/카드사 양식 자동 판별
    2) 컬럼 매핑 (날짜/내용/금액/잔액 등)
    3) 대분류/소분류 자동 분류 (학습 데이터 기반)
    4) 확신도 낮은 건 플래그 표시
    5) 취소/환불 건 반영
    6) 월 귀속 판단 (전월분 감지)
  ↓
미리보기: 건별로 분류 결과 표시 + 확인 필요 건 하이라이트
  ↓
사용자: 확인/수정 → 저장
```

### 저장 테이블: mydata_transactions (기존 테이블 확장)
추가 필드:
- `category_id` uuid → expense_categories FK (AI 분류 결과)
- `sub_category` text (소분류)
- `confidence` text (high/medium/low — AI 확신도)
- `needs_review` boolean (사용자 확인 필요 여부)
- `exclude_from_settlement` boolean (정산 제외: 카드대금, 개인결제 등)
- `attribution_month` text (귀속월 — 출금월과 다를 수 있음)
- `supply_amount` integer (공급가액 — 카드 부가세 분리용)
- `vat_amount` integer (부가세)
- `source` text 값 추가: 'excel_bank' / 'excel_card'
- `raw_description` text (원장 원본 내용 보존)
- `upload_batch_id` text (업로드 배치 ID — 중복 방지 + 일괄 삭제용)

## 2. AI 분류 프롬프트 설계

### 은행 거래내역용
```
은행 계좌 거래내역입니다. 각 건을 분류해주세요.

컬럼 매핑 규칙:
- 컬럼명이 은행마다 다릅니다 (찾으신금액/출금액/지급액 → 출금, 맡기신금액/입금액 → 입금)
- 날짜: 거래일/거래일시/일자 → YYYY-MM-DD
- 내용: 적요/거래내용/내용/비고 → description
- 잔액: 잔액/거래후잔액 → balance

분류 규칙 (과거 학습 데이터):
{여기에 위에서 추출한 매핑 규칙 삽입}

특수 처리:
1. 카드대금(롯데카드, 신한카드 등) → exclude_from_settlement: true
2. 배당금, 개인결제(이송은 등) → exclude_from_settlement: true  
3. "정산체크제외" 메모가 있으면 → exclude_from_settlement: true
4. 내용에 월 정보 포함 시(XX월분, 202507 등) → attribution_month 추출
   - 출금월과 귀속월이 다르면 → needs_review: true
5. 금액이 해당 항목 평소 범위와 크게 다르면 → needs_review: true
6. 분류 확신이 낮으면 → confidence: "low", needs_review: true

출력: JSON 배열
필드: tx_date, tx_time, description, amount(입금+/출금-), balance,
      category(대분류), sub_category(소분류), confidence(high/medium/low),
      needs_review(boolean), review_reason(사유),
      exclude_from_settlement(boolean), attribution_month(YYYY-MM 또는 null)
```

### 카드 결제내역용
```
카드 결제내역입니다. 각 건을 분류해주세요.

컬럼 매핑 규칙:
- 가맹점명/이용가맹점/내용 → merchant_name
- 이용금액/승인금액/총금액 → amount
- 공급가액 → supply_amount, 부가세 → vat_amount (있으면)
- 할부기간 → installment

분류 규칙 (과거 학습 데이터):
{카드 가맹점 매핑 규칙 삽입}

특수 처리:
1. 취소 건: 승인취소/부분취소가 있으면 원거래와 매칭하여 차감 금액 계산
   - 취소 후 실제 청구 금액을 amount로 설정
2. 직구(직접구매) 건: 논산농협, 쿠팡, 다이소, 탑마트, 홈플러스 등
   → 카드내역만으로는 품목별 분류 불가
   → category: "직구", needs_review: false (영수증으로 별도 분류)
3. 개인결제(어머님, 아버님) → exclude_from_settlement: true
4. 부가세가 분리되어 있으면 supply_amount, vat_amount 각각 저장

출력: JSON 배열
필드: tx_date, tx_time, merchant_name, amount, supply_amount, vat_amount,
      category(대분류), sub_category(소분류), confidence(high/medium/low),
      needs_review(boolean), review_reason(사유),
      exclude_from_settlement(boolean), installment(할부개월),
      is_cancelled(boolean), original_amount(취소전 원금액)
```

## 3. 중복 업로드 방지

### 방법: upload_batch_id + 건별 해시
```
1. 파일 업로드 시 배치 ID 생성 (날짜+시간+파일해시)
2. 각 건마다 해시 생성: SHA256(날짜+시간+금액+내용)
3. 기존 데이터에 동일 해시가 있으면 → "이미 업로드된 건입니다" 표시
4. 부분 중복이면 → "N건 중 M건이 이미 존재합니다. 신규 N-M건만 저장할까요?"
```

## 4. 월 귀속 판단 로직

### 우선순위
```
1차: 내용에 월 정보 있음 + 금액이 평소 범위 내 → 자동 귀속
1차-b: 내용에 월 정보 있음 + 금액이 평소와 다름 → 귀속은 하되 needs_review: true
2차: 고정비 항목 + 예정일 기반 → 해당 월에 출금 없었고 다음 달에 나감 → "전월분?" 제안
3차: 거래처 월정산 + 금액 대조 → 
     - 일치 → "N월분 정산금으로 보입니다" 제안
     - 차액 있음 → "N월분 정산 추정, 차액 X원 확인 필요" + 차액 추적
4차: 위 해당 없음 → 출금월 = 귀속월 (기본값, 사용자가 변경 가능)
```

### 차액 추적
```
거래처별 차액 기록:
- vendor_id, year_month, expected_amount, actual_amount, diff, status(pending/resolved)
- 다음 달 거래원장에서 상계 건 발견 시 → status: resolved
- 미해결 차액 → 정산/검수에서 "미해결 차액" 목록 표시
```

## 5. 공과금 미납 알림

### fixed_costs 테이블 필드 추가
```sql
ALTER TABLE fixed_costs ADD COLUMN expected_day integer; -- 예정일 (1~31)
ALTER TABLE fixed_costs ADD COLUMN tolerance_days integer DEFAULT 3; -- 유예일수
```

### 체크 로직
```
매일 또는 정산/검수 로드 시:
1. fixed_costs에서 expected_day가 설정된 활성 항목 조회
2. 해당 월 mydata_transactions에서 매칭되는 출금 검색
3. 예정일 + 유예일수 지났는데 출금 없음 → "미납 의심" 알림
4. 주말/공휴일이면 다음 영업일까지 유예
```

### 알림 위치
- 정산/검수 총괄표에 "⚠️ 미납 의심" 배지
- 대시보드에도 간단 알림 가능 (추후)

## 6. UI 설계

### 업로드 진입점
기존 지출리스트 탭의 계좌내역/카드리스트에 "📎 엑셀 업로드" 버튼 추가

### 업로드 바텀시트
```
[은행내역 업로드] [카드내역 업로드]  ← 2개 버튼만

파일 선택: [📁 엑셀/CSV 선택]

AI 분석 중... (로딩)

━━ 분석 결과 ━━
✅ 정상 분류: 245건
⚠️ 확인 필요: 12건  ← 클릭하면 해당 건만 필터
🔄 중복 건: 3건 (자동 제외)
❌ 취소/환불: 5건 (자동 반영)

[확인 필요 건 먼저 보기]
[전체 미리보기]
[저장하기]
```

### 확인 필요 건 UI
```
⚠️ 확인 필요 (12건)

┌─────────────────────────────────┐
│ 2026-03-02 대봄야채02월분        │
│ 출금: 6,237,100원               │
│ AI 분류: 물품대금/대봄야채       │
│ ⚠️ 2월분인데 3월에 출금됨        │
│ → 귀속월: [2월 ▼] 확인          │
│ vendor_orders 2월 합계: 6,237,100 (일치 ✅)│
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 2026-01-15 중도매인228           │
│ 출금: 400,000원                 │
│ AI 분류: ??? (확신 낮음)         │
│ → 대분류: [선택 ▼] 소분류: [입력]│
└─────────────────────────────────┘
```

## 7. 범용 대량 입력 (직원/거래처/고정비)

### 동일 엔진, 대상만 교체
```
EXCEL_TARGETS = {
  bank: { prompt, saver, table: 'mydata_transactions' },
  card: { prompt, saver, table: 'mydata_transactions' },
  employee: { prompt, saver, table: 'employees' },
  vendor_order: { prompt, saver, table: 'vendor_orders' },  // 기존 기능 확장
  fixed_cost: { prompt, saver, table: 'fixed_costs + fixed_cost_amounts' }
}
```

### 추가 시 코드 변경 없이:
- EXCEL_TARGETS에 새 대상 추가
- 프롬프트 1개 + 저장함수 1개만 작성

## 8. 수정 대상 파일

### `index.html`
- 지출리스트 탭에 "📎 엑셀 업로드" 버튼 2개 추가
- 엑셀 업로드 바텀시트 HTML
- 확인 필요 건 리뷰 UI
- JS 함수:
  - `openExcelUpload(type)` — 바텀시트 열기
  - `handleExcelFile(input, type)` — XLSX → CSV
  - `parseWithAI(csv, type)` — AI 분류 호출
  - `renderUploadPreview(result)` — 미리보기
  - `renderReviewItems(items)` — 확인 필요 건
  - `saveExcelBatch(result, type)` — 일괄 저장
  - `checkDuplicates(items)` — 중복 체크
  - `checkUnpaidFixed()` — 공과금 미납 체크

### Supabase 변경
- mydata_transactions 필드 추가 (category_id, sub_category, confidence 등)
- fixed_costs 필드 추가 (expected_day, tolerance_days)

### AI 학습 데이터
- 은행 내용→분류 매핑 규칙 (프롬프트에 포함)
- 카드 가맹점→분류 매핑 규칙 (프롬프트에 포함)
- 과거 분류 데이터를 Supabase에서 조회하여 동적 힌트 생성

## 9. 검증 방법
1. 사용자 제공 엑셀 데이터(6~4월)로 AI 분류 정확도 테스트
2. 취소/환불 건 정확히 반영되는지 확인
3. 중복 업로드 시 차단 확인
4. 전월 귀속 건 정확히 감지하는지 확인
5. 정산/검수에서 업로드 데이터 정상 표시 확인
6. 공과금 미납 알림 정상 동작 확인
