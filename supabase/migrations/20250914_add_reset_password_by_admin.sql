-- Create reset_password_by_admin RPC used by the admin UI
-- Ensures default password reset, updates password_changed_at, and writes audit log

-- Required for extensions.crypt() and extensions.gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.reset_password_by_admin(
  p_admin_user_id BIGINT,
  p_target_user_id BIGINT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  admin_rec   nhan_vien%ROWTYPE;
  target_rec  nhan_vien%ROWTYPE;
  new_password TEXT := 'userqltb';
BEGIN
  -- Fetch admin and target users
  SELECT * INTO admin_rec FROM nhan_vien WHERE id = p_admin_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admin user not found');
  END IF;

  SELECT * INTO target_rec FROM nhan_vien WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target user not found');
  END IF;

  -- Authorization: only admins may perform this action
  IF admin_rec.role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only admins can reset passwords');
  END IF;

  -- Optional: prevent self-reset to avoid confusion (allow if desired)
  -- IF p_admin_user_id = p_target_user_id THEN
  --   RETURN jsonb_build_object('success', false, 'message', 'Use change_password to change your own password');
  -- END IF;

  -- Update the target user's password (hash), clear legacy plaintext, and track timestamp
  UPDATE nhan_vien
  SET hashed_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      password = 'hashed password',
      password_changed_at = NOW(),
      failed_attempts = 0,
      password_reset_required = COALESCE(password_reset_required, false)
  WHERE id = p_target_user_id;

  -- Audit log (best-effort)
  BEGIN
    INSERT INTO public.audit_logs (
      admin_user_id, admin_username, action_type, target_user_id, target_username,
      action_details, ip_address, user_agent
    ) VALUES (
      p_admin_user_id,
      admin_rec.username,
      'password_reset_admin',
      p_target_user_id,
      target_rec.username,
      'Admin reset password to default value',
      COALESCE(inet_client_addr()::TEXT, 'unknown'),
      COALESCE(current_setting('request.headers', true), 'unknown')
    );
  EXCEPTION WHEN others THEN
    -- Do not fail the operation if audit logging fails
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

-- Permissions
GRANT EXECUTE ON FUNCTION public.reset_password_by_admin(INTEGER, INTEGER) TO authenticated;
-- Do NOT grant to anon for safety

COMMENT ON FUNCTION public.reset_password_by_admin(INTEGER, INTEGER)
IS 'Admin-only RPC to reset a user\'s password to default, updates password_changed_at, and writes audit log. Returns jsonb with success/message.';
