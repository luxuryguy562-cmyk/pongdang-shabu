-- ═══════════════════════════════════════════════════════════════════
-- 롤백: 백필로 생성된 sales_daily 행만 제거
-- 안전장치:
--   1. memo='과거 마감정산 백필' AND source='closing' 두 조건 모두 일치하는 행만 삭제
--   2. 마감정산 신규 저장분(memo='마감정산 자동')은 memo 값이 달라 보호됨
--   3. 사장님 수동 편집본(source='closing_edited' 또는 'manual')은 source 값이 달라 보호됨
-- ═══════════════════════════════════════════════════════════════════

DELETE FROM sales_daily
WHERE memo   = '과거 마감정산 백필'
  AND source = 'closing';

-- 롤백 후 확인
-- SELECT source, memo, COUNT(*) FROM sales_daily GROUP BY source, memo ORDER BY source;
