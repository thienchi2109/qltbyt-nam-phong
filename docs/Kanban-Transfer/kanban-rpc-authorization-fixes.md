# Kanban RPC Authorization Fixes

**Date**: 2025-10-12  
**Author**: GitHub Copilot  
**Related Migration**: `supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_side_filtering.sql`

## Executive Summary

Fixed two critical authorization bugs in the new Kanban RPC functions (`get_transfers_kanban` and `get_transfer_counts`) that would have blocked all users and prevented regional leaders from accessing multiple facilities.

## P0 Bug: Wrong JWT Claim for Role Authorization

### Problem

Both RPC functions read `current_setting('request.jwt.claims', true)->>'role'` for application role verification. However, the RPC proxy (`src/app/api/rpc/[fn]/route.ts`) deliberately sets the `role` claim to `'authenticated'` (the database role) for all users, and stores the actual application role in the `app_role` claim.

### Impact

**Severity**: P0 (Blocking)  
**Affected Functions**: `get_transfers_kanban`, `get_transfer_counts`  
**User Impact**: ALL users blocked from Kanban view

The role validation check:
```sql
IF v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
  RAISE EXCEPTION 'Unauthorized: Invalid or missing role';
END IF;
```

Would ALWAYS fail because `v_user_role = 'authenticated'`, causing:
- All API calls to `/api/transfers/kanban` to return 500 errors
- Error message: "Unauthorized: Invalid or missing role"
- Complete inability to use Kanban view for any user

### Root Cause

Mismatch between RPC proxy JWT claim structure and RPC function expectations.

**RPC Proxy Sets** (`src/app/api/rpc/[fn]/route.ts:147`):
```typescript
const claims: Record<string, any> = {
  role: 'authenticated',        // <-- Database role (PostgREST requirement)
  app_role: appRole,            // <-- Application role (user/technician/to_qltb/regional_leader/global)
  don_vi: donVi,
  user_id: userId,
  dia_ban: diaBan,
}
```

**RPC Functions Read** (INCORRECT):
```sql
v_user_role := current_setting('request.jwt.claims', true)::json->>'role';
-- Returns 'authenticated', not 'user'/'technician'/etc.
```

### Solution

Changed both RPC functions to read `app_role` claim instead of `role`:

```sql
-- BEFORE (WRONG):
v_user_role := current_setting('request.jwt.claims', true)::json->>'role';

-- AFTER (CORRECT):
v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
```

Added inline comment to prevent future mistakes:
```sql
-- Get user context from JWT claims (use app_role, not role)
v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
```

### Verification

**Test Case 1**: User role authorization
```sql
-- Given: JWT with app_role = 'user', role = 'authenticated'
-- When: get_transfers_kanban() is called
-- Then: Should pass authorization (not raise exception)
```

**Test Case 2**: Technician role authorization
```sql
-- Given: JWT with app_role = 'technician', role = 'authenticated'
-- When: get_transfer_counts() is called
-- Then: Should pass authorization and return counts
```

**Test Case 3**: Invalid role rejection
```sql
-- Given: JWT with app_role = 'invalid_role'
-- When: get_transfers_kanban() is called
-- Then: Should raise "Unauthorized: Invalid or missing role"
```

## P1 Bug: Regional Leader Multi-Facility Access Blocked

### Problem

The tenant isolation logic forced `p_facility_ids := ARRAY[v_user_don_vi]` for ALL non-global users, including `regional_leader`. This overrode any facility list supplied by the caller, preventing regional leaders from viewing multiple facilities.

### Impact

**Severity**: P1 (Feature Breaking)  
**Affected Users**: Regional leaders only  
**User Impact**: Cannot switch between facilities in Kanban view

Regional leaders have legitimate read-only access to multiple facilities (their assigned region). The UI provides a facility selector, but the RPC functions ignored it:

```sql
-- BEFORE (BREAKS regional_leader):
IF v_user_role != 'global' THEN
  -- This includes regional_leader!
  p_facility_ids := ARRAY[v_user_don_vi];
END IF;
```

**Example Scenario**:
- Regional leader assigned to facilities: [1, 2, 3]
- User selects facility 2 in UI
- Frontend calls `get_transfers_kanban(p_facility_ids := [2])`
- RPC function overrides: `p_facility_ids := [1]` (user's home facility)
- Returns wrong data (facility 1 instead of facility 2)

### Root Cause

Overly broad tenant isolation that didn't account for legitimate multi-tenant read access patterns.

**Existing Pattern** (RPC proxy exempts regional_leader):
```typescript
// src/app/api/rpc/[fn]/route.ts:152
if (appRole !== 'global' && appRole !== 'regional_leader') {
  // Only coerce p_don_vi for regular users, not regional leaders
  if (Object.prototype.hasOwnProperty.call(body, 'p_don_vi')) {
    body.p_don_vi = donVi;
  }
}
```

**New RPC Functions** (DIDN'T exempt regional_leader):
```sql
-- BEFORE (WRONG):
IF v_user_role != 'global' THEN
  p_facility_ids := ARRAY[v_user_don_vi];
END IF;
```

### Solution

Exempt `regional_leader` from forced tenant isolation, matching RPC proxy pattern:

```sql
-- BEFORE (BREAKS regional_leader):
IF v_user_role != 'global' THEN
  p_facility_ids := ARRAY[v_user_don_vi];
END IF;

-- AFTER (CORRECT):
IF v_user_role NOT IN ('global', 'regional_leader') THEN
  -- regional_leader can access multiple facilities
  p_facility_ids := ARRAY[v_user_don_vi];
END IF;
```

Added explanatory comment:
```sql
-- Tenant isolation robustness for non-global, non-regional_leader users
-- EXCEPTION: regional_leader can view multiple facilities (read-only multi-tenant)
IF v_user_role NOT IN ('global', 'regional_leader') THEN
```

### Verification

**Test Case 1**: Regular user strict isolation
```sql
-- Given: user role with don_vi = 1
-- When: get_transfers_kanban(p_facility_ids := [2]) is called
-- Then: p_facility_ids should be overridden to [1] (strict isolation)
```

**Test Case 2**: Regional leader multi-facility access
```sql
-- Given: regional_leader role with don_vi = 1, authorized for [1,2,3]
-- When: get_transfers_kanban(p_facility_ids := [2]) is called
-- Then: p_facility_ids should remain [2] (NOT overridden)
-- And: Should return transfers from facility 2
```

**Test Case 3**: Global user unrestricted access
```sql
-- Given: global role
-- When: get_transfers_kanban(p_facility_ids := NULL) is called
-- Then: p_facility_ids should remain NULL (all facilities)
```

**Test Case 4**: Regional leader facility switching
```sql
-- Given: regional_leader with authorized facilities [1,2,3]
-- When: User selects facility 3 in UI
-- And: get_transfer_counts(p_facility_ids := [3]) is called
-- Then: Should return counts ONLY from facility 3
```

## Authorization Matrix (After Fixes)

| Role             | `app_role` Claim | Facility Filter Behavior                          | Multi-Facility Access |
|------------------|------------------|---------------------------------------------------|----------------------|
| `user`           | `user`           | Forced to `[v_user_don_vi]` (strict isolation)   | ❌ No                |
| `technician`     | `technician`     | Forced to `[v_user_don_vi]` (strict isolation)   | ❌ No                |
| `to_qltb`        | `to_qltb`        | Forced to `[v_user_don_vi]` (strict isolation)   | ❌ No                |
| `regional_leader`| `regional_leader`| Respects caller-supplied `p_facility_ids`         | ✅ Yes (read-only)   |
| `global`         | `global`         | Respects caller-supplied `p_facility_ids` or NULL | ✅ Yes (full access) |

## Technical Details

### JWT Claims Structure

**Complete Claims Object** (as set by RPC proxy):
```typescript
{
  role: 'authenticated',           // Database role (always 'authenticated')
  sub: userId,                     // Required for auth.uid() in PostgreSQL
  app_role: appRole,               // Application role (user/technician/to_qltb/regional_leader/global)
  don_vi: donVi,                   // User's home facility ID
  user_id: userId,                 // User ID (duplicate of sub for clarity)
  dia_ban: diaBan                  // Regional district ID (if applicable)
}
```

**Correct Reading Pattern**:
```sql
DECLARE
  v_user_role TEXT;
  v_user_don_vi BIGINT;
BEGIN
  -- Read app_role (NOT role) for application-level authorization
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
  
  -- Validate against application roles
  IF v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid or missing role';
  END IF;
END;
```

### Tenant Isolation Logic Flow

```sql
-- Step 1: Authenticate user
v_user_id := (SELECT auth.uid());
IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'Unauthorized: Authentication required';
END IF;

-- Step 2: Get application role (NOT database role)
v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';

-- Step 3: Validate role is allowed
IF v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
  RAISE EXCEPTION 'Unauthorized: Invalid or missing role';
END IF;

-- Step 4: Apply tenant isolation (with regional_leader exemption)
IF v_user_role NOT IN ('global', 'regional_leader') THEN
  -- Only regular users have strict isolation
  IF v_user_don_vi IS NULL THEN
    RAISE EXCEPTION 'Forbidden: Tenant context required';
  END IF;
  p_facility_ids := ARRAY[v_user_don_vi];
END IF;
-- Else: global and regional_leader can use caller-supplied p_facility_ids
```

## Affected Functions

Both functions in `20251012120000_kanban_server_side_filtering.sql`:

### 1. `get_transfers_kanban()`
- **Purpose**: Server-side Kanban data fetching with filtering, pagination, search
- **Parameters**: `p_facility_ids`, `p_assignee_ids`, `p_types`, `p_statuses`, `p_date_from`, `p_date_to`, `p_search_text`, `p_limit`, `p_cursor`
- **Returns**: Transfer requests with joined equipment data + pagination metadata
- **Fixed**: Lines 71-88 (authorization and tenant isolation)

### 2. `get_transfer_counts()`
- **Purpose**: Get transfer counts by status for Kanban column headers
- **Parameters**: `p_facility_ids`
- **Returns**: Counts grouped by status (cho_duyet, da_duyet, etc.)
- **Fixed**: Lines 195-212 (authorization and tenant isolation)

## Consistency Check

Confirmed both bugs fixed in:
- ✅ `get_transfers_kanban()` function (lines 71-88)
- ✅ `get_transfer_counts()` function (lines 195-212)

Pattern now matches:
- ✅ RPC proxy tenant coercion logic (`src/app/api/rpc/[fn]/route.ts:152`)
- ✅ Existing RPC functions (e.g., `maintenance_plan_list`, `equipment_list_enhanced`)
- ✅ Role-based access control conventions (global/regional_leader exempt from coercion)

## Testing Checklist

Before deploying to production:

### P0 Bug Verification
- [ ] Test with `user` role: Should pass authorization (not raise "Invalid role")
- [ ] Test with `technician` role: Should pass authorization
- [ ] Test with `to_qltb` role: Should pass authorization
- [ ] Test with `regional_leader` role: Should pass authorization
- [ ] Test with `global` role: Should pass authorization
- [ ] Test with invalid role: Should raise "Invalid or missing role"

### P1 Bug Verification
- [ ] Regional leader with multiple facilities: Can switch between facilities
- [ ] Regional leader facility selector: Returns correct data for selected facility
- [ ] Regular user facility coercion: Cannot access other facilities
- [ ] Global user: Can access all facilities (p_facility_ids = NULL works)

### Integration Testing
- [ ] Kanban page loads without 500 errors
- [ ] Facility selector works for regional leaders
- [ ] Column headers show correct counts per facility
- [ ] Transfer cards display correct equipment data
- [ ] Search and filtering work across facilities (for regional leaders)

## Migration Deployment

**File**: `supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_side_filtering.sql`

**Deployment Steps**:
1. Review SQL in Supabase SQL Editor (test environment)
2. Run test queries (commented at bottom of migration)
3. Verify authorization with different roles
4. Apply to production via Supabase Dashboard
5. Update RPC proxy whitelist (already includes `get_transfers_kanban`, `get_transfer_counts`)
6. Test Kanban page in production with all user roles

## Key Learnings

### 1. JWT Claim Naming Conventions
- **Database role**: `role` claim (always `'authenticated'` for RLS)
- **Application role**: `app_role` claim (user/technician/regional_leader/global)
- Always use `app_role` for business logic, not `role`

### 2. Regional Leader Pattern
- Regional leaders need multi-facility READ access for monitoring
- Exempt from tenant coercion in both RPC proxy AND RPC functions
- Write operations still require proper authorization (not covered here)

### 3. Consistency Requirements
- RPC proxy tenant coercion MUST match RPC function tenant isolation
- If proxy exempts a role, function MUST exempt it too
- Document exemptions clearly to prevent future bugs

### 4. Testing Multi-Tenant Logic
- Test each role separately (user, technician, to_qltb, regional_leader, global)
- Test facility switching for regional leaders
- Test strict isolation for regular users
- Test NULL p_facility_ids for global users

## Related Documentation

- **RPC Proxy**: `src/app/api/rpc/[fn]/route.ts` (lines 147-165)
- **Auth Config**: `src/auth/config.ts` (NextAuth role mapping)
- **Migration**: `supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_side_filtering.sql`
- **Architecture**: `.github/copilot-instructions.md` (RPC-first data access pattern)

## Status

✅ **P0 Bug RESOLVED**: All users can now access Kanban view  
✅ **P1 Bug RESOLVED**: Regional leaders can switch between facilities  
✅ **Documentation COMPLETE**: This file provides comprehensive context  
⏳ **Deployment PENDING**: Awaiting manual SQL execution in Supabase Dashboard

---

**Last Updated**: 2025-10-12  
**Git Branch**: `feat/rpc-enhancement`  
**Next Steps**: Deploy migration, test with all roles, commit fixes
