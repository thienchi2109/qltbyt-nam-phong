# Transfer Request Regional Leader Fixes - October 8, 2025

## Problem Summary
Transfer request system had two critical issues for `regional_leader` role:
1. **Write Access Not Blocked**: Regional leaders could create/update/delete/approve transfers
2. **Limited Regional Visibility**: Could only see transfers from single facility, not all facilities in their `dia_ban`

## Solutions Implemented

### 1. Database Layer - Write Protection & Multi-Facility Access

**Migration 1**: `supabase/migrations/202510081430_enforce_regional_leader_readonly_transfers.sql`
- Added role validation to ALL transfer RPC functions
- Blocked write operations for `regional_leader` at database level
- Enhanced security with `search_path`, role claim validation, tenant isolation
- Converted simple SQL functions to `plpgsql` for better security
- **CRITICAL BUG FIX**: Fixed data corruption in `transfer_request_update`
  - Bug: Partial updates wiped department/external fields when `loai_hinh` not in payload
  - Fix: Use JSONB `?` operator to detect `loai_hinh` presence, then:
    - If present: NULL opposite type's fields (clean type change)
    - If absent: Preserve all fields (safe partial update)

**Migration 2**: `supabase/migrations/202510081440_fix_transfer_list_regional_leader.sql`
- Replaced single `don_vi` filtering with `allowed_don_vi_for_session()` array
- Enabled `regional_leader` to view transfers from ALL facilities in region
- Used array filtering: `tb.don_vi = ANY(v_effective)`

**Migration 3**: `supabase/migrations/202510081445_restore_transfer_user_info.sql`
- Restored user joins missing in enhanced list query
- Added `nguoi_yeu_cau` (requester) and `nguoi_duyet` (approver) objects
- Fixed TransferDetailDialog showing empty user sections
- Included LEFT JOINs with `nhan_vien` table

**Functions Updated**:
- `transfer_request_list_enhanced()` - Multi-facility regional access
- `transfer_request_create()` - Blocks regional_leader writes
- `transfer_request_update()` - Blocks regional_leader writes + bug fix
- `transfer_request_delete()` - Blocks regional_leader writes
- `transfer_request_approve()` - Blocks regional_leader writes

### 2. API Layer Protection
**File**: `src/app/api/transfers/[id]/approve/route.ts`
- Added explicit role check rejecting `regional_leader`
- Returns 403 Forbidden with clear error message

### 3. Frontend UI - Role-Based Access Control
**File**: `src/app/(app)/transfers/page.tsx`
- Disabled "New Transfer Request" button for `regional_leader`
- Hidden action buttons (Edit, Delete, Approve) for `regional_leader`
- Disabled print functionality for `regional_leader`
- Maintained read-only table view with full regional data

## Security Improvements

**Database Functions Pattern**:
```sql
-- Role Claim Validation
IF v_role IS NULL OR v_role = '' THEN
  RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
END IF;

-- Regional Leader Write Block
IF v_role = 'regional_leader' THEN
  RAISE EXCEPTION 'Regional leaders have read-only access' USING ERRCODE = '42501';
END IF;

-- Tenant Isolation
IF NOT p_don_vi = ANY(v_allowed) THEN
  RAISE EXCEPTION 'Access denied for tenant %' USING ERRCODE = '42501';
END IF;
```

## Role Permission Matrix

| Role | View Regional | Create | Edit | Delete | Approve | Multi-Facility |
|------|--------------|--------|------|--------|---------|----------------|
| `global` | ✅ All | ✅ | ✅ | ✅ | ✅ | ✅ All |
| `regional_leader` | ✅ Region | ❌ | ❌ | ❌ | ❌ | ✅ In dia_ban |
| `to_qltb` | ❌ Single | ✅ | ✅ | ✅ | ✅ | ❌ Single |
| `admin` | ❌ Single | ✅ | ✅ | ✅ | ✅ | ❌ Single |

## Files Modified

### Database Migrations (Manual Review Required)
1. `supabase/migrations/202510081430_enforce_regional_leader_readonly_transfers.sql`
2. `supabase/migrations/202510081440_fix_transfer_list_regional_leader.sql`
3. `supabase/migrations/202510081445_restore_transfer_user_info.sql`

### API Routes
1. `src/app/api/transfers/[id]/approve/route.ts`

### Frontend Components
1. `src/app/(app)/transfers/page.tsx`

## Deployment Instructions

### ⚠️ CRITICAL: Manual Migration Application Required
**DO NOT apply migrations through automated tools!**

**Steps**:
1. Review migration files in Supabase console SQL editor
2. Test in development/staging environment first
3. Apply migrations manually in production
4. Monitor audit logs for access violations
5. Verify UI reflects read-only state for regional_leader

## Architecture Patterns Reinforced

1. **Multi-Layer Security**: Database → API → UI enforcement
2. **Role-Based Access Control**: Centralized role validation
3. **Regional Multi-Tenancy**: `allowed_don_vi_for_session()` provides facility arrays
4. **Defense in Depth**: SECURITY DEFINER with search_path protection

## Success Metrics
✅ Security: Regional leaders blocked from writes at all layers  
✅ Visibility: Regional leaders see all transfers in region  
✅ Isolation: Other roles maintain facility boundaries  
✅ Consistency: Same behavior across database/API/UI  
✅ Auditability: All access attempts logged with role context

**Status**: Ready for manual review and production deployment after testing.
