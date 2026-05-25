-- Issue #544 follow-up: qualify auth_login_throttle_check columns.
-- The first live migration created the throttle schema, but the TABLE return
-- column names shadowed same-named table columns inside PL/pgSQL.

BEGIN;

CREATE OR REPLACE FUNCTION public.auth_login_throttle_check(
  p_username text,
  p_ip_address inet
)
RETURNS TABLE (
  allowed boolean,
  blocked_until timestamptz,
  retry_after_seconds integer,
  blocked_scope text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_username_hash text;
  v_block record;
BEGIN
  IF NULLIF(btrim(p_username), '') IS NULL OR p_ip_address IS NULL THEN
    RETURN QUERY SELECT TRUE, NULL::timestamptz, 0, NULL::text;
    RETURN;
  END IF;

  v_username_hash := public._auth_login_throttle_username_hash(p_username);

  SELECT t.bucket_type, t.blocked_until
  INTO v_block
  FROM public.auth_login_attempt_throttle AS t
  WHERE t.ip_address = p_ip_address
    AND t.blocked_until > v_now
    AND (
      (t.bucket_type = 'username_ip' AND t.username_hash = v_username_hash)
      OR (t.bucket_type = 'ip' AND t.username_hash IS NULL)
    )
  ORDER BY t.blocked_until DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      v_block.blocked_until,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_block.blocked_until - v_now)))::integer),
      v_block.bucket_type;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::timestamptz, 0, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_login_throttle_check(text, inet) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_login_throttle_check(text, inet) FROM anon;
REVOKE ALL ON FUNCTION public.auth_login_throttle_check(text, inet) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_login_throttle_check(text, inet) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
