-- ═══════════════════════════════════════════════════════════════
-- sales_daily 테이블 신설 (매출 관리 페이지 — 가로형 피벗)
-- 일시: 2026-04-23 (리팩터: 세로 raw → 가로 피벗, 사장님 피드백)
-- 목적:
--   1) 이전 sales_records (세로 raw) 폐기 — 월 180행 쌓이면 결산 비효율
--   2) 하루 1행 가로형으로: 날짜 + 결제수단 7컬럼 + source
--   3) UI는 카드형 (컬럼 대신 리스트로 표시해 모바일 짤림 방지)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 0. 이전 설계 (sales_records) 드롭 — 없어도 IF EXISTS 로 통과
DROP TRIGGER IF EXISTS trg_sales_records_updated_at ON sales_records;
DROP FUNCTION IF EXISTS _sales_records_touch_updated_at();
DROP INDEX IF EXISTS idx_sales_records_store_date_method;
DROP INDEX IF EXISTS idx_sales_records_store_date;
DROP TABLE IF EXISTS sales_records;

-- 1. 가로형 테이블 생성
CREATE TABLE IF NOT EXISTS sales_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  card            NUMERIC NOT NULL DEFAULT 0,  -- 💳 신용카드 (POS 기준)
  cash            NUMERIC NOT NULL DEFAULT 0,  -- 💵 현금 (순수)
  cash_receipt    NUMERIC NOT NULL DEFAULT 0,  -- 🧾 현금영수증
  qr              NUMERIC NOT NULL DEFAULT 0,  -- 📱 QR (카카오페이/네이버페이/제로페이 등)
  etc             NUMERIC NOT NULL DEFAULT 0,  -- 📲 기타결제 (POS 기타 + 계좌이체 등)
  extra_large     NUMERIC NOT NULL DEFAULT 0,  -- 🎰 뽑기(대형)
  extra_small     NUMERIC NOT NULL DEFAULT 0,  -- 🎲 뽑기(소형)
  memo            TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'closing' | 'pos_api' | ...
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_sales_daily_store_date UNIQUE(store_id, date)
);

-- 2. 인덱스 (매장×월 조회)
CREATE INDEX IF NOT EXISTS idx_sales_daily_store_date
  ON sales_daily(store_id, date DESC);

-- 3. updated_at 자동 갱신
CREATE OR REPLACE FUNCTION _sales_daily_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_daily_updated_at ON sales_daily;
CREATE TRIGGER trg_sales_daily_updated_at
  BEFORE UPDATE ON sales_daily
  FOR EACH ROW EXECUTE FUNCTION _sales_daily_touch_updated_at();

-- 4. (RLS 비활성 가정) 앱 레벨 store_id 필터 강제 — dev_lessons #28

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 매출 합계 계산 (앱 레벨):
--   total = card + cash + cash_receipt + qr + etc + extra_large + extra_small
-- ═══════════════════════════════════════════════════════════════
