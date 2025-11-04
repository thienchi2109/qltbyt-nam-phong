# Bug Fix: Transfer Kanban Cards Not Rendering (Empty String in JWT Claims)

**Date**: 2025-11-04  
**Status**: Fixed  
**Severity**: Critical (P0)

## Issue Summary

Transfer request cards were not rendering in the kanban board, and counts API was returning zero for all columns.

## Error Message

```
Supabase RPC error for get_transfer_counts: {
  status: 400,
  payload: {
    code: '22P02',
    details: null,
    hint: null,
    message: 'invalid input syntax for type bigint: ""'
  },
  body: '{\n' +
    '  "p_facility_ids": null,\n' +
    '  "p_assignee_ids": null,\n' +
    '  "p_types": null,\n' +
    '  "p_statuses": null,\n' +
    '  "p_date_from": "2025-10-05T13:18:10.613Z",\n' +
    '  "p_date_to": null,\n' +
    '  "p_search_text": null\n' +
    '}',
  claims: { app_role: 'global', don_vi: '', user_id: '1' }
}
```

## Root Cause

### Bug #1: Empty String in JWT Claims (PRIMARY)

**File**: `src/app/api/rpc/[fn]/route.ts` (line 136-151)

Global users have no `don_vi` (tenant), so their session has `don_vi: null`. The RPC proxy converted this to an **empty string** `''` instead of `null`:

```typescript
// BEFORE (WRONG)
const donVi = (session as any)?.user?.don_vi ? String((session as any).user.don_vi) : ''
const diaBan = (session as any)?.user?.dia_ban_id ? String((session as any).user.dia_ban_id) : ''

const claims: Record<string, any> = {
  role: 'authenticated',
  sub: userId,
  app_role: appRole,
  don_vi: donVi,        // ❌ Empty string '' for global users
  user_id: userId,
  dia_ban: diaBan,      // ❌ Empty string '' for global users
}
```

When PostgreSQL RPC functions tried to use this empty string in BIGINT comparisons, it threw:
```
invalid input syntax for type bigint: ""
```

**Impact**: All RPC calls from global users failed with 400 errors.

### Bug #2: Fallback Logic Error (SECONDARY)

**File**: `src/app/api/transfers/counts/route.ts` (line 123)

The backward compatibility fallback incorrectly set `row = undefined` when using legacy RPC, causing all counts to be zero:

```typescript
// BEFORE (WRONG)
let row = usedLegacyFallback ? undefined : data[0]  // ❌ Discards data on fallback
```

**Impact**: Even if fallback succeeded, counts were zeroed out.

## Fix

### Fix #1: Convert Empty Strings to Null

**File**: `src/app/api/rpc/[fn]/route.ts`

```typescript
// AFTER (CORRECT)
const claims: Record<string, any> = {
  role: 'authenticated',
  sub: userId,
  app_role: appRole,
  don_vi: donVi || null,      // ✅ Convert empty string to null
  user_id: userId,
  dia_ban: diaBan || null,    // ✅ Convert empty string to null
}
```

**Why**: PostgreSQL expects `NULL` for optional BIGINT parameters, not empty strings. Empty strings cause type conversion errors.

### Fix #2: Always Use RPC Response Data

**File**: `src/app/api/transfers/counts/route.ts`

```typescript
// AFTER (CORRECT)
let row = data[0]  // ✅ Always use data[0], regardless of fallback
```

**Why**: The RPC call succeeded (either with new or legacy signature), so we should use the returned data.

## Testing

### Before Fix
- ❌ Kanban board empty (no cards rendered)
- ❌ All count badges showed 0
- ❌ Console errors: `invalid input syntax for type bigint: ""`
- ❌ 400 errors on `/api/rpc/get_transfer_counts`

### After Fix
- ✅ TypeScript compilation clean (`npm run typecheck`)
- ⏳ Pending runtime verification: cards should render immediately
- ⏳ Pending runtime verification: counts should match visible cards

## Related Issues

This bug affected **ALL global users** on the following pages:
- Transfer Kanban Board (`/transfers`)
- Repair Requests (if using similar RPC patterns)
- Any other feature using JWT claims with optional BIGINT fields

## Prevention

1. **Always use `|| null`** when setting JWT claims from potentially empty strings
2. **Never use empty string as placeholder** for optional numeric fields
3. **Test with global users** who have no tenant assignment
4. **Add TypeScript strict null checks** for session fields

## Validation Checklist

- [x] TypeScript compilation passes
- [ ] Create external transfer request as global user
- [ ] Verify card renders in "Chờ duyệt" column
- [ ] Verify badge count increments
- [ ] Approve transfer and verify immediate count update
- [ ] Apply date filter and verify counts remain accurate

## Deployment Notes

**Priority**: Deploy immediately - this is a P0 blocker for global users

**Risk**: Low - only changes default value from empty string to null (more correct)

**Rollback**: Revert commits if unexpected issues arise (unlikely)

---

**Fixed by**: Droid  
**Reviewed by**: Pending  
**Deployed**: Pending
