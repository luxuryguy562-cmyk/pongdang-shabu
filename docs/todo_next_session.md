# 다음 세션 TODO 리스트

> **최종 업데이트**: 2026-04-23 세션 마감
> **브랜치**: `claude/complete-priority-tasks-yRxCN` (이 세션). 다음 세션은 신규 `claude/...` 브랜치 생성
> **이전 세션 완료 내역**: `docs/work_log.md` 2026-04-23 섹션 전체 참조

---

## 🚦 다음 세션 진입 트리거 (사장님이 칠 말)

가장 간단:
> **"어제 todo 이어받아"**

또는 명시적:
> **"docs/todo_next_session.md 보고 남은 것 진행해줘"**

→ Claude가 이 파일 + work_log.md + db_schema.md 읽고 계획서 제출.

---

## ⚠️ 사장님이 아직 실행 안 하신 SQL 2개 (이 세션 산출물)

**배포된 코드는 SQL 미실행 시에도 레거시 폴백으로 동작하지만, 아래 SQL 실행해야 풀 기능 활성화됨:**

1. **Part D (정산/검수 매출 대조)** — `docs/sql/migrate_sales_recon_mapping_2026_04_23.sql`
   - `store_settings.sales_recon_mapping jsonb` 컬럼 추가
   - 실행 후: 정산/검수 탭 매출 섹션 4항목에서 "⚙️ 입금 카테고리 설정" 가능

2. **Part F Phase 1 (결제수단 동적 관리)** — `docs/sql/migrate_payment_methods_2026_04_23.sql`
   - `payment_methods` 테이블 신설 + seed 7개 + `sales_daily.amounts jsonb` 컬럼 + 백필
   - 실행 후: 사이드메뉴 💰 매출 관리 → "결제수단 관리" 정상 작동

> SQL 실행 여부 Claude가 확인하려면: `select count(*) from payment_methods;` / `select sales_recon_mapping from store_settings limit 1;`

---

## 🟢 남은 작업 (다음 세션 후보)

### 🟡 Part F Phase 2 — 대시보드/정산검수 paymentMethods 동적화 (중형, 2~3시간)
**Phase 1 배경**: 매출 관리 + 마감정산만 동적화 완료. 대시보드 매출 상세 도넛과 정산/검수 매출 대조는 아직 legacy_key 기준.
**할 일**:
- `loadDashboard` salesBreakdown — `paymentMethods.name` 기반으로 집계
- `loadReconciliation` 매출 대조 4항목 (`_sales_card/_sales_cash_receipt/_sales_qr/_sales_etc`) — paymentMethods 기반 동적 생성
- `sales_recon_mapping` 구조도 method_id 기반으로 확장 검토 (legacy_key 호환 유지)
**진입 조건**: 사장님이 Phase 1 실사용해서 "대시보드에도 신규 결제수단 나왔으면 좋겠다" 피드백 줄 때

### 🟡 Phase 2 완료 후 (Phase 3 예정)
- sales_daily 기존 7 컬럼(card/cash/...) DROP — amounts jsonb만 남김
- 안전하려면 Phase 2 배포 후 1~2주 관찰 필요

### 🟢 기타 여유 작업 (사장님 요청 시)
- 매출 관리 2열 그리드 (⑥ 보완) — 결제수단 많아지면 스크롤 길어짐 대응
- 거래내역 검색/필터 고도화
- 영수증 OCR 정확도 개선
- 직원 교대근무 자동 판정

---

## 🏁 이번 세션 (2026-04-23) 완료 요약

**1순위 4건 + 2순위 6건 + 3순위 3건 = 총 13건 처리**

| # | 내용 | 상태 |
|---|---|---|
| ① | 수동 수정본 덮어씌움 (closing_edited 마킹) | ✅ |
| ② | 편집 시트 날짜 충돌 확인 | ✅ |
| ③ | 마감정산 sync 실패 토스트 | ✅ |
| ④ | 대시보드 매출 → sales_daily 통합 | ✅ (backfill SQL 실행됨) |
| ⑤ | 정산/검수 매출 대조 추가 | ✅ (**SQL 실행 필요**) |
| ⑥ | 편집 시트 모바일 스크롤 | ✅ |
| ⑦ | 0원 마감자동 카드 숨김 | ✅ |
| ⑧ | 상세비교 setLoad | ✅ |
| ⑨ | 비활성 카테고리 필터 | ✅ (이미 적용됨 확인) |
| ⑩ | 기술 에러 문구 토스트화 | ✅ |
| ⑪ | 결제수단 동적 관리 | 🟡 Phase 1 완료 (**SQL 실행 필요**), Phase 2 예정 |
| ⑫ | 거래내역 📸 배지 | ❌ 오진단 판명, 스킵 (dev_lessons #48 교훈) |
| ⑬ | 빈 매출 중앙 큰 버튼 | ✅ |
| ⑭ | 예비비 이력 팝업 | ✅ |

**신규 dev_lessons**: #46 자동 sync 수정본 보호 · #47 단일 진실의 원천 · #48 검증 없이 todo 전달 금지
