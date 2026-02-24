-- Migration: remove conflicting FK from thiet_bi_nhom_audit_log and validate references at insert time
-- Date: 2026-02-24
-- Reason: ON DELETE SET NULL conflicts with immutable audit trigger.

BEGIN;

LOCK TABLE public.thiet_bi_nhom_audit_log IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.thiet_bi_nhom_audit_log
  DROP CONSTRAINT IF EXISTS thiet_bi_nhom_audit_log_nhom_thiet_bi_id_fkey;

CREATE OR REPLACE FUNCTION public.validate_nhom_thiet_bi_audit_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.nhom_thiet_bi_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.nhom_thiet_bi
    WHERE id = NEW.nhom_thiet_bi_id
  ) THEN
    RAISE EXCEPTION 'Invalid nhom_thiet_bi_id % for audit log', NEW.nhom_thiet_bi_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_nhom_thiet_bi_audit_reference() IS
'Ensures audit rows reference existing categories at insert time while keeping thiet_bi_nhom_audit_log append-only.';

DROP TRIGGER IF EXISTS trg_validate_nhom_thiet_bi_audit_reference ON public.thiet_bi_nhom_audit_log;
CREATE TRIGGER trg_validate_nhom_thiet_bi_audit_reference
BEFORE INSERT ON public.thiet_bi_nhom_audit_log
FOR EACH ROW
WHEN (NEW.nhom_thiet_bi_id IS NOT NULL)
EXECUTE FUNCTION public.validate_nhom_thiet_bi_audit_reference();

COMMIT;
