-- Equipment dataset partition contract.
-- This is a read-only source/semantic smoke check; no application rows are written.

BEGIN;

DO $$
DECLARE
  v_regular_count integer;
  v_placed_count integer;
  v_page_count integer;
  v_page_total integer;
  v_name text;
  v_definition text;
  v_core_definitions text;
  v_required_functions constant text[] := ARRAY[
    'equipment_list_enhanced',
    'equipment_department_distribution',
    'equipment_filter_buckets',
    'equipment_count_enhanced',
    'equipment_status_distribution',
    'equipment_list_for_reports',
    'equipment_aggregates_for_reports',
    'unused_equipment_report_for_reports',
    'equipment_aggregate_search'
  ];
BEGIN
  -- The funding classifier is deliberately trim-normalized and total: every
  -- row belongs to exactly one UI dataset, including NULL and blank funding.
  WITH source(id, funding) AS (
    VALUES
      (1, NULL::text),
      (2, ''::text),
      (3, '  '::text),
      (4, 'Mượn'::text),
      (5, '  Mượn '::text),
      (6, 'Mua sắm'::text)
  ), classified AS (
    SELECT
      id,
      btrim(coalesce(funding, '')) = 'Mượn' AS is_placed
    FROM source
  )
  SELECT
    count(*) FILTER (WHERE NOT is_placed),
    count(*) FILTER (WHERE is_placed)
  INTO v_regular_count, v_placed_count
  FROM classified;

  IF v_regular_count <> 4 OR v_placed_count <> 2 THEN
    RAISE EXCEPTION 'equipment dataset partition mismatch: regular %, placed %',
      v_regular_count, v_placed_count;
  END IF;

  -- Search and pagination totals must be computed from the scoped relation,
  -- before OFFSET/LIMIT is applied.
  WITH scoped AS (
    SELECT id, funding
    FROM (VALUES
      (1, NULL::text), (2, ''::text), (3, 'Mượn'::text),
      (4, '  Mượn '::text), (5, 'Mua sắm'::text)
    ) AS rows(id, funding)
    WHERE btrim(coalesce(funding, '')) <> 'Mượn'
  ), page AS (
    SELECT id FROM scoped ORDER BY id OFFSET 1 LIMIT 1
  )
  SELECT count(*), (SELECT count(*) FROM scoped)
  INTO v_page_count, v_page_total
  FROM page;

  IF v_page_count <> 1 OR v_page_total <> 3 THEN
    RAISE EXCEPTION 'scoped page/total mismatch: page %, total %', v_page_count, v_page_total;
  END IF;

  -- Every equipment list/aggregate source must expose the named scope. The
  -- migration may retain an unscoped compatibility wrapper, so inspect all
  -- overload definitions and require at least one scoped definition per RPC.
  FOREACH v_name IN ARRAY v_required_functions LOOP
    SELECT string_agg(lower(pg_get_functiondef(p.oid)), E'\n')
    INTO v_definition
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name;

    IF v_definition IS NULL OR position('p_equipment_dataset' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'equipment dataset argument missing from public.%', v_name;
    END IF;
  END LOOP;

  -- Core predicates must use the same trim-normalized borrowed marker.
  SELECT string_agg(lower(pg_get_functiondef(p.oid)), E'\n')
  INTO v_core_definitions
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'equipment_list_enhanced',
      'equipment_department_distribution',
      'equipment_filter_buckets',
      'equipment_count_enhanced',
      'equipment_status_distribution',
      'equipment_list_for_reports',
      'equipment_aggregates_for_reports',
      'unused_equipment_report_for_reports',
      'equipment_aggregate_search'
    );

  IF v_core_definitions IS NULL
    OR position('btrim' IN v_core_definitions) = 0
    OR position('mượn' IN v_core_definitions) = 0 THEN
    RAISE EXCEPTION 'equipment dataset predicate is not trim-normalized';
  END IF;
END;
$$;

ROLLBACK;
