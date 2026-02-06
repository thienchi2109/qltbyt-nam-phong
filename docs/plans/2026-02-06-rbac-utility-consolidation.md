# Plan: Consolidate Duplicated RBAC Role Check Patterns

## Problem Statement

Code review finding: Role check pattern `(global || admin || to_qltb)` is duplicated in 48+ files across the codebase. This violates DRY and makes RBAC logic hard to maintain.

## Current State

### Duplicated Patterns Found

| Pattern | Roles | Occurrences | Example |
|---------|-------|-------------|---------|
| Equipment manager check | `global \| admin \| to_qltb` | 7+ files | `DeviceQuotaSubNav.tsx:54` |
| Global user check | `global \| admin` | 12+ files | `add-equipment-dialog.tsx:87` |
| Regional leader check | `regional_leader` | 13+ files | `useTransferActions.ts:47` |
| Dept-scoped check | `technician \| qltb_khoa` | Implicit | Multiple contexts |

### Existing Infrastructure (Underutilized)

- `src/types/tenant.ts` has `isPrivilegedRole()` checking `global|admin|regional_leader`
- `src/lib/department-utils.ts` has `shouldBypassDepartmentFilter()` checking `admin|to_qltb`

---

## Solution: Minimal Utility Functions

Create `src/lib/rbac.ts` with focused utility functions matching actual usage patterns.

### New File: `src/lib/rbac.ts`

```typescript
/**
 * RBAC Utility Functions
 * Centralizes role check logic to eliminate duplication across 48+ files.
 *
 * Usage: import { isGlobalRole, isEquipmentManagerRole } from '@/lib/rbac'
 */

/**
 * System administrator check (global or legacy admin alias)
 * Use for: tenant management, user management, audit logs, full system access
 */
export function isGlobalRole(role: string | null | undefined): boolean {
  if (!role) return false
  const normalized = role.toLowerCase()
  return normalized === 'global' || normalized === 'admin'
}

/**
 * Regional leader check (read-only multi-tenant access)
 * Use for: restricting write operations, regional data filtering
 */
export function isRegionalLeaderRole(role: string | null | undefined): boolean {
  if (!role) return false
  return role.toLowerCase() === 'regional_leader'
}

/**
 * Equipment manager check (equipment team + admins)
 * Use for: equipment CRUD, bulk import, repairs, transfers, maintenance plans
 * This is the most commonly duplicated pattern (7+ files)
 */
export function isEquipmentManagerRole(role: string | null | undefined): boolean {
  if (!role) return false
  const normalized = role.toLowerCase()
  return normalized === 'global' || normalized === 'admin' || normalized === 'to_qltb'
}

/**
 * Department-scoped role check
 * Use for: determining if user needs khoa_phong filtering
 */
export function isDeptScopedRole(role: string | null | undefined): boolean {
  if (!role) return false
  const normalized = role.toLowerCase()
  return normalized === 'technician' || normalized === 'qltb_khoa'
}

/**
 * Multi-tenant selection privilege check
 * Re-exported from tenant.ts for convenience
 */
export { isPrivilegedRole } from '@/types/tenant'
```

---

## Files to Update (Complete List - 30 files)

### Priority 0: BUG FIX - Incorrect Role Checks (2 files)

**CRITICAL**: These files check `role !== 'admin'` which is incorrect since `admin` is just an alias for `global`. Should use `isGlobalRole()`.

| File | Line | Current (BROKEN) | Fix With |
|------|------|------------------|----------|
| `src/components/performance-dashboard.tsx` | 41 | `role !== 'admin'` | `!isGlobalRole(user?.role)` |
| `src/components/admin/user-management.tsx` | 40, 178 | `role !== 'admin'` | `!isGlobalRole(user?.role)` |

### Priority 1: High-Impact Hooks (4 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/hooks/useTransferActions.ts` | 47-49 | triple OR + regional | `isEquipmentManagerRole`, `isRegionalLeaderRole` |
| `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts` | 46-47 | dual OR + regional | `isGlobalRole`, `isRegionalLeaderRole` |
| `src/hooks/use-tenant-branding.ts` | 19 | dual OR | `isGlobalRole(user?.role)` |
| `src/hooks/use-audit-logs.ts` | 80, 125, 159 | dual OR (3 instances) | `isGlobalRole(user?.role)` |

### Priority 2: Contexts (2 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx` | 254-255 | array includes + regional | `isEquipmentManagerRole`, `isRegionalLeaderRole` |
| `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx` | 95-96 | dual OR + regional | `isGlobalRole`, `isRegionalLeaderRole` |

### Priority 3: Page Components (7 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx` | 53-54 | triple OR | `isEquipmentManagerRole(user?.role)` |
| `src/app/(app)/device-quota/categories/page.tsx` | 35-36 | triple OR | `isEquipmentManagerRole(userRole)` |
| `src/app/(app)/repair-requests/_components/RepairRequestsColumns.tsx` | 61 | triple OR | `isEquipmentManagerRole(user.role)` |
| `src/app/(app)/maintenance/page.tsx` | 82, 84, 139, 158, 655 | triple OR + regional | Use rbac utilities |
| `src/app/(app)/users/page.tsx` | 86 | dual OR | `isGlobalRole(currentUser?.role)` |
| `src/app/(app)/activity-logs/page.tsx` | 40 | dual OR | `isGlobalRole(userRole)` |
| `src/app/(app)/dashboard/page.tsx` | 60 | regional check | `isRegionalLeaderRole(user?.role)` |

### Priority 4: Dialog/Form Components (8 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/components/add-equipment-dialog.tsx` | 87 | dual OR | `isGlobalRole(user?.role)` |
| `src/components/add-transfer-dialog.tsx` | 69 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/edit-transfer-dialog.tsx` | 74 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/add-maintenance-plan-dialog.tsx` | 58 | global check | `isGlobalRole(user?.role)` |
| `src/components/start-usage-dialog.tsx` | 73 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/usage-history-tab.tsx` | 220, 298, 328 | dual OR (3 instances) | `isGlobalRole(user?.role)` |
| `src/components/tenants-management.tsx` | 73 | dual OR (lowercase) | `isGlobalRole(user?.role)` |
| `src/components/form-branding-header.tsx` | 29 | dual OR | `isGlobalRole(user?.role)` |

### Priority 5: Mobile Components (4 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/components/mobile-footer-nav.tsx` | 54 | dual OR | `isGlobalRole(user?.role)` |
| `src/components/mobile-equipment-list-item.tsx` | 69-71 | triple OR + dept | Use rbac utilities |
| `src/components/mobile-usage-actions.tsx` | 39 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/equipment/equipment-actions-menu.tsx` | 42, 78-80, 113 | uses `isGlobal` from context | Verify context uses rbac |

### Priority 6: Reports/Charts (3 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/app/(app)/reports/components/tenant-filter-dropdown.tsx` | 24-25 | dual OR + regional | `isGlobalRole`, `isRegionalLeaderRole` |
| `src/components/unified-inventory-chart.tsx` | 39-40 | dual OR + regional | `isGlobalRole`, `isRegionalLeaderRole` |
| `src/components/department-filter-status.tsx` | 66 | array NOT includes | `!isEquipmentManagerRole(user.role)` |

### Priority 7: Utilities (1 file)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/lib/advanced-cache-manager.ts` | 232 | array includes | `isEquipmentManagerRole(user.role)` |

### Not Changing (Already Correct)

| File | Reason |
|------|--------|
| `src/types/tenant.ts` | Keep `isPrivilegedRole` - re-export from rbac.ts |
| `src/contexts/TenantSelectionContext.tsx` | Already uses `isPrivilegedRole` correctly |
| `src/app/(app)/layout.tsx` | Uses dual OR - update to `isGlobalRole` |
| API routes (`src/app/api/tenants/*`) | Server-side role normalization - leave as is |

---

## Implementation Steps

### Step 1: Create RBAC utilities
- Create `src/lib/rbac.ts` with the four utility functions
- Re-export `isPrivilegedRole` from `src/types/tenant.ts`

### Step 2: Add tests
- Create `src/lib/__tests__/rbac.test.ts`
- Test null/undefined handling, case-insensitivity, all role combinations

### Step 3: Fix critical bugs (Priority 0)
- `performance-dashboard.tsx` - Fix broken `role !== 'admin'` check
- `admin/user-management.tsx` - Fix broken `role !== 'admin'` check

### Step 4: Update hooks (Priority 1)
- `useTransferActions.ts` - Replace `isTransferCoreRole` and `isRegionalLeader`
- `useEquipmentAuth.ts` - Replace inline checks
- `use-tenant-branding.ts` - Replace inline check
- `use-audit-logs.ts` - Replace 3 duplicate `isGlobalUser` checks

### Step 5: Update contexts (Priority 2)
- `RepairRequestsContext.tsx` - Replace `canSetRepairUnit` and `isRegionalLeader`
- `EquipmentDialogContext.tsx` - Replace inline checks

### Step 6: Update page components (Priority 3)
- `DeviceQuotaSubNav.tsx` (mentioned in code review)
- `categories/page.tsx`, `maintenance/page.tsx`, `users/page.tsx`
- `activity-logs/page.tsx`, `dashboard/page.tsx`
- `RepairRequestsColumns.tsx`

### Step 7: Update dialog/form components (Priority 4)
- All dialog components using role checks
- `usage-history-tab.tsx` (3 instances)

### Step 8: Update mobile components (Priority 5)
- All mobile-*.tsx components

### Step 9: Update reports/charts (Priority 6)
- `tenant-filter-dropdown.tsx`, `unified-inventory-chart.tsx`
- `department-filter-status.tsx`

### Step 10: Update utilities (Priority 7)
- `advanced-cache-manager.ts`

### Step 11: Update docs
- Add "Frontend Utility Functions" section to `docs/RBAC.md`

---

## Verification

1. **Typecheck**: `node scripts/npm-run.js run typecheck`
2. **Tests**: `node scripts/npm-run.js run test:run`
3. **Build**: `node scripts/npm-run.js run build`
4. **Manual**: Verify DeviceQuotaSubNav shows/hides Categories tab based on role

---

## Out of Scope

- RPC functions (security stays at API layer per CLAUDE.md)
- Creating React hooks (utilities are simpler and sufficient)
- Removing `isPrivilegedRole` from tenant.ts (keep for backwards compatibility)
