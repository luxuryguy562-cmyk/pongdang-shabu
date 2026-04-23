-- ═══════════════════════════════════════════════════════════════
-- #55 영수증 참조 + 예비비 사용 대분류 분리 (category_type 5종)
-- 일시: 2026-04-22
-- 목적:
--   - #54에서 잘못 설계한 "식자재 > 영수증 참조" 소분류 구조 취소
--   - 영수증 참조 / 예비비 사용을 각각 별도 대분류로 신설
--   - category_type에 'receipt_ref' / 'reserve' 신규 타입 추가
--   - 예비비 자동 동기화를 위해 reserve_fund_logs.source_tx_id 컬럼 추가
--
-- ⚠️ 선행: #54 migrate_receipt_ref_2026_04_22.sql 이미 실행된 상태 가정
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────
-- 1. 백업
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories_bak_20260422_c AS
  SELECT * FROM expense_categories
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

CREATE TABLE IF NOT EXISTS classification_rules_bak_20260422_c AS
  SELECT * FROM classification_rules
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
    AND (category='영수증 참조' OR sub_category='영수증 참조');

CREATE TABLE IF NOT EXISTS mydata_tx_bak_20260422_c AS
  SELECT id, category, sub_category, category_id, exclude_from_settlement
    FROM mydata_transactions
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND (category='영수증 참조' OR sub_category='영수증 참조');

-- ─────────────────────────────────────────────────
-- 2. reserve_fund_logs.source_tx_id 컬럼 추가 (예비비 자동 동기화)
-- ─────────────────────────────────────────────────
ALTER TABLE reserve_fund_logs
  ADD COLUMN IF NOT EXISTS source_tx_id uuid NULL REFERENCES mydata_transactions(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────
-- 3. 새 대분류 2개 INSERT: "영수증 참조" / "예비비 사용"
-- ─────────────────────────────────────────────────
INSERT INTO expense_categories
  (store_id, name, data_source, color, vendor_category, parent_id, sort_order, is_active, category_type)
SELECT
  '4ae03341-e5dc-4933-b746-29728cbc685f',
  '영수증 참조',
  'receipts',
  '#3B82F6',
  NULL,
  NULL,
  (SELECT COALESCE(MAX(sort_order),0)+1 FROM expense_categories
    WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
      AND category_type='receipt_ref' AND parent_id IS NULL),
  true,
  'receipt_ref'
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND name='영수증 참조' AND category_type='receipt_ref' AND parent_id IS NULL
);

INSERT INTO expense_categories
  (store_id, name, data_source, color, vendor_category, parent_id, sort_order, is_active, category_type)
SELECT
  '4ae03341-e5dc-4933-b746-29728cbc685f',
  '예비비 사용',
  'manual',
  '#F59E0B',
  NULL,
  NULL,
  (SELECT COALESCE(MAX(sort_order),0)+1 FROM expense_categories
    WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
      AND category_type='reserve' AND parent_id IS NULL),
  true,
  'reserve'
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND name='예비비 사용' AND category_type='reserve' AND parent_id IS NULL
);

-- ─────────────────────────────────────────────────
-- 4. classification_rules: 기존 sub_category='영수증 참조' → category='영수증 참조', sub_category=''
-- ─────────────────────────────────────────────────
UPDATE classification_rules
   SET category='영수증 참조',
       sub_category='',
       exclude_from_settlement=true
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND sub_category='영수증 참조';

-- ─────────────────────────────────────────────────
-- 5. mydata_transactions: 기존 '식자재 > 영수증 참조' 건들을 새 대분류로 이동
-- ─────────────────────────────────────────────────
UPDATE mydata_transactions m
   SET category='영수증 참조',
       sub_category='',
       category_id=(
         SELECT id FROM expense_categories
          WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
            AND name='영수증 참조' AND category_type='receipt_ref' AND parent_id IS NULL
          LIMIT 1
       ),
       exclude_from_settlement=true
 WHERE m.store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND m.sub_category='영수증 참조';

-- ─────────────────────────────────────────────────
-- 6. 기존 식자재 아래 "영수증 참조" 소분류 삭제 (#54에서 잘못 만든 것)
-- ─────────────────────────────────────────────────
DELETE FROM expense_categories
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND name='영수증 참조'
   AND parent_id IS NOT NULL;

-- ─────────────────────────────────────────────────
-- 7. 검증 쿼리 (실행 후 육안 확인)
-- ─────────────────────────────────────────────────
-- SELECT name, parent_id, category_type, data_source
--   FROM expense_categories
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
--    AND category_type IN ('receipt_ref','reserve');
-- 기대: 영수증 참조 (receipt_ref), 예비비 사용 (reserve) 2건
--
-- SELECT category, COUNT(*) FROM mydata_transactions
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f' AND category='영수증 참조'
--  GROUP BY category;
-- 기대: category='영수증 참조' 건 다수, sub_category=''

COMMIT;

-- ⚠️ 사장님: 이 SQL은 "Run without RLS"로 실행하세요
--    실행 후 앱 하드 리프레시 → 확인필요 드롭다운에 📸 영수증참조 / 🏦 예비비 그룹 확인
