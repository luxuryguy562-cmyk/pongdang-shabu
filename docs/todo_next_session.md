# 다음 세션 TODO 리스트

> **최종 업데이트**: 2026-05-05 (로그인 갈아엎기 + 시급/월급 + 헌법 1-6 신설)
> **이전 세션 완료 내역**: `docs/work_log.md` 2026-05-05 세션 #1~#4 참조
> **현재 브랜치**: `claude/debug-login-access-0Zifq` (origin·main 동기화 완료)

---

## 🚦 다음 세션 진입 트리거 (사용자가 칠 말)

가장 시급:
> **"월급제 출퇴근 calculated_wage 정리"** (오늘 미완 — 데이터 정합성)

또는:
> **"PIN 보안 강화"** (brute-force 잠금 + bcrypt)
> **"phase 2 가자"** (편의성 Phase 2 — B/C/F)
> **"5월 테스팅 결과 공유"** (실사용 이슈 정리)
> **"freemium 가자"** (Phase 1-D)

---

## 🏁 2026-05-05 세션 완료 요약 (4건)

| # | 내용 | 상태 |
|---|---|---|
| 1 | 로그인 화면 결함 묶음 수정 + 호칭 정정 | ✅ |
| 2 | 앱 개발자 employees 분리 + owner=사장 재확정 | ✅ |
| 3 | 로그인 화면 갈아엎기 (분기 5→1) + **헌법 1-6 신설** | ✅ |
| 4 | 시급/월급 + 직급 4개 + 인건비 일별 분배 | ✅ |

**헌법 변경**:
- CLAUDE.md 1-6 신설 (정당한 갈아엎기 근거)
- dev_lessons #51에 ⚠️ 보완 (특수 상황 권고일 뿐)
- business_rules #7 호칭 절대 규칙 (owner=매장 사장)
- dev_lessons #55 (호칭 혼용 방지) + #56 (앱 개발자 employees 분리)

**SQL 사용자 직접 실행 (완료)**:
- 김은성 employees row 삭제 (work_schedules 정리 후)
- 이송은 owner 승격 + role='사장'
- employees.wage_type / monthly_wage 컬럼 추가
- 기존 직원 role 4개로 마이그레이션

---

## 🟢 다음 세션 후보 (우선순위 순)

### 🔴 1순위 — 월급제 출퇴근 calculated_wage 정리
**규모**: 소형 (JS 약 20줄)
**할 일**: checkIn/checkOut/save시 직원 wage_type='monthly'면 `calculated_wage=null` 박기. 현재는 박혀도 대시보드에서 무시되지만 데이터 정합성 위해 출퇴근 코드도 손봐야.
**진입 조건**: 즉시 (오늘 작업의 미완)

### 🔴 2순위 — PIN 보안 강화
**규모**: 중형 (DB 컬럼 + JS 50줄)
- brute-force 잠금 (5회 실패 시 60초)
- (선택) PIN bcrypt 마이그레이션
**진입 조건**: 5월 테스팅 끝나고 외부 매장 받기 시작 시

### 🔴 3순위 — 직원 편집 시트 'owner' 옵션 + readonly
**규모**: 소형 (HTML 1줄 + JS 5줄)
- empAuthLevel 셀렉트에 `<option value="owner">사장</option>` 추가
- owner 카드 편집 시 권한 select disabled (강등 시한폭탄 차단)
**진입 조건**: 즉시

### 🟡 4순위 — 사용자 편의성 Phase 2 (B + C + F)
**규모**: 중형 (약 170줄)
- B. 영수증 분류 직후 피드백
- C. 빈 상태 가이드
- F. 숫자 입력 단축 칩

### 🟡 5순위 — 다른 영역 엑셀 다운로드
**규모**: 중형
- 거래내역(mydata) / 마감정산 / 영수증 월별 다운로드

### 🟡 6순위 — Freemium 인프라 (Phase 1-D)
**규모**: 중형
**진입 조건**: 5월 말 테스팅 끝난 후

### 🟢 그 외
- Phase 1-A3 직원 매장 코드 로그인 (외부 매장 시)
- 기존 owner 계정 이메일 업그레이드 UI (사용자 요청 시)
- Phase 1-B Sentry / 1-C FAQ
- 본사용 RLS 정책
- Part F Phase 3 sales_daily 레거시 컬럼 DROP

### 🔵 검토만 (Claude 불가)
- 이용약관·개인정보 법률 검토
- 사업자등록 / 세금계산서
- 결제·과금 시스템

---

## 📚 참조

| 파일 | 내용 |
|---|---|
| `CLAUDE.md` | 헌법 (1-6 정당한 갈아엎기 신설) |
| `docs/business_rules.md` | #7 호칭 절대 규칙 |
| `docs/dev_lessons.md` | #51 보완 / #55 호칭 / #56 employees 분리 |
| `docs/db_schema.md` | employees.wage_type / monthly_wage 추가 |
| `docs/work_log.md` | 2026-05-05 세션 #1~#4 |

