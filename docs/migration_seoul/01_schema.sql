-- ============================================================
-- 시드니(ruytgygjwnbtzmtofopg) → 서울(ecfjkfqlnqfxovlwhdtx) 스키마 이전
-- 2026-06-17 생성. 백업표 13개 제외, 운영 41 + 쿠팡 4 = 45표.
-- apply_migration 한 트랜잭션으로 실행 (전부 성공 / 전부 롤백).
-- ============================================================

-- ── 1. 확장 ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 검색경로에 extensions 포함 (uuid_generate_v4 등 해석용)
SET search_path = public, extensions;

-- ── 2. 시퀀스(자동번호) ──
CREATE SEQUENCE IF NOT EXISTS public.daily_opening_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.caps_upload_staging_id_seq;

-- ── 3. 테이블 (45개, 컬럼만) ──
CREATE TABLE IF NOT EXISTS public.accuracy_lab_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  vendor text,
  receipt_date text,
  engine text,
  ai_raw jsonb,
  corrected jsonb,
  score_overall integer,
  score_sum boolean,
  score_qty text,
  score_name text,
  cost_won numeric,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  feature text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  thinking_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_won numeric(10,4) NOT NULL DEFAULT 0,
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_msg text,
  called_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  employee_id uuid,
  work_date date DEFAULT CURRENT_DATE,
  app_in timestamp with time zone,
  app_out timestamp with time zone,
  caps_in timestamp with time zone,
  caps_out timestamp with time zone,
  caps_in_raw timestamp with time zone[],
  caps_out_raw timestamp with time zone[],
  caps_out_source text,
  rest_min integer DEFAULT 0,
  total_work_min integer,
  night_min integer DEFAULT 0,
  weekend_flag boolean,
  calculated_wage integer,
  caps_match_status text DEFAULT '앱전용'::text,
  time_diff_min integer,
  is_confirmed boolean DEFAULT false,
  memo text,
  created_at timestamp with time zone DEFAULT now(),
  check_in_ip character varying(50),
  check_out_ip character varying(50)
);
CREATE TABLE IF NOT EXISTS public.caps_upload_staging (
  id integer NOT NULL DEFAULT nextval('caps_upload_staging_id_seq'::regclass),
  store_id uuid,
  uploaded_at timestamp with time zone DEFAULT now(),
  raw_name text,
  raw_caps_id text,
  raw_date date,
  raw_time time without time zone,
  raw_mode text,
  raw_auth_result text,
  is_valid_auth boolean,
  matched_employee_id uuid,
  match_status text DEFAULT '미매칭'::text,
  dedup_status text DEFAULT '정상'::text,
  processed boolean DEFAULT false,
  reviewer_memo text
);
CREATE TABLE IF NOT EXISTS public.classification_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  keyword text NOT NULL,
  match_type text DEFAULT 'contains'::text,
  tx_type text DEFAULT 'both'::text,
  category text NOT NULL,
  sub_category text DEFAULT ''::text,
  exclude_from_settlement boolean DEFAULT false,
  priority integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  display_item text
);
CREATE TABLE IF NOT EXISTS public.coupang_debug (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.coupang_global_hints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_item_id text NOT NULL,
  category_name text NOT NULL,
  vote_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.coupang_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  vendor_id uuid,
  external_order_id text NOT NULL,
  order_date date NOT NULL,
  item text NOT NULL,
  amount integer NOT NULL,
  unit_price integer,
  quantity numeric,
  raw_json jsonb,
  ai_suggested_category_id uuid,
  ai_confidence numeric,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text
);
CREATE TABLE IF NOT EXISTS public.coupang_learning_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  vendor_item_id text,
  keyword text,
  category_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'auto'::text,
  match_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  item text
);
CREATE TABLE IF NOT EXISTS public.daily_opening (
  id bigint NOT NULL DEFAULT nextval('daily_opening_id_seq'::regclass),
  store_id uuid NOT NULL,
  opening_date date NOT NULL,
  vault_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_total integer NOT NULL DEFAULT 0,
  previous_close_total integer NOT NULL DEFAULT 0,
  diff_amount integer GENERATED ALWAYS AS (actual_total - previous_close_total) STORED,
  memo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE TABLE IF NOT EXISTS public.daily_sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  sale_date date NOT NULL,
  total_sales bigint DEFAULT 0,
  card_sales bigint DEFAULT 0,
  cash_sales bigint DEFAULT 0,
  raw_data jsonb,
  source text DEFAULT 'manual'::text,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.emp_sessions (
  token text NOT NULL,
  employee_id uuid NOT NULL,
  store_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public.employee_private (
  employee_id uuid NOT NULL,
  store_id uuid NOT NULL,
  pin character varying,
  id_number text,
  bank_name text,
  account_number text,
  phone text,
  address text,
  birth_date date,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  auth_user_id uuid,
  login_id text,
  name text NOT NULL,
  birth_date date,
  phone text,
  address text,
  bank_name text,
  account_number text,
  caps_id text,
  role text,
  base_wage integer DEFAULT 10030,
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT true,
  is_manager boolean DEFAULT false,
  hire_date date,
  resign_date date,
  created_at timestamp with time zone DEFAULT now(),
  pin character varying(10),
  auth_level text DEFAULT 'staff'::text,
  device_fingerprint text,
  id_number text,
  is_foreign boolean DEFAULT false,
  report_status text DEFAULT '미신고'::text,
  visa_type text,
  visa_expires_at date,
  doc_contract text,
  doc_health_cert text,
  doc_health_expires date,
  doc_minor_consent text,
  doc_foreigner_id text,
  wage_type text DEFAULT 'hourly'::text,
  monthly_wage integer,
  person_id uuid
);
CREATE TABLE IF NOT EXISTS public.exp_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  name text NOT NULL,
  color text DEFAULT '#0050FF'::text,
  sort_order integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  source_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.exp_item_amounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid,
  store_id uuid,
  year_month text NOT NULL,
  amount bigint DEFAULT 0,
  memo text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.exp_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid,
  store_id uuid,
  name text NOT NULL,
  filter_key text,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  name text NOT NULL,
  data_source text NOT NULL,
  color text DEFAULT '#0050FF'::text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  vendor_category text,
  parent_id uuid,
  category_type text DEFAULT 'expense'::text
);
CREATE TABLE IF NOT EXISTS public.expense_category_amounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category_id uuid,
  store_id uuid,
  year_month text NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  memo text
);
CREATE TABLE IF NOT EXISTS public.extra_revenue_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '🎰'::text,
  color text DEFAULT '#7C3AED'::text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  legacy_key text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.extra_revenue_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  item_id uuid NOT NULL,
  log_date date NOT NULL,
  amount integer NOT NULL,
  settlement_id uuid,
  memo text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fixed_cost_amounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  fixed_cost_id uuid,
  store_id uuid,
  year_month text NOT NULL,
  amount integer NOT NULL,
  estimated_amount integer DEFAULT 0,
  is_confirmed boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  name text NOT NULL,
  category text DEFAULT '고정비'::text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  is_variable boolean DEFAULT false,
  expected_day integer,
  tolerance_days integer DEFAULT 3,
  estimated_monthly integer DEFAULT 0,
  is_auto_pay boolean DEFAULT true,
  vat_included boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.franchises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  invite_code text,
  owner_user_id uuid
);
CREATE TABLE IF NOT EXISTS public.mydata_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  account_type text NOT NULL,
  institution_code text,
  institution_name text,
  account_number text,
  account_alias text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mydata_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  account_id uuid,
  tx_type text NOT NULL,
  tx_date text NOT NULL,
  tx_time text,
  description text,
  merchant_name text,
  amount integer DEFAULT 0,
  balance integer,
  source text DEFAULT 'manual'::text,
  sub_category text,
  confidence text DEFAULT 'high'::text,
  needs_review boolean DEFAULT false,
  review_reason text,
  exclude_from_settlement boolean DEFAULT false,
  attribution_month text,
  supply_amount integer,
  vat_amount integer,
  raw_description text,
  upload_batch_id text,
  tx_hash text,
  is_cancelled boolean DEFAULT false,
  original_amount integer,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  category text,
  category_id uuid
);
CREATE TABLE IF NOT EXISTS public.otp_codes (
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  color text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  legacy_key text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pending_joins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  store_id uuid NOT NULL,
  join_code_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.persons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  pin text
);
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  receipt_date date,
  vendor text,
  item text,
  total_price integer,
  category text,
  note text DEFAULT '정상'::text,
  category_id uuid,
  vendor_id uuid,
  input_method text,
  receipt_group_id uuid,
  unit_price integer,
  qty numeric(10,2),
  supply_price integer,
  tax_amount integer,
  is_tax_free boolean,
  spec text,
  origin text,
  seq integer,
  is_deposit boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.reconciliation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  year_month text NOT NULL,
  category_id uuid,
  sub_key text NOT NULL,
  sub_label text,
  recorded_total integer DEFAULT 0,
  actual_total integer DEFAULT 0,
  diff_amount integer DEFAULT 0,
  status text DEFAULT 'pending'::text,
  memo text,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reserve_fund_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  log_date date NOT NULL,
  year_month text NOT NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  memo text,
  created_at timestamp with time zone DEFAULT now(),
  source_tx_id uuid
);
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  name text NOT NULL,
  level integer DEFAULT 9,
  is_manager_role boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.sales_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  date date NOT NULL,
  card numeric NOT NULL DEFAULT 0,
  cash numeric NOT NULL DEFAULT 0,
  cash_receipt numeric NOT NULL DEFAULT 0,
  qr numeric NOT NULL DEFAULT 0,
  etc numeric NOT NULL DEFAULT 0,
  extra_large numeric NOT NULL DEFAULT 0,
  extra_small numeric NOT NULL DEFAULT 0,
  memo text,
  source text NOT NULL DEFAULT 'manual'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  amounts jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  settle_date date,
  created_at timestamp with time zone DEFAULT now(),
  items_json jsonb,
  vault_json jsonb,
  actual_total integer,
  expected_total integer,
  diff_amount integer,
  diff_status text,
  sales_total integer DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.signup_tokens (
  token text NOT NULL,
  person_id uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.special_wages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  target_date date NOT NULL,
  extra_amount integer NOT NULL,
  memo text
);
CREATE TABLE IF NOT EXISTS public.store_join_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  code text NOT NULL,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.store_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  target_ip text,
  auto_rest_min integer DEFAULT 60,
  weekend_extra integer DEFAULT 1000,
  night_extra_start time without time zone DEFAULT '18:00:00'::time without time zone,
  night_extra_end time without time zone DEFAULT '22:00:00'::time without time zone,
  night_extra_amount integer DEFAULT 1000,
  settle_items_json jsonb,
  store_name text,
  crawler_url text,
  crawler_secret text,
  ups_store_code text,
  royalty_rate numeric DEFAULT 0,
  card_fee_rate numeric DEFAULT 0,
  settle_sections_json jsonb,
  reserve_rate numeric DEFAULT 5,
  reserve_fixed integer DEFAULT 400000,
  ups_id character varying(100),
  ups_pw character varying(100),
  mydata_client_id text,
  mydata_client_secret text,
  reserve_initial_balance integer DEFAULT 0,
  expense_thresholds jsonb DEFAULT '{}'::jsonb,
  sales_recon_mapping jsonb DEFAULT '{}'::jsonb,
  business_day_start_hour smallint NOT NULL DEFAULT 6,
  exp_hub_order text,
  vendor_order text,
  weekly_holiday_pay_enabled boolean DEFAULT true,
  weekly_holiday_pay_deduct_absent boolean DEFAULT false,
  role_permissions jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  ups_store_code text,
  franchise_id uuid,
  store_code text,
  tos_accepted_at timestamp with time zone,
  business_no text
);
CREATE TABLE IF NOT EXISTS public.vendor_diffs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  vendor_id uuid,
  year_month text NOT NULL,
  expected_amount integer DEFAULT 0,
  actual_amount integer DEFAULT 0,
  diff_amount integer DEFAULT 0,
  status text DEFAULT 'pending'::text,
  resolved_at timestamp with time zone,
  memo text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vendor_orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  vendor_id uuid,
  order_date date NOT NULL,
  item text,
  amount integer NOT NULL,
  unit_price integer,
  quantity numeric,
  memo text,
  source text DEFAULT 'manual'::text,
  created_at timestamp with time zone DEFAULT now(),
  order_group_id uuid
);
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  name text NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  handled_category_ids jsonb,
  kind text DEFAULT 'vendor'::text,
  biz_no text,
  accounts jsonb DEFAULT '[]'::jsonb,
  contacts jsonb DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid,
  employee_id uuid,
  work_date date NOT NULL,
  wish_start time without time zone,
  wish_end time without time zone,
  status text DEFAULT '희망'::text,
  memo text,
  is_off boolean DEFAULT false
);

-- ── 4. 시퀀스 소유권 연결 ──
ALTER SEQUENCE public.daily_opening_id_seq OWNED BY public.daily_opening.id;
ALTER SEQUENCE public.caps_upload_staging_id_seq OWNED BY public.caps_upload_staging.id;

-- ── 5. 기본키(PK) ──
ALTER TABLE public.accuracy_lab_logs ADD CONSTRAINT accuracy_lab_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_usage_logs ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.caps_upload_staging ADD CONSTRAINT caps_upload_staging_pkey PRIMARY KEY (id);
ALTER TABLE public.classification_rules ADD CONSTRAINT classification_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.coupang_debug ADD CONSTRAINT coupang_debug_pkey PRIMARY KEY (id);
ALTER TABLE public.coupang_global_hints ADD CONSTRAINT coupang_global_hints_pkey PRIMARY KEY (id);
ALTER TABLE public.coupang_inbox ADD CONSTRAINT coupang_inbox_pkey PRIMARY KEY (id);
ALTER TABLE public.coupang_learning_rules ADD CONSTRAINT coupang_learning_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_opening ADD CONSTRAINT daily_opening_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_sales ADD CONSTRAINT daily_sales_pkey PRIMARY KEY (id);
ALTER TABLE public.emp_sessions ADD CONSTRAINT emp_sessions_pkey PRIMARY KEY (token);
ALTER TABLE public.employee_private ADD CONSTRAINT employee_private_pkey PRIMARY KEY (employee_id);
ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE public.exp_groups ADD CONSTRAINT exp_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.exp_item_amounts ADD CONSTRAINT exp_item_amounts_pkey PRIMARY KEY (id);
ALTER TABLE public.exp_items ADD CONSTRAINT exp_items_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_category_amounts ADD CONSTRAINT expense_category_amounts_pkey PRIMARY KEY (id);
ALTER TABLE public.extra_revenue_items ADD CONSTRAINT extra_revenue_items_pkey PRIMARY KEY (id);
ALTER TABLE public.extra_revenue_logs ADD CONSTRAINT extra_revenue_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.fixed_cost_amounts ADD CONSTRAINT fixed_cost_amounts_pkey PRIMARY KEY (id);
ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_pkey PRIMARY KEY (id);
ALTER TABLE public.franchises ADD CONSTRAINT franchises_pkey PRIMARY KEY (id);
ALTER TABLE public.mydata_accounts ADD CONSTRAINT mydata_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.mydata_transactions ADD CONSTRAINT mydata_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (phone);
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE public.pending_joins ADD CONSTRAINT pending_joins_pkey PRIMARY KEY (id);
ALTER TABLE public.persons ADD CONSTRAINT persons_pkey PRIMARY KEY (id);
ALTER TABLE public.receipts ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);
ALTER TABLE public.reconciliation ADD CONSTRAINT reconciliation_pkey PRIMARY KEY (id);
ALTER TABLE public.reserve_fund_logs ADD CONSTRAINT reserve_fund_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_daily ADD CONSTRAINT sales_daily_pkey PRIMARY KEY (id);
ALTER TABLE public.settlements ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);
ALTER TABLE public.signup_tokens ADD CONSTRAINT signup_tokens_pkey PRIMARY KEY (token);
ALTER TABLE public.special_wages ADD CONSTRAINT special_wages_pkey PRIMARY KEY (id);
ALTER TABLE public.store_join_codes ADD CONSTRAINT store_join_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (id);
ALTER TABLE public.vendor_diffs ADD CONSTRAINT vendor_diffs_pkey PRIMARY KEY (id);
ALTER TABLE public.vendor_orders ADD CONSTRAINT vendor_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.vendors ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);
ALTER TABLE public.work_schedules ADD CONSTRAINT work_schedules_pkey PRIMARY KEY (id);

-- ── 6. 중복방지(UNIQUE) ──
ALTER TABLE public.coupang_global_hints ADD CONSTRAINT coupang_global_hints_vendor_item_id_category_name_key UNIQUE (vendor_item_id, category_name);
ALTER TABLE public.coupang_inbox ADD CONSTRAINT coupang_inbox_store_id_external_order_id_item_key UNIQUE (store_id, external_order_id, item);
ALTER TABLE public.daily_opening ADD CONSTRAINT daily_opening_store_id_opening_date_key UNIQUE (store_id, opening_date);
ALTER TABLE public.daily_sales ADD CONSTRAINT daily_sales_store_id_sale_date_key UNIQUE (store_id, sale_date);
ALTER TABLE public.employees ADD CONSTRAINT employees_login_id_key UNIQUE (login_id);
ALTER TABLE public.expense_category_amounts ADD CONSTRAINT expense_category_amounts_category_id_year_month_key UNIQUE (category_id, year_month);
ALTER TABLE public.extra_revenue_items ADD CONSTRAINT extra_revenue_items_store_id_name_key UNIQUE (store_id, name);
ALTER TABLE public.fixed_cost_amounts ADD CONSTRAINT fixed_cost_amounts_fixed_cost_id_year_month_key UNIQUE (fixed_cost_id, year_month);
ALTER TABLE public.franchises ADD CONSTRAINT franchises_invite_code_key UNIQUE (invite_code);
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_store_id_name_key UNIQUE (store_id, name);
ALTER TABLE public.pending_joins ADD CONSTRAINT pending_joins_person_id_store_id_key UNIQUE (person_id, store_id);
ALTER TABLE public.reconciliation ADD CONSTRAINT reconciliation_store_id_year_month_sub_key_key UNIQUE (store_id, year_month, sub_key);
ALTER TABLE public.roles ADD CONSTRAINT roles_store_id_name_key UNIQUE (store_id, name);
ALTER TABLE public.sales_daily ADD CONSTRAINT uq_sales_daily_store_date UNIQUE (store_id, date);
ALTER TABLE public.settlements ADD CONSTRAINT settlements_store_id_settle_date_key UNIQUE (store_id, settle_date);
ALTER TABLE public.special_wages ADD CONSTRAINT special_wages_store_id_target_date_key UNIQUE (store_id, target_date);
ALTER TABLE public.store_join_codes ADD CONSTRAINT store_join_codes_code_key UNIQUE (code);
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_store_id_key UNIQUE (store_id);
ALTER TABLE public.stores ADD CONSTRAINT stores_store_code_key UNIQUE (store_code);
ALTER TABLE public.work_schedules ADD CONSTRAINT work_schedules_store_id_employee_id_work_date_key UNIQUE (store_id, employee_id, work_date);

-- ── 7. 값검사(CHECK) ──
ALTER TABLE public.coupang_inbox ADD CONSTRAINT coupang_inbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'skipped'::text])));
ALTER TABLE public.coupang_learning_rules ADD CONSTRAINT coupang_learning_rules_source_check CHECK ((source = ANY (ARRAY['auto'::text, 'manual'::text])));
ALTER TABLE public.coupang_learning_rules ADD CONSTRAINT coupang_learning_rules_check CHECK (((vendor_item_id IS NOT NULL) OR (keyword IS NOT NULL)));
ALTER TABLE public.extra_revenue_logs ADD CONSTRAINT extra_revenue_logs_amount_check CHECK ((amount >= 0));
ALTER TABLE public.reserve_fund_logs ADD CONSTRAINT reserve_fund_logs_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'withdrawal'::text])));
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_business_day_start_hour_check CHECK (((business_day_start_hour >= 0) AND (business_day_start_hour < 24)));

-- ── 8. 외래키(FK, 표 연결) ──
ALTER TABLE public.accuracy_lab_logs ADD CONSTRAINT accuracy_lab_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.ai_usage_logs ADD CONSTRAINT ai_usage_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.caps_upload_staging ADD CONSTRAINT caps_upload_staging_matched_employee_id_fkey FOREIGN KEY (matched_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.caps_upload_staging ADD CONSTRAINT caps_upload_staging_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.classification_rules ADD CONSTRAINT classification_rules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.coupang_inbox ADD CONSTRAINT coupang_inbox_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.coupang_inbox ADD CONSTRAINT coupang_inbox_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE public.coupang_inbox ADD CONSTRAINT coupang_inbox_ai_suggested_category_id_fkey FOREIGN KEY (ai_suggested_category_id) REFERENCES expense_categories(id) ON DELETE SET NULL;
ALTER TABLE public.coupang_learning_rules ADD CONSTRAINT coupang_learning_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE;
ALTER TABLE public.coupang_learning_rules ADD CONSTRAINT coupang_learning_rules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.daily_opening ADD CONSTRAINT daily_opening_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.daily_opening ADD CONSTRAINT daily_opening_created_by_fkey FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.daily_sales ADD CONSTRAINT daily_sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.emp_sessions ADD CONSTRAINT emp_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_private ADD CONSTRAINT employee_private_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD CONSTRAINT employees_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD CONSTRAINT employees_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id);
ALTER TABLE public.exp_groups ADD CONSTRAINT exp_groups_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.exp_item_amounts ADD CONSTRAINT exp_item_amounts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.exp_item_amounts ADD CONSTRAINT exp_item_amounts_item_id_fkey FOREIGN KEY (item_id) REFERENCES exp_items(id);
ALTER TABLE public.exp_items ADD CONSTRAINT exp_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES exp_groups(id);
ALTER TABLE public.exp_items ADD CONSTRAINT exp_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES expense_categories(id);
ALTER TABLE public.expense_category_amounts ADD CONSTRAINT expense_category_amounts_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public.expense_category_amounts ADD CONSTRAINT expense_category_amounts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.extra_revenue_items ADD CONSTRAINT extra_revenue_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.extra_revenue_logs ADD CONSTRAINT extra_revenue_logs_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE SET NULL;
ALTER TABLE public.extra_revenue_logs ADD CONSTRAINT extra_revenue_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.extra_revenue_logs ADD CONSTRAINT extra_revenue_logs_item_id_fkey FOREIGN KEY (item_id) REFERENCES extra_revenue_items(id) ON DELETE CASCADE;
ALTER TABLE public.fixed_cost_amounts ADD CONSTRAINT fixed_cost_amounts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.fixed_cost_amounts ADD CONSTRAINT fixed_cost_amounts_fixed_cost_id_fkey FOREIGN KEY (fixed_cost_id) REFERENCES fixed_costs(id);
ALTER TABLE public.fixed_costs ADD CONSTRAINT fixed_costs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.franchises ADD CONSTRAINT franchises_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id);
ALTER TABLE public.mydata_accounts ADD CONSTRAINT mydata_accounts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.mydata_transactions ADD CONSTRAINT mydata_transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public.mydata_transactions ADD CONSTRAINT mydata_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.pending_joins ADD CONSTRAINT pending_joins_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.pending_joins ADD CONSTRAINT pending_joins_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;
ALTER TABLE public.pending_joins ADD CONSTRAINT pending_joins_join_code_id_fkey FOREIGN KEY (join_code_id) REFERENCES store_join_codes(id) ON DELETE SET NULL;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public.receipts ADD CONSTRAINT receipts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.reconciliation ADD CONSTRAINT reconciliation_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public.reconciliation ADD CONSTRAINT reconciliation_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.reserve_fund_logs ADD CONSTRAINT reserve_fund_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.reserve_fund_logs ADD CONSTRAINT reserve_fund_logs_source_tx_id_fkey FOREIGN KEY (source_tx_id) REFERENCES mydata_transactions(id) ON DELETE SET NULL;
ALTER TABLE public.roles ADD CONSTRAINT roles_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.sales_daily ADD CONSTRAINT sales_daily_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.signup_tokens ADD CONSTRAINT signup_tokens_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;
ALTER TABLE public.special_wages ADD CONSTRAINT special_wages_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.store_join_codes ADD CONSTRAINT store_join_codes_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE public.stores ADD CONSTRAINT stores_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES franchises(id);
ALTER TABLE public.vendor_diffs ADD CONSTRAINT vendor_diffs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.vendor_diffs ADD CONSTRAINT vendor_diffs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id);
ALTER TABLE public.vendor_orders ADD CONSTRAINT vendor_orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.vendor_orders ADD CONSTRAINT vendor_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id);
ALTER TABLE public.vendors ADD CONSTRAINT vendors_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.work_schedules ADD CONSTRAINT work_schedules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
ALTER TABLE public.work_schedules ADD CONSTRAINT work_schedules_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);

-- ── 9. 색인(검색 빠르게) ──
CREATE INDEX idx_accuracy_lab_store ON public.accuracy_lab_logs USING btree (store_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature_date ON public.ai_usage_logs USING btree (feature, called_at DESC);
CREATE INDEX idx_ai_usage_store_date ON public.ai_usage_logs USING btree (store_id, called_at DESC);
CREATE INDEX idx_attendance_logs_emp ON public.attendance_logs USING btree (employee_id);
CREATE INDEX idx_attendance_logs_store ON public.attendance_logs USING btree (store_id);
CREATE UNIQUE INDEX uniq_attendance_store_emp_date ON public.attendance_logs USING btree (store_id, employee_id, work_date);
CREATE INDEX idx_caps_staging_emp ON public.caps_upload_staging USING btree (matched_employee_id);
CREATE INDEX idx_caps_staging_store ON public.caps_upload_staging USING btree (store_id);
CREATE INDEX idx_cls_rules_store ON public.classification_rules USING btree (store_id);
CREATE INDEX idx_coupang_debug_created ON public.coupang_debug USING btree (created_at DESC);
CREATE INDEX idx_global_hints_item ON public.coupang_global_hints USING btree (vendor_item_id);
CREATE INDEX idx_coupang_inbox_cat ON public.coupang_inbox USING btree (ai_suggested_category_id);
CREATE INDEX idx_coupang_inbox_store_status ON public.coupang_inbox USING btree (store_id, status);
CREATE INDEX idx_coupang_inbox_vendor ON public.coupang_inbox USING btree (vendor_id);
CREATE INDEX idx_coupang_learning_cat ON public.coupang_learning_rules USING btree (category_id);
CREATE INDEX idx_coupang_rules_store ON public.coupang_learning_rules USING btree (store_id);
CREATE UNIQUE INDEX idx_coupang_rules_vendor_item ON public.coupang_learning_rules USING btree (store_id, vendor_item_id) WHERE (vendor_item_id IS NOT NULL);
CREATE INDEX idx_daily_opening_createdby ON public.daily_opening USING btree (created_by);
CREATE INDEX idx_daily_opening_store_date ON public.daily_opening USING btree (store_id, opening_date DESC);
CREATE INDEX emp_sessions_emp_idx ON public.emp_sessions USING btree (employee_id);
CREATE INDEX idx_employees_person ON public.employees USING btree (person_id);
CREATE INDEX idx_employees_store ON public.employees USING btree (store_id);
CREATE INDEX idx_exp_groups_store ON public.exp_groups USING btree (store_id);
CREATE INDEX idx_exp_item_amounts_item ON public.exp_item_amounts USING btree (item_id);
CREATE INDEX idx_exp_item_amounts_store ON public.exp_item_amounts USING btree (store_id);
CREATE INDEX idx_exp_items_group ON public.exp_items USING btree (group_id);
CREATE INDEX idx_exp_items_store ON public.exp_items USING btree (store_id);
CREATE INDEX idx_expense_categories_parent ON public.expense_categories USING btree (parent_id);
CREATE INDEX idx_expense_categories_store ON public.expense_categories USING btree (store_id);
CREATE INDEX idx_expense_category_amounts_store ON public.expense_category_amounts USING btree (store_id);
CREATE INDEX idx_eri_store_sort ON public.extra_revenue_items USING btree (store_id, sort_order);
CREATE INDEX idx_erl_item ON public.extra_revenue_logs USING btree (item_id);
CREATE INDEX idx_erl_settle ON public.extra_revenue_logs USING btree (settlement_id);
CREATE INDEX idx_erl_store_date ON public.extra_revenue_logs USING btree (store_id, log_date DESC);
CREATE INDEX idx_fixed_cost_amounts_store ON public.fixed_cost_amounts USING btree (store_id);
CREATE INDEX idx_fixed_costs_store ON public.fixed_costs USING btree (store_id);
CREATE INDEX idx_franchises_owner ON public.franchises USING btree (owner_user_id);
CREATE INDEX idx_mydata_accounts_store ON public.mydata_accounts USING btree (store_id);
CREATE INDEX idx_mydata_batch ON public.mydata_transactions USING btree (upload_batch_id);
CREATE INDEX idx_mydata_review ON public.mydata_transactions USING btree (needs_review) WHERE (needs_review = true);
CREATE INDEX idx_mydata_transactions_cat ON public.mydata_transactions USING btree (category_id);
CREATE INDEX idx_mydata_tx_date ON public.mydata_transactions USING btree (store_id, tx_date);
CREATE INDEX idx_mydata_tx_hash ON public.mydata_transactions USING btree (store_id, tx_hash);
CREATE INDEX idx_mydata_tx_store ON public.mydata_transactions USING btree (store_id, tx_date);
CREATE INDEX idx_mydata_tx_type ON public.mydata_transactions USING btree (store_id, tx_type);
CREATE INDEX idx_pm_store_sort ON public.payment_methods USING btree (store_id, sort_order);
CREATE INDEX idx_pending_joins_code ON public.pending_joins USING btree (join_code_id);
CREATE INDEX idx_pending_joins_store ON public.pending_joins USING btree (store_id);
CREATE UNIQUE INDEX persons_phone_uniq ON public.persons USING btree (phone) WHERE (phone IS NOT NULL);
CREATE INDEX idx_receipts_cat ON public.receipts USING btree (category_id);
CREATE INDEX idx_receipts_group_id ON public.receipts USING btree (receipt_group_id);
CREATE INDEX idx_receipts_input_method ON public.receipts USING btree (input_method);
CREATE INDEX idx_receipts_item_date ON public.receipts USING btree (item, receipt_date DESC) WHERE ((item IS NOT NULL) AND (item <> ''::text));
CREATE INDEX idx_receipts_store ON public.receipts USING btree (store_id);
CREATE INDEX idx_receipts_vendor_id ON public.receipts USING btree (vendor_id);
CREATE INDEX idx_recon_store_month ON public.reconciliation USING btree (store_id, year_month);
CREATE INDEX idx_reconciliation_cat ON public.reconciliation USING btree (category_id);
CREATE INDEX idx_reserve_fund_logs_srctx ON public.reserve_fund_logs USING btree (source_tx_id);
CREATE INDEX idx_reserve_fund_logs_store ON public.reserve_fund_logs USING btree (store_id);
CREATE INDEX idx_sales_daily_store_date ON public.sales_daily USING btree (store_id, date DESC);
CREATE INDEX idx_signup_tokens_person ON public.signup_tokens USING btree (person_id);
CREATE INDEX idx_store_join_codes_store ON public.store_join_codes USING btree (store_id);
CREATE INDEX idx_stores_franchise ON public.stores USING btree (franchise_id);
CREATE INDEX idx_vendor_diffs_store ON public.vendor_diffs USING btree (store_id, year_month);
CREATE INDEX idx_vendor_diffs_vendor ON public.vendor_diffs USING btree (vendor_id);
CREATE INDEX idx_vendor_orders_group_id ON public.vendor_orders USING btree (order_group_id);
CREATE INDEX idx_vendor_orders_store ON public.vendor_orders USING btree (store_id);
CREATE INDEX idx_vendor_orders_vendor ON public.vendor_orders USING btree (vendor_id);
CREATE INDEX idx_vendors_cat ON public.vendors USING btree (category_id);
CREATE INDEX idx_vendors_store ON public.vendors USING btree (store_id);
CREATE INDEX idx_work_schedules_emp ON public.work_schedules USING btree (employee_id);

-- ── 10. 함수 + 트리거 ──
CREATE OR REPLACE FUNCTION public._sales_daily_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vote_global_hint(p_vendor_item_id text, p_category_name text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  INSERT INTO coupang_global_hints (vendor_item_id, category_name, vote_count)
  VALUES (p_vendor_item_id, p_category_name, 1)
  ON CONFLICT (vendor_item_id, category_name)
  DO UPDATE SET vote_count = coupang_global_hints.vote_count + 1, updated_at = now();
$function$;

CREATE TRIGGER trg_sales_daily_updated_at BEFORE UPDATE ON public.sales_daily FOR EACH ROW EXECUTE FUNCTION _sales_daily_touch_updated_at();

-- ── 11. 보안(RLS) 활성화 ──
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caps_upload_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_cost_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_wages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_category_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_item_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mydata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mydata_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_fund_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_revenue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_revenue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_opening ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_join_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_joins ENABLE ROW LEVEL SECURITY;

-- ── 12. 보안정책(RLS Policy) — 시드니 1:1 ──
CREATE POLICY pd_phase2b_all ON public.attendance_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.caps_upload_staging AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.classification_rules AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY daily_opening_all ON public.daily_opening AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.daily_sales AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.employees AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.expense_categories AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.expense_category_amounts AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.extra_revenue_items AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.extra_revenue_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.fixed_cost_amounts AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.fixed_costs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.mydata_accounts AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY mydata_transactions_all ON public.mydata_transactions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY pd_phase2b_all ON public.mydata_transactions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.payment_methods AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.receipts AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.reconciliation AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY reconciliation_all ON public.reconciliation AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY pd_phase2b_all ON public.reserve_fund_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.roles AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.sales_daily AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.settlements AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.special_wages AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.store_settings AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.vendor_diffs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY vendor_diffs_all ON public.vendor_diffs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY pd_phase2b_all ON public.vendor_orders AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.vendors AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
CREATE POLICY pd_phase2b_all ON public.work_schedules AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK ((store_id IS NOT NULL));
