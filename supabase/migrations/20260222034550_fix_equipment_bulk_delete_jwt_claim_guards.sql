-- Migration: enforce mandatory JWT claim guards in equipment_bulk_delete
-- Date: 2026-02-22
-- Fixes:
--   - Add explicit missing-role guard
--   - Add missing user_id extraction and guard
--   - Keep non-global don_vi guard as mandatory

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_bulk_delete(p_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_is_global BOOLEAN := false;
  v_expected_count INTEGER;
  v_count INTEGER;
  v_missing_ids BIGINT[];
  v_already_deleted_ids BIGINT[];
  v_cross_tenant_ids BIGINT[];
  v_batch_id UUID := gen_random_uuid();
  v_row RECORD;
BEGIN
  -- Mandatory JWT claim guards for write RPCs.
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  v_is_global := v_role = 'global';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_global AND v_donvi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  -- Permission check: only global/to_qltb can delete (allow-list).
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Input validation.
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'p_ids must not be null or empty' USING ERRCODE = '22023';
  END IF;

  -- Critical: deduplicate before count-based validations and row-count assertions.
  p_ids := ARRAY(SELECT DISTINCT unnest(p_ids));
  v_expected_count := array_length(p_ids, 1);

  IF v_expected_count > 100 THEN
    RAISE EXCEPTION 'Bulk delete supports at most 100 ids per call' USING ERRCODE = '22023';
  END IF;

  -- Lock rows in deterministic order to prevent deadlocks.
  CREATE TEMP TABLE IF NOT EXISTS _equipment_bulk_delete_locked (
    id BIGINT PRIMARY KEY,
    don_vi BIGINT,
    is_deleted BOOLEAN,
    ma_thiet_bi TEXT,
    ten_thiet_bi TEXT
  ) ON COMMIT DROP;

  TRUNCATE TABLE _equipment_bulk_delete_locked;

  INSERT INTO _equipment_bulk_delete_locked (id, don_vi, is_deleted, ma_thiet_bi, ten_thiet_bi)
  SELECT tb.id, tb.don_vi, tb.is_deleted, tb.ma_thiet_bi, tb.ten_thiet_bi
  FROM public.thiet_bi tb
  WHERE tb.id = ANY(p_ids)
  ORDER BY tb.id
  FOR UPDATE;

  SELECT count(*) INTO v_count
  FROM _equipment_bulk_delete_locked;

  IF NOT v_is_global THEN
    SELECT ARRAY(
      SELECT l.id
      FROM _equipment_bulk_delete_locked l
      WHERE l.don_vi IS DISTINCT FROM v_donvi
      ORDER BY l.id
    ) INTO v_cross_tenant_ids;

    IF COALESCE(array_length(v_cross_tenant_ids, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Access denied for equipment ids: %', array_to_string(v_cross_tenant_ids, ', ')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_count <> v_expected_count THEN
    SELECT ARRAY(
      SELECT req.id
      FROM unnest(p_ids) AS req(id)
      LEFT JOIN _equipment_bulk_delete_locked l ON l.id = req.id
      WHERE l.id IS NULL
      ORDER BY req.id
    ) INTO v_missing_ids;

    RAISE EXCEPTION 'Equipment ids not found: %', array_to_string(v_missing_ids, ', ')
      USING ERRCODE = 'P0002';
  END IF;

  SELECT ARRAY(
    SELECT l.id
    FROM _equipment_bulk_delete_locked l
    WHERE l.is_deleted IS DISTINCT FROM false
    ORDER BY l.id
  ) INTO v_already_deleted_ids;

  IF COALESCE(array_length(v_already_deleted_ids, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Equipment not found or already deleted: %', array_to_string(v_already_deleted_ids, ', ')
      USING ERRCODE = 'P0002';
  END IF;

  -- Defense in depth: keep deletion constraints in UPDATE.
  UPDATE public.thiet_bi tb
  SET is_deleted = true
  WHERE tb.id = ANY(p_ids)
    AND tb.is_deleted = false
    AND (v_is_global OR tb.don_vi = v_donvi);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> v_expected_count THEN
    RAISE EXCEPTION 'Bulk delete row count mismatch (expected %, got %)', v_expected_count, v_count
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_row IN
    SELECT l.id, l.ma_thiet_bi, l.ten_thiet_bi, l.don_vi
    FROM _equipment_bulk_delete_locked l
    ORDER BY l.id
  LOOP
    PERFORM public.audit_log(
      p_action_type := 'equipment_bulk_delete',
      p_entity_type := 'equipment',
      p_entity_id := v_row.id,
      p_entity_label := COALESCE(v_row.ma_thiet_bi, v_row.ten_thiet_bi, 'equipment-' || v_row.id::TEXT),
      p_action_details := jsonb_build_object(
        'soft_deleted', true,
        'id', v_row.id,
        'ma_thiet_bi', v_row.ma_thiet_bi,
        'ten_thiet_bi', v_row.ten_thiet_bi,
        'don_vi', v_row.don_vi,
        'batch_id', v_batch_id,
        'batch_size', v_expected_count
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_expected_count,
    'ids', COALESCE(
      (SELECT jsonb_agg(l.id ORDER BY l.id) FROM _equipment_bulk_delete_locked l),
      '[]'::JSONB
    ),
    'batch_id', v_batch_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_bulk_delete(BIGINT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_bulk_delete(BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.equipment_bulk_delete(BIGINT[]) IS
  'Bulk soft-delete for equipment. Enforces mandatory JWT claims (role, user_id, don_vi for non-global).';

COMMIT;

