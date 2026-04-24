-- Phase 1-A1: 신규 매장 가입 플로우 지원 (2026-04-24)
-- 실행 후 신규 사장님이 앱에서 직접 매장 등록 가능
-- 모두 IF NOT EXISTS / UPDATE WHERE IS NULL 이라 여러 번 실행해도 안전

-- 1. employees: Supabase Auth 연결
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- 2. stores: 매장 고유 코드(직원 로그인용) + 약관 동의 시각 + 사업자번호
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS store_code TEXT,
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_no TEXT;

-- store_code 유니크 제약 (기존 중복 없을 때만 성립)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_store_code_key'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_store_code_key UNIQUE (store_code);
  END IF;
END $$;

-- 기존 매장에 store_code 자동 발급 (md5 해시 앞 6자리)
UPDATE stores
SET store_code = UPPER(substring(md5(id::text) from 1 for 6))
WHERE store_code IS NULL;

-- 3. franchises: 초대 코드 + 소유자 (Phase 1-A2 대비 스키마 미리 준비)
-- franchises 테이블이 존재할 때만 컬럼 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'franchises') THEN
    ALTER TABLE franchises
      ADD COLUMN IF NOT EXISTS invite_code TEXT,
      ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'franchises_invite_code_key'
    ) THEN
      ALTER TABLE franchises ADD CONSTRAINT franchises_invite_code_key UNIQUE (invite_code);
    END IF;
  END IF;
END $$;
