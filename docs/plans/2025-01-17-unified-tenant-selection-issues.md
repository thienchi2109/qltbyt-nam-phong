# Unified Tenant Selection - Beads Issues Structure

## Overview

This document defines the Beads issue structure for implementing the Unified Tenant Selection System as outlined in `2025-01-17-unified-tenant-selection.md`.

**Total Issues:** 11 (1 epic + 10 tasks)

---

## Epic

| Field | Value |
|-------|-------|
| **Title** | [Epic] Unified Tenant Selection System |
| **Type** | epic |
| **Priority** | P1 |
| **Label** | unified-tenant |
| **Dependencies** | None |

**Description:**
Create a centralized React Context for tenant/facility selection that provides consistent UX for global and regional_leader users across all protected pages.

---

## Phase 1: Core Infrastructure (P1, Sequential)

### Task 1.1: Create RPC `get_accessible_facilities`

| Field | Value |
|-------|-------|
| **Title** | Create RPC function get_accessible_facilities |
| **Type** | task |
| **Priority** | P1 |
| **Label** | unified-tenant |
| **Dependencies** | None (first task) |

**Description:**
- Create `supabase/migrations/YYYYMMDD_get_accessible_facilities.sql`
- Returns JSONB array of `{id, name}` objects
- Global users: ALL active facilities
- Regional leaders: Only facilities in their region via `allowed_don_vi_for_session_safe()`
- Add function to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
- Grant execute to authenticated role

**Verification:**
- [ ] Function created successfully
- [ ] Added to ALLOWED_FUNCTIONS
- [ ] Returns correct facilities for each role

---

### Task 1.2: Create TenantSelectionContext

| Field | Value |
|-------|-------|
| **Title** | Create TenantSelectionContext with React Context |
| **Type** | task |
| **Priority** | P1 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.1 |

**Description:**
- Create `src/contexts/TenantSelectionContext.tsx`
- Create `src/types/tenant.ts` for consolidated types
- Context shape: `{ selectedFacilityId, setSelectedFacilityId, facilities, showSelector, isLoading, shouldFetchData }`
- Use TanStack Query with proper query key scoping: `["accessible_facilities", { role, diaBan }]`
- Stable setter via `useCallback`
- SessionStorage persistence for page refresh
- `useMemo` on context value to prevent re-renders

**Verification:**
- [ ] No TypeScript errors
- [ ] Context provides all required values
- [ ] useMemo prevents unnecessary re-renders

---

### Task 1.3: Create shared TenantSelector component

| Field | Value |
|-------|-------|
| **Title** | Create shared TenantSelector component |
| **Type** | task |
| **Priority** | P1 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.2 |

**Description:**
- Create `src/components/shared/TenantSelector.tsx`
- Adapt from existing `src/components/equipment/tenant-selector.tsx`
- Use `useTenantSelection()` hook instead of props
- Searchable dropdown with facility list
- Shows "Select facility" prompt when none selected

**Verification:**
- [ ] Component renders correctly
- [ ] Selection updates context
- [ ] Shows "Select facility" prompt when none selected

---

### Task 1.4: Add provider to app layout

| Field | Value |
|-------|-------|
| **Title** | Add TenantSelectionProvider to app layout |
| **Type** | task |
| **Priority** | P1 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.3 |

**Description:**
- Modify `src/app/(app)/layout.tsx`
- Wrap children with `TenantSelectionProvider` inside SessionProvider
- Ensure no hydration errors

**Verification:**
- [ ] No hydration errors
- [ ] Context available in all protected pages
- [ ] `npm run typecheck` passes

---

## Phase 2: Page Migrations (P2, Parallel after Phase 1)

All Phase 2 tasks depend on Task 1.4 but can run in parallel with each other.

### Task 2.1: Migrate RepairRequests page

| Field | Value |
|-------|-------|
| **Title** | Migrate RepairRequests page to unified tenant |
| **Type** | task |
| **Priority** | P2 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.4 |

**Description:**
- Modify `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx`
- Replace `useFacilityFilter` with `useTenantSelection()`
- Use `shouldFetchData` to gate queries
- Render `<TenantSelector />` in CardHeader
- Remove inline `<Select>` for facility

**Verification:**
- [ ] Page loads without errors
- [ ] Facility selector appears for global/regional users
- [ ] Data fetches only after facility selected
- [ ] Selection persists when navigating away and back

---

### Task 2.2: Migrate Transfers page

| Field | Value |
|-------|-------|
| **Title** | Migrate Transfers page to unified tenant |
| **Type** | task |
| **Priority** | P2 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.4 |

**Description:**
- Modify `src/app/(app)/transfers/page.tsx`
- Same pattern as RepairRequests migration

**Verification:**
- [ ] Same checks as Task 2.1

---

### Task 2.3: Migrate Reports page

| Field | Value |
|-------|-------|
| **Title** | Migrate Reports page to unified tenant |
| **Type** | task |
| **Priority** | P2 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.4 |

**Description:**
- Modify `src/app/(app)/reports/page.tsx`
- Same pattern as RepairRequests migration

**Verification:**
- [ ] Same checks as Task 2.1

---

### Task 2.4: Migrate Equipment page

| Field | Value |
|-------|-------|
| **Title** | Migrate Equipment page to unified tenant |
| **Type** | task |
| **Priority** | P2 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.4 |

**Description:**
- Modify `src/app/(app)/equipment/_hooks/useEquipmentData.ts`
- Modify `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts`
- Replace `useEquipmentAuth` tenant logic with `useTenantSelection()`
- Keep Equipment-specific auth logic separate
- Replace `TenantSelector` import path
- Remove localStorage usage (context handles session persistence)

**Verification:**
- [ ] Equipment page loads without errors
- [ ] Facility selection works
- [ ] No localStorage usage for tenant
- [ ] Navigating to RepairRequests keeps same facility selected

---

### Task 2.5: Migrate Dashboard page

| Field | Value |
|-------|-------|
| **Title** | Migrate Dashboard page to unified tenant |
| **Type** | task |
| **Priority** | P2 |
| **Label** | unified-tenant |
| **Dependencies** | Task 1.4 |

**Description:**
- Modify `src/app/(app)/dashboard/page.tsx`
- Add facility selector for global/regional users
- Gate data fetching until facility selected

**Verification:**
- [ ] Dashboard loads without errors
- [ ] Facility selector appears for global/regional users
- [ ] Data fetches only after facility selected
- [ ] Selection persists when navigating away and back

---

## Phase 3: Cleanup (P3, After All Phase 2)

### Task 3.1: Deprecate and delete old hooks

| Field | Value |
|-------|-------|
| **Title** | Deprecate and delete old tenant hooks |
| **Type** | task |
| **Priority** | P3 |
| **Label** | unified-tenant |
| **Dependencies** | Tasks 2.1, 2.2, 2.3, 2.4, 2.5 |

**Description:**
- Delete `src/hooks/useFacilityFilter.ts`
- Remove tenant parts from `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts`
- Verify no remaining imports of old hooks
- Run full build verification

**Verification:**
- [ ] No remaining imports of old hooks
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │ [Epic]          │
                    │ Unified Tenant  │
                    │ Selection       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │ Phase 1 │   │ Phase 2 │   │ Phase 3 │
        │ (P1)    │   │ (P2)    │   │ (P3)    │
        └────┬────┘   └────┬────┘   └────┬────┘
             │              │              │
     ┌───────┴───────┐      │              │
     │               │      │              │
┌────┴────┐    ┌─────┴─────┐│              │
│ Task 1.1│───▶│ Task 1.2  ││              │
│ RPC fn  │    │ Context   ││              │
└─────────┘    └─────┬─────┘│              │
                     │      │              │
               ┌─────┴─────┐│              │
               │ Task 1.3  ││              │
               │ Component ││              │
               └─────┬─────┘│              │
                     │      │              │
               ┌─────┴─────┐│              │
               │ Task 1.4  │◀──────────────┘
               │ Provider  │               │
               └─────┬─────┘               │
                     │                     │
     ┌───────┬───────┼───────┬───────┐     │
     │       │       │       │       │     │
     ▼       ▼       ▼       ▼       ▼     │
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│Task 2.1││Task 2.2││Task 2.3││Task 2.4││Task 2.5│
│Repair  ││Transfer││Reports ││Equipmt ││Dashbrd │
└────┬───┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘
     │         │         │         │         │
     └─────────┴─────────┴─────────┴─────────┘
                         │
                         ▼
                   ┌───────────┐
                   │ Task 3.1  │
                   │ Cleanup   │
                   └───────────┘
```

---

## Beads Commands (for reference)

```powershell
# Create epic
bd create --title="[Epic] Unified Tenant Selection System" --type=epic --priority=1 --label=unified-tenant

# Phase 1 tasks (sequential)
bd create --title="Create RPC function get_accessible_facilities" --type=task --priority=1 --label=unified-tenant
bd create --title="Create TenantSelectionContext with React Context" --type=task --priority=1 --label=unified-tenant
bd create --title="Create shared TenantSelector component" --type=task --priority=1 --label=unified-tenant
bd create --title="Add TenantSelectionProvider to app layout" --type=task --priority=1 --label=unified-tenant

# Phase 2 tasks (parallel after Phase 1)
bd create --title="Migrate RepairRequests page to unified tenant" --type=task --priority=2 --label=unified-tenant
bd create --title="Migrate Transfers page to unified tenant" --type=task --priority=2 --label=unified-tenant
bd create --title="Migrate Reports page to unified tenant" --type=task --priority=2 --label=unified-tenant
bd create --title="Migrate Equipment page to unified tenant" --type=task --priority=2 --label=unified-tenant
bd create --title="Migrate Dashboard page to unified tenant" --type=task --priority=2 --label=unified-tenant

# Phase 3 task (after all Phase 2)
bd create --title="Deprecate and delete old tenant hooks" --type=task --priority=3 --label=unified-tenant

# Add dependencies (after getting issue IDs)
# Phase 1 sequential chain
bd dep add <1.2-id> <1.1-id>
bd dep add <1.3-id> <1.2-id>
bd dep add <1.4-id> <1.3-id>

# Phase 2 depends on Phase 1 completion
bd dep add <2.1-id> <1.4-id>
bd dep add <2.2-id> <1.4-id>
bd dep add <2.3-id> <1.4-id>
bd dep add <2.4-id> <1.4-id>
bd dep add <2.5-id> <1.4-id>

# Phase 3 depends on all Phase 2
bd dep add <3.1-id> <2.1-id>
bd dep add <3.1-id> <2.2-id>
bd dep add <3.1-id> <2.3-id>
bd dep add <3.1-id> <2.4-id>
bd dep add <3.1-id> <2.5-id>
```

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
