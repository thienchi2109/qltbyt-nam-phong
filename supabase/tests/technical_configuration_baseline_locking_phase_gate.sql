-- supabase/tests/technical_configuration_baseline_locking_phase_gate.sql
-- Purpose: prove P4 role, lock, mutation, copy, and history invariants.
-- Non-destructive: all fixture writes are wrapped in a transaction and rolled back.
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
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_version_id UUID;
  v_copy_version_id UUID;
  v_source_group_id UUID;
  v_other_group_id UUID;
  v_criterion_id UUID;
  v_group_ids UUID[];
  v_criterion_ids UUID[];
  v_revision BIGINT;
  v_locked_revision BIGINT;
  v_response JSONB;
  v_history JSONB;
  v_count BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_locking_phase_gate')
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
    device_type_name,
    name,
    description,
    created_by,
    updated_by
  )
  VALUES (
    'P4 phase gate device ' || v_suffix,
    'P4 phase gate dossier ' || v_suffix,
    'Rolled back after verification',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_dossier_id;
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims fail closed',
    format(
      'SELECT public.technical_configuration_baseline_versions_list(%L::UUID, 1, 100)',
      v_dossier_id
    ),
    '42501',
    'permission_denied'
  );
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role denied',
    format(
      'SELECT public.technical_configuration_baseline_versions_list(%L::UUID, 1, 100)',
      v_dossier_id
    ),
    '42501',
    'permission_denied'
  );
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_baseline_draft_create(v_dossier_id, 1)
  INTO v_response;
  v_version_id := (v_response->'data'->>'id')::UUID;
  IF v_version_id IS NULL OR (v_response->'data'->>'version_number')::BIGINT <> 1 THEN
    RAISE EXCEPTION 'Admin draft creation returned an invalid first version';
  END IF;
  PERFORM pg_temp.expect_error(
    'blank creation rejects an existing draft',
    format(
      'SELECT public.technical_configuration_baseline_draft_create(%L::UUID, %s)',
      v_dossier_id,
      (v_response->'data'->>'dossier_revision')::BIGINT
    ),
    'PT409',
    'draft_already_exists'
  );
  SELECT public.technical_configuration_baseline_versions_list(v_dossier_id, 1, 100)
  INTO v_history;
  IF (v_history->>'total')::BIGINT <> 1
     OR v_history->'data'->0->>'status' <> 'draft' THEN
    RAISE EXCEPTION 'Admin history read did not return the draft';
  END IF;
  SELECT revision
  INTO v_revision
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_version_id;
  PERFORM pg_temp.expect_error(
    'copy requires a locked source',
    format(
      'SELECT public.technical_configuration_baseline_copy(%L::UUID, %s)',
      v_version_id,
      v_revision
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'lock requires baseline content',
    format(
      'SELECT public.technical_configuration_baseline_lock(%L::UUID, %s)',
      v_version_id,
      v_revision
    ),
    'PT422',
    'validation_error'
  );
  SELECT id
  INTO v_source_group_id
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = v_version_id
  ORDER BY sort_order, id
  LIMIT 1;
  SELECT id
  INTO v_other_group_id
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = v_version_id
    AND id <> v_source_group_id
  ORDER BY sort_order, id
  LIMIT 1;
  PERFORM public.technical_configuration_baseline_criterion_create(
    v_source_group_id,
    'Nguồn điện',
    '220V - 50Hz',
    v_revision
  );
  SELECT revision
  INTO v_revision
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_version_id;
  SELECT id
  INTO v_criterion_id
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
  ORDER BY sort_order, id
  LIMIT 1;
  SELECT array_agg(id ORDER BY sort_order, id)
  INTO v_group_ids
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = v_version_id;
  SELECT array_agg(id ORDER BY sort_order, id)
  INTO v_criterion_ids
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = v_source_group_id;
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'lock rejects a stale revision',
    format(
      'SELECT public.technical_configuration_baseline_lock(%L::UUID, %s)',
      v_version_id,
      v_revision - 1
    ),
    'PT409',
    'stale_revision'
  );
  SELECT public.technical_configuration_baseline_lock(v_version_id, v_revision)
  INTO v_response;
  v_locked_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_response->'data'->>'status' <> 'locked'
     OR (v_response->'data'->>'locked_by')::BIGINT <> v_user_id
     OR v_response->'data'->>'locked_at' IS NULL THEN
    RAISE EXCEPTION 'Global lock did not persist immutable lock metadata';
  END IF;
  PERFORM pg_temp.set_claims('admin', v_user_id);
  PERFORM pg_temp.expect_error(
    'locked version cannot be locked twice',
    format(
      'SELECT public.technical_configuration_baseline_lock(%L::UUID, %s)',
      v_version_id,
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'group create blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_group_create(%L::UUID, %L, %s)',
      v_version_id,
      'Blocked group',
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'group update blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_group_update(%L::UUID, %L, %s)',
      v_source_group_id,
      'Blocked rename',
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'group delete blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_group_delete(%L::UUID, %s)',
      v_other_group_id,
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'group reorder blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_groups_reorder(%L::UUID, %L::UUID[], %s)',
      v_version_id,
      v_group_ids::TEXT,
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'criterion create blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_criterion_create(%L::UUID, %L, %L, %s)',
      v_source_group_id,
      'Blocked criterion',
      'Blocked requirement',
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'criterion update blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_criterion_update(%L::UUID, %L, %L, %s)',
      v_criterion_id,
      'Blocked update',
      'Blocked requirement',
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'criterion delete blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_criterion_delete(%L::UUID, %s)',
      v_criterion_id,
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'criterion reorder blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_criteria_reorder(%L::UUID, %L::UUID[], %s)',
      v_source_group_id,
      v_criterion_ids::TEXT,
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'bulk preview blocked after lock',
    format(
      'SELECT public.technical_configuration_baseline_bulk_preview(%L::UUID, %L::JSONB, %s)',
      v_source_group_id,
      '[]',
      v_locked_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'copy rejects a stale locked revision',
    format(
      'SELECT public.technical_configuration_baseline_copy(%L::UUID, %s)',
      v_version_id,
      v_locked_revision - 1
    ),
    'PT409',
    'stale_revision'
  );
  SELECT public.technical_configuration_baseline_copy(v_version_id, v_locked_revision)
  INTO v_response;
  v_copy_version_id := (v_response->'data'->>'id')::UUID;
  IF v_copy_version_id IS NULL
     OR v_copy_version_id = v_version_id
     OR (v_response->'data'->>'version_number')::BIGINT <> 2
     OR v_response->'data'->>'status' <> 'draft'
     OR (v_response->'data'->>'source_baseline_version_id')::UUID <> v_version_id THEN
    RAISE EXCEPTION 'Copy did not create the expected linked draft';
  END IF;
  PERFORM pg_temp.expect_error(
    'copy rejects an existing draft',
    format(
      'SELECT public.technical_configuration_baseline_copy(%L::UUID, %s)',
      v_version_id,
      v_locked_revision
    ),
    'PT409',
    'draft_already_exists'
  );
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions source
    JOIN public.technical_configuration_baseline_versions copied
      ON copied.id = v_copy_version_id
    WHERE source.id = v_version_id
      AND copied.next_criterion_number = source.next_criterion_number
  ) THEN
    RAISE EXCEPTION 'Copy did not preserve the criterion counter';
  END IF;
  IF EXISTS (
    SELECT g.name, g.sort_order
    FROM public.technical_configuration_baseline_groups g
    WHERE g.baseline_version_id = v_version_id
    EXCEPT
    SELECT g.name, g.sort_order
    FROM public.technical_configuration_baseline_groups g
    WHERE g.baseline_version_id = v_copy_version_id
  ) OR EXISTS (
    SELECT g.name, g.sort_order
    FROM public.technical_configuration_baseline_groups g
    WHERE g.baseline_version_id = v_copy_version_id
    EXCEPT
    SELECT g.name, g.sort_order
    FROM public.technical_configuration_baseline_groups g
    WHERE g.baseline_version_id = v_version_id
  ) THEN
    RAISE EXCEPTION 'Copy did not preserve the group snapshot';
  END IF;
  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id;
  IF v_count <> (
    SELECT count(*)
    FROM public.technical_configuration_baseline_criteria
    WHERE baseline_version_id = v_copy_version_id
  ) THEN
    RAISE EXCEPTION 'Copy did not preserve the criterion count';
  END IF;
  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_baseline_criteria copied
  JOIN public.technical_configuration_baseline_groups copied_group
    ON copied_group.id = copied.group_id
  LEFT JOIN public.technical_configuration_baseline_criteria source
    ON source.id = copied.source_criterion_id
  LEFT JOIN public.technical_configuration_baseline_groups source_group
    ON source_group.id = source.group_id
  WHERE copied.baseline_version_id = v_copy_version_id
    AND (
      source.id IS NULL
      OR copied.id = source.id
      OR source.baseline_version_id <> v_version_id
      OR copied_group.name IS DISTINCT FROM source_group.name
      OR copied_group.sort_order IS DISTINCT FROM source_group.sort_order
      OR copied.criterion_code IS DISTINCT FROM source.criterion_code
      OR copied.title IS DISTINCT FROM source.title
      OR copied.requirement_text IS DISTINCT FROM source.requirement_text
      OR copied.sort_order IS DISTINCT FROM source.sort_order
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Copy criterion fidelity or lineage check failed';
  END IF;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_lock(v_copy_version_id, v_revision)
  INTO v_response;
  SELECT public.technical_configuration_baseline_versions_list(v_dossier_id, 1, 100)
  INTO v_history;
  IF (v_history->>'total')::BIGINT <> 2
     OR (v_history->'data'->0->>'id')::UUID <> v_copy_version_id
     OR v_history->'data'->0->>'status' <> 'locked'
     OR (v_history->'data'->1->>'id')::UUID <> v_version_id
     OR v_history->'data'->1->>'status' <> 'locked'
     OR v_history->'data'->1->'groups'->0->'criteria'->0->>'criterion_code' <> 'TC-0001'
     OR v_history->'data'->1->'groups'->0->'criteria'->0->>'requirement_text' <> '220V - 50Hz' THEN
    RAISE EXCEPTION 'historical read after newer version is locked';
  END IF;
END;
$gate$;
ROLLBACK;
