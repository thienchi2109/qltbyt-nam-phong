-- Regional Leader Role Schema Foundation (DM-1)
-- Creates dia_ban table, foreign keys, helper functions, and indexes
-- Migration Date: 2025-09-27
-- YYYYMMDDHHMMSS: 20250927120000

BEGIN;

-- =============================================================================
-- 1. CREATE dia_ban TABLE WITH HIERARCHICAL SUPPORT
-- =============================================================================

-- Create the dia_ban (regional district) table
CREATE TABLE IF NOT EXISTS public.dia_ban (
    id BIGSERIAL PRIMARY KEY,
    ma_dia_ban TEXT NOT NULL UNIQUE,
    ten_dia_ban TEXT NOT NULL,
    ten_lanh_dao TEXT,
    so_luong_don_vi_truc_thuoc INTEGER NOT NULL DEFAULT 0 
        CHECK (so_luong_don_vi_truc_thuoc >= 0),
    dia_chi TEXT,
    logo_dia_ban_url TEXT,
    
    -- Governance and hierarchy columns
    cap_do TEXT, -- Level: 'tinh', 'huyen', 'xa', etc.
    parent_id BIGINT REFERENCES public.dia_ban(id),
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    -- Audit columns
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment to dia_ban table
COMMENT ON TABLE public.dia_ban IS 'Regional districts (địa bàn) for organizing organizational units';
COMMENT ON COLUMN public.dia_ban.ma_dia_ban IS 'Unique regional district code';
COMMENT ON COLUMN public.dia_ban.ten_dia_ban IS 'Regional district name';
COMMENT ON COLUMN public.dia_ban.ten_lanh_dao IS 'Regional leader name';
COMMENT ON COLUMN public.dia_ban.so_luong_don_vi_truc_thuoc IS 'Number of organizational units under this region';
COMMENT ON COLUMN public.dia_ban.parent_id IS 'Parent region for hierarchical organization';
COMMENT ON COLUMN public.dia_ban.cap_do IS 'Administrative level (provincial, district, commune, etc.)';

-- Create updated_at trigger for dia_ban
CREATE OR REPLACE FUNCTION public.update_dia_ban_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_dia_ban_updated_at
    BEFORE UPDATE ON public.dia_ban
    FOR EACH ROW
    EXECUTE FUNCTION public.update_dia_ban_updated_at();

-- =============================================================================
-- 2. ADD FOREIGN KEY COLUMNS TO EXISTING TABLES
-- =============================================================================

-- Add dia_ban_id to don_vi table (required)
ALTER TABLE public.don_vi 
ADD COLUMN IF NOT EXISTS dia_ban_id BIGINT;

-- Add dia_ban_id to nhan_vien table (optional but recommended)
ALTER TABLE public.nhan_vien 
ADD COLUMN IF NOT EXISTS dia_ban_id BIGINT;

-- Add foreign key constraints (will be enforced after backfill)
-- Note: Initially nullable to allow for gradual migration
-- Will be made NOT NULL after backfill process

-- Don't add FK constraints yet - will be added after backfill
-- ALTER TABLE public.don_vi 
-- ADD CONSTRAINT fk_don_vi_dia_ban 
-- FOREIGN KEY (dia_ban_id) REFERENCES public.dia_ban(id);

-- ALTER TABLE public.nhan_vien 
-- ADD CONSTRAINT fk_nhan_vien_dia_ban 
-- FOREIGN KEY (dia_ban_id) REFERENCES public.dia_ban(id);

-- =============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary indexes for dia_ban
CREATE UNIQUE INDEX IF NOT EXISTS idx_dia_ban_ma_dia_ban 
ON public.dia_ban(ma_dia_ban);

CREATE INDEX IF NOT EXISTS idx_dia_ban_parent_active 
ON public.dia_ban(parent_id, active);

CREATE INDEX IF NOT EXISTS idx_dia_ban_active_sort 
ON public.dia_ban(active, sort_order) WHERE active = true;

-- Optional GIN index for fuzzy search on ten_dia_ban (requires pg_trgm extension)
-- Commented out initially - can be added later if needed
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_dia_ban_ten_gin 
-- ON public.dia_ban USING gin(ten_dia_ban gin_trgm_ops);

-- Foreign key indexes (will improve join performance)
CREATE INDEX IF NOT EXISTS idx_don_vi_dia_ban_id 
ON public.don_vi(dia_ban_id) WHERE dia_ban_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhan_vien_dia_ban_id 
ON public.nhan_vien(dia_ban_id) WHERE dia_ban_id IS NOT NULL;

-- =============================================================================
-- 4. HELPER FUNCTION FOR SESSION-BASED ACCESS CONTROL
-- =============================================================================

-- Function to get allowed don_vi for current session based on role and dia_ban
CREATE OR REPLACE FUNCTION public.allowed_don_vi_for_session()
RETURNS BIGINT[] 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_role TEXT;
    v_user_don_vi BIGINT;
    v_user_dia_ban BIGINT;
    v_allowed_don_vi BIGINT[];
BEGIN
    -- Get user context from JWT claims
    v_user_role := current_setting('request.jwt.claims', true)::json->>'role';
    v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
    v_user_dia_ban := (current_setting('request.jwt.claims', true)::json->>'dia_ban')::BIGINT;
    
    -- Handle different role access patterns
    CASE v_user_role
        WHEN 'global' THEN
            -- Global users can access all don_vi
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE active = true;
            
        WHEN 'regional_leader' THEN
            -- Regional leaders can access all don_vi in their dia_ban
            IF v_user_dia_ban IS NULL THEN
                RAISE EXCEPTION 'Regional leader must have dia_ban assigned';
            END IF;
            
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE dia_ban_id = v_user_dia_ban 
            AND active = true;
            
        WHEN 'admin', 'to_qltb', 'qltb_khoa', 'technician', 'user' THEN
            -- Other roles are limited to their specific don_vi
            IF v_user_don_vi IS NULL THEN
                RAISE EXCEPTION 'User must have don_vi assigned for role %', v_user_role;
            END IF;
            
            v_allowed_don_vi := ARRAY[v_user_don_vi];
            
        ELSE
            -- Unknown role - no access
            RAISE EXCEPTION 'Unknown role: %', v_user_role;
    END CASE;
    
    -- Return empty array if no access (safety fallback)
    RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$$;

-- Grant execution to authenticated role
GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session() IS 
'Returns array of don_vi IDs that current session user can access based on role and dia_ban';

-- =============================================================================
-- 5. VERIFICATION HELPER FUNCTION
-- =============================================================================

-- Function to verify schema foundation setup
CREATE OR REPLACE FUNCTION public.verify_regional_leader_schema()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Check dia_ban table exists
    RETURN QUERY
    SELECT 
        'dia_ban_table_exists'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dia_ban') 
             THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'dia_ban table creation'::TEXT;
    
    -- Check dia_ban_id columns exist
    RETURN QUERY
    SELECT 
        'don_vi_dia_ban_id_column'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'don_vi' AND column_name = 'dia_ban_id'
        ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'don_vi.dia_ban_id column exists'::TEXT;
    
    RETURN QUERY
    SELECT 
        'nhan_vien_dia_ban_id_column'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'nhan_vien' AND column_name = 'dia_ban_id'
        ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'nhan_vien.dia_ban_id column exists'::TEXT;
    
    -- Check helper function exists
    RETURN QUERY
    SELECT 
        'allowed_don_vi_function'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'allowed_don_vi_for_session'
        ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'allowed_don_vi_for_session function exists'::TEXT;
    
    -- Check indexes exist
    RETURN QUERY
    SELECT 
        'dia_ban_indexes'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'dia_ban' AND indexname = 'idx_dia_ban_ma_dia_ban'
        ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'dia_ban primary indexes created'::TEXT;
        
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_regional_leader_schema() TO authenticated;

-- =============================================================================
-- 6. INITIAL DATA SETUP (SAMPLE)
-- =============================================================================

-- Insert sample dia_ban data for testing
-- This will be replaced with actual data during backfill phase
INSERT INTO public.dia_ban (ma_dia_ban, ten_dia_ban, ten_lanh_dao, cap_do, active) 
VALUES 
    ('SAMPLE_REGION', 'Sample Regional District', 'Sample Leader', 'tinh', true)
ON CONFLICT (ma_dia_ban) DO NOTHING;

-- =============================================================================
-- 7. COMMIT AND ANALYZE
-- =============================================================================

-- Commit the transaction
COMMIT;

-- Update statistics for new tables and indexes
ANALYZE public.dia_ban;
ANALYZE public.don_vi;
ANALYZE public.nhan_vien;

-- =============================================================================
-- 8. POST-MIGRATION VERIFICATION
-- =============================================================================

-- Run verification check
-- SELECT * FROM public.verify_regional_leader_schema();

-- Check sample data insertion
-- SELECT COUNT(*) as dia_ban_count FROM public.dia_ban;

-- =============================================================================
-- ROLLBACK PLAN (for emergency use)
-- =============================================================================
/*
-- To rollback this migration if needed:

BEGIN;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.verify_regional_leader_schema();
DROP FUNCTION IF EXISTS public.allowed_don_vi_for_session();
DROP FUNCTION IF EXISTS public.update_dia_ban_updated_at();

-- Drop foreign key columns (will lose data!)
ALTER TABLE public.nhan_vien DROP COLUMN IF EXISTS dia_ban_id;
ALTER TABLE public.don_vi DROP COLUMN IF EXISTS dia_ban_id;

-- Drop table (will lose all dia_ban data!)
DROP TABLE IF EXISTS public.dia_ban CASCADE;

COMMIT;
*/