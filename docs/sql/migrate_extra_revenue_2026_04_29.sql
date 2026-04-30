-- ═══════════════════════════════════════════════════════════════════
-- 기타매출 분리 관리: extra_revenue_items + extra_revenue_logs
-- 목적:
--   1. 뽑기 등 기타매출을 장부합계에서 분리 (매장별 항목이 달라서 합산 부적절)
--   2. 매장별 동적 항목 관리 (payment_methods 패턴 차용)
--   3. 항목별 누적 매출 표시 (마감 카드 + 대시보드)
-- 안전장치:
--   1. 기존 settlements.items_json의 extra_draw_* 키는 그대로 유지 (과거 마감 카드 보존)
--   2. NOT EXISTS 가드 — 중복 seed 방지
--   3. payment_methods의 뽑기 항목은 비활성(soft-delete) — 매출 데이터 보존
-- 소요 시간: 1초 이내 (마감 100건 가정)
-- 배포 시점: Phase 2 코드 push 직전
-- ═══════════════════════════════════════════════════════════════════

-- (1) 항목 정의 테이블
CREATE TABLE IF NOT EXISTS extra_revenue_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text DEFAULT '🎰',
  color       text DEFAULT '#7C3AED',
  sort_order  int  DEFAULT 0,
  is_active   bool DEFAULT true,
  legacy_key  text,  -- 'draw_large' / 'draw_small' / NULL(커스텀)
  created_at  timestamptz DEFAULT now(),
  UNIQUE(store_id, name)
);
CREATE INDEX IF NOT EXISTS idx_eri_store_sort ON extra_revenue_items(store_id, sort_order);

-- (2) 매출 로그 테이블 (마감과 1:N)
CREATE TABLE IF NOT EXISTS extra_revenue_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES extra_revenue_items(id) ON DELETE CASCADE,
  log_date        date NOT NULL,
  amount          int  NOT NULL CHECK (amount >= 0),
  settlement_id   uuid REFERENCES settlements(id) ON DELETE SET NULL,
  memo            text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erl_store_date ON extra_revenue_logs(store_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_erl_item ON extra_revenue_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_erl_settle ON extra_revenue_logs(settlement_id);

-- (3) seed: 모든 매장에 기본 항목(뽑기 대/소) 자동 입력
INSERT INTO extra_revenue_items (store_id, name, icon, color, sort_order, legacy_key)
SELECT s.id, v.name, v.icon, v.color, v.sort_order, v.legacy_key
FROM stores s
CROSS JOIN (VALUES
  ('뽑기(대형)', '🎰', '#7C3AED', 1, 'draw_large'),
  ('뽑기(소형)', '🎲', '#A78BFA', 2, 'draw_small')
) AS v(name, icon, color, sort_order, legacy_key)
ON CONFLICT (store_id, name) DO NOTHING;

-- (4) 백필: 기존 settlements.items_json의 extra_draw_* → extra_revenue_logs로 이관
-- NULL/문자열 방어: COALESCE + jsonb 키 존재 체크
INSERT INTO extra_revenue_logs (store_id, item_id, log_date, amount, settlement_id, memo)
SELECT s.store_id, i.id, s.settle_date,
       (s.items_json->>'extra_draw_large')::int,
       s.id, '백필(2026-04-29)'
FROM settlements s
JOIN extra_revenue_items i ON i.store_id = s.store_id AND i.legacy_key = 'draw_large'
WHERE s.items_json ? 'extra_draw_large'
  AND COALESCE((s.items_json->>'extra_draw_large')::int, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM extra_revenue_logs el
    WHERE el.settlement_id = s.id AND el.item_id = i.id
  );

INSERT INTO extra_revenue_logs (store_id, item_id, log_date, amount, settlement_id, memo)
SELECT s.store_id, i.id, s.settle_date,
       (s.items_json->>'extra_draw_small')::int,
       s.id, '백필(2026-04-29)'
FROM settlements s
JOIN extra_revenue_items i ON i.store_id = s.store_id AND i.legacy_key = 'draw_small'
WHERE s.items_json ? 'extra_draw_small'
  AND COALESCE((s.items_json->>'extra_draw_small')::int, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM extra_revenue_logs el
    WHERE el.settlement_id = s.id AND el.item_id = i.id
  );

-- (5) payment_methods의 뽑기 항목 비활성화 (결제수단 화면 + 매출관리에서 빠짐)
-- soft-delete: amounts jsonb의 기존 데이터는 그대로 보존
UPDATE payment_methods
SET is_active = false
WHERE legacy_key IN ('extra_large','extra_small') AND is_active = true;

-- 확인 쿼리
-- SELECT store_id, COUNT(*) FROM extra_revenue_items WHERE is_active GROUP BY store_id;
-- SELECT i.name, COUNT(*) AS log_count, SUM(l.amount) AS total
--   FROM extra_revenue_logs l JOIN extra_revenue_items i ON i.id = l.item_id GROUP BY i.name;
-- SELECT COUNT(*) FROM payment_methods WHERE legacy_key IN ('extra_large','extra_small') AND is_active = false;
