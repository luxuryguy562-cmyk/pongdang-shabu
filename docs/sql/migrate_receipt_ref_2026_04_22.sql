-- ═══════════════════════════════════════════════════════════════
-- 영수증 참조 소분류 추가 + classification_rules 업데이트
-- 일시: 2026-04-22
-- 목적:
--   1) 식자재 아래 "영수증 참조" 소분류 신설
--      → 쿠팡/이마트처럼 한 영수증에 여러 카테고리 섞인 거래용
--      → 카드/은행 거래는 이 분류로 두고, 실제 집계는 영수증에서
--   2) 기존 classification_rules sub_category='직구상세' → '영수증 참조' UPDATE
--   3) 집계 로직: 해당 거래는 지출 집계에서 자동 제외 (영수증으로 대체)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. 백업 (classification_rules만, expense_categories는 2026-04-22 백업 재사용)
CREATE TABLE IF NOT EXISTS classification_rules_bak_20260422_b AS
  SELECT id, sub_category FROM classification_rules
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
    AND sub_category='직구상세';

-- 2. 식자재 대분류 아래 "영수증 참조" 소분류 INSERT
WITH parent AS (
  SELECT id FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND name='식자재' AND parent_id IS NULL AND is_active=true
   LIMIT 1
), next_order AS (
  SELECT COALESCE(MAX(sort_order),0)+1 AS so
    FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND parent_id=(SELECT id FROM parent)
)
INSERT INTO expense_categories
  (store_id, name, data_source, color, vendor_category, parent_id, sort_order, is_active, category_type)
SELECT
  '4ae03341-e5dc-4933-b746-29728cbc685f',
  '영수증 참조',
  'receipts',
  '#94A3B8',
  NULL,
  (SELECT id FROM parent),
  (SELECT so FROM next_order),
  true,
  'expense'
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND name='영수증 참조' AND parent_id=(SELECT id FROM parent)
);

-- 3. classification_rules 시드 중 sub_category='직구상세' → '영수증 참조' UPDATE
UPDATE classification_rules
   SET sub_category='영수증 참조'
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND sub_category='직구상세';

-- 4. 기존 mydata_transactions sub_category='직구상세' → '영수증 참조' UPDATE
UPDATE mydata_transactions
   SET sub_category='영수증 참조'
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND sub_category='직구상세';

-- 5. 검증 쿼리 (실행 후 육안)
-- SELECT name, parent_id, data_source, category_type
--   FROM expense_categories
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
--    AND name='영수증 참조';
--
-- SELECT sub_category, COUNT(*) FROM classification_rules
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f' GROUP BY sub_category;

COMMIT;
