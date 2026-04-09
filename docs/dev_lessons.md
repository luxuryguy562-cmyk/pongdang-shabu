# 개발 교훈 (Dev Lessons)

> 같은 실수 반복하지 않기 위한 기록.
> **새 세션 시작 시 반드시 이 파일을 읽고 시작할 것.**

---

## 1. Cloudflare Pages CSP — inline 핸들러 차단
**날짜**: 2026-04-09  
**증상**: `onchange="handleExcelUpload(this,'bank')"` 같은 inline 핸들러가 **조용히 무시됨** (에러도 안 뜸)  
**원인**: Cloudflare Pages의 Content Security Policy가 inline 이벤트 핸들러 차단  
**해결**: `addEventListener`로 교체  

### 규칙
```
❌ <input onchange="doSomething(this)">
❌ <button onclick="doSomething()">
❌ <div onclick="event.stopPropagation()">

✅ document.getElementById('myInput').addEventListener('change', function(){ doSomething(this); });
✅ DOMContentLoaded에서 바인딩
```

### 현재 바인딩 위치
`DOMContentLoaded` 안, `return` 위에서 `bindFile()` 사용:
- bankExcelInput, cardExcelInput, capsFileInput, salesFileInput, vendorFileInput
- sheet-overlay 배경 클릭 닫기

---

## 2. DOMContentLoaded에서 return 순서
**날짜**: 2026-04-09  
**증상**: 로그인된 상태에서만 파일 업로드 안 됨  
**원인**: `completeLogin(emp); return;`이 이벤트 바인딩 코드보다 위에 있어서 도달 불가  

### 규칙
```
DOMContentLoaded 안에서:
1. 초기화 코드 (전부 실행)
2. 이벤트 바인딩 (전부 실행)  ← return보다 위에!
3. 로그인 복원 (return 가능) ← 여기서부터만 return 허용
```

---

## 3. sheet-overlay 이중 구조
**날짜**: 2026-04-09  
**증상**: 시트가 안 올라오거나, 올라와도 바로 사라짐  
**원인**:
- 일반 시트: `<div class="sheet" id="...">` ← openSheet이 직접 show 추가
- 오버레이 시트: `<div class="sheet-overlay" id="..."><div class="sheet">` ← show가 바깥에 붙어서 CSS 안 먹힘
- `#overlay`와 `sheet-overlay` 이중 어두운 배경

### 규칙
```
openSheet: sheet-overlay면 → #overlay 안 켜고, 내부 .sheet에 show
closeSheet: 구조별 분기
새 시트 추가 시: 가능하면 일반 <div class="sheet" id="..."> 구조 사용
```

---

## 4. category 이름 매핑
**날짜**: 2026-04-09  
**증상**: mydata_transactions에 category_id가 null  
**원인**: 키워드 분류 결과명("물품대금")과 expense_categories.name("식자재(거래처)")이 불일치  

### 규칙
```
새 분류 규칙 추가 시 → CAT_NAME_MAP도 확인
새 expense_category 추가 시 → CAT_NAME_MAP도 확인

현재 매핑:
물품대금 → 식자재(거래처)
직구 → 식자재(직구)
고정비 → 공과금/고정비
인건비 → 인건비
세금 → 세금
마케팅 → 마케팅
기타 → 기타
```

---

## 5. 배포 전 검증 체크리스트
**날짜**: 2026-04-09  
**반성**: 코드를 브랜치에만 푸시하고 main 머지 안 해서 배포 안 됨. 배포 후에도 브라우저 캐시 때문에 반영 안 됨.

### 규칙
```
1. JS 구문 검사: node --check
2. main 머지 + push
3. 사장님에게 Ctrl+Shift+R 안내
4. 콘솔에서 typeof 함수명 확인
5. 실제 동작 테스트 (파일 업로드 → 결과 표시 → 저장)
```

---

## 6. 사장님 힌트는 금이다
**날짜**: 2026-04-09  
**반성**: 사장님이 "화면 어두운 부분 고치면 될 것 같은데"라고 힌트 줬는데, 다른 곳을 파고 있었음. 결국 사장님 말이 맞았음 (#overlay 이중 표시 문제).

### 규칙
```
사장님이 증상을 묘사하면 → 그 증상을 문자 그대로 해석할 것
"화면 어두워져" → overlay/배경 관련 문제
"클릭하면 사라져" → 이벤트 전파 문제
"아무것도 안 돼" → 함수 자체가 안 불리는 문제
```
