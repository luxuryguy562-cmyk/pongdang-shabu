-- ============================================================
-- Phase 2b 롤백: RLS 비활성화 복원 (2026-04-17)
-- 실행 조건: 골든패스 테스트 실패 or 장애 발생 시
-- 실행: Supabase Dashboard → SQL Editor
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.store_settings;
ALTER TABLE public.store_settings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.employees;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.roles;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.attendance_logs;
ALTER TABLE public.attendance_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.caps_upload_staging;
ALTER TABLE public.caps_upload_staging DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.work_schedules;
ALTER TABLE public.work_schedules DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.daily_sales;
ALTER TABLE public.daily_sales DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.receipts;
ALTER TABLE public.receipts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.settlements;
ALTER TABLE public.settlements DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.vendors;
ALTER TABLE public.vendors DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.vendor_orders;
ALTER TABLE public.vendor_orders DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.expense_categories;
ALTER TABLE public.expense_categories DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.expense_category_amounts;
ALTER TABLE public.expense_category_amounts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.fixed_costs;
ALTER TABLE public.fixed_costs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.fixed_cost_amounts;
ALTER TABLE public.fixed_cost_amounts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.special_wages;
ALTER TABLE public.special_wages DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.mydata_accounts;
ALTER TABLE public.mydata_accounts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.mydata_transactions;
ALTER TABLE public.mydata_transactions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.reconciliation;
ALTER TABLE public.reconciliation DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.reserve_fund_logs;
ALTER TABLE public.reserve_fund_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.classification_rules;
ALTER TABLE public.classification_rules DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_phase2b_all" ON public.vendor_diffs;
ALTER TABLE public.vendor_diffs DISABLE ROW LEVEL SECURITY;

COMMIT;

-- 검증 쿼리 (롤백 후 확인용)
SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname='public' AND tablename IN (
    'store_settings','employees','roles','attendance_logs',
    'caps_upload_staging','work_schedules','daily_sales','receipts',
    'settlements','vendors','vendor_orders','expense_categories',
    'expense_category_amounts','fixed_costs','fixed_cost_amounts',
    'special_wages','mydata_accounts','mydata_transactions',
    'reconciliation','reserve_fund_logs','classification_rules','vendor_diffs'
  ) ORDER BY tablename;
-- 기대: rowsecurity = false 22건
