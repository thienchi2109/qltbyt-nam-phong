-- P5C: authoritative baseline import preview and atomic aggregate persistence.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_preview(
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
  PERFORM public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  v_validation := public._technical_configuration_baseline_import_validate(
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

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_apply(
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
  v_validation JSONB;
  v_errors JSONB;
  v_new_criterion_count BIGINT;
  v_existing_group_ids UUID[] := ARRAY[]::UUID[];
  v_target_group_ids UUID[] := ARRAY[]::UUID[];
  v_kept_criterion_codes TEXT[] := ARRAY[]::TEXT[];
  v_group_map JSONB := '{}'::JSONB;
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  v_validation := public._technical_configuration_baseline_import_validate(
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

  SET CONSTRAINTS
    technical_configuration_baseline_groups_version_sort_key,
    technical_configuration_baseline_criteria_group_sort_key
    DEFERRED;

  SELECT COALESCE(array_agg(g.id ORDER BY g.sort_order, g.id), ARRAY[]::UUID[])
  INTO v_existing_group_ids
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_baseline_version_id;

  WITH incoming_groups AS (
    SELECT
      (value->>'group_order')::INTEGER AS group_order,
      value->>'group_name' AS group_name
    FROM jsonb_array_elements(v_validation->'rows')
    WHERE value->>'row_type' = 'GROUP'
  ),
  resolved_groups AS (
    SELECT
      i.group_order,
      COALESCE(v_existing_group_ids[i.group_order], gen_random_uuid()) AS group_id
    FROM incoming_groups i
  )
  SELECT
    COALESCE(
      jsonb_object_agg(r.group_order::TEXT, r.group_id ORDER BY r.group_order),
      '{}'::JSONB
    ),
    COALESCE(array_agg(r.group_id ORDER BY r.group_order), ARRAY[]::UUID[])
  INTO v_group_map, v_target_group_ids
  FROM resolved_groups r;

  WITH incoming_groups AS (
    SELECT
      (value->>'group_order')::INTEGER AS group_order,
      value->>'group_name' AS group_name
    FROM jsonb_array_elements(v_validation->'rows')
    WHERE value->>'row_type' = 'GROUP'
  )
  UPDATE public.technical_configuration_baseline_groups g
  SET name = i.group_name,
      sort_order = i.group_order,
      updated_at = now(),
      updated_by = v_user_id
  FROM incoming_groups i
  WHERE g.id = (v_group_map->>i.group_order::TEXT)::UUID;

  WITH incoming_groups AS (
    SELECT
      (value->>'group_order')::INTEGER AS group_order,
      value->>'group_name' AS group_name
    FROM jsonb_array_elements(v_validation->'rows')
    WHERE value->>'row_type' = 'GROUP'
  )
  INSERT INTO public.technical_configuration_baseline_groups (
    id,
    baseline_version_id,
    name,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    (v_group_map->>i.group_order::TEXT)::UUID,
    p_baseline_version_id,
    i.group_name,
    i.group_order,
    v_user_id,
    v_user_id
  FROM incoming_groups i
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_groups g
    WHERE g.id = (v_group_map->>i.group_order::TEXT)::UUID
  );

  WITH incoming_criteria AS (
    SELECT
      value->>'criterion_code' AS criterion_code,
      (value->>'group_order')::INTEGER AS group_order,
      (value->>'criterion_order')::INTEGER AS criterion_order,
      NULLIF(value->>'criterion_title', '') AS criterion_title,
      value->>'requirement_text' AS requirement_text
    FROM jsonb_array_elements(v_validation->'rows')
    WHERE value->>'row_type' = 'CRITERION'
  )
  UPDATE public.technical_configuration_baseline_criteria c
  SET group_id = (v_group_map->>i.group_order::TEXT)::UUID,
      title = i.criterion_title,
      requirement_text = i.requirement_text,
      sort_order = i.criterion_order,
      updated_at = now(),
      updated_by = v_user_id
  FROM incoming_criteria i
  WHERE c.baseline_version_id = p_baseline_version_id
    AND c.criterion_code = i.criterion_code;

  WITH incoming_criteria AS (
    SELECT
      value->>'criterion_code' AS criterion_code,
      (value->>'group_order')::INTEGER AS group_order,
      (value->>'criterion_order')::INTEGER AS criterion_order,
      NULLIF(value->>'criterion_title', '') AS criterion_title,
      value->>'requirement_text' AS requirement_text
    FROM jsonb_array_elements(v_validation->'rows')
    WHERE value->>'row_type' = 'CRITERION'
  )
  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id,
    group_id,
    criterion_code,
    title,
    requirement_text,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    p_baseline_version_id,
    (v_group_map->>i.group_order::TEXT)::UUID,
    i.criterion_code,
    i.criterion_title,
    i.requirement_text,
    i.criterion_order,
    v_user_id,
    v_user_id
  FROM incoming_criteria i
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_baseline_version_id
      AND c.criterion_code = i.criterion_code
  );

  SELECT COALESCE(array_agg(value->>'criterion_code'), ARRAY[]::TEXT[])
  INTO v_kept_criterion_codes
  FROM jsonb_array_elements(v_validation->'rows')
  WHERE value->>'row_type' = 'CRITERION';

  DELETE FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = p_baseline_version_id
    AND NOT (c.criterion_code = ANY(v_kept_criterion_codes));

  DELETE FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_baseline_version_id
    AND NOT (g.id = ANY(v_target_group_ids));

  v_new_criterion_count := (v_validation->>'new_criterion_count')::BIGINT;
  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = next_criterion_number + v_new_criterion_count,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_baseline_version_id;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(p_baseline_version_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_import_preview(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_import_preview(UUID, JSONB, JSONB, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_import_apply(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_import_apply(UUID, JSONB, JSONB, BIGINT) TO authenticated;

COMMIT;
