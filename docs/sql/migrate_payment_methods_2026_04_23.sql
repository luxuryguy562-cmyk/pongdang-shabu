-- ═══════════════════════════════════════════════════════════════════
-- Part F Phase 1: 결제수단 동적 관리
-- 목적: payment_methods 테이블 + sales_daily.amounts jsonb 추가
-- 안전장치:
--   1. sales_daily 기존 7개 컬럼(card/cash/...) 그대로 유지
--   2. NOT EXISTS 가드 — 중복 seed 방지
--   3. legacy_key 매핑으로 기존 마감정산/백필 호환
-- 소요 시간: 1초 이내
-- 배포 시점: Phase 1 코드 push 직전
-- ═══════════════════════════════════════════════════════════════════

-- (1) payment_methods 테이블 신설
CREATE TABLE IF NOT EXISTS payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text,
  color       text,
  sort_order  int  DEFAULT 0,
  is_active   bool DEFAULT true,
  legacy_key  text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(store_id, name)
);
CREATE INDEX IF NOT EXISTS idx_pm_store_sort ON payment_methods(store_id, sort_order);

-- (2) sales_daily.amounts 컬럼 추가 (기존 7개 컬럼은 유지)
ALTER TABLE sales_daily
  ADD COLUMN IF NOT EXISTS amounts jsonb DEFAULT '{}'::jsonb;

-- (3) seed: 모든 매장에 기본 7개 결제수단 자동 입력
INSERT INTO payment_methods (store_id, name, icon, color, sort_order, legacy_key)
SELECT s.id, v.name, v.icon, v.color, v.sort_order, v.legacy_key
FROM stores s
CROSS JOIN (VALUES
  ('신용카드',   '💳', '#0050FF', 1, 'card'),
  ('현금',       '💵', '#05C072', 2, 'cash'),
  ('현금영수증', '🧾', '#10B981', 3, 'cash_receipt'),
  ('QR',         '📱', '#14B8A6', 4, 'qr'),
  ('기타결제',   '📲', '#FF9500', 5, 'etc'),
  ('뽑기(대형)', '🎰', '#7C3AED', 6, 'extra_large'),
  ('뽑기(소형)', '🎲', '#A78BFA', 7, 'extra_small')
) AS v(name, icon, color, sort_order, legacy_key)
ON CONFLICT (store_id, name) DO NOTHING;

-- (4) 백필: 기존 sales_daily 7개 컬럼 → amounts jsonb 이동
-- legacy_key 매핑으로 method_id 찾아서 amounts에 채움
-- 이미 amounts 있는 행(신규 저장분)은 건너뜀
UPDATE sales_daily sd SET amounts =
  CASE WHEN sd.card         > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='card'),         sd.card)         ELSE '{}'::jsonb END
  || CASE WHEN sd.cash         > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='cash'),         sd.cash)         ELSE '{}'::jsonb END
  || CASE WHEN sd.cash_receipt > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='cash_receipt'), sd.cash_receipt) ELSE '{}'::jsonb END
  || CASE WHEN sd.qr           > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='qr'),           sd.qr)           ELSE '{}'::jsonb END
  || CASE WHEN sd.etc          > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='etc'),          sd.etc)          ELSE '{}'::jsonb END
  || CASE WHEN sd.extra_large  > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='extra_large'),  sd.extra_large)  ELSE '{}'::jsonb END
  || CASE WHEN sd.extra_small  > 0 THEN jsonb_build_object((SELECT id::text FROM payment_methods WHERE store_id=sd.store_id AND legacy_key='extra_small'),  sd.extra_small)  ELSE '{}'::jsonb END
WHERE (amounts IS NULL OR amounts = '{}'::jsonb);

-- 확인 쿼리
-- SELECT store_id, COUNT(*) FROM payment_methods GROUP BY store_id;
-- SELECT COUNT(*) filter(where amounts != '{}'::jsonb) as migrated, COUNT(*) as total FROM sales_daily;
