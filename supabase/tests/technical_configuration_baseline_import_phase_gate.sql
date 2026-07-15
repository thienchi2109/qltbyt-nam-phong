-- P5C trust phase gate: authorization, metadata binding, preview, and target guards.
-- Non-destructive: every fixture and mutation is rolled back.
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
        p_label,
        p_expected_state,
        p_expected_message,
        v_state,
        v_message;
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
CREATE FUNCTION pg_temp.import_metadata(
  p_dossier_id UUID,
  p_baseline_version_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql
AS $gate$
  SELECT jsonb_build_object(
    'template_kind', 'technical_configuration_baseline',
    'template_version', 1,
    'dossier_id', p_dossier_id,
    'baseline_version_id', p_baseline_version_id,
    'baseline_revision', p_revision,
    'generated_at', clock_timestamp()
  );
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_criterion_id UUID := gen_random_uuid();
  v_revision BIGINT := 7;
  v_metadata JSONB;
  v_rows JSONB;
  v_bad_rows JSONB;
  v_response JSONB;
  v_before JSONB;
  v_after JSONB;
  v_case RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_import_phase_gate')
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
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  )
  VALUES (
    v_dossier_id,
    'P5C trust gate device ' || v_suffix,
    'P5C trust gate dossier ' || v_suffix,
    'Rolled back after verification',
    v_user_id,
    v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    created_by, updated_by
  )
  VALUES (
    v_version_id, v_dossier_id, 1, 'draft', 2, v_revision, v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES (
    v_group_id, v_version_id, 'Original group', 1, v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title,
    requirement_text, sort_order, created_by, updated_by
  )
  VALUES (
    v_criterion_id, v_version_id, v_group_id, 'TC-0001', 'Original criterion',
    'Original requirement', 1, v_user_id, v_user_id
  );
  v_metadata := pg_temp.import_metadata(v_dossier_id, v_version_id, v_revision);
  v_rows := jsonb_build_array(
    jsonb_build_object(
      'row_type', 'GROUP',
      'group_order', 1,
      'group_name', 'Imported group',
      'criterion_order', NULL,
      'criterion_code', NULL,
      'criterion_title', NULL,
      'requirement_text', NULL
    ),
    jsonb_build_object(
      'row_type', 'CRITERION',
      'group_order', 1,
      'group_name', NULL,
      'criterion_order', 1,
      'criterion_code', 'TC-0001',
      'criterion_title', 'Imported criterion',
      'requirement_text', 'Imported requirement'
    )
  );
  -- missing claims fail closed through both RPCs
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims fail closed through preview',
    format(
      'SELECT public.technical_configuration_baseline_import_preview(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision
    ),
    '42501',
    'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'missing claims fail closed through apply',
    format(
      'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision
    ),
    '42501',
    'permission_denied'
  );
  -- non-global role denied through both RPCs
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role denied through preview',
    format(
      'SELECT public.technical_configuration_baseline_import_preview(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision
    ),
    '42501',
    'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'non-global role denied through apply',
    format(
      'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision
    ),
    '42501',
    'permission_denied'
  );
  -- raw admin preview succeeds and preview is read-only
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public._technical_configuration_baseline_snapshot(v_version_id) INTO v_before;
  SELECT public.technical_configuration_baseline_import_preview(
    v_version_id, v_metadata, v_rows, v_revision
  )
  INTO v_response;
  SELECT public._technical_configuration_baseline_snapshot(v_version_id) INTO v_after;
  IF jsonb_array_length(v_response->'errors') <> 0 THEN
    RAISE EXCEPTION 'raw admin preview succeeds: unexpected validation errors';
  END IF;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'preview is read-only: aggregate changed';
  END IF;
  PERFORM pg_temp.set_claims('global', v_user_id);
  FOR v_case IN
    SELECT *
    FROM (
      VALUES
        (
          'wrong template kind',
          jsonb_set(v_metadata, '{template_kind}', to_jsonb('wrong_kind'::TEXT))
        ),
        (
          'wrong template version',
          jsonb_set(v_metadata, '{template_version}', '2'::JSONB)
        ),
        (
          'mismatched dossier metadata',
          jsonb_set(v_metadata, '{dossier_id}', to_jsonb(gen_random_uuid()::TEXT))
        ),
        (
          'mismatched baseline metadata',
          jsonb_set(v_metadata, '{baseline_version_id}', to_jsonb(gen_random_uuid()::TEXT))
        ),
        (
          'mismatched revision metadata',
          jsonb_set(v_metadata, '{baseline_revision}', to_jsonb(v_revision + 1))
        )
    ) AS cases(label, metadata)
  LOOP
    PERFORM pg_temp.expect_error(
      v_case.label,
      format(
        'SELECT public.technical_configuration_baseline_import_preview(%L::UUID, %L::JSONB, %L::JSONB, %s)',
        v_version_id, v_case.metadata::TEXT, v_rows::TEXT, v_revision
      ),
      'PT422',
      'template_mismatch'
    );
    -- metadata mismatch through apply
    PERFORM pg_temp.expect_error(
      v_case.label || ' through apply',
      format(
        'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
        v_version_id, v_case.metadata::TEXT, v_rows::TEXT, v_revision
      ),
      'PT422',
      'template_mismatch'
    );
  END LOOP;
  PERFORM pg_temp.expect_error(
    'malformed payload through preview',
    format(
      'SELECT public.technical_configuration_baseline_import_preview(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, '{}'::JSONB::TEXT, v_revision
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'malformed payload through apply',
    format(
      'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, '{}'::JSONB::TEXT, v_revision
    ),
    'PT422',
    'validation_error'
  );
  -- tampered canonical rows are reported by preview and rejected by apply
  v_bad_rows := jsonb_set(v_rows, '{1,criterion_code}', '"TC-9999"'::JSONB);
  SELECT public.technical_configuration_baseline_import_preview(
    v_version_id, v_metadata, v_bad_rows, v_revision
  )
  INTO v_response;
  IF NOT v_response->'errors' @> '[{"code":"changed_criterion_code"}]'::JSONB THEN
    RAISE EXCEPTION 'tampered canonical rows: preview did not report changed code';
  END IF;
  PERFORM pg_temp.expect_error(
    'tampered canonical rows through apply',
    format(
      'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_bad_rows::TEXT, v_revision
    ),
    'PT422',
    'validation_error'
  );
  -- global apply succeeds
  SELECT public.technical_configuration_baseline_import_apply(
    v_version_id, v_metadata, v_rows, v_revision
  )
  INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_revision <> 8
     OR v_response->'data'->'groups'->0->>'name' <> 'Imported group' THEN
    RAISE EXCEPTION 'global apply succeeds: unexpected aggregate result';
  END IF;
  -- stale revision
  PERFORM pg_temp.expect_error(
    'stale revision',
    format(
      'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision - 1
    ),
    'PT409',
    'stale_revision'
  );
  -- locked target
  UPDATE public.technical_configuration_baseline_versions
  SET status = 'locked',
      locked_at = now(),
      locked_by = v_user_id,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_version_id
  RETURNING revision INTO v_revision;
  v_metadata := pg_temp.import_metadata(v_dossier_id, v_version_id, v_revision);
  PERFORM pg_temp.expect_error(
    'locked target',
    format(
      'SELECT public.technical_configuration_baseline_import_preview(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision
    ),
    'PT409',
    'locked_version'
  );
  -- archived target
  UPDATE public.technical_configuration_dossiers
  SET archived_at = now(), archived_by = v_user_id
  WHERE id = v_dossier_id;
  PERFORM pg_temp.expect_error(
    'archived target',
    format(
      'SELECT public.technical_configuration_baseline_import_apply(%L::UUID, %L::JSONB, %L::JSONB, %s)',
      v_version_id, v_metadata::TEXT, v_rows::TEXT, v_revision
    ),
    'PT409',
    'archived_dossier'
  );
END;
$gate$;
ROLLBACK;
