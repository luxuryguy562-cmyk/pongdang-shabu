-- ═══════════════════════════════════════════════════════════════
-- 2026-04-21 마이그레이션: mydata_transactions.category_id 정합성 복구
-- ═══════════════════════════════════════════════════════════════
-- 목적: category_id 규칙 확립
--   BEFORE: category_id 가 소분류 id로 저장된 건 존재 (FK 혼란, 대시보드 집계 누락)
--   AFTER : category_id 는 항상 대분류 id, sub_category 는 소분류명(text)
--
-- 연관 커밋: claude/improve-category-ui-TQloc
-- 연관 코드: saveExcelBatch.resolveCatPayload, openTxEditSheet/saveTxEdit, resolveCatPair
--
-- 실행 순서:
--   [1단계] 백업 테이블 생성 (Run and enable RLS)
--   [2단계] sub_category 비어있는 건 expense_categories에서 소분류명 채움
--   [3단계] category_id를 부모(대분류) id로 치환 + category 텍스트도 대분류명으로
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- [1단계] 백업 테이블 (사장님 실행 완료)
-- ───────────────────────────────────────────────────────────────
-- CREATE TABLE mydata_transactions_bak_20260421 AS
--   SELECT * FROM mydata_transactions;
-- → Supabase UI에서 "Run and enable RLS" 선택 (anon 접근 차단)

-- ───────────────────────────────────────────────────────────────
-- [2단계] sub_category 비어있는 건 소분류명 채움
-- ───────────────────────────────────────────────────────────────
-- 조건: category_id가 소분류(parent_id IS NOT NULL)를 가리키는데
--       sub_category가 비어있는 경우만
-- 효과: 대시보드 상세비교/정산 UI에서 소분류명 표시 가능
UPDATE mydata_transactions mt
SET sub_category = ec.name
FROM expense_categories ec
WHERE mt.category_id = ec.id
  AND ec.parent_id IS NOT NULL
  AND (mt.sub_category IS NULL OR mt.sub_category = '');

-- ───────────────────────────────────────────────────────────────
-- [3단계] category_id를 부모(대분류) id로 치환 + category 텍스트 대분류명 통일
-- ───────────────────────────────────────────────────────────────
-- 조건: category_id가 소분류를 가리키는 경우
-- 효과: 대시보드 집계(5474행 이하)에서 대분류별 tx 누락 없이 집계
UPDATE mydata_transactions mt
SET category_id = ec.parent_id,
    category = (SELECT name FROM expense_categories WHERE id = ec.parent_id)
FROM expense_categories ec
WHERE mt.category_id = ec.id
  AND ec.parent_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────
-- 검증 쿼리 (실행 후 확인)
-- ───────────────────────────────────────────────────────────────
-- 1. 소분류 id를 가리키는 거래 0건이어야 함
-- SELECT count(*) FROM mydata_transactions mt
--   JOIN expense_categories ec ON mt.category_id = ec.id
--   WHERE ec.parent_id IS NOT NULL;
--
-- 2. 대분류 id를 가리키는 거래 수 + sub_category 채워진 비율
-- SELECT
--   count(*) FILTER (WHERE category_id IS NOT NULL) AS with_main,
--   count(*) FILTER (WHERE sub_category IS NOT NULL AND sub_category <> '') AS with_sub,
--   count(*) AS total
-- FROM mydata_transactions;
