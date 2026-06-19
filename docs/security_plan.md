# 🔐 보안(매장 간 데이터 격리) 실행 계획 — 실측 기반

> 작성 2026-06-19. 서울 DB(`ecfjkfqlnqfxovlwhdtx`) 실측 + 코드 grep + emp-login 소스 확인 후 작성.
> 이전 세션이 "계획 박았다" 했으나 실제 미저장 → 이 문서가 진짜 1번째 실측 계획.
> ⚠️ DB 잠금(RLS) 변경은 전부 헌법 8-A: 사장님 "실행 승인" 4글자 필수.

---

## 1. 실측 진단 (2026-06-19, 추측 아님)

### 1-1. RLS(매장 격리 잠금) 현황
| 상태 | 표 | 의미 |
|---|---|---|
| 🔴 RLS 아예 꺼짐 (ERROR) | stores, franchises, accuracy_lab_logs, ai_usage_logs, coupang_inbox/debug/global_hints/learning_rules/(8개) | 잠금 0 |
| 🟡 RLS 켜짐 + 정책 `USING(true)` (WARN) | attendance_logs, receipts, sales_daily, settlements, vendors, vendor_orders, employees, fixed_costs, store_settings, mydata_transactions 등 운영 표 대부분 | 읽기 전부 개방 = 남 매장 데이터 다 보임 |
| 🟢 RLS 켜짐 + 정책 0 (anon 차단됨) | employee_private, emp_sessions, otp_codes, persons, signup_tokens, store_join_codes, pending_joins, exp_groups/items/item_amounts | 민감 금고는 이미 잠김(굿). exp_* 는 anon 접근 불가(앱이 service_role로 쓰는지 확인 필요) |

### 1-2. 근본 원인 (왜 표 몇 개만 못 잠그나)
- 앱(브라우저)이 **공개 열쇠(anon key) 하나로 거의 모든 표를 직접** 읽고 쓴다 (`grep .from` 결과: 33개 표 접근).
- anon 요청에는 **"누가/어느 매장인지" 신분(identity)이 없다** → RLS가 매장으로 거를 수가 없다.
- 그래서 옛 작업이 `USING(true)`(=무조건 통과)로 풀어둔 것. 안 풀면 앱이 안 돌아가서.
- emp-login은 로그인 증표로 **랜덤 토큰**(JWT 아님)만 발급 → DB 접근엔 안 쓰임(자동로그인 복원용).

### 1-3. 결론
**"표 몇 개 살짝 잠그기"는 불가능.** 어느 표를 잠가도 anon으로 읽던 앱이 깨진다.
진짜 격리 = **앱 요청에 매장 신분(증표)을 실어 보내고, RLS가 그 증표의 store_id만 보여주게** 하는 구조 변경(대형).

---

## 2. 위험도 (사장님 판단용)
- **현재 사장님 매장 운영**: 정상. 데이터 안 샘(앱은 자기 store_id로만 필터).
- **실제 위험**: 기술 아는 사람이 anon key로 직접 쿼리 짜면 **남 매장 데이터 읽기/쓰기 가능**. 멀티매장(SaaS) 판매 시 치명적.
- **민감 금고(PIN·계좌·주민번호)**: 이미 잠겨 있음(employee_private RLS 정책 0). 이건 안전.

---

## 3. 실행 계획 (단계별 — 각 단계 되돌리기 가능)

> 핵심 안전 원칙: **앱이 증표를 먼저 실어보내게 만든 뒤에야** DB 잠금을 조인다. 순서 거꾸로 하면 라이브 즉시 다운.

### 단계 A — 증표(JWT) 발급 (서버, 라이브 영향 0)
- emp-login / emp-session 이 store_id·employee_id 담은 **서명 토큰(JWT)** 추가 발급.
- 앱은 아직 안 씀 → 라이브 변화 0. (헌법 8-A 🔴 Edge 배포 = 실행 승인 필요)
- ⚠️ 신규 키 시스템(`sb_publishable_…`)이라 JWT 서명키 확보 방식 먼저 확인.

### 단계 B — 앱이 증표 부착 (앱, 라이브 테스트 필요)
- 브라우저 supabase 클라이언트가 모든 요청에 그 JWT를 붙임.
- 이 시점 정책은 아직 `USING(true)` → **아무것도 안 깨짐** (안전 확인 구간).
- ⚠️ **사장님 실기기 테스트 필수** (CTO가 PWA 로그인 못 함 — 전 탭 작동 확인은 사장님).

### 단계 C — DB 잠금 조이기 (DB, SQL 시뮬레이션 검증 가능)
- `USING(true)` → `store_id = (증표의 store_id)` 로 표마다 교체.
- 격리 검증: SQL로 "매장A 증표가 매장B 행 못 봄" 시뮬레이션(여기서 가능).
- RLS 꺼진 8개 표도 같은 정책으로 켬.
- 각 표 롤백 SQL 보관. (헌법 8-A 🔴 = 실행 승인)

### 대안(더 작게) — 쓰기만 우선 보호
- 전체 격리 부담되면: 위험한 **쓰기**(급여·정산·직원)만 Edge Function 경유 권한검사로 먼저 잠금. 읽기 격리는 나중.
- 장점: 작고 빠름. 단점: 남 매장 **읽기**는 여전히 가능.

---

## 4. CTO 추천
1순위: **단계 A → B → C 전체 격리** (SaaS 판매 전제. 비전 3번).
단, B·C 사이는 사장님 실기기 테스트가 끼는 집중 작업. 한 번에 몰아치지 말고 단계마다 "됐고 안 깨짐" 확인 후 다음.

## 5. 환경 제약 (정직)
- 여기서 **가능**: DB 진단·RLS 정책 작성·SQL 격리 시뮬레이션 검증·Edge 소스 작성/배포.
- 여기서 **불가**: 라이브 PWA(사장님 폰/앱) 로그인 후 전 탭 클릭 검증 → **사장님 손 필요한 유일 구간**.

---

## 6. ✅ 확정 설계 (2026-06-19 실측 검증 — 사장님 "다 잠가" 승인)

### 6-0. 진행 현황
- ✅ **A단계 완료·배포·검증 (2026-06-19)**: emp-login/emp-session 버전5 배포(verify_jwt=false 유지). 임시직원 실로그인 테스트 → 신분증(JWT) 안에 `role=authenticated` + `app_metadata.store_id` 정확히 박힘 확인 + 그 신분증으로 REST 200(인증통과) 확인. 테스트 직원/유저 전부 삭제 완료. **라이브 무변화**(앱은 아직 session 미사용).
- ⏭️ **다음 = B단계**: 앱(common.js)이 받은 session을 `sb.auth.setSession()`으로 부착. 정책은 아직 USING(true)라 안 깨짐. **사장님 폰 전탭 테스트 필요**.
- ⏳ **그 다음 = C단계**: 6-3-A 함정(로그인 전 매장/직원 읽기) 먼저 해결 후 RLS 표별 격리.

### 6-1. 검증된 사실
- JWT 비밀키(secret)는 코드로 **못 읽음** (GUC false, vault 없음, pgsodium 없음) → 직접 서명 방식 불가.
- 그러나 **Supabase Auth(자체 로그인) 살아있음** (`auth.users` 존재, `auth.jwt()` 함수 있음) → **Supabase(GoTrue)가 신분증 서명** → 비밀키 불필요, 사장님 손 0.
- RLS 표현식 실측 통과: `current_setting('request.jwt.claims',true)::json->'app_metadata'->>'store_id'` 로 매장ID 정확 추출 + 매칭 `true` 확인.

### 6-2. 확정 구조 = "Supabase Auth 신분증 + app_metadata 매장도장"
1. **emp-login**: PIN 검증(기존) 후 → 그 직원용 Supabase Auth 유저 확보(없으면 생성), `app_metadata.store_id` 도장 → **Supabase 세션(서명된 신분증) 발급** → 앱에 반환. (랜덤 토큰도 기존대로 병행 유지)
2. **앱(common.js 등)**: 받은 세션을 `sb.auth.setSession()` 로 부착 → 모든 요청이 신분증 지님. 이 시점 정책은 아직 `USING(true)` → **안 깨짐**(안전 확인 구간).
3. **RLS**: 표마다 `USING(true)` → `store_id::text = (auth.jwt()->'app_metadata'->>'store_id')` 로 교체. RLS 꺼진 8표도 동일 정책으로 켬.

### 6-3. 단계별 실행 + 게이트
| 단계 | 내용 | 라이브 위험 | 검증 | 게이트 |
|---|---|---|---|---|
| A | emp-login/session 신분증 발급 추가 | 0 (앱 미사용) | 함수 호출 테스트 | 🔴 Edge 배포 = "실행 승인" |
| B | 앱이 신분증 부착(setSession) | 낮음(정책 아직 USING(true)) | **사장님 폰 로그인+전탭** | 사장님 테스트 |
| C | RLS 표마다 매장격리로 교체 | 중(부착 확인 후만) | SQL 격리 시뮬 + 사장님 폰 | 🔴 표별 "실행 승인" + 롤백SQL |

### 6-3-A. ⚠️ 발견된 함정 (C단계에서 반드시 처리)
- **로그인 전 읽기**: 로그인 화면은 신분증 받기 *전에* `stores`(매장 고르기)·`employees`(이름 고르기)를 anon으로 읽음. 이 둘을 통째로 잠그면 **로그인 화면이 깨짐**.
  → 해결: 매장·직원의 **로그인용 최소 정보(id·name·store_id·is_active)** 만 공개로 읽는 좁은 경로(Edge Function `list-stores`/`list-employees` 또는 컬럼 제한 뷰) 신설. 나머지 컬럼·표는 전부 잠금.
- **사장(owner) 로그인 경로**도 동일하게 store_id 도장 받아야 함(자기 매장 전체 접근).
- caps_upload_staging 등 store_id 컬럼 유무 표별 확인 필요(격리 정책 적용 가능 여부).

### 6-4. 불변 보장 (사장님 약속)
- 잠근 뒤에도 **클로드코드(관리자 통로=service_role)는 RLS 무시하고 다 봄·다 고침** → 자동 유지보수 그대로.
- 민감 금고(employee_private 등)는 이미 잠김 → 그대로.
- 순서 A→B→C 고정. 거꾸로 가면 라이브 다운 → 절대 금지.
