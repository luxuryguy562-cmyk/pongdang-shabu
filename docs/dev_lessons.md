# 개발 교훈 (Dev Lessons)

> 같은 실수 반복 방지. **새 세션 시작 시 필독.**

---

## 84. 사장님 명시 컬럼 받자마자 빌드 금지 — 핵심 필드 누락 짚어야 (2026-05-15)
**사건**: 사장님 "한 행에 날짜/단가/수량/금액/메모/편집/삭제 7컬럼"이라 명시 → 그대로 7컬럼 구현 → 사장님 분노: "**상품명**(품목)이 들어가야될거 아니야 이씨발 뭔지도 모르고 얼마인거 알아서 뭐해". 옛 두 줄 패턴엔 품목 있었는데 한 행으로 가면서 통째 빠진 회귀.

**같은 패턴**: PR #135에서도 사장님 "지출카테고리 순서 따라옴" 명시 → 그대로 적용 → top3 합의 깨짐. 사장님이 "에이전트플로우 가동 안된거같은데"라 짚음.

**원인**: 헌법 3-1 critic 의무 누락. 사장님 명시만 받고 입력 폼 필드와 대조 안 함. CTO는 사장님이 빠뜨린 핵심 필드 짚어야.

**원칙**:
- 표 컬럼 정의 받으면 → **입력 폼 필드와 1:1 대조 필수** (orderInput 시트에 item/unit_price/quantity/amount/memo 있으면 표에도 다 등장해야)
- 사장님 명시가 입력 필드보다 적으면 "X 빠졌는데, 의도하신 건가요?" 짚기
- 한 줄 패턴 → 다른 한 줄 패턴 갈아엎을 때 옛 패턴의 모든 정보 보존 검증
- "사장님 의견 무조건 동조 금지"(헌법 3-1)는 **추가/누락에도 적용**

**체크리스트 (표 컬럼 정의 받았을 때)**:
- [ ] 입력 시트의 모든 필드가 표에 등장하나? (item/memo/price 등 누락 X)
- [ ] 옛 패턴(카드/리스트)에 있던 정보가 새 표에도 다 있나?
- [ ] 사장님 명시 컬럼 수 < 입력 필드 수면 → 짚어 묻기
- [ ] 모바일 폭 가능 검증 (360px - 패딩에 들어가나)

**관련**: 헌법 3-1, 4-2 (에이전트 플로우), dev_lessons #83(직전 항목 #135 case)

## 83. 자식 카테고리 드릴다운은 parent_id 동적 — 하드코딩 X (2026-05-15)
- 사장님 짚으심: "▶ 이거 식자재만이 아니고 소분류가 있는것들 다 넣는거지 또 하드코딩하는거 아니지"
- 잘못된 안: `if(catName==='식자재')` 분기 → 사장님이 비품/주류 등에 소분류 추가하면 ▶ 안 등장
- 올바른 안: `expCategories.filter(c=>c.parent_id===부모.id).length>0` 동적 판단 → 자식 1개라도 있으면 자동 ▶
- 헌법 10조 2번(코드 수정 없이 데이터 변경 반영) + dev_lessons #23(CAT_NAME_MAP 하드코딩 제거) 일관 패턴
- 사장님 인지: 카테고리 추가가 사장님 자율 영역 → 코드가 따라와야 함

## 82. 1순위 카드 통합 — "어제" 컨텍스트 흩어지면 "총 누적" 오해 (2026-05-15)
- 상황: coder가 매출 관리 탭 매출 추가 폼이 paymentMethods 동적 생성된다고 추측 답변
- 실제: 스크린샷 보니 paymentMethods 빈 배열 → 입력 행 0개 (빈 폼)
- 사장님이 "코드를 봐도 화면이 이렇게 나오는 걸 못 본 거야? 추측한 거야?" 짚어줌
- 교훈: 사용자가 보는 화면 = 코드와 다를 수 있음 (런타임 상태 의존). **사용자 우려는 추측으로 안심시키지 말고 스크린샷·실제 확인 요청**
- 우회: 매출 빠른 입력 시트는 LEGACY 5개 직매핑으로 paymentMethods 의존 X (안전망)
- 후속: paymentMethods 폴백 버그 본격 진단 별도 PR

## 81. 결제수단 비율 시각화 = 매장 의사결정 가치 낮음 (2026-05-15)
- 현금/카드/현금영수증 비율은 사장님 일상 의사결정에 거의 안 씀
- 카드 매출 절대값만 카드수수료 계산에 필요 (보이지 않는 곳)
- 매출원별 분해(홀/배민/쿠팡)가 진짜 가치 — 다만 정확한 수수료/입금주기 모르면 신뢰도 손상
- 교훈: **정확성 없는 데이터 표시 = 신뢰도 손상 > 미보유 표시**. 사장님 직관 정확
- 적용: 월 요약 카드 결제수단 세그먼트 바 통째 제거 (PR #123)

## 82. 1순위 카드 통합 — "어제" 컨텍스트 흩어지면 "총 누적" 오해 (2026-05-15)
- 초기 디자인: 1순위 매출 카드 + 2순위 순수익/지출 카드 = 위계형
- 사장님 피드백: "카드 따로 있어서 그런가 어제 같지가 않고 총 같은 느낌"
- 정정: 매출 + 순수익 + 지출 한 카드 안에 통합 → "어제 05.14(목)" 라벨이 모든 정보에 적용
- 교훈: **시간 컨텍스트(오늘/어제/이번주) 동일한 정보는 한 카드 안에 묶어야** 사용자 인식 일치

## 79. 표 셀 정렬 — 숫자는 무조건 우측, 날짜·텍스트는 중앙 (2026-05-14)

**사건**: 차액 표 만들면서 사장님이 "중앙정렬해라" 요청 → 전체 셀 `text-align:center` → 사장님 짚음: "화폐는 우측정렬 안 햇엇나?"

**교훈**:
- 표에서 **숫자(화폐) 컬럼은 우측 정렬이 정석**. 자릿수 일관 + 가독성 ↑
- 날짜·텍스트 컬럼만 중앙 정렬
- 헤더도 본문과 동일 정렬 (헤더 중앙·본문 우측은 어긋남)
- `font-variant-numeric:tabular-nums` 필수 (등폭 숫자)
- 사장님 "중앙정렬" 요청해도 무비판적 따르지 말고 CTO 정석 짚어줘야 (헌법 3-1)

---

## 78. 시스템 today vs picker.value — 사용자 입력값 우선 (2026-05-14)

**사건**: 사장님이 마감정산 몰아서 입력 시 "전일이월금이 최근 마감금고계수금액 따라가는 느낌". `loadOpeningAmount()`가 시스템 today−1 고정으로 전일 마감 조회 → settle_date 변경 시 무시.

**교훈**:
- date picker 있는 화면은 **항상 picker.value 우선**, 시스템 today는 fallback
- 함수 호출 순서: picker 설정(initSettleDate) → 데이터 로드(loadOpeningAmount)
- 같은 패턴: 영업개시·근태·근무계획 등 date picker 있는 모든 화면 점검 필요

---

## 77. UI 상태 reset 시 관련 전역 변수·status 텍스트 같이 reset (2026-05-14)

**사건**: 영업개시 수정 진입 후 nav-bar로 다른 탭 갔다 영업개시 재진입 → picker는 today reset되지만 status 텍스트는 "5/13 영업개시 수정 중" 그대로. picker(5/14) vs status(5/13) 불일치.

**교훈**:
- `initXxxDate()` 같은 reset 함수는 **DOM·전역 변수·status 텍스트를 한꺼번에 reset**
- 수정 모드 전역 변수(`openingEditDate`, `editFcId` 등)도 같이 null
- 패턴: `initXxxDate()`는 "모든 상태를 초기 상태로" 원칙

---

## 76. 시스템 무결성 — 의도적 회피는 못 막음, review 안전망 (2026-05-14)

**사건**: 사장님 통찰 — 마감 차액 0 만들려고 가짜 지출(메모 없는 "기타") 입력하면 시스템이 무결성 위반을 못 잡음.

**교훈**:
- 의도적 회피는 완벽 차단 불가. 어떤 시스템도 한계.
- 대신 **review 단계 의심 패턴 자동 표시**:
  - 메모 없는 지출 → 빨강 ⚠️
  - 평소 평균 대비 큰 지출 → 알림 (옵션)
- "차액 0 = 무조건 정상" 가정 금지. 항상 상세 review 자리 제공.

---

## 75. 라벨 정확화 — UI 텍스트가 실제 기능과 맞아야 (2026-05-14)

**사건**: 사장님이 hub 카드 라벨 짚음 — "계좌·카드"는 모호, "정산 대조 sub: 매출 vs 카드 출금"은 잘못된 설명 (실제는 통합), "카테고리 관리"는 좁음, "지출"은 통장 입금 포함이라 헷갈림.

**교훈**:
- 라벨은 **실제 기능 100% 반영**. 일부만 설명하면 사장님 헷갈림 누적
- 예: "계좌·카드" → "계좌내역·카드내역" / "카테고리 관리" → "수입·지출 카테고리 관리" / "지출" → "통장 입금" / "현금 지출" 분리
- 새 화면·라벨 만들 때 사장님 인지·실제 기능 두 가지 다 검증

---

## 74. 동적 시스템 vs 고정 hub — 사장님 운영 모델 정확히 파악 (2026-05-14)

**사건**: "지출 hub로 다 펴바르기" 사장님 의향 → CTO 동적 카테고리 제안 → 사장님 짚음: "그럼 뭐 추가할때마다 변동되야되는 불편함 있잖아".

**교훈**:
- 사장님 비전("운영 자동화")과 실제 의도("안정적 고정 hub") 다를 수 있음
- 외식업 카테고리는 실제로 거의 안 바뀜 — 동적 시스템 비용 > 이득
- 사장님이 "쉽게 가자" 했으면 하드코딩이 정답
- 헌법 3-1: 사장님 의향만 보고 진행하지 말고 CTO critic으로 비용·이득 검토 후 솔직 추천

---

## 73. 입력 시트는 진입 컨텍스트(상세/첫화면)를 인지해야 함 (2026-05-13)

**사건**: 거래처 카드 클릭 → 상세 페이지 진입 → "+ 주문 수동 입력" 누르면 시트의 거래처 셀렉트에 모든 거래처 노출 → 사장님이 A 거래처 보고 있는데 B 거래처로 입력 가능. "왜 그럴 이유도 없잖아 괜히 실수만 나잖아."

**원인**: `openAddOrderSheet()`이 진입 컨텍스트 구분 없이 항상 셀렉트 노출. 옛 디자인(공용 입력 시트)의 잔재.

**교훈**:
- 입력 시트가 여러 진입점에서 호출되면 호출 컨텍스트를 전역 변수(예: `currentVendorDetailId`)나 인자로 받아서 분기해야 함
- 상세 페이지에서 입력 = 그 엔티티 고정 (셀렉트 숨김 + 시트 제목에 명시)
- 첫화면(전체)에서 입력 = 엔티티 선택 가능
- 패턴: 헤더에 엔티티 정보가 고정돼 있으면 본문에서 같은 엔티티 선택 UI를 또 노출하지 말 것 (UX 짬뽕)

---

## 72. 클라이언트 캐시는 항상 fresh 보장이 필요한 위치를 식별해야 함 (2026-05-13)

**사건**: 사장님이 거래처를 "네이버/직구"에서 "롯데칠성/주류"로 이름·카테고리 변경했는데 클라이언트 메모리 `vendors` 배열이 옛 값 그대로. 결과: 거래처 카드 클릭 시 헤더 = "네이버/직구" (캐시) / 본문 카드 = "롯데칠성" (DB join 결과). 사장님이 "짬뽕된 느낌" 호소.

**진단법**:
```sql
SELECT vo.id, vo.amount, vo.vendor_id, v.name, v.category
FROM vendor_orders vo LEFT JOIN vendors v ON v.id=vo.vendor_id
WHERE vo.amount = ? ORDER BY vo.created_at DESC LIMIT 5;
```

**교훈**:
- 진입점마다 캐시 fresh 강제 호출 (`await loadVendors()` 등)이 안전
- 사장님이 "이상하다", "짬뽕된 느낌" 같은 모호한 호소를 할 때 → 데이터 출처가 두 군데(캐시 vs DB)로 갈리는 케이스 의심

---

## 71. 자정 넘는 시간 입력 = `datetime-local` 또는 자동 +24h 보정 (2026-05-13)

**사건**: 마감조 출퇴근 수동 입력 시 "퇴근이 출근보다 빠르다" 차단. 사장님: "근데 그냥 날짜선택란이 있으면 되는거 아니야?"

**원인**: `<input type="time">`은 00:00~23:59만. 자정 넘는 표현 불가능.

**해결 패턴**:
1. **편집 시트 (이미 row 존재)** = `<input type="datetime-local">` (출근/퇴근 둘 다 날짜+시간 동시 선택)
2. **사후 등록 시트 (날짜 + 시간 별도)** = `if(appOut<=appIn) appOut += 24h` 자동 보정. 토스트에 "익일 HH:MM 퇴근으로 처리" 명시. 24h 초과 차단.

**교훈**:
- 시간 input UI 설계 시 자정 넘는 케이스 반드시 검토
- 자동 보정 시 사용자에게 즉시 토스트 알림 — 무음 처리 금지

---

## 70. 자동 PR 머지 정책 — 사장님 명시 요청 (2026-05-13)

**사건**: 사장님이 "머지 왜 자꾸 내가 하게 하냐 니가 하게 해" 호소. 매 푸시마다 사장님이 GitHub 들어가서 머지 버튼 누름 = 피로 누적.

**새 정책 (사장님 명시 요청)**:
- 푸시 → PR 생성 → 자동 머지까지 Claude가 처리
- 사장님은 1~2분 후 production에서 강력 새로고침 확인만
- DB 변경·대형 회귀 위험 케이스는 미리 알림 후 진행

**교훈**:
- 사장님 반복 호소 = 시스템 정책 갱신 신호 (헌법 1-2 "자동 main 머지"와 정렬)
- 자동 머지 도입 시 위험 케이스(DB, 대규모 변경) 분기는 유지

---

## 69. 통일감 vs 1탭 효율 — 패턴 통일이 이김 (2026-05-13)

**사건**: 5/12 PR #52에서 근무 계획 캘린더 셀 탭 = 등록 시트 직행으로 단순화(1탭 효율). 하루 뒤 사장님이 "근무 기록과 패턴이 다르다, 통일감 살려달라" 호소. 다시 "셀 탭은 일별 상세 표시, 등록은 [＋] 버튼" 패턴으로 갈아엎음(2탭).

**교훈**:
- 짧은 효율(1탭 절약)은 두 화면 패턴이 어긋날 때 손해보다 작다
- 사장님이 "통일감 없다"고 직접 호소하는 시점이 헌법 1-6 갈아엎기 조건의 신호
- 결정 빠르게 뒤집어도 OK — 단 docs와 코드 주석에 "왜 뒤집었는지" 명시 (다음 세션이 또 뒤집지 않게)

**라벨 결정**: "＋ 직원"은 사이드→직원관리 "직원 추가" 시트와 명사 충돌. 행동 중심 라벨 "＋ 일정등록"이 사용자 멘탈 모델에 더 맞음. 두 화면(근태/근무계획) 동일 라벨로 통일.

---

## 68. 시트 안에서 다른 시트 띄울 때 closeAllSheets 호출하면 부모 시트도 닫힘 (2026-05-12)

**사건**: 출퇴근 사후 등록 시트(`attManualSheet`)에서 직원/날짜/시간 피커를 띄우고 선택했더니 사후 등록 시트까지 같이 닫혀 입력이 통째로 사라지는 회귀.

**원인**: 기존 `selectEmpFromSheet` / `confirmDate` / `confirmTime` 모두 마지막에 무조건 `closeAllSheets()`. 이전엔 부모가 인라인 폼이라 닫혀도 화면에 그대로 보였지만, 부모를 시트로 옮긴 순간 부모까지 사라짐.

**해법**: ctx 분기로 자식 시트만 닫음.
```js
// selectEmpFromSheet: ctx==='att' → closeSheet('empSheet')만
// confirmDate: ctx==='att' → closeSheet('dateSheet')만
// confirmTime: ctx==='start'|'end' → closeSheet('timeSheet')만
```

**일반 원칙**: 모달(시트)을 중첩하는 흐름이라면 자식 닫기는 `closeSheet(id)`로 정확히 명시한다. `closeAllSheets()`는 "전부 종료" 의미. 자식 모달 흐름에서 쓰면 회귀.

---

## 67. `.manager-only` 클래스가 인라인 `display:none !important`를 덮어쓴다 (2026-05-12)

**사건**: 캡스 업로드 서브탭에 `class="sub-tab manager-only"` + `style="display:none !important;"` 인데 사장님(관리자) 화면에 그대로 보임.

**원인**: `applyPermissionUI()` 안에서
```js
document.querySelectorAll('.manager-only').forEach(el => {
  el.style.display = isManager ? '' : 'none';
});
```
관리자면 인라인 display를 빈 문자열로 설정 → 인라인 속성 자체가 제거됨 → 외부 CSS의 `.sub-tab { display: ... }` 가 살아남. `!important`도 인라인이 제거됐으니 무력.

**해법**: 정말 안 보이게 하려면 `.manager-only` 클래스를 빼고 `style="display:none !important;"` 단독으로 두거나, 별도 클래스 사용. JS의 일괄 제어 대상에서 제외해야 인라인이 보존됨.

**일반 원칙**: JS가 `style.display` 를 일괄 제어하는 클래스에는 `!important`도 안 통한다. 권한 클래스를 뗀 단독 inline 스타일이 가장 안정.

---

## 66. "갈아엎기"는 시각 구조까지 가야 와닿는다 — 텍스트 수정으로 그치면 "와닿다 마는 느낌" 호소 (2026-05-12)

**사건**: 사장님이 출퇴근 화면 1차 안을 보고 *"전체적으로 나쁘진 않은데 큰 변화가 없어서 와닿다가 마는 느낌이야"* 호소. → 상태 변환 카드 + 사후 등록 시트 이전이라는 패러다임 변경으로 재제안하니 OK.

**원인**: 두 시나리오("지금 출퇴근" + "관리자 사후 등록")가 한 카드에 무차별 섞여 흐름이 안 와닿음. 텍스트 수정만으로는 잡티가 그대로 → 임팩트 0.

**해법 (이번 세션)**:
- **출퇴근 = "지금 찍기" 전용** 큰 카드 (3색 상태 변환, 단일 버튼, 메타 영역)
- **사후 등록은 📋 근무 기록 캘린더 빈 셀 + "+"**로 이전 (자연스러운 진입점)
- 잡티 0% → 사장님 "와닿는다" 확인

**일반 원칙**: 사장님이 "와닿다 마는 느낌"·"감이 안 잡힘" 호소하면 = 시각 패러다임 변경이 필요한 신호. 명칭 수정·헤더 분리 같은 텍스트 레벨로 답하지 말고, 화면 구조 자체를 다른 메타포로 갈아엎는 안을 함께 제시할 것. dev_lessons #60(디자인 변화 = 무의식 효과)과 짝.

---

## 65. `location.reload()` 후처리는 자동 로그인 흐름 발동 → 화면 점프 (2026-05-12)

**사건**: `finishSettlement2` 마지막에 `location.reload()` 로 페이지 새로고침해서 마감 결과 갱신. 사장님 보고 "마감 저장 누르면 로그인 화면 잠깐 떴다가 대시보드로 점프".

**원인 추적**:
- `location.reload()` → 페이지 재로드 → 초기 자동 로그인 흐름 (localStorage `pd_emp` 확인) 발동
- 그 짧은 사이 로그인 오버레이 깜빡 노출
- `completeLogin` → `navHome(isManager?'dashboard':'attendance')` → 사장님은 관리자라 대시보드로

**교훈**:
- 저장 후 새로고침 대신 명시적 상태 갱신 (탭 전환/리렌더) 으로 해결.
- `location.reload()` 는 PWA + 자동로그인 환경에서 시각 점프 야기. 최후수단.

**적용**: `location.reload()` 제거 → `settleTab('list')` 자동 전환으로 방금 저장한 마감을 즉시 확인.

---

## 64. DB Generated Column 은 단순식만 가능 — 보정 계산은 JS 에서 (2026-05-12)

**사건**: `daily_opening.diff_amount` 를 `GENERATED ALWAYS AS (actual_total - previous_close_total) STORED` 로 정의. 후속 작업에서 차감(deductions) 도입했지만 generated column 식은 차감 미반영. 차액 통합 표에서 "차감 입력해도 영업개시 차액 그대로 빨강".

**원인**: Generated column 식은 같은 행의 다른 컬럼만 참조 가능. `deductions` JSONB 합산을 식에 못 박음.

**교훈**:
- Generated column 은 단순 산술 만. 복잡한 보정/JSONB 합산이 필요하면 JS 에서 계산.
- DB 값은 "기본 차이" 의미로 두되, UI 표시 단계에서 JS 가 다시 보정.

**적용**: `loadSettleList` 에서 `calcOpDiff = actual − (previous − Σdeductions.amount)` 로 JS 보정.

---

## 63. 매출 수식은 입력 칸 기준으로 단순화 — 분해/검증값을 매출에 합산하지 말 것 (2026-05-12)

**사건**: `syncClosingToSalesDaily` 옛 코드가 `sales_daily.cash = cash_detail_cash, qr = cash_detail_qr, etc = pos_etc + cash_detail_transfer` 매핑. 직원이 매출 4칸(pos_*) 안 채우고 현금상세만 채우면 sales_daily 합계로 가짜 매출(예: 277,920원) 잡힘. 사장님이 "왜 매출이 이상한가" 추적 어려움.

**원인**: 사장님 의도 = "매출 4칸 합 = 매출". 현금상세는 검증용이지 매출 합산 대상 X. 옛 매핑이 "분해 합 = 매출"로 일치시키려다 직원 입력 누락 시 가짜 매출.

**교훈**:
- 매출 합계 = 사장님이 명시한 입력 칸 기준 단순 합. 분해/검증값을 매출에 섞지 말 것.
- 매출 4칸이 0인데 현금상세는 있다 = "직원 입력 누락" 시그널. 매출은 0으로 두고 UI 가 ⚠️ 안내.

**적용**:
1. `legacyVals.cash = pos_cash` (현금상세 분해 안 함)
2. `loadSettleCard` 에 매출 현금+현금영수증 vs 현금분해 합 비교 ⚠️ 박스

---

## 62. iOS Safari sticky 작동 조건 까다로움 — 신뢰 못하면 fixed 로 (2026-05-12)

**사건**: 마감정산 차액 박스를 `position: sticky` 로 헤더 아래 고정 시도. `.container { overflow-x: hidden }` 가 sticky 차단 → `clip` 폴백 + `#settleCont.container { overflow: visible }` 까지 해도 사장님 폰에서 "스크롤하면 안 따라옴".

**원인 후보**:
- iOS Safari `overflow-x: clip` 지원 16.4+ (사장님 폰 버전 불확실)
- 부모 elements 의 다른 속성(transform/filter/contain) 이 sticky 컨테이너 break
- body padding-top 으로 sticky top 계산 어긋남

**교훈**:
- iOS Safari sticky 는 환경 따라 깨질 수 있음. 사용자 핵심 기능에는 신뢰하기 어려움.
- 행고정이 정말 중요하면 `position: fixed + left:0 right:0` + 자리 확보 padding 으로 확실히.
- 또는 sticky 대상을 다른 카드 안에 흡수시켜 행고정 자체를 회피 (이번 케이스 = 차액 박스를 금고 계수 카드 안 좌측으로 이동 → 행고정 불필요).

---

## 61. 화면 같은 정보가 두 군데에 보이면 사장님이 "중복 거슬림" 호소 (2026-05-12)

**사건**: 차액 박스(매출/금고/차액) 행고정 + 영업개시 카드의 전일 이월금이 같은 숫자(1,526,900원) 표시. 사장님 "중복 느낌, 차라리 영업개시에 붙이는 게 낫겠다".

**원인**: 의미상 다른 값(영업개시 이월금 = 고정값 / 장부 합계 = 동적 계산)이지만 입력 시작 전엔 같은 숫자 → 사용자 인식상 중복.

**교훈**:
- 동일 숫자가 두 곳 표시되면 의미 차이 설명하기보다 한 곳으로 합치는 게 빠름.
- 사장님 인사이트로 화면 재구성 = 헌법 1-6 정당한 갈아엎기 적용.

**적용**: 차액 박스를 화면 위 행고정 → 금고 계수 카드 안 좌측 계산기로 통합. 영업개시는 자기 자리에 한 번만 표시.

---

## 60. 디자인 변화는 무의식 효과 — 체감 임팩트는 패러다임 변경 (2026-05-06)

**사건**: 전수 점검 1~5단계(폰트·아이콘·에러메시지·어미·자동로그인) 후 사장님 "큰 차이 못 느끼겠다". 6~9단계(햄버거→하단탭, 큰 숫자, 빈 상태, 시트 SVG) 한꺼번에 추가했더니 "조금은 보이지만 크게 달라진 느낌은 없다".

**원인**:
- 폰트(Pretendard) / 색상 / 글자 굵기 / 작은 아이콘 = **무의식 효과**. "왠지 깔끔" 정도로만 느낌
- 사용자가 의식적으로 "달라졌다"고 느끼는 건 **레이아웃 패러다임 변경**:
  - 햄버거 메뉴 위치 이동 (좌상단 → 하단)
  - 빨간색 → 노란색 (감정 색깔 변화)
  - 도넛 → 세그먼트 바 (그래프 형태 변화)
  - 매장 선택 큰 파란 버튼 (행동 유도 명확)

**원칙**:
1. **임팩트 작은 변화는 묶어서 한 번에** — 폰트·아이콘·색깔 미세 조정은 1세션에 묶어서 푸시
2. **사용자 검증은 패러다임 변경 후에** — 폰트만 바꾸고 "어때요?"는 무의미. 큰 변경 같이 묶어서 보여줘야
3. **솔직 보고**: "이건 무의식 효과라 즉시 체감 어려울 수 있다" 미리 안내. 사장님 기대치 조정.
4. **체감 큰 변화 우선순위**: 레이아웃 > 색깔 패러다임 > 글자 크기 > 폰트 > 아이콘
5. **외부 프레임워크의 한계 인정**: 토스 같은 고퀄 = 디자인 + 폰트 + 애니메이션 + haptic + 네이티브. PWA로는 70~80%까지가 한계 (Capacitor·React Native 도입 시 90%+)

**체크리스트 (디자인 변경 작업 전)**:
- [ ] 이 변경이 사용자 의식적 인지 가능한가? (안 그럼 무의식 효과)
- [ ] 묶어서 1세션에 패러다임 변경과 같이 갈 수 있나?
- [ ] 사장님께 "체감 미리보기" 텍스트로 어떻게 보일지 설명했나?

**관련**: 이번 세션의 (가) PWA 디테일 vs (나) Capacitor 패키징 트레이드오프 — 디테일 끌어올리기에는 PWA 한계 있음을 사장님이 직관으로 짚음.

---

## 59. Service Worker 도입은 단계적으로, iOS 호환 검증 필수 (2026-05-06)

**사건**: PWA 강화 일환으로 sw.js 신설 + DOMContentLoaded 진입 전 register. PC 크롬에서는 정상이었으나 iOS Chrome에서 사장님이 "직원 선택 안 보임" 보고. 진단해보니 매장 미선택 상태였고 SW가 직접 원인 아니었지만, 첫 반응으로 SW 비활성화 + 기존 등록 unregister 코드 박음.

**원인**:
- iOS Chrome = WebKit 엔진. PC Chrome (Blink)과 SW 동작 미세 차이
- 첫 등록 시점 캐시 꼬임 가능성
- SW 한 번 등록되면 이후 unregister 안 하는 한 캐시 잔존 → 디버깅 어려움
- 진짜 원인은 매장 선택 안 됐던 UX 문제였지만 SW가 "범인 후보 1순위"로 의심됨

**원칙**:
1. **SW 도입 전 staging 환경에서 검증**: 운영 SW가 잘못 등록되면 모든 사용자에게 영향 (캐시 잔존)
2. **SW 등록 코드와 같이 unregister 코드도 준비**: 이번처럼 문제 발생 시 강제 정리 가능
3. **iOS 호환성 검증 필수**: 사장님이 iOS 사용자라 PC 검증만으로 안전 X
4. **외부 도메인(Supabase·CDN) 제외 명시**: `if (url.origin !== self.location.origin) return;`
5. **CACHE_VERSION 명시**: 캐시 버전 변경하면 옛 캐시 자동 정리됨

**체크리스트 (SW 도입 시)**:
- [ ] iOS Chrome·Safari에서 직접 테스트 (사장님 폰 환경)
- [ ] unregister 핸들러 같이 만들기 (문제 시 즉시 OFF 가능)
- [ ] CACHE_VERSION에 날짜 박기 (배포 시점 추적)
- [ ] DevTools Application → Service Workers 탭에서 활성 SW 확인
- [ ] 외부 API (Supabase) 가로채기 막기

**현재 상태 (2026-05-06)**:
- sw.js 파일 보존
- index.html에서는 unregister + caches 삭제 코드만 활성화
- 안정화 후 (Capacitor 전환 시점) 재도입 검토

---

## 58. 금액 입력란은 무조건 세자리 콤마 자동 (2026-05-06)

**사건**: 고정비 편집 시트의 예상 월 금액 입력란을 `type="number"`로 만들어 `3190000` 그대로 표시. 사장님 "금액은 세자리쉼표가 필수인데 왜 자꾸 이런식으로 하는지 모르겠어".

**원인**:
- `type="number"`는 콤마 입력 거부 → 미적용
- dev_lessons #22가 "**리스트 표시**는 tabular-nums + table" 명시 — 입력란 콤마 자동은 별도 규칙으로 못박혀있지 않았음
- 마감정산 입력란들은 이미 `type="text" inputmode="numeric" data-input="onSInput|this"` 패턴으로 콤마 자동 (line 1050~) — 알고 있었지만 새 입력란에 재적용 누락

**규칙 (이후 모든 금액 입력란에 적용)**:
1. **`type="number"` 금지** — 콤마 표시 못 함
2. **표준 패턴**:
   ```html
   <input type="text" inputmode="numeric" data-input="formatNumberInput|this" placeholder="예: 2,000,000">
   ```
3. **공용 함수** `formatNumberInput(el)` (index.html line 2800 부근):
   ```js
   function formatNumberInput(el){
     const raw=(el.value||'').replace(/[^\d]/g,'');
     el.value=raw?parseInt(raw).toLocaleString():'';
   }
   ```
4. **값 set 시 콤마 적용**: `el.value = fmt(num)` (예: openEditFcSheet)
5. **저장 시 콤마 제거**: `unFmt(el.value)` (예: saveFc)
6. **금액 외 숫자(예정일·일수·등)는 `type="number"` OK** — 콤마 불필요한 작은 숫자

**체크리스트 (입력란 만들 때)**:
- [ ] 이 입력란이 **금액**(원·만원·천원 등)인가
- [ ] 그렇다면 `type="text" + inputmode="numeric" + data-input="formatNumberInput|this"`
- [ ] 초기값 set 시 `fmt()` 거쳤나
- [ ] 저장 로직에서 `unFmt()` 거쳤나
- [ ] placeholder에 콤마 포함 (예: "2,000,000")

**관련**: dev_lessons #22(금액 리스트는 tabular-nums + table), #57(사장님께 코드 용어 금지). 사장님 분노 트리거: "왜 자꾸 이런식으로 하는지" — 같은 류 실수 반복 신호.

---

## 57. 사장님께는 코드 용어 금지, 화면 단어 + 비유로 설명 (2026-05-06)

**사건**: 고정비 집계 진단 보고 시 `fixed_cost_amounts.year_month`, `default_amount INT`, `loadFixedCosts`, "fallback 우선순위 1번" 같은 DB 테이블명·컬럼명·함수명·영어 IT 용어를 그대로 사장님께 노출 → 사장님 "전문가 아니라 가독성 떨어진다"고 지적.

**원인**:
- 헌법 제3조 "초등학생도 이해하게 쉬운 비유로" 규정이 있는데도 critic/planner 출력 그대로 카피 → 사장님이 보는 화면 단어로 치환 안 함
- DB 컬럼명·SQL·함수명을 "정확함"이라 착각, 사장님 입장에선 외계어

**규칙 (이후 모든 보고에 적용)**:
1. **DB 테이블/컬럼명 노출 금지** — 사장님 앱에서 보는 단어로 치환
   - `fixed_cost_amounts.year_month` → "고정비 월별 금액 입력 시트"
   - `default_amount INT 컬럼` → "고정비 항목 옆에 '평소 금액' 칸"
2. **함수명 노출 금지** — 화면 위치/버튼명으로 치환
   - `loadFixedCosts` → "사이드메뉴 → 고정비 화면"
3. **영어 IT 용어 → 한국어 비유**
   - fallback → "비어있으면 대신 쓸 값"
   - override → "그 달만 다른 값으로 덮어쓰기"
   - 우선순위 1번/2번 → "먼저 보는 값/없으면 쓰는 값"
4. **SQL/코드 블록은 사장님 응답에 절대 안 보임** — 계획서 "DB 변경" 항목은 코드는 적되, 사장님 본문 설명에는 한 줄 풀어 쓰기 ("고정비 항목에 평소 금액 칸 1개 추가")
5. **비유 우선** — 기술 설명 전에 일상 비유 1줄 ("매달 월세 200만원 똑같은데 매번 새로 적게 만들어놨던 셈")

**체크리스트 (모든 답변 발송 전)**:
- [ ] DB 테이블·컬럼명 영어로 그대로 쓴 곳 없나
- [ ] 함수명 백틱(`)으로 감싼 곳 없나
- [ ] 영어 IT 용어(fallback/override/upsert 등) 한국어로 풀었나
- [ ] 첫 줄에 비유 또는 결론을 사장님 단어로 넣었나
- [ ] 정밀한 기술 보고가 필요하면 "기술 상세" 접기 섹션으로 분리

**관련**: 헌법 제3조(페르소나 — 초등학생도 이해), dev_lessons #6(사장님 힌트는 금이다 — 사장님 단어 그대로 듣는 것의 반대 방향)

---

## 56. 앱 개발자는 매장 직원 테이블에 없어야 한다 (2026-05-05)

**사건**: 가입 시 owner 직원 row 자동 생성 로직(`Phase 1-A1`)이 "앱 운영자(=김은성=사용자) 본인을 첫 매장의 owner 직원으로 등록"하는 구조였음. 사용자가 "어플 만든 사람이 매장에 들어가서 데이터 수정해줄 일이 없는데 왜 매장 직원에 박혀있냐, 매장마다 또 박을 거냐"라고 지적 → super_admins 테이블 신설 제안도 사용자가 "의미 없다"고 일축 ("시스템 고칠 일 있으면 코드 수정하지 매장 UI 들어갈 일 없다").

**원인**:
- `auth_level='owner'`라는 단일 권한이 두 가지 다른 개념을 섞어버림
  - (a) 매장 운영 최상위 권한자 (매장 사장)
  - (b) 앱 시스템 운영자 (개발자)
- 가입 플로우가 가입자 본인을 자동으로 (a)로 등록 → 사용자(앱 개발자)도 매장 owner가 됨 → 호칭 충돌(사장 vs 총관리자)

**해결**:
1. owner = **매장 운영 사장 1명**으로 의미 단일화 (UI 라벨 "👑 사장")
2. 앱 개발자(김은성) row 삭제, 매장 운영 사장(이송은) owner 승격
3. super_admin 메커니즘 신설 X — 앱 운영자가 매장 UI에 로그인할 메커니즘 자체가 불필요
4. 시스템 디버깅·수정은 Supabase 콘솔 직접 SQL 또는 코드 수정으로 처리

**체크리스트** (가입 플로우 손볼 때):
- [ ] 가입자 본인을 매장 employees.owner로 등록하는 게 적절한가?
- [ ] 가입자 = 진짜 매장 운영자인가? (개발자/운영자가 가입자가 되면 안 됨)
- [ ] 매장 직원 테이블에 들어가야 할 사람만 들어가나?

**재발 방지**: business_rules.md #7 호칭 절대 규칙 + 이력 박음.

---

## 55. 호칭 절대 금지: owner ≠ 사장 (2026-05-05)

**사건**: 김은성(=총관리자=owner=사용자)이 "난 사장이 아니다, 매장 사장은 이송은이고 나는 앱 총관리자다"라고 명확히 한 후에도 클로드가 두 번째 응답에서 또 "사장님(=owner)" 표현을 사용 → 사용자 분노.

**원인**:
- 헌법 제3조에 "사장님 회사의 CTO 대행" 페르소나 표현이 있어 "사장님"이라는 호칭을 무비판적으로 owner와 동일시함
- owner는 **앱의 시스템 권한**이고, 매장 운영 사장(=업주)과는 분리된 개념인데 코드/문서/대화에서 혼용
- 가입 화면 placeholder "사장님 이름", 에러 메시지 "직원(사장님) 생성 실패", 코드 주석 다수

**해결**:
1. UI 노출 "사장님" → "총관리자"로 통일
   - 가입 placeholder/에러 메시지 3곳 변경
   - 코드 주석은 그대로 (사용자 노출 X)
2. `business_rules.md` #7에 "호칭 절대 규칙" 명시 (owner=총관리자=김은성, 매장사장=이송은=store_manager)
3. 헌법 제3조의 "사장님" 호칭은 페르소나 비유일 뿐 → owner를 "사장"으로 부르는 근거 아님

**체크리스트** (auth_level 표시 코드 작성 시):
- [ ] owner 라벨에 "사장" 단어 안 들어감 ("총관리자" / "👑 총관리자")
- [ ] store_manager 라벨에 "사장" 단어 OK (매장 운영의 사장 = 점장 = store_manager 가능)
- [ ] 신규 가입 입력란/에러: "사장님" 단어 금지, "총관리자"로 통일

**재발 방지**: docs/business_rules.md #7에 못박음 + 본 항목 등재.

---

## 54. 기기 식별은 변동 요소 빼라 — localStorage UUID가 정답 (2026-05-04)

**사건**: 사장님 "출퇴근 오류 난다, 기기초기화 해도 되다가 또 오류". 점검해보니 `getDeviceFingerprint`가 canvas 픽셀 + `screen.width/height` + `navigator.userAgent` + `hardwareConcurrency` 조합 해시. 같은 폰에서도 **화면 회전**(가로↔세로), **브라우저 자동 업데이트**(UA 버전 변경), GPU 캐시 변동으로 해시가 달라져 "등록 안 된 기기" 차단. 관리자가 초기화 → 새 해시로 등록 → 또 변동 → 또 차단. **무한 반복**.

**원인**:
- "기기 고유성"을 **불안정한 환경 변수**로 만들려 함 — fingerprint.js 류 진보적 알고리즘은 광고 추적용이지 출퇴근 식별용이 아님
- dev_lessons #32에서 등록 UX(팝업)는 개선했으나 **fingerprint 자체의 안정성**은 그대로 둠 → 후속 사고
- 사용자가 보고한 "오류" 패턴(되다 안 되다)은 **fingerprint 변동성의 명확한 signal**이었지만 즉각 못 짚음

**해법 패턴 (재사용)**:
1. **localStorage UUID 우선**: 첫 호출 시 `crypto.randomUUID()` 1회 생성 → 영구 보관. 이후 항상 동일값
   - 화면 회전·브라우저 업데이트·GPU 변동 영향 0
2. **fallback fingerprint**(localStorage 차단 환경): canvas 제거, UA 버전 숫자 제거, screen 정렬해서 회전 무관화
3. **옛 형식 호환**: 기존 DB 등록값(`DF…`)이 있으면 첫 시도에서 자동으로 새 형식(`UUID-…`)으로 silent migration. 사용자·관리자 별도 조작 0
4. **`reset` 시 localStorage는 보존**: DB만 null → 같은 폰에서 재등록 시 동일 UUID 유지(다른 직원이 이 폰을 쓰는 경우도 자연스럽게 처리)

**체크리스트 (기기/세션 식별 만들 때)**:
- [ ] 식별자 구성요소 중 사용자가 의도하지 않게 변하는 게 있나? (화면 회전, 브라우저 업데이트, OS 폰트 변경)
- [ ] localStorage/IndexedDB로 영구 저장 가능한 환경인가? → 가능하면 **무조건 우선**
- [ ] fingerprint류는 fallback **2순위**로만 사용
- [ ] 사용자가 "되다 안 되다"라고 호소하면 → **변동성 의심**이 1순위
- [ ] 형식 전환 시 기존 데이터 자동 마이그레이션 경로(silent migration) 있나

**관련**: dev_lessons #32(기기 등록 UX), 헌법 10조-3(자가 치유 — 사용자에게 반복 오류 떠넘기지 말 것)

---

## 53. main 브랜치 직접 작업 실수 → claude 브랜치 fast-forward로 정리 (2026-04-30)

**사건**: 사용자 편의성 Phase 1(A+D+E) 작업 중 직전 main 머지 흐름 때문에 `git checkout` 안 한 상태로 코드 수정·커밋 → 헌법 1-2 위반(main 직접 커밋). 다행히 `git push origin claude/...`는 "Everything up-to-date"로 차단됨 (local main에만 새 커밋, claude 브랜치엔 변경 없음).

**원인**:
- 직전 main 머지 후 `git checkout claude/...` 누락
- 작업 시작 전 `git branch --show-current` 점검 안 함

**해법 패턴 (재사용, destructive op 없이)**:
```bash
# 1. claude 브랜치로 이동 + main의 새 커밋 fast-forward
git checkout claude/store-testing-checklist-XXX
git merge main --ff-only
# 2. claude push (정상)
git push origin claude/store-testing-checklist-XXX
# 3. main도 그대로 push (이미 같은 커밋)
git checkout main && git push origin main
```

**체크리스트 (모든 코드 작업 시작 전)**:
- [ ] `git branch --show-current` 출력이 `claude/...`인가
- [ ] 아니면 `git checkout claude/...` 먼저
- [ ] 커밋 직전 `git status`로 브랜치 한 번 더 확인

**교훈**: `reset --hard`/`push --force` 같은 destructive op 안 쓰고도 정리 가능. 새 커밋이 다른 브랜치에 보존되는 한, fast-forward 머지로 깔끔하게 흡수.

**관련**: 헌법 1-2(main 직접 push 금지), 헌법 11-2(백업 커밋), CLAUDE.md "Executing actions with care"

---

## 52. "분리 관리" 요청 받으면 차액 검증이 깨지는지 먼저 확인 (2026-04-29 기타매출)

**사건**: 사장님이 "마감정산에서 뽑기 매출 합산되면 안 될 것 같다, 따로 관리하자"고 요청. 즉시 코드 짜기 전에 **critic으로 모순 짚기**: "현금이 금고에 들어오는 매출인데 장부에서 빼면 차액이 항상 +가 됨". → 사장님이 설명 → "뽑기는 **기계 안 현금**이라 금고와 별개" → 모순 해소.

**교훈**:
- "합산 안 한다" = 차액 계산 로직과 직결. 무조건 분리 X. **현금 흐름이 어디로 가는지** 먼저 확인.
- 본 매출(POS) = 금고에 도착 → 장부합계 검증 대상
- 기타매출(뽑기) = 기계 안에 머무름 → 장부와 무관, 별도 패널
- 사장님이 비즈니스 의도를 정확히 말하지 않을 때, **숫자가 어디로 흘러가는지 한 번 더 묻는 게** 빠른 길.

**적용 패턴**:
```
"X를 분리하자" 요청 → critic 6질문 중 #2 "차액/합계가 깨지지 않나?" → 사장님 설명 → 진짜 의도 발견
```

---

## 51-A. ✅ 2026-04-29 추가 적용 — payment_methods 패턴 재사용

**계기**: 기타매출 동적 항목 작업.
- `payment_methods` 구조(매장별 동적, sort_order, legacy_key, soft-delete) 그대로 차용 → 99% 복붙으로 **2시간 안에 완성**.
- 시트 구조 + `loadXxx`/`renderXxxList`/`openXxxEdit`/`saveXxx`/`deleteXxx` 5종 함수 그대로 변수만 치환.
- 신규 가입 시 시드도 동일 패턴.

**교훈**: 한 번 검증된 동적화 패턴이 있으면 **새 도메인에 그대로 복제**. 새 패턴 발명하지 말 것.

---

## 51. 기존 데이터 있는 앱에 신규 가입 플로우 추가할 땐 하위호환 사수 (2026-04-24 Phase 1-A1)

> ⚠️ **2026-05-05 보완**: 본 항목의 "추가만, 수정 금지"는 **하위 호환 위험이 큰 특수 상황의 권고**이지, **잘못된 설계까지 영구 보존하라는 일반 원칙이 아니다**. 잘못된 전제·사용 모델 오해·잔재 누적이 분기를 폭증시킨 경우엔 **헌법 1-6(정당한 갈아엎기)에 따라 통째로 정리**한다. 본 항목 무한 적용으로 5월 5일 로그인 화면이 분기 5개 괴물이 됐고 사장님이 "왜 이렇게 헷갈리게 됐냐"고 분노 → 헌법 1-6 신설로 시정.

**사건**: Phase 1-A1에서 Supabase Auth 기반 신규 가입 플로우 추가. 사장님 첫 반응은 **"지금 논산에 등록해놓은 직원들은 어떻게 되는데?"** 기존 데이터 보호 여부에 대한 불안.

**원칙**:
1. **"추가만, 수정 금지"** — 신규 기능은 **기존 로그인·데이터 경로를 한 줄도 건드리지 않고** 별도 경로로 추가
2. 기존 owner/employee 데이터 **그대로 유지** (auth_user_id는 nullable)
3. 로그인 화면 **하단에만** 새 버튼 추가, 기존 매장 드롭다운·PIN 입력은 100% 유지
4. DB 마이그레이션도 **`ADD COLUMN IF NOT EXISTS`** — 기존 컬럼·데이터 안 건드림

**해법 패턴 (재사용)**:
1. 신규 가입은 `auth_user_id NOT NULL`, 기존 사용자는 `auth_user_id NULL` — 둘 다 공존 OK
2. `submitLogin`(PIN) 경로와 `submitOwnerLogin`(이메일) 경로를 **분리된 함수**로 (하나 망가져도 다른 쪽 영향 없음)
3. 기존 owner 계정 업그레이드는 **강제 아님** — 본인 원할 때 UI로 (별도 작업)
4. 마이그레이션 SQL은 **여러 번 실행 안전** (IF NOT EXISTS + DO 블록)

**체크리스트 (기존 서비스에 가입/auth 추가할 때)**:
- [ ] 기존 로그인 함수를 **한 글자도 수정하지 않았나**
- [ ] 기존 사용자가 기존 방식으로 계속 로그인되나
- [ ] 신규 필드는 nullable인가 (기존 행에 default 값 강제 없음)
- [ ] 마이그레이션 SQL이 실행돼 있든 안 돼 있든 **앱이 안 깨지는가**
- [ ] 사장님 불안 선제적 설명 (구현 전 "기존 데이터 그대로 둡니다" 명시)

**관련**: dev_lessons #46(자동 sync는 수동 수정본 덮지 말 것), #47(소스 통일), #50(공식 통일)과 함께 "**기존 데이터 절대 보호**" 4대 원칙 완성.

---

## 50. 같은 지표는 공식까지 동일해야 (순이익·적립금 사례) (2026-04-24)

**사건**: 수식 검수 중 `calcReserveBalance`(예비비 잔고)가 순이익을 **`매출 − 고정비` 근사**로 계산. 대시보드 `reserveAmt`는 **`매출 − 모든 비용`** 으로 계산. 같은 "적립금"인데 화면 2곳에서 **30~50% 차이**. 가상 시나리오(매출 33M)에서 193만 vs 130만.

**원인**:
- dev_lessons #47로 "**소스**는 단일 진실의 원천"이 정착됐지만, **수식** 자체는 각 화면에서 독립 구현
- 복잡한 순이익 계산(vendor+receipt+att+fixed+roy+cardFee) 대신 "그냥 매출-고정비로 근사하자" 타협이 코드에 박힘
- 대시보드와 잔고 계산이 **같은 데이터·다른 공식** 사용

**해법 패턴 (재사용)**:
1. **"소스 통일 + 공식 통일" 둘 다** 필요. dev_lessons #47에 공식 통일 명시 안 됨 → 이번 추가
2. 헬퍼 함수 추출 고려: `calcMonthlyNetProfit(ym, store)` 같은 공통 함수로 순이익 산출
3. 진행중 월은 고정비 일할, 완료 월은 전체 고정비 — **동일 규칙** 적용
4. 시나리오 대입 테스트로 두 화면 결과 **숫자 일치** 검증

**체크리스트 (같은 지표가 여러 화면에 있을 때)**:
- [ ] 동일 테이블·컬럼에서 읽나 (소스 통일)
- [ ] 동일 수식 사용하나 (공식 통일)
- [ ] 가상 데이터 1세트 투입 시 두 화면 숫자 일치하나
- [ ] 복잡한 계산은 공통 함수로 추출하나
- [ ] 진행중/완료 월의 일할 규칙 일관되나

**관련**: dev_lessons #47(소스 통일) + 이번(#50 공식 통일)로 "**단일 진실의 원천** 원칙" 완성.

---

## 49. 학습 규칙 keyword는 짧게 정규화 — contains 매칭 성립 조건 (2026-04-24)

**사건**: 영수증 저장 시 `saveReceipt`가 품목 전체 문자열("양파 10kg 2봉")을 그대로 `learnClassification` keyword로 저장. `classification_rules.match_type='contains'`라 다음 영수증에 "양파 5kg" 찍히면 `itemText.includes("양파 10kg 2봉")` → **false** → 학습 규칙이 **실질적으로 무력화**. 사장님은 "학습 안 된다"만 체감, 원인 오랫동안 미발견.

**원인**:
- 학습 로직(쓰기)과 적용 로직(읽기)이 **서로 다른 전제**를 가짐
- 학습: "구체적 품목 그대로 저장이 정확" (잘못된 가정)
- 적용: `contains` — keyword가 부분 일치해야 함
- 둘 사이 일관성 체크 없음

**해법 패턴 (재사용)**:
1. **`normalizeItemKeyword(item)`** 신규 — 품목의 첫 한글/영문 덩어리(2자 이상) 추출
   - "양파 10kg 2봉" → "양파", "삼겹살2kg" → "삼겹살", "생수500ml 12입" → "생수"
2. 학습 호출부에서 **반드시 이 함수 경유**
3. 적용(`applyRulesToReceipt`)은 **기존 contains** 그대로 — 이제 성립

**체크리스트 (학습/적용 쌍이 있는 곳)**:
- [ ] 저장하는 keyword와 매칭 로직의 전제가 일치하나
- [ ] 학습 데이터 **샘플 1건**을 실제 매칭에 넣어보는 유닛 테스트
- [ ] 사용자 "학습 안 된다" 보고는 keyword 내용부터 dump 확인 (적용 로직부터 보지 말 것)

**관련**: dev_lessons #25 "영수증 학습은 힌트가 아니라 규칙 덮어쓰기" — 그때 구조는 맞았지만 keyword 전략에서 이번 버그 내재. 오래 살아남음.

---

## 1. inline 핸들러 금지 (Cloudflare CSP) ✅ 2026-04-17 전수 제거
Cloudflare Pages가 `onchange="..."`, `onclick="..."` **조용히 차단**. 에러도 안 뜸.

```
❌ <input onchange="doSomething(this)">
❌ <div onclick="event.stopPropagation()">
✅ <div data-action="함수명|인자1|인자2">   ← 중앙 라우터가 처리
✅ <input data-change="함수명|this"> / data-input=...
```

**현재 구조 (index.html 1961~2008행, DOMContentLoaded 최상단)**:
- `_dispatchAction(attr, el)` 파서: `data-action="fnName|arg1|arg2"` 파싱
- 특수 토큰: `this` → 요소, `true`/`false`/`null`/`undefined` → 그대로,
  숫자(정수/소수/음수) → 자동 파싱, 그 외 → 문자열
- 복합 동작(다중 호출)은 래퍼로 등록 (navFromSide, editEmpAfterClose, setGanttDay 등)
- 인자에 `|` 문자가 들어가지 않도록 주의 (이름·라벨·UUID 모두 안전)
- `event.stopPropagation()`은 불필요 — `closest('[data-action]')`가 innermost 자동 선택

---

## 2. DOMContentLoaded에서 return 순서
`completeLogin(emp); return;`이 이벤트 바인딩보다 위에 있으면, 로그인된 사용자는 바인딩 안 됨.

```
DOMContentLoaded 안 순서:
1. 초기화 코드
2. 이벤트 바인딩 ← return보다 위에!
3. 로그인 복원 (return 가능)
```

---

## 3. sheet-overlay 이중 구조
두 가지 시트 구조가 공존:
- 일반: `<div class="sheet" id="...">`
- 오버레이: `<div class="sheet-overlay" id="..."><div class="sheet">`

`openSheet`/`closeSheet`이 둘 다 처리해야 함. sheet-overlay는 `#overlay` 안 켜야 함 (자체 배경).

---

## 4. category 이름 매핑
키워드 분류 결과와 expense_categories.name이 다르면 category_id가 null.
새 카테고리 추가 시 `CAT_NAME_MAP`도 업데이트. → `business_rules.md #5` 참조

---

## 5. 배포 전 체크리스트
1. `node --check` 구문 검사 (HTML은 `<script>` 블록만 awk로 추출)
2. main 머지 + push (브랜치만 push 아님!)
3. Ctrl+Shift+R 안내
4. 콘솔에서 `typeof 함수명` 확인
5. 실제 동작 테스트
6. **대규모 변경은 CLAUDE.md 제11조 절차 필수** (사전 스캔→백업 커밋→스크립트화→3단 검증→기록)

---

## 6. 사장님 힌트는 금이다
사장님이 증상 묘사 → 문자 그대로 해석할 것.
- "화면 어두워져" → overlay/배경 문제
- "클릭하면 사라져" → 이벤트 전파 문제
- "아무것도 안 돼" → 함수가 안 불리는 문제

---

## 7. DB 스키마 변경 시 자동 기록
테이블/컬럼 추가·변경 시 `db_schema.md` 즉시 업데이트.
코드에서 새 테이블 쓰는데 문서에 없으면 → 다음 세션에서 혼란.

---

## 8. 카드사 .xls는 HTML 위장 파일
카드사 다운로드 .xls 파일은 실제 HTML 테이블. SheetJS가 요약 테이블만 읽음.
```
해결: 파일 앞부분이 <html/<table이면 DOMParser로 파싱.
금융 키워드(이용일, 가맹점 등)로 실제 거래내역 테이블 자동 탐색.
```

---

## 9. 은행 엑셀 description = 적요+내용 합침 문제
기존 코드가 `적요 + ' ' + 내용`을 합쳐서 description에 저장.
적요(타행PC, FB자금 등)는 분류 코드라 표시에 불필요.
```
해결: 업로드 시 내용(content)만 description에 저장.
기존 데이터: cleanDesc()로 적요 패턴 제거 후 표시.
```

---

## 10. auth_level과 is_manager 동기화
`auth_level='staff'`인데 `is_manager=true`인 경우 권한이 무시됨.
`completeLogin`에서 반드시 is_manager를 보조 체크해야 함.
```
authLevel = emp.auth_level || 'staff';
if(authLevel === 'staff' && emp.is_manager) authLevel = 'store_manager';
```

---

## 11. 권한 변경은 반드시 UI에서
SQL 하드코딩으로 auth_level 설정하면 불일치 발생.
직원 편집 시트의 권한 드롭박스 → saveEmployee에서 auth_level + is_manager 동시 저장.
owner만 최초 1회 SQL 설정, 나머지는 앱에서.

---

## 12. 로그아웃 시 화면 초기화 필수
`doLogout()`에서 `closeAllSheets()` + 모든 컨테이너 리셋 + `applyPermissionUI()` 필수.
안 하면 이전 세션 화면이 그대로 남아서 권한 없는 사용자가 관리 화면 접근 가능.

---

## 13. 첫 방문 시 매장 선택 버튼
`currentStore`가 null이면 매장 선택 버튼 항상 표시.
`pd_auth_level` localStorage만으로 판단하면 첫 방문자가 매장 선택 불가.

---

## 14. 시간 표시는 24시간 형식
`toLocaleTimeString('ko')` 기본값은 "오후 04:16" (12시간). 모바일에서 공간 낭비.
```
❌ toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit'})  → "오후 04:16"
✅ toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})  → "16:16"
```

---

## 15. 횡스크롤 금지 — 한 화면에 표시
모바일 테이블에 `min-width`, `overflow-x:auto` 사용 금지.
`table-layout:fixed` + `colgroup`으로 칼럼 비율 고정.

---

## 16. 탭 전환 시 상태 초기화
다른 탭 갔다가 돌아오면 이전 상태(스크롤, 서브탭, 입력값)가 남아있음.
`nav()` 함수에서: `window.scrollTo(0,0)` + 첫 번째 서브탭 자동 선택 + 입력폼 리셋.

---

## 19. 모바일 다수 컬럼 문제 → 카드 요약 + 풀스크린 모달
모바일에서 엑셀처럼 다수 컬럼을 한 테이블에 넣으면 횡스크롤 or 글자 깨짐.
해결: 평소에는 토스 스타일 카드 요약(매출/지출/순이익), 상세 비교가 필요할 때
풀스크린 모달에서 피벗 테이블(항목=행, 날짜=열) 제공.
토스 스타일: 격자선 없음, 여백과 색상(컬러도트)으로 구분, 카드형.

---

## 18. 대시보드는 비율(%)이 생명
대시보드 수치에는 반드시 매출 대비 비율(%)을 함께 표시.
고정 금액만 보여주면 "많다/적다" 판단 불가.
비율이 있어야 "식자재 30% → 줄여야겠네" 같은 의사결정 가능.
월요약, 일별 카테고리, 주계 모두 비율 필수.

---

## 20. CSS rotate로 모바일 가로 전환 시 주의
`transform:rotate(90deg)` + `transform-origin:top left` + `left:vw px`.
CSS 클래스로 하면 vw/vh 단위가 부정확 → JS로 `window.innerWidth/Height` 직접 읽어서 px 설정.
풀스크린 모달은 body 직하위에 배치 (컨테이너 안에 넣으면 transform 좌표 꼬임).

---

## 21. 일별정산 catNames 하드코딩 문제 ✅ 해결됨
~~현재 `['식자재','직구/영수증','인건비','고정비','로열티/수수료']` 고정.~~
→ 2026-04-15 해결: expense_categories의 data_source 기반으로 동적 생성.
`srcToCat` 매핑으로 vendor_orders→카테고리명 자동 연결.

---

## 22. 금액/비율 리스트는 반드시 행열 정렬 (tabular-nums + table)
**⚠️ 최우선 규칙 — 사장님 강조사항**

숫자가 2행 이상 나열되면 **무조건 `<table>`** 사용. flex/div 금지.
세자리 콤마를 쓰는 이유가 끝자리를 맞춰서 한눈에 비교하기 위한건데,
flex로 하면 자릿수가 안 맞아서 의미 없음.

```
❌ flex + text-align:right → 항목마다 금액 위치가 들쭉날쭉
✅ <table> + font-variant-numeric:tabular-nums → 금액/비율 컬럼 완벽 정렬
```

**적용 대상 (빠짐없이)**:
- 월 요약 (매출/지출/순수익/예비비/실수익)
- 마감예상
- 지출 상세 아코디언 (카테고리별)
- 매출 상세 아코디언 (결제수단별)
- 급여 집계, 거래내역, 정산 등 모든 금액 리스트

**필수 규칙**:
- 이름 컬럼: 왼쪽 정렬 (`text-align:left`)
- 금액 컬럼: 오른쪽 정렬 + `font-variant-numeric:tabular-nums`
- 비율 컬럼: 오른쪽 정렬 + 고정 width
- 새 금액 리스트 만들 때 **말 안 해도 자동으로 table 적용**

---

## 23. 카테고리 하드코딩 금지 — DB expense_categories 직접 매칭
CAT_NAME_MAP 같은 매핑 테이블 하드코딩하면 카테고리명 변경 시 FK 깨짐.
```
❌ CAT_NAME_MAP = {'물품대금':'식자재(거래처)'}
✅ expense_categories.name 직접 매칭 (findCatId)
```
분류 변경 UI, 리뷰 드롭다운, saveExcelBatch 모두 DB에서 동적 생성.

---

## 24. 비활성 카테고리도 거래 있으면 집계에 포함
카테고리 삭제(is_active=false) 시 해당 월 거래 데이터가 사라지면 안 됨.
```
loadExpCategories: is_active 필터 없이 전체 로드
관리 UI/분류 변경: is_active 필터 적용
대시보드/정산: 활성 + 비활성(거래있는 달만) 포함
```

---

## 25. 영수증 학습은 "힌트"가 아니라 "규칙 덮어쓰기"
AI에 과거 데이터를 프롬프트로 넘기면(힌트): 무시할 수 있음, 프롬프트 비대, 비예측적.
```
❌ 프롬프트에 "바나나우유→간식" 힌트 삽입 (AI가 무시 가능)
✅ AI 응답 후 classification_rules 조회 → 카테고리 강제 덮어쓰기
```

---

## 26. birth_date를 주민번호 칸에 넣지 마라
직원 편집에서 `id_number || birth_date` fallback 사용하면,
birth_date("2025-06-01")를 주민번호로 파싱 → "1920-25-06" → DB 에러.
주민번호 없으면 빈칸. 절대 다른 필드로 fallback 금지.

---

## 17. HTML 요소 제거 후 JS 참조 확인
HTML에서 `empBirthInput` 제거 → JS의 `autoFormatDate(empBirthInput)` 에서 null 에러.
요소 ID 변경/삭제 시 JS에서 해당 ID 참조하는 곳 전부 grep 확인 필수.

---

## 27. 대규모 일괄 치환은 스크립트 + 3단 검증 (2026-04-17 Phase 1 교훈)
인라인 핸들러 251개를 수작업 Edit 반복 = 지옥. 스크립트화가 정답.
```
❌ Edit 200회 반복 → 실수·누락·토큰 소모 폭발
✅ /tmp/phaseN/convert.py 한 번 → 변환 카운트 자동 출력 → 3단 검증
```
**절차 (CLAUDE.md 제11조)**:
1. 사전 스캔: `grep -c`로 총수·`sort -u`로 유니크 패턴 측정
2. 백업 커밋 먼저 (롤백 지점)
3. Python 스크립트: 성공/실패 카운트 반드시 출력
4. 사후 3단 검증: 구문(`node --check`) + 잔재 grep + 샘플 육안
5. `work_log.md`에 수치 기록 + `dev_lessons` 갱신

---

## 28. RLS 비활성 상태에선 모든 쿼리에 store_id 필터 필수 (2026-04-17 Phase 2a 교훈)
Supabase RLS 비활성 + anon key 클라이언트 노출 = 매장 격리는 **코드 레이어가 유일한 방어선**.

```
❌ sb.from('attendance_logs').update(payload).eq('id', x)        ← 다른 매장 id로 위조 시 뚫림
✅ sb.from('attendance_logs').update(payload).eq('id', x).eq('store_id', currentStore.id)
```

**감사 자동화의 한계**:
- audit 스크립트가 `sb.from(...)` 다음 N줄만 보면 **payload 정의가 위에 있는 case는 false positive**
  (예: `const payload={store_id:currentStore.id,...}` 후 한참 아래에서 `.insert(payload)`)
- 1차 grep 결과는 사장님 중간 리포트 + 수동 검증 단계로 **반드시** 재확인
- Phase 2a 사례: audit 1차 C=17 → 수동 검증 후 진짜 C=5 (false positive 12건)

**원칙**:
1. insert/upsert payload — 변수 정의에 `store_id:currentStore.id` 명시 (관용)
2. select/update/delete — 무조건 `.eq('store_id', currentStore.id)` 또는 `sid` (간접 보호되더라도 명시적 추가)
3. PK `.eq('id', X).update/.delete` — 그래도 `.eq('store_id', ...)` 추가 (이론적 위조 차단)
4. 다음 단계: Supabase 콘솔에서 RLS 활성화 → DB 레이어 2차 방어 (Phase 2b)

---

## 31. Claude 샌드박스는 Supabase 직접 테스트 불가 (2026-04-17 Phase 2b 사고)
Claude 샌드박스 IP가 Supabase API allowlist에 없어서 curl로 RLS 동작 직접 검증 불가.
```
❌ curl /rest/v1/... → 403 "Host not in allowlist" (Origin 위조도 안 먹힘)
✅ 사장님이 앱에서 직접 동작 확인 → 유일한 검증 경로
```
**역설적 이점**: anon key 탈취돼도 Supabase 허용 도메인 밖에선 못 씀 → 이미 보안 방어막 존재.
**교훈**: 골든패스 "앱 테스트"는 Claude가 대체 불가. 역할 분담 명확히:
- Claude: 브랜치 작업/SQL 작성/docs/코드 정적 검증
- 사장님: 앱 버튼 누르기 (실제 동작)

---

## 30. RLS 1차 활성화는 USING(true) + WITH CHECK로 무중단 (2026-04-17 Phase 2b)
Supabase RLS를 갑자기 엄격하게 켜면 anon key 앱이 전부 정지. 점진적 강화 전략.

**1차 정책** (Phase 2b):
```sql
ALTER TABLE public.X ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.X
  FOR ALL TO public
  USING (true)                        -- 읽기 전부 허용 (앱 무중단)
  WITH CHECK (store_id IS NOT NULL);  -- 쓰기 시 store_id 필수 (스키마 정합성)
```

**효과**:
- 코드 레이어 `store_id` 필터(Phase 2a 완료)와 2중 방어망
- store_id 누락 INSERT는 DB에서 차단 → 다음 매장 추가 시 실수 방지
- 앱 재배포 불필요, 기존 세션도 정상 동작

**주의**:
- `FOR ALL` = SELECT/INSERT/UPDATE/DELETE 단일 정책으로 커버
- `TO public` = anon + authenticated 둘 다. `TO authenticated` 쓰면 anon 접근 막힘 → 앱 정지
- 부모 테이블(store_id 없는 stores, franchises)은 유보
- 자식 테이블(expense_category_amounts, fixed_cost_amounts)도 store_id 있음 확인 후 포함

**2차 정책** (Phase 2c 이후):
- Cloudflare Worker 프록시 + JWT 인증 도입 후
- `USING (store_id = (auth.jwt() ->> 'store_id')::uuid)` 식 엄격화

**롤백**:
- 실패 시 즉시 `phase2b_rls_rollback.sql` 실행 (DROP POLICY + DISABLE RLS)
- 정책 네이밍 `pd_phase2b_all` 컨벤션으로 향후 찾기 쉬움

---

## 32. 백그라운드 상태 변화는 명시적 피드백 필수 (2026-04-20)
기기 지문 자동 등록 같이 **사용자 모르게 일어나는 상태 변화**는 2초 토스트로는 부족.
사장님조차 "등록됐는지 안됐는지 모름"이라고 불만. 팝업으로 강제 인지시키는 게 UX 정답.

```
❌ 첫 출근 시 조용히 자동 등록 + 2초 toast → 못 봄
✅ 로그인 직후 팝업 3상태(미등록/일치/불일치) + 명시적 버튼
```

**원칙**:
- 보안/권한/식별자 같은 "중요한 자동 상태 변화"는 토스트 금지 → 팝업
- 일치(정상) 상태는 자동 닫힘(3초)으로 흐름 방해 최소화
- 불일치 상태는 **해결 방법 명시**(재로그인 or 관리자 초기화 요청)
- 관리자 계정은 여러 기기 쓰므로 **팝업 스킵** 필요

**구현 위치**: index.html `showDeviceStatusPopup` (6250~6329), `completeLogin` 끝에 staff 한정 호출.

---

## 33. mydata_transactions.category_id = 항상 대분류 id (2026-04-21)
`expense_categories`가 parent_id로 2단계 트리인데, mydata_transactions.category_id가
소분류 id인지 대분류 id인지 **규칙이 없었음** → 혼용 → 대시보드 집계 5474행
`t.category_id === cat.id` 1:1 매칭이 소분류 건을 누락 → 수치 틀어짐.

**사장님 진단**: "소분류 fk 안돼있는듯 / 계산수식 틀어짐"

**범인 3곳**:
1. `saveExcelBatch.resolveCatId` (구버전): 이름만 매칭 → 소분류 선택 시 소분류 id 저장
2. `openCatEdit` 저장(구버전 6051): `category=selected, sub_category=selected` 동일 덮어씀
3. 확인필요 시트 `<input placeholder="소분류">` 자유 입력 → DB에 없는 소분류명 주입

**해결 규칙 (2026-04-21 확립)**:
```
mydata_transactions.category_id = 항상 대분류 id (parent_id IS NULL인 카테고리)
mydata_transactions.sub_category = 소분류명 text (FK 아님, 참고용)
```

**구현**:
- `resolveCatPair(catName)` — 대분류/소분류 이름 구분해서 `{mainId, mainName, subName}` 반환
- `saveExcelBatch.resolveCatPayload` — "A>B" 합쳐진 포맷 + 소분류명만 있는 포맷 양쪽 처리
- `openTxEditSheet/saveTxEdit` — 편집 저장 시 pair.mainId를 category_id에 고정
- 확인필요 시트 `<input>` 제거 → `<select>` 한 개로 통일

**마이그레이션**: `docs/sql/migrate_tx_category_id_to_parent.sql` (기존 소분류 id 박힌 거래 → 부모 id로 치환 + sub_category에 소분류명 채움)

**교훈**: DB 컬럼 2개(category_id + sub_category)로 계층을 표현할 때는 **어느 쪽이 어느 레벨을 담는지** 처음부터 못 박을 것. 이름 기반 매칭은 계층 혼동 사각지대.

---

## 34. 분류 셀 세로 2줄 표시 (2026-04-21)
모바일 테이블은 가로 폭 부족 → "대분류>소분류" 한 줄 동시 표시 불가.
분류 셀을 **세로 2줄**로 쌓는 편이 공간 효율 최고.

```
❌ 분류 셀 탭 → 말풍선 → 확인하려면 매번 탭 (피곤)
❌ 내용 칸 줄이고 분류 칸 늘림 → 내용이 잘려서 뭐가 뭔지 모름
✅ 대분류 9px gray + 소분류 11px 진하게, line-height:1.1 → 행 +8px만
```

소분류 없는 행은 자연스럽게 1줄(대분류만). 폭 증가 0.

---

## 35. 거래 편집은 분류만이 아니라 5필드 전체 (2026-04-21)
분류만 수정 가능하게 만들면 **금액 오타·날짜 오류는 수정 경로 없음**. 사장님 불만.
```
❌ 분류 셀 탭 → 분류만 수정 (금액/날짜 수정 불가)
✅ ✎ 편집 버튼 → 날짜/내용/분류/입금/출금/정산제외 6필드 통합 시트
```

**tx_hash C안 원칙**: 편집해도 원본 지문 **그대로 둠**. 지문은 "이 엑셀 거래가 이미 들어왔다"는 사실을 표시하는 것이지, 현재 값이 아니라 **원본 값의 고유번호**. 재업로드 중복 차단 정상 작동.

---

## 36. 제안 전 FK 전수 점검 필수 (2026-04-21 회고)
사장님이 "지출카테고리 구조 바꾸자"고 하실 때 바로 방법론 3가지 제시했으나 **FK 정합성은 건너뜀**. 사장님 "지금 fk 고려 됐어요?" 한 마디에 검토하니 **6군데 미점검**이 드러남.

**범인 (점검 누락)**:
- `vendors.category` 선택지 변경 시 기존 저장값 무효화
- `expense_categories.data_source` 단일값 → 다중 소스 합산 불가
- `receipts.category_id` 규칙이 mydata와 다름 (통일 안 됨)
- `classification_rules` 시드 명칭이 카테고리명과 어긋남
- `expense_category_amounts` / `reconciliation` 소분류 지원 여부

**교훈**:
```
❌ 사장님 요구 → 방법론 3안 제시 → 추천 → 바로 구현
✅ 사장님 요구 → FK 영향 테이블 전수 나열 → 각 대응안 포함 → 방법론 제시 → 추천
```

**원칙**:
1. 카테고리/태그/상태 같은 **분류 체계 변경**은 무조건 관련 테이블·컬럼 전수 나열부터
2. 다중 `data_source` 집계가 끼면 대시보드·정산 집계 함수 **전체 분기 재검토**
3. 이전 세션에서 확립한 규칙(예: dev_lessons #33)과 **일관성 유지** 확인 — 기존 규칙을 깨는 제안이면 명시적으로 표시
4. **사장님이 "고려됐어?"라고 묻기 전에** 내가 먼저 나열해야 함

---

## 37. composite data_source — 대분류만 루프, 소분류는 details로 (2026-04-22)
식자재 대분류가 거래처(vendor_orders) + 영수증(receipts) 둘 다 합산하는 구조에서,
대분류/소분류 둘 다 집계 루프에 참여하면 **이중 집계** 발생.

```
❌ catsForAggregation = 모든 expense_categories (대+소 둘 다)
   → 식자재 = 300만 (대분류) + 육류 100 + 야채 80 + 공산품 120 = 총 600만 (이중)
✅ catsForAggregation = composite 소분류는 스킵
   if(c.data_source==='composite' && c.parent_id) return false;
   → 대분류만 집계 + 소분류는 reconcileRender의 details로 펼침
```

**집계 로직 (calcExpenseByCategories, reconcileRender 동일)**:
- 대분류 composite: 자식들 `vendor_category` 전부 + 자식 id로 된 receipts + 본인 id receipts
- 소분류 composite: 본인 `vendor_category` + 본인 id receipts (단, 소분류는 loop skip)

**장점**:
- 대분류 집계는 자식 합과 **반드시 일치** (자식 vendor_category들을 모두 포함하므로)
- 소분류 세부 금액은 `details` 배열에서 표시 (아코디언 펼칠 때)

**교훈**: 부모-자식 구조에서 집계 루프 설계할 때 **이중 집계 방지 필터** 반드시 적용. 설계 단계부터 점검.

---

## 38. receipts.category_id = 소분류 id (mydata와 규칙 다름) (2026-04-22)
`mydata_transactions.category_id` = 대분류 id (dev_lessons #33). 그런데 receipts는 **소분류 id**.
왜 규칙이 다른가? 데이터 출처 특성이 다름.

```
mydata: 은행/카드 출금. description = "양두현" (거래처명만). 품목 알 수 없음 → 대분류가 맞음
receipts: 영수증 직접 촬영. item = "양파 10kg" (품목 명시) → 소분류까지 확정 가능
```

**집계 처리 (calcExpenseByCategories receipts 분기)**:
```
// 대분류 receipts면 자식 id도 포함 (소분류 미지정 receipts까지 잡기)
const childIds = expCategories.filter(c=>c.parent_id===cat.id).map(c=>c.id);
const targetIds = [cat.id, ...childIds];
// category_id IN targetIds
```

**교훈**: FK 저장 규칙은 **테이블별로 다를 수 있음**. 모든 FK를 "대분류 id 고정" 같은 단일 규칙으로 통일하려 하지 말 것. 데이터 특성에 맞게 규칙 분화.

---

## 39. 하드코딩/미리-INSERT 금지, DB UI 관리 원칙 (2026-04-22 사장님 지적)
카테고리 신설 기능 만들면서 매출 소분류 4개(카드결제/QR결제/현금입금/송금결제)를 SQL로 미리 INSERT 하자고 제안 → **사장님 반려**.

```
❌ 제안: 예상되는 소분류를 미리 DB에 박음
   → 사장님이 필요 없는 항목까지 들어감
   → 코드 수정 없이 데이터 변경 불가능 (제10조 2번 위반)
✅ 올바름: 관리 UI만 만들고, 사장님이 필요할 때 필요한 만큼 추가
   → DB 편집 = 앱 UI로만 (하드코딩/SQL INSERT 최소화)
```

**원칙 (헌법 제10조 2번 "관리 편의성")**:
1. 카테고리/태그/분류 같은 **사용자 관리 대상** 데이터는 **절대 SQL로 시드 INSERT 하지 말 것**
2. 관리 UI(추가/편집/삭제) 먼저 만들고, 사장님이 직접 입력
3. 스키마 변경(ALTER TABLE)은 필요, 데이터 변경은 UI로
4. 내가 "편의를 위해 기본값 몇 개 미리 넣어둘게요"는 유혹 → **참아야 함**
5. 사장님이 "기본값 넣어주세요"라고 **명시 요청**할 때만 INSERT

**예외** (INSERT 해도 되는 경우):
- 마이그레이션 필수 (기존 데이터 구조 보존): 2026-04-22 식자재 개편의 '식자재/육류/야채/공산품' 
- 시스템 상수 (사용자 편집 불필요): country 코드, 통화 코드 등

**교훈**: 사장님은 "내가 틀릴 수도 있음을 항상 감안해라"고 하셨지만, 이번은 내가 확실히 틀렸고 사장님이 맞았다. 동일 지적 반복되지 않도록 주의.

---

## 40. 동적 DOM 바텀시트는 sheet-overlay 패턴 사용 (2026-04-22)
`document.body.appendChild(sheet)` + 인라인 `position:fixed; top:0; bottom:0;`로 바텀시트 만들면 **화면 중간에 떠버리는 버그** 발생.

```
❌ const sheet=document.createElement('div');
   sheet.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;...';
   document.body.appendChild(sheet);
   → containing block 이슈로 중간에 뜸
✅ HTML에 미리 <div class="sheet-overlay" id="..."><div class="sheet">...</div></div> 정의
   → 기존 openSheet/closeSheet 호출
```

**원인 추정**:
- body에 `overflow-x:hidden; overflow-y:auto; position:relative; max-width:100vw`
- 기존 `.sheet`의 transform 조상이 자손 position:fixed의 containing block을 바꿈
- 이론적으로 body 직접 append면 영향 없어야 하지만, 모바일 브라우저에서 전체 화면 안 덮음

**해결**:
1. `<div class="sheet-overlay" id="catPickerSheet" style="z-index:7000;"><div class="sheet" id="catPickerBox" style="z-index:7001;...">...</div></div>` HTML에 미리
2. 동적 함수는 `.sheet` 내부 innerHTML만 갱신
3. `openSheet('catPickerSheet')` / `closeSheet('catPickerSheet')` 호출

**z-index 위계 (2026-04-22 확정)**:
- `.bottom-nav`: 1000
- 필터 팝업: 1100 + margin-bottom:72px (네비바 회피)
- `.sheet-overlay`: 6000, `.sheet`: 6001 (기본 바텀시트)
- 중첩 바텀시트 (예: 분류 선택): 7000 / 7001

---

## 41. 정렬 UX는 3단계 토글 (오름 → 내림 → 해제) (2026-04-22)
사장님 "정렬 걸었을 때 원상태로 가는 방법 없다" 지적.

```
❌ 2단계: 오름↑ ↔ 내림↓ (해제 불가, 계속 정렬 유지)
✅ 3단계: 오름↑ → 내림↓ → 해제 (sortCol=null, 원상태)
```

**구현**:
```js
if(sortCol===col){
  if(sortAsc){sortAsc=false;}        // 오름 → 내림
  else{sortCol=null;sortAsc=true;}   // 내림 → 해제
}else{sortCol=col;sortAsc=true;}
```

**UX 보강**:
- 활성 헤더 색상 강조 (파란색 + 굵게 + 연한 파랑 배경)
- 화살표 △▽ → ↑↓ (굵고 명확)
- title 툴팁: '한 번 더 누르면 정렬 해제'

---

## 42. 카테고리 선택은 3단계 드릴다운 + 시스템 카테고리는 바로 선택 (2026-04-22)
바텀시트에 모든 카테고리 다 펼치면 가시성 떨어짐. 타입별 드릴다운으로 분리.

```
1단계: 타입 선택
  ├ 💸 지출 › (드릴다운)
  ├ 💰 매출 ›
  ├ 🚫 정산제외 ›
  ├ 📸 영수증 참조 (바로 선택)
  └ 🏦 예비비 사용 (메모 prompt 후 바로 선택)

2단계: 대분류 리스트 (선택한 타입)
  - 자식 있음 → '›' 표시, 탭 시 3단계
  - 자식 없음 → 바로 선택

3단계: 소분류 리스트
  - 최상단 '대분류 (소분류 없이)' 옵션 포함
  - 각 소분류 선택 → '대분류>소분류' 반환
```

**교훈**:
- 시스템 카테고리(영수증 참조/예비비)는 하위 구조 불필요 → 1단계에서 즉시 선택
- 사용자 관리 카테고리(지출/매출/제외)는 드릴다운으로 정리
- 개수 힌트("11개") 같은 건 사장님이 불필요하다고 판단 → 제거

---

## 43. resolveCatPair에 '>' 분리 로직 필수 (FK 일관성) (2026-04-22)
바텀시트가 `대분류>소분류` 형식의 문자열 반환. applyReviewChoice/saveTxEdit/saveExcelBatch 모두 resolveCatPair 호출.

**문제**: resolveCatPair('식자재>육류') → DB에 그 이름 카테고리 없음 → `{mainId:null, mainName:'식자재>육류'}`
→ item.category='식자재>육류'로 저장 → FK 깨짐 + UI 표시 이상

**해결**: resolveCatPair 입력에 '>' 있으면 **분리 후 DB 조회**:
```js
if(catName.includes('>')){
  const parts=catName.split('>').map(s=>s.trim());
  const subName=parts.pop();
  const mainName=parts.join('>');
  const mainCat=expCategories.find(c=>c.name===mainName&&!c.parent_id);
  const subCat=mainCat?expCategories.find(c=>c.name===subName&&c.parent_id===mainCat.id):null;
  return {mainId:mainCat?.id||null, mainName:mainCat?.name||mainName, subName:subCat?.name||subName};
}
```

→ 모든 저장 경로에서 **대분류 id 고정** 규칙(dev_lessons #33) 자동 준수.

---

## 29. 세션 시작 시 `git fetch --all` 필수 (2026-04-17 Phase 2a 사고)
새 Claude Code 세션이 시작되면 **로컬 git은 이전 세션의 snapshot**. 원격에서 다른 세션/사장님이 push한 커밋은 모른다.

**실제 사고**:
- 사장님이 "Phase 0·1 main 머지 완료 (커밋 8453bbd)"라고 알림
- Claude는 로컬 main(`d57cd11`) 기준으로 "8453bbd 존재하지 않음"이라고 **잘못 단정**
- 사장님이 `git fetch --all` 지시 후 확인 → 로컬이 **54커밋 behind**였음
- 두 번 반복됨 (사과 후에도 같은 실수)

**교훈**:
```
❌ git log --all --oneline | grep XXX  → 없으면 단정
✅ git fetch --all 먼저 → 그다음 판단
```

**절차**:
1. 세션 시작 첫 bash 명령에 `git fetch --all` 포함
2. 로컬 브랜치 behind/ahead 확인 (`git status`, `git log HEAD..origin/main`)
3. 사장님이 "X 커밋 있음"이라 하면 grep 없으면 **fetch 먼저 의심**
4. MCP GitHub 도구(`mcp__github__get_file_contents`, `list_commits`)도 원격 fresh 상태 보여줌 — 적극 활용

---

## 48. todo/메모의 진단을 검증 없이 전달 금지 (2026-04-23 ⑫ 오진단 사건)

**사건**: `todo_next_session.md` ⑫에 "거래내역 테이블에 📸 영수증 배지 추가 — 마감정산엔 있고 거래내역엔 빠짐"이라 적혀있어 그대로 사장님께 "쉽게 설명" 요청 시 **상상한 UX 시나리오**로 답함. 사장님 반박("마감정산 탭에 영수증 거래내역이 어딨어")으로 3분 이상 시간 낭비. grep 돌려보니 거래내역에 이미 `📸 영수증 참조` 표시 존재, todo 진단 자체가 틀림.

**원인**:
- todo 메모는 과거 세션의 **초안/가설**인데 **사실**로 취급함
- "쉽게 설명"하라는 요청에 `grep` 1초면 확인될 걸 **추측으로 시나리오 지어냄**
- 사장님 반박 받고 나서야 처음으로 코드 확인 — 선제적 검증 누락

**원칙 위반**:
- CLAUDE.md 제3조 "**작동하는 결과물로 답한다**" → 추측으로 답함
- dev_lessons #45 "**critic v2 만들어놓고 본인이 안 지킴**" → 같은 패턴 반복

**해법 패턴 (새 세션·재확인 시 무조건)**:
1. todo/이전 세션 메모의 기술 진단은 **항상 `grep`으로 현재 코드와 대조** 후 전달
2. "이미 있다", "빠져있다", "N곳 있다" 같은 **수치·존재 주장은 grep 결과로만** 말하기
3. 사장님께 "쉽게 설명" 요청 받아도 **코드 확인 먼저 → 그 다음 설명**
4. 검증 안 된 진단은 "**todo 메모이지 사실 확인은 안 했습니다**" 명시

**체크리스트 (todo 기반 계획 전)**:
- [ ] 각 항목의 "이미 있다/없다" 주장을 grep으로 검증
- [ ] 함수명/라인 번호가 현재 코드와 일치하는지 확인
- [ ] 설명할 UX 시나리오가 **실제 화면 구조와 맞는지** 확인 (상상 금지)
- [ ] todo 작성 시점 이후 변경사항 있는지 work_log 크로스체크

**재발 방지 문구 (작업 전 속으로 읊기)**:
> "메모는 힌트일 뿐. 코드가 진실이다. grep 안 돌렸으면 사실로 말하지 말자."

---

## 47. 같은 지표는 단 하나의 소스에서만 (2026-04-23 대시보드 sales_daily 통합)

**사건**: 대시보드는 `settlements.items_json` 조회, 매출 관리는 `sales_daily` 조회. 사장님이 매출 관리에서 금액 고쳐도 대시보드는 **원본 마감정산 기준**이라 영원히 안 맞음.

**원인**:
- `syncClosingToSalesDaily`는 settlements → sales_daily 단방향 복사
- sales_daily 수정본은 settlements로 역류하지 않음 (의도적, 원본 보존)
- 결과: 두 테이블이 "한 번은 같고 그 뒤는 다름"

**해법 패턴 (재사용)**:
1. **파생 데이터는 하향 전용**: 원본(settlements) → 파생(sales_daily)으로만 흐름. 양쪽 조회 금지.
2. **UI/보고는 최종 파생 테이블만 조회**: 대시보드, 리포트, 집계는 모두 sales_daily 같은 최종 소스에서.
3. **원본 테이블(settlements)은 입력 로그/감사 용도**: 마감정산 탭에서만 표시.
4. **전환 시 백필 SQL 필수**: `NOT EXISTS` 가드로 기존 파생 행 보호.
5. **롤백 SQL은 memo/source 조합으로 식별**: 백필로 생긴 행만 지워지도록.

**체크리스트 (같은 지표가 여러 테이블에 있을 때)**:
- [ ] 소스 → 파생 관계 명확히 문서화 (db_schema.md)
- [ ] UI는 **파생만** 조회, 원본은 입력/감사에만
- [ ] 파생 테이블에 수동 편집 흔적(`source='..._edited'`) 구분 컬럼
- [ ] 원본 재저장 시 파생 수정본 보호 로직 (#46과 연결)
- [ ] 전환 시 백필 + 롤백 SQL 세트 필수

**관련**: dev_lessons #46 (수정본 보호) + 이번 통합으로 sales_daily가 **매출 단일 진실의 원천**으로 확정.

---

## 46. 자동 sync는 수동 수정본을 덮어쓰지 말 것 (2026-04-23 closing_edited 도입)

**사건**: `sales_daily` 행을 사장님이 손으로 고쳐도, 같은 날 마감정산 재저장 시 `syncClosingToSalesDaily`가 **upsert onConflict**로 무조건 덮어씀 → 수동 수정 사라짐.

**원인**:
- sync 함수가 `source` 컬럼을 **쓰기만** 하고 **읽지 않음**
- upsert는 편하지만 "이미 있는 행의 상태"를 고려하지 않는 blind write

**해법 패턴 (재사용)**:
1. 자동 sync 전에 기존 행의 `source`(또는 `edited_at`, `user_locked` 플래그) **먼저 조회**
2. 사용자 편집 흔적이 있으면 **스킵** + `{skipped:true}` 반환 (throw 금지)
3. 호출부에서 skipped 여부로 토스트 메시지 분기
4. 수동 편집 시 저장 쪽에서 `source` 를 `edited` 변종으로 자동 승격 (사장님 별도 조작 불필요)

**체크리스트 (자동-수동 데이터 혼재 테이블 다룰 때)**:
- [ ] 자동 소스(`closing` 등)와 수동 편집을 구분할 컬럼 있나
- [ ] 수동 편집 저장 시 source 승격 로직 있나
- [ ] 자동 sync에서 기존 행 조회 후 분기 있나
- [ ] sync 실패/스킵을 **사용자에게 토스트로 알림** (console.error만 → 금지)
- [ ] 뱃지/아이콘으로 수정본 여부 시각화

**관련**: 이번 수정으로 `source='closing_edited'` 값 추가 (db_schema.md sales_daily 컬럼 주석 갱신).

---

## 45. 사용자 UX 는 DB 스키마보다 강하다 (2026-04-23 sales_records 폐기 사건)

**사건**: sales_records 세로 raw 설계 (`payment_method` 컬럼) → 사장님 즉각 반발:
- 월 180행 쌓여 "결산 비효율"
- 결제수단 드롭다운 12개 자의적 하드코딩 → "직관적이지 못함"
- 모바일에서 "짤려 안 짤려" 걱정
- 사장님 제안: "날짜 현금 현금영수증 카드 QR 기타 총금액 이렇게 하는게 안 나음?"

**원인**:
- DB 정규화(3NF)에 집착 → `payment_method` 컬럼에 모든 결제수단 값 묶기
- 엔지니어 관점에서는 "확장성/미래 API 유리"
- **사장님(도메인 전문가) 관점에서는 "매일 본다는데 눈 아픔"**

**교훈**:
1. 사장님이 **"엑셀처럼"** 이라고 하시면 → **가로형 피벗**이 맞다. 세로 raw는 DB 정석이지만 사람 눈엔 무거움
2. 컬럼 7개 = 모바일 표 불가. **카드형 UI**(세로 스크롤 + 그리드 내부)가 모바일 정답
3. 하루 1행 보장(UNIQUE) = upsert 1번으로 끝. 세로 raw는 DELETE+INSERT N번
4. 미래 API 대비는 `source` 컬럼 1개로 충분. 스키마까지 추상화하면 오버엔지니어링
5. **critic v2 PD1 (FK 근본) / PD3 (유령 데이터) 제가 만들어놓고 본인이 안 지킴** — 기존 마감정산 UI 라벨·구조 재확인 안 하고 items_json 키만 보고 설계
6. 사장님 제안 무시하지 말 것. 엔지니어적 "옳음"보다 **사용자 일상 루틴에 맞는 것**이 이긴다

**체크리스트 (다음 매출/거래 관련 작업 전)**:
- [ ] 기존 마감정산 / 거래내역 UI의 **실제 화면 라벨** 재확인 (HTML grep)
- [ ] 사장님이 **"한 눈에 본다"** 맥락이면 피벗/카드형 검토
- [ ] 월 N행 쌓이는 설계는 모바일 불리 (스크롤 무한)
- [ ] 컬럼 수가 모바일 375px에 안 맞으면 카드형 전환
- [ ] DB 스키마 결정 전 **사장님에게 목업 1장 보여주고 OK** 받기

---

## 44. 외부 프레임워크 흡수는 "사고법만, 인프라는 버린다" (2026-04-23 gstack critic 도입)

**삽질 직전 멈춤:** gstack(garrytan/gstack) 적용 요청 시 원본 `SKILL.md` 2100줄 중 약 800줄이 telemetry/config check/세션 관리 bash 코드. 그걸 그대로 가져왔다면 `~/.claude/skills/gstack/bin/gstack-config` 같은 존재하지 않는 경로 참조로 **전부 실패**.

**원칙**:
- 외부 AI 프레임워크 흡수 시 **사고법·질문·패턴**만 한국어로 번역해 가져온다.
- **버릴 것**: preamble bash, telemetry 로깅, config check, 세션 관리, 설치 경로 참조, 외부 CLI 호출
- **가져올 것**: 6강제질문, 반-아부 규칙, 푸시백 패턴, 4가지 검토 모드, CEO 사고 패턴
- 비즈니스 맥락도 번역 필요: "founder" → "사장님", "enterprise" → "매장", "waitlist" → "관심 있다고 말만 하는 직원/점장"

**확인 체크리스트**:
- [ ] 흡수한 문서에 존재하지 않는 경로 참조 있나? (grep `~/.claude`, `bin/`)
- [ ] 외부 CLI 호출 코드 남아있나? (grep `curl`, `source <(`, `eval`)
- [ ] 비즈니스 용어가 식당/매장 맥락에 맞게 번역됐나?
- [ ] 기존 에이전트 역할과 겹치지 않게 경계가 명확한가?

**교훈**: 외부 도구의 **실행 인프라**는 그 도구의 세계에서만 돌아간다. 우리 세계에선 **사고법**만 쓸모 있다.

---

## 45. 이모지 절제 정책 (2026-05-12 사장님 재확정)

**배경**: 옛 작업(2026-04-24 work_log "사이드메뉴 이모지 통일")에서 이모지를 통일했으나, 사장님이 그 후 "이모지가 너무 많아서 빼자"고 별도 지시. 그러나 그 결정이 docs에 기록되지 않아 이후 작업에서 다시 이모지 잔뜩 추가하는 회귀 발생.

**원칙**:
- **사이드메뉴 항목 텍스트엔 이모지 안 붙임** (예: "지출 카테고리 설정" O, "📋 지출 카테고리 설정" X)
- **결제수단/기타매출 등 DB에 사용자가 직접 등록하는 `icon` 필드**의 이모지는 OK (payment_methods, extra_revenue_items)
- **앱 내 핵심 동작 한 줄 안내**(예: "📷 사진 찍으면 AI가 자동 분석")는 OK — 시각 단서 1개로 의미 강화
- **나열 메뉴/리스트/표 헤더에 모든 항목마다 이모지** = 금지 (시각 노이즈)

**판단 기준**: 이모지가 **의미를 추가하는가**, 아니면 **장식인가**. 후자면 빼라.

**같은 실수 방지**: 사장님이 한 번 "빼자"고 한 결정은 즉시 `dev_lessons.md`에 박을 것.

---

## 46. 시점 미리보기 (viewAs) 격리 설계 + 미래 제거 절차 (2026-05-12)

**기능**: 사장님(owner/franchise_admin)이 헤더 우측 토글로 "점장 시점", "직원 시점"을 임시로 켜서 다른 권한 사용자가 보는 화면을 미리볼 수 있는 기능. DB 권한은 안 바뀜.

**왜 격리해야 하나**: 사장님이 "완성되면 토글 지워라" 할 가능성 있음. 그때 코드 곳곳에 분기 박혀있으면 제거가 대형 작업이 됨.

### 격리 구조

**1) 변수 분리** (`index.html` 글로벌 상태):
```js
let realAuthLevel = 'staff';  // DB에서 받은 실제 권한 (변하지 않음)
let authLevel = 'staff';      // 화면에 적용되는 권한 (viewAsLevel 반영)
let viewAsLevel = null;       // 미리보기 권한 (null이면 실제 권한 사용)
```

**2) 단일 진입점**: `recalcPermissions()` 함수만이 `authLevel` / `isManager` / `isOwner`를 갱신. 다른 코드는 이 함수만 호출.

**3) 코드 마커**: 시점 관련 모든 추가 코드를 다음 마커로 감쌈:
```
<!-- VIEWAS-START -->  ...  <!-- VIEWAS-END -->
// ─── VIEWAS-START ───  ...  // ─── VIEWAS-END ───
```

### 미래 제거 절차 (예상 10~15분, 소형 작업)

1. `index.html`에서 `VIEWAS-START` ~ `VIEWAS-END` 마커 사이 모든 블록 삭제 (HTML/JS 양쪽)
2. `let viewAsLevel = null;` 줄 삭제
3. `let realAuthLevel = ...`을 `let authLevel = ...`로 합치기 (`authLevel` 변수 하나로 환원)
4. `recalcPermissions()` 함수 삭제. `completeLogin` 안에서 직접 `isOwner`/`isManager` 계산식 복원 (이전 PR diff 참조)
5. `recalcPermissions()` 호출 부분을 직접 계산식으로 교체 (grep로 찾음)
6. `viewAsSheet` 바텀시트 HTML 블록 삭제

**제거 후 검증**:
- `grep -i "viewAs\|VIEWAS\|realAuthLevel\|recalcPermissions" index.html` → 0건
- node --check 통과
- 골든패스: 로그인 → isManager UI 정상 표시

---

## 47. PostgREST `count` 컬럼명 충돌 (2026-05-13 영수증 400 에러 진단)

**증상**: `sb.from('receipts').select('id,...,count')` 호출 시 400 Bad Request.

**원인**: `count`는 PostgREST에서 집계 헤더 파라미터로 쓰여 컬럼명과 충돌. select에 raw하게 넣으면 일부 환경에서 400.

**해결**: select에서 `count` 제거 (사용 안 하면 그냥 빼고, 필요하면 별칭 또는 따옴표 escape).

**잘못된 진단 회피**: 처음엔 `.order('created_at')` 두번째 정렬이 원인인 줄 알고 그것만 제거 → 여전히 400. 진짜 원인은 select의 `count`. **에러 본문을 더 일찍 봐야** 진단 빠름.

---

## 48. 미정의 CSS 변수는 fallback 없이 무시됨 (2026-05-13 amt 회색 안 됨)

**증상**: `.hub-mini-amt { color: var(--gray-500); }` 적용 안 되어 amt가 다른 색으로 표시.

**원인**: 프로젝트에 `--gray-500` 변수 미정의 (`--gray-100`, `--gray-200`, `--gray-400`, `--gray-600`만 있음). 미정의 CSS 변수는 `inherit` 또는 default로 fallback 없이 무시.

**원칙**:
- 새 색 적용 전 변수 목록 확인 (`grep "\-\-gray-" index.html | head`)
- 신규 색은 정의된 변수만 사용. 안 맞으면 fallback 명시: `var(--gray-500, #9CA3AF)`
- 또는 CSS 최상단 `:root`에 변수 추가

---

## 49. standalone `.sheet` 두 개 동시 표시 시 같은 위치 stack (2026-05-13 직원 선택 가림)

**증상**: 근무 계획 시트(addSchedSheet) 안에서 직원 선택(empSheet) 호출 → 두 시트가 같은 `bottom:0` 위치에 stack되어 화면 위/아래로 분리되거나 가려짐.

**원인**: 두 시트 모두 `position:fixed; bottom:0; z-index:6001`. DOM 순서에 따라 위/아래 stack되지만 시각적으로 모달 분리 안 됨.

**해결 패턴**: 다른 시트 *위에* 떠야 하는 시트는 `<div class="sheet-overlay">` 로 감싸기.
- sheet-overlay = 어두운 배경 + display:flex (모달 컨테이너)
- 그 안의 `.sheet` = position:relative + transform:translateY 슬라이드
- z-index를 6100 등으로 높이면 다른 standalone .sheet 위에 명확히

**적용 사례**:
- empSheet, viewAsSheet, catPickerSheet 등 모달성 시트
- standalone `.sheet`는 단독 시트 (다른 시트 위 안 떠도 되는 경우)

**원칙**: 시트 안에서 또 다른 시트 호출하는 케이스 → 호출되는 시트는 sheet-overlay 패턴 강제.

---

## 50. `closeAllSheets()`는 부모 시트도 같이 닫는다 (2026-05-13 직원 선택 후 sched 시트 사라짐)

**증상**: addSchedSheet 안에서 직원 선택 → empSheet 닫힘 → addSchedSheet도 같이 닫힘.

**원인**: `selectEmpFromSheet`의 `ctx==='sched'` 분기가 `closeAllSheets()` 호출. 이 함수는 `.sheet.show` 모두 제거 → 부모 시트(addSchedSheet)도 닫힘.

**원칙**: 모달 시트(자식)에서 부모 시트로 돌아갈 때는 `closeSheet('자식id')` + `return`. 절대 `closeAllSheets()` 쓰지 말 것.

**ctx별 분기 패턴** (예시):
```js
function selectFromModal(){
  if(ctx==='att'){ ...; closeSheet('empSheet'); return; }
  if(ctx==='sched'){ ...; closeSheet('empSheet'); return; }
  closeAllSheets(); // 진짜 끝까지 닫는 케이스만
}
```

---

## 51. 토스 스타일 = 데이터 자체가 진입로 (잡 버튼 없음, 2026-05-13 사장님 의견)

**원칙**: 토스 UI는 "[상세 ›]" 같은 별도 액션 버튼 대신 **데이터 자체가 클릭 영역**.
- 통장 잔액 숫자 = 클릭 → 통장 내역
- 카드 잔액 = 클릭 → 카드 내역

**우리 앱 적용**:
- 대시보드 매출 행 = 클릭 → 매출 일별 화면
- 라벨에 이모지 + ›로 클릭 단서 (예: "📊 매출 ›")
- 행/카드 자체에 `cursor:pointer + active 효과`

**금지**:
- "[상세 ›]" 같은 잡 버튼 (시각 노이즈, 사장님 표현 "짜쳐")
- 데이터와 액션 분리 → 데이터=액션이 모바일 친화적

---

## 52. parentTabMap — 화면 진입 시 nav-bar 어느 탭 active할지 매핑 (2026-05-13)

**필요**: 한 화면이 nav-bar의 여러 진입 경로에서 호출됨. 호출 컨텍스트에 따라 nav-bar active 탭 다르게.

**예**:
- `sales` 화면 = 홈 매출 클릭에서만 진입 → `parentTabMap['sales']='dashboard'`
- `opening` 화면 = 영업 허브 카드에서만 진입 → `parentTabMap['opening']='busHub'`
- `receipt` 화면 = 사장은 지출 허브, 직원은 nav-bar 직접 → 우선순위 분기 (visible nav-item 우선, 없으면 parentTabMap fallback)

**원칙**:
- 진입 경로 바뀌면 (예: 영업 탭에서 매출 카드 제거) parentTabMap도 즉시 갱신
- visible nav-item 우선 매칭 → 사용 안 되는 nav-item이 active 표시되는 부작용 방지

---

## 53. 추측 답변 → 사장님 신뢰 손상 (2026-05-15)

**상황**: 식자재 12,594,000 원인 추적 + 잔재 카테고리 정리 작업 중, 사장님 매장의 '물품대금', '카드대금', '배당금' 카테고리 의미를 docs 안 읽고 "잔재 같다", "사장님 비즈니스 규칙일 듯" 등 추측해서 답함.

사장님 지적:
> "너 docs 안 읽고 추측하잖아. 내가 항상 세션에서 docs 읽으라고 하는데 왜 요즘 추측을 많이 하는거지? 추측 절대 금지하자."

**확인된 docs 위치**:
- `business_rules.md #4` (2026-04-09): 카드대금/배당금 = 정산 제외 항목 명시
- `work_log.md:2663` (2026-04-22): 물품대금 → 식자재 일괄 치환 이력
- `index.html:9655` 하드코딩 `fixedCats=['매출','카드대금','배당금','미분류']`
- `index.html:11201` classification_rules 시드 '배당' 키워드

**교훈**:
- 비즈니스 용어 모르면 즉시 `grep "용어" docs/*.md` 먼저
- 매 답변 전 자문: "이게 추측인가 사실인가?"
- docs 읽기 비용(0.5초) << 추측 답변 신뢰 손상 비용(영구)
- 빠른 답보다 정확한 답

**헌법 1-7 신설**로 못박음 (CLAUDE.md 제1조 1-7).

---

## 54. toISOString().split('T')[0] = 한국 시간 자정 직후 하루 빠짐 트랩 (2026-05-15)

**증상**: 사장님 5/15 영업개시 진입 시 "어제 마감"으로 5/14 (1,109,200) 대신 **5/13** 마감 (897,100)이 표시됨. 화살표 ← 누르면 5/15 → 5/14 가야 하는데 **5/13으로 점프** (하루 빠짐).

**원인 코드 패턴**:
```js
const t = new Date(targetDate+'T00:00:00');  // '2026-05-15T00:00:00' → 로컬(한국) 자정
t.setDate(t.getDate()-1);                     // 5/14 한국 자정 = UTC 5/13T15:00
const yest = t.toISOString().split('T')[0];   // UTC 변환 → '2026-05-13' ⚠️
```

`new Date(YYYY-MM-DD'T00:00:00')` 는 시간대 명시 없으면 **로컬 자정**으로 파싱. `toISOString()` 은 **UTC 변환**. 한국(UTC+9)에선 자정의 -9시간 = 전날 15시. `.split('T')[0]` 하면 _전날 날짜 문자열_ 반환.

**해결**: 헬퍼 `ymdLocal(date)` 함수 도입. 로컬 기준 YYYY-MM-DD 반환.

```js
function ymdLocal(date){
  const d=date instanceof Date?date:new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

**fix 8곳** (영업개시 + 마감정산):
- `initSettleDate`, `moveSettleDate`, `loadOpeningForDate`, `getSettleDate`
- `loadOpeningPage`, `initOpeningDate`, `moveOpeningDate`, `loadOpeningAmount`

**✅ 2026-05-15 해결**: 남은 30곳 (실제 카운트) 일괄 치환 완료 (Python 정규식 스크립트):
- 패턴 1 `new Date().toISOString().split('T')[0]` → `ymdLocal(new Date())` (18개)
- 패턴 2 `<var>.toISOString().split('T')[0]` → `ymdLocal(<var>)` (11개)
- 헬퍼 정의 위 주석 1줄만 보존 (코드 아님)
- node --check 통과, 모든 패턴2 변수 Date 객체 확인됨

**영향 범위**: 영수증/카드내역/근태/스케줄/매출/직원관리/거래처 업로드 등 전반.

**원칙**:
- 사용자가 보는 날짜 문자열 = 로컬 기준이어야 한다 (한국 매장이면 한국 시간)
- DB 저장 날짜도 마찬가지 (settle_date, opening_date 등)
- UTC 변환은 _명시적으로_ 필요할 때만 (서버 timestamp 비교 등)
- 새 코드 작성 시 `toISOString().split('T')[0]` 패턴 절대 금지 → `ymdLocal()` 사용
