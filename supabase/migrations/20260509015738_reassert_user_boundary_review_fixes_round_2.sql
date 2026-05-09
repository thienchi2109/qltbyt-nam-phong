-- Issue #405: close the final review gaps on the user-management RPC boundary.
-- Supersedes 20260509005630 by hashing the same trimmed password that passed
-- validation, and by making password-reset audit logging mandatory.

CREATE OR REPLACE FUNCTION public.user_create(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_current_don_vi BIGINT,
  p_memberships BIGINT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role TEXT := LOWER(NULLIF(COALESCE(v_claims->>'app_role', v_claims->>'role'), ''));
  v_admin_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  v_admin_username TEXT;
  v_admin_role TEXT;
  v_id INTEGER;
  v_hashed_password TEXT;
  v_username TEXT := TRIM(p_username);
  v_password TEXT := TRIM(p_password);
  v_full_name TEXT := TRIM(p_full_name);
  v_role TEXT := LOWER(TRIM(p_role));
BEGIN
  IF v_app_role = 'admin' THEN
    v_app_role := 'global';
  END IF;

  IF v_app_role IS NULL OR v_app_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  SELECT nv.username, nv.role
  INTO v_admin_username, v_admin_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_admin_user_id;

  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'global') OR v_app_role <> 'global' THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required' USING ERRCODE = '42501';
  END IF;

  IF p_username IS NULL OR v_username = '' OR POSITION(' ' IN v_username) > 0 THEN
    RAISE EXCEPTION 'Invalid username format' USING ERRCODE = '22023';
  END IF;

  IF p_password IS NULL OR v_password = '' THEN
    RAISE EXCEPTION 'Invalid password format' USING ERRCODE = '22023';
  END IF;

  IF p_full_name IS NULL OR v_full_name = '' OR p_role IS NULL OR v_role = '' OR p_current_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing required fields' USING ERRCODE = '22023';
  END IF;

  v_hashed_password := extensions.crypt(v_password, extensions.gen_salt('bf', 12));

  INSERT INTO public.nhan_vien(
    username,
    password,
    hashed_password,
    full_name,
    role,
    don_vi,
    current_don_vi
  )
  VALUES (
    v_username,
    'hashed password',
    v_hashed_password,
    v_full_name,
    v_role,
    p_current_don_vi,
    p_current_don_vi
  )
  RETURNING id INTO v_id;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
  VALUES (v_id, p_current_don_vi)
  ON CONFLICT DO NOTHING;

  IF p_memberships IS NOT NULL THEN
    INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
    SELECT v_id, m
    FROM unnest(p_memberships) AS m
    WHERE m IS NOT NULL AND m <> p_current_don_vi
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.audit_logs (
    admin_user_id,
    admin_username,
    action_type,
    target_user_id,
    target_username,
    action_details,
    ip_address,
    user_agent,
    entity_type,
    entity_id,
    entity_label
  ) VALUES (
    v_admin_user_id,
    v_admin_username,
    'USER_CREATE',
    v_id,
    v_username,
    jsonb_build_object(
      'username', v_username,
      'full_name', v_full_name,
      'role', v_role,
      'current_don_vi', p_current_don_vi,
      'memberships', COALESCE(p_memberships, ARRAY[]::BIGINT[])
    ),
    COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(
      NULLIF((COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb)->>'user-agent', ''),
      'unknown'
    ),
    'nhan_vien',
    v_id,
    v_username
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_password_by_admin(
  p_admin_user_id BIGINT,
  p_target_user_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := LOWER(NULLIF(COALESCE(v_claims->>'app_role', v_claims->>'role'), ''));
  v_claim_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  admin_rec public.nhan_vien%ROWTYPE;
  target_rec public.nhan_vien%ROWTYPE;
  new_password TEXT := 'userqltb';
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_claim_user_id IS DISTINCT FROM p_admin_user_id THEN
    RAISE EXCEPTION 'admin user claim mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO admin_rec
  FROM public.nhan_vien
  WHERE id = p_admin_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admin user not found');
  END IF;

  IF admin_rec.role NOT IN ('admin', 'global') OR v_role <> 'global' THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO target_rec
  FROM public.nhan_vien
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target user not found');
  END IF;

  UPDATE public.nhan_vien
  SET hashed_password = extensions.crypt(new_password, extensions.gen_salt('bf', 12)),
      password = 'hashed password',
      password_changed_at = NOW(),
      failed_attempts = 0,
      password_reset_required = TRUE
  WHERE id = p_target_user_id;

  INSERT INTO public.audit_logs (
    admin_user_id,
    admin_username,
    action_type,
    target_user_id,
    target_username,
    action_details,
    ip_address,
    user_agent,
    entity_type,
    entity_id,
    entity_label
  ) VALUES (
    p_admin_user_id,
    admin_rec.username,
    'password_reset_admin',
    p_target_user_id,
    target_rec.username,
    jsonb_build_object('reason', 'admin reset password to default value'),
    COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(
      NULLIF((COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb)->>'user-agent', ''),
      'unknown'
    ),
    'nhan_vien',
    p_target_user_id,
    target_rec.username
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Password for user %s has been reset to the default.', target_rec.username),
    'username', target_rec.username,
    'new_password', new_password
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) TO service_role;

REVOKE ALL ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) TO service_role;
