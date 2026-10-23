-- Run on a disposable database with the current migrations applied:
-- psql "$DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/facility_options_dataset_behavior.sql
-- Exercises the real RPC; admin reaches the same global claim through the proxy.
BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  dataset TEXT;
  tenant_id BIGINT;
  actual JSONB;
  expected JSONB;
  failures TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT min(id) INTO tenant_id FROM public.don_vi;
  IF tenant_id IS NULL THEN
    RAISE EXCEPTION 'facility isolation test needs an existing tenant';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'role', 'authenticated', 'app_role', 'to_qltb', 'don_vi', tenant_id
  )::TEXT, TRUE);
  actual := public.get_facilities_with_equipment_count('regular');
  IF jsonb_array_length(actual) <> 1 OR (actual->0->>'id')::BIGINT IS DISTINCT FROM tenant_id THEN
    RAISE EXCEPTION 'tenant facility options escaped the permitted tenant: %', actual;
  END IF;
  RAISE NOTICE 'PASS: to_qltb facility options remain tenant-scoped';

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_role":"global"}', TRUE);

  FOREACH dataset IN ARRAY ARRAY['regular', 'placed', 'all'] LOOP
    BEGIN
      actual := public.get_facilities_with_equipment_count(dataset);

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', d.id, 'name', d.name, 'code', d.code,
          'equipment_count', COALESCE(c.equipment_count, 0)
        ) ORDER BY d.name
      ), '[]'::JSONB)
      INTO expected
      FROM public.don_vi d
      LEFT JOIN (
        SELECT don_vi, COUNT(*) AS equipment_count
        FROM public.thiet_bi
        WHERE is_deleted = FALSE
          AND CASE dataset
            WHEN 'regular' THEN btrim(COALESCE(nguon_kinh_phi, '')) <> 'Mượn'
            WHEN 'placed' THEN btrim(COALESCE(nguon_kinh_phi, '')) = 'Mượn'
            ELSE TRUE
          END
        GROUP BY don_vi
      ) c ON c.don_vi = d.id;

      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'facility options or dataset counts differ: expected %, got %', expected, actual;
      END IF;
      RAISE NOTICE 'PASS: global facility options for dataset %', dataset;
    EXCEPTION WHEN OTHERS THEN
      failures := array_append(failures, format('%s: [%s] %s', dataset, SQLSTATE, SQLERRM));
      RAISE NOTICE 'FAIL: global facility options for dataset %: [%] %', dataset, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  IF cardinality(failures) > 0 THEN
    RAISE EXCEPTION 'global facility options regression: %', array_to_string(failures, '; ');
  END IF;
END;
$$;

ROLLBACK;
