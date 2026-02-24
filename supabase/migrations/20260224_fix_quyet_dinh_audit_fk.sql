-- Migration: Fix quota decision delete by removing mutating FK on audit log
-- Applies Supabase Postgres best practices: schema-immutability, lock-ddl-safe-migration

BEGIN;

LOCK TABLE public.lich_su_dinh_muc IN SHARE ROW EXCLUSIVE MODE;

-- Drop FK that attempted to NULL audit rows (violates immutability trigger)
ALTER TABLE public.lich_su_dinh_muc
  DROP CONSTRAINT IF EXISTS lich_su_dinh_muc_quyet_dinh_id_fkey;

-- Validator ensures audit rows reference an existing decision at INSERT time only
CREATE OR REPLACE FUNCTION public.validate_decision_audit_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.quyet_dinh_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quyet_dinh_dinh_muc WHERE id = NEW.quyet_dinh_id
  ) THEN
    RAISE EXCEPTION 'Invalid quyet_dinh_id % for audit log', NEW.quyet_dinh_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_decision_audit_reference() IS
'Ensures audit rows reference existing decisions at insert time while keeping audit table append-only.';

DROP TRIGGER IF EXISTS trg_validate_decision_audit_reference ON public.lich_su_dinh_muc;
CREATE TRIGGER trg_validate_decision_audit_reference
BEFORE INSERT ON public.lich_su_dinh_muc
FOR EACH ROW
WHEN (NEW.quyet_dinh_id IS NOT NULL)
EXECUTE FUNCTION public.validate_decision_audit_reference();

COMMIT;
