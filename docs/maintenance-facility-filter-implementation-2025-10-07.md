# Maintenance Page Facility Filter Implementation - October 7, 2025

## Feature Overview

Added client-side facility filtering for the maintenance plans page, allowing **regional leaders** and **global users** to filter maintenance plans by facility.

## Key Implementation Details

### 1. Data Flow

```
RPC Level (Server) → Pre-filters by role
    ↓
Regional leader: plans from their region only
Global user: plans from all facilities  
Other roles: plans from single facility
    ↓
Client Level (React) → Additional filtering by selected facility
    ↓
TanStack Table → Pagination on filtered data
```

### 2. Files Modified

#### **Type Definition**: `src/lib/data.ts`
- Added `don_vi: number | null` to `MaintenancePlan` type
- Added `facility_name?: string` for client-side joined data

#### **Main Page**: `src/app/(app)/maintenance/page.tsx`

**New State Variables** (lines 116-118):
```typescript
const [selectedFacility, setSelectedFacility] = React.useState<number | null>(null);
const [facilities, setFacilities] = React.useState<Array<{ id: number; name: string }>>([]);
```

**Facility Fetching** (lines 286-306):
- Calls `don_vi_list` RPC to fetch all facilities
- Only fetches for regional leaders and global users
- Stores facility ID and name mapping

**Data Enrichment** (lines 308-341):
```typescript
// Join facility names with plans (client-side)
const enrichedPlans = React.useMemo(() => {
  if (facilities.length === 0) return plans;
  return plans.map(plan => ({
    ...plan,
    facility_name: facilities.find(f => f.id === plan.don_vi)?.name || null
  }));
}, [plans, facilities]);

// Filter by selected facility
const displayedPlans = React.useMemo(() => {
  if (!showFacilityFilter || !selectedFacility) return enrichedPlans;
  return enrichedPlans.filter(plan => plan.don_vi === selectedFacility);
}, [enrichedPlans, showFacilityFilter, selectedFacility]);
```

**Table Data** (line 790):
```typescript
const planTable = useReactTable({
  data: tablePlans as MaintenancePlan[], // Uses filtered data
  // ...
})
```

**UI Component** (lines 1951-2002):
- Dropdown with Building2 icon
- Shows "Tất cả cơ sở" option
- Lists all facilities with plan counts
- Displays summary badges

### 3. User Experience

#### Regional Leader View:
```
[🏢] [Select: Tất cả cơ sở ▼]  [5 cơ sở • 23 kế hoạch]

↓ Selects "Bệnh viện Đa khoa An Giang"

[🏢] [Select: Bệnh viện Đa khoa An Giang ▼]  [7 kế hoạch]
```

#### Global User View:
```
[🏢] [Select: Tất cả cơ sở ▼]  [12 cơ sở • 87 kế hoạch]

↓ Selects "Trung tâm Kiểm soát bệnh tật An Giang"

[🏢] [Select: Trung tâm... ▼]  [4 kế hoạch]
```

#### Other Roles (to_qltb, etc.):
- Filter not shown (only have access to single facility)

### 4. Technical Features

✅ **Client-side filtering** - Instant, no API calls
✅ **Works with pagination** - TanStack Table handles filtering before pagination
✅ **Auto-reset to page 1** - When filter changes, pagination resets automatically
✅ **Count badges** - Shows facility count and plan count dynamically
✅ **Role-based visibility** - Only shown for multi-facility roles
✅ **Pre-filtered data** - RPC already filtered by role at database level

### 5. Pagination Behavior

**Scenario**: User on page 5, selects facility filter
1. All 50 plans in memory (pre-filtered by role)
2. Filter by "Facility A" → 7 matching plans
3. TanStack Table automatically:
   - Resets to page 1
   - Shows filtered 7 plans
   - Updates pagination controls

**Why it works**:
```typescript
getCoreRowModel()        // Gets all data
    ↓
getFilteredRowModel()    // Filters data
    ↓
getPaginationRowModel()  // Paginates filtered data
```

### 6. Consistency with Other Pages

This implementation follows the exact same pattern as:
- ✅ **Repair Requests Page** (lines 1954-2005)
- ✅ **Equipment Page** (uses similar client-side filtering)

### 7. Testing Checklist

Before deploying, verify:

- [ ] **Regional Leader User**:
  - [ ] Sees facility filter dropdown
  - [ ] Dropdown shows only facilities in their region
  - [ ] Can filter by selecting a facility
  - [ ] Badge shows correct count
  - [ ] Pagination works correctly after filtering
  - [ ] Can reset to "Tất cả cơ sở"

- [ ] **Global User**:
  - [ ] Sees facility filter dropdown
  - [ ] Dropdown shows ALL facilities
  - [ ] Can filter by selecting a facility
  - [ ] Badge shows correct count
  - [ ] Pagination works correctly

- [ ] **to_qltb User**:
  - [ ] Does NOT see facility filter
  - [ ] Only sees plans from their single facility

- [ ] **General**:
  - [ ] TypeScript compilation passes ✅ (already verified)
  - [ ] Filter works across all pages
  - [ ] Search still works with filter active
  - [ ] Footer count updates correctly

### 8. Code Locations Reference

| Feature | File | Line Range |
|---------|------|------------|
| Type definition | `src/lib/data.ts` | 49-50 |
| State variables | `src/app/(app)/maintenance/page.tsx` | 116-118 |
| Fetch facilities | `src/app/(app)/maintenance/page.tsx` | 286-306 |
| Enrich plans | `src/app/(app)/maintenance/page.tsx` | 308-341 |
| Filter UI | `src/app/(app)/maintenance/page.tsx` | 1951-2002 |
| Table data | `src/app/(app)/maintenance/page.tsx` | 790 |
| Footer count | `src/app/(app)/maintenance/page.tsx` | 2086 |

### 9. Dependencies

**RPC Functions Used**:
- `maintenance_plan_list` - Fetches plans (pre-filtered by role)
- `don_vi_list` - Fetches facility names for dropdown

**No new dependencies added** - Uses existing components and hooks.

### 10. Performance Considerations

- **Facility list**: Cached after first fetch (only fetches once per page load)
- **Plan enrichment**: Memoized with `useMemo` - only recalculates when plans or facilities change
- **Filtering**: Client-side array filter - instant, no latency
- **Pagination**: TanStack Table handles efficiently

### 11. Future Enhancements (Optional)

- Add facility filter to mobile card view
- Persist selected facility in URL query params
- Add facility logos to dropdown items
- Show facility count in parentheses next to each option

---

**Status**: ✅ Complete and ready for testing  
**Date**: October 7, 2025  
**TypeScript**: ✅ Compilation successful
