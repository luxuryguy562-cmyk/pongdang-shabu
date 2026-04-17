# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

---

## [2026-04-17] 코드 구조 개선 로드맵 Phase 2a — store_id 필터 누락 감사 + 수정

### 상태: 배포완료
### 브랜치: claude/review-docs-deployment-JjQkV → main
### 백업 커밋: 12d7a70
### 수정 커밋: 9f6a30d

### 배경
Supabase RLS 비활성 상태이므로 클라이언트 레이어 `.eq('store_id', currentStore.id)` 필터가 다매장 데이터 격리의 유일한 방어선. 다음 매장 추가 시(예: 대전점) 누락 곳에서 데이터 혼입·노출 위험. 본 작업은 사장님 B안(방어적) 승인하에 진행.

### 절차 (제11조 6단계 준수)

**11-1 사전 스캔**:
- /tmp/phase2a/audit.py 작성 → sb.from(...) 호출 136개 전수 추출 후 체인 분석
- 분류 결과 (1차): A=97 / B=1 / C=17 / D=21
- 사장님 중간 리포트 + 재승인 (B안: C+D 전부 수정)
- C 17건 수동 검증 → **11건 false positive 발견** (payload 변수가 sb.from 위에 정의돼 있어 audit script 한계). 진짜 C는 5건.
- 최종 수정 대상: D 21 + C 5 = **26건**

**11-2 백업 커밋**: 12d7a70 (빈 커밋, 롤백 지점)

**11-3 스크립트화**: 
- /tmp/phase2a/patch.py — 라인번호 + 패턴타입(eq_id/in_id/select_eq) + store 변수명 매핑
- 변환 결과: 성공 26 / 실패 0
- /tmp/phase2a/index.html.bak 보존

**11-4 사후 검증 (3단 게이트)**:
1. 구문: node --check (script 블록 추출) 통과
2. 잔재: audit 재실행 → D 21→0, C 17→12 (12건은 검증 완료 false positive)
3. 샘플: diff 26줄 전수 육안 — 패턴 일관성 확인

**11-5 기록**: 본 항목 + dev_lessons #28 신설

**11-6 배포 전 체크**: 6항목 전부 통과 후 main 머지

### 수정 카테고리
| 분류 | 패턴 | 건수 |
|------|------|------|
| D | `.eq('id', X).update/.delete` → `.eq('id', X).eq('store_id', currentStore.id)` 추가 | 21 |
| C-eq | `.eq('id', X)` 단일 행 update | 1 (5016) |
| C-in | `.in('id', list).update/.delete` → `.eq('store_id')` 추가 | 2 (5014, 5776) |
| C-select | `.select(...).eq('category_id', ...)` → `.eq('store_id', sid)` 추가 | 3 (5477, 5484, 7147) |

### False Positive 12건 (수정 불필요 — 이미 안전)
- payload/rows 변수에 `store_id:currentStore.id` 사전 포함:
  receipts(2356), attendance_logs(2990), caps_upload_staging(2992), work_schedules(3028), 
  vendor_orders(4233), fixed_cost_amounts(4301), store_settings(4615/4641), 
  special_wages(4673), classification_rules(6471/6550), mydata_transactions(6967)

### DB 변경
- 없음 (코드만)

### 다음 단계 (Phase 2b — 별도 세션)
- RLS 활성화 SQL + 롤백 SQL 준비
- store_settings 등 모든 테이블에 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (true)` 1차 (방어막 2중화 후 점진적 강화)
- Cloudflare Worker 프록시 검토 (anon key 노출 대안)

### 다음 세션 시작 방법 (복붙용)
```
docs 전부 읽고 (CLAUDE.md 제11조 특히, business_rules.md, dev_lessons.md,
plan.md, db_schema.md, work_log.md 최상단 Phase 2a 항목, services.md)
절대 무시·생략 없이 준수.

세션 시작 필수: git fetch --all 먼저 실행 (dev_lessons #29 참조).
로컬 main이 뒤처져 있을 수 있음.

현재 상태: Phase 2a 배포완료 (커밋 9f6a30d, main 머지 완료)
Phase 2b (RLS 활성화 준비)부터 이어서 진행.

Phase 2b 작업 범위:
- Supabase 모든 매장별 테이블 21개 RLS 활성화
- 1차 정책: USING (true) + WITH CHECK (store_id IS NOT NULL)
  (코드 레이어 필터가 이미 있으므로 점진적 강화)
- 실행 SQL + 롤백 SQL 작성
- 사장님 Supabase 콘솔(Dashboard → Authentication → Policies)에서 실행
- 실행 후 앱 골든패스 5가지 재테스트

반드시:
- CLAUDE.md 제11조 "대규모 변경 안전 절차" 6단계 따를 것
- 계획서 먼저 제출하고 승인 받은 후 SQL 실행 (제1조 1-1)
- DB 변경은 실행 SQL + 롤백 SQL 모두 제출 (제8조)
- RLS 활성화는 DB 변경 = 대형 + 승인 게이트 강화 (제4-3조)
```

### 남은 로드맵 (Phase 2b, 2c, 3~5)
- **Phase 2b (대형, DB/보안)**: RLS 활성화 — 사장님 Supabase 콘솔 실행 필요
- **Phase 2c (중형, 인프라)**: Cloudflare Worker 프록시 (anon key 서버측 보호)
- **Phase 3 (중형)**: loadDashboard 583줄 분할 (3485~4067행)
- **Phase 4 (중형)**: openAdd/Edit*Sheet 6곳 중복 → 제너릭화
- **Phase 5 (중형)**: 전역 가변 상태 20+개 → state.* 네임스페이스

---

## [2026-04-17] 코드 구조 개선 로드맵 Phase 0·1 — 인라인 핸들러 제거

### 상태: 구현완료 (배포 대기)
### 브랜치: claude/review-code-structure-scaDn

### 배경
전수 리뷰 결과 index.html이 3,400줄 → 7,535줄로 비대화. dev_lessons #1(CSP 인라인 핸들러 금지) 규칙이 있음에도 onclick 208개·onchange 28개가 방치돼 있어, CSP 강화 시 대규모 장애 위험. 6개 구조 개선 과제를 4단계 로드맵으로 분할.

### 로드맵 (4단계)
- **Phase 0 (소형)**: CLAUDE.md / plan.md / work_log.md 실제치 동기화 — 이번 세션
- **Phase 1 (중형)**: onclick 208·onchange 28 → data-action + 중앙 이벤트 위임 — 이번 세션
- **Phase 2 (대형)**: store_id 누락 감사 + RLS 준비 — 사장님 승인 후 별도 세션
- **Phase 3 (중형)**: loadDashboard 583줄 분할
- **Phase 4 (중형)**: openAdd/Edit*Sheet 제너릭화
- **Phase 5 (중형)**: 전역 상태 네임스페이스 state.*

### Phase 0 내용
- CLAUDE.md 제6조 라인수 "3400줄" → "약 7,500줄 (CSS 434 · HTML 1,461 · JS 5,629)"
- plan.md 최종 업데이트일 갱신
- 본 항목 추가

### Phase 1 내용
- 중앙 이벤트 위임 라우터 추가 (index.html 1961~2008행): `_parseActionArg` / `_dispatchAction`
- DOMContentLoaded 최상단에 click/change/input 3개 전역 리스너 등록
- 치환 결과: `onclick 211개 + onchange 25개 + oninput 15개 = 251개` 전부 data-* 속성으로 전환, **미변환 0건**
- 인라인 onclick → `data-action`, onchange → `data-change`, oninput → `data-input`
- 단순 호출: `foo('a',1)` → `foo|a|1`
- 복합 호출(다중 호출·JS 표현식) 14개는 래퍼 함수로 등록:
  `navFromSide`, `navHome`, `editEmpAfterClose`, `setGanttDay`, `setGanttAllDays`,
  `removeParent`, `openEditAttByIdx`, `saveVendorUploadGlobal`,
  `setFcAmount`, `setSpecialWageDate`, `setSpecialWageAmount`,
  `toggleRolePermEvt`, `toggleEmpPermEvt`, `resetCurrentEmpDevice`
- `event.stopPropagation()` 제거 — `closest('[data-action]')`가 innermost 자동 선택
- node --check 구문 검증 통과
- dev_lessons.md #1 해결 표시 + 현재 구조 설명 추가

### DB 변경
- 없음

### 다음 세션 시작 방법 (복붙용)
```
docs 전부 읽고 (CLAUDE.md 제11조 특히, business_rules.md, dev_lessons.md,
plan.md, db_schema.md, work_log.md 최상단 Phase 0·1 항목, services.md)
절대 무시·생략 없이 준수.

현재 브랜치: claude/review-code-structure-scaDn
마지막 커밋: Phase 1 인라인 핸들러 251개 제거 (커밋 912042b)
Phase 0·1 배포 확인 완료 가정하에,
Phase 2 (store_id 필터 누락 58곳 감사 + RLS 준비)부터 이어서 진행.

반드시:
- CLAUDE.md 제11조 "대규모 변경 안전 절차" 6단계 따를 것
- 계획서 먼저 제출하고 승인 받은 후 코드 수정 (제1조 1-1)
- DB 변경은 실행 SQL + 롤백 SQL 모두 제출 (제8조)
```

### 이번 세션에서 얻은 교훈 → 헌법·교훈 반영 완료
- CLAUDE.md 제11조 신설: "대규모 변경 안전 절차" (사전 스캔→백업→스크립트→3단 검증→기록)
- dev_lessons.md #27 신설: 일괄 치환 스크립트화 원칙
- dev_lessons.md #5 보강: 대규모 변경은 제11조 참조하도록 링크

### 남은 로드맵 (Phase 2~5, 별도 세션 진행)
- **Phase 2 (대형, 보안)**: store_id 누락 58곳 감사 + RLS 활성화 SQL + Cloudflare Worker 프록시 검토
  - 전제: 사장님 Supabase 콘솔 접근 필요
- **Phase 3 (중형)**: loadDashboard 583줄 분할 (3485~4067행)
- **Phase 4 (중형)**: openAdd/Edit*Sheet 6곳 중복 → 제너릭화
- **Phase 5 (중형)**: 전역 가변 상태 20+개 → state.* 네임스페이스

---

## [2026-04-17] 엑셀 분류 DB 범용화 + 직원 서류 + 영수증 학습 + 버그 수정

### 상태: 배포완료
### 브랜치: claude/review-excel-matching-axdTW → main

### 작업 내용
1. **엑셀 분류 규칙 DB 범용화**: BANK_RULES/CARD_RULES 하드코딩 → classification_rules(매장별 DB) + COMMON 공통 규칙 분리
2. **자동 학습**: 수동 분류 시 DB에 키워드 저장 → 다음부터 자동 매칭 (은행/카드/영수증 공통)
3. **CAT_NAME_MAP 완전 제거**: 하드코딩 카테고리 매핑 폐기 → DB expense_categories.name 직접 FK
4. **분류 변경 UI 개선**: 하드코딩 10개 칩 → DB 대분류>소분류 트리 표시
5. **카드매출 공통규칙 수정**: 매장전용 가맹점번호(741961 등) 제거, 카드사 약자만 유지
6. **직원 서류 관리**: 파일 첨부 방식 (Supabase Storage), 근로계약서/보건증/법대동의서/외국인등록증
7. **미성년자 자동 감지**: 주민번호 → 만 18세 미만 판단 → 법대동의서 배지
8. **외국인 비자 관리**: 비자 유형 드롭박스(E-9/E-7 등) + 만료일 + 상태별 배지 색상
9. **직원 카드 UI**: 3줄 구조 (이름+직급 / 전화번호 / 서류 배지 줄), 시급+입사일 5:5
10. **매장 IP 다중 등록**: WiFi 여러 대 지원 (+IP 추가/삭제 버튼)
11. **계좌 입금/출금 정렬 분리**: data-col="amount" 공유 → deposit/withdraw 분리
12. **거래내역 삭제 기능**: 월 일괄 삭제 + 건별 삭제 (✕ 버튼)
13. **지출 카테고리 독립 화면**: 설정에서 분리 → expcatCont 독립 컨테이너 + nav('expcat')
14. **카테고리 삭제 버튼**: 대분류에도 삭제 추가 + 소분류 연쇄 비활성화
15. **비활성 카테고리 집계**: 삭제해도 거래 있는 달엔 대시보드/정산에 표시
16. **사이드메뉴 정리**: 중복 네비게이션 제거, 그룹 구조 복원
17. **영수증 OCR 개선**: 해상도 800→1600, 품질 0.7→0.85, 프롬프트 전면 개편
18. **영수증 품목 학습**: 힌트 방식 폐기 → 규칙 덮어쓰기 방식 (AI 결과 → DB 규칙으로 확정 오버라이드)
19. **직원 편집 birth_date 버그 수정**: 주민번호 없으면 birth_date가 주민번호 칸에 들어가는 버그

### DB 변경
- classification_rules: 신규 테이블 (매장별 분류 규칙)
- employees: visa_type, visa_expires_at, doc_contract, doc_health_cert, doc_health_expires, doc_minor_consent, doc_foreigner_id 추가
- receipts: category_id FK 추가
- Supabase Storage: employee-docs 버킷 생성

### 기술 메모
- 분류 체계: 공통 규칙(코드) → 매장 DB 규칙 → 미분류 (3단계)
- 학습: learnClassification() — 값 변경 시 UPDATE, 신규 시 INSERT
- 비활성 카테고리: 대시보드/정산에서 해당 월 거래 있으면 포함
- 영수증 학습: AI 응답 → applyRulesToReceipt() → DB 규칙 덮어쓰기 → ✨마크

---

## [2026-04-16] 엑셀 분류 규칙 DB 범용화 + 자동 학습

### 상태: 구현완료
### 브랜치: claude/review-excel-matching-axdTW

### 작업 내용
1. **하드코딩 규칙 → 2단계 분류**: BANK_RULES/CARD_RULES 폐기 → COMMON_BANK_RULES(공통) + classification_rules(매장별 DB)
2. **공통 규칙**: 카드사 정산코드, 이체코드, 세금, 카드대금 → 코드 유지 (어떤 매장이든 동일)
3. **매장별 규칙**: 거래처, 가맹점, 고정비 등 → DB 테이블(classification_rules)로 이전
4. **자동 학습**: 수동 분류(리뷰 확인/분류변경) 시 키워드를 DB에 자동 저장 → 다음부터 자동 매칭
5. **시드 마이그레이션**: 퐁당샤브 기존 규칙 → 첫 업로드 시 자동 DB INSERT (seedDefaultRules)
6. **범용성**: 새 매장은 빈 규칙으로 시작 → 사용하면서 규칙 축적

### DB 변경
- classification_rules: 신규 테이블 (keyword, match_type, category, sub_category, priority 등)
- docs/db_schema.md 업데이트 완료

### 수익화 포인트
- 무료: 공통 규칙만 / 유료: 매장별 자동 학습 무제한

### 다음 TODO
- [ ] Supabase에서 CREATE TABLE SQL 실행 (사장님)
- [ ] 실제 엑셀 업로드 테스트

---

## [2026-04-16] 대시보드 전월대비 문구 추가 (클로브 스타일)

### 상태: 배포완료
### 브랜치: claude/review-docs-assessment-WDrDx → main

### 작업 내용
1. **월 요약 전월대비 문구**: 실수익 아래 "지난달보다 매출 120만(▲12%) 늘고, 지출 20만(▼3%) 줄었어요 👍" 자동 생성
2. **지출 아코디언 MoM**: 식자재+인건비 2개 항상 표시, "매출대비" 문구 포함, ⚠️/✅ 아이콘
3. **주별 카드 MoM**: 전월 동일주차 대비 매출/지출/식자재/인건비 4항목, 컴팩트 1줄
4. **색상 규칙**: 매출↑파랑/↓빨강, 지출↑빨강/↓파랑 (좋으면 파랑, 나쁘면 빨강)
5. **전월 데이터 병렬 조회**: Promise.all에 전월 매출/고정비/식자재/인건비/영수증 5개 쿼리 추가
6. **전월 주차 자동 생성**: 전월도 월~일 기준 주차 그룹핑하여 동일주차 비교

### DB 변경
- 없음 (SELECT만)

### 기술 메모
- 전월 데이터 없으면 문구 자체 안 보임 (기존 UI 100% 유지)
- ±2% 이내 변동은 "비슷" 처리
- momTxt 헬퍼 함수로 통일 (isRevType 파라미터로 색상 방향 제어)

### 다음 TODO
- [ ] 카드 엑셀 실제 업로드 테스트

---

## [2026-04-15] 대시보드 안정성 + UI 전면 개선

### 상태: 배포완료
### 브랜치: claude/review-docs-design-BjzwH → main

### 작업 내용
1. **CORS/502 쿼리 최적화**: getMydataAmount() N×2회 → 2회 단일쿼리. loadDashboard() 3개 순차 → Promise.all 병렬. 로열티도 병렬 합류
2. **디버그 console.log 제거**: 엑셀업로드 11개 삭제, console.error 9개 유지
3. **catNames 동적화**: 하드코딩 → expense_categories DB data_source 기반 동적 생성
4. **기준% DB 저장**: store_settings.expense_thresholds(jsonb), 1.5초 디바운스 자동 저장
5. **마감예상 카드 색상**: 매출 파랑, 지출 빨강, 순수익 조건색, 예비비 회색
6. **주카드 개선**: 전체 카테고리 표시(0원 포함) + 컬러도트 + 순수익 라벨 + 2열 그리드
7. **상세비교 모달**: 총누계 행(파란배경) + 주별 접기/펼치기(▶/▼) + 셀 높이 통일
8. **모바일 좌우 스크롤 방지**: html overflow-x:hidden + min-width 제거 + container overflow
9. **라벨 변경**: 일별정산→주단위 요약, 상세비교→일별 상세비교
10. **월정산 상세 → 지출 상세 아코디언**: 독립 카드 제거, 지출 라벨 옆 버튼 → 아코디언(도넛차트+카테고리 테이블)
11. **매출 상세 아코디언**: 매출 라벨 옆 버튼 → 도넛(카드/현금 비율) + 결제수단 테이블 + 일평균/영업일수
12. **월 요약 table 전환**: flex→table + tabular-nums, 마감예상도 동일 구조. 숫자 자릿수 완벽 정렬
13. **영업일수 수정**: receiptCount(입력일수) → passedDays(경과일) 기준으로 변경
14. **docs 수정**: plan.md "네이버 클로브"→"Clobe", dev_lessons #22 행열 정렬 규칙 추가

### DB 변경
- store_settings: expense_thresholds (jsonb, default '{}') 컬럼 추가 — 실행 완료

### 다음 TODO
- [ ] 카드 엑셀 실제 업로드 테스트

---

## [2026-04-15] 대시보드 재설계 + 예비비 관리

### 상태: 배포완료
### 브랜치: claude/redesign-dashboard-settlement-fGMHI → main

### 작업 내용
1. **대시보드 전면 재설계 (토스 스타일)**:
   - 월 요약: 매출/지출/순수익/예비비/실수익 + 매출대비 비율% + 마감예상 별도 블록
   - 일별 정산: 토스 카드형 (주차 카드 + 일별 카드), 카테고리 컬러도트+비율
   - 주차: 월~일 기준, 현재주만 펼침, 나머지 접힘
   - 일별 카드 터치 → 카테고리 상세 펼침
   - 월정산 상세: 토스 스타일 카테고리별 컬러도트+금액+비율%
   - 일별 차트: 매출 + 순이익 동시 표시
2. **상세 비교 풀스크린 모달**:
   - "상세 비교" 버튼 → 풀스크린 모달 (가로 자동 전환)
   - 날짜=행, 항목=열 (엑셀 방향)
   - 카테고리별 금액+비율%, 주계행 다크 배경
   - 데이터 없는 날도 전체 표시 (빈 날 '-')
   - 카테고리별 기준% 설정 바: 초과 빨강 / 적정 파랑 즉시 반영
3. **예비비 관리 화면** (사이드메뉴 > 현황 > 예비비):
   - 예비비 잔고 카드 (총적립/총사용/현재잔고)
   - 예비비 설정 (비율/고정액/초기잔고)
   - 예비비 사용 등록 (바텀시트) + 이력 리스트
4. **예비비 잔고 미니**: 월 요약 하단에 잔고 + 클릭→예비비 화면
5. **인라인 핸들러 제거**: 대시보드 버튼 전체 addEventListener 전환

### DB 변경
- store_settings: reserve_rate, reserve_fixed, reserve_initial_balance 컬럼 추가
- reserve_fund_logs: 신규 테이블 (예비비 적립/사용 이력)

### 다음 TODO
- [x] 일별정산 catNames를 expense_categories DB에서 동적 로드 → 2026-04-15 완료
- [x] 상세비교 기준% 값을 store_settings에 저장 → 2026-04-15 완료
- [x] Supabase mydata_transactions CORS/502 에러 — 병렬 쿼리 최적화 → 2026-04-15 완료

---

## [2026-04-14] 기기인증 + 정산수정 + 직원관리 + 카테고리 + UX개선

### 상태: 배포완료
### 브랜치: main

### 작업 내용
1. **기기 기반 출퇴근 인증**: Device Fingerprint, 최초 자동등록, 관리자 초기화
2. **근태 기록 수정/삭제**: 전체조회에서 터치→편집 시트
3. **내 기록 간트 개선**: 오늘상태카드 제거, 근무시간 표시, 출근만도 바 표시
4. **마감정산 일별카드**: undefined 수정 + 수정/삭제 기능
5. **탭 전환 초기화**: 스크롤·서브탭·입력폼 리셋
6. **급여 0원 방지**: 퇴근<출근 검증, 자정 퇴근 fallback, 이상 표시
7. **직원관리**: 주민번호(마스킹)/외국인등록번호, 신고구분(외국인만), 전화 바로걸기
8. **카테고리 2단계**: parent_id로 대분류→소분류 트리 구조
9. **홈화면 분리**: 관리자→대시보드, 직원→근태, 로고 클릭 홈 이동
10. **UX**: 시간 24h 통일, 횡스크롤 제거, 메뉴명 정리, 하단 지출리스트 제거

### DB 변경
- employees: device_fingerprint, id_number, is_foreign, report_status
- expense_categories: parent_id

---

## [2026-04-14] 기기 기반 출퇴근 인증 + 근태 수정 + 간트 개선

### 상태: 구현완료
### 브랜치: claude/device-based-attendance-n9GRH

### 작업 내용
1. **기기 지문(Device Fingerprint) 인증**: canvas+screen+UA 조합 해시로 기기 고유 식별
   - 최초 출근 시 자동 등록, 이후 불일치 시 차단 (관리자 우회 가능)
   - 직원 편집 시트에 "등록 기기 초기화" 버튼 추가
2. **근태 기록 수정/삭제**: 전체조회 테이블 행 터치 → 편집 시트
   - 출근/퇴근 시간 수정, 휴게시간 조정, 급여 자동 재계산
   - 기록 삭제 기능 (관리자만)
3. **내 기록 간트차트 개선**:
   - 오늘 근태 상태 카드 제거 (중복 정보)
   - 날짜 라벨에 근무시간 직접 표시 (예: 8h30m)
   - 출근만 찍어도 바 표시 (오늘=현재시간까지 파란색, 과거 퇴근누락=주황색 짧은바)

### DB 변경
- employees.device_fingerprint (text, nullable) 추가

---

## [2026-04-14] 권한 체계 재설계 + 로그인 보안 + UI 개선

### 상태: 배포완료
### 브랜치: main (claude/review-account-verification-XigL3 → main 머지)

### 작업 내용
1. **계좌이체 사람이름 자동 분류**: 적요(desc) 재시도 + 입금+한글이름 → 매출/송금결제
2. **BANK_RULES 패턴 확장**: 타행PC/FB자금/BZ뱅크 등 커버
3. **간식/중식 자동 분류 확장**: 메가커피, 스타벅스, 이디야, 식당, 치킨 등
4. **배지 겹침 수정**: 확인/제외/취소 동시 표시
5. **마감정산 날짜 선택**: 관리자만 과거 날짜 정산 추가/수정 가능
6. **근태 주간 간트차트**: 내 기록에 근무계획 스타일 간트 + 오늘 상태 카드 + 누락 경고
7. **권한 체계 재설계 (auth_level 4단계)**:
   - DB: franchises 테이블, stores.franchise_id, employees.auth_level
   - owner / franchise_admin / store_manager / staff
   - owner만 자동 로그인, 나머지 PIN 필수
8. **로그인 화면 재설계**: 직원 리스트 → 드롭박스+PIN 입력 방식, 개발모드 삭제
9. **직원관리 통합**: 3탭(직원/직급/권한) → 1탭, 편집 시트에서 권한 드롭박스 직접 설정
10. **직원 카드형 UI**: 토스 스타일, 시급/은행/입사일 분리
11. **직원 편집폼 라벨 추가 + 자동 하이픈** (전화번호, 날짜)
12. **PIN 필수 강제**: 미설정 시 저장/로그인 차단
13. **권한 보안**: 일반 직원은 편집/추가/권한변경/퇴사 버튼 숨김, 로그아웃 시 화면 초기화
14. **급여 집계**: 시급 컬럼 + 미산출 감지 + 재계산 기능
15. **초기 로딩 최적화**: 5개 API → 1개(employees)만 먼저, 나머지 백그라운드

### DB 변경
- franchises 테이블 신규
- stores.franchise_id 추가
- employees.auth_level 추가 (text, default 'staff')

---

## [2026-04-09] 카드 엑셀 업로드 버그 수정 + 거래내역 리스트 UI

### 상태: 배포완료
### 브랜치: claude/debug-card-upload-V4DBL

### 작업 내용
1. **카드 .xls 파싱 버그 수정**: 카드사 .xls 파일은 실제 HTML 테이블 → SheetJS가 요약만 읽는 문제 → DOMParser로 직접 파싱
2. **거래내역 테이블 UI**: 마이데이터 연결 빈 화면 제거 → 항상 테이블로 거래내역 표시
3. **컬럼 정렬**: 헤더 터치 → 오름/내림차순 토글
4. **필터 버튼**: 날짜 범위(date picker) + 분류(바텀시트 체크리스트) + 입금만/출금만
5. **적요 코드 분리**: 업로드 시 내용만 description 저장, 표시 시 적요 자동 제거
6. **분류 수정 기능**: 분류 셀 터치 → 카테고리 선택 → category + category_id FK 동기화
7. **테이블 압축**: 내용 6글자 + 말풍선 툴팁, 날짜 YY-MM-DD, 금액 nowrap
8. **합계 위치**: 테이블 아래 → 위로 이동 (스크롤 없이 확인)
9. docs/plan.md에 클로브(clobe.ai) UI 참조 추가

---

## [2026-04-09] 엑셀 업로드 수정 + 대시보드 연동

### 상태: 배포완료
### 브랜치: claude/fix-excel-upload-errors-dKfoz

### 작업 내용
1. Gemini AI 프록시 500 에러 → AI 제거, 컬럼 키워드 매칭으로 대체
2. Cloudflare CSP inline 핸들러 차단 → addEventListener 방식 전환 (→ dev_lessons.md #1)
3. DOMContentLoaded return 순서 버그 → bindFile을 return 위로 이동 (→ dev_lessons.md #2)
4. sheet-overlay 이중 구조 → openSheet/closeSheet 분기 처리 (→ dev_lessons.md #3)
5. category 이름 불일치 → CAT_NAME_MAP 매핑 추가 (→ business_rules.md #5)
6. mydata_transactions → 대시보드/지출대조 FK 연동
7. 가마감/진마감 토글 추가
8. 귀속월(attribution_month) 자동 추출
9. 매출 엑셀 업로드 추가 (마감정산 탭)

### 은행/카드 호환
- 은행 13개사, 카드 8개사 검증 완료 (→ plan.md #3)

---

## [2026-04-09] docs 전체 정리

### 상태: 완료

### 작업 내용
1. plan2.md → plan.md 이름 변경 + 전면 재작성 (excel-upload-plan 통합)
2. excel-upload-plan.md 삭제
3. services.md 신규 생성 (외부 URL/키/배포 정보 분리)
4. work_log.md 축소 (중복 제거 → dev_lessons/business_rules 참조)
5. dev_lessons.md 정리 (중복 제거)
6. db_schema.md 업데이트 (mydata_transactions, reconciliation, vendor_diffs 추가)
7. CLAUDE.md에 추가:
   - 새 세션 시작 시 필독 순서
   - docs 자동 기록 규칙 (모든 docs 파일 해당 이벤트 시 즉시 업데이트)

### 반성
- 사장님 지시사항(인건비 익월지급) 같은 변수를 코드 구현에 바로 반영하지 않았음
- docs 기록을 수동으로만 하다 보니 누락 발생 → 자동 기록 규칙으로 방지

---

### 다음 TODO
- [ ] 디버그 console.log 제거
- [ ] 카드 엑셀 실제 업로드 테스트
