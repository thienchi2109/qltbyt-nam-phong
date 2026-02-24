-- Migration: Drop audit FK on chi_tiet_id and add insert-time validator
-- Applies schema-immutability + lock-ddl-safe-migration best practices

BEGIN;

LOCK TABLE public.lich_su_dinh_muc IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.lich_su_dinh_muc
  DROP CONSTRAINT IF EXISTS lich_su_dinh_muc_chi_tiet_id_fkey;

CREATE OR REPLACE FUNCTION public.validate_chi_tiet_audit_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.chi_tiet_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chi_tiet_dinh_muc WHERE id = NEW.chi_tiet_id
  ) THEN
    RAISE EXCEPTION 'Invalid chi_tiet_id % for audit log', NEW.chi_tiet_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_chi_tiet_audit_reference() IS
'Ensures audit rows reference existing line items at insert time while keeping audit table append-only.';

DROP TRIGGER IF EXISTS trg_validate_chi_tiet_audit_reference ON public.lich_su_dinh_muc;
CREATE TRIGGER trg_validate_chi_tiet_audit_reference
BEFORE INSERT ON public.lich_su_dinh_muc
FOR EACH ROW
WHEN (NEW.chi_tiet_id IS NOT NULL)
EXECUTE FUNCTION public.validate_chi_tiet_audit_reference();

COMMIT;
