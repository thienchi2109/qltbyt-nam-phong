-- Issue #957: make Technical Configuration copy workspaces re-entrant.
BEGIN;

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
  v_role TEXT;
  v_claim_user_id TEXT;
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
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  v_user_id := public._technical_configuration_require_global_user();
  SELECT v.dossier_id INTO v_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  SELECT d.archived_at INTO v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  SELECT v.status, v.revision, v.next_criterion_number
  INTO v_source_status, v_source_revision, v_next_criterion_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id AND v.dossier_id = v_dossier_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
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
    SELECT 1 FROM public.technical_configuration_baseline_versions v
    WHERE v.dossier_id = v_dossier_id AND v.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'draft_already_exists' USING ERRCODE = 'PT409';
  END IF;
  SELECT COALESCE(MAX(v.version_number), 0) + 1 INTO v_version_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.dossier_id = v_dossier_id;
  v_new_version_id := gen_random_uuid();
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, source_baseline_version_id,
    next_criterion_number, revision, created_by, updated_by
  ) VALUES (
    v_new_version_id, v_dossier_id, v_version_number, 'draft',
    p_source_baseline_version_id, v_next_criterion_number, 1, v_user_id, v_user_id
  );

  DROP TABLE IF EXISTS pg_temp.technical_configuration_baseline_group_copy_map;
  CREATE TEMP TABLE technical_configuration_baseline_group_copy_map (
    source_group_id UUID PRIMARY KEY,
    target_group_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_baseline_group_copy_map
    (source_group_id, target_group_id)
  SELECT g.id, gen_random_uuid()
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  )
  SELECT m.target_group_id, v_new_version_id, g.name, g.sort_order, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_baseline_group_copy_map m
  JOIN public.technical_configuration_baseline_groups g ON g.id = m.source_group_id
  ORDER BY g.sort_order, g.id;

  DROP TABLE IF EXISTS pg_temp.technical_configuration_baseline_subgroup_copy_map;
  CREATE TEMP TABLE technical_configuration_baseline_subgroup_copy_map (
    source_subgroup_id UUID PRIMARY KEY,
    target_subgroup_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_baseline_subgroup_copy_map
    (source_subgroup_id, target_subgroup_id)
  SELECT s.id, gen_random_uuid()
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_subgroups (
    id, baseline_version_id, group_id, name, sort_order, created_by, updated_by
  )
  SELECT sm.target_subgroup_id, v_new_version_id, gm.target_group_id,
    s.name, s.sort_order, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_baseline_subgroup_copy_map sm
  JOIN public.technical_configuration_baseline_subgroups s
    ON s.id = sm.source_subgroup_id
  JOIN pg_temp.technical_configuration_baseline_group_copy_map gm
    ON gm.source_group_id = s.group_id
  ORDER BY s.group_id, s.sort_order, s.id;

  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, subgroup_id, criterion_code, title,
    requirement_text, sort_order, source_criterion_id, created_by, updated_by
  )
  SELECT gen_random_uuid(), v_new_version_id, gm.target_group_id, sm.target_subgroup_id,
    c.criterion_code, c.title, c.requirement_text, c.sort_order, c.id, v_user_id, v_user_id
  FROM public.technical_configuration_baseline_criteria c
  JOIN pg_temp.technical_configuration_baseline_group_copy_map gm
    ON gm.source_group_id = c.group_id
  LEFT JOIN pg_temp.technical_configuration_baseline_subgroup_copy_map sm
    ON sm.source_subgroup_id = c.subgroup_id
  WHERE c.baseline_version_id = p_source_baseline_version_id
  ORDER BY c.group_id, (c.subgroup_id IS NOT NULL), c.sort_order, c.id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_dossier_revision;
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(v_new_version_id)
      || jsonb_build_object('dossier_revision', v_dossier_revision)
  );
END;
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_copy_p4(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_copy_p7a1(
  p_source_baseline_version_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
  v_response JSONB;
  v_new_version_id UUID;
  v_user_id BIGINT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  v_user_id := public._technical_configuration_require_global_user();
  v_response := public._technical_configuration_baseline_copy_p4(
    p_source_baseline_version_id, p_expected_revision
  );
  v_new_version_id := (v_response->'data'->>'id')::UUID;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_reference_product_copy_map;
  CREATE TEMP TABLE technical_configuration_reference_product_copy_map (
    source_reference_product_id UUID PRIMARY KEY,
    target_reference_product_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_reference_product_copy_map (
    source_reference_product_id, target_reference_product_id
  )
  SELECT p.id, gen_random_uuid()
  FROM public.technical_configuration_reference_products p
  WHERE p.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_products (
    id, baseline_version_id, model, manufacturer, description, notes,
    created_by, updated_by
  )
  SELECT m.target_reference_product_id, v_new_version_id, p.model, p.manufacturer,
    p.description, p.notes, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_reference_product_copy_map m
  JOIN public.technical_configuration_reference_products p
    ON p.id = m.source_reference_product_id;
  INSERT INTO public.technical_configuration_reference_responses (
    id, baseline_version_id, reference_product_id, criterion_id,
    response_text, created_by, updated_by
  )
  SELECT gen_random_uuid(), v_new_version_id, m.target_reference_product_id,
    copied_criterion.id, r.response_text, v_user_id, v_user_id
  FROM public.technical_configuration_reference_responses r
  JOIN pg_temp.technical_configuration_reference_product_copy_map m
    ON m.source_reference_product_id = r.reference_product_id
  JOIN public.technical_configuration_baseline_criteria copied_criterion
    ON copied_criterion.baseline_version_id = v_new_version_id
   AND copied_criterion.source_criterion_id = r.criterion_id
  WHERE r.baseline_version_id = p_source_baseline_version_id;
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_copy_p7a1(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy(
  p_source_baseline_version_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
  v_response JSONB;
  v_new_version_id UUID;
  v_user_id BIGINT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  v_user_id := public._technical_configuration_require_global_user();
  v_response := public._technical_configuration_baseline_copy_p7a1(
    p_source_baseline_version_id, p_expected_revision
  );
  v_new_version_id := (v_response->'data'->>'id')::UUID;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_baseline_document_copy_map;
  CREATE TEMP TABLE technical_configuration_baseline_document_copy_map (
    source_document_id UUID PRIMARY KEY,
    target_document_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_baseline_document_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_baseline_documents
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_documents (
    id, baseline_version_id, name, url, created_by, updated_by
  )
  SELECT m.target_document_id, v_new_version_id, d.name, d.url, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_baseline_document_copy_map m
  JOIN public.technical_configuration_baseline_documents d ON d.id = m.source_document_id;
  INSERT INTO public.technical_configuration_baseline_citations (
    baseline_version_id, baseline_document_id, criterion_id, page_section,
    excerpt, created_by, updated_by
  )
  SELECT v_new_version_id, m.target_document_id, target_criterion.id,
    c.page_section, c.excerpt, v_user_id, v_user_id
  FROM public.technical_configuration_baseline_citations c
  JOIN pg_temp.technical_configuration_baseline_document_copy_map m
    ON m.source_document_id = c.baseline_document_id
  JOIN public.technical_configuration_baseline_criteria target_criterion
    ON target_criterion.baseline_version_id = v_new_version_id
   AND target_criterion.source_criterion_id = c.criterion_id;

  DROP TABLE IF EXISTS pg_temp.technical_configuration_reference_document_copy_map;
  CREATE TEMP TABLE technical_configuration_reference_document_copy_map (
    source_document_id UUID PRIMARY KEY,
    target_document_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_reference_document_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_reference_documents
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_documents (
    id, baseline_version_id, reference_product_id, name, url, created_by, updated_by
  )
  SELECT m.target_document_id, v_new_version_id, product_map.target_reference_product_id,
    d.name, d.url, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_reference_document_copy_map m
  JOIN public.technical_configuration_reference_documents d ON d.id = m.source_document_id
  JOIN pg_temp.technical_configuration_reference_product_copy_map product_map
    ON product_map.source_reference_product_id = d.reference_product_id;
  INSERT INTO public.technical_configuration_reference_citations (
    baseline_version_id, reference_document_id, criterion_id, page_section,
    excerpt, created_by, updated_by
  )
  SELECT v_new_version_id, m.target_document_id, target_criterion.id,
    c.page_section, c.excerpt, v_user_id, v_user_id
  FROM public.technical_configuration_reference_citations c
  JOIN pg_temp.technical_configuration_reference_document_copy_map m
    ON m.source_document_id = c.reference_document_id
  JOIN public.technical_configuration_baseline_criteria target_criterion
    ON target_criterion.baseline_version_id = v_new_version_id
   AND target_criterion.source_criterion_id = c.criterion_id;
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT)
  TO authenticated;

CREATE OR REPLACE FUNCTION technical_configuration_internal.baseline_cross_dossier_copy_rows(
  p_source_baseline_version_id UUID,
  p_target_baseline_version_id UUID,
  p_user_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_claim_user_id TEXT;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'app_role', '');
  v_claim_user_id := NULLIF(current_setting('request.jwt.claims', true)::JSONB->>'user_id', '');
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  PERFORM public._technical_configuration_require_global_user();

  DROP TABLE IF EXISTS pg_temp.technical_configuration_xd_group_copy_map;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_xd_subgroup_copy_map;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_xd_criterion_copy_map;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_xd_reference_product_copy_map;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_xd_baseline_document_copy_map;
  DROP TABLE IF EXISTS pg_temp.technical_configuration_xd_reference_document_copy_map;
  CREATE TEMP TABLE technical_configuration_xd_group_copy_map (
    source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_xd_subgroup_copy_map (
    source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_xd_criterion_copy_map (
    source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_xd_reference_product_copy_map (
    source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_xd_baseline_document_copy_map (
    source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  CREATE TEMP TABLE technical_configuration_xd_reference_document_copy_map (
    source_id UUID PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_xd_group_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_groups
    (id, baseline_version_id, name, sort_order, created_by, updated_by)
  SELECT m.target_id, p_target_baseline_version_id, g.name, g.sort_order, p_user_id, p_user_id
  FROM pg_temp.technical_configuration_xd_group_copy_map m
  JOIN public.technical_configuration_baseline_groups g ON g.id = m.source_id;
  INSERT INTO pg_temp.technical_configuration_xd_subgroup_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_baseline_subgroups
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_subgroups
    (id, baseline_version_id, group_id, name, sort_order, created_by, updated_by)
  SELECT sm.target_id, p_target_baseline_version_id, gm.target_id, sg.name,
    sg.sort_order, p_user_id, p_user_id
  FROM pg_temp.technical_configuration_xd_subgroup_copy_map sm
  JOIN public.technical_configuration_baseline_subgroups sg ON sg.id = sm.source_id
  JOIN pg_temp.technical_configuration_xd_group_copy_map gm ON gm.source_id = sg.group_id;
  INSERT INTO pg_temp.technical_configuration_xd_criterion_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, subgroup_id, criterion_code, title,
    requirement_text, sort_order, source_criterion_id, created_by, updated_by
  )
  SELECT cm.target_id, p_target_baseline_version_id, gm.target_id, sm.target_id,
    c.criterion_code, c.title, c.requirement_text, c.sort_order, c.id, p_user_id, p_user_id
  FROM pg_temp.technical_configuration_xd_criterion_copy_map cm
  JOIN public.technical_configuration_baseline_criteria c ON c.id = cm.source_id
  JOIN pg_temp.technical_configuration_xd_group_copy_map gm ON gm.source_id = c.group_id
  LEFT JOIN pg_temp.technical_configuration_xd_subgroup_copy_map sm
    ON sm.source_id = c.subgroup_id;
  INSERT INTO pg_temp.technical_configuration_xd_reference_product_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_reference_products
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_products (
    id, baseline_version_id, model, manufacturer, description, notes, created_by, updated_by
  )
  SELECT pm.target_id, p_target_baseline_version_id, p.model, p.manufacturer,
    p.description, p.notes, p_user_id, p_user_id
  FROM pg_temp.technical_configuration_xd_reference_product_copy_map pm
  JOIN public.technical_configuration_reference_products p ON p.id = pm.source_id;
  INSERT INTO public.technical_configuration_reference_responses (
    id, baseline_version_id, reference_product_id, criterion_id, response_text,
    created_by, updated_by
  )
  SELECT gen_random_uuid(), p_target_baseline_version_id, pm.target_id, cm.target_id,
    r.response_text, p_user_id, p_user_id
  FROM public.technical_configuration_reference_responses r
  JOIN pg_temp.technical_configuration_xd_reference_product_copy_map pm
    ON pm.source_id = r.reference_product_id
  JOIN pg_temp.technical_configuration_xd_criterion_copy_map cm ON cm.source_id = r.criterion_id
  WHERE r.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO pg_temp.technical_configuration_xd_baseline_document_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_baseline_documents
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_documents (
    id, baseline_version_id, name, url, created_by, updated_by
  )
  SELECT dm.target_id, p_target_baseline_version_id, d.name, d.url, p_user_id, p_user_id
  FROM pg_temp.technical_configuration_xd_baseline_document_copy_map dm
  JOIN public.technical_configuration_baseline_documents d ON d.id = dm.source_id;
  INSERT INTO public.technical_configuration_baseline_citations (
    id, baseline_version_id, baseline_document_id, criterion_id, page_section, excerpt,
    created_by, updated_by
  )
  SELECT gen_random_uuid(), p_target_baseline_version_id, dm.target_id, cm.target_id,
    c.page_section, c.excerpt, p_user_id, p_user_id
  FROM public.technical_configuration_baseline_citations c
  JOIN pg_temp.technical_configuration_xd_baseline_document_copy_map dm
    ON dm.source_id = c.baseline_document_id
  JOIN pg_temp.technical_configuration_xd_criterion_copy_map cm ON cm.source_id = c.criterion_id
  WHERE c.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO pg_temp.technical_configuration_xd_reference_document_copy_map
  SELECT id, gen_random_uuid()
  FROM public.technical_configuration_reference_documents
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_documents (
    id, baseline_version_id, reference_product_id, name, url, created_by, updated_by
  )
  SELECT dm.target_id, p_target_baseline_version_id, pm.target_id, d.name, d.url,
    p_user_id, p_user_id
  FROM pg_temp.technical_configuration_xd_reference_document_copy_map dm
  JOIN public.technical_configuration_reference_documents d ON d.id = dm.source_id
  JOIN pg_temp.technical_configuration_xd_reference_product_copy_map pm
    ON pm.source_id = d.reference_product_id;
  INSERT INTO public.technical_configuration_reference_citations (
    id, baseline_version_id, reference_document_id, criterion_id, page_section, excerpt,
    created_by, updated_by
  )
  SELECT gen_random_uuid(), p_target_baseline_version_id, dm.target_id, cm.target_id,
    c.page_section, c.excerpt, p_user_id, p_user_id
  FROM public.technical_configuration_reference_citations c
  JOIN pg_temp.technical_configuration_xd_reference_document_copy_map dm
    ON dm.source_id = c.reference_document_id
  JOIN pg_temp.technical_configuration_xd_criterion_copy_map cm ON cm.source_id = c.criterion_id
  WHERE c.baseline_version_id = p_source_baseline_version_id;
  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = (
        SELECT source.next_criterion_number
        FROM public.technical_configuration_baseline_versions source
        WHERE source.id = p_source_baseline_version_id
      ),
      updated_at = now(), updated_by = p_user_id
  WHERE id = p_target_baseline_version_id;
END;
$$;
REVOKE ALL ON FUNCTION technical_configuration_internal.baseline_cross_dossier_copy_rows(
  UUID, UUID, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  v_p4 TEXT := pg_get_functiondef(
    'public._technical_configuration_baseline_copy_p4(UUID, BIGINT)'::regprocedure
  );
  v_p7a1 TEXT := pg_get_functiondef(
    'public._technical_configuration_baseline_copy_p7a1(UUID, BIGINT)'::regprocedure
  );
  v_wrapper TEXT := pg_get_functiondef(
    'public.technical_configuration_baseline_copy(UUID, BIGINT)'::regprocedure
  );
  v_cross TEXT := pg_get_functiondef(
    'technical_configuration_internal.baseline_cross_dossier_copy_rows(UUID, UUID, BIGINT)'::regprocedure
  );
BEGIN
  IF position('ON COMMIT DROP' IN v_p4) = 0
     OR position('ON COMMIT DROP' IN v_p7a1) = 0
     OR position('ON COMMIT DROP' IN v_wrapper) = 0
     OR position('ON COMMIT DROP' IN v_cross) = 0 THEN
    RAISE EXCEPTION 'Issue #957 workspace assertion failed: missing ON COMMIT DROP';
  END IF;
  IF position('technical_configuration_baseline_group_copy_map' IN v_cross) > 0
     OR position('technical_configuration_reference_product_copy_map' IN v_cross) > 0
     OR position('technical_configuration_baseline_document_copy_map' IN v_cross) > 0 THEN
    RAISE EXCEPTION 'Issue #957 workspace assertion failed: old cross-dossier map name remains';
  END IF;
  IF position('technical_configuration_xd_group_copy_map' IN v_cross) = 0
     OR position('technical_configuration_xd_subgroup_copy_map' IN v_cross) = 0
     OR position('technical_configuration_xd_criterion_copy_map' IN v_cross) = 0
     OR position('technical_configuration_xd_reference_product_copy_map' IN v_cross) = 0
     OR position('technical_configuration_xd_baseline_document_copy_map' IN v_cross) = 0
     OR position('technical_configuration_xd_reference_document_copy_map' IN v_cross) = 0 THEN
    RAISE EXCEPTION 'Issue #957 workspace assertion failed: renamed cross-dossier map missing';
  END IF;
END;
$$;

COMMIT;
