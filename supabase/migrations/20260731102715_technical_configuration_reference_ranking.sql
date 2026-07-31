-- P12C1: complete, read-only supplier-option reference ranking.
-- Rollback (forward-only; never edit applied history): ship a separately reviewed migration with:
-- REVOKE ALL ON FUNCTION public.technical_configuration_reference_ranking_list(
--   UUID, UUID, INTEGER, INTEGER
-- ) FROM PUBLIC, anon, authenticated, service_role;
-- DROP FUNCTION IF EXISTS public.technical_configuration_reference_ranking_list(
--   UUID, UUID, INTEGER, INTEGER
-- );
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_reference_ranking_list(
  p_dossier_id UUID,
  p_baseline_version_id UUID,
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total BIGINT;
  v_data JSONB;
  v_snapshot_token TEXT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_dossier_id IS NULL
     OR p_baseline_version_id IS NULL
     OR p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions version
    WHERE version.id = p_baseline_version_id
      AND version.dossier_id = p_dossier_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  WITH canonical_criteria AS MATERIALIZED (
    SELECT
      criterion.id AS criterion_id,
      group_row.sort_order AS group_order,
      criterion.sort_order AS criterion_order
    FROM public.technical_configuration_baseline_criteria criterion
    JOIN public.technical_configuration_baseline_groups group_row
      ON group_row.id = criterion.group_id
     AND group_row.baseline_version_id = criterion.baseline_version_id
    WHERE criterion.baseline_version_id = p_baseline_version_id
  ),
  option_universe AS MATERIALIZED (
    SELECT
      option_row.id AS option_id,
      option_row.supplier_id,
      supplier.name AS supplier_name,
      supplier.normalized_name AS supplier_normalized_name,
      COALESCE(option_row.model, option_row.option_name) AS identity_label,
      supplier.name || ' · ' || COALESCE(option_row.model, option_row.option_name)
        AS display_label,
      option_row.updated_at AS option_updated_at,
      supplier.updated_at AS supplier_updated_at
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
      criterion.criterion_id,
      CASE
        WHEN criterion.criterion_id IS NULL THEN 0
        WHEN assessment.technical_axis = 'not_applicable' THEN 0
        WHEN assessment.technical_axis IS NULL
          OR assessment.evidence_axis IS NULL THEN 1
        ELSE 0
      END AS incomplete_criterion,
      CASE
        WHEN criterion.criterion_id IS NULL THEN NULL
        WHEN assessment.technical_axis IS NULL THEN 'not_evaluated'
        WHEN assessment.technical_axis = 'not_applicable' THEN 'not_applicable'
        WHEN assessment.technical_axis = 'fails' THEN 'fails'
        WHEN assessment.technical_axis = 'unclear' THEN 'unclear'
        WHEN assessment.evidence_axis IS NULL THEN 'not_evaluated'
        WHEN assessment.evidence_axis IN ('partial', 'missing')
          THEN 'insufficient_evidence'
        ELSE assessment.technical_axis
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
  ),
  ranked_options AS MATERIALIZED (
    SELECT
      aggregated.option_id,
      aggregated.supplier_id,
      aggregated.supplier_name,
      aggregated.supplier_normalized_name,
      aggregated.identity_label,
      aggregated.display_label,
      CASE
        WHEN aggregated.incomplete_criterion_count = 0 THEN 'eligible'
        ELSE 'incomplete'
      END AS eligibility,
      aggregated.incomplete_criterion_count,
      aggregated.failed_count,
      aggregated.insufficient_evidence_count,
      aggregated.exceeds_count,
      eligible.rank
    FROM aggregated
    LEFT JOIN eligible_ranked eligible
      ON eligible.option_id = aggregated.option_id
  ),
  snapshot_identity AS MATERIALIZED (
    SELECT md5(
      concat_ws(
        '|',
        p_dossier_id::TEXT,
        p_baseline_version_id::TEXT,
        COALESCE(
          (
            SELECT string_agg(
              concat_ws(
                ':',
                snapshot_option.option_id::TEXT,
                snapshot_option.supplier_id::TEXT,
                snapshot_option.option_updated_at::TEXT,
                snapshot_option.supplier_updated_at::TEXT
              ),
              ',' ORDER BY
                snapshot_option.supplier_normalized_name,
                snapshot_option.identity_label,
                snapshot_option.option_id
            )
            FROM option_universe snapshot_option
          ),
          ''
        ),
        COALESCE(
          (
            SELECT string_agg(
              snapshot_criterion.criterion_id::TEXT,
              ',' ORDER BY
                snapshot_criterion.group_order,
                snapshot_criterion.criterion_order,
                snapshot_criterion.criterion_id
            )
            FROM canonical_criteria snapshot_criterion
          ),
          ''
        ),
        COALESCE(
          (
            SELECT string_agg(
              concat_ws(
                ':',
                comparison_set.id::TEXT,
                comparison_set.updated_at::TEXT,
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
          ),
          ''
        )
      )
    ) AS snapshot_token
  ),
  paged_options AS (
    SELECT ranked.*
    FROM ranked_options ranked
    ORDER BY
      CASE WHEN ranked.rank IS NULL THEN 1 ELSE 0 END,
      ranked.rank,
      ranked.supplier_normalized_name,
      ranked.identity_label,
      ranked.option_id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT
    (SELECT count(*) FROM ranked_options),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'option_id', paged.option_id,
            'supplier_id', paged.supplier_id,
            'supplier_name', paged.supplier_name,
            'display_label', paged.display_label,
            'eligibility', paged.eligibility,
            'incomplete_criterion_count', paged.incomplete_criterion_count,
            'failed_count', paged.failed_count,
            'insufficient_evidence_count', paged.insufficient_evidence_count,
            'exceeds_count', paged.exceeds_count,
            'rank', paged.rank
          )
          ORDER BY
            CASE WHEN paged.rank IS NULL THEN 1 ELSE 0 END,
            paged.rank,
            paged.supplier_normalized_name,
            paged.identity_label,
            paged.option_id
        )
        FROM paged_options paged
      ),
      '[]'::JSONB
    ),
    snapshot.snapshot_token
  INTO v_total, v_data, v_snapshot_token
  FROM snapshot_identity snapshot;

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

REVOKE ALL ON FUNCTION public.technical_configuration_reference_ranking_list(
  UUID, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_ranking_list(
  UUID, UUID, INTEGER, INTEGER
) TO authenticated, service_role;

COMMIT;
