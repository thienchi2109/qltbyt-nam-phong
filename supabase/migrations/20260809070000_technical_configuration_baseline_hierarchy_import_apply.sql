-- P2B hidden atomic hierarchy apply capability with a guarded public rollout seam.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_import_apply_v2(
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
  v_group_map JSONB := '{}'::JSONB;
  v_subgroup_map JSONB := '{}'::JSONB;
  v_target_group_ids UUID[] := ARRAY[]::UUID[];
  v_target_subgroup_ids UUID[] := ARRAY[]::UUID[];
  v_target_criterion_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  v_validation := public._technical_configuration_baseline_import_validate_v2(
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
    tc_baseline_subgroups_group_sort_key,
    technical_configuration_baseline_criteria_group_sort_key,
    tc_baseline_criteria_subgroup_scope_fkey
    DEFERRED;

  WITH incoming_groups AS (
    SELECT
      NULLIF(row->>'group_id', '')::UUID AS group_id,
      row->>'group_name' AS group_name,
      (row->>'target_group_order')::INTEGER AS target_group_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'GROUP'
  ),
  resolved_groups AS (
    SELECT
      i.*,
      COALESCE(i.group_id, gen_random_uuid()) AS resolved_group_id
    FROM incoming_groups i
  )
  SELECT
    COALESCE(
      jsonb_object_agg(
        r.target_group_order::TEXT,
        r.resolved_group_id
        ORDER BY r.target_group_order
      ),
      '{}'::JSONB
    ),
    COALESCE(
      array_agg(r.resolved_group_id ORDER BY r.target_group_order),
      ARRAY[]::UUID[]
    )
  INTO v_group_map, v_target_group_ids
  FROM resolved_groups r;

  WITH incoming_groups AS (
    SELECT
      NULLIF(row->>'group_id', '')::UUID AS group_id,
      row->>'group_name' AS group_name,
      (row->>'target_group_order')::INTEGER AS target_group_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'GROUP'
  )
  UPDATE public.technical_configuration_baseline_groups g
  SET name = i.group_name,
      sort_order = i.target_group_order,
      updated_at = now(),
      updated_by = v_user_id
  FROM incoming_groups i
  WHERE g.id = i.group_id
    AND g.baseline_version_id = p_baseline_version_id;

  WITH incoming_groups AS (
    SELECT
      NULLIF(row->>'group_id', '')::UUID AS group_id,
      row->>'group_name' AS group_name,
      (row->>'target_group_order')::INTEGER AS target_group_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'GROUP'
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
    (v_group_map->>i.target_group_order::TEXT)::UUID,
    p_baseline_version_id,
    i.group_name,
    i.target_group_order,
    v_user_id,
    v_user_id
  FROM incoming_groups i
  WHERE i.group_id IS NULL;

  WITH incoming_subgroups AS (
    SELECT
      NULLIF(row->>'subgroup_id', '')::UUID AS subgroup_id,
      row->>'subgroup_name' AS subgroup_name,
      (row->>'target_group_order')::INTEGER AS target_group_order,
      (row->>'target_subgroup_order')::INTEGER AS target_subgroup_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'SUBGROUP'
  ),
  resolved_subgroups AS (
    SELECT
      i.*,
      COALESCE(i.subgroup_id, gen_random_uuid()) AS resolved_subgroup_id
    FROM incoming_subgroups i
  )
  SELECT
    COALESCE(
      jsonb_object_agg(
        format('%s:%s', r.target_group_order, r.target_subgroup_order),
        r.resolved_subgroup_id
        ORDER BY r.target_group_order, r.target_subgroup_order
      ),
      '{}'::JSONB
    ),
    COALESCE(
      array_agg(
        r.resolved_subgroup_id
        ORDER BY r.target_group_order, r.target_subgroup_order
      ),
      ARRAY[]::UUID[]
    )
  INTO v_subgroup_map, v_target_subgroup_ids
  FROM resolved_subgroups r;

  WITH incoming_subgroups AS (
    SELECT
      NULLIF(row->>'subgroup_id', '')::UUID AS subgroup_id,
      row->>'subgroup_name' AS subgroup_name,
      (row->>'target_group_order')::INTEGER AS target_group_order,
      (row->>'target_subgroup_order')::INTEGER AS target_subgroup_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'SUBGROUP'
  )
  UPDATE public.technical_configuration_baseline_subgroups sg
  SET group_id = (v_group_map->>i.target_group_order::TEXT)::UUID,
      name = i.subgroup_name,
      sort_order = i.target_subgroup_order,
      updated_at = now(),
      updated_by = v_user_id
  FROM incoming_subgroups i
  WHERE sg.id = i.subgroup_id
    AND sg.baseline_version_id = p_baseline_version_id;

  WITH incoming_subgroups AS (
    SELECT
      NULLIF(row->>'subgroup_id', '')::UUID AS subgroup_id,
      row->>'subgroup_name' AS subgroup_name,
      (row->>'target_group_order')::INTEGER AS target_group_order,
      (row->>'target_subgroup_order')::INTEGER AS target_subgroup_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'SUBGROUP'
  )
  INSERT INTO public.technical_configuration_baseline_subgroups (
    id,
    baseline_version_id,
    group_id,
    name,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    (
      v_subgroup_map->>format(
        '%s:%s',
        i.target_group_order,
        i.target_subgroup_order
      )
    )::UUID,
    p_baseline_version_id,
    (v_group_map->>i.target_group_order::TEXT)::UUID,
    i.subgroup_name,
    i.target_subgroup_order,
    v_user_id,
    v_user_id
  FROM incoming_subgroups i
  WHERE i.subgroup_id IS NULL;

  WITH incoming_criteria AS (
    SELECT
      NULLIF(row->>'criterion_id', '')::UUID AS criterion_id,
      row->>'criterion_code' AS criterion_code,
      NULLIF(row->>'existing_title', '') AS existing_title,
      row->>'requirement_text' AS requirement_text,
      (row->>'target_group_order')::INTEGER AS target_group_order,
      NULLIF(row->>'target_subgroup_order', '')::INTEGER AS target_subgroup_order,
      (row->>'target_criterion_order')::INTEGER AS target_criterion_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'CRITERION'
  )
  UPDATE public.technical_configuration_baseline_criteria c
  SET group_id = (v_group_map->>i.target_group_order::TEXT)::UUID,
      subgroup_id = CASE
        WHEN i.target_subgroup_order IS NULL THEN NULL
        ELSE (
          v_subgroup_map->>format(
            '%s:%s',
            i.target_group_order,
            i.target_subgroup_order
          )
        )::UUID
      END,
      title = i.existing_title,
      requirement_text = i.requirement_text,
      sort_order = i.target_criterion_order,
      updated_at = now(),
      updated_by = v_user_id
  FROM incoming_criteria i
  WHERE c.id = i.criterion_id
    AND c.baseline_version_id = p_baseline_version_id;

  WITH incoming_criteria AS (
    SELECT
      NULLIF(row->>'criterion_id', '')::UUID AS criterion_id,
      row->>'criterion_code' AS criterion_code,
      NULLIF(row->>'existing_title', '') AS existing_title,
      row->>'requirement_text' AS requirement_text,
      (row->>'target_group_order')::INTEGER AS target_group_order,
      NULLIF(row->>'target_subgroup_order', '')::INTEGER AS target_subgroup_order,
      (row->>'target_criterion_order')::INTEGER AS target_criterion_order
    FROM jsonb_array_elements(v_validation->'normalized_rows') row
    WHERE row->>'row_type' = 'CRITERION'
  )
  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id,
    group_id,
    subgroup_id,
    criterion_code,
    title,
    requirement_text,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    p_baseline_version_id,
    (v_group_map->>i.target_group_order::TEXT)::UUID,
    CASE
      WHEN i.target_subgroup_order IS NULL THEN NULL
      ELSE (
        v_subgroup_map->>format(
          '%s:%s',
          i.target_group_order,
          i.target_subgroup_order
        )
      )::UUID
    END,
    i.criterion_code,
    i.existing_title,
    i.requirement_text,
    i.target_criterion_order,
    v_user_id,
    v_user_id
  FROM incoming_criteria i
  WHERE i.criterion_id IS NULL;

  SELECT COALESCE(
    array_agg(NULLIF(row->>'criterion_id', '')::UUID),
    ARRAY[]::UUID[]
  )
  INTO v_target_criterion_ids
  FROM jsonb_array_elements(v_validation->'normalized_rows') row
  WHERE row->>'row_type' = 'CRITERION'
    AND NULLIF(row->>'criterion_id', '') IS NOT NULL;

  DELETE FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = p_baseline_version_id
    AND NOT (c.id = ANY(v_target_criterion_ids))
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_validation->'normalized_rows') row
      WHERE row->>'row_type' = 'CRITERION'
        AND NULLIF(row->>'criterion_id', '') IS NULL
        AND row->>'criterion_code' = c.criterion_code
    );

  DELETE FROM public.technical_configuration_baseline_subgroups sg
  WHERE sg.baseline_version_id = p_baseline_version_id
    AND NOT (sg.id = ANY(v_target_subgroup_ids));

  DELETE FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_baseline_version_id
    AND NOT (g.id = ANY(v_target_group_ids));

  v_new_criterion_count := (v_validation->'effects'->'criteria'->>'create')::BIGINT;
  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = next_criterion_number + v_new_criterion_count,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_baseline_version_id;

  RETURN jsonb_build_object(
    'data', public._technical_configuration_baseline_snapshot(p_baseline_version_id),
    'preview', jsonb_build_object(
      'metadata', v_validation->'metadata',
      'rows', v_validation->'normalized_rows',
      'counts', v_validation->'counts',
      'effects', v_validation->'effects'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_apply_v2(
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
BEGIN
  RAISE EXCEPTION 'hierarchical_import_apply_not_activated' USING ERRCODE = 'PT409';
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_import_apply_v2(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_import_apply_v2(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_import_apply_v2(UUID, JSONB, JSONB, BIGINT) TO authenticated;

COMMIT;
