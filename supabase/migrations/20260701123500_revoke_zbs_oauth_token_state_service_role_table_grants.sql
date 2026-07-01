-- Issue #646 follow-up: keep plaintext ZBS OAuth token state behind RPC boundaries.
--
-- Scope:
-- - Revoke direct table privileges from API roles, including service_role.
-- - Preserve service-role-only access through SECURITY DEFINER token-state RPCs.
--
-- Rollback:
-- - Forward-only: create a follow-up migration that restores only the exact
--   direct table privileges required by a reviewed server-side caller.
-- - If production token state exists, rotate/revoke provider tokens before
--   replacing this RPC-only access model with any direct table access.

BEGIN;

REVOKE ALL ON TABLE public.zbs_oauth_token_state FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.zbs_oauth_token_state IS
  'Server-only ZBS/OA access and refresh token state. Plaintext token material must remain behind SECURITY DEFINER RPC boundaries; direct table privileges are revoked from API roles, including service_role.';

COMMIT;
