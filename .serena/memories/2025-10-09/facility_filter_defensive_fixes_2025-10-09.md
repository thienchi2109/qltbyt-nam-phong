# Facility Filter Defensive Fixes - Session Summary (2025-01-09)

## Overview
Addressed reviewer concerns about facility filtering edge cases across maintenance plans and transfer requests pages. Implemented two-part solution: prevention (UI improvement) and defense (robust filtering logic).

## Context: Regional Leader Access Control Design

### Server-Side Architecture
- **Key Function**: `allowed_don_vi_for_session()` (RPC helper)
- **Global users**: Access all active facilities
- **Regional leaders**: Access ALL facilities in their assigned `dia_ban` (region)
- **Other roles**: Access only their single assigned `don_vi` (facility)

### Data Flow Pattern
```
User Request → RPC (filters by allowed_don_vi) → Client (receives pre-filtered data) → UI Filter → Display
```

**Critical Security**: All RPCs filter data at the source. Client never receives cross-region data.

---

## Issue 1: Maintenance Plans Filtering

### Problem (Reviewer's Concern)
**File**: `src/app/(app)/maintenance/page.tsx`

When maintenance plans lack `don_vi` data:
1. Fallback RPC populates facility dropdown
2. User selects facility
3. Filter logic: `plan.don_vi === selectedFacilityId`
4. All plans have `don_vi = null` → **empty table** (confusing UX)

### Root Cause
- Old migration added `don_vi` column to `ke_hoach_bao_tri` table (Sept 28, 2025)
- Potential legacy plans with `don_vi = NULL` (though client confirmed none exist)
- Backend RPC `maintenance_plan_create` populates `don_vi` from JWT automatically

### Solution Part 1: Prevention (UI Enhancement)
**File**: `src/components/add-maintenance-plan-dialog.tsx`

**Added read-only facility field to creation dialog:**
```typescript
// Added TanStack Query for tenant_list (5-min cache)
const { data: tenantList = [] } = useQuery({
  queryKey: ['tenant_list'],
  queryFn: async () => {
    const list = await callRpc<any[]>({ fn: 'tenant_list', args: {} })
    return (list || []).map(t => ({ id: t.id, code: t.code, name: t.name }))
  },
  enabled: open,
  staleTime: 5 * 60 * 1000,
})

// Find current user's tenant
const currentTenant = React.useMemo(() => {
  const userDonVi = user?.don_vi
  if (!userDonVi || !tenantList.length) return null
  return tenantList.find(t => t.id === Number(userDonVi)) || null
}, [user?.don_vi, tenantList])

// Display read-only "Đơn vị" field (between "Năm" and "Loại công việc")
<Input 
  value={currentTenant ? `${currentTenant.name}${currentTenant.code ? ` (${currentTenant.code})` : ''}` : 'Đang tải...'}
  disabled
  readOnly
  className="bg-muted text-muted-foreground cursor-not-allowed"
/>
```

**Result**: All NEW plans will have `don_vi` correctly populated.

### Solution Part 2: Defense (Robust Filtering)
**File**: `src/app/(app)/maintenance/page.tsx`

**Enhanced `displayedPlans` memo with defensive checks:**
```typescript
const displayedPlans = React.useMemo(() => {
  if (!showFacilityFilter) return enrichedPlans
  if (!selectedFacilityId) return enrichedPlans
  
  // ✅ Security check: Verify selected facility is in allowed list
  const allowedFacilityIds = new Set(effectiveFacilities.map(f => f.id))
  if (!allowedFacilityIds.has(selectedFacilityId)) {
    console.warn(`[Maintenance] Selected facility ${selectedFacilityId} not in allowed list.`)
    return enrichedPlans // Pre-filtered by RPC, safe to show
  }
  
  // ✅ Data quality check: Skip filtering if plans lack facility metadata
  const plansWithFacilityData = enrichedPlans.filter((plan: any) => plan?.don_vi != null)
  if (plansWithFacilityData.length === 0 && enrichedPlans.length > 0) {
    console.warn('[Maintenance] Plans missing don_vi data. Cannot filter by facility.')
    return enrichedPlans // Show all (pre-filtered) plans instead of empty table
  }
  
  // ✅ Apply filter (normal case)
  return enrichedPlans.filter((plan: any) => Number(plan?.don_vi) === selectedFacilityId)
}, [enrichedPlans, showFacilityFilter, selectedFacilityId, effectiveFacilities])
```

---

## Issue 2: Transfer Requests Filtering

### Problem (Reviewer's Concern)
**File**: `src/app/(app)/transfers/page.tsx`

Same pattern as maintenance plans:
1. Transfers use `useFacilityFilter` filtering by `t.thiet_bi?.facility_id`
2. If equipment has `don_vi = NULL`, RPC returns `facility_id = null`
3. Fallback populates dropdown, but filtering fails
4. Result: **Empty Kanban board** (all 5 columns empty)

### Root Cause
- Equipment (`thiet_bi`) might have `don_vi = NULL` (legacy, pre-migration)
- Transfer RPC joins: `LEFT JOIN don_vi dv ON dv.id = tb.don_vi`
- When `tb.don_vi IS NULL`: `facility_id` and `facility_name` become NULL

### Solution: Defense (Robust Filtering)
**File**: `src/app/(app)/transfers/page.tsx`

**Enhanced `displayedTransfers` memo:**
```typescript
const displayedTransfers = React.useMemo(() => {
  // If no facility filter is active, return filtered items as-is
  if (!showFacilityFilter || !selectedFacilityId) {
    return filteredItems
  }

  // ✅ Security check: Verify selected facility is in allowed list
  const allowedFacilityIds = new Set(dropdownFacilities.map(f => f.id))
  if (!allowedFacilityIds.has(selectedFacilityId)) {
    console.warn(`[Transfers] Selected facility ${selectedFacilityId} not in allowed list.`)
    return transfers // Pre-filtered by RPC, safe to show
  }

  // ✅ Data quality check: Skip filtering if transfers lack facility metadata
  const transfersWithFacilityData = transfers.filter((t) => t.thiet_bi?.facility_id != null)
  if (transfersWithFacilityData.length === 0 && transfers.length > 0) {
    console.warn('[Transfers] Transfers missing facility metadata. Cannot filter.')
    return transfers // Show all (pre-filtered) transfers instead of empty Kanban
  }

  // ✅ Use filtered items from useFacilityFilter hook (normal case)
  return filteredItems
}, [filteredItems, showFacilityFilter, selectedFacilityId, dropdownFacilities, transfers])
```

---

## Security Verification: Regional Leader Isolation

### Question Raised
Does defensive logic respect regional leader boundaries?

### Answer: YES ✅

**Data Flow Security:**
1. **Backend RPC Layer**: Filters ALL data by `allowed_don_vi_for_session()`
   - Regional leader with `dia_ban = 1` → Gets `v_allowed_don_vi = [3, 5, 7, 9]`
   - RPC: `WHERE don_vi = ANY(v_allowed_don_vi)`

2. **Client Receives**: ONLY pre-filtered data from allowed facilities
   - `enrichedPlans` / `transfers` contain ONLY region 1 data

3. **Defensive Fallback**: Returns pre-filtered data
   - `return enrichedPlans` → Still only region 1 data
   - `return transfers` → Still only region 1 data

**No cross-region data leakage possible.**

### Security Validation Matrix

| Check | Status | Reasoning |
|-------|--------|----------|
| Backend filters by region | ✅ PASS | All RPCs use `allowed_don_vi_for_session()` |
| No raw data leakage | ✅ PASS | Client never receives cross-region data |
| Defensive fallback safe | ✅ PASS | Falls back to pre-filtered data |
| Dropdown validation | ✅ PASS | Validates `selectedFacilityId` in allowed list |
| Console warnings | ✅ PASS | Helps identify data quality issues |

---

## Behavior Summary

### Before Fix
| Scenario | Behavior | UX Impact |
|----------|----------|----------|
| All items have facility data | Filter works | ✅ Good |
| ALL items missing facility data | Empty view | ❌ Confusing |

### After Fix
| Scenario | Behavior | UX Impact |
|----------|----------|----------|
| All items have facility data | Filter works | ✅ Good |
| ALL items missing facility data | Show all items + warning | ✅ Defensive |
| Selected facility not in list | Show all items + warning | ✅ Secure |

---

## Files Modified

### 1. Maintenance Plan Creation Dialog
**File**: `src/components/add-maintenance-plan-dialog.tsx`
- Added: `useQuery` for `tenant_list` RPC
- Added: `currentTenant` computation from `user.don_vi`
- Added: Read-only "Đơn vị" field (between "Năm" and "Loại công việc")
- Pattern: Mirrored from equipment dialog for consistency

### 2. Maintenance Plans Page
**File**: `src/app/(app)/maintenance/page.tsx`
- Enhanced: `displayedPlans` memo with 3-layer validation
  1. Security check (facility in allowed list)
  2. Data quality check (plans have facility data)
  3. Normal filtering (when data is complete)

### 3. Transfers Page
**File**: `src/app/(app)/transfers/page.tsx`
- Enhanced: `displayedTransfers` memo with 3-layer validation
  1. Security check (facility in allowed list)
  2. Data quality check (transfers have facility data)
  3. Normal filtering (when data is complete)

---

## Verification Results

✅ **TypeScript Compilation**: PASSED  
✅ **Build**: PASSED (55s compile time)  
✅ **Security**: Regional leader isolation maintained  
✅ **Reviewer Concerns**: Fully addressed  

---

## Key Takeaways

1. **Prevention > Defense**: UI enhancement prevents issue at source
2. **Defense in Depth**: Client-side validation handles edge cases gracefully
3. **Security First**: All defensive fallbacks respect backend filtering
4. **User Experience**: No confusing empty states, clear console warnings
5. **Data Quality**: Warnings help identify legacy data needing migration

## Pattern for Future Pages

When implementing facility filtering:

```typescript
// 1. Use useFacilityFilter for base filtering
const { filteredItems, facilities, selectedFacilityId } = useFacilityFilter(...)

// 2. Add defensive layer
const displayedItems = React.useMemo(() => {
  if (!showFilter || !selectedId) return filteredItems
  
  // Security: Validate selected facility
  if (!allowedFacilities.has(selectedId)) {
    console.warn('[Page] Invalid facility selected')
    return items // Pre-filtered by RPC
  }
  
  // Data quality: Check if items have facility metadata
  const itemsWithData = items.filter(i => i.facility_id != null)
  if (itemsWithData.length === 0 && items.length > 0) {
    console.warn('[Page] Items missing facility metadata')
    return items // Show all instead of empty
  }
  
  return filteredItems // Normal case
}, [filteredItems, items, selectedId, allowedFacilities])
```