-- ═══════════════════════════════════════════════════════════════
-- 롤백: sales_daily 제거
-- 일시: 2026-04-23
-- 주의: 매출 raw 데이터 전부 삭제됨. settlements 는 그대로 유지.
--      sales_records 복구는 하지 않음 (세로 raw 설계 자체 폐기).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS trg_sales_daily_updated_at ON sales_daily;
DROP FUNCTION IF EXISTS _sales_daily_touch_updated_at();
DROP INDEX IF EXISTS idx_sales_daily_store_date;
DROP TABLE IF EXISTS sales_daily;

COMMIT;
