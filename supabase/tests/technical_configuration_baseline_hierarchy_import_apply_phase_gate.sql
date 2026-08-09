-- P2B atomic hierarchy import apply phase gate.
-- The P2B migration must be applied before execution. All fixture writes roll back.
BEGIN;
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
-- fixture tree snapshot
CREATE FUNCTION pg_temp.baseline_tree_snapshot(p_version_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $gate$
  SELECT jsonb_build_object(
    'version', (
      SELECT to_jsonb(v)
      FROM public.technical_configuration_baseline_versions v
      WHERE v.id = p_version_id
    ),
    'groups', (
      SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.id), '[]'::JSONB)
      FROM public.technical_configuration_baseline_groups g
      WHERE g.baseline_version_id = p_version_id
    ),
    'subgroups', (
      SELECT COALESCE(jsonb_agg(to_jsonb(sg) ORDER BY sg.id), '[]'::JSONB)
      FROM public.technical_configuration_baseline_subgroups sg
      WHERE sg.baseline_version_id = p_version_id
    ),
    'criteria', (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]'::JSONB)
      FROM public.technical_configuration_baseline_criteria c
      WHERE c.baseline_version_id = p_version_id
    )
  );
$gate$;
CREATE FUNCTION pg_temp.expect_apply_error_unchanged(
  p_label TEXT,
  p_version_id UUID,
  p_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT,
  p_expected_state TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_failed BOOLEAN := false;
  v_state TEXT;
  v_message TEXT;
BEGIN
  v_before := pg_temp.baseline_tree_snapshot(p_version_id);
  BEGIN
    PERFORM public._technical_configuration_baseline_import_apply_v2(
      p_version_id,
      p_metadata,
      p_rows,
      p_expected_revision
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_failed := true;
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION '%: expected statement to fail', p_label;
  END IF;
  IF v_state <> p_expected_state OR v_message <> p_expected_message THEN
    RAISE EXCEPTION '%: expected %/%, got %/%',
      p_label, p_expected_state, p_expected_message, v_state, v_message;
  END IF;
  v_after := pg_temp.baseline_tree_snapshot(p_version_id);
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION '%: hierarchy changed after rejected apply', p_label;
  END IF;
END;
$gate$;
CREATE FUNCTION pg_temp.inject_apply_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF current_setting('p2b.inject_failure', true) = 'on' THEN
    RAISE EXCEPTION 'p2b_injected_failure';
  END IF;
  RETURN NEW;
END;
$gate$;
CREATE TRIGGER p2b_hierarchy_import_apply_injected_failure
BEFORE UPDATE ON public.technical_configuration_baseline_versions
FOR EACH ROW
EXECUTE FUNCTION pg_temp.inject_apply_failure();
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid(); v_version_id UUID := gen_random_uuid();
  v_group_a_id UUID := gen_random_uuid(); v_group_b_id UUID := gen_random_uuid();
  v_group_delete_id UUID := gen_random_uuid();
  v_subgroup_keep_id UUID := gen_random_uuid(); v_subgroup_delete_id UUID := gen_random_uuid();
  v_criterion_a_id UUID := gen_random_uuid(); v_criterion_b_id UUID := gen_random_uuid();
  v_criterion_delete_id UUID := gen_random_uuid();
  v_criterion_subgroup_delete_id UUID := gen_random_uuid();
  v_revision BIGINT := 4;
  v_metadata JSONB; v_rows JSONB; v_preview JSONB; v_apply JSONB;
  v_before JSONB; v_after JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_hierarchy_import_apply_phase_gate')
  );
  PERFORM set_config('p2b.inject_failure', 'off', true);
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
  VALUES (v_dossier_id, 'P2B apply device ' || v_suffix,
    'P2B apply dossier ' || v_suffix, 'Rolled back after verification',
    v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_versions
    (id, dossier_id, version_number, status, next_criterion_number, revision,
     created_by, updated_by)
  VALUES (v_version_id, v_dossier_id, 1, 'draft', 5, v_revision,
    v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_groups
    (id, baseline_version_id, name, sort_order, created_by, updated_by)
  VALUES
    (v_group_a_id, v_version_id, 'Alpha', 1, v_user_id, v_user_id),
    (v_group_b_id, v_version_id, 'Beta', 2, v_user_id, v_user_id),
    (v_group_delete_id, v_version_id, 'Delete me', 3, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_subgroups
    (id, baseline_version_id, group_id, name, sort_order, created_by, updated_by)
  VALUES
    (v_subgroup_keep_id, v_version_id, v_group_b_id,
      'Move me', 2, v_user_id, v_user_id),
    (v_subgroup_delete_id, v_version_id, v_group_a_id,
      'Delete subgroup', 1, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_criteria
    (id, baseline_version_id, group_id, subgroup_id, criterion_code, title,
     requirement_text, sort_order, created_by, updated_by)
  VALUES
    (v_criterion_a_id, v_version_id, v_group_a_id, NULL, 'TC-0001', 'Alpha title', 'Alpha requirement', 2, v_user_id, v_user_id),
    (v_criterion_b_id, v_version_id, v_group_b_id, v_subgroup_keep_id, 'TC-0002',
      'Beta title', 'Beta requirement', 1, v_user_id, v_user_id),
    (v_criterion_delete_id, v_version_id, v_group_delete_id, NULL, 'TC-0003',
      'Delete title', 'Delete requirement', 1, v_user_id, v_user_id),
    (v_criterion_subgroup_delete_id, v_version_id, v_group_a_id,
      v_subgroup_delete_id, 'TC-0004', 'Delete subgroup title',
      'Delete subgroup requirement', 3, v_user_id, v_user_id);
  v_metadata := pg_temp.import_metadata_v2(v_dossier_id, v_version_id, v_revision);
  v_rows := jsonb_build_array(
    jsonb_build_object(
      'row', 2, 'stt', 'I', 'content', 'Beta updated',
      'group_id', v_group_b_id, 'subgroup_id', NULL, 'criterion_id', NULL,
      'criterion_code', NULL),
    jsonb_build_object(
      'row', 3, 'stt', NULL, 'content', 'Beta direct updated',
      'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', v_criterion_b_id,
      'criterion_code', 'TC-0002'),
    jsonb_build_object(
      'row', 4, 'stt', '1', 'content', 'New Beta subgroup',
      'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL,
      'criterion_code', NULL),
    jsonb_build_object(
      'row', 5, 'stt', '', 'content', 'New subgroup criterion',
      'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL,
      'criterion_code', NULL),
    jsonb_build_object(
      'row', 6, 'stt', 'II', 'content', 'Alpha updated',
      'group_id', v_group_a_id, 'subgroup_id', NULL, 'criterion_id', NULL,
      'criterion_code', NULL),
    jsonb_build_object(
      'row', 7, 'stt', '1', 'content', 'Moved subgroup updated',
      'group_id', NULL, 'subgroup_id', v_subgroup_keep_id, 'criterion_id', NULL,
      'criterion_code', NULL),
    jsonb_build_object(
      'row', 8, 'stt', NULL, 'content', 'Alpha subgroup updated',
      'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', v_criterion_a_id,
      'criterion_code', 'TC-0001'),
    jsonb_build_object(
      'row', 9, 'stt', 'III', 'content', 'Created section',
      'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL,
      'criterion_code', NULL),
    jsonb_build_object(
      'row', 10, 'stt', NULL, 'content', 'Created direct criterion',
      'group_id', NULL, 'subgroup_id', NULL, 'criterion_id', NULL,
      'criterion_code', NULL)
  );
  v_before := pg_temp.baseline_tree_snapshot(v_version_id);
  -- stale revision rollback
  PERFORM pg_temp.expect_apply_error_unchanged(
    'stale revision rollback',
    v_version_id,
    pg_temp.import_metadata_v2(v_dossier_id, v_version_id, v_revision - 1),
    v_rows,
    v_revision - 1,
    'PT409',
    'stale_revision'
  );
  -- tampered identity rollback
  PERFORM pg_temp.expect_apply_error_unchanged(
    'tampered identity rollback',
    v_version_id,
    v_metadata,
    jsonb_set(v_rows, '{1,criterion_id}', to_jsonb(gen_random_uuid()::TEXT)),
    v_revision,
    'PT422',
    'validation_error'
  );
  -- validation error rollback
  PERFORM pg_temp.expect_apply_error_unchanged(
    'validation error rollback',
    v_version_id,
    v_metadata,
    jsonb_set(v_rows, '{1,content}', 'null'::JSONB),
    v_revision,
    'PT422',
    'validation_error'
  );
  -- injected failure rollback
  PERFORM set_config('p2b.inject_failure', 'on', true);
  PERFORM pg_temp.expect_apply_error_unchanged(
    'injected failure rollback',
    v_version_id,
    v_metadata,
    v_rows,
    v_revision,
    'P0001',
    'p2b_injected_failure'
  );
  PERFORM set_config('p2b.inject_failure', 'off', true);
  v_after := pg_temp.baseline_tree_snapshot(v_version_id);
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'rejected apply cases changed the fixture tree';
  END IF;
  -- complete hierarchy reconciliation
  SELECT public.technical_configuration_baseline_import_preview_v2(
    v_version_id, v_metadata, v_rows, v_revision
  ) INTO v_preview;
  SELECT public._technical_configuration_baseline_import_apply_v2(
    v_version_id, v_metadata, v_rows, v_revision
  ) INTO v_apply;
  -- deferred constraint commit check
  SET CONSTRAINTS ALL IMMEDIATE;
  -- preview apply parity
  IF v_apply->'preview' IS DISTINCT FROM v_preview->'data' THEN
    RAISE EXCEPTION 'preview/apply parity mismatch';
  END IF;
  IF v_apply->'data'
     IS DISTINCT FROM public._technical_configuration_baseline_snapshot(v_version_id) THEN
    RAISE EXCEPTION 'apply response snapshot mismatch';
  END IF;
  -- expected effect counts
  IF v_preview->'data'->'effects' IS DISTINCT FROM jsonb_build_object(
    'groups', jsonb_build_object('create', 1, 'update', 2, 'move', 2, 'delete', 1),
    'subgroups', jsonb_build_object('create', 1, 'update', 1, 'move', 1, 'delete', 1),
    'criteria', jsonb_build_object('create', 2, 'update', 2, 'move', 2, 'delete', 2)
  ) THEN
    RAISE EXCEPTION 'hierarchy effect counts mismatch: %', v_preview->'data'->'effects';
  END IF;
  -- section hierarchy contract
  IF (SELECT count(*) FROM public.technical_configuration_baseline_groups
      WHERE baseline_version_id = v_version_id) <> 3
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_groups
       WHERE id = v_group_b_id AND name = 'Beta updated' AND sort_order = 1
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_groups
       WHERE id = v_group_a_id AND name = 'Alpha updated' AND sort_order = 2
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_groups
       WHERE baseline_version_id = v_version_id
         AND name = 'Created section' AND sort_order = 3
     ) THEN
    RAISE EXCEPTION 'section hierarchy contract mismatch';
  END IF;
  -- subgroup hierarchy contract; existing subgroup reorder contract
  IF (SELECT count(*) FROM public.technical_configuration_baseline_subgroups
      WHERE baseline_version_id = v_version_id) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_subgroups
       WHERE id = v_subgroup_keep_id AND group_id = v_group_a_id
         AND name = 'Moved subgroup updated' AND sort_order = 1
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.technical_configuration_baseline_subgroups sg
       WHERE sg.group_id = v_group_b_id
         AND sg.name = 'New Beta subgroup' AND sg.sort_order = 1
     ) THEN
    RAISE EXCEPTION 'subgroup hierarchy contract mismatch';
  END IF;
  -- preserves compatible identities and codes; existing criterion reorder contract
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id = v_criterion_a_id
      AND c.criterion_code = 'TC-0001'
      AND c.group_id = v_group_a_id
      AND c.subgroup_id = v_subgroup_keep_id
      AND c.sort_order = 1
      AND c.requirement_text = 'Alpha subgroup updated'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id = v_criterion_b_id
      AND c.criterion_code = 'TC-0002'
      AND c.group_id = v_group_b_id
      AND c.subgroup_id IS NULL
      AND c.requirement_text = 'Beta direct updated'
  ) THEN
    RAISE EXCEPTION 'compatible criterion identities or codes changed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id IN (v_criterion_delete_id, v_criterion_subgroup_delete_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_groups g
    WHERE g.id = v_group_delete_id
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_subgroups sg
    WHERE sg.id = v_subgroup_delete_id
  ) THEN
    RAISE EXCEPTION 'omitted hierarchy entities were not deleted';
  END IF;
  -- advances next criterion only for creates
  -- increments revision exactly once
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.id = v_version_id
      AND v.next_criterion_number = 7
      AND v.revision = v_revision + 1
  ) THEN
    RAISE EXCEPTION 'version counters were not advanced exactly once';
  END IF;
  IF (
    SELECT count(*)
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = v_version_id
      AND c.criterion_code IN ('TC-0005', 'TC-0006')
  ) <> 2 THEN
    RAISE EXCEPTION 'new criterion codes were not allocated sequentially';
  END IF;
  -- new criterion membership contract
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    JOIN public.technical_configuration_baseline_subgroups sg ON sg.id = c.subgroup_id
    WHERE c.baseline_version_id = v_version_id
      AND c.criterion_code = 'TC-0005'
      AND c.group_id = v_group_b_id
      AND c.requirement_text = 'New subgroup criterion'
      AND c.sort_order = 2
      AND sg.name = 'New Beta subgroup'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    JOIN public.technical_configuration_baseline_groups g ON g.id = c.group_id
    WHERE c.baseline_version_id = v_version_id
      AND c.criterion_code = 'TC-0006'
      AND c.subgroup_id IS NULL
      AND c.requirement_text = 'Created direct criterion'
      AND c.sort_order = 1
      AND g.name = 'Created section'
  ) THEN
    RAISE EXCEPTION 'new criterion membership contract mismatch';
  END IF;
  -- empty tree replacement
  v_revision := v_revision + 1;
  v_metadata := pg_temp.import_metadata_v2(v_dossier_id, v_version_id, v_revision);
  SELECT public.technical_configuration_baseline_import_preview_v2(
    v_version_id, v_metadata, '[]'::JSONB, v_revision
  ) INTO v_preview;
  SELECT public._technical_configuration_baseline_import_apply_v2(
    v_version_id, v_metadata, '[]'::JSONB, v_revision
  ) INTO v_apply;
  SET CONSTRAINTS ALL IMMEDIATE;
  IF v_apply->'preview' IS DISTINCT FROM v_preview->'data'
     OR EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_groups
       WHERE baseline_version_id = v_version_id
     )
     OR EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_subgroups
       WHERE baseline_version_id = v_version_id
     )
     OR EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_criteria
       WHERE baseline_version_id = v_version_id
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.technical_configuration_baseline_versions v
       WHERE v.id = v_version_id
         AND v.next_criterion_number = 7
         AND v.revision = v_revision + 1
     ) THEN
    RAISE EXCEPTION 'empty tree replacement contract mismatch';
  END IF;
END;
$gate$;
ROLLBACK;
