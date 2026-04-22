-- ═══════════════════════════════════════════════════════════════
-- 지출카테고리 2차 개편 롤백 SQL
-- 일시: 2026-04-22
-- 용도: 마이그레이션 실패 or 집계 숫자 틀어짐 → 즉시 복원
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────
-- 1. receipts.category_id 복원 (id 매칭)
-- ─────────────────────────────────────────────────
UPDATE receipts r
   SET category    = b.category,
       category_id = b.category_id
  FROM receipts_bak_20260422 b
 WHERE r.id=b.id
   AND r.store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

-- ─────────────────────────────────────────────────
-- 2. classification_rules 복원
-- ─────────────────────────────────────────────────
DELETE FROM classification_rules
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

INSERT INTO classification_rules
  (id, store_id, keyword, match_type, tx_type, category, sub_category,
   exclude_from_settlement, priority, created_at)
SELECT id, store_id, keyword, match_type, tx_type, category, sub_category,
       exclude_from_settlement, priority, created_at
  FROM classification_rules_bak_20260422;

-- ─────────────────────────────────────────────────
-- 3. expense_categories 복원
--   신규 생성한 식자재/육류/야채/공산품 삭제 → 원상복구
-- ─────────────────────────────────────────────────

-- 3-1. 신규 추가한 소분류 3개 삭제
DELETE FROM expense_categories
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND name IN ('육류','야채','공산품')
   AND parent_id IN (
     SELECT id FROM expense_categories
      WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
        AND name='식자재' AND parent_id IS NULL
   );

-- 3-2. 신규 추가한 식자재 대분류 삭제
DELETE FROM expense_categories
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND name='식자재'
   AND data_source='composite'
   AND parent_id IS NULL;

-- 3-3. 주류 → 식자재(주류)로 되돌림
UPDATE expense_categories e
   SET name        = b.name,
       data_source = b.data_source,
       vendor_category = b.vendor_category,
       parent_id   = b.parent_id
  FROM expense_categories_bak_20260422 b
 WHERE e.id=b.id
   AND e.store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND b.name='식자재(주류)';

-- 3-4. 식자재(거래처), 식자재(직구) is_active 복원
UPDATE expense_categories e
   SET is_active = b.is_active
  FROM expense_categories_bak_20260422 b
 WHERE e.id=b.id
   AND e.store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND b.name IN ('식자재(거래처)','식자재(직구)');

-- ─────────────────────────────────────────────────
-- 4. 검증 쿼리 (롤백 후 확인)
-- ─────────────────────────────────────────────────
-- SELECT name, parent_id, data_source, is_active FROM expense_categories
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
--  ORDER BY sort_order;
-- 기대: 식자재(거래처)/식자재(직구)/식자재(주류) 3개 활성 상태 복원

COMMIT;

-- ⚠️ 백업테이블(expense_categories_bak_20260422 등)은 수동 DROP 전까지 유지
--    향후 문제 재조사 시 참고용
