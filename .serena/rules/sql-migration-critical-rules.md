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

## Date Range Filtering & Timezone Rules (2025-10-25)

DB TimeZone: UTC. Business timezone: Asia/Ho_Chi_Minh (+07).

### Goals
- Make date range filters index-friendly
- Compare using VN-local day boundaries
- Preserve tenant isolation & role logic

### REQUIRED Pattern (Half-open range)
```sql
-- Params are DATE (YYYY-MM-DD)
AND (
  p_date_from IS NULL OR
  r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
)
AND (
  p_date_to IS NULL OR
  r.ngay_yeu_cau <  ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
)
```

### DO NOT
- ❌ Do NOT apply functions to the indexed column (e.g., `(r.ngay_yeu_cau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`) — breaks index usage
- ❌ Do NOT cast DATE to timestamptz then `AT TIME ZONE` (wrong direction)
- ❌ Do NOT build timestamps via string concat ("2025-10-08 00:00:00 00:00:00+07")

### DO
- ✅ Convert PARAMS to timestamptz at VN boundaries (move functions to the right-hand side only)
- ✅ Use half-open range `>= start` and `< next_day`
- ✅ Ensure btree index on `yeu_cau_sua_chua(ngay_yeu_cau)` exists
- ✅ Optionally composite with status for common sort/filter

### Client Coordination
- Persist dates as local strings `yyyy-MM-dd` (not `toISOString().slice(0,10)`) to avoid UTC off-by-one shifts.
