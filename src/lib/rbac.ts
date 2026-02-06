/**
 * RBAC Utility Functions - FRONTEND USE ONLY
 *
 * Centralizes role check logic to eliminate duplication across the codebase.
 *
 * ⚠️ SECURITY NOTE: These functions control UI visibility, not data access.
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
 * Regional leaders can view data across facilities but cannot modify.
 */
export function isRegionalLeaderRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.REGIONAL_LEADER
}

/**
 * Equipment manager check (global + to_qltb).
 *
 * Use for: equipment CRUD, bulk import, repairs, transfers, maintenance plans.
 * This is the most commonly duplicated pattern.
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
