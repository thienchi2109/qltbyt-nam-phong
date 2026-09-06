-- Phase 3.5 cross-layer catalog identity and tenant branding contract.
-- The gate is read-only apart from transaction-local JWT claims.

BEGIN;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_state TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      IF v_state = p_expected_state THEN
        RETURN;
      END IF;
      RAISE EXCEPTION '%: expected SQLSTATE %, got %', p_label, p_expected_state, v_state;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

DO $gate$
DECLARE
  v_catalog_id UUID;
  v_payload JSONB;
  v_user_id BIGINT;
  v_assigned_unit_id BIGINT;
  v_current_unit_id BIGINT;
  v_other_unit_id BIGINT;
  v_branded_id BIGINT;
BEGIN
  SELECT v.id
  INTO v_catalog_id
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
    AND device_quota_internal.catalog_is_complete(v.id);

  ASSERT v_catalog_id IS NOT NULL, 'canonical catalog UUID is required';

  SELECT
    nv.id,
    nv.don_vi,
    nv.current_don_vi
  INTO v_user_id, v_assigned_unit_id, v_current_unit_id
  FROM public.nhan_vien AS nv
  WHERE COALESCE(nv.is_active, true)
    AND nv.role = 'to_qltb'
    AND nv.don_vi IS NOT NULL
  ORDER BY nv.id
  LIMIT 1;

  ASSERT v_user_id IS NOT NULL, 'eligible draft export user is required';
  ASSERT v_assigned_unit_id IS NOT NULL, 'assigned tenant fixture is required';

  SELECT d.id
  INTO v_current_unit_id
  FROM public.don_vi AS d
  WHERE d.id <> v_assigned_unit_id
  ORDER BY d.id
  LIMIT 1;

  ASSERT v_current_unit_id IS NOT NULL, 'switched tenant fixture is required';

  -- Create the switched-unit fixture inside this rollback-only gate instead of
  -- assuming production-derived data already contains one.
  UPDATE public.nhan_vien
  SET current_don_vi = v_current_unit_id
  WHERE id = v_user_id;

  SELECT d.id
  INTO v_other_unit_id
  FROM public.don_vi AS d
  WHERE d.id <> v_current_unit_id
  ORDER BY d.id
  LIMIT 1;

  ASSERT v_other_unit_id IS NOT NULL, 'cross-tenant branding fixture is required';

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'don_vi', v_assigned_unit_id::TEXT,
      'current_don_vi', v_current_unit_id::TEXT
    )::TEXT,
    true
  );

  SELECT public.device_quota_regulatory_catalog_get() INTO v_payload;

  IF v_payload->'catalog_version'->>'id' IS DISTINCT FROM v_catalog_id::TEXT THEN
    RAISE EXCEPTION 'catalog RPC did not return the actual canonical UUID';
  END IF;

  -- A nonmatching current tenant claim must fail actor verification instead of
  -- silently falling back to the assigned tenant claim.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'don_vi', v_assigned_unit_id::TEXT,
      'current_don_vi', v_other_unit_id::TEXT
    )::TEXT,
    true
  );

  PERFORM pg_temp.expect_error(
    'nonmatching current tenant catalog request',
    'SELECT public.device_quota_regulatory_catalog_get()',
    '42501'
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'don_vi', v_assigned_unit_id::TEXT,
      'current_don_vi', v_current_unit_id::TEXT
    )::TEXT,
    true
  );

  PERFORM pg_temp.expect_error(
    'cross-tenant branding request',
    format('SELECT * FROM public.don_vi_branding_get(%s)', v_other_unit_id),
    '42501'
  );

  -- A target role must use current_don_vi ahead of its assigned tenant claim.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'don_vi', v_other_unit_id::TEXT,
      'current_don_vi', v_current_unit_id::TEXT
    )::TEXT,
    true
  );

  PERFORM pg_temp.expect_error(
    'current tenant branding mismatch',
    format('SELECT * FROM public.don_vi_branding_get(%s)', v_other_unit_id),
    '42501'
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'don_vi', v_current_unit_id::TEXT,
      'current_don_vi', v_current_unit_id::TEXT
    )::TEXT,
    true
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.don_vi WHERE id = v_other_unit_id
  ) THEN
    RAISE EXCEPTION 'global branding fixture is missing';
  END IF;

  SELECT b.id
  INTO v_branded_id
  FROM public.don_vi_branding_get(v_other_unit_id) AS b;

  IF v_branded_id IS DISTINCT FROM v_other_unit_id THEN
    RAISE EXCEPTION 'global branding returned the wrong tenant';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'admin',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'don_vi', v_current_unit_id::TEXT,
      'current_don_vi', v_current_unit_id::TEXT
    )::TEXT,
    true
  );

  SELECT b.id
  INTO v_branded_id
  FROM public.don_vi_branding_get(v_other_unit_id) AS b;

  IF v_branded_id IS DISTINCT FROM v_other_unit_id THEN
    RAISE EXCEPTION 'admin branding returned the wrong tenant';
  END IF;
END;
$gate$;

ROLLBACK;
