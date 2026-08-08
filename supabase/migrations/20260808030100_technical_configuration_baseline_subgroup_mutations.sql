CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_subgroup_create(
  p_group_id UUID,
  p_name TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_version_id UUID; v_subgroup_id UUID;
  v_sort_order INTEGER; v_revision BIGINT;
BEGIN
  SELECT context.user_id, context.version_id
  INTO v_user_id, v_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    p_group_id, NULL, p_expected_revision
  ) context;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order
  FROM public.technical_configuration_baseline_subgroups
  WHERE group_id = p_group_id;
  INSERT INTO public.technical_configuration_baseline_subgroups (
    baseline_version_id, group_id, name, sort_order, created_by, updated_by
  ) VALUES (
    v_version_id, p_group_id, btrim(p_name), v_sort_order, v_user_id, v_user_id
  ) RETURNING id INTO v_subgroup_id;

  PERFORM public._technical_configuration_baseline_normalize_group(
    p_group_id, v_user_id
  );
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id, v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_subgroup_payload(
      v_subgroup_id, v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_subgroup_update(
  p_subgroup_id UUID,
  p_name TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group_id UUID; v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  SELECT s.group_id INTO v_group_id
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.id = p_subgroup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT context.user_id, context.version_id
  INTO v_user_id, v_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    v_group_id, p_subgroup_id, p_expected_revision
  ) context;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  UPDATE public.technical_configuration_baseline_subgroups
  SET name = btrim(p_name), updated_at = now(), updated_by = v_user_id
  WHERE id = p_subgroup_id;
  PERFORM public._technical_configuration_baseline_normalize_group(
    v_group_id, v_user_id
  );
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id, v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_subgroup_payload(
      p_subgroup_id, v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_subgroup_delete(
  p_subgroup_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group_id UUID; v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  SELECT s.group_id INTO v_group_id
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.id = p_subgroup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT context.user_id, context.version_id
  INTO v_user_id, v_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    v_group_id, p_subgroup_id, p_expected_revision
  ) context;
  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria
    WHERE subgroup_id = p_subgroup_id
  ) THEN
    RAISE EXCEPTION 'subgroup_not_empty' USING ERRCODE = 'PT409';
  END IF;

  DELETE FROM public.technical_configuration_baseline_subgroups
  WHERE id = p_subgroup_id;
  PERFORM public._technical_configuration_baseline_normalize_group(
    v_group_id, v_user_id
  );
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id, v_user_id
  );
  RETURN jsonb_build_object(
    'data', jsonb_build_object('id', p_subgroup_id, 'revision', v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_subgroups_reorder(
  p_group_id UUID,
  p_subgroup_ids UUID[],
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
  v_existing_count BIGINT; v_input_count BIGINT;
  v_distinct_count BIGINT; v_matching_count BIGINT;
BEGIN
  SELECT context.user_id, context.version_id
  INTO v_user_id, v_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    p_group_id, NULL, p_expected_revision
  ) context;
  IF p_subgroup_ids IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.technical_configuration_baseline_subgroups
  WHERE group_id = p_group_id;
  SELECT COUNT(*), COUNT(DISTINCT item_id)
  INTO v_input_count, v_distinct_count
  FROM unnest(p_subgroup_ids) input(item_id);
  SELECT COUNT(*) INTO v_matching_count
  FROM public.technical_configuration_baseline_subgroups
  WHERE group_id = p_group_id AND id = ANY(p_subgroup_ids);
  IF cardinality(p_subgroup_ids) <> v_existing_count
     OR v_input_count <> v_distinct_count
     OR v_matching_count <> v_existing_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SET CONSTRAINTS tc_baseline_subgroups_group_sort_key DEFERRED;
  UPDATE public.technical_configuration_baseline_subgroups s
  SET sort_order = input.new_order::INTEGER,
      updated_at = now(),
      updated_by = v_user_id
  FROM unnest(p_subgroup_ids) WITH ORDINALITY input(id, new_order)
  WHERE s.id = input.id;
  PERFORM public._technical_configuration_baseline_normalize_group(
    p_group_id, v_user_id
  );
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id, v_user_id
  );
  RETURN jsonb_build_object(
    'data', public._technical_configuration_baseline_snapshot(v_version_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroup_create(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroup_update(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroup_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroups_reorder(UUID, UUID[], BIGINT) FROM PUBLIC, anon, authenticated, service_role;
