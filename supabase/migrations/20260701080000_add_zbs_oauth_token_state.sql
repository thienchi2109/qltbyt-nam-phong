-- Issue #646: durable server-only Zalo ZBS OAuth token state.
--
-- Scope:
-- - Store current ZBS/OA access + refresh token state for the server dispatcher.
-- - Expose service-role-only RPC boundaries for cron dispatch token refresh.
-- - Keep client roles denied; token plaintext must never be exposed through the Data API.

BEGIN;

CREATE TABLE IF NOT EXISTS public.zbs_oauth_token_state (
  provider text PRIMARY KEY CHECK (provider = 'zalo_zbs'),
  access_token text,
  access_token_expires_at timestamptz,
  refresh_token text,
  refresh_token_issued_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_refresh_at timestamptz,
  last_refresh_error_code text,
  last_refresh_error_message text,
  last_refresh_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    access_token IS NULL
    OR access_token_expires_at IS NOT NULL
  ),
  CHECK (
    refresh_token IS NULL
    OR refresh_token_issued_at IS NOT NULL
  )
);

ALTER TABLE public.zbs_oauth_token_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zbs_oauth_token_state_no_client_access
  ON public.zbs_oauth_token_state;
CREATE POLICY zbs_oauth_token_state_no_client_access
  ON public.zbs_oauth_token_state
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.zbs_oauth_token_state_get(
  p_provider text DEFAULT 'zalo_zbs'
)
RETURNS TABLE (
  provider text,
  access_token text,
  access_token_expires_at timestamptz,
  refresh_token text,
  refresh_token_issued_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_refresh_at timestamptz,
  last_refresh_error_code text,
  last_refresh_error_message text,
  last_refresh_error_at timestamptz,
  updated_at timestamptz
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
    RAISE EXCEPTION 'ZBS token state RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    state.provider,
    state.access_token,
    state.access_token_expires_at,
    state.refresh_token,
    state.refresh_token_issued_at,
    state.refresh_token_expires_at,
    state.last_refresh_at,
    state.last_refresh_error_code,
    state.last_refresh_error_message,
    state.last_refresh_error_at,
    state.updated_at
  FROM public.zbs_oauth_token_state state
  WHERE state.provider = coalesce(nullif(p_provider, ''), 'zalo_zbs');
END;
$$;

CREATE OR REPLACE FUNCTION public.zbs_oauth_token_state_persist_success(
  p_provider text,
  p_previous_refresh_token text,
  p_access_token text,
  p_access_token_expires_at timestamptz,
  p_refresh_token text,
  p_refresh_token_issued_at timestamptz,
  p_refresh_token_expires_at timestamptz
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
  v_provider text := coalesce(nullif(p_provider, ''), 'zalo_zbs');
  v_current_refresh_token text;
BEGIN
  IF coalesce(v_claims->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ZBS token state RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

  IF v_provider <> 'zalo_zbs' THEN
    RAISE EXCEPTION 'Unsupported ZBS OAuth token provider %', v_provider
      USING errcode = '22023';
  END IF;

  IF NULLIF(p_access_token, '') IS NULL THEN
    RAISE EXCEPTION 'ZBS OAuth access token is required'
      USING errcode = '22023';
  END IF;

  IF NULLIF(p_refresh_token, '') IS NULL THEN
    RAISE EXCEPTION 'ZBS OAuth refresh token is required'
      USING errcode = '22023';
  END IF;

  SELECT state.refresh_token
  INTO v_current_refresh_token
  FROM public.zbs_oauth_token_state state
  WHERE state.provider = v_provider
  FOR UPDATE;

  IF FOUND THEN
    IF NULLIF(p_previous_refresh_token, '') IS NOT NULL
       AND v_current_refresh_token IS DISTINCT FROM p_previous_refresh_token THEN
      RAISE EXCEPTION 'ZBS OAuth refresh token changed concurrently'
        USING errcode = '40001';
    END IF;

    UPDATE public.zbs_oauth_token_state state
    SET
      access_token = p_access_token,
      access_token_expires_at = p_access_token_expires_at,
      refresh_token = p_refresh_token,
      refresh_token_issued_at = coalesce(p_refresh_token_issued_at, now()),
      refresh_token_expires_at = p_refresh_token_expires_at,
      last_refresh_at = now(),
      last_refresh_error_code = NULL,
      last_refresh_error_message = NULL,
      last_refresh_error_at = NULL,
      updated_at = now()
    WHERE state.provider = v_provider;
  ELSE
    IF NULLIF(p_previous_refresh_token, '') IS NOT NULL THEN
      RAISE EXCEPTION 'ZBS OAuth token state missing for refresh compare'
        USING errcode = 'P0002';
    END IF;

    INSERT INTO public.zbs_oauth_token_state (
      provider,
      access_token,
      access_token_expires_at,
      refresh_token,
      refresh_token_issued_at,
      refresh_token_expires_at,
      last_refresh_at
    )
    VALUES (
      v_provider,
      p_access_token,
      p_access_token_expires_at,
      p_refresh_token,
      coalesce(p_refresh_token_issued_at, now()),
      p_refresh_token_expires_at,
      now()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.zbs_oauth_token_state_record_error(
  p_provider text,
  p_previous_refresh_token text,
  p_error_code text,
  p_error_message text,
  p_error_at timestamptz DEFAULT now()
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
  v_provider text := coalesce(nullif(p_provider, ''), 'zalo_zbs');
BEGIN
  IF coalesce(v_claims->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ZBS token state RPC requires service_role JWT'
      USING errcode = '42501';
  END IF;

  IF v_provider <> 'zalo_zbs' THEN
    RAISE EXCEPTION 'Unsupported ZBS OAuth token provider %', v_provider
      USING errcode = '22023';
  END IF;

  INSERT INTO public.zbs_oauth_token_state (
    provider,
    refresh_token,
    refresh_token_issued_at,
    last_refresh_error_code,
    last_refresh_error_message,
    last_refresh_error_at
  )
  VALUES (
    v_provider,
    NULLIF(p_previous_refresh_token, ''),
    CASE WHEN NULLIF(p_previous_refresh_token, '') IS NULL THEN NULL ELSE now() END,
    NULLIF(p_error_code, ''),
    NULLIF(p_error_message, ''),
    coalesce(p_error_at, now())
  )
  ON CONFLICT (provider) DO UPDATE
  SET
    last_refresh_error_code = NULLIF(p_error_code, ''),
    last_refresh_error_message = NULLIF(p_error_message, ''),
    last_refresh_error_at = coalesce(p_error_at, now()),
    updated_at = now();
END;
$$;

REVOKE ALL ON TABLE public.zbs_oauth_token_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.zbs_oauth_token_state TO service_role;

REVOKE ALL ON FUNCTION public.zbs_oauth_token_state_get(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zbs_oauth_token_state_persist_success(
  text,
  text,
  text,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zbs_oauth_token_state_record_error(text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.zbs_oauth_token_state_get(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.zbs_oauth_token_state_persist_success(
  text,
  text,
  text,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.zbs_oauth_token_state_record_error(text, text, text, text, timestamptz)
  TO service_role;

COMMENT ON TABLE public.zbs_oauth_token_state IS
  'Server-only Zalo ZBS OAuth token state for scheduled dispatch. Client roles have no direct table access.';
COMMENT ON FUNCTION public.zbs_oauth_token_state_get(text) IS
  'Service-role-only ZBS token-state read boundary for the cron dispatcher.';
COMMENT ON FUNCTION public.zbs_oauth_token_state_persist_success(text, text, text, timestamptz, text, timestamptz, timestamptz) IS
  'Service-role-only atomic ZBS token refresh success boundary. Locks the provider row and compares the previous refresh token before persisting rotated tokens.';
COMMENT ON FUNCTION public.zbs_oauth_token_state_record_error(text, text, text, text, timestamptz) IS
  'Service-role-only ZBS token refresh error boundary. Stores sanitized error metadata without provider token payloads.';

COMMIT;
