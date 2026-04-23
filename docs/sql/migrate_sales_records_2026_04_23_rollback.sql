-- ═══════════════════════════════════════════════════════════════
-- 롤백: sales_records 테이블 제거
-- 일시: 2026-04-23
-- 주의: 매출 raw 데이터 전부 삭제됨.
--      settlements 테이블은 건드리지 않으므로 마감정산 기록은 그대로 유지.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS trg_sales_records_updated_at ON sales_records;
DROP FUNCTION IF EXISTS _sales_records_touch_updated_at();

DROP INDEX IF EXISTS idx_sales_records_store_date_method;
DROP INDEX IF EXISTS idx_sales_records_store_date;

DROP TABLE IF EXISTS sales_records;

COMMIT;
