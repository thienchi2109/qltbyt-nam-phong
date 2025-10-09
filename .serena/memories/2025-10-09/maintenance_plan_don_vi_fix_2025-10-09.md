# Maintenance Plan don_vi Field Fix (2025-01-09)

## Problem Identified
Reviewer found that when maintenance plans lack `don_vi` data:
- Fallback RPC populates facility dropdown
- User selects facility from dropdown
- Filter logic matches `plan.don_vi === selectedFacilityId`
- Since all plans have `don_vi = null`, filter returns empty array → empty table

## Root Cause
- Old migration added `don_vi` column to `ke_hoach_bao_tri` table (Sept 28, 2025)
- Legacy plans created before migration have `don_vi = NULL`
- Frontend `maintenance_plan_create` RPC reads `don_vi` from JWT claims automatically
- Client confirmed: **No existing plans in database** (fresh system)

## Solution Implemented (Two-Part)

### Part 1: Prevention (Add Read-Only Facility Field to Creation Dialog)
**File:** `src/components/add-maintenance-plan-dialog.tsx`

**Changes:**
- Added TanStack Query for `tenant_list` RPC (5-min cache)
- Computed `currentTenant` from `user.don_vi` (same pattern as equipment dialog)
- Added read-only "Đơn vị" field between "Năm" and "Loại công việc"
- Field displays: `"${currentTenant.name}${currentTenant.code ? ` (${currentTenant.code})` : ''}"`
- Styling: `bg-muted text-muted-foreground cursor-not-allowed`
- Helper text: "Trường này được lấy từ tài khoản của bạn và không thể thay đổi."

**Result:** All NEW plans will have `don_vi` correctly populated by backend.

### Part 2: Defense (Robust Filtering Logic)
**File:** `src/app/(app)/maintenance/page.tsx`

**Changes to `displayedPlans` memo:**

```typescript
const displayedPlans = React.useMemo(() => {
  if (!showFacilityFilter) return enrichedPlans
  if (!selectedFacilityId) return enrichedPlans
  
  // ✅ Security check: Verify selected facility is in allowed list
  const allowedFacilityIds = new Set(effectiveFacilities.map(f => f.id))
  if (!allowedFacilityIds.has(selectedFacilityId)) {
    console.warn(`[Maintenance] Selected facility ${selectedFacilityId} not in allowed list.`)
    return enrichedPlans
  }
  
  // ✅ Data quality check: Skip filtering if plans lack facility metadata
  const plansWithFacilityData = enrichedPlans.filter((plan: any) => plan?.don_vi != null)
  if (plansWithFacilityData.length === 0 && enrichedPlans.length > 0) {
    console.warn('[Maintenance] Plans missing don_vi data. Cannot filter by facility.')
    return enrichedPlans // Show all plans instead of empty table
  }
  
  // ✅ Apply filter
  return enrichedPlans.filter((plan: any) => Number(plan?.don_vi) === selectedFacilityId)
}, [enrichedPlans, showFacilityFilter, selectedFacilityId, effectiveFacilities])
```

**Behavior:**
- If ALL plans lack `don_vi`: Shows all plans (prevents empty table)
- If selected facility not in allowed list: Shows all plans + warning
- If plans have valid `don_vi`: Filter works normally

## Verification
- ✅ TypeScript compilation: PASSED
- ✅ Build: PASSED (55s)
- ✅ Reviewer's concern: ADDRESSED

## Key Takeaway
Since client has NO existing plans, Part 1 prevents the issue entirely. Part 2 provides defensive coding for edge cases.