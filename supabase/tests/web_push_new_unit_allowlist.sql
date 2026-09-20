-- Issue #1003: a successful don_vi_create appends its new ID to both canaries.
BEGIN;

CREATE TEMP TABLE wp1003_result (
  ordinal integer PRIMARY KEY,
  id bigint NOT NULL,
  active boolean NOT NULL
);
GRANT INSERT, SELECT ON wp1003_result TO authenticated;

CREATE TEMP TABLE wp1003_before AS
SELECT to_jsonb(c) AS controls
FROM public.web_push_runtime_controls AS c
WHERE c.singleton;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"app_role":"global"}', true);
INSERT INTO pg_temp.wp1003_result (ordinal, id, active)
SELECT 1, id, active
FROM public.don_vi_create(
  'wp1003-' || txid_current()::text,
  'Issue 1003 fixture',
  true,
  NULL,
  NULL,
  NULL
);
RESET ROLE;

DO $function$
DECLARE
  v_first_id bigint;
  v_before jsonb;
  v_after jsonb;
BEGIN
  SELECT id INTO STRICT v_first_id
  FROM pg_temp.wp1003_result
  WHERE ordinal = 1;
  SELECT controls INTO STRICT v_before FROM pg_temp.wp1003_before;
  SELECT to_jsonb(c) INTO STRICT v_after
  FROM public.web_push_runtime_controls AS c
  WHERE c.singleton;

  ASSERT v_after->'registration_canary_don_vi_ids' =
    (v_before->'registration_canary_don_vi_ids') || jsonb_build_array(v_first_id),
    'new unit must append to registration allowlist';
  ASSERT v_after->'dispatch_canary_don_vi_ids' =
    (v_before->'dispatch_canary_don_vi_ids') || jsonb_build_array(v_first_id),
    'new unit must append to dispatch allowlist';
  ASSERT (v_after - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids') =
    (v_before - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids'),
    'create must preserve all other controls';
  ASSERT has_function_privilege(
    'authenticated',
    'public.don_vi_create(text,text,boolean,integer,text,text)',
    'EXECUTE'
  ), 'authenticated can execute don_vi_create';
  ASSERT NOT has_table_privilege(
    'authenticated',
    'public.web_push_runtime_controls',
    'SELECT,INSERT,UPDATE,DELETE'
  ), 'authenticated cannot write runtime controls directly';
  ASSERT (
    SELECT pg_get_userbyid(p.proowner) = 'postgres'
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'don_vi_create'
      AND pg_get_function_identity_arguments(p.oid) =
        'p_code text, p_name text, p_active boolean, p_membership_quota integer, p_logo_url text, p_google_drive_folder_url text'
  ), 'don_vi_create owner remains postgres';
  ASSERT (
    SELECT p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'don_vi_create'
      AND pg_get_function_identity_arguments(p.oid) =
        'p_code text, p_name text, p_active boolean, p_membership_quota integer, p_logo_url text, p_google_drive_folder_url text'
  ), 'don_vi_create pins a safe search_path';
END;
$function$;

DO $function$
DECLARE
  v_first_id bigint;
BEGIN
  SELECT id INTO STRICT v_first_id
  FROM pg_temp.wp1003_result
  WHERE ordinal = 1;

  UPDATE public.web_push_runtime_controls AS c
  SET registration_canary_don_vi_ids = array_remove(c.registration_canary_don_vi_ids, v_first_id),
      dispatch_canary_don_vi_ids = array_remove(c.dispatch_canary_don_vi_ids, v_first_id)
  WHERE c.singleton;
  UPDATE public.don_vi
  SET name = 'Issue 1003 renamed', active = false
  WHERE id = v_first_id;
END;
$function$;

CREATE TEMP TABLE wp1003_after_manual AS
SELECT c.registration_canary_don_vi_ids,
       c.dispatch_canary_don_vi_ids,
       to_jsonb(c) AS controls
FROM public.web_push_runtime_controls AS c
WHERE c.singleton;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"app_role":"admin","role":"admin"}', true);
INSERT INTO pg_temp.wp1003_result (ordinal, id, active)
SELECT 2, id, active
FROM public.don_vi_create(
  'wp1003-second-' || txid_current()::text,
  'Issue 1003 inactive fixture',
  false,
  NULL,
  NULL,
  NULL
);
RESET ROLE;

DO $function$
DECLARE
  v_first_id bigint;
  v_second_id bigint;
  v_second_active boolean;
  v_registration bigint[];
  v_dispatch bigint[];
  v_expected_registration bigint[];
  v_expected_dispatch bigint[];
  v_after jsonb;
  v_manual jsonb;
BEGIN
  SELECT id INTO STRICT v_first_id FROM pg_temp.wp1003_result WHERE ordinal = 1;
  SELECT id, active INTO STRICT v_second_id, v_second_active
  FROM pg_temp.wp1003_result WHERE ordinal = 2;
  SELECT c.registration_canary_don_vi_ids, c.dispatch_canary_don_vi_ids,
         to_jsonb(c)
  INTO STRICT v_registration, v_dispatch, v_after
  FROM public.web_push_runtime_controls AS c
  WHERE c.singleton;

  SELECT registration_canary_don_vi_ids, dispatch_canary_don_vi_ids, controls
  INTO STRICT v_expected_registration, v_expected_dispatch, v_manual
  FROM pg_temp.wp1003_after_manual;
  ASSERT v_registration = v_expected_registration || v_second_id,
    'second unit appends after manual removal without reordering';
  ASSERT v_dispatch = v_expected_dispatch || v_second_id,
    'second unit appends to dispatch after manual removal';
  ASSERT NOT (v_first_id = ANY(v_registration)),
    'manually removed unit is not re-added';
  ASSERT (SELECT count(*) FROM unnest(v_registration) AS x(id) WHERE x.id = v_second_id) = 1,
    'registration contains the new unit exactly once';
  ASSERT (SELECT count(*) FROM unnest(v_dispatch) AS x(id) WHERE x.id = v_second_id) = 1,
    'dispatch contains the new unit exactly once';
  ASSERT NOT v_second_active, 'inactive creation still appends without enabling policy';
  ASSERT (SELECT name = 'Issue 1003 renamed' AND NOT active FROM public.don_vi WHERE id = v_first_id),
    'rename and active toggle do not change allowlists';
  ASSERT (v_after - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids') =
    (v_manual - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids'),
    'second create preserves all non-allowlist controls';
END;
$function$;

DO $function$
DECLARE
  v_code text := 'wp1003-missing-' || txid_current()::text;
BEGIN
  BEGIN
    DELETE FROM public.web_push_runtime_controls WHERE singleton;
    PERFORM set_config('request.jwt.claims', '{"app_role":"global"}', true);
    PERFORM public.don_vi_create(v_code, 'Issue 1003 missing controls', true, NULL, NULL, NULL);
    RAISE EXCEPTION 'expected missing controls failure';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    ASSERT SQLERRM = 'Web Push runtime controls missing',
      'missing controls failure keeps its exact fail-closed message';
  END;
  ASSERT EXISTS (SELECT 1 FROM public.web_push_runtime_controls WHERE singleton),
    'missing controls failure restores the singleton row';
  ASSERT NOT EXISTS (SELECT 1 FROM public.don_vi WHERE code = v_code),
    'missing controls failure rolls back the new unit';
END;
$function$;

DO $function$
DECLARE
  v_code text := 'wp1003-abort-' || txid_current()::text;
  v_before jsonb;
  v_created_id bigint;
BEGIN
  SELECT to_jsonb(c) INTO STRICT v_before
  FROM public.web_push_runtime_controls AS c
  WHERE c.singleton;

  BEGIN
    PERFORM set_config('request.jwt.claims', '{"app_role":"global"}', true);
    SELECT id INTO STRICT v_created_id
    FROM public.don_vi_create(v_code, 'Issue 1003 forced abort', true, NULL, NULL, NULL);
    RAISE EXCEPTION 'issue 1003 forced abort' USING ERRCODE = 'ZX003';
  EXCEPTION WHEN SQLSTATE 'ZX003' THEN
    NULL;
  END;

  ASSERT NOT EXISTS (SELECT 1 FROM public.don_vi WHERE code = v_code),
    'post-create abort rolls back the new unit';
  ASSERT (
    SELECT to_jsonb(c)
    FROM public.web_push_runtime_controls AS c
    WHERE c.singleton
  ) = v_before, 'post-create abort rolls back both allowlists';
END;
$function$;

DO $function$
DECLARE
  v_code text := 'wp1003-validation-' || txid_current()::text;
  v_after_create jsonb;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"app_role":"user"}', true);
    PERFORM public.don_vi_create(v_code, 'Issue 1003 forbidden', true, NULL, NULL, NULL);
    RAISE EXCEPTION 'non-global create unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    ASSERT SQLERRM = 'Forbidden', 'non-global create keeps its forbidden error';
  END;

  PERFORM set_config('request.jwt.claims', '{"app_role":"global"}', true);
  PERFORM public.don_vi_create(v_code, 'Issue 1003 duplicate', true, NULL, NULL, NULL);
  SELECT to_jsonb(c) INTO STRICT v_after_create
  FROM public.web_push_runtime_controls AS c
  WHERE c.singleton;

  BEGIN
    PERFORM set_config('request.jwt.claims', '{"app_role":"global"}', true);
    PERFORM public.don_vi_create(v_code, 'Issue 1003 duplicate again', true, NULL, NULL, NULL);
    RAISE EXCEPTION 'duplicate code unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    ASSERT SQLERRM = 'Mã đơn vị đã tồn tại', 'duplicate code keeps its validation error';
  END;

  BEGIN
    PERFORM set_config('request.jwt.claims', '{"app_role":"global"}', true);
    PERFORM public.don_vi_create('wp1003-empty-' || txid_current(), '  ', true, NULL, NULL, NULL);
    RAISE EXCEPTION 'empty name unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    ASSERT SQLERRM = 'Tên đơn vị không được trống', 'empty name keeps its validation error';
  END;

  ASSERT (
    SELECT to_jsonb(c)
    FROM public.web_push_runtime_controls AS c
    WHERE c.singleton
  ) = v_after_create, 'rejected creates leave controls unchanged';
END;
$function$;

ROLLBACK;
