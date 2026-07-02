-- Issue #621 Phase 4: inbound ZBS delivery webhook persistence.
--
-- Scope:
-- - Add webhook receipt timestamp for delivery callbacks.
-- - Add tracking_id lookup index for provider webhook matching.
-- - Add service-role-only RPC to mark sent outbox rows delivered by tracking_id.
-- - No client RPC proxy allowlist exposure.

BEGIN;

ALTER TABLE public.zbs_notification_outbox
  ADD COLUMN IF NOT EXISTS delivery_webhook_received_at timestamptz;

CREATE INDEX IF NOT EXISTS zbs_notification_outbox_tracking_id_idx
  ON public.zbs_notification_outbox (tracking_id)
  WHERE provider = 'zalo_zbs';

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_delivered(
  p_tracking_id text,
  p_provider_message_id text,
  p_recipient_phone text,
  p_delivered_at timestamptz,
  p_delivery_webhook_received_at timestamptz,
  p_delivery_webhook_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  status text
)
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
    RAISE EXCEPTION 'ZBS delivery webhook RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT outbox.id
    FROM public.zbs_notification_outbox outbox
    WHERE outbox.provider = 'zalo_zbs'
      AND outbox.tracking_id = nullif(p_tracking_id, '')
      AND outbox.status IN ('sent', 'delivered')
    ORDER BY outbox.created_at ASC
    LIMIT 1
    FOR UPDATE
  ),
  updated AS (
    UPDATE public.zbs_notification_outbox outbox
    SET
      status = 'delivered',
      provider_message_id = coalesce(
        nullif(outbox.provider_message_id, ''),
        nullif(p_provider_message_id, '')
      ),
      provider_response = CASE
        WHEN outbox.status = 'sent' THEN
          coalesce(outbox.provider_response, '{}'::jsonb)
            || jsonb_build_object(
              'delivery_webhook',
              coalesce(p_delivery_webhook_payload, '{}'::jsonb)
                || jsonb_build_object(
                  'tracking_id', nullif(p_tracking_id, ''),
                  'provider_message_id', nullif(p_provider_message_id, ''),
                  'recipient_phone', nullif(p_recipient_phone, '')
                )
            )
        ELSE outbox.provider_response
      END,
      delivered_at = CASE
        WHEN outbox.status = 'sent' THEN coalesce(p_delivered_at, now())
        ELSE outbox.delivered_at
      END,
      delivery_webhook_received_at = CASE
        WHEN outbox.status = 'sent' THEN coalesce(p_delivery_webhook_received_at, now())
        ELSE outbox.delivery_webhook_received_at
      END,
      last_error_code = CASE
        WHEN outbox.status = 'sent' THEN NULL
        ELSE outbox.last_error_code
      END,
      last_error_message = CASE
        WHEN outbox.status = 'sent' THEN NULL
        ELSE outbox.last_error_message
      END,
      updated_at = CASE
        WHEN outbox.status = 'sent' THEN now()
        ELSE outbox.updated_at
      END
    FROM matched
    WHERE outbox.id = matched.id
    RETURNING outbox.id, outbox.status
  )
  SELECT updated.id, updated.status
  FROM updated;
END;
$$;

REVOKE ALL ON FUNCTION public.zbs_notification_outbox_mark_delivered(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_mark_delivered(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) TO service_role;

COMMENT ON COLUMN public.zbs_notification_outbox.delivery_webhook_received_at IS
  'Server receipt timestamp for trusted Zalo ZBS delivery webhooks.';
COMMENT ON FUNCTION public.zbs_notification_outbox_mark_delivered(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) IS
  'Server-only ZBS delivery webhook boundary. Requires service_role JWT, matches by tracking_id, and marks sent Zalo ZBS rows delivered idempotently.';

COMMIT;
