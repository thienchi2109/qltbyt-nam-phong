-- P9A2 rollback-only supplier-option import trust, validation, and atomicity gate.
-- Execute as one SQL batch through Supabase MCP after explicit live-write approval.
BEGIN;

CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
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

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_label;
  END IF;
END;
$gate$;

CREATE FUNCTION pg_temp.option_metadata(
  p_dossier_id UUID, p_option_id UUID, p_baseline_version_id UUID, p_revision BIGINT
)
RETURNS JSONB LANGUAGE sql AS $gate$
  SELECT jsonb_build_object(
    'template_kind', 'technical_configuration_option', 'template_version', 1,
    'dossier_id', p_dossier_id, 'option_id', p_option_id,
    'baseline_version_id', p_baseline_version_id, 'dossier_revision', p_revision,
    'generated_at', clock_timestamp()
  );
$gate$;

CREATE FUNCTION pg_temp.option_row(
  p_group_order INTEGER, p_group_name TEXT, p_criterion_order INTEGER,
  p_criterion_id UUID, p_criterion_code TEXT, p_criterion_title TEXT,
  p_requirement_text TEXT, p_response_text TEXT, p_supplementary_information TEXT
)
RETURNS JSONB LANGUAGE sql AS $gate$
  SELECT jsonb_build_object(
    'group_order', p_group_order, 'group_name', p_group_name,
    'criterion_order', p_criterion_order, 'criterion_id', p_criterion_id,
    'criterion_code', p_criterion_code, 'criterion_title', p_criterion_title,
    'requirement_text', p_requirement_text, 'response_text', p_response_text,
    'supplementary_information', p_supplementary_information
  );
$gate$;

CREATE FUNCTION pg_temp.option_import_snapshot(
  p_dossier_id UUID, p_option_id UUID, p_baseline_version_id UUID
)
RETURNS JSONB LANGUAGE sql AS $gate$
  SELECT jsonb_build_object(
    'dossier', (
      SELECT to_jsonb(d) FROM public.technical_configuration_dossiers d
      WHERE d.id = p_dossier_id
    ),
    'sets', COALESCE((
      SELECT jsonb_agg(to_jsonb(cs) ORDER BY cs.id)
      FROM public.technical_configuration_comparison_sets cs
      WHERE cs.option_id = p_option_id
        AND cs.baseline_version_id = p_baseline_version_id
    ), '[]'::JSONB),
    'responses', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.criterion_id)
      FROM public.technical_configuration_option_responses r
      JOIN public.technical_configuration_comparison_sets cs
        ON cs.id = r.comparison_set_id
      WHERE cs.option_id = p_option_id
        AND cs.baseline_version_id = p_baseline_version_id
    ), '[]'::JSONB)
  );
$gate$;

CREATE FUNCTION pg_temp.expect_no_write_error(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT, p_expected_message TEXT,
  p_dossier_id UUID, p_option_id UUID, p_baseline_version_id UUID
)
RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_state TEXT;
  v_message TEXT;
BEGIN
  v_before := pg_temp.option_import_snapshot(
    p_dossier_id, p_option_id, p_baseline_version_id
  );
  BEGIN
    EXECUTE p_statement;
    RAISE EXCEPTION 'expected_error_was_not_raised';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM p_expected_state
     OR v_message IS DISTINCT FROM p_expected_message THEN
    RAISE EXCEPTION '%: expected [%] %, got [%] %',
      p_label, p_expected_state, p_expected_message, v_state, v_message;
  END IF;
  v_after := pg_temp.option_import_snapshot(
    p_dossier_id, p_option_id, p_baseline_version_id
  );
  PERFORM pg_temp.assert_true(p_label || ' zero writes', v_after = v_before);
END;
$gate$;

CREATE FUNCTION pg_temp.expect_option_import_error(
  p_label TEXT, p_function_name TEXT, p_dossier_id UUID, p_option_id UUID,
  p_baseline_version_id UUID, p_metadata JSONB, p_rows JSONB,
  p_expected_revision BIGINT, p_expected_state TEXT, p_expected_message TEXT
)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  PERFORM pg_temp.expect_no_write_error(
    p_label,
    format(
      'SELECT public.%I(%L::UUID,%L::UUID,%L::JSONB,%L::JSONB,%s)',
      p_function_name, p_option_id, p_baseline_version_id,
      p_metadata, p_rows, p_expected_revision
    ),
    p_expected_state, p_expected_message,
    p_dossier_id, p_option_id, p_baseline_version_id
  );
END;
$gate$;

CREATE FUNCTION public._p9a2_option_import_fail_revision_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $gate$
BEGIN
  IF NEW.id::TEXT = current_setting('p9a2.failure_dossier', true) THEN
    RAISE EXCEPTION 'injected_late_failure';
  END IF;
  RETURN NEW;
END;
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossiers UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_suppliers UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_options UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_versions UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_groups UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_criteria UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_rows JSONB;
  v_draft_rows JSONB;
  v_archived_rows JSONB;
  v_metadata JSONB;
  v_response JSONB;
  v_before JSONB;
  v_after JSONB;
  v_set_id UUID;
  v_function_signature TEXT;
  v_error_message TEXT;
  v_case RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_option_import_phase_gate')
  );
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P9A2 phase gate requires one active public.nhan_vien row';
  END IF;

  -- Array indexes: main, other, archived; option also has metadata, failure and draft.
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, archived_at, archived_by, created_by, updated_by
  ) VALUES
    (v_dossiers[1], 'P9A2 device ' || v_suffix, 'P9A2 dossier ' || v_suffix,
      NULL, NULL, v_user_id, v_user_id),
    (v_dossiers[2], 'P9A2 other device ' || v_suffix, 'P9A2 other ' || v_suffix,
      NULL, NULL, v_user_id, v_user_id),
    (v_dossiers[3], 'P9A2 archived device ' || v_suffix, 'P9A2 archived ' || v_suffix,
      now(), v_user_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_suppliers[1], v_dossiers[1], 'P9A2 Supplier', v_user_id, v_user_id),
    (v_suppliers[2], v_dossiers[2], 'P9A2 Other Supplier', v_user_id, v_user_id),
    (v_suppliers[3], v_dossiers[3], 'P9A2 Archived Supplier', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  ) VALUES
    (v_options[1], v_dossiers[1], v_suppliers[1], 'Import Option', v_user_id, v_user_id),
    (v_options[2], v_dossiers[1], v_suppliers[1], 'Metadata Option', v_user_id, v_user_id),
    (v_options[3], v_dossiers[1], v_suppliers[1], 'Failure Option', v_user_id, v_user_id),
    (v_options[4], v_dossiers[1], v_suppliers[1], 'Draft Option', v_user_id, v_user_id),
    (v_options[5], v_dossiers[2], v_suppliers[2], 'Other Option', v_user_id, v_user_id),
    (v_options[6], v_dossiers[3], v_suppliers[3], 'Archived Option', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES
    (v_versions[1], v_dossiers[1], 1, 'locked', 3, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_versions[2], v_dossiers[1], 2, 'draft', 2, 1, NULL, NULL,
      v_user_id, v_user_id),
    (v_versions[3], v_dossiers[2], 1, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_versions[4], v_dossiers[3], 1, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (v_groups[1], v_versions[1], 'Main Group', 1, v_user_id, v_user_id),
    (v_groups[2], v_versions[2], 'Draft Group', 1, v_user_id, v_user_id),
    (v_groups[3], v_versions[3], 'Other Group', 1, v_user_id, v_user_id),
    (v_groups[4], v_versions[4], 'Archived Group', 1, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (v_criteria[1], v_versions[1], v_groups[1], 'TC-0001', 'Power',
      'Main criterion', 1, v_user_id, v_user_id),
    (v_criteria[2], v_versions[1], v_groups[1], 'TC-0002', NULL,
      'Second criterion', 2, v_user_id, v_user_id),
    (v_criteria[3], v_versions[2], v_groups[2], 'TC-0001', NULL,
      'Draft criterion', 1, v_user_id, v_user_id),
    (v_criteria[4], v_versions[3], v_groups[3], 'TC-0001', NULL,
      'Other criterion', 1, v_user_id, v_user_id),
    (v_criteria[5], v_versions[4], v_groups[4], 'TC-0001', NULL,
      'Archived criterion', 1, v_user_id, v_user_id);

  v_rows := jsonb_build_array(
    pg_temp.option_row(
      1, 'Main Group', 1, v_criteria[1], 'TC-0001', 'Power',
      'Main criterion', E'Line 1\nLine 2', 'Doc A'
    ),
    pg_temp.option_row(
      1, 'Main Group', 2, v_criteria[2], 'TC-0002', NULL,
      'Second criterion', 'Second response', 'Doc B'
    )
  );
  v_draft_rows := jsonb_build_array(pg_temp.option_row(
    1, 'Draft Group', 1, v_criteria[3], 'TC-0001', NULL,
    'Draft criterion', 'Draft response', ''
  ));
  v_archived_rows := jsonb_build_array(pg_temp.option_row(
    1, 'Archived Group', 1, v_criteria[5], 'TC-0001', NULL,
    'Archived criterion', 'Blocked', ''
  ));
  v_metadata := pg_temp.option_metadata(v_dossiers[1], v_options[1], v_versions[1], 1);

  -- missing and invalid claims fail closed; non-global role denied
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_option_import_error(
    'missing claims fail closed', 'technical_configuration_option_import_preview',
    v_dossiers[1], v_options[1], v_versions[1], v_metadata, v_rows, 1,
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('global', -1);
  PERFORM pg_temp.expect_option_import_error(
    'invalid claims fail closed', 'technical_configuration_option_import_preview',
    v_dossiers[1], v_options[1], v_versions[1], v_metadata, v_rows, 1,
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_option_import_error(
    'non-global role denied', 'technical_configuration_option_import_apply',
    v_dossiers[1], v_options[1], v_versions[1], v_metadata, v_rows, 1,
    '42501', 'permission_denied'
  );

  -- raw admin preview succeeds and is read-only
  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_before := pg_temp.option_import_snapshot(v_dossiers[1], v_options[1], v_versions[1]);
  SELECT public.technical_configuration_option_import_preview(
    v_options[1], v_versions[1], v_metadata, v_rows, 1
  ) INTO v_response;
  v_after := pg_temp.option_import_snapshot(v_dossiers[1], v_options[1], v_versions[1]);
  PERFORM pg_temp.assert_true(
    'raw admin preview succeeds',
    jsonb_array_length(v_response->'errors') = 0
      AND jsonb_array_length(v_response->'data'->'rows') = 2
  );
  PERFORM pg_temp.assert_true('preview is read-only', v_after = v_before);

  PERFORM pg_temp.set_claims('global', v_user_id);
  FOR v_case IN SELECT * FROM (VALUES
    ('wrong option metadata zero writes', v_dossiers[1], v_options[1], v_versions[1],
      pg_temp.option_metadata(v_dossiers[1], v_options[2], v_versions[1], 1),
      v_rows, 1::BIGINT, 'PT422', 'template_mismatch'),
    ('wrong baseline metadata zero writes', v_dossiers[1], v_options[1], v_versions[1],
      pg_temp.option_metadata(v_dossiers[1], v_options[1], v_versions[2], 1),
      v_rows, 1::BIGINT, 'PT422', 'template_mismatch'),
    ('cross-dossier target zero writes', v_dossiers[1], v_options[1], v_versions[3],
      pg_temp.option_metadata(v_dossiers[1], v_options[1], v_versions[3], 1),
      v_rows, 1::BIGINT, 'PT422', 'validation_error'),
    ('stale preview zero writes', v_dossiers[1], v_options[1], v_versions[1],
      pg_temp.option_metadata(v_dossiers[1], v_options[1], v_versions[1], 0),
      v_rows, 0::BIGINT, 'PT409', 'stale_revision'),
    ('stale apply zero writes', v_dossiers[1], v_options[3], v_versions[1],
      pg_temp.option_metadata(v_dossiers[1], v_options[3], v_versions[1], 0),
      v_rows, 0::BIGINT, 'PT409', 'stale_revision'),
    ('archived preview zero writes', v_dossiers[3], v_options[6], v_versions[4],
      pg_temp.option_metadata(v_dossiers[3], v_options[6], v_versions[4], 1),
      v_archived_rows, 1::BIGINT, 'PT409', 'archived_dossier'),
    ('archived target zero writes', v_dossiers[3], v_options[6], v_versions[4],
      pg_temp.option_metadata(v_dossiers[3], v_options[6], v_versions[4], 1),
      v_archived_rows, 1::BIGINT, 'PT409', 'archived_dossier')
  ) AS cases(
    label, dossier_id, option_id, baseline_version_id, metadata, rows,
    expected_revision, expected_state, expected_message
  ) LOOP
    PERFORM pg_temp.expect_option_import_error(
      v_case.label,
      CASE WHEN v_case.label = 'stale preview zero writes'
             OR v_case.label = 'archived preview zero writes'
        THEN 'technical_configuration_option_import_preview'
        ELSE 'technical_configuration_option_import_apply'
      END,
      v_case.dossier_id, v_case.option_id, v_case.baseline_version_id,
      v_case.metadata, v_case.rows, v_case.expected_revision,
      v_case.expected_state, v_case.expected_message
    );
  END LOOP;

  -- Row issues are returned by preview and rejected by apply with zero writes.
  FOR v_case IN SELECT * FROM (VALUES
    ('malformed rows zero writes',
      jsonb_build_array(jsonb_build_object('criterion_id', v_criteria[1])),
      'invalid_row_shape'::TEXT, 1::INTEGER, NULL::UUID),
    ('tampered rows zero writes',
      jsonb_set(v_rows, '{0,requirement_text}', '"Tampered"'::JSONB),
      'changed_context', 1, v_criteria[1]),
    ('missing criterion zero writes',
      jsonb_build_array(v_rows->0), 'missing_criterion', NULL, v_criteria[2]),
    ('unknown criterion zero writes',
      jsonb_set(v_rows, '{1,criterion_id}', to_jsonb(v_criteria[6]::TEXT)),
      'unknown_criterion', 2, v_criteria[6]),
    ('duplicate criterion zero writes',
      jsonb_build_array(v_rows->0, v_rows->0),
      'duplicate_criterion', 2, v_criteria[1])
  ) AS cases(label, rows, issue_code, row_number, criterion_id) LOOP
    PERFORM pg_temp.expect_option_import_error(
      v_case.label,
      'technical_configuration_option_import_apply',
      v_dossiers[1], v_options[1], v_versions[1],
      v_metadata, v_case.rows, 1, 'PT422', 'validation_error'
    );
    v_before := pg_temp.option_import_snapshot(v_dossiers[1], v_options[1], v_versions[1]);
    SELECT public.technical_configuration_option_import_preview(
      v_options[1], v_versions[1], v_metadata, v_case.rows, 1
    ) INTO v_response;
    v_after := pg_temp.option_import_snapshot(v_dossiers[1], v_options[1], v_versions[1]);
    PERFORM pg_temp.assert_true(
      v_case.issue_code || ' preview issue',
      v_after = v_before
        AND v_response->'errors'->0->>'code' = v_case.issue_code
        AND COALESCE((v_response->'errors'->0->>'row')::INTEGER, 0)
          = COALESCE(v_case.row_number, 0)
        AND COALESCE(v_response->'errors'->0->>'criterion_id', '')
          = COALESCE(v_case.criterion_id::TEXT, '')
    );
  END LOOP;

  -- Global apply accepts locked baselines, creates the set, and reconciles all rows.
  SELECT public.technical_configuration_option_import_apply(
    v_options[1], v_versions[1], v_metadata, v_rows, 1
  ) INTO v_response;
  v_set_id := (v_response->'data'->>'id')::UUID;
  PERFORM pg_temp.assert_true(
    'global apply succeeds',
    (v_response->'data'->>'revision')::BIGINT = 2
  );
  PERFORM pg_temp.assert_true(
    'locked baseline accepted',
    (SELECT status FROM public.technical_configuration_baseline_versions
     WHERE id = v_versions[1]) = 'locked'
  );
  PERFORM pg_temp.assert_true(
    'creates comparison set inside apply',
    EXISTS (SELECT 1 FROM public.technical_configuration_comparison_sets
            WHERE id = v_set_id)
  );
  PERFORM pg_temp.assert_true(
    'reconciles complete snapshot',
    (SELECT count(*) FROM public.technical_configuration_option_responses
     WHERE comparison_set_id = v_set_id) = 2
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossiers[1]) = 2
  );

  -- Blank canonical row deletes its response; remaining values update exactly.
  v_rows := jsonb_set(v_rows, '{0,response_text}', '"Updated"'::JSONB);
  v_rows := jsonb_set(v_rows, '{1,response_text}', '""'::JSONB);
  v_rows := jsonb_set(v_rows, '{1,supplementary_information}', '""'::JSONB);
  PERFORM public.technical_configuration_option_import_apply(
    v_options[1], v_versions[1],
    pg_temp.option_metadata(v_dossiers[1], v_options[1], v_versions[1], 2),
    v_rows, 2
  );
  PERFORM pg_temp.assert_true(
    'blank canonical row deletes response',
    (SELECT count(*) FROM public.technical_configuration_option_responses
     WHERE comparison_set_id = v_set_id) = 1
      AND EXISTS (
        SELECT 1 FROM public.technical_configuration_option_responses
        WHERE comparison_set_id = v_set_id
          AND criterion_id = v_criteria[1]
          AND response_text = 'Updated'
          AND supplementary_information = 'Doc A'
      )
  );
  PERFORM pg_temp.assert_true(
    'increments dossier revision exactly once',
    (SELECT revision FROM public.technical_configuration_dossiers
     WHERE id = v_dossiers[1]) = 3
  );

  -- Inject a failure at the final revision update inside apply and prove rollback.
  PERFORM set_config('p9a2.failure_dossier', v_dossiers[1]::TEXT, true);
  CREATE TRIGGER technical_configuration_option_import_fail_revision
  BEFORE UPDATE OF revision ON public.technical_configuration_dossiers
  FOR EACH ROW EXECUTE FUNCTION public._p9a2_option_import_fail_revision_update();
  v_before := pg_temp.option_import_snapshot(v_dossiers[1], v_options[3], v_versions[1]);
  v_error_message := NULL;
  BEGIN
    PERFORM public.technical_configuration_option_import_apply(
      v_options[3], v_versions[1],
      pg_temp.option_metadata(v_dossiers[1], v_options[3], v_versions[1], 3),
      v_rows, 3
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
  END;
  DROP TRIGGER technical_configuration_option_import_fail_revision
    ON public.technical_configuration_dossiers;
  DROP FUNCTION public._p9a2_option_import_fail_revision_update();
  v_after := pg_temp.option_import_snapshot(v_dossiers[1], v_options[3], v_versions[1]);
  PERFORM pg_temp.assert_true(
    'late failure rolls back comparison set and responses',
    v_error_message = 'injected_late_failure'
      AND v_after = v_before
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossiers[1]) = 3
  );

  -- Draft baseline accepted.
  SELECT public.technical_configuration_option_import_apply(
    v_options[4], v_versions[2],
    pg_temp.option_metadata(v_dossiers[1], v_options[4], v_versions[2], 3),
    v_draft_rows, 3
  ) INTO v_response;
  PERFORM pg_temp.assert_true(
    'draft baseline accepted',
    (SELECT status FROM public.technical_configuration_baseline_versions
     WHERE id = v_versions[2]) = 'draft'
      AND jsonb_array_length(v_response->'data'->'responses') = 1
      AND (v_response->'data'->>'revision')::BIGINT = 4
  );

  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.technical_configuration_option_import_preview(uuid,uuid,jsonb,jsonb,bigint)',
    'public.technical_configuration_option_import_apply(uuid,uuid,jsonb,jsonb,bigint)'
  ] LOOP
    PERFORM pg_temp.assert_true(
      'authenticated executes ' || v_function_signature,
      has_function_privilege('authenticated', v_function_signature, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      'service role executes ' || v_function_signature,
      has_function_privilege('service_role', v_function_signature, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      'anon cannot execute ' || v_function_signature,
      NOT has_function_privilege('anon', v_function_signature, 'EXECUTE')
    );
  END LOOP;
  PERFORM pg_temp.assert_true(
    'validator hidden from authenticated',
    NOT has_function_privilege(
      'authenticated',
      'public._technical_configuration_option_import_validate(uuid,uuid,jsonb,jsonb,bigint)',
      'EXECUTE'
    )
  );
  PERFORM pg_temp.assert_true(
    'service role executes validator',
    has_function_privilege(
      'service_role',
      'public._technical_configuration_option_import_validate(uuid,uuid,jsonb,jsonb,bigint)',
      'EXECUTE'
    )
  );
END;
$gate$;

ROLLBACK;
