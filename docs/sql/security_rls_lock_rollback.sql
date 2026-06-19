-- ════════════════════════════════════════════════════════════
-- 매장 격리 잠금 되돌리기 (보안 C단계 ROLLBACK) — 2026-06-19 준비
-- 잠금 후 화면이 깨지면 이 SQL로 즉시 원복 (USING(true) 허용 상태로 복귀).
-- ════════════════════════════════════════════════════════════

-- store_id 표: 격리정책 제거 → 옛 허용정책(USING true) 복구
DO $$
DECLARE t text;
DECLARE store_tables text[] := ARRAY[
  'attendance_logs','caps_upload_staging','classification_rules','daily_opening','daily_sales',
  'employees','expense_categories','expense_category_amounts','extra_revenue_items','extra_revenue_logs',
  'fixed_cost_amounts','fixed_costs','mydata_accounts','mydata_transactions','payment_methods',
  'receipts','reconciliation','reserve_fund_logs','roles','sales_daily','schedule_change_requests',
  'settlements','special_wages','store_settings','vendor_diffs','vendor_orders','vendors','work_schedules'
];
BEGIN
  FOREACH t IN ARRAY store_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS store_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY pd_phase2b_all ON public.%I FOR ALL'
      || ' USING (true) WITH CHECK (store_id IS NOT NULL)', t);
  END LOOP;
END $$;

-- 원래 RLS 꺼져 있던 표: 격리정책 제거 + RLS 끔 (옛 상태)
DO $$
DECLARE t text;
DECLARE off_tables text[] := ARRAY[
  'accuracy_lab_logs','ai_usage_logs','coupang_debug','coupang_inbox','coupang_learning_rules',
  'stores','franchises','coupang_global_hints'
];
BEGIN
  FOREACH t IN ARRAY off_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS store_isolation ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS store_self ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS franchise_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cgh_read ON public.%I', t);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
