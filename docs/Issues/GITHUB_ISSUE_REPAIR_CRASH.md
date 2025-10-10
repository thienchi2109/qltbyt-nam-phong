# 🐛 P0: Repair Requests Page Crash — Root Cause Analysis and 3-Phase Fix Plan

**Severity**: Critical / P0  
**Affected Page**: `src/app/(app)/repair-requests/page.tsx`  
**User Role**: `regional_leader` (primarily), affects all users  
**Status**: Identified, awaiting implementation  
**Created**: 2025-10-10

---

## 📋 Executive Summary

The Repair Requests page crashes or displays inconsistent data when:
1. A `regional_leader` user selects a facility from the filter dropdown
2. Equipment data contains null `thiet_bi` or `facility_name` values
3. Users switch between filtered and unfiltered views repeatedly

**Root causes identified**: 4 critical issues  
**Fix plan**: 3 phases (Immediate hotfix → Medium enhancements → Long-term safety)  
**Estimated effort**: Phase 1 = 2-4 hours, Phase 2 = 1 sprint, Phase 3 = 1 sprint

---

## 🔴 Steps to Reproduce

1. Log in as a `regional_leader` user
2. Navigate to `/repair-requests`
3. Wait for data to load (ensure `yeu_cau_sua_chua` table has records)
4. Open the facility filter dropdown (Building2 icon)
5. Select any facility
6. **Result**: Application crashes/freezes or displays incorrect counts

---

## 🔬 Root Cause Analysis

### Issue #1: Null Safety in useFacilityFilter (CRITICAL)

**Location**: `src/hooks/useFacilityFilter.ts:142`

**Current Code**:
```typescript
return items.filter((it) => (getName(it) || null) === selectedFacilityName)
```

**Problems**:
- Unsafe comparison: `(getName(it) || null)` converts `undefined` to `null` but still attempts equality
- When `selectedFacilityName` is `null` (no filter selected), this matches items with `null` facility names
- Items with `undefined` facility names behave unpredictably

**Evidence**:
- `page.tsx:332` — `getFacilityName: (item) => item.thiet_bi?.facility_name ?? null`
- `page.tsx:422-430` — Data normalization explicitly allows `thiet_bi: null`

**Impact**: Incorrect filtering → empty/wrong results → React Table state corruption

---

### Issue #2: Incorrect Count Calculations (HIGH)

**Location**: `src/app/(app)/repair-requests/page.tsx:1981, 1997`

**Current Code**:
```typescript
// Line 1981
const count = requests.filter(r => r.thiet_bi?.facility_name === facility).length;

// Line 1997
{requests.filter(r => r.thiet_bi?.facility_name === selectedFacility).length} yêu cầu
```

**Problems**:
- Counts computed from `requests` (unfiltered) instead of `tableData` (what's actually displayed)
- Badge shows "10 requests" but table only displays 3 filtered rows
- Mismatch confuses users and can trigger UI logic errors

**Impact**: User confusion, incorrect metrics, potential state corruption when UI logic depends on counts

---

### Issue #3: Accessor Function Null Safety (MEDIUM)

**Location**: `src/app/(app)/repair-requests/page.tsx:1109`

**Current Code**:
```typescript
accessorFn: row => `${row.thiet_bi?.ten_thiet_bi} ${row.mo_ta_su_co}`
```

**Problems**:
- Returns `"undefined undefined"` when `thiet_bi` is null or fields are missing
- React Table uses this for sorting/filtering — string `"undefined"` breaks assumptions
- Poor UX showing literal "undefined" text in cells

**Impact**: Broken sorting, visual bugs, potential downstream errors in search/filter logic

---

### Issue #4: React Table State Corruption (HIGH)

**Location**: `src/app/(app)/repair-requests/page.tsx:1261, 1278`

**Current Code**:
```typescript
// Line 1261
const tableData = showFacilityFilter ? filteredItems : requests;

// Line 1278
const table = useReactTable({ data: tableData, /* ... */ });
```

**Problems**:
- Switching between `filteredItems` and `requests` changes `tableData` identity
- React Table's internal state (selection, page index, sorting) is not reset
- Old row indices point to wrong data or non-existent rows → crash

**Impact**: Crashes on filter toggle, stale selection, invalid pagination

---

## 🎯 3-Phase Fix Plan

### Phase 1: Immediate Hotfix (Today, ~2-4 hours)

**Priority**: P0 — Ship ASAP  
**Scope**: Fix crashes and data consistency issues  
**PR Strategy**: Single atomic PR with all 4 fixes

#### Fix A: Null-Safe Facility Filter

**File**: `src/hooks/useFacilityFilter.ts`  
**Lines**: ~139-143

**Before**:
```typescript
return items.filter((it) => (getName(it) || null) === selectedFacilityName)
```

**After**:
```typescript
const filteredItems = React.useMemo(() => {
  if (!showFacilityFilter) return items
  
  if ((clientOpts as ClientOptionsId<T>).selectBy === 'id') {
    // ... existing id logic
  } else {
    const getName = (clientOpts as ClientOptionsName<T>).getFacilityName
    if (!selectedFacilityName) return items
    
    // CRITICAL FIX: Explicitly handle null/undefined
    return items.filter((it) => {
      const name = getName(it)
      // Exclude items with missing facility info when filtering
      if (name === undefined || name === null) return false
      return name === selectedFacilityName
    })
  }
}, [items, clientOpts, showFacilityFilter, selectedFacilityId, selectedFacilityName])
```

**Rationale**: Items with missing facility data are explicitly excluded during filtering rather than causing comparison errors.

---

#### Fix B: Use Correct Data Source for Counts

**File**: `src/app/(app)/repair-requests/page.tsx`  
**Lines**: 1981, 1997

**Before**:
```typescript
const count = requests.filter(r => r.thiet_bi?.facility_name === facility).length;
```

**After**:
```typescript
const count = tableData.filter(r => r.thiet_bi?.facility_name === facility).length;
```

**Better alternative** (memoized for performance):
```typescript
const facilityCounts = React.useMemo(() => {
  const counts = new Map<string, number>();
  tableData.forEach(r => {
    const facility = r.thiet_bi?.facility_name;
    if (facility) {
      counts.set(facility, (counts.get(facility) || 0) + 1);
    }
  });
  return counts;
}, [tableData]);

// Usage: facilityCounts.get(facility) || 0
```

**Rationale**: Counts must match the data actually rendered to the user.

---

#### Fix C: Safe Accessor Functions

**File**: `src/app/(app)/repair-requests/page.tsx`  
**Line**: 1109

**Before**:
```typescript
accessorFn: row => `${row.thiet_bi?.ten_thiet_bi} ${row.mo_ta_su_co}`
```

**After**:
```typescript
accessorFn: (row) => {
  const parts: string[] = [];
  if (row.thiet_bi?.ten_thiet_bi) {
    parts.push(String(row.thiet_bi.ten_thiet_bi));
  }
  if (row.mo_ta_su_co) {
    parts.push(String(row.mo_ta_su_co));
  }
  return parts.join(' ').trim() || 'N/A';
}
```

**Rationale**: Always returns a valid string, never "undefined" or empty string that breaks sorting.

---

#### Fix D: Reset Table State on Data Changes

**File**: `src/app/(app)/repair-requests/page.tsx`  
**Location**: After line 1261 (tableData definition)

**Add**:
```typescript
// Reset table state when filtered data changes
React.useEffect(() => {
  if (!table) return;
  table.resetRowSelection();
  table.setPageIndex(0);
}, [table, selectedFacilityName, debouncedSearch]);
```

**Optional enhancement** (force remount):
```typescript
// Create stable key for table identity
const tableKey = React.useMemo(() => {
  return `${selectedFacilityName || 'all'}_${debouncedSearch}_${tableData.length}`;
}, [selectedFacilityName, debouncedSearch, tableData.length]);

// In JSX:
<div key={tableKey}>
  {/* table rendering */}
</div>
```

**Rationale**: Prevents React Table from referencing stale row indices when data source changes.

---

### Phase 2: Defensive Enhancements (This Sprint, ~1 week)

**Priority**: P1 — Prevent future crashes  
**Scope**: Add safety nets and debugging tools

#### Enhancement A: Error Boundary

**Create**: `src/components/error-boundary.tsx`

```typescript
"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Dev-only logging
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Đã xảy ra lỗi</CardTitle>
              </div>
              <CardDescription>
                Không thể hiển thị nội dung. Vui lòng thử lại.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Tải lại trang
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Usage in page.tsx**:
```typescript
import { ErrorBoundary } from "@/components/error-boundary"

export default function RepairRequestsPage() {
  // ... existing logic
  
  return (
    <ErrorBoundary>
      {/* existing JSX */}
    </ErrorBoundary>
  )
}
```

---

#### Enhancement B: Validation Logging

**Create**: `src/lib/dev-logger.ts`

```typescript
export const devWarn = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[DEV]', ...args)
  }
}

export const devError = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[DEV]', ...args)
  }
}
```

**Usage in data normalization** (page.tsx ~line 430):
```typescript
import { devWarn } from '@/lib/dev-logger'

const normalized: RepairRequestWithEquipment[] = (data || []).map((row: any) => {
  const result = {
    // ... existing mapping
  }
  
  // Log data quality issues in development
  if (!result.thiet_bi) {
    devWarn('Repair request missing thiet_bi:', { id: result.id })
  } else if (!result.thiet_bi.facility_name) {
    devWarn('Repair request missing facility_name:', { 
      id: result.id, 
      equipment_id: result.thiet_bi_id 
    })
  }
  
  return result
})
```

---

### Phase 3: Long-Term Safety (Next Sprint, ~1-2 weeks)

**Priority**: P2 — Prevent at database level  
**Scope**: Database constraints + runtime validation

#### Safety A: Database Constraint

**Create**: `supabase/migrations/101020250940_enforce_equipment_facility_constraint.sql`

```sql
-- Migration: Enforce NOT NULL on thiet_bi.don_vi
-- Date: 2025-10-10
-- Purpose: Ensure all equipment has a facility assigned
-- Dependencies: Must backfill null don_vi values first
-- MANUAL REVIEW REQUIRED - DO NOT AUTO-APPLY

BEGIN;

-- Check for existing nulls
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM thiet_bi WHERE don_vi IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: thiet_bi table has % rows with don_vi IS NULL. Backfill first.',
      (SELECT COUNT(*) FROM thiet_bi WHERE don_vi IS NULL);
  END IF;
END
$$;

-- Add NOT NULL constraint
ALTER TABLE thiet_bi
  ALTER COLUMN don_vi SET NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN thiet_bi.don_vi IS 
  'Facility ID (required). Every equipment must be assigned to a facility for proper tracking and filtering.';

COMMIT;
```

**Pre-migration backfill script** (run manually first):
```sql
-- Create default facility if needed
INSERT INTO don_vi (name, dia_ban)
VALUES ('Chưa phân công', 'default')
ON CONFLICT (name) DO NOTHING;

-- Backfill null values
UPDATE thiet_bi
SET don_vi = (SELECT id FROM don_vi WHERE name = 'Chưa phân công' LIMIT 1)
WHERE don_vi IS NULL;

-- Verify
SELECT COUNT(*) FROM thiet_bi WHERE don_vi IS NULL;
-- Should return 0
```

---

#### Safety B: Runtime Type Validation with Zod

**Create**: `src/types/repair.ts`

```typescript
import { z } from 'zod'

export const RepairRequestEquipmentSchema = z.object({
  ten_thiet_bi: z.string().min(1),
  ma_thiet_bi: z.string().min(1),
  model: z.string().nullable(),
  serial: z.string().nullable(),
  khoa_phong_quan_ly: z.string().nullable(),
  facility_name: z.string().min(1), // Required!
  facility_id: z.number().positive(),
})

export const RepairRequestSchema = z.object({
  id: z.number(),
  thiet_bi_id: z.number(),
  ngay_yeu_cau: z.string(),
  trang_thai: z.string(),
  mo_ta_su_co: z.string(),
  hang_muc_sua_chua: z.string().nullable(),
  ngay_mong_muon_hoan_thanh: z.string().nullable(),
  nguoi_yeu_cau: z.string().nullable(),
  ngay_duyet: z.string().nullable(),
  ngay_hoan_thanh: z.string().nullable(),
  nguoi_duyet: z.string().nullable(),
  nguoi_xac_nhan: z.string().nullable(),
  don_vi_thuc_hien: z.enum(['noi_bo', 'thue_ngoai']).nullable(),
  ten_don_vi_thue: z.string().nullable(),
  ket_qua_sua_chua: z.string().nullable(),
  ly_do_khong_hoan_thanh: z.string().nullable(),
  thiet_bi: RepairRequestEquipmentSchema.nullable(),
})

export type RepairRequestWithEquipment = z.infer<typeof RepairRequestSchema>

export const RepairRequestArraySchema = z.array(RepairRequestSchema)
```

**Usage in page.tsx**:
```typescript
import { RepairRequestArraySchema } from '@/types/repair'
import { devError } from '@/lib/dev-logger'

// After fetching data
const parseResult = RepairRequestArraySchema.safeParse(data)

if (!parseResult.success) {
  devError('Invalid repair requests data:', parseResult.error.format())
  setRequests([]) // Fail safe
} else {
  setRequests(parseResult.data)
}
```

---

## ✅ Testing Checklist

### Unit Tests

- [ ] `useFacilityFilter` returns all items when `selectedFacilityName` is null
- [ ] `useFacilityFilter` excludes items with null `facility_name` when filter is active
- [ ] `useFacilityFilter` performs case-insensitive matching
- [ ] Accessor function never returns "undefined" string
- [ ] Count calculations match filtered dataset
- [ ] Zod validation catches invalid data shapes

### Integration Tests

- [ ] Switching facilities resets table selection
- [ ] Switching facilities resets to page 1
- [ ] Counts in badges match visible rows
- [ ] Search + facility filter work together correctly
- [ ] Status filter + facility filter work together correctly
- [ ] No console errors when filtering with null data
- [ ] ErrorBoundary catches and displays fallback UI

### Role-Based Tests

- [ ] `regional_leader` can view all facilities in their region
- [ ] `regional_leader` cannot perform write operations
- [ ] `global` sees all facilities
- [ ] Facility counts respect role-based data access

### Performance Tests

- [ ] Page remains responsive with 5000+ requests
- [ ] Filtering completes in <200ms
- [ ] No memory leaks after 50 filter toggles

### Manual QA

- [ ] Test on Chrome, Firefox, Edge
- [ ] Test on mobile viewport
- [ ] Test with real production data sample
- [ ] Verify no "undefined" text visible anywhere
- [ ] Verify all tooltips and labels are correct

---

## 📊 Impact Assessment

### Severity: **CRITICAL (P0)**

**User Impact**:
- Blocks `regional_leader` users from using facility filter feature
- Causes data inconsistency confusion for all users
- Potential data loss if crashes occur during form submission

**Business Impact**:
- Core feature unusable for an entire user role
- Damages user trust in system accuracy
- Support tickets and manual workarounds required

**Affected Users**:
- All `regional_leader` users (primary)
- All users viewing filtered data (secondary)
- Estimated 30-40% of active users

### Risk Assessment

**Phase 1 Changes**:
- **Risk Level**: Low
- **Reasoning**: Localized changes, defensive coding, no schema/auth changes
- **Rollback**: Simple PR revert

**Phase 2 Changes**:
- **Risk Level**: Very Low
- **Reasoning**: Additive only (ErrorBoundary), dev-only logging
- **Rollback**: Remove ErrorBoundary wrapper

**Phase 3 Changes**:
- **Risk Level**: Medium
- **Reasoning**: Database constraint could block inserts if backfill missed rows
- **Mitigation**: Manual pre-check, transaction-wrapped, reversible
- **Rollback**: `ALTER TABLE thiet_bi ALTER COLUMN don_vi DROP NOT NULL`

---

## 🛡️ Prevention Strategies

### Immediate (With Phase 1)
1. Add accessor function linting rule: must return string, never undefined
2. Add count calculation rule: must use tableData, not unfiltered arrays
3. Document safe filter patterns in project wiki

### Medium Term (With Phase 2)
1. Add integration tests for all filter combinations
2. Create test datasets with edge cases (nulls, empty strings, special chars)
3. Add performance benchmarks to CI

### Long Term (With Phase 3)
1. Adopt Zod for all API boundaries
2. Create shared utilities: `normalizeString`, `safeAccessor`, `safeCount`
3. Add TypeScript ESLint rules: no implicit any, strict null checks
4. Database: Add foreign key constraints on all facility relationships

---

## 📝 Implementation Plan

### Timeline

| Phase | Duration | Start Date | Reviewer | QA Required |
|-------|----------|------------|----------|-------------|
| Phase 1 | 2-4 hours | Today | Frontend Lead | Yes (smoke test) |
| Phase 2 | 3-5 days | This week | Frontend + QA Lead | Yes (full regression) |
| Phase 3 | 1-2 weeks | Next sprint | Backend + DBA | Yes (data validation) |

### Ownership

- **Developer**: @thienchi2109
- **Reviewer**: Frontend Team Lead
- **QA**: QA Team
- **DBA Review**: For Phase 3 migration only

### Deployment Strategy

**Phase 1**: 
- Single PR, fast-tracked review
- Deploy to staging → QA smoke test → Production hotfix
- Monitor error rates and user complaints for 24h

**Phase 2**:
- Standard PR review process
- Deploy to staging → Full regression → Production
- Feature flag for ErrorBoundary (can disable if issues arise)

**Phase 3**:
- Migration reviewed by DBA
- Backfill script run manually in maintenance window
- Constraint added in separate maintenance window
- Monitor for constraint violations

---

## 📚 References

### Code Evidence
- `src/hooks/useFacilityFilter.ts:142` — Filter logic
- `src/app/(app)/repair-requests/page.tsx:332` — getFacilityName definition
- `src/app/(app)/repair-requests/page.tsx:422-430` — Data normalization
- `src/app/(app)/repair-requests/page.tsx:1109` — Accessor function
- `src/app/(app)/repair-requests/page.tsx:1261, 1278` — Table data switch
- `src/app/(app)/repair-requests/page.tsx:1981, 1997` — Count calculations

### External Resources
- [React Table v8 Docs](https://tanstack.com/table/v8) — State management
- [Zod Documentation](https://zod.dev/) — Runtime validation
- [Error Boundaries in React](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

### Project Conventions
- No `console.log` in production (use dev-only logger)
- TypeScript strict mode (no `any`)
- File structure: follow established patterns
- Import hierarchy: `@/*` aliases only

---

## ✨ Acceptance Criteria

**Phase 1 Success Metrics**:
- [ ] Zero crashes when selecting facilities
- [ ] Counts match visible rows in all scenarios
- [ ] No "undefined" strings visible in UI
- [ ] Table state resets correctly on filter changes
- [ ] All existing tests pass
- [ ] New unit tests added and passing

**Phase 2 Success Metrics**:
- [ ] ErrorBoundary catches all component errors
- [ ] Dev logging identifies data quality issues
- [ ] No production console output
- [ ] Performance unchanged (< 5ms regression)

**Phase 3 Success Metrics**:
- [ ] Database constraint active
- [ ] Zero rows with null `don_vi`
- [ ] Zod validation integrated
- [ ] All data passes schema validation
- [ ] No constraint violation errors in logs

---

## 🏷️ Labels

`bug` `critical` `p0` `regional-leader` `facility-filter` `react-table` `data-quality` `needs-review`

---

**Issue Created**: 2025-10-10  
**Reporter**: Development Team  
**Assignee**: @thienchi2109  
**Sprint**: Current (Hotfix)  
**Epic**: Data Quality & Stability
