BEGIN;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_value BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF NOT COALESCE(p_value, false) THEN
    RAISE EXCEPTION 'Assertion failed: %', p_label;
  END IF;
END;
$gate$;
CREATE FUNCTION pg_temp.set_claims(p_role TEXT, p_user_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;
CREATE FUNCTION pg_temp.seed_baseline(
  p_dossier_id UUID,
  p_version_id UUID,
  p_status TEXT,
  p_label TEXT,
  p_user_id BIGINT,
  p_with_working_roots BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $gate$
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
  ) VALUES (
    v_group, p_version_id, p_label || ' group', 1, p_user_id, p_user_id
  );
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
    p_label || ' product', p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_reference_responses (
    baseline_version_id, reference_product_id, criterion_id, response_text,
    created_by, updated_by
  ) VALUES (
    p_version_id, v_product, v_direct_criterion, p_label || ' response',
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
    'supplier', v_supplier,
    'option', v_option,
    'option_document', v_option_document,
    'comparison_set', v_comparison_set
  );
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'); v_user_id BIGINT;
  v_source_dossier UUID := gen_random_uuid(); v_source_version UUID := gen_random_uuid();
  v_second_source_dossier UUID := gen_random_uuid(); v_second_source_version UUID := gen_random_uuid();
  v_mixed_baseline_source_dossier UUID := gen_random_uuid();
  v_mixed_baseline_source_version UUID := gen_random_uuid();
  v_cross_source_dossier UUID := gen_random_uuid(); v_cross_source_version UUID := gen_random_uuid();
  v_create_dossier UUID := gen_random_uuid(); v_replace_dossier UUID := gen_random_uuid();
  v_replace_version UUID := gen_random_uuid();
  v_mixed_baseline_cross_dossier UUID := gen_random_uuid();
  v_mixed_cross_baseline_dossier UUID := gen_random_uuid();
  v_rollback_baseline_dossier UUID := gen_random_uuid();
  v_rollback_baseline_version UUID := gen_random_uuid();
  v_rollback_cross_dossier UUID := gen_random_uuid();
  v_rollback_cross_revision BIGINT;
  v_response JSONB; v_preview JSONB; v_fingerprint TEXT;
  v_copy_version UUID; v_copy_revision BIGINT;
  v_dossier_revision BIGINT; v_baseline_revision BIGINT;
  v_before JSONB; v_after JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_copy_reentrant_workspace_phase_gate')
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
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  ) VALUES
    (
      v_source_dossier, 'Reentrant source ' || v_suffix,
      'Reentrant source ' || v_suffix, 'locked source', v_user_id, v_user_id
    ),
    (
      v_second_source_dossier, 'Mixed-order source ' || v_suffix,
      'Mixed-order source ' || v_suffix, 'locked source', v_user_id, v_user_id
    ),
    (
      v_mixed_baseline_source_dossier, 'Mixed baseline source ' || v_suffix,
      'Mixed baseline source ' || v_suffix, 'locked source', v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, archived_at, archived_by,
    created_by, updated_by
  ) VALUES
    (
      v_cross_source_dossier, 'Cross source ' || v_suffix,
      'Cross source ' || v_suffix, 'locked source', now(), v_user_id,
      v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  ) VALUES
    (
      v_create_dossier, 'Reentrant create target ' || v_suffix,
      'Reentrant create target ' || v_suffix, 'create target', v_user_id, v_user_id
    ),
    (
      v_replace_dossier, 'Reentrant replace target ' || v_suffix,
      'Reentrant replace target ' || v_suffix, 'replace target', v_user_id, v_user_id
    ),
    (
      v_mixed_baseline_cross_dossier, 'Mixed baseline target ' || v_suffix,
      'Mixed baseline target ' || v_suffix, 'mixed target', v_user_id, v_user_id
    ),
    (
      v_mixed_cross_baseline_dossier, 'Mixed cross target ' || v_suffix,
      'Mixed cross target ' || v_suffix, 'mixed target', v_user_id, v_user_id
    ),
    (
      v_rollback_cross_dossier, 'Rollback cross target ' || v_suffix,
      'Rollback cross target ' || v_suffix, 'rollback target', v_user_id, v_user_id
    );
  PERFORM pg_temp.seed_baseline(v_source_dossier, v_source_version, 'locked', 'Reentrant source', v_user_id);
  PERFORM pg_temp.seed_baseline(v_second_source_dossier, v_second_source_version, 'locked', 'Mixed-order source', v_user_id);
  PERFORM pg_temp.seed_baseline(v_mixed_baseline_source_dossier, v_mixed_baseline_source_version, 'locked', 'Mixed baseline source', v_user_id);
  PERFORM pg_temp.seed_baseline(v_cross_source_dossier, v_cross_source_version, 'locked', 'Cross source', v_user_id);
  PERFORM pg_temp.seed_baseline(v_replace_dossier, v_replace_version, 'draft', 'Replacement old', v_user_id, true);
  SELECT public.technical_configuration_baseline_copy(v_source_version, 1)
  INTO v_response;
  v_copy_version := (v_response #>> '{data,id}')::UUID;
  v_copy_revision := (v_response #>> '{data,revision}')::BIGINT;
  PERFORM pg_temp.assert_true(
    'first baseline copy maps hierarchy, products, and documents',
    v_copy_version IS NOT NULL
    AND (SELECT count(*) FROM public.technical_configuration_baseline_groups
         WHERE baseline_version_id = v_copy_version) = 1
    AND (SELECT count(*) FROM public.technical_configuration_baseline_criteria
         WHERE baseline_version_id = v_copy_version) = 2
    AND (SELECT count(*) FROM public.technical_configuration_reference_products WHERE baseline_version_id = v_copy_version) = 1
    AND (SELECT count(*) FROM public.technical_configuration_baseline_documents WHERE baseline_version_id = v_copy_version) = 1
    AND (SELECT count(*) FROM public.technical_configuration_reference_documents WHERE baseline_version_id = v_copy_version) = 1
    AND EXISTS (
      SELECT 1
      FROM public.technical_configuration_baseline_criteria c
      WHERE c.baseline_version_id = v_copy_version
        AND c.source_criterion_id IS NOT NULL
    )
  );
  SELECT public.technical_configuration_baseline_lock(v_copy_version, v_copy_revision)
  INTO v_response;
  SELECT public.technical_configuration_baseline_copy(v_source_version, 1)
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'repeated baseline copy succeeds without map cleanup',
    (v_response #>> '{data,id}')::UUID IS NOT NULL
  );
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers
  WHERE id = v_create_dossier;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_cross_source_version, v_create_dossier, v_dossier_revision, NULL, NULL
  ) INTO v_preview;
  v_fingerprint := v_preview #>> '{data,preview_fingerprint}';
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_cross_source_version, v_create_dossier, v_dossier_revision, NULL, NULL
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'repeated preview is stable and read-only',
    v_response #>> '{data,preview_fingerprint}' = v_fingerprint
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions
      WHERE dossier_id = v_create_dossier
    )
  );
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_cross_source_version, v_create_dossier, v_dossier_revision, NULL, NULL,
    v_fingerprint, false
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'first cross-dossier apply succeeds',
    v_response #>> '{data,mode}' = 'create'
    AND (v_response #>> '{data,target_baseline_version_id}')::UUID IS NOT NULL
  );
  SELECT d.revision, v.revision
  INTO v_dossier_revision, v_baseline_revision
  FROM public.technical_configuration_dossiers d
  JOIN public.technical_configuration_baseline_versions v
    ON v.dossier_id = d.id AND v.status = 'draft'
  WHERE d.id = v_replace_dossier;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_cross_source_version, v_replace_dossier, v_dossier_revision,
    v_replace_version, v_baseline_revision
  ) INTO v_preview;
  v_fingerprint := v_preview #>> '{data,preview_fingerprint}';
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_cross_source_version, v_replace_dossier, v_dossier_revision,
    v_replace_version, v_baseline_revision, v_fingerprint, true
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'repeated cross-dossier apply preserves target roots and lineage',
    (v_response #>> '{data,target_baseline_version_id}')::UUID = v_replace_version
    AND EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions
      WHERE id = v_replace_version
        AND source_baseline_version_id = v_cross_source_version
    )
    AND (SELECT count(*) FROM public.technical_configuration_suppliers
         WHERE dossier_id = v_replace_dossier) = 1
  );
  SELECT public.technical_configuration_baseline_copy(v_second_source_version, 1)
  INTO v_response;
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers
  WHERE id = v_mixed_baseline_cross_dossier;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_cross_source_version, v_mixed_baseline_cross_dossier, v_dossier_revision, NULL, NULL
  ) INTO v_preview;
  v_fingerprint := v_preview #>> '{data,preview_fingerprint}';
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_cross_source_version, v_mixed_baseline_cross_dossier, v_dossier_revision, NULL, NULL,
    v_fingerprint, false
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'baseline then cross-dossier apply succeeds',
    v_response #>> '{data,mode}' = 'create'
  );
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers
  WHERE id = v_mixed_cross_baseline_dossier;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_cross_source_version, v_mixed_cross_baseline_dossier, v_dossier_revision, NULL, NULL
  ) INTO v_preview;
  v_fingerprint := v_preview #>> '{data,preview_fingerprint}';
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_cross_source_version, v_mixed_cross_baseline_dossier, v_dossier_revision, NULL, NULL,
    v_fingerprint, false
  ) INTO v_response;
  SELECT public.technical_configuration_baseline_copy(v_mixed_baseline_source_version, 1)
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'cross-dossier apply then baseline copy succeeds',
    (v_response #>> '{data,id}')::UUID IS NOT NULL
  );
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  ) VALUES (
    v_rollback_baseline_dossier, 'Rollback source ' || v_suffix,
    'Rollback source ' || v_suffix, 'locked source', v_user_id, v_user_id
  );
  PERFORM pg_temp.seed_baseline(v_rollback_baseline_dossier, v_rollback_baseline_version, 'locked', 'Rollback source', v_user_id);
  SELECT count(*) INTO v_dossier_revision
  FROM public.technical_configuration_baseline_versions
  WHERE dossier_id = v_rollback_baseline_dossier;
  SELECT count(*) INTO v_baseline_revision
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_rollback_baseline_version;
  BEGIN
    SELECT public.technical_configuration_baseline_copy(v_rollback_baseline_version, 1)
    INTO v_response;
    RAISE EXCEPTION 'phase_gate_baseline_rollback_probe' USING ERRCODE = 'P0001';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'phase_gate_baseline_rollback_probe' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.assert_true(
    'baseline rollback removed target mutation',
    (SELECT count(*) FROM public.technical_configuration_baseline_versions
     WHERE dossier_id = v_rollback_baseline_dossier) = v_dossier_revision
    AND (SELECT count(*) FROM public.technical_configuration_baseline_criteria
         WHERE baseline_version_id = v_rollback_baseline_version) = v_baseline_revision
  );
  SELECT public.technical_configuration_baseline_copy(v_rollback_baseline_version, 1)
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'baseline retry succeeds after rollback',
    (v_response #>> '{data,id}')::UUID IS NOT NULL
  );
  SELECT revision INTO v_rollback_cross_revision
  FROM public.technical_configuration_dossiers
  WHERE id = v_rollback_cross_dossier;
  SELECT jsonb_build_object(
    'revision', v_rollback_cross_revision,
    'versions', (SELECT count(*) FROM public.technical_configuration_baseline_versions
                 WHERE dossier_id = v_rollback_cross_dossier)
  ) INTO v_before;
  SELECT public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_cross_source_version, v_rollback_cross_dossier, v_rollback_cross_revision, NULL, NULL
  ) INTO v_preview;
  v_fingerprint := v_preview #>> '{data,preview_fingerprint}';
  BEGIN
    SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
      v_cross_source_version, v_rollback_cross_dossier, v_rollback_cross_revision, NULL, NULL,
      v_fingerprint, false
    ) INTO v_response;
    RAISE EXCEPTION 'phase_gate_cross_rollback_probe' USING ERRCODE = 'P0001';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'phase_gate_cross_rollback_probe' THEN RAISE; END IF;
  END;
  SELECT jsonb_build_object(
    'revision', (SELECT revision FROM public.technical_configuration_dossiers
                 WHERE id = v_rollback_cross_dossier),
    'versions', (SELECT count(*) FROM public.technical_configuration_baseline_versions
                 WHERE dossier_id = v_rollback_cross_dossier)
  ) INTO v_after;
  PERFORM pg_temp.assert_true(
    'cross-dossier rollback removed target mutation',
    v_after = v_before
  );
  SELECT public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_cross_source_version, v_rollback_cross_dossier, v_rollback_cross_revision, NULL, NULL,
    v_fingerprint, false
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'cross-dossier retry succeeds after rollback',
    v_response #>> '{data,mode}' = 'create'
  );
END;
$gate$;
ROLLBACK;
