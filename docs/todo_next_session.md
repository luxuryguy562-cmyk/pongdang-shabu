# 다음 세션 TODO 리스트

> **작성일**: 2026-04-23 세션 말미
> **상태**: 대기 (사장님 승인 후 진행)
> **브랜치**: `claude/apply-gstack-repo-24Y4m` (또는 신규 `claude/fix-sales-dashboard-YYMMDD`)

---

## 다음 세션 진입 트리거 (사장님이 쳐야 할 말)

> **"docs/todo_next_session.md 봐. 1순위부터 진행해줘."**

또는 더 짧게:

> **"어제 todo 이어받아"**

→ Claude가 이 파일 읽고 `critic v2` 사전 스캔 돌린 뒤 1순위부터 계획서 제출.

---

## 🔴 1순위 — 치명 (오늘 안 고쳐야)

> **2026-04-23 후속 세션**: ①②③ 수정 완료 (work_log 참조). ④는 별도 Part B 계획서 필요 — 아직 미착수.

### ① ✅ [2026-04-23 수정] [자기-버그] 수동 편집한 `source='closing'` 카드, 마감 재저장 시 덮어써짐
**증상**: 사장님이 매출 관리 페이지에서 금액 수정 후, 같은 날 마감정산 다시 저장하면 수동 수정 사라짐.
**원인**: `syncClosingToSalesDaily` 가 UPSERT onConflict(store_id,date) → 무조건 덮어씀.
**수정 방향**:
- A. source='closing' 행을 수동 편집하면 source를 `'closing_edited'` 로 바꿈 → sync 시 그 날은 스킵
- B. sync 시 기존 행의 `source='closing'`인 경우만 덮어씀, 수정본은 유지
→ B가 덜 침습적. 20~40분 작업.
**위치**: `index.html` `syncClosingToSalesDaily` (약 3625행 부근) + `saveSalesDaily` upsert 로직

### ② ✅ [2026-04-23 수정] [자기-버그] 편집 시트에서 날짜 변경 시 UNIQUE 충돌 가능
**증상**: 04-23 카드 편집 중 날짜를 04-22로 바꾸면, 04-22 이미 있는 카드를 덮어씀 (다른 날 매출 증발)
**수정 방향**:
- 날짜 바꾸면 **저장 전 기존 행 확인** → 있으면 "그 날짜에 이미 데이터 있어요. 덮어쓸까요?" 확인
- 또는 날짜 변경 자체를 막고 삭제 후 새로 추가로 유도
**위치**: `saveSalesDaily` 함수 (`index.html` 약 8700행 부근)

### ③ ✅ [2026-04-23 수정] [자기-버그] 마감정산 sync 실패 시 사용자 알림 없음
**증상**: `syncClosingToSalesDaily` 가 에러 나도 `console.error`만, 사장님은 "마감 저장 완료!" 토스트만 봄
**수정 방향**:
- `try/catch` 에서 실패 시 `toast('매출 관리 동기화 실패: ...', 'warn')` 추가
- 또는 setLoad 끝나기 전 명시적 알림
**위치**: `index.html` 약 3618~3622행

### ④ ✅ [2026-04-23 수정] 매출 관리 ↔ 대시보드 ↔ 마감정산 **숫자 따로 놂**
**증상**: 대시보드는 `settlements.items_json` 또는 `daily_sales` 읽음. 매출 관리 페이지는 `sales_daily` 읽음. 사장님이 비교 시 숫자 불일치 혼동.
**수정 방향**:
- 대시보드 매출 차트 데이터 소스를 `sales_daily` 로 전환 (옵션 추가 or 전면 전환)
- 신호: 사장님이 "매출 관리 숫자랑 대시보드 숫자 맞춰줘" 할 것
**위치**: `index.html` `loadDashboard` 및 `dashSaleSource` 관련 (약 3800~3870행)
**작업 시간**: 2~3시간 (차트 재작성 포함)

---

## 🟡 2순위 — 중요 (이번 주)

### ⑤ ✅ [2026-04-23 수정] 정산/검수 페이지에 **매출 대조 항목 추가** (Part D)
- 지출 9개 대조는 있으나 매출 대조 0개
- sales_daily.card → mydata_transactions 카드사 입금 매칭
- sales_daily.etc → 배달앱/계좌이체 매칭
- 위치: `loadReconciliation` (약 7986~8450행)
- 규모: 중~대형

### ⑥ ✅ [2026-04-23 수정] 편집 시트 모바일 세로 공간 부족
- 결제수단 7개 + 메모 + 합계 + 버튼 → 스크롤 필요
- `sales-edit-row` 부모에 `overflow-y:auto; max-height:80vh` 추가 검토
- 또는 입력 항목 2열 그리드로

### ⑦ ✅ [2026-04-23 수정] 합계 0원 카드 숨김
- 휴무일에도 마감 찍으면 0원 카드 생성 → 의미 없음
- `renderSalesCards` 에서 `total===0 && source==='closing'` 은 제외

### ⑧ ✅ [2026-04-23 부분 수정] 로딩 표시(`setLoad`) 누락 — 실제는 상세비교 1곳만 필요
- `openTxEditSheet`, `applyReviewChoice`, `bulkReclassify`, 상세비교 열기
- 네트워크 느릴 때 중복 저장 위험

### ⑨ ✅ [2026-04-23 확인] 비활성 카테고리 — 이미 `openCatPicker` 3단계 모두 `is_active!==false` 필터 있음. 재확인 완료.
- 관리 화면은 필터링되는데 분류 선택 드롭다운에서 안 됨
- 위치: `openCatPicker` (약 5955행)

### ⑩ ✅ [2026-04-23 수정] 에러 메시지 기술 문구 노출 — openDailyDetail alert → toast
- `alert('상세 비교 열기 실패: TypeError: ...')` 같은 것
- 위치: 약 5654, 6290행
- 교체: 사용자 친화 메시지 + `console.error` 분리

---

## 🟢 3순위 — 개선 (여유되면)

### ⑪ 🟡 [2026-04-23 Phase 1 완료, Phase 2 예정] 동적 결제수단 추가/삭제
- Phase 1 ✅: payment_methods 테이블 + sales_daily.amounts jsonb + 매출 관리 UI 동적화 + 결제수단 CRUD UI
- Phase 2 (예정): 대시보드 salesBreakdown + 정산/검수 매출 대조도 paymentMethods 기반 동적화
- Phase 2는 사장님 Phase 1 실사용 피드백 후 착수

### ⑫ ❌ [2026-04-23 오진단 판명 — 스킵]
- 원문: "거래내역 테이블에 📸 영수증 배지 추가 — 마감정산엔 있고 거래내역엔 빠짐"
- 실제: 거래내역(`renderTxRow` 6179~)에 이미 `📸 영수증 참조` 표시 있음. 마감정산 탭엔 애초에 거래 리스트 없음.
- 교훈: `dev_lessons #48` — todo 메모를 검증 없이 사실로 옮긴 제 실수.

### ⑬ ✅ [2026-04-23 수정] 빈 매출 관리 페이지 중앙에 [+ 매출 추가] 큰 버튼

### ⑭ ✅ [2026-04-23 수정] 예비비 사용 이력 대시보드에서 바로 조회 (reserveHistorySheet 팝업)

---

## 이번 세션에서 확정된 것 (사장님이 이미 OK 한 것)

- ✅ gstack critic v1 + v2 에이전트 도입 (`agents/critic.md`)
- ✅ `sales_daily` 테이블 + 매출 관리 카드형 UI (2026-04-23 머지 `4c1f516`)
- ✅ 마감정산 저장 시 `syncClosingToSalesDaily` 연동
- ✅ dev_lessons #44, #45 추가 (외부 흡수 원칙 + UX > 스키마)

---

## critic v2 사전 스캔 결과 (다음 세션 참고용)

다음 세션 시작하면 critic이 자동으로 이 표 읽고 판단:

| 요청 | 예상 라우팅 | 회차 |
|---|---|---|
| "버그 고쳐" (1순위 ①~④) | v2 PD1 먼저 — 내가 만든 것 근본 체크 | 2회차 (방금 만듦) |
| "대시보드 sales_daily 연결" | v2 PD3 유령 데이터 — settlements/daily_sales/sales_daily 3중 매핑 점검 | 대시보드 5회차+ |
| "매출 대조 추가" | v1 Q4 최소버전 + v2 PD3 | 신규 |

---

## 세션 끊길 때 체크리스트

- [x] work_log.md 업데이트
- [x] 이 파일(`todo_next_session.md`) 작성
- [ ] 커밋 + 브랜치 푸시
- [ ] main 머지 + 푸시
