-- Web Push Phase 4: rollout controls and worker replay protection.
BEGIN;

ALTER TABLE public.web_push_runtime_controls
  ADD COLUMN registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN dispatch_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN registration_canary_don_vi_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  ADD COLUMN dispatch_canary_don_vi_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  ADD COLUMN vapid_key_version text,
  ADD COLUMN vapid_public_key text,
  ADD COLUMN vapid_fingerprint text,
  ADD COLUMN vapid_subject text,
  ADD COLUMN web_push_retention_last_run_at timestamptz,
  ADD CONSTRAINT web_push_runtime_controls_vapid_version_ck CHECK (
    vapid_key_version IS NULL OR vapid_key_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
  ),
  ADD CONSTRAINT web_push_runtime_controls_vapid_public_key_ck CHECK (
    vapid_public_key IS NULL OR vapid_public_key ~ '^[A-Za-z0-9_-]{87}$'
  ),
  ADD CONSTRAINT web_push_runtime_controls_vapid_fingerprint_ck CHECK (
    vapid_fingerprint IS NULL OR vapid_fingerprint ~ '^sha256:[0-9a-f]{64}$'
  );

CREATE FUNCTION public.web_push_runtime_controls_get()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_controls public.web_push_runtime_controls%ROWTYPE;
  v_vapid jsonb;
  v_vapid_ready boolean;
BEGIN
  SELECT * INTO v_controls
  FROM public.web_push_runtime_controls
  WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'unavailable' USING ERRCODE = 'P0001'; END IF;
  v_vapid_ready := v_controls.vapid_key_version IS NOT NULL
    AND v_controls.vapid_public_key IS NOT NULL
    AND v_controls.vapid_fingerprint IS NOT NULL;
  v_vapid := CASE WHEN v_vapid_ready THEN jsonb_build_object(
    'version', v_controls.vapid_key_version,
    'public_key', v_controls.vapid_public_key,
    'fingerprint', v_controls.vapid_fingerprint
  ) ELSE NULL::jsonb END;
  RETURN jsonb_build_object(
    'version', 1,
    'registration_enabled', v_controls.registration_enabled
      AND cardinality(v_controls.registration_canary_don_vi_ids) > 0
      AND v_vapid_ready,
    'dispatch_enabled', v_controls.dispatch_enabled
      AND cardinality(v_controls.dispatch_canary_don_vi_ids) > 0
      AND v_vapid_ready,
    'vapid', v_vapid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_runtime_controls_get()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_runtime_controls_get() TO service_role;

-- Registration remains session-owned, with a SQL-enforced rollout switch.
ALTER FUNCTION public.web_push_subscription_register(jsonb, text)
  RENAME TO web_push_subscription_register_unchecked;
REVOKE ALL ON FUNCTION public.web_push_subscription_register_unchecked(jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.web_push_subscription_register(p_subscription jsonb, p_vapid_key_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT COALESCE((SELECT registration_enabled FROM public.web_push_runtime_controls WHERE singleton), false) THEN
    RAISE EXCEPTION 'registration_disabled' USING ERRCODE = 'P0001';
  END IF;
  IF p_vapid_key_version IS NULL OR p_vapid_key_version IS DISTINCT FROM
    (SELECT vapid_key_version FROM public.web_push_runtime_controls WHERE singleton) THEN
    RAISE EXCEPTION 'key_version_mismatch' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.web_push_runtime_controls controls
    CROSS JOIN LATERAL unnest(controls.registration_canary_don_vi_ids) AS canary(don_vi_id)
    WHERE controls.singleton
      AND public.web_push_subject_can_receive(public.web_push_session_user_id(), canary.don_vi_id)
  ) THEN
    RAISE EXCEPTION 'registration_disabled' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.web_push_subscription_register_unchecked(p_subscription, p_vapid_key_version);
END;
$function$;

CREATE FUNCTION public.web_push_retention_run(p_now timestamptz DEFAULT clock_timestamp())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_last_run timestamptz;
  v_deleted_nonces integer := 0;
  v_deleted_deliveries integer := 0;
  v_deleted_intents integer := 0;
  v_deleted_subscriptions integer := 0;
BEGIN
  SELECT web_push_retention_last_run_at INTO v_last_run
  FROM public.web_push_runtime_controls
  WHERE singleton
  FOR UPDATE;
  IF v_last_run IS NOT NULL AND v_last_run > p_now - interval '1 hour' THEN
    RETURN jsonb_build_object('version', 1, 'ran', false, 'deleted_nonces', 0,
      'deleted_deliveries', 0, 'deleted_intents', 0, 'deleted_subscriptions', 0);
  END IF;
  UPDATE public.web_push_runtime_controls
  SET web_push_retention_last_run_at = p_now
  WHERE singleton;

  WITH doomed AS (
    SELECT ctid FROM public.web_push_worker_nonces
    WHERE expires_at <= p_now ORDER BY expires_at LIMIT 500
  )
  DELETE FROM public.web_push_worker_nonces n USING doomed
  WHERE n.ctid = doomed.ctid;
  GET DIAGNOSTICS v_deleted_nonces = ROW_COUNT;

  WITH doomed AS (
    SELECT ctid FROM public.web_push_notification_deliveries
    WHERE terminal_at IS NOT NULL AND terminal_at <= p_now - interval '7 days'
    ORDER BY terminal_at, id LIMIT 500
  )
  DELETE FROM public.web_push_notification_deliveries d USING doomed
  WHERE d.ctid = doomed.ctid;
  GET DIAGNOSTICS v_deleted_deliveries = ROW_COUNT;

  WITH doomed AS (
    SELECT ctid FROM public.web_push_notification_intents i
    WHERE i.terminal_at IS NOT NULL AND i.terminal_at <= p_now - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.web_push_notification_deliveries d WHERE d.intent_id = i.id
      )
    ORDER BY i.terminal_at, i.id LIMIT 500
  )
  DELETE FROM public.web_push_notification_intents i USING doomed
  WHERE i.ctid = doomed.ctid;
  GET DIAGNOSTICS v_deleted_intents = ROW_COUNT;

  WITH doomed AS (
    SELECT ctid FROM public.web_push_subscriptions s
    WHERE s.revoked_at IS NOT NULL AND s.revoked_at <= p_now - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.web_push_notification_deliveries d WHERE d.subscription_id = s.id
      )
    ORDER BY s.revoked_at, s.id LIMIT 500
  )
  DELETE FROM public.web_push_subscriptions s USING doomed
  WHERE s.ctid = doomed.ctid;
  GET DIAGNOSTICS v_deleted_subscriptions = ROW_COUNT;

  RETURN jsonb_build_object('version', 1, 'ran', true,
    'deleted_nonces', v_deleted_nonces, 'deleted_deliveries', v_deleted_deliveries,
    'deleted_intents', v_deleted_intents, 'deleted_subscriptions', v_deleted_subscriptions);
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_retention_run(timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_retention_run(timestamptz) TO service_role;

CREATE FUNCTION public.web_push_worker_nonce_consume(p_key_id text, p_nonce text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_key_id IS NULL OR p_key_id !~ '^[a-z0-9-]{1,64}$'
    OR p_nonce IS NULL OR p_nonce !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;

  -- Serialize one key's replay and throttle windows across all API instances.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_id, 0));
  DELETE FROM public.web_push_worker_nonces WHERE expires_at <= v_now;
  IF EXISTS (
    SELECT 1 FROM public.web_push_worker_nonces
    WHERE key_id = p_key_id AND nonce = p_nonce
  ) THEN
    RETURN false;
  END IF;
  IF (
    SELECT count(*) FROM public.web_push_worker_nonces
    WHERE key_id = p_key_id AND created_at > v_now - interval '60 seconds'
  ) >= 60 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.web_push_worker_nonces(key_id, nonce, created_at, expires_at)
  VALUES (p_key_id, p_nonce, v_now, v_now + interval '180 seconds');
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_subscription_register(jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_worker_nonce_consume(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_subscription_register(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_worker_nonce_consume(text, text) TO service_role;

COMMIT;
