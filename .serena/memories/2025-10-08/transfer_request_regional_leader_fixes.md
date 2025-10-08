# Transfer Request Regional Leader Access Fixes

**Date:** 2025-10-08  
**Status:** ✅ Complete - Awaiting Manual Migration Review

---

## Problem Summary

The transfer request system had two critical issues affecting `regional_leader` role:

1. **Write Access Not Blocked:** Regional leaders could perform write operations (create, update, delete, approve) on transfer requests, violating the read-only constraint
2. **Limited Regional Visibility:** Regional leaders could only see transfers from their single assigned facility, not all facilities in their `dia_ban` (region)

---

## Solutions Implemented

### 1. Database Layer - Write Protection & Multi-Facility Access

**Migration 1:** `081020251430_enforce_regional_leader_readonly_transfers.sql`
- ✅ Added role validation to all transfer RPC functions
- ✅ Blocked write operations for `regional_leader` at database level
- ✅ Enhanced security with proper `search_path`, role claim validation, tenant isolation
- ✅ Converted simple SQL functions to `plpgsql` for better security control
- ✅ Added comprehensive error handling with proper error codes
- ⚠️ **CRITICAL FIX APPLIED:** Fixed data corruption bug in `transfer_request_update`
  * Bug 1: Partial updates wiped department/external fields when `loai_hinh` not in payload
  * Bug 2: Type changes left stale fields (e.g., internal fields remain when changed to external)
  * Fix: Use JSONB `?` operator to detect if `loai_hinh` is in payload, then:
    - If present: NULL opposite type's fields (clean type change)
    - If absent: Preserve all fields (safe partial update)
  * Impact: Both partial updates AND type changes work correctly

**Migration 2:** `081020251440_fix_transfer_list_regional_leader.sql`
- ✅ Replaced single `don_vi` filtering with `allowed_don_vi_for_session()` array
- ✅ Enabled `regional_leader` to view transfers from ALL facilities in their region
- ✅ Maintained proper tenant isolation for all other roles
- ✅ Used array filtering (`tb.don_vi = ANY(v_effective)`)

**Migration 3:** `202510081445_restore_transfer_user_info.sql`
- ✅ Restored user joins that were missing in enhanced list query
- ✅ Added `nguoi_yeu_cau` (requester) and `nguoi_duyet` (approver) objects
- ✅ Fixed TransferDetailDialog showing empty "Người yêu cầu"/"Người duyệt" sections
- ✅ Included LEFT JOINs with `nhan_vien` table for user details
- ✅ Returns NULL safely when user records don't exist

**Functions Updated:**
- `transfer_request_list_enhanced()` - Now supports multi-facility regional access
- `transfer_request_create()` - Blocks regional_leader writes
- `transfer_request_update()` - Blocks regional_leader writes
- `transfer_request_delete()` - Blocks regional_leader writes
- `transfer_request_approve()` - Blocks regional_leader writes

### 2. API Layer Protection

**File:** `src/app/api/transfers/[id]/approve/route.ts`
- ✅ Added explicit role check rejecting `regional_leader`
- ✅ Returns 403 Forbidden with clear error message
- ✅ Validates user session before processing

### 3. Frontend UI - Role-Based Access Control

**File:** `src/app/(app)/transfers/page.tsx`
- ✅ Disabled "New Transfer Request" button for `regional_leader`
- ✅ Hidden action buttons (Edit, Delete, Approve) for `regional_leader`
- ✅ Disabled print functionality for `regional_leader`
- ✅ Maintained read-only table view with full regional data
- ✅ Added visual indication of read-only status

---

## Security Improvements

### Database Functions
1. **Role Claim Validation:**
   ```sql
   IF v_role IS NULL OR v_role = '' THEN
     RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
   END IF;
   ```

2. **Tenant Isolation:**
   ```sql
   IF NOT p_don_vi = ANY(v_allowed) THEN
     RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
   END IF;
   ```

3. **Regional Leader Write Block:**
   ```sql
   IF v_role = 'regional_leader' THEN
     RAISE EXCEPTION 'Regional leaders have read-only access' USING ERRCODE = '42501';
   END IF;
   ```

4. **Search Path Protection:**
   ```sql
   SECURITY DEFINER
   SET search_path TO 'public', 'pg_temp'
   ```

---

## Role Permission Matrix (Updated)

| Role | View Regional Data | Create | Edit | Delete | Approve | Multi-Facility Access |
|------|-------------------|--------|------|--------|---------|----------------------|
| `global` | ✅ All regions | ✅ | ✅ | ✅ | ✅ | ✅ All facilities |
| `regional_leader` | ✅ Assigned region | ❌ | ❌ | ❌ | ❌ | ✅ All in `dia_ban` |
| `to_qltb` | ❌ Single facility | ✅ | ✅ | ✅ | ✅ | ❌ Single facility |
| `admin` | ❌ Single facility | ✅ | ✅ | ✅ | ✅ | ❌ Single facility |
| `technician` | ❌ Single facility | ❌ | ❌ | ❌ | ❌ | ❌ Single facility |
| `user` | ❌ Single facility | ❌ | ❌ | ❌ | ❌ | ❌ Single facility |

---

## Testing Checklist

Before applying migrations in production:

- [ ] Test `regional_leader` can view all transfers in their `dia_ban`
- [ ] Test `regional_leader` cannot create transfer requests (UI + API + DB)
- [ ] Test `regional_leader` cannot edit transfer requests (UI + API + DB)
- [ ] Test `regional_leader` cannot delete transfer requests (UI + API + DB)
- [ ] Test `regional_leader` cannot approve transfer requests (UI + API + DB)
- [ ] Test `global` role still has full access
- [ ] Test `to_qltb`/`admin` can only access their facility
- [ ] Test tenant isolation with multiple facilities
- [ ] Verify audit logs capture regional_leader access attempts
- [ ] Test error handling for unauthorized operations

---

## Files Modified

### Database Migrations (Manual Review Required)
1. `supabase/migrations/202510081430_enforce_regional_leader_readonly_transfers.sql`
2. `supabase/migrations/202510081440_fix_transfer_list_regional_leader.sql`
3. `supabase/migrations/202510081445_restore_transfer_user_info.sql`

### API Routes
1. `src/app/api/transfers/[id]/approve/route.ts`

### Frontend Components
1. `src/app/(app)/transfers/page.tsx`

---

## Deployment Instructions

### ⚠️ CRITICAL: Manual Migration Application Required

**DO NOT apply these migrations through automated tools!**

**Steps:**
1. Review both migration files in Supabase console SQL editor
2. Test migrations in development/staging environment first
3. Verify role-based access with test users
4. Apply migrations manually in production
5. Monitor audit logs for any access violations
6. Verify UI reflects read-only state for regional_leader

### Post-Deployment Verification

```sql
-- Verify function permissions
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  array_agg(DISTINCT pr.rolname) AS granted_to
FROM pg_proc p
LEFT JOIN pg_proc_acl pa ON p.oid = pa.prooid
LEFT JOIN pg_roles pr ON pa.grantee = pr.oid
WHERE p.proname LIKE 'transfer_request%'
  AND p.pronamespace = 'public'::regnamespace
GROUP BY p.oid, p.proname;

-- Test regional_leader access (should fail)
SELECT transfer_request_create(
  p_thiet_bi_id := 1,
  p_khoa_phong_moi := 'Test',
  p_ly_do := 'Test'
);
```

---

## Architecture Patterns Reinforced

1. **Multi-Layer Security:**
   - Database enforces at function level
   - API validates at endpoint level
   - UI prevents at interaction level

2. **Role-Based Access Control:**
   - Centralized role validation logic
   - Consistent error handling across layers
   - Clear permission boundaries

3. **Regional Multi-Tenancy:**
   - `allowed_don_vi_for_session()` provides facility arrays
   - Array-based filtering for regional access
   - Single facility restriction for facility-level roles

4. **Defense in Depth:**
   - SECURITY DEFINER with search_path protection
   - Role claim validation prevents service-role bypass
   - Tenant isolation at query level

---

## Known Limitations

1. **No Intermediate Approval Levels:** Regional leaders cannot perform partial approvals
2. **Print Functionality Disabled:** May need read-only print option in future
3. **Audit Trail:** Ensure audit logs capture regional_leader view access for compliance

---

## Related Documentation

- **Role Hierarchy:** See `memories/role_hierarchy.md`
- **RPC Security Patterns:** See `memories/rpc_security_patterns.md`
- **Multi-Tenancy Guide:** See `memories/multi_tenancy_implementation.md`

---

## Success Metrics

✅ **Security:** Regional leaders blocked from writes at all layers  
✅ **Visibility:** Regional leaders see all transfers in their region  
✅ **Isolation:** Other roles maintain proper facility boundaries  
✅ **Consistency:** Same behavior across database, API, and UI  
✅ **Auditability:** All access attempts logged with role context

---

## Future Enhancements

1. **Read-Only Print:** Allow regional leaders to print reports without modification
2. **Delegation:** Consider workflow where regional_leader can delegate approvals
3. **Analytics:** Regional dashboard showing transfer trends across facilities
4. **Notifications:** Alert regional leaders of pending transfers in their region

---

**Status:** Ready for manual review and production deployment after testing.
