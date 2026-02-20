-- Migration: Pin transfer_request_list_enhanced search_path to public only
-- Date: 2026-02-20
-- Issue: SECURITY DEFINER policy requires removing pg_temp from search_path.

BEGIN;

ALTER FUNCTION public.transfer_request_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT
) SET search_path TO public;

COMMIT;
