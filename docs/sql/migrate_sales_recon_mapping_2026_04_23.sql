-- ═══════════════════════════════════════════════════════════════════
-- Part D: 매출 대조 매핑 컬럼 추가
-- 목적: 정산/검수의 매출 대조 섹션에서
--       매출 결제수단별로 매칭할 입금 카테고리(category_type='income') 저장
-- 구조:
--   { "card":         ["<category_id1>", ...],  -- 신용카드 매출 ↔ 카드사 입금 카테고리
--     "cash_receipt": [...],                     -- 현금영수증 (보통 매칭 없음)
--     "qr":           [...],                     -- QR 매출 ↔ QR 입금 카테고리
--     "etc":          [...]  }                   -- 기타결제 ↔ 배달앱/계좌이체 입금 카테고리
-- 소요 시간: 1초 이내
-- 롤백: drop 시 매핑 데이터 소실 (설정 다시)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS sales_recon_mapping jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN store_settings.sales_recon_mapping IS
  '매출 대조 매핑 (key: card/cash_receipt/qr/etc, value: category_id 배열 — category_type=income)';

-- 실행 후 확인
-- SELECT store_id, sales_recon_mapping FROM store_settings;
