-- supabase/tests/equipment_bulk_delete_smoke.sql
-- Purpose: validate equipment_bulk_delete contract and security guards
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_tenant_a BIGINT;
  v_tenant_b BIGINT;
  v_ids BIGINT[];
  v_returned_ids BIGINT[];
  v_duplicate_ids BIGINT[];
  v_guard_ids BIGINT[];
  v_null_donvi_id BIGINT;
  v_cross_tenant_ids BIGINT[];
  v_cross_tenant_deleted_id BIGINT;
  v_cross_tenant_mixed_id BIGINT;
  v_large_ids BIGINT[];
  v_response JSONB;
  v_batch_id UUID;
  v_count BIGINT;
  v_err_text TEXT;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role', 'global', 'role', 'authenticated', 'user_id', '1', 'sub', '1', 'don_vi', null)::TEXT,
    true
  );

  SELECT id
  INTO v_tenant_a
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant_a IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for smoke fixture';
  END IF;

  SELECT id
  INTO v_tenant_b
  FROM public.don_vi
  WHERE active = true
    AND id <> v_tenant_a
  ORDER BY id
  LIMIT 1;

  IF v_tenant_b IS NULL THEN
    INSERT INTO public.don_vi(name, active)
    VALUES ('Bulk delete smoke tenant ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), true)
    RETURNING id INTO v_tenant_b;
  END IF;

  -- Happy path: delete 3 active rows in one call.
  WITH inserted AS (
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
    SELECT
      format('SMK-BULK-%s-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), g.i),
      format('Bulk delete smoke %s', g.i),
      v_tenant_a
    FROM generate_series(1, 3) AS g(i)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_ids
  FROM inserted;

  v_response := public.equipment_bulk_delete(v_ids);

  IF (v_response->>'success')::BOOLEAN IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected success=true, got: %', v_response;
  END IF;

  IF (v_response->>'deleted_count')::INT <> 3 THEN
    RAISE EXCEPTION 'Expected deleted_count=3, got: %', v_response;
  END IF;

  SELECT array_agg(value::BIGINT ORDER BY value::BIGINT)
  INTO v_returned_ids
  FROM jsonb_array_elements_text(v_response->'ids');

  IF v_returned_ids IS DISTINCT FROM v_ids THEN
    RAISE EXCEPTION 'Expected ids %, got %', v_ids, v_returned_ids;
  END IF;

  v_batch_id := (v_response->>'batch_id')::UUID;
  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'Expected batch_id in response';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.thiet_bi
  WHERE id = ANY(v_ids)
    AND is_deleted = true;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 deleted rows, got: %', v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.audit_logs
  WHERE action_type = 'equipment_bulk_delete'
    AND entity_type = 'equipment'
    AND entity_id = ANY(v_ids)
    AND action_details->>'batch_id' = v_batch_id::TEXT
    AND action_details->>'batch_size' = '3';

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 audit rows with same batch metadata, got: %', v_count;
  END IF;

  -- Empty array guard.
  BEGIN
    PERFORM public.equipment_bulk_delete(ARRAY[]::BIGINT[]);
    RAISE EXCEPTION 'Expected empty-array validation error';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF position('empty' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected empty-array error, got: %', SQLERRM;
    END IF;
  END;

  -- Duplicate IDs are deduplicated.
  WITH inserted AS (
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
    SELECT
      format('SMK-BULK-DUP-%s-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), g.i),
      format('Bulk duplicate smoke %s', g.i),
      v_tenant_a
    FROM generate_series(1, 2) AS g(i)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_duplicate_ids
  FROM inserted;

  v_response := public.equipment_bulk_delete(ARRAY[v_duplicate_ids[1], v_duplicate_ids[1], v_duplicate_ids[2]]);

  IF (v_response->>'deleted_count')::INT <> 2 THEN
    RAISE EXCEPTION 'Expected deduplicated deleted_count=2, got: %', v_response;
  END IF;

  -- Already-deleted guard: all-or-nothing behavior.
  WITH inserted AS (
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
    SELECT
      format('SMK-BULK-GUARD-%s-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), g.i),
      format('Bulk guard smoke %s', g.i),
      v_tenant_a
    FROM generate_series(1, 2) AS g(i)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_guard_ids
  FROM inserted;

  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = v_guard_ids[1];

  BEGIN
    PERFORM public.equipment_bulk_delete(v_guard_ids);
    RAISE EXCEPTION 'Expected already-deleted guard error';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF position('already deleted' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected already-deleted error, got: %', SQLERRM;
    END IF;
  END;

  SELECT COUNT(*)
  INTO v_count
  FROM public.thiet_bi
  WHERE id = v_guard_ids[2]
    AND is_deleted = false;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected all-or-nothing rollback behavior for mixed deleted batch';
  END IF;

  -- Non-global users must provide don_vi claim.
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (
    format('SMK-BULK-NULL-DONVI-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')),
    'Bulk null don_vi smoke',
    null
  )
  RETURNING id INTO v_null_donvi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role', 'to_qltb', 'role', 'authenticated', 'user_id', '1', 'sub', '1', 'don_vi', null)::TEXT,
    true
  );

  BEGIN
    PERFORM public.equipment_bulk_delete(ARRAY[v_null_donvi_id]);
    RAISE EXCEPTION 'Expected missing don_vi claim error';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF SQLSTATE <> '42501' OR position('missing don_vi claim' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected 42501 missing don_vi claim error, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT COUNT(*)
  INTO v_count
  FROM public.thiet_bi
  WHERE id = v_null_donvi_id
    AND is_deleted = false;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected row to remain undeleted when don_vi claim is missing';
  END IF;

  -- Tenant isolation for non-global users.
  WITH inserted AS (
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
    VALUES
      (format('SMK-BULK-TENANT-%s-1', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')), 'Bulk tenant smoke 1', v_tenant_a),
      (format('SMK-BULK-TENANT-%s-2', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')), 'Bulk tenant smoke 2', v_tenant_b)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_cross_tenant_ids
  FROM inserted;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role', 'to_qltb', 'role', 'authenticated', 'user_id', '1', 'sub', '1', 'don_vi', v_tenant_a::TEXT)::TEXT,
    true
  );

  BEGIN
    PERFORM public.equipment_bulk_delete(v_cross_tenant_ids);
    RAISE EXCEPTION 'Expected cross-tenant not-found error';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF position('not found' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected not-found error for cross-tenant ids, got: %', SQLERRM;
    END IF;
  END;

  SELECT COUNT(*)
  INTO v_count
  FROM public.thiet_bi
  WHERE id = ANY(v_cross_tenant_ids)
    AND is_deleted = true;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected tenant-violation batch to remain unchanged';
  END IF;

  -- Cross-tenant ids are treated as missing before already-deleted checks.
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (
    format('SMK-BULK-TENANT-DELETED-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')),
    'Bulk tenant deleted smoke',
    v_tenant_b
  )
  RETURNING id INTO v_cross_tenant_deleted_id;

  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = v_cross_tenant_deleted_id;

  BEGIN
    PERFORM public.equipment_bulk_delete(ARRAY[v_cross_tenant_deleted_id]);
    RAISE EXCEPTION 'Expected not-found for cross-tenant soft-deleted row';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF SQLSTATE <> 'P0002' OR position('not found' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected P0002 not-found for cross-tenant soft-deleted row, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT COUNT(*)
  INTO v_count
  FROM public.thiet_bi
  WHERE id = v_cross_tenant_deleted_id
    AND is_deleted = true;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected cross-tenant soft-deleted row to remain unchanged';
  END IF;

  -- Mixed cross-tenant + missing must resolve to the same not-found semantics.
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (
    format('SMK-BULK-TENANT-MIXED-%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')),
    'Bulk tenant mixed smoke',
    v_tenant_b
  )
  RETURNING id INTO v_cross_tenant_mixed_id;

  BEGIN
    PERFORM public.equipment_bulk_delete(ARRAY[v_cross_tenant_mixed_id, -1::BIGINT]);
    RAISE EXCEPTION 'Expected not-found for mixed cross-tenant + missing ids';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF SQLSTATE <> 'P0002' OR position('not found' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected P0002 not-found for mixed cross-tenant + missing ids, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT COUNT(*)
  INTO v_count
  FROM public.thiet_bi
  WHERE id = v_cross_tenant_mixed_id
    AND is_deleted = false;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected mixed-case cross-tenant row to remain unchanged';
  END IF;

  -- Max size guard.
  SELECT array_agg(g.i::BIGINT) INTO v_large_ids
  FROM generate_series(1, 101) AS g(i);

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role', 'global', 'role', 'authenticated', 'user_id', '1', 'sub', '1', 'don_vi', null)::TEXT,
    true
  );

  BEGIN
    PERFORM public.equipment_bulk_delete(v_large_ids);
    RAISE EXCEPTION 'Expected >100 ids validation error';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF position('100' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected max-size error, got: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'OK: equipment_bulk_delete smoke checks passed';
END $$;

ROLLBACK;
