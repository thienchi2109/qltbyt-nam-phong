-- Web Push Phase 4: atomic worker claim/report and lease fencing.
BEGIN;

CREATE FUNCTION public.web_push_intent_reconcile(p_intent_id uuid, p_now timestamptz DEFAULT clock_timestamp())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_deadline timestamptz;
  v_status text;
  v_children integer;
  v_open_children integer;
BEGIN
  SELECT i.deadline, i.status INTO v_deadline, v_status
  FROM public.web_push_notification_intents i
  WHERE i.id = p_intent_id AND i.terminal_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*)::integer, count(*) FILTER (WHERE d.terminal_at IS NULL)::integer
  INTO v_children, v_open_children
  FROM public.web_push_notification_deliveries d
  WHERE d.intent_id = p_intent_id;
  IF v_children = 0 OR v_open_children > 0 THEN RETURN; END IF;

  UPDATE public.web_push_notification_intents
  SET status = CASE WHEN v_deadline <= p_now THEN 'expired' ELSE 'completed' END,
      terminal_at = p_now,
      next_attempt_at = p_now
  WHERE id = p_intent_id AND terminal_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_intent_reconcile(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_intent_reconcile(uuid, timestamptz) TO service_role;

CREATE FUNCTION public.web_push_delivery_claim(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_intent record;
  v_delivery record;
  v_claimed record;
  v_limit integer;
  v_deliveries jsonb := '[]'::jsonb;
  v_has_subscription boolean;
  v_subject_authorized boolean;
  v_lease_expires timestamptz;
  v_backoff integer;
  v_inserted integer;
  v_reconcile record;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_request)) <> 5
    OR p_request - ARRAY['version','worker_id','limit','vapid_key_version','vapid_fingerprint'] <> '{}'::jsonb
    OR jsonb_typeof(p_request->'version') IS DISTINCT FROM 'number'
    OR p_request->>'version' <> '1'
    OR jsonb_typeof(p_request->'worker_id') IS DISTINCT FROM 'string'
    OR p_request->>'worker_id' !~ '^[a-z0-9-]{1,64}$'
    OR jsonb_typeof(p_request->'limit') IS DISTINCT FROM 'number'
    OR p_request->>'limit' !~ '^[1-5]$'
    OR jsonb_typeof(p_request->'vapid_key_version') IS DISTINCT FROM 'string'
    OR p_request->>'vapid_key_version' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    OR jsonb_typeof(p_request->'vapid_fingerprint') IS DISTINCT FROM 'string'
    OR p_request->>'vapid_fingerprint' !~ '^sha256:[0-9a-f]{64}$'
    OR octet_length(p_request::text) > 2048 THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE((SELECT dispatch_enabled FROM public.web_push_runtime_controls WHERE singleton), false) THEN
    RAISE EXCEPTION 'dispatch_disabled' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.web_push_runtime_controls controls
    WHERE controls.singleton
      AND controls.vapid_key_version IS NOT NULL
      AND controls.vapid_fingerprint IS NOT NULL
      AND controls.vapid_key_version = p_request->>'vapid_key_version'
      AND controls.vapid_fingerprint = p_request->>'vapid_fingerprint'
  ) THEN
    RAISE EXCEPTION 'key_version_mismatch' USING ERRCODE = '40001';
  END IF;
  v_limit := (p_request->>'limit')::integer;
  PERFORM public.web_push_retention_run(v_now);

  -- Password changes invalidate every active subscription before fan-out.
  UPDATE public.web_push_subscriptions s
  SET revoked_at = v_now, revision = s.revision + 1, updated_at = v_now
  FROM public.nhan_vien nv
  WHERE nv.id = s.user_id
    AND s.revoked_at IS NULL
    AND s.authorization_epoch IS DISTINCT FROM nv.password_changed_at;
  WITH cancelled AS (
    UPDATE public.web_push_notification_deliveries d
    SET status = 'cancelled', terminal_at = v_now, worker_id = NULL,
        leased_at = NULL, lease_expires_at = NULL,
      result = jsonb_build_object('reason', 'authorization_epoch_changed')
    WHERE d.status IN ('pending', 'retry', 'leased')
      AND EXISTS (
        SELECT 1 FROM public.web_push_subscriptions s
        WHERE s.id = d.subscription_id AND s.revoked_at = v_now
      )
    RETURNING d.intent_id
  ), counts AS (
    SELECT intent_id, count(*)::integer AS n FROM cancelled GROUP BY intent_id
  )
  UPDATE public.web_push_notification_intents i
  SET cancelled_count = i.cancelled_count + counts.n
  FROM counts
  WHERE i.id = counts.intent_id AND i.terminal_at IS NULL;
  FOR v_reconcile IN
    SELECT DISTINCT d.intent_id
    FROM public.web_push_notification_deliveries d
    WHERE d.status = 'cancelled' AND d.terminal_at = v_now
  LOOP
    PERFORM public.web_push_intent_reconcile(v_reconcile.intent_id, v_now);
  END LOOP;

  -- Close work whose deadline or attempt budget has already elapsed.
  WITH expired AS (
    UPDATE public.web_push_notification_deliveries
    SET status = 'expired', terminal_at = v_now, worker_id = NULL,
        leased_at = NULL, lease_expires_at = NULL,
        result = jsonb_build_object('reason', 'deadline_expired')
    WHERE status IN ('pending', 'retry', 'leased') AND deadline <= v_now
    RETURNING intent_id
  ), counts AS (
    SELECT intent_id, count(*) AS n FROM expired GROUP BY intent_id
  )
  UPDATE public.web_push_notification_intents i
  SET expired_count = i.expired_count + counts.n
  FROM counts WHERE i.id = counts.intent_id AND i.terminal_at IS NULL;
  FOR v_reconcile IN
    SELECT DISTINCT d.intent_id
    FROM public.web_push_notification_deliveries d
    WHERE d.status = 'expired' AND d.terminal_at = v_now
  LOOP
    PERFORM public.web_push_intent_reconcile(v_reconcile.intent_id, v_now);
  END LOOP;
  UPDATE public.web_push_notification_intents i
  SET status = 'expired', terminal_at = v_now, next_attempt_at = v_now
  WHERE i.status IN ('pending', 'materialized') AND i.deadline <= v_now
    AND i.terminal_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.web_push_notification_deliveries d
      WHERE d.intent_id = i.id AND d.terminal_at IS NULL
    );

  -- Reclaim leases without granting a worker a second attempt.
  FOR v_delivery IN
    SELECT d.*
    FROM public.web_push_notification_deliveries d
    WHERE d.status = 'leased' AND d.lease_expires_at <= v_now
    ORDER BY d.lease_expires_at, d.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  LOOP
    IF v_delivery.deadline <= v_now THEN
      UPDATE public.web_push_notification_deliveries
      SET status = 'expired', terminal_at = v_now, worker_id = NULL,
          leased_at = NULL, lease_expires_at = NULL,
          result = jsonb_build_object('reason', 'lease_expired')
      WHERE id = v_delivery.id;
      UPDATE public.web_push_notification_intents
      SET expired_count = expired_count + 1
      WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
      PERFORM public.web_push_intent_reconcile(v_delivery.intent_id, v_now);
    ELSIF v_delivery.attempt >= 100 THEN
      UPDATE public.web_push_notification_deliveries
      SET status = 'failed', terminal_at = v_now, worker_id = NULL,
          leased_at = NULL, lease_expires_at = NULL,
          result = jsonb_build_object('reason', 'attempt_limit')
      WHERE id = v_delivery.id;
      UPDATE public.web_push_notification_intents
      SET failed_count = failed_count + 1
      WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
      PERFORM public.web_push_intent_reconcile(v_delivery.intent_id, v_now);
    ELSE
      v_backoff := least(3600, 5 * (2 ^ least(greatest(v_delivery.attempt - 1, 0), 10)));
      UPDATE public.web_push_notification_deliveries
      SET status = 'retry', worker_id = NULL, leased_at = NULL, lease_expires_at = NULL,
          next_attempt_at = least(deadline, v_now + make_interval(secs => ceil(v_backoff * (1 + random() * 0.2))::integer)),
          result = jsonb_build_object('reason', 'lease_expired')
      WHERE id = v_delivery.id;
    END IF;
  END LOOP;

  -- Fan out each intent once, at the first claim after a subscription exists.
  FOR v_intent IN
    SELECT i.*
    FROM public.web_push_notification_intents i
    WHERE i.status = 'pending' AND i.materialized_at IS NULL AND i.next_attempt_at <= v_now
      AND i.don_vi_id = ANY(COALESCE((SELECT dispatch_canary_don_vi_ids
                                      FROM public.web_push_runtime_controls WHERE singleton), '{}'::bigint[]))
    ORDER BY i.created_at, i.id
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  LOOP
    IF v_intent.deadline <= v_now THEN
      UPDATE public.web_push_notification_intents
      SET status = 'expired', terminal_at = v_now, expired_count = expired_count + 1
      WHERE id = v_intent.id AND terminal_at IS NULL;
      CONTINUE;
    END IF;

    SELECT public.web_push_subject_can_receive(v_intent.recipient_user_id, v_intent.don_vi_id, v_intent.request_id)
      AND EXISTS (
        SELECT 1
        FROM public.yeu_cau_sua_chua yc
        JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
        WHERE yc.id = v_intent.request_id AND tb.don_vi = v_intent.don_vi_id
      )
      AND EXISTS (
        SELECT 1
        FROM public.web_push_recipient_configs cfg
        WHERE cfg.don_vi_id = v_intent.don_vi_id AND cfg.user_id = v_intent.recipient_user_id
      )
    INTO v_subject_authorized;
    IF NOT v_subject_authorized THEN
      UPDATE public.web_push_notification_intents
      SET status = 'cancelled', terminal_at = v_now, cancelled_count = cancelled_count + 1,
          next_attempt_at = v_now
      WHERE id = v_intent.id AND terminal_at IS NULL;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.web_push_subscriptions s
      JOIN public.nhan_vien nv ON nv.id = s.user_id
      JOIN public.web_push_runtime_controls controls ON controls.singleton
      WHERE s.user_id = v_intent.recipient_user_id
        AND s.revoked_at IS NULL
        AND s.authorization_epoch IS NOT DISTINCT FROM nv.password_changed_at
        AND s.vapid_key_version = controls.vapid_key_version
    ) INTO v_has_subscription;

    IF NOT v_has_subscription THEN
      UPDATE public.web_push_notification_intents
      SET next_attempt_at = least(deadline, v_now + interval '60 seconds')
      WHERE id = v_intent.id AND terminal_at IS NULL;
      CONTINUE;
    END IF;

    INSERT INTO public.web_push_notification_deliveries(
      intent_id, subscription_identity, subscription_id, subscription_revision,
      vapid_key_version, created_at, deadline
    )
    SELECT v_intent.id, s.id, s.id, s.revision, s.vapid_key_version,
      v_now, v_intent.deadline
    FROM public.web_push_subscriptions s
    JOIN public.nhan_vien nv ON nv.id = s.user_id
    JOIN public.web_push_runtime_controls controls ON controls.singleton
    WHERE s.user_id = v_intent.recipient_user_id
      AND s.revoked_at IS NULL
      AND s.authorization_epoch IS NOT DISTINCT FROM nv.password_changed_at
      AND s.vapid_key_version = controls.vapid_key_version
      AND public.web_push_subject_can_receive(s.user_id, v_intent.don_vi_id, v_intent.request_id)
      AND EXISTS (
        SELECT 1 FROM public.web_push_recipient_configs cfg
        WHERE cfg.don_vi_id = v_intent.don_vi_id AND cfg.user_id = s.user_id
      )
    ON CONFLICT (intent_id, subscription_identity) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      UPDATE public.web_push_notification_intents
      SET materialized_at = v_now, status = 'materialized', next_attempt_at = v_now
      WHERE id = v_intent.id AND terminal_at IS NULL;
    ELSE
      UPDATE public.web_push_notification_intents
      SET next_attempt_at = least(deadline, v_now + interval '60 seconds')
      WHERE id = v_intent.id AND terminal_at IS NULL;
    END IF;
  END LOOP;

  -- Expire exhausted deliveries before selecting fresh work.
  WITH exhausted AS (
    UPDATE public.web_push_notification_deliveries
    SET status = 'failed', terminal_at = v_now,
        result = jsonb_build_object('reason', 'attempt_limit')
    WHERE status IN ('pending','retry') AND attempt >= 100 AND deadline > v_now
    RETURNING intent_id
  ), counts AS (
    SELECT intent_id, count(*) AS n FROM exhausted GROUP BY intent_id
  )
  UPDATE public.web_push_notification_intents i
  SET failed_count = i.failed_count + counts.n
  FROM counts WHERE i.id = counts.intent_id AND i.terminal_at IS NULL;
  FOR v_reconcile IN
    SELECT DISTINCT d.intent_id
    FROM public.web_push_notification_deliveries d
    WHERE d.status = 'failed' AND d.terminal_at = v_now
  LOOP
    PERFORM public.web_push_intent_reconcile(v_reconcile.intent_id, v_now);
  END LOOP;

  FOR v_delivery IN
    SELECT d.*
    FROM public.web_push_notification_deliveries d
    JOIN public.web_push_notification_intents i ON i.id = d.intent_id
    WHERE d.status IN ('pending','retry') AND d.next_attempt_at <= v_now
      AND d.deadline > v_now AND i.terminal_at IS NULL
      AND d.vapid_key_version = p_request->>'vapid_key_version'
      AND i.don_vi_id = ANY(COALESCE((SELECT dispatch_canary_don_vi_ids
                                      FROM public.web_push_runtime_controls WHERE singleton), '{}'::bigint[]))
    ORDER BY d.next_attempt_at, d.created_at, d.id
    FOR UPDATE OF d SKIP LOCKED
    LIMIT v_limit
  LOOP
    -- A changed owner, revision, epoch, authorization or config fences the job.
    IF NOT EXISTS (
      SELECT 1
      FROM public.web_push_subscriptions s
      JOIN public.nhan_vien nv ON nv.id = s.user_id
      WHERE s.id = v_delivery.subscription_id
        AND s.user_id = (SELECT recipient_user_id FROM public.web_push_notification_intents WHERE id = v_delivery.intent_id)
        AND s.revision = v_delivery.subscription_revision
        AND s.vapid_key_version = v_delivery.vapid_key_version
        AND s.revoked_at IS NULL
        AND s.authorization_epoch IS NOT DISTINCT FROM nv.password_changed_at
        AND public.web_push_subject_can_receive(s.user_id,
          (SELECT don_vi_id FROM public.web_push_notification_intents WHERE id = v_delivery.intent_id),
          (SELECT request_id FROM public.web_push_notification_intents WHERE id = v_delivery.intent_id))
        AND EXISTS (
          SELECT 1 FROM public.web_push_recipient_configs cfg
          JOIN public.web_push_notification_intents i ON i.id = v_delivery.intent_id
          WHERE cfg.don_vi_id = i.don_vi_id AND cfg.user_id = s.user_id
        )
        AND EXISTS (
          SELECT 1
          FROM public.yeu_cau_sua_chua yc
          JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
          JOIN public.web_push_notification_intents i ON i.id = v_delivery.intent_id
          WHERE yc.id = i.request_id AND tb.don_vi = i.don_vi_id
        )
    ) THEN
      UPDATE public.web_push_notification_deliveries
      SET status = 'cancelled', terminal_at = v_now,
          result = jsonb_build_object('reason', 'authorization_changed')
      WHERE id = v_delivery.id AND terminal_at IS NULL;
      UPDATE public.web_push_notification_intents
      SET cancelled_count = cancelled_count + 1
      WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
      PERFORM public.web_push_intent_reconcile(v_delivery.intent_id, v_now);
      CONTINUE;
    END IF;

    v_lease_expires := least(v_delivery.deadline, v_now + interval '45 seconds');
    IF v_lease_expires <= v_now THEN CONTINUE; END IF;
    UPDATE public.web_push_notification_deliveries
    SET status = 'leased', attempt = attempt + 1, attempt_token = gen_random_uuid(),
        worker_id = p_request->>'worker_id', leased_at = v_now,
        lease_expires_at = v_lease_expires, next_attempt_at = v_now
    WHERE id = v_delivery.id AND status IN ('pending','retry')
    RETURNING * INTO v_claimed;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_deliveries := v_deliveries || jsonb_build_array(jsonb_build_object(
      'delivery_id', v_claimed.id,
      'attempt_token', v_claimed.attempt_token,
      'attempt', v_claimed.attempt,
      'subscription_id', v_claimed.subscription_id,
      'subscription_revision', v_claimed.subscription_revision::text,
      'lease_expires_at', to_char(v_claimed.lease_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'deadline', to_char(v_claimed.deadline AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ttl_seconds', greatest(0, floor(extract(epoch FROM (v_claimed.deadline - v_now)))::integer),
      'vapid_key_version', v_claimed.vapid_key_version,
      'endpoint', s.endpoint,
      'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth),
      'payload_base64', replace(encode(convert_to(i.payload::text, 'UTF8'), 'base64'), E'\n', '')
    ))
    FROM public.web_push_subscriptions s
    JOIN public.web_push_notification_intents i ON i.id = v_claimed.intent_id
    WHERE s.id = v_claimed.subscription_id;
  END LOOP;

  RETURN jsonb_build_object(
    'version', 1,
    'server_time', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'poll_after_seconds', 5,
    'deliveries', v_deliveries
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_subscription_register(jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_worker_nonce_consume(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_delivery_claim(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_subscription_register(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_worker_nonce_consume(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_push_delivery_claim(jsonb) TO service_role;

COMMIT;
