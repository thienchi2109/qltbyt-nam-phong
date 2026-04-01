import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { format } from 'date-fns'
import {
  type InventoryItem,
  type InventorySummary,
  type InventoryDataFilters,
  type FacilityRow,
  type EquipmentAggregateRow,
  type DepartmentRow,
  type EquipmentReportRow,
  type TransferReportRow,
  isRpcNotFoundError,
  mapDepartmentNames,
  mapExportedInventoryItems,
  mapFacilityIds,
  mapImportedInventoryItems,
  mapInventorySummary,
} from './use-inventory-data.types'

export type { InventoryItem, InventorySummary } from './use-inventory-data.types'

interface DateRange {
  from: Date
  to: Date
}

// Query keys for reports caching
export const reportsKeys = {
  all: ['reports'] as const,
  inventory: () => [...reportsKeys.all, 'inventory'] as const,
  inventoryData: (filters: InventoryDataFilters) => [...reportsKeys.inventory(), { filters }] as const,
}

export function useInventoryData(
  dateRange: DateRange,
  selectedDepartment: string,
  searchTerm: string,
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  // Detect if this is a multi-facility query ("all facilities" mode)
  const isAllFacilities = tenantFilter === 'all'
  
  // Fetch list of allowed facilities for multi-facility aggregation
  const { data: facilitiesData } = useQuery({
    queryKey: ['reports-facilities-list'],
    queryFn: async () => {
      const result = await callRpc<FacilityRow[]>({
        fn: 'get_facilities_with_equipment_count', 
        args: {} 
      })
      return mapFacilityIds(result)
    },
    enabled: isAllFacilities,
    staleTime: 5 * 60_000, // Cache for 5 minutes
  })
  
  const queryKey = reportsKeys.inventoryData({
    dateRange: {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to, 'yyyy-MM-dd')
    },
    selectedDepartment,
    searchTerm,
    tenant: effectiveTenantKey || 'auto', // Cache partitioning
    isMultiFacility: isAllFacilities, // NEW: separate cache for multi-facility
  })
  
  // (debug removed)
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd')
      const toDate = format(dateRange.to, 'yyyy-MM-dd')

      // Multi-facility aggregation path (when "all facilities" selected)
      if (isAllFacilities) {
        const facilitiesToQuery = facilitiesData || []
        
        // Call aggregate RPC for equipment stats
        const aggregates = await callRpc<EquipmentAggregateRow>({
          fn: 'equipment_aggregates_for_reports',
          args: {
            p_don_vi_array: facilitiesToQuery.length > 0 ? facilitiesToQuery : null,
            p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null,
            p_date_from: fromDate,
            p_date_to: toDate,
          },
        })
        
        // Get departments across all facilities
        const deptRows = await callRpc<DepartmentRow[]>({
          fn: 'departments_list_for_facilities',
          args: { 
            p_don_vi_array: facilitiesToQuery.length > 0 ? facilitiesToQuery : null 
          }
        })
        
        const summary = mapInventorySummary(aggregates)
        
        return {
          data: [], // No detailed transactions in "all facilities" mode
          summary,
          departments: mapDepartmentNames(deptRows),
        }
      }

      // Single-facility detailed query (existing logic)
      // Fetch equipment via enhanced Reports RPC with explicit tenant + department parameter
      const equipment = await callRpc<EquipmentReportRow[]>({
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

      const importedItems = mapImportedInventoryItems(equipment, fromDate, toDate)

      // Fetch transfers via enhanced RPC with explicit tenant parameter
      let transfers: TransferReportRow[] = []
      try {
        transfers = await callRpc<TransferReportRow[]>({
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
      } catch (error: unknown) {
        // If the RPC is not available (404) or temporarily failing, continue without transfers
        if (isRpcNotFoundError(error)) {
          transfers = []
        } else {
          throw error
        }
      }

      const exportedItems = mapExportedInventoryItems(transfers, fromDate, toDate)

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
      const deptRows = await callRpc<DepartmentRow[]>({
        fn: 'departments_list_for_tenant',
        args: { p_don_vi: selectedDonVi }  // Explicit tenant parameter
      })
      const uniqueDepts = mapDepartmentNames(deptRows)

      return {
        data: allItems,
        summary,
        departments: uniqueDepts,
      }
    },
    enabled: effectiveTenantKey !== 'unset' && 
             (!isAllFacilities || (facilitiesData !== undefined)), // Wait for facilities in multi-facility mode
    staleTime: 0, // Always refetch when query key changes (filters change)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}
