-- ═══════════════════════════════════════════════════════════════════
-- 롤백: 기타매출 분리 관리
-- 사용 시점: 마이그레이션 직후 문제 발견 시
-- 효과:
--   1. extra_revenue_logs / extra_revenue_items 테이블 삭제
--   2. payment_methods의 뽑기 항목 다시 활성화
-- 주의: 백필 이후 신규 입력된 logs 데이터도 삭제됨 (배포 직후 사용)
-- ═══════════════════════════════════════════════════════════════════

-- (1) payment_methods 뽑기 항목 복원
UPDATE payment_methods
SET is_active = true
WHERE legacy_key IN ('extra_large','extra_small');

-- (2) 로그 테이블 삭제 (FK 의존 → 먼저 삭제)
DROP TABLE IF EXISTS extra_revenue_logs;

-- (3) 항목 테이블 삭제
DROP TABLE IF EXISTS extra_revenue_items;

-- 확인
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'extra_revenue_%';
-- SELECT name, is_active FROM payment_methods WHERE legacy_key IN ('extra_large','extra_small');
