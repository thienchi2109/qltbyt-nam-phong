-- P5C atomicity gate: full-tree reconciliation; all fixtures and mutations roll back.
BEGIN;
CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS TEXT
LANGUAGE sql
AS $gate$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
$gate$;
CREATE FUNCTION pg_temp.import_metadata(
  p_dossier_id UUID, p_baseline_version_id UUID, p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql
AS $gate$
  SELECT jsonb_build_object(
    'template_kind', 'technical_configuration_baseline', 'template_version', 1,
    'dossier_id', p_dossier_id, 'baseline_version_id', p_baseline_version_id,
    'baseline_revision', p_revision,
    'generated_at', clock_timestamp()
  );
$gate$;
CREATE FUNCTION pg_temp.group_row(p_order INTEGER, p_name TEXT)
RETURNS JSONB
LANGUAGE sql
AS $gate$
  SELECT jsonb_build_object(
    'row_type', 'GROUP', 'group_order', p_order, 'group_name', p_name,
    'criterion_order', NULL, 'criterion_code', NULL, 'criterion_title', NULL,
    'requirement_text', NULL
  );
$gate$;
CREATE FUNCTION pg_temp.criterion_row(
  p_group_order INTEGER, p_criterion_order INTEGER, p_code TEXT,
  p_title TEXT, p_requirement TEXT
)
RETURNS JSONB
LANGUAGE sql
AS $gate$
  SELECT jsonb_build_object(
    'row_type', 'CRITERION', 'group_order', p_group_order, 'group_name', NULL,
    'criterion_order', p_criterion_order, 'criterion_code', p_code,
    'criterion_title', p_title,
    'requirement_text', p_requirement
  );
$gate$;
CREATE FUNCTION pg_temp.expect_import_rollback(
  p_label TEXT, p_failure_mode TEXT, p_baseline_version_id UUID,
  p_metadata JSONB, p_rows JSONB, p_expected_revision BIGINT, p_user_id BIGINT,
  p_expected_state TEXT,
  p_expected_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_state TEXT;
  v_message TEXT;
  v_raised BOOLEAN := false;
BEGIN
  SELECT public._technical_configuration_baseline_snapshot(p_baseline_version_id) INTO v_before;
  BEGIN
    PERFORM public.technical_configuration_baseline_import_apply(
      p_baseline_version_id, p_metadata, p_rows, p_expected_revision
    );
    IF p_failure_mode = 'row' THEN
      RAISE EXCEPTION 'forced_import_failure';
    ELSIF p_failure_mode = 'duplicate' THEN
      INSERT INTO public.technical_configuration_baseline_criteria (
        baseline_version_id, group_id, criterion_code, requirement_text,
        sort_order, created_by, updated_by
      )
      SELECT p_baseline_version_id, g.id, 'TC-0001', 'Duplicate failure',
        99, p_user_id, p_user_id
      FROM public.technical_configuration_baseline_groups g
      WHERE g.baseline_version_id = p_baseline_version_id
      ORDER BY g.sort_order
      LIMIT 1;
    ELSIF p_failure_mode = 'relationship' THEN
      INSERT INTO public.technical_configuration_baseline_criteria (
        baseline_version_id, group_id, criterion_code, requirement_text,
        sort_order, created_by, updated_by
      )
      VALUES (
        p_baseline_version_id, gen_random_uuid(), 'TC-9999',
        'Relationship failure', 99, p_user_id, p_user_id
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_raised := true;
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION '%: expected statement to fail', p_label;
  END IF;
  IF v_state IS DISTINCT FROM p_expected_state
     OR (p_expected_message IS NOT NULL
         AND v_message IS DISTINCT FROM p_expected_message) THEN
    RAISE EXCEPTION '%: expected %/%, got %/%',
      p_label, p_expected_state, p_expected_message, v_state, v_message;
  END IF;
  SELECT public._technical_configuration_baseline_snapshot(p_baseline_version_id) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION '%: snapshot changed', p_label;
  END IF;
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_source_version_id UUID := gen_random_uuid();
  v_target_version_id UUID := gen_random_uuid();
  v_source_groups UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_target_groups UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_source_criteria UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_target_criteria UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_revision BIGINT := 7;
  v_next_number BIGINT := 5;
  v_created_code TEXT := 'TC-0005';
  v_new_code TEXT := 'TC-0006';
  v_metadata JSONB;
  v_create_rows JSONB;
  v_rows JSONB;
  v_current_rows JSONB;
  v_failure_rows JSONB;
  v_overflow_rows JSONB;
  v_response JSONB;
  v_count BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('technical_configuration_baseline_import_atomicity_phase_gate'));
  SELECT nv.id INTO v_user_id FROM public.nhan_vien nv
  WHERE nv.is_active = true ORDER BY nv.id LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Setup failed: no active nhan_vien row found'; END IF;
  INSERT INTO public.technical_configuration_dossiers
    (id, device_type_name, name, description, created_by, updated_by)
  VALUES (v_dossier_id, 'P5C atomicity gate device ' || v_suffix,
    'P5C atomicity gate dossier ' || v_suffix, 'Rolled back after verification',
    v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, source_baseline_version_id,
    next_criterion_number, revision, locked_at, locked_by, created_by, updated_by
  )
  VALUES
    (v_source_version_id, v_dossier_id, 1, 'locked', NULL, 5, 1,
      now(), v_user_id, v_user_id, v_user_id),
    (v_target_version_id, v_dossier_id, 2, 'draft', v_source_version_id,
      v_next_number, v_revision, NULL, NULL, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES
    (v_source_groups[1], v_source_version_id, 'Source group 1', 1, v_user_id, v_user_id),
    (v_source_groups[2], v_source_version_id, 'Source group 2', 2, v_user_id, v_user_id),
    (v_source_groups[3], v_source_version_id, 'Source group 3', 3, v_user_id, v_user_id),
    (v_target_groups[1], v_target_version_id, 'Target group 1', 10, v_user_id, v_user_id),
    (v_target_groups[2], v_target_version_id, 'Target group 2', 20, v_user_id, v_user_id),
    (v_target_groups[3], v_target_version_id, 'Target group 3', 30, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title,
    requirement_text, sort_order, source_criterion_id, created_by, updated_by
  )
  VALUES
    (v_source_criteria[1], v_source_version_id, v_source_groups[1], 'TC-0001', 'Source 1', 'Source requirement 1', 1, NULL, v_user_id, v_user_id),
    (v_source_criteria[2], v_source_version_id, v_source_groups[1], 'TC-0002', 'Source 2', 'Source requirement 2', 2, NULL, v_user_id, v_user_id),
    (v_source_criteria[3], v_source_version_id, v_source_groups[2], 'TC-0003', 'Source 3', 'Source requirement 3', 1, NULL, v_user_id, v_user_id),
    (v_source_criteria[4], v_source_version_id, v_source_groups[3], 'TC-0004', 'Source 4', 'Source requirement 4', 1, NULL, v_user_id, v_user_id),
    (v_target_criteria[1], v_target_version_id, v_target_groups[1], 'TC-0001', 'Target 1', 'Target requirement 1', 10, v_source_criteria[1], v_user_id, v_user_id),
    (v_target_criteria[2], v_target_version_id, v_target_groups[1], 'TC-0002', 'Target 2', 'Target requirement 2', 20, v_source_criteria[2], v_user_id, v_user_id),
    (v_target_criteria[3], v_target_version_id, v_target_groups[2], 'TC-0003', 'Target 3', 'Target requirement 3', 10, v_source_criteria[3], v_user_id, v_user_id),
    (v_target_criteria[4], v_target_version_id, v_target_groups[3], 'TC-0004', 'Target 4', 'Target requirement 4', 10, v_source_criteria[4], v_user_id, v_user_id);
  PERFORM pg_temp.set_claims('global', v_user_id);
  v_metadata := pg_temp.import_metadata(v_dossier_id, v_target_version_id, v_revision);
  v_create_rows := jsonb_build_array(
    pg_temp.group_row(1, 'Created-pass group 1'),
    pg_temp.criterion_row(1, 1, 'TC-0001', 'Created-pass 1', 'Created requirement 1'),
    pg_temp.criterion_row(1, 2, 'TC-0002', 'Created-pass 2', 'Created requirement 2'),
    pg_temp.group_row(2, 'Created-pass group 2'),
    pg_temp.criterion_row(2, 1, 'TC-0003', 'Created-pass 3', 'Created requirement 3'),
    pg_temp.group_row(3, 'Created-pass group 3'),
    pg_temp.criterion_row(3, 1, 'TC-0004', 'Created-pass 4', 'Created requirement 4'),
    pg_temp.group_row(4, 'Persisted group 4'),
    pg_temp.criterion_row(4, 1, NULL, 'Persisted criterion 5', 'Persisted requirement 5')
  );
  SELECT public.technical_configuration_baseline_import_apply(
    v_target_version_id, v_metadata, v_create_rows, v_revision) INTO v_response;
  IF (v_response->'data'->>'revision')::BIGINT <> v_revision + 1
     OR (v_response->'data'->>'next_criterion_number')::BIGINT <> v_next_number + 1 THEN
    RAISE EXCEPTION 'persists a newly created group and criterion';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_groups g
    JOIN public.technical_configuration_baseline_criteria c ON c.group_id = g.id
    WHERE g.baseline_version_id = v_target_version_id
      AND g.name = 'Persisted group 4' AND g.sort_order = 4
      AND g.created_by = v_user_id AND g.updated_by = v_user_id
      AND c.criterion_code = v_created_code AND c.sort_order = 1
      AND c.created_by = v_user_id AND c.updated_by = v_user_id
  ) THEN
    RAISE EXCEPTION 'persists a newly created group and criterion';
  END IF;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  v_next_number := (v_response->'data'->>'next_criterion_number')::BIGINT;
  v_metadata := pg_temp.import_metadata(v_dossier_id, v_target_version_id, v_revision);
  v_rows := jsonb_build_array(
    pg_temp.group_row(1, 'Imported group 1'),
    pg_temp.criterion_row(1, 1, 'TC-0003', 'Imported 3', 'Imported requirement 3'),
    pg_temp.criterion_row(1, 2, 'TC-0001', 'Imported 1', 'Imported requirement 1'),
    pg_temp.criterion_row(1, 3, NULL, 'Imported 5', 'Imported requirement 5'),
    pg_temp.group_row(2, 'Imported group 2'),
    pg_temp.criterion_row(2, 1, 'TC-0002', 'Imported 2', 'Imported requirement 2')
  );
  SELECT public.technical_configuration_baseline_import_apply(
    v_target_version_id, v_metadata, v_rows, v_revision
  )
  INTO v_response;
  IF (v_response->'data'->>'revision')::BIGINT <> v_revision + 1
     OR (v_response->'data'->>'next_criterion_number')::BIGINT <> v_next_number + 1 THEN
    RAISE EXCEPTION 'advances revision and counter exactly once';
  END IF;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  v_metadata := pg_temp.import_metadata(
    v_dossier_id, v_target_version_id, v_revision
  );
  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_baseline_criteria c
  JOIN (
    VALUES
      ('TC-0001', v_target_criteria[1], v_source_criteria[1]),
      ('TC-0002', v_target_criteria[2], v_source_criteria[2]),
      ('TC-0003', v_target_criteria[3], v_source_criteria[3])
  ) expected(code, id, source_id)
    ON c.criterion_code = expected.code
   AND c.id = expected.id
   AND c.source_criterion_id = expected.source_id
  WHERE c.baseline_version_id = v_target_version_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'preserves criterion identity and source linkage';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_groups
    WHERE id = v_target_groups[3]
       OR (baseline_version_id = v_target_version_id AND name = 'Persisted group 4')
  ) OR EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_criteria
    WHERE id = v_target_criteria[4]
       OR (baseline_version_id = v_target_version_id AND criterion_code = v_created_code)
  ) THEN
    RAISE EXCEPTION 'deletes omitted groups and criteria';
  END IF;
  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_baseline_criteria c
  JOIN (
    VALUES
      ('TC-0003', v_target_groups[1], 1),
      ('TC-0001', v_target_groups[1], 2),
      ('TC-0002', v_target_groups[2], 1)
  ) expected(code, group_id, sort_order)
    ON c.criterion_code = expected.code
   AND c.group_id = expected.group_id
   AND c.sort_order = expected.sort_order
  WHERE c.baseline_version_id = v_target_version_id;
  IF v_count <> 3
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_groups
       WHERE id = v_target_groups[1] AND sort_order = 1
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_groups
       WHERE id = v_target_groups[2] AND sort_order = 2
     ) THEN
    RAISE EXCEPTION 'reorders groups and criteria';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria
    WHERE baseline_version_id = v_target_version_id
      AND criterion_code = v_new_code
      AND source_criterion_id IS NULL
  ) THEN
    RAISE EXCEPTION 'transactional code allocation failed';
  END IF;
  v_current_rows := jsonb_set(
    v_rows, '{3,criterion_code}', to_jsonb(v_new_code)
  );
  v_failure_rows := jsonb_build_array(
    pg_temp.group_row(1, 'Rollback group 1'),
    pg_temp.criterion_row(1, 1, 'TC-0002', 'Rollback 2', 'Rollback requirement 2'),
    pg_temp.group_row(2, 'Rollback group 2'),
    pg_temp.criterion_row(2, 1, 'TC-0001', 'Rollback 1', 'Rollback requirement 1'),
    pg_temp.group_row(3, 'Rollback new group'),
    pg_temp.criterion_row(3, 1, NULL, 'Rollback insert', 'Rollback requirement 6')
  );
  PERFORM pg_temp.expect_import_rollback(
    'row failure rolls back the aggregate', 'row', v_target_version_id,
    v_metadata, v_failure_rows, v_revision, v_user_id,
    'P0001', 'forced_import_failure'
  );
  PERFORM pg_temp.expect_import_rollback(
    'duplicate failure rolls back the aggregate', 'duplicate', v_target_version_id,
    v_metadata, v_failure_rows, v_revision, v_user_id, '23505'
  );
  PERFORM pg_temp.expect_import_rollback(
    'relationship failure rolls back the aggregate', 'relationship',
    v_target_version_id, v_metadata, v_failure_rows, v_revision, v_user_id, '23503'
  );
  PERFORM pg_temp.expect_import_rollback(
    'stale revision leaves the aggregate unchanged', 'internal',
    v_target_version_id, v_metadata, v_current_rows, v_revision - 1,
    v_user_id, 'PT409', 'stale_revision'
  );
  UPDATE public.technical_configuration_baseline_versions SET next_criterion_number = 10000 WHERE id = v_target_version_id;
  SELECT public.technical_configuration_baseline_import_preview(v_target_version_id, v_metadata, v_rows, v_revision) INTO v_response;
  IF v_response->'data'->'rows'->3->>'criterion_code' <> 'TC-10000' THEN RAISE EXCEPTION 'allocates TC-10000 without truncation'; END IF;
  v_revision := '9223372036854775807'::BIGINT;
  UPDATE public.technical_configuration_baseline_versions
  SET revision = v_revision
  WHERE id = v_target_version_id;
  v_metadata := pg_temp.import_metadata(
    v_dossier_id, v_target_version_id, v_revision
  );
  v_overflow_rows := jsonb_build_array(
    pg_temp.group_row(1, 'Overflow group 1'),
    pg_temp.criterion_row(1, 1, 'TC-0002', 'Overflow 2', 'Overflow requirement 2'),
    pg_temp.group_row(2, 'Overflow group 2'),
    pg_temp.criterion_row(2, 1, 'TC-0001', 'Overflow 1', 'Overflow requirement 1')
  );
  PERFORM pg_temp.expect_import_rollback(
    'late failure rolls back the aggregate', 'internal', v_target_version_id,
    v_metadata, v_overflow_rows, v_revision, v_user_id, '22003'
  );
END;
$gate$;
ROLLBACK;
