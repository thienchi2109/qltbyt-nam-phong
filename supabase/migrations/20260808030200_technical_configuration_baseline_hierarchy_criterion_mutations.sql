-- Keep legacy direct-criterion mutations canonical while hierarchy-only RPCs
-- remain unavailable until the later activation phase.
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_criterion_create(
  p_group_id UUID,
  p_title TEXT,
  p_requirement_text TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_version_id UUID; v_criterion_id UUID;
  v_criterion_number BIGINT; v_criterion_code TEXT;
  v_sort_order INTEGER; v_revision BIGINT;
BEGIN
  SELECT context.user_id, context.version_id
  INTO v_user_id, v_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    p_group_id, NULL, p_expected_revision
  ) context;
  IF p_requirement_text IS NULL OR btrim(p_requirement_text) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id;
  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = next_criterion_number + 1,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_version_id
  RETURNING next_criterion_number - 1, revision
  INTO v_criterion_number, v_revision;
  v_criterion_code := 'TC-' || lpad(
    v_criterion_number::TEXT,
    GREATEST(4, length(v_criterion_number::TEXT)),
    '0'
  );

  BEGIN
    INSERT INTO public.technical_configuration_baseline_criteria (
      baseline_version_id, group_id, subgroup_id, criterion_code, title,
      requirement_text, sort_order, created_by, updated_by
    ) VALUES (
      v_version_id, p_group_id, NULL, v_criterion_code,
      NULLIF(btrim(p_title), ''), btrim(p_requirement_text),
      v_sort_order, v_user_id, v_user_id
    ) RETURNING id INTO v_criterion_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END;

  PERFORM public._technical_configuration_baseline_normalize_group(
    p_group_id, v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_criterion_payload(
      v_criterion_id, v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_criteria_reorder(
  p_group_id UUID,
  p_criterion_ids UUID[],
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
  IF p_criterion_ids IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id;
  SELECT COUNT(*), COUNT(DISTINCT item_id)
  INTO v_input_count, v_distinct_count
  FROM unnest(p_criterion_ids) input(item_id);
  SELECT COUNT(*) INTO v_matching_count
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id
    AND id = ANY(p_criterion_ids);
  IF cardinality(p_criterion_ids) <> v_existing_count
     OR v_input_count <> v_distinct_count
     OR v_matching_count <> v_existing_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SET CONSTRAINTS technical_configuration_baseline_criteria_group_sort_key DEFERRED;
  UPDATE public.technical_configuration_baseline_criteria c
  SET sort_order = input.new_order::INTEGER,
      updated_at = now(),
      updated_by = v_user_id
  FROM unnest(p_criterion_ids) WITH ORDINALITY input(id, new_order)
  WHERE c.id = input.id;
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

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_hierarchy_criterion_create(
  p_group_id UUID,
  p_subgroup_id UUID,
  p_title TEXT,
  p_requirement_text TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_version_id UUID; v_criterion_id UUID;
  v_criterion_number BIGINT; v_criterion_code TEXT;
  v_sort_order INTEGER; v_revision BIGINT;
BEGIN
  SELECT context.user_id, context.version_id
  INTO v_user_id, v_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    p_group_id, p_subgroup_id, p_expected_revision
  ) context;
  IF p_requirement_text IS NULL OR btrim(p_requirement_text) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT next_criterion_number INTO v_criterion_number
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_version_id;
  v_criterion_code := 'TC-' || lpad(
    v_criterion_number::TEXT,
    GREATEST(4, length(v_criterion_number::TEXT)),
    '0'
  );
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id;

  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id, group_id, subgroup_id, criterion_code, title,
    requirement_text, sort_order, created_by, updated_by
  ) VALUES (
    v_version_id, p_group_id, p_subgroup_id, v_criterion_code,
    NULLIF(btrim(p_title), ''), btrim(p_requirement_text),
    v_sort_order, v_user_id, v_user_id
  ) RETURNING id INTO v_criterion_id;

  PERFORM public._technical_configuration_baseline_normalize_group(
    p_group_id, v_user_id
  );
  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = next_criterion_number + 1,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_version_id
  RETURNING revision INTO v_revision;
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_hierarchy_criterion_payload(
      v_criterion_id, v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_hierarchy_criterion_move(
  p_criterion_id UUID,
  p_target_group_id UUID,
  p_target_subgroup_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_target_version_id UUID; v_source_version_id UUID;
  v_source_group_id UUID; v_sort_order INTEGER; v_revision BIGINT;
BEGIN
  SELECT context.user_id, context.version_id
  INTO v_user_id, v_target_version_id
  FROM public._technical_configuration_baseline_hierarchy_context(
    p_target_group_id, p_target_subgroup_id, p_expected_revision
  ) context;

  SELECT c.baseline_version_id, c.group_id
  INTO v_source_version_id, v_source_group_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_source_version_id <> v_target_version_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_target_group_id;
  SET CONSTRAINTS technical_configuration_baseline_criteria_group_sort_key DEFERRED;
  UPDATE public.technical_configuration_baseline_criteria
  SET group_id = p_target_group_id,
      subgroup_id = p_target_subgroup_id,
      sort_order = v_sort_order,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_criterion_id;

  PERFORM public._technical_configuration_baseline_normalize_group(
    v_source_group_id, v_user_id
  );
  IF p_target_group_id <> v_source_group_id THEN
    PERFORM public._technical_configuration_baseline_normalize_group(
      p_target_group_id, v_user_id
    );
  END IF;
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_target_version_id, v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_hierarchy_criterion_payload(
      p_criterion_id, v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_hierarchy_criteria_reorder(
  p_group_id UUID,
  p_subgroup_id UUID,
  p_criterion_ids UUID[],
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
    p_group_id, p_subgroup_id, p_expected_revision
  ) context;
  IF p_criterion_ids IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id
    AND subgroup_id IS NOT DISTINCT FROM p_subgroup_id;
  SELECT COUNT(*), COUNT(DISTINCT item_id)
  INTO v_input_count, v_distinct_count
  FROM unnest(p_criterion_ids) input(item_id);
  SELECT COUNT(*) INTO v_matching_count
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id
    AND subgroup_id IS NOT DISTINCT FROM p_subgroup_id
    AND id = ANY(p_criterion_ids);
  IF cardinality(p_criterion_ids) <> v_existing_count
     OR v_input_count <> v_distinct_count
     OR v_matching_count <> v_existing_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SET CONSTRAINTS technical_configuration_baseline_criteria_group_sort_key DEFERRED;
  UPDATE public.technical_configuration_baseline_criteria c
  SET sort_order = input.new_order::INTEGER,
      updated_at = now(),
      updated_by = v_user_id
  FROM unnest(p_criterion_ids) WITH ORDINALITY input(id, new_order)
  WHERE c.id = input.id;
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

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_hierarchy_criterion_create(UUID, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_hierarchy_criterion_move(UUID, UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_hierarchy_criteria_reorder(UUID, UUID, UUID[], BIGINT) FROM PUBLIC, anon, authenticated, service_role;
