-- Issue #619 Phase 2 follow-up: clear Supabase advisor warning for ZBS dispatch RPC.
-- The Next.js RPC proxy mints a short-lived service_role JWT for this server-only
-- function after same-origin, session, and whitelist checks. The function still
-- enforces app_role/user_id/don_vi claims internally.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.zbs_notification_outbox_pending_for_dispatch(integer, timestamptz)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.zbs_notification_outbox_pending_for_dispatch(integer, timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.zbs_notification_outbox_pending_for_dispatch(integer, timestamptz) IS
  'Server-only read boundary for ZBS dispatcher dry-run request construction. The app RPC proxy invokes it with a service_role DB role and user app claims; it does not send Zalo requests.';

COMMIT;
