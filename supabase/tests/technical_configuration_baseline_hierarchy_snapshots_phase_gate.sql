-- supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql
-- Purpose: prove P1D hierarchy copy, wrapper remap, canonical ordering, and lock identity.
-- Non-destructive: all fixture writes are wrapped in a transaction and rolled back.
BEGIN;

CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid(); v_source_version_id UUID := gen_random_uuid();
  v_source_group_id UUID := gen_random_uuid();
  v_source_subgroup_a_id UUID := gen_random_uuid(); v_source_subgroup_b_id UUID := gen_random_uuid();
  v_source_direct_a_id UUID := gen_random_uuid(); v_source_direct_b_id UUID := gen_random_uuid();
  v_source_subgroup_a1_id UUID := gen_random_uuid(); v_source_subgroup_a2_id UUID := gen_random_uuid();
  v_source_subgroup_b1_id UUID := gen_random_uuid();
  v_reference_product_id UUID := gen_random_uuid();
  v_baseline_document_id UUID := gen_random_uuid(); v_reference_document_id UUID := gen_random_uuid();
  v_copy_version_id UUID;
  v_copy_group_ids UUID[]; v_copy_subgroup_ids UUID[];
  v_copy_criterion_ids UUID[]; v_copy_source_criterion_ids UUID[];
  v_locked_group_ids UUID[]; v_locked_subgroup_ids UUID[]; v_locked_criterion_ids UUID[];
  v_source_criterion_ids UUID[];
  v_copy_response JSONB; v_copy_snapshot JSONB;
  v_lock_response JSONB; v_locked_snapshot JSONB;
  v_copy_revision BIGINT;
  v_count BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_hierarchy_snapshots_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;

  PERFORM pg_temp.set_claims('global', v_user_id);

  INSERT INTO public.technical_configuration_dossiers
    (id, device_type_name, name, description, created_by, updated_by)
  VALUES (
    v_dossier_id,
    'P1D hierarchy device ' || v_suffix,
    'P1D hierarchy dossier ' || v_suffix,
    'Rolled back after verification',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_versions
    (id, dossier_id, version_number, status, next_criterion_number, revision,
     locked_at, locked_by, created_by, updated_by)
  VALUES (
    v_source_version_id,
    v_dossier_id,
    1,
    'locked',
    6,
    7,
    now(),
    v_user_id,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_groups
    (id, baseline_version_id, name, sort_order, created_by, updated_by)
  VALUES (
    v_source_group_id,
    v_source_version_id,
    'Main section',
    1,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_subgroups
    (id, baseline_version_id, group_id, name, sort_order, created_by, updated_by)
  VALUES
    (
      v_source_subgroup_a_id,
      v_source_version_id,
      v_source_group_id,
      'Subgroup A',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_source_subgroup_b_id,
      v_source_version_id,
      v_source_group_id,
      'Subgroup B',
      2,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_criteria
    (id, baseline_version_id, group_id, subgroup_id, criterion_code,
     requirement_text, sort_order, created_by, updated_by)
  VALUES
    (
      v_source_direct_a_id,
      v_source_version_id,
      v_source_group_id,
      NULL,
      'TC-0001',
      'Direct criterion A',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_source_direct_b_id,
      v_source_version_id,
      v_source_group_id,
      NULL,
      'TC-0002',
      'Direct criterion B',
      2,
      v_user_id,
      v_user_id
    ),
    (
      v_source_subgroup_a1_id,
      v_source_version_id,
      v_source_group_id,
      v_source_subgroup_a_id,
      'TC-0003',
      'Subgroup A criterion 1',
      3,
      v_user_id,
      v_user_id
    ),
    (
      v_source_subgroup_a2_id,
      v_source_version_id,
      v_source_group_id,
      v_source_subgroup_a_id,
      'TC-0004',
      'Subgroup A criterion 2',
      4,
      v_user_id,
      v_user_id
    ),
    (
      v_source_subgroup_b1_id,
      v_source_version_id,
      v_source_group_id,
      v_source_subgroup_b_id,
      'TC-0005',
      'Subgroup B criterion 1',
      5,
      v_user_id,
      v_user_id
    );

  v_source_criterion_ids := ARRAY[
    v_source_direct_a_id,
    v_source_direct_b_id,
    v_source_subgroup_a1_id,
    v_source_subgroup_a2_id,
    v_source_subgroup_b1_id
  ];

  INSERT INTO public.technical_configuration_reference_products
    (id, baseline_version_id, model, manufacturer, created_by, updated_by)
  VALUES (
    v_reference_product_id,
    v_source_version_id,
    'P1D model',
    'P1D manufacturer',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_reference_responses
    (baseline_version_id, reference_product_id, criterion_id, response_text,
     created_by, updated_by)
  VALUES (
    v_source_version_id,
    v_reference_product_id,
    v_source_subgroup_a1_id,
    'P1D response',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_documents
    (id, baseline_version_id, name, url, created_by, updated_by)
  VALUES (
    v_baseline_document_id,
    v_source_version_id,
    'P1D baseline document',
    'https://example.com/p1d-baseline',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_citations
    (baseline_version_id, baseline_document_id, criterion_id, page_section,
     excerpt, created_by, updated_by)
  VALUES (
    v_source_version_id,
    v_baseline_document_id,
    v_source_direct_a_id,
    '1',
    'P1D baseline citation',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_reference_documents
    (id, baseline_version_id, reference_product_id, name, url, created_by, updated_by)
  VALUES (
    v_reference_document_id,
    v_source_version_id,
    v_reference_product_id,
    'P1D reference document',
    'https://example.com/p1d-reference',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_reference_citations
    (baseline_version_id, reference_document_id, criterion_id, page_section,
     excerpt, created_by, updated_by)
  VALUES (
    v_source_version_id,
    v_reference_document_id,
    v_source_subgroup_b1_id,
    '2',
    'P1D reference citation',
    v_user_id,
    v_user_id
  );

  SELECT public.technical_configuration_baseline_copy(v_source_version_id, 7)
  INTO v_copy_response;

  v_copy_snapshot := v_copy_response->'data';
  v_copy_version_id := (v_copy_snapshot->>'id')::UUID;
  v_copy_revision := (v_copy_snapshot->>'revision')::BIGINT;

  IF v_copy_version_id IS NULL
     OR v_copy_snapshot->>'status' IS DISTINCT FROM 'draft'
     OR (v_copy_snapshot->>'source_baseline_version_id')::UUID
        IS DISTINCT FROM v_source_version_id
     OR jsonb_array_length(v_copy_snapshot->'groups') IS DISTINCT FROM 1
     OR jsonb_array_length(v_copy_snapshot#>'{groups,0,criteria}') IS DISTINCT FROM 2
     OR jsonb_array_length(v_copy_snapshot#>'{groups,0,subgroups}') IS DISTINCT FROM 2
     OR jsonb_array_length(v_copy_snapshot#>'{groups,0,subgroups,0,criteria}')
        IS DISTINCT FROM 2
     OR jsonb_array_length(v_copy_snapshot#>'{groups,0,subgroups,1,criteria}')
        IS DISTINCT FROM 1
     OR (v_copy_snapshot#>>'{groups,0,id}')::UUID IS NOT DISTINCT FROM v_source_group_id THEN
    RAISE EXCEPTION 'copied hierarchy remap failed';
  END IF;

  SELECT
    array_agg(c.id ORDER BY c.criterion_code),
    array_agg(c.source_criterion_id ORDER BY c.criterion_code),
    count(DISTINCT c.id)
  INTO
    v_copy_criterion_ids,
    v_copy_source_criterion_ids,
    v_count
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = v_copy_version_id;

  IF v_count <> 5
     OR v_copy_criterion_ids && v_source_criterion_ids
     OR v_copy_source_criterion_ids IS DISTINCT FROM v_source_criterion_ids THEN
    RAISE EXCEPTION 'copied criteria identity failed';
  END IF;

  SELECT array_agg(s.id ORDER BY s.sort_order, s.id)
  INTO v_copy_subgroup_ids
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.baseline_version_id = v_copy_version_id;

  IF cardinality(v_copy_subgroup_ids) IS DISTINCT FROM 2
     OR v_copy_subgroup_ids && ARRAY[v_source_subgroup_a_id, v_source_subgroup_b_id]
     OR EXISTS (
       SELECT 1
       FROM public.technical_configuration_baseline_criteria c
       LEFT JOIN public.technical_configuration_baseline_subgroups s
         ON s.id = c.subgroup_id
        AND s.group_id = c.group_id
        AND s.baseline_version_id = c.baseline_version_id
       WHERE c.baseline_version_id = v_copy_version_id
         AND c.subgroup_id IS NOT NULL
         AND s.id IS NULL
     ) THEN
    RAISE EXCEPTION 'copied hierarchy remap failed';
  END IF;

  -- Canonical mixed ordering is direct criteria first, followed by complete subgroup blocks.
  IF v_copy_snapshot#>>'{groups,0,criteria,0,criterion_code}' IS DISTINCT FROM 'TC-0001'
     OR v_copy_snapshot#>>'{groups,0,criteria,1,criterion_code}' IS DISTINCT FROM 'TC-0002'
     OR v_copy_snapshot#>>'{groups,0,subgroups,0,name}' IS DISTINCT FROM 'Subgroup A'
     OR v_copy_snapshot#>>'{groups,0,subgroups,0,criteria,0,criterion_code}'
        IS DISTINCT FROM 'TC-0003'
     OR v_copy_snapshot#>>'{groups,0,subgroups,0,criteria,1,criterion_code}'
        IS DISTINCT FROM 'TC-0004'
     OR v_copy_snapshot#>>'{groups,0,subgroups,1,name}' IS DISTINCT FROM 'Subgroup B'
     OR v_copy_snapshot#>>'{groups,0,subgroups,1,criteria,0,criterion_code}'
        IS DISTINCT FROM 'TC-0005' THEN
    RAISE EXCEPTION 'copied mixed ordering failed';
  END IF;

  IF (SELECT count(*) FROM public.technical_configuration_reference_products
      WHERE baseline_version_id = v_copy_version_id) <> 1
     OR (SELECT count(*) FROM public.technical_configuration_reference_responses
         WHERE baseline_version_id = v_copy_version_id) <> 1
     OR (SELECT count(*) FROM public.technical_configuration_baseline_documents
         WHERE baseline_version_id = v_copy_version_id) <> 1
     OR (SELECT count(*) FROM public.technical_configuration_baseline_citations
         WHERE baseline_version_id = v_copy_version_id) <> 1
     OR (SELECT count(*) FROM public.technical_configuration_reference_documents
         WHERE baseline_version_id = v_copy_version_id) <> 1
     OR (SELECT count(*) FROM public.technical_configuration_reference_citations
         WHERE baseline_version_id = v_copy_version_id) <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public.technical_configuration_reference_responses r
       JOIN public.technical_configuration_baseline_criteria c
         ON c.id = r.criterion_id
        AND c.baseline_version_id = r.baseline_version_id
       WHERE r.baseline_version_id = v_copy_version_id
         AND c.source_criterion_id = v_source_subgroup_a1_id
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.technical_configuration_baseline_citations citation
       JOIN public.technical_configuration_baseline_criteria c
         ON c.id = citation.criterion_id
        AND c.baseline_version_id = citation.baseline_version_id
       WHERE citation.baseline_version_id = v_copy_version_id
         AND c.source_criterion_id = v_source_direct_a_id
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.technical_configuration_reference_citations citation
       JOIN public.technical_configuration_baseline_criteria c
         ON c.id = citation.criterion_id
        AND c.baseline_version_id = citation.baseline_version_id
       WHERE citation.baseline_version_id = v_copy_version_id
         AND c.source_criterion_id = v_source_subgroup_b1_id
     ) THEN
    RAISE EXCEPTION 'copy wrapper leaf remap failed';
  END IF;

  SELECT array_agg(g.id ORDER BY g.sort_order, g.id)
  INTO v_copy_group_ids
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = v_copy_version_id;

  SELECT public.technical_configuration_baseline_lock(
    v_copy_version_id,
    v_copy_revision
  )
  INTO v_lock_response;

  v_locked_snapshot := v_lock_response->'data';

  SELECT array_agg(g.id ORDER BY g.sort_order, g.id)
  INTO v_locked_group_ids
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = v_copy_version_id;

  SELECT array_agg(s.id ORDER BY s.sort_order, s.id)
  INTO v_locked_subgroup_ids
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.baseline_version_id = v_copy_version_id;

  SELECT array_agg(c.id ORDER BY c.criterion_code)
  INTO v_locked_criterion_ids
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = v_copy_version_id;

  IF v_locked_snapshot->>'status' IS DISTINCT FROM 'locked'
     OR v_locked_snapshot#>>'{groups,0,criteria,0,criterion_code}'
        IS DISTINCT FROM 'TC-0001'
     OR v_locked_snapshot#>>'{groups,0,subgroups,0,criteria,0,criterion_code}'
        IS DISTINCT FROM 'TC-0003'
     OR v_locked_group_ids IS DISTINCT FROM v_copy_group_ids
     OR v_locked_subgroup_ids IS DISTINCT FROM v_copy_subgroup_ids
     OR v_locked_criterion_ids IS DISTINCT FROM v_copy_criterion_ids THEN
    RAISE EXCEPTION 'locked hierarchy identity changed';
  END IF;
END;
$gate$;

ROLLBACK;
