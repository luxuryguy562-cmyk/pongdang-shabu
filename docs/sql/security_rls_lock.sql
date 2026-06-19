-- ════════════════════════════════════════════════════════════
-- 매장 격리 잠금 (보안 C단계) — 2026-06-19 준비
-- ⚠️ 적용 전 필수 선행조건 (안 지키면 라이브 다운):
--   1) 앱 신분증(B단계: setSession + login-meta)이 본가(main)에 반영 + 사장님 폰 정상 확인
--   2) 신규 매장 가입(owner-signup) 서버 경유로 전환 (안 하면 새 손님 가입 깨짐 — 우리 매장 일상은 무관)
--   3) 적용 직후 사장님 폰에서 전 탭 확인 (깨지면 아래 rollback 즉시 실행)
-- 원리: 신분증(JWT) app_metadata.store_id 와 행의 store_id 가 같을 때만 접근 허용.
--       service_role(클로드코드 관리자 통로)는 RLS 무시 → 자동 유지보수 그대로.
-- ════════════════════════════════════════════════════════════

-- store_id 컬럼 있는 표: 기존 허용정책 전부 제거 → 매장 격리 정책으로 교체
DO $$
DECLARE t text; pol text;
DECLARE store_tables text[] := ARRAY[
  'attendance_logs','caps_upload_staging','classification_rules','daily_opening','daily_sales',
  'employees','expense_categories','expense_category_amounts','extra_revenue_items','extra_revenue_logs',
  'fixed_cost_amounts','fixed_costs','mydata_accounts','mydata_transactions','payment_methods',
  'receipts','reconciliation','reserve_fund_logs','roles','sales_daily','schedule_change_requests',
  'settlements','special_wages','store_settings','vendor_diffs','vendor_orders','vendors','work_schedules',
  'accuracy_lab_logs','ai_usage_logs','coupang_debug','coupang_inbox','coupang_learning_rules'
];
BEGIN
  FOREACH t IN ARRAY store_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY store_isolation ON public.%I FOR ALL'
      || ' USING (store_id::text = (auth.jwt() -> ''app_metadata'' ->> ''store_id''))'
      || ' WITH CHECK (store_id::text = (auth.jwt() -> ''app_metadata'' ->> ''store_id''))', t);
  END LOOP;
END $$;

-- stores: 자기 매장 행만 (로그인 전 매장 고르기는 login-meta 공개함수가 담당)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_self ON public.stores;
CREATE POLICY store_self ON public.stores FOR ALL
  USING (id::text = (auth.jwt() -> 'app_metadata' ->> 'store_id'))
  WITH CHECK (id::text = (auth.jwt() -> 'app_metadata' ->> 'store_id'));

-- franchises: 브랜드명(비민감). 로그인 사용자 읽기 허용, 쓰기는 막힘
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS franchise_read ON public.franchises;
CREATE POLICY franchise_read ON public.franchises FOR SELECT TO authenticated USING (true);

-- coupang_global_hints: 전체 공유 학습데이터(비민감). 로그인 사용자 읽기 허용
ALTER TABLE public.coupang_global_hints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cgh_read ON public.coupang_global_hints;
CREATE POLICY cgh_read ON public.coupang_global_hints FOR SELECT TO authenticated USING (true);

-- (이미 잠긴 표는 손 안 댐: emp_sessions/employee_private/otp_codes/persons/signup_tokens/
--  store_join_codes/pending_joins/exp_groups/exp_items/exp_item_amounts — 프론트 미사용, 서버 경유)
