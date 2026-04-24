# 다음 세션 TODO 리스트

> **최종 업데이트**: 2026-04-24 Part F Phase 2 배포
> **브랜치**: `claude/continue-todo-list-KG9PD` (이 세션). 다음 세션은 신규 `claude/...` 브랜치 생성
> **이전 세션 완료 내역**: `docs/work_log.md` 2026-04-24 / 2026-04-23 섹션 참조

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

### 🟡 Part F Phase 3 — sales_daily 레거시 컬럼 정리 (소형~중형, Phase 2 안정 후)
**할 일**:
- `sales_daily`의 `card/cash/cash_receipt/qr/etc/extra_large/extra_small` 7컬럼 DROP — `amounts jsonb`만 유지
- DROP 전: `amounts`가 누락된 행 백필 SQL (legacy 컬럼 → amounts)
- 코드의 `getMethodAmount` legacy_key 폴백 분기 단순화
**진입 조건**: Phase 2 배포 후 **1~2주 관찰** + 사장님이 새 결제수단 정상 사용 확인

### 🟢 부가 옵션 — 매출 대조 결제수단 표시 토글 (소형)
- Phase 2 배포 후 매출 대조에 cash/뽑기 등 매핑 의미 없는 항목이 노이즈로 느껴지면
- `payment_methods.show_in_recon` 같은 컬럼 추가해서 결제수단 관리에서 토글
**진입 조건**: 사장님이 "현금은 대조에서 안 보이게" 같은 피드백 줄 때

### 🟢 기타 여유 작업 (사장님 요청 시)
- 매출 관리 2열 그리드 — 결제수단 많아지면 스크롤 길어짐 대응
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
| ⑪ | 결제수단 동적 관리 | 🟢 Phase 1+2 완료 (**SQL 실행 필요**), Phase 3 예정 |
| ⑫ | 거래내역 📸 배지 | ❌ 오진단 판명, 스킵 (dev_lessons #48 교훈) |
| ⑬ | 빈 매출 중앙 큰 버튼 | ✅ |
| ⑭ | 예비비 이력 팝업 | ✅ |

**신규 dev_lessons**: #46 자동 sync 수정본 보호 · #47 단일 진실의 원천 · #48 검증 없이 todo 전달 금지
