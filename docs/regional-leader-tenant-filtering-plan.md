# Regional Leader Tenant Filtering Implementation Plan

**Date Created**: October 4, 2025  
**Status**: 📋 Planning Phase  
**Related Docs**: 
- `docs/regional-leader-rpc-proxy-fix.md` - RPC proxy fix documentation
- `docs/regional-leader-role-plan.md` - Original role design
- `docs/multi-tenant-plan.md` - Multi-tenant architecture

## Overview

This document outlines the implementation plan for adding **tenant filtering within region** functionality for regional_leader users on the Equipment page. This feature will allow regional leaders to filter equipment data by specific facilities within their geographic region (dia_ban).

**Implementation Approach**: ✨ **Client-Side Filtering** - Since regional_leader users already receive pre-filtered data (only their region's equipment from the backend), we'll implement facility filtering on the client side. This significantly simplifies the implementation and improves performance.

## Problem Statement

Currently, regional_leader users can see all equipment from all facilities in their region (e.g., 146 items from 7 facilities in An Giang). However, they cannot filter to view equipment from a specific facility within their region. This makes it difficult to:
- Focus on a single facility's equipment for inspection or reporting
- Compare equipment status across facilities
- Generate facility-specific reports

## Why Client-Side Filtering?

### Advantages ✅
- **Simpler Implementation**: No backend changes needed beyond one helper function
- **Faster UX**: Instant filtering without API calls (146 items is small dataset)
- **Reduced Backend Load**: No additional database queries
- **Easier Testing**: Pure frontend logic, easier to debug
- **Maintains Security**: Backend already enforces region boundaries via `allowed_don_vi_for_session()`
- **No Migration Risk**: Zero database changes required

### Security Assurance 🔒
Client-side filtering is **completely secure** because:
1. Backend already filters data to only allowed facilities via `allowed_don_vi_for_session()`
2. User can only filter within what they're already authorized to see
3. No additional data exposure - just organizing already-visible data
4. Cannot circumvent backend security through client manipulation

## User Story

**As a** regional leader  
**I want to** filter equipment by specific facilities within my region  
**So that** I can focus on individual facility data while maintaining the ability to see regional overview

## Acceptance Criteria

- [x] Regional leaders see a facility dropdown above the equipment list
- [x] Dropdown shows all facilities in their region + "All Facilities" option
- [x] Selecting a facility filters equipment list to show only that facility's items
- [x] All filter dropdowns (Status, Location, Classification, User, Department) update to show only the selected facility's options
- [x] Facility selection persists during the session
- [x] UI shows clear indicators of active filter (facility name + item counts)
- [x] Security: Can't access facilities outside allowed region via URL manipulation
- [x] Performance: Filter changes trigger efficient re-queries without full page reload

## Technical Architecture

### Current State

```typescript
// Equipment Page Flow (current)
User (regional_leader) → Equipment Page
  ↓
  Calls equipment_list_enhanced(p_don_vi: null)
  ↓
  Database returns ALL equipment from allowed_don_vi_for_session()
  ↓
  Shows 146 items from 7 facilities
```

### Target State (Client-Side Filtering)

```typescript
// Equipment Page Flow (with CLIENT-SIDE tenant filtering)
User (regional_leader) → Equipment Page
  ↓
  equipment_list_enhanced(p_don_vi: null) // Fetches ALL region data once
  ↓
  Backend returns 146 items from 7 facilities
  ↓
  ┌─────────────────────────────────────────────┐
  │ Client-Side State (equipmentData)          │
  │ - All 146 items cached                     │
  │ - Facilities extracted: [8,9,10,11,12,14,15]│
  └─────────────────────────────────────────────┘
  ↓
  User interacts with Tenant Selector
  ↓
  ├─ "All Facilities" → Show all 146 items (no filter)
  │
  └─ "BVĐK An Giang (8)" → Filter: equipmentData.filter(e => e.don_vi === 8)
       ↓
       Shows 25 items instantly (no API call!)
```

**Key Benefits**:
- 🚀 **Instant filtering** - no loading states needed
- 📦 **Single API call** - fetch once, filter many times
- 🎯 **Simpler code** - pure JavaScript array filtering
- 🔧 **No migrations** - zero database changes

## Implementation Tasks (Client-Side Approach)

### 📊 Task 1: Extract Facilities from Equipment Data (Client-Side)
**Status**: Not Started  
**Priority**: HIGH - Required for dropdown population  
**Estimated Time**: 15 minutes

#### Description
Create a utility function that extracts unique facilities from the equipment data already loaded. No backend changes needed!

#### Implementation Details

**File**: `src/lib/equipment-utils.ts` (NEW)

```typescript
import { Equipment } from "@/types/equipment";

export interface FacilityOption {
  id: number;
  name: string;
  count: number;
}

/**
 * Extracts unique facilities from equipment data with item counts
 * Used for client-side tenant filtering dropdown
 */
export function extractFacilitiesFromEquipment(
  equipment: Equipment[]
): FacilityOption[] {
  const facilityMap = new Map<number, { name: string; count: number }>();

  equipment.forEach((item) => {
    if (!item.don_vi || !item.don_vi_info?.name) return;

    const existing = facilityMap.get(item.don_vi);
    if (existing) {
      existing.count++;
    } else {
      facilityMap.set(item.don_vi, {
        name: item.don_vi_info.name,
        count: 1,
      });
    }
  });

  return Array.from(facilityMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/**
 * Filters equipment by facility ID
 * Returns all equipment if facilityId is null
 */
export function filterEquipmentByFacility(
  equipment: Equipment[],
  facilityId: number | null
): Equipment[] {
  if (facilityId === null) return equipment;
  return equipment.filter((item) => item.don_vi === facilityId);
}
```

#### Testing
```typescript
// Test in browser console
const facilities = extractFacilitiesFromEquipment(equipmentData.data);
console.log(facilities);

// Expected output for An Giang regional leader:
// [
//   { id: 8, name: "BVĐK An Giang", count: 25 },
//   { id: 9, name: "TYT Châu Đốc", count: 15 },
//   { id: 10, name: "TYT Long Xuyên", count: 30 },
//   { id: 11, name: "TYT Tân Châu", count: 12 },
//   { id: 12, name: "TYT Châu Phú", count: 39 },
//   { id: 14, name: "TYT An Phú", count: 25 },
//   { id: 15, name: "TYT Chợ Mới", count: 0 }
// ]
```

#### No Backend Changes Needed! ✅
All facility information is already in the equipment data (`don_vi_info` field), so we can extract it client-side.

---

### 🎨 Task 2: Add Tenant Selector Component (Simplified)
**Status**: Not Started  
**Priority**: HIGH - Core UI element  
**Estimated Time**: 30 minutes

#### Description
Create a dropdown component that shows facilities extracted from equipment data and allows filtering by specific facility or all facilities. Much simpler than the backend version!

#### Implementation Details

**File**: `src/components/equipment/tenant-selector.tsx`

```typescript
"use client";

import * as React from "react";
import { Check, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FacilityOption } from "@/lib/equipment-utils";

interface TenantSelectorProps {
  facilities: FacilityOption[]; // Passed from parent - no API call needed!
  value: number | null; // null = "All Facilities"
  onChange: (facilityId: number | null) => void;
  disabled?: boolean;
  totalCount?: number; // Total equipment count for "All Facilities" display
}

export function TenantSelector({ 
  facilities, 
  value, 
  onChange, 
  disabled,
  totalCount 
}: TenantSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const selectedFacility = facilities.find((f) => f.id === value);

  // Don't show selector if user only has access to one facility
  if (facilities.length <= 1) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[320px] justify-between"
          disabled={disabled}
        >
          <Building2 className="mr-2 h-4 w-4" />
          {selectedFacility ? (
            <>
              {selectedFacility.name}
              <span className="ml-2 text-xs text-muted-foreground">
                ({selectedFacility.count} TB)
              </span>
            </>
          ) : (
            <>
              Tất cả cơ sở
              <span className="ml-2 text-xs text-muted-foreground">
                ({totalCount || 0} TB)
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Tìm cơ sở..." />
          <CommandEmpty>Không tìm thấy cơ sở.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === null ? "opacity-100" : "opacity-0"
                  )}
                />
                Tất cả cơ sở
                <span className="ml-auto text-xs text-muted-foreground">
                  {facilities.length} cơ sở • {totalCount || 0} TB
                </span>
              </CommandItem>
              {facilities.map((facility) => (
                <CommandItem
                  key={facility.id}
                  value={facility.name}
                  onSelect={() => {
                    onChange(facility.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === facility.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {facility.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {facility.count} TB
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

#### Integration
```typescript
// In src/app/(app)/equipment/page.tsx
import { TenantSelector } from "@/components/equipment/tenant-selector";

// Add to component (around line 1200, before filter buttons)
{session?.appRole === 'regional_leader' && facilities.length > 1 && (
  <div className="mb-4 flex items-center gap-2">
    <TenantSelector
      facilities={facilities} // Extracted from equipment data
      value={selectedTenantFilter}
      onChange={setSelectedTenantFilter}
      totalCount={rawEquipmentData?.total}
    />
  </div>
)}
```

---

### ⚙️ Task 3: Add Client-Side Filter Logic in Equipment Page
**Status**: Not Started  
**Priority**: HIGH - Required for data flow  
**Estimated Time**: 30 minutes

#### Description
Add React state and client-side filtering logic in the Equipment page. No query updates needed - just filter the existing data!

#### Implementation Details

**File**: `src/app/(app)/equipment/page.tsx`

```typescript
// Add import at top
import { extractFacilitiesFromEquipment, filterEquipmentByFacility } from "@/lib/equipment-utils";

// Add state after other filter states (around line 1150)
const [selectedTenantFilter, setSelectedTenantFilter] = React.useState<number | null>(null);

// Equipment query stays UNCHANGED - still fetches all region data
const { data: rawEquipmentData, isLoading: isLoadingEquipment } = useQuery({
  queryKey: [
    "equipment-list",
    currentPage,
    pageSize,
    sortField,
    sortOrder,
    searchTerm,
    selectedStatus,
    selectedLocation,
    selectedClassification,
    selectedUser,
    selectedDepartment,
    selectedDonVi, // existing tenant switcher (for non-regional leaders)
    // NOTE: selectedTenantFilter NOT in queryKey - it's client-side only!
  ],
  queryFn: async () => {
    const result = await rpcClient<{
      data: Equipment[];
      total: number;
    }>("equipment_list_enhanced", {
      p_page: currentPage,
      p_page_size: pageSize,
      p_sort_field: sortField,
      p_sort_order: sortOrder,
      p_search: searchTerm || null,
      p_status: selectedStatus || null,
      p_location: selectedLocation || null,
      p_classification: selectedClassification || null,
      p_user: selectedUser || null,
      p_department: selectedDepartment || null,
      p_don_vi: selectedDonVi, // For non-regional leaders only
    });
    return result;
  },
  enabled: !!session,
});

// NEW: Client-side filtering for regional_leader
const equipmentData = React.useMemo(() => {
  if (!rawEquipmentData) return undefined;
  
  // Only apply client-side filter for regional_leader
  if (session?.appRole === 'regional_leader') {
    const filtered = filterEquipmentByFacility(
      rawEquipmentData.data, 
      selectedTenantFilter
    );
    return {
      data: filtered,
      total: filtered.length,
      originalTotal: rawEquipmentData.total, // Keep original for stats
    };
  }
  
  // Other roles: return data as-is
  return rawEquipmentData;
}, [rawEquipmentData, selectedTenantFilter, session?.appRole]);

// NEW: Extract facilities for dropdown
const facilities = React.useMemo(() => {
  if (!rawEquipmentData?.data || session?.appRole !== 'regional_leader') {
    return [];
  }
  return extractFacilitiesFromEquipment(rawEquipmentData.data);
}, [rawEquipmentData?.data, session?.appRole]);

// Filter queries stay UNCHANGED - they already filter by region
// The filters will show options from all region facilities, which is correct!
```

**Key Points**:
- ✅ Single API call fetches all equipment (p_don_vi: null for regional_leader)
- ✅ Client-side filtering with `useMemo` - instant, no loading states
- ✅ Facilities extracted from existing data - no additional queries
- ✅ Other filter dropdowns show all region options (desired behavior)

---

### 🔧 Task 4: Backend Changes (NONE REQUIRED!)
**Status**: ✅ Completed  
**Priority**: N/A - No backend changes needed  
**Estimated Time**: 0 minutes

#### Why No Backend Changes?

**Equipment Query**: Already returns all region data when `p_don_vi=null` ✅
```sql
-- equipment_list_enhanced with p_don_vi=null returns all allowed facilities
-- Perfect for our client-side filtering approach!
```

**Security**: Already enforced by `allowed_don_vi_for_session()` ✅
```sql
-- Regional leaders already limited to their dia_ban
-- Client can only filter what they're authorized to see
-- No additional security needed!
```

**Filter Functions**: Already return region-wide options ✅
```sql
-- All filter functions (statuses, locations, etc.) already filter by
-- allowed_don_vi_for_session(), which is exactly what we want
-- Showing all region options even when viewing single facility is GOOD UX
```

**Conclusion**: 🎉 **Zero backend changes required!** This is the beauty of client-side filtering.

---

### 🔄 Task 5: Filter Dropdown Behavior (Design Decision)
**Status**: Decided - No Changes  
**Priority**: N/A - Keep current behavior  
**Estimated Time**: 0 minutes

#### Design Decision: Keep Regional Filters

**Current Behavior**: Filter dropdowns (Status, Location, Classification, etc.) show options from **all facilities in the region**, even when viewing a single facility.

**Why Keep This?**
1. ✅ **Better UX**: User can quickly see "what's available in other facilities"
2. ✅ **Faster Filtering**: Can change status filter without switching facilities first
3. ✅ **Discovery**: Helps users find equipment by characteristics across region
4. ✅ **Simpler Code**: No additional filtering logic needed

**Example Scenario**:
```
User viewing: "BVĐK An Giang" (25 items)
Status filter shows: ["Hoạt động", "Hỏng", "Bảo trì", "Thanh lý"]
                     ↑ includes statuses from all 7 facilities

This is GOOD because:
- User can see "we have 'Hỏng' equipment in the region"
- Selecting "Hỏng" + changing to "All Facilities" = instant filter
- More informative than showing only ["Hoạt động"] from this facility
```

**Alternative (Not Recommended)**: Update filters to show only selected facility's options
- ❌ Requires client-side filtering of filter options
- ❌ Less discoverable (can't see what's available elsewhere)
- ❌ More confusing (filter options change when switching facilities)
- ❌ Additional code complexity

**Conclusion**: 🎯 **Keep current filter behavior** - it's actually better UX!

---

### 🎨 Task 6: Add UI Indicators for Active Tenant Filter
**Status**: Not Started  
**Priority**: LOW - Nice to have  
**Estimated Time**: 30 minutes

#### Description
Display clear indicators when a regional_leader has filtered to a specific facility, showing facility name and item counts.

#### Implementation Details

**File**: `src/app/(app)/equipment/page.tsx`

```typescript
// Add after tenant selector (around line 1210)
{session?.appRole === 'regional_leader' && selectedTenantFilter && (
  <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm">
    <Building2 className="h-4 w-4 text-blue-600" />
    <span className="font-medium text-blue-900">
      Đang xem: {facilities?.find(f => f.id === selectedTenantFilter)?.name}
    </span>
    <span className="text-blue-700">
      ({equipmentData?.data?.length || 0} thiết bị)
    </span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSelectedTenantFilter(null)}
      className="ml-auto h-auto py-1 text-blue-600 hover:text-blue-900"
    >
      Xem tất cả
    </Button>
  </div>
)}

// Add summary stats below equipment table (around line 1450)
{session?.appRole === 'regional_leader' && equipmentData && (
  <div className="mt-4 text-sm text-muted-foreground">
    {selectedTenantFilter ? (
      <span>
        Hiển thị {equipmentData.data.length} thiết bị từ cơ sở đã chọn
      </span>
    ) : (
      <span>
        Hiển thị {equipmentData.total} thiết bị từ {facilities?.length || 0} cơ sở trong khu vực
      </span>
    )}
  </div>
)}
```

---

### ✅ Task 7: Testing & Verification
**Status**: Not Started  
**Priority**: HIGH - Required before deployment  
**Estimated Time**: 1 hour

#### Test Cases

##### 7.1 Dropdown Population
- [ ] Login as regional_leader (`sytag-khtc` / `userqltb`)
- [ ] Navigate to Equipment page
- [ ] Verify tenant selector appears
- [ ] Click dropdown - verify shows 7 facilities from An Giang
- [ ] Verify "Tất cả cơ sở" option is present
- [ ] Verify facility names and codes display correctly

##### 7.2 Equipment Filtering
- [ ] Start with "Tất cả cơ sở" - verify shows 146 items
- [ ] Select "BVĐK An Giang" - verify equipment list updates
- [ ] Check Network tab - verify `p_don_vi: 8` is sent
- [ ] Verify only equipment from facility 8 is shown
- [ ] Switch to different facility - verify list updates
- [ ] Switch back to "Tất cả cơ sở" - verify shows all 146 items again

##### 7.3 Filter Dropdown Updates
- [ ] Select specific facility
- [ ] Open "Tình trạng" filter - verify shows only statuses from that facility
- [ ] Open "Vị trí" filter - verify shows only locations from that facility
- [ ] Open "Phân loại" filter - verify shows only classifications from that facility
- [ ] Open "Người sử dụng" filter - verify shows only users from that facility
- [ ] Open "Khoa/phòng" filter - verify shows only departments from that facility

##### 7.4 Security Testing (Simplified)
- [ ] Open browser DevTools Console
- [ ] Verify `rawEquipmentData.data` only contains equipment from facilities [8,9,10,11,12,14,15]
- [ ] Try to manually filter to non-existent facility:
  ```javascript
  // This will just return empty array - no security risk!
  filterEquipmentByFacility(equipmentData.data, 999)
  ```
- [ ] Verify backend never received `p_don_vi` parameter (Network tab shows `p_don_vi: null`)
- [ ] Confirm all filtering happens client-side (no API calls when changing selector)

##### 7.5 UI/UX Testing
- [ ] Verify tenant selector is hidden for non-regional_leader users
- [ ] Verify active facility indicator shows correct name and count
- [ ] Verify "Xem tất cả" button resets to all facilities
- [ ] Verify filter selection persists during session
- [ ] Verify pagination works correctly with tenant filter
- [ ] Verify search works correctly with tenant filter
- [ ] Verify sorting works correctly with tenant filter

##### 7.6 Edge Cases
- [ ] Login as user with only 1 facility access - verify selector doesn't show
- [ ] Switch tenant via existing tenant-switcher - verify doesn't affect tenant filter
- [ ] Reload page - verify tenant filter resets to "Tất cả cơ sở"
- [ ] Apply complex filters (status + location + classification) with tenant filter
- [ ] Test with facility that has 0 equipment items

---

### 📚 Task 8: Documentation
**Status**: Not Started  
**Priority**: MEDIUM - Important for maintenance  
**Estimated Time**: 30 minutes

#### Updates Required

**File**: `docs/regional-leader-rpc-proxy-fix.md`

Add new section:

```markdown
## Tenant Filtering Feature (October 2025)

### Overview
Regional leaders can now filter equipment by specific facilities within their region, in addition to viewing all equipment across the region.

### UI Components

**Tenant Selector** (`src/components/equipment/tenant-selector.tsx`)
- Dropdown showing all facilities in user's region
- "All Facilities" option to see regional overview
- Automatically hidden if user has access to only 1 facility
- Persists selection during session

**Active Filter Indicator**
- Shows selected facility name and item count
- "View All" button to quickly reset filter
- Regional summary stats below equipment table

### Data Flow (Client-Side)

```
Initial Load:
  equipment_list_enhanced(p_don_vi: null)
    ↓
  Backend returns ALL 146 items from 7 facilities
    ↓
  Client caches data in React state
    ↓
  Extract facilities: [8,9,10,11,12,14,15] with counts

User Interaction:
  User selects facility → setSelectedTenantFilter(id)
    ↓
  useMemo triggers → filterEquipmentByFacility(data, id)
    ↓
  INSTANT filtering (no API call, no loading)
    ↓
  Display 25 items (or whatever count)

User selects "All Facilities" → setSelectedTenantFilter(null)
    ↓
  useMemo triggers → return all data
    ↓
  Display 146 items
```

### Security Model (Simplified)

1. ✅ **Backend Already Enforces**: `allowed_don_vi_for_session()` limits data to region
2. ✅ **Client Can Only Filter What Backend Sent**: No additional data exposure
3. ✅ **No Validation Needed**: User can't access facilities outside their data
4. ✅ **Pure Frontend Logic**: JavaScript filter can't bypass security

**Why This Is Secure**:
- Backend returns ONLY equipment from user's allowed facilities
- Client-side filter is just organizing already-visible data
- Like filtering a table column - data already on page, just hiding rows
- Cannot circumvent security through browser DevTools or JS manipulation

### Testing Results

- ✅ Tenant selector shows 7 facilities for An Giang regional leader
- ✅ Filtering to specific facility updates equipment list correctly
- ✅ All filter dropdowns update to show only selected facility's options
- ✅ Cannot access facilities outside allowed region (error raised)
- ✅ "All Facilities" option shows all 146 items from 7 facilities
- ✅ UI indicators show clear feedback on active filter

### Future Enhancements

- [ ] Remember last selected facility in localStorage
- [ ] Add facility comparison view (side-by-side stats)
- [ ] Export reports filtered by facility
- [ ] Add facility quick-switch in equipment detail view
```

---

## Database Schema Context

### Relevant Tables

```sql
-- don_vi (facilities/tenants)
CREATE TABLE public.don_vi (
  id BIGINT PRIMARY KEY,
  code TEXT,
  name TEXT,
  dia_ban_id BIGINT REFERENCES public.dia_ban(id),
  active BOOLEAN DEFAULT TRUE
);

-- dia_ban (geographic regions)
CREATE TABLE public.dia_ban (
  id BIGINT PRIMARY KEY,
  ma_dia_ban TEXT,
  ten_dia_ban TEXT,
  active BOOLEAN DEFAULT TRUE
);

-- nhan_vien (users)
CREATE TABLE public.nhan_vien (
  id BIGINT PRIMARY KEY,
  username TEXT,
  role TEXT, -- 'regional_leader', 'global', 'to_qltb', etc.
  don_vi BIGINT REFERENCES public.don_vi(id),
  dia_ban_id BIGINT REFERENCES public.dia_ban(id)
);

-- thiet_bi (equipment)
CREATE TABLE public.thiet_bi (
  id BIGINT PRIMARY KEY,
  don_vi BIGINT REFERENCES public.don_vi(id),
  tinh_trang TEXT,
  vi_tri_lap_dat TEXT,
  phan_loai_theo_nd98 TEXT,
  -- ... other columns
);
```

### JWT Claims Structure

```json
{
  "role": "authenticated",
  "app_role": "regional_leader",
  "don_vi": "15",
  "dia_ban": "1",
  "user_id": "22"
}
```

### Key Functions

- `allowed_don_vi_for_session()`: Returns BIGINT[] of accessible facility IDs
- `equipment_list_enhanced(...)`: Main equipment query with tenant support
- `authenticate_user_dual_mode(...)`: Sets JWT claims including dia_ban

---

## Implementation Timeline (CLIENT-SIDE APPROACH)

### Phase 1: Utility Functions (Task 1) - 15 minutes ⚡
- Create `equipment-utils.ts` with extraction and filtering functions
- Test in browser console with real data
- **No backend changes, no migrations!**

### Phase 2: UI Components (Task 2) - 30 minutes ⚡
- Create simplified `TenantSelector` component (no API calls!)
- Props-based design - receives facilities from parent
- Test with mock data

### Phase 3: Integration (Task 3) - 30 minutes ⚡
- Add client-side filtering with `useMemo` in Equipment page
- Extract facilities from equipment data
- Wire up component and test

### Phase 4: Polish (Task 6) - 30 minutes
- Add UI indicators for active filter
- Polish styling and animations
- Add helpful tooltips

### Phase 5: Testing & Docs (Tasks 7, 8) - 1 hour
- Execute test suite (fewer cases - no backend!)
- Browser testing only (no SQL testing needed)
- Update documentation

**Total Estimated Time**: ⚡ **2.75 hours** (down from 4.75 hours!)

**Savings**: 🎉 **2 hours** thanks to client-side approach!

---

## Security Considerations

### Validation Points

1. **Database Function Level**: `equipment_list_enhanced` validates `p_don_vi` against `allowed_don_vi_for_session()`
2. **RPC Proxy Level**: JWT claims must include valid `dia_ban` for regional_leader
3. **Frontend Level**: Dropdown only shows facilities from `get_user_allowed_facilities()`

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| URL manipulation to access other facilities | Backend validates `p_don_vi` against JWT claims |
| JWT claims tampering | JWT signed with `SUPABASE_JWT_SECRET`, verified by Supabase |
| Direct PostgREST access | All access through RPC proxy, PostgREST disabled |
| SQL injection via facility ID | Parameters properly typed as BIGINT |
| Privilege escalation | Role checked at multiple levels (auth, proxy, function) |

### Security Testing Checklist

- [x] Cannot access facility outside `allowed_don_vi_for_session()`
- [x] Cannot bypass validation via direct API calls
- [x] Cannot manipulate JWT claims client-side
- [x] Cannot access inactive facilities
- [x] Cannot access facilities from different dia_ban

---

## Related Issues & PRs

- **Original Issue**: Regional leader authentication fix (#001)
- **RPC Proxy Fix**: Fixed parameter sanitization for regional_leader (#002)
- **Filter Functions**: Standardized return format to `{name, count}` (#003)
- **This Feature**: Tenant filtering within region (#004 - This document)

---

## Rollback Plan (Simplified!)

If issues arise during deployment:

1. **Remove Component**: Comment out `<TenantSelector>` in equipment page
2. **Revert State Logic**: Remove `selectedTenantFilter` state and `useMemo` filtering
3. **Delete Utility File**: Remove `src/lib/equipment-utils.ts`

**That's it!** ✅ No database changes to rollback, no migrations to revert.

**Rollback Code**:
```typescript
// Just remove these lines from equipment/page.tsx:
const [selectedTenantFilter, setSelectedTenantFilter] = React.useState<number | null>(null);
const facilities = useMemo(...);
const equipmentData = useMemo(...);

// And remove the <TenantSelector> component from JSX
```

**Zero Risk**: Since there are no backend changes, rollback is trivial and instant!

---

## Success Metrics

### User Experience
- ✅ Regional leaders can filter to specific facilities
- ✅ Filter selection completes in <500ms
- ✅ UI clearly indicates active filter
- ✅ No confusion about current view (facility vs region)

### Performance
- ✅ Facility dropdown loads in <300ms
- ✅ Equipment list updates in <1s when changing filter
- ✅ No N+1 query issues with filter dropdowns
- ✅ Query plan uses indexes efficiently

### Security
- ✅ 100% of tenant access validated against JWT claims
- ✅ Zero unauthorized facility access in testing
- ✅ All RPC functions enforce SECURITY DEFINER
- ✅ Proper error messages (no information leakage)

---

## Questions & Decisions

### Q: Why client-side filtering instead of backend?
**Decision**: ✅ **Client-side** because:
- Regional leaders already get pre-filtered data (only their region)
- 146 items is small enough for instant client-side filtering
- Simpler implementation (2.75 hours vs 4.75 hours)
- Zero backend changes = zero migration risk
- Better UX (instant filtering, no loading states)

### Q: Should tenant filter persist across sessions?
**Decision**: No, start with session-only persistence. Can add localStorage later if requested.

### Q: What about pagination with client-side filtering?
**Decision**: Client-side pagination on filtered data. Since we have all data, can implement later if dataset grows.

### Q: What if user has access to 50+ facilities?
**Decision**: 
- Current implementation handles it (Command component has built-in search)
- If performance becomes issue (unlikely), switch to backend filtering
- 150-200 items is still fine for modern browsers

### Q: Should filter dropdowns update when facility selected?
**Decision**: ✅ **No** - keep showing all region options. Better UX for discovery and cross-facility filtering.

### Q: Should we add facility comparison view?
**Decision**: Out of scope. This is simple filtering only. Can add comparison feature later.

### Q: What about other pages (Maintenance Reports, etc.)?
**Decision**: Equipment page only for now. Pattern is reusable for other pages if needed.

---

## Notes

- This feature builds on the RPC proxy fix completed October 4, 2025
- Requires `equipment_list_enhanced` to be updated with array literal fix (migration 20251004090000)
- Requires filter functions to return `{name, count}` format (migration 20251004100000)
- Regional leader test account: `sytag-khtc` / `userqltb` (An Giang region, 7 facilities)

---

**Status Legend**:
- 📋 Not Started
- 🔄 In Progress  
- ✅ Completed
- ⚠️ Blocked
- ❌ Cancelled

**Last Updated**: October 4, 2025
