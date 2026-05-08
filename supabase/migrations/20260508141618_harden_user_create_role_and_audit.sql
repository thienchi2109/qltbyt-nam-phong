-- Issue #405 follow-up hardening from PR review.
-- Keep user creation behind the same global/admin boundary as the other
-- nhan_vien management RPCs, and make successful creates audit-visible.

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

  IF p_password IS NULL OR p_full_name IS NULL OR v_full_name = '' OR p_role IS NULL OR v_role = '' OR p_current_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing required fields' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[]) TO service_role;
