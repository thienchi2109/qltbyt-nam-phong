import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { format } from 'date-fns'
import * as React from 'react'

export interface InventoryItem {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model?: string
  serial?: string
  khoa_phong_quan_ly?: string
  ngay_nhap: string
  created_at: string
  type: 'import' | 'export'
  source: 'manual' | 'excel' | 'transfer_internal' | 'transfer_external' | 'liquidation'
  quantity: number
  value?: number
  reason?: string
  destination?: string
}

export interface InventorySummary {
  totalImported: number
  totalExported: number
  currentStock: number
  netChange: number
}

interface DateRange {
  from: Date
  to: Date
}

// Query keys for reports caching
export const reportsKeys = {
  all: ['reports'] as const,
  inventory: () => [...reportsKeys.all, 'inventory'] as const,
  inventoryData: (filters: Record<string, any>) => [...reportsKeys.inventory(), { filters }] as const,
}

export function useInventoryData(
  dateRange: DateRange,
  selectedDepartment: string,
  searchTerm: string,
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  const queryKey = reportsKeys.inventoryData({
    dateRange: {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to, 'yyyy-MM-dd')
    },
    selectedDepartment,
    searchTerm,
    tenant: effectiveTenantKey || 'auto' // Cache partitioning
  })
  
  // (debug removed)
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd')
      const toDate = format(dateRange.to, 'yyyy-MM-dd')

      // (debug removed)

      // Fetch equipment via enhanced Reports RPC with explicit tenant + department parameter
      const equipment = await callRpc<any[]>({
        fn: 'equipment_list_for_reports',
        args: { 
          p_q: searchTerm || null, 
          p_sort: 'id.asc', 
          p_page: 1, 
          p_page_size: 10000,
          p_don_vi: selectedDonVi,  // Explicit tenant parameter for global users
          p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null
        },
      })

      // (debug removed)

      const importedEquipment = (equipment || []).filter((item: any) => {
        const created = (item.created_at || '').split('T')[0]
        return created >= fromDate && created <= toDate
      })

      // Process imported equipment
      const importedItems: InventoryItem[] = importedEquipment.map((item: any) => ({
        id: item.id,
        ma_thiet_bi: item.ma_thiet_bi,
        ten_thiet_bi: item.ten_thiet_bi,
        model: item.model,
        serial: item.serial,
        khoa_phong_quan_ly: item.khoa_phong_quan_ly,
        ngay_nhap: item.created_at,
        created_at: item.created_at,
        type: 'import' as const,
        source: 'manual' as const,
        quantity: 1,
        value: item.gia_goc,
      }))

      // Fetch transfers via enhanced RPC with explicit tenant parameter
      let transfers: any[] = []
      try {
        transfers = await callRpc<any[]>({
          fn: 'transfer_request_list_enhanced',
          args: { 
            p_q: null, 
            p_status: null, 
            p_page: 1, 
            p_page_size: 10000,
            p_don_vi: selectedDonVi,  // Explicit tenant parameter
            p_date_from: fromDate,
            p_date_to: toDate,
            p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null
          },
        })
      } catch (e: any) {
        // If the RPC is not available (404) or temporarily failing, continue without transfers
        if (e?.message?.includes('404') || e?.message?.toLowerCase?.().includes('not found')) {
          transfers = []
        } else {
          throw e
        }
      }

      const transferredEquipment = (transfers || []).filter((t: any) => {
        if (!t.ngay_ban_giao) return false
        const d = String(t.ngay_ban_giao).split('T')[0]
        return d >= fromDate && d <= toDate
      })

      const liquidatedEquipment = (transfers || []).filter((t: any) => {
        if (t.loai_hinh !== 'thanh_ly' || t.trang_thai !== 'hoan_thanh') return false
        if (!t.ngay_hoan_thanh) return false
        const d = String(t.ngay_hoan_thanh).split('T')[0]
        return d >= fromDate && d <= toDate
      })

      const exportedFromTransfers: InventoryItem[] = transferredEquipment
        .filter((transfer: any) => transfer.thiet_bi)
        .map((transfer: any) => ({
          id: transfer.id,
          ma_thiet_bi: transfer.thiet_bi.ma_thiet_bi,
          ten_thiet_bi: transfer.thiet_bi.ten_thiet_bi,
          model: transfer.thiet_bi.model,
          serial: transfer.thiet_bi.serial,
          khoa_phong_quan_ly: transfer.thiet_bi.khoa_phong_quan_ly,
          ngay_nhap: transfer.ngay_ban_giao,
          created_at: transfer.created_at,
          type: 'export' as const,
          source: transfer.loai_hinh === 'noi_bo' ? ('transfer_internal' as const) : ('transfer_external' as const),
          quantity: 1,
          reason: transfer.ly_do_luan_chuyen,
          destination: transfer.loai_hinh === 'noi_bo' ? transfer.khoa_phong_nhan : transfer.don_vi_nhan,
        }))

      const exportedFromLiquidation: InventoryItem[] = liquidatedEquipment
        .filter((transfer: any) => transfer.thiet_bi)
        .map((transfer: any) => ({
          id: transfer.id,
          ma_thiet_bi: transfer.thiet_bi.ma_thiet_bi,
          ten_thiet_bi: transfer.thiet_bi.ten_thiet_bi,
          model: transfer.thiet_bi.model,
          serial: transfer.thiet_bi.serial,
          khoa_phong_quan_ly: transfer.thiet_bi.khoa_phong_quan_ly,
          ngay_nhap: transfer.ngay_hoan_thanh,
          created_at: transfer.created_at,
          type: 'export' as const,
          source: 'liquidation' as const,
          quantity: 1,
          reason: transfer.ly_do_luan_chuyen,
          destination: 'Thanh lý',
        }))

      const exportedItems = [...exportedFromTransfers, ...exportedFromLiquidation]

      // Combine and filter data
      let allItems = [...importedItems, ...exportedItems]

      // Department filtering now handled server-side via p_khoa_phong

      // Apply search filter (if not already fully covered by p_q for imports, this also filters exports)
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        allItems = allItems.filter((item) =>
          item.ten_thiet_bi.toLowerCase().includes(q) || item.ma_thiet_bi.toLowerCase().includes(q)
        )
      }

      // Sort by date
      allItems.sort((a, b) => new Date(b.ngay_nhap).getTime() - new Date(a.ngay_nhap).getTime())

      // Calculate summary
      const totalImported = importedItems.length
      const totalExported = exportedItems.length
      const netChange = totalImported - totalExported

      // Current stock via enhanced RPC with explicit tenant and department parameter
      const currentStock = await callRpc<number>({ 
        fn: 'equipment_count_enhanced', 
        args: { 
          p_statuses: null, 
          p_q: null,
          p_don_vi: selectedDonVi,  // Explicit tenant parameter
          p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null
        } 
      })

      const summary: InventorySummary = {
        totalImported,
        totalExported,
        currentStock: currentStock || 0,
        netChange,
      }

      // Departments via enhanced RPC with explicit tenant parameter
      const deptRows = await callRpc<{ name: string; count: number }[]>({ 
        fn: 'departments_list_for_tenant',
        args: { p_don_vi: selectedDonVi }  // Explicit tenant parameter
      })
      const uniqueDepts = (deptRows || []).map((r) => r.name).filter(Boolean)

      return {
        data: allItems,
        summary,
        departments: uniqueDepts as string[],
      }
    },
    enabled: effectiveTenantKey !== 'unset', // Gate query for global users (same as Equipment page)
    staleTime: 0, // Always refetch when query key changes (filters change)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
} 