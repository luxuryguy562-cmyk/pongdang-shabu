# 작업 로그

> 에이전트가 중형/대형 작업 시 진행 상태를 여기에 기록한다.
> 세션이 끊겨도 이 파일을 보면 어디까지 했는지 알 수 있다.

---

## [2026-04-09] 엑셀 업로드 버그 수정 + 대시보드 연동

### 상태: 배포완료
### 브랜치: claude/fix-excel-upload-errors-dKfoz

### 발견된 문제 및 해결 (시간순)

#### 1. Gemini AI 프록시 500 에러
- **증상**: 엑셀 업로드 시 "분석중" 무한 로딩 후 아무것도 안 됨
- **원인**: gemini-proxy.luxuryguy562.workers.dev 서버 500 에러
- **해결**: AI 호출 제거 → 컬럼 키워드 매칭 방식으로 교체
- **참고**: 영수증 AI(runAI), POS AI(runPosAI)는 유지

#### 2. Cloudflare Pages CSP (Content Security Policy)
- **증상**: 파일 선택해도 `onchange` 핸들러가 발동 안 됨. 콘솔 에러도 없음
- **원인**: Cloudflare Pages가 inline 이벤트 핸들러(onchange="...", onclick="...") 차단
- **해결**: 모든 파일 input의 `onchange` 제거 → `DOMContentLoaded`에서 `addEventListener`로 바인딩
- **영향받는 요소**: bankExcelInput, cardExcelInput, capsFileInput, salesFileInput, vendorFileInput
- **주의**: sheet-overlay의 `onclick`도 차단됨 → 같은 방식으로 교체함
- **교훈**: **앞으로 새 이벤트 핸들러는 반드시 addEventListener 사용. inline 핸들러(onchange, onclick 등) 절대 쓰지 말 것**

#### 3. DOMContentLoaded return 문제
- **증상**: 로그인된 상태에서만 파일 업로드 안 됨. 비로그인시 정상
- **원인**: `completeLogin(emp); return;`이 `bindFile` 코드보다 위에 있어서, 로그인 복원 시 이벤트 바인딩 코드에 도달 불가
- **해결**: `bindFile` 코드를 `return` 위로 이동
- **교훈**: **DOMContentLoaded 안에서 return 앞에 모든 초기화 코드 배치할 것**

#### 4. sheet-overlay 이중 구조 문제
- **증상**: 엑셀 분석 완료 후 결과 시트가 안 올라옴 (화면만 어두워짐)
- **원인 1**: `openSheet(id)`가 `#overlay`와 `sheet-overlay`를 동시에 켜서 이중 어두운 배경
- **원인 2**: CSS `.sheet.show{bottom:0}` ← show가 `.sheet-overlay`에 붙어서 매칭 안 됨
- **해결**: 
  - `openSheet`: sheet-overlay 타입이면 `#overlay` 안 켜고, 내부 `.sheet`에 show 추가
  - `closeSheet`: 구조별 분기 처리
  - CSS: `.sheet-overlay .sheet` 전용 스타일 추가 (transform 방식 슬라이드업)
- **교훈**: **sheet-overlay 래핑 구조와 일반 sheet 구조 2가지가 공존함. openSheet/closeSheet이 둘 다 처리해야 함**

#### 5. category 이름 불일치
- **증상**: mydata_transactions 저장 후 대시보드/지출대조에 안 나옴
- **원인**: 키워드 분류 결과("물품대금")와 expense_categories.name("식자재(거래처)")이 다름
- **해결**: `CAT_NAME_MAP` 매핑 테이블 추가
  ```
  물품대금 → 식자재(거래처)
  직구 → 식자재(직구)  
  고정비 → 공과금/고정비
  인건비 → 인건비 (일치)
  세금 → 세금 (일치)
  마케팅 → 마케팅 (일치)
  기타 → 기타 (일치)
  ```
- **교훈**: **분류 규칙의 카테고리명과 DB의 카테고리명이 반드시 매칭되어야 함. 새 카테고리 추가 시 CAT_NAME_MAP도 업데이트 필요**

### 은행/카드 엑셀 호환 현황

**은행 (13개사 검증 완료)**:
신한기업뱅킹, KB국민, NH농협, 우리, 하나, 카카오뱅크, 토스뱅크, IBK기업, SC제일, 새마을금고, 수협, 신협, 대구은행

**카드 (8개사 검증 완료)**:
신한, 삼성, 현대, KB국민, 롯데, 하나, BC, NH

**특이 컬럼명 대응**:
- KB국민: 찾으신금액/맡기신금액/거래후잔액/기재내용
- SC제일: 들어온금액/나간금액/남은금액
- 신한기업뱅킹: 거래일시(날짜+시간 합체), 적요(코드)/내용(실제 거래처) 분리

### 현재 데이터 흐름

```
엑셀 업로드
  → parseExcelFile (XLSX/CSV 파싱)
  → matchColumns (헤더 키워드 자동 매칭)
  → classifyByKeyword (적요/내용으로 카테고리 분류 + 귀속월 추출)
  → renderExcelPreview (미리보기)
  → saveExcelBatch (category_id FK 매칭 → mydata_transactions 저장)
  
대시보드
  → calcExpenseByCategories(ym, mode)
  → 가마감: 기록 소스 (vendor_orders, attendance 등) + mydata 보충
  → 진마감: mydata_transactions 실제 출금만

지출대조
  → loadReconciliation
  → 기록(장부) vs 실제(mydata_transactions) 자동 매칭
```

### 다음 작업 TODO
- [ ] 기존 데이터 attribution_month 업데이트 (SQL 실행 필요)
- [ ] 디버그 console.log 제거 (안정화 후)
- [ ] 카드 엑셀 실제 테스트 (은행만 테스트됨)
