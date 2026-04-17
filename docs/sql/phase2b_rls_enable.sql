-- ============================================================
-- Phase 2b: RLS 1차 활성화 (2026-04-17)
-- 정책: USING(true) + WITH CHECK(store_id IS NOT NULL)
-- 전제: 코드 레이어 store_id 필터 선행 완료 (Phase 2a, 커밋 f5fc304)
-- 실행: Supabase Dashboard → SQL Editor
-- 목적: 코드 레이어 필터 + DB 레이어 RLS 2중 방어망 구축
--       1차는 느슨(USING true), 2차(Phase 2c 이후) Worker 프록시 + auth.uid 기반 엄격화
-- ============================================================

BEGIN;

-- 1. store_settings
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.store_settings
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 2. employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.employees
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 3. roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.roles
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 4. attendance_logs
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.attendance_logs
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 5. caps_upload_staging
ALTER TABLE public.caps_upload_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.caps_upload_staging
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 6. work_schedules
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.work_schedules
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 7. daily_sales
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.daily_sales
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 8. receipts
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.receipts
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 9. settlements
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.settlements
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 10. vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.vendors
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 11. vendor_orders
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.vendor_orders
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 12. expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.expense_categories
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 13. expense_category_amounts
ALTER TABLE public.expense_category_amounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.expense_category_amounts
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 14. fixed_costs
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.fixed_costs
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 15. fixed_cost_amounts
ALTER TABLE public.fixed_cost_amounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.fixed_cost_amounts
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 16. special_wages
ALTER TABLE public.special_wages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.special_wages
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 17. mydata_accounts
ALTER TABLE public.mydata_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.mydata_accounts
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 18. mydata_transactions
ALTER TABLE public.mydata_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.mydata_transactions
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 19. reconciliation
ALTER TABLE public.reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.reconciliation
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 20. reserve_fund_logs
ALTER TABLE public.reserve_fund_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.reserve_fund_logs
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 21. classification_rules
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.classification_rules
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

-- 22. vendor_diffs
ALTER TABLE public.vendor_diffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_phase2b_all" ON public.vendor_diffs
  FOR ALL TO public
  USING (true) WITH CHECK (store_id IS NOT NULL);

COMMIT;

-- 검증 쿼리 (실행 후 확인용)
SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname='public' AND tablename IN (
    'store_settings','employees','roles','attendance_logs',
    'caps_upload_staging','work_schedules','daily_sales','receipts',
    'settlements','vendors','vendor_orders','expense_categories',
    'expense_category_amounts','fixed_costs','fixed_cost_amounts',
    'special_wages','mydata_accounts','mydata_transactions',
    'reconciliation','reserve_fund_logs','classification_rules','vendor_diffs'
  ) ORDER BY tablename;
-- 기대: rowsecurity = true 22건
