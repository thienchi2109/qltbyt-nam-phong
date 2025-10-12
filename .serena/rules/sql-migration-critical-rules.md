# Critical Rules for SQL Migrations

## MANDATORY Pre-Flight Checks

### Before Writing ANY SQL Migration:

1. **READ schema.md FIRST**
   - Location: `d:\qltbyt-nam-phong\schema.md`
   - Verify table structure (lines 1-259)
   - Check EXACT column names
   - Note foreign key relationships
   - Confirm data types

2. **CHECK Existing RPC Functions**
   - Search: `supabase/migrations/**/*.sql`
   - Look for similar patterns (equipment_list_enhanced, repair_request_list)
   - Copy authentication patterns from existing functions
   - NEVER use `auth.uid()` - our system uses integer user IDs, not UUIDs

3. **VERIFY Column Names**
   - ❌ NEVER assume: `ngay_tao`, `don_vi_quan_ly`, `ngay_cap_nhat`
   - ✅ ALWAYS use: `created_at`, `don_vi`, `updated_at`
   - Use semantic_search or grep_search to find actual usage

## JWT Authentication Pattern (REQUIRED)

```sql
DECLARE
  v_user_role TEXT;
  v_user_don_vi BIGINT;
BEGIN
  -- Get from JWT claims (NOT auth.uid())
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
  
  -- Validate role
  IF v_user_role IS NULL OR v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid or missing role';
  END IF;
  
  -- Tenant isolation (except regional_leader and global)
  IF v_user_role != 'global' AND v_user_role != 'regional_leader' THEN
    IF v_user_don_vi IS NULL THEN
      RAISE EXCEPTION 'Forbidden: Tenant context required';
    END IF;
    -- Force tenant filter
    p_don_vi := v_user_don_vi;
  END IF;
END;
```

## Common Table Schemas

### thiet_bi (Equipment)
- Primary key: `id BIGINT`
- Tenant: `don_vi BIGINT` (NOT don_vi_quan_ly)
- Created: `created_at TIMESTAMPTZ`
- Code: `ma_thiet_bi TEXT`

### yeu_cau_luan_chuyen (Transfer Requests)
- Primary key: `id BIGINT`
- Equipment: `thiet_bi_id BIGINT`
- Status: `trang_thai TEXT` (cho_duyet, da_duyet, dang_luan_chuyen, da_ban_giao, hoan_thanh)
- Created: `created_at TIMESTAMPTZ` (NOT ngay_tao)
- Updated: `updated_at TIMESTAMPTZ` (NOT ngay_cap_nhat)
- Approval: `nguoi_duyet_id BIGINT`, `ngay_duyet TIMESTAMPTZ`, `ghi_chu_duyet TEXT`

## Lesson from 2025-10-12

**Incident:** Wasted 20 minutes debugging wrong column names
**Root Cause:** Did not read schema.md before writing SQL
**User Feedback:** "I've noticed you to check the column name carefully first but you didn't do"

**Prevention:**
1. ALWAYS read schema.md FIRST
2. NEVER assume column names from external sources
3. TEST in SQL Editor before asking user to apply
4. Check existing functions for patterns

This is NON-NEGOTIABLE for future work.
