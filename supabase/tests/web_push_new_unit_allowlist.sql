-- Issue #1003: a successful don_vi_create appends its new ID to both canaries.
BEGIN;

CREATE TEMP TABLE wp1003_result (
  ordinal integer PRIMARY KEY,
  id bigint NOT NULL,
  active boolean NOT NULL
);
GRANT INSERT, SELECT ON wp1003_result TO authenticated;

UPDATE public.web_push_runtime_controls
SET registration_canary_don_vi_ids = ARRAY[-1003001, -1003002]::bigint[],
    dispatch_canary_don_vi_ids = ARRAY[-1003003]::bigint[]
WHERE singleton;

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

  ASSERT v_before->'registration_canary_don_vi_ids' = to_jsonb(ARRAY[-1003001, -1003002]::bigint[]),
    'registration fixture starts with deterministic canaries';
  ASSERT v_before->'dispatch_canary_don_vi_ids' = to_jsonb(ARRAY[-1003003]::bigint[]),
    'dispatch fixture starts with a different deterministic canary set';
  ASSERT v_before->'registration_canary_don_vi_ids' <> v_before->'dispatch_canary_don_vi_ids',
    'registration and dispatch fixtures are intentionally different';
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

UPDATE public.web_push_runtime_controls
SET enqueue_enabled = true,
    registration_enabled = true,
    dispatch_enabled = true,
    registration_canary_don_vi_ids = '{}'::bigint[],
    dispatch_canary_don_vi_ids = '{}'::bigint[],
    vapid_key_version = 'wp1003-v1',
    vapid_public_key = repeat('A', 87),
    vapid_fingerprint = 'sha256:' || repeat('0', 64),
    vapid_subject = 'mailto:issue-1003@example.test',
    web_push_retention_last_run_at = '2030-01-02 03:04:05+00'::timestamptz
WHERE singleton;

CREATE TEMP TABLE wp1003_bridge_before AS
SELECT to_jsonb(c) AS controls
FROM public.web_push_runtime_controls AS c
WHERE c.singleton;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"app_role":"global"}', true);
INSERT INTO pg_temp.wp1003_result (ordinal, id, active)
SELECT 3, id, active
FROM public.don_vi_create(
  'wp1003-third-' || txid_current()::text,
  'Issue 1003 bridge fixture',
  true,
  NULL,
  NULL,
  NULL
);
RESET ROLE;

DO $function$
DECLARE
  v_third_id bigint;
  v_before jsonb;
  v_after jsonb;
  v_registration bigint[];
  v_dispatch bigint[];
BEGIN
  SELECT id INTO STRICT v_third_id
  FROM pg_temp.wp1003_result
  WHERE ordinal = 3;
  SELECT controls INTO STRICT v_before FROM pg_temp.wp1003_bridge_before;
  SELECT registration_canary_don_vi_ids, dispatch_canary_don_vi_ids, to_jsonb(c)
  INTO STRICT v_registration, v_dispatch, v_after
  FROM public.web_push_runtime_controls AS c
  WHERE c.singleton;

  ASSERT v_before->'registration_canary_don_vi_ids' = '[]'::jsonb,
    'empty registration allowlist is an explicit creation fixture';
  ASSERT v_before->'dispatch_canary_don_vi_ids' = '[]'::jsonb,
    'empty dispatch allowlist is an explicit creation fixture';
  ASSERT v_registration = ARRAY[v_third_id]::bigint[],
    'empty registration allowlist receives only the new unit';
  ASSERT v_dispatch = ARRAY[v_third_id]::bigint[],
    'empty dispatch allowlist receives only the new unit';
  ASSERT (v_after - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids') =
    (v_before - 'registration_canary_don_vi_ids' - 'dispatch_canary_don_vi_ids'),
    'empty-array create preserves flags, VAPID fields, deadline metadata, and other controls';
END;
$function$;

DO $function$
DECLARE
  v_don_vi_id bigint;
  v_region_id bigint;
  v_user_id integer;
  v_username text;
  v_equipment_id integer;
  v_request_id integer;
  v_no_subscription_deadline timestamptz;
  v_claim jsonb;
  v_delivery jsonb;
  v_key text := translate(rtrim(replace(encode(decode(
    '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5',
    'hex'), 'base64'), E'\n', ''), '='), '+/', '-_');
BEGIN
  SELECT id INTO STRICT v_don_vi_id FROM pg_temp.wp1003_result WHERE ordinal = 3;
  INSERT INTO public.dia_ban (ma_dia_ban, ten_dia_ban)
  VALUES ('wp1003-' || txid_current()::text, 'Issue 1003 bridge region')
  RETURNING id INTO v_region_id;
  UPDATE public.don_vi SET dia_ban_id = v_region_id WHERE id = v_don_vi_id;

  SELECT COALESCE(max(id), 0) + 1 INTO v_user_id FROM public.nhan_vien;
  v_username := 'wp1003-' || txid_current()::text;
  INSERT INTO public.nhan_vien (
    id, username, password, full_name, role, khoa_phong, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    v_user_id, v_username, 'unused', 'Issue 1003 bridge user',
    'to_qltb', 'CT', v_don_vi_id, v_don_vi_id, v_region_id
  );
  SELECT COALESCE(max(id), 0) + 1 INTO v_equipment_id FROM public.thiet_bi;
  INSERT INTO public.thiet_bi (
    id, ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted
  )
  VALUES (
    v_equipment_id, 'WP1003-' || txid_current()::text, 'Issue 1003 bridge equipment',
    v_don_vi_id, 'CT', 'Hoạt động', false
  );

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb', 'user_id', v_user_id::text, 'don_vi', v_don_vi_id::text
  )::text, true);

  v_request_id := public.repair_request_create(
    v_equipment_id, 'Issue 1003 no recipient', NULL, NULL, 'Bridge user', NULL, NULL
  );
  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'wp1003-no-recipient', 'limit', 5,
    'vapid_key_version', 'wp1003-v1', 'vapid_fingerprint', 'sha256:' || repeat('0', 64)
  ));
  ASSERT jsonb_array_length(v_claim->'deliveries') = 0,
    'event without recipient config produces no delivery';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.web_push_notification_intents WHERE request_id = v_request_id
  ), 'event without recipient config produces no intent';

  PERFORM public.web_push_recipient_config_set(v_don_vi_id, ARRAY[v_username]);
  v_request_id := public.repair_request_create(
    v_equipment_id, 'Issue 1003 no subscription', NULL, NULL, 'Bridge user', NULL, NULL
  );
  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'wp1003-no-subscription', 'limit', 5,
    'vapid_key_version', 'wp1003-v1', 'vapid_fingerprint', 'sha256:' || repeat('0', 64)
  ));
  ASSERT jsonb_array_length(v_claim->'deliveries') = 0,
    'recipient config without subscription produces no delivery';
  ASSERT EXISTS (
    SELECT 1 FROM public.web_push_notification_intents
    WHERE request_id = v_request_id AND recipient_user_id = v_user_id
  ), 'recipient config creates an intent before subscription registration';
  SELECT deadline INTO STRICT v_no_subscription_deadline
  FROM public.web_push_notification_intents
  WHERE request_id = v_request_id AND recipient_user_id = v_user_id;
  UPDATE public.web_push_notification_intents
  SET status = 'cancelled', terminal_at = clock_timestamp(), cancelled_count = cancelled_count + 1
  WHERE request_id = v_request_id AND terminal_at IS NULL;
  ASSERT (
    SELECT deadline
    FROM public.web_push_notification_intents
    WHERE request_id = v_request_id AND recipient_user_id = v_user_id
  ) = v_no_subscription_deadline, 'terminal transition preserves the old deadline';

  PERFORM public.web_push_subscription_register(jsonb_build_object(
    'endpoint', 'https://push.example.test/wp1003-' || v_user_id,
    'keys', jsonb_build_object('p256dh', v_key, 'auth', 'AAAAAAAAAAAAAAAAAAAAAA')
  ), 'wp1003-v1');
  v_request_id := public.repair_request_create(
    v_equipment_id, 'Issue 1003 with subscription', NULL, NULL, 'Bridge user', NULL, NULL
  );
  -- Worker claims run in this owner DO; configuration above still uses manager JWT authorization.
  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'wp1003-with-subscription', 'limit', 5,
    'vapid_key_version', 'wp1003-v1', 'vapid_fingerprint', 'sha256:' || repeat('0', 64)
  ));
  ASSERT jsonb_array_length(v_claim->'deliveries') = 1,
    'opted-in recipient produces one claimed delivery';
  v_delivery := v_claim->'deliveries'->0;
  ASSERT (
    SELECT i.request_id
    FROM public.web_push_notification_deliveries d
    JOIN public.web_push_notification_intents i ON i.id = d.intent_id
    WHERE d.id = (v_delivery->>'delivery_id')::uuid
  ) = v_request_id, 'claimed delivery belongs to the fresh event';
  ASSERT (
    SELECT i.recipient_user_id
    FROM public.web_push_notification_deliveries d
    JOIN public.web_push_notification_intents i ON i.id = d.intent_id
    WHERE d.id = (v_delivery->>'delivery_id')::uuid
  ) = v_user_id, 'claimed delivery belongs to the configured recipient';
  ASSERT (v_delivery->>'ttl_seconds')::integer BETWEEN 86390 AND 86400,
    'claimed delivery preserves the 24-hour deadline';
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
