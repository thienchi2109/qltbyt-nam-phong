"use client"

import * as React from "react"
import type { ColumnDef, ColumnFiltersState, SortingState, VisibilityState, Table } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import { exportToExcel, generateEquipmentImportTemplate } from "@/lib/excel-utils"
import { generateProfileSheet, generateDeviceLabel, type PrintContext } from "@/components/equipment/equipment-print-utils"
import { columnLabels, createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import { EquipmentActionsMenu } from "@/components/equipment/equipment-actions-menu"
import type { Equipment, UsageLog, SessionUser } from "@/types/database"
import type { TenantBranding } from "@/hooks/use-tenant-branding"

// Filter bottom sheet data type
export interface FilterBottomSheetData {
  status: { id: string; label: string; count: number }[]
  department: { id: string; label: string; count: number }[]
  location: { id: string; label: string; count: number }[]
  user: { id: string; label: string; count: number }[]
  classification: { id: string; label: string; count: number }[]
}

// Facility option type
export interface FacilityOption {
  id: number
  name: string
  count: number
}

// Re-export SessionUser for convenience
export type { SessionUser }

// Interface for hook return value
export interface UseEquipmentPageReturn {
  // Session/Auth
  user: SessionUser | null
  status: "loading" | "authenticated" | "unauthenticated"
  isGlobal: boolean
  isRegionalLeader: boolean

  // Router
  router: ReturnType<typeof useRouter>

  // Data
  data: Equipment[]
  total: number
  isLoading: boolean
  isFetching: boolean
  shouldFetchEquipment: boolean

  // Table
  table: Table<Equipment>
  columns: ColumnDef<Equipment>[]
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number
  columnVisibility: VisibilityState
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>

  // Filters
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  columnFilters: ColumnFiltersState
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  isFiltered: boolean

  // Filter options (from server)
  departments: string[]
  users: string[]
  statuses: string[]
  classifications: string[]
  filterData: FilterBottomSheetData

  // Facility filter
  showFacilityFilter: boolean
  facilities: FacilityOption[]
  selectedFacilityId: number | null
  setSelectedFacilityId: (id: number | null) => void
  activeFacility: FacilityOption | null
  hasFacilityFilter: boolean
  isFacilitiesLoading: boolean

  // Facility sheet
  isFacilitySheetOpen: boolean
  setIsFacilitySheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  pendingFacilityId: number | null
  setPendingFacilityId: React.Dispatch<React.SetStateAction<number | null>>
  handleFacilityApply: () => void
  handleFacilityClear: () => void
  handleFacilityCancel: () => void

  // Dialogs
  isAddDialogOpen: boolean
  setIsAddDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  isImportDialogOpen: boolean
  setIsImportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  editingEquipment: Equipment | null
  setEditingEquipment: React.Dispatch<React.SetStateAction<Equipment | null>>
  selectedEquipment: Equipment | null
  setSelectedEquipment: React.Dispatch<React.SetStateAction<Equipment | null>>
  isDetailModalOpen: boolean
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  isStartUsageDialogOpen: boolean
  setIsStartUsageDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  startUsageEquipment: Equipment | null
  setStartUsageEquipment: React.Dispatch<React.SetStateAction<Equipment | null>>
  isEndUsageDialogOpen: boolean
  setIsEndUsageDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  endUsageLog: UsageLog | null
  setEndUsageLog: React.Dispatch<React.SetStateAction<UsageLog | null>>

  // Filter sheet
  isFilterSheetOpen: boolean
  setIsFilterSheetOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Columns dialog
  isColumnsDialogOpen: boolean
  setIsColumnsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Handlers
  handleShowDetails: (equipment: Equipment) => void
  handleStartUsage: (equipment: Equipment) => void
  handleEndUsage: (usage: UsageLog) => void
  handleDownloadTemplate: () => Promise<void>
  handleExportData: () => Promise<void>
  handleGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  handleGenerateDeviceLabel: (equipment: Equipment) => Promise<void>
  onDataMutationSuccess: () => void
  onDataMutationSuccessWithStatePreservation: () => void

  // UI state
  isMobile: boolean
  isCardView: boolean
  useTabletFilters: boolean

  // Branding
  tenantBranding: TenantBranding | undefined
}

type EquipmentListRes = { data: Equipment[]; total: number; page: number; pageSize: number }

export function useEquipmentPage(): UseEquipmentPageReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const user = session?.user as SessionUser | null
  const isRegionalLeader = user?.role === 'regional_leader'
  const { toast } = useToast()
  const { data: tenantBranding } = useTenantBranding()
  const queryClient = useQueryClient()

  // Global/admin role check
  const isGlobal = user?.role === 'global' || user?.role === 'admin'

  // Tenant key for non-global users
  const tenantKey = user?.don_vi ? String(user.don_vi) : 'none'

  // State declarations
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)
  const [isFacilitySheetOpen, setIsFacilitySheetOpen] = React.useState(false)
  const [pendingFacilityId, setPendingFacilityId] = React.useState<number | null>(null)
  const debouncedSearch = useSearchDebounce(searchTerm)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false)
  const [selectedEquipment, setSelectedEquipment] = React.useState<Equipment | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false)
  const [isStartUsageDialogOpen, setIsStartUsageDialogOpen] = React.useState(false)
  const [startUsageEquipment, setStartUsageEquipment] = React.useState<Equipment | null>(null)
  const [isEndUsageDialogOpen, setIsEndUsageDialogOpen] = React.useState(false)
  const [endUsageLog, setEndUsageLog] = React.useState<UsageLog | null>(null)
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | null>(null)
  const [tenantFilter, setTenantFilter] = React.useState<string>(() => (isGlobal ? 'unset' : tenantKey))
  const [isColumnsDialogOpen, setIsColumnsDialogOpen] = React.useState(false)
  const [preservePageState, setPreservePageState] = React.useState<{
    pageIndex: number
    pageSize: number
  } | null>(null)
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    id: false,
    ma_thiet_bi: true,
    ten_thiet_bi: true,
    model: true,
    serial: true,
    cau_hinh_thiet_bi: false,
    phu_kien_kem_theo: false,
    hang_san_xuat: false,
    noi_san_xuat: false,
    nam_san_xuat: false,
    ngay_nhap: false,
    ngay_dua_vao_su_dung: false,
    nguon_kinh_phi: false,
    gia_goc: false,
    nam_tinh_hao_mon: false,
    ty_le_hao_mon: false,
    han_bao_hanh: false,
    vi_tri_lap_dat: true,
    nguoi_dang_truc_tiep_quan_ly: true,
    khoa_phong_quan_ly: true,
    tinh_trang_hien_tai: true,
    ghi_chu: false,
    chu_ky_bt_dinh_ky: false,
    ngay_bt_tiep_theo: false,
    chu_ky_hc_dinh_ky: false,
    ngay_hc_tiep_theo: false,
    chu_ky_kd_dinh_ky: false,
    ngay_kd_tiep_theo: false,
    phan_loai_theo_nd98: true,
  })

  // Media queries
  const isMobile = useIsMobile()
  const useTabletFilters = useMediaQuery("(min-width: 768px) and (max-width: 1024px)")
  const isCardView = useMediaQuery("(max-width: 1279px)")
  const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1800px)")

  // Regional leader tenant filtering state
  const { showFacilityFilter, selectedFacilityId, setSelectedFacilityId } = useFacilityFilter({
    mode: 'server',
    userRole: user?.role || 'user',
  })

  // Computed values
  const selectedDonViUI = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === 'all') return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

  const shouldFetchEquipment = React.useMemo(() => {
    if (!isGlobal) return true
    if (tenantFilter === 'all') return true
    return /^\d+$/.test(tenantFilter)
  }, [isGlobal, tenantFilter])

  const effectiveTenantKey = isGlobal ? (shouldFetchEquipment ? tenantFilter : 'unset') : tenantKey

  const currentTenantId = React.useMemo(() => {
    if (!isGlobal) return user?.don_vi ? Number(user.don_vi) : null
    if (selectedDonViUI !== null) return selectedDonViUI
    return null
  }, [isGlobal, user?.don_vi, selectedDonViUI])

  const selectedDonVi = React.useMemo(() => {
    if (isRegionalLeader) return selectedFacilityId
    if (!isGlobal) return null
    if (tenantFilter === 'all') return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isRegionalLeader, selectedFacilityId, isGlobal, tenantFilter])

  const sortParam = React.useMemo(() => {
    if (!sorting || sorting.length === 0) return 'id.asc'
    const s = sorting[0]
    return `${s.id}.${s.desc ? 'desc' : 'asc'}`
  }, [sorting])

  // Filter helper functions
  const getArrayFilter = React.useCallback((id: string): string[] => {
    const entry = (columnFilters || []).find((f) => f.id === id)
    return (entry?.value as string[] | undefined) || []
  }, [columnFilters])

  const selectedDepartments = getArrayFilter('khoa_phong_quan_ly')
  const selectedUsers = getArrayFilter('nguoi_dang_truc_tiep_quan_ly')
  const selectedLocations = getArrayFilter('vi_tri_lap_dat')
  const selectedStatuses = getArrayFilter('tinh_trang_hien_tai')
  const selectedClassifications = getArrayFilter('phan_loai_theo_nd98')

  // Data queries
  const { data: activeUsageLogs, isLoading: isLoadingActiveUsage } = useActiveUsageLogs({
    tenantId: currentTenantId,
    enabled: true,
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: tenantList, isLoading: isTenantsLoading } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ['tenant_list'],
    queryFn: async () => {
      const list = await callRpc<{ id: number; name: string; code: string }[]>({ fn: 'tenant_list', args: {} })
      return (list || []).map((t) => ({ id: t.id, name: t.name, code: t.code }))
    },
    enabled: isGlobal,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const tenantOptions = (tenantList ?? []) as { id: number; name: string; code: string }[]

  const effectivePageSize = pagination.pageSize
  const effectivePage = pagination.pageIndex + 1

  const { data: equipmentRes, isLoading: isEqLoading, isFetching: isEqFetching } = useQuery<EquipmentListRes>({
    queryKey: ['equipment_list_enhanced', {
      tenant: effectiveTenantKey,
      donVi: selectedDonVi,
      page: pagination.pageIndex,
      size: pagination.pageSize,
      q: debouncedSearch || null,
      khoa_phong_array: selectedDepartments,
      nguoi_su_dung_array: selectedUsers,
      vi_tri_lap_dat_array: selectedLocations,
      tinh_trang_array: selectedStatuses,
      phan_loai_array: selectedClassifications,
      sort: sortParam,
    }],
    enabled: shouldFetchEquipment,
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentListRes>({ fn: 'equipment_list_enhanced', args: {
        p_q: debouncedSearch || null,
        p_sort: sortParam,
        p_page: effectivePage,
        p_page_size: effectivePageSize,
        p_don_vi: selectedDonVi,
        p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
        p_nguoi_su_dung_array: selectedUsers.length > 0 ? selectedUsers : null,
        p_vi_tri_lap_dat_array: selectedLocations.length > 0 ? selectedLocations : null,
        p_tinh_trang_array: selectedStatuses.length > 0 ? selectedStatuses : null,
        p_phan_loai_array: selectedClassifications.length > 0 ? selectedClassifications : null,
      }, signal })
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const data = (equipmentRes?.data ?? []) as Equipment[]
  const total = equipmentRes?.total ?? 0
  const isLoading = isEqLoading

  // Facilities query for regional leader
  const { data: facilitiesData, isLoading: isFacilitiesLoading } = useQuery<Array<{id: number; name: string; code: string; equipment_count: number}>>({
    queryKey: ['facilities_with_equipment_count'],
    queryFn: async () => {
      const result = await callRpc<{id: number; name: string; code: string; equipment_count: number}[]>({ fn: 'get_facilities_with_equipment_count', args: {} })
      return result || []
    },
    enabled: showFacilityFilter,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const facilities = React.useMemo(() => {
    if (!showFacilityFilter || !facilitiesData) return []
    return facilitiesData.map(f => ({
      id: f.id,
      name: f.name,
      count: f.equipment_count,
    }))
  }, [showFacilityFilter, facilitiesData])

  const activeFacility = React.useMemo(() => {
    if (selectedFacilityId == null) return null
    return facilities.find((facility) => facility.id === selectedFacilityId) ?? null
  }, [facilities, selectedFacilityId])

  const isFetching = isEqFetching || isFacilitiesLoading

  // Filter options queries
  const { data: departmentsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['departments_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'departments_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const departments = React.useMemo(() =>
    (departmentsData || []).map(x => x.name).filter(Boolean),
    [departmentsData]
  )

  const { data: usersData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_users_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_users_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const users = React.useMemo(() =>
    (usersData || []).map(x => x.name).filter(Boolean),
    [usersData]
  )

  const { data: locationsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_locations_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_locations_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const locations = React.useMemo(() =>
    (locationsData || []).map(x => x.name).filter(Boolean),
    [locationsData]
  )

  const { data: classificationsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_classifications_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_classifications_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const classifications = React.useMemo(() =>
    (classificationsData || []).map(x => x.name).filter(Boolean),
    [classificationsData]
  )

  const { data: statusesData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['equipment_statuses_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'equipment_statuses_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const statuses = React.useMemo(() =>
    (statusesData || []).map(x => x.name).filter(Boolean),
    [statusesData]
  )

  // Filter data for bottom sheet
  const filterData: FilterBottomSheetData = {
    status: (statusesData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
    department: (departmentsData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
    location: (locationsData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
    user: (usersData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
    classification: (classificationsData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
  }

  // Handlers
  const handleShowDetails = React.useCallback((equipment: Equipment) => {
    setSelectedEquipment(equipment)
    setIsDetailModalOpen(true)
  }, [])

  const handleStartUsage = React.useCallback((equipment: Equipment) => {
    setStartUsageEquipment(equipment)
    setIsStartUsageDialogOpen(true)
  }, [])

  const handleEndUsage = React.useCallback((usage: UsageLog) => {
    setEndUsageLog(usage)
    setIsEndUsageDialogOpen(true)
  }, [])

  const handleDownloadTemplate = React.useCallback(async () => {
    try {
      const blob = await generateEquipmentImportTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Mau_Nhap_Thiet_Bi.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading template:', error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải template. Vui lòng thử lại.",
      })
    }
  }, [toast])

  const handleGenerateProfileSheet = React.useCallback(async (equipment: Equipment) => {
    const printContext: PrintContext = {
      tenantBranding,
      userRole: user?.role,
      equipmentTenantId: equipment.don_vi ?? undefined
    }
    await generateProfileSheet(equipment, printContext)
  }, [tenantBranding, user?.role])

  const handleGenerateDeviceLabel = React.useCallback(async (equipment: Equipment) => {
    const printContext: PrintContext = {
      tenantBranding,
      userRole: user?.role,
      equipmentTenantId: equipment.don_vi ?? undefined
    }
    await generateDeviceLabel(equipment, printContext)
  }, [tenantBranding, user?.role])

  const handleExportData = React.useCallback(async () => {
    const dataToExport = data
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu phù hợp để xuất.",
      })
      return
    }

    try {
      const dbKeysInOrder = (Object.keys(columnLabels) as Array<keyof Equipment>).filter(key => key !== 'id')
      const headers = dbKeysInOrder.map(key => columnLabels[key])

      const formattedData = dataToExport.map(item => {
        const rowData: Record<string, unknown> = {}
        dbKeysInOrder.forEach(key => {
          const header = columnLabels[key]
          const value = item[key]
          rowData[header] = value ?? ""
        })
        return rowData
      })

      const colWidths = headers.map(header => Math.max(header.length, 20))
      const fileName = `Danh_sach_thiet_bi_${new Date().toISOString().slice(0, 10)}.xlsx`

      await exportToExcel(formattedData, fileName, "Danh sách thiết bị", colWidths)

      toast({
        title: "Xuất dữ liệu thành công",
        description: `Đã tạo file ${fileName}`,
      })
    } catch (error) {
      console.error('Error exporting data:', error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
      })
    }
  }, [data, toast])

  // Cache invalidation
  const invalidateEquipmentForCurrentTenant = React.useCallback(() => {
    if (isGlobal && !shouldFetchEquipment) return
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey
        if (!Array.isArray(key)) return false
        if (key[0] !== 'equipment_list_enhanced') return false
        const params = key[1] as Record<string, unknown>
        return params?.tenant === effectiveTenantKey
      },
      refetchType: 'active',
    })
  }, [queryClient, effectiveTenantKey, isGlobal, shouldFetchEquipment])

  const onDataMutationSuccess = React.useCallback(() => {
    invalidateEquipmentForCurrentTenant()
  }, [invalidateEquipmentForCurrentTenant])

  // Facility handlers
  const handleFacilityApply = React.useCallback(() => {
    setSelectedFacilityId(pendingFacilityId ?? null)
    if (isGlobal) {
      React.startTransition(() => {
        setTenantFilter(pendingFacilityId ? String(pendingFacilityId) : 'all')
      })
    }
    setIsFacilitySheetOpen(false)
  }, [pendingFacilityId, setSelectedFacilityId, isGlobal])

  const handleFacilityClear = React.useCallback(() => {
    setPendingFacilityId(null)
    setSelectedFacilityId(null)
    if (isGlobal) {
      React.startTransition(() => {
        setTenantFilter('all')
      })
    }
    setIsFacilitySheetOpen(false)
  }, [setSelectedFacilityId, isGlobal])

  const handleFacilityCancel = React.useCallback(() => {
    setPendingFacilityId(selectedFacilityId ?? null)
    setIsFacilitySheetOpen(false)
  }, [selectedFacilityId])

  // Render actions helper
  const renderActions = React.useCallback((equipment: Equipment) => (
    <EquipmentActionsMenu
      equipment={equipment}
      user={user}
      isRegionalLeader={isRegionalLeader}
      activeUsageLogs={activeUsageLogs}
      isLoadingActiveUsage={isLoadingActiveUsage}
      onShowDetails={handleShowDetails}
      onStartUsage={handleStartUsage}
      onEndUsage={handleEndUsage}
      onCreateRepairRequest={(eq) => router.push(`/repair-requests?equipmentId=${eq.id}`)}
    />
  ), [user, isRegionalLeader, activeUsageLogs, isLoadingActiveUsage, handleShowDetails, handleStartUsage, handleEndUsage, router])

  const columns = React.useMemo(() => createEquipmentColumns({ renderActions }), [renderActions])

  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(pagination.pageSize, 1)))

  // Table setup
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: debouncedSearch,
      pagination,
    },
    manualPagination: true,
    manualFiltering: true,
    pageCount: pageCount,
  })

  const onDataMutationSuccessWithStatePreservation = React.useCallback(() => {
    const currentState = table.getState()
    const stateToSave = {
      pageIndex: currentState.pagination.pageIndex,
      pageSize: currentState.pagination.pageSize,
    }
    setPreservePageState(stateToSave)
    onDataMutationSuccess()
  }, [table, onDataMutationSuccess])

  // Effects
  // Auto-hide columns on medium screens
  React.useEffect(() => {
    if (isMediumScreen) {
      setColumnVisibility(prev => ({
        ...prev,
        model: false,
        serial: false,
        phan_loai_theo_nd98: false,
      }))
    } else {
      setColumnVisibility(prev => ({
        ...prev,
        model: true,
        serial: true,
        phan_loai_theo_nd98: true,
      }))
    }
  }, [isMediumScreen])

  // Sync pending facility when sheet opens
  React.useEffect(() => {
    if (isFacilitySheetOpen) {
      setPendingFacilityId(selectedFacilityId ?? null)
    }
  }, [isFacilitySheetOpen, selectedFacilityId])

  // Cache invalidation listeners
  React.useEffect(() => {
    const handleCacheInvalidation = () => {
      invalidateEquipmentForCurrentTenant()
    }

    window.addEventListener('equipment-cache-invalidated', handleCacheInvalidation)
    const handleTenantSwitched = () => {
      invalidateEquipmentForCurrentTenant()
    }
    window.addEventListener('tenant-switched', handleTenantSwitched as EventListener)

    return () => {
      window.removeEventListener('equipment-cache-invalidated', handleCacheInvalidation)
      window.removeEventListener('tenant-switched', handleTenantSwitched as EventListener)
    }
  }, [queryClient, invalidateEquipmentForCurrentTenant])

  // Tenant filter change effect
  React.useEffect(() => {
    if (!isGlobal) return
    invalidateEquipmentForCurrentTenant()
  }, [tenantFilter, isGlobal, queryClient, effectiveTenantKey, invalidateEquipmentForCurrentTenant])

  // Toast when applying tenant filter
  React.useEffect(() => {
    if (!isGlobal) return
    if (selectedDonViUI !== null) {
      try {
        const selectedTenant = tenantOptions.find(t => t.id === selectedDonViUI)
        const tenantName = selectedTenant ? selectedTenant.name : `Đơn vị ${selectedDonViUI}`
        toast({
          variant: 'default',
          title: '✅ Đã áp dụng bộ lọc đơn vị',
          description: `Hiển thị thiết bị thuộc ${tenantName}`
        })
      } catch { /* ignore */ }
    }
  }, [selectedDonViUI, isGlobal, toast, tenantOptions])

  // Persist tenant selection for global/admin users
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (isGlobal) {
      try { localStorage.setItem('equipment_tenant_filter', tenantFilter) } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem('equipment_tenant_filter') } catch { /* ignore */ }
    }
  }, [isGlobal, tenantFilter])

  // Restore tenant selection on first load
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isGlobal) return
    try {
      const saved = localStorage.getItem('equipment_tenant_filter')
      if (saved && (saved === 'unset' || saved === 'all' || /^\d+$/.test(saved))) {
        setTenantFilter(saved)
      }
    } catch { /* ignore */ }
  }, [isGlobal])

  // Clear column filters when tenant changes
  React.useEffect(() => {
    if (!isGlobal) return
    try {
      table.resetColumnFilters()
    } catch { /* ignore */ }
  }, [tenantFilter, isGlobal, table])

  // Handle URL parameters
  React.useEffect(() => {
    const actionParam = searchParams.get('action')
    const highlightParam = searchParams.get('highlight')

    if (actionParam === 'add') {
      setIsAddDialogOpen(true)
      router.replace('/equipment', { scroll: false })
    }

    if (highlightParam && data.length > 0) {
      const equipmentToHighlight = data.find(eq => eq.id === Number(highlightParam))
      if (equipmentToHighlight) {
        setSelectedEquipment(equipmentToHighlight)
        setIsDetailModalOpen(true)
        router.replace('/equipment', { scroll: false })

        setTimeout(() => {
          const element = document.querySelector(`[data-equipment-id="${highlightParam}"]`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
      }
    }
  }, [searchParams, router, data])

  // Pagination reset when filters change
  const filterKey = React.useMemo(() =>
    JSON.stringify({
      filters: columnFilters,
      search: debouncedSearch,
      facility: selectedFacilityId,
      tenant: selectedDonVi
    }),
    [columnFilters, debouncedSearch, selectedFacilityId, selectedDonVi]
  )
  const [lastFilterKey, setLastFilterKey] = React.useState(filterKey)

  React.useEffect(() => {
    if (filterKey !== lastFilterKey && pagination.pageIndex > 0) {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
      setLastFilterKey(filterKey)
    } else if (filterKey !== lastFilterKey) {
      setLastFilterKey(filterKey)
    }
  }, [filterKey, lastFilterKey, pagination.pageIndex])

  // Restore table state after data changes
  React.useEffect(() => {
    if (preservePageState && !isLoading && data.length > 0) {
      setTimeout(() => {
        table.setPageIndex(preservePageState.pageIndex)
        table.setPageSize(preservePageState.pageSize)
        setPreservePageState(null)
      }, 150)
    }
  }, [preservePageState, isLoading, data.length, table])

  const isFiltered = table.getState().columnFilters.length > 0
  const hasFacilityFilter = showFacilityFilter && selectedFacilityId !== null

  return {
    // Session/Auth
    user,
    status,
    isGlobal,
    isRegionalLeader,

    // Router
    router,

    // Data
    data,
    total,
    isLoading,
    isFetching,
    shouldFetchEquipment,

    // Table
    table,
    columns,
    pagination,
    setPagination,
    pageCount,
    columnVisibility,
    setColumnVisibility,

    // Filters
    searchTerm,
    setSearchTerm,
    columnFilters,
    setColumnFilters,
    isFiltered,

    // Filter options
    departments,
    users,
    statuses,
    classifications,
    filterData,

    // Facility filter
    showFacilityFilter,
    facilities,
    selectedFacilityId,
    setSelectedFacilityId,
    activeFacility,
    hasFacilityFilter,
    isFacilitiesLoading,

    // Facility sheet
    isFacilitySheetOpen,
    setIsFacilitySheetOpen,
    pendingFacilityId,
    setPendingFacilityId,
    handleFacilityApply,
    handleFacilityClear,
    handleFacilityCancel,

    // Dialogs
    isAddDialogOpen,
    setIsAddDialogOpen,
    isImportDialogOpen,
    setIsImportDialogOpen,
    editingEquipment,
    setEditingEquipment,
    selectedEquipment,
    setSelectedEquipment,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isStartUsageDialogOpen,
    setIsStartUsageDialogOpen,
    startUsageEquipment,
    setStartUsageEquipment,
    isEndUsageDialogOpen,
    setIsEndUsageDialogOpen,
    endUsageLog,
    setEndUsageLog,

    // Filter sheet
    isFilterSheetOpen,
    setIsFilterSheetOpen,

    // Columns dialog
    isColumnsDialogOpen,
    setIsColumnsDialogOpen,

    // Handlers
    handleShowDetails,
    handleStartUsage,
    handleEndUsage,
    handleDownloadTemplate,
    handleExportData,
    handleGenerateProfileSheet,
    handleGenerateDeviceLabel,
    onDataMutationSuccess,
    onDataMutationSuccessWithStatePreservation,

    // UI state
    isMobile,
    isCardView,
    useTabletFilters,

    // Branding
    tenantBranding: tenantBranding ?? undefined,
  }
}
