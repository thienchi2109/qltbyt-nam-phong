-- P2A hierarchy import preview phase gate.
-- The v2 functions must be applied before execution. All fixture writes roll back.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state = p_expected_state AND v_message = p_expected_message THEN
        RETURN;
      END IF;
      RAISE EXCEPTION '%: expected %/%, got %/%',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;
CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS TEXT
LANGUAGE sql
AS $gate$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
$gate$;
CREATE FUNCTION pg_temp.import_metadata_v2(
  p_dossier_id UUID,
  p_baseline_version_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql
AS $gate$
  SELECT jsonb_build_object(
    'template_kind', 'technical_configuration_baseline',
    'template_version', 2,
    'dossier_id', p_dossier_id,
    'baseline_version_id', p_baseline_version_id,
    'baseline_revision', p_revision,
    'generated_at', clock_timestamp()
  );
$gate$;
CREATE FUNCTION pg_temp.baseline_tree_snapshot(p_version_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $gate$
  SELECT jsonb_build_object(
    'version', (SELECT to_jsonb(v) FROM public.technical_configuration_baseline_versions v WHERE v.id = p_version_id),
    'groups', (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.id), '[]'::JSONB) FROM public.technical_configuration_baseline_groups g WHERE g.baseline_version_id = p_version_id),
    'subgroups', (SELECT COALESCE(jsonb_agg(to_jsonb(sg) ORDER BY sg.id), '[]'::JSONB) FROM public.technical_configuration_baseline_subgroups sg WHERE sg.baseline_version_id = p_version_id),
    'criteria', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]'::JSONB) FROM public.technical_configuration_baseline_criteria c WHERE c.baseline_version_id = p_version_id)
  );
$gate$;
CREATE FUNCTION pg_temp.expect_row_error(
  p_label TEXT,
  p_version_id UUID,
  p_metadata JSONB,
  p_rows JSONB,
  p_revision BIGINT,
  p_row INTEGER,
  p_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_response JSONB;
BEGIN
  SELECT public.technical_configuration_baseline_import_preview_v2(
    p_version_id, p_metadata, p_rows, p_revision
  ) INTO v_response;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_response->'errors') error
    WHERE (error->>'row')::INTEGER = p_row
      AND error->>'code' = p_code
  ) THEN
    RAISE EXCEPTION '%: missing row % error % in %', p_label, p_row, p_code, v_response;
  END IF;
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_foreign_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_foreign_version_id UUID := gen_random_uuid();
  v_group_a_id UUID := gen_random_uuid();
  v_group_b_id UUID := gen_random_uuid();
  v_foreign_group_id UUID := gen_random_uuid();
  v_subgroup_id UUID := gen_random_uuid();
  v_direct_criterion_id UUID := gen_random_uuid();
  v_subgroup_criterion_id UUID := gen_random_uuid();
  v_foreign_criterion_id UUID := gen_random_uuid();
  v_revision BIGINT := 4;
  v_metadata JSONB;
  v_rows JSONB;
  v_response JSONB;
  v_case_rows JSONB;
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_hierarchy_import_preview_phase_gate')
  );
  SELECT nv.id INTO v_user_id
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
  VALUES
    (
      v_dossier_id,
      'P2A preview device ' || v_suffix,
      'P2A preview dossier ' || v_suffix,
      'Rolled back after verification',
      v_user_id,
      v_user_id
    ),
    (
      v_foreign_dossier_id,
      'P2A foreign device ' || v_suffix,
      'P2A foreign dossier ' || v_suffix,
      'Rolled back after verification',
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_versions
    (id, dossier_id, version_number, status, next_criterion_number, revision,
     created_by, updated_by)
  VALUES
    (v_version_id, v_dossier_id, 1, 'draft', 3, v_revision, v_user_id, v_user_id),
    (
      v_foreign_version_id,
      v_foreign_dossier_id,
      1,
      'draft',
      2,
      1,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_groups
    (id, baseline_version_id, name, sort_order, created_by, updated_by)
  VALUES
    (v_group_a_id, v_version_id, 'Section A', 1, v_user_id, v_user_id),
    (v_group_b_id, v_version_id, 'Section B', 2, v_user_id, v_user_id),
    (
      v_foreign_group_id,
      v_foreign_version_id,
      'Foreign section',
      1,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_subgroups
    (id, baseline_version_id, group_id, name, sort_order, created_by, updated_by)
  VALUES (
    v_subgroup_id,
    v_version_id,
    v_group_b_id,
    'Existing subgroup',
    1,
    v_user_id,
    v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_criteria
    (id, baseline_version_id, group_id, subgroup_id, criterion_code, title,
     requirement_text, sort_order, created_by, updated_by)
  VALUES
    (
      v_direct_criterion_id,
      v_version_id,
      v_group_a_id,
      NULL,
      'TC-0001',
      'Direct title',
      'Direct requirement',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_subgroup_criterion_id,
      v_version_id,
      v_group_b_id,
      v_subgroup_id,
      'TC-0002',
      'Subgroup title',
      'Subgroup requirement',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_foreign_criterion_id,
      v_foreign_version_id,
      v_foreign_group_id,
      NULL,
      'TC-0001',
      'Foreign title',
      'Foreign requirement',
      1,
      v_user_id,
      v_user_id
    );
  v_metadata := pg_temp.import_metadata_v2(v_dossier_id, v_version_id, v_revision);
  v_rows := jsonb_build_array(
    jsonb_build_object(
      'row', 2, 'stt', ' III ', 'content', 'Section A updated',
      'group_id', v_group_a_id, 'subgroup_id', NULL,
      'criterion_id', NULL, 'criterion_code', NULL
    ),
    jsonb_build_object(
      'row', 3, 'stt', NULL, 'content', 'Direct requirement updated',
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', v_direct_criterion_id, 'criterion_code', 'TC-0001'
    ),
    jsonb_build_object(
      'row', 4, 'stt', NULL, 'content', NULL,
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', NULL, 'criterion_code', NULL
    ),
    jsonb_build_object(
      'row', 5, 'stt', '7', 'content', 'Existing subgroup moved',
      'group_id', NULL, 'subgroup_id', v_subgroup_id,
      'criterion_id', NULL, 'criterion_code', NULL
    ),
    jsonb_build_object(
      'row', 6, 'stt', '', 'content', 'Subgroup requirement updated',
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', v_subgroup_criterion_id, 'criterion_code', 'TC-0002'
    ),
    jsonb_build_object(
      'row', 7, 'stt', '11', 'content', 'New subgroup',
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', NULL, 'criterion_code', NULL
    ),
    jsonb_build_object(
      'row', 8, 'stt', NULL, 'content', 'New subgroup criterion',
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', NULL, 'criterion_code', NULL
    ),
    jsonb_build_object(
      'row', 9, 'stt', 'VI', 'content', 'New section',
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', NULL, 'criterion_code', NULL
    ),
    jsonb_build_object(
      'row', 10, 'stt', NULL, 'content', 'New direct criterion',
      'group_id', NULL, 'subgroup_id', NULL,
      'criterion_id', NULL, 'criterion_code', NULL
    )
  );
  -- roman sections and normalized order; direct criteria before subgroups; blank rows are ignored; create update move delete effects; provisional criterion codes
  -- fixture tree snapshot
  SELECT pg_temp.baseline_tree_snapshot(v_version_id) INTO v_before;
  SELECT public.technical_configuration_baseline_import_preview_v2(
    v_version_id, v_metadata, v_rows, v_revision
  ) INTO v_response;
  IF jsonb_array_length(v_response->'errors') <> 0
     OR (v_response#>>'{data,counts,groups}')::BIGINT <> 2
     OR (v_response#>>'{data,counts,subgroups}')::BIGINT <> 2
     OR (v_response#>>'{data,counts,criteria}')::BIGINT <> 4
      OR jsonb_array_length(v_response#>'{data,rows}') <> 8
      OR v_response#>>'{data,rows,1,row_type}' <> 'CRITERION'
      OR v_response#>>'{data,rows,2,row_type}' <> 'SUBGROUP'
      OR v_response#>>'{data,rows,0,target_group_order}' <> '1'
      OR v_response#>>'{data,rows,2,target_subgroup_order}' <> '1'
      OR v_response#>>'{data,rows,3,target_criterion_order}' <> '2'
      OR v_response#>>'{data,rows,4,target_subgroup_order}' <> '2'
      OR v_response#>>'{data,rows,5,target_criterion_order}' <> '3'
      OR v_response#>>'{data,rows,6,target_group_order}' <> '2'
      OR v_response#>>'{data,rows,7,target_criterion_order}' <> '1'
     OR v_response::TEXT NOT LIKE '%TC-0003%'
     OR v_response::TEXT NOT LIKE '%TC-0004%'
     OR (v_response#>>'{data,effects,groups,create}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,groups,update}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,groups,delete}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,subgroups,create}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,subgroups,update}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,subgroups,move}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,criteria,create}')::BIGINT <> 2
     OR (v_response#>>'{data,effects,criteria,update}')::BIGINT <> 2
     OR (v_response#>>'{data,effects,criteria,move}')::BIGINT <> 1 THEN
    RAISE EXCEPTION 'valid hierarchical preview mismatch: %', v_response;
  END IF;
  SELECT pg_temp.baseline_tree_snapshot(v_version_id) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'preview is read-only';
  END IF;
  -- content before a section
  v_case_rows := jsonb_build_array(jsonb_build_object(
    'row', 2, 'stt', NULL, 'content', 'No section',
    'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL, 'criterion_code', NULL
  ));
  PERFORM pg_temp.expect_row_error(
    'content before a section', v_version_id, v_metadata, v_case_rows,
    v_revision, 2, 'content_before_section'
  );
  -- unsupported 1.1 marker
  v_case_rows := jsonb_build_array(jsonb_build_object(
    'row', 2, 'stt', '1.1', 'content', 'Unsupported depth',
    'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL, 'criterion_code', NULL
  ));
  PERFORM pg_temp.expect_row_error(
    'unsupported 1.1 marker', v_version_id, v_metadata, v_case_rows,
    v_revision, 2, 'unsupported_marker'
  );
  -- empty content
  v_case_rows := jsonb_build_array(jsonb_build_object(
    'row', 2, 'stt', 'I', 'content', ' ',
    'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL, 'criterion_code', NULL
  ));
  PERFORM pg_temp.expect_row_error(
    'empty content', v_version_id, v_metadata, v_case_rows, v_revision, 2, 'empty_content'
  );
  -- malformed row
  PERFORM pg_temp.expect_row_error(
    'malformed row', v_version_id, v_metadata, jsonb_build_array(to_jsonb('bad row'::TEXT)),
    v_revision, 2, 'invalid_row_shape'
  );
  -- physical row number validation
  PERFORM pg_temp.expect_row_error(
    'fractional physical row', v_version_id, v_metadata,
    jsonb_build_array((v_rows->0) || jsonb_build_object('row', 1.5)),
    v_revision, 2, 'invalid_row_shape'
  );
  PERFORM pg_temp.expect_row_error(
    'physical row before worksheet data', v_version_id, v_metadata,
    jsonb_build_array((v_rows->0) || jsonb_build_object('row', 1)),
    v_revision, 2, 'invalid_row_shape'
  );
  -- partial identity
  v_case_rows := jsonb_build_array(v_rows->0, jsonb_build_object(
    'row', 3, 'stt', NULL, 'content', 'Partial',
    'group_id', NULL, 'subgroup_id', NULL,
    'criterion_id', v_direct_criterion_id, 'criterion_code', NULL
  ));
  PERFORM pg_temp.expect_row_error(
    'partial identity', v_version_id, v_metadata, v_case_rows,
    v_revision, 3, 'partial_identity'
  );
  -- wrong-kind identity
  v_case_rows := jsonb_build_array(jsonb_build_object(
    'row', 2, 'stt', 'I', 'content', 'Wrong identity kind',
    'group_id', NULL, 'subgroup_id', v_subgroup_id,
    'criterion_id', NULL, 'criterion_code', NULL
  ));
  PERFORM pg_temp.expect_row_error(
    'wrong-kind identity', v_version_id, v_metadata, v_case_rows,
    v_revision, 2, 'wrong_identity_kind'
  );
  -- foreign identity
  v_case_rows := jsonb_build_array(v_rows->0, jsonb_build_object(
    'row', 3, 'stt', NULL, 'content', 'Foreign criterion',
    'group_id', NULL, 'subgroup_id', NULL,
    'criterion_id', v_foreign_criterion_id, 'criterion_code', 'TC-0001'
  ));
  PERFORM pg_temp.expect_row_error(
    'foreign identity', v_version_id, v_metadata, v_case_rows,
    v_revision, 3, 'foreign_identity'
  );
  -- changed criterion code
  v_case_rows := jsonb_build_array(v_rows->0, jsonb_build_object(
    'row', 3, 'stt', NULL, 'content', 'Changed code',
    'group_id', NULL, 'subgroup_id', NULL,
    'criterion_id', v_direct_criterion_id, 'criterion_code', 'TC-9999'
  ));
  PERFORM pg_temp.expect_row_error(
    'changed criterion code', v_version_id, v_metadata, v_case_rows,
    v_revision, 3, 'changed_criterion_code'
  );
  SELECT public.technical_configuration_baseline_import_preview_v2(v_version_id, v_metadata, v_case_rows, v_revision) INTO v_response; -- invalid preview suppresses effects
  IF v_response#>'{data,effects}' IS DISTINCT FROM 'null'::JSONB THEN RAISE EXCEPTION 'invalid preview exposed effects: %', v_response; END IF;
  -- duplicate identity
  v_case_rows := jsonb_build_array(v_rows->0, v_rows->1, jsonb_set(v_rows->1, '{row}', '4'));
  PERFORM pg_temp.expect_row_error(
    'duplicate identity', v_version_id, v_metadata, v_case_rows,
    v_revision, 4, 'duplicate_identity'
  );
  -- identity loss uses create-delete fallback
  v_case_rows := jsonb_build_array(
    jsonb_set(v_rows->0, '{group_id}', 'null'),
    jsonb_set(jsonb_set(v_rows->1, '{criterion_id}', 'null'), '{criterion_code}', 'null')
  );
  SELECT public.technical_configuration_baseline_import_preview_v2(
    v_version_id, v_metadata, v_case_rows, v_revision
  ) INTO v_response;
  IF (v_response#>>'{data,effects,groups,create}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,groups,delete}')::BIGINT <> 2
     OR (v_response#>>'{data,effects,criteria,create}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,criteria,delete}')::BIGINT <> 2 THEN
    RAISE EXCEPTION 'identity fallback mismatch: %', v_response;
  END IF;
  -- empty tree previews explicit deletes
  SELECT public.technical_configuration_baseline_import_preview_v2(
    v_version_id, v_metadata, '[]'::JSONB, v_revision
  ) INTO v_response;
  IF (v_response#>>'{data,counts,groups}')::BIGINT <> 0
     OR (v_response#>>'{data,effects,groups,delete}')::BIGINT <> 2
     OR (v_response#>>'{data,effects,subgroups,delete}')::BIGINT <> 1
     OR (v_response#>>'{data,effects,criteria,delete}')::BIGINT <> 2 THEN
    RAISE EXCEPTION 'empty-tree preview mismatch: %', v_response;
  END IF;
  -- stale metadata
  PERFORM pg_temp.expect_error(
    'stale metadata',
    format(
      'SELECT public.technical_configuration_baseline_import_preview_v2(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id,
      jsonb_set(v_metadata, '{baseline_revision}', to_jsonb(v_revision - 1))::TEXT,
      v_rows::TEXT,
      v_revision
    ),
    'PT422',
    'template_mismatch'
  );
END;
$gate$;
ROLLBACK;
