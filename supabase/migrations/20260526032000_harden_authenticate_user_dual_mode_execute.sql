-- Harden the login RPC boundary: credentials login must go through the
-- server-side NextAuth authorize() path using SUPABASE_SERVICE_ROLE_KEY.
REVOKE EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO service_role;
