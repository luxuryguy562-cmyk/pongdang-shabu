# 퐁당샤브 관리 시스템 — 전체 설계 현황

> 최종 업데이트: 2026-04-30 (#65~67 5월 테스팅 진입 — 공란 가드 + 편의성 + 노무 다운로드)

---

## 0. 외부 서비스 / 배포 정보
> `docs/services.md` 참조

---

## 1. 기능별 구현 현황

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 1 | 영수증 AI 분석 | ✅ 완료 | Gemini AI 유지 |
| 2 | 근태 관리 (출퇴근/CAPS) | ✅ 완료 | |
| 3 | 근무계획 (간트차트) | ✅ 완료 | |
| 4 | 마감정산 (현금 vs 장부) | ✅ 완료 | POS AI 인식 유지 |
| 5 | 대시보드 (매출/지출/순이익) | ✅ 완료 | 일별/주별/월별 정산 + 예비비 관리 |
| 6 | 급여 집계 | ✅ 완료 | |
| 7 | 거래처 관리 + 파일 업로드 | ✅ 완료 | AI 제거 → 컬럼 매칭 |
| 8 | 고정비 관리 | ✅ 완료 | |
| 9 | 지출 카테고리 | ✅ 완료 | |
| 10 | 엑셀 업로드 (은행/카드) | ✅ 완료 | AI 제거 → 키워드 분류 |
| 11 | 매출 엑셀 업로드 | ✅ 완료 | 마감정산 탭 |
| 12 | 정산/검수 (지출대조) | ✅ 완료 | 기록 vs mydata 자동 매칭 |
| 13 | 공과금 미납 알림 | ⏳ 부분 | UI만 (체크 로직 미구현) |
| 14 | 거래처 차액 추적 | ⏳ 부분 | DB만 (로직 미구현) |
| 15 | 월 귀속 판단 고도화 | ⏳ 부분 | 기본 추출만 |
| 16 | Codef API 연동 | ❌ 대기 | 유료 견적 답변 대기 |
| 17 | 권한 체계 (auth_level) | ✅ 완료 | 4단계: owner/franchise_admin/store_manager/staff |
| 18 | 로그인 보안 | ✅ 완료 | PIN 필수, owner만 자동로그인, 드롭박스 방식 |
| 19 | 마감정산 날짜 선택 | ✅ 완료 | 관리자만 과거 날짜 정산 |
| 20 | 근태 주간 간트차트 | ✅ 완료 | 내 기록에 계획vs실제 바 표시 |
| 21 | 직원관리 통합 | ✅ 완료 | 3탭→1탭, 편집시트에서 권한 직접 설정 |
| 22 | 급여 재계산 | ✅ 완료 | 시급 변경 후 기존 기록 재계산 |
| 23 | 엑셀 사람이름 자동 분류 | ✅ 완료 | 적요 재시도 + 입금+이름패턴 |
| 24 | 기기 기반 출퇴근 인증 | ✅ 완료 | Device Fingerprint + 관리자 초기화 |
| 25 | 근태 기록 수정/삭제 | ✅ 완료 | 관리자 전체조회에서 터치→편집 |
| 26 | 내 기록 간트 개선 | ✅ 완료 | 오늘상태카드 제거, 근무시간 표시, 출근만도 바 표시 |
| 27 | 마감정산 일별카드 수정 | ✅ 완료 | undefined 수정 + 수정/삭제 기능 |
| 28 | 탭 전환 상태 초기화 | ✅ 완료 | 스크롤·서브탭·입력폼 리셋 |
| 29 | 급여 0원 방지 | ✅ 완료 | 시간 검증 + 자정 퇴근 fallback + 이상 표시 |
| 30 | 직원관리 주민번호/외국인 | ✅ 완료 | 주민번호 마스킹, 외국인등록번호, 신고구분 |
| 31 | 카테고리 대분류→소분류 | ✅ 완료 | parent_id 2단계, 트리 UI |
| 32 | 홈화면 역할별 분리 | ✅ 완료 | 관리자→대시보드, 직원→근태, 로고 클릭 홈 |
| 33 | 대시보드 재설계 (일별/주별) | ✅ 완료 | 월요약+주단위요약+월정산+차트, 매출대비 비율% |
| 34 | 예비비 관리 | ✅ 완료 | 잔고계산, 설정, 사용등록, 이력 |
| 35 | 상세비교 풀스크린 모달 | ✅ 완료 | 가로전환, 피벗테이블, 주계행, 기준% 색상, 총누계+주별접기 |
| 36 | 대시보드 쿼리 최적화 | ✅ 완료 | getMydataAmount 2회로 축소, Promise.all 병렬화, console.log 제거 |
| 37 | catNames 동적화 | ✅ 완료 | expense_categories DB data_source 기반 동적 생성 |
| 38 | 기준% DB 저장 | ✅ 완료 | store_settings.expense_thresholds jsonb |
| 39 | 매출/지출 상세 아코디언 | ✅ 완료 | 도넛차트 + 카테고리 테이블, 매출(카드/현금/일평균), 지출(카테고리별) |
| 40 | 모바일 좌우 스크롤 방지 | ✅ 완료 | html overflow-x:hidden, min-width 제거, container overflow |
| 41 | 월요약 table 정렬 | ✅ 완료 | flex→table 전환, tabular-nums, 마감예상 포함 |
| 42 | 전월대비 문구 (클로브 스타일) | ✅ 완료 | 월요약+지출아코디언+주별카드, 매출↑파랑/지출↑빨강 |
| 43 | 엑셀 분류 DB 범용화 | ✅ 완료 | 하드코딩→classification_rules DB, 매장별 학습, 공통/매장 2단계 |
| 44 | 직원 서류 관리 | ✅ 완료 | 파일 첨부(Storage), 배지 개별 표시, 미성년자 감지, 비자 관리 |
| 45 | 영수증 OCR 개선 + 학습 | ✅ 완료 | 해상도↑, 프롬프트 강화, 규칙 덮어쓰기 학습, DB 카테고리 FK |
| 46 | 매장 IP 다중 등록 | ✅ 완료 | 쉼표 구분 다중 IP, 추가/삭제 UI |
| 47 | 거래내역 삭제 | ✅ 완료 | 월 일괄 + 건별 삭제 |
| 48 | 지출 카테고리 독립 화면 | ✅ 완료 | 설정에서 분리, 삭제 버튼 추가, 비활성 집계 |
| 49 | CAT_NAME_MAP 하드코딩 제거 | ✅ 완료 | DB 카테고리 직접 FK, 분류변경 대분류>소분류 트리 UI |
| 50 | 로그인 시 기기 등록 팝업 | ✅ 완료 | staff 로그인 직후 3상태 팝업(미등록/일치/불일치), 일치 3초 자동닫힘, 관리자 스킵 |
| 51 | 거래내역 분류 2줄 + 5필드 편집 + FK 정합성 | ✅ 완료 | 분류 셀 2줄(대분류 9px/소분류 11px), ✎편집 버튼 신설(날짜/내용/분류/입금/출금), category_id=대분류 고정 규칙 확립, 확인필요 수기입력 제거, tx_hash C안(원본 지문 보존) |
| 52 | 지출카테고리 2차 개편 (식자재 통합 + 주류 분리) | ✅ 완료 | **B+가 안**. 식자재 대분류 1개(composite) + 육류/야채/공산품 소분류 3개. 직구 개념 삭제(품목 기반). 주류 별도 대분류. vendor_orders + receipts 자동 합산. receipts.category_id=소분류 id 규칙. 거래처 재분류 도우미 UI. 마이그레이션 SQL+롤백 SQL 포함 |
| 53 | 매출/제외 카테고리 분리 (category_type) | ✅ 완료 | expense_categories.category_type 컬럼(expense/income/exclude) 추가. 관리 화면 상단 탭 3개. 리뷰 드롭다운 하드코딩 제거 → DB optgroup 동적. 집계 함수 category_type='expense' 필터. 매출/제외는 사장님이 UI에서 직접 추가 (하드코딩 금지 원칙) |
| 54 | "영수증 참조" 소분류 + 영수증 기반 집계 대체 | ✅ 완료 | 한 영수증에 식자재/비품 섞인 케이스 대응. 카드 거래는 식자재>영수증참조로 분류하고 지출 집계에서 제외, receipts에서 품목별 집계 → 이중 집계 방지. 거래내역 UI에 📸 배지 표시 |
| 55 | 카테고리 드래그 정렬 (SortableJS) | ✅ 완료 | ▲▼ 버튼 → ☰ 삼선 드래그 핸들, 모바일 터치 지원. sort_order 자동 저장. 편집 시 순서 유지 (기존에 편집하면 맨 뒤로 밀리던 버그 수정) |
| 56 | linked 카테고리 분리 (영수증참조 + 예비비) | ✅ 완료 | category_type에 'receipt_ref', 'reserve' 추가. 2개 대분류 INSERT(시스템 상수). 관리 탭은 기존 3개(지출/매출/제외) 유지. 리뷰 드롭다운 optgroup 5개. 예비비 선택 시 메모 입력 필드. 저장 시 reserve_fund_logs 자동 INSERT(source_tx_id 연결). exclude_from_settlement 자동 처리 |
| 57 | 거래내역 UI 전면 개편 + 분류 선택 바텀시트 | ✅ 완료 | 테이블: 4열(내용/대분류/소분류/금액) + 날짜 그룹 헤더(sticky) + 컬러 도트 + 금액 통합(+파랑/-빨강) + 행 탭→편집. 정렬 3단계 토글(오름→내림→해제). 필터 z-index/네비바 회피. 분류 선택 바텀시트: sheet-overlay 패턴, 3단계 드릴다운(타입→대분류→소분류), 영수증참조/예비비는 1단계 바로 선택, 예비비 메모 prompt. FK 보강: resolveCatPair '>' 분리. cat===sub UI 방어 |
| 58 | 매출 관리 페이지 (sales_daily 가로형 피벗 + 카드 UI) | ✅ 완료 (2026-04-23 재설계) | **v1 폐기 → v2 가로형으로 재작성**. 이전 `sales_records`(세로 raw)는 월 180행 쌓여 결산 비효율 + 모바일 짤림. 새 테이블 `sales_daily` (하루 1행, UNIQUE(store_id,date), 컬럼 7개: card/cash/cash_receipt/qr/etc/extra_large/extra_small). UI는 **카드형** — 각 일자 1장 카드(세로 스크롤, 짤림 없음), 월 합계 sticky 상단. 카드 탭 → 편집 시트(7개 결제수단 입력, 합계 자동 계산). 마감정산 저장 시 `syncClosingToSalesDaily` 1회 upsert (items.pos_card→card, cash_detail_cash→cash, pos_cash_receipt→cash_receipt, cash_detail_qr→qr, pos_etc+cash_detail_transfer→etc, extra_draw_*→extra_*). source 컬럼 보유(미래 API 대비). 2단계(동적 결제수단 추가/삭제, 대시보드 연계, 실제 API)는 추후. dev_lessons #45 "사용자 UX는 DB 스키마보다 강하다" 추가 |
| 59 | 결제수단 동적 관리 (Part F Phase 1+2) | ✅ Phase 1+2 완료 (2026-04-23/24) | **Phase 1 (4-23)**: `payment_methods` 테이블 + `sales_daily.amounts jsonb` 추가. seed 7개 + 백필. 사이드메뉴 → 💰 매출 관리 → "결제수단 관리" CRUD UI. 매출 관리 + 마감정산 sync 동적화. **Phase 2 (4-24)**: `loadDashboard`/`loadReconciliation` 동적화 — 신규 결제수단이 대시보드 매출 도넛/정산검수 매출 대조에도 자동 노출. method key=legacy_key 우선(기존 sales_recon_mapping 호환). DB 변경 없음. **Phase 3 예정**: sales_daily 레거시 7컬럼 DROP (1~2주 관찰 후) |
| 60 | 영수증 학습 버그 수정 + 기록 내역/편집 화면 | ✅ 완료 (2026-04-24) | **A. 학습 버그**: `saveReceipt`가 품목 전체("양파 10kg 2봉")를 keyword로 저장 → contains 매칭 실패. `normalizeItemKeyword()` 추가 — 첫 한글/영문 덩어리(2자↑) 추출(→"양파"). dev_lessons #49. **B. 기록 화면**: 영수증 탭에 서브탭(📸 새 영수증/📋 기록 내역) 추가. 기록 내역은 월 선택 + 날짜 그룹 카드 + 카드 탭→편집 시트(날짜/거래처/품목/금액/분류/정상↔오답/삭제). 분류는 `openCatPicker` 3단계 드릴다운 재사용. 저장 시 학습 규칙 자동 갱신. DB 변경 없음 |
| 61 | 사이드메뉴 재구성 + 거래처 대조 & 단가 | ✅ 완료 (2026-04-24) | **A. 사이드메뉴 통합**: "지출내역"→"지출 관리" + 고정비·거래처관리·급여집계를 지출 관리 하위로 편입. 그룹 9→6. **B. 거래처 매입 관리에 📊 대조 & 단가 서브탭 신설**. 거래처 장표(vendor_orders) ↔ 실 송금(mydata, 이름 매칭) 일별 대조 + 품목별 이번달/지난달 단가·총액 변화율. quantity 있으면 원/단위, 없으면 총액 기준 자동 분기. PostgREST or-filter에서 거래처명의 `,()` 제거한 safeName 사용. DB 변경 없음 |
| 62 | 수식 검수 → 예비비 잔고 정확화 + 정산검수 카드수수료 통일 | ✅ 완료 (2026-04-24) | 가상 시나리오로 전 화면 수식 검수. `calcReserveBalance`가 (매출−고정비)×5% 근사로 30~50% 과다 적립 → 실제 순이익(매출−vendor−receipt−att−fixed일할−royalty−cardFee) 기반으로 재작성. 소스도 settlements→sales_daily. 정산/검수 cardSales도 settlements→sales_daily. dev_lessons #50 ("소스 통일+공식 통일"). DB 변경 없음 |
| 63 | Phase 1-A1 신규 매장 가입 플로우 (개인 사업자 MVP) | ✅ 완료 (2026-04-24) — **SQL 실행 필요** | 출시 로드맵 Phase 1-A 첫 세션. Supabase Auth 도입. 로그인 오버레이에 "🏪 매장 시작하기" 버튼 + 6단계 가입 마법사(유형→이메일→비번→매장→사업자번호→약관). 주인 이메일+비번 로그인 + "비번 찾기". 가입 시 stores/employees/store_settings/카테고리7종/결제수단7종 자동 seed. 매장 고유 6자리 코드(store_code) 자동 발급. 약관 초안 템플릿 (법률 검토 플레이스홀더). DB 마이그레이션: auth_user_id/store_code/tos_accepted_at/business_no/invite_code/owner_user_id 추가. 한계: 다른 3종 유형은 Phase 1-A2, 기존 계정 업그레이드 UI 없음 |
| 64 | Phase 1-A2 프랜차이즈 본사/가맹점주 + 본사 홈 + 자연빵 흡수 | ✅ 완료 (2026-04-24) | 가입 유형 4종 전부 활성화(개인/다점포/본사/가맹점주). 본사 가입 시 `franchises` 생성 + 초대 코드(F-XXXXXX) 자동 발급 + 비활성 더미 매장. 가맹점주 가입 시 초대 코드 입력으로 franchise_id 자동 연결(비우면 혼자 시작). 신규 본사 홈(`franchiseHomeCont`): 브랜드명·초대코드·전체 매출·가맹점 순위 리스트·매장 전환 버튼·코드 복사. 로그인 후 franchise_admin 자동 라우팅. **자연빵 흡수**: 사이드메뉴 "🏯 본사 연결" 시트 → 코드 입력 → `stores.franchise_id` UPDATE (데이터 보존). `.franchise-admin-only` CSS 클래스 + applyPermissionUI 확장. DB 변경 없음. 한계: RLS 정책 추가 필요시 별도 SQL, 다점포 매장 추가 UI 미구현 |
| 65 | 마감정산 공란 가드 + 빨간 강조 | ✅ 완료 (2026-04-30) | 5월 매장 테스팅 진입 직전. 빈 입력칸 빨간 테두리 + 빨간 placeholder. 필수 8칸(전일이월·매출4·현금상세3) 빈 채로 저장 시 차단 + 알림 + 첫 빈 칸 자동 스크롤. 차감/금고/기타매출은 강조만(저장 통과). "⚡ 공란 0으로 채우기" 보조 버튼(직원 단축). 신규: refreshSettleEmptyHighlight, validateSettleInputs, fillEmptyWithZero. CSS .settle-item.empty + .v-input.empty. DB 변경 없음 |
| 66 | 사용자 편의성 Phase 1 (마감 중복 가드 + 차액 강조 + 출퇴근 토스트) | ✅ 완료 (2026-04-30) | **A. 마감 중복 저장 가드**: finishSettlement2 시작에 같은 매장+날짜 settlements SELECT → 있으면 저장된 매출/금고 보여주고 "덮어쓸까요?" confirm. **D. 차액 0원 강조**: 신규 refreshSaveButtonState(diff) + #settleGuide DOM. 차액=0 + 필수칸 채워짐 → 저장 버튼 초록 그라데이션 + ✅. 차액 있음 → 노란 가이드, 빈칸 → 빨간 가이드. **E. 출퇴근 즉시 피드백**: checkIn → "🌅 출근 완료! HH:MM" / checkOut → "👏 오늘 N시간 M분 일하셨어요 · 오늘 X원" (calcWageData 활용). DB 변경 없음. 남은 항목 B/C/F는 Phase 2 |
| 67 | 노무 제출용 엑셀 다운로드 3종 (근기법 §41/§42/§48) | ✅ 완료 (2026-04-30) | 첫 다운로드 기능. 근태 탭 헤더 "📥 노무제출" 버튼(관리자만) → 시트: 월 ◀▶ + 체크박스 3종(출퇴근부/임금대장⭐/근로자명부) + 다운로드. 1개 선택→단일 시트, 복수→1파일 다중 시트. 출퇴근부(§42): 일자×직원, 빈 날도 결근/휴무 행. 임금대장(§48 시행령 §27 16개 필수항목 + 합계행). 근로자명부(§41 시행령 §20). 가드: isManager + 직원 0명 토스트. 주민번호 마스킹(951010-1******). 신규 8개 함수(openLaborExportSheet, downloadLaborExport, build{Att,Pay,Emp}Sheet, maskRRN, fmtTime, moveLaborExportMonth). SheetJS 재사용. DB 변경 없음. 한계: 식대/주휴/공제 컬럼 빈 칸(DB 미관리), 결근/휴무 자동 구분 X |
| 68 | 출퇴근 기기 인식 오류 수정 (fingerprint 안정화) | ✅ 완료 (2026-05-04) | **현장 사고**: "기기 초기화해도 됐다가 또 오류" 무한 반복. **원인**: `getDeviceFingerprint`가 canvas + screen.width/height + userAgent + hardwareConcurrency 조합 해시 → 화면 회전·브라우저 자동 업데이트만 해도 해시 변동 → 차단. **해법**: localStorage `pd_device_id` UUID(crypto.randomUUID) 1순위 사용 → 환경 변동 영향 0. localStorage 차단 환경(시크릿)은 회전 무관(screen 정렬) + UA 버전 제거 fallback `FB-…`. 옛 `DF…` 형식 보유자는 첫 출근 시 자동 silent migration. 변경: getDeviceFingerprint 재작성, checkDeviceForAttendance 분기 추가, showDeviceStatusPopup DF 보유자 일치 표시. DB 변경 없음. 18개 가상 시나리오 통과(회전/브라우저 업데이트/도용/매장 폰 공유/관리자 초기화 흐름). dev_lessons #54 추가 |
| 69 | 근태 화면 통합 갈아엎기 — E·F·G안 (캘린더+간트, 탭 통합, 상태 변환 카드, 사후 등록 시트 이전) | ✅ 완료 (2026-05-12) | **E안**: 표 나열식 "전체 조회"를 폐기하고 월 캘린더 + 일별 간트(.gantt-* 재활용)로 갈아엎기. 직원 색점·일 합계·1인 모드 자동 변환. KPI 3분할(출근일/근무시간/인건비, `fmtMan` 10만↑ 만 단위 압축). **F안**: "내 기록"+"전체 조회" 두 서브탭 → 단일 "📋 근무 기록". 직원 필터를 시점 스위치로 활용(전체/1인/본인 자동 변환). staff 자동 본인 필터 잠금. 본인 모드일 때만 주간 간트(myAttGantt) 노출. attListMonth/attListData/attMonSummary 잔재 제거. **G안**: 출퇴근 탭 = 상태 변환 카드(.before 회색 / .during 연파랑 / .after 연초록). 인라인 "수동 입력 (관리자)" 섹션 폐기, 사후 등록은 `#attManualSheet`으로 이전 (vEmpName/vDate/vStart/vEnd/vRest 시트로 통합). 📋 근무 기록 캘린더 빈 셀에 "+" (관리자만) → `openAttManualSheet|date|empId?`. 일별 상세 헤더 "+ 직원"/"+ 출퇴근 등록"(관리자), staff엔 안내 텍스트. 캡스 서브탭 manager-only 제거 + display:none !important 유지(코드 살림). **부가 픽스**: 시트 안에서 다른 시트 띄울 때 closeAllSheets→closeSheet(id) (selectEmpFromSheet/confirmDate/confirmTime). 카드 타이틀 "근태 기록"→"근태". 서브탭 짝꿍 통일 "📋 근무 기록"/"📅 근무 계획". DB 변경 없음. PR #27/#28/#29 머지. dev_lessons #66/#67/#68 추가 |

---

## 2. 정산/검수 시스템

### 대조 대상 (9개 항목)
| # | 항목 | 기록 소스 | 실제 소스 |
|---|------|----------|-----------|
| 1 | 거래처 매입 | vendor_orders (거래처별 소계) | mydata_transactions |
| 2 | 인건비(급여) | attendance_logs.calculated_wage | mydata_transactions (귀속월 기준) |
| 3 | 인건비(수당) | special_wages.extra_amount | mydata_transactions |
| 4 | 고정비 | fixed_cost_amounts (항목별) | mydata_transactions |
| 5 | 소모품/비품 | receipts | mydata_transactions |
| 6 | 로열티 | 매출 × royalty_rate | mydata_transactions |
| 7 | 카드수수료 | 카드매출 × card_fee_rate | mydata_transactions |
| 8 | 수동 카테고리 | expense_category_amounts | mydata_transactions |
| 9 | 기타/미분류 | — | mydata_transactions 미매칭 건 |

### FK 설계
- `reconciliation.category_id` → `expense_categories.id`
- `mydata_transactions.category_id` → `expense_categories.id`

---

## 3. 엑셀 업로드 시스템

### 업로드 흐름
```
파일 선택 (xlsx, xls, csv)
  → parseExcelFile (SheetJS 파싱)
  → matchColumns (헤더 키워드 자동 매칭)
  → classifyByKeyword (적요/내용으로 카테고리 분류 + 귀속월 추출)
  → renderExcelPreview (미리보기)
  → saveExcelBatch (category_id FK 매칭 → mydata_transactions 저장)
```

### 호환 현황
- **은행 13개사**: 신한/KB/NH/우리/하나/카카오/토스/IBK/SC/새마을/수협/신협/대구
- **카드 8개사**: 신한/삼성/현대/KB/롯데/하나/BC/NH

### 특수 처리
1. 중복 방지: tx_hash (날짜+시간+금액+내용 해시)
2. 취소/환불: is_cancelled, original_amount
3. 정산 제외: 카드대금, 배당금, 개인결제
4. 귀속월: "급여03월" → attribution_month='2026-03'
5. 카테고리 매핑: → `business_rules.md` 참조

---

## 4. 가마감 / 진마감

> 상세 규칙 → `business_rules.md` 참조

- **가마감**: 발생기준(예측). 기록 소스 (attendance, vendor_orders 등)
- **진마감**: 출금기준(확정). mydata_transactions 실제 출금
- 대시보드 상단 토글로 전환

---

## 5. 미구현 기능

### 5-1. 공과금 미납 알림
- fixed_costs에 expected_day, tolerance_days 필드 있음
- 매 정산/검수 로드 시: mydata에서 매칭 출금 검색
- 예정일 + 유예일수 경과 + 출금 없음 → "미납 의심"

### 5-2. 거래처 차액 추적
- vendor_orders 월 합계 vs mydata 거래처 출금 비교
- 차액 → vendor_diffs 기록, 다음 달 상계 시 resolved

### 5-3. 월 귀속 판단 고도화
현재: "XX월" 패턴만 추출. 목표:
```
1차: 내용에 월 정보 + 금액 정상 범위 → 자동 귀속
2차: 고정비 + 예정일 기반 → 전월분 제안
3차: 거래처 월정산 + 금액 대조
4차: 해당 없음 → 출금월 = 귀속월
```

### 5-4. Codef API 연동
- Sandbox 사용 가능 (3개월 무료, 일 100건)
- 실서비스: 유료 구독 필요 (견적 답변 대기)

### 5-5. 지출카테고리 2차 개편 (식자재 대분류 통합)
**논의·설계 단계** (2026-04-21) — 새 세션에서 진행 예정.
- 현 구조: `식자재(거래처)/식자재(직구)/식자재(주류)` 구매경로별 분리
- 목표 구조: `식자재` 대분류 하나 + `육류/야채/공산품` 소분류
- FK 영향 6군데 점검 필요 (상세: work_log.md "지출카테고리 2차 개편" 항목)
- 단계 옵션: 1단계 소형(vendors 확장 + 도우미) / 2단계 대형(풀패키지) / 하이브리드(추천)
- 주류 위치 미결 (별도 대분류 vs 식자재 소분류)

---

## 6. UI 참조 앱

| 앱 | 참조 포인트 |
|---|---|
| **토스** | 거래내역 리스트, 깔끔한 카드 UI, 컬러 체계 |
| **Clobe** | 데이터 테이블 UI, 필터/정렬 UX, 전체적 디자인 감각 (https://clobe.ai/) |

---

## 7. Supabase 테이블 목록

> 상세 스키마 → `db_schema.md` 참조

기존 17개 + 추가 4개 = 21개
