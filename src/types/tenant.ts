/**
 * Consolidated tenant/facility types for the Unified Tenant Selection System.
 * These replace duplicate definitions in useFacilityFilter.ts and equipment/types.ts.
 */

export interface FacilityOption {
  id: number
  name: string
  count?: number  // Optional - not all RPCs return count
}

export type TenantRole = 'global' | 'admin' | 'regional_leader' | 'to_qltb' | 'user'

/**
 * Check if the given role has multi-tenant selection privileges.
 * Global, admin, and regional_leader users can select which facility to view.
 */
export function isPrivilegedRole(role: string | undefined | null): boolean {
  if (!role) return false
  return ['global', 'admin', 'regional_leader'].includes(role.toLowerCase())
}
