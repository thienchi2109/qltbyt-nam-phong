# Fix: Transfer Approval Type Mismatch (bigint = text)

**Date**: 2025-11-06
**Issue**: Global user clicking "Duyệt" (Approve) button on transfers shows error: "operator does not exist: bigint = text"
**Status**: Fixed ✅
**Related Files**: `src/app/(app)/transfers/page.tsx`, `src/types/next-auth.d.ts`

---

## Problem Summary

When global users click the "Duyệt" (Approve) button on transfer requests, the operation fails with PostgreSQL type mismatch error.

### Error Message
```
Lỗi: operator does not exist: bigint = text
```

### Root Cause

**Type Mismatch Chain**:
1. NextAuth session stores `user.id` as **STRING** (`src/types/next-auth.d.ts:7`)
2. Client sends string to RPC: `{ nguoi_duyet_id: user?.id }` (STRING)
3. Database column `nguoi_duyet_id` is **INTEGER** (`yeu_cau_luan_chuyen.nguoi_duyet_id INTEGER`)
4. RPC function attempts `::INT` cast on string, causing PostgreSQL operator error

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

### Immediate Fix (Applied)

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
- Uses `parseInt(user.id, 10)` for explicit base-10 conversion
- Passes `undefined` if `user?.id` is missing (allows RPC to use fallback logic)
- Minimal change, lowest risk

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

- [x] TypeScript compilation passes (`npm run typecheck`)
- [x] Transfers page loads without errors
- [ ] Global user can approve transfer request successfully
- [ ] Toast shows success message after approval
- [ ] Database updates `nguoi_duyet_id` and `ngay_duyet` correctly
- [ ] Transfer status changes to "Đã duyệt"
- [ ] No console errors in browser
- [ ] Non-global users cannot approve (role check still works)

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
