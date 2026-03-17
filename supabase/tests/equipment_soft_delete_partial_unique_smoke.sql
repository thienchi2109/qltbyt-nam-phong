-- supabase/tests/equipment_soft_delete_partial_unique_smoke.sql
-- Purpose: Verify partial unique index on ma_thiet_bi scoped to active equipment,
--          and restore guard that prevents restoring when code is already in use.
-- Non-destructive: wrapped in transaction and rolled back.
--
-- Expected results:
--   BEFORE migration: Tests 1 & 4 will FAIL (global unique blocks code reuse)
--   AFTER  migration: All 5 tests PASS

BEGIN;

DO $$
DECLARE
  v_tenant BIGINT;
  v_id_a BIGINT;
  v_id_b BIGINT;
  v_is_deleted BOOLEAN;
  v_err_code TEXT;
  v_err_msg TEXT;
  v_code_reuse TEXT := 'PUIDX-REUSE-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_code_dup TEXT := 'PUIDX-DUP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_code_guard TEXT := 'PUIDX-GUARD-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_code_resok TEXT := 'PUIDX-RESOK-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
BEGIN
  -- Setup: global user JWT
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', null
    )::text,
    true
  );

  SELECT id INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for smoke fixture';
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- TEST 1: Code reuse after soft-delete should succeed
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_reuse, 'Original equipment', v_tenant)
  RETURNING id INTO v_id_a;

  PERFORM public.equipment_delete(v_id_a);

  -- Insert with same code — should succeed with partial unique index
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_reuse, 'Reused equipment', v_tenant)
  RETURNING id INTO v_id_b;

  IF v_id_b IS NULL THEN
    RAISE EXCEPTION 'TEST 1 FAIL: Code reuse after soft-delete should succeed';
  END IF;
  RAISE NOTICE 'TEST 1 PASS: Code reuse after soft-delete works (old_id=%, new_id=%)', v_id_a, v_id_b;

  -- ═══════════════════════════════════════════════════════════════════
  -- TEST 2: Active duplicate still blocked
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_dup, 'First active', v_tenant);

  BEGIN
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
    VALUES (v_code_dup, 'Second active', v_tenant);

    RAISE EXCEPTION 'TEST 2 FAIL: Active duplicate should be blocked';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 2 PASS: Active duplicate correctly blocked';
  END;

  -- ═══════════════════════════════════════════════════════════════════
  -- TEST 3: Partial unique index exists (schema check)
  -- ═══════════════════════════════════════════════════════════════════
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'thiet_bi_ma_thiet_bi_key'
      AND conrelid = 'public.thiet_bi'::regclass
  ) THEN
    RAISE EXCEPTION 'TEST 3 FAIL: Old constraint thiet_bi_ma_thiet_bi_key should be dropped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'thiet_bi'
      AND indexname = 'idx_thiet_bi_ma_unique_active'
      AND indexdef ILIKE '%lower(ma_thiet_bi)%'
      AND indexdef ILIKE '%WHERE%is_deleted%false%'
  ) THEN
    RAISE EXCEPTION 'TEST 3 FAIL: Partial unique index idx_thiet_bi_ma_unique_active with lower() not found';
  END IF;
  RAISE NOTICE 'TEST 3 PASS: Partial unique index uses lower(ma_thiet_bi), old constraint removed';

  -- ═══════════════════════════════════════════════════════════════════
  -- TEST 4: Restore guard — code conflict prevents restore
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_guard, 'Equipment A', v_tenant)
  RETURNING id INTO v_id_a;

  PERFORM public.equipment_delete(v_id_a);

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_guard, 'Equipment B (reused code)', v_tenant);

  BEGIN
    PERFORM public.equipment_restore(v_id_a);
    RAISE EXCEPTION 'TEST 4 FAIL: Restore should fail when code is in use by active equipment';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 4 PASS: Restore correctly blocked by code conflict (unique_violation)';
  END;

  -- ═══════════════════════════════════════════════════════════════════
  -- TEST 5: Restore without conflict still works
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_resok, 'Restorable', v_tenant)
  RETURNING id INTO v_id_a;

  PERFORM public.equipment_delete(v_id_a);
  PERFORM public.equipment_restore(v_id_a);

  SELECT is_deleted INTO v_is_deleted
  FROM public.thiet_bi
  WHERE id = v_id_a;

  IF v_is_deleted IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'TEST 5 FAIL: Restore should succeed when no code conflict';
  END IF;
  RAISE NOTICE 'TEST 5 PASS: Restore without conflict works';

  -- ═══════════════════════════════════════════════════════════════════
  -- TEST 6: Case-insensitive duplicate blocked
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code_resok || '-CI', 'CaseSensitive', v_tenant);

  BEGIN
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
    VALUES (lower(v_code_resok || '-CI'), 'lowercase dup', v_tenant);

    RAISE EXCEPTION 'TEST 6 FAIL: Case-insensitive duplicate should be blocked';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 6 PASS: Case-insensitive duplicate correctly blocked';
  END;

  -- Summary
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'ALL 6 TESTS PASSED';
  RAISE NOTICE '══════════════════════════════════════════';
END $$;

ROLLBACK;
