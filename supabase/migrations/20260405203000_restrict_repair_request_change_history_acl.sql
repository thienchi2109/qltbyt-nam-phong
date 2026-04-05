-- Follow-up hardening for repair_request_change_history_list after live ACL verification.
-- Purpose: revoke unexpected anon execute access while preserving authenticated callers.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
