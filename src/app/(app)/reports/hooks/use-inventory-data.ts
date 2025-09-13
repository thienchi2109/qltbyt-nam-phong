import { useQuery } from '@tanstack/react-query'
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

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
  searchTerm: string
) {
  return useQuery({
    queryKey: reportsKeys.inventoryData({
      dateRange: {
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd')
      },
      selectedDepartment,
      searchTerm
    }),
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const fromDate = format(dateRange.from, 'yyyy-MM-dd')
      const toDate = format(dateRange.to, 'yyyy-MM-dd')

      // Fetch imported equipment (from manual input and excel import)
      // Use created_at to track when equipment records were added to the system
      let equipmentQuery = supabase
        .from('thiet_bi')
        .select('*')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)

      if (selectedDepartment !== 'all') {
        equipmentQuery = equipmentQuery.eq('khoa_phong_quan_ly', selectedDepartment)
      }

      if (searchTerm) {
        equipmentQuery = equipmentQuery.or(
          `ten_thiet_bi.ilike.%${searchTerm}%,ma_thiet_bi.ilike.%${searchTerm}%`
        )
      }

      const { data: importedEquipment, error: equipmentError } = await equipmentQuery

      if (equipmentError) throw equipmentError

      // Fetch exported equipment (from transfers)
      let transferQuery = supabase
        .from('yeu_cau_luan_chuyen')
        .select(`
          *,
          thiet_bi:thiet_bi_id (
            id,
            ma_thiet_bi,
            ten_thiet_bi,
            model,
            serial,
            khoa_phong_quan_ly
          )
        `)
        .gte('ngay_ban_giao', fromDate)
        .lte('ngay_ban_giao', toDate)
        .not('ngay_ban_giao', 'is', null)

      const { data: transferredEquipment, error: transferError } = await transferQuery

      if (transferError) throw transferError

      // Fetch liquidated equipment
      const { data: liquidatedEquipment, error: liquidationError } = await supabase
        .from('yeu_cau_luan_chuyen')
        .select(`
          *,
          thiet_bi:thiet_bi_id (
            id, ma_thiet_bi, ten_thiet_bi, model, serial, khoa_phong_quan_ly
          )
        `)
        .eq('loai_hinh', 'thanh_ly')
        .eq('trang_thai', 'hoan_thanh')
        .gte('ngay_hoan_thanh', fromDate)
        .lte('ngay_hoan_thanh', toDate)

      if (liquidationError) throw liquidationError

      // Process imported equipment (filtering already done in query)
      const importedItems: InventoryItem[] = (importedEquipment || []).map(item => ({
          id: item.id,
          ma_thiet_bi: item.ma_thiet_bi,
          ten_thiet_bi: item.ten_thiet_bi,
          model: item.model,
          serial: item.serial,
          khoa_phong_quan_ly: item.khoa_phong_quan_ly,
          ngay_nhap: item.created_at, // Use created_at as the import date for reports
          created_at: item.created_at,
          type: 'import' as const,
          source: 'manual' as const, // We'll enhance this later to detect excel imports
          quantity: 1,
          value: item.gia_goc
        }))

      // Process exported equipment from transfers
      const exportedFromTransfers: InventoryItem[] = (transferredEquipment || [])
        .filter(transfer => transfer.thiet_bi)
        .map(transfer => ({
          id: transfer.id,
          ma_thiet_bi: transfer.thiet_bi.ma_thiet_bi,
          ten_thiet_bi: transfer.thiet_bi.ten_thiet_bi,
          model: transfer.thiet_bi.model,
          serial: transfer.thiet_bi.serial,
          khoa_phong_quan_ly: transfer.thiet_bi.khoa_phong_quan_ly,
          ngay_nhap: transfer.ngay_ban_giao,
          created_at: transfer.created_at,
          type: 'export' as const,
          source: transfer.loai_hinh === 'noi_bo' ? 'transfer_internal' as const : 'transfer_external' as const,
          quantity: 1,
          reason: transfer.ly_do_luan_chuyen,
          destination: transfer.loai_hinh === 'noi_bo' ? transfer.khoa_phong_nhan : transfer.don_vi_nhan
        }))

      // Process liquidated equipment as exports
      const exportedFromLiquidation: InventoryItem[] = (liquidatedEquipment || [])
        .filter(transfer => transfer.thiet_bi)
        .map(transfer => ({
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
          destination: 'Thanh lý'
        }))

      const exportedItems = [...exportedFromTransfers, ...exportedFromLiquidation]

      // Combine and filter data
      let allItems = [...importedItems, ...exportedItems]

      // Apply department filter to exported items
      if (selectedDepartment !== 'all') {
        allItems = allItems.filter(item => 
          item.type === 'import' || 
          (item.type === 'export' && item.khoa_phong_quan_ly === selectedDepartment)
        )
      }

      // Apply search filter
      if (searchTerm) {
        allItems = allItems.filter(item =>
          item.ten_thiet_bi.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.ma_thiet_bi.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      // Sort by date
      allItems.sort((a, b) => new Date(b.ngay_nhap).getTime() - new Date(a.ngay_nhap).getTime())

      // Calculate summary
      const totalImported = importedItems.length
      const totalExported = exportedItems.length
      const netChange = totalImported - totalExported

      // Get current stock (total equipment in system)
      const { count: currentStock } = await supabase
        .from('thiet_bi')
        .select('*', { count: 'exact', head: true })

      const summary: InventorySummary = {
        totalImported,
        totalExported,
        currentStock: currentStock || 0,
        netChange
      }

      // Get departments for filter
      const { data: deptData } = await supabase
        .from('thiet_bi')
        .select('khoa_phong_quan_ly')
        .not('khoa_phong_quan_ly', 'is', null)

      const uniqueDepts = [...new Set(deptData?.map(item => item.khoa_phong_quan_ly).filter(Boolean))]

      return {
        data: allItems,
        summary,
        departments: uniqueDepts as string[]
      }
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - reports data can be cached for a while
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  })
} 