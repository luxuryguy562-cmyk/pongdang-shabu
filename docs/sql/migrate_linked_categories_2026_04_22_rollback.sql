-- ═══════════════════════════════════════════════════════════════
-- #55 롤백 SQL
-- 실행 전 백업 테이블 존재 확인: expense_categories_bak_20260422_c,
--                             classification_rules_bak_20260422_c,
--                             mydata_tx_bak_20260422_c
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. mydata_transactions 복원
UPDATE mydata_transactions m
   SET category=b.category,
       sub_category=b.sub_category,
       category_id=b.category_id,
       exclude_from_settlement=b.exclude_from_settlement
  FROM mydata_tx_bak_20260422_c b
 WHERE m.id=b.id
   AND m.store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

-- 2. classification_rules 복원
UPDATE classification_rules cr
   SET category=b.category,
       sub_category=b.sub_category,
       exclude_from_settlement=b.exclude_from_settlement
  FROM classification_rules_bak_20260422_c b
 WHERE cr.id=b.id
   AND cr.store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

-- 3. 새 대분류 2개 삭제
DELETE FROM expense_categories
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND category_type IN ('receipt_ref','reserve')
   AND parent_id IS NULL
   AND name IN ('영수증 참조','예비비 사용');

-- 4. 식자재 > 영수증 참조 소분류 복원
WITH parent AS (
  SELECT id FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND name='식자재' AND parent_id IS NULL AND is_active=true
   LIMIT 1
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
  99,
  true,
  'expense'
WHERE EXISTS (SELECT 1 FROM parent);

-- 5. source_tx_id 컬럼 제거
ALTER TABLE reserve_fund_logs DROP COLUMN IF EXISTS source_tx_id;

COMMIT;
