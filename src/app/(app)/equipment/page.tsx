"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronDown,
  Building2,
  Loader2,
  Plus,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type Equipment } from "@/types/database"
import { callRpc } from "@/lib/rpc-client"
import { useEquipmentRealtimeSync } from "@/hooks/use-realtime-sync"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { ImportEquipmentDialog } from "@/components/import-equipment-dialog"
import { useSession } from "next-auth/react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { EditEquipmentDialog } from "@/components/edit-equipment-dialog"
import { FilterBottomSheet } from "@/components/equipment/filter-bottom-sheet"
import { generateProfileSheet, generateDeviceLabel, type PrintContext } from "@/components/equipment/equipment-print-utils"
import {
  columnLabels,
  equipmentStatusOptions,
  filterableColumns,
  getStatusVariant,
  getClassificationVariant,
  createEquipmentColumns
} from "@/components/equipment/equipment-table-columns"
import { EquipmentActionsMenu } from "@/components/equipment/equipment-actions-menu"
import { EquipmentPagination } from "@/components/equipment/equipment-pagination"
import { FacilityFilterSheet } from "@/components/equipment/facility-filter-sheet"
import { EquipmentToolbar } from "@/components/equipment/equipment-toolbar"
import { EquipmentDetailDialog } from "@/components/equipment/equipment-detail-dialog"
import { ResponsivePaginationInfo } from "@/components/responsive-pagination-info"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMediaQuery } from "@/hooks/use-media-query"
import { exportArrayToExcel, exportToExcel } from "@/lib/excel-utils"
import { UsageHistoryTab } from "@/components/usage-history-tab"
import { StartUsageDialog } from "@/components/start-usage-dialog"
import { EndUsageDialog } from "@/components/end-usage-dialog"
import { ActiveUsageIndicator } from "@/components/active-usage-indicator"
import { MobileUsageActions } from "@/components/mobile-usage-actions"
import { useSearchDebounce } from "@/hooks/use-debounce"
// Auto department filter removed
import { MobileEquipmentListItem } from "@/components/mobile-equipment-list-item"
import { callRpc as rpc } from "@/lib/rpc-client"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import type { UsageLog } from "@/types/database"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"


export default function EquipmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const isRegionalLeader = (user as any)?.role === 'regional_leader'
  const { toast } = useToast()
  const { data: tenantBranding } = useTenantBranding()
  // Global/admin role check computed early so hooks below can depend on it safely
  const isGlobal = (user as any)?.role === 'global' || (user as any)?.role === 'admin'

  // Redirect if not authenticated
  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  // Enable realtime sync to invalidate cache on external changes
  // TODO: Temporarily disabled - uncomment to re-enable
  // useEquipmentRealtimeSync()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)
  const [isFacilitySheetOpen, setIsFacilitySheetOpen] = React.useState(false)
  const [pendingFacilityId, setPendingFacilityId] = React.useState<number | null>(null)
  const debouncedSearch = useSearchDebounce(searchTerm)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false)
  const [selectedEquipment, setSelectedEquipment] = React.useState<Equipment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [isStartUsageDialogOpen, setIsStartUsageDialogOpen] = React.useState(false)
  const [startUsageEquipment, setStartUsageEquipment] = React.useState<Equipment | null>(null);
  const [isEndUsageDialogOpen, setIsEndUsageDialogOpen] = React.useState(false)
  const [endUsageLog, setEndUsageLog] = React.useState<UsageLog | null>(null)
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | null>(null)

  // Moved from below to fix variable declaration order
  const tenantKey = (user as any)?.don_vi ? String((user as any).don_vi) : 'none'
  const [tenantFilter, setTenantFilter] = React.useState<string>(() => (isGlobal ? 'unset' : tenantKey))
  const selectedDonViUI = React.useMemo(() => {
    if (!isGlobal) return null
    if (tenantFilter === 'all') return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobal, tenantFilter])

  // Regional leader tenant filtering state (server mode via shared hook)
const { showFacilityFilter, selectedFacilityId, setSelectedFacilityId } = useFacilityFilter({
    mode: 'server',
    userRole: (user?.role as string) || 'user',
  })

  // Optimized active usage logs with tenant filtering and reduced polling
  const currentTenantId = React.useMemo(() => {
    if (!isGlobal) return user?.don_vi ? Number(user.don_vi) : null
    // For global users, use the selected tenant filter if available
    if (selectedDonViUI !== null) return selectedDonViUI
    return null // Global users see all by default
  }, [isGlobal, user?.don_vi, selectedDonViUI])
  
  const { data: activeUsageLogs, isLoading: isLoadingActiveUsage } = useActiveUsageLogs({
    tenantId: currentTenantId,
    enabled: true,
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes instead of 10 seconds
  })

  const isMobile = useIsMobile();
  const useTabletFilters = useMediaQuery("(min-width: 768px) and (max-width: 1024px)");
  // Card view breakpoint (switch to cards below 1280px)
  const isCardView = useMediaQuery("(max-width: 1279px)");

  // Columns dialog state for unified toolbar "Tùy chọn"
  const [isColumnsDialogOpen, setIsColumnsDialogOpen] = React.useState(false);

  // State to preserve pagination during data reload
  const [preservePageState, setPreservePageState] = React.useState<{
    pageIndex: number;
    pageSize: number;
  } | null>(null);

  // Medium screen detection using useMediaQuery hook for better performance
  // Target tablet and small laptop screens (768px - 1800px) where column space is limited
  // This covers most 12-15 inch laptops and tablets in landscape mode
  const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1800px)");

  // Load tenant options for global select using TanStack Query
  const { data: tenantList, isLoading: isTenantsLoading } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ['tenant_list'],
    queryFn: async () => {
      const list = await rpc<any[]>({ fn: 'tenant_list', args: {} })
      return (list || []).map((t: any) => ({ id: t.id, name: t.name, code: t.code }))
    },
    enabled: isGlobal,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const tenantOptions = (tenantList ?? []) as { id: number; name: string; code: string }[]

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    id: false,
    ma_thiet_bi: true,           // Mã thiết bị ✅
    ten_thiet_bi: true,          // Tên thiết bị ✅
    model: true,                 // Model ✅
    serial: true,                // Serial ✅
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
    vi_tri_lap_dat: true,        // Vị trí lắp đặt ✅
    nguoi_dang_truc_tiep_quan_ly: true,  // Người sử dụng ✅
    khoa_phong_quan_ly: true,    // Khoa/phòng ✅
    tinh_trang_hien_tai: true,   // Tình trạng ✅
    ghi_chu: false,
    chu_ky_bt_dinh_ky: false,
    ngay_bt_tiep_theo: false,
    chu_ky_hc_dinh_ky: false,
    ngay_hc_tiep_theo: false,
    chu_ky_kd_dinh_ky: false,
    ngay_kd_tiep_theo: false,
    phan_loai_theo_nd98: true,   // Phân loại theo NĐ98 ✅
  });

  // Auto-hide columns on medium screens
  React.useEffect(() => {
    if (isMediumScreen) {
      setColumnVisibility(prev => ({
        ...prev,
        model: false,                // Hide Model on medium screens
        serial: false,               // Hide Serial on medium screens
        phan_loai_theo_nd98: false,  // Hide Phân loại theo NĐ98 on medium screens
      }));
    } else {
      // Restore default visibility when not on medium screen
      setColumnVisibility(prev => ({
        ...prev,
        model: true,                 // Show Model on other screens
        serial: true,                // Show Serial on other screens
        phan_loai_theo_nd98: true,   // Show Phân loại theo NĐ98 on other screens
      }));
    }
  }, [isMediumScreen]);

  const handleDownloadTemplate = async () => {
    try {
      const templateHeaders = Object.entries(columnLabels)
        .filter(([key]) => key !== 'id')
        .map(([, label]) => label);

      const colWidths = templateHeaders.map(header => Math.max(header.length, 25));

      await exportArrayToExcel(
        [templateHeaders],
        "Mau_Nhap_Thiet_Bi.xlsx",
        "Template Thiết Bị",
        colWidths
      );
    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải template. Vui lòng thử lại.",
      });
    }
  };

  const handleGenerateProfileSheet = async (equipment: Equipment) => {
    const printContext: PrintContext = {
      tenantBranding,
      userRole: user?.role,
      equipmentTenantId: equipment.don_vi ?? undefined
    }
    await generateProfileSheet(equipment, printContext)
  }

  const handleGenerateDeviceLabel = async (equipment: Equipment) => {
    const printContext: PrintContext = {
      tenantBranding,
      userRole: user?.role,
      equipmentTenantId: equipment.don_vi ?? undefined
    }
    await generateDeviceLabel(equipment, printContext)
  }

  const handleShowDetails = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsDetailModalOpen(true);
  };

  const handleStartUsage = (equipment: Equipment) => {
    setStartUsageEquipment(equipment);
    setIsStartUsageDialogOpen(true);
  };

  const handleEndUsage = (usage: UsageLog) => {
    setEndUsageLog(usage);
    setIsEndUsageDialogOpen(true);
  };

  const renderActions = (equipment: Equipment) => (
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
  );

  const columns = createEquipmentColumns({ renderActions })

  // Moved above to fix variable declaration order - these are now declared earlier
  const shouldFetchEquipment = React.useMemo(() => {
    if (!isGlobal) return true
    if (tenantFilter === 'all') return true
    return /^\d+$/.test(tenantFilter)
  }, [isGlobal, tenantFilter])
  const effectiveTenantKey = isGlobal ? (shouldFetchEquipment ? tenantFilter : 'unset') : tenantKey


  // Equipment list query (TanStack Query) - server-side pagination via equipment_list_enhanced
  type EquipmentListRes = { data: Equipment[]; total: number; page: number; pageSize: number }

  // Server-side pagination state for all users (global, regional leader, etc.)
  // Regional leaders will filter by facility via p_don_vi parameter
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

  // Always use server-side pagination for all users
  const effectivePageSize = pagination.pageSize
  const effectivePage = pagination.pageIndex + 1

  // Extract server-filterable values from columnFilters
  const getSingleFilter = React.useCallback((id: string): string | null => {
    const entry = (columnFilters || []).find((f) => f.id === id)
    const vals = (entry?.value as string[] | undefined) || []
    return vals.length === 1 ? vals[0] : null
  }, [columnFilters])

  // Get array of selected values for multi-select filters
  const getArrayFilter = React.useCallback((id: string): string[] => {
    const entry = (columnFilters || []).find((f) => f.id === id)
    return (entry?.value as string[] | undefined) || []
  }, [columnFilters])

  const selectedDonVi = React.useMemo(() => {
    // Regional leaders: use selected facility ID for server-side filtering
    if (isRegionalLeader) return selectedFacilityId
    // Global users: use tenant filter dropdown
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

  const selectedDepartments = getArrayFilter('khoa_phong_quan_ly')
  const selectedUsers = getArrayFilter('nguoi_dang_truc_tiep_quan_ly')
  const selectedLocations = getArrayFilter('vi_tri_lap_dat')
  const selectedStatuses = getArrayFilter('tinh_trang_hien_tai')
  const selectedClassifications = getArrayFilter('phan_loai_theo_nd98')
  
  const { data: equipmentRes, isLoading: isEqLoading, isFetching: isEqFetching } = useQuery<EquipmentListRes>({
    queryKey: ['equipment_list_enhanced', {
      tenant: effectiveTenantKey,
      donVi: selectedDonVi, // ← Include facility filter in cache key for regional leaders
      page: pagination.pageIndex, // Always cache by page (server-side pagination for all users)
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

  // Data is already server-filtered by facility for regional leaders via p_don_vi parameter
  const data = (equipmentRes?.data ?? []) as Equipment[]
  const total = equipmentRes?.total ?? 0
  const isLoading = isEqLoading

  // Load facilities for regional leader filtering using dedicated RPC
const { data: facilitiesData, isLoading: isFacilitiesLoading } = useQuery<Array<{id: number; name: string; code: string; equipment_count: number}>>({
  queryKey: ['facilities_with_equipment_count'],
  queryFn: async () => {
    const result = await rpc<any>({ fn: 'get_facilities_with_equipment_count', args: {} })
    return result || []
  },
  enabled: showFacilityFilter,
  staleTime: 300_000, // 5 minutes
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

  React.useEffect(() => {
    if (isFacilitySheetOpen) {
      setPendingFacilityId(selectedFacilityId ?? null)
    }
  }, [isFacilitySheetOpen, selectedFacilityId])

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

  const isFetching = isEqFetching || isFacilitiesLoading

  // Granular cache invalidation for current tenant
  const invalidateEquipmentForCurrentTenant = React.useCallback(() => {
    if (isGlobal && !shouldFetchEquipment) return
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = (q as any)?.queryKey
        if (!Array.isArray(key)) return false
        if (key[0] !== 'equipment_list_enhanced') return false
        const params = key[1] as any
        return params?.tenant === effectiveTenantKey
      },
      refetchType: 'active',
    })
  }, [queryClient, effectiveTenantKey, isGlobal, shouldFetchEquipment])


  const onDataMutationSuccess = React.useCallback(() => {
    // Invalidate only current-tenant queries
    invalidateEquipmentForCurrentTenant()
  }, [invalidateEquipmentForCurrentTenant]);

  // Listen for realtime cache invalidation events (invalidate queries)
  React.useEffect(() => {
    const handleCacheInvalidation = () => {
      console.log('[EquipmentPage] Cache invalidated by realtime, invalidating equipment_list_enhanced...')
      invalidateEquipmentForCurrentTenant()
    };

    window.addEventListener('equipment-cache-invalidated', handleCacheInvalidation);
    const handleTenantSwitched = () => {
      console.log('[EquipmentPage] Tenant switched, invalidating equipment_list_enhanced...')
      invalidateEquipmentForCurrentTenant()
    }
    window.addEventListener('tenant-switched', handleTenantSwitched as EventListener)

    return () => {
      window.removeEventListener('equipment-cache-invalidated', handleCacheInvalidation);
      window.removeEventListener('tenant-switched', handleTenantSwitched as EventListener)
    };
  }, [queryClient, invalidateEquipmentForCurrentTenant]);


  // Debug: log when tenant filter changes
  React.useEffect(() => {
    if (!isGlobal) return
    console.log('[EquipmentPage] tenantFilter changed ->', tenantFilter)
    // Refetch equipment list when filter changes by invalidating queries for current tenant
    invalidateEquipmentForCurrentTenant()
  }, [tenantFilter, isGlobal, queryClient, effectiveTenantKey, invalidateEquipmentForCurrentTenant])

  // Show a user-friendly toast when applying specific tenant filter
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
      } catch {}
    }
  }, [selectedDonViUI, isGlobal, toast, tenantOptions])

  // Log when refetch effect triggers due to tenant changes
  React.useEffect(() => {
    if (!isGlobal) return
    console.log('[EquipmentPage] Refetch effect triggered for tenantFilter:', tenantFilter)
  }, [tenantFilter, isGlobal])

  // Persist tenant selection for global/admin users
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (isGlobal) {
      try { localStorage.setItem('equipment_tenant_filter', tenantFilter) } catch {}
    } else {
      try { localStorage.removeItem('equipment_tenant_filter') } catch {}
    }
  }, [isGlobal, tenantFilter])

  // Restore tenant selection on first load for global/admin
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isGlobal) return
    try {
      const saved = localStorage.getItem('equipment_tenant_filter')
      if (saved && (saved === 'unset' || saved === 'all' || /^\d+$/.test(saved))) {
        setTenantFilter(saved)
      }
    } catch {}
  }, [isGlobal])

  // When tenant filter changes for global users, clear column filters to avoid cross-tenant stale filters causing empty results
  React.useEffect(() => {
    if (!isGlobal) return
    try {
      table.resetColumnFilters()
    } catch {}
  }, [tenantFilter, isGlobal])

  // Handle URL parameters for quick actions
  React.useEffect(() => {
    const actionParam = searchParams.get('action')
    const highlightParam = searchParams.get('highlight')
    const tabParam = searchParams.get('tab')
    
    if (actionParam === 'add') {
      setIsAddDialogOpen(true)
      // Clear URL params after opening dialog
      router.replace('/equipment', { scroll: false })
    }
    
    // Handle QR Scanner highlights
    if (highlightParam && data.length > 0) {
      const equipmentToHighlight = data.find(eq => eq.id === Number(highlightParam))
      if (equipmentToHighlight) {
        setSelectedEquipment(equipmentToHighlight)
        setIsDetailModalOpen(true)

        // Clear URL params after opening modal
        router.replace('/equipment', { scroll: false })
        
        // Auto scroll to equipment in table (with delay for modal to open)
        setTimeout(() => {
          const element = document.querySelector(`[data-equipment-id="${highlightParam}"]`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
      }
    }
  }, [searchParams, router, data])

  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(pagination.pageSize, 1)))

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Remove client-side filtering since we use server-side filtering
    // getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    // Remove faceted models since they're for client-side filtering
    // getFacetedRowModel: getFacetedRowModel(),
    // getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: debouncedSearch,
      pagination,
    },
    // All users use server-side pagination and filtering
    manualPagination: true,
    manualFiltering: true, // Enable server-side filtering
    pageCount: pageCount,
  })
  
  // Reset pagination to page 1 when filters change (including facility filter for regional leaders)
  const filterKey = React.useMemo(() => 
    JSON.stringify({ 
      filters: columnFilters, 
      search: debouncedSearch,
      facility: selectedFacilityId, // Include facility in filter key for regional leaders
      tenant: selectedDonVi // Include tenant for global users
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
  
  // Auto department filter removed; no role-based table filter adjustments
  
  // Restore table state after data changes
  React.useEffect(() => {
    if (preservePageState && !isLoading && data.length > 0) {
      setTimeout(() => {
        table.setPageIndex(preservePageState.pageIndex);
        table.setPageSize(preservePageState.pageSize);
        setPreservePageState(null);
      }, 150);
    }
  }, [preservePageState, isLoading, data.length, table]);
  
  const onDataMutationSuccessWithStatePreservation = React.useCallback(() => {
    const currentState = table.getState();
    const stateToSave = {
      pageIndex: currentState.pagination.pageIndex,
      pageSize: currentState.pagination.pageSize,
    };
    setPreservePageState(stateToSave);
    onDataMutationSuccess();
  }, [table, onDataMutationSuccess]);
  
  const handleExportData = async () => {
    // Use server-filtered data instead of client-side filtered model
    const dataToExport = data; // This is already server-filtered
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu phù hợp để xuất.",
      });
      return;
    }

    try {

      const dbKeysInOrder = (Object.keys(columnLabels) as Array<keyof Equipment>).filter(key => key !== 'id');
      const headers = dbKeysInOrder.map(key => columnLabels[key]);

      const formattedData = dataToExport.map(item => {
          const rowData: Record<string, any> = {};
          dbKeysInOrder.forEach(key => {
              const header = columnLabels[key];
              let value = item[key];
              rowData[header] = value ?? "";
          });
          return rowData;
      });

      const colWidths = headers.map(header => Math.max(header.length, 20));
      const fileName = `Danh_sach_thiet_bi_${new Date().toISOString().slice(0,10)}.xlsx`;

      await exportToExcel(formattedData, fileName, "Danh sách thiết bị", colWidths);

      toast({
        title: "Xuất dữ liệu thành công",
        description: `Đã tạo file ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
      });
    }
  };

  // Load departments for current tenant via RPC (tenant-aware filtering)
  const { data: departmentsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['departments_list_for_tenant', selectedDonVi],
    queryFn: async () => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: 'departments_list_for_tenant',
        args: { p_don_vi: selectedDonVi }
      })
      return result || []
    },
    enabled: shouldFetchEquipment, // Same gating as equipment query
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const departments = React.useMemo(() => 
    (departmentsData || []).map(x => x.name).filter(Boolean),
    [departmentsData]
  )

  // Load all filter options via tenant-aware RPCs
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
  
  const isFiltered = table.getState().columnFilters.length > 0;
const hasFacilityFilter = showFacilityFilter && selectedFacilityId !== null;

  const renderContent = () => {
    if (isGlobal && !shouldFetchEquipment) {
      return (
        <div className="p-4 border rounded-md bg-muted/30 text-sm text-muted-foreground">
          Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị
        </div>
      )
    }
    if (isLoading) {
      return isCardView ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-start justify-between pb-4">
                <div>
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <Skeleton className="h-5 w-full" />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns.length}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (table.getRowModel().rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          Không tìm thấy kết quả phù hợp
        </div>
      );
    }

    return isCardView ? (
      <div className="relative space-y-3">
        {isFetching && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {table.getRowModel().rows.map((row) => (
          <MobileEquipmentListItem
            key={row.original.id}
            equipment={row.original}
            onShowDetails={handleShowDetails}
            onEdit={setEditingEquipment}
          />
        ))}
      </div>
    ) : (
      <div className="relative overflow-x-auto rounded-md border">
        {isFetching && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted hover:bg-muted">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                data-equipment-id={row.original.id}
                className="hover:bg-muted cursor-pointer"
                onClick={() => handleShowDetails(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
       <AddEquipmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={onDataMutationSuccessWithStatePreservation}
      />
      <ImportEquipmentDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={onDataMutationSuccessWithStatePreservation}
      />
      <EditEquipmentDialog
        open={!!editingEquipment}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEquipment(null);
          }
        }}
        onSuccess={() => {
          setEditingEquipment(null);
          onDataMutationSuccessWithStatePreservation();
        }}
        equipment={editingEquipment}
      />
      <EquipmentDetailDialog
        equipment={selectedEquipment}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        user={user}
        isRegionalLeader={isRegionalLeader}
        onGenerateProfileSheet={handleGenerateProfileSheet}
        onGenerateDeviceLabel={handleGenerateDeviceLabel}
        onEquipmentUpdated={onDataMutationSuccessWithStatePreservation}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="heading-responsive-h2">Danh mục thiết bị</CardTitle>
              <CardDescription className="body-responsive-sm">
                Quản lý danh sách các trang thiết bị y tế.
              </CardDescription>
            </div>
            
            {/* Facility filter (global + regional leader) */}
            {showFacilityFilter && (
              <div className="flex w-full max-w-md items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex h-10 flex-1 items-center justify-start gap-2 rounded-xl border border-dashed px-3"
                  onClick={() => setIsFacilitySheetOpen(true)}
                  disabled={isFacilitiesLoading}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-left text-sm font-medium">
                    {activeFacility ? activeFacility.name : "Tất cả cơ sở"}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {activeFacility ? `${activeFacility.count ?? 0} TB` : `${facilities.length || 0} cơ sở`}
                  </Badge>
                </Button>
              </div>
            )}
          </div>

          {/* Department auto-filter removed */}
        </CardHeader>
        <CardContent className="space-y-4 px-4 md:px-6">
          {/* Unified toolbar */}
          <EquipmentToolbar
            table={table}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            columnFilters={columnFilters}
            isFiltered={isFiltered}
            statuses={statuses}
            departments={departments}
            users={users}
            classifications={classifications}
            isMobile={isMobile}
            useTabletFilters={useTabletFilters}
            isRegionalLeader={isRegionalLeader}
            hasFacilityFilter={hasFacilityFilter}
            onOpenFilterSheet={() => setIsFilterSheetOpen(true)}
            onOpenColumnsDialog={() => setIsColumnsDialogOpen(true)}
            onDownloadTemplate={handleDownloadTemplate}
            onExportData={handleExportData}
            onAddEquipment={() => setIsAddDialogOpen(true)}
            onImportEquipment={() => setIsImportDialogOpen(true)}
            onClearFacilityFilter={() => setSelectedFacilityId(null)}
          />

          {/* Columns dialog */}
          <Dialog open={isColumnsDialogOpen} onOpenChange={setIsColumnsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hiện/Ẩn cột</DialogTitle>
                <DialogDescription>Chọn các cột muốn hiển thị trong bảng.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto space-y-1">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <div key={column.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground">
                        {columnLabels[column.id as keyof Equipment] || column.id}
                      </span>
                      <Button
                        variant={column.getIsVisible() ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7"
                        onClick={() => column.toggleVisibility(!column.getIsVisible())}
                      >
                        {column.getIsVisible() ? 'Ẩn' : 'Hiện'}
                      </Button>
                    </div>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsColumnsDialogOpen(false)}>Đóng</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-4">
            {renderContent()}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 py-4 px-4 md:px-6 sm:flex-row sm:items-center sm:justify-between">
          <EquipmentPagination
            table={table}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            currentCount={data.length}
            totalCount={total}
            onExportData={handleExportData}
            isLoading={isEqLoading}
            shouldFetchEquipment={shouldFetchEquipment}
          />
        </CardFooter>
      </Card>

      {/* Floating Add Button - Mobile only */}
      {!isRegionalLeader && (
        <div className="fixed bottom-20 right-6 md:hidden z-[100]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="lg" 
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Plus className="h-6 w-6" />
                <span className="sr-only">Thêm thiết bị</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              <DropdownMenuItem onSelect={() => setIsAddDialogOpen(true)}>
                Thêm thủ công
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsImportDialogOpen(true)}>
                Nhập từ Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <StartUsageDialog
        open={isStartUsageDialogOpen}
        onOpenChange={(open) => {
          setIsStartUsageDialogOpen(open);
          if (!open) {
            setStartUsageEquipment(null);
          }
        }}
        equipment={startUsageEquipment}
      />

      <EndUsageDialog
        open={isEndUsageDialogOpen}
        onOpenChange={(open) => {
          setIsEndUsageDialogOpen(open)
          if (!open) setEndUsageLog(null)
        }}
        usageLog={endUsageLog}
      />

      <FilterBottomSheet
        open={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        data={{
          status: (statusesData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
          department: (departmentsData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
          location: (locationsData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
          user: (usersData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
          classification: (classificationsData || []).map(x => ({ id: x.name, label: x.name, count: x.count })),
        }}
        columnFilters={columnFilters}
        onApply={setColumnFilters}
        onClearAll={() => setColumnFilters([])}
      />

      <FacilityFilterSheet
        open={isFacilitySheetOpen}
        onOpenChange={setIsFacilitySheetOpen}
        facilities={facilities}
        isLoading={isFacilitiesLoading}
        selectedFacilityId={selectedFacilityId}
        pendingFacilityId={pendingFacilityId}
        onPendingChange={setPendingFacilityId}
        onApply={handleFacilityApply}
        onClear={handleFacilityClear}
        onCancel={handleFacilityCancel}
        totalEquipmentCount={total}
      />

    </>
  )
}
