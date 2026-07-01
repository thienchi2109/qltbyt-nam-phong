-- Issue #648: tolerate timestamp precision drift when persisting live ZBS dispatch results.
--
-- Rollback strategy: forward-only. Restore the exact lease comparison from
-- 20260630234000_validate_zbs_dispatch_processing_lease.sql in a later
-- CREATE OR REPLACE migration if the client/DB timestamp contract changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_sent(
  p_id uuid,
  p_claimed_at timestamptz,
  p_provider_message_id text,
  p_sent_at timestamptz,
  p_provider_response jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
BEGIN
  IF coalesce(v_claims->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ZBS live dispatch RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

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
    AND status = 'processing'
    AND p_claimed_at IS NOT NULL
    AND last_attempt_at BETWEEN p_claimed_at - interval '1 millisecond'
      AND p_claimed_at + interval '1 millisecond';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ZBS outbox row % is not claimable as sent for this lease', p_id
      USING errcode = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_failed(
  p_id uuid,
  p_claimed_at timestamptz,
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
  v_claims jsonb := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
BEGIN
  IF coalesce(v_claims->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ZBS live dispatch RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

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
    AND outbox.status = 'processing'
    AND p_claimed_at IS NOT NULL
    AND outbox.last_attempt_at BETWEEN p_claimed_at - interval '1 millisecond'
      AND p_claimed_at + interval '1 millisecond';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ZBS outbox row % is not claimable as failed for this lease', p_id
      USING errcode = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.zbs_notification_outbox_mark_sent(uuid, timestamptz, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zbs_notification_outbox_mark_failed(uuid, timestamptz, boolean, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_mark_sent(uuid, timestamptz, text, timestamptz, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_mark_failed(uuid, timestamptz, boolean, text, text, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.zbs_notification_outbox_mark_sent(uuid, timestamptz, text, timestamptz, jsonb) IS
  'Server-only live ZBS dispatcher success boundary. Requires service_role JWT and a matching processing lease timestamp, tolerating client/DB precision drift.';
COMMENT ON FUNCTION public.zbs_notification_outbox_mark_failed(uuid, timestamptz, boolean, text, text, jsonb) IS
  'Server-only live ZBS dispatcher failure boundary. Requires service_role JWT and a matching processing lease timestamp, tolerating client/DB precision drift.';

COMMIT;
