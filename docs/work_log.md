# 작업 로그

> 세션별 작업 요약. 상세 교훈은 `dev_lessons.md`, 비즈니스 규칙은 `business_rules.md` 참조.

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
