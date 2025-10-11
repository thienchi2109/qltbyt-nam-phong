# QR Scanner Regional Leader Security - Quick Summary

**Date**: October 11, 2025  
**Status**: ✅ **SECURE** (properly enforced)

---

## TL;DR

**Question**: Can regional_leader users scan/search equipment outside their region?

**Answer**: ❌ **NO** - Multi-layered security prevents cross-region access:

1. ✅ Database RPC `equipment_get_by_code()` filters by `allowed_don_vi_for_session()`
2. ✅ Helper function returns ONLY facilities in user's `dia_ban_id`
3. ✅ JWT claims propagate `dia_ban` from authentication → session → RPC
4. ✅ Equipment scan fails with generic error if not in user's region

---

## Security Flow

```
User scans QR "EQ003" (facility 30, region 2)
         ↓
Frontend: callRpc('equipment_get_by_code', { p_ma_thiet_bi: 'EQ003' })
         ↓
RPC Proxy: Sign JWT with { app_role: 'regional_leader', dia_ban: '1' }
         ↓
Database: allowed_don_vi_for_session() returns [15, 16, 17] (region 1 facilities)
         ↓
Database: SELECT * FROM thiet_bi WHERE ma_thiet_bi = 'EQ003' AND don_vi IN (15,16,17)
         ↓
Result: NOT FOUND (facility 30 not in allowed list)
         ↓
Frontend: Error message "Không tìm thấy thiết bị với mã: EQ003"
```

---

## Critical Dependency

⚠️ **Regional leader users MUST have `dia_ban_id` assigned** in `nhan_vien` table:

```sql
-- Check for missing assignments
SELECT id, username, role, dia_ban_id 
FROM nhan_vien 
WHERE role = 'regional_leader' 
AND dia_ban_id IS NULL;
-- Expected: 0 rows

-- If found, assign appropriate region:
UPDATE nhan_vien 
SET dia_ban_id = <region_id>
WHERE id = <user_id>;
```

---

## Test Instructions

### Quick Test (3 steps)

1. **Login** as regional_leader (region 1)
2. **Scan** QR code of equipment in different region
3. **Verify** error message (no equipment details shown)

### Database Test (SQL Console)

```sql
-- Set JWT claims for regional_leader in region 1
SET request.jwt.claims TO '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1"}';

-- Test 1: Check allowed facilities
SELECT allowed_don_vi_for_session();
-- Expected: {15, 16, 17, ...} (all facilities in region 1)

-- Test 2: Scan equipment in region 1 (should succeed)
SELECT * FROM equipment_get_by_code('EQ001');
-- Expected: Equipment details returned

-- Test 3: Scan equipment in region 2 (should fail)
SELECT * FROM equipment_get_by_code('EQ003');
-- Expected: ERROR: Equipment not found or access denied
```

---

## Related Files

- **Documentation**: `docs/security/qr-scanner-regional-leader-security-analysis.md` (full analysis)
- **RPC Function**: `supabase/migrations/20250930_add_equipment_get_by_code.sql`
- **Helper Function**: `supabase/migrations/2025-10-04/20251004071000_fix_jwt_claim_reading_with_fallback.sql`
- **Auth Config**: `src/auth/config.ts`
- **RPC Proxy**: `src/app/api/rpc/[fn]/route.ts`
- **Frontend**: `src/components/qr-action-sheet.tsx`

---

## Verdict

✅ **Regional leaders CANNOT scan equipment outside their region**  
✅ **Security architecture is correctly implemented**  
⚠️ **Requires database validation** (ensure `dia_ban_id` assigned)  
⚠️ **Requires user testing** (manual QR scan test)

---

**Confidence Level**: 95% (code review complete, pending live test)
