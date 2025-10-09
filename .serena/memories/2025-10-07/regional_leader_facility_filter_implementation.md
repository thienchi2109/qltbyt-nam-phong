# Regional Leader Facility Filter Implementation

**Date**: October 6, 2025  
**Branch**: feat/regional_leader  
**Status**: ✅ Completed

## Overview
Implemented client-side facility filtering for regional leaders in the repair requests page, allowing them to focus on specific facilities within their region.

## Key Changes

### 1. Database Migration
**File**: `supabase/migrations/20251006_repair_request_list_include_facility.sql`

- Modified `repair_request_list` RPC function to return JSONB with equipment data
- Added `facility_name` (from `don_vi.name`) and `facility_id` to the response
- Used subquery pattern with `jsonb_agg` to avoid GROUP BY issues
- Maintained server-side security: regional leaders only see requests from facilities in their `dia_ban`

**Key SQL Pattern**:
```sql
SELECT jsonb_agg(row_data ORDER BY ...) FROM (
  SELECT jsonb_build_object(
    ...repair request fields...,
    'thiet_bi', jsonb_build_object(
      'facility_name', dv.name,
      'facility_id', tb.don_vi,
      ...other equipment fields...
    )
  ) as row_data
  FROM yeu_cau_sua_chua r
  JOIN thiet_bi tb ON tb.id = r.thiet_bi_id
  LEFT JOIN don_vi dv ON dv.id = tb.don_vi
  WHERE tb.don_vi = ANY(v_allowed)
) subquery;
```

### 2. Frontend Updates
**File**: `src/app/(app)/repair-requests/page.tsx`

#### Type Updates
- Added `facility_name: string | null` and `facility_id: number | null` to `RepairRequestWithEquipment.thiet_bi` type

#### Client-Side Filtering Logic
```typescript
// Extract unique facilities from server-filtered requests
const availableFacilities = React.useMemo(() => {
  if (!isRegionalLeader) return [];
  const facilities = new Set<string>();
  requests.forEach(req => {
    const facility = req.thiet_bi?.facility_name;
    if (facility) facilities.add(facility);
  });
  return Array.from(facilities).sort();
}, [requests, isRegionalLeader]);

// Filter requests by selected facility
const displayedRequests = React.useMemo(() => {
  if (!isRegionalLeader || !selectedFacility) return requests;
  return requests.filter(req => req.thiet_bi?.facility_name === selectedFacility);
}, [requests, isRegionalLeader, selectedFacility]);

// Use filtered data for table
const tableData = isRegionalLeader ? displayedRequests : requests;
```

#### UI Component (Equipment-page-style)
- Building2 icon for visual consistency
- Dashed border select dropdown
- Badge display showing counts:
  - Selected: "X yêu cầu"
  - All facilities: "X cơ sở • Y yêu cầu"
- Dropdown items show facility name + count
- Disabled state when no requests exist
- Always visible for regional leaders (even with 0 data)

### 3. Data Flow
1. **Server-side**: RPC filters by `tb.don_vi = ANY(v_allowed)` (security enforced)
2. **Client receives**: Pre-filtered requests with `facility_name` populated
3. **Client-side**: Extracts unique facility names, provides UX filtering
4. **No additional API calls**: Filter operates on already-fetched data

## Security Notes
- **Server-side enforcement**: Regional leaders can only receive requests from their `dia_ban` facilities
- **Client-side filter**: Pure UX enhancement, does not affect security
- **No data leakage**: Impossible to see requests from other regions

## User Experience
- Regional leaders see facility filter immediately upon page load
- Filter shows "Chưa có yêu cầu" when no data exists (disabled)
- When data exists: dropdown with facility names + counts
- Badges provide visual summary of filter status
- Matches Equipment page design patterns

## Technical Notes
- Uses facility name from `don_vi.name` (not `khoa_phong_quan_ly` department)
- Client-side filtering via `useMemo` for performance
- Debug logging available for troubleshooting
- TypeScript strict mode compliant

## Testing
To test with data, insert sample request in Supabase SQL Editor:
```sql
INSERT INTO yeu_cau_sua_chua (thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, nguoi_yeu_cau)
VALUES (945, NOW(), 'Chờ xử lý', 'Test request', 'Test User');
```

## Related Memories
- `regional_leader_implementation`: Core role implementation
- `regional_leader_ui_gating`: UI restrictions for regional leaders
- `tenant_branding_customization`: Related facility management features