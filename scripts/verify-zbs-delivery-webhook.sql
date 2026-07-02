BEGIN;

DO $$
DECLARE
  v_don_vi_id bigint;
  v_recipient_id uuid;
  v_sent_id uuid;
  v_delivered_id uuid;
  v_unmatched_count integer;
  v_duplicate_received_at timestamptz;
  v_result record;
BEGIN
  SELECT id
    INTO v_don_vi_id
  FROM public.don_vi
  ORDER BY id
  LIMIT 1;

  IF v_don_vi_id IS NULL THEN
    RAISE EXCEPTION 'verify-zbs-delivery-webhook requires at least one public.don_vi row';
  END IF;

  INSERT INTO public.zbs_recipient_configs (don_vi_id, event_type, recipient_phone, active)
  VALUES (v_don_vi_id, 'repair_request_created', '84900000002', true)
  RETURNING id INTO v_recipient_id;

  INSERT INTO public.zbs_notification_outbox (
    provider,
    event_type,
    source_type,
    source_id,
    don_vi_id,
    recipient_config_id,
    recipient_phone,
    template_id,
    template_data,
    tracking_id,
    status,
    provider_message_id,
    provider_response,
    sent_at
  )
  VALUES (
    'zalo_zbs',
    'repair_request_created',
    'repair_request',
    -62101,
    v_don_vi_id,
    v_recipient_id,
    '84900000002',
    'template-test',
    jsonb_build_object('repair_request_id', -62101),
    'verify-zbs-delivery-webhook:sent',
    'sent',
    'existing-provider-message',
    jsonb_build_object('send', 'ok'),
    now() - interval '5 minutes'
  )
  RETURNING id INTO v_sent_id;

  INSERT INTO public.zbs_notification_outbox (
    provider,
    event_type,
    source_type,
    source_id,
    don_vi_id,
    recipient_config_id,
    recipient_phone,
    template_id,
    template_data,
    tracking_id,
    status,
    provider_message_id,
    provider_response,
    sent_at,
    delivered_at,
    delivery_webhook_received_at
  )
  VALUES (
    'zalo_zbs',
    'repair_request_created',
    'repair_request',
    -62102,
    v_don_vi_id,
    v_recipient_id,
    '84900000002',
    'template-test',
    jsonb_build_object('repair_request_id', -62102),
    'verify-zbs-delivery-webhook:delivered',
    'delivered',
    'existing-delivered-message',
    jsonb_build_object('delivery_webhook', jsonb_build_object('tracking_id', 'verify-zbs-delivery-webhook:delivered')),
    now() - interval '10 minutes',
    now() - interval '9 minutes',
    now() - interval '8 minutes'
  )
  RETURNING id INTO v_delivered_id;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","app_role":"to_qltb","user_id":"verify-zbs-delivery-webhook"}',
    true
  );

  BEGIN
    PERFORM public.zbs_notification_outbox_mark_delivered(
      'verify-zbs-delivery-webhook:sent',
      'forbidden-provider-message',
      '84900000002',
      now(),
      now(),
      '{}'::jsonb
    );
    RAISE EXCEPTION 'mark_delivered RPC did not reject non-service_role JWT';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"service_role","app_role":"to_qltb","user_id":"verify-zbs-delivery-webhook"}',
    true
  );

  SELECT *
    INTO v_result
  FROM public.zbs_notification_outbox_mark_delivered(
    'verify-zbs-delivery-webhook:sent',
    'new-provider-message',
    '84900000002',
    '2026-07-02T08:30:00Z'::timestamptz,
    '2026-07-02T08:31:00Z'::timestamptz,
    jsonb_build_object('message_tracking_id', 'verify-zbs-delivery-webhook:sent', 'message_msg_id', 'new-provider-message')
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mark_delivered returned no rows for sent tracking id';
  END IF;

  IF v_result.id IS DISTINCT FROM v_sent_id OR v_result.status <> 'delivered' THEN
    RAISE EXCEPTION 'mark_delivered returned unexpected row: %, %', v_result.id, v_result.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_sent_id
      AND status = 'delivered'
      AND tracking_id = 'verify-zbs-delivery-webhook:sent'
      AND provider_message_id = 'existing-provider-message'
      AND delivered_at = '2026-07-02T08:30:00Z'::timestamptz
      AND delivery_webhook_received_at = '2026-07-02T08:31:00Z'::timestamptz
      AND provider_response->'delivery_webhook'->>'message_tracking_id' = 'verify-zbs-delivery-webhook:sent'
  ) THEN
    RAISE EXCEPTION 'sent row was not marked delivered by tracking_id with preserved provider_message_id';
  END IF;

  SELECT count(*)
    INTO v_unmatched_count
  FROM public.zbs_notification_outbox_mark_delivered(
    'verify-zbs-delivery-webhook:missing',
    'missing-message',
    NULL,
    now(),
    now(),
    '{}'::jsonb
  );

  IF v_unmatched_count <> 0 THEN
    RAISE EXCEPTION 'unmatched tracking id returned rows: %', v_unmatched_count;
  END IF;

  SELECT delivery_webhook_received_at
    INTO v_duplicate_received_at
  FROM public.zbs_notification_outbox
  WHERE id = v_delivered_id;

  PERFORM public.zbs_notification_outbox_mark_delivered(
    'verify-zbs-delivery-webhook:delivered',
    'duplicate-provider-message',
    '84900000002',
    '2026-07-02T08:40:00Z'::timestamptz,
    '2026-07-02T08:41:00Z'::timestamptz,
    jsonb_build_object('message_tracking_id', 'verify-zbs-delivery-webhook:delivered')
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.zbs_notification_outbox
    WHERE id = v_delivered_id
      AND status = 'delivered'
      AND provider_message_id = 'existing-delivered-message'
      AND delivery_webhook_received_at = v_duplicate_received_at
  ) THEN
    RAISE EXCEPTION 'duplicate delivery event was not idempotent';
  END IF;
END;
$$;

ROLLBACK;
