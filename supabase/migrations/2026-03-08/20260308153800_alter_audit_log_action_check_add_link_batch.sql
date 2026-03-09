-- Migration: extend audit log action constraint to support batch link operations
-- Purpose: allow 'link_batch' action for suggested mapping save audit trail

BEGIN;

ALTER TABLE public.thiet_bi_nhom_audit_log
  DROP CONSTRAINT IF EXISTS thiet_bi_nhom_audit_log_action_check;

ALTER TABLE public.thiet_bi_nhom_audit_log
  ADD CONSTRAINT thiet_bi_nhom_audit_log_action_check
  CHECK (action IN ('link', 'unlink', 'link_batch'));

COMMIT;
