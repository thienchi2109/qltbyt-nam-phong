-- Migration: Pin transfer_request_update search_path to public only
-- Date: 2026-02-20
-- Issue: SECURITY DEFINER policy requires removing pg_temp from search_path.
--        All table/function references in the body are already public.-qualified,
--        but the declarative search_path should still exclude pg_temp to prevent
--        any temp-table shadowing of public schema objects.

BEGIN;

ALTER FUNCTION public.transfer_request_update(integer, jsonb)
  SET search_path TO public;

COMMIT;
