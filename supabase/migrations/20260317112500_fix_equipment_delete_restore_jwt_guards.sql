-- Migration: Add mandatory JWT claim guards to equipment_delete and equipment_restore
-- Date: 2026-03-17
--
-- Fixes:
--   1. Add v_user_id declaration + 3 mandatory JWT claim guards to both functions
--      (matches pattern from equipment_bulk_delete)
--   2. Move role null check BEFORE admin→global normalization (correct guard order)
--   3. Add don_vi null check for non-global users
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards (allow-list),
--           tenant isolation, FOR UPDATE row locking, audit logging.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- PART 1: equipment_restore — add JWT claim guards
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.equipment_restore(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_code TEXT;
  v_name TEXT;
  v_row_don_vi BIGINT;
  v_is_deleted BOOLEAN;
  v_tenant_active BOOLEAN;
BEGIN
  -- Mandatory JWT claim guards for write RPCs.
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  -- Normalize admin → global (aligns with newer RPCs)
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' AND v_donvi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  -- Permission check: only global/to_qltb can restore (allow-list)
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Atomic read with row lock (prevents TOCTOU race condition)
  SELECT tb.ma_thiet_bi, tb.ten_thiet_bi, tb.don_vi, tb.is_deleted
  INTO v_code, v_name, v_row_don_vi, v_is_deleted
  FROM public.thiet_bi tb
  WHERE tb.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Tenant isolation check
  IF v_role <> 'global' AND v_row_don_vi IS DISTINCT FROM v_donvi THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_is_deleted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Equipment not found or not deleted' USING ERRCODE = 'P0002';
  END IF;

  IF v_row_don_vi IS NULL THEN
    RAISE EXCEPTION 'Cannot restore equipment without tenant assignment'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT dv.active
  INTO v_tenant_active
  FROM public.don_vi dv
  WHERE dv.id = v_row_don_vi;

  IF NOT FOUND OR v_tenant_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cannot restore equipment because tenant is missing or inactive'
      USING ERRCODE = 'P0001';
  END IF;

  -- Code-conflict guard — prevent restore if code is already used by active equipment
  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(v_code)
      AND is_deleted = false
      AND id <> p_id
  ) THEN
    RAISE EXCEPTION 'Cannot restore: equipment code "%" is already in use by active equipment', v_code
      USING ERRCODE = '23505';
  END IF;

  -- Defense in depth: keep deletion constraints in UPDATE
  UPDATE public.thiet_bi
  SET is_deleted = false
  WHERE id = p_id
    AND is_deleted = true
    AND (v_role = 'global' OR don_vi = v_donvi);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or already restored'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.audit_log(
    p_action_type := 'equipment_restore',
    p_entity_type := 'equipment',
    p_entity_id := p_id,
    p_entity_label := COALESCE(v_code, v_name, 'equipment-' || p_id::text),
    p_action_details := jsonb_build_object(
      'restored', true,
      'id', p_id,
      'ma_thiet_bi', v_code,
      'ten_thiet_bi', v_name,
      'don_vi', v_row_don_vi
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_id, 'restored', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_restore(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_restore(BIGINT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: equipment_delete — add JWT claim guards
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.equipment_delete(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_code TEXT;
  v_name TEXT;
  v_row_don_vi BIGINT;
  v_is_deleted BOOLEAN;
BEGIN
  -- Mandatory JWT claim guards for write RPCs.
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  -- Normalize admin → global (aligns with newer RPCs)
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' AND v_donvi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  -- Permission check: only global/to_qltb can delete (allow-list)
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Atomic read with row lock (prevents TOCTOU race condition)
  SELECT tb.ma_thiet_bi, tb.ten_thiet_bi, tb.don_vi, tb.is_deleted
  INTO v_code, v_name, v_row_don_vi, v_is_deleted
  FROM public.thiet_bi tb
  WHERE tb.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Tenant isolation check AFTER locking row
  IF v_role <> 'global' AND v_row_don_vi IS DISTINCT FROM v_donvi THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  -- Check not already deleted
  IF v_is_deleted IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Equipment not found or already deleted' USING ERRCODE = 'P0002';
  END IF;

  -- Soft delete with tenant filter (defense-in-depth)
  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = p_id
    AND is_deleted = false
    AND (v_role = 'global' OR don_vi = v_donvi);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or already deleted'
      USING ERRCODE = 'P0002';
  END IF;

  -- Audit log
  PERFORM public.audit_log(
    p_action_type := 'equipment_delete',
    p_entity_type := 'equipment',
    p_entity_id := p_id,
    p_entity_label := COALESCE(v_code, v_name, 'equipment-' || p_id::text),
    p_action_details := jsonb_build_object(
      'soft_deleted', true,
      'id', p_id,
      'ma_thiet_bi', v_code,
      'ten_thiet_bi', v_name,
      'don_vi', v_row_don_vi
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_id, 'soft_deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_delete(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_delete(BIGINT) TO authenticated;

COMMIT;
