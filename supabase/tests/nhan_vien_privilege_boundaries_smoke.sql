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
      AND p.roles = '{anon,authenticated}'
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
