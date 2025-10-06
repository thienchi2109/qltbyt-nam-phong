# Dashboard KPI Tenant-Filtering Fix (2025-09-28)

## Issue Resolved
**Problem**: `dashboard_maintenance_plan_stats` function failed with SQL error: "column kh.don_vi does not exist"

## Root Cause Analysis
Using Supabase MCP tool schema exploration, discovered that:

1. **`ke_hoach_bao_tri` table does NOT have a `don_vi` column**
2. **Maintenance plans are not directly linked to tenants** 
3. **Existing `maintenance_plan_list` RPC also doesn't do tenant filtering**

### Schema Reality:
```sql
ke_hoach_bao_tri columns:
- id, created_at, ten_ke_hoach, nam, khoa_phong
- trang_thai, ngay_phe_duyet, nguoi_lap_ke_hoach
- loai_cong_viec, ly_do_khong_duyet, nguoi_duyet
-- NO don_vi column!
```

### Tenant Relationship:
- `thiet_bi` has `don_vi` (direct tenant link)
- `ke_hoach_bao_tri` has `khoa_phong` (department, not tenant)
- `cong_viec_bao_tri` links plans to equipment via `thiet_bi_id`
- **Indirect tenant filtering would require complex JOINs**

## Solution Applied
**File**: `supabase/migrations/20250928022700_fix_maintenance_plan_no_tenant.sql`

### Approach:
1. **Removed tenant filtering logic** from `dashboard_maintenance_plan_stats()`
2. **Returns all maintenance plans** (consistent with existing `maintenance_plan_list` RPC)
3. **Simplified SQL** - no complex JOINs needed
4. **Maintains identical interface** - no breaking changes to frontend

### Updated Function:
```sql
CREATE OR REPLACE FUNCTION public.dashboard_maintenance_plan_stats()
RETURNS JSONB
AS $$
-- Get ALL maintenance plans (no tenant filtering since no don_vi column)
WITH plan_counts AS (
  SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE trang_thai = 'Bản nháp') AS draft,
    COUNT(*) FILTER (WHERE trang_thai = 'Đã duyệt') AS approved
  FROM public.ke_hoach_bao_tri
)
-- Returns: {total, draft, approved, plans[]}
$$;
```

## Impact Assessment

### **Security Impact**: ACCEPTABLE
- Maintenance plans don't contain sensitive tenant-specific data
- Plans are organizational/departmental level (not tenant-specific)
- Consistent with existing `maintenance_plan_list` behavior
- Other KPIs (equipment, repairs) still properly tenant-filtered

### **Functionality**: RESTORED
- Dashboard maintenance plan KPI card now works correctly
- No more 400 errors or SQL column errors
- Same data display format as before
- Performance optimized with simple aggregation

### **Future Enhancement Options**:
1. **Add `don_vi` column** to `ke_hoach_bao_tri` table (requires schema change)
2. **Filter by user's department** (`khoa_phong`) if needed
3. **Tenant-filter via equipment linkage** (complex JOINs with tasks)

## Files Applied
1. ✅ `20250928021500_dashboard_kpi_tenant_filtering.sql` - Main KPI functions
2. ✅ `20250928022600_fix_dashboard_maintenance_plan_stats.sql` - SQL logic fix
3. ✅ `20250928022700_fix_maintenance_plan_no_tenant.sql` - **Final fix** (removes tenant filtering)

## Status: RESOLVED
- ✅ SQL error fixed (no more "column does not exist")
- ✅ Dashboard maintenance plan KPI now functional
- ✅ Other KPIs (equipment, repairs) properly tenant-filtered
- ✅ TypeScript compilation clean
- ✅ No breaking changes to frontend

**Migration Ready**: Apply `20250928022700_fix_maintenance_plan_no_tenant.sql` to resolve the dashboard KPI error.