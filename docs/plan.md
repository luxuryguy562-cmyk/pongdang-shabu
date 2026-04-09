# 퐁당샤브 관리 시스템 — 전체 설계 현황

> 최종 업데이트: 2026-04-09

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
| 5 | 대시보드 (매출/지출/순이익) | ✅ 완료 | 가마감/진마감 토글 |
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

---

## 6. Supabase 테이블 목록

> 상세 스키마 → `db_schema.md` 참조

기존 17개 + 추가 4개 = 21개
