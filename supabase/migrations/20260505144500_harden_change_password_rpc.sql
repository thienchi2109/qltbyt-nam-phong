-- Harden password changes behind session-signed JWT claims.
-- Do not trust p_user_id from the client; it must match request.jwt.claims.user_id.

CREATE OR REPLACE FUNCTION public.change_password(
  p_user_id INTEGER,
  p_old_password TEXT,
  p_new_password TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := LOWER(COALESCE(NULLIF(v_claims->>'app_role', ''), NULLIF(v_claims->>'role', '')));
  v_claim_user_id INTEGER;
  user_record RECORD;
  password_valid BOOLEAN := FALSE;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(v_claims->>'user_id', '') IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_claim_user_id := (v_claims->>'user_id')::INTEGER;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid user_id claim' USING ERRCODE = '42501';
  END;

  IF p_user_id IS NULL OR p_user_id <> v_claim_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT id, username, password, hashed_password
  INTO user_record
  FROM public.nhan_vien
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF user_record.hashed_password IS NOT NULL AND user_record.hashed_password <> '' THEN
    password_valid := (extensions.crypt(p_old_password, user_record.hashed_password) = user_record.hashed_password);
  ELSE
    password_valid := (user_record.password = p_old_password);
  END IF;

  IF NOT password_valid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Current password is incorrect');
  END IF;

  UPDATE public.nhan_vien
  SET hashed_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
      password = 'hashed password',
      password_changed_at = NOW()
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO public.audit_logs (
      admin_user_id,
      admin_username,
      action_type,
      target_user_id,
      target_username,
      action_details,
      ip_address,
      user_agent
    ) VALUES (
      p_user_id,
      user_record.username,
      'password_change',
      p_user_id,
      user_record.username,
      'User changed password',
      COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
      COALESCE(current_setting('request.headers', true), 'unknown')
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Failed to log password change: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

REVOKE ALL ON FUNCTION public.change_password(INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_password(INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.change_password(INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.change_password(INTEGER, TEXT, TEXT)
IS 'Allows the current authenticated session user to change only their own password with hashed storage, audit logging, and JWT claim guard.';
