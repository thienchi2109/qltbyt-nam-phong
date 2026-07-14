-- P4 review follow-up: set-based history snapshots and stable copy lineage metadata.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_snapshot(
  p_baseline_version_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH criteria_by_group AS (
    SELECT
      c.group_id,
      jsonb_agg(
        jsonb_build_object(
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
          'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_baseline_version_id
    GROUP BY c.group_id
  ),
  groups_by_version AS (
    SELECT
      g.baseline_version_id,
      jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'baseline_version_id', g.baseline_version_id,
          'name', g.name,
          'sort_order', g.sort_order,
          'created_at', g.created_at,
          'created_by', g.created_by,
          'updated_at', g.updated_at,
          'updated_by', g.updated_by,
          'criteria', COALESCE(cbg.criteria, '[]'::JSONB)
        )
        ORDER BY g.sort_order, g.id
      ) AS groups
    FROM public.technical_configuration_baseline_groups g
    LEFT JOIN criteria_by_group cbg ON cbg.group_id = g.id
    WHERE g.baseline_version_id = p_baseline_version_id
    GROUP BY g.baseline_version_id
  )
  SELECT jsonb_build_object(
    'id', v.id,
    'dossier_id', v.dossier_id,
    'version_number', v.version_number,
    'status', v.status,
    'source_baseline_version_id', v.source_baseline_version_id,
    'source_version_number', source_version.version_number,
    'next_criterion_number', v.next_criterion_number,
    'revision', v.revision,
    'locked_at', v.locked_at,
    'locked_by', v.locked_by,
    'created_at', v.created_at,
    'created_by', v.created_by,
    'updated_at', v.updated_at,
    'updated_by', v.updated_by,
    'groups', COALESCE(gbv.groups, '[]'::JSONB)
  )
  FROM public.technical_configuration_baseline_versions v
  LEFT JOIN public.technical_configuration_baseline_versions source_version
    ON source_version.id = v.source_baseline_version_id
  LEFT JOIN groups_by_version gbv ON gbv.baseline_version_id = v.id
  WHERE v.id = p_baseline_version_id;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_versions_list(
  p_dossier_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_page IS NULL
     OR p_page < 1
     OR p_page_size IS NULL
     OR NOT (p_page_size BETWEEN 1 AND 100) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  PERFORM 1
  FROM public.technical_configuration_dossiers d
  WHERE d.id = p_dossier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  WITH paged_versions AS (
    SELECT
      v.id,
      v.dossier_id,
      v.version_number,
      v.status,
      v.source_baseline_version_id,
      source_version.version_number AS source_version_number,
      v.next_criterion_number,
      v.revision,
      v.locked_at,
      v.locked_by,
      v.created_at,
      v.created_by,
      v.updated_at,
      v.updated_by
    FROM public.technical_configuration_baseline_versions v
    LEFT JOIN public.technical_configuration_baseline_versions source_version
      ON source_version.id = v.source_baseline_version_id
    WHERE v.dossier_id = p_dossier_id
    ORDER BY v.version_number DESC, v.id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  ),
  criteria_by_group AS (
    SELECT
      c.group_id,
      jsonb_agg(
        jsonb_build_object(
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
          'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    INNER JOIN paged_versions pv ON pv.id = c.baseline_version_id
    GROUP BY c.group_id
  ),
  groups_by_version AS (
    SELECT
      g.baseline_version_id,
      jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'baseline_version_id', g.baseline_version_id,
          'name', g.name,
          'sort_order', g.sort_order,
          'created_at', g.created_at,
          'created_by', g.created_by,
          'updated_at', g.updated_at,
          'updated_by', g.updated_by,
          'criteria', COALESCE(cbg.criteria, '[]'::JSONB)
        )
        ORDER BY g.sort_order, g.id
      ) AS groups
    FROM public.technical_configuration_baseline_groups g
    INNER JOIN paged_versions pv ON pv.id = g.baseline_version_id
    LEFT JOIN criteria_by_group cbg ON cbg.group_id = g.id
    GROUP BY g.baseline_version_id
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pv.id,
            'dossier_id', pv.dossier_id,
            'version_number', pv.version_number,
            'status', pv.status,
            'source_baseline_version_id', pv.source_baseline_version_id,
            'source_version_number', pv.source_version_number,
            'next_criterion_number', pv.next_criterion_number,
            'revision', pv.revision,
            'locked_at', pv.locked_at,
            'locked_by', pv.locked_by,
            'created_at', pv.created_at,
            'created_by', pv.created_by,
            'updated_at', pv.updated_at,
            'updated_by', pv.updated_by,
            'groups', COALESCE(gbv.groups, '[]'::JSONB)
          )
          ORDER BY pv.version_number DESC, pv.id
        )
        FROM paged_versions pv
        LEFT JOIN groups_by_version gbv ON gbv.baseline_version_id = pv.id
      ),
      '[]'::JSONB
    ),
    'total',
    (
      SELECT count(*)
      FROM public.technical_configuration_baseline_versions v
      WHERE v.dossier_id = p_dossier_id
    ),
    'page',
    p_page,
    'page_size',
    p_page_size
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
