-- P8A3 rollback-only composite ownership constraint gate.
BEGIN;

CREATE FUNCTION pg_temp.expect_fk_violation(p_label TEXT, p_statement TEXT)
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
      IF v_state IS DISTINCT FROM '23503' THEN
        RAISE EXCEPTION '%: expected [23503], got [%] %',
          p_label, v_state, v_message;
      END IF;
      RETURN;
  END;

  RAISE EXCEPTION '%: expected foreign key violation', p_label;
END;
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_other_dossier_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid();
  v_other_supplier_id UUID := gen_random_uuid();
  v_option_id UUID := gen_random_uuid();
  v_other_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_other_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_other_group_id UUID := gen_random_uuid();
  v_criterion_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid();
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_option_responses_constraints_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P8A3 constraints gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, created_by, updated_by
  )
  VALUES
    (
      v_dossier_id,
      'P8A3 constraints device ' || v_suffix,
      'P8A3 constraints dossier ' || v_suffix,
      v_user_id,
      v_user_id
    ),
    (
      v_other_dossier_id,
      'P8A3 constraints other device ' || v_suffix,
      'P8A3 constraints other dossier ' || v_suffix,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  )
  VALUES
    (
      v_supplier_id,
      v_dossier_id,
      'P8A3 Constraints Supplier',
      v_user_id,
      v_user_id
    ),
    (
      v_other_supplier_id,
      v_other_dossier_id,
      'P8A3 Constraints Other Supplier',
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  )
  VALUES
    (
      v_option_id,
      v_dossier_id,
      v_supplier_id,
      'P8A3 Constraints Option',
      v_user_id,
      v_user_id
    ),
    (
      v_other_option_id,
      v_other_dossier_id,
      v_other_supplier_id,
      'P8A3 Constraints Other Option',
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  )
  VALUES
    (
      v_version_id,
      v_dossier_id,
      1,
      'locked',
      2,
      1,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      v_other_version_id,
      v_other_dossier_id,
      1,
      'locked',
      2,
      1,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES
    (v_group_id, v_version_id, 'P8A3 Constraints Group', 1, v_user_id, v_user_id),
    (
      v_other_group_id,
      v_other_version_id,
      'P8A3 Constraints Other Group',
      1,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  )
  VALUES
    (
      v_criterion_id,
      v_version_id,
      v_group_id,
      'TC-0001',
      'P8A3 constraints criterion',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_other_criterion_id,
      v_other_version_id,
      v_other_group_id,
      'TC-0001',
      'P8A3 constraints other criterion',
      1,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  )
  VALUES (
    v_set_id,
    v_dossier_id,
    v_option_id,
    v_version_id,
    v_user_id,
    v_user_id
  );

  PERFORM pg_temp.expect_fk_violation(
    'comparison set option ownership FK enforced',
    format(
      'INSERT INTO public.technical_configuration_comparison_sets '
      || '(dossier_id, option_id, baseline_version_id, created_by, updated_by) '
      || 'VALUES (%L::UUID, %L::UUID, %L::UUID, %s, %s)',
      v_other_dossier_id,
      v_option_id,
      v_other_version_id,
      v_user_id,
      v_user_id
    )
  );

  PERFORM pg_temp.expect_fk_violation(
    'comparison set baseline ownership FK enforced',
    format(
      'INSERT INTO public.technical_configuration_comparison_sets '
      || '(dossier_id, option_id, baseline_version_id, created_by, updated_by) '
      || 'VALUES (%L::UUID, %L::UUID, %L::UUID, %s, %s)',
      v_dossier_id,
      v_option_id,
      v_other_version_id,
      v_user_id,
      v_user_id
    )
  );

  PERFORM pg_temp.expect_fk_violation(
    'response comparison set ownership FK enforced',
    format(
      'INSERT INTO public.technical_configuration_option_responses '
      || '(comparison_set_id, baseline_version_id, criterion_id, created_by, updated_by) '
      || 'VALUES (%L::UUID, %L::UUID, %L::UUID, %s, %s)',
      v_set_id,
      v_other_version_id,
      v_other_criterion_id,
      v_user_id,
      v_user_id
    )
  );

  PERFORM pg_temp.expect_fk_violation(
    'response criterion ownership FK enforced',
    format(
      'INSERT INTO public.technical_configuration_option_responses '
      || '(comparison_set_id, baseline_version_id, criterion_id, created_by, updated_by) '
      || 'VALUES (%L::UUID, %L::UUID, %L::UUID, %s, %s)',
      v_set_id,
      v_version_id,
      v_other_criterion_id,
      v_user_id,
      v_user_id
    )
  );
END;
$gate$;

ROLLBACK;
