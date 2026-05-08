-- Smoke test for Issue #405.
-- Expected to fail before applying the nhan_vien privilege/RLS hardening migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'nhan_vien'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'public.nhan_vien must have RLS enabled';
  END IF;
END $$;

DO $$
DECLARE
  v_role TEXT;
  v_privilege TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(v_role, 'public.nhan_vien', v_privilege) THEN
        RAISE EXCEPTION '% must not have % on public.nhan_vien', v_role, v_privilege;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  v_anon_exposed_functions TEXT[];
BEGIN
  SELECT COALESCE(array_agg(p.proname ORDER BY p.proname), ARRAY[]::TEXT[])
  INTO v_anon_exposed_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY[
      'user_create',
      'create_user',
      'update_user_info',
      'user_list_for_admin',
      'user_update_profile',
      'user_delete_by_admin',
      'user_set_current_don_vi',
      'reset_password_by_admin'
    ])
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF array_length(v_anon_exposed_functions, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'anon must not execute user-management RPCs: %', v_anon_exposed_functions;
  END IF;
END $$;

DO $$
DECLARE
  v_missing_deny_policies TEXT[];
BEGIN
  SELECT array_agg(required_policy ORDER BY required_policy)
  INTO v_missing_deny_policies
  FROM unnest(ARRAY[
    'nhan_vien_deny_select',
    'nhan_vien_deny_insert',
    'nhan_vien_deny_update',
    'nhan_vien_deny_delete'
  ]) AS required_policy
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'nhan_vien'
      AND p.policyname = required_policy
      AND p.roles @> ARRAY['anon', 'authenticated']::NAME[]
      AND p.roles <@ ARRAY['anon', 'authenticated']::NAME[]
      AND (
        (p.cmd IN ('SELECT', 'DELETE') AND p.qual = 'false')
        OR (p.cmd = 'INSERT' AND p.with_check = 'false')
        OR (p.cmd = 'UPDATE' AND p.qual = 'false' AND p.with_check = 'false')
      )
  );

  IF array_length(v_missing_deny_policies, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'explicit deny-all RLS policies are missing or not fail-closed: %', v_missing_deny_policies;
  END IF;
END $$;

DO $$
DECLARE
  v_missing_functions TEXT[];
BEGIN
  SELECT array_agg(required_name ORDER BY required_name)
  INTO v_missing_functions
  FROM unnest(ARRAY[
    'user_create',
    'user_list_for_admin',
    'user_update_profile',
    'user_delete_by_admin',
    'user_set_current_don_vi',
    'reset_password_by_admin'
  ]) AS required_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = required_name
  );

  IF array_length(v_missing_functions, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'required user-management RPCs are missing: %', v_missing_functions;
  END IF;
END $$;

DO $$
DECLARE
  v_missing_search_path TEXT[];
BEGIN
  SELECT COALESCE(array_agg(p.proname ORDER BY p.proname), ARRAY[]::TEXT[])
  INTO v_missing_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY[
      'user_create',
      'create_user',
      'update_user_info',
      'user_list_for_admin',
      'user_update_profile',
      'user_delete_by_admin',
      'user_set_current_don_vi',
      'reset_password_by_admin'
    ])
    AND (
      NOT p.prosecdef
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS cfg
        WHERE cfg = ANY (ARRAY[
          'search_path=public, pg_temp',
          'search_path=public, extensions, pg_temp'
        ])
      )
    );

  IF array_length(v_missing_search_path, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'user-management RPCs must be SECURITY DEFINER with fixed search_path: %', v_missing_search_path;
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id BIGINT;
  v_created_id INTEGER;
BEGIN
  BEGIN
    INSERT INTO public.don_vi(name, active)
    VALUES ('Issue 405 non-admin create smoke tenant', TRUE)
    RETURNING id INTO v_tenant_id;

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'app_role', 'user',
        'role', 'user',
        'user_id', -405001,
        'don_vi', v_tenant_id
      )::TEXT,
      TRUE
    );

    v_created_id := public.user_create(
      'issue405_non_admin_create_smoke',
      'temporary-password',
      'Issue 405 Non Admin Create Smoke',
      'user',
      v_tenant_id,
      NULL
    );

    RAISE EXCEPTION 'user_create allowed non-admin role to create user id %', v_created_id;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN raise_exception THEN
      RAISE;
  END;
END $$;

DO $$
DECLARE
  v_tenant_a BIGINT;
  v_tenant_b BIGINT;
  v_user_id BIGINT;
BEGIN
  BEGIN
    INSERT INTO public.don_vi(name, active)
    VALUES ('Issue 405 switch smoke tenant A', TRUE)
    RETURNING id INTO v_tenant_a;

    INSERT INTO public.don_vi(name, active)
    VALUES ('Issue 405 switch smoke tenant B', TRUE)
    RETURNING id INTO v_tenant_b;

    INSERT INTO public.nhan_vien(
      username,
      password,
      hashed_password,
      full_name,
      role,
      don_vi,
      current_don_vi
    )
    VALUES (
      'issue405_switch_user_smoke',
      'hashed password',
      extensions.crypt('temporary-password', extensions.gen_salt('bf', 12)),
      'Issue 405 Switch User Smoke',
      'user',
      v_tenant_a,
      v_tenant_a
    )
    RETURNING id INTO v_user_id;

    INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
    VALUES (v_user_id, v_tenant_a), (v_user_id, v_tenant_b);

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'app_role', 'user',
        'role', 'user',
        'user_id', v_user_id,
        'don_vi', v_tenant_a
      )::TEXT,
      TRUE
    );

    PERFORM public.user_set_current_don_vi(v_user_id::INTEGER, v_tenant_b);

    IF NOT EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_user_id
        AND nv.current_don_vi = v_tenant_b
    ) THEN
      RAISE EXCEPTION 'user_set_current_don_vi must switch to an allowed membership tenant';
    END IF;

    RAISE EXCEPTION 'rollback tenant switch smoke';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'rollback tenant switch smoke' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;
END $$;

DO $$
DECLARE
  v_tenant_id BIGINT;
  v_user_id BIGINT;
  v_other_user_id BIGINT;
BEGIN
  BEGIN
    INSERT INTO public.don_vi(name, active)
    VALUES ('Issue 405 switch mismatch smoke tenant', TRUE)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.nhan_vien(username, password, hashed_password, full_name, role, don_vi, current_don_vi)
    VALUES (
      'issue405_switch_claim_user_smoke',
      'hashed password',
      extensions.crypt('temporary-password', extensions.gen_salt('bf', 12)),
      'Issue 405 Switch Claim User Smoke',
      'user',
      v_tenant_id,
      v_tenant_id
    )
    RETURNING id INTO v_user_id;

    INSERT INTO public.nhan_vien(username, password, hashed_password, full_name, role, don_vi, current_don_vi)
    VALUES (
      'issue405_switch_other_user_smoke',
      'hashed password',
      extensions.crypt('temporary-password', extensions.gen_salt('bf', 12)),
      'Issue 405 Switch Other User Smoke',
      'user',
      v_tenant_id,
      v_tenant_id
    )
    RETURNING id INTO v_other_user_id;

    INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
    VALUES (v_user_id, v_tenant_id), (v_other_user_id, v_tenant_id);

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'app_role', 'user',
        'role', 'user',
        'user_id', v_user_id,
        'don_vi', v_tenant_id
      )::TEXT,
      TRUE
    );

    PERFORM public.user_set_current_don_vi(v_other_user_id::INTEGER, v_tenant_id);

    RAISE EXCEPTION 'user_set_current_don_vi allowed claim user to switch another user';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN raise_exception THEN
      RAISE;
  END;
END $$;

DO $$
DECLARE
  v_tenant_id BIGINT;
  v_admin_id BIGINT;
  v_created_id INTEGER;
  v_username TEXT := 'issue405_audit_create_smoke';
BEGIN
  BEGIN
    INSERT INTO public.don_vi(name, active)
    VALUES ('Issue 405 audit create smoke tenant', TRUE)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.nhan_vien(
      username,
      password,
      hashed_password,
      full_name,
      role,
      don_vi,
      current_don_vi
    )
    VALUES (
      'issue405_audit_admin_smoke',
      'hashed password',
      extensions.crypt('temporary-admin-password', extensions.gen_salt('bf', 12)),
      'Issue 405 Audit Admin Smoke',
      'global',
      v_tenant_id,
      v_tenant_id
    )
    RETURNING id INTO v_admin_id;

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'app_role', 'global',
        'role', 'global',
        'user_id', v_admin_id,
        'don_vi', v_tenant_id
      )::TEXT,
      TRUE
    );

    v_created_id := public.user_create(
      v_username,
      'temporary-password',
      'Issue 405 Audit Create Smoke',
      'user',
      v_tenant_id,
      NULL
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.audit_logs al
      WHERE al.admin_user_id = v_admin_id
        AND al.action_type = 'USER_CREATE'
        AND al.target_user_id = v_created_id
        AND al.target_username = v_username
        AND al.entity_type = 'nhan_vien'
        AND al.entity_id = v_created_id
    ) THEN
      RAISE EXCEPTION 'user_create must write a USER_CREATE audit log';
    END IF;

    RAISE EXCEPTION 'rollback user_create audit smoke';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'rollback user_create audit smoke' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;
END $$;
