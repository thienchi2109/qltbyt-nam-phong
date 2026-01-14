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

export function useEquipmentAuth(): UseEquipmentAuthReturn {
  const { data: session, status } = useSession()
  const user = session?.user as SessionUser | null

  // Role checks
  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"

  // Tenant key for non-global users
  const tenantKey = user?.don_vi ? String(user.don_vi) : "none"

  // Tenant filter state with localStorage persistence (global users only)
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
  const shouldFetchEquipment = React.useMemo(() => {
    if (!isGlobal) return true
    if (tenantFilter === "all") return true
    return /^\d+$/.test(tenantFilter)
  }, [isGlobal, tenantFilter])

  // Effective tenant key for queries
  const effectiveTenantKey = isGlobal
    ? shouldFetchEquipment
      ? tenantFilter
      : "unset"
    : tenantKey

  // Selected tenant ID for UI display
  const selectedDonViUI = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === "all") return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

  // Current tenant ID for queries
  const currentTenantId = React.useMemo(() => {
    if (!isGlobal) return user?.don_vi ? Number(user.don_vi) : null
    if (selectedDonViUI !== null) return selectedDonViUI
    return null
  }, [isGlobal, user?.don_vi, selectedDonViUI])

  // Selected don_vi for query filtering
  const selectedDonVi = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === "all") return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

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
