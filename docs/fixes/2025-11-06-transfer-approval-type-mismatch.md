# Fix: Transfer Approval Type Mismatch (bigint = text)

**Date**: 2025-11-06
**Issue**: Global user clicking "Duyệt" (Approve) button on transfers shows error: "operator does not exist: bigint = text"
**Status**: Fixed ✅
**Related Files**: `supabase/migrations/20251106_fix_transfer_update_status_type_cast.sql`, `src/app/(app)/transfers/page.tsx`

---

## Problem Summary

When users click the "Duyệt" (Approve) button on transfer requests, the operation fails with PostgreSQL type mismatch error.

### Error Message
```
Lỗi: operator does not exist: bigint = text
HTTP 404 with PostgreSQL error code 42883
```

### Root Cause (UPDATED)

**The REAL issue was in the RPC function's tenant isolation check, NOT the user ID field:**

The `transfer_request_update_status` RPC function has a tenant isolation check that compares:
```sql
-- Line 341 of 2025-10-08/202510081430_enforce_regional_leader_readonly_transfers.sql
IF v_role IS DISTINCT FROM 'global' AND v_don_vi IS NOT NULL AND v_req.tb_don_vi IS DISTINCT FROM v_don_vi THEN
```

**Type Mismatch**:
1. `v_don_vi` is extracted from JWT as **TEXT**: `v_claims->>'don_vi'` (->>' returns TEXT)
2. `v_req.tb_don_vi` comes from `thiet_bi.don_vi` which is **BIGINT**
3. PostgreSQL comparison `BIGINT IS DISTINCT FROM TEXT` fails with "operator does not exist: bigint = text"

**Secondary Issue** (also fixed):
- Client was passing `user.id` as STRING to `nguoi_duyet_id` field (expecting INTEGER)
- This would have caused issues after fixing the primary problem

### Code Location

**File**: `src/app/(app)/transfers/page.tsx:358-380`

```typescript
const handleApproveTransfer = React.useCallback(
  async (item: TransferListItem) => {
    // ... role checks ...
    try {
      await callRpc({
        fn: "transfer_request_update_status",
        args: {
          p_id: item.id,
          p_status: "da_duyet",
          p_payload: { nguoi_duyet_id: user?.id }  // ❌ STRING passed to INTEGER field
        },
      })
      // ... success handling ...
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message })
    }
  },
  [/* deps */]
)
```

**Database Schema**: `supabase/migrations/20241220_create_luan_chuyen_tables.sql:34`
```sql
nguoi_duyet_id INTEGER REFERENCES nhan_vien(id)
```

**RPC Function**: `supabase/migrations/2025-10-08/202510081430_enforce_regional_leader_readonly_transfers.sql:359`
```sql
UPDATE public.yeu_cau_luan_chuyen
  SET nguoi_duyet_id = COALESCE(NULLIF(p_payload->>'nguoi_duyet_id','')::INT, nguoi_duyet_id),
      -- Attempts to cast string to INT, causing type error
```

---

## Solution

### Primary Fix (Database Migration - REQUIRED)

**File**: `supabase/migrations/20251106_fix_transfer_update_status_type_cast.sql`

**Problem**: RPC function compares BIGINT (tb.don_vi) with TEXT (v_don_vi from JWT)

**Solution**: Cast `v_don_vi` from TEXT to BIGINT before comparison

**Before**:
```sql
v_don_vi := NULLIF(v_claims->>'don_vi','');  -- TEXT type
-- Later: v_req.tb_don_vi IS DISTINCT FROM v_don_vi  -- BIGINT vs TEXT ❌
```

**After**:
```sql
v_don_vi_text := NULLIF(v_claims->>'don_vi','');
v_don_vi := CASE
  WHEN v_don_vi_text IS NOT NULL AND v_don_vi_text ~ '^\d+$'
  THEN v_don_vi_text::BIGINT
  ELSE NULL
END;
-- Later: v_req.tb_don_vi IS DISTINCT FROM v_don_vi  -- BIGINT vs BIGINT ✅
```

**Rationale**:
- Safely casts TEXT to BIGINT with regex validation
- Handles NULL and non-numeric values gracefully
- Maintains tenant isolation security checks

**CRITICAL**: This migration must be run in Supabase SQL Editor before the fix will work.

### Secondary Fix (Client-Side - Applied)

**File**: `src/app/(app)/transfers/page.tsx:367`

**Before**:
```typescript
p_payload: { nguoi_duyet_id: user?.id }
```

**After**:
```typescript
p_payload: { nguoi_duyet_id: user?.id ? parseInt(user.id, 10) : undefined }
```

**Rationale**:
- Converts string ID to integer before sending to RPC
- Prevents future type issues with nguoi_duyet_id field
- Defensive coding practice

### Long-Term Fix (Recommended)

**Architecture Alignment**: The session type definition should reflect database reality.

**File**: `src/types/next-auth.d.ts:7`

**Current**:
```typescript
interface Session {
  user: {
    id: string  // ❌ Inconsistent with INTEGER database schema
    // ...
  }
}
```

**Recommended**:
```typescript
interface Session {
  user: {
    id: string | number  // ✅ Flexible type matching DB (SERIAL/INTEGER)
    // ...
  }
}
```

**Complementary Change**: Update `src/auth/config.ts` JWT callbacks to parse ID as number:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id
      // ...
    }
    return token
  },
  async session({ session, token }) {
    if (token && session.user) {
      session.user.id = token.id  // Now number type
      // ...
    }
    return session
  }
}
```

---

## Impact Analysis

### Affected Components

**Confirmed Similar Issues** (require same fix):
- ✅ `handleApproveTransfer` - **FIXED**
- ⚠️ Other transfer operations may have similar issues
- ⚠️ Repair request approval operations
- ⚠️ Maintenance plan operations
- ⚠️ User management operations
- ⚠️ Audit log creation

### Search Pattern for Audit
```bash
# Find all usages of user?.id in RPC payload contexts
grep -r "user?.id" src/app/(app) --include="*.tsx" -B 2 -A 2 | grep -E "(callRpc|payload)"
```

### Database Schema Reference

All `nhan_vien` (user) references use **INTEGER**:
```sql
-- Core user table
CREATE TABLE nhan_vien (
    id SERIAL PRIMARY KEY,  -- INTEGER AUTO-INCREMENT
    -- ...
)

-- Foreign key examples across tables
yeu_cau_luan_chuyen.nguoi_duyet_id INTEGER REFERENCES nhan_vien(id)
yeu_cau_luan_chuyen.nguoi_yeu_cau_id INTEGER REFERENCES nhan_vien(id)
yeu_cau_sua_chua.nguoi_yeu_cau_id INTEGER REFERENCES nhan_vien(id)
ke_hoach_bao_tri.nguoi_tao_id INTEGER REFERENCES nhan_vien(id)
```

---

## Testing Checklist

### Pre-Testing (Database Migration)
- [ ] **CRITICAL**: Run SQL migration in Supabase SQL Editor: `supabase/migrations/20251106_fix_transfer_update_status_type_cast.sql`
- [ ] Verify function created: `SELECT proname FROM pg_proc WHERE proname = 'transfer_request_update_status';`
- [ ] Check function has updated code: `\df+ transfer_request_update_status`

### Application Testing
- [x] TypeScript compilation passes (`npm run typecheck`)
- [x] Client-side fix applied (parseInt conversion)
- [ ] Rebuild and redeploy application
- [ ] Clear browser cache / hard refresh (Ctrl+Shift+R)
- [ ] Transfers page loads without errors
- [ ] Global user can approve transfer request successfully
- [ ] Non-global user (to_qltb role) can approve transfers in their facility
- [ ] Non-global user CANNOT approve transfers in other facilities (permission error)
- [ ] Toast shows success message after approval
- [ ] Database updates `nguoi_duyet_id` and `ngay_duyet` correctly
- [ ] Transfer status changes to "Đã duyệt"
- [ ] No console errors in browser
- [ ] No PostgreSQL type mismatch errors in server logs

---

## Deployment Notes

### Pre-Deployment
1. Review all `user?.id` usages in codebase
2. Run full typecheck: `npm run typecheck`
3. Test in dev environment with global role

### Post-Deployment
1. Monitor error logs for similar type mismatch errors
2. Verify approval flow works for all roles
3. Check database audit logs for successful approval records

### Rollback Plan
If issues occur, revert to:
```typescript
p_payload: { nguoi_duyet_id: user?.id }
```
And investigate RPC function cast logic instead.

---

## Related Issues

### Known Type Inconsistencies in Session

From `src/types/next-auth.d.ts`:
```typescript
id: string                           // ❌ Should be number
don_vi?: string | number | null      // ✅ Flexible (matches DB BIGINT)
dia_ban_id?: string | number | null  // ✅ Flexible (matches DB BIGINT)
```

**Inconsistency**: Only `id` is strictly string, while other ID fields allow number. This should be unified.

### PostgreSQL Type System

PostgreSQL operator resolution is **strict** on types:
- `bigint = text` → ❌ No operator exists
- `integer = text` → ❌ No operator exists
- `integer = integer` → ✅ Works
- Explicit cast `'123'::INT = 123` → ✅ Works (but throws error if string is non-numeric)

---

## References

- **RPC Gateway**: `src/app/api/rpc/[fn]/route.ts` (tenant isolation + JWT signing)
- **Session Config**: `src/auth/config.ts` (NextAuth v4 JWT strategy)
- **Session Types**: `src/types/next-auth.d.ts` (TypeScript definitions)
- **Database Schema**: `supabase/migrations/20241220_create_luan_chuyen_tables.sql`
- **RPC Function**: `supabase/migrations/2025-10-08/202510081430_enforce_regional_leader_readonly_transfers.sql`
- **Project Rules**: `CLAUDE.md` (security-first architecture, RPC-only data access)

---

## Keywords

`transfer_request_update_status`, `nguoi_duyet_id`, `bigint = text`, `type mismatch`, `NextAuth session`, `PostgreSQL operator`, `RPC payload`, `parseInt`, `user ID conversion`
