-- Phase 1-A1 롤백 (2026-04-24)
-- ⚠️ 주의: 가입한 매장·직원 데이터가 있으면 복구 불가능.
-- 컬럼만 제거. 데이터는 보존됨.

-- franchises 롤백 (컬럼만)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'franchises') THEN
    ALTER TABLE franchises DROP CONSTRAINT IF EXISTS franchises_invite_code_key;
    ALTER TABLE franchises
      DROP COLUMN IF EXISTS invite_code,
      DROP COLUMN IF EXISTS owner_user_id;
  END IF;
END $$;

-- stores 롤백
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_store_code_key;
ALTER TABLE stores
  DROP COLUMN IF EXISTS store_code,
  DROP COLUMN IF EXISTS tos_accepted_at,
  DROP COLUMN IF EXISTS business_no;

-- employees 롤백
ALTER TABLE employees DROP COLUMN IF EXISTS auth_user_id;
