-- P12B2: server-filtered criterion IDs for guarded evaluation navigation.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_evaluation_criteria_list(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_status_filter TEXT,
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_comparison_page_size CONSTANT INTEGER := 50;
  v_dossier_id UUID;
  v_total BIGINT;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_option_id IS NULL
     OR p_baseline_version_id IS NULL
     OR p_status_filter IS NULL
     OR p_status_filter NOT IN ('all', 'not_evaluated', 'fails', 'insufficient_evidence')
     OR p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT version.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_baseline_versions version
  WHERE version.id = p_baseline_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_options option_row
    WHERE option_row.id = p_option_id
      AND option_row.dossier_id = v_dossier_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  WITH canonical_criteria AS MATERIALIZED (
    SELECT
      group_row.sort_order AS group_order,
      criterion.sort_order AS criterion_order,
      criterion.id AS criterion_id,
      row_number() OVER (
        ORDER BY group_row.sort_order, criterion.sort_order, criterion.id
      ) AS canonical_index,
      CASE
        WHEN assessment.technical_axis IS NULL THEN 'not_evaluated'
        WHEN assessment.technical_axis = 'not_applicable' THEN 'not_applicable'
        WHEN assessment.technical_axis = 'fails' THEN 'fails'
        WHEN assessment.technical_axis = 'unclear' THEN 'unclear'
        WHEN assessment.evidence_axis IS NULL THEN 'not_evaluated'
        WHEN assessment.evidence_axis IN ('partial', 'missing')
          THEN 'insufficient_evidence'
        ELSE assessment.technical_axis
      END AS derived_status
    FROM public.technical_configuration_baseline_criteria criterion
    JOIN public.technical_configuration_baseline_groups group_row
      ON group_row.id = criterion.group_id
     AND group_row.baseline_version_id = criterion.baseline_version_id
    LEFT JOIN public.technical_configuration_comparison_sets comparison_set
      ON comparison_set.option_id = p_option_id
     AND comparison_set.baseline_version_id = p_baseline_version_id
    LEFT JOIN public.technical_configuration_manual_assessments assessment
      ON assessment.comparison_set_id = comparison_set.id
     AND assessment.baseline_version_id = criterion.baseline_version_id
     AND assessment.criterion_id = criterion.id
    WHERE criterion.baseline_version_id = p_baseline_version_id
  ),
  filtered_criteria AS MATERIALIZED (
    SELECT
      canonical.group_order,
      canonical.criterion_order,
      canonical.criterion_id,
      canonical.canonical_index,
      ((canonical.canonical_index - 1) / v_comparison_page_size) + 1 AS canonical_page
    FROM canonical_criteria canonical
    WHERE p_status_filter = 'all'
       OR canonical.derived_status = p_status_filter
  ),
  paged_criteria AS (
    SELECT *
    FROM filtered_criteria filtered
    ORDER BY filtered.group_order, filtered.criterion_order, filtered.criterion_id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT
    (SELECT count(*) FROM filtered_criteria),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'criterion_id', paged.criterion_id,
          'canonical_index', paged.canonical_index,
          'canonical_page', paged.canonical_page
        )
        ORDER BY paged.group_order, paged.criterion_order, paged.criterion_id
      ),
      '[]'::JSONB
    )
  INTO v_total, v_data
  FROM paged_criteria paged;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_evaluation_criteria_list(
  UUID, UUID, TEXT, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_evaluation_criteria_list(
  UUID, UUID, TEXT, INTEGER, INTEGER
) TO authenticated, service_role;

COMMIT;
