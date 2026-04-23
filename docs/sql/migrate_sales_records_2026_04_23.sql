-- ═══════════════════════════════════════════════════════════════
-- sales_records 테이블 신설 (매출 관리 페이지 1단계)
-- 일시: 2026-04-23
-- 목적:
--   1) 매출 raw 거래 데이터 저장용 테이블 신설
--      → 지금까지 settlements.items_json 덩어리에 묶여있던 매출 정보를
--        결제수단별/날짜별 한 줄씩 풀어서 관리
--   2) source 컬럼으로 미래 API 연동 대비
--      ('manual' | 'closing' | 'excel' | 'pos_api' | 'card_api' | ...)
--   3) settlements는 그대로 유지 — 마감정산 저장 시 병행 INSERT
--   4) category_id는 expense_categories 중 category_type='income' 만 허용 (앱 레벨 검증)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS sales_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  payment_method  TEXT NOT NULL,
  category_id     UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount          NUMERIC NOT NULL DEFAULT 0,
  memo            TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. 인덱스 (매장×월 조회, 매장×날짜×결제수단 집계)
CREATE INDEX IF NOT EXISTS idx_sales_records_store_date
  ON sales_records(store_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_records_store_date_method
  ON sales_records(store_id, date, payment_method);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION _sales_records_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_records_updated_at ON sales_records;
CREATE TRIGGER trg_sales_records_updated_at
  BEFORE UPDATE ON sales_records
  FOR EACH ROW EXECUTE FUNCTION _sales_records_touch_updated_at();

-- 4. (RLS 비활성 가정) store_id 격리는 앱 레벨에서 책임
--    dev_lessons #28 참조 — 모든 쿼리에 .eq('store_id', currentStore.id) 강제

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (수동 실행)
-- ═══════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name='sales_records'
--  ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename='sales_records';
