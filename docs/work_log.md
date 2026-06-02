# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

---

## [2026-05-26] 쿠팡 자동 동기화 Phase 2 완성 (PR #308~#324)

### 한 줄
쿠팡 주문내역 자동 수집·AI분류·학습 전체 시스템 구축. 크롤링(개인용) + 스샷→AI분석(정식) 2갈래.

### 진행 흐름
1. 크롤링 가능성 검증 — 컨테이너는 쿠팡 차단, 사장님 PC 콘솔/북마클릿이 본 방식
2. 쿠팡 API 구조 분석 (사장님+데스크탑 클로드 Chrome MCP 협업) — 시행착오 4회 후 진짜 구조 확정
3. Edge Function + 북마클릿 + DB 3표 + 앱 UI 구축
4. 노가다 줄이기: 학습 규칙(매장별) + 글로벌 누적 + 기간선택 + 일괄삭제
5. 스샷→AI 분석 (Gemini→GPT fallback, FK 카테고리, 수정 학습)
6. 문서 자동 갱신 에이전트 의무 신설
7. 거래처 상세 뒤로가기·서브탭 유저플로우 정정

### 쿠팡 API 확정 사실 (다음 세션 안 의심)
- 엔드포인트: `GET /ssr/api/myorders/model/page?size=10&pageIndex=0&requestYear=YYYY`
- size 최대 10, pageIndex 0부터, hasNext로 페이지네이션
- 상품 = `orderList[i].deliveryGroupList[j].productList[k]`
- 필드: vendorItemName(풀네임) / combinedUnitPrice(실결제) / quantity / vendorItemId(유니크)
- orderedAt = 밀리초 타임스탬프
- 취소/반품: allCanceled / returnReceipted / cancelReturnStatus='RETURN_COMPLETE' = 스킵
- 교환 상품 = 같은 vendorItemId 여러 deliveryGroup 중복 → Set 제거

### DB 변경 (db_schema.md 동기화 완료)
- coupang_inbox (분류 대기 스테이징)
- coupang_learning_rules (매장별 자동분류, item 컬럼 포함)
- coupang_global_hints (전체 매장 누적, category_name 기반) + vote_global_hint RPC
- coupang_debug (파서 검증용 임시, 안정 후 DROP 가능)

### CTO 자가 반성 (헌법 1-7 위반 4회)
- 쿠팡 응답 구조 추측으로 파서 4번 틀림 (vendorItems→items→deliveryGroupList)
- 교훈: 새 외부 API = HAR/Network 캡처 또는 실제 dump 먼저, 추측 시작 금지
- dev_lessons #130 (UX 뒤로가기) 박음

## [2026-05-25] 종합 세션: D안 통합 표시 + 인건비 통일 + 토스 디자인 통일 + 캐시 무효화

**14개 PR 머지** (사장님 "한 번에 싹다" 패턴 다수 적용)

### 1. 데이터 통합 표시 (D안) — 사장님 호소 "거래처 영수증 2번 합산되는 거 같다"
- PR #256 — 거래처 상세 표에 영수증분 통합 + saveOrder 중복 가드
- PR #258 — 모든 카테고리 화면 통일 (manualCat 분기 제거 → catReceipt에 mydata 추가)
- 진단: 자동 미러 코드 없음 / 표시 갈래 분리가 진짜 원인
- 헌법 1-6 갈아엎기 정당화 (잘못된 전제 = data_source별 화면 분리)

### 2. 인건비 검수 + 통일 — 사장님 호소 "월급제 직원 빠짐"
- PR #261 — fmtHourDecimal 0.5h 반올림 → 소수점 1자리 정확 + 야간수당 totalMin 전체 곱하기 버그 (과지급 위험 제거)
- PR #265 — 3개 화면 인건비 통일 (시급+월급 합산)
  - calcMonthlyProratedWages(ym) 공통 헬퍼 신설
  - 옛 648만 → 신 12,123,732원 (탁성현 일할 565만 포함)
- DB 검수: 평일/주말 시급 100% 정확, weekend_extra=1,000 정상

### 3. 토스 디자인 통일 — 사장님 호소 "통일하기로 했는데 스킵된 게 있다"
- PR #266 — KPI 3분할 → 2분할 (보조 1 : 인건비 2) + 세로 가운데
- PR #267 — 천 단위 자동 축소 (clamp) + 인건비 카드 흰색
- PR #270 — Phase 1: 뒤로가기 헤더 통일 (.app-back) + 지출 카테고리 색상 (하드코딩 9개)
- **PR #271** — 카테고리 색상 하드코딩 제거 (사장님 직접 지적 "혹시 하드코딩이니?") → expense_categories.color DB 컬럼 사용
- PR #273 — Phase 2: 출퇴근 본인 카드 아바타 + 펄스 + 정보 그리드 (mockup ②)
- PR #275 — 옛 회색 뒤로 버튼 2건 잔재 (salesCont + vendorDetailHeader)

### 4. 일자·매출 UI
- PR #259 — today-detail 일자 네비 ([‹] 📅 [›] + 데이트피커)
- PR #260 — 매출 입력 시트 보던 일자 인계 + sales_daily 기존 데이터 자동 로드
- PR #264 — 간트차트 헤더 2단 정리

### 5. 안정성 / 데이터 동기화
- PR #275 — 사용자 전환 시 옛 상태 잔재 일괄 제거 (_resetUserState)
  - 전역 18개 + DOM select 5개 + SWR 캐시 클리어
  - 사장님 호소 "문보영 로그인 후 이송은 재로그인 시 필터 그대로"
- PR #277 — 영수증/거래처 저장 후 홈 즉시 갱신 (캐시 무효화)
  - _refreshAfterExpenseChange() 공통 헬퍼 신설
  - 사장님 결정: 즉시 반영 유지 (시점 문제는 마감 전 항상 부정확, Capacitor 동기화 때 안내 같이 추가)

### 6. 다른 세션 충돌
- PR #272 (CSS 분리 styles.css) / #274 (docs) / #276 (common.js 분리) 동시 진행
- 리베이스 3회 — 새 CSS는 assets/styles.css에 분리 옮김

### 사장님 직접 호소 / 정정
- "혹시 하드코딩이니?" — 카테고리 색상 9개 매핑 → 헌법 10조-2/9 위반 인정 → DB 컬럼 사용으로 정상화
- "쉽게 말하세요" — 헌법 1-9 위반 (보고 너무 기술적·길음)
- "어렵다" — 옵션 너무 많이 제시 (단순화 의무)

### 보류 / 다음 세션
- KPI 개인 모드 인건비 칸 텅 빔 — "현재 나쁘진 않음, 보류"
- 마감 미입력 안내 카드 — Capacitor 자동 동기화 작업 때
- 토스 통일 Phase 3: 시트 헤더, 매장 설정 폼, 사이드메뉴 위계 (보류)
- index.html 분리: Phase 1 CSS + Phase 2 common.js 머지됨, Phase 3 이후 다른 세션

---

## [2026-05-24] vision-driven 구조 박음 + 헌법 다이어트 + agents 정리

### 상태: 완료 (docs만 변경, 코드 X)
### 브랜치: claude/fervent-edison-Cqj8e
### 사장님 첫 호소: "구조를 아예 안 잡고 가고 있다는 느낌. 너는 내가 무슨 어플을 만들고 싶어하는지 알고 있니?"

### 큰 결정 (시간 순)

#### 1. vision.md (Tier 0) 박음 — 사장님 답 5+α 기반
- 한 줄 정의: "식당 사장이 정산 손 까딱 X, 매출-지출-순익 직관, 외식업 자동화 플랫폼"
- 차별점: 캐시노트=매출 SaaS, 우리=순익 SaaS
- 측정: 월 20시간 → 30분 (사장님 본인 경험)
- Phase 1~4 + 양면 시장 5개 도메인 + 커뮤니티
- 7개 약속 (데이터 신뢰 / SLA / 온보딩 / 인사이트 등)
- 모든 agent 자문 5개 의무

#### 2. CLAUDE.md 헌법 큰 수정 (사장님 명시 위임)
- **1-1 자율 모드 박음** ("최선의 방향으로 결정하고 내가 확인만") — 3색 게이트 🟢🟡🔴
- **1-9 정정** — "비유 1개 의무" → "상황 설명 직접 + 영어 한국어 풀이" (사장님 정정: "비유 싫음")
- **1-12 신설** — vision 일치 의무 + 자문 5개
- **2조 0순위** — vision 일치
- **4-0 신설** — 비전 라벨링 (모든 작업 0단계)
- **부칙 필독 순서** — vision.md 0순위 박음

#### 3. 동반 docs 6개 (Tier 3) 박음
- `persona.md` — 메인+서브 5+안티 페르소나
- `pricing.md` — 4단계 (무료/9,900/29,900/99,000)
- `marketing.md` — 1,000명 깔때기·채널
- `roadmap.md` — Phase 1~4 일정·KPI·실행 주체
- `team.md` — Phase별 채용 + RACI
- `blueprint.md` — 화면 14개 설계도 + 위험 FK 5개

#### 4. blueprint_diagram.svg (사장님 명시 "그림으로 쉽게")
- v1 → 사장님 정정 ("거래처가 식자재만? 영수증이 인건비? 잉 좀 이상") → v2
- 빨간선 = 자유 분류 / 주황선 = 고정 / 파란선 = 자동

#### 5. business_rules.md #12 신설 (사장님 도메인)
- **카드 매출 = POS 원액 / 계좌 입금액 ≠ 매출 (수수료 차감됨)**

#### 6. agents 다이어트 + designer 정정
- agents/*.md 10개 헌법 카피 (1-7-A + 1-11) 통째 제거 → 새 1줄 헌장 (-180줄)
- 새 1줄 = 헌법 1-7, 1-7-A, 1-8, 1-9, 1-10, 1-11, 1-12 통합 자문
- `designer.md` trigger: `when_ui_involved` → `always` (사장님 호소 "디자이너 일 제대로 안 함" 정정)

### 다음 세션 인계
- **다른 세션 수식 작업 진행 중** (이 세션 침범 X)
- Capacitor·SMS = Phase 1 끝 후 (1~2주 작업)
- 사장님 검토 3개 답 대기: 나이대 / 9,900 / 김은성
- agents critic·designer 비대 다이어트 별도 작업
- plan.md ↔ roadmap.md 중복 정리

### CTO 페널티 4건 (dev_lessons #98 박음)
1. Codef API 추측 박음 (실제 = 문자 자동)
2. Capacitor Phase 1 시작 가정 (사장님 옛 결정 무시)
3. 헌법 1-9 "비유 의무" 박음 (사장님 실제 = 상황 설명 직접)
4. blueprint 그림 v1 좌표 오류
+ 5. 카드 매출 = 계좌 입금 추측 (사장님 정정 → business_rules #12)

### 사장님 마지막 명령
> "가" (4개 한 번에: 헌법 1-9 / designer / agents 다이어트 / 영어 풀이)



---

