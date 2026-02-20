-- Migration: Fix equipment_count tenant scoping mismatch
-- Date: 2026-02-18
-- Issue: equipment_count used a single `don_vi` JWT claim for tenant scoping
--        while equipment_get and equipment_list use allowed_don_vi_for_session()
--        (which returns an array covering all tenants the session may access).
-- Impact: For regional_leader users the count was always 0 (don_vi claim is
--         NULL for that role) while the list showed equipment from all tenants
--         in their region. For other roles the count happened to be correct by
--         coincidence (single-tenant array == scalar claim).
-- Fix: Replace scalar v_donvi with v_allowed BIGINT[] from
--      allowed_don_vi_for_session() and filter with = ANY(v_allowed).
--      Also adds the missing admin → global mapping that was in the migration
--      file but never applied to the live database.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role    TEXT     := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_cnt     BIGINT;
BEGIN
  -- Map admin → global for consistency with equipment_get / equipment_list
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    -- Global/admin: count across all tenants (no tenant filter)
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    -- All other roles (regional_leader, to_qltb, technician, user, etc.):
    -- use allowed_don_vi_for_session() so the count covers exactly the same
    -- set of tenants that equipment_list returns rows for.
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_allowed)
      AND tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

COMMIT;
