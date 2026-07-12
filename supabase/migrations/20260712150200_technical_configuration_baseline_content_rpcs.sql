-- Issue #744, Phase P2: group reorder and criterion mutation RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_criterion_payload(
  p_criterion_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'baseline_version_id', c.baseline_version_id,
    'group_id', c.group_id,
    'criterion_code', c.criterion_code,
    'title', c.title,
    'requirement_text', c.requirement_text,
    'sort_order', c.sort_order,
    'source_criterion_id', c.source_criterion_id,
    'created_at', c.created_at,
    'created_by', c.created_by,
    'updated_at', c.updated_at,
    'updated_by', c.updated_by,
    'revision', p_revision
  )
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.id = p_criterion_id;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_groups_reorder(
  p_baseline_version_id UUID,
  p_group_ids UUID[],
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_existing_count BIGINT;
  v_input_count BIGINT;
  v_distinct_count BIGINT;
  v_matching_count BIGINT;
  v_revision BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  IF p_group_ids IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = p_baseline_version_id;

  SELECT COUNT(*), COUNT(DISTINCT item_id)
  INTO v_input_count, v_distinct_count
  FROM unnest(p_group_ids) AS input(item_id);

  SELECT COUNT(*) INTO v_matching_count
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = p_baseline_version_id
    AND id = ANY(p_group_ids);

  IF cardinality(p_group_ids) <> v_existing_count
     OR v_input_count <> v_distinct_count
     OR v_matching_count <> v_existing_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SET CONSTRAINTS technical_configuration_baseline_groups_version_sort_key DEFERRED;
  UPDATE public.technical_configuration_baseline_groups g
  SET sort_order = input.new_order::INTEGER,
      updated_at = now(),
      updated_by = v_user_id
  FROM unnest(p_group_ids) WITH ORDINALITY AS input(id, new_order)
  WHERE g.id = input.id;

  UPDATE public.technical_configuration_baseline_versions
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_baseline_version_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(p_baseline_version_id)
  );
END;
$$;

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
  v_user_id BIGINT;
  v_version_id UUID;
  v_criterion_id UUID;
  v_criterion_number BIGINT;
  v_criterion_code TEXT;
  v_sort_order INTEGER;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id INTO v_version_id
  FROM public.technical_configuration_baseline_groups
  WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
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

  v_criterion_code := 'TC-' || lpad(v_criterion_number::TEXT, 4, '0');
  BEGIN
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
    VALUES (
      v_version_id,
      p_group_id,
      v_criterion_code,
      NULLIF(btrim(p_title), ''),
      btrim(p_requirement_text),
      v_sort_order,
      v_user_id,
      v_user_id
    )
    RETURNING id INTO v_criterion_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_criterion_payload(
      v_criterion_id,
      v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_criterion_update(
  p_criterion_id UUID,
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
  v_user_id BIGINT;
  v_version_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id INTO v_version_id
  FROM public.technical_configuration_baseline_criteria
  WHERE id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  IF p_requirement_text IS NULL OR btrim(p_requirement_text) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  UPDATE public.technical_configuration_baseline_criteria
  SET title = NULLIF(btrim(p_title), ''),
      requirement_text = btrim(p_requirement_text),
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_criterion_payload(
      p_criterion_id,
      v_revision
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_criterion_delete(
  p_criterion_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_version_id UUID;
  v_group_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id, group_id INTO v_version_id, v_group_id
  FROM public.technical_configuration_baseline_criteria
  WHERE id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  DELETE FROM public.technical_configuration_baseline_criteria
  WHERE id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, id)::INTEGER AS new_order
    FROM public.technical_configuration_baseline_criteria
    WHERE group_id = v_group_id
  )
  UPDATE public.technical_configuration_baseline_criteria c
  SET sort_order = ordered.new_order, updated_at = now(), updated_by = v_user_id
  FROM ordered
  WHERE c.id = ordered.id AND c.sort_order <> ordered.new_order;

  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id,
    v_user_id
  );
  RETURN jsonb_build_object('data', jsonb_build_object(
    'id', p_criterion_id,
    'revision', v_revision
  ));
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_criterion_payload(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_groups_reorder(UUID, UUID[], BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_groups_reorder(UUID, UUID[], BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_criterion_create(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_criterion_create(UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_criterion_update(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_criterion_update(UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_criterion_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_criterion_delete(UUID, BIGINT) TO authenticated;

COMMIT;
