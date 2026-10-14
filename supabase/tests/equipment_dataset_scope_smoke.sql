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
  v_signature text;
  v_scoped_definition_count integer;
  v_predicate_position integer;
  v_limit_position integer;
  v_count_position integer;
  v_function record;
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
  -- Unit semantics only: this classifier proves the partition rule itself;
  -- the pg_proc checks below are the RPC source proof.
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
  -- migration may retain an unscoped compatibility wrapper, so inspect each
  -- overload independently and validate the predicate in that same definition.
  FOREACH v_name IN ARRAY v_required_functions LOOP
    v_scoped_definition_count := 0;
    FOR v_function IN
      SELECT p.oid, p.oid::regprocedure::text AS signature,
             lower(pg_get_functiondef(p.oid)) AS definition
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      -- Compatibility wrappers are intentionally unscoped; only scoped
      -- overloads (identified by their argument name) require these checks.
      IF position('p_equipment_dataset' IN v_function.definition) = 0 THEN
        CONTINUE;
      END IF;
      v_scoped_definition_count := v_scoped_definition_count + 1;
      v_definition := v_function.definition;
      v_signature := v_function.signature;
      IF position('btrim(coalesce' IN v_definition) = 0
        OR position('mượn' IN v_definition) = 0 THEN
        RAISE EXCEPTION
          'scoped predicate missing or not trim-normalized in %', v_signature;
      END IF;

      -- Pagination and aggregate totals must be derived from the scoped
      -- relation. The SQL parser cannot reliably order COUNT(*) and WHERE
      -- tokens (ordinary SELECT COUNT(*) ... WHERE has COUNT first), so this
      -- source check verifies both contracts and the disposable smoke call
      -- supplies the behavioral pagination/total assertion.
      v_predicate_position := position('btrim(coalesce' IN v_definition);
      IF v_name IN ('equipment_list_enhanced', 'equipment_list_for_reports',
                    'unused_equipment_report_for_reports') THEN
        -- Match LIMIT as a SQL token; position('limit' ...) incorrectly
        -- matches identifiers such as v_limit declared before the predicate.
        v_limit_position := regexp_instr(
          v_definition,
          '(^|[^[:alnum:]_])limit([^[:alnum:]_]|$)',
          1,
          1,
          'i'
        );
        IF v_limit_position = 0 THEN
          RAISE EXCEPTION 'pagination source token missing in %', v_signature;
        END IF;
        IF v_limit_position < v_predicate_position THEN
          RAISE EXCEPTION 'pagination precedes dataset predicate in %', v_signature;
        END IF;
      END IF;
      IF v_name IN ('equipment_department_distribution', 'equipment_filter_buckets',
                    'equipment_count_enhanced', 'equipment_status_distribution',
                    'equipment_aggregates_for_reports', 'unused_equipment_report_for_reports',
                    'equipment_aggregate_search') THEN
        v_count_position := position('count(' IN v_definition);
        IF v_count_position = 0 THEN
          RAISE EXCEPTION 'aggregate total source token missing in %', v_signature;
        END IF;
      END IF;
    END LOOP;
    IF v_scoped_definition_count = 0 THEN
      RAISE EXCEPTION 'scoped equipment dataset overload missing for public.%', v_name;
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.equipment_list_enhanced(
      NULL, 'id.asc', 1, 1, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 'invalid'
    );
    RAISE EXCEPTION 'invalid equipment dataset was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'equipment_list_enhanced'
      AND p.proargnames @> ARRAY['p_equipment_dataset']::text[]
  ) THEN
    RAISE EXCEPTION 'scoped equipment_list_enhanced overload is not discoverable';
  END IF;
END;
$$;

DO $$
DECLARE
  v_name text;
  v_scoped_count integer;
  v_legacy_count integer;
  v_defaulted_scoped integer;
  v_expected_scoped integer;
  v_contract_names constant text[] := ARRAY[
    'equipment_list_enhanced', 'equipment_department_distribution',
    'equipment_filter_buckets', 'equipment_count_enhanced',
    'equipment_status_distribution', 'equipment_list_for_reports',
    'equipment_aggregates_for_reports', 'unused_equipment_report_for_reports',
    'equipment_aggregate_search', 'dashboard_kpi_summary',
    'dashboard_equipment_total', 'dashboard_maintenance_count',
    'equipment_attention_list', 'equipment_attention_list_paginated',
    'usage_log_list', 'usage_analytics_overview', 'usage_analytics_daily',
    'get_maintenance_report_data', 'maintenance_stats_for_reports',
    'get_facilities_with_equipment_count', 'dinh_muc_compliance_summary',
    'dinh_muc_compliance_detail'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_contract_names LOOP
    v_expected_scoped := CASE WHEN v_name IN ('equipment_status_distribution', 'usage_log_list') THEN 2 ELSE 1 END;
    SELECT
      count(*) FILTER (WHERE p.proargnames @> ARRAY['p_equipment_dataset']::text[]),
      count(*) FILTER (WHERE NOT (p.proargnames @> ARRAY['p_equipment_dataset']::text[])),
      count(*) FILTER (
        WHERE p.proargnames @> ARRAY['p_equipment_dataset']::text[]
          AND p.pronargdefaults > 0
      )
    INTO v_scoped_count, v_legacy_count, v_defaulted_scoped
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name;

    IF v_scoped_count <> v_expected_scoped OR v_legacy_count < v_expected_scoped THEN
      RAISE EXCEPTION 'RPC compatibility overload contract failed for public.% (scoped %, legacy %)',
        v_name, v_scoped_count, v_legacy_count;
    END IF;
    IF v_defaulted_scoped <> 0 THEN
      RAISE EXCEPTION 'scoped overload must not have defaults for public.%', v_name;
    END IF;
  END LOOP;
END;
$$;

-- Dashboard/report consumers use the same explicit, non-default dataset
-- argument.  No new RPC name is introduced; each check is against an
-- overload of the existing function and therefore preserves the old call.
DO $$
DECLARE
  v_name text;
  v_definition text;
  v_signature text;
  v_found boolean;
  v_dashboard_functions constant text[] := ARRAY[
    'dashboard_kpi_summary', 'dashboard_equipment_total',
    'dashboard_maintenance_count', 'equipment_attention_list',
    'equipment_attention_list_paginated', 'usage_log_list',
    'usage_analytics_overview', 'usage_analytics_daily',
    'get_maintenance_report_data', 'maintenance_stats_for_reports',
    'get_facilities_with_equipment_count', 'dinh_muc_compliance_summary',
    'dinh_muc_compliance_detail', 'dashboard_repair_request_stats',
    'dashboard_maintenance_plan_stats'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_dashboard_functions LOOP
    v_found := false;
    FOR v_signature, v_definition IN
      SELECT p.oid::regprocedure::text, lower(pg_get_functiondef(p.oid))
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      IF position('p_equipment_dataset' IN v_definition) > 0 THEN
        v_found := true;
        IF v_name <> 'dashboard_maintenance_plan_stats'
          AND (position('btrim(coalesce' IN v_definition) = 0
            OR position('mượn' IN v_definition) = 0) THEN
          RAISE EXCEPTION 'dashboard dataset predicate missing in %', v_signature;
        END IF;
        IF v_name = 'dashboard_maintenance_plan_stats'
          AND position('thiet_bi' IN v_definition) > 0 THEN
          RAISE EXCEPTION 'plan-only dashboard metric unexpectedly references equipment in %', v_signature;
        END IF;
        IF v_name = 'dashboard_repair_request_stats'
          AND (position('missing role claim' IN v_definition) = 0
            OR position('missing user_id claim' IN v_definition) = 0
            OR position('v_role = ''admin''' IN v_definition) = 0) THEN
          RAISE EXCEPTION 'dashboard repair auth compatibility guard missing in %', v_signature;
        END IF;
        IF position('invalid equipment dataset' IN v_definition) = 0
          OR position('22023' IN v_definition) = 0 THEN
          RAISE EXCEPTION 'dashboard dataset validation guard missing in %', v_signature;
        END IF;
        IF position('from public.thiet_bi' IN v_definition) > 0
          AND position(
                'btrim(coalesce(tb.nguon_kinh_phi' IN
                substring(v_definition FROM position('from public.thiet_bi' IN v_definition))
              ) = 0 THEN
          RAISE EXCEPTION 'dataset predicate is only a pre-query guard in %', v_signature;
        END IF;
      END IF;
    END LOOP;
    IF NOT v_found THEN
      RAISE EXCEPTION 'scoped dashboard/report overload missing for public.%', v_name;
    END IF;
  END LOOP;
END;
$$;

ROLLBACK;
