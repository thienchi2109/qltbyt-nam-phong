-- P1C expands read snapshots after P1B-compatible clients are deployed.
CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_snapshot(
  p_baseline_version_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH direct_criteria_by_group AS (
    SELECT
      c.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'baseline_version_id', c.baseline_version_id,
          'group_id', c.group_id, 'subgroup_id', c.subgroup_id,
          'criterion_code', c.criterion_code, 'title', c.title,
          'requirement_text', c.requirement_text, 'sort_order', c.sort_order,
          'source_criterion_id', c.source_criterion_id, 'created_at', c.created_at,
          'created_by', c.created_by, 'updated_at', c.updated_at, 'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_baseline_version_id
      AND c.subgroup_id IS NULL
    GROUP BY c.group_id
  ),
  criteria_by_subgroup AS (
    SELECT
      c.subgroup_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'baseline_version_id', c.baseline_version_id,
          'group_id', c.group_id, 'subgroup_id', c.subgroup_id,
          'criterion_code', c.criterion_code, 'title', c.title,
          'requirement_text', c.requirement_text, 'sort_order', c.sort_order,
          'source_criterion_id', c.source_criterion_id, 'created_at', c.created_at,
          'created_by', c.created_by, 'updated_at', c.updated_at, 'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_baseline_version_id
      AND c.subgroup_id IS NOT NULL
    GROUP BY c.subgroup_id
  ),
  subgroups_by_group AS (
    SELECT
      sg.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sg.id, 'baseline_version_id', sg.baseline_version_id,
          'group_id', sg.group_id, 'name', sg.name, 'sort_order', sg.sort_order,
          'created_at', sg.created_at, 'created_by', sg.created_by,
          'updated_at', sg.updated_at, 'updated_by', sg.updated_by,
          'criteria', COALESCE(cbs.criteria, '[]'::JSONB)
        )
        ORDER BY sg.sort_order, sg.id
      ) AS subgroups
    FROM public.technical_configuration_baseline_subgroups sg
    LEFT JOIN criteria_by_subgroup cbs ON cbs.subgroup_id = sg.id
    WHERE sg.baseline_version_id = p_baseline_version_id
    GROUP BY sg.group_id
  ),
  groups_by_version AS (
    SELECT
      g.baseline_version_id,
      jsonb_agg(
        jsonb_build_object(
          'id', g.id, 'baseline_version_id', g.baseline_version_id,
          'name', g.name, 'sort_order', g.sort_order,
          'created_at', g.created_at, 'created_by', g.created_by,
          'updated_at', g.updated_at, 'updated_by', g.updated_by,
          'criteria', COALESCE(dcbg.criteria, '[]'::JSONB),
          'subgroups', COALESCE(sbg.subgroups, '[]'::JSONB)
        )
        ORDER BY g.sort_order, g.id
      ) AS groups
    FROM public.technical_configuration_baseline_groups g
    LEFT JOIN direct_criteria_by_group dcbg ON dcbg.group_id = g.id
    LEFT JOIN subgroups_by_group sbg ON sbg.group_id = g.id
    WHERE g.baseline_version_id = p_baseline_version_id
    GROUP BY g.baseline_version_id
  )
  SELECT jsonb_build_object(
    'id', v.id, 'dossier_id', v.dossier_id,
    'version_number', v.version_number, 'status', v.status,
    'source_baseline_version_id', v.source_baseline_version_id,
    'source_version_number', source_version.version_number,
    'next_criterion_number', v.next_criterion_number, 'revision', v.revision,
    'locked_at', v.locked_at, 'locked_by', v.locked_by,
    'created_at', v.created_at, 'created_by', v.created_by,
    'updated_at', v.updated_at, 'updated_by', v.updated_by,
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
  direct_criteria_by_group AS (
    SELECT
      c.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'baseline_version_id', c.baseline_version_id,
          'group_id', c.group_id, 'subgroup_id', c.subgroup_id,
          'criterion_code', c.criterion_code, 'title', c.title,
          'requirement_text', c.requirement_text, 'sort_order', c.sort_order,
          'source_criterion_id', c.source_criterion_id, 'created_at', c.created_at,
          'created_by', c.created_by, 'updated_at', c.updated_at, 'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    INNER JOIN paged_versions pv ON pv.id = c.baseline_version_id
    WHERE c.subgroup_id IS NULL
    GROUP BY c.group_id
  ),
  criteria_by_subgroup AS (
    SELECT
      c.subgroup_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'baseline_version_id', c.baseline_version_id,
          'group_id', c.group_id, 'subgroup_id', c.subgroup_id,
          'criterion_code', c.criterion_code, 'title', c.title,
          'requirement_text', c.requirement_text, 'sort_order', c.sort_order,
          'source_criterion_id', c.source_criterion_id, 'created_at', c.created_at,
          'created_by', c.created_by, 'updated_at', c.updated_at, 'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    INNER JOIN paged_versions pv ON pv.id = c.baseline_version_id
    WHERE c.subgroup_id IS NOT NULL
    GROUP BY c.subgroup_id
  ),
  subgroups_by_group AS (
    SELECT
      sg.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sg.id, 'baseline_version_id', sg.baseline_version_id,
          'group_id', sg.group_id, 'name', sg.name, 'sort_order', sg.sort_order,
          'created_at', sg.created_at, 'created_by', sg.created_by,
          'updated_at', sg.updated_at, 'updated_by', sg.updated_by,
          'criteria', COALESCE(cbs.criteria, '[]'::JSONB)
        )
        ORDER BY sg.sort_order, sg.id
      ) AS subgroups
    FROM public.technical_configuration_baseline_subgroups sg
    INNER JOIN paged_versions pv ON pv.id = sg.baseline_version_id
    LEFT JOIN criteria_by_subgroup cbs ON cbs.subgroup_id = sg.id
    GROUP BY sg.group_id
  ),
  groups_by_version AS (
    SELECT
      g.baseline_version_id,
      jsonb_agg(
        jsonb_build_object(
          'id', g.id, 'baseline_version_id', g.baseline_version_id,
          'name', g.name, 'sort_order', g.sort_order,
          'created_at', g.created_at, 'created_by', g.created_by,
          'updated_at', g.updated_at, 'updated_by', g.updated_by,
          'criteria', COALESCE(dcbg.criteria, '[]'::JSONB),
          'subgroups', COALESCE(sbg.subgroups, '[]'::JSONB)
        )
        ORDER BY g.sort_order, g.id
      ) AS groups
    FROM public.technical_configuration_baseline_groups g
    INNER JOIN paged_versions pv ON pv.id = g.baseline_version_id
    LEFT JOIN direct_criteria_by_group dcbg ON dcbg.group_id = g.id
    LEFT JOIN subgroups_by_group sbg ON sbg.group_id = g.id
    GROUP BY g.baseline_version_id
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pv.id, 'dossier_id', pv.dossier_id,
            'version_number', pv.version_number, 'status', pv.status,
            'source_baseline_version_id', pv.source_baseline_version_id,
            'source_version_number', pv.source_version_number,
            'next_criterion_number', pv.next_criterion_number, 'revision', pv.revision,
            'locked_at', pv.locked_at, 'locked_by', pv.locked_by,
            'created_at', pv.created_at, 'created_by', pv.created_by,
            'updated_at', pv.updated_at, 'updated_by', pv.updated_by,
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
    'page', p_page,
    'page_size', p_page_size
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_documents_list(
  p_baseline_version_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page INTEGER := COALESCE(p_page, 1);
  v_page_size INTEGER := COALESCE(p_page_size, 50);
  v_result JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions
    WHERE id = p_baseline_version_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_page < 1 OR v_page_size < 1 OR v_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  WITH documents AS (
    SELECT
      id, 'baseline'::TEXT AS owner_type, baseline_version_id AS owner_id,
      name, url, created_by, created_at, updated_at
    FROM public.technical_configuration_baseline_documents
    WHERE baseline_version_id = p_baseline_version_id
    UNION ALL
    SELECT
      id, 'reference_product', reference_product_id, name, url,
      created_by, created_at, updated_at
    FROM public.technical_configuration_reference_documents
    WHERE baseline_version_id = p_baseline_version_id
  ),
  paged_documents AS (
    SELECT *
    FROM documents
    ORDER BY created_at, owner_type, id
    LIMIT v_page_size
    OFFSET (v_page - 1)::BIGINT * v_page_size
  ),
  citation_rows AS (
    SELECT
      d.owner_type,
      d.id AS document_id,
      c.id,
      c.criterion_id,
      cr.baseline_version_id,
      cr.group_id,
      cr.subgroup_id,
      cr.criterion_code,
      c.page_section,
      c.excerpt,
      c.created_at,
      g.sort_order AS group_sort_order,
      sg.sort_order AS subgroup_sort_order,
      cr.sort_order AS criterion_sort_order
    FROM public.technical_configuration_baseline_citations c
    INNER JOIN paged_documents d
      ON d.owner_type = 'baseline' AND d.id = c.baseline_document_id
    INNER JOIN public.technical_configuration_baseline_criteria cr
      ON cr.id = c.criterion_id AND cr.baseline_version_id = p_baseline_version_id
    INNER JOIN public.technical_configuration_baseline_groups g
      ON g.id = cr.group_id AND g.baseline_version_id = cr.baseline_version_id
    LEFT JOIN public.technical_configuration_baseline_subgroups sg
      ON sg.id = cr.subgroup_id
      AND sg.group_id = cr.group_id
      AND sg.baseline_version_id = cr.baseline_version_id
    WHERE c.baseline_version_id = p_baseline_version_id
    UNION ALL
    SELECT
      d.owner_type,
      d.id,
      c.id,
      c.criterion_id,
      cr.baseline_version_id,
      cr.group_id,
      cr.subgroup_id,
      cr.criterion_code,
      c.page_section,
      c.excerpt,
      c.created_at,
      g.sort_order,
      sg.sort_order,
      cr.sort_order
    FROM public.technical_configuration_reference_citations c
    INNER JOIN paged_documents d
      ON d.owner_type = 'reference_product' AND d.id = c.reference_document_id
    INNER JOIN public.technical_configuration_baseline_criteria cr
      ON cr.id = c.criterion_id AND cr.baseline_version_id = p_baseline_version_id
    INNER JOIN public.technical_configuration_baseline_groups g
      ON g.id = cr.group_id AND g.baseline_version_id = cr.baseline_version_id
    LEFT JOIN public.technical_configuration_baseline_subgroups sg
      ON sg.id = cr.subgroup_id
      AND sg.group_id = cr.group_id
      AND sg.baseline_version_id = cr.baseline_version_id
    WHERE c.baseline_version_id = p_baseline_version_id
  ),
  citations_by_document AS (
    SELECT
      cr.owner_type,
      cr.document_id,
      jsonb_agg(
        jsonb_build_object(
          'id', cr.id,
          'criterion_id', cr.criterion_id,
          'baseline_version_id', cr.baseline_version_id,
          'group_id', cr.group_id,
          'subgroup_id', cr.subgroup_id,
          'criterion_code', cr.criterion_code,
          'page_section', cr.page_section,
          'excerpt', cr.excerpt
        )
        ORDER BY
          cr.group_sort_order,
          (cr.subgroup_id IS NOT NULL),
          cr.subgroup_sort_order,
          cr.criterion_sort_order,
          cr.created_at,
          cr.id
      ) AS citations
    FROM citation_rows cr
    GROUP BY cr.owner_type, cr.document_id
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'owner_type', d.owner_type,
            'owner_id', d.owner_id,
            'name', d.name,
            'url', d.url,
            'created_by', d.created_by,
            'created_at', d.created_at,
            'updated_at', d.updated_at,
            'citations', COALESCE(cbd.citations, '[]'::JSONB)
          )
          ORDER BY d.created_at, d.owner_type, d.id
        )
        FROM paged_documents d
        LEFT JOIN citations_by_document cbd
          ON cbd.owner_type = d.owner_type AND cbd.document_id = d.id
      ),
      '[]'::JSONB
    ),
    'total', (SELECT count(*) FROM documents),
    'page', v_page,
    'page_size', v_page_size
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_documents_list(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_documents_list(UUID, INTEGER, INTEGER) TO authenticated;
