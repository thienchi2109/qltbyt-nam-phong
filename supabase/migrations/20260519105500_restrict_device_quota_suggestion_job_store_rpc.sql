BEGIN;

REVOKE ALL ON FUNCTION public.device_quota_suggestion_job_store_rpc(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.device_quota_suggestion_job_store_rpc(TEXT, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.device_quota_suggestion_job_store_rpc(TEXT, JSONB) IS
  'Service-role-only RPC persistence boundary for async Device Quota suggestion jobs. Client/user access remains through Next.js job APIs, which validate session access before invoking this function. Rollback by adding a later migration that restores the previous grant contract if needed.';

COMMIT;
