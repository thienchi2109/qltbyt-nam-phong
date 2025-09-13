-- =====================================================
-- PASSWORD MIGRATION BACKUP & PREPARATION
-- =====================================================
-- Create backup table and prepare for password migration

-- Create backup table để preserve original data
CREATE TABLE IF NOT EXISTS nhan_vien_backup_pre_hash AS 
SELECT * FROM nhan_vien;

-- Add migration tracking
ALTER TABLE nhan_vien_backup_pre_hash 
ADD COLUMN backup_created_at TIMESTAMPTZ DEFAULT NOW();

-- Create migration log table
CREATE TABLE IF NOT EXISTS password_migration_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username VARCHAR(50),
    migration_status VARCHAR(20) CHECK (migration_status IN ('pending', 'success', 'failed', 'rollback')),
    original_password_hash TEXT, -- For verification during rollback
    migration_timestamp TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT
);

-- Function to verify current database state
CREATE OR REPLACE FUNCTION verify_migration_prerequisites()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if pgcrypto extension exists
    RETURN QUERY SELECT 
        'pgcrypto_extension'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') 
             THEN 'OK' ELSE 'MISSING' END::TEXT,
        'Required for password hashing'::TEXT;
    
    -- Check if hashed_password column exists
    RETURN QUERY SELECT 
        'hashed_password_column'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'nhan_vien' AND column_name = 'hashed_password'
        ) THEN 'OK' ELSE 'MISSING' END::TEXT,
        'Column for storing hashed passwords'::TEXT;
        
    -- Check current user count
    RETURN QUERY SELECT 
        'user_count'::TEXT,
        'INFO'::TEXT,
        ('Total users: ' || (SELECT COUNT(*) FROM nhan_vien))::TEXT;
        
    -- Check users with plain text passwords
    RETURN QUERY SELECT 
        'users_need_migration'::TEXT,
        'INFO'::TEXT,
        ('Users needing migration: ' || (
            SELECT COUNT(*) FROM nhan_vien 
            WHERE hashed_password IS NULL OR hashed_password = ''
        ))::TEXT;
END;
$$;

-- Test bcrypt functionality
CREATE OR REPLACE FUNCTION test_bcrypt_functionality()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    test_password TEXT := 'test123';
    test_hash TEXT;
    verification_result BOOLEAN;
BEGIN
    -- Test password hashing
    BEGIN
        test_hash := crypt(test_password, gen_salt('bf', 12));
        
        RETURN QUERY SELECT 
            'hash_generation'::TEXT,
            'SUCCESS'::TEXT,
            ('Generated hash length: ' || LENGTH(test_hash))::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'hash_generation'::TEXT,
            'FAILED'::TEXT,
            SQLERRM::TEXT;
        RETURN;
    END;
    
    -- Test password verification
    BEGIN
        verification_result := (test_hash = crypt(test_password, test_hash));
        
        RETURN QUERY SELECT 
            'hash_verification'::TEXT,
            CASE WHEN verification_result THEN 'SUCCESS' ELSE 'FAILED' END::TEXT,
            ('Verification result: ' || verification_result)::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'hash_verification'::TEXT,
            'FAILED'::TEXT,
            SQLERRM::TEXT;
    END;
END;
$$;

-- Add comments
COMMENT ON TABLE nhan_vien_backup_pre_hash IS 'Backup table created before password hashing migration';
COMMENT ON TABLE password_migration_log IS 'Log table tracking password migration progress and results';
COMMENT ON FUNCTION verify_migration_prerequisites() IS 'Verify all prerequisites for password migration are met';
COMMENT ON FUNCTION test_bcrypt_functionality() IS 'Test bcrypt hashing and verification functionality'; 