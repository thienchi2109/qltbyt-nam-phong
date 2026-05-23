-- Issue #538 review follow-up: accept standard service-role JWT claims.

CREATE OR REPLACE FUNCTION public.ai_kill_switch_status()
RETURNS TABLE (
  enabled BOOLEAN,
  reason TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims_text TEXT := current_setting('request.jwt.claims', true);
  v_claims JSONB;
  v_role TEXT;
  v_user_id TEXT;
  v_enabled_text TEXT;
  v_enabled_updated_at TIMESTAMPTZ;
  v_reason_updated_at TIMESTAMPTZ;
BEGIN
  IF v_claims_text IS NULL OR btrim(v_claims_text) = '' THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;

  v_claims := v_claims_text::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role', ''), NULLIF(v_claims->>'role', ''));
  v_user_id := NULLIF(v_claims->>'user_id', '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'service_role' AND v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  SELECT s.value, s.updated_at
  INTO v_enabled_text, v_enabled_updated_at
  FROM public.internal_settings s
  WHERE s.key = 'ai_kill_switch.enabled';

  SELECT NULLIF(btrim(s.value), ''), s.updated_at
  INTO reason, v_reason_updated_at
  FROM public.internal_settings s
  WHERE s.key = 'ai_kill_switch.reason';

  enabled := lower(COALESCE(v_enabled_text, 'false')) IN ('true', '1', 'on', 'yes', 'enabled');
  updated_at := GREATEST(v_enabled_updated_at, v_reason_updated_at);

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_kill_switch_set(
  p_enabled BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  enabled BOOLEAN,
  reason TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims_text TEXT := current_setting('request.jwt.claims', true);
  v_claims JSONB;
  v_role TEXT;
  v_user_id TEXT;
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_enabled_updated_at TIMESTAMPTZ;
  v_reason_updated_at TIMESTAMPTZ;
BEGIN
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'p_enabled is required' USING ERRCODE = '22023';
  END IF;

  IF v_claims_text IS NULL OR btrim(v_claims_text) = '' THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;

  v_claims := v_claims_text::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role', ''), NULLIF(v_claims->>'role', ''));
  v_user_id := NULLIF(v_claims->>'user_id', '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'service_role' AND v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('global', 'service_role') THEN
    RAISE EXCEPTION 'Insufficient privileges to set AI kill switch' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.internal_settings(key, value, updated_at)
  VALUES ('ai_kill_switch.enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at
  RETURNING public.internal_settings.updated_at INTO v_enabled_updated_at;

  IF v_reason IS NULL THEN
    DELETE FROM public.internal_settings
    WHERE key = 'ai_kill_switch.reason';
    v_reason_updated_at := NULL;
  ELSE
    INSERT INTO public.internal_settings(key, value, updated_at)
    VALUES ('ai_kill_switch.reason', v_reason, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    RETURNING public.internal_settings.value, public.internal_settings.updated_at
    INTO reason, v_reason_updated_at;
  END IF;

  enabled := p_enabled;
  updated_at := GREATEST(v_enabled_updated_at, v_reason_updated_at);

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_kill_switch_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_kill_switch_set(BOOLEAN, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ai_kill_switch_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_kill_switch_set(BOOLEAN, TEXT) TO authenticated, service_role;
