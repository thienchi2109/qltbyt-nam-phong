import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"

/** Preserves the existing role and tenant guards for facility-wide suggestions. */
export function canShowDeviceQuotaSuggestedMappingAction(
  donViId: number | null,
  userRole: string | null
): boolean {
  return donViId !== null && (isEquipmentManagerRole(userRole) || isRegionalLeaderRole(userRole))
}
