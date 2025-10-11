# Regional Leader Facility Filter Implementation

**Date**: October 6, 2025  
**Branch**: feat/regional_leader  
**Status**: ✅ Implementation Complete - Requires Database Migration

## Problem

Regional leaders couldn't see a facility filter dropdown in the repair requests page. The initial implementation attempted to use `khoa_phong_quan_ly` (department) field, but the RPC function wasn't returning the complete equipment information including the facility name.

## Root Cause

The `repair_request_list` RPC function was returning only the `yeu_cau_sua_chua` (repair request) table columns without the joined `thiet_bi` (equipment) data. The frontend was expecting equipment information including `khoa_phong_quan_ly`, but this data wasn't being returned by the RPC.

## Solution

### 1. Database Migration (Required)

**File**: `supabase/migrations/20251006_repair_request_list_include_facility.sql`

Modified the `repair_request_list` RPC function to:
- Change return type from `SETOF public.yeu_cau_sua_chua` to a TABLE with explicit columns
- Add a `thiet_bi` JSONB column containing equipment information
- Join with `don_vi` table to get facility name
- Return equipment data including:
  - `ten_thiet_bi` (equipment name)
  - `ma_thiet_bi` (equipment code)
  - `model`
  - `serial`
  - `khoa_phong_quan_ly` (managing department)
  - **`facility_name`** (from `don_vi.name` - NEW)
  - **`facility_id`** (from `thiet_bi.don_vi` - NEW)

**Migration must be run in Supabase SQL Editor** before the frontend changes will work.

### 2. Frontend Changes

**File**: `src/app/(app)/repair-requests/page.tsx`

#### Updated Type Definition
```typescript
export type RepairRequestWithEquipment = {
  // ... existing fields
  thiet_bi: {
    ten_thiet_bi: string;
    ma_thiet_bi: string;
    model: string | null;
    serial: string | null;
    khoa_phong_quan_ly: string | null;
    facility_name: string | null;  // NEW
    facility_id: number | null;    // NEW
  } | null;
};
```

#### Updated Filtering Logic

**Changed from**: Using `khoa_phong_quan_ly` (department within a facility)  
**Changed to**: Using `facility_name` (actual facility name from `don_vi` table)

```typescript
// Extract unique facilities (now uses facility_name)
const availableFacilities = React.useMemo(() => {
  if (!isRegionalLeader) return [];
  const facilities = new Set<string>();
  requests.forEach(req => {
    const facility = req.thiet_bi?.facility_name;  // Changed from khoa_phong_quan_ly
    if (facility) facilities.add(facility);
  });
  return Array.from(facilities).sort();
}, [requests, isRegionalLeader]);

// Apply filter (now uses facility_name)
const displayedRequests = React.useMemo(() => {
  if (!isRegionalLeader || !selectedFacility) return requests;
  return requests.filter(req => req.thiet_bi?.facility_name === selectedFacility);  // Changed
}, [requests, isRegionalLeader, selectedFacility]);
```

#### Updated Data Normalization
```typescript
// When processing RPC response
thiet_bi: row.thiet_bi ? {
  ten_thiet_bi: row.thiet_bi.ten_thiet_bi,
  ma_thiet_bi: row.thiet_bi.ma_thiet_bi,
  model: row.thiet_bi.model ?? null,
  serial: row.thiet_bi.serial ?? null,
  khoa_phong_quan_ly: row.thiet_bi.khoa_phong_quan_ly ?? null,
  facility_name: row.thiet_bi.facility_name ?? null,  // NEW
  facility_id: row.thiet_bi.facility_id ?? null,      // NEW
} : null,
```

## Why This Approach?

### Better User Experience
- **Facility-level filtering**: Users want to filter by facility (e.g., "Trung tâm Y tế Nam Phong"), not by department within a facility
- **Clearer organization**: Matches the tenant structure in the system (regional leaders manage multiple facilities)

### Correct Data Model
- `don_vi.name` = Facility name (e.g., "Trung tâm Y tế Nam Phong")
- `thiet_bi.khoa_phong_quan_ly` = Department within facility (e.g., "Phòng khám đa khoa")
- Regional leaders manage facilities, not departments

### Security Note
This is a **client-side UX enhancement only**. Server-side security via:
- `allowed_don_vi_for_session()` returns facilities in the regional leader's `dia_ban`
- RPC filters: `WHERE tb.don_vi = ANY(v_allowed)`
- Even if client modifies the filter, server only returns authorized data

## Deployment Steps

### 1. Run Database Migration
```sql
-- In Supabase SQL Editor, run the contents of:
-- supabase/migrations/20251006_repair_request_list_include_facility.sql
```

### 2. Deploy Frontend
```bash
npm run typecheck  # Already verified ✅
npm run build      # Build for production
npm run deploy:dual # Deploy to Vercel + Cloudflare
```

### 3. Verify
1. Log in as a regional leader user
2. Navigate to repair requests page
3. Facility filter dropdown should appear in CardHeader
4. Dropdown should show facilities from the regional leader's dia_ban
5. Selecting a facility should filter the list

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Regional leader sees facility filter dropdown
- [ ] Dropdown shows correct facility names with counts
- [ ] Selecting a facility filters the repair requests list
- [ ] "Tất cả cơ sở" option shows all requests
- [ ] Non-regional users don't see the facility filter
- [ ] Server-side filtering still works (only authorized facilities shown)

## Files Changed

1. **supabase/migrations/20251006_repair_request_list_include_facility.sql** - Database migration (NEW)
2. **src/app/(app)/repair-requests/page.tsx** - Frontend changes (MODIFIED)
   - Updated `RepairRequestWithEquipment` type
   - Changed `availableFacilities` to use `facility_name`
   - Changed `displayedRequests` filter to use `facility_name`
   - Updated data normalization to include `facility_name` and `facility_id`
   - Updated dropdown count logic

## Related Documentation

- Regional Leader Implementation: `docs/regional-leader-role-plan.md`
- Database Schema: `supabase/migrations/20250927_regional_leader_schema_foundation.sql`
- Phase 4 Backend: `supabase/migrations/20250927_regional_leader_phase4.sql`

## Next Steps

1. **Immediate**: Run the database migration in Supabase SQL Editor
2. **Testing**: Add sample repair requests to verify the filter works
3. **Optional**: Add similar facility filtering to other pages if needed
