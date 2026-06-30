BEGIN;

DO $$
DECLARE
  v_don_vi_id bigint;
  v_recipient_id uuid;
  v_sent_id uuid;
  v_retry_id uuid;
  v_final_retry_id uuid;
  v_final_id uuid;
  v_claimed_count integer;
  v_acl text;
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
    );

  SELECT id INTO v_sent_id
  FROM public.zbs_notification_outbox
  WHERE tracking_id = 'verify-zbs-live-dispatch:sent';

  SELECT id INTO v_retry_id
  FROM public.zbs_notification_outbox
  WHERE tracking_id = 'verify-zbs-live-dispatch:retry';

  SELECT id INTO v_final_retry_id
  FROM public.zbs_notification_outbox
  WHERE tracking_id = 'verify-zbs-live-dispatch:final-retry';

  SELECT id INTO v_final_id
  FROM public.zbs_notification_outbox
  WHERE tracking_id = 'verify-zbs-live-dispatch:final';

  UPDATE public.zbs_notification_outbox
  SET attempt_count = 2
  WHERE id = v_final_retry_id;

  SELECT count(*) INTO v_claimed_count
  FROM public.zbs_notification_outbox_claim_for_dispatch(
    10,
    now(),
    ARRAY[v_sent_id, v_retry_id, v_final_retry_id, v_final_id]
  );

  IF v_claimed_count <> 4 THEN
    RAISE EXCEPTION 'expected 4 claimed rows, got %', v_claimed_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id IN (v_sent_id, v_retry_id, v_final_retry_id, v_final_id)
      AND status <> 'processing'
  ) THEN
    RAISE EXCEPTION 'claim did not move all targeted rows to processing';
  END IF;

  PERFORM public.zbs_notification_outbox_mark_sent(
    v_sent_id,
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

  SELECT coalesce(proacl::text, '') INTO v_acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'zbs_notification_outbox_claim_for_dispatch';

  IF v_acl !~ 'service_role=X' OR v_acl ~ 'authenticated=X' THEN
    RAISE EXCEPTION 'claim RPC grants are not service_role-only: %', v_acl;
  END IF;
END $$;

ROLLBACK;
