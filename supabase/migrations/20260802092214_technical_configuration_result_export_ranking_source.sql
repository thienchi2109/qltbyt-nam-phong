-- P14A2: one ranking source for P12C1 and bounded result-export ranking pages.
-- Rollback with a new reviewed migration that drops the P14A2 ranking RPC and
-- private helpers, then restores 20260731102715 as STABLE.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_option_display_label(
  p_supplier_name TEXT,
  p_model TEXT,
  p_option_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_supplier_name || ' ' || chr(183) || ' '
    || COALESCE(p_model, p_option_name);
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_derived_status(
  p_technical_axis TEXT,
  p_evidence_axis TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_technical_axis IS NULL THEN 'not_evaluated'
    WHEN p_technical_axis = 'not_applicable' THEN 'not_applicable'
    WHEN p_technical_axis = 'fails' THEN 'fails'
    WHEN p_technical_axis = 'unclear' THEN 'unclear'
    WHEN p_evidence_axis IS NULL THEN 'not_evaluated'
    WHEN p_evidence_axis IN ('partial', 'missing') THEN 'insufficient_evidence'
    ELSE p_technical_axis
  END;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_reference_ranking_snapshot(
  p_dossier_id UUID,
  p_baseline_version_id UUID
)
RETURNS TABLE (
  option_id UUID,
  rank_value BIGINT,
  supplier_normalized_name TEXT,
  identity_label TEXT,
  ranking_item JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH canonical_criteria AS MATERIALIZED (
    SELECT criterion.id AS criterion_id
    FROM public.technical_configuration_baseline_criteria criterion
    WHERE criterion.baseline_version_id = p_baseline_version_id
  ),
  option_universe AS MATERIALIZED (
    SELECT
      option_row.id AS option_id,
      option_row.supplier_id,
      supplier.name AS supplier_name,
      supplier.normalized_name AS supplier_normalized_name,
      COALESCE(option_row.model, option_row.option_name) AS identity_label,
      public._technical_configuration_option_display_label(
        supplier.name,
        option_row.model,
        option_row.option_name
      ) AS display_label
    FROM public.technical_configuration_options option_row
    JOIN public.technical_configuration_suppliers supplier
      ON supplier.id = option_row.supplier_id
     AND supplier.dossier_id = option_row.dossier_id
    WHERE option_row.dossier_id = p_dossier_id
  ),
  scored AS MATERIALIZED (
    SELECT
      option_row.option_id,
      option_row.supplier_id,
      option_row.supplier_name,
      option_row.supplier_normalized_name,
      option_row.identity_label,
      option_row.display_label,
      CASE
        WHEN criterion.criterion_id IS NULL THEN 0
        WHEN assessment.technical_axis = 'not_applicable' THEN 0
        WHEN assessment.technical_axis IS NULL
          OR assessment.evidence_axis IS NULL THEN 1
        ELSE 0
      END AS incomplete_criterion,
      CASE WHEN criterion.criterion_id IS NULL THEN NULL
        ELSE public._technical_configuration_derived_status(
          assessment.technical_axis,
          assessment.evidence_axis
        )
      END AS derived_status
    FROM option_universe option_row
    LEFT JOIN canonical_criteria criterion ON TRUE
    LEFT JOIN public.technical_configuration_comparison_sets comparison_set
      ON comparison_set.option_id = option_row.option_id
     AND comparison_set.baseline_version_id = p_baseline_version_id
     AND comparison_set.dossier_id = p_dossier_id
    LEFT JOIN public.technical_configuration_manual_assessments assessment
      ON assessment.comparison_set_id = comparison_set.id
     AND assessment.baseline_version_id = p_baseline_version_id
     AND assessment.criterion_id = criterion.criterion_id
  ),
  aggregated AS MATERIALIZED (
    SELECT
      scored.option_id,
      scored.supplier_id,
      scored.supplier_name,
      scored.supplier_normalized_name,
      scored.identity_label,
      scored.display_label,
      COUNT(*) FILTER (WHERE scored.incomplete_criterion = 1)
        AS incomplete_criterion_count,
      COUNT(*) FILTER (WHERE scored.derived_status = 'fails') AS failed_count,
      COUNT(*) FILTER (WHERE scored.derived_status = 'insufficient_evidence')
        AS insufficient_evidence_count,
      COUNT(*) FILTER (WHERE scored.derived_status = 'exceeds') AS exceeds_count
    FROM scored
    GROUP BY
      scored.option_id,
      scored.supplier_id,
      scored.supplier_name,
      scored.supplier_normalized_name,
      scored.identity_label,
      scored.display_label
  ),
  eligible_ranked AS MATERIALIZED (
    SELECT
      aggregated.option_id,
      DENSE_RANK() OVER (
        ORDER BY
          aggregated.failed_count,
          aggregated.insufficient_evidence_count,
          aggregated.exceeds_count DESC
      ) AS rank
    FROM aggregated
    WHERE aggregated.incomplete_criterion_count = 0
  )
  SELECT
    aggregated.option_id,
    eligible.rank,
    aggregated.supplier_normalized_name,
    aggregated.identity_label,
    jsonb_build_object(
          'option_id', aggregated.option_id,
          'supplier_id', aggregated.supplier_id,
          'supplier_name', aggregated.supplier_name,
          'display_label', aggregated.display_label,
          'eligibility', CASE
            WHEN aggregated.incomplete_criterion_count = 0 THEN 'eligible'
            ELSE 'incomplete'
          END,
          'incomplete_criterion_count', aggregated.incomplete_criterion_count,
          'failed_count', aggregated.failed_count,
          'insufficient_evidence_count', aggregated.insufficient_evidence_count,
          'exceeds_count', aggregated.exceeds_count,
          'rank', eligible.rank
        )
  FROM aggregated
  LEFT JOIN eligible_ranked eligible ON eligible.option_id = aggregated.option_id;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_reference_ranking_token(
  p_dossier_id UUID,
  p_baseline_version_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT md5(concat_ws(
    '|',
    p_dossier_id::TEXT,
    p_baseline_version_id::TEXT,
    COALESCE((
      SELECT string_agg(
        concat_ws(
          ':',
          option_row.id::TEXT,
          option_row.supplier_id::TEXT,
          to_char(option_row.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
          to_char(supplier.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        ),
        ',' ORDER BY
          supplier.normalized_name,
          COALESCE(option_row.model, option_row.option_name),
          option_row.id
      )
      FROM public.technical_configuration_options option_row
      JOIN public.technical_configuration_suppliers supplier
        ON supplier.id = option_row.supplier_id
       AND supplier.dossier_id = option_row.dossier_id
      WHERE option_row.dossier_id = p_dossier_id
    ), ''),
    COALESCE((
      SELECT string_agg(
        criterion.id::TEXT,
        ',' ORDER BY group_row.sort_order, criterion.sort_order, criterion.id
      )
      FROM public.technical_configuration_baseline_criteria criterion
      JOIN public.technical_configuration_baseline_groups group_row
        ON group_row.id = criterion.group_id
       AND group_row.baseline_version_id = criterion.baseline_version_id
      WHERE criterion.baseline_version_id = p_baseline_version_id
    ), ''),
    COALESCE((
      SELECT string_agg(
        concat_ws(
          ':',
          comparison_set.id::TEXT,
          to_char(
            comparison_set.updated_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US'
          ),
          COALESCE(assessment.id::TEXT, ''),
          COALESCE(assessment.revision::TEXT, ''),
          COALESCE(assessment.technical_axis, ''),
          COALESCE(assessment.evidence_axis, '')
        ),
        ',' ORDER BY comparison_set.option_id, assessment.criterion_id
      )
      FROM public.technical_configuration_comparison_sets comparison_set
      LEFT JOIN public.technical_configuration_manual_assessments assessment
        ON assessment.comparison_set_id = comparison_set.id
       AND assessment.baseline_version_id = comparison_set.baseline_version_id
      WHERE comparison_set.dossier_id = p_dossier_id
        AND comparison_set.baseline_version_id = p_baseline_version_id
    ), '')
  ));
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_reference_ranking_list(
  p_dossier_id UUID,
  p_baseline_version_id UUID,
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_total BIGINT; v_data JSONB; v_snapshot_token TEXT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_dossier_id IS NULL OR p_baseline_version_id IS NULL
     OR p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_versions version
    WHERE version.id = p_baseline_version_id
      AND version.dossier_id = p_dossier_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  WITH ranked AS MATERIALIZED (
    SELECT
      ranking.option_id,
      ranking.rank_value,
      ranking.supplier_normalized_name,
      ranking.identity_label,
      ranking.ranking_item
    FROM public._technical_configuration_reference_ranking_snapshot(
      p_dossier_id, p_baseline_version_id
    ) ranking
  ),
  paged AS (
    SELECT ranking_item, rank_value, supplier_normalized_name, identity_label, option_id
    FROM ranked
    ORDER BY
      CASE WHEN rank_value IS NULL THEN 1 ELSE 0 END,
      rank_value, supplier_normalized_name, identity_label, option_id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT
    (SELECT count(*) FROM ranked),
    COALESCE((
      SELECT jsonb_agg(
        ranking_item ORDER BY
          CASE WHEN rank_value IS NULL THEN 1 ELSE 0 END,
          rank_value, supplier_normalized_name, identity_label, option_id
      )
      FROM paged
    ), '[]'::JSONB)
  INTO v_total, v_data;
  v_snapshot_token := public._technical_configuration_reference_ranking_token(
    p_dossier_id, p_baseline_version_id
  );
  RETURN jsonb_build_object(
    'data', v_data,
    'dossier_id', p_dossier_id,
    'baseline_version_id', p_baseline_version_id,
    'snapshot_token', v_snapshot_token,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_result_export_ranking_list(
  p_dossier_id UUID,
  p_baseline_version_id UUID,
  p_option_ids UUID[],
  p_criterion_ids UUID[],
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_snapshot JSONB; v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  v_snapshot := public._technical_configuration_result_export_snapshot(
    p_dossier_id, p_baseline_version_id, p_option_ids, p_criterion_ids
  );
  WITH selected_options AS MATERIALIZED (
    SELECT option_id::UUID
    FROM jsonb_array_elements_text(v_snapshot->'option_ids')
      WITH ORDINALITY AS selected(option_id, ordinal)
  ),
  ranked AS MATERIALIZED (
    SELECT
      ranking.option_id,
      ranking.rank_value,
      ranking.supplier_normalized_name,
      ranking.identity_label,
      ranking.ranking_item
    FROM public._technical_configuration_reference_ranking_snapshot(
      p_dossier_id, p_baseline_version_id
    ) ranking
    JOIN selected_options selected ON selected.option_id = ranking.option_id
  ),
  paged AS (
    SELECT
      option_id,
      rank_value,
      supplier_normalized_name,
      identity_label,
      ranking_item
    FROM ranked
    ORDER BY
      CASE WHEN rank_value IS NULL THEN 1 ELSE 0 END,
      rank_value, supplier_normalized_name, identity_label, option_id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT COALESCE((
    SELECT jsonb_agg(
      ranking_item ORDER BY
        CASE WHEN rank_value IS NULL THEN 1 ELSE 0 END,
        rank_value, supplier_normalized_name, identity_label, option_id
    )
    FROM paged
  ), '[]'::JSONB)
  INTO v_data;
  RETURN jsonb_build_object(
    'data', v_data,
    'dossier_id', p_dossier_id,
    'baseline_version_id', p_baseline_version_id,
    'snapshot_token', v_snapshot->'snapshot_token',
    'ranking_snapshot_token', v_snapshot->'ranking_snapshot_token',
    'total', v_snapshot->'option_total',
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_reference_ranking_snapshot(
  UUID, UUID
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_option_display_label(
  TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_option_display_label(
  TEXT, TEXT, TEXT
) TO service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_derived_status(
  TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_derived_status(
  TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_reference_ranking_snapshot(
  UUID, UUID
) TO service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_reference_ranking_token(
  UUID, UUID
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_reference_ranking_token(
  UUID, UUID
) TO service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_ranking_list(
  UUID, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_ranking_list(
  UUID, UUID, INTEGER, INTEGER
) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_result_export_ranking_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_result_export_ranking_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) TO authenticated, service_role;

COMMIT;
