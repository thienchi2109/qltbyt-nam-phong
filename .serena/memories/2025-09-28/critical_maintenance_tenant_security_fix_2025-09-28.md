# CRITICAL TENANT SECURITY FIX - Maintenance Plans (2025-09-28)

## Critical Security Issue Identified
**Problem**: Users from different tenants could see each other's maintenance plans due to missing tenant isolation.

**Evidence**: Screenshot shows both "Plan - CDC" and "Plan - YKPNT" visible to users from different organizations.

## Root Cause Analysis

### Database Investigation Results:
1. **`ke_hoach_bao_tri` table lacked `don_vi` column** - No direct tenant relationship
2. **Existing plans had no tenant association**:
   - Plan - CDC (created by CDC user, should be tenant 3)
   - Plan - YKPNT (created by YKPNT user, should be tenant 1)
3. **Previous filtering logic was flawed**:
   ```sql
   OR NOT EXISTS (SELECT 1 FROM cong_viec_bao_tri cv WHERE cv.ke_hoach_id = kh.id)
   -- This made ALL plans without tasks visible to ALL users!
   ```

### Data Relationships Discovered:
```sql
-- Users and their tenants
ykpnt: don_vi = 1 (Trường Đại học Y khoa Phạm Ngọc Thạch)
cdc: don_vi = 3 (Trung tâm Kiểm soát bệnh tật thành phố Cần Thơ)

-- Plans without proper tenant association
Plan - YKPNT: created by YKPNT user, should belong to tenant 1
Plan - CDC: created by CDC user, should belong to tenant 3
```

## Solution Applied
**Migration**: `supabase/migrations/20250928024600_add_don_vi_to_maintenance_plans.sql`

### Changes Made:

#### 1. **Schema Enhancement**
```sql
-- Add direct tenant relationship
ALTER TABLE public.ke_hoach_bao_tri 
ADD COLUMN don_vi BIGINT REFERENCES public.don_vi(id);
```

#### 2. **Data Migration** 
```sql
-- Fix existing plans with proper tenant assignment
UPDATE ke_hoach_bao_tri SET don_vi = 3 
WHERE ten_ke_hoach = 'Plan - CDC';

UPDATE ke_hoach_bao_tri SET don_vi = 1 
WHERE ten_ke_hoach = 'Plan - YKPNT';
```

#### 3. **Security Functions Fixed**
- **`maintenance_plan_list`** - Direct `kh.don_vi = v_effective_donvi` filtering
- **`dashboard_maintenance_plan_stats`** - Tenant-scoped KPI statistics  
- **`maintenance_plan_create`** - Auto-assigns `don_vi` from JWT claims

#### 4. **Performance Optimization**
```sql
-- Add index for fast tenant filtering
CREATE INDEX idx_ke_hoach_bao_tri_don_vi ON ke_hoach_bao_tri (don_vi);
```

## Security Impact

### **Before Fix** (CRITICAL VULNERABILITY):
- ❌ **Cross-tenant data exposure**: All users could see all maintenance plans
- ❌ **No tenant isolation**: Plans without tasks visible to everyone
- ❌ **Data leakage**: Sensitive organizational planning data exposed

### **After Fix** (SECURE):
- ✅ **Proper tenant isolation**: Users see only their organization's plans
- ✅ **Direct filtering**: `WHERE don_vi = current_user_tenant`
- ✅ **Future-proof**: New plans automatically get correct tenant assignment
- ✅ **Performance optimized**: Indexed tenant filtering

## Expected Results After Migration

### Tenant 1 (YKPNT) users will see:
- ✅ "Plan - YKPNT" only
- ❌ "Plan - CDC" hidden

### Tenant 3 (CDC) users will see:
- ✅ "Plan - CDC" only  
- ❌ "Plan - YKPNT" hidden

### Global users will see:
- ✅ All plans (as intended for admin oversight)

## Technical Implementation

### **Tenant Filtering Logic**:
```sql
WHERE (
  v_effective_donvi IS NULL -- Global users see all
  OR kh.don_vi = v_effective_donvi -- Direct tenant match
)
```

### **No Complex JOINs**: 
- Simple direct column comparison
- Fast indexed lookups
- Clean security boundary

## Critical Priority

**SECURITY SEVERITY**: 🔴 **CRITICAL**
- Data exposure across tenant boundaries
- Violates fundamental multi-tenant architecture  
- Requires immediate deployment

**DEPLOYMENT URGENCY**: **IMMEDIATE**
- Apply migration `20250928024600_add_don_vi_to_maintenance_plans.sql`
- Verify tenant isolation after deployment
- Test with multiple tenant accounts

## Status: READY FOR DEPLOYMENT
- ✅ Schema change prepared
- ✅ Data migration included
- ✅ Security functions updated
- ✅ Performance optimized
- ✅ Future maintenance plans will auto-assign tenant

**This fix completely resolves the critical tenant isolation vulnerability in maintenance plans.**