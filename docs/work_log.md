# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

---

## [2026-05-20] 영수증·거래처 기록 표시 통일 (그룹 카드 + 미니 표)

### 상태: main 머지 완료
### 브랜치: `claude/standardize-transaction-display-nWMBf` → main

### 사장님 호소 (배경)
- 영수증 기록 / 거래처 기록 표시 패턴이 달라 통일감 없음
- 거래처 기록 = 평탄 7컬럼 표 → 같은 영수증/주문건 묶음 표시 안 됨
- 영수증 기록 = 그룹 카드는 있는데 한 행이 2줄 차지 (공간 낭비)
- 영수증 행에 단가·수량·총금액이 흐릿하게 표시 (조건부 회색 텍스트)

### 사장님 결정 (이번 세션 — 3차례 짚으심)
1. **거래처도 영수증 패턴(그룹 카드)으로 통일** + 같은 영수증 묶음 시각화
2. **영수증 행을 1줄 6컬럼 표로** (품목·분류·단가·수량·금액·›)
3. **금액은 우측 끝(회계 정석)** + **분류는 품목 옆**으로 순서 정정 (사장님이 CTO 초안 정정)
4. **메모 컬럼 제거** — 행에선 💬 인디케이터, 입력시트에서만 (DB 보존)

### 갈아엎기 (헌법 1-6 정당)
- 영수증 행 = "2줄 디브" → 1줄 미니 표 (`.order-tbl` 재사용)
- 거래처 주문 = "평탄 7컬럼 표" → 그룹 카드(vendor_id+order_date) + 5컬럼 미니 표
- 두 화면 같은 `.order-tbl` 클래스 → 통일감 + CSS 줄임

### 작업 내역 (index.html, +99/-58 = 합 +41 라인)
**CSS 추가** (line 562 부근):
- `.ord-cat` — 분류 컬럼 (영수증 전용, 좌측 정렬 10px gray-600)
- `.order-tbl tr.ord-row.suspect td{background:#FEF9C3}` — _suspect 의심행 노랑
- `.order-tbl tr.ord-row.err td{opacity:.55;text-decoration:line-through}` — 오답행

**`renderReceiptList` (5409~)** — 그룹 카드 내부 본문 갈아엎기:
- 옛: forEach div 본문 (2줄: 품목+금액 / 🏷분류·단가×수량)
- 새: `<table class="order-tbl">` 미니 표
- 컬럼: 품목(가변) / 분류(56) / 단가(54) / 수량(38) / 금액(64) / ›(22)
- 분류 표시: 풀라벨 "식자재>채소" → 소분류만 "채소" (title hover로 풀 확인)
- 행 클래스: `ord-row` + (오답=`err`) + (의심=`suspect`)
- 행 탭 → `openReceiptEdit|${r.id}` (기존 함수 재사용)

**`loadVendorOrders` (9726~)** — 평탄 표를 그룹 카드로 갈아엎기:
- 그룹 키: `(vendor_id||'-')+'|'+(order_date||'-')` — DB 변경 X
- 그룹 헤더: 🧾 거래처 · 날짜 · 합계 (또는 📅 날짜 — 단일 거래처 필터 시)
- 내부 표 5컬럼: 품목(가변) / 단가(54) / 수량(38) / 금액(64) / ›(22)
- 메모 있는 행 = 품목명 옆 ` 💬` 인디케이터 + title에 메모 표시
- 행 탭 → `openEditOrderSheet|${r.id}` (기존 함수 재사용)

### DB 변경
**없음** — AI 프롬프트(단가·수량 추출)도 5/19 작업 그대로

### 검증
- node --check 통과 (~645K chars JS, 1 block, 에러 0)
- 함수 정의 모두 존재 (`openReceiptEdit`, `openEditOrderSheet`)
- 옛 영수증(receipt_group_id NULL) 1행 그룹 호환 그대로 (`_groupReceipts` 옛 로직 보존)
- 메모 입력시트 / DB 컬럼 그대로 (memo 데이터 손실 X)

### 사장님 검증 시나리오
1. `https://pongdang-shabu.pages.dev` 진입 → 영수증 → 📋 기록 내역 → 6컬럼 미니 표 확인
2. 사이드메뉴 → 거래처 → 거래처 카드 진입 → 주문 기록 = 그룹 카드 + 5컬럼 표 + 💬 (메모 있는 행)
3. 모바일 360px에서 잘림 없는지
4. 영수증 행 탭 / 거래처 주문 행 탭 → 편집시트 정상 진입

### 다음 페이즈 (todo_next_session.md 합의 그대로)
- 외부 매장 권유 준비 / 공과금 미납 알림 / 거래처 차액 추적 등

---

## [2026-05-20] 관리자 대시보드 1차+2차+3차 완료 (#admin) — AI 비용·차트·CSV·DB·에러·학습규칙

### 상태: 1차/2차/3차 모두 구현 + UX 강화 완료, main 머지
### 브랜치: `claude/admin-dashboard-HDLZM` → main
### 미리보기: `claude-admin-dashboard-hdlzm.pongdang-shabu.pages.dev`
### 운영: `pongdang-shabu.pages.dev/#admin` (PIN 1260)

### 진행 흐름 (한 세션, 커밋 8개)
1. **호칭 정정** — Claude가 "사장님(=김은성=어플 주인)"과 "owner(=이송은=매장 사용자)" 두 사람을 한 덩어리로 묶는 사고 발생 → docs 정정 + dev_lessons #96 신설
2. **1차+2차 핵심 구현** (+549 라인) — adminOverlay HTML + JS 함수 17개 + B안 자동 학습 정리
3. **docs 업데이트** — work_log/todo/plan
4. **UX 강화** — "얼마나 썼는지" 메인 카드(30px) + 누적 카드 + 학습 규칙 안내 박스
5. **일/월 토글 + 날짜 네비** — ◀▶ + "오늘로" + 시점 기준 SQL 분기 + 데이트피커 (사장님 추가 요청)
6. **모델 분포 슬라이스 3→6** — 사장님 짚음 "Gemini·GPT 다 보여야"
7. **3차 완료** — Chart.js 일별/시간별 추이 + CSV 다운로드 + DB 사용량 + 에러 로그
8. **main 머지**

### 사장님 결정 (이번 세션)
1. **범위**: 1차+2차 핵심 → UX 강화 → 일/월 네비 → 모델 분포 확장 → 3차 (한 세션 다 마무리)
2. **진입**: 해시 라우팅 `#admin` + PIN 4자리 `1260`
3. **B안 자동 학습 정리**: 박기 (영수증 삭제 시 고아 학습 노트 자동 청소)
4. **권한**: 김은성(어플 주인) 본인만. owner 게이트가 아닌 PIN 단독
5. **매장 그룹핑**: 가입 유형 대분류·소분류 (🏯프랜차이즈 / 🏢다매장 / 🏪개인사업자)
6. **시점 토글**: 일별/월별 + 데이트피커 + ◀▶ + "오늘로"
7. **모델 분포**: 상위 6개 표시 (+나머지 카운트)
8. **3차 항목**: Chart, CSV, DB 사용량, 에러 로그 다 박음

### docs 정정 — 헌법 1-7 추측 금지 일관 (사장님 분노 호소)
> "나는 김은성, 어플 개발자+주인. 이송은은 논산점 사장이고 어플 사용자일 뿐. 이 개념이 아직도 안 잡혀있네... 어딘가에 이상하게 적혀있다는 뜻이겠지"

- `business_rules.md` #7 — 두 사람 5열 표(역할/테이블/게이트/권한) 명문화 + 절대 금지 4종
- `dev_lessons.md` #96 신설 — 김은성(어플 주인) vs 이송은(매장 owner) 절대 분리

### 작업 내역 총합 (index.html, +900 라인 이상)
**HTML**: adminOverlay (풀스크린 + PIN 패널 + 대시보드 패널 + 서브탭 + 모드 토글 + 날짜 네비 + 데이트피커 + 메인 카드 + 그리드 카드 + 차트 카드 + 누적·DB·에러·매장별·시뮬·학습규칙 카드 + 안내 박스) / learningRuleEditSheet

**JS 함수 27개**:
- 권한·진입: `_sha256`, `initAdminMode`, `openAdminOverlay`, `closeAdminOverlay`, `submitAdminPin`
- 시점 네비: `_getAdminViewRange`, `_getAdminCompareRange`, `_isAdminViewCurrent`, `setAdminViewMode`, `moveAdminView`, `goAdminToToday`, `onAdminDateInput`, `_syncAdminDateInput`
- 카드 렌더: `renderAdminMainCard`, `renderAdminCumCard`, `renderAdminAiCards`, `renderAdminByStoreTable`, `_renderAdminStoreRow`
- 3차: `renderAdminChart`, `renderAdminErrors`, `loadAdminDbUsage`, `downloadAdminCsv`
- 시뮬: `updateAdminSim`
- 학습 규칙: `loadAdminLearningRules`, `renderLearningRulesTable`, `filterAdminRules`, `openLearningRuleEditSheet`, `saveLearningRule`, `deleteLearningRule`, `toggleAdminRulesHelp`
- B안: `cleanupOrphanRulesByItems`
- 진입: `switchAdminTab`, `loadAdminDashboard`

**수정 함수 1개**: `deleteReceiptGroup` — B안 hook 호출 + 정리 결과 토스트

**이벤트 리스너 2개**: `window.hashchange` + `adminPinInput` keydown (Enter=확인)

### PIN 처리
- `ADMIN_PIN_HASH` = SHA-256("1260") = `9c19f29d0e6fefa21eec58f6ff4d0cf807b63d0ed146f1fea0874506b66c35ee`
- 코드 검색해도 PIN 원문 안 보임
- 변경 시: `echo -n "<새PIN>" | sha256sum`으로 재계산 후 상수 박음
- 3회 실패 = 60초 잠금 (브루트포스 방어)

### DB 변경
**없음** — 기존 테이블만 SELECT/DELETE/UPDATE (`ai_usage_logs`, `classification_rules`, `stores`, `franchises`, `receipts`)

### Supabase 실측 데이터 (사장님 매장 모델 분포)
| 모델 | 호출 | 비용 | 실패 |
|---|---|---|---|
| gemini-2.5-flash | 19 | 50.01원 | 9 |
| gemini-2.5-flash-lite | 4 | 1.92원 | 0 |
| gemini-2.0-flash-lite | 2 | 0.69원 | 1 |
| gpt-4o-mini | 1 | 7.82원 | 0 |
| clova+gpt-4o-mini | 1 | 7.97원 | 0 |
| clova+gpt-4o | 1 | 30.52원 | 0 |

→ GPT-4o vision fallback 실제 발동 0건 (Gemini가 한 번도 안 망함). gpt-4o-mini·clova는 5/19 PR #173·#174 Multi-Provider 테스트 잔재.

### 검증
- node --check 통과 (~628,000 chars JS, 5 blocks)
- 새 함수 27개 + 변수 9개 중복 0건
- 기존 `deleteReceiptGroup` 흐름 보호 (try/catch — B안 실패해도 영수증 삭제는 성공)
- 미리보기 DB = 운영 DB 동일 (services.md 정책 일관)

### 한계 (다음 페이즈 후보)
- [ ] PIN 6~8자리 강화 (외부 매장 권유 직전)
- [ ] RLS 정책 강화 (현재 `USING(true)` → 매장 격리 엄격화)
- [ ] 매장 활동 모니터 (이탈 매장 조기 발견 — freemium 도입 후)
- [ ] 가격·결제 가맹 (Phase 1-D Freemium)

### 사장님 검증 시나리오
1. `https://pongdang-shabu.pages.dev/#admin` → PIN `1260` → 통과
2. [📅 일별]/[📆 월별] 토글 + ◀▶ + 데이트피커 동작
3. 메인 카드 "이번달 사용액" 큰 글씨 + 트렌드(▲▼) + 일평균/지난달 비교
4. 카드 4종 (오늘/모델분포 6개+/실패율7일/평균응답)
5. 📈 Chart.js 차트 (일별=시간별, 월별=일별 막대+라인)
6. 📚 누적 / 💾 DB 사용량 / 🐞 에러 로그 / 📋 매장별 그룹핑 / 💡 시뮬
7. 📥 헤더 버튼 → CSV 다운로드
8. 🧠 학습 규칙 탭 — 안내 박스(▾) + 6열 표 + 검색 + 행 탭→편집 시트
9. PIN 3회 실패 → 60초 잠금

---

## [2026-05-20 옛 항목 보존] 관리자 대시보드 초기 진행 (1차+2차 핵심) — 통합됨

### 사장님 결정 (이번 세션)
1. **범위**: 1차+2차 핵심만 (차트·CSV·매장활동·DB사용량은 다음 세션)
2. **진입**: 해시 라우팅 `#admin` + PIN
3. **B안 자동 학습 정리**: 박기
4. **권한**: **김은성(어플 주인) 본인만**. owner 권한 아님 — owner는 매장 단위 권한, 시스템 권한 아님 (사장님 정정 명시)
5. **PIN**: 4자리 `1260` (외부 매장 권유 직전 6~8자리로 강화 예정)
6. **매장 그룹핑**: 가입 유형 대분류·소분류 (🏯프랜차이즈 / 🏢다매장 / 🏪개인사업자)

### 사장님 결정적 짚음 (헌법 1-7, 3-1 일관)
> "나는 김은성, 어플 개발자+주인. 이송은은 논산점 사장이고 어플 사용자일 뿐. 이 개념이 아직도 안 잡혀있네... 어딘가에 이상하게 적혀있다는 뜻이겠지"

CTO가 옛 docs의 "사용자=김은성" 잔재(2026-05-05 1차 정정 시점 표현) 그대로 읽고 "사장님=owner=이송은" 한 덩어리로 묶음 → admin 게이트를 `auth_level==='owner'` + 이송은 PIN으로 설계 → 정반대 잘못. 김은성은 employees에 row 없어서 PIN 자체도 없는데.

### docs 정정 (이번 세션 1차 작업)
- `business_rules.md` #7 — 두 사람 5열 표(역할/테이블/게이트/권한) 명문화 + 절대 금지 4종
- `dev_lessons.md` #96 신설 — 김은성(어플 주인) vs 이송은(매장 owner) 절대 분리. 재발 시 자동 차단

### 작업 내역 (index.html, +549 라인)
- **HTML**: `adminOverlay` (풀스크린 + PIN 패널 + 대시보드 패널 + 서브탭) / `learningRuleEditSheet`
- **JS 함수 17개**:
  - `_sha256(str)` — Web Crypto API SHA-256
  - `initAdminMode()` / `openAdminOverlay()` / `closeAdminOverlay()` — hash 감지 + 진입/이탈
  - `submitAdminPin()` — PIN 검증 (3회 실패 60초 잠금)
  - `switchAdminTab(tab)` — AI/Rules 서브탭 토글
  - `loadAdminDashboard()` — Promise.all 4쿼리 병렬 (오늘/이번달/7일/이번달 매장별)
  - `renderAdminAiCards(stats)` — 카드 5개 그리드 (2열 minmax(0,1fr))
  - `renderAdminByStoreTable(rows)` — 가입 유형 그룹핑 (🏯/🏢/🏪)
  - `_renderAdminStoreRow(s)` — 매장 한 행
  - `updateAdminSim(range)` — 시뮬 슬라이더 (월 비용 추정)
  - `loadAdminLearningRules()` — classification_rules + receipts join으로 적용 영수증 수 계산
  - `renderLearningRulesTable(rules)` — 5열 표 (매장/키워드/분류/표시명/적용수)
  - `filterAdminRules(input)` — 검색 필터
  - `openLearningRuleEditSheet(id)` / `saveLearningRule()` / `deleteLearningRule()` — CRUD
  - `cleanupOrphanRulesByItems(items)` — B안 hook
- **수정 함수 1개**: `deleteReceiptGroup()` — 삭제 후 `cleanupOrphanRulesByItems` 호출, 토스트 메시지에 정리 결과 추가
- **이벤트 리스너 2개**: `window.hashchange` (DOMContentLoaded 안) + `adminPinInput` keydown (Enter=확인)
- **초기 진입**: DOMContentLoaded에서 `initAdminMode()` 호출 (즐겨찾기 #admin 진입 즉시 처리)

### PIN 처리
- `ADMIN_PIN_HASH` 상수 = SHA-256("1260") = `9c19f29d0e6fefa21eec58f6ff4d0cf807b63d0ed146f1fea0874506b66c35ee`
- 코드 검색해도 PIN 원문 안 보임
- 변경 시: `echo -n "<새PIN>" | sha256sum`으로 재계산 후 상수 박음

### B안 자동 학습 정리 로직
1. `deleteReceiptGroup` 진입 시 삭제 대상 행의 `item` 추출
2. `normalizeItemKeyword`로 각 item 정규화 → 키워드 set
3. 각 키워드별 같은 매장 classification_rules 존재 확인
4. 존재하면 같은 매장 다른 영수증에 키워드 포함 여부 확인 (`ilike %kw%`)
5. 0건이면 classification_rules도 DELETE
6. 토스트에 정리 결과 추가 ("학습 노트 N개도 같이 정리됨")

### DB 변경
**없음** — 기존 테이블만 SELECT/DELETE/UPDATE (`ai_usage_logs`, `classification_rules`, `stores`, `franchises`, `receipts`)

### 검증
- node --check 통과 (627,025 chars JS, 5 blocks)
- 새 함수 17개 + 변수 7개 중복 0건
- 기존 `deleteReceiptGroup` 흐름 보호 (try/catch로 B안 실패해도 영수증 삭제는 성공 처리)

### 한계 (다음 세션 후속)
- [ ] Chart.js 일별 비용 추이 (3차)
- [ ] CSV 다운로드 (3차, profit_advisor 검증 가능성 충족)
- [ ] 기간 필터 (오늘/이번주/이번달/지난달/사용자지정)
- [ ] 매장 활동 모니터 (이탈 매장 조기 발견)
- [ ] Supabase DB 사용량 (무료 한도 추적)
- [ ] 에러 로그 모음
- [ ] PIN 보안 강화 (외부 매장 권유 직전 6~8자리)
- [ ] RLS 정책 강화 (현재 USING(true) → owner별 매장 격리, 어플 주인 service_role)

### 사장님 검증 시나리오
1. `https://pongdang-shabu.pages.dev/#admin` 진입
2. PIN `1260` 입력 → 통과
3. 📊 AI 비용 탭 — 카드 5개·매장별 표·시뮬 슬라이더 정상
4. 🧠 학습 규칙 탭 — 목록 표시, 검색 동작, 행 탭→편집 시트 동작
5. 학습 규칙 편집·저장·삭제 동작
6. (선택) 영수증 1개 삭제 후 토스트에 "학습 노트도 정리됨" 표시 확인 (B안)
7. PIN 잘못 3회 입력 시 60초 잠금 확인

---

## [2026-05-19 (4)++] 영수증 AI 사장님 검증 통과 — 16/16 정확 + 4.0원

### 상태: 사장님 검증 ✅ 완료
### 사장님 보고
> "틀린것 하나도 없음, 정확해서 토스트없고 행노란배경 이모지 확인못함, 비용 약4.0으로 뜸"

### 비용·정확도 변천 (이번 세션)
| 시점 | 모델·설정 | 정확도 | 비용 | 변화 |
|---|---|---|---|---|
| 옛 (PR #174) | clova+gpt-4o Hybrid | 62.5% (10/16) | 30.5원 | 기준선 |
| D안 직후 (OCR 제거) | gemini-2.5-flash | ~94% | 5.52원 | -82% |
| 다이어트 + 1280px | gemini-2.5-flash + 1280 | 87.5% (14/16) | 4.92원 | BOX 0 사고 발견 |
| **BOX 0 보강 + d/v 최상위** | **gemini-2.5-flash + 1280 + 출력 다이어트** | **100% (16/16)** | **4.0원** | **-87% (최종)** |

### 사장님 호소 vs 해결
| 호소 | 원인 | 해결 |
|---|---|---|
| 비용 비싸 | clova+gpt-4o-full | gemini-2.5-flash + 다이어트 + 1280px |
| 116,000 vs 115,999 | "p=계산값" 박힘 | "p=영수증 인쇄값 그대로" 박음 |
| BOX/EA 사고 (2/11행) | 다이어트 시 BOX 0 예시 빠짐 | BOX 0 4개 예시 + ⚠️ 강조 |
| 임계값 5% 느슨 | 임의 % | max(100원, 0.5%) 회계 기준 |
| 2페이지 영수증 인지 X | Page(N/M) 감지 X | page_info: {current, total} + 안내 박스 |
| OCR 정확도 떨어짐 | Clova OCR 행 시프트 | OCR 회로 완전 제거, AI 단독 |
| high demand 사용 불가 | Gemini 부하 | callGemini 백오프 3회 + GPT-4o vision fallback |

### 검증 (사장님 실측)
- ai_usage_logs 측정: gemini-2.5-flash, in 883 tok, out 1,300 tok, 4.92원 (다이어트 직후)
- 출력 d/v 다이어트 후: **약 4.0원** (사장님 토스트 확인)
- 16행 모두 단가·수량·금액 정확 = **AI 행 분석 100%**
- 의심행 시각화 = 사고 없어서 발동 X (정상 동작)

### 외부 매장 50개 수익성
- 거래처 5건/일 × 50매장 × 30일 × 4.0원 = **30,000원/월 AI 비용**
- 매출 1.5만원 × 50매장 = 75만원/월
- AI 비용 비중 = 4% (손익분기 충분)

### 다음 세션 후속
- [ ] 2페이지 영수증 실측 (오늘 1장 없어서 미검증, 다음 영수증 도래 시)
- [ ] high demand fallback 발동 빈도 측정 (ai_usage_logs.model='gpt-4o' 누적)
- [ ] 직구 영수증 정확도 측정 (사장님 다음 마트·배민 영수증)
- [ ] 관리자 대시보드 (사장님 결정 대기 — todo_next_session 박힘)

---

## [2026-05-19 (4)+] 영수증 AI 통합 개선 — 다이어트 + p=인쇄값 + Multi-page + 임계값

### 상태: 구현완료 (사장님 실측 검증 대기)
### 브랜치: `claude/improve-receipt-ai-analysis-CNmn2`
### 트리거: 사장님 영수증(순창국제 거래명세서) 분석 결과 호소 "정확도 부족" → critic 결과 = AI 행 분석 100% 정확. 진짜 원인 = ① 영수증 "Page (1/2)" 누락 ② AI가 "총합계(외상포함)" 박스 박음 ③ 임계값 5% 너무 느슨 (회계 기준)

### 사장님 결정
1. OCR 돌아가지 X (Gemini 단독 유지)
2. Multi-page UI 신설 (사진 수 제한 X)
3. 모델 자체 안 바꿈 (정확도 위험). 프롬프트 다이어트로 비용 ↓
4. 해상도 1600 → 1280 다운사이즈 (Clova OCR 때문에 1600 올렸음. AI vision은 768 tile 단위라 영향 작음)
5. u×q=p 검증 그대로 유지 (비용 0원 클라 JS, 안전망)
6. 임계값 5% → max(100원, 0.5%) (회계 기준 5% 너무 느슨)
7. "p = 영수증 인쇄값 그대로" 프롬프트 박음 (116,000 vs 115,999 사장님 호소 ② catch)

### 작업 내역 (index.html)
- 전역 `b64` (단일) → `b64Pages` (배열) 전환
- HTML: 멀티페이지 썸네일 영역 (`#rcpPagesArea` 가로 스크롤 + ✕ 삭제) + 페이지 감지 박스 (`#rcpPageInfoBox`)
- 신설 함수: `_renderRcpPages()`, `removeRcpPage(idx)`, `_updateRcpActionLabel()`
- 수정 함수: `handleImg` (1280px + append + 마지막 사진 미리보기), `rcpRePickImage` (전체 초기화), `resetRcpMode` / `manualReceipt` (b64Pages 초기화), `_renderRcpSumCheck` (pageInfo + photoCount 처리, ⏳/✅ 표시), `runAI` (multi-image parts + 프롬프트 다이어트 + page_info 응답 + 임계값 갱신 + 토스트 페이지 표시)
- 프롬프트 변경:
  - 11개 규칙 → 핵심 4줄로 통합 (입력 토큰 ~30% ↓)
  - `p = 영수증 [합계] 컬럼 인쇄값 그대로` 명시 (회계 증빙 우선)
  - `total_sum` 우선순위 정정: 금일합계 > 합계액 > 결제금액 (전미수/총합계/잔액 무시)
  - `page_info: {current, total}` 응답 추가
  - `multiPageHint` 동적 추가 (사진 N장 = 같은 영수증 통합 분석)
  - 예시 = 사장님 실제 영수증 케이스 (집게피쉬볼 115,999 vs 116,000)

### DB 변경
없음

### 비용 예상 (다이어트 30% + 해상도 20% = ~40% 절감)
| 시나리오 | 새 비용 | 옛 비용 |
|---|---|---|
| 거래처 1장 | ~3~4원 | ~6원 |
| 거래처 2장 (2페이지) | ~5~6원 | — |
| 거래처 3장 | ~8~9원 | — |
| 직구 1장 | ~0.5원 | ~1원 |
| Fallback 발동 | +5~8원 추가 | — |

### High Demand 처리
- callGemini 내부 3회 백오프 재시도 (1s/2s/4s)
- 다 실패 → GPT-4o vision 자동 fallback 1회 (timeoutSec+15초)
- 사용자 측 실패율 0%에 가까움 (Gemini OR GPT-4o 둘 중 응답)
- 빈도 = ai_usage_logs로 다음 세션에 측정

### 검증
- node --check 통과 (604,308자 JS)
- 단일 b64 변수 잔재 0건 (b64Pages·b64Part로 통일)
- DB 변경 없음

### 다음 세션 확인
- 사장님 실측: 1페이지 영수증 / 2페이지 영수증 / 직구 영수증 각 1장씩
- ai_usage_logs로 실제 토큰·비용·정확도 측정
- 1280px 다운사이즈 정확도 영향 확인 (작은 글씨 식별)
- Page (N/M) 감지 false negative 비율
- GPT-4o vision 단독 fallback 정확도 (high demand 발동 시)

---

## [2026-05-19 (4)] 영수증 AI 분석 — OCR 제거 + Gemini 단독 + GPT-4o vision fallback

### 상태: 구현완료 (사장님 실측 검증 대기)
### 브랜치: `claude/improve-receipt-ai-analysis-CNmn2`
### 트리거: 사장님 "ai만 쓰는게 낫다. clova ocr 썻음에도 정확도가 떨어졌었고, 굳이 ocr 쓸 필요가 없다"

### 사장님 가설 + critic 검증
- 사장님 주장: OCR 빼고 AI 단독 가자
- 검증: work_log 6단계 표가 명백히 정당화
  - AI 단독(1·2·3차) = 80~95% (3차 best)
  - OCR+AI Hybrid(4·6차) = 6%·62.5% (행 시프트 사고)
- → CTO 동의. D안(3차 best 회귀 + AI fallback) 채택.

### 작업 내용 (index.html)
- `runAI()` (4670~) provider 분기 단순화:
  - 변경 전: 거래처 `'clova+gpt'` / 직구 `'gpt'` (둘 다 OCR 거침)
  - 변경 후: 모두 `provider='gemini'` 메인
    - 거래처 모드 = `gemini-2.5-flash`
    - 직구·POS 모드 = `gemini-2.5-flash-lite`
- High demand·과부하·빈응답·JSON 실패 → `gpt-4o` vision 단독 fallback 1회 (OCR 거치지 않음)
- 토스트: `🔄 GPT-4o 백업` 프리픽스로 fallback 발동 가시화
- 프롬프트(BOX/EA, total_sum 박스) 한 글자도 안 건드림 → 3차 best 정확도 유지

### 검증
- node --check 통과 (600,454자 JS)
- 호출 측 `'clova+gpt'` 잔재 0건 (callGemini 함수 내부 호환성용만 잔존, 호출 X)
- DB 변경 없음

### 비용·정확도 기대
| 시나리오 | 모델 | 비용 | 정확도 |
|---|---|---|---|
| 거래처 (메인) | gemini-2.5-flash | ~6원 | ~95%+ |
| 직구·POS (메인) | gemini-2.5-flash-lite | ~1원 | ~80~90% |
| Fallback 발동 시 | gpt-4o vision | ~6~10원 | 미검증 |

### 다음 세션 확인
- Worker `_provider='gemini'` 응답에 `_modelUsed`·`_costWon` 박는지 ai_usage_logs로 확인
- GPT-4o vision 단독 정확도 (fallback 발동 시 추적)
- 사장님 실측 정확도 표본 (거래명세서 + 직구 영수증 각 1장)

---

## [2026-05-19] 대규모 세션 — 4단계 작업 (PR #152~#174, 23개 PR)

### 상태: 진행 중 마무리 (사장님 결정 대기: 거래명세서 정확도 GPT 2단계 검증 OR Clova Document)
### 브랜치: `claude/fix-category-grid-alignment-KTIth`
### 트리거: 사장님 "지출카테고리 그리드 줄 틀어짐"으로 시작 → 영수증 OCR 정확도까지 확장

### Phase 1: 지출 카테고리 그리드 + 거래채널 통일 (PR #152~#155, #158)
- 거래채널 vs 지출카테고리 카드 폭 일치
- `.hub-grid` 기본값 `repeat(3,1fr)` → `#expHubCatGrid`에 `repeat(2,minmax(0,1fr))` override
- 거래채널도 grid로 통일 (flex→grid)
- 폭 미세 차이 원인: `1fr` 단독 = min-content 영향 받음 → `minmax(0,1fr)` 표준
- column 2줄 레이아웃 (사장님 "식자재가 식...이 맞아?" 호소 반영)
- ✨ 학습 시그널 뱃지 강화 (12→14px) + 페이드인 애니메이션
- 스켈레톤 우선 패턴 (진입 즉시 외곽 + 비동기 숫자)
- 상단 [+ 새 영수증 등록] 중복 버튼 제거 (사장님 짚음)

### Phase 2: 영수증 그룹핑 + 단가/수량 + 학습 (PR #157, #159, #160, #161, #164, #165)
- **DB 변경 3건**:
  - `receipts.receipt_group_id` UUID 신설 (영수증 사진 1장 그룹)
  - `receipts.unit_price` INT, `qty` NUMERIC(10,2) 부활 (가격 추세 분석 기반)
  - `classification_rules.display_item` TEXT (품목 표시명 학습)
  - 인덱스 3개
- 그룹 카드 + 그룹 편집 시트(receiptGroupEditSheet) 신설
- 거래처 모드 vendor 컬럼 숨김 + 상단 노란 배지
- 거래처 주문 수동 입력과 컬럼 통일 (단가/수량/금액)
- BOX/EA 시스템 프롬프트 강화
- 합계 검증 토스트 (u × q ≠ p 차이 5% 이상)
- 학습 흐름: AI 원본(`data-orig-item`) → 사용자 정정 → `display_item` 학습 → 다음 OCR 자동 교체
- 영수증 저장 후 in-page 기록내역 자동 이동 (location.reload 제거)
- 취소·초기화 PWA 재실행 버그 (resetReceipt → in-page) + 업로드 2회 안 됨 + [📷 다시] 버튼
- 셀렉터 버그: `#resTable th.col-vendor` 매칭 실패 (tbody id) → `.col-vendor` 클래스 단독으로
- 컬럼 min-width 명시 (잘림 차단): c-v 64 / c-i 110 / c-u 62 / c-q 44 / c-p 78

### Phase 3: AI 비용 다이어트 + 토큰 토스트 + 모델 교체 (PR #162, #163, #166, #167)
- **DB 변경 1건**: `ai_usage_logs` 테이블 신설
  - store_id, feature, model, prompt/output/thinking_tokens, total, estimated_cost_won, duration_ms, success, error_msg
  - 인덱스 2개
- callGemini 함수 4번째 인자 (feature) + 5번째 인자 (model) + 6번째 인자 (provider)
- `_calcGeminiCostWon()`, `_GEMINI_PRICING` 6개 모델 가격표
- 분석 후 토스트: "✨ 분석 완료 (Clova+GPT-4o, 8.3초) / 토큰: ... / 💰 약 N원"
- thinking 다이어트: gemini-2.5-flash 기본 ON → Worker `thinkingBudget:0` (5~10배 절감)
- 모델 교체 시도:
  - gemini-2.5-flash → gemini-2.0-flash-lite (실패: 신규 사용자 차단됨)
  - → gemini-2.5-flash-lite (정착, 1.1원/회)
- 동적 모델: 거래처 = flash / 직구·POS = flash-lite
- 비용 토스트 헷갈림 (1.3731원을 13,731원으로 오인) → 포맷 분기 + 6초 노출

### Phase 4: Multi-Provider (Clova OCR + GPT) (PR #169, #173, #174)
- **사장님 결정**: B안 동적 모델 + Multi-Provider (Naver Clova OCR + OpenAI GPT)
- 트리거: Gemini high demand 누적 = "상용화 불가능 신뢰도"
- 동종 앱 분석: 캐시노트·자비스 등도 OCR 보조 위치, 마이데이터 메인
- **사장님 가입 완료**:
  - Naver Cloud Platform + Clova OCR Domain (`cashflow-receipt`)
  - OpenAI Platform + 결제 + API key
- Worker 코드 진화:
  - v1: Gemini 단독
  - v2: 동적 모델 (gemini flash / lite)
  - v3: Clova+GPT 도입
  - v4: 디버그 강화 (error_msg에 응답 본문 포함)
  - v5: GPT-4o full + 이미지 Hybrid + boundingPoly 정밀 그룹핑
- Worker 환경변수: CLOVA_URL, CLOVA_SECRET, OPENAI_KEY (+ 기존 GEM_ES_KEY)
- 분기: `body._provider` (`clova+gpt` / `gpt` / `gemini`)
- Clova OCR 1002 인증 거부 troubleshoot (사장님과 1시간):
  - 1차: URL 잘못 박힘 (수동 연동 URL 사용)
  - 2차: `/general` 누락
  - 3차: VPC 환경 의심
  - 4차: Premium 플랜 의심
  - **최종 원인**: 수동 연동 URL은 외부 호출 차단 → **API Gateway 자동 연동** 필요 (Naver 공식 가이드 확인)
  - 사장님이 자동 연동 후 새 Invoke URL (`apigw.ntruss.com/...`) + Secret Key 받아 갱신 → 동작 시작
- GPT 진행 정확도:
  - GPT-mini Hybrid: 6% (1/16 정확, 행 매핑 통째 밀림)
  - GPT-4o full Hybrid: **62.5%** (10/16 정확, 10배 개선)
  - 남은 오류 패턴: BOX/EA 시스템 일부 행, 행 누락(13행 련화푸주) → 시프트

### agent 강화 (사장님 호소 누적 반영, PR #154~#171)
- `designer.md` 절대 규칙 신설: 7(위·아래 카드 폭 일치) / 8(잘림 해결 우선순위) / 9(스켈레톤 UX) / 10(텍스트 목업 의무) / 11(모바일 360px 실측 폭 표 + 셀렉터 검증)
- `coder.md` 데이터 로딩 패턴 신설 (innerHTML 통째 교체 금지, textContent in-place)
- `advisor.md` 사장님 기술 의견 처리 의무 (단순 동조 금지, 비교표+결론+근거)
- `planner.md` UI 변경 시 designer 호출 + 목업 의무 (소형도 예외)
- `reviewer.md` 자가 체크 11개 항목 추가
- `dev_lessons.md` #91~#94 신설

### 검증
- node --check 통과 (모든 PR)
- DB 마이그레이션 4건 성공 (ai_usage_logs, receipt_group_id, unit_price+qty+display_item)
- ai_usage_logs로 실시간 토큰·비용 자동 추적
- CTO 자동 진단: DB 조회로 실패 원인 즉시 파악 (사장님 손 최소)

### 사장님 명시 결정 (이번 세션)
1. 디자이너 박을 명령: "모바일 360px 의무 + 320px 권장 실측 폭 표 + 셀렉터 검증" (designer 규칙 11)
2. AI 비용 다이어트 동의 (E + B + 모델 교체)
3. Multi-Provider B안 (거래처=flash / 직구=lite)
4. **거래명세서 OCR = "어플 살길". 포기 X**
5. 학습 관리 + 영수증 삭제 학습 정리 = 관리자 대시보드 통합 (다음 세션)
6. 가격 책정: 1.5만원/매장 권장 (마진 14,900원/매장 + 손익분기점 ~30~50매장)

### 다음 세션 첫 결정 (마무리 대기)
**거래명세서 정확도 62.5% → 사장님 호소 정당** (47% 차이는 SaaS 사용 불가)
- 옵션 A: GPT 2단계 검증 (Worker 코드 추가, 사장님 1회 배포) — 85~90% 기대
- 옵션 B: Clova Document 모드 새 도메인 (사장님 새 도메인 작업) — 90~95% 기대
- 옵션 A+B 동시
- 옵션 C: 현재 + catch 도구 + 사장님 부분 수정 (3분/장)

---

## [2026-05-19 핵심 정리] AI 시도 흐름 — 7단계 (사장님 검증 통과 ✅)

### 1차: Gemini 단독 (시작 시점)
- 모델: `gemini-2.5-flash`
- 인프라: 클라이언트 → Cloudflare Worker (gemini-proxy) → Google Gemini API
- 정확도: 거래명세서 ~80% (행별 단가/수량 일부 잘못, 합계는 추출)
- 비용: **5~10원/회** (thinking 토큰 2,000~3,000개 자동 ON, 출력 토큰의 일부로 청구)
- 호소: 사장님 "비용 너무 비싸. 매장당 수익 없겠다"
- 호소: high demand 자주 발생 → "상용화 불가능"

### 2차: Gemini 다이어트 (Worker thinking OFF + 짧은 키)
- Worker 코드 갱신:
  - `thinkingConfig.thinkingBudget: 0` (thinking 모드 OFF — 영수증 OCR에 추론 불필요)
  - `maxOutputTokens: 2048` (출력 폭주 방지)
  - `temperature: 0.1` (일관성 ↑)
- 클라이언트 프롬프트 다이어트:
  - JSON 키 짧게 (date→d, vendor→v, item→i, unitPrice→u, qty→q, totalPrice→p, category→c)
  - 거래처 모드면 vendor/category 출력 생략 (클라이언트가 박음)
- 모델 교체 시도 1: `gemini-2.0-flash-lite` → **신규 사용자 차단 (옛 모델, Google 정책)**
- 모델 교체 시도 2: `gemini-2.5-flash-lite` → **정착** (1.1원/회, 5~10배 절감)
- **거래명세서 정확도 ↓↓** = lite 모델은 표 인식 약함 (행 매핑 다 밀림)
- 호소: 사장님 "정확도가 너무 떨어진다"

### 3차: 동적 모델 — 거래처=flash / 직구=lite (★ 정확도 가장 좋았던 시점)
- Worker 코드 갱신: `body._model` 화이트리스트 분기
- 거래처 영수증 = `gemini-2.5-flash` (정확도 우선) / 직구·POS = `gemini-2.5-flash-lite` (저렴)
- **거래명세서 정확도: 거의 정확** (행별 단가/수량/카테고리 다 맞음)
- **남은 호소 1건만**: 사장님 짚음 — "5,800×20=116,000으로 AI가 계산했지만 영수증 원본은 115,999. 원본 그대로 박는 게 맞지 않나"
  - 회계·세무 측면: 영수증 원본 = 실제 지불 증빙, 자체 계산값으로 덮어쓰면 X
  - CTO 동의 → 프롬프트에 "p = 영수증 인쇄된 값 그대로" 박음
  - 부작용: 다른 행에서 BOX/EA 계산 약해짐 (산으로 가는 LLM 패턴, dev_lessons #94 같은 흐름)
- 비용: 거래처 ~6원 / 직구 ~1원 / POS ~0.5원
- **이 시점이 사장님 매장 운영상 best** — 동적 모델 + 합계 검증 토스트 + 합계 박스 도구
- 사장님 의지: "그래도 거래처 high demand 차단 + 정확도 더 높게" → 다음 시도

### 4차: Multi-Provider 인프라 구축 (Clova OCR + OpenAI GPT + Gemini Fallback)
- 트리거: Gemini high demand + 정확도 부족 = "상용화 불가능"
- 동종 앱 조사: 캐시노트·자비스 등 한국 SaaS도 OCR 보조 위치, 마이데이터(카드/은행) 메인
- **사장님 가입 작업** (사장님 손 필수):
  - Naver Cloud Platform → CLOVA OCR Domain (`cashflow-receipt`, General, Premium, 한국어)
  - OpenAI Platform → 결제 ($10 충전) → API key 발급
  - Cloudflare Worker 환경변수 3개 추가 (CLOVA_URL, CLOVA_SECRET, OPENAI_KEY)
- Worker 코드 v3 (Multi-Provider):
  - `body._provider`로 분기: 'clova+gpt' / 'gpt' / 'gemini'
  - 'clova+gpt' = Clova OCR (텍스트 추출) → OpenAI GPT-4o-mini (텍스트→JSON 분류)
  - 'gpt' = OpenAI GPT-4o-mini Vision (직접 이미지)
  - 'gemini' = 기존 Gemini (폴백)
- **거래명세서 정확도: 6%** (1/16, 행 통째 시프트 발생)
- 호소: 사장님 "정확도 똥. 이건 어플 살길. 끝까지 성공시켜야"

### 5차: 1002 인증 디버깅 (사장님과 1시간 troubleshoot)
- 사장님 박은 URL = `clovaocr-api-kr.ncloud.com/external/v1/.../general` (**수동 연동 URL**)
- 4번 시도:
  1. URL `/general` 누락 의심 — 추가해도 X
  2. Secret Key 재발급 — X
  3. VPC vs Classic 환경 의심 (한국 리전 = VPC 강제, Classic 폐기됨)
  4. Premium 플랜 결제 의심 — X
- **진짜 원인** (사장님이 Naver 공식 가이드에서 발견):
  > "안전한 서비스 제공을 위해 외부 서비스에 바로 공개하지 않고... **반드시 API Gateway와 연동**하여 사용하도록 설계"
- 해결: CLOVA OCR Domain → **"API Gateway 연동" 버튼 → 자동 연동** → 새 URL (`apigw.ntruss.com/...`) + 새 Secret Key
- → Clova OCR 외부 호출 동작 시작

### 6차: GPT-4o full + 이미지 Hybrid (정확도 핵심 무기)
- 사장님 결정: "거래명세서 OCR = 어플 살길. 비용 6~10원 받아들임"
- Worker 코드 v5:
  - GPT-4o-mini → **GPT-4o (full)** (mini의 16배 똑똑한 표 인식)
  - **이미지 + OCR 텍스트 둘 다 GPT에 전달** (Hybrid)
  - boundingPoly 정밀 그룹핑 (y 동적 임계값 = avgH × 0.5)
  - 프롬프트 강화 (행 매핑 명시 + BOX/EA 시스템 + 합계 검증)
  - temperature 0 (일관성 최대)
- **거래명세서 정확도: 62.5%** (10/16, GPT-mini의 6%에서 **10배 개선**)
  - 정확: 행 1, 4, 6, 7, 8, 9, 10, 11, 12, 16
  - 오류: 행 2, 3, 5 (BOX/EA 적용 잘못) + 행 13 누락 → 14, 15 시프트
- 사장님 호소: "그대로 정확도 똥. 47% 차이는 사용 불가"
- 다음 카드: **A안 GPT 2단계 검증** 또는 **B안 Clova Document 모드** (todo_next_session 박힘)

### 7차: OCR 제거 + AI 단독 + 통합 개선 (★★ 사장님 검증 통과)
- 사장님 가설 검증 (헌법 3-1): "ai만 쓰자, ocr 정확도 떨어졌었음" → work_log 6단계 표로 검증
  - AI 단독(1·2·3차) 80~95% > OCR+AI Hybrid(4·6차) 6%·62.5%
  - → OCR이 정확도 끌어내리는 원흉. AI 이미지 직접 분석이 안정적
- 인프라 변경:
  - `_provider='clova+gpt'` 제거 → 모든 모드 `'gemini'` 메인
  - high demand 시 → `'gpt'` (GPT-4o vision 단독) auto-fallback (OCR 미사용)
  - Worker v6 (`docs/worker_v6_snippet.js` 사장님 배포)
- 사장님 영수증(순창국제 1/2장) 1차 분석 호소 → critic 결과:
  - AI 행 분석 자체는 100% 정확
  - 진짜 원인 ① Page(1/2) 누락 ② AI가 "총합계(외상포함)" 박음 ③ 임계값 5% 느슨 ④ 116,000 vs 115,999 (계산값 박힘)
- 통합 개선:
  - 프롬프트 다이어트 (11규칙→핵심 4줄)
  - `p = 영수증 인쇄값 그대로` 박음 (회계 증빙 우선)
  - `total_sum` 우선순위 정정: 금일합계 > 합계액 > 결제금액 (전미수/총합계/잔액 무시)
  - `page_info: {current,total}` 응답 신설 — Page(N/M) 인쇄 감지
  - 해상도 1600 → 1280 (Gemini 768 tile 단위)
  - 임계값 5% → max(100원, 0.5%) 회계 기준
  - 멀티페이지 UI: b64Pages 배열 + 썸네일 + parts에 inline_data 여러 개 통합 분석
- 사장님 BOX/EA 사고 호소 (87.5% 14/16) → BOX 0 케이스 4개 예시 + ⚠️ 강조 박음
- 출력 다이어트: date·vendor 응답 최상위 1번
- 의심행 시각화: 행 배경 노란색 + ⚠️ 아이콘 (토스트 사라져도 영구)
- **사장님 실측**: "틀린것 하나도 없음, 비용 약4.0으로 뜸" → **100% (16/16) · 4.0원**

### AI 비용·정확도 변화 (7단계)
| 단계 | 모델 | 정확도 | 1회 비용 | 비고 |
|---|---|---|---|---|
| 1차 (Gemini 단독) | gemini-2.5-flash + thinking ON | ~80% | 5~10원 (thinking 포함) | 비용 부담 |
| 2차 (다이어트) | gemini-2.5-flash-lite | ~30~50% | 1.1원 | 5~10배 절감 but 정확도 ↓↓ |
| 3차 (동적 모델 ★ best 후보) | 거래처=flash / 직구=lite | ~95%+ (1행 호소만) | 거래처 6원 / 직구 1원 | 116,000 vs 115,999 1건 호소 |
| 4차 (Multi-Provider 시도) | clova+gpt-4o-mini | 6% | 1.5~2원 | 행 매핑 통째 시프트 |
| 5차 (1002 디버깅) | — | 호출 실패 | 0원 | 자동 연동 발견 |
| 6차 (GPT-4o full + Hybrid) | clova+gpt-4o | 62.5% | 5~10원 | mini의 10배 개선, 다만 3차 best 미달 |
| **7차 (OCR 제거 + 통합 개선 ★★)** | **gemini-2.5-flash + 1280px + 다이어트 + BOX 0 보강** | **100% (16/16)** ✅ | **4.0원** ✅ | **사장님 실측 검증 통과. 옛 30.5원 대비 87% 절감** |

### 핵심 통찰 — 7차로 사장님 호소 다 해결
- **AI 단독(OCR 제거)** = 사장님 가설 정당. 데이터로 검증됨
- **프롬프트 다이어트** = 엣지 케이스(BOX 0)는 절대 빼지 X (dev_lessons #95)
- **사장님 호소 = critic 의무**. 행별 실측 없이 OCR 도입한 게 과거 실수 (dev_lessons #93)
- **임계값은 비즈니스 룰 기반**. 5% 임의 박지 X (dev_lessons #94)
- **2페이지 영수증** 같은 도메인 케이스를 시스템 설계 시 빠뜨림 → page_info 신설로 해결
- 외부 50매장 손익: AI 비용 30,000원/월 (매출 75만원의 4%), 손익분기 충분

---

## [2026-05-19 핵심 정리] 관리자 대시보드 + AI 비용 추적 인프라 (사장님 검증 요청)

### 인프라 구축 (이번 세션 완료)

**1. DB 테이블 `ai_usage_logs` 신설** (마이그레이션 `create_ai_usage_logs_20260519`):
| 컬럼 | 용도 |
|---|---|
| id (UUID) | PK |
| store_id (FK→stores) | 매장별 비용 추적 |
| feature | 'receipt_ocr' / 'pos_ocr' / 기타 |
| model | 'clova+gpt-4o' / 'gpt-4o-mini' / 'gemini-2.5-flash-lite' 등 |
| prompt_tokens, output_tokens, thinking_tokens, total_tokens | 토큰 추적 |
| estimated_cost_won | 추정 비용 (원 단위, 환율 1400원/$) |
| duration_ms | 응답 시간 |
| success, error_msg | 성공/실패 모니터링 |
| called_at | 호출 시각 |
- 인덱스 2개: (store_id, called_at DESC), (feature, called_at DESC)

**2. 매 AI 호출 자동 누적** (callGemini 함수에서 `_logAIUsage` 호출):
- Worker가 응답에 박은 `_modelUsed`, `_costWon` 사용
- 성공/실패 모두 기록
- 클라이언트가 fire-and-forget 방식으로 DB insert (실패해도 OCR 흐름 막지 않음)

**3. 실시간 토스트** (사장님 즉시 확인):
- 영수증 분석 완료 시 토스트:
  ```
  ✨ 분석 완료 (Clova+GPT-4o, 8.3초)
  토큰: 입력 1,200 · 출력 800
  💰 약 8.2원
  ```
- 모델명, 응답 시간, 토큰, 비용 한눈에 확인

**4. CTO 자동 진단** (사장님 손 없이):
- DB ai_usage_logs 조회로 실패 원인 즉시 파악
- error_msg 컬럼에 Worker의 디버그 정보 박힘 (host, secret_len, body 일부)
- 이번 세션 Clova 1002 디버깅 = DB만 보고 자동 진단

### 관리자 대시보드 (다음 세션 진행 — todo_next_session 박힘)

**위치**: 사이드메뉴 → owner 전용 메뉴 (auth_level === 'owner')
**profit_advisor 5축 점검**: 14/15점 → 우선 추천

**표시 항목**:
| 섹션 | 지표 | 데이터 소스 |
|---|---|---|
| 💰 AI 비용 | 오늘/이번달 호출 수, 입력/출력/thinking 토큰, 추정 비용(원), 모델·provider 분포 | `ai_usage_logs` |
| 📊 AI 정확도 | 분류 변경률 (사용자가 ✨ 분류 수동 변경한 비율) | `receipts` + `classification_rules` 비교 |
| 🏪 매장 사용 | 매장별 영수증·마감·근태 등록 수 | 각 테이블 집계 |
| ⚠️ 에러 모니터링 | 최근 7일 AI 실패율, DB 에러 카운트 | `ai_usage_logs.success` |
| 💡 수익 시뮬레이션 | 매장 N개 × 평균 호출 수 × 단가 = 월 비용 시뮬레이션 | 매장별 평균 |
| 🧠 학습 규칙 관리 | classification_rules 목록 + 직접 삭제·수정 | `classification_rules` |

**통합 처리 (사장님 결정)**:
- 학습 관리는 어플 본체 X, 관리자 대시보드 안 (어플 단순화)
- 영수증 삭제 시 자동 학습 정리: 같은 키워드의 다른 정상 영수증 0건이면 학습도 DELETE (CTO 안전망)

**작업 분리**:
1. 1차 (소형): 사이드메뉴 + 단순 SQL 집계 카드 4~5개
2. 2차 (중형): 매장별 분리·시뮬레이션 + 학습 규칙 관리 탭
3. 3차 (대형): 차트 + 기간 필터 + CSV 다운로드

**진입 트리거**: 사장님 "관리자 대시보드 만들자" 명시

---

## [2026-05-19 핵심 정리] 모바일 디자인 규칙 — designer 절대 규칙 11개 (사장님 검증 요청)

### 사장님 명령 한 줄 (헌법급, designer 규칙 11에 박힘)
> **"모바일 360px 의무 + 320px 권장 실측 폭 표: 컬럼별 width + 콘텐츠 자연 폭 비교표 + 셀렉터 검증을 매번 제출해라. 가로 스크롤 필요 시 명시할 것."**

### designer 절대 규칙 11개 누적 (2026-05-18 ~ 2026-05-19)

**기존 (2026-05-18 사장님 반복 호소)**:
| # | 규칙 |
|---|---|
| 1 | 회계 숫자 (세자리 콤마 + 우측 정렬 + tabular-nums + 헤더 중앙 + 0원→`-` + ±1,000원 이상 빨강) |
| 2 | 모바일 폭 절대 (360px 기준, 좌우 스크롤 X, 터치 44×44px) |
| 3 | 하드코딩 X (parent_id 동적, `if(name==='식자재')` 금지) |
| 4 | 같은 정보 두 군데 표시 X |
| 5 | 통일감 우선 (비슷한 화면 = 같은 패턴) |
| 6 | 임팩트 = 레이아웃 패러다임 변경 (폰트·색 무의식 효과 X) |

**신규 (2026-05-19 이번 세션)**:
| # | 규칙 | 배경 |
|---|---|---|
| 7 | **위·아래 카드 행렬 폭 일치 + 글자 자동조절** | 사장님 "가로넓이 안 맞아". `grid + minmax(0,1fr)` 의무, `1fr` 단독 금지 |
| 8 | **카드 잘림 = ellipsis 박지 말고 레이아웃 변경 먼저** | 사장님 "식자재가 식...이 맞아?". 우선순위 1)2줄 column 2)clamp 3)풀width 4)만원단위 5)ellipsis |
| 9 | **스켈레톤 우선 — 사용자 인지 즉시감** | 사장님 "없어졌다 생기는 느낌". UX 원칙만 명시, 구현은 coder.md |
| 10 | **텍스트 목업 의무 — 글 설명 X, 시각화 O** | 사장님 "텍스트 목업 줘". ASCII 와이어프레임 의무, Before/After 비교 |
| 11 | **모바일 360px 의무 + 320px 권장 + 실측 폭 표 + 셀렉터 검증** | 사장님 "왜 맨날 디자인에서 이러지". 매 UI 변경 시 폭표 의무 |

### 모바일 디자인 가이드 (designer.md 규칙 11 안)

**폭 표 의무**:
```
| 컬럼 | 지정 width | 콘텐츠 자연 폭 | min-width | 셀렉터 | 통과? |
|---|---|---|---|---|---|
| X | 24px | 24px | — | .x-btn | ✅ |
| 거래처 | 60 | "광성탑마트" ~70 | 64 | .c-v / .col-vendor | ✅ |
| 품목 | 가변 | 80~120 | 110 | .c-i | ✅ |
| 단가 | 54 | "9,400" ~50 | 62 | .c-u | ✅ |
| 수량 | 42 | "120.39" ~50 | 44 | .c-q | ✅ |
| 금액 | 72 | "1,701,408원" ~75 | 78 | .c-p | ✅ |
| 분류 | 74 | "식자재>채소" ~80 | 78 | .c-cBtn | ✅ |
| 합계 | 326+가변 | (전체 폭) | — | — | 가로스크롤 OK |
```

**셀렉터 검증**:
- ID 셀렉터 사용 시 **실제 매칭 DOM 위치 확인** (`#resTable`은 tbody — thead 매칭 안 됨)
- 양쪽 매칭 필요하면 **클래스 단독**으로 (`.col-vendor`)

**잘림 방지 안전망 4종**:
1. 컬럼별 `min-width` (콘텐츠 자연 폭 +10% 여유)
2. `white-space:nowrap` (자동 줄임 방지)
3. `.table-wrap { overflow-x:auto }` (가로 스크롤 fallback)
4. `-webkit-overflow-scrolling:touch` (iOS 부드러운 스크롤)

**폰트 크기 가이드** (모바일 360px):
- 부가/안내: 11~12px
- 본문: 13~14px
- 강조 숫자: 15~17px
- 큰 강조: 18~22px
- 시그널 이모지/뱃지: **14px+ 의무** (12px 이하 = 안 보임)

**사장님 호소 시그널 (1개라도 = designer 실격)**:
- "표 밀렸어"
- "글자 잘려"
- "왜 맨날 디자인에서 이러지"
- "10만원 이상 짤려"

### 위반 시 제재
- 실측 폭 표 없이 UI 작업 = reviewer 자동 반려
- 사장님 호소 1회 = dev_lessons 박음
- 3회 누적 = 본 규칙 추가 강화

### 관련 dev_lessons
- #91 grid `1fr` 함정 → `minmax(0,1fr)`
- #92 ellipsis는 안전망 X, 레이아웃 변경 우선
- #93 텍스트 목업 의무
- #94 designer 디테일 누락 (폰트·정렬·간격)
- #95 CSS ID 셀렉터 매칭 위치 검증

---

## [2026-05-18 (6)] 지출 허브 대정비 — 동적 그리드 + 카테고리 분리 + 4섹션 + 자동 복귀

### 상태: 모든 변경 main 머지 완료
### 브랜치: `claude/add-gemini-retry-logic-RjG9z`
### 트리거: 사장님 — "지출 카테고리 그리드가 뭐가 들어가야 정상인가" + 통일감 + 동적

### 큰 그림 변화 (designer 4섹션 + 동적)
**이전**: 영수증·내역 + 거래처/직구/기타/고정비/인건비/로열티/마케팅/세금 = 8장 정적 카드 한 그리드

**이후 4섹션 분리**:
1. **입력**: [📸 영수증 등록] 큰 카드 1개 (수동 입력은 모드 선택 화면에)
2. **🚚 거래 채널** (큰 카드 가로 2분할): 🏪 거래처 관리 / 🛒 직구
   - 이모지 + 다른 배경색 (#FEF3C7 노랑 / #FCE7F3 분홍) = 다른 차원 시각 강조
3. **📦 지출 카테고리** (동적 그리드, 가로 2단 row, 부제 X): expense_categories에서 자동
4. **💰 도구** (그대로): 계좌·카드 / 정산 대조 / 카테고리 관리

### 동적 그리드 (핵심 변경)
- `expense_categories WHERE category_type='expense' AND is_active AND parent_id IS NULL` 동적 렌더링
- 시스템·매출·exclude 카테고리 자동 제외 (영수증 참조 / 예비비 사용 / 카드대금 / 물품대금 / 매출)
- 사장님이 카테고리 추가/삭제 = 그리드 자동 반영 (헌법 10-2)
- 카드 합산 = data_source별 자동 분기
  - `receipts`/`composite`/`vendor_orders` → receipts + vendor_orders (parent+자식 포함)
  - `attendance` → attendance_logs + settlements 차감
  - `fixed_costs` → fixed_costs.category 텍스트 매칭
  - `manual` → expense_category_amounts + mydata_transactions 자동 매칭
- 카드 클릭 = data_source별 분기 (catReceipt / wage / fixedcost / goCategoryDetail)
- 로열티는 별도 (카테고리 X, 매출 × 요율)

### catReceiptCont 화면 신설 + 진화
- 모드: `direct` + `cat:<id>` 패턴 (카테고리 일반화)
- 표 컬럼: 날짜·가게·품목·금액·분류·거래(🏪/🛒)·📸/✏️
- 거래방법 필터 = 바텀시트
  - 직구 모드: 가게별 (vendor 텍스트 그룹, `shop:<name>`)
  - 카테고리 모드: 직접구입 + 거래처별 (vendor_id 그룹)
- 카드 안 [📸][✏️] 입력 버튼 제거 (영수증 1장 카테고리 섞이는 모순 해소 — 사장님 통찰)

### DB 변경 (3건)
1. `receipts.vendor_id` UUID FK→vendors (영수증 진입 분기 거래처/직구)
2. `receipts.input_method` TEXT ('photo'|'manual', 옛 영수증 NULL 호환)
3. `store_settings.vendor_order` TEXT (긴급 버그 — 문서엔 있었는데 실제 DB 누락, dev_lessons #90)
4. `expense_categories` 공과금/고정비 분리:
   - '공과금/고정비' parent → '고정비' rename
   - '공과금' parent 신규 (sort_order=6, data_source='fixed_costs')

### 자동 복귀 (사장님 결정 C2)
- `rcpEntryReturn` 글로벌 + localStorage `pd_rcp_return`
- 영수증 저장 후 reload → 로그인 후 진입 화면 자동 복귀:
  - catReceipt:<mode> → 카테고리 화면
  - vendors:<id> → 거래처 상세
- 로그인 12483 분기 처리 (콜론 2개 대응 slice)

### Sortable 자동 스크롤 (사장님 호소)
- 거래처/지출 허브/카테고리 관리 4곳 Sortable에 `forceAutoScrollFallback: true` 추가
- 드래그 중 화면 가장자리 진입 시 자동 페이지 스크롤
- 모바일 터치 환경 필수

### 거래처 합산 통합 (Phase 3)
- `vendorMonthTotals` = `vendor_orders.amount` + `receipts WHERE vendor_id NOT NULL`
- 거래처 영수증 등록 → 거래처 카드 합산 자동 반영

### 거래처 카드 [📸] 미니 + 거래처 상세 [📸/✏️] 버튼
- `data-stop="1"` 속성 신규 (디스패처 부모 전파 차단)
- `openRcpReceiptFromVendor(vendorId, method)` — picker 우회 + vendor·카테고리·input_method 직접 박기

### 영수증 모드 진입 분기 (이전 세션 일부 + 이번 세션 정제)
- 모드 선택 카드 3개: [📦 거래처][🛒 직구][✏️ 수동 입력]
- 거래처 모드 = vendor_id + 카테고리 자동 박힘 + AI 학습 스킵
- 직구 모드 = AI 품목별 분류
- 수동 모드 = 사진 단계 건너뜀 + 빈 행
- runAI 프롬프트 강화: 모드별 hint + 규칙 12개 + 예시 7개 (사장님 영수증 8장 사실 기반)

### 사장님 critic 적용 (헌법 3-1)
- "직구·기타 배타?" → 처음 배타 적용 (A2)
- "한도 끝없겠는걸" 의심
- "거래처도 카테고리?" → designer 4섹션 분리
- "이번달·건수 부제 필요?" → 부제 통째 제거 (가로 2단 + 짤림 해결)
- "공과금 ≠ 고정비?" → 카테고리 분리 (DB UPDATE + INSERT)
- "남들도 분리?" → 일반 인식 + 사장님 매장만 적용

### 사장님 매장 발견 사항
- 옛 영수증 15개 모두 vendor_id NULL = 직구 카드로 정확히 잡힘
- 거래처: 행복한정육점/순창국제/웰스토리 등 vendor.category_id 식자재 자식
- **프레시원**: vendor.category_id 삭제된 카테고리 가리킴 (사장님 거래처 관리에서 재설정 필요)
- "기타" 카테고리 3개 중복 (sort 8/18/20) — 다음 세션 정리 후보
- 비활성 카테고리 5개 (식자재(주류), 카드결제, 현금결제, QR결제, 송금결제) — 정리 후보

### 검증
- ✅ node --check 통과 (JS 약 12,000줄)
- ✅ apply_migration 2건 성공 (input_method, store_settings.vendor_order)
- ✅ execute_sql (공과금/고정비 분리) "실행 승인" 통과
- ✅ 옛 영수증·옛 데이터 호환 (NULL 처리)

### 다음 세션 시작점
**최우선 검토 사항** (todo_next_session.md):
1. **manual 카테고리 카드 화면 신설** (마케팅/세금/기타 클릭 시 mydata + eca 합산 표) — 시나리오 9·10 잠시 뒤로 미룬 거
2. **프레시원 거래처 category 재설정** (사장님 직접 또는 마이그레이션)
3. **카테고리 정리** (중복 "기타" 3개, 비활성 5개)
4. **신규 매장 기본 시드** = 공과금/고정비 분리 반영 검토

---

## [2026-05-18 (5)] 지출 허브 그리드 완성 + 카테고리별 영수증 목록 + 거래처 영수증 진입 (Phase 1+2+3)

### 상태: 코드 push 완료 / main 머지 진행
### 브랜치: `claude/add-gemini-retry-logic-RjG9z`
### 트리거: 사장님 — "지출이 분류돼있는 게 보여야 정상" + "각 그리드 안에 수동/영수증 이모지 구분"

### 사장님 critic 반박 4번 (헌법 3-1 자기 적용)
사장님이 내 critic 직접 반박:
1. "대시보드는 합산만 보임 → 상세 항목 못 봄" → 맞음
2. "기록 내역은 다 섞여서 카테고리별 찾기 힘듦" → 맞음
3. "지출 허브 그리드가 이미 분류 진입점 → 여기 채우자" → 맞음
→ 내가 "분석 욕구"라고 매도한 거 = 반박 위한 반박. 인정.

### 핵심 결정 (3 Phase 일괄)
**Phase 1**: 그리드에 [🛒 직구][📂 기타] 카드 2개 추가
- 직구 합산 = receipts WHERE vendor_id IS NULL
- 기타 합산 = receipts WHERE category_id IN (기타+자식 소분류)
- receipts SELECT에 vendor_id, category_id 추가 (한 번에 분류)

**Phase 2**: 카테고리별 영수증 목록 + 입력 방식 이모지
- DB: `receipts.input_method` TEXT 추가 (마이그레이션 `add_receipts_input_method_20260518`, "실행 승인" 통과)
- handleImg = 'photo', manualReceipt = 'manual', saveReceipt cleaned 박기
- 신규 컨테이너 catReceiptCont (직구·기타 공통, mode 파라미터)
- 헤더: 아이콘+제목+이번달 합계+월 선택
- 상단 [📸 영수증 사진][✏️ 수동 입력] 두 버튼 (openCatReceiptInput)
- 표: 날짜/가게/품목/금액/분류/📸|✏️
- openReceiptEdit 공유 (rcpRecords set)
- 편집/삭제 후 활성 컨테이너 기준 갱신
- nav() parentTabMap·actions에 catReceipt:'expHub' 추가

**Phase 3**: 거래처 영수증 진입 + 합산 통합
- 거래처 카드(목록)에 [📸] 미니 버튼 (data-stop="1"로 부모 전파 차단)
- 거래처 상세 헤더에 [📸 영수증 사진][✏️ 수동 입력]
- openRcpReceiptFromVendor(vendorId, method) — picker 우회, 모드·카테고리·input_method 직접 박기
- **loadVendors의 vendorMonthTotals = vendor_orders + receipts (vendor_id NOT NULL) 통합**
  → 거래처 영수증 등록되면 거래처 카드 합산에 자동 반영

### data-action 디스패처 작은 확장
- `data-stop="1"` 속성 지원 → 부모 요소 전파 차단 (거래처 카드 안 미니 [📸] 버튼)

### 검증
- ✅ node --check 통과 (3 Phase 모두)
- ✅ SQL apply_migration 성공 (input_method, 영향 행 0)
- ✅ 옛 영수증 호환 (input_method NULL → 이모지 빈 칸)
- ✅ 카드 드래그 순서 (applyExpHubCardOrder는 data-card-id 기반 → direct/etcExp 자동 처리)

### 사장님 골든패스 테스트
1. 지출 허브 → [🛒 직구] / [📂 기타] 카드 보이는지
2. 각 카드 클릭 → 영수증 목록 화면 (헤더+버튼+표)
3. 상단 [📸 영수증 사진] → 영수증 탭 직구 모드 진입
4. 상단 [✏️ 수동 입력] → 영수증 탭 직구 + 빈 행 자동
5. 영수증 등록 후 catReceiptCont 합계·이모지 확인
6. 거래처 관리 카드의 [📸] 미니 버튼 → 거래처 영수증 등록 (vendor 자동 박힘)
7. 거래처 상세 헤더의 두 버튼 → 동일하게 vendor·카테고리 자동
8. 거래처 영수증 등록 후 거래처 카드 합산 자동 증가 (orders + receipts 통합)

### 다음 세션 후보
- 카테고리별 목록 화면 UX 피드백 반영
- 식자재/비품 등 다른 expense_categories 카드도 그리드에 추가 검토
- input_method NULL 옛 영수증 일괄 분류 보조 도구 (필요 시)

---

## [2026-05-18 (4)] 영수증 진입 분기 (거래처/직구) + 수동 입력 + 토스 문어체 + 프롬프트 강화

### 상태: SQL 실행 완료 / 코드 push 진행
### 브랜치: `claude/add-gemini-retry-logic-RjG9z`
### 트리거: 사장님 — "양식 다양성 = AI 부담. 사용자가 진입 분기로 줄이자" + "수동 입력 폴백" + "토스 문어체"

### 사장님 통찰 (헌법 3-1 자기 적용 4번)
1. "OCR이 최선이냐" — Claude 산만 만드는 거 짚음
2. "우리 매장 카테고리 기준이면 다른 매장은?" — 매장 무관 메커니즘 본질 짚음
3. "양식 다양성 = OCR로 해결 안 됨" — AI 모델 능력 문제 짚음 (gemini-2.5-flash 확인됨)
4. "직구는 식자재·비품 섞이니 대분류 강제 못 함" — 대분류 picker 제거 결정

### 핵심 결정 (4중 폴백 체인 명문화)
1. 거래처 영수증 → 거래처 picker → 카테고리 자동 → 카메라 (AI 양식+카테고리 알고 시작)
2. 직구 영수증 → 카메라 바로 (AI 품목별 분류)
3. 수동 입력 (사진 없이 빈 행 1개 직접 입력) — AI 실패·작은 영수증 fallback
4. (다음 세션 검토) 클로바 OCR

### 작업 내용
1. **DB 변경 1건** (마이그레이션 `add_receipts_vendor_id_20260518`, "실행 승인" 통과)
   - `receipts.vendor_id` UUID FK→vendors(id) ON DELETE SET NULL
   - `idx_receipts_vendor_id` 인덱스
   - 옛 영수증 NULL 호환

2. **영수증 탭 진입 분기 UI** (HTML)
   - 모드 선택 카드 2개: [📦 거래처 영수증] / [🛒 직구 영수증]
   - 모드 표시 배지 + [변경] 버튼
   - 안내 가이드 (모드별 문어체 분기)
   - 거래처 picker 시트 (`#rcpVendorPickSheet`) — vendors WHERE is_active=true

3. **JS 신규 함수**
   - `setRcpMode(mode)`, `resetRcpMode()`, `showRcpUploadUI()`, `renderRcpModeBadge()`
   - `openRcpVendorPicker()`, `pickRcpVendor(id)`
   - `manualReceipt()` — 빈 행 1개 (거래처 모드면 vendor/category 미리 박힘)
   - `esc()` 글로벌 헬퍼

4. **runAI 프롬프트 강화**
   - 모드별 hint (거래처 = vendor 위치·카테고리 강제 / 직구 = 품목별 분류)
   - 규칙 7개 → 12개 (vendor 우선순위, totalPrice 우선순위, 누적금액 무시, 주류 처리, 면세 무시)
   - 예시 4개 → 7개 (영수증 8장 사실 기반: 순창국제·대명주류·이래관 추가)

5. **saveReceipt 분기**
   - 거래처 모드: vendor_id + rcpCatId/Name 강제 박힘 + 학습 스킵
   - 직구 모드: vendor_id NULL + AI 분류 그대로 + 학습 작동

6. **토스 문어체 적용**
   - 진입 카드 상단: "어떤 영수증인가요? 먼저 종류를 골라주세요. 거래처를 선택하면 카테고리는 자동으로 박아드려요."
   - 거래처 모드 가이드: "🎯 [거래처] 영수증으로 등록할게요. 카테고리는 [○○]로 자동으로 박아드려요."
   - 직구 모드 가이드: "🤖 AI가 품목별로 카테고리를 분류해드려요. 한 영수증에 식자재·비품이 섞여 있어도 따로따로 잡아드릴게요."

### 검증
- ✅ node --check 통과 (JS 11,420줄)
- ✅ SQL apply_migration 성공 (영향 행 0)
- ✅ 옛 영수증 호환 (vendor_id NULL)

### 사장님 다음 작업
1. 1~2분 후 main 머지 → 앱 배포
2. 영수증 탭 진입 → 거래처 모드 / 직구 모드 / 수동 입력 각각 골든패스 테스트
3. 양식 다양성 체감 — 사장님 매장 영수증 8장(이전 분석)이 잘 잡히는지

### 다음 세션 후보
- 영수증 분기 UX 피드백 반영
- 클로바 OCR 도입 검토 (만약 Gemini로도 안 잡히는 양식 있으면)
- 외상 거래처(순창국제·대명주류·에이젯·행복정육점·이래관) vendors 테이블 등록 (앞으로 거래처 모드 활용용)

---

## [2026-05-18 (3)] 영수증 8장 OCR 실측용 분석 + 헌법 "결정 즉시 박기" 규칙 신설

### 상태: 분석 완료 / 코드 변경 0줄 / 사장님 답변 대기
### 브랜치: `claude/add-gemini-retry-logic-RjG9z`
### 트리거: 사장님 약속한 영수증 사진 8장 (1차 5 + 2차 3) 받아 양식 다양성·OCR 통과율 추정용 사실 정리

### 받은 영수증 8장 사실 (사장님 매장 = 퐁당샤브샤브 논산점 = 이송은, 106-25-76683)
| # | 매장 | 일자 | 합계 | 결제 | 카테고리 추정 | 메모 |
|---|---|---|---|---|---|---|
| ① | 이래관 (배민 홀서비스) | 26-03-29 15:06 | 48,600 | 현금 | **확인 필요** (사장님 매입) | 더블클래식·치킨버거·모짜베이컨·L포테이토 |
| ② | 광성탑마트 POS:1 | 26-03-30 14:31 | 22,900 | 카드(롯데) | **확인 필요** | 부탄가스 + 종량제봉투 |
| ③ | 대명주류상사 | 26-04-08 12:09 | 435,533 | 외상 | 식자재(주류) | 키스/참이슬/맑은린/필후생/짐빔/산토리 + 빈용기보증금 -65,300 |
| ④ | (주)순창국제 | 26-04-09 | 1,632,549 (전미수 216,500+금일 1,416,049) | 외상 | 식자재 | 16종 (피쉬볼·완자·당면·푸주·버섯 등) **수기 빨간표시** |
| ⑤ | 광성탑마트 POS:2 | 26-04-10 17:52 | 10,940 | 카드(롯데) | **확인 필요** | 토스트식빵 + 종량제봉투, 사장님 적립 |
| ⑥ | (주)에이젯시스템 | 26-05-14 10:46 | 921,736 | 외상? | 식자재(육류) | 호주 우육 565,360 + 미국 돈육 356,376 |
| ⑦ | 행복한정육점 | 26-05-15 (금) | 627,848 | 외상 | 식자재(육류) | 우삼겹 미국산 60.37kg |
| ⑧ | 배민 (현장결제 단순형) | - | 19,800 | 카드 | **확인 필요** | 아메리카노 + 왕메가카페라떼×2 + 바닐라시럽×2 + 배달비 |

### 양식 다양성 (총 6~7종)
- 배민 영수증 2종 (홀서비스 후결제형 / 현장결제 단순형)
- 마트 POS 영수증 (광성탑마트, 바코드 포함)
- 주류 계산서 (Universe21 양식, 용기보증금 컬럼 존재)
- 거래명세서 인쇄형 2장 (에이젯/행복정육점, B/L 이력번호 포함)
- 거래명세서 수기 (순창국제, 빨간 동그라미·체크 다수) ← **OCR 통과율 가장 의심**

### 결제 형태
- 외상 4장 (50%) — 식자재 거래처는 전부 외상
- 카드 3장 (37.5%)
- 현금 1장 (12.5%)

### 핵심 인사이트
1. **식자재는 거의 외상** → vendor_orders 모듈과 영수증 연결이 OCR보다 더 큰 가치
2. **수기 영수증(④)** → 클로바 OCR 통과율 실측 결과에 따라 "수동 입력 정책" 필요할 수 있음
3. **배민 영수증 2종** → 학습 규칙 필요 (양식별 파서)

### 사장님 답변 대기 중 (카테고리 4건)
- ① 배민 이래관 (사장님 매입한 음식) = 어떤 분류?
- ② 광성탑마트 부탄가스 = 어떤 분류?
- ②⑤ 광성탑마트 종량제봉투 / 식빵 = 어떤 분류?
- ⑧ 배민 커피 (왕메가카페라떼) = 어떤 분류? (직원 간식?)

### docs 동기화
- `CLAUDE.md` 부칙 강화: **세션 끊김 대비 "결정 즉시 docs 박기" 규칙 신설** (옛 "세션 끝나기 전" 폐기). `todo_next_session.md`를 자동 기록 표 최상위에 추가
- `todo_next_session.md` 최상위에 영수증 OCR Phase 0~4 로드맵 박음 + 옛 영업일 회전 트리거는 "보류"로 격하

### 다음 단계
1. 사장님 카테고리 답변 4건 받기
2. 받으면 OCR 마이그레이션 정식 계획서 작성 (context_reader → critic → advisor → planner → reviewer)
3. 네이버 클로바 OCR 실측 (사장님 무료 한도 1000건/월) → 통과율로 4중 폴백 체인 설계

---

## [2026-05-18 (2)] Gemini high demand 자동 재시도 + agents/profit_advisor.md 신설

### 상태: 배포완료 (push 예정)
### 브랜치: `claude/standardize-settlement-records-6QOZ4` (연속 세션)
### 트리거: 사장님 — "영수증 잘 안 됨. high demand 떠서 검증조차 안 됨. 유료 결제해도 동일. 동종 앱 어떻게 푸는지 + 우리 맞는 게 뭔지 분석 필요"

### 작업 내용
1. **`callGemini` 지수 백오프 재시도** (3372~3395)
   - 1s → 2s → 4s 백오프, 최대 3회
   - 429/503 또는 "high demand|overload|currently experiencing" 텍스트 감지 시 자동 재시도
   - 재시도 중 로딩 메시지 "AI 다시 시도 중... (N/3)" 표시
   - 네트워크 오류도 동일 재시도 대상
   - work_log #1067 "AI 자동 재시도 — 보류, 자주 발생하면 재검토" 트리거 발동

2. **`agents/profit_advisor.md` 신설**
   - 사장님 의견 "수익성 agent 공식화" 이행
   - 5축 점검표 (수익 영향·차별화·검증 가능성·외부 의존도·안정성 영향)
   - 동종 앱 비교 의무 (캐시노트·자비스·위쿡 등) + 헌법 1-7 추측 시 명시
   - 검증 도구 동반 권고 (CSV/드릴다운/계산식 노출)
   - 진행·보류·재설계 신호 명문화
   - 헌법 2·1-6·1-7·3-1 연결

### 사장님과 합의된 다음 단계 (다음 세션 준비)
- **Phase 0 마무리**: 사장님 매장 영수증 5-10장 사진 → 네이버 클로바 OCR 실측
- **OCR 마이그레이션 설계** (1-2주차): 텍스트 OCR + 학습 규칙 + 정규식 폴백 체인
- **Phase 1**: 검증 도구 (사장님 스프레드시트 호환 CSV/표 + 드릴다운)
- **Phase 2**: 수식 픽스 (마감 → 근태/급여 → 정산검수 → 대시보드 순)
- **Phase 3**: 알림·이상탐지 (공과금 미납 #13, 거래처 차액 #14)
- **Phase 4**: 수익화 결정 시점 (가격·결제·앱 출시)

### 동종 앱 분석 결론 (이번 세션)
한국 자영업 SaaS는 영수증 OCR 비중을 낮추고 카드/은행 거래(마이데이터)를 메인으로 함. 우리도 영수증 OCR을 "보조 기능" 위치로 다이어트 + 4중 폴백 체인 (텍스트 OCR → 학습 규칙 → 텍스트 AI → 수동 입력) 권고.

### 분량
- index.html: +27/-9 라인
- agents/profit_advisor.md: 신규 1개 파일
- docs/work_log.md: +본 항목

---

## [2026-05-18] 마감정산 기록 영업개시 패턴 통일 (옵션 C: 미니 카드 + 풀정보 시트)

### 상태: 배포완료 (push)
### 브랜치: `claude/standardize-settlement-records-6QOZ4`
### 계획서 요약: 마감정산 "기록 조회" 표 + 별도 "마감 기록" 서브탭(3개) → 영업개시처럼 미니 카드 리스트 + 카드 클릭→풀정보 바텀시트(2개)로 갈아엎기. 헌법 1-6 정당한 갈아엎기 (옆 분기 추가 X, 통째로).

### 사장님 결정사항
- 옵션 C 선택: 리스트는 미니 카드, 풀 상세는 시트
- 카드 최소 정보: 마감 차액 + 차감 항목+메모
- 시트 안 날짜 네비(‹›) 유지
- 통합 추적(이번달 이상 발생 합)은 시트 상단에 표시

### 변경 내역
- HTML: `#settleCont .sub-tabs` 3→2 ("마감 기록" 서브탭 제거), `#settleCard` div 통째 새 `#settleDetailSheet` 시트로 이동 (날짜 네비·picker 그대로 살림)
- JS:
  - `loadSettleList()`: 4열 grid 표 → 미니 카드 리스트로 갈아엎기 (날짜+요일 / 마감 차액 / 차감 행+메모). items_json까지 SELECT (60일 차감 표시용). `_settleListMonthCache`로 이번달 합 캐시
  - `gotoCard(d)`: 서브탭 전환 → `openSheet('settleDetailSheet')` + `renderSettleSheetMonthSummary()` + `loadSettleCard(d)` 3단계 호출
  - 신규 `renderSettleSheetMonthSummary()`: 시트 상단 "📊 이번달 이상 발생 추적" 미니 카드 (영업개시 차액 합 + 마감 차액 합 + 이상 합)
  - `settleTab`: 'card' 분기 제거
  - `editSettlement`: `closeSheet('settleDetailSheet')` 추가, `#settleCard` 참조 제거
  - `deleteSettlement`: 삭제 후 시트 닫고 `loadSettleList()` (영업개시 deleteOpening 패턴)
- DB: 변경 없음
- 잔재 검증: `settleTab|card`, `closeSettleDetailSheet`, `getElementById('settleCard')` 모두 0건
- node --check 통과
- 사용자 사고/UX 통일 패턴: 영업개시(`openingCont`)와 마감정산(`settleCont`) 둘 다 "오늘 입력 / 기록 조회" 2탭 + 카드형 리스트 + 카드 클릭→수정/삭제 동선

### 골든패스 안내 (사장님 검증용)
1. 햄버거 → 영업 hub → 마감정산 → "기록 조회" 진입 → 카드형으로 보이는지 (영업개시 화면과 같은 느낌)
2. 차감 있는 날 카드: 통장입금/기타사용 + 메모가 카드 안에 보이는지
3. 카드 클릭 → 시트 열림 → 상단에 "이번달 이상 발생" 요약 + 본문에 매출/현금분해/차감/금고 다 보이는지
4. 시트 안 ‹ › 또는 날짜 picker로 다른 날 마감 후루림 가능한지
5. 시트 안 [수정] → 시트 닫히고 입력 탭으로 이동 → 기존 값 채워져있는지
6. 시트 안 [삭제] → 시트 닫히고 리스트 새로고침되며 그 카드 사라지는지
7. 마감 새로 저장 → 자동으로 기록 조회 탭으로 이동하는지 (기존 동작 보존)

---

## [2026-05-17~18 통합 세션] 인건비 카테고리 갈아엎기 + 마감정산 양방향 + agents 강화 + RLS 보강 (대형 멀티 PR)

### 상태: 배포완료
### 브랜치: `claude/test-supabase-mcp-agent-DGbKV` (PR #142~#150 다 머지)

### 머지된 PR 목록 (시간순)
| PR | 작업 |
|---|---|
| #142 | Supabase MCP RLS 누락 16개 보강 + 헌법 8조-A "실행 승인" 명령어 도입 |
| #143 | 인건비 시급/월급 갈라치기 + 마감정산 차감 카테고리 FK 기반 (Phase 1+2+3) |
| #144 | 월급 진행일까지만 분배 + 차감 분류 지출만 노출 (PR #145로 후속 갈아엎기) |
| #145 | 마감정산 "현금 지출" → "💵 금고 변동 사유" 양방향 + 전체 카테고리 노출 |
| #146 | docs todo agents 강화 후보 추가 |
| #148 | 인건비 카테고리 식자재 composite 패턴 통일 (모든 소스 매칭) |
| #149 | 빈틈 4곳 통일 (예비비/지출허브/정산검수/일별차트) |
| #150 | agents/*.md 6개 강화 (UI 절대 규칙 + 사장님 요구 거부 의무 + 추측 금지) |

### 핵심 결정사항

**1. Supabase MCP 운영 정착 (PR #142)**
- `.mcp.json --read-only` 1차 방어선 유지
- 헌법 8조-A 빨간불 명령어를 도구명 → **"실행 승인"** 4글자로 단순화
- RLS 누락 16개 보강 (운영 4 + 잔재 3 + 백업 9) — critical 경고 19→0

**2. 인건비 카테고리 식자재 패턴 통일 (PR #143, #148, #149)**
- 부모 인건비 = 자기 매칭 + 자식 합 (composite 패턴)
- 자식 시급/월급/상여금 = 자체 자동 + sumAllSourcesByCatId(자기 id)
- 헬퍼 `sumAllSourcesByCatId(catId, opts)` 신설 — mydata + receipts + vendor + eca + deductSum 일괄
- DB: 시급(attendance_hourly), 월급(attendance_monthly), 상여금(manual) 소분류 추가
- 사장님 추가한 상여금 카테고리 `attendance` → `manual` 정정

**3. 마감정산 차감 = "금고 변동 사유" 양방향 (PR #145)**
- 옛 "현금 지출" 단방향 가정 → 사장님 짚음: 들어옴(거래처 환불·돈 투입)도 있음
- 행마다 ± 토글 (빨강 −/초록 +)
- 분류 선택 전체 카테고리 노출 (지출/매출/정산제외/예비비)
- 카테고리 자동 집계: `cat += d.amount` (부호 그대로 반영)

**4. 인건비 합산 빈틈 4곳 통일 (PR #149)**
- `calcReserveBalance` (예비비 잔고)
- `loadExpHubData` (지출 hub 인건비 카드)
- `loadReconciliation` (정산검수 "마감 차감 인건비" details)
- `loadDashboard` 일별 차트 (일자별 deductions 카테고리 키 분배)
- 사장님 의도: 5개 화면 모두 같은 인건비 숫자

**5. agents 강화 (PR #150)**
- 6 agent (designer/reviewer/critic/context_reader/coder/tester) 다 강화
- UI 절대 규칙 6개 못박음 (회계 숫자/모바일/하드코딩X/중복X/통일감/패러다임)
- 사장님 요구도 거부 의무 (헌법 3-1 + 1-6)
- 추측 금지 강화 (이번 세션 4번 위반 누적)
- tester 통과 없이 머지 금지

### DB 변경
1. `.mcp.json` (변경 없음, 운영 정착)
2. expense_categories: 시급/월급/상여금 소분류 3개 INSERT (`attendance_hourly`/`attendance_monthly`/`manual`)
3. settlements.items_json.deductions[]에 category_id/category_name/(sign 의미) 옵션 필드 (스키마 변경 X, JSONB)
4. 16개 테이블 RLS ENABLE + 4개 정책 CREATE

### docs 동기화
- `CLAUDE.md`: 8조-A "실행 승인" 명령어로 갱신
- `db_schema.md`: attendance_hourly/monthly data_source + deductions.category_id/category_name 추가
- `dev_lessons.md`: #87 (추측 4번 위반), #88 (금고 변동 양방향), #89 (식자재 composite 패턴 통일)
- `agents/*.md` 6개: UI 절대 규칙 + 추측 금지 + 사장님 거부 의무
- `todo_next_session.md`: agents 자동 호출 명령어 옵션 보류 (사장님 결정 대기)

### 헌법 1-7 위반 4번 (이번 세션, dev_lessons #87 박음)
1. `special_wages` "활발히 사용 중" — DB 0건
2. `special_wages.extra_amount` = "상여금" — 실제 "추가시급(원/시간)"
3. "현금지출" 단방향 가정 — 사장님 의도 양방향
4. 빈틈 4곳 전수 점검 누락 — 사장님 짚음

→ agents 강화로 다음 세션 방지

### 미해결 / 다음 세션 후보
- mydata 매칭 4곳 통일 (사장님 매장 0건, 노무사 데이터 들어올 때)
- agents 자동 호출 명령어 ("풀코스" / "빨리") — 사장님 결정 대기
- 상여금 사장님 매장 운영 검증 (사장님 차감 분류 시작 후)
- `employee-docs` 버킷 SELECT 정책 광범위 (RLS 보강 잔여 WARN)
- `_sales_daily_touch_updated_at` 함수 search_path mutable

### 사장님 다음 작업
1. 하드 새로고침
2. 마감정산 → 금고 변동 사유 섹션에 차감 분류 시작 (인건비>상여금 등)
3. 홈/예비비/허브/검수/일별차트 5곳 동기화 확인
4. UI 절대 규칙 위반 발견 시 즉시 짚어주세요 → agents 더 강화

---

## [2026-05-17] 인건비 시급/월급 갈라치기 + 마감정산 차감 카테고리 FK (대형, Phase 1+2+3)

### 상태: 배포완료
### 브랜치: `claude/test-supabase-mcp-agent-DGbKV`

### 배경
사장님 호소 2개:
1. "인건비가 시급만 계산되는 듯, 월급(고정급)도 있는데 어떻게 되는지?"
   → 코드 확인 결과 월급제도 처리 중. 단, 인건비 대분류 1개로 합쳐 보임 (시급 vs 월급 분리 X)
2. **"현금지출은 내가 지금까지 계속 놓쳐서 반영이 하나도 안 되고 있었어"** (긴급)
   → 마감정산 차감(deductions) 입력값이 카테고리 집계에 안 들어옴 = **데이터 누수 진행 중**

### 사장님 통찰 (대형 그림)
- 상여금 = 금고에서 만원씩 현금 지급 → 마감정산 차감으로 입력
- 차감 항목에 카테고리 FK 연결되면 → 마감정산이 곧 분류 입력 화면
- 모든 현금지출이 카테고리별 자동 집계됨

### critic 검토 결과
- v1 1회차 (인건비 카테고리는 처음 갈라치기, 부담 적음)
- 사장님 4개 안(시급/월급/상여/기타) → 3개로 축소 → 최종 시급/월급 2개로 축소
  - "기타(택시비)" = 인건비 X (세무상 복리후생비). 노무사 데이터에도 없음 → 제외
  - "상여금" = special_wages 코드 오해 발견 (그건 일별 추가시급) → 별도 구상 필요
- 사장님 결정: 1+2 묶음 → "3 급함" 명시 → 결국 1+2+3 통합 결정 (데이터 누수 차단 우선)

### 작업 내용

**Phase 1: 인건비 시급/월급 갈라치기**
- DB: `expense_categories` INSERT 2건 (시급/월급 소분류, parent_id=인건비 id)
  - data_source 신값: `attendance_hourly`, `attendance_monthly`
- 코드:
  - `calcExpenseByCategories`: 자식 스킵 추가 (composite 패턴), attendance_logs select에 employee_id 추가, attTotal 계산 = 시급제 calculated_wage + 월급제 분배
  - `loadDashboard childExpByCat`: 시급/월급 자식 amt 계산 분기 추가

**Phase 2: 마감정산 차감 자동 집계 (긴급)**
- `calcExpenseByCategories`: settlements.items_json.deductions SELECT 1회 → category_id 있는 차감 합산 → 가마감 카테고리 합계에 추가 (진마감은 mydata 기반이라 중복 방지)
- 옛 deductions (category_id 없음)은 자동 집계 무시 (옛 동작 보존)

**Phase 3: 마감정산 차감 입력 UI 카테고리 선택**
- `addSettleDeductRow(type, amount, memo, catName, catId)`: 인자 2개 추가, row HTML에 분류 버튼 추가
- 새 함수 `pickStDedCategory(rowId)`: openCatPicker 재사용 → 카테고리 선택 → row dataset 업데이트
- `getSettleDeductRows()`: category_id, category_name 함께 리턴
- 차감 행 복원 (`restoreSettlement2`): d.category_name, d.category_id 함께 전달
- 옛 차감 입력 UI 호환 (4,5번 인자 기본값 '')

### DB 변경
**실행 SQL** (`execute_sql` 🟡 노란불, 사장님 "실행 승인" 통과):
```sql
INSERT INTO expense_categories (store_id, name, parent_id, data_source, category_type, is_active, color, sort_order)
VALUES
  ('4ae03341-...', '시급', '6f1a1cb5-...', 'attendance_hourly',  'expense', true, '#FF9F0A', 1),
  ('4ae03341-...', '월급', '6f1a1cb5-...', 'attendance_monthly', 'expense', true, '#FF453A', 2);
```
**롤백**: `DELETE FROM expense_categories WHERE parent_id='6f1a1cb5-...';`

**스키마 변경 X** (JSONB 자유 필드라 `deductions[].category_id` 추가는 마이그레이션 불필요)

### 검증
- ✅ node --check 통과 (HTML <script> 추출 검증)
- ✅ 옛 deductions 데이터 보호 (category_id 없으면 자동 집계 무시)
- ⏳ 사장님 골든패스 (다음 단계 필수):
  1. 하드 새로고침 (Ctrl+Shift+R)
  2. 홈 지출 카드 → 인건비 "+ 상세보기" → 시급/월급 자식 행 표시 확인
  3. 마감정산 진입 → "+ 현금 지출 추가" → 금액 입력 → "🏷️ 분류 선택" 버튼 → 인건비/식자재 등 선택 → 저장
  4. 다시 마감정산 진입 → 복원된 차감 행에 카테고리 표시 확인
  5. 홈 지출 카드에서 해당 카테고리에 금액 반영 확인

### 헌법 위반 / 교훈
- **헌법 1-7 위반 2회 (추측)**:
  1. "special_wages 활발히 사용 중" — 코드에 함수만 있을 뿐 사장님 0건 사용 (정정)
  2. "special_wages = 상여금" — 코드 보니 "일별 추가시급" (정정)
- 사장님 즉각 짚으심 ("내가 쓴 적 없는데", "이름만 보고 추측?") — 헌법 1-7 제대로 작동
- 대응: 코드 (placeholder/필드명) 직접 확인 후 정정 → 새 설계로 전환

### 헌법 변경 없음
- 다만 dev_lessons.md에 본 헌법 1-7 위반 사례 추가 권장 (다음 세션 todo)

### docs 동기화
- `db_schema.md`: expense_categories.data_source 신값(attendance_hourly/monthly) + settlements.items_json.deductions[].category_id 추가 명시
- `work_log.md`: 본 항목

### 사장님 다음 작업
1. **하드 새로고침** (Ctrl+Shift+R)
2. 마감정산 진입 → 현금지출 행 입력 시 "🏷️ 분류 선택" 클릭 → 카테고리 선택
3. 저장 후 홈 지출 카드에 합산 확인
4. 매일 마감 시 차감 항목 카테고리 분류 시작 → **누수 차단**

### 미해결 / 다음 세션 후보
- 상여금 입력 방식 (별 테이블 vs special_wages 확장 vs 수동 카테고리) — 사장님 결정 필요
- 노무사 데이터 받은 후 진마감 인건비 매핑 형식 확정
- 인건비 외 다른 자동 집계 카테고리에도 deductions 합산 작동 (이미 됨, 검증만)
- `_sales_daily_touch_updated_at` 함수 search_path mutable (이전 세션 WARN 잔여)
- `employee-docs` 버킷 SELECT 정책 광범위 (이전 세션 WARN 잔여)

---

## [2026-05-17] MCP 실전 검증 + RLS 누락 16개 보강 + "실행 승인" 명령어 도입 (대형)

### 상태: 배포완료 (DB 마이그레이션 1회 + 헌법 1줄 수정)
### 브랜치: `claude/test-supabase-mcp-agent-DGbKV`

### 배경 — 이전 세션 권장 순서대로 실전 테스트
1. CashFlow 환경 새 세션에서 "supabase mcp로 stores 데이터 보여줘" 시도
2. 헌법 8조-A 작동 검증 (🟢/🟡/🔴 흐름)
3. 자물쇠 빠진 테이블 발견 시 보강

### 작업 내용
1. **🟢 도구 자동 실행 검증** — `list_tables`, `execute_sql(SELECT stores)` 모두 자동 호출 정상.
   - 결과: stores 1개 (퐁당샤브 논산점) — 헌법 8조-A-3 절차 통과
2. **보안 advisory에서 RLS 비활성 19개 발견** (Supabase MCP가 의무 surface)
   - 운영 4개 위험: `sales_daily`(17행), `payment_methods`(7), `extra_revenue_items`(2), `extra_revenue_logs`(1)
   - 잔재 3개: `exp_groups`, `exp_items`, `exp_item_amounts` (코드 grep 0건 = 안 씀)
   - 백업 9개: `*_bak_20260422*` / `*_backup_2026051*`
   - 의도적 OFF 2개: `stores`, `franchises` (유지)
3. **🔴 빨간불 명령어 변경 (헌법 8-A 1줄 수정)**
   - 기존: 사장님이 도구 이름(`apply_migration`) 콕 찍어야 → 사용성 ❌
   - 신규: **"실행 승인" 4글자**만 말하면 OK → 사장님 친화적
   - 헌법 8-A-3, 8-A-4 표현 갱신
4. **🔴 `apply_migration` 1회 실행 — 16개 RLS ON + 4개 정책 CREATE**
   - 마이그레이션 이름: `enable_rls_on_missing_tables_20260517`
   - 결과: critical 보안 경고 19개 → 0개 ✅
   - 운영 4개 SELECT 검증: 정책 적용 후에도 정상 동작 (앱 영향 0)

### 핵심 결정사항
- "실행 승인 + 뒤에 무엇" 형태도 허용 (예: "실행 승인 잠가")
- 새 운영 테이블 만들 때마다 RLS + `pd_phase2b_all` 정책 함께 적용 의무화 (db_schema.md 명시)
- 백업/잔재 테이블도 자물쇠는 채우되 정책은 없음 → service_role(사장님 콘솔)만 접근 가능

### docs 동기화
- `CLAUDE.md` 8-A-2/8-A-3/8-A-4: "실행 승인" 명령어로 갱신
- `db_schema.md` 주의사항: RLS 보강 항목 + 신규 테이블 의무 패턴 추가
- `work_log.md`: 본 항목

### 미해결 (다음 세션 후보)
- WARN 레벨 잔여:
  - `employee-docs` 버킷 SELECT 정책이 광범위 (직원 파일 목록 노출 가능성)
  - `_sales_daily_touch_updated_at` 함수 search_path mutable
  - `pd_phase2b_all USING(true)` 정책 자체 — Phase 2c JWT 도입 후 엄격화 예정 (헌법 명시)
- exp_* 3개 통째 DROP 여부 (지금은 봉인만, 사장님 결정 시 삭제)

### 사장님 다음 작업
- **없음**. 앱 동작 그대로. UI 변경 0줄.
- 다음 새 세션 시작 시 본 헌법(`CLAUDE.md` 8-A)에 "실행 승인" 명령어 자동 적용됨.

---

## [2026-05-17] Supabase MCP 보안 정리 — 헌법 8조-A 신설 (중형)

### 상태: 배포완료 (문서만, 앱 영향 없음)
### 브랜치: `claude/security-token-risks-JVSFs`

### 배경
- 이전 세션에서 사장님이 데스크탑 Claude Code에서 Supabase MCP 시도 → 도구 미연결
- 원인 진단: 네트워크 정책 + OAuth 권한 범위 + MCP 서버 read-only 설정 등 다층 요인

### 작업 내용
1. **CashFlow 클라우드 환경 구성 안내** (사장님 작업)
   - 네트워크 정책: 사용자 정의
   - 허용 도메인: `*.supabase.co`, `*.supabase.com`, `api.github.com`
   - 환경 변수: `SUPABASE_ACCESS_TOKEN`
2. **OAuth 커넥터 승인** (사장님 작업, claude.ai 측)
   - Judypapa 조직 광범위 권한 부여 (프로젝트 삭제 포함)
   - 보안 검토 결과 보고 후 사장님 A안 선택 (권한 유지 + 헌법 강화)
3. **헌법 8조-A 신설** (`CLAUDE.md` +49줄)
   - 1차 방어선: `.mcp.json --read-only` 절대 유지
   - 도구 3색 신호등 (🟢 자동 / 🟡 승인 / 🔴 절대금지)
   - 호출 전 의무 절차 4단계
   - 빨간불 도구 6종: `delete_project`, `apply_migration`, `deploy_edge_function`, branch 조작 5종, `pause/restore_project`, `update_postgres_config`

### 핵심 교훈 (→ dev_lessons.md 추가)
- **도메인 추측 금지**: `api.supabase.com` vs `*.supabase.co` 혼동으로 정정 한 번 더 발생. MCP 도구는 관리 API(`api.supabase.com`) 사용.
- **OAuth 권한 ≠ MCP 도구 노출**: OAuth가 광범위 권한을 주더라도 MCP 서버가 read-only면 위험 도구 자체가 노출 안 됨. 이게 1차 방어선.
- **사장님이 무서워하면 진짜 무서워해야 할 가능성 큼**: 사장님이 "괜찮을 거 같다고는 했는데 무섭다" → 헌법 1-7·3-1에 따라 솔직히 보안 위험 4+1가지 분석 보고. 사장님 직관 신뢰.

### 머지 정보
- 본 PR: 헌법 문서만 수정 → 앱 영향 0 → 머지 후에도 사장님 테스트 불필요

---

## [2026-05-15 (밤~새벽 통합 세션)] 월 요약 갈아엎기 + 거래처/주문 UX 대공사 ✅ PR #126~#139 머지

**브랜치**: `claude/redesign-monthly-summary-aBZ2Y` (14 PR)

### 머지된 PR 목록
| PR | 작업 요약 |
|---|---|
| #126 | 월 요약 카드 수술 + 일별 추이 그래프 카드 통째 제거 |
| #127 | 단일 표 통합 (매출/지출/카테고리/순수익/예비비/실수익 한 표) + 카테고리 매출대비% + 0원 자식 표시 |
| #128 | 전월 데이터 TDZ 회피 — 매출대비 비교 placeholder 패턴 |
| #129 | 카테고리 ▾ → "+상세보기" 텍스트 + 더보기 가운데 정렬 |
| #130 | "+상세보기" 가운데 정렬 |
| #131 | saveVendor 단계별 진단 토스트 (사장님 "씨푸드 추가 안됨" 진단) |
| #132 | 거래처 완전 삭제 버튼 + stale 캐시 fix + 진단 토스트 제거 |
| #133 | 지출 hub 직렬 8회 → Promise.all 1회 (속도 ~9배) |
| #134 | 거래종료 → 편집시트 + 입력버튼 위로 + 주문리스트 카드→표 + 합계 즉시 갱신 |
| #135 | 주문표 단가수량 + 거래처 ☰ 드래그(localStorage) + 월요약 sort_order |
| #136 | 주문표 7컬럼 + 거래처 ☰ 핸들 + **top3 금액 큰 순 원복** (사장님 정정) |
| #137 | 주문 표에 **품목 컬럼 추가** (사장님 분노 정정 — 옛 패턴 회귀) |
| #138 | 표 헤더 가운데 + 너비 데이터 기반 + dev_lessons #85 (표 정렬 규칙 종합) |
| #139 | 주문 표 옵션 A 7컬럼(✎🗑 → 행 클릭+시트 안 삭제) + 거래처 순서 DB 마이그레이션 |

### 핵심 변경 결정사항

**1. 월 요약 카드 단일 표 갈아엎기 (PR #126~#130)**
- 매출/지출/카테고리/순수익/예비비/실수익 모두 한 `<table>` (table-layout:fixed + colgroup)
- 마감예상 별도 블록 → "월말 예상" 컬럼 통합 (4컬럼: 라벨/지금/매출대비/예상)
- 지출 카테고리 = 상위 3개(금액 큰 순) + "+ 더보기 N개 ▾" 가운데 + 펼치면 "− 접기 ▴"
- 식자재/주류 등 `parent_id` 자식 있는 카테고리는 우측 "+ 상세보기" 클릭 → 자식 펼침
- 자식 0원도 표시 (사장님 "카테고리 존재하면 보여야지")
- 카테고리 비율 = **매출 대비** (지출 합계 대비 X) → 카테고리 % 합 = 지출 % 정합
- 일별 추이 그래프 카드 통째 제거 (주단위 요약과 정보 중복)

**2. 거래처/주문 UX (PR #131~#134, #139)**
- 거래처 편집 시트에 거래종료/재개 토글 + 완전 삭제 버튼 통합 (옛 헤더 토글 제거)
- 거래처 카드 ☰ 드래그 핸들 (long-press 제거, dev_lessons #55 패턴)
- 주문 표 7컬럼 (날짜/품목/단가/수량/금액/메모/›) — 행 클릭 = 편집 시트
- 편집 시트 안 빨간 🗑 삭제 버튼 (편집 모드만 표시)
- 주문 입력 버튼 데이터 위로 이동 (스크롤 부담 해소)
- 거래처 순서 localStorage → **store_settings.vendor_order DB** (다기기 동기화)

**3. 성능/캐시 fix (PR #132~#133)**
- 지출 hub: DB 호출 직렬 8회 → Promise.all 1회 (~9배 빠름)
- 지출 hub 카드 순서: settings 캐시 즉시 적용 (DB fetch 기다리지 말고)
- 주문 저장 후 vendorMonthTotals 즉시 갱신 (다른 화면 안 가도 합계 반영)

### DB 변경 (사장님 SQL 실행 필요)
```sql
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS vendor_order TEXT;
-- 롤백: ALTER TABLE store_settings DROP COLUMN IF EXISTS vendor_order;
```

### 헌법 변경
- 헌법 변경 없음. 다만 헌법 3-1·4-2 위반 사례 2회 발생 (PR #135 top3 + PR #136 품목 누락) — dev_lessons #84로 박음

### dev_lessons 추가
- **#80** 헌법 1-7 위반 — 코드만 보고 추측 (스크린샷 확인 의무)
- **#81** 결제수단 비율 가치 낮음
- **#82** 시간 컨텍스트 통합 (오늘/어제 같은 카드)
- **#83** parent_id 동적 드릴다운 (하드코딩 X)
- **#84** 사장님 명시 컬럼 받자마자 빌드 금지 — 입력 폼 필드 1:1 대조 의무
- **#85** 표 정렬·너비 규칙 종합 (헤더=가운데, 본문 숫자=우측/텍스트=좌측, 짤림 방지)

### docs 동기화
- `db_schema.md`: store_settings.vendor_order 컬럼 추가 기록
- `dev_lessons.md`: #80~#85 추가, #79 헤더 규칙 #85로 대체 표시
- `work_log.md`: 본 항목

### 사장님 다음 작업
1. Supabase 콘솔에서 SQL 1줄 실행 (vendor_order 컬럼 추가)
2. 운영 앱(`pongdang-shabu.pages.dev`) 강력 새로고침
3. 거래처 모바일↔PC 순서 동기화 확인
4. 월 요약 카드 카테고리 상위 3 + 식자재 "상세보기" 펼침 확인

### 미해결 / 다음 세션 후보
- 사장님 매장 거래처 옛 9개 (식자재 4 + 직구 5) 재분류 잔여분 (사장님 자율)
- 거래처 카드 드래그 정렬 핸들이 모바일에서 발견성 충분한지 사장님 검증
- 주문 표 모바일 가독성 (좁은 폰 364px 이하) 확인 — 짤림 시 추가 조정

---

## [2026-05-15 (밤 세션)] 월 요약 카드 수술 + 일별 추이 그래프 제거 (중형)

> ⚠️ 위 통합 보고로 마무리됨 (PR #126만 단독 기록 → #126~#139 통합으로 갱신)

**브랜치**: `claude/redesign-monthly-summary-aBZ2Y`
**규모**: 중형 (~150줄, DB SELECT만, 추가 쿼리 0)

### 사장님 호소
- 월 요약 카드 지출 카테고리가 다 펼쳐진 상태 → "칸 다 잡아먹음. 카테고리 이렇게 많을 줄 몰랐음"
- 소분류(식자재>육류/야채/공산품)가 안 나오고 있음
- 일별 추이 그래프 "필요한가 싶기도 함" (사장님 본인 의심)
- "월요약카드도 수술 필요"

### 결정사항 (사장님 답변 기반)
1. **일별 추이 그래프 통째 제거** — 주단위 요약 카드가 이미 일별 매출/지출/순익 표시. 정보 중복
2. **지출 카테고리 = 금액 큰 순 상위 3 + "더보기 ▾"** — 클릭 시 펼침/접힘
3. **소분류 드릴다운** — 자식 있는 카테고리 옆 ▶ 표시, 클릭 시 자식 행 펼침 (식자재 하드코딩 X, `parent_id` 동적)
4. **마감예상 별도 블록 제거 → "예상" 컬럼 통합** — 매출/지출/순수익/예비비/실수익 한 표에 "지금 / 매출대비 / 월말 예상" 3컬럼
5. **예비비/실수익 행 유지** — 사장님 본인 매장 사용 중 ("예비비 시스템 놓치고 싶지 않음")

### 변경 내역
- HTML: 일별 추이 카드(L1765) 통째 삭제
- CSS: `.summ-tbl .ds-est`(예상 컬럼) + `.summ-tbl thead th`(컬럼 헤더) + `.exp-cat-tbl` 신규
- JS `loadDashboard`:
  - 월 요약 빌더 — 단일 표 4컬럼, "예상" 통합
  - 마감예상 별도 블록(`.dash-summ-est-block`) 제거
  - 지출 아코디언 — 세그먼트 바 유지 + 카테고리 리스트 = 상위 3 + 더보기 + 드릴다운
  - 자식 카테고리 합산 (`childExpByCat`) — voRes2/rcRes2 재사용 (추가 DB 쿼리 0)
  - 일별 차트 Chart.js 인스턴스 생성 코드 제거
- 신규 함수 2개: `toggleExpCatChildren(catId)`, `toggleExpMoreCategories()` (dispatcher 호환)
- DB 변경: **없음**

### 보존
- 함수명/DOM ID: `dashSummaryGrid`, `expAccordionBody`, `momSummaryText`, `dashReserveBalanceMini`, `dashPassedLabel`, `dashReserveBalanceAmt`, `nav|sales` 디스패치
- 세그먼트 바 (전체 카테고리 비율 시각화)
- 매출대비 비교 문구 (식자재/인건비 MoM)
- 카테고리 합산 수치 (composite 부모 합계 그대로)

### 검증
- ✅ node --check 통과
- ✅ grep "dailyChart" — destroyChart('dailyChart') 1개 잔존 (chartInstances 없으면 noop, 안전)
- ✅ DB 쿼리 추가 0
- ✅ 헌법 1-5 (기존 기능 보호), 1-6 (정당한 갈아엎기), 1-7 (사장님 명시 답변), 22 (table + tabular-nums) 준수
- ⏳ 골든패스 — 사장님 미리보기 확인 필요

### 헌법 1-6 갈아엎기 근거
- dev_lessons #60(2026-05-06) "항상 펼침" 결정이 한 달 만에 사장님 호소 → 잔재 누적
- "추가만, 수정 금지"(dev_lessons #51) 아닌 정당 갈아엎기

---

## [2026-05-15 (저녁 세션)] 홈 대시보드 1순위 매출 카드 + 일별 캘린더 시트 (대형) ✅ PR #123 머지

### 작업 요약
- 사장님 결정: 앱 정체성 = "오늘 매출 실시간" 1순위. 홈 화면 리디자인.
- I안 (Capacitor 백그라운드 동기화)으로 영구 자동화 진로 결정 — 맥북 도착 후 진행
- 이번 작업: 홈 골격 신설 (코드만 준비, 실시간 자동화는 I안 완성 후)

### 구현 내역
1. **1순위 매출 카드** (`dashTopSalesCard`)
   - 압도적 큰 매출 숫자 (전월 % 비교 없음 — 사장님 결정)
   - 날짜·요일 라벨 (`오늘 매출 · 05.15(목)` 또는 `어제 매출 · 05.14(수)`)
   - 모드 배지 ([실시간]/[마감]) — `dashSaleSource` 따라감
   - 임시 모드 (settle): "📝 오늘 매출 입력 (30초)" 버튼 → 매출 관리 탭 점프
   - 영구 모드 (ups): "업데이트 hh:mm ↻" 표시
   - 매출 영역 클릭 → 일별 매출 캘린더 시트 열림
2. **2순위 순수익/지출 카드** (`dashTodayProfitExpenseRow`)
   - 2열 그리드, 1순위 바로 아래
   - 순수익 (매출 − 지출) · 지출
   - 전월 동일자 % 비교 (`momTxt` 재사용)
3. **일별 매출 캘린더 시트** (`salesCalendarSheet`)
   - 7×N 그리드 (요일 헤더 + 일자)
   - 셀: 날짜 + 매출 (파랑) + 순수익 (+초록/-빨강) — 단위 생략 (만 단위)
   - 자체 월 네비 ‹ › (대시보드 본화면 월과 독립)
   - 상단 요약: 매출 합계 + 순수익 합계
   - 오늘 = 파란 테두리 / 미래 = 점선 / 휴무일 = 회색
4. **기존 카드 5개 모두 보존** — 위치만 아래로 (월요약/예비비미니/주단위/차트/기타매출)
5. **현재 월일 때만 1순위/2순위 카드 표시** — 다른 월에서는 자동 숨김

### 변경 라인 / 함수
- index.html ~280줄 추가 (HTML 50 + CSS 20 + JS 200 + 이벤트 10)
- 신규 함수 3개: `openSalesCalendarSheet`, `moveSalesCalendarMonth`, `renderSalesCalendar`
- 신규 DOM ID 12개 (기존 ID 0개 변경)
- DB: SELECT만 (sales_daily, vendor_orders, receipts, attendance_logs) — 캘린더용 4쿼리 추가
- DB 스키마 변경: **없음**

### 사장님 미리보기 2차 피드백 (같은 PR #123, 2026-05-15 저녁)
1. **매출관리/업솔루션/↓ 토글 제거** — 사장님 안 쓰던 잔재. 자동 모드 판별로 대체 (loadDashboard 시작 시 daily_sales 최근 3일 데이터 체크 → 있으면 ups, 없으면 settle). 이벤트 리스너 3개 제거 (switchSaleSource·manualCrawl·crawlBtn 함수 자체는 ↻ 재사용 위해 보존)
2. **↻ 클릭 가능** — 1순위 카드 안 "업데이트 hh:mm ↻" 텍스트가 영구 모드일 때 클릭 → manualCrawl() 강제 갱신
3. **월 네비 위치 이동** — 1순위 카드(일 단위) 직하단 → dashSettleCont 안 (월 단위 카드 컨테이너 헤더)로 이동. 어디의 네비인지 명확
4. **1순위 카드 순서 변경** — "순수익 → 지출" → **"지출 → 순수익"** (계산 순서대로, 사장님 피드백)
5. **신규 매장/빈 데이터 CTA** — 1순위 카드에 매출 데이터 0건이면 "오늘 첫 매출인가요?" + [📝 매출 입력] [🏖 휴무] 2버튼 표시
6. **캘린더 빈 셀 클릭 → 미니 시트** — 매출 0인 셀 클릭 시 calCellActionSheet 열림 → "매출 입력 / 휴무 / 그대로" 3옵션
7. **휴무 표시** — sales_daily에 source='closed' + memo='휴무' + 결제수단 0원으로 저장 (스키마 변경 X). 캘린더에 🏖 노란 셀로 표시. dashTopSalesCard 빈 데이터 분기에서 lastSaleDay 계산 시 매출 0인 행(휴무) 자동 제외

### 사장님 미리보기 피드백 → 추가 작업 (같은 PR #123)
1. **1순위 카드 통합** — 사장님 피드백 "카드 따로 있으니 어제 거 같지 않고 총 같은 느낌". 1순위 매출 + 순수익 + 지출 한 카드 안에 묶음. 2순위 카드(dashTodayProfitExpenseRow) 삭제. DOM ID 변경: dashTodayProfitAmt → dashTopProfitAmt 등
2. **매출 빠른 입력 시트 신설** (`quickSalesInputSheet`) — 사장님 짚으심: 매출 관리 탭의 매출 추가 시트가 paymentMethods 빈 배열로 input 행 0개 (버그). 마감정산 형식 새 시트 신설로 우회. `QUICK_SALES_METHODS` 5개 (카드/현금/현금영수증/QR/기타) LEGACY 직매핑. sales_daily에 source='manual'로 upsert
3. **입력 버튼 동작 변경** — `dashTopSalesInputBtn` 클릭 시 매출 관리 탭 점프 → `openQuickSalesInput()` 직접 호출

### 헌법 1-7 위반 정정 (사장님 짚으심)
- coder 단계에서 매출 관리 탭 매출 추가 폼이 "코드는 살아있다"고 추측 답변. 실제 스크린샷 보니 paymentMethods 빈 상태에서 input 행 0개. 사장님 미리보기 직접 확인 없이 코드만 보고 답한 게 부적절. → 새 시트로 우회 + 별도 진단(payment_methods 폴백 미작동) 후속

### 후속 작업 (이번 세션과 분리)
- I안 (Capacitor) 본격 시작 (맥북 도착 후, 1~2주)
- I안 완성 후 마감정산 매출 칸 정리 (헌법 1-6, 사장님 짚으심)
- 매출 관리 탭 매출 추가 폼 paymentMethods 폴백 버그 진단 (별도)
- OKPOS 참고: "오늘 들어올 돈" 카드, 빠른 액션 버튼 — 별도 검토
- 캘린더 일별 지출에 고정비 일할 / 로열티 / 카드수수료 추가 정밀화 (현재 변동비만)
- 캘린더 vs 주단위 테이블 중복 정리 (한 달 운영 후 판단)

### 검증
- ✅ node --check (JS 블록 추출 → 구문 OK)
- ✅ 신규 ID·함수 grep 확인 (48 hits)
- ✅ 기존 ID 보존 (17 hits — dashSummaryGrid 등)
- ✅ momTxt·salesRowTotal·dailySalesMap·dailyExpTotal·prevDailySalesMap 등 기존 함수·변수 재사용
- ⏳ 골든패스 테스트 — 사장님이 앱에서 확인 필요 (배포 후)

---

## [2026-05-15 (대형 세션)] 식자재 미궁 → 시간대 → 거래처 FK 갈아엎기 → 카테고리 표시 (PR #109~#121)

### 머지된 PR 13개
| # | 작업 |
|---|---|
| 109 | 고정비 차트 그룹 누락 + 영수증 에러 진단 로그 |
| 110 | receipts.price 42703 → price/count 제거 + mydata 디버그 강화 |
| 111 | docs 정리 (식자재 마이그레이션 + price 제거 기록) |
| 112 | 차트 그룹화 하드코딩 갈아엎기 (헌법 10조 2번) |
| 113 | 시간대 버그 8곳 + 차액 카드 2x2 그리드 + 헌법 1-7 신설 |
| 114 | 거래처 상세 진입 시 다른 거래처 주문 깜빡임 fix |
| 115 | 주문 입력 단가/수량 + 자동 곱셈 (DB ALTER) |
| 116 | 시간대 버그 남은 30곳 일괄 (헌법 11조) |
| 117 | 금액 input 9개 천단위 콤마 일관 적용 |
| 118 | 거래처 카테고리 select 하드코딩 1차 제거 (1단 동적) |
| 119 | 거래처 2단 select + category_id FK 도입 (DB ALTER) |
| 120 | calcExpense·reconciliation·필터 FK 매칭 갈아엎기 |
| 121 | 0원 카테고리도 0%로 차트 표시 |

### 사장님 직접 실행 SQL
1. `expense_categories` 식자재 트리 마이그레이션 (식자재/육류/야채/공산품 → composite, vendor_category 설정)
2. `daily_opening` 5/15 row previous_close_total 정정 (897,100 → 1,109,200)
3. `expense_categories` 주류 카테고리 정상화 (receipts → vendor_orders, vendor_category='주류')
4. `vendor_orders` ALTER — unit_price INT, quantity NUMERIC
5. `vendors` ALTER — category_id UUID FK to expense_categories (ON DELETE SET NULL)
6. `daily_opening` 5/13 row 등 옛 잔재 row UPDATE (있다면 정정)

### 헌법 변경
- **1-7 신설**: 추측 절대 금지 (사장님 도메인 용어 모르면 즉시 grep, 추측 답 금지)

### business_rules.md 추가
- **#10**: 영업개시 생략 가능 + 이월금 fallback (마감→영업개시→마감 vs 마감→마감)

### dev_lessons.md 추가
- **#53**: 추측 답변 신뢰 손상 사례 (물품대금/카드대금/배당금 추정 사건)
- **#54**: `toISOString().split('T')[0]` 시간대 트랩 + `ymdLocal()` 헬퍼

### 핵심 변경 결정사항
1. **카테고리 표준화** — `expense_categories`가 _모든 그룹의 단일 진실의 원천_. 색·이름·순서 사장님 자유 관리. SaaS 매장 가입 시 라벨 자유.
2. **vendors.category_id FK** — 텍스트 매칭 폐기, FK 매칭 일관. 카테고리 이름 변경에도 매칭 안 깨짐.
3. **시간대 헬퍼** — `ymdLocal()` 도입. 모든 `toISOString().split('T')[0]` 제거 (주석 1줄만 보존).
4. **0원 카테고리 표시** — 사장님이 신규 카테고리 추가 후 데이터 없어도 차트 리스트에 등장 (0%).

### 사장님 다음 작업 (영업 중 본인 페이스로)
- 옛 거래처 9개 (식자재 4 + 직구 5) 편집창에서 1개씩 재분류 → category_id 채워짐 → 가마감 식자재 합산 정상화
- 음료 카테고리 활용: 거래처 _음료_로 분류 + 거래처 주문 입력 시 단가·수량·금액

### 미해결 (다음 세션 후보)
- 카테고리 화면의 _데이터 소스_ 라벨 사용자 친화 표현 (옵션 — 사장님이 필요 시)
- `vendorReclassSheet` 옵션 동적화 (지금은 옛 하드코딩 일부 남음)
- 영수증 row 단가/수량 입력 → DB 저장 패턴 정리 (현재 c-u/c-q UI는 있지만 DB 컬럼 없음)
- classification_rules 시드의 '배당' 키워드 (모든 매장 강제) — SaaS 확장 시 정리 필요

---

## [2026-05-15] 식자재 12,594,000원 미궁 추적 + DB 마이그레이션 (대형)

**브랜치**: `claude/dash-fix-fixedgroup-receipt-debug` (PR #109), `claude/receipts-price-fix-debug2` (PR #110)
**규모**: 대형 (DB 마이그레이션 + 코드 fix + 진단)

### 발견 흐름
1. 사장님 신고 — 거래처 등록 7,653,858원(실은 고정비) → 홈 식자재 12,594,000원 (실은 거래처 3,148,500)
2. 코드 흐름 추적 — 식자재 = vendor_orders + receipts. 영수증 0원이면 식자재 ≤ 거래처 합이어야 하나 안 맞음 (미궁)
3. 진단 콘솔 로그 + 영수증 SELECT 에러 화면 노출 (PR #109)
4. 사장님 캡처 — 영수증 42703 (`column receipts.price does not exist`) 확정
5. price 컬럼 제거 + mydata/잔재 디버그 강화 (PR #110)
6. 2차 캡처 — expCategories 29개 (잔재 7개) + expResults에서 식자재 트리 4개 모두 `vendor_orders` source + vendor_category null
7. 원인 확정: 식자재(vendor_orders, vc=null) + 육류/야채/공산품(vendor_orders, vc=null) × 4 → 모든 voRows가 4번 합산 → 3,148,500 × 4 = 12,594,000 ✅

### DB 마이그레이션 (사장님 SQL 실행 완료)
- `expense_categories_backup_20260515` 백업 테이블 생성
- 식자재 (a521efc8): vendor_orders → composite
- 육류 (2750fd26): vendor_orders → composite, vendor_category='육류'
- 야채 (015d4126): vendor_orders → composite, vendor_category='야채'
- 공산품 (7dde5264): vendor_orders → composite, vendor_category='공산품'
- 검증 SELECT 결과 4행 모두 정상

### 부가 fix (PR #109)
- 고정비 차트 그룹화 갈아엎기: `fixedProratedByCat[e.name]` 룩업 → fcRows.category 기준 직접 합산
  - 사장님 "공과금/고정비" 통합 이름이 `fixed_costs.category` 키 ("고정비"/"공과금")와 불일치로 차트 누락되던 버그 fix
- 영수증 에러 화면 노출 (코드+메시지)
- Dashboard 가마감 디버그 로그 추가

### 부가 fix (PR #110)
- 영수증 SELECT/INSERT에서 `price/count` 키 제거 (DB 컬럼 없음, 42703 원인)
- docs/db_schema.md receipts 컬럼 정정

### 남은 일 (다음 세션)
- 사장님 거래처 2곳 카테고리 확인 (옛 '식자재'면 재분류 필요)
- 디버그 콘솔 로그 제거 (`[DASH-DEBUG]`) — 진단 끝났으니 정리
- 잔재 카테고리 7개 정리 검토 (식자재(주류)/쿠팡/옛 income 5개/물품대금)
- dev_lessons 추가: "DB 컬럼-문서 불일치 의심 시 진단 SELECT 먼저"

---

## [2026-05-14 후속] 차액 확인 카드 헤더 토스화 + 월별 네비 (소형)

**브랜치**: `claude/improve-deadline-ui-2m897`
**규모**: 소형 (UI 헤더 + 월별 offset state)

### 변경
1. 헤더 단순화 — 짜친 11px 라벨/이모지 배지/서브설명 모두 제거. "차액 확인" 타이틀 + 우측 월 네비게이터(‹ 5월 ›) 한 덩어리
2. `loadDiffTable()` 기간: 최근 30일 → 월별 (offset state `_diffTableMonthOffset`)
3. `shiftDiffTableMonth(±1)` 함수 추가 — `data-action="shiftDiffTableMonth|-1"` dispatch
4. 미래 차단: offset>0 무시, next 버튼 시각 비활성화(opacity 0.3)
5. 칩 라벨: 이번달=`5월`, 과거=`2026.04` (헷갈림 방지)
6. 빈 상태 문구 동적: "이번달 마감 데이터 없음" / "2026년 4월 마감 데이터 없음"

### 사장님 피드백 반영
- 🛡 이모지가 OS에서 깨져 보임 → 아이콘 배지 통째로 제거
- "도난·실수 감지 · 매일 0원이 정상" 서브설명 제거 (잔소리)
- 월별 왔다갔다 보고 싶다 → 토스 토글 패턴(‹ 월 ›)

### 검증
- node --check 통과
- 인라인 onclick 사용 안 함 (data-action 디스패처 사용, dev_lessons 컨벤션 준수)
- 헌법 1-5 준수 (함수명·DOM ID 그대로: `loadDiffTable`, `diffTableBody`, `diffTableSummary`)

### 검증
- node --check 통과
- grep "최근 30일" 잔재 0 (주석 1건만 변경 이력용 잔존)
- 헌법 1-5 준수 (함수명·DOM ID 그대로: `loadDiffTable`, `diffTableBody`, `diffTableSummary`)

---

## [2026-05-14 오후~심야] hub UI 정비 + 차액 표 + 마감정산 지출 분리 (대형 세션)

**브랜치**: `claude/update-business-icons-AYKCB`
**PR**: #74~#100 (28개 squash 머지) — 한 브랜치 누적
**규모**: 대형 (UI 전반 + 차액 무결성 표 신규 + 마감 데이터 구조 변경 + 헌법 3-1 신설)

### A. CLAUDE.md 제3조 3-1 신설 — 아부 금지·사장님 틀릴 수 있음
사장님 명시 — "아부 떨지 말고, 내가 틀릴 수 있음을 항상 고려해야함".
- 사장님 의견 무조건 동조 X, critic 정신
- 동의 안 할 때 솔직 반박 + 근거 + 대안
- 단, 단순 반대 금지 — 근거 기반 책임감 있는 의견

### B. 개시·마감 hub 아이콘 시리즈 (PR #74~#79)
- 저금통/지갑 → 해/달 SVG → OPEN/CLOSE 글자 (사장님 결정 흐름)
- 색상 부활: 영업개시 주황(#F59E0B) / 마감정산 인디고(#6366F1)
- 글자 12px/weight 900, 카드 가운데 정렬, sub 라인 제거 (amt와 중복)

### C. 거래처 hub 카드 sub (PR #80)
- '주문 N건' → 'N곳' (다른 카드 패턴과 통일, 거래처 수 정보가 더 직관)

### D. 고정비/공과금 분리 + 지출 hub 보강 (PR #81~#82)
- DB: `expense_categories` '공과금' INSERT (data_source='fixed_costs', sort_order=8)
- DB: `classification_rules` UPDATE (한국전력/가스/관리비 → '공과금')
- DB: `mydata_transactions` 과거 자동분류 동기화 (description+sub_category)
- 신규 컬럼 0건 (기존 `fixed_costs.category` 활용)
- hub 카드 3개 추가: 로열티 / 마케팅 / 세금
- 로열티 전용 화면 (`royaltyCont`): 매출 × 요율 + 월별 12개월 표
- 차트 그룹 분리: groupMap/groupOrder/mGroupColors → 고정비·공과금·로열티·마케팅·세금 별도
- 가마감 일할계산 카테고리별 분기 (`fcByCatMonthly`)
- 로열티 화면 단순화: 상단 3섹션(매출/예상/요율 input) + 월별 4열 표(월/매출/요율/금액), 실제 출금·차액 컬럼 제거 (정산 대조와 중복)

### E. 지출 hub UI 정비 (PR #83~#88)
- 신규 SVG: i-megaphone, i-document, i-arrows-lr
- 아이콘 교체: 고정비 home→calendar / 마케팅 coins→megaphone / 세금 receipt→document / 정산대조 coins→arrows-lr
- i-settings 진짜 톱니바퀴로 교체 (옛 정의가 사실 해 모양이었음, 사장님 짚음)
- hub 구조: 카테고리 그리드(거래처/고정비/인건비/로열티/마케팅/세금) + 도구 hub-full(계좌·카드/정산 대조/카테고리 관리)
- 예비비 카드 제거 (홈 미니 행과 중복 — 사장님 짚음)
- 라벨 정정: '계좌·카드'→'계좌내역·카드내역', '정산 대조 sub'→'예상 vs 실제 매출·지출 대조', '카테고리 관리'→'수입·지출 카테고리 관리'
- 카테고리 그리드 드래그 reorder (SortableJS long-press 300ms)
- DB: `store_settings.exp_hub_order` text 컬럼 신규 (사장님 ALTER 실행)

### F. 마감정산 지출 카드 분리 + 차액 표 (PR #89~#100)
**마감정산 화면**:
- 옛 '차감' 카드 → 🏧 통장 입금 / 💵 현금 지출 2개 카드로 분리 (사장님 직관: "통장입금은 지출이 아니라 이동")
- 컨테이너: `#settleDeductBankRows` / `#settleDeductEtcRows`
- type select 제거 (컨테이너로 자동 결정, data-type 보존)
- 호환: `items_json.deductions[]`·`deduct_etc`·`deduct_bank` 그대로 (book 계산 동일)

**차액 표 (busHubCont)**:
- 사장님 운영 흐름 반영: 전날 마감(필수) → 당일 영업개시(생략 가능) → 당일 마감(필수)
- 영업개시 생략 시 전날 마감 기준 자동 계산
- 토스 스타일: 3카드 한 줄(총 차액·통장입금 합·현금지출 합), 표 4컬럼(날짜/통장입금/현금지출/차액)
- 행 padding 7px, 폰트 12px, 한 화면 31일 가시
- 날짜 오름차순 (옛날 위, 오늘 아래)
- 날짜 셀 중앙, 화폐 셀 우측 정렬 (헌법 3-1 — 사장님 짚음, 표 표준)
- 0 표시 → `-` (엑셀 회계 서식)
- ±1,000원 이상만 차액 빨강 + ⚠
- 가로 스크롤·펼침·진입 버튼 모두 제거 (사장님 의도)
- DB 변경 0건 — `daily_opening.actual_total/previous_close_total` + `settlements.diff_amount/items_json` 그대로 활용

**기타 버그 수정**:
- `loadOpeningAmount` 시스템 today 고정 버그 → picker.value(settle_date) 기준 (PR #90)
- `initOpeningDate` 시 status·`openingEditDate` 잔재 → reset 추가 (PR #91)

### G. 사장님 직관 점검·반려한 안 (헌법 3-1 적용)
- "지출 hub로 다 펴바르기 동적" → 사장님 본인이 "변동되는 게 불편" 짚어 반려
- 마감정산 화면 매출/시재 분리 → 사장님 자각: "현금 상세가 시재 점검 인풋" → 분리 안 함
- 영업개시 효용 모호 호소 → 옵션 B 유지 결정 (보험 가치)
- 차액 표 정렬 — 처음 중앙으로 갔다가 사장님 짚음 → 숫자 우측 정렬로 정정

### H. 사장님이 가르쳐준 비즈니스 흐름
- 마감정산 = 매출 입력 + 시재 점검 (분리 불가, 현금 매출이 시재 인풋)
- 영업개시는 생략 가능, 마감정산은 필수 누락 시 다음날에라도 입력
- 인계 차액(밤사이) vs 마감차액(영업 중) — 별도 의미, 합쳐서 총 차액
- 가짜 지출로 차액 메우는 위험성 — 시스템 무결성 한계

### 검증
- 28개 PR 각각 node --check 통과, grep 잔재 0건
- 사장님 매장(논산점) 실데이터 검증 완료
- 헌법 11조 대규모 변경 절차 준수 (백업 커밋·검증·문서화)

---

## [2026-05-14] 고정비/공과금 분리 + 지출 hub 카테고리 보강 (로열티 전용 화면)

**브랜치**: `claude/update-business-icons-AYKCB`
**규모**: 대형 (DB 변경 + 광범위 UI + 신규 화면)
**계기**: 사장님 — "고정비와 공과금을 분리해야겠어. 고정비=월세 같은 고정 금액, 공과금=전기세 같은 변동 금액". 추가로 hub에 로열티/마케팅/세금 카드 누락 발견.

### 1. DB 변경 (사장님 Supabase 직접 실행 완료)
- `expense_categories` INSERT: '공과금' 카테고리 (data_source='fixed_costs', color #FB923C, sort_order=8)
- `classification_rules` UPDATE: 한국전력/가스/관리비 키워드 → '공과금' 카테고리
- `mydata_transactions` UPDATE: 과거 자동분류 데이터 동기화 (sub_category IN ('전기요금','가스요금','관리비') OR description ILIKE '%한국전력%' etc)
- **컬럼 신규 추가 0건** — 기존 `fixed_costs.category` 활용 (옵션에 '공과금' 추가만)

### 2. UI 변경 (코드)
**고정비 등록 시트** (라인 2971~)
- 옵션 4개: `고정비/공과금/마케팅/세금` (기존 '로열티' 제거)
- 안내 라벨: "유형 (어느 카테고리로 집계할지)"

**고정비 리스트 뱃지** (라인 7315~)
- 컬러 뱃지 CSS 5종: `.fc-badge-fixed/utility/marketing/tax/hidden`
- `FC_BADGE_CLASS` 매핑

**지출 hub 카드 3개 신규** (라인 1214~)
- 💼 로열티 → `nav|royalty` (신규 화면)
- 📣 마케팅 → `goCategoryDetail|마케팅` (expcat + 하이라이트)
- 🧾 세금 → `goCategoryDetail|세금`

**로열티 전용 화면 (`royaltyCont`)** — 신규
- 상단 요약: 이번달 매출 / 요율 / 예상 / 실제
- 표: 최근 12개월 [월/매출/요율/예상/실제/차액]
- 데이터: `sales_daily` × `store_settings.royalty_rate` + `mydata_transactions` (sub_category='로열티' OR description ILIKE '%유림에퐁당%')

### 3. 로직 변경
**`loadDashboard` 일별 카테고리 분배** (라인 6300~6440)
- `_dailySrcs`에서 fixed_costs 제외 → `fixedCats` 별도 처리
- `dailyFixedShareByCat` 카테고리별 일할 (고정비/공과금)
- `fcByCatMonthly`, `fixedProratedByCat` 신규

**차트 그룹** (라인 6620~6660)
- `groupMap.fixed_costs`: '공과금/고정비' → '고정비'
- `nameGroupMap`: 주류/공과금/마케팅/세금 → e.name 우선 매핑
- `mGroupColors`/`groupOrder`: '공과금', '마케팅', '세금' 그룹 추가, 색상 분리

**`calcExpenseByCategories`** (라인 8870~)
- `needFc=true` 무조건 (manual 카테고리 마케팅/세금도 fc 합산)
- SELECT에 `category` 컬럼 추가
- fixed_costs 분기: `cat.name`과 `r.category` 매칭
- manual 분기: ecaSum + fcMatchSum 합산

**`loadExpHubData`** (라인 10510~)
- 고정비 카드: fixed_costs 카테고리별 분기 (고정비+공과금 합산 표시)
- 로열티 카드: sales × 요율 자동 계산
- 마케팅/세금 카드: `renderCatCard` (ECA + fc 합산)

**`loadExpCategories`** (라인 8146~)
- `window._expcatPreselect` 외부 진입 시 자동 스크롤·하이라이트 (#FEF3C7, 2초)

**`goCategoryDetail`** — 신규 글로벌 함수
- 카테고리명 전역 변수 저장 후 nav('expcat')

**라우팅** (라인 3220~3324)
- `parentTabMap.royalty='expHub'`
- `actions.royalty=loadRoyaltyPage`

### 4. 검증
- node --check 통과 (492K chars)
- grep 잔재 0건 ('공과금/고정비' 옛 라벨 제거 확인)

### 5. 골든패스 (사장님 확인 필요)
- 지출 hub에 로열티·마케팅·세금 카드 3개 보임
- 로열티 카드 amt = "매출 × 요율" 표시, 클릭 시 월별 12개월 표
- 마케팅·세금 카드 클릭 → expcat 진입 + 카테고리 자동 하이라이트
- 사이드 → 고정비 관리: 항목별 컬러 뱃지 (회색/주황/분홍/갈색)
- 등록 시트에 '공과금' 옵션 있음 ('로열티' 옵션 없음)
- 대시보드 차트: '고정비'·'공과금' 두 색으로 분리

### 6. 다음 작업 (사장님 한 번 분류)
- 사이드 → 고정비 관리에서 기존 항목 중 변동성 있는 것(전기·가스·수도·관리비 등) "공과금"으로 편집
- fixed_costs.category='로열티' 항목이 있었다면 다른 카테고리로 이동 또는 비활성 (자동계산 중복 방지)

---

## [2026-05-13 심야] 개시·마감 허브 아이콘 — 해/달 → OPEN/CLOSE 글자

**브랜치**: `claude/update-business-icons-AYKCB`
**PR**: #74 (해/달 squash 머지) → #75 (OPEN/CLOSE 글자 squash 머지)
**규모**: 소형 2연속 (UI 아이콘 교체)

### 1차 (PR #74): 해/달 SVG
- 사장님 — "해 달 아이콘 좋았는데 색상은 통일?"
- 조사 결과 git 히스토리에 해/달 SVG는 한 번도 없었음. 5/12 6f2ffbb에서 도트→저금통/지갑 통일. 색상(주황·인디고)이 무의식적으로 해/달 인상 유발한 것.
- advisor A안 채택: 색상은 의미 매핑(아침·저녁)이라 그대로, 아이콘만 sun/moon SVG.

### 2차 (PR #75): OPEN/CLOSE 글자
- 사장님 — "그냥 이거 OPEN CLOSE 이모지 없나?" → 표준 유니코드 이모지에는 사인보드 OPEN/CLOSED 없음 안내.
- AskUserQuestion 3안 중 "OPEN/CLOSE 글자" 선택.
- 구현:
  - `.hub-mini-text` CSS 추가 (10px 흰 글자, weight 800)
  - 1차에서 추가했던 i-sun/i-moon symbol 제거 (잔재 방지, 헌법 11-7)
  - 영업개시 → "OPEN", 마감정산 → "CLOSE"
- 색상은 주황·인디고 유지 (사장님 마음 바뀌면 초록·빨강으로 1초 교체 가능 안내)

### 발단
사장님 — "영업개시·마감정산 아이콘 바뀌었네? 해/달 좋았는데. 색상은 통일?"
조사 결과 git 히스토리에 해/달 SVG는 없었음. 5/12 PR(6f2ffbb)에서 도트→저금통/지갑으로 변경된 게 사장님 기억 속 "해/달"의 정체였음 (서브 라벨 "아침 금고"·"저녁 정산" + 주황·인디고 색상이 무의식적 연상).

### 결정 (advisor A안)
- 아이콘: **저금통 → 해(i-sun)** / **지갑 → 달(i-moon)**
- 색상: 그대로 (주황 #F59E0B / 인디고 #6366F1) — 의미 매핑 유지
- 통일 X: 색상 통일은 카드 간 구분력을 떨어뜨려 거부

### 변경 범위
- `i-sun`, `i-moon` SVG symbol 신규 추가 (Lucide 스타일, stroke-width=2)
- `busHubCont`의 영업개시·마감정산 카드 `<use>` 2곳 교체
- **유지**: nav-bar "개시·마감" 통합 탭(piggy), 예비비 카드(piggy), 예비비 사용 이력 sheet-title(piggy)

### 검증
- node --check 통과 (script 블록 484K chars)
- grep 잔재 확인: i-sun/i-moon 정의 1개씩, use 1개씩 정확 매칭

---

## [2026-05-13 야간 후반] 영업개시 옛 차감 잔재 정리 + 4월 테스트 데이터 삭제

**브랜치**: `claude/cleanup-opening-deductions`
**PR**: #71 (머지 완료, #70은 옛 브랜치 충돌로 닫음)
**규모**: 중형 (코드 정리 + 데이터 삭제, DB 스키마 변경 없음)

### 1. 영업개시 옛 차감 코드 잔재 제거 (PR #71)
- 사전 점검 결과: `daily_opening.deductions` 컬럼이 이미 DB에서 사라진 상태 (docs와 불일치)
- 5개 함수에서 `deductions` SELECT 참조 제거: `loadOpeningPage`, `saveOpening`, `loadOpeningList`, `loadSettleList`(calcOpDiff), `loadSettleCard`
- UI 삭제: "⚠️ 이 날짜의 옛 차감 기록 (참고용)" 카드, "⚠️ 옛 차감" 행, 마감 카드 영업개시 차감 표시, `opLegacyDeductions` 빈 DOM
- 영업개시 차액 계산 단순화: `actual_total - previous_close_total`
- docs/db_schema.md daily_opening 표기 동기화
- 변경: 17 ins / 62 del, node --check 통과, grep 잔재 0건

### 2. 4월 테스트 데이터 삭제 (사장님 Supabase 직접 실행)
- 매장: 퐁당샤브 논산점 (`4ae03341-e5dc-4933-b746-29728cbc685f`) — 사장님 유일 운영 매장
- 점검 결과 → DELETE 한정: 7개 테이블 242건 (mydata_transactions 214, fixed_cost_amounts 16, attendance_logs 8, reserve_fund_logs 2, settlements 2, sales_daily 1, work_schedules 1)
- mydata 214건: 자동 수집 거래지만 사장님 결정 "테스트 단계 → 삭제 OK"
- fixed_cost_amounts는 fixed_costs.store_id 간접 한정 (서브쿼리)
- 결과 확인 SELECT: 모두 0
- 효과: 사장님 확인 "어색한거 없고 이상한 증감률 알림 사라짐" — 코드의 `prev===0 → return null` 분기가 5월 단독 화면 자연스럽게 처리

### 보류 (사장님 명시)
- 베타 매장 5개 오픈 전 인프라 점검 1주 계획 — "기능적으로 내가 납득된 후에"
- 수익화 전략(소>대 + 외식업 1년 특화 + 월 1.5만원) 의논 결과 — 공식 기록 미정

---

## [2026-05-13 야간] 홈 N+1 정리 + 라벨 통일 + 영업개시 차감 통합 (헌법 1-6)

**브랜치**: `claude/continue-session-cKTQ4`
**규모**: 대형 (홈 성능 + UI 일괄 + 영업개시 갈아엎기)
**PR**: #66 (N+1) · #67 (수동 뱃지) · #68 (nav 라벨) · 이번 (영업개시)

### 1. 홈 N+1 쿼리 정리 (PR #66)
- 캡쳐 측정: 홈 진입 시 supabase 호출 44건 / 3초 → 약 15건 / 1초
- `calcExpenseByCategories(ym, mode, prefetched)` — 카테고리별 vendor_orders/receipts/fixed_costs/eca/attendance 반복 호출 → loadDashboard에서 prefetch 후 메모리 필터
- 두 Promise.all 통합 + 일별 분배에 재사용
- `renderExtraRevenueDashboard` extra_revenue_logs 2회 → 1회 (월별/누적 JS 분리)

### 2. 라벨 통일 (PR #67, #68)
- 거래처 주문 카드 `manual`→`수동`, `upload`→`업로드` (디버깅 잔재 한글화)
- nav-bar: 홈 / **근태관리** / **개시·마감** / **지출관리** / 더보기 (사장님 의견 "영업이 뭔지 직관 X")
- `.nav-item white-space:nowrap` 보강

### 3. 영업개시 차감 통합 — 헌법 1-6 정당한 갈아엎기
**발단**: 사장님 — "마감정산 수정 화면에서 차감 편집·삭제 안 된다" → "영업개시는 기록조회·수정 화면 자체가 없다" 짚어줌

**결정**: 영업개시에서 **차감 입력 제거** + **기록조회/수정/삭제 화면 추가**. 차감은 마감 한 곳에서만.
- 사장님 명시: "맨날 차감 입력하긴 한다. 근데 마감 한 번에 체크하는 게 맞아보임"
- 도난 감지(차액 자동 계산)는 그대로 유지 — `actual - previous_close_total`로 단순화
- 옛 차감 데이터는 read-only로 표시("저장 시 사라짐" 안내)

**변경 내용**:
- `openingCont`에 sub-tabs (`오늘 영업개시` / `기록 조회`) 추가
- 차감 카드 UI 제거 + 차액 메모 1줄 추가
- 마감 화면 파란 박스(`#settleOpDedReadonly`) 제거 + `loadOpeningAmount` 박스 채움 코드 삭제
- 새 함수: `openingTab`, `loadOpeningList`, `editOpening`, `deleteOpening`, `initOpeningDate`, `moveOpeningDate`
- `loadOpeningPage(dateStr)` — 날짜 인자 지원 (수정 모드)
- `saveOpening` — `deductions=[]` 빈 배열 + memo 저장, 수정 모드 토스트 분기
- 옛 함수 삭제: `addOpDeductRow`, `removeOpDeductRow`, `onOpDedAmountInput`, `getOpDeductTotal`
- `daily_opening.deductions` 컬럼 DB는 그대로 유지 (옛 데이터 보존)

**FK 안전**: `daily_opening`을 참조하는 다른 테이블 없음 → 삭제/수정 안전
**호환성**: `loadSettleList` calcOpDiff / `loadSettleCard`의 영업개시 차감 표시는 옛 데이터용으로 유지

### 검증
- node --check 통과
- grep 잔재 0건 (`addOpDeductRow`/`opDeductRows`/`settleOpDedReadonly` 등)
- 골든패스: 오늘 영업개시 입력·저장 / 어제 [수정] → 메모 편집 → 저장 / 카드 [삭제] / 마감 화면 파란 박스 사라짐

### 보류 / 다음 세션
- 옛 영업개시 차감 데이터가 많은 매장: 수정 진입 시 read-only 안내. 사장님 결정에 따라 마이그레이션 SQL 가능
- 영업개시 [기록 조회] 표 디자인은 마감 통합표(`settleList`)와 일관성 검토 가능

---

## [2026-05-13 후반] 자정 넘는 근무 입력·표시 + 영업일 회전 + 거래처 짬뽕 해소

**브랜치**: `claude/unify-schedule-registration-aa920`
**규모**: 대형 (DB 변경 + 광범위 UI + 거래처 모듈 재정렬)
**PR**: #62, #63, #64 (3개 자동 머지 완료)
**발단**: 사장님 — 근태 기록 수정에서 마감조 저장 시 "퇴근이 출근보다 빠르다" 차단. SaaS 확장 의향 → 시간 모델 일반화 필요. + 거래처 화면 짬뽕 호소.

### A. 시간 모델 일반화 (영업일 회전 — Phase 1)
1. **근태 기록 수정 시트**: `<input type="time">` → `<input type="datetime-local">`
2. **출퇴근 사후 등록**: 퇴근 시각 ≤ 출근 시각이면 자동 +24h (익일 처리). 24h 초과 차단. 토스트에 "익일 HH:MM 퇴근으로 처리" 명시
3. **간트차트 영업일 회전축**:
   - `GANTT_START=9, GANTT_END=22` → `6, 30` (24시간)
   - 자정 넘는 일정/근무 4곳 모두 `eH<sH → eH+=24` 자동 보정
   - 자정선 점선 빨강 (`.gantt-bar-area::after`, 축 75%)
   - 시간 라벨 3시간 단위, 자정(0) 빨강 굵게, 자정 이후 -24 (25→01)
   - 자정 이후 영역 옅은 파랑 배경
   - 자정 넘는 일정 라벨에 "(익)" 표시
4. **출퇴근 기록 화면 헤더(line 4350)도 동일 패턴 통일** (옛 25,26,27 잔재 제거)

### B. 영업일 경계 DB 도입
- 사장님 결정: 영업일 시작 시각 = **익일 06:00** (업계 표준)
- `store_settings.business_day_start_hour SMALLINT DEFAULT 6` 컬럼 추가 ✅ (사장님 SQL 실행 완료)
- `attendance_logs_backup_20260513` 백업 테이블 생성 ✅
- **다음 단계 보류**: 매장 설정 UI 입력란(ⓒ), 출퇴근/CAPS 영업일 계산(ⓓ), work_date 마이그레이션 SQL

### C. 거래처 화면 짬뽕 해소
1. **거래처 상세 드롭다운(`orderVendorFilter`) 숨김** — 헤더와 짬뽕 원인. 전환은 ‹ 목록으로
2. **vendors 캐시 stale 방지** — `openVendorDetail`에 `await loadVendors()` (사장님이 거래처를 "네이버/직구" → "롯데칠성/주류"로 변경한 게 클라이언트 메모리 안 갱신됨. SQL 진단으로 확인)
3. **주문 [편집] [🗑 삭제] 버튼 추가** — `openEditOrderSheet`, `deleteOrder` 신규. `saveOrder`에 `editOrderId` 분기
4. **주문 입력 시 거래처 고정** — 거래처 상세에서 입력할 때 셀렉트 숨김. 시트 제목에 "주문 입력 — 롯데칠성 · 주류" 명시. `currentVendorDetailId` 전역 변수 도입
5. **편집 시 거래처 변경 불가** — 잘못 입력했으면 삭제 후 재등록

### D. 운영 방식 변경 (사장님 명시 요청)
- 사장님이 매번 GitHub 들어가서 머지 버튼 누르는 게 귀찮다 호소
- 이번 세션부터 **푸시 → PR 생성 → 자동 머지까지 Claude가 처리**
- 사장님은 1~2분 후 production에서 강력 새로고침으로 확인만
- DB 변경 같은 위험한 케이스만 사전 알림

### 검증
- 모든 PR `node --check` 통과
- grep 잔재 0건 (옛 25,26,27 라벨, 거래처 드롭다운 노출, vendor 셀렉트 노출)
- mockup HTML 추가 (`docs/mockups/gantt_compare.html`) — 안 A/B/C 비교

### 보류 / 다음 세션
- 매장 설정 UI에 영업일 경계 시각 입력란 (ⓒ)
- 출퇴근/CAPS 저장 시 work_date를 영업일 기준으로 계산 (ⓓ)
- `attendance_logs.work_date` 마이그레이션 SQL (자정~06시 출근 기록의 일자 이동)
- 간트차트 본격 디자인 개선 (사장님 "보기 힘듦" 호소)
- 거래처 화면 "싹다 점검" (사용자 관점 본격 점검)

---

## [2026-05-13] 근태/근무계획 통일감 — 라벨 + 셀 동작 정렬

**브랜치**: `claude/unify-schedule-registration-aa920`
**규모**: 중형 (어제 PR #52 갈아엎기 동반, DB 변경 0, 4개 위치 ~10줄)
**발단**: 사장님 — "근무계획도 근무기록처럼 달력아래 +직원 누르고 등록할 수 있게 통일감 살리고, +직원이 아니고 +일정등록으로 하는게 사용자가 보기에 좋지 않을지"

### 작업 내용
1. **라벨 통일**: 양쪽 일별 상세 헤더 `＋ 직원` → `＋ 일정등록`
   - 근태 일별상세: 빈 날(4317) + 일정 있는 날(4330) 2곳 (관리자만, 현행 권한 유지)
   - 근무 계획 일별상세: 헤더 [＋ 일정등록] 신규 추가 (4769, 권한 가드 없음 — staff 본인 일정 등록 가능)
2. **근무 계획 셀 탭 동작 변경 (PR #52 갈아엎기)**:
   - 변경 전: 셀 탭 → `openSchedSheet(date)` 직행 (시트 바로 뜸)
   - 변경 후: 셀 탭 → `pickSchedDay(date)` (일별 상세 표시만, 4745)
   - 등록은 헤더 [＋ 일정등록]으로 일원화 → 근무 기록과 100% 동일 패턴
3. **변경 함수**: renderAttDayDetail / renderSchedCalendar / renderSchedDayDetail (3개)

### 라벨 판단 근거
- "직원"은 사이드→직원관리 "직원 추가" 시트와 명사 충돌 (같은 단어 다른 의미)
- "일정등록"은 행동 중심 라벨로 사용자 멘탈 모델 일치
- 두 화면(사후/사전 등록)이 의미는 다르지만 동일 라벨로 사용자 화면 맥락이 명확히 구분해줌

### 트레이드오프 수용
- 근무 계획 등록 경로 1탭 → 2탭 (셀 탭 → 일별상세 → [＋])
- 사장님 통일감 우선 결정. dev_lessons #69 기록 (다음 세션이 또 뒤집지 않게)

### 검증
- node --check 통과
- `＋ 직원` 잔재 grep 0건
- pickSchedDay 함수 재사용 (이미 line 4754 존재, 추가 작성 X)
- openSchedSheet는 [＋ 일정등록] + 일정 카드 [편집] + 시트 갱신용으로 정상 호출 유지

### 다음 세션 회귀 포인트
- 누군가 "왜 셀 탭이 바로 시트로 안 가지?" 의문 가지면 → dev_lessons #69 안내
- 라벨 "＋ 일정등록" 위치는 4317·4330·4769 3곳 (변경 시 동기화)

---

## [2026-05-13] 종합 세션: 영수증 FK 검토 → 토스 스타일 nav + 허브 → 근태/근무계획 통일

**브랜치**: `claude/check-receipt-category-fk-AtZHf` (PR #31~#56, 26개 머지)
**규모**: 대형 (다중 PR 단계 진행, DB 변경 0)

### 영수증 분류 + FK
- PR #31, #32: 영수증 분류 칸 텍스트 → 셀렉트 → 바텀시트 picker로 통일
  - 카테고리 매칭 안 되면 ⚠ 옵션으로 보존
  - 금액 입력 천단위 콤마 자동
  - 기록내역 400 에러 진짜 원인: select에 `count` 컬럼 (PostgREST 충돌) 제거
- FK 활용처 전수 검토: composite/receipts data_source 모두 정상

### 시점 미리보기 토글 (viewAs)
- PR #33: 사장(owner/franchise_admin)이 점장/직원 시점 미리보기
  - 변수 분리: `realAuthLevel` / `authLevel` / `viewAsLevel`
  - `recalcPermissions()` 단일 진입점
  - VIEWAS-START/END 마커 (제거 가이드 dev_lessons #46)

### nav-bar 토스 스타일 + 허브
- PR #34: nav 5칸 사장 / 4칸 직원 (홈/근태/영업/지출/더보기 + 영수증/내정보)
- PR #35: staff-only 분기 핫픽스
- PR #36: 사이드 "지출 관리" 통째 삭제 (지출 탭으로 일원화) + 영수증 등록 안내
- PR #38: 바텀시트 숨김 패턴 transform 통일 (직원 추가 잔재 노출 버그)
- PR #41~#46: 허브 D안 (영수증 큰 카드 → 흰 카드, 그리드, 동적 정보, 컬러 도트→원형 SVG, 톤 통일, 폰트/색/여백 조정, 영업 미완료 빨강·완료 초록)

### 거래처 화면
- PR #37: sub-tab 4→3 (주문 내역 sub-tab 제거, 카드 누르면 주문 내역 진입)
- DB 변경(vendor_orders.category 추가) 검토 → **보류** (식당 거래처 대부분 단일 카테고리, 만물상은 영수증으로 처리)

### 대시보드 토스 스타일
- PR #39 시범 → PR #40 롤백 (사장님 옛 표가 더 와닿는다 판단)

### 근태 / 근무 계획
- PR #47: 근태 본인 모드 이번주 간트 숨김 (월 달력과 중복 정보)
- PR #48: 근무 기록 빈 날 진입 통일 (달력 + 제거, 일별 상세에서 [+ 직원])
- PR #49: 근무 계획 레이아웃 → 근무 기록과 동일 패턴 (월 달력 + 일별 상세)
- PR #50: 근무 계획 빈 셀 [+] + KPI 인건비 단위 ("85" → "85만원")
- PR #51: 직원 선택 시트가 부모 시트까지 닫던 버그 fix
- PR #52: 근무 계획 셀=시트 통일 (모든 셀 탭 = 시트 진입) + 삭제 기능 추가
- PR #53: empSheet sheet-overlay로 감싸 모달 처리 (z-index 6100)

### 영업 탭 + 매출 진입
- PR #54: 영업 탭 매출 일별 카드 제거 → 2칸 그리드. 홈 매출 행 자체가 클릭 (토스 스타일 — 잡 버튼 없이)
- PR #55: 매출 진입 시 nav-bar 홈 active 유지 (parentTabMap['sales']='dashboard')
- PR #56: 매출 일별 화면 [‹ 홈] 뒤로가기 추가

### 사용자 의견 거절·수정
- 카테고리 그룹핑 (만물상 케이스 거론, DB 변경 부담)
- 대시보드 토스 시범 (옛 표가 낫다고 판단)

### 검증
- node --check 모두 통과
- 핫픽스 1회 (PR #35), 롤백 1회 (PR #40)

### 다음 세션 TODO (2026-05-13 마감 시점)

**사장님 액션 필요**:
- [ ] 거래처 옛 분류(식자재/직구) → 새 분류(육류/야채/공산품) **재분류** 직접 실행
  - 거래처 화면 상단 [🔄 재분류] 버튼으로 가능
  - 사장님 캡쳐에 "직구" "식자재" 거래처가 옛 분류로 남아있음

**보류된 작업**:
- [ ] AI 분석 자동 재시도 (Gemini "high demand" 에러) — 사장님이 보류 결정. 자주 발생하면 재검토.
- [ ] 거래처 화면 카드 안 미니 정보 (안 A/B/C 중 결정) — 사장님이 더 생각 후
- [ ] vendor_orders.category 컬럼 추가 — 보류 (식당 케이스 영수증으로 처리)
- [ ] 다른 화면들 뒤로가기 통일 (영업개시·마감정산·거래처·고정비·인건비 등)
- [ ] 대시보드 토스 스타일 (롤백됨, 사장님 추후 재검토 시)

**자주 마주칠 회귀 포인트**:
- 시점 토글 (`viewAsLevel`) — 미래 제거 시 dev_lessons #46 절차
- 이모지 절제 정책 (dev_lessons #45) — 새 메뉴/UI 추가 시 위배 안 되게
- standalone .sheet 패턴 (dev_lessons #49) — 시트 안 시트 호출 시 sheet-overlay 강제

---

## [2026-05-12] 거래처 화면 UI 단순화 (Phase 2C)

**브랜치**: `claude/check-receipt-category-fk-AtZHf`
**규모**: 중형. DB 변경 없음 (사장님이 만물상 케이스는 영수증으로 처리 결론).
**발단**: 사장님 — "거래처 목록과 주문 내역을 합칠 수는 없는지" + "만물상은 vendors.category 단일이라 한계" → DB 변경 보류, UI만 단순화

### 작업 내용
1. **sub-tab "주문 내역" 제거** (4개 → 3개: 거래처 / 파일 업로드 / 대조 & 단가)
2. **거래처 카드 재설계**: 카테고리 작은 라벨 + 거래처명 + 이번달 합계·건수. 카드 전체가 클릭 가능 `›` 표시
3. **이번달 거래처별 합계 캐시** `vendorMonthTotals`: `loadVendors` 시 한 번 조회 → 카드에 표시
4. **상단 월 합계 헤더**: 카테고리 필터 결과 기준 총액·건수
5. **거래처 상세 진입**: 카드 누르면 → 주문 내역 패널로 이동 + 그 거래처 미리 선택 + 헤더에 거래처 정보 표시
6. **상세 패널 헤더**: [‹ 목록] · 거래처명/카테고리 · [편집] [거래종료/재개] 버튼
7. **목록 복귀 시 헤더 초기화**

### 만물상 케이스 처리
- 한 거래처가 여러 카테고리 파는 경우 (삼성웰스토리 등)
- DB 변경 없이 영수증 등록으로 처리 권장 (영수증은 품목별 카테고리 분리 가능)

### 검증
- node --check 통과
- sub-tab 4개 → 3개

---

## [2026-05-12] 사이드메뉴 "지출 관리" 통째 삭제 + 영수증 안내 (Phase 2B)

**브랜치**: `claude/check-receipt-category-fk-AtZHf`
**규모**: 소형. DB 변경 없음.
**발단**: Phase 2A에서 nav-bar [지출] 탭(허브)에 모든 지출 항목이 들어가서 사이드와 중복. 사장님이 A안(통째 삭제) 선택.

### 작업 내용
1. **사이드메뉴 "지출 관리" 섹션 통째 삭제** (5개 항목: 계좌내역·카드내역, 지출 카테고리 설정, 고정비, 거래처 관리, 급여 집계)
   - 모두 [지출] 탭 허브 카드로 접근 가능
2. **영수증 등록 화면 상단 안내** 추가: 📷 사진 찍으면 AI가 거래처·품목·금액·분류를 자동 분석해요.
3. **이름 변경** (지출 허브 카드 이미 사장님 정한 이름 사용 중):
   - 거래처 관리 → 거래처 내역
   - 급여 집계 → 인건비

### 검증
- node --check 통과
- 사이드메뉴 그룹: 7개 → 6개 (지출 관리 삭제)

---

## [2026-05-12] nav-bar 토스 스타일 + 허브 화면 (Phase 2A)

**브랜치**: `claude/check-receipt-category-fk-AtZHf`
**규모**: 중형~대형. DB 변경 없음.
**발단**: 사장님이 "지출 관리 가시성 없다" 호소 → 토스 스타일 대주제 nav로 흐름 정리.

### 작업 내용
1. **nav-bar 권한별 분기** (사장 5칸 / 직원 4칸, manager-only / staff-only 클래스)
   - 사장: 홈 / 근태 / 영업 / 지출 / 더보기
   - 직원: 근태 / 영업 / 영수증 / 내 정보
2. **허브 컨테이너 신규** (각 탭이 카드 메뉴를 통해 세부 진입):
   - `busHubCont` (영업): 영업개시 / 마감정산 / 매출 일별 카드 3개
   - `expHubCont` (지출): 영수증·거래처·고정비·인건비·계좌카드·정산대조·예비비·카테고리 카드 8개
   - `myinfoCont` (내 정보, 직원용): 이름·직급·이번 달 급여·PIN 변경·로그아웃
3. **CSS `.hub-card`** 클래스 신설 (큰 버튼 카드 스타일)
4. **`staff-only` 클래스** 추가 + `applyPermissionUI` 처리
5. **`parentTabMap`**: 허브 카드에서 다른 컨테이너 진입 시 부모 탭(영업/지출)이 active 유지되도록 nav() 함수 보강
6. **첫 진입 화면**: 사장→홈(dashboard), 직원→근태(attendance)
7. **i-home SVG 아이콘** 신규

### 미적용 (Phase 2B로 이월)
- 사이드메뉴 "지출 관리" 항목 이름 변경 (영수증 등록·내역 / 거래처 내역 / 인건비)
- 영수증 등록 화면 상단 "사진 찍으면 AI 자동 분석" 안내 문구
- 이모지 절제 정책 사이드메뉴 적용

### 검증
- node --check 통과
- 허브 카드 수: 3+8+0 = 11개 (busHub 3 / expHub 8)
- nav-item 9개 (사장 5 + 직원 4)

---

## [2026-05-12] 시점 미리보기 토글 + 권한 격리 설계 (Phase 1)

**브랜치**: `claude/check-receipt-category-fk-AtZHf` (계속 사용)
**규모**: 중형. DB 변경 없음.
**발단**: 사장님이 직원 화면 확인하려고 로그아웃→재로그인 반복하는 불편 해소 + 추후 제거 쉽게.

### 작업 내용
1. **권한 격리 설계**:
   - 변수 분리: `realAuthLevel` (DB 실제 권한, 변하지 않음) + `authLevel` (화면 반영) + `viewAsLevel` (미리보기)
   - `recalcPermissions()` 단일 진입점 함수 — `isManager` / `isOwner` 갱신은 이 함수만
   - `completeLogin` / `doLogout` 안 직접 할당을 함수 호출로 교체
2. **시점 토글 UI**:
   - 헤더 우측 작은 노란 버튼 `[👁 사장]`
   - 누르면 `viewAsSheet` 바텀시트: 👑 사장 / 📋 점장 / 🧑‍🍳 직원 3개 옵션
   - owner / franchise_admin만 토글 가능 (직원이 권한 상승 못 함)
3. **노란 띠 배너**: 미리보기 ON일 때 상단 고정 띠 "미리보기: X이 보는 화면 · 탭해서 사장 복귀". 클릭 시 즉시 복귀
4. **새로고침 시 자동 복원**: `viewAsLevel`은 localStorage 저장 X — 새로고침하면 사장 시점으로

### 격리 설계 (미래 제거 쉽게)
- 모든 추가 코드를 `VIEWAS-START` / `VIEWAS-END` 마커로 감쌈 (HTML/JS/CSS 양쪽 20개 마커)
- 제거 가이드: `dev_lessons.md #46`에 단계별 절차 명시 (예상 10~15분)

### 추가 기록
- `dev_lessons.md #45`: 이모지 절제 정책 (옛 결정이 docs 누락된 회귀 방지)
- `dev_lessons.md #46`: 시점 미리보기 격리 설계 + 제거 절차

### 검증
- node --check 통과
- VIEWAS 마커 20개 (10쌍) 정상

---

## [2026-05-12] 영수증 분류 picker 통일 + 금액 콤마 + 400 진짜 수정

**브랜치**: `claude/check-receipt-category-fk-AtZHf` (PR #31 머지 후 추가 작업)
**규모**: 중형 (JS ~50줄 교체, CSS 2줄 추가, HTML 헤더 폭 조정).
**발단**: 사장님 캡쳐 보고 — 셀렉트 두 칸 짤림 + 콤마 없음 + 400 여전히 발생

### 작업 내용
1. **분류 셀렉트 두 칸 → 버튼 1개로 통일**: 누르면 바텀시트 picker 올라옴 (편집 시트와 동일 UX)
2. **openCatPicker 확장**: `startType:'expense'` 옵션 — 영수증용은 stage1(타입선택) 생략하고 바로 대분류 리스트부터. 사장님이 두 번만 누르면 끝 (대분류 → 소분류)
3. **분류 표시**: "식자재 · 야채" 형식. CSS `white-space:normal`로 2줄 자동 줄바꿈 → 짤림 방지
4. **표 컬럼 폭 조정**: 분류 55px → 88px (품목에서 일부 양보)
5. **금액 천단위 콤마**: `<input type="text" inputmode="numeric">` + `onReceiptAmountInput` (입력할 때마다 콤마 자동, 커서 위치 보정)
6. **기록내역 400 진짜 원인**: select에서 `count` 컬럼 제거 (PostgREST 예약어 충돌 추정. 렌더링/집계에서 안 씀)
7. **행별 상태 저장 방식 변경**: select value → `tr.dataset.cat` / `tr.dataset.catId` (picker 콜백에서 갱신)

### 정리
- 이전 헬퍼 제거: `buildMainCatOptions`, `buildSubCatOptions`, `onReceiptMainCatChange` (셀렉트용)
- 신규 헬퍼: `formatRcpCatLabel`, `resolveReceiptCatId`, `openReceiptCatPicker`, `onReceiptAmountInput`

### 검증
- node --check 통과
- 잔재 0건 (`.c-cMain`, `.c-cSub`, `buildMainCatOptions` 등 모두 제거)

---

## [2026-05-12] 영수증 분류 드롭다운 + 기록내역 400 수정 + FK 검토

**브랜치**: `claude/check-receipt-category-fk-AtZHf`
**규모**: 중형 (JS ~70줄 추가, CSS 1줄 정리). DB 변경 없음.
**발단**: 사장님 지적 — "분류가 드롭박스로 나와야지 수기 기재하면 깨지는 거 아냐?"

### 작업 내용
1. **영수증 촬영 결과 표**: `<input type="text">` 자유 입력 → 대분류 `<select>` + 소분류 `<select>` 두 칸 (세로 2단)
   - 대분류 변경 시 소분류 옵션 자동 갱신 (`onReceiptMainCatChange`)
   - 비품·인건비처럼 자식 없는 대분류 → 소분류 셀렉트 숨김
   - AI 미매칭/옛 분류명 → ⚠ 빨간색 옵션으로 보존 (사장님이 인지 가능)
2. **saveReceipt 재작성**: 두 셀렉트에서 mainCat/subCat 읽어 `category_id` 결정 (소분류 우선, 없으면 대분류)
3. **기록내역 400 에러 수정** (`index.html:3417-3418`): `.order('created_at')` 한 줄 삭제. `receipt_date` 단일 정렬.
4. **편집 시트는 그대로 유지**: 이미 `openCatPicker` 3단계 드릴다운 사용 중. 텍스트 오타 불가능.

### FK 검토 결과 (사장님 요청)
`receipts.category_id` (FK→expense_categories) 활용처 전수 점검:
- `calcExpenseByCategories` (가마감 지출 집계): composite 대분류는 자식 id 전부 + 본인 id 검색 ✅
- 마감 지출 대조 (`reconciliation`): 동일 패턴 ✅
- 대시보드 매출 차트/순이익: `total_price`만 사용, FK 영향 없음 ✅
- 옛 영수증(소분류 없이 대분류만 저장) 케이스: 본인 id 검색에 잡힘 ✅
- AI 미매칭/오타: 기존 `confirm` 가드 + ⚠ 옵션 표시로 2중 방어 ✅

### 검증
- node --check 통과 (JS 9295줄)
- grep 잔재 0건 (.c-c 텍스트 input 사용처 모두 제거, CSS도 정리)
- saveReceipt missing 가드 유지

---

## [2026-05-12] 출퇴근 탭 큰 변신 + 사후 등록 시트 이전 (G안)

**브랜치**: `claude/improve-attendance-display-xKUUb` (E·F안 연속 작업)
**규모**: 대형 (HTML +33/-43, CSS +25, JS +50/-29). DB 변경 없음
**근거**: 헌법 1-6 정당한 갈아엎기 — 사장님 호소: "와닿다 마는 느낌"·"수동 입력이 두 군데"·"누락된 출퇴근 어디서 입력?"

### 발단 (사장님 인사이트)
- F안 직후 사장님 캡쳐 분석: 카드 타이틀 "근태 기록" + 서브탭 "수동 입력" + 그 안에 또 "수동 입력 (관리자)" 섹션 = 명칭·흐름 혼란
- "캡스 업로드 빼" — manager-only 클래스가 inline display:none을 덮어써서 사장님 화면에 보임
- "출퇴근 누락 시 어디서 입력?" — 기능은 있으나 "수동 입력" 섹션에 묻혀서 발견 어려움
- "탭 이름이 직관적이지 못함" — 📋 기록·📅 근무계획 → 📋 근무 기록·📅 근무 계획 (짝꿍 통일)
- 결정: 출퇴근 탭 = "지금 찍기" 전용으로 큰 변화, 사후 등록은 📋 근무 기록 캘린더 빈 셀 + 일별 헤더 + 버튼으로 이동

### 변경

#### A. 명칭 정리
- 카드 타이틀: `근태 기록` → `근태`
- 서브탭: `수동 입력` / `캡스 업로드` / `📋 기록` / `📅 근무계획` → `⏰ 출퇴근` / `(캡스 숨김)` / `📋 근무 기록` / `📅 근무 계획`
- 캡스 서브탭: `manager-only` 클래스 제거 (JS가 display 인라인을 덮어쓰던 문제 해결), `style="display:none !important;"` 유지 — 코드는 살림

#### B. 출퇴근 탭 상태 변환 카드 (G안 본체)
- `#attManual` 안 "직원 선택 행" + "현재시간 div" + "출근/퇴근 버튼 두 개" + "todayRecord" + "수동 입력 (관리자) 섹션" 통째 폐기
- 신규 `#attStatusCard` 단일 큰 카드 (3색 변환: `.before` 회색 / `.during` 연파랑 / `.after` 연초록)
  - 큰 날짜 + 48px 시계 (`#attTodayDate`, `#attNowTime`)
  - 색 변환 상태 뱃지 (`#attStatusBadge`)
  - 1개 풀폭 버튼 (`.att-big-btn`): 출근 전엔 출근만, 근무 중엔 퇴근만, 퇴근 후엔 둘 다 숨김
  - 메타 영역 (`#attStatusMeta`): 근무 중=`출근 09:00`, 퇴근 후=`09:00~17:30 휴게 30분`+`오늘 93,500원`(파랑 강조)
- `updateCheckInOutUI(record)` 갈아엎기: `attStatusMsg`/`todayRecord` 참조 제거, 카드 클래스·뱃지·메타·버튼 토글로 통합

#### C. 사후 등록 시트 (📋 근무 기록 캘린더 진입)
- 신규 `#attManualSheet` (editAttSheet 아래에 위치): 직원(`vEmpName`)/날짜(`vDate`)/출근(`vStart`)/퇴근(`vEnd`)/휴게(`vRest`) + 저장/취소
- 기존 attManual의 vDate/vStart/vEnd/vRest/vEmpName ID들이 시트로 이동 (DOM 1개로 통일)
- 새 함수 `openAttManualSheet(date, empId?)`: 날짜/직원 자동 채우기 + 시트 열기 + `selectedEmpCtx='att'` + staff 호출 시 토스트
- `saveAttendance` 마지막에 `closeAllSheets()` + `loadAttList()` 추가 (시트 닫고 캘린더 즉시 반영)

#### D. 📋 근무 기록 캘린더 + 직원 추가 흐름
- `renderAttCalendar`: 빈 셀(근무 0건) + 관리자면 셀에 `+` 아이콘 + 액션을 `openAttManualSheet|YYYY-MM-DD[|empId]`로 매핑 (1인 필터일 때 직원 자동), staff는 기존 `pickAttDay` 유지 (안내 메시지)
- `renderAttDayDetail`: 데이터 있는 날 헤더에 관리자만 `+ 직원` 작은 버튼, 빈 날엔 관리자=`+ 출퇴근 등록` 버튼 / staff=`출퇴근 누락 시 관리자에게 등록을 요청하세요` 안내

#### E. 시트 UX 버그 픽스 (G안 진행 중 발견)
- `selectEmpFromSheet`: `ctx==='att'`면 `closeAllSheets()` → `closeSheet('empSheet')`만. 사후 등록 시트가 같이 닫히던 버그 차단
- `confirmDate`: `datePickerCtx==='att'`면 `closeSheet('dateSheet')`만
- `confirmTime`: `timePickerCtx==='start'||'end'`면 `closeSheet('timeSheet')`만
- 이전엔 출퇴근 탭에 인라인 attManual이 있어서 시트가 같이 닫혀도 문제 없었음 (입력 폼이 화면에 그대로 노출). 시트로 이전 후엔 같이 닫히면 입력 자체가 사라지는 회귀

### 영향
- DB: 변경 없음
- 호출 잔재: `saveAttendance` 호출 위치는 시트 안 1곳만 (기존 attManual 버튼은 폐기)
- `selectedEmpId`/`selectedEmpCtx` 그대로 활용 (사후 등록 시트 안에서)
- `loadTodayRecord`/`checkIn`/`checkOut`: 변경 없음 (currentEmp 우선 로직 그대로)
- staff 화면: 빈 셀은 그대로 `pickAttDay` → 일별 상세에 안내 텍스트

### 검증
- ✅ `node --check` 통과 (1 script block)
- ✅ grep 잔재 0건: `attStatusMsg` / `todayRecord` / `attListData` / `loadAttList\((true|false)\)`
- ✅ ID 중복 0건: vEmpName/vDate/vStart/vEnd/vRest 각 1개 (시트로 통합)
- ✅ 캡스 서브탭: manager-only 제거됐고 inline `display:none !important` 단독 → 모든 권한 안 보임

### 골든패스 (사장님 테스트)
1. 근태 탭 → 카드 타이틀 "근태" 확인
2. 서브탭 ⏰ 출퇴근 / 📋 근무 기록 / 📅 근무 계획 — 3개만 보임 (캡스 안 보임)
3. ⏰ 출퇴근 — 회색 카드 + 시계 + "⚪ 아직 출근 안 했어요" + [🟢 출근 찍기]
4. 출근 찍기 → 카드가 연파랑으로 변환 + 뱃지 "🔵 근무 중 N시간 N분 째" + [🔴 퇴근 찍기]만 노출
5. 퇴근 찍기 → 카드가 연초록 + 뱃지 "🟢 오늘 수고하셨어요" + 출퇴근시각 + 오늘 급여 파랑 강조 (버튼 없음)
6. 📋 근무 기록 → 캘린더 빈 셀에 "+" (관리자) → 탭 → 사후 등록 시트 (날짜 자동)
7. 시트에서 직원 탭 → 직원 시트 열림 → 직원 선택 → 직원 시트만 닫힘, 사후 등록 시트 유지
8. 시트에서 날짜 탭 → 날짜 시트만 닫힘
9. 시트에서 시간 탭 → 시간 시트만 닫힘
10. 저장 → 시트 닫힘 + 캘린더 즉시 갱신 (해당 날짜에 직원 색점/막대 표시)
11. (관리자) 일별 상세 헤더에 "+ 직원" 작은 버튼 → 사후 등록 시트 (날짜 자동)
12. (staff) 빈 날 탭 → 일별 상세에 "관리자에게 등록 요청" 안내

---

## [2026-05-12] 근태 "내 기록"+"전체 조회" → 단일 "📋 기록" 통합 (F안)

**브랜치**: `claude/improve-attendance-display-xKUUb` (E안 연속 작업)
**규모**: 중형~대형 (HTML -33줄/+19줄, JS -76줄/+85줄, CSS +6줄. DB 변경 없음)
**근거**: 헌법 1-6 정당한 갈아엎기 — E안 후 사장님이 "내 기록과 전체조회가 같은 계열인데 탭이 나뉘어 있다, 합치자" 요청

### 발단 (사장님 인사이트)
- E안 후 KPI 헤더 `💰 이번달` 부분이 캘린더와 한 줄 차지해 답답
- "내 기록은 시간단위로 보는, 전체조회는 일별로 종합적으로 보는 — KPI(출근일/시간/인건비)도 내 기록에서 보고 싶으니 전체 조회로 합치자"
- 결정: 직원 필터를 "시점 스위치"로 활용 → 필터에 따라 동일 컴포넌트가 자동 변환

### 변경
- **서브탭** (1048~1052): "내 기록" 폐기 + "전체 조회" → "📋 기록" + `manager-only` 제거 (누구나 봄)
- **HTML** `#attList` div 통째 제거. 안에 있던 주간 간트(myAttGantt + myAttTodayStatus + myAttWarning + myAttWeekLabel) 블록은 `#attWeeklySection`으로 `#attAll` 내부로 이전
- **HTML** `#attAll`: `#attMonSummary` → `#attKpi` (3분할 셀), `#attWeeklySection` 신규 슬롯 추가
- **CSS** `.att-mon-summary` 폐기 → `.att-kpi-row` / `.att-kpi-cell` / `.att-kpi-lbl` / `.att-kpi-val` / `.att-kpi-cell.wage` 신규
- **JS 신규**: `fmtMan(won)` — 10만 이상이면 만 단위 반올림 ("385만"), 미만이면 "9,500원"
- **JS 변경**: `attTab` — 'list' 호환 매핑 ('all'로) + 패널 토글 배열에서 'List' 제거, `moveAttMonth` — mode 인자 무시·단일 진입, `loadAttList` — allMode 인자 무시·통합 단일 진입·KPI 3분할 렌더·주간 간트 본인 모드 조건부·내 기록 카드형 분기 폐기·staff 필터 자동 잠금
- **JS 시그니처**: `renderAttCalendar`/`renderAttDayDetail`에 `isSingleView` 인자 추가, `pickAttDay`는 필터값으로 자동 판정
- **JS 1인 모드 표현**:
  - 캘린더 셀: 색점 숨기고 시간 폰트 크게(13px)
  - 일별 상세: 막대 아래 caps_match_status 작은 색점+텍스트 표시
- **변수 정리**: `attListMonth` 변수 삭제 (`attAllMonth` 단일 사용)
- **호출 잔재 정리**: `closeAllSheets();loadAttList(true);loadAttList(false);` → `closeAllSheets();loadAttList();` (수정·삭제 후 갱신)

### 영향
- DB: 변경 없음 (SELECT 그대로)
- 권한: 모든 권한이 "📋 기록" 탭 접근. staff 진입 시 필터 자동 본인 ID + disabled
- 본인 모드: 관리자가 자신을 필터링한 경우만 (= empF === currentEmp.id) → 주간 간트 노출
- 편집 핸들러: `openEditAttByIdx` 그대로 호출, `window._attListData` 이름은 옛 잔재지만 동작 OK

### 검증
- ✅ `node --check` 통과 (1 script block)
- ✅ grep 잔재 0건: `attListMonth`/`vListMonth`/`attMonSummary`/`att-mon-summary`/`loadAttList(true)`/`loadAttList(false)`/`id="attList"`
- ✅ HTML row count: 11974 (전 12077 대비 -103줄 순감)

### 골든패스 (사장님 테스트)
1. 근태 → "📋 기록" 서브탭 (모든 권한이 봄)
2. 상단 KPI 3분할: `출근일 N │ 근무시간 X.5h │ 인건비 N만`
3. (관리자) 필터 "전체 직원" → 캘린더 셀에 직원 색점 + 일 합계 시간
4. (관리자) 필터 한 명 선택 → 셀에서 색점 사라지고 시간 글자 커짐, KPI는 그 직원 1인분
5. (관리자) 본인 선택 → 추가로 상단에 이번주 주간 간트 노출
6. (staff 로그인) 필터 = 본인 자동 잠금 (회색 disabled), 주간 간트 자동 노출
7. 월 ‹/› 이동: KPI / 캘린더 / 상세 모두 갱신, 선택일 자동
8. 셀 탭 → 일별 간트, 1인 모드에선 막대 아래 ⚪🟠 매칭 상태 텍스트

### 다음 시리즈 후보 (사장님 사양 결정용)
- 노트북 M5 24GB 1TB = 오버스펙. M4 에어 16GB 512GB 권장 (CTO 대행 의견)

---

## [2026-05-12] 근태 전체조회 → 월 캘린더 + 일별 간트 (E안)

**브랜치**: `claude/improve-attendance-display-xKUUb`
**규모**: 중형 (CSS +25줄 / JS +120줄 / HTML 4줄 교체, DB 변경 없음)
**근거**: 헌법 1-6 정당한 갈아엎기 (사장님 호소: "엑셀처럼 쭉 나열돼서 불편" + "근무계획과 통일감 없음")

### 발단 (사장님 인사이트)
- 기존 전체조회 = 5컬럼 테이블, 시간 `8h00m` 표기, 직원·날짜 뒤섞여 나열
- "이게 정말 더 편할지 확신 안 섬" → 단계 분리 제시 → "일별 총합계 없고 근무계획과 통일감 없는 레이아웃이라 그런 듯"
- 보스몬 앱의 월 캘린더 + 일별 상세를 사장님이 좋다고 지적
- 결정: 근무계획 `.gantt-*` CSS 재활용 + 보스몬 월 캘린더 시점 → E안

### 변경
- **HTML** `index.html#attAll` (1100~1112): `attAllData` 단일 테이블 → `attMonSummary` + `attCalendar` + `attDayDetail` 3섹션으로 교체
- **CSS** (316 다음): `.att-mon-summary`, `.att-cal*`, `.att-cal-cell.{today,active,empty,sun,sat}`, `.att-cal-{day,dots,dot,more,sum}`, `.att-day-{detail,empty}`, `.att-row-{label,meta}` 신규
- **JS 신규**: `empColor(empId)` 8색 ID 해시, `fmtHourDecimal(min)` 0.5h 단위, `renderAttCalendar(monthStr, dayMap, selectedDate)`, `renderAttDayDetail(date, logs)`, `pickAttDay(date)`, 모듈 변수 `attAllSelectedDate`/`attAllDayMap`
- **JS 변경**: `loadAttList(allMode=true)` 분기 갈아엎기 (테이블 HTML 제거 → dayMap 빌드 + 합계 + 캘린더/상세 렌더 호출 + early return), `moveAttMonth(dir,'all')`에서 `attAllSelectedDate=null` 리셋
- **재활용**: 근무계획의 `.gantt-day-label`/`.gantt-header`/`.gantt-hour`/`.gantt-bar`/`.gantt-bar-area`/`.gantt-bg-col`/`.gantt-row`, `GANTT_START`/`GANTT_END`/`GANTT_SPAN`/`ganttHours` 상수
- **시간 표기**: 전체조회만 `8h00m → 8.5h` (Math.round(min/30)/2). "내 기록"은 기존 `${total_work_min}분` 유지

### 영향
- DB: 변경 없음 (SELECT만, `attendance_logs` 그대로)
- DOM 제거: `#attAllData`
- DOM 추가: `#attMonSummary`, `#attCalendar`, `#attDayDetail`
- 권한: 기존 `manager-only` 서브탭 유지 (staff에겐 "전체 조회" 자체가 안 보임)
- 편집 핸들러: 일별 상세의 `gantt-row`에 `openEditAttByIdx|${idx}` 그대로 연결 (관리자만)

### 검증
- ✅ `node --check` 통과 (1 script block, 454k 문자)
- ✅ grep 잔재 0건 (`attAllData` 0개, 새 함수 모두 호출 연결)

### 골든패스 (사장님 테스트)
1. 근태 → 전체 조회 → 상단 "💰 이번달 N일 · X.5h · ₩" 한 줄
2. 월 ‹/› 화살표 → 캘린더 갱신 + 선택일 자동 (오늘 or 가장 최근 근무일)
3. 캘린더 셀에 직원 색점 최대 3개 + "+N", 일 합계 시간 (0.5h 단위)
4. 일·토 색 구분 (일=빨강, 토=파랑), 오늘 셀 = 연파랑, 선택 셀 = 파란 테두리
5. 셀 탭 → 하단 일별 간트 (가로 9~22h 시간축 + 직원별 막대 + `9:00~18:00 · 8.5h` + 급여)
6. 관리자 막대 탭 → 기존 편집 시트 열림
7. 직원 필터 변경 → 캘린더+상세 동시 갱신
8. 비관리자(staff) → "전체 조회" 서브탭 자체가 안 보임 (기존 `manager-only` 유지)

---

## 🏁 [2026-05-12] 큰 사이클: 영업개시 시스템 + 마감정산 UX 갈아엎기 + 차액 통합 추적

**브랜치**: `claude/fix-admin-permissions-3HiCm` → main 머지 (PR 10~25)
**규모**: 초대형 (DB 신규 테이블 1 + ALTER 1, HTML/CSS/JS 다수)

### A. 영업개시 보고 시스템 신규 (B안: 익일 검증)
- 직원이 오프라인으로 하던 영업개시(아침 출근 시 금고 계수)를 시스템화
- DB: `daily_opening` 테이블 신규 + `deductions JSONB` 컬럼 추가
- 화면: 어제 마감 결과 → 차감 → 오늘 실제 금고 흐름 (마감정산과 통일)
- 검증식: `오늘 실제 − (어제 마감 − 차감) = 영업개시 차액`
  - 0 = 정상, ≠0 = 차감 미반영 외 진짜 사라진 돈(도난/실수 의심)
- 메모: 차감 항목별 메모 + 행 추가/삭제

### B. 마감정산 차감 구조 통일
- 옛: `siDeductEtc / siDeductBank` 단일 input 2개
- 새: 영업개시와 동일 동적 행 (type 셀렉트 + 금액 + 메모 + 행 추가)
- 데이터 호환: `items.deductions[]` 신규 + `deduct_etc/bank` 합산값 함께 저장
- 옛 마감 데이터 수정 시 자동 변환 폴백

### C. 차액 통합 표 (마감정산 > 기록 조회)
- 일별: 영업개시 차액 / 마감 차액 / 이상 발생 합(절댓값)
- 색: + 초록 / 0 회색 / − 빨강
- 이번달 합계 행 (이상 발생 누적 추적)
- 영업개시 차감 자동 반영 보정 (DB diff_amount는 generated, 차감 미반영 → JS 보정)

### D. 일별 카드 → 마감 기록 재구성
- 탭명: "일별 카드" → "마감 기록"
- 달력(date picker) 추가 — 좌우 화살표 + 직접 날짜 선택
- 섹션 구분: 영업개시 / 매출 / 현금 결제 분해 / 차감 / 기타매출 / 금고 / 마감 차액
- 매출 합계는 4칸 합으로 직접 계산
- 매출 현금+현금영수증 ≠ 현금 분해 합 시 ⚠️ 자동 안내
- 차감 메모 표시(↳ ) + 영업개시 차감도 같은 섹션에 파란 배경으로 합쳐서 표시

### E. 하단 네비 재구조
- 옛: 영수증 / 근태 / 근무계획 / 마감정산 / 더보기
- 새: 근태 / 영업개시 / 마감정산 / 영수증 / 더보기(staff 숨김)
- 근무계획 → 근태 서브탭으로 통합 (`#schedCard`)
- attTab 함수에 'sched' 케이스 추가, 캡스 서브탭 가림(기능 보존)

### F. 마감정산 매출 수식 정리
- 옛 sales_daily 매핑: cash = cash_detail_cash, qr = cash_detail_qr, etc = pos_etc + cash_detail_transfer
- 직원이 매출 4칸 안 채우고 현금상세만 채우면 가짜 매출 잡힘 (사장님 케이스: 277,920원 미스터리)
- 새: card=pos_card, cash=pos_cash, cash_receipt=pos_cash_receipt, qr=0, etc=pos_etc
- 매출 = 마감 4칸 그대로

### G. 버그 픽스
- **마감 저장 후 로그인 화면 → 대시보드 점프**: `finishSettlement2` 의 `location.reload()` 제거. settleTab('list') 로 자동 이동
- **분해 합계 식 오류**: 마감 기록의 분해 합계 검증을 `pos_cash` 만 → `pos_cash + pos_cash_receipt` 로 (마감정산 입력 화면 cashVerify 식과 통일)
- **희망근무 권한 누수**: 직원 선택 input-row 에 `manager-only` 추가 (Phase 0)

### H. 진단 강화
- `errToast` 에 Supabase 에러 코드/메시지 60자 노출 (사용자가 토스트만 봐도 원인 파악)
- `saveReceipt` 사전 분류 가드 — expense_categories 미매칭 분류 confirm

### 결과 (코드 변동)
- 추가 PR: 12개 (PR #10 ~ #25, 모두 머지 완료)
- DB: `daily_opening` 신규 (CREATE) + `deductions JSONB` (ALTER)
- 헌법 1-6 정당한 갈아엎기 적용 (마감정산 sticky 행고정 → 금고 계수 통합)

### 골든패스 (사장님 테스트 가이드)
1. 마감정산 → 오늘 마감 → 차감 카드: 동적 행 + 메모 + 행 추가 OK
2. 영업개시 → 차감 카드: 영업개시와 마감정산 차감 UI 동일
3. 영업개시 보고 후 마감정산 차감 카드에 read-only 박스로 표시
4. 마감정산 → 마감 기록 → 달력 선택 → 일별 풀 디테일 (메모 포함)
5. 마감정산 → 기록 조회 → 차액 통합 표 (영업개시 / 마감 / 이상 발생 합)

### 핵심 수식 정리 (사장님 추적용)
- 마감 차액 = 금고 − 장부 (= opening + 현금상세 - 차감)
- 영업개시 차액 = 오늘 실제 − (어제 마감 − 차감)
- 영업개시 차액 0 = 정상, ≠0 = 진짜 사라진 돈 (도난 의심)

---

## [2026-05-08] 마감정산 계산기 sticky + 입력 가이드 잔재 정리

**브랜치**: `claude/fix-admin-permissions-3HiCm` → main 머지 완료
**규모**: 중형 (11줄 추가 / 94줄 삭제 = 순제거 83줄)
**근거**: 헌법 1-6 정당한 갈아엎기 (잔재 누적으로 사장님 헷갈림 호소)

### 발단 (사장님 인사이트)
- "빨간칸을 먼저 채워주세요"는 이제 의미 없는 설명
- "계산기를 맨 위에 행고정하고 입력하면서 실시간으로 보이면 빨간걸 채워라 0을 채워라가 필요없을 거 같다"
- "오케이 저리해놓으면 불일치면 바로 알 거 아냐"

### 변경
- **HTML**: `.settle-result`(매출/금고/차액 3줄)을 `#settleInput` 최상단으로 이동, `.settle-sticky` 클래스 부여 → 헤더(60px+safe-area) 아래 sticky 고정
- **CSS**: `.settle-item.empty`, `.v-input.empty`, `.settle-guide*` 9줄 제거. `.settle-sticky{position:sticky;top:calc(60px + env(safe-area-inset-top,0px));z-index:50;margin-bottom:10px;}` 추가. `.settle-ready`는 유지(차액 0 → 저장 버튼 초록 강조)
- **JS 제거**: `SETTLE_REQUIRED_IDS`, `SETTLE_OPTIONAL_IDS`, `isInputEmpty`, `refreshSettleEmptyHighlight`, `validateSettleInputs`, `fillEmptyWithZero`
- **JS 단순화**: `refreshSaveButtonState`는 settleGuide 참조 제거 → `saveBtn.classList.toggle('settle-ready', diff===0)` 한 줄
- **JS 정리**: `recalcSettle2`에서 `refreshSettleEmptyHighlight()` 호출 제거, `finishSettlement2`에서 `validateSettleInputs()` 가드 제거
- **빈 칸 안전성**: `gv(id)=unFmt(value||'0')`이 이미 빈 칸을 0으로 폴백 처리 → 가드 alert 제거해도 저장 안전

### 검증
- ✅ grep 잔재 0건 (SETTLE_REQUIRED_IDS / fillEmptyWithZero / settleGuide / .settle-item.empty 모두 부재)
- ✅ node --check 통과 (인라인 JS 428,685자)
- ✅ HTML diff 깔끔 (이동/삭제만, 신규 코드 최소)

### 결과
- 사용자 시야: 어떤 카드 입력해도 화면 위 차액이 실시간 변동
- 잔소리(주황 강조 / 빨간 칸 메시지 / 0 채우기 버튼) 사라짐
- 차액 0 되면 저장 버튼이 초록으로 변하는 시각 보조만 남김

### 골든패스 (사장님 테스트)
1. 마감정산 → 입력 탭 진입 → 화면 위에 매출/금고/차액 박스가 항상 보여야 함
2. 매출 입력하다가 스크롤 내려도 차액 박스 따라옴
3. 빈 칸 둔 채로 저장 시도 → alert 없이 그대로 저장되고 빈 칸은 0 처리
4. 차액 0 되면 저장 버튼 초록색으로 변함

---

## [2026-05-08] 희망근무 등록 권한 누수 수정

**브랜치**: `claude/fix-admin-permissions-3HiCm` → main 머지 완료
**규모**: 소형 (1줄)

### 문제
- 사장님 지적: 근무계획 → 희망근무 등록에서 직원 누르면 모든 직원이 다 나옴.
- 일반 staff가 다른 직원(점장 포함) 이름으로 희망근무를 임의 등록 가능 = 권한 누수.

### 원인
- `index.html:1113` 직원 선택 input-row에 `manager-only` 클래스가 빠져 있었음.
- 근태 탭(1022)은 같은 패턴으로 manager-only 처리되어 있어 일관성 깨짐.

### 수정
- `<div class="input-row" data-action="openEmpSheet|sched">` → `<div class="input-row manager-only" data-action="openEmpSheet|sched">`
- `saveSchedule`(4077)은 `empId = schedEmpId || currentEmp?.id` 로직이 이미 있어 staff는 자동으로 본인으로 등록됨. 추가 수정 불필요.

### 결과
- staff 로그인 시 직원 선택 행이 안 보임 → 본인 희망근무만 등록 가능.
- 관리자(store_manager 이상)는 기존대로 모든 직원 선택 가능.

---

## 🏁 2026-05-06 세션 — 큰 사이클: 고정비 단순화 + 전수 UX 점검 + 캐쉬플로우 리브랜딩 + PWA 강화

**브랜치**: `claude/fix-fixed-costs-aggregation-QmsL8`
**규모**: 초대형 (HTML+CSS+JS 다수, DB 컬럼 1개 추가, 새 파일 2개)
**커밋**: 약 25건 / 주요 머지 18건

### A. 고정비 시스템 갈아엎기 (헌법 1-6 정당한 갈아엎기)
- 사장님 인사이트: "고정비는 가마감 예상치니까 매월 입력 불필요"
- DB: `fixed_costs.estimated_monthly INT DEFAULT 0` 신설 (사용자 SQL 직접 실행)
- `fixed_cost_amounts` 테이블·UI 사용 중단 (데이터는 보존)
- 영향 함수: loadDashboard, calcReserveBalance, calcExpenseByCategories, monthSummary
- 인라인 금액 편집 도입 → 시트 방식으로 환원 (사장님 "적용됐는지 모름" 피드백)
- 금액 입력란 세자리 콤마 자동 (`formatNumberInput` 공용 함수)

### B. 캐쉬플로우 리브랜딩 (전 화면)
- 앱 이름 "퐁당샤브" → "캐쉬플로우" (헤더·로그인·약관·manifest)
- 가입 placeholder "퐁당논산점" → "본죽 강남점" 일반 예시
- ₩ 마크 + 파란 그라디언트 로고 (헤더 26px, 로그인 56px)
- D안 토스 스타일: 앱 자체는 캐쉬플로우 고정, 매장은 헤더 옆 동적

### C. UX 전수 점검 9단계
1. **Pretendard 폰트** 도입 (Pretendard Variable CDN)
2. **SVG 아이콘 도입** — 탭바 4개 (i-receipt/clock/calendar/wallet) + 사이드메뉴 (i-building/link)
3. **에러 메시지 친근화** — `errToast(action, err)` 헬퍼 + 43곳 일괄 치환
4. **토스트 어미 통일** — "완료/성공/되었습니다" → "됐어요" (34곳)
5. **자동 로그인 규칙** — 코드 검증 결과 모든 권한 이미 적용. business_rules.md 동기화
6. **햄버거 → 하단 "더보기" 탭** (i-grid 아이콘)
7. **핵심 숫자 큰 글씨** — 월 요약 ds-amt 16→22px / summ-total 20→28px
8. **빈 상태 토스 스타일** — 회색 원형 박스 + padding 늘림
9. **시트/카드 제목 SVG** 6곳 (i-piggy/card/coins/download/money)

### D. PWA 강화 + Capacitor 전환 대비
- `icon.svg` 신설 (벡터, 모든 사이즈 대응 — Capacitor가 자동 변환)
- `manifest.json` 풍부화 (description, theme_color, lang, categories, maskable icon)
- 메타 보강: `mobile-web-app-capable`, `apple-mobile-web-app-capable`, status-bar-style, title
- `viewport-fit=cover` (iOS 노치)
- `<meta theme-color="#0050FF">` (상태바 색 통합)
- `apple-touch-icon` 추가
- `<header>·<bottom-nav>` safe-area inset 적용
- `sw.js` 신설 → iOS Chrome 부작용 의심으로 **임시 OFF + 기존 등록 unregister 코드** 추가
- 시트 애니메이션 cubic-bezier(0.32,0.72,0,1) iOS 표준 + duration 0.3→0.42s

### E. 디자인 디테일
- X 버튼 토스 스타일 통일 (`.sheet-close` 32×32 원형, gray-100, hover/active)
- 월 요약 도넛 → 세그먼트 바 (가로 색깔 띠 + 항목 표) + 매출/지출 항상 펼침
- 마감정산 빨간 박스 → 노란 배경 (#FFF8E1, warn 톤)
  - placeholder "0" → "입력", 색·크기 차분히 (#D97706, 14px, weight 500)
  - 노란 박스끼리 3px margin (구분감)
- 마감정산 합계 큰 숫자 (.sr-row .sr-val 22px, last-child 28px + 굵은 가로선)
- `*:not(.account-masked){font-family:inherit;}` 강제 폰트 상속 (input/select 누락 케이스 fix)
- `.card-sub` 클래스 신규 정의 (12px gray-500, 카드 부연설명)

### F. 데이터/로직 버그 fix
- 예비비 음수 버그 (순수익 음수일 때 reserveAmt=0 강제, 3곳 일관 — dev_lessons #50 적용)
- 매출 0일 때 MoM 비교 문구 숨김 (월 요약 + 지출 상세)
- 예비비 "-0" 표시 → "0" (강제 부호 제거)
- 화면 하단 잘림 → safe-area를 height에 흡수
- deprecated 메타 경고 해소

### G. 매장 선택 + 로그인 흐름
- 매장 미선택 시 큰 파란 "매장 선택하기" 버튼 강조
- 직원/PIN 영역 흐림(opacity 0.4) + 비활성
- 매장 선택 시트: 검색 + 브랜드 그룹 (franchises.name 조인) + flat 모드 (≤3개)
- _storeListCache 캐시 (매번 DB 안 치고 검색)

### H. 정보 구조 정리
- 사이드메뉴 "📥 자료 다운로드" 그룹 신설
- 근태 화면의 "노무제출" 버튼 → 사이드메뉴로 이동
- 미래 매출/지출/세무 보고서 추가 시 그 그룹 안에 항목만 추가

### I. dev_lessons 신규 (4건)
- #57 사장님께는 코드 용어 금지 (DB 컬럼명·함수명·영어 IT 용어 → 화면 단어 + 비유)
- #58 금액 입력란은 무조건 세자리 콤마 자동 (`formatNumberInput` 표준 패턴)

### J. 환경/배포
- Cloudflare Pages **자동 preview URL** 사용 결정 — main 머지 전 `claude/xxx.pongdang-shabu.pages.dev`로 사장님 검증
- DB 분리 staging은 보류 (UI/UX 변경에는 preview URL로 충분, DB 변경 시점에 staging 환경 도입 검토)

### K. 미해결/보류 항목
- **Service Worker 재도입**: 안정화 후 iOS 호환 형태로 재시도 필요
- **Capacitor 전환**: 사장님 맥북 구비 후 진행 (코드 100% 재사용 가능)
- **본인 식별 우선 로그인 (토스 스타일)**: SaaS 매장 5~10개 확장 시점에 1단계 (이메일+초대코드+승인) 도입

### L. 사장님 피드백 정리
- "큰 차이 못 느끼겠어" → 폰트·아이콘은 무의식 효과. 임팩트 큰 변화(햄버거→하단탭, 큰 숫자, 노란 박스)로 체감 만들어야
- "고퀄 느낌이 안 나" → PWA 본질적 한계. Capacitor wrapper로 80~90% 따라잡기 가능
- "토스같은 어플과 괴리" → 디자인보다 패러다임 (시트 애니메이션, 본인 식별 로그인 등)이 진짜 차이

### 검증
- 모든 단계마다 `node --check` 통과
- grep 잔재 검증 (제거 함수·변수 0건 확인)
- 기능 회귀 0건 (사장님 보고 기준)

### 골든패스 (사장님 최종 검증 부탁)
1. 마감정산 미입력 노란 박스 (사이즈 차분, 박스 사이 구분)
2. 대시보드 월 요약 매출/지출 항상 펼침 + 큰 숫자
3. 고정비 항목 추가 → 예상 월 금액 입력 → 카드에 표시
4. 사이드메뉴 "더보기" 탭 → 자료 다운로드 → 노무 제출
5. 매장 선택 시트 검색 (매장 1개라 단순 리스트)
6. 폰 홈에 추가 후 ₩ 로고 + "캐쉬플로우" 이름 (PWA)

---

## 🏁 2026-05-06 세션 — 고정비 월별 입력 → 항목별 예상 월 금액 1회 입력으로 단순화

**브랜치**: `claude/fix-fixed-costs-aggregation-QmsL8`
**규모**: 중형 (DB 컬럼 1개 추가, JS 약 -40줄/+15줄, HTML 탭 1개 제거 + 입력란 1개 추가)
**승인**: 2026-05-06 사용자 "sql 실행완료 진행해"

**문제 인식 (사장님 지적)**:
- 월 바뀌면 대시보드 고정비 0원 처리 → "월마다 입력해줘야 되는 상황인가 현재?"
- 사장님 통찰: "고정비는 어차피 예상액. 가마감 = 예상치, 진마감 = 출금. 굳이 매월 입력?"
- 가스비처럼 변동되는 항목도 가마감은 예상치니까 평균값 1회면 충분

**완료 항목**:
1. **DB 컬럼 추가** (사용자가 SQL 직접 실행 완료):
   - `fixed_costs.estimated_monthly INT DEFAULT 0` — 항목별 예상 월 금액
   - 백필 쿼리로 가장 최근 입력 월 금액 자동 복사
2. **HTML**:
   - 고정비 화면 (`fixedcostCont`) — `항목 관리` / `월별 금액` 2탭 → 단일 화면으로 단순화
   - `addFcSheet` — `예상 월 금액` 입력란 1개 추가
3. **JS 함수 변경**:
   - `loadFixedCosts`/`renderFcList` — 항목 카드에 예상 월 금액 표시
   - `openAddFcSheet`/`openEditFcSheet`/`saveFc` — `estimated_monthly` 처리
4. **JS 함수 제거** (헌법 1-6 정당한 갈아엎기):
   - `fcTab`, `loadFcMonthly`, `saveFcAmounts`, `moveFcMonth`, `updateFcDaily`, `setFcAmount`
   - 전역 변수 `fcMonthStr`, `fcMonthStr2`, `fcAmountsEditing`
5. **집계 로직 통일** (모든 화면 `fixed_costs.estimated_monthly` 기준):
   - `loadDashboard` 당월/전월 고정비 → `estimated_monthly` 합산
   - `calcReserveBalance` 월별 적립 계산 → 모든 달 동일 `fixedMonthlyAll`
   - `calcExpenseByCategories` `fixed_costs` 분기 → `estimated_monthly` 합산
   - `monthSummary` 지출 대조 → 항목별 `estimated_monthly` 표시
6. **데이터 보존**: 기존 `fixed_cost_amounts` 6개월치 데이터 삭제 안 함 (역사용)

**검증**:
- node --check 통과 (sed extract 2599~11273)
- grep 잔재 0건 (`fixed_cost_amounts`, `loadFcMonthly`, `fcMonthly`, `fcAmountsEditing` 등)

**골든패스 (사장님 테스트)**:
1. 사이드메뉴 → 고정비 → 항목 카드에 예상 월 금액 표시되는지
2. 항목 편집 → 예상 월 금액 수정 → 저장 → 카드 갱신 확인
3. 대시보드 → 6월(미래 달)로 이동 → 고정비 0원 아닌지
4. 마감예상/지출대조 → 고정비 합계 일치하는지

**dev_lessons 갱신**: #57 (사장님께 코드 용어 금지) — 본 세션에서 신설

---

## 🏁 2026-05-05 세션 #4 — 시급/월급 + 직급 4개 + 인건비 일별 분배

**브랜치**: `claude/debug-login-access-0Zifq` (이어서)
**규모**: 대형 (DB 컬럼 2개 추가, JS 약 +90줄, HTML +20줄)
**승인**: 2026-05-05 사용자 "응 해 sql 햇음 / 매니저 잔류"

**완료 항목**:
1. **DB 컬럼 추가** (사용자가 SQL 직접 실행 완료):
   - `employees.wage_type text DEFAULT 'hourly'` — 시급제 / 월급제
   - `employees.monthly_wage int` (nullable, **만원 단위**) — 월급액 (예: 280=280만원)
2. **기존 직원 직급 마이그레이션** (사용자 SQL 실행 완료): role='시급제'/null/그외 → ' 아르바이트'
3. **직원 편집 시트 UI**:
   - 급여 종류 셀렉트 (시급제/월급제) → 토글 시 입력칸 자동 전환 (`onEmpWageTypeChange`)
   - 시급(원) / 월급(만원) 입력칸 분리
   - 직급 셀렉트 4개 고정: 점장/팀장/매니저/아르바이트 + 선택안함
   - 기존 chips 시스템(`renderRoleChips`/`selectRoleChip`/`promptAddRole` + `selectedRoleName`) 폐기 (헌법 1-6)
4. **직원 카드 표시**: 월급제면 "월급 280만원", 시급제면 "시급 10030원"
5. **대시보드 일별 인건비 분배**:
   - 시급제: `attendance_logs.calculated_wage` 그대로 (출퇴근한 날만)
   - 월급제: 매일 `monthly_wage * 10000 / 해당월일수` (쉬는 날도 1/N 박음, hire_date/resign_date 고려)
   - `monthlyEmpIds` 셋으로 시급 합산 시 월급제 직원 제외 (이중 합산 방지)
   - 전월(MoM) 비교 데이터에도 동일 적용
6. **단위 규칙**: `base_wage`=원 단위(시급), `monthly_wage`=**만원 단위**(월급, business_rules #7과 일치). 일별 분배 시만 ×10000 원 단위 변환.

**검증**:
- node --check ✅
- 행동 시뮬레이션 (다음 단계)

**남은 작업 (별도 세션)**:
- 출퇴근 시 월급제 직원의 `calculated_wage` 박기 막기 (현재는 박혀도 대시보드에서 무시되지만, attendance_logs 데이터 정합성 위해 출퇴근 코드도 정리 권장)
- PIN brute-force 제한
- empAuthLevel 셀렉트에 'owner' 옵션

---

## 🏁 2026-05-05 세션 #3 — 로그인 화면 갈아엎기 (헌법 1-6 신설 적용)

**브랜치**: `claude/debug-login-access-0Zifq` (이어서)
**규모**: 중형 갈아엎기 (HTML 약 -40줄, JS 약 -160줄, docs 갱신)
**승인**: 2026-05-05 사용자 "다 ok" (헌법 1-6 + dev_lessons #51 보완 + 단순화 안 통째 승인)

**배경**: 사용자가 로그인 화면 분기 5개(드롭다운/관리자/이메일/시크릿/매장변경)에 분노. 헌법 1-5 "기존 기능 보호" 원칙을 무한 적용한 결과 잔재 누적. 사용자: "최대한 건드리지 않되, 갈아엎을 필요가 정당할 때는 한다"는 명시 요청.

**헌법 변경**:
- **CLAUDE.md 제1조 1-6 신설**: "정당한 갈아엎기" — 잘못된 전제·잔재 누적·구조 충돌 시 통째로 정리할 수 있는 근거 명시
- **dev_lessons.md #51 보완**: "추가만, 수정 금지"는 하위 호환 위험이 큰 특수 상황의 권고일 뿐, 잘못된 설계까지 보존하라는 일반 원칙 아님 (헌법 1-6 우선)

**갈아엎기 내역**:
| 제거 | 이유 |
|---|---|
| `loginAdminArea` HTML 패널 (+`loginAdminMsg`,`loginAdminName`,`loginAdminPin`) | 김은성=owner 시절 잔재. 김은성 employees row 삭제(세션 #2)로 불필요 |
| `loginOwnerArea` HTML 패널 (이메일 로그인) | Phase 1-A2 가맹점주용. 사용 안 함 |
| 하단 [관리자] / [주인 (이메일)] 버튼 | 위 패널과 함께 제거 |
| 로고 long-press 시크릿 트리거 (`brandLogo`) | 김은성 숨김용 시크릿 통로 — 김은성 빠지면 불필요 |
| `showLoginPanel` / `_currentLoginPanel` / `_panelMsgEl` / `_panelAreaEl` | 3패널 토글용. 1패널만 남으면 불필요 |
| `toggleAdminLogin` / `toggleOwnerLogin` / `submitAdminLogin` / `submitOwnerLogin` / `openResetPw` / `loginPanelBack` | 위와 동시 사용 |
| dropdown 필터의 `auth_level !== 'owner'` 조건 | owner=이송은=매장 사장이 매일 들어와야 할 사람이라 dropdown 노출이 자연스러움 |

**남긴 것 (단순화 후 진입 경로 1개)**:
- 드롭다운(👑 사장 / 🔑 관리자 배지) + PIN 4자리 + [로그인] + [매장 선택](미선택 시만)
- `submitLogin` (동명이인 PIN 매칭) + `shakeLogin` (form 영역만) + 엔터키 → submitLogin

**자동 로그인 변경**:
- 이전: owner만 자동 로그인, 나머지는 매번 PIN
- 이후: **본인 폰 가정** (dev_lessons #54 fingerprint 안정화) → 모든 권한 자동 로그인. 직원이 자기 폰에서 한 번 PIN 입력하면 다음부터 자동 진입.

**UI 라벨**:
- 드롭다운 옵션: `👑 이송은 (사장)` / `🔑 김미지 (점장)` / `권채현 (아르바이트)` 식으로 권한 표시

**검증**:
- `node --check` ✅
- 행동 시뮬레이션 10/10 통과 (`/tmp/sim_login2.js`):
  드롭다운에 owner 노출 / 비활성 직원 미노출 / 정상 로그인 / owner 드롭다운 직접 로그인 / PIN 미설정 거절 / 잘못된 PIN 거절 / owner+staff 모두 자동 로그인 / 비활성 직원 자동 로그인 거절 / 매장 미선택 자동 로그인 거절

**남은 작업 (별도 세션)**:
- 시급/월급 + 직급 4개 본 작업 (사용자가 시작한 다음 큰 트랙)
- PIN brute-force 제한 (5회 실패 시 60초 잠금)
- empAuthLevel 셀렉트에 'owner' 옵션 추가 + readonly

---

## 🏁 2026-05-05 세션 #2 — 매장 직원 테이블에서 앱 개발자 분리 + 호칭 재확정

**브랜치**: `claude/debug-login-access-0Zifq` (이어서)
**규모**: 소형 (DB UPDATE/DELETE 사용자 직접 실행, JS 라벨 5곳 + docs)
**승인**: 2026-05-05 사용자 "(가) 사장으로 / SQL 실행완료"

**핵심 결정**: 앱 개발자(=김은성=사용자)는 매장 employees 테이블에 있어야 할 사람이 아님 → row 삭제. 매장 운영 사장(이송은) owner 승격. super_admin 메커니즘은 신설하지 않음 (사용자 통찰: "어플 만든 사람이 매장 들어가서 데이터 수정해줄 일이 없는데 매장 UI 로그인 만들 이유가 없다 — 시스템 고칠 일 있으면 코드 수정 / Supabase 콘솔 직접 사용").

**변경 사항**:
- DB (사용자가 직접 실행 완료):
  ```sql
  UPDATE employees SET auth_level='owner', is_manager=true
  WHERE name='이송은' AND store_id='4ae03341-e5dc-4933-b746-29728cbc685f';
  DELETE FROM employees
  WHERE name='김은성' AND store_id='4ae03341-e5dc-4933-b746-29728cbc685f';
  ```
- UI 라벨: "👑 총관리자" → "**👑 사장**" (배지 2곳 / 가입 placeholder / 에러 메시지 2곳)
- `business_rules.md` #7: owner 호칭 "총관리자"→"사장" 재확정 + 이력 박음 (1차/2차 정정 명시)
- `dev_lessons.md` #56 신설: "앱 개발자는 매장 직원 테이블에 없어야 한다"

**검증**: `node --check` ✅ / UI 노출 "총관리자" 잔재 0건

**효과**: 김은성(사용자)의 개인정보(주민번호/계좌/PIN)가 어떤 매장에도 박히지 않음. 매장 직원 명단에서도 사라짐. 매장 추가될 때마다 김은성을 직원으로 박을 필요 없음.

**남은 이슈** (별도 세션):
- 시급/월급 + 직급 4개 본 작업 (사용자가 시작한 다음 큰 트랙)
- PIN brute-force 제한
- empAuthLevel 셀렉트에 'owner' 옵션 추가 + readonly

---

## 🏁 2026-05-05 세션 — 로그인 화면 결함 묶음 수정 + 호칭 정정

**브랜치**: `claude/debug-login-access-0Zifq`
**규모**: 중형 (HTML 약 12줄, JS 약 110줄, DB UPDATE 1줄(사용자 직접 실행))
**승인**: 2026-05-05 사용자 "1.했음 / 2.가 / 3.진행"

**증상**: 김은성(=총관리자) 본인 로그인 안 됨, [관리자] 버튼 눌러도 "아무 반응 없음", [주인 이메일] 갔다 [뒤로] 누르면 일반 로그인 + 관리자 로그인 두 영역이 동시 표시되는 비정상 화면.

**원인 (4개 결함 동시 작용)**:
1. **메시지 영역 누락** — `loginAdminArea`/`loginOwnerArea`에 에러 메시지 표시 div가 없어 `loginMsg`(form 내부)에 출력 → form hide되면 메시지도 같이 숨겨짐 → "아무 반응 없음"
2. **토글 책임 분산** — `toggleAdminLogin`/`toggleOwnerLogin`가 서로의 영역 안 만짐 → 호출 순서에 따라 두 영역 동시 표시
3. **owner 진입 경로 불명** — owner는 dropdown 필터 제외, [관리자] 버튼 안내 없음
4. **호칭 혼용** — "사장님" 표현이 owner를 가리키는 듯 박혀있어 사용자(=총관리자) 분노

**해법**:
- HTML: `loginAdminMsg` + `loginOwnerMsg` 신규 / 로고에 `id="brandLogo"` / [관리자] 버튼 제거 / [뒤로] 통일(`loginPanelBack`)
- JS: `showLoginPanel('form'|'admin'|'owner')` 신규 — 1개만 보이게 + 메시지/입력 초기화
- 토글 함수 단순화: `showLoginPanel` 호출만
- `submitLogin`/`submitAdminLogin`/`submitOwnerLogin`이 각자 패널 메시지 출력 + 동명이인 PIN 매칭 (`filter` + `find by pin`)
- `shakeLogin`은 현재 표시 패널만 흔듦
- 엔터키: 현재 표시 패널의 submit 호출
- 시크릿 트리거: 로고 1초 길게 누르면 admin 패널 (직원 호기심 클릭 차단)
- 매장 변경 버튼 모든 권한 노출 (F4 결함 수정)
- 호칭: UI 3곳 "사장님" → "총관리자" / `business_rules.md` #7 호칭 절대 규칙 / `dev_lessons.md` #55 신설

**검증**:
- `node --check` ✅
- 행동 시뮬레이션 12/12 통과 (`/tmp/sim_login.js`):
  패널 전환 / owner→뒤로 시 admin 안 뜸(사용자 케이스) / 정상 로그인 / 잘못된 PIN 메시지 해당 패널 표시 + 해당 패널만 흔들림 / 동명이인 PIN 매칭 / 매장 미선택 가드

**남은 작업 (별도 세션)**:
- PIN brute-force 제한 (5회 실패 시 60초 잠금)
- PIN 평문 → bcrypt 마이그레이션
- empAuthLevel 셀렉트에 'owner' 옵션 추가 + owner 카드 권한 readonly (강등 시한폭탄 차단)

**사용자가 직접 실행한 SQL**: 김은성 owner 권한 복원
```sql
UPDATE employees SET auth_level='owner', is_manager=true
WHERE name='김은성' AND store_id='4ae03341-e5dc-4933-b746-29728cbc685f';
```

---

## 🏁 2026-05-04 세션 — 출퇴근 기기 인식 오류 수정 (fingerprint 안정화)

**브랜치**: `claude/fix-attendance-errors-hwHYE`
**규모**: 중형 (JS 약 30줄, DB 변경 없음)
**승인**: 2026-05-04 사장님 "안정적인거로 해 / 엄청난 걸 할 이유는 없음"

**증상**: 직원이 출퇴근 시도 → "등록되지 않은 기기" 차단. 관리자가 기기 초기화 → 한동안 정상 → 또 차단. 무한 반복.

**원인**: `getDeviceFingerprint`가 canvas 픽셀 + screen.width/height + userAgent + hardwareConcurrency 등 **변동 큰 요소**로 해시 생성. 화면 회전(가로↔세로 swap), 브라우저 자동 업데이트(UA 버전 변경), GPU 캐시 변동만으로 해시가 달라져 차단.

**해법 (단순·안정)**:
- 1순위: `localStorage.pd_device_id` 에 `crypto.randomUUID()` 영구 저장 → 환경 변동에 영향 0
- fallback: localStorage 차단 환경에서만 정제 fingerprint (canvas 제거, UA 버전 제거, screen 정렬 → 회전 무관)
- 옛 `DF…` 형식 보유 직원: 첫 출근 시 자동 silent migration (DB 값을 새 UUID 형식으로 갱신)

**변경 함수**: `getDeviceFingerprint`, `checkDeviceForAttendance` (DF 호환 분기 추가), `showDeviceStatusPopup` (DF 보유자 "일치" 표시)

**바뀌는 DB**: 없음 (`employees.device_fingerprint` 컬럼 그대로, 값 형식만 점진 전환)

**검증 통과**:
- `node --check` ✅
- **Node 가상 시나리오 18종 통과** (`/tmp/test_fp.js`, `/tmp/test_check.js`):
  - 핵심: 같은 폰 두 번째 호출 동일 / 화면 회전 후 동일 / 브라우저 업데이트 후 동일 / 다른 폰 다름
  - Fallback: 시크릿 모드 `FB-` prefix / 시크릿+회전 동일 / 시크릿+iOS 마이너 업데이트 동일 / `crypto.randomUUID` 미지원 시 정규식 fallback
  - 운영: 매장 폰 1대 직원 2명 공유 OK / 옛 DF 첫 출근 silent migration / 그 직원 두 번째 일치 분기 / 도용자 차단 + DB 보호 / 관리자 초기화 후 같은 UUID 복귀
  - 트레이드오프(인지): 옛 DF 보유자에 한정해 1회 다른 폰도 통과 가능 (마이그레이션 비용, 첫 출근 직후 새 UUID 박힘)

**dev_lessons #54 추가**: "기기 식별은 변동 요소 빼라 — localStorage UUID가 정답"

**남은 액션**: 사장님 실기 테스트 (특히 폰 가로↔세로 회전 후 출근 — 예전 차단 케이스)

---

## 🏁 2026-04-30 세션 #3 — 노무 제출용 엑셀 다운로드 3종

**브랜치**: `claude/store-testing-checklist-n1YIk` (이어서)
**규모**: 중형 (HTML 시트 1개 + JS 약 145줄)
**승인**: 2026-04-30 사장님 "3종 전부 해" + "선택해서 다운받게" → 체크박스 선택형

**배경**: 5월 매장 테스팅 직전 사장님 지적 — "엑셀 다운로드 기능 있어야 한다, 노무는 노무제출양식 맞춰서". 코드 점검 결과 **다운로드 함수 0개** 확인. 노무사 양식 따로 없음 → 근로기준법 표준 3종으로 결정.

**완료 항목**:
- 근태 탭 헤더에 **📥 노무제출** 버튼 (`manager-only` 클래스로 자동 가드)
- 시트 `#laborExportSheet`: 월 ◀▶ + 체크박스 3종 (출퇴근부/임금대장/근로자명부) + 다운로드 버튼
- 1개 선택 시 단일 시트 파일, 복수 선택 시 1파일에 다중 시트 (노무사 한 번에 보기 좋음)

**신규 함수 (JS 8개)**:
- `openLaborExportSheet`, `moveLaborExportMonth` — 시트 진입/월 이동
- `maskRRN` — 주민번호 뒷자리 6자리 마스킹
- `fmtTime` — ISO → HH:MM
- `downloadLaborExport` — Promise.all로 emps/logs/sw 동시 조회 → 시트 빌드 → XLSX.writeFile
- `buildAttendanceSheet` — 일자×직원, 빈 날도 결근/휴무 행 채움
- `buildPayrollSheet` — 직원별 1행, 근기법 §27 16개 필수항목 + 합계 행
- `buildEmployeeSheet` — 활성 직원, 근기법 §20 필수항목

**변경 함수**: 없음 (기존 코드 손대지 않음 — 추가만)

**파일명 규칙**:
- 1종 단독: `출퇴근부_매장명_2026-05.xlsx` 등
- 복수 선택: `노무제출_매장명_2026-05.xlsx`
- 매장명 한글 OK (UTF-8), 위험 문자(/\:*?"<>|) `_`로 치환

**가드**:
- `isManager` 가드 — staff는 버튼 자체 안 보임 + 함수 호출 시 거부
- 직원 0명이면 "등록된 직원이 없습니다" 토스트 + 다운로드 중단
- 주민번호: 풀 노출 X, 마스킹(951010-1******) — 노무사가 풀이 필요하면 사장님이 별도로 알림

**근거 법령**:
- 출퇴근부: 근기법 §42 (근로시간 기록·보존)
- 임금대장: 근기법 §48 + 시행령 §27 (16개 필수항목)
- 근로자명부: 근기법 §41 + 시행령 §20

**검증 통과**: `node --check` ✅ / 통합 지점 10개 grep ✅ / DB 변경 없음

**한계**:
- 주민번호 풀 노출 미지원 (기본값 마스킹) — 노무사 요구 시 옵션 추가 가능
- 출퇴근부 "결근/휴무" 자동 구분 X (휴무일 정의가 매장별로 다름)
- 식대·주휴수당·공제 컬럼은 헤더만 있고 데이터 빈 칸 (현재 DB 미관리)

---

## 🏁 2026-04-30 세션 #2 — 사용자 편의성 패키지 Phase 1 (A+D+E)

**브랜치**: `claude/store-testing-checklist-n1YIk` (이어서)
**규모**: 중형 (HTML 1줄 + CSS 7줄 + JS 약 60줄)
**승인**: 2026-04-30 사장님 "ABCDEF 가자" → 분할 push 합의

**완료 항목 (Phase 1)**:
- **A. 마감 중복 저장 가드** — `finishSettlement2` 시작에 같은 매장+날짜 `settlements` SELECT → 있으면 confirm("이미 X월 X일 마감 기록이 있습니다. 덮어쓸까요?") + 저장된 매출/금고 표시. 사용자가 모르는 사이 덮어쓰는 경우 차단
- **D. 차액 0원 저장 가능 강조** — 신규 `refreshSaveButtonState(diff)` + `#settleGuide` DOM. 차액=0 + 필수칸 모두 채워짐 → 저장 버튼 초록 그라데이션 + "✅ 마감 가능". 차액≠0 → "💡 차액 X원 — 한 번 더 확인". 빈칸 있음 → "🔴 빨간 칸을 먼저 채워주세요"
- **E. 출퇴근 즉시 피드백** — `checkIn` 끝: "🌅 출근 완료! HH:MM · 좋은 하루 보내세요". `checkOut` 끝: "👏 오늘 N시간 M분 일하셨어요 · 오늘 X원. 수고하셨습니다!" (`calcWageData` 결과 활용)

**남은 항목 (Phase 2 예정)**: B 영수증 분류 피드백 / C 빈 상태 가이드 / F 숫자 입력 단축 칩

**검증 통과**: `node --check` ✅ / 통합 지점 6개 grep ✅ / DB 변경 없음

---

## 🏁 2026-04-30 세션 #1 — 마감정산 공란 가드 + 빨간 강조

**브랜치**: `claude/store-testing-checklist-n1YIk`
**규모**: 소형 (CSS 5줄 + HTML 1줄 + JS 약 50줄)
**승인**: 2026-04-30 사장님 "ok" — 5월 매장 테스팅 시작 전 누락 방지용

**배경**: 5월부터 본인 매장(논산) 실서비스 테스팅 진입. 사장님 우려 — "한 화면에 다 나오니 직원들이 누락 가능". critic으로 단계 마법사 대신 더 가벼운 패턴 추천 → 채택.

**핵심 결정**:
- 단계 마법사로 풀 리팩터링 X (마감 시간 늘어남, 직원 스트레스)
- 대신 빨간 강조 + 저장 가드 + 0 일괄 채우기 버튼
- 필수 차단 영역: 전일이월 + 매출 4 + 현금상세 3 = **8칸**
- 권장 강조: 차감 2칸, 기타매출 동적, 금고 8칸 (저장 통과)

**신규 함수**:
- `refreshSettleEmptyHighlight` — recalcSettle2 끝에서 빈 칸 빨간 토글
- `validateSettleInputs` — 필수 8칸 빈 칸 있으면 차단 + 알림 + 자동 스크롤
- `fillEmptyWithZero` — 모든 빈 칸 0 일괄 채우기 (직원 단축 버튼)

**변경 함수**: `recalcSettle2`(끝부분 1줄 추가), `finishSettlement2`(시작 1줄 추가)

**신규 CSS**: `.settle-item.empty`, `.v-input.empty` (빨간 인셋 1.5px + placeholder 빨간색)

**HTML 변경**: 마감 저장 버튼 위에 "⚡ 공란 0으로 채우기" 보조 버튼

**검증 통과**: `node --check` ✅ / 통합 지점 6개 grep 매칭 ✅ / DB 변경 없음

**골든패스 시뮬**:
- 빈 칸 → 빨간 테두리 ✅
- 0 입력 → 정상색 복귀 ✅
- 매출 1칸 빈 채로 저장 시도 → 알림 + 차단 + 첫 빈 칸으로 스크롤 ✅
- "공란 0으로 채우기" 클릭 → 모든 빈 칸 0 → 저장 가능 ✅

---

## 🏁 2026-04-29 세션 마감 — 기타매출 분리 관리 + 동적 항목

**브랜치**: `claude/review-todo-notes-EOjM7`
**규모**: 대형 (DB 2테이블 신규 + UI 5곳 변경 + 백필 마이그레이션)
**승인**: 2026-04-29 사장님 "ok" 확정 (계획서 v2)

**핵심 결정**:
- 뽑기 등 기타매출을 **장부합계에서 분리** (지금까지는 합산 → 매장별 항목이 달라 부적절)
- 매장별 동적 항목 관리 (payment_methods 패턴 차용)
- 회수 입력 **없음** — "회수"는 기계 구매원가 ROI 의미였음 (누적 매출만 보면 판단 가능)
- 마감 카드 + 대시보드 둘 다 누적 표시

**완료 단계**:
- [x] Phase 0 백업 커밋 (작업트리 clean → `5aaa8e3` 자체가 백업)
- [x] Phase 1 마이그레이션 SQL 작성 (`migrate_extra_revenue_2026_04_29.sql` + rollback)
- [x] Phase 2 항목 관리 UI (사이드메뉴 + 시트 2개)
- [x] Phase 3 마감 입력 동적화 + recalc 로직 (장부에서 뽑기 제외, sales_daily 동기화 변경)
- [x] Phase 4 마감 카드 + 대시보드 누적 표시
- [x] Phase 5 docs 동기화 + 구문 검증

**신규 함수**: loadExtraItems, loadExtraItemSums, openExtraItemsSheet, renderExtraItemList, openExtraItemEdit, saveExtraItem, deleteExtraItem, renderExtraRevenueInputs, recalcExtraRevenuePanel, renderSettleCardExtraSection, renderExtraRevenueDashboard

**변경 함수**: recalcSettle2, finishSettlement2, resetSettleView, syncClosingToSalesDaily, loadSettleCard, editSettlement, parseClosingExcel(?fillExtra), createDefaultSeeds(signup)

**신규 DB 테이블**: extra_revenue_items, extra_revenue_logs

**사장님 SQL 실행 필요**:
- `docs/sql/migrate_extra_revenue_2026_04_29.sql` (Supabase에서 실행)
- 실행 후 매장에 뽑기 대/소 자동 시드 + 옛 마감의 뽑기 매출이 logs로 자동 백필됨

**검증 통과**: `node --check` ✅ / DOM ID 잔재 0건 ✅ / 호환용 `extra_draw_*` 키는 의도된 보존

---

## 🏁 2026-04-24 세션 마감 (종합)

**처리**: 큰 덩어리 **11건** 완료 (단일 세션 최다 기록)
**브랜치**: `claude/continue-todo-list-KG9PD` → main 머지 9회

**main 커밋 흐름**:
1. Part F Phase 2 — 대시보드/정산검수 결제수단 동적화
2. 영수증 학습 버그 수정 + 기록 내역/편집 화면
3. 사이드메뉴 재구성 + 거래처 대조 & 단가 서브탭
4. 사이드메뉴 이모지 통일 (지출 관리 하위)
5. 수식 검수 → 예비비 잔고 정확화 + 정산/검수 카드수수료 통일
6. Phase 1-A1 — 개인 사업자 가입 플로우 (Supabase Auth 도입)
7. Phase 1-A2 — 프랜차이즈 본사/가맹점주 + 본사 홈 + 자연빵 흡수

**사장님 실행 완료 SQL**:
- `migrate_signup_2026_04_24.sql` (이메일·비번 인증 + store_code + franchises 확장)

**신규 DB 컬럼 (1-A1)**:
- `employees.auth_user_id` (→ auth.users)
- `stores.store_code` (6자리 유니크), `stores.tos_accepted_at`, `stores.business_no`
- `franchises.invite_code` (유니크), `franchises.owner_user_id`

**신규 dev_lessons**: #49 학습 keyword 정규화, #50 같은 지표는 소스+공식 둘 다 통일, #51 기존 데이터 앱에 신규 가입 플로우 추가할 땐 하위 호환 유지

**남은 과제 (다음 세션 후보)**:
- **Phase 1-A3**: 직원 매장 코드 로그인 + 카톡 초대 링크
- **기존 owner 계정 이메일 업그레이드 UI** (지금 사장님 계정도 이메일 로그인 가능하게)
- **Phase 1-B**: Sentry 에러 모니터링
- **Phase 1-C**: FAQ + 문의 채널
- **본사용 RLS 정책** (필요시, 본사가 여러 매장 못 읽으면)

**점검 지표** (가상 시나리오 33M 매출 기준):
- 대시보드 ↔ 예비비 잔고 ↔ 정산/검수 카드수수료 **3화면 수식 동기화** ✅
- 결제수단 신규 추가 시 매출 관리·대시보드·정산/검수·마감정산 **4화면 자동 반영** ✅

**출시 준비도** (이번 세션 전 vs 후):
- 본인 매장용: 85 → **88**
- SaaS 다른 매장 판매용: 45 → **58** (가입/본사/가맹 플로우 추가로 +13)
- 프랜차이즈 체인용: 60 → **72**

**다음 세션 진입 트리거**: "어제 todo 이어받아" 또는 `docs/todo_next_session.md` 참조

---

## [2026-04-24] Phase 1-A2 — 프랜차이즈 본사/가맹점주 가입 + 본사 홈 + 자연빵 흡수

### 상태: 구현완료 → 배포 예정 (**DB 변경 없음**, Phase 1-A1 SQL만 실행돼 있으면 됨)
### 규모: 대형 (HTML ~150줄 + JS ~230줄)
### 브랜치: `claude/continue-todo-list-KG9PD`

### 배경
사장님 지적: "프랜차이즈는 모든 매장의 정보를 봐야 의미가 있는데 그런 창이 없잖아". Phase 1-A1의 나머지 3종 사업자 유형(다점포/본사/가맹점) 활성화 + 본사 통합 홈 신설.

### 변경 요약

#### 1. 가입 유형 4종 전부 활성화
- `personal` (개인): 매장 1개 (기존)
- `multi` (다점포): 첫 매장만 먼저 등록, 추후 추가
- `franchise_hq` (본사): franchises 행 생성 + 초대 코드(`F-XXXXXX`) 자동 발급 + 비활성 더미 매장 `[브랜드] 본사`
- `franchisee` (가맹점주): 본사 초대 코드 입력 시 franchise_id 자동 연결, 비우면 혼자 시작(자연빵 흡수 대기)

#### 2. 타입별 3단계 UI 동적 조정 (`applySignupTypeUi`)
- franchise_hq: 타이틀 "본사(브랜드) 정보", placeholder "브랜드명"
- franchisee: 초대 코드 입력 박스 표시, 타이틀 "가맹점 정보"
- multi: 타이틀 "첫 매장 정보"

#### 3. `completeSignup` 타입별 분기
- franchise_hq: `franchises` INSERT → 비활성 더미 stores → `franchise_admin` employees
- franchisee: 초대 코드로 franchises 조회 → store.franchise_id 설정
- 본사는 `seedNewStoreDefaults` 스킵 (카테고리/결제수단 불필요)
- 본사는 "초대 코드" 환영 카드, 나머지는 "매장 코드" 환영 카드

#### 4. 신규 본사 홈 `#franchiseHomeCont` (container [5-C])
- 브랜드명 + 초대 코드 표시
- 이번 달 전체 매출 + 가맹점 수 요약 카드
- **가맹점 순위 리스트** (매출 내림차순, 매출 %)
- 카드 탭 → `selectStoreFromFranchise(storeId)` → currentStore 전환 + 기존 대시보드 재사용
- 초대 코드 복사 버튼 (`copyInviteCode`)
- 월 선택기 (`fhMonth`)

#### 5. 자연빵 흡수 — 사이드메뉴 "🏯 본사 연결" (owner-only)
- 혼자 쓰던 매장 주인 → 본사가 주는 초대 코드 입력 → `stores.franchise_id` UPDATE
- 매출/지출 데이터 그대로 유지, 연결만 바뀜
- `joinFranchiseSheet` + `openJoinFranchise` + `submitJoinFranchise`

#### 6. 자동 라우팅
- 로그인 후 `authLevel==='franchise_admin'`이면 `franchiseHome`으로 자동 이동
- 사이드메뉴 `🏯 본사 홈`은 franchise_admin만 노출 (`.franchise-admin-only` 클래스 + applyPermissionUI 확장)

### 영향 범위
- **HTML**: 신규 container(franchiseHomeCont) + 신규 sheet(joinFranchiseSheet) + 사이드메뉴 2개 항목 추가 + 가입 시트 3단계 UI 조건부
- **JS**: 6개 신규 함수 (loadFranchiseHome, selectStoreFromFranchise, copyInviteCode, openJoinFranchise, submitJoinFranchise, applySignupTypeUi), completeSignup 분기 확장, nav actions 확장, applyPermissionUI 확장
- **DB**: 변경 없음 (Phase 1-A1의 franchises.invite_code, owner_user_id 재사용)

### 검증
- ✅ node --check 통과 (8026 lines)
- ✅ 신규 DOM id 전부 유니크 (15개)
- ✅ 가입 타입 4종 selectSignupType 바인딩
- ✅ franchise_admin 자동 라우팅
- ✅ 기존 PIN 로그인 / 개인 사업자 가입 경로 영향 없음

### 사장님 수동 작업
- 앱 Ctrl+Shift+R. **SQL 추가 실행 불필요** (Phase 1-A1 SQL 이미 실행됨).
- 테스트 시나리오:
  1. **본사 가입**: 로그인 오버레이 → 매장 시작하기 → "🏯 프랜차이즈 본사" 선택 → 6단계 완료 → 본사 홈 자동 진입 + 초대 코드 보임
  2. **가맹점주 가입(코드 있음)**: 새 이메일로 → "🎫 가맹점주" → 3단계에서 본사 코드 입력 → 가입 완료 → 본사 홈에 자동 집계
  3. **자연빵 흡수**: 기존 개인 가입 계정 로그인 → 사이드메뉴 → "🏯 본사 연결" → 코드 입력 → 본사에 연결됨

### 한계 (알려진)
- **RLS 정책**: 현재 RLS가 본사 계정의 여러 store 읽기를 막을 수 있음. 문제 시 `policies` 추가 SQL 별도 제공 필요
- **다점포 사업자 매장 추가 UI**: 이번엔 첫 매장만 등록. 추가 매장은 추후 (본사 홈 형태 재사용 검토)
- **가맹점 승인/해지**: 본사가 가맹점을 자동 승인. 거부 워크플로우는 Phase 1-A2b
- **매장별 매출 상세**: 본사 홈은 이번달 매출 합계만. 차트/추세는 매장 전환 후 대시보드에서

### 다음 단계
- **Phase 1-A3**: 직원 매장 코드 로그인 + 카톡 초대 링크
- **Phase 1-B**: Sentry 에러 모니터링
- **Phase 1-C**: FAQ + 문의 채널
- 필요 시 본사용 RLS 정책 SQL 추가

---

## [2026-04-24] Phase 1-A1 — 매장 가입 플로우 (개인 사업자 MVP)

### 상태: 구현완료 → 배포 예정 (**사장님 SQL 실행 필요**)
### 규모: 대형 (HTML ~150줄 + JS ~330줄 + SQL 1개)
### 브랜치: `claude/continue-todo-list-KG9PD`

### 배경
출시 로드맵 Phase 1-A의 첫 세션. "신규 매장 주인이 앱을 열어 스스로 가입 → 기본 세팅 자동 → 바로 사용" 플로우 구축. Supabase Auth 도입.

### 변경 요약

#### 1. DB 마이그레이션 — `docs/sql/migrate_signup_2026_04_24.sql`
- `employees.auth_user_id UUID REFERENCES auth.users(id)` (이미 있을 수 있음, IF NOT EXISTS)
- `stores.store_code TEXT UNIQUE` (직원 로그인용 6자리 고유 코드)
- `stores.tos_accepted_at TIMESTAMPTZ`
- `stores.business_no TEXT`
- `franchises.invite_code TEXT UNIQUE`, `franchises.owner_user_id UUID REFERENCES auth.users(id)` (Phase 1-A2 대비 미리 준비)
- 기존 stores에 store_code 자동 발급 (`md5(id) 앞 6자`)
- 전체 `IF NOT EXISTS` + DO 블록으로 **여러 번 실행 안전**

#### 2. 로그인 오버레이 업그레이드 (index.html:498~)
- 기존: 매장 선택 → 직원 이름+PIN
- 신규 추가:
  - 하단에 **"🏪 매장 시작하기 →"** 큰 버튼 (신규 사장님용)
  - **"주인 (이메일)"** 토글 — 이메일/비번 로그인 + "비번 찾기" 버튼
  - 관리자 PIN 로그인 + 매장 변경 버튼은 기존대로 유지

#### 3. 신규 가입 시트 `#signupOverlay` — 6단계 마법사
- 0/6: 사업자 유형 선택 (개인만 활성, 다른 3종은 Phase 1-A2 대비 "준비 중" 비활성화)
- 1/6: 이메일
- 2/6: 비밀번호 (8자↑ + 영문+숫자 권장)
- 3/6: 매장 이름 + 사장님 이름 + 주소(선택)
- 4/6: 사업자번호 (선택, 건너뛰기 가능)
- 5/6: 약관 동의 (전체 동의 + 이용약관/개인정보(필수) + 마케팅(선택))
- 진행바, 이전/다음, 실시간 검증

#### 4. 법률 문서 템플릿 시트 `#legalDocSheet`
- 이용약관·개인정보 처리방침 **초안 템플릿** 삽입
- "법률 검토 전" 명시 안내 배너
- 정식 서비스 개시 전 법무 검토 예정

#### 5. JS 가입 로직
- `openSignup` / `closeSignup` / `showSignupStep` / `selectSignupType`
- `signupPrev` / `signupNext` (단계별 검증 포함)
- `signupToggleAll` (약관 전체 동의 체크)
- `showLegalDoc(type)` — 약관/개인정보 초안 표시
- `completeSignup()` — 통합 트랜잭션:
  1. `sb.auth.signUp` (Supabase Auth)
  2. `stores` INSERT (store_code 자동 생성)
  3. `employees` INSERT (auth_level='owner', auth_user_id 연결)
  4. `store_settings` 기본값 upsert
  5. `seedNewStoreDefaults(storeId)` — 지출 카테고리 7종 + 결제수단 7종
  6. 자동 로그인 + 환영 카드
- `generateStoreCode()` — 헷갈리는 0/O/1/I 제외 6자리 (ABCDEFGHJKLMNPQRSTUVWXYZ23456789)
- `showWelcomeCard(storeCode)` — 가입 후 대시보드에 "환영+첫 액션 3개" 카드 (localStorage로 1회만)

#### 6. 이메일 로그인 JS
- `toggleOwnerLogin` — 이메일 로그인 영역 토글
- `submitOwnerLogin` — `sb.auth.signInWithPassword` + auth_user_id로 employee 찾기 → 매장 자동 선택 → completeLogin
- `openResetPw` — `sb.auth.resetPasswordForEmail` (비밀번호 재설정 이메일 발송)

### 기본 seed 데이터
- **지출 카테고리** 7개: 식자재(composite) / 인건비(attendance) / 고정비(fixed_costs) / 세금(manual) / 마케팅(manual) / 비품(receipts) / 기타(manual)
- **결제수단** 7개: 신용카드/현금/현금영수증/QR/기타결제/뽑기(대)/뽑기(소) — LEGACY_SALES_DEFS 재사용
- **store_settings**: royalty 0%, cardFee 2.5%, reserve 5% + 40만원

### 영향 범위
- **HTML**: 로그인 오버레이 하단 버튼 3개 추가 + 이메일 로그인 영역 + 신규 시트 2개
- **JS**: 신규 15개 함수, 전역 `signupState` 1개
- **DB**: 컬럼 5개 추가 (멱등성 IF NOT EXISTS)

### 검증
- ✅ node --check 통과 (7800 lines)
- ✅ 신규 DOM id 전부 유니크 (22개)
- ✅ 기존 PIN 로그인 경로 변경 없음 (하위 호환)
- ✅ SQL 여러 번 실행 안전 (IF NOT EXISTS + DO 블록)
- ✅ 기존 사장님 계정도 기존 PIN 방식 유지

### 사장님 수동 작업 (⚠️ 순서대로)
1. **Supabase Dashboard → Authentication → Providers → Email** 활성화 확인
   - 개발 단계: "Confirm email" OFF 권장 (즉시 가입 가능)
2. **Supabase SQL Editor → `migrate_signup_2026_04_24.sql`** 실행
3. 앱 Ctrl+Shift+R
4. 테스트:
   - 로그인 화면 하단에 "🏪 매장 시작하기" 보이는지
   - 버튼 클릭 → 6단계 가입 마법사 정상 작동
   - 새 이메일로 가입 → 대시보드 환영 카드 + 매장 코드 표시
   - 로그아웃 → "주인 (이메일)" 버튼 → 이메일 로그인 성공

### 한계 (알려진)
- **법률 문서는 초안 템플릿**. 정식 출시 전 변호사 검토 필수
- **사업자번호 진위 검증 없음** (국세청 API 연동 미구현 — Phase 2)
- **이메일 인증 메일**: Supabase 설정에 따라 즉시 가입 or 메일 확인 필요
- **프랜차이즈/다점포/가맹점주** 유형은 UI만 있고 비활성화 → Phase 1-A2에서 구현
- **기존 owner 계정 업그레이드 UI 없음** — 사장님 계정은 기존 PIN 로그인 유지

### 다음 단계
- **Phase 1-A2**: 프랜차이즈 본사/가맹점 가입 + 흡수(자연빵) 로직
- **Phase 1-A3**: 직원 매장 코드 로그인 + 카톡 초대 링크
- **Phase 1-B**: Sentry 에러 모니터링
- **Phase 1-C**: FAQ + 문의 채널

---

## [2026-04-24] 수식 검수 → 예비비 잔고 + 정산/검수 카드수수료 수정

### 상태: 구현완료 → 배포 예정 (DB 변경 없음)
### 규모: 중형 (수식 2곳 재작성)
### 브랜치: `claude/continue-todo-list-KG9PD`

### 배경
사장님 요청으로 전체 앱 수식 검수 → 2건의 불일치 발견:
1. 예비비 잔고(`calcReserveBalance`)가 `(매출 − 고정비)` 근사로 **30~50% 과다 적립**
2. 정산/검수 카드수수료가 `settlements.items_json` 기반이라 매출 관리 수정값과 **대시보드 카드수수료와 불일치**

### 변경 요약

#### 1. `calcReserveBalance` 정확한 순이익 기반 재작성 (index.html:6230~)
**수식 변경**:
```
[이전] approxNet = rev − fc
[이후] netProfit = rev − vendor − receipt − att − fixedProrated − royalty − cardFee
```
- **병렬 5쿼리**로 교체: sales_daily / fixed_cost_amounts / vendor_orders / receipts / attendance_logs
- 매출 소스 `settlements` → **`sales_daily`** (dev_lessons #47 단일 진실의 원천)
- 카드 매출은 `paymentMethods.legacy_key==='card'` 기반 (Part F 동적 결제수단 호환)
- **진행중 월은 고정비 일할** (대시보드 `reserveAmt`와 동일 공식)

**시나리오 대입 (2026-04, 22일 경과, 매출 33M)**:
- 이전: (33M − 2.3M) × 5% + 40만 = **1,935,000원** ❌
- 이후: netProfit 18,010,833 × 5% + 40만 = **1,300,542원** ✅
- 대시보드 reserveAmt와 **완전 일치**

#### 2. 정산/검수 `cardSales`·`totalRevenue` sales_daily 기반 (index.html:8608~)
```js
// 이전: settlements.items_json.pos_card 합산
// 이후: salesDailyRows.forEach(r=>{ totalRevenue+=salesRowTotal(r); cardSales+=getMethodAmount(r,cardMethod); })
```
- 대시보드와 **완전 동일 소스**. 매출관리에서 수정한 값도 정산/검수에 즉시 반영
- `settlements` 쿼리(salesRes)는 그대로 유지 (다른 용도 가능성 대비, 추후 정리)

### 영향 범위
- **함수**: `calcReserveBalance` 전면 재작성 (+20줄), `loadReconciliation` 수식 2줄 교체
- **DB**: 변경 없음 (READ 5개 추가, 쿼리 자체 증가는 1회/세션)
- **UI**: 숫자만 바뀜 (표시 구조 동일)

### 검증
- ✅ node --check 통과 (7487 lines)
- ✅ 시나리오 대입 결과 대시보드 ↔ 예비비 잔고 ↔ 정산/검수 카드수수료 **3화면 일치**
- ✅ Part F Phase 2 paymentMethods 호환 (legacy_key='card')
- ✅ 진행중 월은 일할, 완료 월은 전체 고정비

### 사장님 수동 작업
- 앱 Ctrl+Shift+R
- 테스트:
  1. 대시보드 "이번 달 적립예상" 값 확인 (A)
  2. 예비비 탭 "현재 잔고" — 과거 적립분 + A 포함된 값 확인. 이전보다 수백만원 적게 나올 수 있음 (정확화)
  3. 정산/검수 "카드수수료" 항목 → 대시보드 카드수수료와 동일한지

### 다음 후보
- 현재 달 진행중 `reserveAmt`와 `calcReserveBalance` 완전 동기화 상태. 월 완료 후엔 일할 아닌 전체 고정비로 자동 전환됨 (지난달 포함)
- settlements 쿼리(salesRes) 정산/검수에서 완전 제거 (추후 정리 단계)

---

## [2026-04-24] 사이드메뉴 재구성 + 거래처 대조 & 단가 화면

### 상태: 구현완료 → 배포 예정 (DB 변경 없음)
### 규모: 중형 (HTML 재배치 + 서브탭 1개 + JS ~150줄)
### 브랜치: `claude/continue-todo-list-KG9PD`

### 배경
사장님 니즈:
1. 사이드메뉴가 **지출 관련 그룹이 흩어져 있어** 보기 번잡 → "지출 관리"로 통합
2. 거래처별 **장표(vendor_orders) vs 실 송금(mydata)** 을 일별로 대조하고, 품목 **단가 추세**(배추 올랐네/내렸네)도 보고 싶음
3. 기존 장표 데이터 그릇(`vendor_orders`)은 이미 있지만, 보여주는 화면이 없어 활용 안 됨

### 변경 요약

#### A. 사이드메뉴 재구성 (HTML 재배치, DB 무변경)
- "📑 지출내역" → **"📑 지출 관리"** 이름 변경
- 지출 관리 아래로 통합:
  - 계좌내역 · 카드내역 (기존)
  - 지출 카테고리 설정 (기존)
  - **📋 고정비** (독립 그룹 해체 후 편입)
  - **🏪 거래처 관리** (독립 그룹 해체 후 편입, 파일 업로드 직접 링크는 제거 — vendorsCont 서브탭에 이미 존재)
  - **💵 급여 집계** (현황 그룹에서 이동)
- 그룹 9개 → **6개**로 감소

#### B. 거래처 매입 관리에 **📊 대조 & 단가** 서브탭 신설
**HTML** (~20줄):
- `vendorsCont .sub-tabs`에 버튼 1개 추가 (`data-sub="compare"`)
- `<div id="vendorCompare">`: 거래처 선택 + 월 선택 + 결과 렌더 영역(`#vcBody`)

**JS** (~150줄):
- `initVendorCompare()` — 거래처 드롭다운(활성만) + 월 초기값 세팅
- `loadVendorCompare()` — 병렬 3쿼리:
  1. 이번 달 vendor_orders (거래처 장표)
  2. 지난 달 vendor_orders (단가 비교용)
  3. 이번 달 mydata_transactions **이름 매칭** (`sub_category.eq.이름` OR `description.ilike.%이름%` OR `merchant_name.ilike.%이름%`, 출금만 `amount<0`)
- `renderVendorCompare()` — 3섹션 렌더:
  - 📊 **요약 카드**: 장표 합 / 송금 합 / 차액 (일치·초과 송금·미지급 의심 라벨)
  - 📅 **일별 대조표**: 날짜 × (장표 / 송금 / 차액)
  - 💹 **품목 추세**: 이번 달 vs 지난 달, 변화율(%), 📈/📉 이모지, 신규/중단 배지. **quantity 있으면 원/단위 기준, 없으면 총액 기준** 자동 분기

**FK / 이름 매칭 처리 (사장님 "fk 고려" 요청)**:
- `vendor_orders.vendor_id → vendors.id` — 안전한 FK 기반 조회
- `mydata_transactions`는 vendor_id 없음 → **이름 매칭만 가능** (기존 분류 규칙과 동일)
- PostgREST `.or()` 파서 대응: 거래처명에서 `,()` 제거한 `safeName` 버전 사용
- `select('*')` 로 가져와 **quantity 컬럼 존재 여부와 무관**하게 동작 (있으면 단가 활용, 없으면 총액 기준)

**사용자 친환경 배려**:
- 거래처 미선택 시 안내 문구 + 사용법 힌트
- 이번 달 데이터 없을 때 empty state
- 차액 뱃지 색상 의미 부여 (일치=초록, 초과 송금=빨강, 미지급=주황)
- 변화율 이모지 (📈 증가=빨강, 📉 감소=초록 — 지출 관점)
- 하단 안내 박스: 장표 업로드 방법 / 이름 매칭 한계 / 품목명 통일 권장

### 영향 범위
- **HTML**: side-menu 9그룹→6그룹, vendorsCont 서브탭 3→4, 신규 vendorCompare 패널
- **JS**: `vendorTab` 분기 추가, 신규 3함수 (init/load/render)
- **DB**: 변경 없음 (READ만, 기존 `vendor_orders`·`mydata_transactions`)

### 검증
- ✅ node --check 통과 (7470 lines)
- ✅ 사이드메뉴 `navFromSide|vendorUpload` 잔재 0건 (vendorsCont 내부 서브탭은 유지)
- ✅ 신규 식별자 유니크 (loadVendorCompare, renderVendorCompare, initVendorCompare)
- ✅ `nav.subTabMap.vendorUpload` 항목은 유지 — 외부 딥링크 호환 (주석 처리하지 않음)

### 한계 (알려진)
- `vendor_orders.quantity` 컬럼이 실제 DB에 있는지 불확실 — 있으면 단가 추세 정확, 없으면 총액 증감율로 대체 (UI에 안내)
- 거래처 이름 변경 시 과거 mydata 매칭 놓칠 수 있음 (현 구조 한계. 별칭 테이블은 별도 작업 필요)
- 거래처명에 `,()` 포함 시 자동 제거 버전으로 매칭 (PostgREST or-filter 제약)

### 사장님 수동 작업
- 앱 Ctrl+Shift+R. Supabase 변경 없음.
- 테스트 시나리오:
  1. 햄버거 → 사이드메뉴에 **"지출 관리"** 아래 5개 항목 (계좌내역·카드내역 / 지출 카테고리 / 고정비 / 거래처 관리 / 급여 집계) 확인
  2. 거래처 관리 → **📊 대조 & 단가** 탭 → 대봄야채 선택 → 이번 달 요약/일별/품목 추세 출력 확인
  3. 장표 없는 거래처는 요약이 "차액 전액(송금만)"으로 나옴 → 파일 업로드 탭 안내 효과 체크

### 다음 후보 (필요 시)
- 품목명 별칭 관리 (예: "배추"="봄배추") → 단가 추세 정확도 향상
- `vendor_orders.quantity` 명시적 컬럼 추가 마이그레이션 (SQL 파일만 준비)
- 거래처 별칭 테이블로 mydata 이름 매칭 개선

---

## [2026-04-24] 영수증 학습 버그 수정 + 기록 내역/편집 화면 추가

### 상태: 구현완료 → 배포 예정 (DB 변경 없음)
### 규모: 중형 (HTML ~100줄 + JS ~150줄)
### 브랜치: `claude/continue-todo-list-KG9PD`

### 배경
사장님 보고:
1. 영수증 저장 시 카테고리 학습이 **제대로 작동 안 함** (같은 품목 반복 오분류)
2. 영수증 저장 후 **수정 불가** — 기록 내역을 보거나 고칠 UI 없음

### 변경 요약

#### A. 학습 버그 수정 (핵심)
**원인**: `saveReceipt`가 품목명 전체(예: "양파 10kg 2봉")를 `learnClassification` keyword로 저장. `classification_rules.match_type='contains'`라 **키워드가 길면 다음 영수증("양파 5kg")에서 contains 매칭 실패** → 학습이 실질적으로 무력화됨.

**해결**:
- 신규 함수 `normalizeItemKeyword(item)` — 품목의 **첫 한글/영문 덩어리**(2자 이상) 추출
  - "양파 10kg 2봉" → "양파", "삼겹살2kg" → "삼겹살", "생수500ml 12입" → "생수"
- `saveReceipt` 학습 호출부 1곳을 이 정규화 경유로 변경

#### B. 영수증 탭 서브탭 + 기록 내역/편집 화면 신설
**HTML** (index.html 660~763, ~100줄):
1. `receiptCont` 내부에 `.sub-tabs` 2개 — `📸 새 영수증` / `📋 기록 내역`
2. 기존 영수증 등록 UI를 `<div id="rcpNew">`로 감싸기
3. 신규 `<div id="rcpList">` — 월 선택 + 합계 + 날짜 그룹 리스트(`rcpListBody`)
4. 신규 `<div id="receiptEditSheet">` — 날짜/거래처/품목/금액/분류/정상↔오답/삭제/저장

**JS** (index.html 2760~ 신규 섹션, ~150줄):
- 전역: `rcpListMonth`, `rcpRecords`, `rcpEditingId`, `rcpEditingCategory`
- `rcpTab(tab,el)` — 서브탭 전환, list 진입 시 loadReceiptList
- `onRcpListMonthChange(el)` — 월 변경 트리거
- `loadReceiptList()` — 월별 receipts 조회 (id,receipt_date,vendor,item,total_price,category,category_id,note 포함)
- `renderReceiptList()` — 날짜 그룹 카드 리스트. 오답은 회색/65%. 카드 어디든 탭하면 편집.
- `openReceiptEdit(id)` — 편집 시트 오픈, 기존 값 채움
- `openReceiptEditCat()` — `openCatPicker` 재사용 (거래내역 편집과 동일 UI)
- `saveReceiptEdit()` — UPDATE + 정상이면 `learnClassification` 자동 호출 (수정한 분류로 규칙 갱신)
- `deleteReceiptRow()` — confirm 후 DELETE

### 영향 범위
- 함수: `saveReceipt` (학습부 1곳), 신규 8개 함수
- DOM 신규 id: rcpNew, rcpList, rcpListMonth, rcpListBody, rcpListTotal, receiptEditSheet, reDate, reVendor, reItem, reAmount, reCatBtn + name="reNote" 라디오
- DB: 변경 없음 (읽기 + update/delete만)

### 검증
- ✅ node --check 통과 (7272 lines)
- ✅ 신규 DOM id 모두 유니크 (1건씩)
- ✅ 기존 `saveReceipt` / `applyRulesToReceipt` 로직 보존 (learn keyword만 정규화)
- ✅ `openCatPicker` 재사용 — 거래내역 편집과 동일 경험
- ✅ 행별 매장 격리 — `.eq('store_id',currentStore.id)` 유지

### 사장님 수동 작업
- 앱 Ctrl+Shift+R. Supabase 변경 없음.
- 테스트:
  1. 영수증 탭 → `📋 기록 내역` → 이번 달 영수증 리스트 나오는지
  2. 아무 카드 탭 → 편집 시트 → 분류 바꾸고 💾 저장 → 토스트 + 리스트 갱신 확인
  3. 같은 품목(예: "양파")으로 다시 새 영수증 찍어보면 **이번엔 학습된 분류로 자동 매칭되는지** (✨ 배지 표시)
  4. 🗑 삭제 버튼도 동작하는지

### dev_lessons 신규 #49
"학습 규칙 keyword는 **짧게 정규화** — contains 매칭 성립 조건" (별도 추가 예정)

---

## [2026-04-24] Part F Phase 2 — 대시보드/정산검수 결제수단 동적화

### 상태: 구현완료 → 배포 예정 (DB 변경 없음)
### 규모: 중형 (~70줄 변경, 추가 식별자 12건)
### 브랜치: `claude/continue-todo-list-KG9PD`

### 배경
Phase 1(2026-04-23)에서 매출 관리/마감정산만 결제수단 동적화 완료. 사장님이 신규 결제수단(예: 카카오페이) 추가해도 **대시보드 매출 도넛/정산검수 매출 대조에는 안 나오는** 반쪽 상태였음.

### 변경 요약
1. **`loadDashboard` (settle 경로)**
   - sales_daily SELECT: 레거시 7컬럼 → `select('*')` (당월/전월 둘 다)
   - `salesBreakdown` 집계: paymentMethods 동적 루프 + `getMethodAmount(s,m)` + key=`m.name`
   - `totalRevenue`: `salesRowTotal(s)` 재사용
   - `cardSales`: `paymentMethods.find(m=>m.legacy_key==='card')` 기반 (이름 변경 내성). ups 경로 폴백 유지
   - `revColors`/`revOrder`: paymentMethods에서 동적 생성. ups 경로용 '카드/현금/기타' 폴백 보강
2. **`loadReconciliation` (Part D 매출 대조)**
   - sales_daily SELECT: 레거시 7컬럼 → `select('*')`
   - `salesDefs` 하드코딩 제거 → paymentMethods 동적 생성
   - **method key = `legacy_key || 'm_'+id`** — 기존 `sales_recon_mapping` JSON 키 그대로 호환
   - `salesTotals`/`depositByMethod` 동적 맵으로 교체
   - 매출 항목 이름: `getMethodLabel(m)+' 매출'` (예: "💳 신용카드 매출", "💵 현금 매출")
   - 색상: `m.color` 사용
3. **`dashSaleSource==='ups'` 경로 미변경** — upsolution 3컬럼 구조(카드/현금/기타) 그대로

### 영향 범위
- 함수: `loadDashboard`, `loadReconciliation` + 내부 렌더 블록(revColors/revOrder, salesDefs)
- DOM: 변경 없음
- DB: 읽기만 (SELECT * 확장)

### 검증
- ✅ node --check 통과 (7085 lines)
- ✅ Part F Phase 2 식별자 12건 / `methodKeyOf` 4회 사용
- ✅ `salesDefs`/`salesTotals.{card,...}` 잔재 0건
- ✅ 레거시 `sales_recon_mapping` 키({card,cash_receipt,qr,etc}) 호환 — methodKey가 legacy_key 우선
- ✅ Phase 1 SQL 미실행 매장 안전망 — paymentMethods LEGACY 폴백 + getMethodAmount legacy_key 폴백 둘 다 유지

### 사장님 수동 작업
- 앱 Ctrl+Shift+R만. Supabase 변경 없음.
- (Phase 1 SQL 실행 후 결제수단 관리에서 추가한 신규 수단이 대시보드/정산검수에도 자동 반영됨)

### 부수 효과 (사용 시 참고)
- 매출 대조 섹션에 **현금/뽑기(대형)/뽑기(소형)도 노출**됨 (paymentMethods에 활성으로 있으면). 매핑 안 한 항목은 기존처럼 "⚙️ 입금 카테고리 설정" 안내. 현금처럼 입금 매칭 의미 없는 결제수단은 그냥 미설정 상태로 두면 OK.
- 시각 노이즈가 부담되면 Phase 3 후보로 "결제수단 관리에 *대조 제외* 토글 추가" 검토.

### Phase 3 (예정, 별도)
- sales_daily 레거시 7컬럼 DROP — amounts jsonb만 남김
- 결제수단 관리에 "매출 대조 표시 여부" 토글 (선택)
- 안전을 위해 Phase 2 배포 후 1~2주 관찰 필요

---

## 🏁 2026-04-23 세션 마감 (종합)

**처리**: 1순위 4건 + 2순위 6건 + 3순위 3건 = **13건** 완료 + **1건 오진단 판명 스킵**(⑫)
**브랜치**: `claude/complete-priority-tasks-yRxCN` → main 머지 5회 (각 Part별)

**main 커밋 흐름**:
1. `71a5045` Part A — 자기-버그 ①②③ (수정본 보호, 날짜 충돌, sync 알림)
2. `ae4f6d0` Part B — 대시보드 sales_daily 통합 ④
3. `2938ac3` Part C — UX 소형 묶음 ⑥⑦⑧⑨⑩
4. `175f552` Part D — 정산/검수 매출 대조 ⑤
5. `41c1411` Part E — 빈 매출 큰 버튼 + 예비비 이력 ⑬⑭
6. `b78b39a` Part F Phase 1 — 결제수단 동적 관리 ⑪

**사장님 실행 대기 SQL** (배포 완료, 사장님이 실행해야 풀 기능 활성화):
- `migrate_sales_recon_mapping_2026_04_23.sql` (Part D — 매출 대조)
- `migrate_payment_methods_2026_04_23.sql` (Part F — 결제수단)

**이미 실행 완료 SQL** (사장님 확인):
- `backfill_sales_daily_from_settlements_2026_04_23.sql` (Part B 배포 시 실행됨)

**신규 dev_lessons**: #46 자동 sync 수정본 보호 · #47 단일 진실의 원천 · #48 검증 없이 todo 전달 금지

**다음 세션 후보**: Part F Phase 2 (대시보드/정산검수 paymentMethods 동적화). 진입 트리거는 `docs/todo_next_session.md` 상단 참조.

---

## [2026-04-23 후속] 3순위 Part F Phase 1 — 결제수단 동적 관리 ⑪

### 상태: 구현완료 → 배포 예정 (사장님 SQL 실행 필요)
### 규모: 대형 (DB 테이블 신설 + ~300줄)
### 브랜치: `claude/complete-priority-tasks-yRxCN`

### 변경 요약
1. **DB 마이그레이션** — `payment_methods` 테이블 + `sales_daily.amounts jsonb` 추가
   - SQL: `docs/sql/migrate_payment_methods_2026_04_23{.sql,_rollback.sql}`
   - seed: 모든 매장에 기본 7개 결제수단 자동 입력 (legacy_key 매핑)
   - 백필: 기존 sales_daily 7컬럼 → amounts jsonb 이동
2. **전역 `paymentMethods` 배열 + `loadPaymentMethods`** — selectStore 시 자동 로드
   - 테이블 없거나 비어있으면 `LEGACY_SALES_DEFS` 7개로 폴백 (SQL 미실행 안전망)
3. **헬퍼 함수 신규**
   - `getMethodAmount(row, method)` — amounts 우선, legacy_key 폴백
   - `getMethodLabel(method)` — 아이콘+이름
4. **매출 관리 UI 동적화**
   - `salesRowTotal` — amounts 기반 합산 + legacy 폴백
   - `renderSalesCards` itemsHtml — paymentMethods 루프
   - 편집 시트 HTML: 7개 고정 input 제거 → `#seRowsContainer` 동적 생성
   - `_populateSalesEditSheet` — paymentMethods 순회하여 input 생성
   - `_recalcSeTotal` — `data-method-id` input 합산
   - `saveSalesDaily` — amounts + legacy 컬럼 **동시 저장** (호환)
5. **`syncClosingToSalesDaily`** — amounts에도 동시 저장 (legacy_key 있는 method만)
6. **결제수단 관리 UI 신규** — 사이드메뉴 `💰 매출 관리 › 결제수단 관리`
   - `paymentMethodsSheet`: 목록 + 추가 버튼
   - `paymentMethodEditSheet`: 아이콘/이름/색상/순서 편집, 삭제 (soft-delete: is_active=false)
   - 색상 피커 ↔ hex 입력 양방향 동기화

### 검증
- ✅ node --check 통과 (7075 lines)
- ✅ Part F 식별자 42건 존재
- ✅ 기존 `SALES_COLS`/`SALES_LABELS` 제거, `seCard` 등 하드코딩 id 0건
- ✅ 레거시 폴백 존재 (SQL 미실행 시에도 앱 정상 동작)
- ✅ 기존 sales_daily 컬럼 유지 (롤백 가능)

### 사장님 수동 작업 (⚠️ 배포 전)
1. Supabase SQL Editor → `migrate_payment_methods_2026_04_23.sql` 실행 (1초)
2. 앱 Ctrl+Shift+R → 사이드메뉴 → 💰 매출 관리 → "결제수단 관리"
3. 테스트:
   - 기본 7개 목록 보이는지
   - "카카오페이" 같은 신규 추가 → 매출 관리 편집 시트에 새 행 나타나는지
   - 이름 변경 → 매출 카드에 반영되는지
   - 매출 입력 → 저장 → 데이터 정상 저장되는지

### Phase 2 (예정, 별도)
- 대시보드 `loadDashboard` salesBreakdown → paymentMethods.name 기반 집계
- 정산/검수 `loadReconciliation` 매출 대조 4항목 → paymentMethods 기반
- 신규 결제수단 추가해도 대시보드/정산검수에 자동 반영되도록

### 한계 (Phase 1)
- 신규 추가한 결제수단(legacy_key 없음)은 **마감정산 자동 기록 대상 아님** — 마감정산은 POS 기반 고정 구조라 의도적. 사장님이 매출 관리에서 수동 입력 필요
- 대시보드 매출 상세 아코디언은 아직 legacy_key 기준 (Phase 2에서 동적화)

---

## [2026-04-23 후속] 3순위 Part E — 소형 UX 2건 + ⑫ 오진단 반성

### 상태: 구현완료 → 배포
### 규모: 소형 (2건 + dev_lessons #48)

### 변경
1. **⑬ 빈 매출 관리 중앙 큰 버튼** — `renderSalesCards` empty state 2곳을 "📊 이번 달 매출이 아직 없어요 + [＋ 매출 추가] 큰 버튼" UI로 교체
2. **⑭ 예비비 사용 이력 팝업** — 대시보드 예비비 잔고 미니 클릭 → 기존 nav('reserve') → `openReserveHistorySheet()` 바텀시트로 교체
   - 신규 시트: `reserveHistorySheet` (잔고 + 최근 20건 사용 내역)
   - "예비비 탭에서 자세히 보기 ›" 버튼으로 풀 페이지 이동도 가능 (기존 동선 보존)
3. **⑫ 스킵** — 거래내역에 `📸 영수증 참조` 이미 존재 (`renderTxRow` 6186). todo 진단 오류. `dev_lessons #48` 추가.

### dev_lessons #48 (새로 추가한 반성)
"todo/메모의 기술 진단을 검증 없이 사장님께 전달 금지. grep 1회 필수." 유사 패턴 재발 방지.

### 검증
- ✅ node --check 통과 (6876 lines)
- ✅ Part E 식별자 15건 존재
- ✅ DB 변경 없음
- ✅ 기존 예비비 탭 접근 경로 유지 (시트 내 버튼)

### 사장님 수동 작업
- 앱 Ctrl+Shift+R만. Supabase 변경 없음.

---

## [2026-04-23 후속] 2순위 Part D — 정산/검수 매출 대조 섹션 추가 ⑤

### 상태: 구현완료 → 배포 예정 (사장님 SQL + 매핑 설정 필요)
### 규모: 대형 (loadReconciliation 확장 + 신규 시트/함수, ~150줄)
### 브랜치: `claude/complete-priority-tasks-yRxCN`

### 변경 요약
1. **DB 마이그레이션** — `store_settings.sales_recon_mapping jsonb` 컬럼 추가
   - SQL 파일: `docs/sql/migrate_sales_recon_mapping_2026_04_23{.sql,_rollback.sql}`
2. **`loadReconciliation`** — sales_daily 쿼리 추가, 입금(amount>0) 매칭 로직 신규
   - summary에 매출 4항목 추가: `_sales_card / _sales_cash_receipt / _sales_qr / _sales_etc`
   - 각 entry에 `type:'sales'|'expense'` 필드 도입 (섹션 구분용)
   - `depositByMethod`/`matchedDepositIds`/`unmatchedDeposits` 신규 맵
3. **`renderReconSummary`** — 섹션 2개 분리 렌더
   - 📊 매출 대조 (sales_daily ↔ 입금)
   - 💸 지출 대조 (기록 ↔ 출금)
   - 각 섹션별 소계. 매출은 "입금" 컬럼, 지출은 "출금" 컬럼
4. **`renderReconDetailFor`** — 매출 entry면 "⚙️ 입금 카테고리 설정" 버튼 + 미설정 안내
5. **`renderReconUnmatched`** — 미매칭 출금 + 미매칭 입금 병렬 렌더
6. **신규 시트 `salesReconMappingSheet`** — 매출 수단별 매칭 카테고리 선택 UI
7. **`openSalesReconMapping` / `saveSalesReconMapping`** — 매핑 편집/저장 함수
8. **`openManualPayment`** — 매출 항목일 때 타이틀 "수동 입금 입력"으로 전환

### 자동 매칭 로직
- `mydata_transactions.amount>0` 거래 중 `category_id`가 `sales_recon_mapping[method]` 배열에 있으면 해당 매출 수단의 `actual`에 합산
- 수동 입력(`reconciliation.actual_total`)이 있으면 수동 우선

### 검증
- ✅ node --check 통과 (6827 lines)
- ✅ Part D 식별자 20건 존재
- ✅ 기존 지출 9개 로직 한 줄도 안 건드림 (분기 추가만)
- ✅ sales_recon_mapping 미설정 graceful fallback (크래시 없음)

### 사장님 수동 작업 (⚠️ **배포 전 필수**)
1. Supabase SQL Editor → `migrate_sales_recon_mapping_2026_04_23.sql` 실행 (1초)
2. 앱 Ctrl+Shift+R → 정산/검수 탭 → 매출 대조 섹션 확인
3. 💳 신용카드 매출 → 탭 → 상세 → "⚙️ 입금 카테고리 설정" → 카드사 입금 카테고리 체크
4. 📲 기타결제 매출도 동일하게 배달앱/계좌이체 카테고리 체크
5. 한 번 설정하면 이후 자동 매칭

---

## [2026-04-23 후속] 2순위 Part C — 소형 UX 버그 묶음 ⑥⑦⑧⑨⑩

### 상태: 구현완료 → 배포 예정
### 규모: 중형 (5건 묶음, 실변경 ~20줄)

### 변경 요약
- **⑥ salesEditSheet 모바일 스크롤 여유** — `#salesEditSheet .sheet{max-height:88vh;padding-bottom:100px}` + `.sales-edit-row{padding:8px 0}` (CSS 3줄). 키보드 뜰 때 하단 저장 버튼 가려짐 방지.
- **⑦ 0원 마감자동 카드 숨김** — `renderSalesCards`에 `visibleRows` 필터 도입. `total===0 && source==='closing'`만 제외. `closing_edited`/`manual`의 0원은 사장님 의도라 표시 유지.
- **⑧ 상세비교 setLoad 추가** — `openDailyDetail` 시작/완료/빈 데이터/에러 경로 4곳 `setLoad(true/false)`. todo 4건 중 실제 필요 1건만 처리(나머지 3건은 네트워크 호출 없어 불필요).
- **⑨ 비활성 카테고리 분류 UI** — `openCatPicker` 3단계 전부 이미 `is_active!==false` 필터 적용됨 확인. **수정 불필요**.
- **⑩ 기술 에러 문구 노출** — `alert('상세 비교 열기 실패: TypeError: ...')` → `toast('상세 비교를 열 수 없어요','error')` + `console.error` 분리 유지.

### 검증
- ✅ node --check 통과 (6676 lines)
- ✅ openDailyDetail 내 `alert` grep 0건, `setLoad` 경로 4개 모두 설정됨
- ✅ DB 스키마 변경 없음, 매장 격리 영향 없음

### 사장님 수동 작업
- 앱 Ctrl+Shift+R. Supabase 변경 없음.

---

## [2026-04-23 후속] 1순위 Part B — 대시보드 매출 차트 sales_daily 통합

### 상태: 구현완료 → 배포 예정 (사장님 백필 SQL 실행 필요)
### 규모: 대형 (쿼리+집계 4곳 교체 + SQL 백필 파일 2개)
### 브랜치: `claude/complete-priority-tasks-yRxCN`

### 배경
todo_next_session.md 1순위 ④ — 대시보드(settlements) ↔ 매출 관리(sales_daily) 데이터 소스 불일치. 사장님이 매출 관리에서 수동 수정해도 대시보드는 옛 숫자 유지되던 문제.

### 변경 요약 — 데이터 소스 통일
1. **`loadDashboard` 당월 쿼리 (~3848)** — `settlements.items_json` → `sales_daily` (card/cash/cash_receipt/qr/etc/extra_large/extra_small 7 컬럼)
2. **당월 집계 로직 (~3871)** — items_json 키 매핑 제거, 평탄 컬럼 직접 합산. `salesBreakdown['QR']` 신규
3. **전월 쿼리 + 집계 (~3860, ~4062)** — 동일 방식 교체
4. **버튼 레이블** (~975) — `📋 마감정산` → `📊 매출 관리`. DOM ID(`saleSrcSettle`)와 `dashSaleSource` 값('settle')은 유지 — 의미 재정의만
5. **매출 상세 아코디언 revColors/revOrder (~4326)** — `'QR':'#14B8A6'` 추가
6. **백필 SQL 2개 파일 신설** — `docs/sql/backfill_sales_daily_from_settlements_2026_04_23{.sql,_rollback.sql}`
   - `NOT EXISTS` 가드 — 기존 sales_daily(수정본 포함) 건드리지 않음
   - `memo='과거 마감정산 백필' + source='closing'` 마킹으로 롤백 식별
   - `items_json ? 'pos_card'` 필터로 구조 있는 행만 이관

### 검증
- ✅ node --check 통과 (6660 lines 인라인 JS)
- ✅ 대시보드 매출 집계 구간에서 `settlements|items_json|pos_` grep 0건
- ✅ 'ups' 분기 무손상 (daily_sales 그대로)
- ✅ `prevSettleRes`/`settleRes` 변수명 유지 — 회귀 최소화
- ✅ 단일 파일 유지, 매장 격리 유지

### 사장님 수동 작업 (⚠️ **배포 전 필수**)
1. Supabase SQL Editor → `docs/sql/backfill_sales_daily_from_settlements_2026_04_23.sql` 복붙 실행 (1초)
2. 앱 Ctrl+Shift+R → 대시보드 숫자가 매출 관리와 일치하는지 확인
3. 이상 시 rollback SQL로 즉시 되돌리기 가능

### 기대 효과
- 매출 관리에서 수동 수정 → 대시보드 자동 반영 (새로고침 1번)
- "대시보드가 왜 안 맞아?" 혼동 제거
- 유일한 매출 진실의 원천 = `sales_daily`

---

## [2026-04-23 후속] 1순위 Part A — 매출 관리 자기-버그 ①②③ 수정

### 상태: 구현완료 → 배포 예정
### 규모: 중형 (순수 로직 4군데, 약 40줄 추가)
### 브랜치: `claude/complete-priority-tasks-yRxCN`

### 배경
2026-04-23 심야 #58 매출 관리 v2 직후, todo_next_session.md 1순위 ①②③ (dev_lessons #46의 근원) 정리.

### 변경 요약 — DB 무변경, 순수 JS
1. **`syncClosingToSalesDaily` (3665~3696)** — upsert 전 기존 행 `source` 조회. `closing_edited`면 스킵 + `{skipped:true}` 반환.
2. **`finishSettlement2` (3624~3663)** — sync 에러 시 `toast(..,'warn',4000)`, sync skip 시 `toast('(해당 날짜는 수동 수정본..)','info',4000)`. 성공 시 기존 토스트 유지.
3. **`saveSalesDaily` (8733~)** —
   - 편집 모드 + 기존 source='closing' → `source='closing_edited'` 자동 승격
   - 편집 모드 + 날짜 바뀜 + 새 날짜에 타 카드 존재 → `confirm` → 타 카드 DELETE 후 upsert
4. **`renderSalesCards` (8677)** — `closing_edited` 뱃지 `✏️ 수정본`

### 검증
- ✅ node --check 통과 (6663 lines 인라인 JS)
- ✅ `closing_edited` grep 4건 (db_schema, dev_lessons, index.html 2곳)
- ✅ DB 스키마 변경 없음, source TEXT 컬럼 값만 확장
- ✅ docs/db_schema.md, dev_lessons.md #46 추가

### 사장님 수동 작업
- Supabase 변경 없음
- 앱에서 Ctrl+Shift+R 후 시나리오:
  1. 마감정산 저장 → 매출 관리에 카드 생성 확인 (`마감정산 자동`)
  2. 그 카드 탭 → 금액 수정 → 저장 → `✏️ 수정본` 뱃지 확인
  3. 같은 날 마감정산 재저장 → 수정본 유지 + `info` 토스트 확인
  4. 편집 중 날짜를 기존 카드 있는 날짜로 변경 → 덮어쓰기 confirm 뜨는지

### 다음 단계 (Part B)
- 1순위 ④: 대시보드 매출 차트 데이터 소스 → `sales_daily` 통합 (2~3시간, 별도 계획서 필요)

---

## 🚦 다음 세션 이어받기 (2026-04-23 말미 기록)

**진입 트리거 (사장님이 칠 말)**: `docs/todo_next_session.md 봐. 1순위부터 진행해줘`
**최우선 3건 (자기 버그 + 데이터 불일치)**:
1. 매출 카드 수동 편집본이 마감 재저장 시 덮어써짐 (`syncClosingToSalesDaily`)
2. 편집 시트 날짜 변경 시 UNIQUE 충돌 검증 없음 (`saveSalesDaily`)
3. sync 실패 시 사용자 알림 없음 (toast 추가 필요)
4. 대시보드 ↔ 매출관리 ↔ 마감정산 숫자 불일치 (dashboard가 sales_daily 미사용)

**상태**: todo_next_session.md에 14개 항목 + 우선순위 + 위치(라인) + 규모 정리 완료. 사장님 승인 대기.

---

## [2026-04-23 심야] #58 매출 관리 v2 — sales_daily 가로형 + 카드 UI (v1 폐기 재작성)

### 상태: 구현완료, 브랜치 푸시 + main 머지
### 규모: 중~대형 (이전 v1 거의 전부 철거 + 재작성)

### 배경 — critic 자체 실패
v1 (sales_records 세로 raw) 만들었더니 사장님 피드백 폭발:
- "결제수단 드롭다운 직관적이지 못함" → 제가 자의적 12개 라벨, 기존 마감정산 UI 무시
- "일일이 기록해야 돼?" → 세로 raw 6행/일 × 30일 = 월 180행 쌓임
- "결산 맞추려면" → 라벨이 mydata_transactions와 매칭 안 됨
- "가로 표가 안 낫나?" → 사장님 엑셀 마인드
- "짤려 안 짤려?" → 모바일 7컬럼 표 불가능

critic v2 PD1/PD3를 제가 만들었으면서 **본인이 안 지킨** 결과. (dev_lessons #45 추가)

### 변경 요약 — 전면 교체
1. **[SQL] v1 롤백 + 가로형 신설**
   - `migrate_sales_daily_2026_04_23_b.sql`: `DROP TABLE sales_records` + `CREATE TABLE sales_daily` (컬럼 7개 + UNIQUE(store_id,date))
   - `migrate_sales_daily_2026_04_23_b_rollback.sql`
   - 기존 v1 SQL 파일(`migrate_sales_records_2026_04_23.sql`)은 히스토리 참고용으로 유지
2. **[CSS 교체]** `.sales-table` 섹션(17줄) 전부 삭제 → `.sales-card` / `.sc-head` / `.sc-body` / `.sales-edit-row` 등 카드형 스타일 29줄
3. **[HTML 교체]** salesCont 컨테이너 + salesPasteSheet → 카드형 salesCont + salesEditSheet (편집 시트 신설)
   - 월 sticky 합계 헤더
   - 카드 목록 (일자별 1장, 결제수단 7개 리스트, 하루 합계)
   - + 매출 추가 버튼 1개 (엑셀 paste 제거)
4. **[JS 교체]** 기존 11개 함수 싹 삭제, 재작성:
   - `loadSalesDaily` / `renderSalesCards`
   - `openSalesAdd` / `openSalesEditById` / `_populateSalesEditSheet`
   - `onSalesEditInput` / `_recalcSeTotal`
   - `saveSalesDaily` (upsert onConflict:store_id,date)
   - `onSalesEditDelete`
   - `salesRowTotal` / `onSalesMonthChange`
   - 상수 `SALES_COLS`, `SALES_LABELS` (7개 결제수단)
5. **[마감정산 연동 재작성]** `syncClosingToSalesDaily` — 1회 upsert (이전: 6번 INSERT)
   - cash_detail_cash → cash (순수 현금)
   - cash_detail_qr → qr (QR 별도 분리)
   - pos_etc + cash_detail_transfer → etc (계좌이체 합산)
6. **[연결부]** nav actions: `sales: loadSalesDaily` / selectStore 캐시: `salesDaily=[]; salesEditCtx=null`

### 설계 근거 (사장님 피드백 수용)
- **가로형**: 월 30행 (이전 180행), 엑셀 마인드에 맞음
- **카드형 UI**: 짤림 없음 (세로 스크롤), 결제수단 7개 세로 리스트
- **UNIQUE(store_id,date)**: 하루 1행 강제, upsert 1번으로 갱신
- **QR 별도 컬럼**: 현금 상세에서 QR 추적
- **뽑기 하드코딩**: 퐁당샤브 전용. 동적 추가/삭제는 2단계

### 검증
- ✅ node --check 통과
- ✅ 옛 식별자(sales_records, salesPasteSheet 등) grep 0건 (완전 제거)
- ✅ inline 핸들러 X, data-action/data-change/data-input 패턴
- ✅ 매장 격리 모든 쿼리 `.eq('store_id', currentStore.id)`
- ⚠️ 사장님 실사용 피드백 필요

### 사장님 수동 작업
1. Supabase SQL Editor → `migrate_sales_daily_2026_04_23_b.sql` 실행
2. (v1 SQL 이미 돌렸으면 sales_records 자동 DROP됨)
3. 앱 Ctrl+Shift+R 후 사이드메뉴 → 💰 매출 관리

### 다음 단계 (2단계)
- 결제수단 사장님 UI에서 동적 추가/삭제 (payment_methods 테이블 신설)
- 대시보드 매출 차트 → sales_daily 집계 전환
- reconciliation 연결 (card → 카드사 입금, etc → 계좌 입금 매칭)

---

## [2026-04-23 말미] #58 매출 관리 페이지 v1 (sales_records 세로 raw) — 폐기

### 상태: 구현완료 (브랜치 푸시 + main 머지 예정)
### 브랜치: claude/apply-gstack-repo-24Y4m
### 규모: 대형 (새 테이블 + 새 페이지 + 마감정산 연계)
### critic v2 실전 가동 첫 건

### 배경
사장님 요청: "매출을 마감정산에서 수기 입력만 가능 → 매출 관리 페이지 별도 필요, 미래 API 연동 대비"
critic v2 발동 결과:
- Q1 "API 연동"은 핑계, 진짜는 입력 UX 고통 — 목표 재정의
- Q4 옵션 B(별도 페이지) 사장님 직관 존중 + 단계 분할 (1단계 raw 입력/조회/편집, 2단계 API·분류·집계)
- 입력방식은 **표 형식 1개로 통합** (행 추가 + 엑셀 paste)

### 변경 내역
1. **[신규 테이블]** `sales_records`
   - 컬럼: store_id, date, payment_method, category_id(FK→expense_categories), amount, memo, source, created_at, updated_at
   - source: 'manual' / 'closing' / 'excel' / 'pos_api' / 'card_api' — 미래 API 대비
   - 인덱스: (store_id, date DESC) + (store_id, date, payment_method)
   - updated_at 자동 갱신 트리거
   - SQL: `docs/sql/migrate_sales_records_2026_04_23.sql` (+ rollback)

2. **[UI] 사이드메뉴 → "💰 매출 관리" 그룹 추가**
   - 지출내역 그룹 바로 아래

3. **[UI] 매출 관리 페이지 (`salesCont`)**
   - 월 선택 input (기본 이번달)
   - 5열 표: 날짜 / 결제수단 / 카테고리 / 금액 / 🗑
   - 인라인 편집 (date/select/input all inline)
   - 색상 구분: 회색=closing, 노랑=excel, 흰=manual, 파란줄=변경됨, 초록줄=새 행
   - 버튼: + 행 추가 / 📋 엑셀 붙여넣기 / 💾 변경 저장
   - 엑셀 paste 시트: 탭/쉼표 구분, 첫 줄 제목 자동 감지, normalizeDate + parseSalesAmount

4. **[JS] 신규 함수 11개**
   - `loadSalesRecords` — 월별 조회 + income 카테고리 병렬 로드
   - `renderSalesTable` — 표 렌더 (tabular-nums + escapeHtml)
   - `addSalesRow` / `onSalesEdit` / `onSalesEditAmt` / `onSalesRowDelete`
   - `saveAllSalesChanges` — UPDATE + INSERT 일괄
   - `openSalesPaste` / `applySalesPaste` / `parseSalesPaste` / `normalizeDate` / `parseSalesAmount`
   - `onSalesMonthChange` — 미저장 변경 경고
   - `syncClosingToSalesRecords` — 마감정산 → sales_records 동기화

5. **[JS] 연결부 수정**
   - `nav()` actions 매핑에 `sales: loadSalesRecords` 추가
   - `selectStore()` Promise.all 후 salesRecords/salesEditing/salesNewRows 캐시 클리어
   - 마감정산 저장 함수: settlements upsert 성공 후 `await syncClosingToSalesRecords()` 호출
     (sync 실패해도 마감정산은 성공 처리 — try/catch + console.error)

6. **[CSS]** `.sales-table` + `.sales-row[data-src]` + `.sales-del-btn` 등 18줄 추가 (table-layout:fixed + tabular-nums)

7. **[docs]** `db_schema.md`에 sales_records 섹션 / `plan.md`에 #58 항목 추가

### 매장 격리 (dev_lessons #28 준수)
모든 sales_records 쿼리에 `.eq('store_id', currentStore.id)` 강제:
- SELECT (loadSalesRecords) ✅
- INSERT (saveAllSalesChanges, syncClosing) ✅ store_id 페이로드에 포함
- UPDATE (saveAllSalesChanges) ✅ .eq 추가
- DELETE (onSalesRowDelete, syncClosing) ✅ .eq 추가

### FK 전수 점검 (dev_lessons #36 준수)
`sales_records.category_id → expense_categories.id`:
- ON DELETE SET NULL (카테고리 삭제 시 안전)
- 앱 레벨 필터: category_type='income' 만 드롭다운에 노출
- 삭제된 카테고리 데이터: category_id=null로 남음 (집계 가능)

### 검증
- ✅ node --check 구문 통과
- ✅ grep 잔재 없음
- ✅ data-action/data-change 인라인 핸들러 X (dev_lessons #1 준수)
- ✅ `<table>` + tabular-nums 준수 (dev_lessons #22)
- ✅ table-layout:fixed + colgroup (dev_lessons #15 횡스크롤 방지)
- ⚠️ 사장님 실제 사용 검증 필요 (추후 피드백)

### 다음 단계 (2단계, 별도 작업)
- POS/카드사 API 연동 (source='pos_api' 등)
- 대시보드 매출 차트 — settlements 대신 sales_records 집계로 전환
- 매출 카테고리 자동 분류 규칙

### 롤백 절차
1. 앱: git revert + 배포 재트리거
2. DB: `migrate_sales_records_2026_04_23_rollback.sql` 실행
3. 마감정산은 원래 그대로 동작 (settlements만 쓰던 흐름 복귀)

---

## [2026-04-23 후반] critic v2 — 퐁당샤브 3대 질문 + 사전 스캔 자동화

### 상태: 배포완료 (브랜치 푸시 + main 머지)
### 브랜치: claude/apply-gstack-repo-24Y4m
### 규모: 중형 (critic.md ~120줄 추가)

### 배경
critic v1 역적용 테스트 중 사장님 피드백:
> "기능은 다 쓸모 있어. 문제는 데이터 UX·FK 구조를 자꾸 뒤엎어야 돼."

→ v1의 6강제질문은 **스타트업 피봇용**이라 퐁당샤브의 실제 리스크(근본 없이 덧칠 반복)를 못 짚음.
→ 사장님이 "기능 선별을 못할 수도 있다"는 추가 지적 → v1 폐기 아닌 **병행**.

### 변경 요약
1. **[v2 3대 질문 추가]** `agents/critic.md`:
   - **PD1. FK 근본 체크** — UI 먼저 / DB 나중에 패턴 차단
   - **PD2. 개편 회차 체크** — 3회차 이상이면 보류 처방 권장
   - **PD3. 유령 데이터 체크** — dev_lessons #36 자동 링크
2. **[라우팅 표 확장]** 요청 유형별 v1/v2 우선순위 매핑
   - 새 기능 → v1 먼저
   - 개편/리디자인 → v2 먼저
   - FK·DB 스키마 → v2 PD1, PD3 필수
3. **[사전 스캔 자동화]** 묻기 전 bash 3종 자동 실행:
   - `git log`로 개편 회차 자동 카운트
   - `work_log.md` grep으로 유사 작업 자동 탐지
   - `dev_lessons.md` grep으로 관련 교훈 자동 링크
   - 결과를 2~3줄 요약해서 질문에 **증거로 첨부**
4. **[보고서 양식 업데이트]** 사전 스캔 결과 섹션 + v2 PD1/PD2/PD3 추가

### 이 변경이 해결하는 것
- 사장님이 과거 겪은 **"거래내역 N번째 개편"** 패턴을 숫자로 자각
- FK 먼저 확정 안 하고 UI부터 건드리는 패턴 차단
- **critic이 빈손 질문 안 함** — 항상 숫자·근거 들고 물음

### 다음 단계
- 실제 중형 요청 1건에서 v2 + 사전 스캔 실전 시험
- 겉돌면 즉시 재설계 (critic 자신도 탈출구 카운터 도입 고려)

---

## [2026-04-23] gstack 흡수 — `critic` 에이전트 신설 (기획 빈틈 비평가)

### 상태: 배포완료 (main 591b431)
### 브랜치: claude/apply-gstack-repo-24Y4m
### 규모: 대형 (새 에이전트 + 헌법 워크플로우 변경)

### 배경
사장님 요청: garrytan/gstack 레포의 좋은 부분만 흡수. 특히 `/office-hours`(6강제질문)와 `/plan-ceo-review`(4모드 검토)의 **기획 비평 로직**을 우리 `agents/`에 이식 — "내 기획의 빈틈을 네가 먼저 찾아내게" 하는 게 목적.

### 변경 요약
1. **신규**: `agents/critic.md` — 기획 빈틈 비평가
   - 6강제질문 (식당 버전): 수요현실 / 현재우회법 / 절박한한명 / 가장작은버전 / 관찰놀라움 / 미래적합성
   - 반-아부 규칙 + 5개 푸시백 패턴
   - 4가지 검토 모드 (확장/선별확장/유지/축소)
   - 탈출구: "그냥 해" 2번이면 즉시 통과 (위험 신호만 한 줄 경고)
2. **수정**: `CLAUDE.md` 4-1 표 + 4-2 순서도 → 중형/대형 워크플로우에 `critic` 단계 추가 (context_reader → **critic** → advisor → planner → …). 소형은 스킵.
3. **수정**: `CLAUDE.md` 부칙 파일구조에 `agents/critic.md` 추가
4. **수정**: `agents/advisor.md` depends_on: `critic`, 역할 경계 명시 (advisor=HOW, critic=WHY)
5. **신규**: `docs/dev_lessons.md` #44 "외부 프레임워크 흡수 시 인프라 버리고 사고법만" 교훈 추가

### 인프라 코드 제거 원칙 (dev_lessons #44)
- gstack 원본 SKILL.md ~2100줄 중 ~800줄이 telemetry/config/세션 관리 bash — **전부 제외**
- 가져온 것: 사고법·질문·패턴만 한국어로 번역
- 버린 것: `~/.claude/skills/gstack/bin/` 경로, preamble bash, WRITING_STYLE/LAKE_INTRO 등 gstack 전용 state

### 영향
- 코드(index.html) 무변경
- 다음 중형/대형 작업부터 critic 단계 자동 발동

### 다음 단계
- 사장님이 실제 중형 작업 요청 시 critic 1차 시험 가동
- 너무 깐깐하면 질문 수/푸시백 강도 조정

---

## [2026-04-22 후반] #57 거래내역 UI 전면 개편 + 분류 선택 바텀시트

### 상태: 배포완료 (main 1de7615)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 대형 (약 300줄 수정, 다중 커밋)

### 배경
사장님 스크린샷 기반 피드백 — "계좌/카드 내역 테이블이 정신없다",
"드롭다운 옵션 많으면 잘린다", "대/소분류 셀 분리 필요", "날짜 모르겠다" 등 연속적 UX 이슈.

### 변경 요약 (12가지)

**거래내역 테이블 (renderBankTxTable/renderCardTxTable)**
1. 컬럼 구조 재설계: 날짜/액션 제거 → 4열(내용 30% / 대분류 18% / 소분류 24% / 금액 28%)
2. 날짜 그룹 헤더 신설: '📅 04-20 (목) · 4건' + sticky(top:0, z-index:2)
3. 금액 통합 컬럼: +파랑/-빨강 부호, tabular-nums 정렬
4. 컬러 도트 추가: expense_categories.color 기반
5. 행 탭 → 편집 시트 (✎✕ 버튼 제거)
6. cat===sub UI 방어 (중복값 1줄로 표시)
7. 평면 모드(금액/내용 정렬) — 각 행에 MM-DD 표시
8. 헤더 가운데정렬, 데이터: 내용 좌측 / 대분류·소분류 가운데 / 금액 우측

**정렬 UX**
9. 3단계 토글: 오름 ↑ → 내림 ↓ → 해제 (원상태로)
10. 활성 헤더 강조: 파란색 + 굵게 + 연한 파랑 배경

**필터 팝업**
11. z-index 1100 (네비바 1000 위) + box margin-bottom:72px (네비바 가림 회피)
12. 적용 버튼 강조: flex:2, 파란 그림자, '✓ 적용' 아이콘

**분류 선택 바텀시트 (NEW — 공통 openCatPicker)**
13. 확인필요 시트 + 편집 시트 둘 다 드롭다운/칩 UI 제거 → 버튼 1개 + 바텀시트
14. 3단계 드릴다운: 타입(1) → 대분류(2) → 소분류(3)
    - 지출/매출/제외: 3단계까지 (자식 있는 대분류만 3단계 진입)
    - 영수증 참조: 1단계에서 바로 선택
    - 예비비 사용: 1단계 탭 → 메모 prompt → 바로 선택
    - 미분류: 1단계에서 바로 선택
15. sheet-overlay 패턴 (body append 대신 HTML 미리 정의)
    - z-index 7000/7001 (기존 sheet 6000/6001 위)
    - 기존 openSheet/closeSheet 로직 재사용
    - 애니메이션·containing block 이슈 해결

**FK 정합성**
16. resolveCatPair에 '>' 분리 로직 추가
    - '식자재>육류' 입력 → {mainId:식자재id, mainName:'식자재', subName:'육류'}
    - 모든 저장 경로(applyReviewChoice/saveTxEdit/saveExcelBatch) 일관성
    - 결과: mydata_transactions.category_id = 대분류 id 고정 ✅

### 주요 커밋 (이번 세션 후반)
- 9f85e42 거래내역 테이블 B안 (날짜 그룹 + 분류 한줄 + 금액 통합)
- f546ea3 4열 분리 (대/소분류 별도 셀)
- 4bb4617 헤더 가운데 + 소분류 폭 확대
- 4b8449a 분류 셀 가운데 정렬
- 3232672 정렬 강조 + 적용 버튼 강조
- 370ec7d 날짜 헤더 sticky + 평면 모드 날짜
- 0509072 정렬 해제 + 필터 네비바 회피
- d51a946 분류 선택 바텀시트 (확인필요+편집)
- ad18caf 바텀시트 z-index 7000 (.sheet 6001 위로)
- f9ea4b6 getCatType 함수 복원 (ReferenceError)
- 12b9ad2 바텀시트 2단계 드릴다운
- 11ae9c2 3단계 드릴다운 + FK 보강
- 1de7615 sheet-overlay 패턴 통일 (중간에 뜨던 문제)

### DB 변경
- 없음 (코드/UI만)

### 사장님 확인 후 정상 동작
- 거래내역 테이블: 날짜 그룹, 컬러 도트, 금액 색상, 4열 분리
- 정렬: 3단계 토글, 활성 헤더 강조
- 필터: 네비바 위로 적용 버튼 보임
- 분류 바텀시트: 3단계 드릴다운 정상 작동

---

## [2026-04-22] #56 영수증참조+예비비 linked 카테고리 분리 (#54 구조 변경)

### 상태: 구현완료 (배포 대기, SQL 실행 필요)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 중형 (SQL 2개 + 코드 약 100줄)

### 배경
- #54에서 "식자재 > 영수증 참조" 소분류로 만들었는데 사장님 지적:
  - 한 영수증에 식자재+비품 섞여있으면 비품도 식자재로 집계됨 (같은 문제 재발)
  - 영수증 참조/예비비는 지출 카테고리가 아니라 "다른 시스템 연결용" 플래그
  - 둘을 하나의 "linked" 타입으로 묶지 말고 분리 (예비비는 메모 필요)

### 변경
1. **category_type 확장**: expense/income/exclude → + **receipt_ref** + **reserve** (5종)
2. **#54 구조 취소**: 식자재 > 영수증 참조 소분류 삭제
3. **신규 대분류 2개 INSERT**:
   - "영수증 참조" (category_type='receipt_ref', 시스템 상수)
   - "예비비 사용" (category_type='reserve', 시스템 상수)
4. **reserve_fund_logs.source_tx_id** 컬럼 추가 (FK→mydata_transactions, ON DELETE SET NULL)
5. **관리 화면 탭 3개 유지** (지출/매출/제외만 사장님 관리)
6. **리뷰 드롭다운 optgroup 5개**: 📸 영수증참조, 🏦 예비비 추가
7. **예비비 선택 시 메모 입력 필드** (확인필요 시트, 거래 편집 시트)
8. **자동 동기화**: 예비비 거래 저장 시 reserve_fund_logs INSERT (source_tx_id 연결)
9. **exclude_from_settlement 자동**: receipt_ref/reserve/exclude 타입은 자동 true
10. **saveTxEdit**: 예비비로 분류 변경 시 log 동기화(INSERT/UPDATE), 다른 분류로 변경 시 기존 log 삭제

### DB 변경
- 마이그레이션: `docs/sql/migrate_linked_categories_2026_04_22.sql`
  1. 백업 3개 (expense_categories_bak_20260422_c 등)
  2. reserve_fund_logs.source_tx_id 컬럼 추가
  3. 영수증 참조 + 예비비 사용 대분류 INSERT
  4. classification_rules UPDATE: sub_category='영수증 참조' → category='영수증 참조', sub=''
  5. mydata_transactions UPDATE: 기존 '식자재>영수증 참조' → 새 대분류로 이동
  6. 식자재 자식 '영수증 참조' DELETE
- 롤백 SQL: `migrate_linked_categories_2026_04_22_rollback.sql`

### 사장님 남은 할 일
1. Supabase SQL Editor에서 `migrate_linked_categories_2026_04_22.sql` 실행 (Run without RLS)
2. 앱 하드 리프레시
3. 확인필요 드롭다운에서 📸 영수증참조 / 🏦 예비비 그룹 확인
4. 예비비 사용 건 테스트: 메모 입력 → 현황>예비비에서 자동 차감 확인

---

## [2026-04-22] #54 "영수증 참조" 소분류 + 영수증 기반 집계 대체

### 상태: 구현완료 (배포 대기, SQL 실행 필요)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 중형 (약 50줄 수정 + SQL 2건)
### 배경
- 카드 거래 1건 = 카테고리 1개 제약 → 이마트 45,000원에 야채/공산품/비품 섞여있을 때 애매
- 사장님 제안: 카드 거래는 "영수증 참조"로 두고, 실제 집계는 영수증(품목별 분류)에서

### 변경
1. **expense_categories**: 식자재 대분류 아래 "영수증 참조" 소분류 INSERT (마이그레이션 SQL)
2. **classification_rules**: sub_category='직구상세' → '영수증 참조' UPDATE (일괄)
3. **mydata_transactions**: 기존 저장된 sub_category='직구상세' 건도 '영수증 참조'로 UPDATE
4. **집계 로직** (calcExpenseByCategories + reconcileRender):
   - `mydata_transactions.sub_category='영수증 참조'` 건은 **지출 집계에서 제외**
   - 영수증(receipts)은 정상 집계 → 이중 집계 방지
5. **UI 배지**: 거래내역 테이블에서 "📸 영수증 참조" 파란색 강조 표시

### DB 변경
- 스키마 변경 없음
- 마이그레이션 SQL: `docs/sql/migrate_receipt_ref_2026_04_22.sql`
  1. 백업 (classification_rules_bak_20260422_b)
  2. 식자재 자식으로 "영수증 참조" INSERT
  3. classification_rules + mydata_transactions sub_category UPDATE
- 롤백 SQL: `docs/sql/migrate_receipt_ref_2026_04_22_rollback.sql`

### 사장님 남은 할 일
1. Supabase SQL Editor에서 `migrate_receipt_ref_2026_04_22.sql` 실행 (Run without RLS)
2. 앱 하드 리프레시 (Ctrl+Shift+R)
3. 거래내역 → 쿠팡/이마트/하나로마트 등 건에 📸 영수증 참조 표시 확인
4. 영수증 촬영해서 품목별 분류 입력 → 실제 집계에 반영
5. 대시보드 4월 지출에서 "이마트 45,000" 카드건이 더 이상 식자재로 집계되지 않는지 확인

### 주의사항
- 영수증 참조 건은 **영수증 촬영 안 하면 집계 누락됨** → 향후 알림 기능 필요 (별도 작업)

---

## [2026-04-22] 매출/제외 카테고리 분리 (#53 category_type 컬럼 추가)

### 상태: 구현완료 (배포 대기)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 중형 (약 100줄 수정, DB ALTER 1건)
### 배경
- 2차 개편 후 리뷰 드롭다운에 '매출/카드대금/배당금' 하드코딩 남아있음
- 사장님 지적: "매출은 지출이 아닌데 지출카테고리에서 하면 안되지 않아?"
- 내 틀린 제안: 매출 소분류 4개 미리 INSERT
- 사장님 올바른 방향: 하드코딩/미리INSERT 금지, DB 관리 UI로 사장님이 직접 추가

### 변경
1. **expense_categories.category_type 컬럼 추가** (ALTER TABLE, default 'expense')
   - 사장님이 Supabase SQL Editor에서 이미 실행 완료:
     ALTER TABLE + UPDATE NULL → 'expense'
2. **편집 시트**: category_type 드롭다운 (지출/매출/제외) 추가
3. **지출카테고리 화면**: 상단 탭 3개 (💸 지출 / 💰 매출 / 🚫 제외)
   - 탭 전환 시 해당 타입 카테고리만 표시
   - + 추가 시 현재 탭 타입 기본값
   - 소분류 추가는 부모 타입 상속
4. **리뷰 드롭다운 하드코딩 제거**:
   - 기존 '매출/카드대금/배당금' 3개 option 삭제
   - DB 기반 optgroup 3개 (지출/매출/제외) 동적 생성
   - '미분류'만 유지
5. **집계 필터**: calcExpenseByCategories + reconcileRender에 category_type='expense' 필터
   - income/exclude 카테고리는 지출 집계에서 자동 제외

### DB 변경
- ALTER TABLE expense_categories ADD COLUMN category_type text DEFAULT 'expense' (사장님 실행 완료)
- 롤백: ALTER TABLE DROP COLUMN category_type (필요 시)
- 실제 매출/제외 카테고리 INSERT는 **하지 않음** — 사장님이 UI에서 직접 추가

### 사장님 남은 할 일
1. 앱 하드 리프레시 (Ctrl+Shift+R)
2. 사이드메뉴 → 지출 카테고리 → 상단 탭 확인 (지출/매출/제외)
3. 필요시 💰 매출 탭 → + 추가 (예: "매출" 대분류 → "QR결제/카드결제/현금입금/송금결제" 소분류)
4. 필요시 🚫 제외 탭 → + 추가 (예: "카드대금", "배당금")
5. 엑셀 업로드 후 확인필요 시트에서 드롭다운 그룹 구분 확인

### 제11조 절차
- [x] 사전 스캔 (기존 하드코딩 위치 확인)
- [x] 계획서 제출 + 사장님 지적 (하드코딩 금지 원칙 확립)
- [x] 수정 (DB 미리 INSERT 제거)
- [x] 3단 검증: node --check ✅ + 잔재 grep ✅
- [x] docs 업데이트 (db_schema + business_rules + work_log + dev_lessons)
- [ ] 배포 후 사장님 테스트

---

## [2026-04-22] 지출카테고리 2차 개편 (B+가 안 구현완료)

### 상태: 구현완료 (배포 대기 — 사장님 SQL 실행 + 재분류 도우미 사용 + 대시보드 숫자 확인)
### 브랜치: claude/review-docs-assessment-1UF8u
### 규모: 대형 (약 150줄 추가/수정 + 마이그레이션 SQL 2개)
### 승인: 사장님 "네 일단 해봐요" (B 풀패키지 + 가 주류별도 확정)

### 배경
- 기존 구조 `식자재(거래처)/식자재(직구)/식자재(주류)` 3분할 → 사장님 "식자재 얼마?" 물으면 3개 더해야 함
- 사장님 원하는 구조: **식자재 대분류 하나 + 육류/야채/공산품 소분류**
- "직구" 개념 삭제 — 쿠팡에서 사든 대봄에서 사든 "야채"는 야채, 품목으로 분류
- 주류는 별도 대분류 유지 (주세·매출비중 별도 추적 필요)
- 기존 expense_categories.vendor_category 컬럼이 이미 있어서 마이그레이션 단순화됨

### 구조 최종
```
식자재 (composite, 자식 합산)
  ├ 육류    (composite: vendor_category='육류' + receipts.category_id=소분류 id)
  ├ 야채    (composite: vendor_category='야채' + 동일)
  └ 공산품  (composite: vendor_category='공산품' + 동일)
주류 (vendor_orders, vendor_category='주류')
인건비/공과금·고정비/비품/마케팅/기타 (그대로 유지)
```

### 변경 요약 (8가지)
1. **드롭다운 4곳 옵션 교체**: 식자재/주류/직구 → 육류/야채/공산품/주류 (vendorCatFilter, vendorCatInput, expCatVendorCat)
2. **expCatSourceInput 신규 옵션**: `composite` (🍱 거래처+영수증 합산)
3. **calcExpenseByCategories composite 분기**: 대/소분류별 vendor_orders+receipts 합산. composite 소분류는 루프 스킵(중복 방지)
4. **reconcileRender composite 분기**: 자식 소분류별 details 생성 (sub_key='comp_<id>'). 대분류 자체 receipts는 'comp_direct_<id>'
5. **groupMap 재편**: `식자재(직구/영수증)` 그룹 삭제, `composite:'식자재'` 추가, 주류는 이름 기반 별도 그룹
6. **seedDefaultRules 카테고리명 통일**: `물품대금`(16건) + `직구`(14건) = 30건 → `식자재`로 일괄 치환 (Python 스크립트)
7. **OCR 프롬프트 예시 갱신**: `식자재>거래처` → `식자재>야채/육류/공산품` 3건 예시
8. **거래처 재분류 도우미 시트 신규**: 사이드메뉴 거래처 → 🔄 재분류 버튼 → 기존 식자재/직구 거래처를 육류/야채/공산품 일괄 재지정

### DB 변경
- 스키마 변경 없음 (기존 vendor_category 컬럼 활용, composite는 data_source text 값)
- 마이그레이션 SQL: `docs/sql/migrate_food_composite_2026_04_22.sql`
  - 1단계: 백업테이블 4개 (expense_categories/vendors/receipts/classification_rules)
  - 2단계: expense_categories 재편 (식자재(거래처/직구) 비활성, 식자재(주류)→주류 리네임, 식자재+자식 3개 INSERT)
  - 3단계: receipts 그대로 유지 (재분류 UI로 사장님이 업데이트)
  - 4단계: classification_rules 이름 일치화 ('물품대금'/'직구' → '식자재')
- 롤백 SQL: `docs/sql/migrate_food_composite_2026_04_22_rollback.sql`

### 제11조 절차 준수
- [x] 사전 스캔 (FK 6군데 grep + vendor_category 발견)
- [x] 백업 커밋 (ede8291)
- [x] 스크립트 치환 (Python: 물품대금 16 + 직구 14 = 30건, 실패 0)
- [x] 3단 검증: node --check ✅ + grep 잔재 0 ✅ + 샘플 육안 ✅
- [x] docs 5개 동기화 (본 항목 + db_schema + business_rules + dev_lessons + plan)
- [ ] 배포 체크 (push 후 사장님 앱 테스트)

### 사장님 남은 할 일
1. **Supabase SQL Editor**에서 `migrate_food_composite_2026_04_22.sql` 실행
2. 앱 하드 리프레시 (Ctrl+Shift+R)
3. **거래처 탭 → 🔄 재분류 버튼** → 기존 "식자재" 거래처 목록 → 육류/야채/공산품 중 선택 → 일괄 저장
4. 영수증 테스트 촬영 → AI가 "식자재>야채" 등으로 응답하는지 확인
5. 대시보드 4월 지출 아코디언 확인:
   - 식자재 1개 + 주류 1개 (이전: 식자재(거래처)/식자재(직구)/식자재(주류) 3개)
   - 숫자 합이 이전 3개 합과 같은지 (±0원)
6. 문제 시 즉시 롤백 SQL 실행 → 알려주시면 원인 분석

---

## [2026-04-21 말미] 후속 논의 — 지출카테고리 2차 개편 (**새 세션에서 진행**)

### 상태: **논의·설계 단계 (미구현)**
### 브랜치: claude/improve-category-ui-TQloc (현 브랜치 유지)

### 배경 (사장님 요구)
현재 지출카테고리 구조가 **구매경로별 분리**(식자재(거래처)/식자재(직구)/식자재(주류))라 사장님이 혼란스러움. 사장님 원하는 구조:
```
식자재 (대분류 하나)
 ├ 육류
 ├ 야채
 └ 공산품
```
거래처/직구 구분은 **이미 거래처 탭·영수증 탭**에서 보이므로 대분류 레벨에서 가를 필요 없음.

### FK 영향 점검 — 6군데 (새 세션에서 반드시 전부 검토)

| # | 대상 | 이슈 |
|---|------|------|
| 1 | `vendors.category` (`식자재/주류/직구/기타`) | 선택지 변경 시 기존 "식자재" 저장값 무효화 → 집계 깨짐 위험. 호환 유지 + 재분류 도우미 필요 |
| 2 | `expense_categories.data_source` | 현재 단일값. "거래처+영수증 합산"은 신규 분기 필요 → `food_composite` 소스 추가 or 집계함수 분기 |
| 3 | `mydata_transactions.category_id` | 오늘 규칙 확립 (dev_lessons #33): **항상 대분류 id**. 유지 필요 |
| 4 | `receipts.category_id` | 현재 소분류 id도 허용. mydata와 규칙 다름 → **통일 필요** (대분류 id + sub_category text) + 기존 데이터 마이그레이션 |
| 5 | `classification_rules` 시드 + 학습 | `category='물품대금'` 등 기존 명칭이 expense_categories.name과 어긋남. 이름 변경 시 UPDATE SQL 필요 |
| 6 | `expense_category_amounts` / `reconciliation` | 대분류 단위 저장·매칭. 소분류 수동 입력/대조는 **1차에서 제외** (대분류 단위 유지) |

### 제안 단계 옵션 (새 세션에서 사장님이 선택)

- **1단계만 (소형)**: `vendors.category` 선택지 확장 + 거래처 일괄 재분류 도우미 UI. 지출카테고리 구조는 그대로
- **2단계 풀패키지 (대형)**: 위 FK 6군데 전부 손봄. `food_composite` 집계 로직 추가
- **하이브리드 (추천)**: 1단계 먼저 배포 → 사용 체감 후 2단계 필요 여부 재판단

### 기술 메모
- `food_composite` data_source: 대시보드 집계 시 `vendors.category IN (육류,야채,공산품,...)`인 주문 + `receipts.category_id IN (자식 소분류들)` 합산
- `resolveCatPair` 이미 있음 → receipts.category_id 규칙 통일에도 그대로 활용
- 마이그레이션 SQL은 반드시 백업테이블 + 롤백 SQL 쌍으로 제출 (제8조)
- classification_rules 시드 수정 시 기존 저장된 규칙도 UPDATE 필요

### 주류 처리 미결
- 별도 대분류 `주류`로 유지할지, `식자재` 아래 소분류로 넣을지 사장님 결정 대기
- 권장: 별도 대분류 (주류세·매출비중 별도 추적 편의)

---

### 🚀 다음 세션 시작 방법 (복붙용)
```
docs 전부 읽고 (CLAUDE.md 제11조 특히, business_rules.md, dev_lessons.md,
plan.md, db_schema.md, work_log.md 최상단 "지출카테고리 2차 개편" 항목,
services.md) 절대 무시·생략 없이 준수.

세션 시작 필수: git fetch --all 먼저 실행 (dev_lessons #29).

현재 상태:
- main 최신 커밋 0fab804 (거래내역 분류 2줄 + 1글자 약자 매칭)
- 브랜치: claude/improve-category-ui-TQloc
- 미완료: 지출카테고리 2차 개편 (식자재 대분류 통합 + 품목 기반 소분류)

이어서 할 일:
1. work_log.md "지출카테고리 2차 개편" 항목의 FK 6군데 전수 재확인
2. 사장님께 단계 선택 확인 (1단계 소형 / 2단계 대형 / 하이브리드 중)
3. planner가 계획서 작성 → 승인 게이트
4. 승인 후 context_reader → advisor → reviewer → coder → tester → deployer

반드시:
- CLAUDE.md 제1조 1-1 승인 게이트 준수 (계획서 OK 전 코드 한 줄도 건드리지 말 것)
- 제11조 대규모 변경 안전 절차 6단계 (사전 스캔→백업→스크립트→3단 검증→기록→배포체크)
- 데이터 마이그레이션 SQL 실행/롤백 SQL 쌍 필수 (제8조)
- FK 점검은 work_log의 6군데 표 그대로 전부 확인:
  vendors.category · expense_categories.data_source ·
  mydata_transactions.category_id · receipts.category_id ·
  classification_rules · expense_category_amounts/reconciliation
- 대시보드 집계 함수(loadDashboard 5524~, reconcileRender 7298~) 영향도 확인

주류 처리 미결: 별도 대분류 유지 vs 식자재 아래 소분류 → 사장님 확인 먼저.
```

---

## [2026-04-21] 거래내역 분류 2줄 표시 + 5필드 편집 시트 + 소분류 FK 정합성

### 상태: 구현완료 (배포 대기 — 사장님 앱 테스트 + SQL 2·3단계 실행)
### 브랜치: claude/improve-category-ui-TQloc
### 규모: 대형 (약 180줄 추가/수정 + 데이터 마이그레이션 SQL)

### 배경
- 엑셀 업로드 거래내역에서 분류 컬럼이 대분류만 보이거나 소분류만 보여서 혼란
- 분류 셀 탭으로만 수정 가능했는데 날짜/내용/금액은 수정 불가
- `openCatEdit` 저장 로직(6051행)이 `category=selected, sub_category=selected` 동일 덮어쓰기로 대분류 정보 소실
- 확인필요 시트(6948행)의 `<input placeholder="소분류">` 자유 입력이 DB에 없는 소분류명 주입 → FK 깨짐
- `resolveCatId`가 이름만 매칭 → 소분류 선택 시 `category_id`에 소분류 id 저장 → 대시보드 집계(5474행) 누락
- 사장님 진단 핵심: "소분류 fk 안돼있음 → 계산수식 틀어짐"

### 승인 이력
- 계획서 제출: 2026-04-21
- 사장님 결정: A안(분류 2줄 표시, 세로 최소) + C안(tx_hash 원본 보존)
- 승인 커밋: (본 커밋)

### 변경 요약
1. 분류 셀 2줄 표시 (대분류 9px gray + 소분류 11px, line-height 1.1 → 행 +8px)
2. 통합 편집 시트 신설 (날짜/내용/분류/입금/출금/정산제외)
3. 분류 FK 규칙 확립: `category_id` = 항상 대분류 id, `sub_category` = 소분류명(text)
4. 확인필요 시트 수기 입력 `<input>` 제거 → select만 사용
5. 기존 거래내역 데이터 마이그레이션 SQL (백업테이블 + 2단계 UPDATE)
6. tx_hash C안: 수정 시 원본 지문 유지 (재업로드 중복 차단 정상 작동)

### DB 변경
- 스키마 변경 없음
- 데이터 마이그레이션: `docs/sql/migrate_tx_category_id_to_parent.sql`
  - 1단계: `mydata_transactions_bak_20260421` 백업테이블 (사장님 실행 완료, RLS enabled)
  - 2단계: sub_category 비어있는 건 소분류명 채움 (대기)
  - 3단계: category_id를 부모(대분류) id로 치환 (대기)
- 롤백: `docs/sql/migrate_tx_category_id_to_parent_rollback.sql`

### 주요 구현 요소
- `resolveCatPair(catName)` — 이름 → {mainId, mainName, subName} 분리
- `buildCatChipsHtml(currentCat)` — 분류 칩 UI 재사용 가능 헬퍼
- `openTxEditSheet(txId, type)` — 편집 시트 오픈
- `saveTxEdit()` — 5필드 저장, tx_hash 원본 유지
- `closeTxEdit()` — 시트 닫기
- `applyReviewChoice(item, selected)` — 확인필요 시트 선택값 → category/sub_category 분리
- `saveExcelBatch.resolveCatPayload` — 엑셀 배치 저장 시 규칙 적용

### 검증
- [x] node --check 통과
- [x] 잔재 grep 0건 (tx-cat-edit, openCatEdit, catEditPopup, rvSub)
- [x] 데이터 마이그레이션 SQL + 롤백 SQL 준비

### 사장님 남은 할 일
1. 브랜치 푸시 → main 자동 머지 후 앱 하드 리프레시 (Ctrl+Shift+R)
2. Supabase SQL Editor에서 `docs/sql/migrate_tx_category_id_to_parent.sql` 2·3단계 실행
3. 골든패스 테스트:
   - 엑셀 업로드 후 분류 셀 2줄 표시 확인
   - ✎ 편집 버튼 → 5필드 수정 → 저장 → 반영 확인
   - 확인필요 시트에서 select 한 개로 분류 선택 (수기 입력 input 제거됨)
   - 대시보드 집계 수치 정합성 확인

---

## [2026-04-20] 로그인 시 기기 등록 팝업

### 상태: 배포대기 (브랜치 push → main 자동 머지)
### 브랜치: claude/device-registration-feedback-CIjP4
### 규모: 중형

### 배경
기존: `첫 출근` 버튼 누를 때만 기기 자동 등록 + 2초 토스트 → 사장님/직원이 등록됐는지 모름.
요청: 로그인 시 기기 상태 팝업으로 명확히 알림 + 관리자 초기화 후 재로그인 시 자동 재등록.

### 변경
- 신규 시트 `#deviceStatusSheet` (sheet-overlay, dev_lessons #3 준수)
- 신규 함수: `showDeviceStatusPopup(emp)`, `registerDeviceFromPopup()`, `closeDevicePopup()`
- `completeLogin(emp)` 끝에 `if(!isManager) setTimeout(...showDeviceStatusPopup, 400)` 추가
- `resetDeviceFingerprint` 토스트 문구: "다음 출근" → "다음 로그인" 교체, 편집 시트 상태 라벨 즉시 갱신

### 팝업 3상태
| 상태 | 제목 | 버튼 |
|---|---|---|
| 미등록 | 📱 기기 등록이 필요해요 | [이 기기로 등록] / [나중에] |
| 일치 | ✅ 등록된 기기입니다 | [확인] (3초 자동 닫힘) |
| 불일치 | ⚠️ 다른 기기에서 로그인했어요 | [확인] + 해결방법 안내 |

### 영향 범위
- DB: 변경 없음 (기존 `employees.device_fingerprint` 재사용)
- 기존 `checkDeviceForAttendance()` 자동 등록 로직 유지 (팝업 "나중에" 선택 시 fallback)
- staff 로그인 시만 팝업 (관리자 스킵 — 여러 기기 사용)

### 검증
- node --check 통과
- 기존 출퇴근 플로우 영향 없음 (추가 레이어만)

---

## [2026-04-17] 코드 구조 개선 로드맵 Phase 2b — RLS 1차 활성화

### 상태: 배포완료
### 브랜치: claude/review-docs-sync-main-3aqxI → main (커밋 aa7b3cf)
### SQL 파일: docs/sql/phase2b_rls_enable.sql, phase2b_rls_rollback.sql

### 배경
Phase 2a에서 코드 레이어 `store_id` 필터 26곳 추가 완료(커밋 f5fc304). 이제 DB 레이어 RLS 활성화로 2중 방어망 구축. 1차는 **느슨한 정책**(USING true) + **스키마 정합성 강제**(WITH CHECK store_id IS NOT NULL)로 무중단 활성화. 2차(Phase 2c 이후) Cloudflare Worker 프록시 + auth.uid 기반 엄격화.

### 절차 (제11조 6단계, DB 변경 버전)

**11-1 사전 스캔**:
- db_schema.md + index.html 쿼리 교차 검증 → store_id 컬럼 보유 테이블 22개 확정
- 대상: store_settings, employees, roles, attendance_logs, caps_upload_staging, work_schedules, daily_sales, receipts, settlements, vendors, vendor_orders, expense_categories, expense_category_amounts, fixed_costs, fixed_cost_amounts, special_wages, mydata_accounts, mydata_transactions, reconciliation, reserve_fund_logs, classification_rules, vendor_diffs
- 유보: stores, franchises (부모 테이블, store_id 없음)

**11-2 백업**: Supabase 자동 스냅샷 + 롤백 SQL 사전 준비

**11-3 스크립트화**: 단일 `.sql` 파일 BEGIN/COMMIT 트랜잭션 (enable + rollback 대칭)

**11-4 사후 검증 (3단 게이트)**:
1. 검증 쿼리: `SELECT tablename, rowsecurity FROM pg_tables WHERE ...` — 사장님 실행
2. 앱 동작 확인: 사장님이 `pongdang-shabu.pages.dev` 접속 후 정상 동작 확인 ✅
3. Claude 샌드박스 직접 테스트 시도 → Supabase IP allowlist에 막힘 (→ dev_lessons #31 신설)

**11-5 기록**: 본 항목 + dev_lessons #30 신설 (RLS 1차 활성 교훈) + db_schema.md + services.md 갱신

**11-6 배포 전 체크**: SQL 파일 커밋 + 헌법 1-2 업데이트(브랜치 push → main 자동 머지)

### 정책 설계
```
USING (true)                       -- 모든 SELECT 허용 (anon key 앱 무중단)
WITH CHECK (store_id IS NOT NULL)  -- INSERT/UPDATE 시 store_id 필수 (스키마 정합성)
FOR ALL TO public                  -- anon + authenticated 포함
```

### DB 변경
- 22개 매장별 테이블 RLS ON + `pd_phase2b_all` 정책 생성
- 코드 변경 0줄

### 다음 단계 (Phase 2c — 별도 세션)
- Cloudflare Worker 프록시로 anon key 서버측 보호
- JWT 기반 `auth.uid()` 세션 도입 → RLS 정책 엄격화 (`USING (store_id = auth.store_id())` 등)

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
