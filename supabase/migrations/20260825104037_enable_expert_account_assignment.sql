-- OpenSpec add-technical-configuration-expert-role, Phase 13:
-- enable guarded backend expert assignment while keeping Phase 14 UI dormant.
BEGIN;

CREATE OR REPLACE FUNCTION public.user_create(
  p_username TEXT, p_password TEXT, p_full_name TEXT, p_role TEXT,
  p_current_don_vi BIGINT, p_memberships BIGINT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_app_role TEXT;
  v_admin_user_id BIGINT;
  v_admin_username TEXT;
  v_admin_role TEXT;
  v_id INTEGER;
  v_hashed_password TEXT;
  v_username TEXT;
  v_password TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_dia_ban_id BIGINT;
  v_invariant_valid BOOLEAN;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_app_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_admin_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_app_role IS NULL OR v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  v_username := TRIM(p_username);
  v_password := TRIM(p_password);
  v_full_name := TRIM(p_full_name);
  v_role := LOWER(TRIM(p_role));

  SELECT nv.username, nv.role
  INTO v_admin_username, v_admin_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_admin_user_id;

  IF v_admin_role IS NULL
    OR v_admin_role NOT IN ('admin', 'global')
    OR v_app_role NOT IN ('admin', 'global')
  THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required'
      USING ERRCODE = '42501';
  END IF;

  IF p_username IS NULL OR v_username = '' OR POSITION(' ' IN v_username) > 0 THEN
    RAISE EXCEPTION 'Invalid username format' USING ERRCODE = '22023';
  END IF;

  IF p_password IS NULL OR v_password = '' THEN
    RAISE EXCEPTION 'Invalid password format' USING ERRCODE = '22023';
  END IF;

  IF p_full_name IS NULL OR v_full_name = '' OR p_role IS NULL OR v_role = ''
    OR p_current_don_vi IS NULL
  THEN
    RAISE EXCEPTION 'Missing required fields' USING ERRCODE = '22023';
  END IF;

  IF v_role NOT IN (
    'global',
    'admin',
    'regional_leader',
    'to_qltb',
    'technician',
    'qltb_khoa',
    'user',
    'chuyen_gia'
  ) THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'chuyen_gia' THEN
    SELECT dv.dia_ban_id
    INTO v_dia_ban_id
    FROM public.don_vi dv
    JOIN public.dia_ban db
      ON db.id = dv.dia_ban_id
    WHERE dv.id = p_current_don_vi
      AND COALESCE(dv.active, true)
      AND COALESCE(db.active, true)
    FOR SHARE OF dv, db;

    IF NOT FOUND OR v_dia_ban_id IS NULL THEN
      RAISE EXCEPTION 'Invalid expert destination' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_memberships, ARRAY[]::BIGINT[])) AS membership(don_vi)
      WHERE membership.don_vi IS DISTINCT FROM p_current_don_vi
    ) THEN
      RAISE EXCEPTION 'Invalid expert memberships' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_hashed_password := extensions.crypt(v_password, extensions.gen_salt('bf', 12));

  IF v_role = 'chuyen_gia' THEN
    INSERT INTO public.nhan_vien(
      username, password, hashed_password, full_name, role, don_vi,
      current_don_vi, dia_ban_id
    )
    VALUES (
      v_username, 'hashed password', v_hashed_password, v_full_name, v_role,
      p_current_don_vi, p_current_don_vi, v_dia_ban_id
    )
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.nhan_vien(
      username, password, hashed_password, full_name, role, don_vi, current_don_vi
    )
    VALUES (
      v_username, 'hashed password', v_hashed_password, v_full_name,
      v_role, p_current_don_vi, p_current_don_vi
    )
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi, role_override)
  VALUES (v_id, p_current_don_vi, NULL)
  ON CONFLICT (user_id, don_vi)
  DO UPDATE SET role_override = NULL;

  IF v_role <> 'chuyen_gia' AND p_memberships IS NOT NULL THEN
    INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
    SELECT v_id, membership.don_vi
    FROM unnest(p_memberships) AS membership(don_vi)
    WHERE membership.don_vi IS NOT NULL
      AND membership.don_vi <> p_current_don_vi
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_role = 'chuyen_gia' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      JOIN public.user_don_vi_memberships membership
        ON membership.user_id = nv.id
       AND membership.don_vi = p_current_don_vi
      JOIN public.don_vi dv
        ON dv.id = p_current_don_vi
      JOIN public.dia_ban db
        ON db.id = dv.dia_ban_id
      WHERE nv.id = v_id
        AND LOWER(nv.role) = 'chuyen_gia'
        AND nv.don_vi = p_current_don_vi
        AND nv.current_don_vi = p_current_don_vi
        AND nv.dia_ban_id = v_dia_ban_id
        AND membership.role_override IS NULL
        AND COALESCE(dv.active, true)
        AND COALESCE(db.active, true)
    )
    AND (
      SELECT count(*) = 1
      FROM public.user_don_vi_memberships
      WHERE user_id = v_id
    )
    INTO v_invariant_valid;

    IF v_invariant_valid IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Expert scope invariant could not be established'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    admin_user_id, admin_username, action_type, target_user_id, target_username,
    action_details, ip_address, user_agent, entity_type, entity_id, entity_label
  ) VALUES (
    v_admin_user_id, v_admin_username, 'USER_CREATE', v_id, v_username,
    jsonb_build_object(
      'username', v_username, 'full_name', v_full_name, 'role', v_role,
      'current_don_vi', p_current_don_vi,
      'memberships', COALESCE(p_memberships, ARRAY[]::BIGINT[])
    ),
    COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(
      NULLIF(
        (COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::JSONB)
          ->>'user-agent',
        ''
      ),
      'unknown'
    ),
    'nhan_vien', v_id, v_username
  );

  RETURN v_id;
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
  v_claims JSONB;
  v_role TEXT;
  v_admin_user_id BIGINT;
  v_admin_username TEXT;
  v_admin_role TEXT;
  v_target_username TEXT;
  v_target_role TEXT;
  v_current_don_vi BIGINT;
  v_requested_role TEXT;
  v_dia_ban_id BIGINT;
  v_invariant_valid BOOLEAN;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_admin_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL OR v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  SELECT nv.username, nv.role
  INTO v_admin_username, v_admin_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_admin_user_id;

  IF v_admin_role IS NULL
    OR v_admin_role NOT IN ('admin', 'global')
    OR v_role NOT IN ('admin', 'global')
  THEN
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

  v_requested_role := LOWER(TRIM(p_role));
  IF p_role IS NULL OR v_requested_role NOT IN (
    'global',
    'admin',
    'regional_leader',
    'to_qltb',
    'technician',
    'qltb_khoa',
    'user',
    'chuyen_gia'
  ) THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;

  SELECT nv.username, LOWER(nv.role), nv.current_don_vi
  INTO v_target_username, v_target_role, v_current_don_vi
  FROM public.nhan_vien nv
  WHERE nv.id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_target_user_id USING ERRCODE = '22023';
  END IF;

  IF v_requested_role = 'chuyen_gia' THEN
    IF v_current_don_vi IS NULL THEN
      RAISE EXCEPTION 'Invalid expert destination' USING ERRCODE = '22023';
    END IF;

    SELECT dv.dia_ban_id
    INTO v_dia_ban_id
    FROM public.don_vi dv
    JOIN public.dia_ban db
      ON db.id = dv.dia_ban_id
    WHERE dv.id = v_current_don_vi
      AND COALESCE(dv.active, true)
      AND COALESCE(db.active, true)
    FOR SHARE OF dv, db;

    IF NOT FOUND OR v_dia_ban_id IS NULL THEN
      RAISE EXCEPTION 'Invalid expert destination' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.user_don_vi_memberships(user_id, don_vi, role_override)
    VALUES (p_target_user_id, v_current_don_vi, NULL)
    ON CONFLICT (user_id, don_vi)
    DO UPDATE SET role_override = NULL;

    UPDATE public.nhan_vien
    SET username = TRIM(p_username),
        full_name = TRIM(p_full_name),
        role = v_requested_role,
        khoa_phong = NULLIF(TRIM(COALESCE(p_khoa_phong, '')), ''),
        don_vi = v_current_don_vi,
        current_don_vi = v_current_don_vi,
        dia_ban_id = v_dia_ban_id
    WHERE id = p_target_user_id;

    DELETE FROM public.user_don_vi_memberships
    WHERE user_id = p_target_user_id
      AND don_vi <> v_current_don_vi;

    SELECT EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      JOIN public.user_don_vi_memberships membership
        ON membership.user_id = nv.id
       AND membership.don_vi = v_current_don_vi
      JOIN public.don_vi dv
        ON dv.id = v_current_don_vi
      JOIN public.dia_ban db
        ON db.id = dv.dia_ban_id
      WHERE nv.id = p_target_user_id
        AND LOWER(nv.role) = 'chuyen_gia'
        AND nv.don_vi = v_current_don_vi
        AND nv.current_don_vi = v_current_don_vi
        AND nv.dia_ban_id = v_dia_ban_id
        AND membership.role_override IS NULL
        AND COALESCE(dv.active, true)
        AND COALESCE(db.active, true)
    )
    AND (
      SELECT count(*) = 1
      FROM public.user_don_vi_memberships
      WHERE user_id = p_target_user_id
    )
    INTO v_invariant_valid;

    IF v_invariant_valid IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Expert scope invariant could not be established'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    UPDATE public.nhan_vien
    SET username = TRIM(p_username),
        full_name = TRIM(p_full_name),
        role = v_requested_role,
        khoa_phong = NULLIF(TRIM(COALESCE(p_khoa_phong, '')), '')
    WHERE id = p_target_user_id;
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
    'USER_UPDATE',
    p_target_user_id,
    v_target_username,
    jsonb_build_object(
      'username', TRIM(p_username),
      'full_name', TRIM(p_full_name),
      'role', v_requested_role,
      'khoa_phong', NULLIF(TRIM(COALESCE(p_khoa_phong, '')), ''),
      'password_updated', FALSE
    ),
    COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(
      NULLIF(
        (COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::JSONB)
          ->>'user-agent',
        ''
      ),
      'unknown'
    ),
    'nhan_vien',
    p_target_user_id,
    TRIM(p_username)
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[])
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[])
  FROM anon;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_create(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT[])
  TO service_role;

REVOKE ALL ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_update_profile(INTEGER, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;
