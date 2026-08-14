"use client"

import { useSession } from "next-auth/react"

import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { isEquipmentManagerRole } from "@/lib/rbac"

/** Authenticated user claims needed by the Categories workspace. */
export interface DeviceQuotaCategoryUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

/** Derives the current role permissions and exact tenant scope for Categories. */
export function useDeviceQuotaCategoryAccess() {
  const { data: session } = useSession()
  const user = session?.user as DeviceQuotaCategoryUser | null
  const { selectedFacilityId, showSelector } = useTenantSelection()
  const userDonViId = user?.don_vi ? parseInt(user.don_vi, 10) : null
  const isFacilitySelected = !showSelector || typeof selectedFacilityId === "number"
  const donViId = showSelector
    ? typeof selectedFacilityId === "number"
      ? selectedFacilityId
      : null
    : userDonViId
  const canManageCategories = isEquipmentManagerRole(user?.role)

  return {
    user,
    donViId,
    isFacilitySelected,
    canManageCategories,
    canInspectCategoryDetail: canManageCategories,
    canAssignManually: canManageCategories,
  }
}
