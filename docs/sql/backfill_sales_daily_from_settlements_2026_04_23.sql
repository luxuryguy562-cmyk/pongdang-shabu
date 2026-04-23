-- ═══════════════════════════════════════════════════════════════════
-- 1순위 Part B 백필: 과거 settlements → sales_daily
-- 목적: 대시보드 매출 차트를 sales_daily 기준으로 전환 (Part B 코드 배포 전 실행)
-- 안전장치:
--   1. NOT EXISTS 로 이미 있는 sales_daily 행(사장님 수정본 포함)은 절대 건드리지 않음
--   2. items_json 에 pos_card 키가 있는 정상 구조 마감정산만 이관
--   3. memo = '과거 마감정산 백필' 로 마킹하여 롤백 대상 식별
-- 실행 시점: Part B 코드 push 직전
-- 소요 시간: 1초 이내 (기록 수백 건 수준)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO sales_daily (
  store_id,
  date,
  card,
  cash,
  cash_receipt,
  qr,
  etc,
  extra_large,
  extra_small,
  memo,
  source
)
SELECT
  s.store_id,
  s.settle_date                                                        AS date,
  COALESCE((s.items_json->>'pos_card')::numeric, 0)                    AS card,
  COALESCE((s.items_json->>'cash_detail_cash')::numeric, 0)            AS cash,
  COALESCE((s.items_json->>'pos_cash_receipt')::numeric, 0)            AS cash_receipt,
  COALESCE((s.items_json->>'cash_detail_qr')::numeric, 0)              AS qr,
  COALESCE((s.items_json->>'pos_etc')::numeric, 0)
    + COALESCE((s.items_json->>'cash_detail_transfer')::numeric, 0)    AS etc,
  COALESCE((s.items_json->>'extra_draw_large')::numeric, 0)            AS extra_large,
  COALESCE((s.items_json->>'extra_draw_small')::numeric, 0)            AS extra_small,
  '과거 마감정산 백필'                                                  AS memo,
  'closing'                                                            AS source
FROM settlements s
WHERE s.items_json ? 'pos_card'
  AND NOT EXISTS (
    SELECT 1
    FROM sales_daily sd
    WHERE sd.store_id = s.store_id
      AND sd.date     = s.settle_date
  );

-- 실행 후 확인 쿼리 (선택)
-- SELECT source, COUNT(*) FROM sales_daily GROUP BY source ORDER BY source;
