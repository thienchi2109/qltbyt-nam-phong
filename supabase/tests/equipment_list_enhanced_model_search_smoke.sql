-- supabase/tests/equipment_list_enhanced_model_search_smoke.sql
-- Purpose: smoke-test equipment_list_enhanced model search using existing live data.
-- Read-only: does not create test data; wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_candidate record;
  v_payload jsonb;
BEGIN
  SELECT
    tb.id,
    tb.don_vi,
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model,
    tb.serial,
    tb.so_luu_hanh,
    trim(tb.model) AS search_text
  INTO v_candidate
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND tb.don_vi IS NOT NULL
    AND nullif(trim(tb.model), '') IS NOT NULL
    AND length(trim(tb.model)) >= 4
    AND trim(tb.model) NOT LIKE '%\%%' ESCAPE '\'
    AND trim(tb.model) NOT LIKE '%\_%' ESCAPE '\'
    AND trim(tb.model) NOT LIKE '%\\%' ESCAPE '\'
    AND coalesce(tb.ten_thiet_bi, '') NOT ILIKE '%' || trim(tb.model) || '%'
    AND coalesce(tb.ma_thiet_bi, '') NOT ILIKE '%' || trim(tb.model) || '%'
    AND coalesce(tb.serial, '') NOT ILIKE '%' || trim(tb.model) || '%'
    AND coalesce(tb.so_luu_hanh, '') NOT ILIKE '%' || trim(tb.model) || '%'
  ORDER BY tb.id
  LIMIT 1;

  IF v_candidate.id IS NULL THEN
    RAISE EXCEPTION 'Cannot run smoke: no model-only searchable equipment found';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'global',
      'user_id', '3383001',
      'don_vi', ''
    )::text,
    true
  );

  v_payload := public.equipment_list_enhanced(
    v_candidate.search_text,
    'id.asc',
    1,
    50,
    v_candidate.don_vi,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  );

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE (row_value->>'id')::bigint = v_candidate.id
      AND row_value->>'model' = v_candidate.model
  ) THEN
    RAISE EXCEPTION
      'Scenario failed: equipment_list_enhanced should find id % by model-only search text "%"; payload=%',
      v_candidate.id,
      v_candidate.search_text,
      v_payload;
  END IF;

  RAISE NOTICE
    'equipment_list_enhanced_model_search smoke: found id % by model "%"',
    v_candidate.id,
    v_candidate.model;
END;
$$;

ROLLBACK;
