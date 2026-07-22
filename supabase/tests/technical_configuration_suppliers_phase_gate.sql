-- supabase/tests/technical_configuration_suppliers_phase_gate.sql
-- Purpose: prove P8A1 authorization, normalization, revision, and ownership invariants.
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

      IF v_state IS DISTINCT FROM p_expected_state
         OR v_message IS DISTINCT FROM p_expected_message THEN
        RAISE EXCEPTION
          '%: expected [%] %, got [%] %',
          p_label,
          p_expected_state,
          p_expected_message,
          v_state,
          v_message;
      END IF;
      RETURN;
  END;

  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

CREATE FUNCTION pg_temp.set_claims(
  p_app_role TEXT,
  p_user_id BIGINT
)
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
  v_archived_dossier_id UUID;
  v_cascade_dossier_id UUID;
  v_supplier_id UUID;
  v_cascade_supplier_id UUID;
  v_revision BIGINT;
  v_cascade_revision BIGINT;
  v_response JSONB;
  v_count BIGINT;
  v_rls_enabled BOOLEAN;
  v_function_signature TEXT;
  v_table_privilege TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('technical_configuration_suppliers_phase_gate'));

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P8A1 phase gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name,
    name,
    description,
    created_by,
    updated_by
  )
  VALUES (
    'P8A1 device ' || v_suffix,
    'P8A1 dossier ' || v_suffix,
    'Supplier phase-gate fixture',
    v_user_id,
    v_user_id
  )
  RETURNING id, revision INTO v_dossier_id, v_revision;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name,
    name,
    description,
    archived_at,
    archived_by,
    created_by,
    updated_by
  )
  VALUES (
    'P8A1 archived device ' || v_suffix,
    'P8A1 archived dossier ' || v_suffix,
    'Archived supplier fixture',
    now(),
    v_user_id,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_archived_dossier_id;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name,
    name,
    description,
    created_by,
    updated_by
  )
  VALUES (
    'P8A1 cascade device ' || v_suffix,
    'P8A1 cascade dossier ' || v_suffix,
    'ON DELETE CASCADE fixture',
    v_user_id,
    v_user_id
  )
  RETURNING id, revision INTO v_cascade_dossier_id, v_cascade_revision;

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims fail closed',
    format(
      'SELECT public.technical_configuration_suppliers_list(%L::UUID, 1, 50)',
      v_dossier_id
    ),
    '42501',
    'permission_denied'
  );

  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role denied',
    format(
      'SELECT public.technical_configuration_suppliers_list(%L::UUID, 1, 50)',
      v_dossier_id
    ),
    '42501',
    'permission_denied'
  );

  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_response := public.technical_configuration_suppliers_list(v_dossier_id, 1, 50);
  IF v_response->>'revision' IS DISTINCT FROM v_revision::TEXT
     OR v_response->>'total' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'raw admin must read the empty supplier collection';
  END IF;

  PERFORM pg_temp.set_claims('global', v_user_id);
  -- boundary whitespace canonicalization
  v_response := public.technical_configuration_supplier_create(
    v_dossier_id,
    E'\tCông ty \n Thiết bị A\t',
    v_revision
  );
  v_supplier_id := (v_response #>> '{data,id}')::UUID;
  v_revision := (v_response #>> '{data,revision}')::BIGINT;

  IF v_response #>> '{data,name}' IS DISTINCT FROM 'Công ty Thiết bị A'
     OR v_response #>> '{data,normalized_name}' IS DISTINCT FROM 'công ty thiết bị a' THEN
    RAISE EXCEPTION 'supplier create must preserve canonical name and normalized identity';
  END IF;

  PERFORM pg_temp.expect_error(
    'all-whitespace supplier rejected',
    format(
      'SELECT public.technical_configuration_supplier_create(%L::UUID, %L, %s)',
      v_dossier_id,
      E'\n\t',
      v_revision
    ),
    'PT422',
    'validation_error'
  );

  PERFORM pg_temp.expect_error(
    'normalized duplicate rejected',
    format(
      'SELECT public.technical_configuration_supplier_create(%L::UUID, %L, %s)',
      v_dossier_id,
      'cÔnG Ty Thiết Bị A',
      v_revision
    ),
    'PT409',
    'duplicate_supplier'
  );

  v_response := public.technical_configuration_supplier_create(
    v_cascade_dossier_id,
    'CÔNG TY THIẾT BỊ A',
    v_cascade_revision
  );
  v_cascade_supplier_id := (v_response #>> '{data,id}')::UUID;

  PERFORM pg_temp.expect_error(
    'stale revision rejected',
    format(
      'SELECT public.technical_configuration_supplier_update(%L::UUID, %L, %s)',
      v_supplier_id,
      'Nhà cung cấp A',
      v_revision - 1
    ),
    'PT409',
    'stale_revision'
  );

  v_response := public.technical_configuration_supplier_update(
    v_supplier_id,
    'Nhà cung cấp A',
    v_revision
  );
  v_revision := (v_response #>> '{data,revision}')::BIGINT;

  v_response := public.technical_configuration_suppliers_list(v_dossier_id, 1, 50);
  IF v_response->>'revision' IS DISTINCT FROM v_revision::TEXT
     OR v_response->>'total' IS DISTINCT FROM '1'
     OR v_response #>> '{data,0,name}' IS DISTINCT FROM 'Nhà cung cấp A' THEN
    RAISE EXCEPTION 'supplier list must return the dossier revision and canonical row';
  END IF;

  PERFORM pg_temp.expect_error(
    'archived dossier rejects mutation',
    format(
      'SELECT public.technical_configuration_supplier_create(%L::UUID, %L, 1)',
      v_archived_dossier_id,
      'Archived supplier'
    ),
    'PT409',
    'archived_dossier'
  );

  DELETE FROM public.technical_configuration_dossiers
  WHERE id = v_cascade_dossier_id;

  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_suppliers s
  WHERE s.id = v_cascade_supplier_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'dossier delete must cascade to suppliers';
  END IF;

  v_response := public.technical_configuration_supplier_delete(
    v_supplier_id,
    v_revision
  );
  v_revision := (v_response #>> '{data,revision}')::BIGINT;

  IF v_response #>> '{data,id}' IS DISTINCT FROM v_supplier_id::TEXT THEN
    RAISE EXCEPTION 'supplier delete must return the deleted supplier id';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_suppliers s
  WHERE s.dossier_id = v_dossier_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'supplier delete must remove the owned row';
  END IF;

  SELECT c.relrowsecurity
  INTO v_rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'technical_configuration_suppliers';

  IF v_rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'supplier table must have RLS enabled';
  END IF;

  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.technical_configuration_suppliers_list(UUID, INTEGER, INTEGER)',
    'public.technical_configuration_supplier_create(UUID, TEXT, BIGINT)',
    'public.technical_configuration_supplier_update(UUID, TEXT, BIGINT)',
    'public.technical_configuration_supplier_delete(UUID, BIGINT)'
  ]
  LOOP
    IF NOT has_function_privilege(
      'authenticated',
      v_function_signature,
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'authenticated must execute %', v_function_signature;
    END IF;

    IF NOT has_function_privilege(
      'service_role',
      v_function_signature,
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'service_role must execute %', v_function_signature;
    END IF;

    -- anon includes any privilege inherited from PUBLIC.
    IF has_function_privilege('anon', v_function_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon/PUBLIC must not execute %', v_function_signature;
    END IF;
  END LOOP;

  FOREACH v_table_privilege IN ARRAY ARRAY[
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  ]
  LOOP
    IF has_table_privilege(
      'authenticated',
      'public.technical_configuration_suppliers',
      v_table_privilege
    ) THEN
      RAISE EXCEPTION 'authenticated must not have table privilege %', v_table_privilege;
    END IF;

    IF has_table_privilege(
      'anon',
      'public.technical_configuration_suppliers',
      v_table_privilege
    ) THEN
      RAISE EXCEPTION 'anon/PUBLIC must not have table privilege %', v_table_privilege;
    END IF;

    IF NOT has_table_privilege(
      'service_role',
      'public.technical_configuration_suppliers',
      v_table_privilege
    ) THEN
      RAISE EXCEPTION 'service_role must have table privilege %', v_table_privilege;
    END IF;
  END LOOP;
END;
$gate$;

ROLLBACK;
