-- ═══════════════════════════════════════════════════════════════════
-- 롤백: payment_methods + sales_daily.amounts 제거
-- ⚠️ 주의: 사장님이 추가/수정/삭제한 커스텀 결제수단 데이터 모두 소실
-- 기존 sales_daily.card/cash/... 컬럼은 무손상이라 앱은 기존 방식으로 계속 작동
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE sales_daily DROP COLUMN IF EXISTS amounts;
DROP INDEX IF EXISTS idx_pm_store_sort;
DROP TABLE IF EXISTS payment_methods;
