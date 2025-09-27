-- Consolidated admin/global user management functions
-- Ensures secure password handling, audit logging, and role-aware RPCs
-- Migration Date: 2025-09-27 13:30 UTC
-- Rollback: restore definitions from migrations 20241221_secure_user_update_function.sql,
--           20250914_add_reset_password_by_admin.sql, and reapply any removed files.

BEGIN;

-- Prerequisites -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.nhan_vien
  ADD COLUMN IF NOT EXISTS hashed_password TEXT,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE NOT NULL;

UPDATE public.nhan_vien
SET password_changed_at = COALESCE(password_changed_at, NOW()),
    failed_attempts = COALESCE(failed_attempts, 0),
    password_reset_required = COALESCE(password_reset_required, FALSE)
WHERE password_changed_at IS NULL
   OR failed_attempts IS NULL
   OR password_reset_required IS NULL;

-- Helper functions & triggers ----------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_hashed_password_ins ON public.nhan_vien;
DROP TRIGGER IF EXISTS trg_enforce_hashed_password_upd ON public.nhan_vien;
DROP FUNCTION IF EXISTS public.enforce_hashed_password();
DROP FUNCTION IF EXISTS public.validate_username(TEXT);

CREATE OR REPLACE FUNCTION public.validate_username(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN p_username IS NOT NULL
     AND length(trim(p_username)) > 0
     AND p_username !~ '\\s';
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_hashed_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> 'hashed password' THEN
    NEW.hashed_password := extensions.crypt(NEW.password, extensions.gen_salt('bf', 12));
    NEW.password := 'hashed password';
  END IF;

  IF NEW.hashed_password IS NOT NULL AND (NEW.password IS NULL OR NEW.password <> 'hashed password') THEN
    NEW.password := 'hashed password';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_hashed_password_ins
BEFORE INSERT ON public.nhan_vien
FOR EACH ROW
EXECUTE FUNCTION public.enforce_hashed_password();

CREATE TRIGGER trg_enforce_hashed_password_upd
BEFORE UPDATE OF password, hashed_password ON public.nhan_vien
FOR EACH ROW
EXECUTE FUNCTION public.enforce_hashed_password();

-- RPC: create_user ---------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_user(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_user(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_new_user_id INTEGER;
BEGIN
  IF NOT public.validate_username(p_username) THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  INSERT INTO public.nhan_vien (
    username,
    password,
    hashed_password,
    full_name,
    role,
    khoa_phong
  ) VALUES (
    p_username,
    'hashed password',
    extensions.crypt(p_password, extensions.gen_salt('bf', 12)),
    p_full_name,
    p_role,
    p_khoa_phong
  )
  RETURNING id INTO v_new_user_id;

  RETURN v_new_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_user(TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'Creates a user with hashed password and basic profile metadata.';

-- RPC: update_user_info ----------------------------------------------------
DROP FUNCTION IF EXISTS public.update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_user_info(
  p_admin_user_id INTEGER,
  p_target_user_id INTEGER,
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_admin_role TEXT;
  v_admin_username TEXT;
  v_target_username TEXT;
BEGIN
  SELECT role, username
  INTO v_admin_role, v_admin_username
  FROM public.nhan_vien
  WHERE id = p_admin_user_id;

  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: acting user not found';
  END IF;

  IF v_admin_role NOT IN ('admin', 'global') THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required';
  END IF;

  IF NOT public.validate_username(p_username) THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  SELECT username
  INTO v_target_username
  FROM public.nhan_vien
  WHERE id = p_target_user_id;

  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', p_target_user_id;
  END IF;

  UPDATE public.nhan_vien
  SET username = p_username,
      hashed_password = extensions.crypt(p_password, extensions.gen_salt('bf', 12)),
      password = 'hashed password',
      full_name = p_full_name,
      role = p_role,
      khoa_phong = p_khoa_phong
  WHERE id = p_target_user_id;

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
    p_admin_user_id,
    v_admin_username,
    'USER_UPDATE',
    p_target_user_id,
    v_target_username,
    jsonb_build_object(
      'username', p_username,
      'full_name', p_full_name,
      'role', p_role,
      'khoa_phong', p_khoa_phong,
      'password_updated', TRUE
    ),
      COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
    COALESCE(current_setting('request.headers', true), 'unknown')
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'Admin/global RPC to update user credentials and profile data with audit logging.';

-- RPC: reset_password_by_admin ---------------------------------------------
DROP FUNCTION IF EXISTS public.reset_password_by_admin(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.reset_password_by_admin(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.reset_password_by_admin(
  p_admin_user_id BIGINT,
  p_target_user_id BIGINT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  admin_rec   public.nhan_vien%ROWTYPE;
  target_rec  public.nhan_vien%ROWTYPE;
  new_password TEXT := 'userqltb';
BEGIN
  SELECT *
  INTO admin_rec
  FROM public.nhan_vien
  WHERE id = p_admin_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admin user not found');
  END IF;

  IF admin_rec.role NOT IN ('admin', 'global') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only admin or global roles can reset passwords');
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
      user_agent
    ) VALUES (
      p_admin_user_id,
      admin_rec.username,
      'password_reset_admin',
      p_target_user_id,
      target_rec.username,
      'Admin reset password to default value',
        COALESCE(pg_catalog.inet_client_addr(), '0.0.0.0'::INET),
      COALESCE(current_setting('request.headers', true), 'unknown')
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

GRANT EXECUTE ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.reset_password_by_admin(BIGINT, BIGINT)
IS 'Admin/global RPC to reset a user password to the default value with audit logging.';

-- RPC: change_password -----------------------------------------------------
DROP FUNCTION IF EXISTS public.change_password(INTEGER, TEXT, TEXT);

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
  user_record public.nhan_vien%ROWTYPE;
  password_valid BOOLEAN := FALSE;
BEGIN
  SELECT *
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

GRANT EXECUTE ON FUNCTION public.change_password(INTEGER, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.change_password(INTEGER, TEXT, TEXT)
IS 'Allows a user to change their password with hashed storage and audit logging.';

-- RPC: authenticate_user_dual_mode ---------------------------------------
DROP FUNCTION IF EXISTS public.authenticate_user_dual_mode(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.authenticate_user_dual_mode(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE (
  user_id BIGINT,
  username TEXT,
  full_name TEXT,
  role TEXT,
  khoa_phong TEXT,
  don_vi BIGINT,
  dia_ban_id BIGINT,
  dia_ban_ma TEXT,
  is_authenticated BOOLEAN,
  authentication_mode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $func$
DECLARE
  v_username TEXT;
  user_record RECORD;
  password_valid BOOLEAN := FALSE;
  auth_mode TEXT := 'unknown';
  v_resolved_don_vi BIGINT;
  v_resolved_dia_ban BIGINT;
  v_resolved_dia_ban_ma TEXT;
  v_tenant_active BOOLEAN := TRUE;
  v_dia_ban_active BOOLEAN := TRUE;
BEGIN
  v_username := lower(trim(p_username));

  SELECT
    nv.id,
    nv.username,
    nv.full_name,
    nv.role,
    nv.khoa_phong,
    nv.password,
    nv.hashed_password,
    nv.current_don_vi,
    nv.don_vi,
    nv.dia_ban_id,
    COALESCE(dv_current.dia_ban_id, dv_home.dia_ban_id) AS joined_dia_ban_id,
    COALESCE(dv_current.active, TRUE) AS current_don_vi_active,
    COALESCE(dv_home.active, TRUE) AS home_don_vi_active
  INTO user_record
  FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv_current ON dv_current.id = nv.current_don_vi
  LEFT JOIN public.don_vi dv_home ON dv_home.id = nv.don_vi
  WHERE lower(nv.username) = v_username
  LIMIT 1;

  IF user_record.id IS NULL THEN
    RETURN QUERY SELECT
      NULL::BIGINT,
      v_username,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      FALSE,
      'user_not_found'::TEXT;
    RETURN;
  END IF;

  -- Guard against obvious hashed passwords submitted as input
  IF p_password = 'hashed password'
     OR p_password ILIKE '%hash%'
     OR p_password ILIKE '%crypt%'
     OR length(p_password) > 200 THEN
    RETURN QUERY SELECT
      user_record.id,
      user_record.username,
      user_record.full_name,
      user_record.role,
      user_record.khoa_phong,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      FALSE,
      'blocked_suspicious'::TEXT;
    RETURN;
  END IF;

  -- Verify password using hashed column first, then legacy plaintext fallback
  IF user_record.hashed_password IS NOT NULL AND user_record.hashed_password <> '' THEN
    password_valid := (extensions.crypt(p_password, user_record.hashed_password) = user_record.hashed_password);
    IF password_valid THEN
      auth_mode := 'hashed';
    END IF;
  END IF;

  IF NOT password_valid
     AND user_record.password IS NOT NULL
     AND user_record.password <> 'hashed password' THEN
    password_valid := (user_record.password = p_password);
    IF password_valid THEN
      auth_mode := 'plain';
    END IF;
  END IF;

  IF NOT password_valid THEN
    RETURN QUERY SELECT
      user_record.id,
      user_record.username,
      user_record.full_name,
      user_record.role,
      user_record.khoa_phong,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      FALSE,
      auth_mode;
    RETURN;
  END IF;

  v_resolved_don_vi := COALESCE(user_record.current_don_vi, user_record.don_vi);
  IF v_resolved_don_vi IS NOT NULL THEN
    SELECT active, dia_ban_id
    INTO v_tenant_active, v_resolved_dia_ban
    FROM public.don_vi
    WHERE id = v_resolved_don_vi
    LIMIT 1;

    IF NOT FOUND THEN
      v_tenant_active := TRUE;
      v_resolved_dia_ban := COALESCE(user_record.dia_ban_id, user_record.joined_dia_ban_id);
    ELSE
      v_tenant_active := COALESCE(v_tenant_active, TRUE);
      IF v_resolved_dia_ban IS NULL THEN
        v_resolved_dia_ban := COALESCE(user_record.dia_ban_id, user_record.joined_dia_ban_id);
      END IF;
    END IF;
  ELSE
    v_tenant_active := TRUE;
    v_resolved_dia_ban := COALESCE(user_record.dia_ban_id, user_record.joined_dia_ban_id);
  END IF;

  IF v_resolved_dia_ban IS NOT NULL THEN
    SELECT ma_dia_ban, active
    INTO v_resolved_dia_ban_ma, v_dia_ban_active
    FROM public.dia_ban
    WHERE id = v_resolved_dia_ban
    LIMIT 1;

    IF NOT FOUND THEN
      v_resolved_dia_ban_ma := NULL;
      v_dia_ban_active := TRUE;
    ELSE
      v_dia_ban_active := COALESCE(v_dia_ban_active, TRUE);
    END IF;
  ELSE
    v_resolved_dia_ban_ma := NULL;
    v_dia_ban_active := TRUE;
  END IF;

  -- Reject access if tenant/dia_ban is inactive for scoped roles
  IF LOWER(COALESCE(user_record.role, '')) NOT IN ('global', 'admin') THEN
    IF v_resolved_don_vi IS NOT NULL AND v_tenant_active IS DISTINCT FROM TRUE THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        v_resolved_dia_ban,
        v_resolved_dia_ban_ma,
        FALSE,
        'tenant_inactive'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF LOWER(COALESCE(user_record.role, '')) = 'regional_leader' THEN
    IF v_resolved_dia_ban IS NULL THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        NULL::BIGINT,
        NULL::TEXT,
        FALSE,
        'missing_dia_ban'::TEXT;
      RETURN;
    END IF;

    IF v_dia_ban_active IS DISTINCT FROM TRUE THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        v_resolved_dia_ban,
        v_resolved_dia_ban_ma,
        FALSE,
        'dia_ban_inactive'::TEXT;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT
    user_record.id,
    user_record.username,
    user_record.full_name,
    user_record.role,
    user_record.khoa_phong,
    v_resolved_don_vi,
    v_resolved_dia_ban,
    v_resolved_dia_ban_ma,
    TRUE,
    auth_mode;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT)
IS 'Authenticates a user supporting hashed/plain passwords and returns role, don_vi, dia_ban claims.';

COMMIT;
