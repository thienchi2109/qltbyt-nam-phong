-- P14A4: bounded, ordered, read-only option and criterion export axes.
-- Rollback with a new reviewed migration that revokes and drops these RPCs.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_result_export_option_axis_list(
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
DECLARE
  v_snapshot JSONB;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_snapshot := public._technical_configuration_result_export_snapshot(
    p_dossier_id,
    p_baseline_version_id,
    p_option_ids,
    p_criterion_ids
  );
  v_total := (v_snapshot->>'option_total')::BIGINT;

  WITH paged AS (
    SELECT selected.item, selected.ordinal
    FROM jsonb_array_elements(v_snapshot->'options') WITH ORDINALITY
      AS selected(item, ordinal)
    ORDER BY selected.ordinal
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
          'option_id', paged.item->'option_id',
          'supplier_id', paged.item->'supplier_id',
          'supplier_name', paged.item->'supplier_name',
          'display_label', public._technical_configuration_option_display_label(
            paged.item->>'supplier_name',
            paged.item->>'model',
            paged.item->>'option_name'
          ),
          'model', paged.item->'model',
          'manufacturer', paged.item->'manufacturer',
          'option_name', paged.item->'option_name'
        )
      ORDER BY paged.ordinal
    ),
    '[]'::JSONB
  )
  INTO v_data
  FROM paged;

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

CREATE OR REPLACE FUNCTION public.technical_configuration_result_export_criterion_axis_list(
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
DECLARE
  v_snapshot JSONB;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_snapshot := public._technical_configuration_result_export_snapshot(
    p_dossier_id,
    p_baseline_version_id,
    p_option_ids,
    p_criterion_ids
  );
  v_total := (v_snapshot->>'criterion_total')::BIGINT;

  WITH paged AS (
    SELECT selected.item, selected.ordinal
    FROM jsonb_array_elements(v_snapshot->'criteria') WITH ORDINALITY
      AS selected(item, ordinal)
    ORDER BY selected.ordinal
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
          'group_id', paged.item->'group_id',
          'group_name', paged.item->'group_name',
          'group_order', paged.item->'group_order',
          'criterion_id', paged.item->'criterion_id',
          'criterion_code', paged.item->'criterion_code',
          'criterion_title', paged.item->'criterion_title',
          'requirement_text', paged.item->'requirement_text',
          'criterion_order', paged.item->'criterion_order'
        )
      ORDER BY paged.ordinal
    ),
    '[]'::JSONB
  )
  INTO v_data
  FROM paged;

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

REVOKE ALL ON FUNCTION public.technical_configuration_result_export_option_axis_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_result_export_option_axis_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.technical_configuration_result_export_criterion_axis_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_result_export_criterion_axis_list(
  UUID, UUID, UUID[], UUID[], INTEGER, INTEGER
) TO authenticated, service_role;

COMMIT;
