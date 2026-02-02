"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { callRpc } from "@/lib/rpc-client"

// ============================================
// Types
// ============================================

interface ComplianceSummary {
  quyet_dinh_id: number | null
  so_quyet_dinh: string | null
  ten_don_vi: string | null
  total_categories: number
  dat_count: number
  thieu_count: number
  vuot_count: number
  unassigned_equipment: number
}

interface AuthUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

interface DeviceQuotaDashboardContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Data
  complianceSummary: ComplianceSummary | null

  // Loading states
  isLoading: boolean
  isError: boolean

  // Refetch
  refetch: () => void
}

// ============================================
// Context
// ============================================

const DeviceQuotaDashboardContext = React.createContext<DeviceQuotaDashboardContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface DeviceQuotaDashboardProviderProps {
  children: React.ReactNode
}

export function DeviceQuotaDashboardProvider({ children }: DeviceQuotaDashboardProviderProps) {
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Get tenant ID from user
  const donViId = user?.don_vi ? parseInt(user.don_vi, 10) : null

  // Fetch compliance summary (auto-finds active decision)
  const {
    data: complianceSummaryData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dinh_muc_compliance_summary', { donViId }],
    queryFn: async () => {
      const result = await callRpc<ComplianceSummary[]>({
        fn: 'dinh_muc_compliance_summary',
        args: {
          p_quyet_dinh_id: null, // Auto-find active decision
          p_don_vi: donViId,
        },
      })
      // RPC returns array with single row
      return result?.[0] || null
    },
    enabled: !!donViId,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  const value = React.useMemo<DeviceQuotaDashboardContextValue>(() => ({
    user,
    donViId,
    complianceSummary: complianceSummaryData || null,
    isLoading,
    isError,
    refetch,
  }), [
    user,
    donViId,
    complianceSummaryData,
    isLoading,
    isError,
    refetch,
  ])

  return (
    <DeviceQuotaDashboardContext.Provider value={value}>
      {children}
    </DeviceQuotaDashboardContext.Provider>
  )
}

export { DeviceQuotaDashboardContext }
export type { ComplianceSummary, DeviceQuotaDashboardContextValue }
