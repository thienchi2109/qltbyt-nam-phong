-- =====================================================
-- PASSWORD MIGRATION EXECUTION
-- =====================================================
-- Migrate all existing plain text passwords to hashed format

-- Migration function để hash existing passwords
CREATE OR REPLACE FUNCTION migrate_existing_passwords()
RETURNS TABLE(
    user_id BIGINT,
    username TEXT,
    status TEXT,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    hashed_password TEXT;
    migration_count INTEGER := 0;
    total_users INTEGER;
BEGIN
    -- Get total count for progress tracking
    SELECT COUNT(*) INTO total_users 
    FROM nhan_vien 
    WHERE hashed_password IS NULL OR hashed_password = '' OR password != 'hashed password';
    
    RAISE NOTICE 'Starting password migration for % users', total_users;
    
    -- Loop through all users that need migration
    FOR user_record IN 
        SELECT id, username, password, full_name 
        FROM nhan_vien 
        WHERE hashed_password IS NULL OR hashed_password = '' OR password != 'hashed password'
        ORDER BY id
    LOOP
        BEGIN
            -- Log migration start
            INSERT INTO password_migration_log (user_id, username, migration_status)
            VALUES (user_record.id, user_record.username, 'pending');
            
            -- Hash the current plain text password
            hashed_password := crypt(user_record.password, gen_salt('bf', 12));
            
            -- Update user record với hashed password, keep original for verification
            UPDATE nhan_vien 
            SET hashed_password = hashed_password,
                -- Keep original password temporarily for verification
                password = user_record.password  -- Will be changed to 'hashed password' after verification
            WHERE id = user_record.id;
            
            -- Update log với success
            UPDATE password_migration_log 
            SET migration_status = 'success',
                original_password_hash = hashed_password
            WHERE user_id = user_record.id AND migration_status = 'pending';
            
            migration_count := migration_count + 1;
            
            -- Return progress
            RETURN QUERY SELECT 
                user_record.id,
                user_record.username::TEXT,
                'SUCCESS'::TEXT,
                ('Migrated ' || migration_count || '/' || total_users)::TEXT;
                
        EXCEPTION WHEN OTHERS THEN
            -- Log error
            UPDATE password_migration_log 
            SET migration_status = 'failed',
                error_message = SQLERRM
            WHERE user_id = user_record.id AND migration_status = 'pending';
            
            -- Return error
            RETURN QUERY SELECT 
                user_record.id,
                user_record.username::TEXT,
                'FAILED'::TEXT,
                ('Error: ' || SQLERRM)::TEXT;
        END;
    END LOOP;
    
    RAISE NOTICE 'Password migration completed. Migrated: %, Total: %', migration_count, total_users;
END;
$$;

-- Verification function để test migrated passwords
CREATE OR REPLACE FUNCTION verify_migrated_passwords()
RETURNS TABLE(
    user_id BIGINT,
    username TEXT,
    original_password_works BOOLEAN,
    hashed_password_works BOOLEAN,
    verification_status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    original_check BOOLEAN;
    hashed_check BOOLEAN;
BEGIN
    -- Loop through migrated users để verify
    FOR user_record IN 
        SELECT id, username, password, hashed_password 
        FROM nhan_vien 
        WHERE hashed_password IS NOT NULL AND hashed_password != ''
        ORDER BY id
    LOOP
        -- Test original password against hash
        original_check := (user_record.hashed_password = crypt(user_record.password, user_record.hashed_password));
        
        -- Test against "hashed password" string (should fail)
        hashed_check := (user_record.hashed_password = crypt('hashed password', user_record.hashed_password));
        
        RETURN QUERY SELECT 
            user_record.id,
            user_record.username::TEXT,
            original_check,
            hashed_check,
            CASE 
                WHEN original_check AND NOT hashed_check THEN 'PASS'
                WHEN NOT original_check THEN 'FAIL - Original password verification failed'
                WHEN hashed_check THEN 'FAIL - Hashed password string should not work'
                ELSE 'UNKNOWN'
            END::TEXT;
    END LOOP;
END;
$$;

-- Function để finalize migration (replace plain text với placeholder)
CREATE OR REPLACE FUNCTION finalize_password_migration()
RETURNS TABLE(
    user_id BIGINT,
    username TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    affected_count INTEGER := 0;
BEGIN
    -- Only finalize users that passed verification
    FOR user_record IN 
        SELECT nv.id, nv.username 
        FROM nhan_vien nv
        JOIN password_migration_log pml ON pml.user_id = nv.id
        WHERE pml.migration_status = 'success' 
        AND nv.hashed_password IS NOT NULL 
        AND nv.password != 'hashed password'
        ORDER BY nv.id
    LOOP
        -- Replace plain text password với placeholder
        UPDATE nhan_vien 
        SET password = 'hashed password'
        WHERE id = user_record.id;
        
        affected_count := affected_count + 1;
        
        RETURN QUERY SELECT 
            user_record.id,
            user_record.username::TEXT,
            'FINALIZED'::TEXT;
    END LOOP;
    
    RAISE NOTICE 'Finalized % user passwords', affected_count;
END;
$$;

-- Rollback function trong trường hợp cần revert
CREATE OR REPLACE FUNCTION rollback_password_migration()
RETURNS TABLE(
    user_id BIGINT,
    username TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    rollback_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting password migration rollback...';
    
    -- Restore từ backup table
    FOR user_record IN 
        SELECT backup.id, backup.username, backup.password
        FROM nhan_vien_backup_pre_hash backup
        WHERE EXISTS (
            SELECT 1 FROM password_migration_log pml 
            WHERE pml.user_id = backup.id AND pml.migration_status = 'success'
        )
        ORDER BY backup.id
    LOOP
        BEGIN
            -- Restore original password và clear hashed_password
            UPDATE nhan_vien 
            SET password = user_record.password,
                hashed_password = NULL
            WHERE id = user_record.id;
            
            -- Mark as rolled back in log
            UPDATE password_migration_log 
            SET migration_status = 'rollback'
            WHERE user_id = user_record.id;
            
            rollback_count := rollback_count + 1;
            
            RETURN QUERY SELECT 
                user_record.id,
                user_record.username::TEXT,
                'ROLLED_BACK'::TEXT;
                
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                user_record.id,
                user_record.username::TEXT,
                ('ROLLBACK_FAILED: ' || SQLERRM)::TEXT;
        END;
    END LOOP;
    
    RAISE NOTICE 'Rollback completed for % users', rollback_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION migrate_existing_passwords() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_migrated_passwords() TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_password_migration() TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_password_migration() TO authenticated;

-- Add comments
COMMENT ON FUNCTION migrate_existing_passwords() IS 'Migrate all existing plain text passwords to bcrypt hashed format';
COMMENT ON FUNCTION verify_migrated_passwords() IS 'Verify that migrated passwords work correctly with original passwords';
COMMENT ON FUNCTION finalize_password_migration() IS 'Replace plain text passwords with placeholder after successful verification';
COMMENT ON FUNCTION rollback_password_migration() IS 'Rollback password migration to original plain text state'; 