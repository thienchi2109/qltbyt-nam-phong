-- =====================================================
-- SECURE USER FUNCTIONS WITH PASSWORD HASHING
-- =====================================================
-- Functions to securely create and update users with password hashing

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add hashed password column if it doesn't exist
ALTER TABLE nhan_vien ADD COLUMN IF NOT EXISTS hashed_password TEXT;

-- Simple username validation function (no restrictions)
CREATE OR REPLACE FUNCTION validate_username(username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check that username is not empty and doesn't contain spaces
  RETURN username IS NOT NULL
    AND length(trim(username)) > 0
    AND username !~ '\s';
END;
$$;

-- Function to create new user with hashed password
CREATE OR REPLACE FUNCTION create_user(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id INTEGER;
BEGIN
  -- Validate inputs
  IF NOT validate_username(p_username) THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  -- No password validation - allow any password

  -- Insert new user with hashed password
  INSERT INTO nhan_vien (username, password, hashed_password, full_name, role, khoa_phong)
  VALUES (p_username, 'hashed password', crypt(p_password, gen_salt('bf', 12)), p_full_name, p_role, p_khoa_phong)
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- Function to update user information (admin only)
CREATE OR REPLACE FUNCTION update_user_info(
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
AS $$
DECLARE
  admin_role TEXT;
  current_username TEXT;
BEGIN
  -- Verify admin permissions
  SELECT role INTO admin_role
  FROM nhan_vien
  WHERE id = p_admin_user_id;
  
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Validate inputs
  IF NOT validate_username(p_username) THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;
  
  -- Check if target user exists
  SELECT username INTO current_username
  FROM nhan_vien
  WHERE id = p_target_user_id;
  
  IF current_username IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', p_target_user_id;
  END IF;
  
  -- Update user information with hashed password
  UPDATE nhan_vien
  SET username = p_username,
      hashed_password = crypt(p_password, gen_salt('bf', 12)),
      password = 'hashed password', -- Set placeholder text
      full_name = p_full_name,
      role = p_role,
      khoa_phong = p_khoa_phong
  WHERE id = p_target_user_id;
  
  -- Invalidate all existing sessions for this user if password changed
  UPDATE user_sessions
  SET is_active = FALSE
  WHERE user_id = p_target_user_id;
  
  -- Log the action
  INSERT INTO audit_log (
    user_id, action, resource_type, resource_id, 
    new_values, ip_address
  ) VALUES (
    p_admin_user_id, 'USER_UPDATE', 'nhan_vien', p_target_user_id,
    jsonb_build_object(
      'username', p_username, 
      'full_name', p_full_name, 
      'role', p_role, 
      'khoa_phong', p_khoa_phong,
      'password_updated', true
    ),
    inet_client_addr()
  );
  
  RETURN TRUE;
END;
$$;

-- Function to change password
CREATE OR REPLACE FUNCTION change_password(
  p_user_id INTEGER,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_hash TEXT;
  current_plain TEXT;
BEGIN
  -- Get current password info
  SELECT hashed_password, password INTO current_hash, current_plain
  FROM nhan_vien
  WHERE id = p_user_id;

  -- Verify old password (try hashed first, then plain text for backward compatibility)
  IF current_hash IS NOT NULL AND current_hash = crypt(p_old_password, current_hash) THEN
    -- Hashed password verification successful
  ELSIF current_plain IS NOT NULL AND current_plain = p_old_password THEN
    -- Plain text password verification successful (backward compatibility)
  ELSE
    RETURN FALSE; -- Invalid old password
  END IF;

  -- Update password with hash
  UPDATE nhan_vien
  SET hashed_password = crypt(p_new_password, gen_salt('bf', 12)),
      password = 'hashed password'
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- =====================================================
-- DUAL MODE AUTHENTICATION FUNCTION
-- =====================================================
-- Enhanced authentication function supporting both hashed and legacy passwords

CREATE OR REPLACE FUNCTION authenticate_user_dual_mode(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE(
  user_id INTEGER,
  username TEXT,
  full_name TEXT,
  role TEXT,
  khoa_phong TEXT,
  is_authenticated BOOLEAN,
  authentication_mode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  password_valid BOOLEAN := FALSE;
  auth_mode TEXT := 'unknown';
BEGIN
  -- Find user by username
  SELECT id, nv.username, nv.full_name, nv.role, nv.khoa_phong, nv.password, nv.hashed_password
  INTO user_record
  FROM nhan_vien nv
  WHERE nv.username = p_username;

  -- Check if user exists
  IF user_record.id IS NULL THEN
    RETURN QUERY SELECT
      NULL::INTEGER,
      p_username::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      FALSE,
      'user_not_found'::TEXT;
    RETURN;
  END IF;

  -- 🚨 SECURITY: Block suspicious password attempts
  IF p_password = 'hashed password' OR
     p_password ILIKE '%hash%' OR
     p_password ILIKE '%crypt%' OR
     LENGTH(p_password) > 200 THEN
    RETURN QUERY SELECT
      user_record.id,
      user_record.username::TEXT,
      user_record.full_name::TEXT,
      user_record.role::TEXT,
      user_record.khoa_phong::TEXT,
      FALSE,
      'blocked_suspicious'::TEXT;
    RETURN;
  END IF;

  -- Try hashed password authentication first (preferred method)
  IF user_record.hashed_password IS NOT NULL AND user_record.hashed_password != '' THEN
    password_valid := (user_record.hashed_password = crypt(p_password, user_record.hashed_password));
    IF password_valid THEN
      auth_mode := 'hashed';
    END IF;
  END IF;

  -- Fallback to plain text password (legacy compatibility)
  IF NOT password_valid AND user_record.password IS NOT NULL AND user_record.password != 'hashed password' THEN
    password_valid := (user_record.password = p_password);
    IF password_valid THEN
      auth_mode := 'plain';
    END IF;
  END IF;

  -- Return authentication result
  RETURN QUERY SELECT
    user_record.id,
    user_record.username::TEXT,
    user_record.full_name::TEXT,
    user_record.role::TEXT,
    user_record.khoa_phong::TEXT,
    password_valid,
    auth_mode::TEXT;
END;
$$;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION validate_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION change_password(INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_user_dual_mode(TEXT, TEXT) TO anon;

-- Add comments
COMMENT ON FUNCTION validate_username(TEXT) IS 'Simple username validation (no spaces, not empty)';
COMMENT ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Create new user with bcrypt hashed password';
COMMENT ON FUNCTION update_user_info(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Securely update user information with password hashing (admin only)';
COMMENT ON FUNCTION change_password(INTEGER, TEXT, TEXT) IS 'Change user password with verification and hashing';
COMMENT ON FUNCTION authenticate_user_dual_mode(TEXT, TEXT) IS 'Dual mode authentication supporting both hashed and legacy passwords with security checks';
