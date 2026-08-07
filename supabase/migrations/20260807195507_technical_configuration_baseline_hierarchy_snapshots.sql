-- P1D extends only aggregate copy. Lock already returns the P1C hierarchy snapshot
-- without rewriting groups, subgroups, or criteria.
CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_copy_p4(
  p_source_baseline_version_id UUID,
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
  v_archived_at TIMESTAMPTZ;
  v_source_status TEXT;
  v_source_revision BIGINT;
  v_next_criterion_number BIGINT;
  v_version_number BIGINT;
  v_new_version_id UUID;
  v_dossier_revision BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();

  SELECT v.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT d.archived_at
  INTO v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT
    v.status,
    v.revision,
    v.next_criterion_number
  INTO
    v_source_status,
    v_source_revision,
    v_next_criterion_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id
    AND v.dossier_id = v_dossier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;

  IF v_source_status <> 'locked' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  IF v_source_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.dossier_id = v_dossier_id
      AND v.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'draft_already_exists' USING ERRCODE = 'PT409';
  END IF;

  SELECT COALESCE(MAX(v.version_number), 0) + 1
  INTO v_version_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.dossier_id = v_dossier_id;

  v_new_version_id := gen_random_uuid();

  INSERT INTO public.technical_configuration_baseline_versions (
    id,
    dossier_id,
    version_number,
    status,
    source_baseline_version_id,
    next_criterion_number,
    revision,
    created_by,
    updated_by
  )
  VALUES (
    v_new_version_id,
    v_dossier_id,
    v_version_number,
    'draft',
    p_source_baseline_version_id,
    v_next_criterion_number,
    1,
    v_user_id,
    v_user_id
  );

  CREATE TEMP TABLE technical_configuration_baseline_group_copy_map (
    source_group_id UUID PRIMARY KEY,
    target_group_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;

  INSERT INTO pg_temp.technical_configuration_baseline_group_copy_map (
    source_group_id,
    target_group_id
  )
  SELECT g.id, gen_random_uuid()
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_source_baseline_version_id;

  INSERT INTO public.technical_configuration_baseline_groups (
    id,
    baseline_version_id,
    name,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    group_map.target_group_id,
    v_new_version_id,
    g.name,
    g.sort_order,
    v_user_id,
    v_user_id
  FROM pg_temp.technical_configuration_baseline_group_copy_map group_map
  INNER JOIN public.technical_configuration_baseline_groups g
    ON g.id = group_map.source_group_id
  ORDER BY g.sort_order, g.id;

  CREATE TEMP TABLE technical_configuration_baseline_subgroup_copy_map (
    source_subgroup_id UUID PRIMARY KEY,
    target_subgroup_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;

  INSERT INTO pg_temp.technical_configuration_baseline_subgroup_copy_map (
    source_subgroup_id,
    target_subgroup_id
  )
  SELECT s.id, gen_random_uuid()
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.baseline_version_id = p_source_baseline_version_id;

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
    subgroup_map.target_subgroup_id,
    v_new_version_id,
    group_map.target_group_id,
    s.name,
    s.sort_order,
    v_user_id,
    v_user_id
  FROM pg_temp.technical_configuration_baseline_subgroup_copy_map subgroup_map
  INNER JOIN public.technical_configuration_baseline_subgroups s
    ON s.id = subgroup_map.source_subgroup_id
  INNER JOIN pg_temp.technical_configuration_baseline_group_copy_map group_map
    ON group_map.source_group_id = s.group_id
  ORDER BY s.group_id, s.sort_order, s.id;

  INSERT INTO public.technical_configuration_baseline_criteria (
    id,
    baseline_version_id,
    group_id,
    subgroup_id,
    criterion_code,
    title,
    requirement_text,
    sort_order,
    source_criterion_id,
    created_by,
    updated_by
  )
  SELECT
    gen_random_uuid(),
    v_new_version_id,
    group_map.target_group_id,
    subgroup_map.target_subgroup_id,
    c.criterion_code,
    c.title,
    c.requirement_text,
    c.sort_order,
    c.id,
    v_user_id,
    v_user_id
  FROM public.technical_configuration_baseline_criteria c
  INNER JOIN pg_temp.technical_configuration_baseline_group_copy_map group_map
    ON group_map.source_group_id = c.group_id
  LEFT JOIN pg_temp.technical_configuration_baseline_subgroup_copy_map subgroup_map
    ON subgroup_map.source_subgroup_id = c.subgroup_id
  WHERE c.baseline_version_id = p_source_baseline_version_id
  ORDER BY c.group_id, (c.subgroup_id IS NOT NULL), c.sort_order, c.id;

  -- P7A/P7B wrappers add their baseline-owned leaf tables after this helper returns.
  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_dossier_revision;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(v_new_version_id)
      || jsonb_build_object('dossier_revision', v_dossier_revision)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_copy_p4(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;

-- Rollback is forward-only once subgroup-bearing copies exist: supersede this helper
-- without dropping subgroup storage or relationships.
