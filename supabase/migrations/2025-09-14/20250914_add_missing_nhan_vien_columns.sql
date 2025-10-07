-- Ensure expected auth-related columns exist on nhan_vien
-- Adds columns if missing to prevent RPC failures

BEGIN;

ALTER TABLE public.nhan_vien
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE public.nhan_vien
  ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false NOT NULL;

COMMIT;