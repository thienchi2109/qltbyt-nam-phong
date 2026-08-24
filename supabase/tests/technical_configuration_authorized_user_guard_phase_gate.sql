-- OpenSpec add-technical-configuration-expert-role, Phase 11:
-- prove the canonical module guard, compatibility wrapper, and transitive RPC graph.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'assertion_failed: %', p_label;
  END IF;
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

CREATE FUNCTION pg_temp.expect_permission_denied(
  p_label TEXT,
  p_app_role TEXT,
  p_user_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_message TEXT;
BEGIN
  PERFORM pg_temp.set_claims(p_app_role, p_user_id);

  BEGIN
    PERFORM public._technical_configuration_require_authorized_user();
    RAISE EXCEPTION 'expected_permission_denied: %', p_label;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message <> 'permission_denied' THEN
        RAISE EXCEPTION '% returned unexpected message %', p_label, v_message;
      END IF;
  END;
END;
$gate$;

CREATE FUNCTION pg_temp.expect_current_claims_permission_denied(p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_message TEXT;
BEGIN
  BEGIN
    PERFORM public._technical_configuration_require_authorized_user();
    RAISE EXCEPTION 'expected_permission_denied: %', p_label;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message <> 'permission_denied' THEN
        RAISE EXCEPTION '% returned unexpected message %', p_label, v_message;
      END IF;
  END;
END;
$gate$;

DO $gate$
DECLARE
  v_authorized_oid OID;
  v_authorized_config TEXT[];
  v_global_oid OID;
  v_metadata_oid OID;
  v_user_id BIGINT;
  v_result BIGINT;
  v_definition TEXT;
  v_module_rpc_count INTEGER;
  v_missing_guard TEXT[];
  v_unrelated_reaching_guard TEXT[];
  v_denied_role TEXT;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;

  PERFORM pg_temp.assert_true(
    'an active employee fixture exists',
    v_user_id IS NOT NULL
  );

  v_authorized_oid := to_regprocedure(
    'public._technical_configuration_require_authorized_user()'
  );
  PERFORM pg_temp.assert_true(
    'canonical authorized-user guard exists',
    v_authorized_oid IS NOT NULL
  );

  SELECT p.proconfig
  INTO v_authorized_config
  FROM pg_proc p
  WHERE p.oid = v_authorized_oid;

  PERFORM pg_temp.assert_true(
    'canonical guard is security definer',
    (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_authorized_oid)
  );
  PERFORM pg_temp.assert_true(
    'canonical guard pins search_path',
    'search_path=public, pg_temp' = ANY(COALESCE(v_authorized_config, ARRAY[]::TEXT[]))
  );
  PERFORM pg_temp.assert_true(
    'canonical guard is not public executable',
    NOT EXISTS (
      SELECT 1
      FROM pg_proc p,
           LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
      WHERE p.oid = v_authorized_oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
  );
  PERFORM pg_temp.assert_true(
    'canonical guard denies direct anon execute',
    NOT has_function_privilege('anon', v_authorized_oid, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'canonical guard denies direct authenticated execute',
    NOT has_function_privilege('authenticated', v_authorized_oid, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'canonical guard preserves service-role helper access',
    has_function_privilege('service_role', v_authorized_oid, 'EXECUTE')
  );

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_current_claims_permission_denied(
    'missing claims fail closed'
  );
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', 'not-a-bigint'
    )::TEXT,
    true
  );
  PERFORM pg_temp.expect_current_claims_permission_denied(
    'malformed user id fails closed'
  );
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', '9223372036854775808'
    )::TEXT,
    true
  );
  PERFORM pg_temp.expect_current_claims_permission_denied(
    'overflowing user id fails closed'
  );
  PERFORM pg_temp.expect_permission_denied(
    'unknown employee fails closed',
    'global',
    9223372036854775807
  );

  FOREACH v_denied_role IN ARRAY ARRAY[
    'to_qltb',
    'qltb_khoa',
    'technician',
    'regional_leader',
    'user'
  ]
  LOOP
    PERFORM pg_temp.expect_permission_denied(
      v_denied_role || ' remains denied',
      v_denied_role,
      v_user_id
    );
  END LOOP;

  FOREACH v_denied_role IN ARRAY ARRAY['global', 'admin', 'chuyen_gia']
  LOOP
    PERFORM pg_temp.set_claims(v_denied_role, v_user_id);
    v_result := public._technical_configuration_require_authorized_user();
    PERFORM pg_temp.assert_true(
      v_denied_role || ' is accepted by the canonical guard',
      v_result = v_user_id
    );
    v_result := public._technical_configuration_require_global_user();
    PERFORM pg_temp.assert_true(
      v_denied_role || ' is accepted through the compatibility wrapper',
      v_result = v_user_id
    );
  END LOOP;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', '',
      'role', 'global',
      'user_id', v_user_id::TEXT
    )::TEXT,
    true
  );
  v_result := public._technical_configuration_require_authorized_user();
  PERFORM pg_temp.assert_true(
    'legacy role claim fallback remains accepted',
    v_result = v_user_id
  );

  v_global_oid := to_regprocedure(
    'public._technical_configuration_require_global_user()'
  );
  SELECT pg_get_functiondef(v_global_oid)
  INTO v_definition;
  PERFORM pg_temp.assert_true(
    'legacy guard delegates to canonical guard',
    v_definition LIKE '%public._technical_configuration_require_authorized_user()%'
  );
  PERFORM pg_temp.assert_true(
    'legacy guard no longer duplicates JWT parsing',
    v_definition NOT LIKE '%request.jwt.claims%'
  );

  v_metadata_oid := to_regprocedure(
    'public._technical_configuration_baseline_import_validate_metadata_v2(uuid,jsonb,bigint)'
  );
  SELECT pg_get_functiondef(v_metadata_oid)
  INTO v_definition;
  PERFORM pg_temp.assert_true(
    'preview-v2 metadata validation reaches canonical guard',
    v_definition LIKE '%public._technical_configuration_require_authorized_user()%'
  );
  PERFORM pg_temp.assert_true(
    'preview-v2 metadata validation no longer duplicates JWT parsing',
    v_definition NOT LIKE '%request.jwt.claims%'
  );

  WITH RECURSIVE
  routines AS MATERIALIZED (
    SELECT
      p.oid,
      p.oid::regprocedure::TEXT AS signature,
      p.proname,
      pg_get_functiondef(p.oid) AS definition,
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
        AS authenticated_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  ),
  call_targets AS (
    SELECT r.*
    FROM routines r
    WHERE left(r.proname, 24) = 'technical_configuration_'
       OR left(r.proname, 25) = '_technical_configuration_'
  ),
  edges AS (
    SELECT
      caller.oid AS caller_oid,
      callee.oid AS callee_oid
    FROM routines caller
    JOIN call_targets callee
      ON caller.oid <> callee.oid
     AND caller.definition ~ (
       'public\.' || callee.proname || '[[:space:]]*\('
     )
  ),
  starts AS (
    SELECT r.oid, r.signature, r.proname
    FROM routines r
    WHERE r.authenticated_execute
  ),
  walk AS (
    SELECT
      s.oid AS start_oid,
      s.oid AS current_oid,
      ARRAY[s.oid]::OID[] AS path
    FROM starts s

    UNION ALL

    SELECT
      w.start_oid,
      e.callee_oid,
      w.path || e.callee_oid
    FROM walk w
    JOIN edges e ON e.caller_oid = w.current_oid
    WHERE NOT e.callee_oid = ANY(w.path)
      AND cardinality(w.path) < 24
  ),
  target AS (
    SELECT r.oid
    FROM routines r
    WHERE r.proname = '_technical_configuration_require_authorized_user'
  )
  SELECT
    count(*) FILTER (
      WHERE left(s.proname, 24) = 'technical_configuration_'
    ),
    array_agg(s.signature ORDER BY s.signature) FILTER (
      WHERE left(s.proname, 24) = 'technical_configuration_'
        AND NOT EXISTS (
          SELECT 1
          FROM walk w
          CROSS JOIN target t
          WHERE w.start_oid = s.oid
            AND w.current_oid = t.oid
        )
    ),
    array_agg(s.signature ORDER BY s.signature) FILTER (
      WHERE left(s.proname, 24) <> 'technical_configuration_'
        AND EXISTS (
          SELECT 1
          FROM walk w
          CROSS JOIN target t
          WHERE w.start_oid = s.oid
            AND w.current_oid = t.oid
        )
    )
  INTO
    v_module_rpc_count,
    v_missing_guard,
    v_unrelated_reaching_guard
  FROM starts s;

  PERFORM pg_temp.assert_true(
    'all 79 authenticated module RPCs are inventoried',
    v_module_rpc_count = 79
  );
  PERFORM pg_temp.assert_true(
    'every authenticated module RPC reaches the canonical guard',
    v_missing_guard IS NULL
  );
  PERFORM pg_temp.assert_true(
    'no unrelated authenticated RPC reaches the canonical guard',
    v_unrelated_reaching_guard IS NULL
  );
END;
$gate$;

ROLLBACK;
