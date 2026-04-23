-- ═══════════════════════════════════════════════════════════════
-- 영수증 참조 소분류 롤백 SQL
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. classification_rules 복원 (직구상세로 되돌림)
UPDATE classification_rules cr
   SET sub_category=b.sub_category
  FROM classification_rules_bak_20260422_b b
 WHERE cr.id=b.id
   AND cr.store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

-- 2. mydata_transactions 복원
UPDATE mydata_transactions
   SET sub_category='직구상세'
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND sub_category='영수증 참조';

-- 3. "영수증 참조" 소분류 삭제
DELETE FROM expense_categories
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND name='영수증 참조'
   AND parent_id IN (
     SELECT id FROM expense_categories
      WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
        AND name='식자재' AND parent_id IS NULL
   );

COMMIT;
