-- P9A2: authoritative supplier-option import preview and atomic full-snapshot apply.
BEGIN;
CREATE OR REPLACE FUNCTION public._technical_configuration_option_import_validate(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_version_dossier_id UUID;
  v_revision BIGINT;
  v_archived_at TIMESTAMPTZ;
  v_key_count INTEGER;
  v_row JSONB;
  v_row_number INTEGER;
  v_group_order INTEGER;
  v_criterion_order INTEGER;
  v_criterion_id UUID;
  v_target JSONB;
  v_targets JSONB;
  v_target_criterion_ids UUID[];
  v_seen_criterion_ids UUID[] := ARRAY[]::UUID[];
  v_normalized_rows JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  SELECT o.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_options o
  WHERE o.id = p_option_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT v.dossier_id
  INTO v_version_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_dossier_id IS DISTINCT FROM v_version_dossier_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  SELECT d.revision, d.archived_at
  INTO v_revision, v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;
  IF v_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;
  IF p_template_metadata IS NULL
     OR jsonb_typeof(p_template_metadata) <> 'object' THEN
    RAISE EXCEPTION 'template_mismatch'
      USING ERRCODE = 'PT422', DETAIL = 'template metadata must be an object';
  END IF;
  SELECT count(*) INTO v_key_count FROM jsonb_object_keys(p_template_metadata);
  IF v_key_count <> 7
     OR NOT p_template_metadata ?& ARRAY[
       'template_kind',
       'template_version',
       'dossier_id',
       'option_id',
       'baseline_version_id',
       'dossier_revision',
       'generated_at'
     ]
     OR jsonb_typeof(p_template_metadata->'template_kind') <> 'string'
     OR jsonb_typeof(p_template_metadata->'template_version') <> 'number'
     OR jsonb_typeof(p_template_metadata->'dossier_id') <> 'string'
     OR jsonb_typeof(p_template_metadata->'option_id') <> 'string'
     OR jsonb_typeof(p_template_metadata->'baseline_version_id') <> 'string'
     OR jsonb_typeof(p_template_metadata->'dossier_revision') <> 'number'
     OR jsonb_typeof(p_template_metadata->'generated_at') <> 'string' THEN
    RAISE EXCEPTION 'template_mismatch'
      USING ERRCODE = 'PT422', DETAIL = 'template metadata has an invalid shape';
  END IF;
  BEGIN
    PERFORM (p_template_metadata->>'generated_at')::TIMESTAMPTZ;
    IF p_template_metadata->>'template_kind' <> 'technical_configuration_option'
       OR p_template_metadata->>'template_version' <> '1'
       OR (p_template_metadata->>'dossier_id')::UUID IS DISTINCT FROM v_dossier_id
       OR (p_template_metadata->>'option_id')::UUID IS DISTINCT FROM p_option_id
       OR (p_template_metadata->>'baseline_version_id')::UUID
         IS DISTINCT FROM p_baseline_version_id
       OR (p_template_metadata->>'dossier_revision')::BIGINT
         IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION 'template_mismatch'
        USING ERRCODE = 'PT422', DETAIL = 'template metadata does not match the target';
    END IF;
  EXCEPTION
    WHEN invalid_text_representation
      OR invalid_datetime_format
      OR datetime_field_overflow
      OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'template_mismatch'
        USING ERRCODE = 'PT422', DETAIL = 'template metadata contains invalid values';
  END;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'validation_error'
      USING ERRCODE = 'PT422', DETAIL = 'canonical rows must be an array';
  END IF;
  SELECT
    COALESCE(
      jsonb_object_agg(
        c.id::TEXT,
        jsonb_build_object(
          'group_order', g.sort_order,
          'group_name', g.name,
          'criterion_order', c.sort_order,
          'criterion_code', c.criterion_code,
          'criterion_title', c.title,
          'requirement_text', c.requirement_text
        )
      ),
      '{}'::JSONB
    ),
    COALESCE(
      array_agg(c.id ORDER BY g.sort_order, c.sort_order, c.id),
      ARRAY[]::UUID[]
    )
  INTO v_targets, v_target_criterion_ids
  FROM public.technical_configuration_baseline_criteria c
  JOIN public.technical_configuration_baseline_groups g
    ON g.id = c.group_id
   AND g.baseline_version_id = c.baseline_version_id
  WHERE c.baseline_version_id = p_baseline_version_id;
  FOR v_row, v_row_number IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(v_row) <> 'object' THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number, 'code', 'invalid_row_shape',
        'message', 'canonical row must be an object'
      ));
      CONTINUE;
    END IF;
    SELECT count(*) INTO v_key_count FROM jsonb_object_keys(v_row);
    IF v_key_count <> 9
       OR NOT v_row ?& ARRAY[
         'group_order',
         'group_name',
         'criterion_order',
         'criterion_id',
         'criterion_code',
         'criterion_title',
         'requirement_text',
         'response_text',
         'supplementary_information'
       ]
       OR jsonb_typeof(v_row->'group_order') <> 'number'
       OR jsonb_typeof(v_row->'group_name') <> 'string'
       OR jsonb_typeof(v_row->'criterion_order') <> 'number'
       OR jsonb_typeof(v_row->'criterion_id') <> 'string'
       OR jsonb_typeof(v_row->'criterion_code') <> 'string'
       OR jsonb_typeof(v_row->'criterion_title') NOT IN ('string', 'null')
       OR jsonb_typeof(v_row->'requirement_text') <> 'string'
       OR jsonb_typeof(v_row->'response_text') <> 'string'
       OR jsonb_typeof(v_row->'supplementary_information') <> 'string'
       OR v_row->>'group_order' !~ '^[0-9]+$'
       OR v_row->>'criterion_order' !~ '^[0-9]+$' THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number, 'code', 'invalid_row_shape',
        'message', 'canonical row has unsupported or missing fields'
      ));
      CONTINUE;
    END IF;
    BEGIN
      v_group_order := (v_row->>'group_order')::INTEGER;
      v_criterion_order := (v_row->>'criterion_order')::INTEGER;
      v_criterion_id := (v_row->>'criterion_id')::UUID;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number, 'code', 'invalid_row_shape',
          'message', 'canonical row contains invalid identifiers or order values'
        ));
        CONTINUE;
    END;
    IF v_group_order <= 0 OR v_criterion_order <= 0 THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number, 'code', 'invalid_row_shape',
        'message', 'canonical row order values must be positive'
      ));
      CONTINUE;
    END IF;
    IF v_criterion_id = ANY(v_seen_criterion_ids) THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number, 'criterion_id', v_criterion_id,
        'code', 'duplicate_criterion', 'message', 'criterion is duplicated'
      ));
      CONTINUE;
    END IF;
    v_seen_criterion_ids := array_append(v_seen_criterion_ids, v_criterion_id);
    v_target := v_targets->v_criterion_id::TEXT;
    IF v_target IS NULL THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number, 'criterion_id', v_criterion_id,
        'code', 'unknown_criterion', 'message', 'criterion does not belong to the target'
      ));
      CONTINUE;
    END IF;
    IF v_group_order IS DISTINCT FROM (v_target->>'group_order')::INTEGER
       OR v_row->>'group_name' IS DISTINCT FROM v_target->>'group_name'
       OR v_criterion_order IS DISTINCT FROM (v_target->>'criterion_order')::INTEGER
       OR v_row->>'criterion_code' IS DISTINCT FROM v_target->>'criterion_code'
       OR CASE
         WHEN v_row->'criterion_title' = 'null'::JSONB THEN NULL
         ELSE v_row->>'criterion_title'
       END IS DISTINCT FROM v_target->>'criterion_title'
       OR v_row->>'requirement_text' IS DISTINCT FROM v_target->>'requirement_text' THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number, 'criterion_id', v_criterion_id,
        'code', 'changed_context', 'message', 'read-only criterion context was changed'
      ));
      CONTINUE;
    END IF;
    v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
      'group_order', (v_target->>'group_order')::INTEGER,
      'group_name', v_target->>'group_name',
      'criterion_order', (v_target->>'criterion_order')::INTEGER,
      'criterion_id', v_criterion_id,
      'criterion_code', v_target->>'criterion_code',
      'criterion_title', v_target->'criterion_title',
      'requirement_text', v_target->>'requirement_text',
      'response_text', v_row->>'response_text',
      'supplementary_information', v_row->>'supplementary_information'
    ));
  END LOOP;
  FOREACH v_criterion_id IN ARRAY v_target_criterion_ids LOOP
    IF NOT (v_criterion_id = ANY(v_seen_criterion_ids)) THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'criterion_id', v_criterion_id, 'code', 'missing_criterion',
        'message', 'criterion is missing from the complete snapshot'
      ));
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'dossier_id', v_dossier_id,
    'metadata', jsonb_build_object(
      'template_kind', 'technical_configuration_option',
      'template_version', 1,
      'dossier_id', v_dossier_id,
      'option_id', p_option_id,
      'baseline_version_id', p_baseline_version_id,
      'dossier_revision', v_revision,
      'generated_at', p_template_metadata->>'generated_at'
    ),
    'rows', v_normalized_rows,
    'row_errors', v_errors
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_option_import_preview(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_validation JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  v_validation := public._technical_configuration_option_import_validate(
    p_option_id,
    p_baseline_version_id,
    p_template_metadata,
    p_rows,
    p_expected_revision
  );
  RETURN jsonb_build_object(
    'data', jsonb_build_object(
      'metadata', v_validation->'metadata',
      'rows', v_validation->'rows'
    ),
    'errors', v_validation->'row_errors'
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_option_import_apply(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_validation JSONB;
  v_errors JSONB;
  v_comparison_set_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  SELECT o.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_options o
  WHERE o.id = p_option_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id,
    p_expected_revision
  );
  PERFORM 1
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id
    AND v.dossier_id = v_dossier_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  v_validation := public._technical_configuration_option_import_validate(
    p_option_id,
    p_baseline_version_id,
    p_template_metadata,
    p_rows,
    p_expected_revision
  );
  v_errors := v_validation->'row_errors';
  IF jsonb_array_length(v_errors) > 0 THEN
    RAISE EXCEPTION 'validation_error'
      USING ERRCODE = 'PT422', DETAIL = v_errors::TEXT;
  END IF;
  SELECT cs.id
  INTO v_comparison_set_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.option_id = p_option_id
    AND cs.baseline_version_id = p_baseline_version_id
  FOR UPDATE;
  IF v_comparison_set_id IS NULL THEN
    INSERT INTO public.technical_configuration_comparison_sets (
      dossier_id,
      option_id,
      baseline_version_id,
      created_by,
      updated_by
    )
    VALUES (
      v_dossier_id,
      p_option_id,
      p_baseline_version_id,
      v_user_id,
      v_user_id
    )
    RETURNING id INTO v_comparison_set_id;
  ELSE
    UPDATE public.technical_configuration_comparison_sets
    SET updated_at = now(),
        updated_by = v_user_id
    WHERE id = v_comparison_set_id;
  END IF;
  DELETE FROM public.technical_configuration_option_responses r
  USING jsonb_array_elements(v_validation->'rows') AS incoming(row)
  WHERE r.comparison_set_id = v_comparison_set_id
    AND r.criterion_id = (incoming.row->>'criterion_id')::UUID
    AND incoming.row->>'response_text' = ''
    AND incoming.row->>'supplementary_information' = '';
  UPDATE public.technical_configuration_option_responses r
  SET response_text = incoming.row->>'response_text',
      supplementary_information = incoming.row->>'supplementary_information',
      updated_at = now(),
      updated_by = v_user_id
  FROM jsonb_array_elements(v_validation->'rows') AS incoming(row)
  WHERE r.comparison_set_id = v_comparison_set_id
    AND r.criterion_id = (incoming.row->>'criterion_id')::UUID
    AND NOT (
      incoming.row->>'response_text' = ''
      AND incoming.row->>'supplementary_information' = ''
    );
  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id,
    baseline_version_id,
    criterion_id,
    response_text,
    supplementary_information,
    created_by,
    updated_by
  )
  SELECT
    v_comparison_set_id,
    p_baseline_version_id,
    (incoming.row->>'criterion_id')::UUID,
    incoming.row->>'response_text',
    incoming.row->>'supplementary_information',
    v_user_id,
    v_user_id
  FROM jsonb_array_elements(v_validation->'rows') AS incoming(row)
  WHERE NOT (
      incoming.row->>'response_text' = ''
      AND incoming.row->>'supplementary_information' = ''
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.technical_configuration_option_responses r
      WHERE r.comparison_set_id = v_comparison_set_id
        AND r.criterion_id = (incoming.row->>'criterion_id')::UUID
    );
  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;
  RETURN public.technical_configuration_comparison_set_get(
    p_option_id,
    p_baseline_version_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_option_import_validate(UUID, UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_import_preview(UUID, UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_import_apply(UUID, UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_option_import_validate(UUID, UUID, JSONB, JSONB, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_import_preview(UUID, UUID, JSONB, JSONB, BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_import_apply(UUID, UUID, JSONB, JSONB, BIGINT) TO authenticated, service_role;
COMMIT;
