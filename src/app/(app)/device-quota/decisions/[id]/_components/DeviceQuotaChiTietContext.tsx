"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import type { NhomThietBiForTemplate } from "@/lib/device-quota-excel"

// ============================================
// Types
// ============================================

export interface Decision {
  id: number
  don_vi_id: number
  so_quyet_dinh: string
  ngay_ban_hanh: string
  ngay_hieu_luc: string
  ngay_het_hieu_luc: string | null
  nguoi_ky: string
  chuc_vu_nguoi_ky: string
  trang_thai: 'draft' | 'active' | 'inactive'
  ghi_chu: string | null
  thay_the_cho_id: number | null
  created_at: string
  updated_at: string
}

export interface QuotaDetail {
  id: number
  quyet_dinh_id: number
  nhom_thiet_bi_id: number
  ma_nhom: string
  ten_nhom: string
  don_vi_tinh: string | null
  so_luong_dinh_muc: number
  so_luong_toi_thieu: number | null
  so_luong_hien_co: number
  ghi_chu: string | null
  created_at: string
  updated_at: string
}

interface AuthUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

interface DeviceQuotaChiTietContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Decision data
  quyetDinhId: number
  decision: Decision | null
  isDecisionLoading: boolean

  // Line items data
  quotaDetails: QuotaDetail[]
  isDetailsLoading: boolean

  // Categories data (for import)
  categories: NhomThietBiForTemplate[]
  leafCategories: NhomThietBiForTemplate[]
  isCategoriesLoading: boolean

  // Import dialog state
  isImportDialogOpen: boolean
  openImportDialog: () => void
  closeImportDialog: () => void

  // Refetch
  refetchDetails: () => void
  invalidateAndRefetch: () => void

  // Loading states
  isLoading: boolean
  isError: boolean
}

// ============================================
// Context
// ============================================

const DeviceQuotaChiTietContext = React.createContext<DeviceQuotaChiTietContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface DeviceQuotaChiTietProviderProps {
  children: React.ReactNode
  quyetDinhId: number
}

export function DeviceQuotaChiTietProvider({ children, quyetDinhId }: DeviceQuotaChiTietProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Get tenant ID from user's session or decision
  // Fallback to decision's tenant for global/admin users who have no don_vi claim
  const donViId = user?.don_vi 
    ? parseInt(user.don_vi, 10) 
    : (decisionData?.don_vi_id ?? null)

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false)

  // Fetch decision details
  const {
    data: decisionData,
    isLoading: isDecisionLoading,
    isError: isDecisionError,
  } = useQuery({
    queryKey: ['dinh_muc_quyet_dinh_get', { id: quyetDinhId }],
    queryFn: async () => {
      const result = await callRpc<Decision>({
        fn: 'dinh_muc_quyet_dinh_get',
        args: { p_id: quyetDinhId },
      })
      return result
    },
    enabled: !!quyetDinhId,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch quota line items
  const {
    data: detailsData,
    isLoading: isDetailsLoading,
    isError: isDetailsError,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['dinh_muc_chi_tiet_list', { quyetDinhId }],
    queryFn: async () => {
      const result = await callRpc<{ data: QuotaDetail[]; total: number }>({
        fn: 'dinh_muc_chi_tiet_list',
        args: { p_quyet_dinh_id: quyetDinhId },
      })
      return result?.data || []
    },
    enabled: !!quyetDinhId,
    staleTime: 10000, // 10 seconds (more frequent for detail page)
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Type for what the RPC actually returns (TABLE format)
  type CategoryFromRpc = {
    id: number
    parent_id: number | null
    ma_nhom: string
    ten_nhom: string
    phan_loai: string | null
    don_vi_tinh: string | null
    thu_tu_hien_thi: number
    mo_ta: string | null
    tu_khoa: string[] | null
    level: number
    so_luong_hien_co: number
  }

  // Fetch categories for import template
  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
  } = useQuery({
    queryKey: ['dinh_muc_nhom_list', { donViId }],
    queryFn: async () => {
      // RPC returns TABLE (array) directly, not { data, total }
      const result = await callRpc<CategoryFromRpc[]>({
        fn: 'dinh_muc_nhom_list',
        args: { p_don_vi: donViId },
      })
      const rows = result ?? []

      // Build a set of parent IDs to determine which categories are leaves
      const parentIds = new Set(rows.map(r => r.parent_id).filter(Boolean))

      // Build a lookup map for parent names
      const idToName = new Map(rows.map(r => [r.id, r.ten_nhom]))

      // Transform to NhomThietBiForTemplate format
      return rows.map((row): NhomThietBiForTemplate => ({
        ma_nhom: row.ma_nhom,
        ten_nhom: row.ten_nhom,
        phan_loai: row.phan_loai,
        don_vi_tinh: row.don_vi_tinh,
        parent_name: row.parent_id ? (idToName.get(row.parent_id) ?? null) : null,
        is_leaf: !parentIds.has(row.id),
      }))
    },
    enabled: !!donViId,
    staleTime: 5 * 60 * 1000, // 5 minutes (categories don't change often)
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  // Filter to leaf-only categories (for import)
  const leafCategories = React.useMemo(() => {
    if (!categoriesData) return []
    return categoriesData.filter(cat => cat.is_leaf)
  }, [categoriesData])

  // Cache invalidation
  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_chi_tiet_list', { quyetDinhId }] })
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_get', { id: quyetDinhId }] })
    // Also invalidate decisions list since it shows total counts
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_list'] })
  }, [queryClient, quyetDinhId])

  // Dialog actions
  const openImportDialog = React.useCallback(() => {
    setIsImportDialogOpen(true)
  }, [])

  const closeImportDialog = React.useCallback(() => {
    setIsImportDialogOpen(false)
  }, [])

  const value = React.useMemo<DeviceQuotaChiTietContextValue>(() => ({
    user,
    donViId,
    quyetDinhId,
    decision: decisionData || null,
    isDecisionLoading,
    quotaDetails: detailsData || [],
    isDetailsLoading,
    categories: categoriesData || [],
    leafCategories,
    isCategoriesLoading,
    isImportDialogOpen,
    openImportDialog,
    closeImportDialog,
    refetchDetails,
    invalidateAndRefetch,
    isLoading: isDecisionLoading || isDetailsLoading || isCategoriesLoading,
    isError: isDecisionError || isDetailsError,
  }), [
    user,
    donViId,
    quyetDinhId,
    decisionData,
    isDecisionLoading,
    detailsData,
    isDetailsLoading,
    categoriesData,
    leafCategories,
    isCategoriesLoading,
    isImportDialogOpen,
    openImportDialog,
    closeImportDialog,
    refetchDetails,
    invalidateAndRefetch,
    isDecisionError,
    isDetailsError,
  ])

  return (
    <DeviceQuotaChiTietContext.Provider value={value}>
      {children}
    </DeviceQuotaChiTietContext.Provider>
  )
}

export { DeviceQuotaChiTietContext }
