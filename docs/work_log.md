# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

---

## [2026-04-15] 대시보드 재설계 + 예비비 관리

### 상태: 배포완료
### 브랜치: claude/redesign-dashboard-settlement-fGMHI → main

### 작업 내용
1. **대시보드 전면 재설계**:
   - 월 요약 카드: 매출/지출/순수익/예비비/실수익 (누적+마감예상 2단)
   - 일별 정산 테이블: 매일 매출/지출/순이익 + 흑자🟢/적자🔴 표시
   - 주정산: 월~일 7일 단위 주계행 자동 삽입 + 주차별 요약 바
   - 월정산 상세: 엑셀 스타일 항목별 테이블 (비율% 포함)
   - 일별 차트: 매출 라인 + 순이익 라인 동시 표시
   - 원형 차트/아코디언 제거 → 테이블 중심으로 전환
2. **예비비 관리 화면** (대시보드 서브탭):
   - 예비비 잔고 카드 (총적립/총사용/현재잔고)
   - 예비비 설정 (비율/고정액/초기잔고)
   - 예비비 사용 등록 (바텀시트)
   - 사용 이력 리스트
3. **예비비 잔고 미니 표시**: 월 요약 카드 하단에 잔고 + 상세보기
4. **인라인 핸들러 제거**: 대시보드 버튼 전체 addEventListener 전환

### DB 변경
- store_settings: reserve_rate, reserve_fixed, reserve_initial_balance 컬럼 추가
- reserve_fund_logs: 신규 테이블 (예비비 적립/사용 이력)

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
