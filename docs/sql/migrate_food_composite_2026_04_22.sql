-- ═══════════════════════════════════════════════════════════════
-- 지출카테고리 2차 개편 마이그레이션 (B+가 안)
-- 일시: 2026-04-22
-- 목적:
--   1) 식자재(거래처/직구/주류) 3개 대분류 → 식자재 대분류 1개 + 육류/야채/공산품 composite 소분류
--   2) 주류는 별도 대분류로 분리 (기존 식자재(주류) 리네임)
--   3) "직구" 개념 삭제 (쿠팡/대봄 관계없이 품목으로 분류)
--   4) receipts.category_id = 소분류 id 고정 규칙 확립 (mydata=대분류 id와 별개)
--   5) classification_rules.category '물품대금' → '식자재' 이름 통일
--
-- ⚠️ 실행 전 반드시 백업 스냅샷(Supabase Settings → Backups) 확인!
-- ⚠️ 매장별 (store_id='4ae03341-e5dc-4933-b746-29728cbc685f') 기준
-- ⚠️ 다른 매장 추가 시 store_id만 바꿔서 반복 실행
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────
-- 1단계. 백업테이블 4개 생성 (롤백용)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories_bak_20260422 AS
  SELECT * FROM expense_categories
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

CREATE TABLE IF NOT EXISTS vendors_bak_20260422 AS
  SELECT * FROM vendors
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

CREATE TABLE IF NOT EXISTS receipts_bak_20260422 AS
  SELECT id, category, category_id FROM receipts
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

CREATE TABLE IF NOT EXISTS classification_rules_bak_20260422 AS
  SELECT * FROM classification_rules
  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f';

-- ─────────────────────────────────────────────────
-- 2단계. expense_categories 재편
-- ─────────────────────────────────────────────────

-- 2-1. 식자재(거래처), 식자재(직구) 비활성화 (데이터 보존. 과거 집계 호환용)
UPDATE expense_categories
   SET is_active=false
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND name IN ('식자재(거래처)','식자재(직구)');

-- 2-2. 식자재(주류) → 주류로 리네임 + vendor_category 유지
UPDATE expense_categories
   SET name='주류',
       data_source='vendor_orders',
       vendor_category='주류',
       parent_id=NULL
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND name='식자재(주류)';

-- 2-3. 신규 식자재 대분류 INSERT (data_source='composite')
INSERT INTO expense_categories
  (store_id, name, data_source, color, vendor_category, parent_id, sort_order, is_active)
VALUES
  ('4ae03341-e5dc-4933-b746-29728cbc685f','식자재','composite','#05C072',NULL,NULL,1,true)
ON CONFLICT DO NOTHING;

-- 2-4. 신규 소분류 3개 INSERT (composite: vendor_orders + receipts 합산)
WITH parent AS (
  SELECT id FROM expense_categories
   WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
     AND name='식자재' AND parent_id IS NULL
)
INSERT INTO expense_categories
  (store_id, name, data_source, color, vendor_category, parent_id, sort_order, is_active)
SELECT '4ae03341-e5dc-4933-b746-29728cbc685f','육류','composite','#EF4444','육류',parent.id,1,true FROM parent
UNION ALL
SELECT '4ae03341-e5dc-4933-b746-29728cbc685f','야채','composite','#10B981','야채',parent.id,2,true FROM parent
UNION ALL
SELECT '4ae03341-e5dc-4933-b746-29728cbc685f','공산품','composite','#F59E0B','공산품',parent.id,3,true FROM parent;

-- ─────────────────────────────────────────────────
-- 3단계. receipts.category_id 마이그레이션
--   기존: '식자재(직구)' 등 소분류 id 저장
--   신규: 소분류 id 저장 유지하되, '식자재(거래처)'/'식자재(직구)' 비활성 카테고리
--        에 꽂혀 있던 receipts는 category text 기준으로 참고용만 유지 (재분류는 사장님 UI로)
-- ─────────────────────────────────────────────────
-- 참고: receipts.category_id는 그대로 둠 (비활성 카테고리 id지만 집계 규칙상 포함됨 dev_lessons #24)
-- 사장님이 재분류 도우미 UI에서 육류/야채/공산품으로 옮길 때 category_id가 신규 소분류 id로 업데이트됨

-- ─────────────────────────────────────────────────
-- 4단계. classification_rules 이름 일치화
--   기존 시드의 category='물품대금' → '식자재' 로 업데이트 (expense_categories.name과 일치)
-- ─────────────────────────────────────────────────
UPDATE classification_rules
   SET category='식자재'
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND category='물품대금';

-- 기존 '직구'로 카테고리 되어있던 card rules → '식자재'로 승격 (쿠팡 등)
-- sub_category는 '직구상세' 유지 (참고용 text)
UPDATE classification_rules
   SET category='식자재'
 WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
   AND category='직구';

-- ─────────────────────────────────────────────────
-- 5단계. 검증 쿼리 (실행 후 육안 확인)
-- ─────────────────────────────────────────────────
-- 활성 카테고리 목록 확인
-- SELECT id, name, parent_id, data_source, vendor_category, is_active
--   FROM expense_categories
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f'
--  ORDER BY parent_id NULLS FIRST, sort_order;
--
-- 기대 결과:
--   대분류: 식자재(composite), 주류(vendor_orders), 인건비, 공과금/고정비, 비품, 마케팅, 기타
--   소분류 (parent=식자재): 육류, 야채, 공산품
--   비활성: 식자재(거래처), 식자재(직구)
--
-- classification_rules 이름 확인
-- SELECT category, COUNT(*) FROM classification_rules
--  WHERE store_id='4ae03341-e5dc-4933-b746-29728cbc685f' GROUP BY category;
-- 기대: '식자재' 포함, '물품대금'/'직구' 0건

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- ⚠️ 실행 직후 사장님 앱 동작:
--   1) 하드 리프레시 (Ctrl+Shift+R)
--   2) 사이드메뉴 → 거래처 → "재분류 도우미" 버튼 클릭
--   3) 기존 "식자재" 거래처들을 육류/야채/공산품으로 재지정
--   4) 영수증 촬영 테스트 → AI가 "식자재>육류" "식자재>야채" 식으로 응답하는지 확인
--   5) 대시보드 월정산 숫자가 이전과 맞는지 확인
-- ═══════════════════════════════════════════════════════════════
