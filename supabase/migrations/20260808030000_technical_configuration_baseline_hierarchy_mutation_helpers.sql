-- P1E internal helpers are deployed first but remain unreachable from client roles.
CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_hierarchy_context(
  p_group_id UUID,
  p_subgroup_id UUID,
  p_expected_revision BIGINT
)
RETURNS TABLE(user_id BIGINT, version_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_version_id UUID;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT g.baseline_version_id
  INTO v_version_id
  FROM public.technical_configuration_baseline_groups g
  WHERE g.id = p_group_id;
  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.technical_configuration_baseline_subgroups s
      WHERE s.id = p_group_id
    ) THEN
      RAISE EXCEPTION 'unsupported_hierarchy_depth' USING ERRCODE = 'PT422';
    END IF;
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );

  IF p_subgroup_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.technical_configuration_baseline_subgroups s
       WHERE s.id = p_subgroup_id
         AND s.group_id = p_group_id
         AND s.baseline_version_id = v_version_id
     ) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  user_id := v_user_id;
  version_id := v_version_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_normalize_group(
  p_group_id UUID,
  p_user_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  SET CONSTRAINTS tc_baseline_subgroups_group_sort_key DEFERRED;
  SET CONSTRAINTS technical_configuration_baseline_criteria_group_sort_key DEFERRED;

  WITH ordered_subgroups AS (
    SELECT
      s.id,
      row_number() OVER (ORDER BY s.sort_order, s.id)::INTEGER AS new_order
    FROM public.technical_configuration_baseline_subgroups s
    WHERE s.group_id = p_group_id
  )
  UPDATE public.technical_configuration_baseline_subgroups s
  SET sort_order = ordered_subgroups.new_order,
      updated_at = now(),
      updated_by = p_user_id
  FROM ordered_subgroups
  WHERE s.id = ordered_subgroups.id
    AND s.sort_order <> ordered_subgroups.new_order;

  WITH ordered_criteria AS (
    SELECT
      c.id,
      row_number() OVER (
        ORDER BY
          CASE WHEN c.subgroup_id IS NULL THEN 0 ELSE 1 END,
          s.sort_order NULLS FIRST,
          c.sort_order,
          c.id
      )::INTEGER AS new_order
    FROM public.technical_configuration_baseline_criteria c
    LEFT JOIN public.technical_configuration_baseline_subgroups s
      ON s.id = c.subgroup_id
     AND s.group_id = c.group_id
     AND s.baseline_version_id = c.baseline_version_id
    WHERE c.group_id = p_group_id
  )
  UPDATE public.technical_configuration_baseline_criteria c
  SET sort_order = ordered_criteria.new_order,
      updated_at = now(),
      updated_by = p_user_id
  FROM ordered_criteria
  WHERE c.id = ordered_criteria.id
    AND c.sort_order <> ordered_criteria.new_order;
END;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_subgroup_payload(
  p_subgroup_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'baseline_version_id', s.baseline_version_id,
    'group_id', s.group_id,
    'name', s.name,
    'sort_order', s.sort_order,
    'created_at', s.created_at,
    'created_by', s.created_by,
    'updated_at', s.updated_at,
    'updated_by', s.updated_by,
    'revision', p_revision
  )
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.id = p_subgroup_id;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_hierarchy_criterion_payload(
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
    'subgroup_id', c.subgroup_id,
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

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_hierarchy_context(UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_normalize_group(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_subgroup_payload(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_hierarchy_criterion_payload(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
