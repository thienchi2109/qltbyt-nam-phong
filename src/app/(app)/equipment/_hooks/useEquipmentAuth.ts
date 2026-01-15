"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import type { SessionUser } from "../types"

const STORAGE_KEY = "equipment_tenant_filter"

export interface UseEquipmentAuthReturn {
  user: SessionUser | null
  status: "loading" | "authenticated" | "unauthenticated"
  isGlobal: boolean
  isRegionalLeader: boolean
  tenantKey: string
  tenantFilter: string
  setTenantFilter: (value: string) => void
  currentTenantId: number | null
  shouldFetchEquipment: boolean
  effectiveTenantKey: string
  selectedDonVi: number | null
}

// Note: Tenant change effects (clear filters, show toast) are handled
// in the main useEquipmentPage composition hook which has access to
// both tenantFilter and filter setters.

export function useEquipmentAuth(): UseEquipmentAuthReturn {
  const { data: session, status } = useSession()
  const user = session?.user as SessionUser | null

  // Role checks
  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"

  // Tenant key for non-global users
  const tenantKey = user?.don_vi ? String(user.don_vi) : "none"

  // Track if we've synced localStorage after auth completed
  const hasSyncedRef = React.useRef(false)

  // Tenant filter state with localStorage persistence (global users only)
  // Note: Initial value may be incorrect during loading state - useEffect below will sync
  const [tenantFilter, setTenantFilterState] = React.useState<string>(() => {
    if (typeof window === "undefined") return isGlobal ? "unset" : tenantKey
    if (!isGlobal) return tenantKey
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && (saved === "unset" || saved === "all" || /^\d+$/.test(saved))) {
        return saved
      }
    } catch {
      /* ignore */
    }
    return "unset"
  })

  // Sync tenant filter after authentication completes
  // This fixes the race condition where useState initializer runs during "loading" state
  // when isGlobal is incorrectly false, preventing localStorage restoration for global users
  React.useEffect(() => {
    // Only run after auth is complete
    if (status !== "authenticated") {
      hasSyncedRef.current = false
      return
    }

    // Only sync once per authentication
    if (hasSyncedRef.current) return
    hasSyncedRef.current = true

    if (isGlobal) {
      // Global user: restore from localStorage
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved && (saved === "unset" || saved === "all" || /^\d+$/.test(saved))) {
            setTenantFilterState(saved)
          } else {
            setTenantFilterState("unset")
          }
        } catch {
          setTenantFilterState("unset")
        }
      }
    } else {
      // Non-global user: force their tenant key
      setTenantFilterState(tenantKey)
    }
  }, [status, isGlobal, tenantKey])

  // Wrapper to persist to localStorage when setting
  const setTenantFilter = React.useCallback(
    (value: string) => {
      setTenantFilterState(value)
      if (typeof window === "undefined") return
      if (isGlobal) {
        try {
          localStorage.setItem(STORAGE_KEY, value)
        } catch {
          /* ignore */
        }
      }
    },
    [isGlobal]
  )

  // Computed: should we fetch equipment based on tenant selection
  // Gate on authenticated status to prevent premature fetches during loading
  const shouldFetchEquipment = React.useMemo(() => {
    if (status !== "authenticated") return false
    if (!isGlobal) return true
    if (tenantFilter === "all") return true
    return /^\d+$/.test(tenantFilter)
  }, [status, isGlobal, tenantFilter])

  // Effective tenant key for queries
  const effectiveTenantKey = isGlobal
    ? shouldFetchEquipment
      ? tenantFilter
      : "unset"
    : tenantKey

  // Selected don_vi for query filtering (also used for UI display)
  const selectedDonVi = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === "all") return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

  // Current tenant ID for queries
  const currentTenantId = React.useMemo(() => {
    if (!isGlobal) return user?.don_vi ? Number(user.don_vi) : null
    if (selectedDonVi !== null) return selectedDonVi
    return null
  }, [isGlobal, user?.don_vi, selectedDonVi])

  return React.useMemo(
    () => ({
      user,
      status,
      isGlobal,
      isRegionalLeader,
      tenantKey,
      tenantFilter,
      setTenantFilter,
      currentTenantId,
      shouldFetchEquipment,
      effectiveTenantKey,
      selectedDonVi,
    }),
    [
      user,
      status,
      isGlobal,
      isRegionalLeader,
      tenantKey,
      tenantFilter,
      setTenantFilter,
      currentTenantId,
      shouldFetchEquipment,
      effectiveTenantKey,
      selectedDonVi,
    ]
  )
}
