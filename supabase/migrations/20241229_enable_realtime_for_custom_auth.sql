-- =============================================================================
-- ENABLE REALTIME FOR CUSTOM AUTH SYSTEM
-- Date: 2024-12-29  
-- Purpose: Enable Realtime Publications cho custom authentication system
-- Actions: 
--   1. Enable Realtime Publications cho 9 tables chính
--   2. Grant permissions cho anon role (để custom auth hoạt động)
--   3. Verify RLS status (should be disabled for custom auth)
-- =============================================================================

-- =============================================================================
-- SECTION 1: VERIFY RLS STATUS (Should be disabled for custom auth)
-- =============================================================================

-- Check RLS status - should all be false for custom auth
SELECT 
    'RLS STATUS CHECK' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '✅ CORRECT - RLS disabled for custom auth'
        ELSE '⚠️ WARNING - RLS enabled, may conflict with custom auth'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'thiet_bi',
    'nhan_vien', 
    'nhat_ky_su_dung',
    'lich_su_thiet_bi',
    'yeu_cau_luan_chuyen',
    'lich_su_luan_chuyen',
    'ke_hoach_bao_tri',
    'cong_viec_bao_tri',
    'yeu_cau_sua_chua'
)
ORDER BY tablename;

-- =============================================================================
-- SECTION 2: ENABLE Realtime Publications
-- =============================================================================

-- Enable realtime cho 9 tables chính
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS thiet_bi;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS nhan_vien;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS nhat_ky_su_dung;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS lich_su_thiet_bi;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS yeu_cau_luan_chuyen;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS lich_su_luan_chuyen;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS ke_hoach_bao_tri;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS cong_viec_bao_tri;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS yeu_cau_sua_chua;

-- =============================================================================
-- SECTION 3: Grant permissions cho Custom Auth System
-- =============================================================================

-- Grant permissions cho anon role (vì app sử dụng anon key với custom auth)
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT SELECT ON realtime.messages TO anon;

-- Grant full access cho các bảng chính với anon role (cho custom auth)
GRANT ALL ON thiet_bi TO anon;
GRANT ALL ON nhan_vien TO anon; 
GRANT ALL ON nhat_ky_su_dung TO anon;
GRANT ALL ON lich_su_thiet_bi TO anon;
GRANT ALL ON yeu_cau_luan_chuyen TO anon;
GRANT ALL ON lich_su_luan_chuyen TO anon;
GRANT ALL ON ke_hoach_bao_tri TO anon;
GRANT ALL ON cong_viec_bao_tri TO anon;
GRANT ALL ON yeu_cau_sua_chua TO anon;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- =============================================================================
-- SECTION 4: Verify Realtime Publications
-- =============================================================================

-- Kiểm tra publications đã được enable
SELECT 
    'REALTIME PUBLICATIONS VERIFICATION' as check_type,
    COUNT(*) as enabled_tables,
    CASE 
        WHEN COUNT(*) = 9 THEN '✅ PERFECT - All 9 tables enabled!'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - Only ' || COUNT(*) || '/9 tables'
        ELSE '❌ FAILED - No tables enabled'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN (
    'thiet_bi', 'nhan_vien', 'nhat_ky_su_dung', 'lich_su_thiet_bi',
    'yeu_cau_luan_chuyen', 'lich_su_luan_chuyen', 'ke_hoach_bao_tri',
    'cong_viec_bao_tri', 'yeu_cau_sua_chua'
);

-- List all enabled tables
SELECT 
    'ENABLED TABLES' as check_type,
    tablename,
    '✅ Realtime enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN (
    'thiet_bi', 'nhan_vien', 'nhat_ky_su_dung', 'lich_su_thiet_bi',
    'yeu_cau_luan_chuyen', 'lich_su_luan_chuyen', 'ke_hoach_bao_tri',
    'cong_viec_bao_tri', 'yeu_cau_sua_chua'
)
ORDER BY tablename;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🚀 REALTIME ENABLED FOR CUSTOM AUTH!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Realtime Publications enabled for 9 tables';
    RAISE NOTICE '🔑 Permissions granted for anon role (custom auth)';
    RAISE NOTICE '🔓 Custom auth system will work with realtime';
    RAISE NOTICE '';
    RAISE NOTICE '📋 ENABLED TABLES:';
    RAISE NOTICE '   - thiet_bi (Equipment)';
    RAISE NOTICE '   - nhan_vien (Staff)';
    RAISE NOTICE '   - nhat_ky_su_dung (Usage Logs)';
    RAISE NOTICE '   - lich_su_thiet_bi (Equipment History)';
    RAISE NOTICE '   - yeu_cau_luan_chuyen (Transfer Requests)';
    RAISE NOTICE '   - lich_su_luan_chuyen (Transfer History)';
    RAISE NOTICE '   - ke_hoach_bao_tri (Maintenance Plans)';
    RAISE NOTICE '   - cong_viec_bao_tri (Maintenance Tasks)';
    RAISE NOTICE '   - yeu_cau_sua_chua (Repair Requests)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '   1. Test realtime subscriptions in app';
    RAISE NOTICE '   2. Verify instant data updates';
    RAISE NOTICE '   3. Monitor performance';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ NOTE: Security handled by custom auth layer';
END $$;
