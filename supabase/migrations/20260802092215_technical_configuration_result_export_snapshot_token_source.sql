-- P14A2: preserve the P14A1 snapshot contract while sourcing its ranking token
-- directly, so ranking export pages compute the complete-universe ranking once.
-- Rollback with a new reviewed migration that restores the P14A1 helper body.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_result_export_snapshot(
  p_dossier_id UUID,
  p_baseline_version_id UUID,
  p_option_ids UUID[],
  p_criterion_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_snapshot_data JSONB;
  v_snapshot_payload JSONB;
  v_option_total BIGINT;
  v_criterion_total BIGINT;
  v_ranking_snapshot_token TEXT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_dossier_id IS NULL OR p_baseline_version_id IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  IF p_option_ids IS NOT NULL AND (
    cardinality(p_option_ids) = 0
    OR array_position(p_option_ids, NULL) IS NOT NULL
    OR (
      SELECT count(DISTINCT requested.option_id)
      FROM unnest(p_option_ids) AS requested(option_id)
    ) <> cardinality(p_option_ids)
  ) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  IF p_criterion_ids IS NOT NULL AND (
    cardinality(p_criterion_ids) = 0
    OR array_position(p_criterion_ids, NULL) IS NOT NULL
    OR (
      SELECT count(DISTINCT requested.criterion_id)
      FROM unnest(p_criterion_ids) AS requested(criterion_id)
    ) <> cardinality(p_criterion_ids)
  ) THEN
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
  v_ranking_snapshot_token :=
    public._technical_configuration_reference_ranking_token(
      p_dossier_id,
      p_baseline_version_id
    );
  WITH requested_options AS MATERIALIZED (
    SELECT requested.option_id, requested.ordinal::BIGINT
    FROM unnest(p_option_ids) WITH ORDINALITY AS requested(option_id, ordinal)
    WHERE p_option_ids IS NOT NULL
    UNION ALL
    SELECT
      option_row.id,
      row_number() OVER (
        ORDER BY
          supplier.normalized_name,
          COALESCE(option_row.model, option_row.option_name),
          option_row.id
      )
    FROM public.technical_configuration_options option_row
    JOIN public.technical_configuration_suppliers supplier
      ON supplier.id = option_row.supplier_id
     AND supplier.dossier_id = option_row.dossier_id
    WHERE p_option_ids IS NULL
      AND option_row.dossier_id = p_dossier_id
  ),
  scoped_options AS MATERIALIZED (
    SELECT
      requested.ordinal,
      option_row.id AS option_id,
      option_row.supplier_id,
      supplier.name AS supplier_name,
      supplier.normalized_name AS supplier_normalized_name,
      option_row.model,
      option_row.manufacturer,
      option_row.option_name
    FROM requested_options requested
    JOIN public.technical_configuration_options option_row
      ON option_row.id = requested.option_id
     AND option_row.dossier_id = p_dossier_id
    JOIN public.technical_configuration_suppliers supplier
      ON supplier.id = option_row.supplier_id
     AND supplier.dossier_id = option_row.dossier_id
  ),
  requested_criteria AS MATERIALIZED (
    SELECT requested.criterion_id, requested.ordinal::BIGINT
    FROM unnest(p_criterion_ids) WITH ORDINALITY AS requested(criterion_id, ordinal)
    WHERE p_criterion_ids IS NOT NULL
    UNION ALL
    SELECT
      criterion.id,
      row_number() OVER (
        ORDER BY group_row.sort_order, criterion.sort_order, criterion.id
      )
    FROM public.technical_configuration_baseline_criteria criterion
    JOIN public.technical_configuration_baseline_groups group_row
      ON group_row.id = criterion.group_id
     AND group_row.baseline_version_id = criterion.baseline_version_id
    WHERE p_criterion_ids IS NULL
      AND criterion.baseline_version_id = p_baseline_version_id
  ),
  scoped_criteria AS MATERIALIZED (
    SELECT
      requested.ordinal,
      group_row.id AS group_id,
      group_row.name AS group_name,
      group_row.sort_order AS group_order,
      criterion.id AS criterion_id,
      criterion.criterion_code,
      criterion.title AS criterion_title,
      criterion.requirement_text,
      criterion.sort_order AS criterion_order
    FROM requested_criteria requested
    JOIN public.technical_configuration_baseline_criteria criterion
      ON criterion.id = requested.criterion_id
     AND criterion.baseline_version_id = p_baseline_version_id
    JOIN public.technical_configuration_baseline_groups group_row
      ON group_row.id = criterion.group_id
     AND group_row.baseline_version_id = criterion.baseline_version_id
  ),
  dossier_context AS MATERIALIZED (
    SELECT
      dossier.id AS dossier_id,
      dossier.device_type_name,
      dossier.name AS dossier_name,
      dossier.revision AS dossier_revision,
      CASE WHEN dossier.archived_at IS NULL THEN NULL ELSE to_char(
        dossier.archived_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ) END AS archived_at,
      version.id AS baseline_version_id,
      version.dossier_id AS baseline_dossier_id,
      version.version_number,
      version.status AS baseline_status,
      version.revision AS baseline_revision,
      CASE WHEN version.locked_at IS NULL THEN NULL ELSE to_char(
        version.locked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ) END AS locked_at
    FROM public.technical_configuration_dossiers dossier
    JOIN public.technical_configuration_baseline_versions version
      ON version.dossier_id = dossier.id
     AND version.id = p_baseline_version_id
    WHERE dossier.id = p_dossier_id
  )
  SELECT
    jsonb_build_object(
      'dossier', jsonb_build_object(
        'id', context.dossier_id,
        'device_type_name', context.device_type_name,
        'name', context.dossier_name,
        'revision', context.dossier_revision,
        'archived_at', context.archived_at
      ),
      'baseline_version', jsonb_build_object(
        'id', context.baseline_version_id,
        'dossier_id', context.baseline_dossier_id,
        'version_number', context.version_number,
        'status', context.baseline_status,
        'revision', context.baseline_revision,
        'locked_at', context.locked_at
      ),
      'option_ids', COALESCE(
        (
          SELECT jsonb_agg(scoped_option.option_id ORDER BY scoped_option.ordinal)
          FROM scoped_options scoped_option
        ),
        '[]'::JSONB
      ),
      'criterion_ids', COALESCE(
        (
          SELECT jsonb_agg(scoped_criterion.criterion_id ORDER BY scoped_criterion.ordinal)
          FROM scoped_criteria scoped_criterion
        ),
        '[]'::JSONB
      ),
      'option_total', (SELECT count(*) FROM scoped_options),
      'criterion_total', (SELECT count(*) FROM scoped_criteria),
      'ranking_snapshot_token', v_ranking_snapshot_token
    ),
    jsonb_build_object(
      'dossier', jsonb_build_object(
        'id', context.dossier_id,
        'device_type_name', context.device_type_name,
        'name', context.dossier_name,
        'revision', context.dossier_revision,
        'archived_at', context.archived_at
      ),
      'baseline_version', jsonb_build_object(
        'id', context.baseline_version_id,
        'dossier_id', context.baseline_dossier_id,
        'version_number', context.version_number,
        'status', context.baseline_status,
        'revision', context.baseline_revision,
        'locked_at', context.locked_at
      ),
      'options', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'option_id', scoped_option.option_id,
              'supplier_id', scoped_option.supplier_id,
              'supplier_name', scoped_option.supplier_name,
              'supplier_normalized_name', scoped_option.supplier_normalized_name,
              'model', scoped_option.model,
              'manufacturer', scoped_option.manufacturer,
              'option_name', scoped_option.option_name
            )
            ORDER BY scoped_option.ordinal
          )
          FROM scoped_options scoped_option
        ),
        '[]'::JSONB
      ),
      'criteria', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'group_id', scoped_criterion.group_id,
              'group_name', scoped_criterion.group_name,
              'group_order', scoped_criterion.group_order,
              'criterion_id', scoped_criterion.criterion_id,
              'criterion_code', scoped_criterion.criterion_code,
              'criterion_title', scoped_criterion.criterion_title,
              'requirement_text', scoped_criterion.requirement_text,
              'criterion_order', scoped_criterion.criterion_order
            )
            ORDER BY scoped_criterion.ordinal
          )
          FROM scoped_criteria scoped_criterion
        ),
        '[]'::JSONB
      ),
      'comparison_sets', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'comparison_set_id', comparison_set.id,
              'option_id', comparison_set.option_id,
              'baseline_version_id', comparison_set.baseline_version_id
            )
            ORDER BY scoped_option.ordinal
          )
          FROM scoped_options scoped_option
          JOIN public.technical_configuration_comparison_sets comparison_set
            ON comparison_set.option_id = scoped_option.option_id
           AND comparison_set.dossier_id = p_dossier_id
           AND comparison_set.baseline_version_id = p_baseline_version_id
        ),
        '[]'::JSONB
      ),
      'responses', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'response_id', response.id,
              'comparison_set_id', response.comparison_set_id,
              'criterion_id', response.criterion_id,
              'response_text', response.response_text,
              'supplementary_information', response.supplementary_information
            )
            ORDER BY scoped_option.ordinal, scoped_criterion.ordinal
          )
          FROM scoped_options scoped_option
          JOIN public.technical_configuration_comparison_sets comparison_set
            ON comparison_set.option_id = scoped_option.option_id
           AND comparison_set.dossier_id = p_dossier_id
           AND comparison_set.baseline_version_id = p_baseline_version_id
          JOIN public.technical_configuration_option_responses response
            ON response.comparison_set_id = comparison_set.id
           AND response.baseline_version_id = p_baseline_version_id
          JOIN scoped_criteria scoped_criterion
            ON scoped_criterion.criterion_id = response.criterion_id
        ),
        '[]'::JSONB
      ),
      'documents', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'document_id', document.id,
              'option_id', document.option_id,
              'document_name', document.name,
              'document_url', document.url
            )
            ORDER BY scoped_option.ordinal, document.name, document.id
          )
          FROM scoped_options scoped_option
          JOIN public.technical_configuration_option_documents document
            ON document.option_id = scoped_option.option_id
        ),
        '[]'::JSONB
      ),
      'citations', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'citation_id', citation.id,
              'option_id', citation.option_id,
              'comparison_set_id', citation.comparison_set_id,
              'criterion_id', citation.criterion_id,
              'document_id', citation.option_document_id,
              'page_section', citation.page_section,
              'excerpt', citation.excerpt
            )
            ORDER BY
              scoped_option.ordinal,
              scoped_criterion.ordinal,
              citation.option_document_id,
              citation.id
          )
          FROM scoped_options scoped_option
          JOIN public.technical_configuration_comparison_sets comparison_set
            ON comparison_set.option_id = scoped_option.option_id
           AND comparison_set.dossier_id = p_dossier_id
           AND comparison_set.baseline_version_id = p_baseline_version_id
          JOIN public.technical_configuration_option_citations citation
            ON citation.comparison_set_id = comparison_set.id
           AND citation.option_id = scoped_option.option_id
           AND citation.baseline_version_id = p_baseline_version_id
          JOIN scoped_criteria scoped_criterion
            ON scoped_criterion.criterion_id = citation.criterion_id
        ),
        '[]'::JSONB
      ),
      'assessments', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'assessment_id', assessment.id,
              'comparison_set_id', assessment.comparison_set_id,
              'criterion_id', assessment.criterion_id,
              'technical_axis', assessment.technical_axis,
              'evidence_axis', assessment.evidence_axis,
              'assessment_notes', assessment.notes,
              'assessment_revision', assessment.revision
            )
            ORDER BY scoped_option.ordinal, scoped_criterion.ordinal
          )
          FROM scoped_options scoped_option
          JOIN public.technical_configuration_comparison_sets comparison_set
            ON comparison_set.option_id = scoped_option.option_id
           AND comparison_set.dossier_id = p_dossier_id
           AND comparison_set.baseline_version_id = p_baseline_version_id
          JOIN public.technical_configuration_manual_assessments assessment
            ON assessment.comparison_set_id = comparison_set.id
           AND assessment.baseline_version_id = p_baseline_version_id
          JOIN scoped_criteria scoped_criterion
            ON scoped_criterion.criterion_id = assessment.criterion_id
        ),
        '[]'::JSONB
      ),
      'ranking_snapshot_token', v_ranking_snapshot_token
    ),
    (SELECT count(*) FROM scoped_options),
    (SELECT count(*) FROM scoped_criteria)
  INTO v_snapshot_data, v_snapshot_payload, v_option_total, v_criterion_total
  FROM dossier_context context;
  IF p_option_ids IS NOT NULL AND v_option_total <> cardinality(p_option_ids) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF p_criterion_ids IS NOT NULL
     AND v_criterion_total <> cardinality(p_criterion_ids) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  RETURN v_snapshot_data || jsonb_build_object(
    'snapshot_token',
    md5(v_snapshot_payload::TEXT)
  );
END;
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_result_export_snapshot(
  UUID, UUID, UUID[], UUID[]
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_result_export_snapshot(
  UUID, UUID, UUID[], UUID[]
) TO service_role;

COMMIT;
