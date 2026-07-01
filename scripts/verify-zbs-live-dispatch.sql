BEGIN;

DO $$
DECLARE
  v_don_vi_id bigint;
  v_recipient_id uuid;
  v_sent_id uuid;
  v_retry_id uuid;
  v_final_retry_id uuid;
  v_final_id uuid;
  v_stale_id uuid;
  v_stale_final_id uuid;
  v_claimed_count integer;
  v_sent_claimed_at timestamptz;
  v_retry_claimed_at timestamptz;
  v_final_retry_claimed_at timestamptz;
  v_final_claimed_at timestamptz;
  v_stale_claimed_at timestamptz;
  v_stale_reclaimed_at timestamptz;
  v_target_rpcs regprocedure[] := ARRAY[
    'public.zbs_notification_outbox_claim_for_dispatch(integer,timestamptz,uuid[])'::regprocedure,
    'public.zbs_notification_outbox_mark_sent(uuid,timestamptz,text,timestamptz,jsonb)'::regprocedure,
    'public.zbs_notification_outbox_mark_failed(uuid,timestamptz,boolean,text,text,jsonb)'::regprocedure
  ];
BEGIN
  SELECT id
    INTO v_don_vi_id
  FROM public.don_vi
  ORDER BY id
  LIMIT 1;

  IF v_don_vi_id IS NULL THEN
    RAISE EXCEPTION 'verify-zbs-live-dispatch requires at least one public.don_vi row';
  END IF;

  INSERT INTO public.zbs_recipient_configs (don_vi_id, event_type, recipient_phone, active)
  VALUES (v_don_vi_id, 'repair_request_created', '84900000001', true)
  RETURNING id INTO v_recipient_id;

  WITH inserted AS (
    INSERT INTO public.zbs_notification_outbox (
      event_type,
      source_type,
      source_id,
      don_vi_id,
      recipient_config_id,
      recipient_phone,
      template_id,
      template_data,
      tracking_id
    )
    VALUES
      (
        'repair_request_created',
        'repair_request',
        -90001,
        v_don_vi_id,
        v_recipient_id,
        '84900000001',
        'template-test',
        jsonb_build_object('repair_request_id', -90001),
        'verify-zbs-live-dispatch:sent'
      ),
      (
        'repair_request_created',
        'repair_request',
        -90002,
        v_don_vi_id,
        v_recipient_id,
        '84900000001',
        'template-test',
        jsonb_build_object('repair_request_id', -90002),
        'verify-zbs-live-dispatch:retry'
      ),
      (
        'repair_request_created',
        'repair_request',
        -90003,
        v_don_vi_id,
        v_recipient_id,
        '84900000001',
        'template-test',
        jsonb_build_object('repair_request_id', -90003),
        'verify-zbs-live-dispatch:final-retry'
      ),
      (
        'repair_request_created',
        'repair_request',
        -90004,
        v_don_vi_id,
        v_recipient_id,
        '84900000001',
        'template-test',
        jsonb_build_object('repair_request_id', -90004),
        'verify-zbs-live-dispatch:final'
      ),
      (
        'repair_request_created',
        'repair_request',
        -90005,
        v_don_vi_id,
        v_recipient_id,
        '84900000001',
        'template-test',
        jsonb_build_object('repair_request_id', -90005),
        'verify-zbs-live-dispatch:stale-processing'
      ),
      (
        'repair_request_created',
        'repair_request',
        -90006,
        v_don_vi_id,
        v_recipient_id,
        '84900000001',
        'template-test',
        jsonb_build_object('repair_request_id', -90006),
        'verify-zbs-live-dispatch:stale-final-processing'
      )
    RETURNING id, tracking_id
  )
  SELECT
    (SELECT id FROM inserted WHERE tracking_id = 'verify-zbs-live-dispatch:sent'),
    (SELECT id FROM inserted WHERE tracking_id = 'verify-zbs-live-dispatch:retry'),
    (SELECT id FROM inserted WHERE tracking_id = 'verify-zbs-live-dispatch:final-retry'),
    (SELECT id FROM inserted WHERE tracking_id = 'verify-zbs-live-dispatch:final'),
    (SELECT id FROM inserted WHERE tracking_id = 'verify-zbs-live-dispatch:stale-processing'),
    (SELECT id FROM inserted WHERE tracking_id = 'verify-zbs-live-dispatch:stale-final-processing')
  INTO v_sent_id, v_retry_id, v_final_retry_id, v_final_id, v_stale_id, v_stale_final_id
  FROM (SELECT 1) AS captured;

  UPDATE public.zbs_notification_outbox
  SET attempt_count = 2
  WHERE id = v_final_retry_id;

  UPDATE public.zbs_notification_outbox
  SET
    status = 'processing',
    attempt_count = 1,
    last_attempt_at = now() - interval '15 minutes'
  WHERE id = v_stale_id;

  UPDATE public.zbs_notification_outbox
  SET
    status = 'processing',
    attempt_count = 3,
    last_attempt_at = now() - interval '15 minutes'
  WHERE id = v_stale_final_id;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","app_role":"to_qltb","user_id":"verify-zbs-live-dispatch"}',
    true
  );

  BEGIN
    PERFORM public.zbs_notification_outbox_claim_for_dispatch(10, now(), ARRAY[v_sent_id]);
    RAISE EXCEPTION 'claim RPC did not reject non-service_role JWT';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.zbs_notification_outbox_mark_sent(
      v_sent_id,
      now(),
      'provider-msg-forbidden',
      now(),
      '{}'::jsonb
    );
    RAISE EXCEPTION 'mark_sent RPC did not reject non-service_role JWT';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.zbs_notification_outbox_mark_failed(
      v_retry_id,
      now(),
      true,
      'http_503',
      'temporary outage',
      '{}'::jsonb
    );
    RAISE EXCEPTION 'mark_failed RPC did not reject non-service_role JWT';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"service_role","app_role":"to_qltb","user_id":"verify-zbs-live-dispatch"}',
    true
  );

  SELECT count(*) INTO v_claimed_count
  FROM public.zbs_notification_outbox_claim_for_dispatch(
    0,
    now(),
    ARRAY[v_sent_id]
  );

  IF v_claimed_count <> 0 THEN
    RAISE EXCEPTION 'expected explicit p_limit=0 to claim no rows, got %', v_claimed_count;
  END IF;

  CREATE TEMP TABLE zbs_live_dispatch_claimed ON COMMIT DROP AS
  SELECT id, last_attempt_at
  FROM public.zbs_notification_outbox_claim_for_dispatch(
    10,
    now(),
    ARRAY[v_sent_id, v_retry_id, v_final_retry_id, v_final_id, v_stale_id]
  );

  SELECT count(*) INTO v_claimed_count
  FROM zbs_live_dispatch_claimed;

  IF v_claimed_count <> 5 THEN
    RAISE EXCEPTION 'expected 5 claimed rows including stale processing, got %', v_claimed_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id IN (v_sent_id, v_retry_id, v_final_retry_id, v_final_id, v_stale_id)
      AND status <> 'processing'
  ) THEN
    RAISE EXCEPTION 'claim did not move all targeted rows to processing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_stale_id
      AND status = 'processing'
      AND attempt_count = 2
      AND last_attempt_at > now() - interval '1 minute'
  ) THEN
    RAISE EXCEPTION 'stale processing row was not reclaimed with a fresh lease';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox_claim_for_dispatch(10, now(), ARRAY[v_stale_final_id])
    WHERE id = v_stale_final_id
  ) THEN
    RAISE EXCEPTION 'stale final-attempt processing row was reclaimed past retry cap';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_stale_final_id
      AND status = 'failed'
      AND attempt_count = 3
      AND last_error_code = 'dispatch_lease_expired'
      AND next_attempt_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'stale final-attempt processing row was not finalized at retry cap';
  END IF;

  SELECT
    (SELECT last_attempt_at FROM zbs_live_dispatch_claimed WHERE id = v_sent_id),
    (SELECT last_attempt_at FROM zbs_live_dispatch_claimed WHERE id = v_retry_id),
    (SELECT last_attempt_at FROM zbs_live_dispatch_claimed WHERE id = v_final_retry_id),
    (SELECT last_attempt_at FROM zbs_live_dispatch_claimed WHERE id = v_final_id),
    (SELECT last_attempt_at FROM zbs_live_dispatch_claimed WHERE id = v_stale_id)
  INTO
    v_sent_claimed_at,
    v_retry_claimed_at,
    v_final_retry_claimed_at,
    v_final_claimed_at,
    v_stale_claimed_at;

  IF v_sent_claimed_at IS NULL
    OR v_retry_claimed_at IS NULL
    OR v_final_retry_claimed_at IS NULL
    OR v_final_claimed_at IS NULL
    OR v_stale_claimed_at IS NULL THEN
    RAISE EXCEPTION 'claim RPC did not return lease timestamps';
  END IF;

  UPDATE public.zbs_notification_outbox
  SET last_attempt_at = v_stale_claimed_at - interval '15 minutes'
  WHERE id = v_stale_id;

  SELECT last_attempt_at INTO v_stale_reclaimed_at
  FROM public.zbs_notification_outbox_claim_for_dispatch(
    1,
    v_stale_claimed_at + interval '20 minutes',
    ARRAY[v_stale_id]
  )
  LIMIT 1;

  IF v_stale_reclaimed_at IS NULL OR v_stale_reclaimed_at = v_stale_claimed_at THEN
    RAISE EXCEPTION 'stale processing row was not reclaimed with a new lease timestamp';
  END IF;

  BEGIN
    PERFORM public.zbs_notification_outbox_mark_failed(
      v_stale_id,
      v_stale_claimed_at,
      false,
      'stale_lease',
      'old dispatcher finished late',
      '{}'::jsonb
    );
    RAISE EXCEPTION 'mark_failed accepted a stale processing lease';
  EXCEPTION
    WHEN no_data_found THEN
      NULL;
  END;

  PERFORM public.zbs_notification_outbox_mark_sent(
    v_sent_id,
    v_sent_claimed_at,
    'provider-msg-1',
    now(),
    jsonb_build_object('error', 0, 'data', jsonb_build_object('msg_id', 'provider-msg-1'))
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_sent_id
      AND status = 'sent'
      AND provider_message_id = 'provider-msg-1'
      AND sent_at IS NOT NULL
      AND provider_response->'data'->>'msg_id' = 'provider-msg-1'
  ) THEN
    RAISE EXCEPTION 'sent metadata was not persisted';
  END IF;

  PERFORM public.zbs_notification_outbox_mark_failed(
    v_retry_id,
    v_retry_claimed_at,
    true,
    'http_503',
    'temporary outage',
    jsonb_build_object('http_status', 503)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_retry_id
      AND status = 'pending'
      AND attempt_count = 1
      AND next_attempt_at > now()
      AND last_error_code = 'http_503'
  ) THEN
    RAISE EXCEPTION 'retryable failure did not return row to pending with backoff';
  END IF;

  PERFORM public.zbs_notification_outbox_mark_failed(
    v_final_retry_id,
    v_final_retry_claimed_at,
    true,
    'http_503',
    'too many attempts',
    jsonb_build_object('http_status', 503)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_final_retry_id
      AND status = 'failed'
      AND attempt_count = 3
      AND last_error_code = 'http_503'
  ) THEN
    RAISE EXCEPTION 'third retryable failure did not finalize row';
  END IF;

  PERFORM public.zbs_notification_outbox_mark_failed(
    v_final_id,
    v_final_claimed_at,
    false,
    'zalo_-1121',
    'issue_summary data breaks max length',
    jsonb_build_object('error', -1121)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_final_id
      AND status = 'failed'
      AND last_error_code = 'zalo_-1121'
  ) THEN
    RAISE EXCEPTION 'non-retryable failure did not finalize row';
  END IF;

  IF (
    SELECT count(*)
    FROM unnest(v_target_rpcs) AS target(fn)
    JOIN pg_proc p ON p.oid = target.fn::oid
  ) <> 3 THEN
    RAISE EXCEPTION 'expected exactly three ZBS live dispatch RPCs';
  END IF;

  IF EXISTS (
    WITH target AS (
      SELECT p.oid, p.proacl, p.proowner
      FROM unnest(v_target_rpcs) AS target(fn)
      JOIN pg_proc p ON p.oid = target.fn::oid
    ),
    grants AS (
      SELECT
        target.oid,
        acl.grantee,
        acl.privilege_type
      FROM target
      CROSS JOIN LATERAL aclexplode(coalesce(target.proacl, acldefault('f', target.proowner))) acl
    )
    SELECT 1
    FROM grants
    WHERE grants.privilege_type = 'EXECUTE'
      AND (
        grants.grantee = 0
        OR grants.grantee NOT IN ('postgres'::regrole::oid, 'service_role'::regrole::oid)
      )
  ) THEN
    RAISE EXCEPTION 'ZBS live dispatch RPC grants are not limited to postgres and service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN unnest(v_target_rpcs) AS target(fn) ON p.oid = target.fn::oid
      AND (
        NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'ZBS live dispatch RPC privilege allowlist check failed';
  END IF;
END $$;

ROLLBACK;
