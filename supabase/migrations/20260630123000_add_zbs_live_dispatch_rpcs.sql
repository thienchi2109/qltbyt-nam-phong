-- Issue #620 Phase 3: live ZBS dispatch write boundaries.
--
-- Scope:
-- - Server-only claim/send/fail RPCs for the existing ZBS outbox.
-- - No webhook handling, scheduler configuration, or legacy repair push trigger changes.

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_claim_for_dispatch(
  p_limit integer DEFAULT 25,
  p_now timestamptz DEFAULT now(),
  p_outbox_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  event_type text,
  source_type text,
  source_id bigint,
  don_vi_id bigint,
  recipient_config_id uuid,
  recipient_phone text,
  template_id text,
  template_data jsonb,
  tracking_id text,
  status text,
  provider text,
  next_attempt_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH claimed AS (
    SELECT outbox.id
    FROM public.zbs_notification_outbox outbox
    WHERE outbox.status = 'pending'
      AND outbox.provider = 'zalo_zbs'
      AND outbox.event_type = 'repair_request_created'
      AND outbox.source_type = 'repair_request'
      AND outbox.next_attempt_at <= coalesce(p_now, now())
      AND (
        p_outbox_ids IS NULL
        OR outbox.id = ANY(p_outbox_ids)
      )
    ORDER BY outbox.created_at ASC
    LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.zbs_notification_outbox outbox
    SET
      status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      last_attempt_at = coalesce(p_now, now()),
      updated_at = now()
    FROM claimed
    WHERE outbox.id = claimed.id
    RETURNING
      outbox.id,
      outbox.event_type,
      outbox.source_type,
      outbox.source_id,
      outbox.don_vi_id,
      outbox.recipient_config_id,
      outbox.recipient_phone,
      outbox.template_id,
      outbox.template_data,
      outbox.tracking_id,
      outbox.status,
      outbox.provider,
      outbox.next_attempt_at,
      outbox.created_at
  )
  SELECT
    updated.id,
    updated.event_type,
    updated.source_type,
    updated.source_id,
    updated.don_vi_id,
    updated.recipient_config_id,
    updated.recipient_phone,
    updated.template_id,
    updated.template_data,
    updated.tracking_id,
    updated.status,
    updated.provider,
    updated.next_attempt_at
  FROM updated
  ORDER BY updated.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_sent(
  p_id uuid,
  p_provider_message_id text,
  p_sent_at timestamptz,
  p_provider_response jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.zbs_notification_outbox
  SET
    status = 'sent',
    provider_message_id = NULLIF(p_provider_message_id, ''),
    provider_response = coalesce(p_provider_response, '{}'::jsonb),
    last_error_code = NULL,
    last_error_message = NULL,
    sent_at = coalesce(p_sent_at, now()),
    updated_at = now()
  WHERE id = p_id
    AND provider = 'zalo_zbs'
    AND status = 'processing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ZBS outbox row % is not claimable as sent', p_id
      USING errcode = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_failed(
  p_id uuid,
  p_retryable boolean,
  p_error_code text,
  p_error_message text,
  p_provider_response jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  UPDATE public.zbs_notification_outbox outbox
  SET
    status = CASE
      WHEN coalesce(p_retryable, false) AND outbox.attempt_count < 3 THEN 'pending'
      ELSE 'failed'
    END,
    next_attempt_at = CASE
      WHEN coalesce(p_retryable, false) AND outbox.attempt_count = 1 THEN v_now + interval '5 minutes'
      WHEN coalesce(p_retryable, false) AND outbox.attempt_count = 2 THEN v_now + interval '30 minutes'
      ELSE outbox.next_attempt_at
    END,
    provider_response = coalesce(p_provider_response, '{}'::jsonb),
    last_error_code = NULLIF(p_error_code, ''),
    last_error_message = NULLIF(p_error_message, ''),
    updated_at = v_now
  WHERE outbox.id = p_id
    AND outbox.provider = 'zalo_zbs'
    AND outbox.status = 'processing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ZBS outbox row % is not claimable as failed', p_id
      USING errcode = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.zbs_notification_outbox_claim_for_dispatch(integer, timestamptz, uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zbs_notification_outbox_mark_sent(uuid, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zbs_notification_outbox_mark_failed(uuid, boolean, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_claim_for_dispatch(integer, timestamptz, uuid[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_mark_sent(uuid, text, timestamptz, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_mark_failed(uuid, boolean, text, text, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.zbs_notification_outbox_claim_for_dispatch(integer, timestamptz, uuid[]) IS
  'Server-only live ZBS dispatcher claim boundary. Moves due pending repair-request ZBS rows to processing using SKIP LOCKED.';
COMMENT ON FUNCTION public.zbs_notification_outbox_mark_sent(uuid, text, timestamptz, jsonb) IS
  'Server-only live ZBS dispatcher success boundary. Persists provider msg_id, sent timestamp, and sanitized provider metadata.';
COMMENT ON FUNCTION public.zbs_notification_outbox_mark_failed(uuid, boolean, text, text, jsonb) IS
  'Server-only live ZBS dispatcher failure boundary. Persists sanitized provider/network error metadata and applies per-row retry policy.';
