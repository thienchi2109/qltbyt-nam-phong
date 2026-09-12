-- Web Push Phase 4: worker controls, replay, lease fencing and report semantics.
BEGIN;

CREATE FUNCTION pg_temp.web_push_phase4_expect_error(p_sql text, p_state text, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = p_state AND SQLERRM = p_message THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected % %, got % %', p_state, p_message, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'Expected % %, statement succeeded', p_state, p_message;
END;
$function$;

DO $function$
DECLARE
  v_key text := translate(rtrim(replace(encode(decode(
    '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5', 'hex'), 'base64'), E'\n', ''), '='), '+/', '-_');
  v_auth text := 'AAAAAAAAAAAAAAAAAAAAAA';
  v_claim jsonb;
  v_report jsonb;
  v_item jsonb;
  v_item_two jsonb;
  v_delivery uuid;
  v_delivery_two uuid;
  v_delivery_three uuid;
  v_delivery_four uuid;
  v_subscription uuid;
  v_token uuid;
  v_token_two uuid;
  v_token_three uuid;
  v_token_four uuid;
  v_revision text;
  v_revision_two text;
  v_revision_three text;
  v_revision_four text;
  v_intent uuid;
  v_intent_two uuid;
  v_i integer;
BEGIN
  ASSERT NOT (SELECT registration_enabled FROM public.web_push_runtime_controls WHERE singleton), 'registration defaults off';
  ASSERT NOT (SELECT dispatch_enabled FROM public.web_push_runtime_controls WHERE singleton), 'dispatch defaults off';
  ASSERT NOT has_function_privilege('authenticated', 'public.web_push_worker_nonce_consume(text,text)', 'EXECUTE'), 'nonce is internal-only';
  ASSERT NOT has_function_privilege('authenticated', 'public.web_push_delivery_claim(jsonb)', 'EXECUTE'), 'claim is internal-only';
  ASSERT NOT has_function_privilege('authenticated', 'public.web_push_delivery_report(jsonb)', 'EXECUTE'), 'report is internal-only';
  ASSERT has_function_privilege('service_role', 'public.web_push_worker_nonce_consume(text,text)', 'EXECUTE'), 'service role nonce grant';
  ASSERT has_function_privilege('service_role', 'public.web_push_delivery_claim(jsonb)', 'EXECUTE'), 'service role claim grant';
  ASSERT has_function_privilege('service_role', 'public.web_push_delivery_report(jsonb)', 'EXECUTE'), 'service role report grant';

  ASSERT public.web_push_worker_nonce_consume('phase4-key', repeat('0', 32)), 'first nonce accepted';
  ASSERT NOT public.web_push_worker_nonce_consume('phase4-key', repeat('0', 32)), 'nonce replay rejected atomically';
  FOR v_i IN 1..59 LOOP
    ASSERT public.web_push_worker_nonce_consume('phase4-key', lpad(to_hex(v_i), 32, '0')), 'unique nonce accepted';
  END LOOP;
  PERFORM pg_temp.web_push_phase4_expect_error(
    $sql$SELECT public.web_push_worker_nonce_consume('phase4-key','0000000000000000000000000000003c')$sql$,
    'P0001', 'rate_limited'
  );
  PERFORM pg_temp.web_push_phase4_expect_error(
    $sql$SELECT public.web_push_worker_nonce_consume('Bad Key','0000000000000000000000000000003d')$sql$,
    '22023', 'invalid_request'
  );

  PERFORM pg_temp.web_push_phase4_expect_error(
    $sql$SELECT public.web_push_delivery_claim(jsonb_build_object(
      'version',1,'worker_id','phase4-worker','limit',5,
      'vapid_key_version','staging-20260910-01',
      'vapid_fingerprint','sha256:'||repeat('0',64)))$sql$,
    'P0001', 'dispatch_disabled'
  );

  INSERT INTO public.dia_ban(id, ma_dia_ban, ten_dia_ban)
  VALUES (2147400001, 'webpush-p4', 'Web Push Phase 4');
  INSERT INTO public.don_vi(id, name, dia_ban_id)
  VALUES (2147400001, 'Web Push Phase 4', 2147400001);
  INSERT INTO public.nhan_vien(id, username, password, role, don_vi, dia_ban_id, khoa_phong)
  VALUES (2147400001, 'webpush-p4-user', 'unused', 'user', 2147400001, 2147400001, 'CT');
  INSERT INTO public.thiet_bi(id, ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, is_deleted)
  VALUES (2147400001, 'WEBPUSH-P4', 'Phase 4 test', 2147400001, 'CT', false);
  INSERT INTO public.yeu_cau_sua_chua(id, thiet_bi_id, mo_ta_su_co)
  VALUES (2147400001, 2147400001, 'Phase 4 test request');
  INSERT INTO public.web_push_recipient_configs(don_vi_id, user_id)
  VALUES (2147400001, 2147400001);
  INSERT INTO public.web_push_subscriptions(
    user_id, endpoint, p256dh, auth, vapid_key_version, authorization_epoch
  )
  VALUES
    (2147400001, 'https://push.example.test/phase4-a', v_key, v_auth, 'staging-20260910-01',
      (SELECT password_changed_at FROM public.nhan_vien WHERE id = 2147400001)),
    (2147400001, 'https://push.example.test/phase4-b', v_key, v_auth, 'staging-20260910-01',
      (SELECT password_changed_at FROM public.nhan_vien WHERE id = 2147400001));
  INSERT INTO public.web_push_notification_intents(event_type, request_id, recipient_user_id, don_vi_id, payload)
  VALUES ('repair_request_created', 2147400001, 2147400001, 2147400001,
    jsonb_build_object('version', 1, 'notification_id', 'phase4'))
  RETURNING id INTO v_intent;

  UPDATE public.web_push_runtime_controls
  SET dispatch_enabled = true,
      vapid_key_version = 'staging-20260910-01',
      vapid_fingerprint = 'sha256:' || repeat('0', 64)
  WHERE singleton;
  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'phase4-worker', 'limit', 5,
    'vapid_key_version', 'staging-20260910-01',
    'vapid_fingerprint', 'sha256:' || repeat('0', 64)));
  ASSERT jsonb_array_length(v_claim->'deliveries') = 0, 'empty dispatch canary fails closed';

  UPDATE public.web_push_runtime_controls
  SET registration_enabled = true,
      registration_canary_don_vi_ids = ARRAY[2147400001]::bigint[],
      dispatch_canary_don_vi_ids = ARRAY[2147400001]::bigint[],
      vapid_key_version = 'staging-20260910-01',
      vapid_fingerprint = 'sha256:' || repeat('0', 64),
      vapid_public_key = v_key
  WHERE singleton;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('app_role', 'user', 'user_id', '2147400001')::text,
    true
  );
  UPDATE public.web_push_runtime_controls
  SET registration_canary_don_vi_ids = '{}'::bigint[]
  WHERE singleton;
  PERFORM pg_temp.web_push_phase4_expect_error(
    $sql$SELECT public.web_push_subscription_register(
      jsonb_build_object(
        'endpoint', 'https://push.example.test/phase4-a',
        'keys', jsonb_build_object('p256dh', 'x', 'auth', 'y')
      ), 'staging-20260910-01')$sql$,
    'P0001', 'registration_disabled'
  );
  UPDATE public.web_push_runtime_controls
  SET registration_canary_don_vi_ids = ARRAY[2147400001]::bigint[]
  WHERE singleton;
  UPDATE public.nhan_vien SET role = 'global' WHERE id = 2147400001;
  PERFORM public.web_push_subscription_register(
    jsonb_build_object(
      'endpoint', 'https://push.example.test/phase4-a',
      'keys', jsonb_build_object('p256dh', v_key, 'auth', v_auth)
    ), 'staging-20260910-01'
  );
  UPDATE public.nhan_vien SET role = 'admin' WHERE id = 2147400001;
  PERFORM public.web_push_subscription_register(
    jsonb_build_object(
      'endpoint', 'https://push.example.test/phase4-a',
      'keys', jsonb_build_object('p256dh', v_key, 'auth', v_auth)
    ), 'staging-20260910-01'
  );
  UPDATE public.nhan_vien SET role = 'user' WHERE id = 2147400001;
  PERFORM set_config('request.jwt.claims', '', true);

  PERFORM pg_temp.web_push_phase4_expect_error(
    $sql$SELECT public.web_push_delivery_claim(jsonb_build_object(
      'version',1,'worker_id','phase4-worker','limit',5,
      'vapid_key_version','staging-20260910-01',
      'vapid_fingerprint','sha256:'||repeat('1',64)))$sql$,
    '40001', 'key_version_mismatch'
  );

  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1,
    'worker_id', 'phase4-worker',
    'limit', 5,
    'vapid_key_version', 'staging-20260910-01',
    'vapid_fingerprint', 'sha256:' || repeat('0', 64)
  ));
  ASSERT v_claim->>'version' = '1', 'claim response version';
  ASSERT v_claim->>'poll_after_seconds' = '5', 'claim poll interval';
  ASSERT jsonb_array_length(v_claim->'deliveries') = 2, 'claim fans out active subscriptions';
  SELECT value INTO v_item FROM jsonb_array_elements(v_claim->'deliveries') LIMIT 1;
  SELECT value INTO v_item_two FROM jsonb_array_elements(v_claim->'deliveries') OFFSET 1 LIMIT 1;
  v_delivery := (v_item->>'delivery_id')::uuid;
  v_token := (v_item->>'attempt_token')::uuid;
  v_revision := v_item->>'subscription_revision';
  v_delivery_two := (v_item_two->>'delivery_id')::uuid;
  v_token_two := (v_item_two->>'attempt_token')::uuid;
  v_revision_two := v_item_two->>'subscription_revision';
  ASSERT (v_item->>'attempt')::integer = 1, 'first claim attempt';
  ASSERT (v_item->>'ttl_seconds')::integer BETWEEN 86390 AND 86400, 'deadline TTL';
  ASSERT v_item->'keys'->>'p256dh' = v_key, 'claim returns subscription keys';
  ASSERT v_item->>'payload_base64' IS NOT NULL, 'claim returns encoded payload';

  v_report := public.web_push_delivery_report(jsonb_build_object(
    'version', 1,
    'results', jsonb_build_array(jsonb_build_object(
      'delivery_id', v_delivery::text, 'attempt_token', v_token::text,
      'subscription_revision', v_revision, 'outcome', 'accepted',
      'provider_status', 201, 'retry_after_seconds', NULL
    ))
  ));
  ASSERT v_report->'results'->0->>'result' = 'applied', 'accepted report applies';
  v_report := public.web_push_delivery_report(jsonb_build_object(
    'version', 1,
    'results', jsonb_build_array(jsonb_build_object(
      'delivery_id', v_delivery::text, 'attempt_token', v_token::text,
      'subscription_revision', v_revision, 'outcome', 'accepted',
      'provider_status', 201, 'retry_after_seconds', NULL
    ))
  ));
  ASSERT v_report->'results'->0->>'result' = 'duplicate', 'exact report retry is duplicate';
  v_report := public.web_push_delivery_report(jsonb_build_object(
    'version', 1,
    'results', jsonb_build_array(jsonb_build_object(
      'delivery_id', v_delivery::text, 'attempt_token', v_token::text,
      'subscription_revision', v_revision, 'outcome', 'accepted',
      'provider_status', 202, 'retry_after_seconds', NULL
    ))
  ));
  ASSERT v_report->'results'->0->>'result' = 'stale', 'changed report result is stale';

  v_report := public.web_push_delivery_report(jsonb_build_object(
    'version', 1,
    'results', jsonb_build_array(jsonb_build_object(
      'delivery_id', v_delivery_two::text, 'attempt_token', v_token_two::text,
      'subscription_revision', v_revision_two, 'outcome', 'transient',
      'provider_status', 503, 'retry_after_seconds', NULL
    ))
  ));
  ASSERT v_report->'results'->0->>'result' = 'applied', 'transient report schedules retry';
  ASSERT (SELECT status = 'retry' FROM public.web_push_notification_deliveries WHERE id = v_delivery_two), 'transient delivery retry state';
  v_report := public.web_push_delivery_report(jsonb_build_object(
    'version', 1,
    'results', jsonb_build_array(jsonb_build_object(
      'delivery_id', v_delivery_two::text, 'attempt_token', v_token_two::text,
      'subscription_revision', v_revision_two, 'outcome', 'transient',
      'provider_status', 503, 'retry_after_seconds', NULL
    ))
  ));
  ASSERT v_report->'results'->0->>'result' = 'duplicate', 'retry report is duplicate';
  UPDATE public.web_push_notification_deliveries SET next_attempt_at = clock_timestamp() WHERE id = v_delivery_two;
  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'phase4-worker', 'limit', 5,
    'vapid_key_version', 'staging-20260910-01', 'vapid_fingerprint', 'sha256:' || repeat('0', 64)));
  SELECT value INTO v_item FROM jsonb_array_elements(v_claim->'deliveries')
  WHERE value->>'delivery_id' = v_delivery_two::text;
  ASSERT (v_item->>'attempt')::integer = 2, 'retry claim increments attempt';

  -- Report mixed outcomes while endpoint_gone cancels the leased sibling on another intent.
  INSERT INTO public.thiet_bi(id, ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, is_deleted)
  VALUES (2147400002, 'WEBPUSH-P4-B', 'Phase 4 sibling test', 2147400001, 'CT', false);
  INSERT INTO public.yeu_cau_sua_chua(id, thiet_bi_id, mo_ta_su_co)
  VALUES (2147400002, 2147400002, 'Phase 4 sibling request');
  INSERT INTO public.web_push_notification_intents(event_type, request_id, recipient_user_id, don_vi_id, payload)
  VALUES ('repair_request_created', 2147400002, 2147400001, 2147400001,
    jsonb_build_object('version', 1, 'notification_id', 'phase4-sibling'))
  RETURNING id INTO v_intent_two;
  SELECT subscription_id INTO v_subscription
  FROM public.web_push_notification_deliveries
  WHERE id = v_delivery_two;
  v_claim := public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'phase4-worker', 'limit', 5,
    'vapid_key_version', 'staging-20260910-01', 'vapid_fingerprint', 'sha256:' || repeat('0', 64)));
  ASSERT jsonb_array_length(v_claim->'deliveries') = 2, 'sibling intent fans out active subscriptions';
  SELECT d.id, d.attempt_token, d.subscription_revision::text
  INTO v_delivery_three, v_token_three, v_revision_three
  FROM public.web_push_notification_deliveries d
  WHERE d.intent_id = v_intent_two AND d.subscription_id = v_subscription;
  SELECT d.id, d.attempt_token, d.subscription_revision::text
  INTO v_delivery_four, v_token_four, v_revision_four
  FROM public.web_push_notification_deliveries d
  WHERE d.intent_id = v_intent_two AND d.subscription_id <> v_subscription;
  ASSERT v_delivery_three IS NOT NULL AND v_delivery_four IS NOT NULL, 'mixed outcome delivery snapshots';
  v_report := public.web_push_delivery_report(jsonb_build_object(
    'version', 1,
    'results', jsonb_build_array(
      jsonb_build_object(
        'delivery_id', v_delivery_three::text, 'attempt_token', v_token_three::text,
        'subscription_revision', v_revision_three, 'outcome', 'endpoint_gone',
        'provider_status', 410, 'retry_after_seconds', NULL
      ),
      jsonb_build_object(
        'delivery_id', v_delivery_four::text, 'attempt_token', v_token_four::text,
        'subscription_revision', v_revision_four, 'outcome', 'accepted',
        'provider_status', 201, 'retry_after_seconds', NULL
      )
    )
  ));
  ASSERT (SELECT count(*) = 2 FROM jsonb_array_elements(v_report->'results')
    WHERE value->>'result' = 'applied'), 'mixed endpoint_gone and accepted reports apply';
  ASSERT (SELECT status = 'cancelled' AND worker_id IS NULL AND leased_at IS NULL
    AND lease_expires_at IS NULL AND result->>'reason' = 'endpoint_gone'
    FROM public.web_push_notification_deliveries WHERE id = v_delivery_two),
    'endpoint_gone clears leased sibling fields';
  ASSERT (SELECT status = 'cancelled' AND worker_id IS NULL AND leased_at IS NULL
    AND lease_expires_at IS NULL AND result->>'outcome' = 'endpoint_gone'
    FROM public.web_push_notification_deliveries WHERE id = v_delivery_three),
    'endpoint_gone primary is terminal';
  ASSERT (SELECT status = 'completed' AND accepted_count = 1 AND cancelled_count = 1
    AND terminal_at IS NOT NULL FROM public.web_push_notification_intents WHERE id = v_intent),
    'original intent reconciles mixed completion counters';
  ASSERT (SELECT status = 'completed' AND accepted_count = 1 AND cancelled_count = 1
    AND terminal_at IS NOT NULL FROM public.web_push_notification_intents WHERE id = v_intent_two),
    'sibling intent reconciles mixed completion counters';
  ASSERT (SELECT revoked_at IS NOT NULL FROM public.web_push_subscriptions WHERE id = v_subscription),
    'endpoint_gone revokes subscription';

  UPDATE public.nhan_vien SET password_changed_at = clock_timestamp() WHERE id = 2147400001;
  PERFORM public.web_push_delivery_claim(jsonb_build_object(
    'version', 1, 'worker_id', 'phase4-worker', 'limit', 5,
    'vapid_key_version', 'staging-20260910-01', 'vapid_fingerprint', 'sha256:' || repeat('0', 64)));
  ASSERT (SELECT count(*) = 0 FROM public.web_push_subscriptions WHERE user_id = 2147400001 AND revoked_at IS NULL), 'epoch change revokes subscriptions';

  PERFORM pg_temp.web_push_phase4_expect_error(
    $sql$SELECT public.web_push_delivery_report(jsonb_build_object(
      'version',1,'results',jsonb_build_array(jsonb_build_object(
        'delivery_id','00000000-0000-0000-0000-000000000000',
        'attempt_token','00000000-0000-0000-0000-000000000000',
        'subscription_revision','1','outcome','permanent',
        'provider_status',401,'retry_after_seconds',NULL))))$sql$,
    '22023', 'invalid_request'
  );
  RAISE NOTICE 'PASS: controls, trusted VAPID metadata, nonce replay/throttle, fan-out, lease/report fencing and epoch revocation';
END;
$function$;

ROLLBACK;
