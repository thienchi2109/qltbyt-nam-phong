/**
 * Consolidated tenant/facility types for the Unified Tenant Selection System.
 * These replace duplicate definitions in useFacilityFilter.ts and equipment/types.ts.
 */

export interface FacilityOption {
  id: number
  name: string
  count?: number  // Optional - not all RPCs return count
  code?: string   // Optional - facility code for display
}

export type TenantRole = 'global' | 'admin' | 'regional_leader' | 'to_qltb' | 'technician' | 'qltb_khoa' | 'user'

/**
 * Check if the given role has multi-tenant selection privileges.
 * Global, admin, and regional_leader users can select which facility to view.
 *
 * Re-exported from @/lib/rbac for single source of truth.
 * @see src/lib/rbac.ts for implementation
 */
export { isPrivilegedRole } from '@/lib/rbac'
