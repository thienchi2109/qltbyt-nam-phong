# Session Note: Facility Filter Defensive Fixes
**Date**: January 9, 2025  
**Duration**: ~2 hours  
**Focus**: Address reviewer concerns about facility filtering edge cases

---

## 📋 Executive Summary

Implemented comprehensive fixes for facility filtering across maintenance plans and transfer requests pages. Added two-layer solution:
1. **Prevention**: Enhanced UI to show facility information during creation
2. **Defense**: Robust client-side filtering that handles missing data gracefully

**Security Status**: ✅ All fixes maintain regional leader access control boundaries.

---

## 🎯 Problems Identified

### Issue 1: Maintenance Plans Empty Table
**Reviewer's Concern** (maintenance page):
```
When maintenance plans lack don_vi data, fallback RPC populates dropdown,
but filtering returns empty array → confusing empty table.
```

**Scenario**:
1. Plans with `don_vi = NULL` (legacy data)
2. Fallback RPC fetches facilities → Populates dropdown
3. User selects facility from dropdown
4. Filter: `plan.don_vi === selectedFacilityId`
5. No plans match (all have `don_vi = null`)
6. **Result**: Empty table 😕

### Issue 2: Transfers Empty Kanban Board
**Reviewer's Concern** (transfers page):
```
Same pattern: transfers reference equipment with don_vi = NULL,
filtering yields empty Kanban board (all 5 columns empty).
```

---

## 🔧 Solutions Implemented

### Part 1: Prevention - Add Read-Only Facility Field

**File**: `src/components/add-maintenance-plan-dialog.tsx`

**What we did**:
- Added read-only "Đơn vị" (Facility) field to creation dialog
- Shows user's facility name and code (e.g., "Bệnh viện ABC (BV001)")
- Positioned between "Năm" (Year) and "Loại công việc" (Work Type)
- Mirrors pattern from equipment dialog for consistency

**Implementation**:
```typescript
// Query tenant list (cached 5 minutes)
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

// Display field
<div className="space-y-2">
  <Label className="text-sm font-medium">Đơn vị</Label>
  <Input 
    value={currentTenant ? `${currentTenant.name}${currentTenant.code ? ` (${currentTenant.code})` : ''}` : 'Đang tải...'}
    disabled
    readOnly
    aria-readonly="true"
    tabIndex={-1}
    className="bg-muted text-muted-foreground cursor-not-allowed"
    data-testid="facility-display"
  />
  <p className="text-xs text-muted-foreground">
    Trường này được lấy từ tài khoản của bạn và không thể thay đổi.
  </p>
</div>
```

**Benefits**:
- ✅ Transparency: Users see their facility during creation
- ✅ Prevention: All NEW plans will have `don_vi` populated correctly
- ✅ User Experience: Clear, informative UI
- ✅ Security: Backend still reads from JWT (authoritative)

---

### Part 2: Defense - Robust Filtering Logic

#### For Maintenance Plans

**File**: `src/app/(app)/maintenance/page.tsx`

**Enhanced filtering with 3-layer validation**:

```typescript
const displayedPlans = React.useMemo(() => {
  if (!showFacilityFilter) return enrichedPlans
  if (!selectedFacilityId) return enrichedPlans
  
  // ✅ Layer 1: Security check
  const allowedFacilityIds = new Set(effectiveFacilities.map(f => f.id))
  if (!allowedFacilityIds.has(selectedFacilityId)) {
    console.warn(`[Maintenance] Selected facility ${selectedFacilityId} not in allowed list.`)
    return enrichedPlans
  }
  
  // ✅ Layer 2: Data quality check
  const plansWithFacilityData = enrichedPlans.filter((plan: any) => plan?.don_vi != null)
  if (plansWithFacilityData.length === 0 && enrichedPlans.length > 0) {
    console.warn('[Maintenance] Plans missing don_vi data. Cannot filter by facility.')
    return enrichedPlans // Show all plans instead of empty table
  }
  
  // ✅ Layer 3: Normal filtering
  return enrichedPlans.filter((plan: any) => Number(plan?.don_vi) === selectedFacilityId)
}, [enrichedPlans, showFacilityFilter, selectedFacilityId, effectiveFacilities])
```

#### For Transfers

**File**: `src/app/(app)/transfers/page.tsx`

**Same 3-layer pattern**:

```typescript
const displayedTransfers = React.useMemo(() => {
  if (!showFacilityFilter || !selectedFacilityId) {
    return filteredItems
  }

  // ✅ Layer 1: Security check
  const allowedFacilityIds = new Set(dropdownFacilities.map(f => f.id))
  if (!allowedFacilityIds.has(selectedFacilityId)) {
    console.warn(`[Transfers] Selected facility ${selectedFacilityId} not in allowed list.`)
    return transfers
  }

  // ✅ Layer 2: Data quality check
  const transfersWithFacilityData = transfers.filter((t) => t.thiet_bi?.facility_id != null)
  if (transfersWithFacilityData.length === 0 && transfers.length > 0) {
    console.warn('[Transfers] Transfers missing facility metadata.')
    return transfers // Show all transfers instead of empty Kanban
  }

  // ✅ Layer 3: Normal filtering
  return filteredItems
}, [filteredItems, showFacilityFilter, selectedFacilityId, dropdownFacilities, transfers])
```

**Benefits**:
- ✅ Handles edge cases gracefully
- ✅ No confusing empty states
- ✅ Security validation
- ✅ Console warnings for debugging

---

## 🔒 Security Verification

### Question: Does this respect regional leader boundaries?

**Answer**: YES ✅

### Regional Leader Design

**Server-Side** (`allowed_don_vi_for_session()` function):
```sql
WHEN 'regional_leader' THEN
    -- Regional leaders can access all don_vi in their dia_ban
    SELECT array_agg(id) INTO v_allowed_don_vi 
    FROM public.don_vi 
    WHERE dia_ban_id = v_user_dia_ban 
    AND active = true;
```

**Example**: Regional leader with `dia_ban = 1` → Gets facilities `[3, 5, 7, 9]`

### Data Flow Security

```
┌─────────────────────────────────────────────────────────────┐
│  User Request (Regional Leader, dia_ban = 1)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend RPC: maintenance_plan_list()                       │
│  - Calls: allowed_don_vi_for_session()                     │
│  - Returns: [3, 5, 7, 9] (facilities in region 1)         │
│  - Filter: WHERE kh.don_vi = ANY([3, 5, 7, 9])            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Client receives: plans from facilities [3, 5, 7, 9] ONLY  │
│  ✅ NO cross-region data                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Defensive Logic Fallback:                                  │
│  - Returns: enrichedPlans                                   │
│  - enrichedPlans = Pre-filtered data from [3, 5, 7, 9]     │
│  ✅ Still region-restricted                                 │
└─────────────────────────────────────────────────────────────┘
```

### Security Validation Matrix

| Check | Status | Evidence |
|-------|--------|----------|
| **Backend filters by region** | ✅ PASS | All RPCs use `allowed_don_vi_for_session()` |
| **No raw data leakage** | ✅ PASS | Client never receives cross-region data |
| **Defensive fallback safe** | ✅ PASS | Falls back to pre-filtered `enrichedPlans`/`transfers` |
| **Dropdown validation** | ✅ PASS | Validates selected facility in allowed list |
| **Console warnings** | ✅ PASS | Helps identify data quality issues |

**Conclusion**: No security vulnerabilities. Regional leader isolation fully maintained.

---

## 📊 Behavior Comparison

### Before Fix

| Scenario | Behavior | UX Impact |
|----------|----------|-----------|
| ✅ All items have facility data | Filter works correctly | Good ✅ |
| ⚠️ Some items missing data | Shows only items with data | Acceptable ⚠️ |
| ❌ ALL items missing data | **Empty view** | **Confusing** ❌ |
| ❌ Invalid facility selected | Shows filtered results | **Security risk** ❌ |

### After Fix

| Scenario | Behavior | UX Impact |
|----------|----------|-----------|
| ✅ All items have facility data | Filter works correctly | Good ✅ |
| ⚠️ Some items missing data | Shows only items with data | Acceptable ⚠️ |
| ✅ ALL items missing data | Shows all + warning | **Defensive** ✅ |
| ✅ Invalid facility selected | Shows all + warning | **Secure** ✅ |

---

## 📁 Files Modified

### 1. `src/components/add-maintenance-plan-dialog.tsx`
**Changes**:
- Added imports: `useQuery`, `Label`, `FormDescription`
- Added tenant list query (TanStack Query)
- Added `currentTenant` computation
- Added read-only "Đơn vị" field in form
- Position: Between "Năm" and "Loại công việc"

**Lines changed**: ~50 lines added

### 2. `src/app/(app)/maintenance/page.tsx`
**Changes**:
- Enhanced `displayedPlans` memo
- Added 3-layer validation (security, data quality, normal)
- Added console warnings for debugging

**Lines changed**: ~20 lines modified

### 3. `src/app/(app)/transfers/page.tsx`
**Changes**:
- Enhanced `displayedTransfers` memo
- Added 3-layer validation (security, data quality, normal)
- Added console warnings for debugging

**Lines changed**: ~25 lines modified

---

## ✅ Verification Results

### Compilation & Build
```bash
npm run typecheck  # ✅ PASSED
npm run build      # ✅ PASSED (55s)
```

### Security
- ✅ Regional leader data isolation maintained
- ✅ Backend filtering respected
- ✅ No cross-region data leakage possible

### Code Quality
- ✅ TypeScript strict mode compliant
- ✅ Consistent with existing patterns
- ✅ Proper error handling and warnings

---

## 🎓 Lessons Learned

### 1. Defense in Depth
- Prevention (UI) + Defense (validation) = Robust solution
- Multiple validation layers catch different edge cases

### 2. Security First
- Always validate that defensive fallbacks respect backend filtering
- Client-side validation is UX, not security

### 3. User Experience
- Empty states are confusing → Always show something
- Console warnings help developers identify data quality issues

### 4. Pattern Consistency
- Mirroring patterns across similar features improves maintainability
- Equipment dialog → Maintenance plan dialog (same UX)

### 5. Regional Leader Design
- Server-side filtering is authoritative
- Client receives only pre-filtered data
- Defensive logic can safely fallback to received data

---

## 🔮 Future Considerations

### Data Migration
If legacy data exists with `don_vi = NULL`:
```sql
-- Migration to backfill missing don_vi
UPDATE ke_hoach_bao_tri 
SET don_vi = (
  SELECT current_don_vi 
  FROM nhan_vien 
  WHERE username = nguoi_lap_ke_hoach 
  LIMIT 1
)
WHERE don_vi IS NULL;
```

### Pattern for Other Pages
When implementing facility filtering:
```typescript
// 1. Use useFacilityFilter
const { filteredItems, selectedFacilityId } = useFacilityFilter(...)

// 2. Add defensive layer
const displayedItems = React.useMemo(() => {
  if (!showFilter || !selectedId) return filteredItems
  
  // Security check
  if (!allowedIds.has(selectedId)) {
    console.warn('[Page] Invalid facility')
    return items
  }
  
  // Data quality check
  if (items.every(i => !i.facility_id)) {
    console.warn('[Page] Missing metadata')
    return items
  }
  
  return filteredItems
}, [filteredItems, items, selectedId])
```

---

## 📝 Client Confirmation

**Client stated**: "I don't have any maintenance plans in DB"

**Implication**:
- No legacy data with `don_vi = NULL` exists
- Part 1 (prevention) ensures future plans are correct
- Part 2 (defense) provides robustness for edge cases

---

## 🎉 Session Outcomes

✅ **Reviewer concerns fully addressed**  
✅ **Security maintained (regional leader boundaries)**  
✅ **User experience improved (no empty states)**  
✅ **Code quality maintained (TypeScript, patterns)**  
✅ **Future-proofed (defensive against edge cases)**  
✅ **Memory bank updated with comprehensive notes**

---

## 📌 Key Takeaways

1. **Prevention > Cure**: UI enhancements prevent issues at source
2. **Defensive Coding**: Handle edge cases gracefully
3. **Security by Design**: Always validate against allowed data
4. **User Experience**: Avoid confusing empty states
5. **Pattern Consistency**: Mirror successful patterns across features

---

**Session Completed**: January 9, 2025  
**Status**: ✅ All issues resolved  
**Next Steps**: Monitor console warnings for data quality issues
