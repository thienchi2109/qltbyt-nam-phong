-- Web Push Phase 4: delivery reporting and lease fencing.
BEGIN;

CREATE FUNCTION public.web_push_delivery_report(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_item jsonb;
  v_delivery record;
  v_result jsonb := '[]'::jsonb;
  v_outcome text;
  v_provider_status integer;
  v_retry_after integer;
  v_revision bigint;
  v_token uuid;
  v_now timestamptz := clock_timestamp();
  v_backoff integer;
  v_next timestamptz;
  v_retry_delay integer;
  v_affected_intents uuid[];
  v_reconcile record;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_request)) <> 2
    OR p_request - ARRAY['version','results'] <> '{}'::jsonb
    OR jsonb_typeof(p_request->'version') IS DISTINCT FROM 'number'
    OR p_request->>'version' <> '1'
    OR jsonb_typeof(p_request->'results') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_request->'results') > 5
    OR octet_length(p_request::text) > 8192 THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;

  -- Validate the complete batch before changing any delivery.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_request->'results') LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(v_item)) <> 6
      OR v_item - ARRAY['delivery_id','attempt_token','subscription_revision','outcome','provider_status','retry_after_seconds'] <> '{}'::jsonb
      OR jsonb_typeof(v_item->'delivery_id') IS DISTINCT FROM 'string'
      OR v_item->>'delivery_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(v_item->'attempt_token') IS DISTINCT FROM 'string'
      OR v_item->>'attempt_token' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(v_item->'subscription_revision') IS DISTINCT FROM 'string'
      OR v_item->>'subscription_revision' !~ '^[1-9][0-9]*$'
      OR jsonb_typeof(v_item->'outcome') IS DISTINCT FROM 'string'
      OR v_item->>'outcome' NOT IN ('accepted','endpoint_gone','transient','permanent','credential_error','not_sent_expired','not_sent_lease_expired','unsafe_endpoint')
      OR NOT (v_item ? 'provider_status')
      OR NOT (v_item ? 'retry_after_seconds')
      OR (v_item->'provider_status' <> 'null'::jsonb
        AND (jsonb_typeof(v_item->'provider_status') IS DISTINCT FROM 'number' OR v_item->>'provider_status' !~ '^[0-9]{3}$'))
      OR (v_item->'retry_after_seconds' <> 'null'::jsonb
        AND (jsonb_typeof(v_item->'retry_after_seconds') IS DISTINCT FROM 'number' OR v_item->>'retry_after_seconds' !~ '^[0-9]+$')) THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    END IF;
    v_outcome := v_item->>'outcome';
    v_provider_status := NULLIF(v_item->>'provider_status', '')::integer;
    v_retry_after := NULLIF(v_item->>'retry_after_seconds', '')::integer;
    IF v_provider_status IS NOT NULL AND (v_provider_status < 100 OR v_provider_status > 599) THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    END IF;
    IF v_retry_after IS NOT NULL AND v_retry_after > 86400 THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    END IF;
    IF v_outcome = 'accepted' AND (v_provider_status IS NULL OR v_provider_status NOT BETWEEN 200 AND 299) THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    ELSIF v_outcome = 'endpoint_gone' AND (v_provider_status IS NULL OR v_provider_status NOT IN (404,410)) THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    ELSIF v_outcome = 'transient' AND v_provider_status IS NOT NULL
      AND v_provider_status NOT IN (408,429) AND v_provider_status NOT BETWEEN 500 AND 599 THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    ELSIF v_outcome = 'credential_error' AND (v_provider_status IS NULL OR v_provider_status NOT IN (401,403)) THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    ELSIF v_outcome IN ('not_sent_expired','not_sent_lease_expired','unsafe_endpoint') AND v_provider_status IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    ELSIF v_outcome = 'permanent' AND (
      v_provider_status IS NULL OR v_provider_status < 300 OR v_provider_status > 499
      OR v_provider_status IN (401,403,404,408,410,429)
    ) THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_request->'results') LOOP
    v_outcome := v_item->>'outcome';
    v_provider_status := NULLIF(v_item->>'provider_status', '')::integer;
    v_retry_after := NULLIF(v_item->>'retry_after_seconds', '')::integer;
    v_revision := (v_item->>'subscription_revision')::bigint;
    v_token := (v_item->>'attempt_token')::uuid;
    SELECT d.* INTO v_delivery
    FROM public.web_push_notification_deliveries d
    WHERE d.id = (v_item->>'delivery_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      v_result := v_result || jsonb_build_array(jsonb_build_object('delivery_id', v_item->>'delivery_id', 'result', 'stale'));
      CONTINUE;
    END IF;

    IF v_delivery.attempt_token = v_token
      AND v_delivery.result->>'outcome' = v_outcome
      AND v_delivery.result->>'provider_status' IS NOT DISTINCT FROM v_item->>'provider_status'
      AND v_delivery.result->>'retry_after_seconds' IS NOT DISTINCT FROM v_item->>'retry_after_seconds'
      AND v_delivery.result->>'subscription_revision' = v_revision::text THEN
      v_result := v_result || jsonb_build_array(jsonb_build_object('delivery_id', v_delivery.id, 'result', 'duplicate'));
      CONTINUE;
    END IF;
    IF v_delivery.status <> 'leased' OR v_delivery.attempt_token IS DISTINCT FROM v_token
      OR v_delivery.subscription_revision <> v_revision OR v_delivery.lease_expires_at <= v_now THEN
      v_result := v_result || jsonb_build_array(jsonb_build_object('delivery_id', v_delivery.id, 'result', 'stale'));
      CONTINUE;
    END IF;

    IF v_outcome = 'not_sent_expired' AND v_delivery.deadline > v_now THEN
      v_result := v_result || jsonb_build_array(jsonb_build_object('delivery_id', v_delivery.id, 'result', 'stale'));
      CONTINUE;
    END IF;

    -- A report is fenced by the same current owner/revision/authorization snapshot
    -- as a claim. An exact repeat already handled above remains duplicate.
    IF NOT EXISTS (
      SELECT 1
      FROM public.web_push_subscriptions s
      JOIN public.nhan_vien nv ON nv.id = s.user_id
      JOIN public.web_push_notification_intents i ON i.id = v_delivery.intent_id
      WHERE s.id = v_delivery.subscription_id
        AND s.user_id = i.recipient_user_id
        AND s.revision = v_delivery.subscription_revision
        AND s.vapid_key_version = v_delivery.vapid_key_version
        AND s.revoked_at IS NULL
        AND s.authorization_epoch IS NOT DISTINCT FROM nv.password_changed_at
        AND public.web_push_subject_can_receive(s.user_id, i.don_vi_id, i.request_id)
        AND EXISTS (
          SELECT 1
          FROM public.yeu_cau_sua_chua yc
          JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
          WHERE yc.id = i.request_id AND tb.don_vi = i.don_vi_id
        )
        AND EXISTS (
          SELECT 1 FROM public.web_push_recipient_configs cfg
          WHERE cfg.don_vi_id = i.don_vi_id AND cfg.user_id = s.user_id
        )
    ) THEN
      v_result := v_result || jsonb_build_array(jsonb_build_object('delivery_id', v_delivery.id, 'result', 'stale'));
      CONTINUE;
    END IF;

    IF v_outcome = 'accepted' THEN
      UPDATE public.web_push_notification_deliveries
      SET status = 'accepted', terminal_at = v_now, worker_id = NULL, leased_at = NULL,
          lease_expires_at = NULL,
          result = jsonb_build_object('outcome', v_outcome, 'provider_status', v_provider_status,
            'retry_after_seconds', v_retry_after, 'subscription_revision', v_revision::text)
      WHERE id = v_delivery.id;
      UPDATE public.web_push_notification_intents SET accepted_count = accepted_count + 1
      WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
    ELSIF v_outcome = 'endpoint_gone' THEN
      -- Cancel every open delivery for this subscription, including siblings on other intents.
      WITH cancelled AS (
        UPDATE public.web_push_notification_deliveries d
        SET status = 'cancelled', terminal_at = v_now, worker_id = NULL, leased_at = NULL,
            lease_expires_at = NULL,
            result = CASE WHEN d.id = v_delivery.id
              THEN jsonb_build_object('outcome', v_outcome, 'provider_status', v_provider_status,
                'retry_after_seconds', v_retry_after, 'subscription_revision', v_revision::text)
              ELSE jsonb_build_object('reason', 'endpoint_gone')
            END
        WHERE d.subscription_id = v_delivery.subscription_id
          AND d.subscription_revision = v_delivery.subscription_revision
          AND d.status IN ('pending','retry','leased')
        RETURNING d.intent_id
      ), counts AS (
        SELECT intent_id, count(*)::integer AS n
        FROM cancelled
        GROUP BY intent_id
      ), updated AS (
        UPDATE public.web_push_notification_intents i
        SET cancelled_count = i.cancelled_count + counts.n
        FROM counts
        WHERE i.id = counts.intent_id
        RETURNING i.id
      )
      SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_affected_intents FROM updated;
      UPDATE public.web_push_subscriptions
      SET revoked_at = COALESCE(revoked_at, v_now), revision = revision + 1, updated_at = v_now
      WHERE id = v_delivery.subscription_id AND revision = v_delivery.subscription_revision;
      FOR v_reconcile IN
        SELECT unnest(v_affected_intents) AS intent_id
      LOOP
        PERFORM public.web_push_intent_reconcile(v_reconcile.intent_id, v_now);
      END LOOP;
    ELSIF v_outcome IN ('permanent','credential_error','unsafe_endpoint') THEN
      UPDATE public.web_push_notification_deliveries
      SET status = 'failed', terminal_at = v_now, worker_id = NULL, leased_at = NULL,
          lease_expires_at = NULL,
          result = jsonb_build_object('outcome', v_outcome, 'provider_status', v_provider_status,
            'retry_after_seconds', v_retry_after, 'subscription_revision', v_revision::text)
      WHERE id = v_delivery.id;
      UPDATE public.web_push_notification_intents SET failed_count = failed_count + 1
      WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
    ELSIF v_outcome = 'not_sent_expired' THEN
      UPDATE public.web_push_notification_deliveries
      SET status = 'expired', terminal_at = v_now, worker_id = NULL, leased_at = NULL,
          lease_expires_at = NULL,
          result = jsonb_build_object('outcome', v_outcome, 'provider_status', NULL,
            'retry_after_seconds', v_retry_after, 'subscription_revision', v_revision::text)
      WHERE id = v_delivery.id;
      UPDATE public.web_push_notification_intents SET expired_count = expired_count + 1
      WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
    ELSE
      v_backoff := least(3600, 5 * (2 ^ least(greatest(v_delivery.attempt - 1, 0), 10)));
      v_retry_delay := ceil(greatest(v_backoff, coalesce(v_retry_after, 0)) * (1 + random() * 0.2))::integer;
      v_next := v_now + make_interval(secs => v_retry_delay);
      IF v_next >= v_delivery.deadline THEN
        UPDATE public.web_push_notification_deliveries
        SET status = 'expired', terminal_at = v_now, worker_id = NULL, leased_at = NULL,
            lease_expires_at = NULL,
            result = jsonb_build_object('outcome', 'not_sent_expired', 'provider_status', NULL,
              'retry_after_seconds', v_retry_after, 'subscription_revision', v_revision::text)
        WHERE id = v_delivery.id;
        UPDATE public.web_push_notification_intents SET expired_count = expired_count + 1
        WHERE id = v_delivery.intent_id AND terminal_at IS NULL;
      ELSE
        UPDATE public.web_push_notification_deliveries
        SET status = 'retry', worker_id = NULL, leased_at = NULL, lease_expires_at = NULL,
            next_attempt_at = v_next,
            result = jsonb_build_object('outcome', v_outcome, 'provider_status', v_provider_status,
              'retry_after_seconds', v_retry_after, 'subscription_revision', v_revision::text)
        WHERE id = v_delivery.id;
      END IF;
    END IF;

    UPDATE public.web_push_notification_intents i
    SET status = 'completed', terminal_at = v_now,
        next_attempt_at = v_now
    WHERE i.id = v_delivery.intent_id AND i.terminal_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.web_push_notification_deliveries d
        WHERE d.intent_id = i.id AND d.terminal_at IS NULL
      );
    v_result := v_result || jsonb_build_array(jsonb_build_object('delivery_id', v_delivery.id, 'result', 'applied'));
  END LOOP;
  RETURN jsonb_build_object('version', 1, 'results', v_result);
END;
$function$;

REVOKE ALL ON FUNCTION public.web_push_delivery_report(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_delivery_report(jsonb) TO service_role;

COMMIT;
