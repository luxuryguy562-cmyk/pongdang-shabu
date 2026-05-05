# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

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
