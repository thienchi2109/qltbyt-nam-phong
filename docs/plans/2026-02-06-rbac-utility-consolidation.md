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
- `src/lib/department-utils.ts` has `shouldBypassDepartmentFilter()` checking `admin|to_qltb` (**BUG: missing 'global'**)

### Bugs Identified During Review

| File | Issue | Impact |
|------|-------|--------|
| `src/lib/department-utils.ts:126` | `shouldBypassDepartmentFilter` excludes 'global' role | Global admins may not bypass department filtering |
| `src/types/database.ts:52` | `UserRole` type missing `regional_leader` | Type inconsistency with `TenantRole` |

---

## Solution: Enhanced Utility Functions

Create `src/lib/rbac.ts` with focused utility functions matching actual usage patterns.

**Enhancements from code review:**
- Add `ROLES` constant for type safety and autocomplete
- Add shared `normalizeRole()` helper with `.trim()` for defense in depth
- Add security documentation in JSDoc

### New File: `src/lib/rbac.ts`

```typescript
/**
 * RBAC Utility Functions - FRONTEND USE ONLY
 *
 * Centralizes role check logic to eliminate duplication across 48+ files.
 *
 * ⚠️ SECURITY NOTE: These functions control UI VISIBILITY, not data access.
 * All security enforcement happens server-side:
 *   - /api/rpc/[fn]/route.ts validates session and signs JWT
 *   - PostgreSQL RPC functions enforce permissions via JWT claims
 *
 * These utilities are safe because:
 *   1. They cannot be used to access data directly
 *   2. They fail closed (return false) for null/undefined inputs
 *   3. The API proxy forcibly overrides tenant parameters
 *
 * Usage: import { isGlobalRole, isEquipmentManagerRole, ROLES } from '@/lib/rbac'
 *
 * @see docs/RBAC.md for complete role matrix
 */

// ============ Role Constants ============

/**
 * Role string constants for type safety and autocomplete.
 * Use these instead of magic strings throughout the codebase.
 */
export const ROLES = {
  GLOBAL: 'global',
  ADMIN: 'admin',
  REGIONAL_LEADER: 'regional_leader',
  TO_QLTB: 'to_qltb',
  TECHNICIAN: 'technician',
  QLTB_KHOA: 'qltb_khoa',
  USER: 'user',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/** Roles with system-wide admin access */
export const GLOBAL_ROLES = [ROLES.GLOBAL, ROLES.ADMIN] as const

/** Roles that can manage equipment (global + to_qltb) */
export const EQUIPMENT_MANAGER_ROLES = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.TO_QLTB] as const

/** Roles restricted to their assigned department */
export const DEPT_SCOPED_ROLES = [ROLES.TECHNICIAN, ROLES.QLTB_KHOA] as const

/** Roles with multi-tenant selection privileges */
export const PRIVILEGED_ROLES = [ROLES.GLOBAL, ROLES.ADMIN, ROLES.REGIONAL_LEADER] as const

// ============ Internal Helpers ============

/**
 * Normalize role string for comparison.
 * Handles null/undefined, trims whitespace, lowercases.
 * @internal
 */
function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null
  const normalized = role.toLowerCase().trim()
  return normalized || null
}

// ============ Role Check Functions ============

/**
 * System administrator check (global or legacy admin alias).
 *
 * Use for: tenant management, user management, audit logs, full system access.
 *
 * @example
 * if (isGlobalRole(user?.role)) {
 *   // Show admin-only UI
 * }
 */
export function isGlobalRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === ROLES.GLOBAL || normalized === ROLES.ADMIN
}

/**
 * Regional leader check (read-only multi-tenant access).
 *
 * Use for: restricting write operations, regional data filtering.
 * Regional leaders can VIEW data across facilities but cannot MODIFY.
 */
export function isRegionalLeaderRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.REGIONAL_LEADER
}

/**
 * Equipment manager check (global + to_qltb).
 *
 * Use for: equipment CRUD, bulk import, repairs, transfers, maintenance plans.
 * This is the most commonly duplicated pattern (48+ files).
 *
 * Note: Regional leaders are NOT included - they have read-only access.
 */
export function isEquipmentManagerRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === ROLES.GLOBAL
    || normalized === ROLES.ADMIN
    || normalized === ROLES.TO_QLTB
}

/**
 * Department-scoped role check.
 *
 * Use for: determining if user needs khoa_phong filtering.
 * Returns true for roles that are restricted to their assigned department.
 */
export function isDeptScopedRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === ROLES.TECHNICIAN || normalized === ROLES.QLTB_KHOA
}

/**
 * Multi-tenant selection privilege check.
 * Re-exported from tenant.ts for convenience.
 *
 * Use for: showing tenant selection dropdown.
 * Includes: global, admin, regional_leader
 */
export { isPrivilegedRole } from '@/types/tenant'
```

---

## Files to Update (Complete List - 39 files)

### Priority 0: BUG FIXES (4 files)

**CRITICAL**: These files have bugs that need immediate attention.

| File | Line | Issue | Fix With |
|------|------|-------|----------|
| `src/components/performance-dashboard.tsx` | 41 | `role !== 'admin'` misses 'global' | `!isGlobalRole(user?.role)` |
| `src/components/admin/user-management.tsx` | 40, 178, 282 | `role !== 'admin'` misses 'global'; badge role check duplicated | `!isGlobalRole(user?.role)` and `isGlobalRole(u.role)` |
| `src/lib/department-utils.ts` | 126 | `shouldBypassDepartmentFilter` missing 'global' | Delegate to `isEquipmentManagerRole` |
| `src/types/database.ts` | 52 | `UserRole` missing `regional_leader` | Add `'regional_leader'` to union |

### Priority 1: High-Impact Hooks (5 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/hooks/useTransferActions.ts` | 47-49 | triple OR + regional | `isEquipmentManagerRole`, `isRegionalLeaderRole` |
| `src/hooks/useTransfersKanban.ts` | 44 | `userRole === 'global' \|\| userRole === 'regional_leader'` | `isGlobalRole(userRole) \|\| isRegionalLeaderRole(userRole)` |
| `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts` | 46-47 | dual OR + regional | `isGlobalRole`, `isRegionalLeaderRole` |
| `src/hooks/use-tenant-branding.ts` | 19 | dual OR | `isGlobalRole(user?.role)` |
| `src/hooks/use-audit-logs.ts` | 80, 125, 159 | dual OR (3 instances) | `isGlobalRole(user?.role)` |

### Priority 2: Contexts (2 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx` | 254-255 | array includes + regional | `isEquipmentManagerRole`, `isRegionalLeaderRole` |
| `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx` | 95-96 | dual OR + regional | `isGlobalRole`, `isRegionalLeaderRole` |

### Priority 3: Page Components (9 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx` | 53-54 | triple OR | `isEquipmentManagerRole(user?.role)` |
| `src/app/(app)/device-quota/categories/page.tsx` | 35-36 | triple OR | `isEquipmentManagerRole(userRole)` |
| `src/app/(app)/repair-requests/_components/RepairRequestsColumns.tsx` | 61 | triple OR | `isEquipmentManagerRole(user.role)` |
| `src/app/(app)/maintenance/page.tsx` | 82, 84, 139, 158, 655 | triple OR + regional | Use rbac utilities |
| `src/app/(app)/layout.tsx` | 118 | dual OR | `isGlobalRole(user?.role)` |
| `src/app/(app)/users/page.tsx` | 86 | dual OR | `isGlobalRole(currentUser?.role)` |
| `src/app/(app)/activity-logs/page.tsx` | 40 | dual OR | `isGlobalRole(userRole)` |
| `src/app/(app)/dashboard/page.tsx` | 60 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx` | 247-249 | triple OR | `isEquipmentManagerRole(user.role)` |

### Priority 4: Dialog/Form Components (10 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/components/add-equipment-dialog.tsx` | 86-87 | dual OR + regional check | `isGlobalRole(user?.role)` and `isRegionalLeaderRole(user?.role)` |
| `src/components/add-transfer-dialog.tsx` | 69 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/edit-transfer-dialog.tsx` | 74 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/add-maintenance-plan-dialog.tsx` | 58 | global check | `isGlobalRole(user?.role)` |
| `src/components/start-usage-dialog.tsx` | 73 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/end-usage-dialog.tsx` | 68 | regional check | `isRegionalLeaderRole(user?.role)` |
| `src/components/edit-maintenance-plan-dialog.tsx` | 52 | regional check | `isRegionalLeaderRole(user?.role)` |
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

### Priority 7: Utilities (2 files)

| File | Line | Current Pattern | Replace With |
|------|------|-----------------|--------------|
| `src/lib/advanced-cache-manager.ts` | 232 | array includes | `isEquipmentManagerRole(user.role)` |
| `src/components/equipment/equipment-print-utils.ts` | 49-50 | dual OR | `isGlobalRole(userRole)` |

### Not Changing (Already Correct)

| File | Reason |
|------|--------|
| `src/types/tenant.ts` | Keep `isPrivilegedRole` - re-export from rbac.ts |
| `src/contexts/TenantSelectionContext.tsx` | Already uses `isPrivilegedRole` correctly |
| API routes (`src/app/api/tenants/*`) | Server-side role normalization - leave as is |

---

## Implementation Steps

### Step 1: Create RBAC utilities
- Create `src/lib/rbac.ts` with:
  - `ROLES` constant object
  - `normalizeRole()` internal helper with `.trim()`
  - Four utility functions with JSDoc
  - Re-export `isPrivilegedRole` from `src/types/tenant.ts`

### Step 2: Add tests
- Create `src/lib/__tests__/rbac.test.ts`
- Required test coverage:
  - Null/undefined handling (returns false)
  - Empty string handling (returns false)
  - Case-insensitivity (`'GLOBAL'`, `'Admin'`, `'global'`)
  - Whitespace handling (`'  global  '` → true)
  - All role combinations for each function
  - Invalid/unknown roles (returns false)
  - Legacy 'admin' alias (treated as 'global')

### Step 3: Fix critical bugs (Priority 0)
- `performance-dashboard.tsx` - Fix broken `role !== 'admin'` check
- `admin/user-management.tsx` - Fix broken `role !== 'admin'` check
- `department-utils.ts` - Update `shouldBypassDepartmentFilter` to use `isEquipmentManagerRole`
- `database.ts` - Add `regional_leader` to `UserRole` type

### Step 4: Update hooks (Priority 1)
- `useTransferActions.ts` - Replace `isTransferCoreRole` and `isRegionalLeader`
- `useTransfersKanban.ts` - Replace inline checks
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
- `EquipmentDetailDialog/index.tsx`
- `layout.tsx`

### Step 7: Update dialog/form components (Priority 4)
- All dialog components using role checks
- `usage-history-tab.tsx` (3 instances)
- `end-usage-dialog.tsx`, `edit-maintenance-plan-dialog.tsx`
- `add-equipment-dialog.tsx` (both global + regional checks)

### Step 8: Update mobile components (Priority 5)
- All mobile-*.tsx components

### Step 9: Update reports/charts (Priority 6)
- `tenant-filter-dropdown.tsx`, `unified-inventory-chart.tsx`
- `department-filter-status.tsx`

### Step 10: Update utilities (Priority 7)
- `advanced-cache-manager.ts`
- `equipment-print-utils.ts`

### Step 11: Update docs
- Add "Frontend Utility Functions" section to `docs/RBAC.md`
- Include security note about UI-only enforcement

---

## Verification

1. **Typecheck**: `node scripts/npm-run.js run typecheck`
2. **Tests**: `node scripts/npm-run.js run test:run`
3. **Build**: `node scripts/npm-run.js run build`
4. **Manual**: Verify DeviceQuotaSubNav shows/hides Categories tab based on role

---

## Security Assessment (from review)

**Verdict: APPROVED**

| Category | Status | Notes |
|----------|--------|-------|
| RPC-only architecture compliance | PASS | Frontend checks are visibility-only |
| Null/undefined handling | PASS | Fails closed |
| Case sensitivity | PASS | Uses toLowerCase() |
| Whitespace handling | PASS | Uses trim() |
| Admin alias handling | PASS | Correctly includes 'admin' |
| Privilege escalation risk | NONE | Cannot bypass server enforcement |
| Tenant isolation impact | NONE | API proxy forces tenant override |

---

## Out of Scope

- RPC functions (security stays at API layer per CLAUDE.md)
- Creating React hooks (utilities are simpler and sufficient)
- Removing `isPrivilegedRole` from tenant.ts (keep for backwards compatibility)
