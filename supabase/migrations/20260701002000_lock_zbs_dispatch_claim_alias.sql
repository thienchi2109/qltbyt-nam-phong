-- Issue #620 Phase 3 follow-up: make claim-row locking explicit on the outbox alias.
--
-- Rollback strategy: forward-only. Restore the claim RPC body from
-- 20260701001000_extract_zbs_dispatch_status_constants.sql in a later
-- CREATE OR REPLACE migration if this locking behavior changes.

BEGIN;

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
  last_attempt_at timestamptz,
  next_attempt_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status_processing constant text := 'processing';
  v_status_failed constant text := 'failed';
  v_claims jsonb := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
  v_now timestamptz := coalesce(p_now, now());
BEGIN
  IF coalesce(v_claims->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ZBS live dispatch RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH expired_ids AS (
    SELECT outbox.id
    FROM public.zbs_notification_outbox outbox
    WHERE outbox.provider = 'zalo_zbs'
      AND outbox.event_type = 'repair_request_created'
      AND outbox.source_type = 'repair_request'
      AND outbox.status = v_status_processing
      AND outbox.last_attempt_at <= v_now - interval '10 minutes'
      AND outbox.attempt_count >= 3
      AND (
        p_outbox_ids IS NULL
        OR outbox.id = ANY(p_outbox_ids)
      )
    ORDER BY outbox.created_at ASC
    LIMIT least(greatest(coalesce(p_limit, 25), 0), 100)
    FOR UPDATE OF outbox SKIP LOCKED
  ),
  expired_processing AS (
    UPDATE public.zbs_notification_outbox outbox
    SET
      status = v_status_failed,
      next_attempt_at = outbox.next_attempt_at,
      last_error_code = 'dispatch_lease_expired',
      last_error_message = 'ZBS processing lease expired after final attempt',
      updated_at = now()
    FROM expired_ids
    WHERE outbox.id = expired_ids.id
  ),
  claimed AS (
    SELECT outbox.id
    FROM public.zbs_notification_outbox outbox
    WHERE outbox.provider = 'zalo_zbs'
      AND outbox.event_type = 'repair_request_created'
      AND outbox.source_type = 'repair_request'
      AND outbox.attempt_count < 3
      AND (
        (
          outbox.status = 'pending'
          AND outbox.next_attempt_at <= v_now
        )
        OR (
          outbox.status = v_status_processing
          AND outbox.last_attempt_at <= v_now - interval '10 minutes'
        )
      )
      AND (
        p_outbox_ids IS NULL
        OR outbox.id = ANY(p_outbox_ids)
      )
    ORDER BY outbox.created_at ASC
    LIMIT least(greatest(coalesce(p_limit, 25), 0), 100)
    FOR UPDATE OF outbox SKIP LOCKED
  ),
  updated AS (
    UPDATE public.zbs_notification_outbox outbox
    SET
      status = v_status_processing,
      attempt_count = outbox.attempt_count + 1,
      last_attempt_at = v_now,
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
      outbox.last_attempt_at,
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
    updated.last_attempt_at,
    updated.next_attempt_at
  FROM updated
  ORDER BY updated.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.zbs_notification_outbox_claim_for_dispatch(integer, timestamptz, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_claim_for_dispatch(integer, timestamptz, uuid[])
  TO service_role;

COMMENT ON FUNCTION public.zbs_notification_outbox_claim_for_dispatch(integer, timestamptz, uuid[]) IS
  'Server-only live ZBS dispatcher claim boundary. Reclaims stale processing rows only before the final attempt cap; final-attempt expiry is bounded and row locks target the outbox alias explicitly.';

COMMIT;
