"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import type { SessionUser } from "../types"

export interface UseEquipmentAuthReturn {
  user: SessionUser | null
  status: "loading" | "authenticated" | "unauthenticated"
  isGlobal: boolean
  isRegionalLeader: boolean
  tenantKey: string
  currentTenantId: number | null
  shouldFetchEquipment: boolean
  effectiveTenantKey: string
  selectedDonVi: number | null
  // From TenantSelectionContext
  selectedFacilityId: number | null | undefined
  setSelectedFacilityId: (id: number | null) => void
  showSelector: boolean
  facilities: { id: number; name: string; code?: string; count?: number }[]
  isFacilitiesLoading: boolean
  shouldFetchData: boolean
}

// Note: Tenant change effects (clear filters, show toast) are handled
// in the main useEquipmentPage composition hook which has access to
// both tenant state and filter setters.

export function useEquipmentAuth(): UseEquipmentAuthReturn {
  const { data: session, status } = useSession()
  const user = session?.user as SessionUser | null

  // Get tenant selection state from shared context
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    showSelector,
    isLoading: isFacilitiesLoading,
    shouldFetchData: contextShouldFetchData,
  } = useTenantSelection()

  // Role checks
  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"

  // Tenant key for non-global users
  const tenantKey = user?.don_vi ? String(user.don_vi) : "none"

  // Computed: should we fetch equipment based on tenant selection
  // Gate on authenticated status to prevent premature fetches during loading
  // For privileged users, context gates fetching until selection is made
  const shouldFetchEquipment = React.useMemo(() => {
    if (status !== "authenticated") return false
    // For non-privileged users, always allow fetching (server enforces their don_vi)
    if (!showSelector) return true
    // For privileged users, defer to context's shouldFetchData
    return contextShouldFetchData
  }, [status, showSelector, contextShouldFetchData])

  // Effective tenant key for queries
  // Uses context's selectedFacilityId for privileged users
  const effectiveTenantKey = React.useMemo(() => {
    if (showSelector) {
      // undefined = not selected yet, null = "all facilities", number = specific facility
      if (selectedFacilityId === undefined) return "unset"
      if (selectedFacilityId === null) return "all"
      return String(selectedFacilityId)
    }
    return tenantKey
  }, [showSelector, selectedFacilityId, tenantKey])

  // Selected don_vi for query filtering (also used for UI display)
  // For privileged users, use context's selectedFacilityId
  const selectedDonVi = React.useMemo(() => {
    if (showSelector) {
      // null = "all facilities" (no filter), number = specific facility
      if (selectedFacilityId === null || selectedFacilityId === undefined) return null
      return selectedFacilityId
    }
    return null
  }, [showSelector, selectedFacilityId])

  // Current tenant ID for queries
  const currentTenantId = React.useMemo(() => {
    if (showSelector) {
      // For privileged users, use selectedFacilityId if set
      if (selectedFacilityId !== null && selectedFacilityId !== undefined) {
        return selectedFacilityId
      }
      return null
    }
    // For non-privileged users, use their assigned don_vi
    return user?.don_vi ? Number(user.don_vi) : null
  }, [showSelector, selectedFacilityId, user?.don_vi])

  return React.useMemo(
    () => ({
      user,
      status,
      isGlobal,
      isRegionalLeader,
      tenantKey,
      currentTenantId,
      shouldFetchEquipment,
      effectiveTenantKey,
      selectedDonVi,
      // Context values
      selectedFacilityId,
      setSelectedFacilityId,
      showSelector,
      facilities,
      isFacilitiesLoading,
      shouldFetchData: contextShouldFetchData,
    }),
    [
      user,
      status,
      isGlobal,
      isRegionalLeader,
      tenantKey,
      currentTenantId,
      shouldFetchEquipment,
      effectiveTenantKey,
      selectedDonVi,
      selectedFacilityId,
      setSelectedFacilityId,
      showSelector,
      facilities,
      isFacilitiesLoading,
      contextShouldFetchData,
    ]
  )
}
