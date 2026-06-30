-- Issue #619 Phase 2: controlled RPC read boundary for ZBS dispatcher dry-run.
-- Scope:
-- - No live Zalo API calls.
-- - Read only pending repair_request_created ZBS outbox rows needed for request construction.
-- - Preserve tenant isolation for non-global callers; no cross-tenant fallback.

BEGIN;

CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_pending_for_dispatch(
  p_limit integer DEFAULT 25,
  p_now timestamptz DEFAULT now()
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_user_id bigint;
  v_don_vi bigint;
  v_is_global boolean := false;
  v_limit integer;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;
  v_is_global := v_role in ('global', 'admin');
  v_limit := least(greatest(coalesce(p_limit, 25), 1), 100);

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
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
    outbox.next_attempt_at
  FROM public.zbs_notification_outbox outbox
  WHERE outbox.status = 'pending'
    AND outbox.provider = 'zalo_zbs'
    AND outbox.event_type = 'repair_request_created'
    AND outbox.source_type = 'repair_request'
    AND outbox.next_attempt_at <= coalesce(p_now, now())
    AND (v_is_global OR outbox.don_vi_id = v_don_vi)
  ORDER BY outbox.created_at ASC, outbox.id ASC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.zbs_notification_outbox_pending_for_dispatch(integer, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_pending_for_dispatch(integer, timestamptz)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.zbs_notification_outbox_pending_for_dispatch(integer, timestamptz) IS
  'Controlled tenant-scoped read boundary for ZBS dispatcher dry-run request construction. Does not send Zalo requests.';

COMMIT;
