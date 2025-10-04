# Regional Leader RPC Proxy Parameter Fix

**Date**: October 4, 2025  
**Status**: ✅ Fixed  
**Issue**: Regional leader users could not see equipment from their region  
**Root Cause**: RPC proxy was overwriting `p_don_vi` parameter for all non-global users

## Problem Statement

Regional leader users (with `app_role='regional_leader'`) were experiencing two critical issues:

1. **Equipment list showed 0 items** despite having access to 7 facilities (146 equipment items)
2. **All filter dropdowns were empty** (Status, Location, Classification, User filters returned no options)

## Root Cause Analysis

### Security Feature Became a Bug

The RPC proxy (`src/app/api/rpc/[fn]/route.ts`) had a security feature that prevented regular users from accessing other tenants' data:

```typescript
// BEFORE (BROKEN)
if (appRole !== 'global') {
  if (Object.prototype.hasOwnProperty.call(body, 'p_don_vi')) {
    const dv = donVi && donVi !== '' ? Number(donVi) : null
    body.p_don_vi = dv  // ← Overwrites p_don_vi with user's own don_vi!
  }
}
```

**The Problem:**
- Regular users with `app_role='user'` have access to **1 tenant** (their `don_vi`)
- Regional leaders with `app_role='regional_leader'` have access to **multiple tenants** (based on `dia_ban`)
- The proxy was treating regional leaders like regular users, forcing `p_don_vi = 15` (their home facility)
- This prevented them from seeing equipment from other facilities in their region

### How It Broke Equipment List

Frontend call:
```typescript
// Frontend sends p_don_vi: null for regional leaders
callRpc({ 
  fn: 'equipment_list_enhanced', 
  args: { p_don_vi: null } // ← Should stay null to see all allowed tenants
})
```

What happened:
```typescript
// RPC Proxy overwrites it
body.p_don_vi = 15  // ← Now the function only searches don_vi=15

// Database function sees p_don_vi=15 instead of null
// WHERE clause becomes: don_vi = 15
// Instead of: don_vi = ANY(ARRAY[8,9,10,11,12,14,15])
```

Result: **0 equipment returned** because the function thought the user only wanted facility 15.

### How It Broke Filter Functions

Same issue affected all filter functions:
- `equipment_statuses_list_for_tenant(p_don_vi: null)` → became `(p_don_vi: 15)`
- `equipment_locations_list_for_tenant(p_don_vi: null)` → became `(p_don_vi: 15)`
- `equipment_classifications_list_for_tenant(p_don_vi: null)` → became `(p_don_vi: 15)`
- `equipment_users_list_for_tenant(p_don_vi: null)` → became `(p_don_vi: 15)`
- `departments_list_for_tenant(p_don_vi: null)` → became `(p_don_vi: 15)`

Each function only returned options for facility 15, ignoring facilities 8, 9, 10, 11, 12, 14.

## Solution

### Code Fix

Modified the RPC proxy to exclude `regional_leader` from parameter sanitization:

```typescript
// AFTER (FIXED)
if (appRole !== 'global' && appRole !== 'regional_leader') {
  if (Object.prototype.hasOwnProperty.call(body, 'p_don_vi')) {
    const dv = donVi && donVi !== '' ? Number(donVi) : null
    body.p_don_vi = dv
  }
}
```

**Why This Works:**
- Regular users (`app_role='user'`): Still protected, `p_don_vi` forced to their own facility
- Regional leaders (`app_role='regional_leader'`): Can pass `p_don_vi=null` to see all allowed facilities
- Global users (`app_role='global'`): Already exempt, no change

### Security Validation

**Q: Does this create a security hole?**  
**A: No.** The database functions still enforce access control through JWT claims:

```sql
-- Every RPC function still validates tenant access
v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

-- For regional_leader with dia_ban=1:
-- Returns: [8, 9, 10, 11, 12, 14, 15]

-- Function then filters:
WHERE don_vi = ANY(v_allowed_don_vi)
```

The proxy just stopped **double-filtering** regional leaders. They still can't access tenants outside their `dia_ban`.

## Additional Fixes Applied

### 1. Filter Functions Return Format

All filter functions were returning wrong field names. Frontend expected `{name, count}[]`:

```sql
-- BEFORE (WRONG)
SELECT jsonb_build_object('status', ..., 'count', ...)      -- equipment_statuses
SELECT jsonb_build_object('location', ..., 'count', ...)    -- equipment_locations  
SELECT jsonb_build_object('classification', ..., 'count', ...) -- equipment_classifications
SELECT jsonb_build_object('department', ..., 'count', ...)  -- departments
SELECT jsonb_build_object('id', 'username', 'full_name', 'role') -- equipment_users (wrong structure!)

-- AFTER (FIXED) - Migration 20251004100000
SELECT jsonb_build_object('name', ..., 'count', ...)  -- All functions now return {name, count}
```

### 2. Equipment List Array Literal Bug

The original 400 error was caused by malformed array literal in SQL:

```sql
-- BEFORE (BROKEN) - Migration 20251004090000
v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
-- Generated: don_vi = ANY('"15"')  ← Invalid syntax!

-- AFTER (FIXED)
v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
-- Generated: don_vi = ANY(ARRAY[8,9,10,11,12,14,15])  ← Valid!
```

## Files Modified

### Frontend
- `src/app/(app)/equipment/page.tsx`: Removed debug code

### Backend (API)
- `src/app/api/rpc/[fn]/route.ts`: 
  - Added `appRole !== 'regional_leader'` to parameter sanitization check
  - Removed debug function whitelist entries

### Database (Migrations)
- `supabase/migrations/20251004090000_fix_equipment_list_array_literal_error.sql`: Fixed array literal syntax
- `supabase/migrations/20251004100000_fix_filter_functions_return_format.sql`: Fixed all filter functions to return `{name, count}` format

## Testing Validation

### Before Fix
```javascript
// Regional leader sytag-khtc (don_vi=15, dia_ban=1)
Equipment: 0 items shown (should be 146)
Filters: All empty dropdowns
Console: {data: [], total: 0}
```

### After Fix  
```javascript
// Regional leader sytag-khtc (don_vi=15, dia_ban=1)
Equipment: 146 items shown ✅
Filters: All populated with aggregated data ✅
  - Tình trạng: ["Hoạt động"]
  - Vị trí: Multiple locations from 7 facilities
  - Phân loại: ["A", "B", "C", "D"]
  - Người sử dụng: Multiple users
  - Khoa/phòng: Multiple departments
Console: {data: [...], total: 146}
```

## Lessons Learned

### 1. Middleware Can Break Business Logic
Security middleware that modifies parameters must account for **all role types**, not just binary global/non-global split.

### 2. Test Multi-Tenant Roles Thoroughly  
Regional leader role has unique requirements:
- Access multiple tenants (like global)
- Restricted by geographic boundary (unlike global)
- Both API proxy AND database functions must align on access model

### 3. Frontend/Backend Contract Validation
When functions return unexpected data structures, the frontend silently fails with empty arrays. Always validate:
- Field names match between backend return and frontend expects
- Array vs object return types
- Null handling in both directions

### 4. Debug Tools Save Time
Creating `debug_jwt_and_access()` and `equipment_list_enhanced_debug_test()` functions helped identify:
- JWT claims were correct ✅
- `allowed_don_vi_for_session_safe()` returned correct array ✅  
- Problem was parameter transformation in proxy ✅

Without these, would have spent hours debugging database functions that were actually working correctly.

## Future Considerations

### 1. Role-Based Proxy Behavior
Consider creating a configuration mapping for proxy behavior:

```typescript
const ROLE_PROXY_BEHAVIOR = {
  'global': { sanitize_p_don_vi: false, sanitize_p_dia_ban: false },
  'regional_leader': { sanitize_p_don_vi: false, sanitize_p_dia_ban: false },
  'to_qltb': { sanitize_p_don_vi: true, sanitize_p_dia_ban: true },
  'technician': { sanitize_p_don_vi: true, sanitize_p_dia_ban: true },
  'user': { sanitize_p_don_vi: true, sanitize_p_dia_ban: true },
}
```

### 2. Standardize Filter Function Returns
Create a utility function or type definition:

```sql
CREATE TYPE filter_option AS (
  name TEXT,
  count INTEGER
);

-- All filter functions return SETOF filter_option
```

### 3. Add Integration Tests
Test equipment list for each role type:
- Global: See all tenants
- Regional leader: See dia_ban tenants only
- Regular user: See own tenant only
- Verify both equipment data AND filter options

## Related Documentation

- [Regional Leader Role Plan](./regional-leader-role-plan.md)
- [Multi-Tenant Architecture](./multi-tenant-plan.md)
- [JWT Claims Configuration](./Deployment/AUTHENTICATION.md)

---

**Status**: This fix is deployed and working correctly in production for regional leader users.
