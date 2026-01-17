"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import type { FacilityOption } from "@/types/tenant"

type TenantSelectionContextValue = {
  /** Currently selected facility ID, or null if none selected */
  selectedFacilityId: number | null
  /** Update the selected facility. Persists to sessionStorage. */
  setSelectedFacilityId: (id: number | null) => void
  /** List of facilities accessible to the current user */
  facilities: FacilityOption[]
  /** Whether to show the facility selector (true for global/admin/regional_leader) */
  showSelector: boolean
  /** Whether facilities are currently loading */
  isLoading: boolean
  /** Whether data queries should be enabled (true when selection made or non-privileged user) */
  shouldFetchData: boolean
}

const TenantSelectionContext = React.createContext<TenantSelectionContextValue | null>(null)

const STORAGE_KEY = "selectedFacilityId"

export function TenantSelectionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const user = session?.user as { role?: string; dia_ban_id?: number } | undefined

  // Determine if user has multi-tenant selection privileges
  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"
  const showSelector = isGlobal || isRegionalLeader

  // State for selected facility with sessionStorage persistence
  const [selectedFacilityId, setSelectedFacilityIdState] = React.useState<number | null>(() => {
    // Initialize from sessionStorage if available (client-side only)
    if (typeof window === "undefined") return null
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        return Number.isFinite(parsed) ? parsed : null
      }
    } catch {
      // sessionStorage access failed
    }
    return null
  })

  // Stable setter with sessionStorage persistence
  const setSelectedFacilityId = React.useCallback((id: number | null) => {
    setSelectedFacilityIdState(id)
    if (typeof window === "undefined") return
    try {
      if (id !== null) {
        sessionStorage.setItem(STORAGE_KEY, String(id))
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // sessionStorage access failed
    }
  }, [])

  // Fetch facilities for global/regional users
  const { data: facilities = [], isLoading } = useQuery<FacilityOption[]>({
    queryKey: ["accessible_facilities", { role: user?.role, diaBan: user?.dia_ban_id }],
    queryFn: () => callRpc({ fn: "get_accessible_facilities", args: {} }),
    enabled: status === "authenticated" && showSelector,
    staleTime: 5 * 60_000, // 5 minutes
  })

  // Determine if data queries should be enabled
  // Non-privileged users can always fetch (server enforces their don_vi)
  // Privileged users must select a facility first
  const shouldFetchData = React.useMemo(() => {
    if (!showSelector) return true
    return selectedFacilityId !== null
  }, [showSelector, selectedFacilityId])

  // Memoize context value to prevent unnecessary re-renders
  const value = React.useMemo<TenantSelectionContextValue>(() => ({
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    showSelector,
    isLoading,
    shouldFetchData,
  }), [selectedFacilityId, setSelectedFacilityId, facilities, showSelector, isLoading, shouldFetchData])

  return (
    <TenantSelectionContext.Provider value={value}>
      {children}
    </TenantSelectionContext.Provider>
  )
}

/**
 * Hook to access the tenant selection context.
 * Must be used within a TenantSelectionProvider.
 */
export function useTenantSelection() {
  const context = React.useContext(TenantSelectionContext)
  if (!context) {
    throw new Error("useTenantSelection must be used within TenantSelectionProvider")
  }
  return context
}
