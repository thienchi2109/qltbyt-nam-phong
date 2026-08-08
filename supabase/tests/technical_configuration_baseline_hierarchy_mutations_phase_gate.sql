-- P1E phase gate. All fixture writes and hierarchy mutations are rolled back.
BEGIN;

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
  v_dossier_id UUID := gen_random_uuid();
  v_locked_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_locked_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_foreign_group_id UUID := gen_random_uuid();
  v_locked_group_id UUID := gen_random_uuid();
  v_foreign_subgroup_id UUID := gen_random_uuid();
  v_existing_direct_id UUID := gen_random_uuid();
  v_subgroup_a_id UUID;
  v_subgroup_b_id UUID;
  v_empty_subgroup_id UUID;
  v_direct_move_id UUID;
  v_subgroup_a_criterion_id UUID;
  v_subgroup_b_criterion_1_id UUID;
  v_subgroup_b_criterion_2_id UUID;
  v_direct_move_code TEXT;
  v_subgroup_a_code TEXT;
  v_legacy_direct_id UUID; v_reference_product_id UUID := gen_random_uuid();
  v_reference_response_id UUID := gen_random_uuid();
  v_response JSONB;
  v_revision BIGINT := 1;
  v_ids UUID[];
  v_count BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_hierarchy_mutations_phase_gate')
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
      'P1E hierarchy device ' || v_suffix,
      'P1E hierarchy dossier ' || v_suffix,
      'Rolled back after verification',
      v_user_id,
      v_user_id
    ),
    (
      v_locked_dossier_id,
      'P1E locked device ' || v_suffix,
      'P1E locked dossier ' || v_suffix,
      'Rolled back after verification',
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_versions
    (id, dossier_id, version_number, status, next_criterion_number, revision,
     locked_at, locked_by, created_by, updated_by)
  VALUES
    (
      v_version_id,
      v_dossier_id,
      1,
      'draft',
      2,
      1,
      NULL,
      NULL,
      v_user_id,
      v_user_id
    ),
    (
      v_locked_version_id,
      v_locked_dossier_id,
      1,
      'locked',
      1,
      1,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_groups
    (id, baseline_version_id, name, sort_order, created_by, updated_by)
  VALUES
    (v_group_id, v_version_id, 'Main section', 1, v_user_id, v_user_id),
    (v_foreign_group_id, v_version_id, 'Foreign section', 2, v_user_id, v_user_id),
    (
      v_locked_group_id,
      v_locked_version_id,
      'Locked section',
      1,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_subgroups
    (id, baseline_version_id, group_id, name, sort_order, created_by, updated_by)
  VALUES (
    v_foreign_subgroup_id,
    v_version_id,
    v_foreign_group_id,
    'Foreign subgroup',
    1,
    v_user_id,
    v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_criteria
    (id, baseline_version_id, group_id, subgroup_id, criterion_code,
     requirement_text, sort_order, created_by, updated_by)
  VALUES (
    v_existing_direct_id,
    v_version_id,
    v_group_id,
    NULL,
    'TC-0001',
    'Existing direct criterion',
    1,
    v_user_id,
    v_user_id
  );
  v_response := public.technical_configuration_baseline_subgroup_create(
    v_group_id, 'Subgroup A', v_revision
  );
  v_subgroup_a_id := (v_response#>>'{data,id}')::UUID;
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  v_response := public.technical_configuration_baseline_subgroup_create(
    v_group_id, 'Subgroup B', v_revision
  );
  v_subgroup_b_id := (v_response#>>'{data,id}')::UUID;
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  v_response := public.technical_configuration_baseline_subgroup_create(
    v_group_id, 'Empty subgroup', v_revision
  );
  v_empty_subgroup_id := (v_response#>>'{data,id}')::UUID;
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  v_response := public.technical_configuration_baseline_hierarchy_criterion_create(
    v_group_id, NULL, NULL, 'Direct criterion to move', v_revision
  );
  v_direct_move_id := (v_response#>>'{data,id}')::UUID;
  v_direct_move_code := v_response#>>'{data,criterion_code}';
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  v_response := public.technical_configuration_baseline_hierarchy_criterion_create(
    v_group_id, v_subgroup_a_id, NULL, 'Subgroup A criterion', v_revision
  );
  v_subgroup_a_criterion_id := (v_response#>>'{data,id}')::UUID;
  v_subgroup_a_code := v_response#>>'{data,criterion_code}';
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  v_response := public.technical_configuration_baseline_hierarchy_criterion_create(
    v_group_id, v_subgroup_b_id, NULL, 'Subgroup B criterion 1', v_revision
  );
  v_subgroup_b_criterion_1_id := (v_response#>>'{data,id}')::UUID;
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  v_response := public.technical_configuration_baseline_hierarchy_criterion_create(
    v_group_id, v_subgroup_b_id, NULL, 'Subgroup B criterion 2', v_revision
  );
  v_subgroup_b_criterion_2_id := (v_response#>>'{data,id}')::UUID;
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  INSERT INTO public.technical_configuration_reference_products
    (id, baseline_version_id, model, created_by, updated_by)
  VALUES (v_reference_product_id, v_version_id, 'P1E linked model', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_reference_responses
    (id, baseline_version_id, reference_product_id, criterion_id, created_by, updated_by)
  VALUES (v_reference_response_id, v_version_id, v_reference_product_id,
          v_subgroup_a_criterion_id, v_user_id, v_user_id);

  v_response := public.technical_configuration_baseline_hierarchy_criterion_move(
    v_direct_move_id, v_group_id, v_subgroup_b_id, v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;
  IF (v_response#>>'{data,id}')::UUID <> v_direct_move_id
     OR v_response#>>'{data,criterion_code}' <> v_direct_move_code THEN
    RAISE EXCEPTION 'criterion move identity failed';
  END IF;

  PERFORM public.technical_configuration_baseline_hierarchy_criteria_reorder(
    v_group_id,
    v_subgroup_b_id,
    ARRAY[
      v_direct_move_id,
      v_subgroup_b_criterion_2_id,
      v_subgroup_b_criterion_1_id
    ],
    v_revision
  );
  v_revision := v_revision + 1;

  PERFORM public.technical_configuration_baseline_subgroups_reorder(
    v_group_id,
    ARRAY[v_subgroup_b_id, v_subgroup_a_id, v_empty_subgroup_id],
    v_revision
  );
  v_revision := v_revision + 1;

  SELECT array_agg(s.id ORDER BY s.sort_order, s.id) INTO v_ids
  FROM public.technical_configuration_baseline_subgroups s
  WHERE s.group_id = v_group_id;
  IF v_ids IS DISTINCT FROM
     ARRAY[v_subgroup_b_id, v_subgroup_a_id, v_empty_subgroup_id] THEN
    RAISE EXCEPTION 'subgroup reorder block failed';
  END IF;

  SELECT array_agg(c.id ORDER BY c.sort_order, c.id) INTO v_ids
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.group_id = v_group_id;
  IF v_ids IS DISTINCT FROM ARRAY[
    v_existing_direct_id,
    v_direct_move_id,
    v_subgroup_b_criterion_2_id,
    v_subgroup_b_criterion_1_id,
    v_subgroup_a_criterion_id
  ] THEN
    RAISE EXCEPTION 'canonical hierarchy mutation ordering failed';
  END IF;
  v_response := public.technical_configuration_baseline_criterion_create(
    v_group_id, NULL, 'Legacy direct criterion', v_revision
  );
  v_legacy_direct_id := (v_response#>>'{data,id}')::UUID;
  v_revision := (v_response#>>'{data,revision}')::BIGINT;
  PERFORM public.technical_configuration_baseline_criteria_reorder(
    v_group_id,
    ARRAY[
      v_subgroup_a_criterion_id, v_subgroup_b_criterion_1_id,
      v_legacy_direct_id, v_direct_move_id,
      v_subgroup_b_criterion_2_id, v_existing_direct_id
    ],
    v_revision
  );
  v_revision := v_revision + 1;
  SELECT array_agg(c.id ORDER BY c.sort_order, c.id) INTO v_ids
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.group_id = v_group_id;
  IF v_ids IS DISTINCT FROM ARRAY[
    v_legacy_direct_id, v_existing_direct_id,
    v_subgroup_b_criterion_1_id, v_direct_move_id,
    v_subgroup_b_criterion_2_id, v_subgroup_a_criterion_id
  ] THEN
    RAISE EXCEPTION 'legacy hierarchy canonical ordering failed';
  END IF;

  v_response := public.technical_configuration_baseline_subgroup_update(
    v_subgroup_a_id, 'Subgroup A renamed', v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  BEGIN
    PERFORM public.technical_configuration_baseline_subgroup_delete(
      v_subgroup_a_id, v_revision
    );
    RAISE EXCEPTION 'subgroup delete atomic rejection failed';
  EXCEPTION
    WHEN SQLSTATE 'PT409' THEN
      IF SQLERRM <> 'subgroup_not_empty' THEN
        RAISE;
      END IF;
  END;
  IF (SELECT revision FROM public.technical_configuration_baseline_versions
      WHERE id = v_version_id) <> v_revision
     OR NOT EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_subgroups
       WHERE id = v_subgroup_a_id
     ) THEN
    RAISE EXCEPTION 'subgroup delete atomic rejection failed';
  END IF;

  BEGIN
    PERFORM public.technical_configuration_baseline_hierarchy_criteria_reorder(
      v_group_id,
      v_subgroup_b_id,
      ARRAY[v_direct_move_id, v_direct_move_id, v_subgroup_b_criterion_1_id],
      v_revision
    );
    RAISE EXCEPTION 'partial reorder atomic rejection failed';
  EXCEPTION
    WHEN SQLSTATE 'PT422' THEN NULL;
  END;
  IF (SELECT revision FROM public.technical_configuration_baseline_versions
      WHERE id = v_version_id) <> v_revision THEN
    RAISE EXCEPTION 'partial reorder atomic rejection failed';
  END IF;

  BEGIN
    PERFORM public.technical_configuration_baseline_hierarchy_criterion_move(
      v_subgroup_a_criterion_id,
      v_group_id,
      v_foreign_subgroup_id,
      v_revision
    );
    RAISE EXCEPTION 'foreign scope atomic rejection failed';
  EXCEPTION
    WHEN SQLSTATE 'PT422' THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_criteria
    WHERE id = v_subgroup_a_criterion_id
      AND subgroup_id <> v_subgroup_a_id
  ) THEN
    RAISE EXCEPTION 'foreign scope atomic rejection failed';
  END IF;

  BEGIN
    PERFORM public.technical_configuration_baseline_subgroup_create(
      v_subgroup_b_id, 'Unsupported depth', v_revision
    );
    RAISE EXCEPTION 'unsupported depth atomic rejection failed';
  EXCEPTION
    WHEN SQLSTATE 'PT422' THEN
      IF SQLERRM <> 'unsupported_hierarchy_depth' THEN
        RAISE;
      END IF;
  END;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_baseline_subgroups
  WHERE baseline_version_id = v_version_id;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'unsupported depth atomic rejection failed';
  END IF;

  BEGIN
    PERFORM public.technical_configuration_baseline_subgroup_update(
      v_subgroup_b_id, 'Stale rename', v_revision - 1
    );
    RAISE EXCEPTION 'stale revision atomic rejection failed';
  EXCEPTION
    WHEN SQLSTATE 'PT409' THEN
      IF SQLERRM <> 'stale_revision' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.technical_configuration_baseline_subgroup_create(
      v_locked_group_id, 'Locked subgroup', 1
    );
    RAISE EXCEPTION 'locked version atomic rejection failed';
  EXCEPTION
    WHEN SQLSTATE 'PT409' THEN
      IF SQLERRM <> 'locked_version' THEN
        RAISE;
      END IF;
  END;

  v_response := public.technical_configuration_baseline_hierarchy_criterion_move(
    v_subgroup_a_criterion_id, v_group_id, v_subgroup_b_id, v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;
  v_response := public.technical_configuration_baseline_hierarchy_criterion_move(
    v_subgroup_a_criterion_id, v_group_id, NULL, v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;
  IF (v_response#>>'{data,id}')::UUID <> v_subgroup_a_criterion_id
     OR v_response#>>'{data,criterion_code}' <> v_subgroup_a_code
     OR v_response#>>'{data,subgroup_id}' IS NOT NULL THEN
    RAISE EXCEPTION 'criterion move identity failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_reference_responses
    WHERE id = v_reference_response_id
      AND criterion_id = v_subgroup_a_criterion_id
  ) THEN
    RAISE EXCEPTION 'linked criterion records changed during move';
  END IF;

  PERFORM public.technical_configuration_baseline_hierarchy_criteria_reorder(
    v_group_id,
    NULL,
    ARRAY[v_subgroup_a_criterion_id, v_existing_direct_id, v_legacy_direct_id],
    v_revision
  );
  v_revision := v_revision + 1;
  SELECT array_agg(c.id ORDER BY c.sort_order, c.id) INTO v_ids
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.group_id = v_group_id
    AND c.subgroup_id IS NULL;
  IF v_ids IS DISTINCT FROM ARRAY[
    v_subgroup_a_criterion_id, v_existing_direct_id, v_legacy_direct_id
  ] THEN
    RAISE EXCEPTION 'direct criterion partition reorder failed';
  END IF;

  v_response := public.technical_configuration_baseline_subgroup_delete(
    v_subgroup_a_id, v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;
  v_response := public.technical_configuration_baseline_subgroup_delete(
    v_empty_subgroup_id, v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;

  UPDATE public.technical_configuration_baseline_versions
  SET next_criterion_number = 10000
  WHERE id = v_version_id;
  v_response := public.technical_configuration_baseline_hierarchy_criterion_create(
    v_group_id, NULL, NULL, 'Wide criterion code', v_revision
  );
  v_revision := (v_response#>>'{data,revision}')::BIGINT;
  IF v_response#>>'{data,criterion_code}' <> 'TC-10000' THEN
    RAISE EXCEPTION 'criterion code width failed';
  END IF;

  IF (SELECT revision FROM public.technical_configuration_baseline_versions
      WHERE id = v_version_id) <> v_revision
     OR EXISTS (
       SELECT 1 FROM public.technical_configuration_baseline_subgroups
       WHERE id IN (v_subgroup_a_id, v_empty_subgroup_id)
     ) THEN
    RAISE EXCEPTION 'subgroup delete final state failed';
  END IF;
END;
$gate$;

SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
