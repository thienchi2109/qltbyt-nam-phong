-- Purpose: prove Phase 1 listing, preview, apply, lineage, boundaries, and atomic rollback.
-- Non-destructive: all fixture writes are wrapped in a transaction and rolled back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_value BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF NOT COALESCE(p_value, false) THEN
    RAISE EXCEPTION 'Assertion failed: %', p_label;
  END IF;
END;
$gate$;
CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT, p_statement TEXT, p_state TEXT, p_message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    IF v_state = p_state AND v_message = p_message THEN
      RETURN;
    END IF;
    RAISE EXCEPTION '%: expected %/%, got %/%',
      p_label, p_state, p_message, v_state, v_message;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;
CREATE FUNCTION pg_temp.set_claims(p_role TEXT, p_user_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'app_role', p_role, 'role', 'authenticated',
    'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT
  )::TEXT, true);
END;
$gate$;
CREATE FUNCTION pg_temp.seed_baseline(
  p_dossier_id UUID, p_version_id UUID, p_status TEXT, p_label TEXT,
  p_user_id BIGINT, p_with_working_roots BOOLEAN DEFAULT false
)
RETURNS JSONB LANGUAGE plpgsql AS $gate$
DECLARE
  v_group UUID := gen_random_uuid(); v_subgroup UUID := gen_random_uuid();
  v_direct_criterion UUID := gen_random_uuid(); v_nested_criterion UUID := gen_random_uuid();
  v_product UUID := gen_random_uuid(); v_baseline_document UUID := gen_random_uuid();
  v_reference_document UUID := gen_random_uuid(); v_supplier UUID := gen_random_uuid();
  v_option UUID := gen_random_uuid(); v_option_document UUID := gen_random_uuid();
  v_comparison_set UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES (
    p_version_id, p_dossier_id, 1, p_status, 3, 1,
    CASE WHEN p_status = 'locked' THEN now() END,
    CASE WHEN p_status = 'locked' THEN p_user_id END,
    p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES (v_group, p_version_id, p_label || ' main section', 1, p_user_id, p_user_id);
  INSERT INTO public.technical_configuration_baseline_subgroups (
    id, baseline_version_id, group_id, name, sort_order, created_by, updated_by
  ) VALUES (
    v_subgroup, p_version_id, v_group, p_label || ' subgroup', 1, p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, subgroup_id, criterion_code, title,
    requirement_text, sort_order, created_by, updated_by
  ) VALUES
    (
      v_direct_criterion, p_version_id, v_group, NULL, 'TC-0001',
      p_label || ' direct', p_label || ' direct requirement', 1, p_user_id, p_user_id
    ),
    (
      v_nested_criterion, p_version_id, v_group, v_subgroup, 'TC-0002',
      p_label || ' nested', p_label || ' nested requirement', 2, p_user_id, p_user_id
    );
  INSERT INTO public.technical_configuration_reference_products (
    id, baseline_version_id, model, manufacturer, description, created_by, updated_by
  ) VALUES (
    v_product, p_version_id, p_label || ' model', p_label || ' manufacturer',
    p_label || ' reference product', p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_reference_responses (
    baseline_version_id, reference_product_id, criterion_id, response_text,
    created_by, updated_by
  ) VALUES (
    p_version_id, v_product, v_direct_criterion, p_label || ' reference response',
    p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_baseline_documents (
    id, baseline_version_id, name, url, created_by, updated_by
  ) VALUES (
    v_baseline_document, p_version_id, p_label || ' baseline document',
    'https://example.com/' || lower(replace(p_label, ' ', '-')) || '-baseline.pdf',
    p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_baseline_citations (
    baseline_version_id, baseline_document_id, criterion_id, page_section,
    excerpt, created_by, updated_by
  ) VALUES (
    p_version_id, v_baseline_document, v_direct_criterion, '1',
    p_label || ' baseline citation', p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_reference_documents (
    id, baseline_version_id, reference_product_id, name, url, created_by, updated_by
  ) VALUES (
    v_reference_document, p_version_id, v_product, p_label || ' reference document',
    'https://example.com/' || lower(replace(p_label, ' ', '-')) || '-reference.pdf',
    p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_reference_citations (
    baseline_version_id, reference_document_id, criterion_id, page_section,
    excerpt, created_by, updated_by
  ) VALUES (
    p_version_id, v_reference_document, v_nested_criterion, '2',
    p_label || ' reference citation', p_user_id, p_user_id
  );
  IF p_with_working_roots THEN
    INSERT INTO public.technical_configuration_suppliers (
      id, dossier_id, name, created_by, updated_by
    ) VALUES (v_supplier, p_dossier_id, p_label || ' supplier', p_user_id, p_user_id);
    INSERT INTO public.technical_configuration_options (
      id, dossier_id, supplier_id, model, manufacturer, option_name,
      created_by, updated_by
    ) VALUES (
      v_option, p_dossier_id, v_supplier, p_label || ' option model',
      p_label || ' option manufacturer', p_label || ' option', p_user_id, p_user_id
    );
    INSERT INTO public.technical_configuration_option_documents (
      id, option_id, name, url, created_by, updated_by
    ) VALUES (
      v_option_document, v_option, p_label || ' option document',
      'https://example.com/' || lower(replace(p_label, ' ', '-')) || '-option.pdf',
      p_user_id, p_user_id
    );
    INSERT INTO public.technical_configuration_comparison_sets (
      id, dossier_id, option_id, baseline_version_id, created_by, updated_by
    ) VALUES (
      v_comparison_set, p_dossier_id, v_option, p_version_id, p_user_id, p_user_id
    );
    INSERT INTO public.technical_configuration_option_responses (
      comparison_set_id, baseline_version_id, criterion_id, response_text,
      supplementary_information, created_by, updated_by
    ) VALUES (
      v_comparison_set, p_version_id, v_direct_criterion, p_label || ' option response',
      p_label || ' supplementary', p_user_id, p_user_id
    );
    INSERT INTO public.technical_configuration_option_citations (
      option_id, baseline_version_id, comparison_set_id, option_document_id,
      criterion_id, page_section, excerpt, created_by, updated_by
    ) VALUES (
      v_option, p_version_id, v_comparison_set, v_option_document,
      v_direct_criterion, '3', p_label || ' option citation', p_user_id, p_user_id
    );
    INSERT INTO public.technical_configuration_manual_assessments (
      comparison_set_id, baseline_version_id, criterion_id, technical_axis,
      evidence_axis, notes, created_by, updated_by
    ) VALUES (
      v_comparison_set, p_version_id, v_direct_criterion, 'meets', 'complete',
      p_label || ' assessment', p_user_id, p_user_id
    );
  END IF;
  RETURN jsonb_build_object(
    'group', v_group, 'subgroup', v_subgroup,
    'direct_criterion', v_direct_criterion, 'nested_criterion', v_nested_criterion,
    'supplier', v_supplier, 'option', v_option,
    'option_document', v_option_document, 'comparison_set', v_comparison_set
  );
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_source_dossier UUID := gen_random_uuid(); v_source_version UUID := gen_random_uuid();
  v_editable_dossier UUID := gen_random_uuid(); v_editable_version UUID := gen_random_uuid();
  v_same_dossier UUID := gen_random_uuid(); v_same_version UUID := gen_random_uuid();
  v_create_dossier UUID := gen_random_uuid(); v_replace_dossier UUID := gen_random_uuid();
  v_replace_version UUID := gen_random_uuid();
  v_replace_fixture JSONB;
  v_response JSONB; v_preview JSONB; v_fingerprint TEXT;
  v_create_version UUID; v_replaced_version UUID;
  v_dossier_revision BIGINT; v_baseline_revision BIGINT;
  v_before JSONB; v_after JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_cross_dossier_copy_phase_gate'));
  SELECT nv.id INTO v_user_id FROM public.nhan_vien nv
  WHERE nv.is_active = true ORDER BY nv.id LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Setup failed: no active nhan_vien row found'; END IF;
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, archived_at, archived_by,
    created_by, updated_by
  ) VALUES (
    v_source_dossier, 'Cross-copy source device ' || v_suffix,
    'Archived locked source ' || v_suffix, 'archived locked source',
    now(), v_user_id, v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  ) VALUES
    (
      v_editable_dossier, 'Editable source device ' || v_suffix,
      'Editable source ' || v_suffix, 'Draft source must be excluded', v_user_id, v_user_id
    ),
    (
      v_same_dossier, 'Same-dossier device ' || v_suffix,
      'Same-dossier source ' || v_suffix, 'same-dossier compatibility', v_user_id, v_user_id
    ),
    (
      v_create_dossier, 'Create target device ' || v_suffix,
      'Create target ' || v_suffix, 'Cross-copy create target', v_user_id, v_user_id
    ),
    (
      v_replace_dossier, 'Replace target device ' || v_suffix,
      'Replace target ' || v_suffix, 'Cross-copy replacement target', v_user_id, v_user_id
    );
  PERFORM pg_temp.seed_baseline(
    v_source_dossier, v_source_version, 'locked', 'Source', v_user_id, true);
  PERFORM pg_temp.seed_baseline(
    v_editable_dossier, v_editable_version, 'draft', 'Editable', v_user_id);
  PERFORM pg_temp.seed_baseline(
    v_same_dossier, v_same_version, 'locked', 'Same dossier', v_user_id);
  v_replace_fixture := pg_temp.seed_baseline(
    v_replace_dossier, v_replace_version, 'draft', 'Target old', v_user_id, true);
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers WHERE id = v_create_dossier;
  PERFORM pg_temp.set_claims('user', v_user_id);
  PERFORM pg_temp.expect_error(
    'authorization',
    format(
      'SELECT public.technical_configuration_baseline_cross_dossier_sources_list(%L::UUID, NULL, 1, 20)',
      v_create_dossier
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'bounded pagination',
    format(
      'SELECT public.technical_configuration_baseline_cross_dossier_sources_list(%L::UUID, NULL, 0, 20)',
      v_create_dossier
    ),
    'PT422', 'validation_error'
  );
  SELECT public.technical_configuration_baseline_cross_dossier_sources_list(
    v_create_dossier, 'Archived locked source ' || v_suffix, 1, 20
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'archived locked source is listed with aggregate counts',
    (v_response->>'total')::BIGINT = 1
    AND v_response#>>'{data,0,baseline_version_id}' = v_source_version::TEXT
    AND v_response#>>'{data,0,dossier_archived_at}' IS NOT NULL
    AND (v_response#>>'{data,0,main_section_count}')::BIGINT = 1
    AND (v_response#>>'{data,0,subgroup_count}')::BIGINT = 1
    AND (v_response#>>'{data,0,criterion_count}')::BIGINT = 2
  );
  SELECT public.technical_configuration_baseline_cross_dossier_sources_list(
    v_create_dossier, 'Editable source ' || v_suffix, 1, 20) INTO v_response;
  PERFORM pg_temp.assert_true('editable source excluded', (v_response->>'total')::BIGINT = 0);
  SELECT public.technical_configuration_baseline_cross_dossier_sources_list(
    v_same_dossier, 'Same-dossier source ' || v_suffix, 1, 20) INTO v_response;
  PERFORM pg_temp.assert_true('target source excluded', (v_response->>'total')::BIGINT = 0);
  PERFORM pg_temp.expect_error(
    'source_not_locked',
    format(
      'SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(%L::UUID,%L::UUID,%s,NULL,NULL)',
      v_editable_version, v_create_dossier, v_dossier_revision
    ),
    'PT409', 'source_not_locked'
  );
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers WHERE id = v_same_dossier;
  PERFORM pg_temp.expect_error(
    'source_matches_target_dossier',
    format(
      'SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(%L::UUID,%L::UUID,%s,NULL,NULL)',
      v_same_version, v_same_dossier, v_dossier_revision
    ),
    'PT422', 'source_matches_target_dossier'
  );
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers WHERE id = v_create_dossier;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_source_version, v_create_dossier, v_dossier_revision, NULL, NULL
  ) INTO v_preview;
  v_fingerprint := v_preview#>>'{data,preview_fingerprint}';
  PERFORM pg_temp.assert_true(
    'create preview is read-only and complete',
    v_preview#>>'{data,mode}' = 'create'
    AND (v_preview#>>'{data,requires_replacement_confirmation}')::BOOLEAN = false
    AND (v_preview#>>'{data,copy_counts,main_sections}')::BIGINT = 1
    AND (v_preview#>>'{data,copy_counts,subgroups}')::BIGINT = 1
    AND (v_preview#>>'{data,copy_counts,criteria}')::BIGINT = 2
    AND length(v_fingerprint) = 64
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions
      WHERE dossier_id = v_create_dossier
    )
  );
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_source_version, v_create_dossier, v_dossier_revision, NULL, NULL,
    v_fingerprint, false
  ) INTO v_response;
  v_create_version := (v_response#>>'{data,target_baseline_version_id}')::UUID;
  PERFORM pg_temp.assert_true(
    'create apply copies identity and lineage without excluded roots',
    v_response#>>'{data,mode}' = 'create'
    AND v_create_version IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions v
      WHERE v.id = v_create_version
        AND v.dossier_id = v_create_dossier
        AND v.status = 'draft'
        AND v.source_baseline_version_id = v_source_version
        AND v.next_criterion_number = 3
    )
    AND (SELECT count(*) FROM public.technical_configuration_baseline_criteria
         WHERE baseline_version_id = v_create_version) = 2
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_suppliers
      WHERE dossier_id = v_create_dossier
    )
  );
  DROP TABLE IF EXISTS pg_temp.technical_configuration_baseline_group_copy_map, pg_temp.technical_configuration_baseline_subgroup_copy_map, pg_temp.technical_configuration_baseline_criterion_copy_map, pg_temp.technical_configuration_reference_product_copy_map, pg_temp.technical_configuration_baseline_document_copy_map, pg_temp.technical_configuration_reference_document_copy_map;
  SELECT d.revision, v.revision
  INTO v_dossier_revision, v_baseline_revision
  FROM public.technical_configuration_dossiers d
  JOIN public.technical_configuration_baseline_versions v
    ON v.dossier_id = d.id AND v.status = 'draft'
  WHERE d.id = v_replace_dossier;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_source_version, v_replace_dossier, v_dossier_revision,
    v_replace_version, v_baseline_revision
  ) INTO v_preview;
  v_fingerprint := v_preview#>>'{data,preview_fingerprint}';
  PERFORM pg_temp.assert_true(
    'replacement preview counts copied deleted and preserved domains',
    v_preview#>>'{data,mode}' = 'replace'
    AND (v_preview#>>'{data,requires_replacement_confirmation}')::BOOLEAN
    AND (v_preview#>>'{data,delete_counts,criteria}')::BIGINT = 2
    AND (v_preview#>>'{data,delete_counts,option_responses}')::BIGINT = 1
    AND (v_preview#>>'{data,delete_counts,option_citations}')::BIGINT = 1
    AND (v_preview#>>'{data,delete_counts,manual_assessments}')::BIGINT = 1
    AND (v_preview#>>'{data,preserved_counts,suppliers}')::BIGINT = 1
    AND (v_preview#>>'{data,preserved_counts,options}')::BIGINT = 1
    AND (v_preview#>>'{data,preserved_counts,option_documents}')::BIGINT = 1
    AND (v_preview#>>'{data,preserved_counts,comparison_sets}')::BIGINT = 1
  );
  PERFORM pg_temp.expect_error(
    'replacement_confirmation_needed',
    format(
      'SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(%L::UUID,%L::UUID,%s,%L::UUID,%s,%L,false)',
      v_source_version, v_replace_dossier, v_dossier_revision,
      v_replace_version, v_baseline_revision, v_fingerprint
    ),
    'PT409', 'replacement_confirmation_needed'
  );
  SELECT jsonb_build_object(
    'version', v_replace_version,
    'criteria', (SELECT count(*) FROM public.technical_configuration_baseline_criteria
                 WHERE baseline_version_id = v_replace_version),
    'responses', (SELECT count(*) FROM public.technical_configuration_option_responses
                  WHERE baseline_version_id = v_replace_version)
  ) INTO v_before;
  PERFORM pg_temp.expect_error(
    'stale_preview atomic rollback',
    format(
      'SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(%L::UUID,%L::UUID,%s,%L::UUID,%s,%L,true)',
      v_source_version, v_replace_dossier, v_dossier_revision,
      v_replace_version, v_baseline_revision, repeat('0', 64)
    ),
    'PT409', 'stale_preview'
  );
  SELECT jsonb_build_object(
    'version', v_replace_version,
    'criteria', (SELECT count(*) FROM public.technical_configuration_baseline_criteria
                 WHERE baseline_version_id = v_replace_version),
    'responses', (SELECT count(*) FROM public.technical_configuration_option_responses
                  WHERE baseline_version_id = v_replace_version)
  ) INTO v_after;
  PERFORM pg_temp.assert_true('atomic rollback after stale_preview', v_after = v_before);
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_source_version, v_replace_dossier, v_dossier_revision,
    v_replace_version, v_baseline_revision, v_fingerprint, true
  ) INTO v_response;
  v_replaced_version := (v_response#>>'{data,target_baseline_version_id}')::UUID;
  PERFORM pg_temp.assert_true(
    'replacement copies source and preserves dossier roots',
    v_replaced_version = v_replace_version
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions
      WHERE id = v_replace_version
        AND source_baseline_version_id = v_source_version
        AND status = 'draft'
    )
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_suppliers
      WHERE id = (v_replace_fixture->>'supplier')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_options
      WHERE id = (v_replace_fixture->>'option')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_option_documents
      WHERE id = (v_replace_fixture->>'option_document')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE id = (v_replace_fixture->>'comparison_set')::UUID
        AND baseline_version_id = v_replace_version
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_option_responses
      WHERE comparison_set_id = (v_replace_fixture->>'comparison_set')::UUID
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_option_citations
      WHERE comparison_set_id = (v_replace_fixture->>'comparison_set')::UUID
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_manual_assessments
      WHERE comparison_set_id = (v_replace_fixture->>'comparison_set')::UUID
    )
  );
  DROP TABLE IF EXISTS pg_temp.technical_configuration_baseline_group_copy_map, pg_temp.technical_configuration_baseline_subgroup_copy_map, pg_temp.technical_configuration_baseline_criterion_copy_map, pg_temp.technical_configuration_reference_product_copy_map, pg_temp.technical_configuration_baseline_document_copy_map, pg_temp.technical_configuration_reference_document_copy_map;
  -- Existing same-dossier compatibility remains callable after lineage broadening.
  SELECT public.technical_configuration_baseline_copy(v_same_version, 1) INTO v_response;
  PERFORM pg_temp.assert_true(
    'same-dossier compatibility',
    v_response#>>'{data,status}' = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions
      WHERE id = (v_response#>>'{data,id}')::UUID
        AND dossier_id = v_same_dossier
        AND source_baseline_version_id = v_same_version
    )
  );
END;
$gate$;
ROLLBACK;
