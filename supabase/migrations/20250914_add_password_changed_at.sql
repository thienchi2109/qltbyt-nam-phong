-- Add password_changed_at column to track password changes for forced re-login
-- This column will be used to invalidate JWT tokens that are older than the last password change
DROP FUNCTION change_password(integer,text,text);
-- Add column to nhan_vien table
ALTER TABLE nhan_vien 
ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone DEFAULT NOW();

-- Set initial value for existing users to current timestamp
UPDATE nhan_vien 
SET password_changed_at = NOW() 
WHERE password_changed_at IS NULL;

-- Update the change_password function to set password_changed_at
CREATE OR REPLACE FUNCTION change_password(
    p_user_id INTEGER,
    p_old_password TEXT,
    p_new_password TEXT
) RETURNS jsonb AS $$
DECLARE
    user_record nhan_vien%ROWTYPE;
    result jsonb;
BEGIN
    -- Get user record
    SELECT * INTO user_record FROM nhan_vien WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Verify current password (dual mode support)
    IF user_record.hashed_password IS NOT NULL AND user_record.hashed_password != '' THEN
        -- User has hashed password - use secure verification
        IF NOT crypt(p_old_password, user_record.hashed_password) = user_record.hashed_password THEN
            RETURN jsonb_build_object('success', false, 'message', 'Current password is incorrect');
        END IF;
    ELSE
        -- Fallback to plaintext verification (for legacy users)
        IF user_record.password != p_old_password THEN
            RETURN jsonb_build_object('success', false, 'message', 'Current password is incorrect');
        END IF;
    END IF;

    -- Update password with hash and set password_changed_at
    UPDATE nhan_vien 
    SET hashed_password = crypt(p_new_password, gen_salt('bf')),
        password = 'hashed password',  -- Clear plaintext
        password_changed_at = NOW()    -- Track when password was changed
    WHERE id = p_user_id;

    -- Log the password change (with error handling)
    BEGIN
        INSERT INTO public.audit_logs (
            admin_user_id, admin_username, action_type, target_user_id, target_username,
            action_details, ip_address, user_agent
        ) VALUES (
            p_user_id, user_record.username, 'password_change', p_user_id, user_record.username,
            'User changed their own password', COALESCE(inet_client_addr()::TEXT, 'unknown'), 
            COALESCE(current_setting('request.headers', true), 'unknown')
        );
    EXCEPTION WHEN others THEN
        -- Log audit failure but don't fail the password change
        RAISE WARNING 'Failed to log password change: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error updating password: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION change_password(INTEGER, TEXT, TEXT) TO anon, authenticated;

-- Add comment
COMMENT ON COLUMN nhan_vien.password_changed_at IS 'Timestamp when password was last changed, used for forced re-login';
COMMENT ON FUNCTION change_password(INTEGER, TEXT, TEXT) IS 'Change user password with security validation and tracking. Returns jsonb with success/message fields';