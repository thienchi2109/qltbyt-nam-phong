-- Issue #646 follow-up: harden ZBS OAuth token-state refresh concurrency guards.
--
-- This migration intentionally supersedes the already-applied
-- 20260701080000_add_zbs_oauth_token_state.sql without editing it.

BEGIN;

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
  v_previous_refresh_token text := NULLIF(p_previous_refresh_token, '');
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
    IF v_current_refresh_token IS DISTINCT FROM v_previous_refresh_token THEN
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
    IF v_previous_refresh_token IS NOT NULL THEN
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
  v_previous_refresh_token text := NULLIF(p_previous_refresh_token, '');
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
    v_previous_refresh_token,
    CASE WHEN v_previous_refresh_token IS NULL THEN NULL ELSE now() END,
    NULLIF(p_error_code, ''),
    NULLIF(p_error_message, ''),
    coalesce(p_error_at, now())
  )
  ON CONFLICT (provider) DO UPDATE
  SET
    last_refresh_error_code = NULLIF(p_error_code, ''),
    last_refresh_error_message = NULLIF(p_error_message, ''),
    last_refresh_error_at = coalesce(p_error_at, now()),
    updated_at = now()
  WHERE zbs_oauth_token_state.refresh_token IS NOT DISTINCT FROM v_previous_refresh_token;
END;
$$;

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

COMMENT ON FUNCTION public.zbs_oauth_token_state_persist_success(text, text, text, timestamptz, text, timestamptz, timestamptz) IS
  'Service-role-only atomic ZBS token refresh success boundary. Locks the provider row and compares the previous refresh token, including bootstrap NULL, before persisting rotated tokens.';
COMMENT ON FUNCTION public.zbs_oauth_token_state_record_error(text, text, text, text, timestamptz) IS
  'Service-role-only ZBS token refresh error boundary. Stores sanitized error metadata only when the refresh token has not rotated.';

COMMIT;
