-- ═══════════════════════════════════════════════════════════════
-- 2026-04-21 롤백: mydata_transactions.category_id 마이그레이션 되돌림
-- ═══════════════════════════════════════════════════════════════
-- 사용: migrate_tx_category_id_to_parent.sql 적용 후 문제 발생 시
-- 전제: mydata_transactions_bak_20260421 백업 테이블이 남아있어야 함
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. 현재 테이블 임시 이름으로 (만일 대비)
ALTER TABLE mydata_transactions RENAME TO mydata_transactions_failed_20260421;

-- 2. 백업 테이블을 원복
ALTER TABLE mydata_transactions_bak_20260421 RENAME TO mydata_transactions;

-- 3. 확인 후 실패본 삭제 (수동)
-- DROP TABLE mydata_transactions_failed_20260421;

COMMIT;

-- 검증: SELECT count(*) FROM mydata_transactions;
