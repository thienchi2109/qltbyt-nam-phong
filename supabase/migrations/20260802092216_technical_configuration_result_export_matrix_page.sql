-- P14A2: bounded, flattened, read-only result-export matrix pages.
-- Rollback with a new reviewed migration that revokes and drops this RPC.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_result_export_matrix_list(
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
DECLARE v_snapshot JSONB; v_data JSONB; v_total BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 1000 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  v_snapshot := public._technical_configuration_result_export_snapshot(
    p_dossier_id, p_baseline_version_id, p_option_ids, p_criterion_ids
  );
  v_total := (v_snapshot->>'option_total')::BIGINT
    * (v_snapshot->>'criterion_total')::BIGINT;
  WITH scoped_options AS MATERIALIZED (
    SELECT
      selected.ordinal,
      option_row.id AS option_id,
      option_row.supplier_id,
      supplier.name AS supplier_name,
      supplier.name || ' ' || chr(183) || ' '
        || COALESCE(option_row.model, option_row.option_name) AS display_label,
      option_row.model,
      option_row.manufacturer,
      option_row.option_name
    FROM jsonb_array_elements_text(v_snapshot->'option_ids')
      WITH ORDINALITY AS selected(option_id, ordinal)
    JOIN public.technical_configuration_options option_row
      ON option_row.id = selected.option_id::UUID
     AND option_row.dossier_id = p_dossier_id
    JOIN public.technical_configuration_suppliers supplier
      ON supplier.id = option_row.supplier_id
     AND supplier.dossier_id = option_row.dossier_id
  ),
  scoped_criteria AS MATERIALIZED (
    SELECT
      selected.ordinal,
      group_row.id AS group_id,
      group_row.name AS group_name,
      group_row.sort_order AS group_order,
      criterion.id AS criterion_id,
      criterion.criterion_code,
      criterion.title AS criterion_title,
      criterion.requirement_text,
      criterion.sort_order AS criterion_order
    FROM jsonb_array_elements_text(v_snapshot->'criterion_ids')
      WITH ORDINALITY AS selected(criterion_id, ordinal)
    JOIN public.technical_configuration_baseline_criteria criterion
      ON criterion.id = selected.criterion_id::UUID
     AND criterion.baseline_version_id = p_baseline_version_id
    JOIN public.technical_configuration_baseline_groups group_row
      ON group_row.id = criterion.group_id
     AND group_row.baseline_version_id = criterion.baseline_version_id
  ),
  paged_cells AS MATERIALIZED (
    SELECT
      criterion.group_id,
      criterion.group_name,
      criterion.group_order,
      criterion.criterion_id,
      criterion.criterion_code,
      criterion.criterion_title,
      criterion.requirement_text,
      criterion.criterion_order,
      option_row.option_id,
      option_row.supplier_id,
      option_row.supplier_name,
      option_row.display_label,
      option_row.model,
      option_row.manufacturer,
      option_row.option_name,
      criterion.ordinal AS criterion_ordinal,
      option_row.ordinal AS option_ordinal
    FROM scoped_criteria criterion
    CROSS JOIN scoped_options option_row
    ORDER BY criterion.ordinal, option_row.ordinal
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  ),
  evidence AS MATERIALIZED (
    SELECT
      cell.option_id,
      cell.criterion_id,
      jsonb_agg(
        jsonb_build_object(
            'document_id', document.id,
            'document_name', document.name,
            'document_url', document.url,
            'citation_id', citation.id,
            'page_section', citation.page_section,
            'excerpt', citation.excerpt
          )
        ORDER BY document.name, document.id, citation.id
      ) AS document_links
    FROM paged_cells cell
    JOIN public.technical_configuration_comparison_sets comparison_set
      ON comparison_set.option_id = cell.option_id
     AND comparison_set.dossier_id = p_dossier_id
     AND comparison_set.baseline_version_id = p_baseline_version_id
    JOIN public.technical_configuration_option_citations citation
      ON citation.option_id = cell.option_id
     AND citation.comparison_set_id = comparison_set.id
     AND citation.baseline_version_id = p_baseline_version_id
     AND citation.criterion_id = cell.criterion_id
    JOIN public.technical_configuration_option_documents document
      ON document.id = citation.option_document_id
     AND document.option_id = cell.option_id
    GROUP BY cell.option_id, cell.criterion_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
            'group_id', cell.group_id,
            'group_name', cell.group_name,
            'group_order', cell.group_order,
            'criterion_id', cell.criterion_id,
            'criterion_code', cell.criterion_code,
            'criterion_title', cell.criterion_title,
            'requirement_text', cell.requirement_text,
            'criterion_order', cell.criterion_order,
            'option_id', cell.option_id,
            'supplier_id', cell.supplier_id,
            'supplier_name', cell.supplier_name,
            'display_label', cell.display_label,
            'model', cell.model,
            'manufacturer', cell.manufacturer,
            'option_name', cell.option_name,
            'response_text', response.response_text,
            'supplementary_information', response.supplementary_information,
            'document_links', COALESCE(evidence.document_links, '[]'::JSONB),
            'technical_axis', assessment.technical_axis,
            'evidence_axis', assessment.evidence_axis,
            'assessment_notes', assessment.notes,
            'conclusion', CASE
              WHEN assessment.technical_axis IS NULL THEN 'not_evaluated'
              WHEN assessment.technical_axis = 'not_applicable' THEN 'not_applicable'
              WHEN assessment.technical_axis = 'fails' THEN 'fails'
              WHEN assessment.technical_axis = 'unclear' THEN 'unclear'
              WHEN assessment.evidence_axis IS NULL THEN 'not_evaluated'
              WHEN assessment.evidence_axis IN ('partial', 'missing')
                THEN 'insufficient_evidence'
              ELSE assessment.technical_axis
            END
          )
    ORDER BY cell.criterion_ordinal, cell.option_ordinal
  ), '[]'::JSONB)
  INTO v_data
  FROM paged_cells cell
  LEFT JOIN public.technical_configuration_comparison_sets comparison_set
    ON comparison_set.option_id = cell.option_id
   AND comparison_set.dossier_id = p_dossier_id
   AND comparison_set.baseline_version_id = p_baseline_version_id
  LEFT JOIN public.technical_configuration_option_responses response
    ON response.comparison_set_id = comparison_set.id
   AND response.baseline_version_id = p_baseline_version_id
   AND response.criterion_id = cell.criterion_id
  LEFT JOIN public.technical_configuration_manual_assessments assessment
    ON assessment.comparison_set_id = comparison_set.id
   AND assessment.baseline_version_id = p_baseline_version_id
   AND assessment.criterion_id = cell.criterion_id
  LEFT JOIN evidence
    ON evidence.option_id = cell.option_id
   AND evidence.criterion_id = cell.criterion_id;
  RETURN jsonb_build_object(
    'data', v_data,
    'dossier_id', p_dossier_id,
    'baseline_version_id', p_baseline_version_id,
    'snapshot_token', v_snapshot->'snapshot_token',
    'ranking_snapshot_token', v_snapshot->'ranking_snapshot_token',
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_result_export_matrix_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_result_export_matrix_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) TO authenticated, service_role;

COMMIT;
