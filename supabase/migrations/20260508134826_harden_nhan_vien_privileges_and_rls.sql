-- Issue #405: make public.nhan_vien an internal auth/account table.
-- App clients must use session-signed RPC boundaries instead of direct table access.

ALTER TABLE public.nhan_vien ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nhan_vien FROM PUBLIC;
REVOKE ALL ON TABLE public.nhan_vien FROM anon;
REVOKE ALL ON TABLE public.nhan_vien FROM authenticated;
GRANT ALL ON TABLE public.nhan_vien TO service_role;

CREATE OR REPLACE FUNCTION public.user_list_for_admin()
RETURNS TABLE (
  id BIGINT,
  username TEXT,
  full_name TEXT,
  role TEXT,
  khoa_phong TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := LOWER(NULLIF(COALESCE(v_claims->>'app_role', v_claims->>'role'), ''));
  v_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  v_db_role TEXT;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  SELECT nv.role
  INTO v_db_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_user_id;

  IF v_db_role IS NULL OR v_db_role NOT IN ('admin', 'global') OR v_role <> 'global' THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    nv.id,
    nv.username,
    nv.full_name,
    nv.role,
    nv.khoa_phong,
    nv.created_at
  FROM public.nhan_vien nv
  ORDER BY nv.created_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_update_profile(
  p_target_user_id INTEGER,
  p_username TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := LOWER(NULLIF(COALESCE(v_claims->>'app_role', v_claims->>'role'), ''));
  v_admin_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  v_admin_username TEXT;
  v_admin_role TEXT;
  v_target_username TEXT;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  SELECT nv.username, nv.role
  INTO v_admin_username, v_admin_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_admin_user_id;

  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'global') OR v_role <> 'global' THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user id' USING ERRCODE = '22023';
  END IF;

  IF NOT public.validate_username(p_username) THEN
    RAISE EXCEPTION 'Invalid username format' USING ERRCODE = '22023';
  END IF;

  IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
    RAISE EXCEPTION 'Missing full_name' USING ERRCODE = '22023';
  END IF;

  IF p_role IS NULL OR LOWER(TRIM(p_role)) NOT IN (
    'global',
    'admin',
    'regional_leader',
    'to_qltb',
    'technician',
    'qltb_khoa',
    'user'
  ) THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;

  SELECT nv.username
  INTO v_target_username
  FROM public.nhan_vien nv
  WHERE nv.id = p_target_user_id;

  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', p_target_user_id USING ERRCODE = '22023';
  END IF;

  UPDATE public.nhan_vien
  SET username = TRIM(p_username),
      full_name = TRIM(p_full_name),
      role = LOWER(TRIM(p_role)),
      khoa_phong = NULLIF(TRIM(COALESCE(p_khoa_phong, '')), '')
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
    v_admin_user_id,
    v_admin_username,
    'USER_UPDATE',
    p_target_user_id,
    v_target_username,
    jsonb_build_object(
      'username', TRIM(p_username),
      'full_name', TRIM(p_full_name),
      'role', LOWER(TRIM(p_role)),
      'khoa_phong', NULLIF(TRIM(COALESCE(p_khoa_phong, '')), ''),
      'password_updated', FALSE
    ),
    COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(
      NULLIF((COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb)->>'user-agent', ''),
      'unknown'
    ),
    'nhan_vien',
    p_target_user_id,
    TRIM(p_username)
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_delete_by_admin(p_target_user_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := LOWER(NULLIF(COALESCE(v_claims->>'app_role', v_claims->>'role'), ''));
  v_admin_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  v_admin_username TEXT;
  v_admin_role TEXT;
  v_target_username TEXT;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user id' USING ERRCODE = '22023';
  END IF;

  IF v_admin_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot delete current user' USING ERRCODE = '42501';
  END IF;

  SELECT nv.username, nv.role
  INTO v_admin_username, v_admin_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_admin_user_id;

  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'global') OR v_role <> 'global' THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required' USING ERRCODE = '42501';
  END IF;

  SELECT nv.username
  INTO v_target_username
  FROM public.nhan_vien nv
  WHERE nv.id = p_target_user_id;

  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', p_target_user_id USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.nhan_vien
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
    v_admin_user_id,
    v_admin_username,
    'USER_DELETE',
    p_target_user_id,
    v_target_username,
    jsonb_build_object('deleted', TRUE),
    COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(
      NULLIF((COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb)->>'user-agent', ''),
      'unknown'
    ),
    'nhan_vien',
    p_target_user_id,
    v_target_username
  );

  RETURN TRUE;
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
      password_reset_required = COALESCE(password_reset_required, FALSE)
  WHERE id = p_target_user_id;

  BEGIN
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
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Failed to write audit log in reset_password_by_admin: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Password for user %s has been reset to the default.', target_rec.username),
    'username', target_rec.username,
    'new_password', new_password
  );
END;
$$;

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
  v_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  v_req_don_vi BIGINT := NULLIF(v_claims->>'don_vi', '')::BIGINT;
  v_id INTEGER;
  v_hashed_password TEXT;
BEGIN
  IF v_app_role = 'admin' THEN
    v_app_role := 'global';
  END IF;

  IF v_app_role IS NULL OR v_app_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF p_username IS NULL OR TRIM(p_username) = '' OR POSITION(' ' IN p_username) > 0 THEN
    RAISE EXCEPTION 'Invalid username format' USING ERRCODE = '22023';
  END IF;

  IF p_password IS NULL OR p_full_name IS NULL OR p_role IS NULL OR p_current_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing required fields' USING ERRCODE = '22023';
  END IF;

  IF v_app_role IS DISTINCT FROM 'global' THEN
    IF v_req_don_vi IS NULL OR v_req_don_vi IS DISTINCT FROM p_current_don_vi THEN
      RAISE EXCEPTION 'Không có quyền tạo người dùng ngoài đơn vị hiện tại' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_hashed_password := extensions.crypt(p_password, extensions.gen_salt('bf', 12));

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
    TRIM(p_username),
    'hashed password',
    v_hashed_password,
    TRIM(p_full_name),
    LOWER(p_role),
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

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_user(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_user(TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

REVOKE ALL ON FUNCTION public.update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.user_list_for_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_list_for_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_list_for_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.user_delete_by_admin(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_delete_by_admin(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_delete_by_admin(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) TO authenticated;
