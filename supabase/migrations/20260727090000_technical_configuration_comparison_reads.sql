-- P10A1: bounded, side-effect-free comparison matrix read.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_comparison_get(
  p_baseline_version_id UUID,
  p_option_ids UUID[],
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_option_count BIGINT;
  v_distinct_option_count BIGINT;
  v_valid_option_count BIGINT;
  v_total BIGINT;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  v_option_count := COALESCE(array_length(p_option_ids, 1), 0);
  IF p_baseline_version_id IS NULL
     OR p_option_ids IS NULL
     OR array_ndims(p_option_ids) IS DISTINCT FROM 1
     OR v_option_count < 1
     OR v_option_count > 8
     OR array_position(p_option_ids, NULL) IS NOT NULL
     OR p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT
    COUNT(*),
    COUNT(DISTINCT requested.option_id)
  INTO v_option_count, v_distinct_option_count
  FROM unnest(p_option_ids) AS requested(option_id);

  IF v_option_count IS DISTINCT FROM v_distinct_option_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT v.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT COUNT(*)
  INTO v_valid_option_count
  FROM unnest(p_option_ids) AS requested(option_id)
  JOIN public.technical_configuration_options o
    ON o.id = requested.option_id
   AND o.dossier_id = v_dossier_id;

  IF v_valid_option_count IS DISTINCT FROM v_option_count THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT COUNT(*)
  INTO v_total
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = p_baseline_version_id;

  WITH selected_options AS (
    SELECT
      requested.ordinal,
      o.id AS option_id,
      o.supplier_id,
      s.name AS supplier_name,
      o.model,
      o.manufacturer,
      o.option_name,
      s.name || ' · ' || COALESCE(o.model, o.option_name) AS display_label
    FROM unnest(p_option_ids) WITH ORDINALITY AS requested(option_id, ordinal)
    JOIN public.technical_configuration_options o
      ON o.id = requested.option_id
     AND o.dossier_id = v_dossier_id
    JOIN public.technical_configuration_suppliers s
      ON s.id = o.supplier_id
     AND s.dossier_id = o.dossier_id
  ),
  paged_criteria AS (
    SELECT
      g.id AS group_id,
      g.name AS group_name,
      g.sort_order AS group_sort_order,
      c.id AS criterion_id,
      c.criterion_code,
      c.title,
      c.requirement_text,
      c.sort_order AS criterion_sort_order,
      c.baseline_version_id
    FROM public.technical_configuration_baseline_criteria c
    JOIN public.technical_configuration_baseline_groups g
      ON g.id = c.group_id
     AND g.baseline_version_id = c.baseline_version_id
    WHERE c.baseline_version_id = p_baseline_version_id
    ORDER BY g.sort_order, c.sort_order, c.id
    LIMIT p_page_size
    OFFSET ((p_page::BIGINT - 1) * p_page_size::BIGINT)
  ),
  baseline_evidence AS (
    SELECT
      paged.criterion_id,
      COUNT(DISTINCT citation.baseline_document_id) AS document_total,
      COUNT(citation.id) AS citation_total
    FROM paged_criteria paged
    LEFT JOIN public.technical_configuration_baseline_citations citation
      ON citation.criterion_id = paged.criterion_id
     AND citation.baseline_version_id = paged.baseline_version_id
    GROUP BY paged.criterion_id
  ),
  option_evidence AS (
    SELECT
      selected.option_id,
      paged.criterion_id,
      COUNT(DISTINCT citation.option_document_id) AS document_total,
      COUNT(citation.id) AS citation_total
    FROM selected_options selected
    CROSS JOIN paged_criteria paged
    LEFT JOIN public.technical_configuration_comparison_sets comparison_set
      ON comparison_set.option_id = selected.option_id
     AND comparison_set.baseline_version_id = paged.baseline_version_id
    LEFT JOIN public.technical_configuration_option_citations citation
      ON citation.comparison_set_id = comparison_set.id
     AND citation.option_id = selected.option_id
     AND citation.baseline_version_id = paged.baseline_version_id
     AND citation.criterion_id = paged.criterion_id
    GROUP BY selected.option_id, paged.criterion_id
  ),
  option_values AS (
    SELECT
      paged.criterion_id,
      selected.ordinal,
      selected.option_id,
      comparison_set.id AS comparison_set_id,
      CASE
        WHEN response.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', response.id,
          'response_text', response.response_text,
          'supplementary_information', response.supplementary_information
        )
      END AS response,
      jsonb_build_object(
        'document_count', evidence.document_total,
        'citation_count', evidence.citation_total,
        'has_evidence', evidence.citation_total > 0
      ) AS evidence
    FROM paged_criteria paged
    CROSS JOIN selected_options selected
    LEFT JOIN public.technical_configuration_comparison_sets comparison_set
      ON comparison_set.option_id = selected.option_id
     AND comparison_set.baseline_version_id = paged.baseline_version_id
    LEFT JOIN public.technical_configuration_option_responses response
      ON response.comparison_set_id = comparison_set.id
     AND response.baseline_version_id = paged.baseline_version_id
     AND response.criterion_id = paged.criterion_id
    JOIN option_evidence evidence
      ON evidence.option_id = selected.option_id
     AND evidence.criterion_id = paged.criterion_id
  ),
  option_value_arrays AS (
    SELECT
      values.criterion_id,
      jsonb_agg(
        jsonb_build_object(
          'option_id', values.option_id,
          'comparison_set_id', values.comparison_set_id,
          'response', values.response,
          'evidence', values.evidence
        )
        ORDER BY values.ordinal
      ) AS option_values
    FROM option_values values
    GROUP BY values.criterion_id
  ),
  option_array AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', selected.option_id,
        'supplier_id', selected.supplier_id,
        'supplier_name', selected.supplier_name,
        'model', selected.model,
        'manufacturer', selected.manufacturer,
        'option_name', selected.option_name,
        'display_label', selected.display_label
      )
      ORDER BY selected.ordinal
    ) AS options
    FROM selected_options selected
  ),
  criteria_array AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'group', jsonb_build_object(
            'id', paged.group_id,
            'name', paged.group_name,
            'sort_order', paged.group_sort_order
          ),
          'criterion', jsonb_build_object(
            'id', paged.criterion_id,
            'criterion_code', paged.criterion_code,
            'title', paged.title,
            'requirement_text', paged.requirement_text,
            'sort_order', paged.criterion_sort_order
          ),
          'baseline_evidence', jsonb_build_object(
            'document_count', evidence.document_total,
            'citation_count', evidence.citation_total,
            'has_evidence', evidence.citation_total > 0
          ),
          'option_values', values.option_values
        )
        ORDER BY paged.group_sort_order, paged.criterion_sort_order, paged.criterion_id
      ),
      '[]'::JSONB
    ) AS criteria
    FROM paged_criteria paged
    JOIN baseline_evidence evidence
      ON evidence.criterion_id = paged.criterion_id
    JOIN option_value_arrays values
      ON values.criterion_id = paged.criterion_id
  )
  SELECT jsonb_build_object(
    'dossier', jsonb_build_object(
      'id', d.id,
      'device_type_name', d.device_type_name,
      'name', d.name,
      'revision', d.revision,
      'archived_at', d.archived_at
    ),
    'baseline_version', jsonb_build_object(
      'id', v.id,
      'dossier_id', v.dossier_id,
      'version_number', v.version_number,
      'status', v.status,
      'revision', v.revision
    ),
    'options', option_array.options,
    'criteria', criteria_array.criteria
  )
  INTO v_data
  FROM public.technical_configuration_dossiers d
  JOIN public.technical_configuration_baseline_versions v
    ON v.dossier_id = d.id
   AND v.id = p_baseline_version_id
  CROSS JOIN option_array
  CROSS JOIN criteria_array
  WHERE d.id = v_dossier_id;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_comparison_get(
  UUID, UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_comparison_get(
  UUID, UUID[], INTEGER, INTEGER
) TO authenticated;

COMMIT;
