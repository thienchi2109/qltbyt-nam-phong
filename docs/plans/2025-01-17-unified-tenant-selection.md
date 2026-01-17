# Unified Tenant Selection System

## Summary

Create a centralized React Context for tenant/facility selection that provides consistent UX for global and regional_leader users across all protected pages.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence | Session-wide React Context | Single source of truth, no prop drilling |
| Provider location | `app/(app)/layout.tsx` inside SessionProvider | Available to all protected routes, has auth context |
| Context shape | Minimal: `{ selectedFacilityId, setSelectedFacilityId, facilities, showSelector }` | Simple API, YAGNI |
| Facility source | New lightweight RPC `get_accessible_facilities` | Clean, ~1-2KB response |
| UI component | Single shared `<TenantSelector />` | Consistent UX everywhere |
| Placement | Page header (each page renders it) | Contextual, pages control visibility |
| Migration | Incremental page-by-page | Safer rollout, validate each step |
| Default behavior | Force selection before data fetch | Better performance, clear intent |

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### Task 1.1: Create RPC function `get_accessible_facilities`

**File:** `supabase/migrations/YYYYMMDD_get_accessible_facilities.sql`

```sql
CREATE OR REPLACE FUNCTION get_accessible_facilities()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  -- Get JWT claims safely
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Global users: Return ALL active facilities
  IF v_role = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object('id', dv.id, 'name', dv.name)
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    WHERE dv.active IS NOT FALSE;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  -- Regional leaders: Return facilities in their region
  IF v_role = 'regional_leader' THEN
    IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
      RETURN '[]'::jsonb;
    END IF;
    
    SELECT jsonb_agg(
      jsonb_build_object('id', dv.id, 'name', dv.name)
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    WHERE dv.id = ANY(v_allowed_don_vi)
      AND dv.active IS NOT FALSE;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  RETURN '[]'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION get_accessible_facilities TO authenticated;
```

**Verification:**
- [ ] Function created successfully
- [ ] Added to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
- [ ] Returns correct facilities for each role

---

#### Task 1.2: Create TenantSelectionContext

**File:** `src/contexts/TenantSelectionContext.tsx`

```typescript
"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"

export type FacilityOption = {
  id: number
  name: string
  count?: number  // Optional - not all RPCs return count
}

export type TenantRole = 'global' | 'admin' | 'regional_leader' | 'to_qltb' | 'user'

export function isPrivilegedRole(role: string): boolean {
  return ['global', 'admin', 'regional_leader'].includes(role?.toLowerCase())
}

type TenantSelectionContextValue = {
  selectedFacilityId: number | null
  setSelectedFacilityId: (id: number | null) => void
  facilities: FacilityOption[]
  showSelector: boolean
  isLoading: boolean
  shouldFetchData: boolean // true when selection made (or non-global user)
}

const TenantSelectionContext = React.createContext<TenantSelectionContextValue | null>(null)

export function TenantSelectionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const user = session?.user

  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"
  const showSelector = isGlobal || isRegionalLeader

  const [selectedFacilityId, setSelectedFacilityIdState] = React.useState<number | null>(null)

  // Fetch facilities for global/regional users
  const setSelectedFacilityId = React.useCallback((id: number | null) => {
    setSelectedFacilityIdState(id)
    // Optional: persist to sessionStorage for page refresh
    if (id !== null) {
      sessionStorage.setItem('selectedFacilityId', String(id))
    } else {
      sessionStorage.removeItem('selectedFacilityId')
    }
  }, [])

  const { data: facilities = [], isLoading } = useQuery<FacilityOption[]>({
    queryKey: ["accessible_facilities", { role: user?.role, diaBan: user?.dia_ban_id }],
    queryFn: () => callRpc({ fn: "get_accessible_facilities", args: {} }),
    enabled: status === "authenticated" && showSelector,
    staleTime: 5 * 60_000, // 5 minutes
  })

  // Non-global users can always fetch (server enforces their don_vi)
  // Global/regional must select first
  const shouldFetchData = React.useMemo(() => {
    if (!showSelector) return true
    return selectedFacilityId !== null
  }, [showSelector, selectedFacilityId])

  const value = React.useMemo<TenantSelectionContextValue>(() => ({
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    showSelector,
    isLoading,
    shouldFetchData,
  }), [selectedFacilityId, facilities, showSelector, isLoading, shouldFetchData])

  return (
    <TenantSelectionContext.Provider value={value}>
      {children}
    </TenantSelectionContext.Provider>
  )
}

export function useTenantSelection() {
  const context = React.useContext(TenantSelectionContext)
  if (!context) {
    throw new Error("useTenantSelection must be used within TenantSelectionProvider")
  }
  return context
}
```

**Verification:**
- [ ] No TypeScript errors
- [ ] Context provides all required values
- [ ] useMemo prevents unnecessary re-renders

---

#### Task 1.3: Create shared TenantSelector component

**File:** `src/components/shared/TenantSelector.tsx`

Adapt from existing `src/components/equipment/tenant-selector.tsx` but:
- Use `useTenantSelection()` hook instead of props
- Simplify to match minimal context shape
- Keep searchable dropdown with facility list

**Verification:**
- [ ] Component renders correctly
- [ ] Selection updates context
- [ ] Shows "Select facility" prompt when none selected

---

#### Task 1.4: Add provider to app layout

**File:** `src/app/(app)/layout.tsx`

Wrap children with `TenantSelectionProvider` inside SessionProvider.

**Verification:**
- [ ] No hydration errors
- [ ] Context available in all protected pages
- [ ] `npm run typecheck` passes

---

### Phase 2: Page Migrations

#### Task 2.1: Migrate RepairRequests page

**File:** `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx`

Changes:
1. Replace `useFacilityFilter` with `useTenantSelection()`
2. Use `shouldFetchData` to gate queries
3. Render `<TenantSelector />` in CardHeader
4. Remove inline `<Select>` for facility

**Verification:**
- [ ] Page loads without errors
- [ ] Facility selector appears for global/regional users
- [ ] Data fetches only after facility selected
- [ ] Selection persists when navigating away and back

---

#### Task 2.2: Migrate Transfers page

**File:** `src/app/(app)/transfers/page.tsx`

Same pattern as RepairRequests.

**Verification:**
- [ ] Same checks as Task 2.1

---

#### Task 2.3: Migrate Reports page

**File:** `src/app/(app)/reports/page.tsx`

Same pattern as RepairRequests.

**Verification:**
- [ ] Same checks as Task 2.1

---

#### Task 2.4: Migrate Equipment page

**File:** `src/app/(app)/equipment/` (multiple files)

This is more complex - current `useEquipmentAuth` has:
- localStorage persistence (remove - context handles session persistence)
- Additional auth logic (keep role checks, move to context if shared)

Changes:
1. Replace `useEquipmentAuth` tenant logic with `useTenantSelection()`
2. Keep Equipment-specific auth logic separate
3. Update `useEquipmentData` to use context
4. Replace `TenantSelector` import path

**Verification:**
- [ ] Equipment page loads without errors
- [ ] Facility selection works
- [ ] No localStorage usage for tenant (context is session-wide)
- [ ] Navigating to RepairRequests keeps same facility selected

---

#### Task 2.5: Migrate Dashboard page

**File:** `src/app/(app)/dashboard/page.tsx`

**Verification:**
- [ ] Dashboard loads without errors
- [ ] Facility selector appears for global/regional users
- [ ] Data fetches only after facility selected
- [ ] Selection persists when navigating away and back

---

### Phase 3: Cleanup

#### Task 3.1: Deprecate old hooks

1. Add deprecation comments to:
   - `src/hooks/useFacilityFilter.ts`
   - `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts` (tenant parts)

2. After all migrations verified, delete unused code

**Verification:**
- [ ] No remaining imports of old hooks
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Verification Checklist

### Functional Tests
- [ ] Global user sees facility selector on all pages
- [ ] Regional leader sees only their region's facilities
- [ ] Regular user sees no selector
- [ ] Selection persists across page navigation
- [ ] Data only fetches after facility selected (for global/regional)
- [ ] Selecting "null" shows all facilities data

### Performance Tests
- [ ] No unnecessary re-renders when navigating
- [ ] Facilities query cached (5 min stale time)
- [ ] Bundle size not significantly increased

### Security Tests
- [ ] Non-global users cannot select arbitrary facilities
- [ ] API enforces tenant isolation regardless of client selection

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_get_accessible_facilities.sql` |
| CREATE | `src/contexts/TenantSelectionContext.tsx` |
| CREATE | `src/components/shared/TenantSelector.tsx` |
| CREATE | `src/types/tenant.ts` |
| MODIFY | `src/app/api/rpc/[fn]/route.ts` (add to allowed functions) |
| MODIFY | `src/app/(app)/layout.tsx` (add provider) |
| MODIFY | `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` |
| MODIFY | `src/app/(app)/transfers/page.tsx` |
| MODIFY | `src/app/(app)/reports/page.tsx` |
| MODIFY | `src/app/(app)/equipment/_hooks/useEquipmentData.ts` |
| MODIFY | `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts` |
| MODIFY | `src/app/(app)/dashboard/page.tsx` |
| DELETE | `src/hooks/useFacilityFilter.ts` (after migration) |

---

## Refactoring Analysis

### Type Consolidation Required

**Problem:** 3 duplicate `FacilityOption` definitions with inconsistent shapes:

| File | `count` | `code` |
|------|---------|--------|
| `src/lib/equipment-utils.ts` | required | optional |
| `src/hooks/useFacilityFilter.ts` | optional | - |
| `src/app/(app)/equipment/types.ts` | required | - |

**Solution:** Create canonical type at `src/types/tenant.ts`:

```typescript
// src/types/tenant.ts
export interface FacilityOption {
  id: number
  name: string
  count?: number  // Optional - not all RPCs return count
}

export type TenantRole = 'global' | 'admin' | 'regional_leader' | 'to_qltb' | 'user'

export function isPrivilegedRole(role: string): boolean {
  return ['global', 'admin', 'regional_leader'].includes(role?.toLowerCase())
}
```

### Code Duplication to Eliminate

| Duplication | Current Files | Consolidated Location |
|-------------|---------------|----------------------|
| Role checking | `useFacilityFilter`, `useEquipmentAuth` | `TenantSelectionContext` |
| Facility filtering | Both hooks | Context handles |
| `FacilityOption` type | 3 files | `src/types/tenant.ts` |

### Best Practices Violations to Fix

| Issue | Fix |
|-------|-----|
| `any` type in useFacilityFilter | Use proper discriminated union |
| eslint-disable comment | Fix dependency array |
| localStorage in useState init | Move to useEffect |
| Custom 180-line dropdown | Use Radix Select (~30 lines) |

---

## Critical Fixes from Agent Reviews

### Backend Architect Fixes

1. **JWT claim key:** Use `dia_ban` not `dia_ban_id`
2. **Column name:** Use `dv.name` not `dv.ten_don_vi`
3. **Helper function:** Use `allowed_don_vi_for_session_safe()`
4. **Return type:** Use `JSONB` not `TABLE`

**Revised RPC Function:**

```sql
CREATE OR REPLACE FUNCTION public.get_accessible_facilities()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  -- Get JWT claims safely
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Global users: Return ALL active facilities
  IF v_role = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object('id', dv.id, 'name', dv.name)
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    WHERE dv.active IS NOT FALSE;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  -- Regional leaders: Return facilities in their region
  IF v_role = 'regional_leader' THEN
    IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
      RETURN '[]'::jsonb;
    END IF;
    
    SELECT jsonb_agg(
      jsonb_build_object('id', dv.id, 'name', dv.name)
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    WHERE dv.id = ANY(v_allowed_don_vi)
      AND dv.active IS NOT FALSE;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  RETURN '[]'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_accessible_facilities TO authenticated;
```

### Frontend Developer Fixes

1. **Query key scoping:** Include role and region for cache isolation
2. **Stable setter:** Wrap `setSelectedFacilityId` in `useCallback`
3. **Simplified component:** Use Radix Select instead of custom dropdown

**Revised Context with useCallback:**

```typescript
const setSelectedFacilityId = React.useCallback((id: number | null) => {
  setSelectedFacilityIdState(id)
  // Optional: persist to sessionStorage for page refresh
  if (id !== null) {
    sessionStorage.setItem('selectedFacilityId', String(id))
  } else {
    sessionStorage.removeItem('selectedFacilityId')
  }
}, [])

// Query with proper scoping
const { data: facilities = [] } = useQuery<FacilityOption[]>({
  queryKey: ["accessible_facilities", { role: user?.role, diaBan: user?.dia_ban_id }],
  // ...
})
```

### Code Reviewer Fixes

1. **Add Dashboard migration** - Task 2.5 added
2. **Rollback plan** - Create git tags before each phase
3. **Tests required** - Unit tests for context and component
4. **"All Facilities" clarity** - `null` means "not selected", add explicit "all" handling

---

## Rollback Plan

```bash
# Before Phase 1
git tag pre-unified-tenant-phase-1

# Before Phase 2
git tag pre-unified-tenant-phase-2

# Before Phase 3
git tag pre-unified-tenant-phase-3

# If rollback needed
git revert HEAD~N  # or reset to tag
```

**SQL Rollback:**
```sql
DROP FUNCTION IF EXISTS get_accessible_facilities();
```

---

## Testing Requirements

### Unit Tests (Before Implementation)

```
src/contexts/__tests__/TenantSelectionContext.test.tsx
├── throws error outside provider
├── shows selector for global users
├── hides selector for regular users
├── shouldFetchData false until selection
└── shouldFetchData true for non-global users

src/components/shared/__tests__/TenantSelector.test.tsx
├── renders facility list
├── filters by search
├── calls onChange on selection
└── shows empty state
```

### Integration Tests (After Migration)

```
src/app/(app)/__tests__/tenant-selection.integration.test.tsx
├── selection persists across page navigation
├── data fetches only after selection
└── regional_leader sees only their facilities
```
