"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit,
  FileText,
  Filter,
  Loader2,
  Play,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Undo2,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { AddTransferDialog } from "@/components/add-transfer-dialog"
import { EditTransferDialog } from "@/components/edit-transfer-dialog"
import { HandoverPreviewDialog } from "@/components/handover-preview-dialog"
import { OverdueTransfersAlert } from "@/components/overdue-transfers-alert"
import { ResponsivePaginationInfo } from "@/components/responsive-pagination-info"
import { TransferDetailDialog } from "@/components/transfer-detail-dialog"
import { TransferCard } from "@/components/transfers/TransferCard"
import { TransferStatusBadges } from "@/components/transfers/TransferStatusBadges"
import { TransferTypeTabs, useTransferTypeTab } from "@/components/transfers/TransferTypeTabs"
import { getColumnsForType } from "@/components/transfers/columnDefinitions"
import { FilterModal } from "@/components/transfers/FilterModal"
import { FilterChips } from "@/components/transfers/FilterChips"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useTransferList, useTransferCounts } from "@/hooks/useTransferDataGrid"
import { useTransferSearch } from "@/hooks/useTransferSearch"
import { callRpc } from "@/lib/rpc-client"
import type {
  TransferListFilters,
  TransferListItem,
  TransferStatus,
} from "@/types/transfers-data-grid"
import { type TransferRequest } from "@/types/database"

export default function TransfersPage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const user = session?.user as any
  const router = useRouter()
  const isMobile = useIsMobile()

  const isRegionalLeader = user?.role === "regional_leader"
  const isTransferCoreRole =
    user?.role === "global" || user?.role === "admin" || user?.role === "to_qltb"

  const notifyRegionalLeaderRestricted = React.useCallback(() => {
    toast({
      variant: "destructive",
      title: "Không thể thực hiện",
      description: "Vai trò Trưởng vùng chỉ được xem yêu cầu luân chuyển.",
    })
  }, [toast])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  const { data: facilityOptionsData } = useQuery<Array<{ id: number; name: string }>>(
    {
      queryKey: ["transfer_request_facilities"],
      queryFn: async () => {
        try {
          if (!user) return []
          const result = await callRpc<Array<{ id: number; name: string }>>(
            {
              fn: "get_transfer_request_facilities",
              args: {},
            }
          )
          return result || []
        } catch (error) {
          console.error("[transfers] Failed to fetch facility options:", error)
          return []
        }
      },
      enabled: !!user,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    }
  )

  const { selectedFacilityId, setSelectedFacilityId: setFacilityId, showFacilityFilter } =
    useFacilityFilter({
      mode: "server",
      userRole: (user?.role as string) || "user",
      facilities: facilityOptionsData || [],
    })

  const [activeTab, setActiveTab] = useTransferTypeTab("noi_bo")
  const { searchTerm, setSearchTerm, debouncedSearch, clearSearch } = useTransferSearch()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })
  const [statusFilter, setStatusFilter] = React.useState<TransferStatus[]>([])
  const [dateRange, setDateRange] = React.useState<{ from: Date | null; to: Date | null } | null>(
    null,
  )
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false)
  const [tempFacilityId, setTempFacilityId] = React.useState<number | null>(null)
  const [isFacilitySheetOpen, setIsFacilitySheetOpen] = React.useState(false)

  const filters = React.useMemo<TransferListFilters>(() => {
    return {
      statuses: statusFilter,
      types: [activeTab],
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      q: debouncedSearch || undefined,
      facilityId: selectedFacilityId ?? null,
      dateFrom: dateRange?.from?.toISOString().split("T")[0] || undefined,
      dateTo: dateRange?.to?.toISOString().split("T")[0] || undefined,
    }
  }, [activeTab, pagination, debouncedSearch, selectedFacilityId, statusFilter, dateRange])

  const countsFilters = React.useMemo<TransferListFilters>(() => {
    const { statuses: _statuses, page: _page, pageSize: _pageSize, ...rest } = filters
    return { ...rest }
  }, [filters])

  const {
    data: transferList,
    isLoading: isListLoading,
    isFetching: isListFetching,
    refetch: refetchList,
  } = useTransferList(filters, {
    placeholderData: (previous) => previous,
  })

  const {
    data: statusCounts,
    isLoading: isCountsLoading,
    refetch: refetchCounts,
  } = useTransferCounts(countsFilters)

  const tableData = transferList?.data ?? []
  const totalCount = transferList?.total ?? 0
  const pageSize = transferList?.pageSize ?? pagination.pageSize
  const pageCount = transferList ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1

  const referenceDate = React.useMemo(() => new Date(), [])

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTransfer, setEditingTransfer] = React.useState<TransferRequest | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false)
  const [detailTransfer, setDetailTransfer] = React.useState<TransferRequest | null>(null)
  const [handoverDialogOpen, setHandoverDialogOpen] = React.useState(false)
  const [handoverTransfer, setHandoverTransfer] = React.useState<TransferRequest | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingTransfer, setDeletingTransfer] = React.useState<TransferListItem | null>(null)

  const mapToTransferRequest = React.useCallback(
    (item: TransferListItem): TransferRequest => ({
      id: item.id,
      ma_yeu_cau: item.ma_yeu_cau,
      thiet_bi_id: item.thiet_bi_id,
      loai_hinh: item.loai_hinh,
      trang_thai: item.trang_thai,
      nguoi_yeu_cau_id: item.nguoi_yeu_cau_id ?? undefined,
      ly_do_luan_chuyen: item.ly_do_luan_chuyen,
      khoa_phong_hien_tai: item.khoa_phong_hien_tai ?? undefined,
      khoa_phong_nhan: item.khoa_phong_nhan ?? undefined,
      muc_dich: item.muc_dich ?? undefined,
      don_vi_nhan: item.don_vi_nhan ?? undefined,
      dia_chi_don_vi: item.dia_chi_don_vi ?? undefined,
      nguoi_lien_he: item.nguoi_lien_he ?? undefined,
      so_dien_thoai: item.so_dien_thoai ?? undefined,
      ngay_du_kien_tra: item.ngay_du_kien_tra ?? undefined,
      ngay_ban_giao: item.ngay_ban_giao ?? undefined,
      ngay_hoan_tra: item.ngay_hoan_tra ?? undefined,
      ngay_hoan_thanh: item.ngay_hoan_thanh ?? undefined,
      nguoi_duyet_id: item.nguoi_duyet_id ?? undefined,
      ngay_duyet: item.ngay_duyet ?? undefined,
      ghi_chu_duyet: item.ghi_chu_duyet ?? undefined,
      created_at: item.created_at,
      updated_at: item.updated_at ?? item.created_at,
      created_by: item.created_by ?? undefined,
      updated_by: item.updated_by ?? undefined,
      thiet_bi: item.thiet_bi
        ? {
          id: item.thiet_bi_id,
          ten_thiet_bi: item.thiet_bi.ten_thiet_bi ?? "",
          ma_thiet_bi: item.thiet_bi.ma_thiet_bi ?? "",
          model: item.thiet_bi.model ?? undefined,
          serial: item.thiet_bi.serial ?? undefined,
          serial_number: item.thiet_bi.serial ?? undefined,
          khoa_phong_quan_ly: item.thiet_bi.khoa_phong_quan_ly ?? undefined,
          don_vi: item.thiet_bi.facility_id ?? undefined,
          facility_name: item.thiet_bi.facility_name ?? undefined,
          facility_id: item.thiet_bi.facility_id ?? undefined,
          tinh_trang: null,
        }
        : null,
      nguoi_yeu_cau: undefined,
      nguoi_duyet: undefined,
      created_by_user: undefined,
      updated_by_user: undefined,
    }),
    [],
  )

  const canEditTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (!user || isRegionalLeader) return false
      const deptMatch =
        user.role === "qltb_khoa" &&
        (user.khoa_phong === item.khoa_phong_hien_tai || user.khoa_phong === item.khoa_phong_nhan)
      const allowedRole = isTransferCoreRole || deptMatch
      return (
        allowedRole && (item.trang_thai === "cho_duyet" || item.trang_thai === "da_duyet")
      )
    },
    [isRegionalLeader, isTransferCoreRole, user],
  )

  const canDeleteTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (!user || isRegionalLeader) return false
      const deptMatch = user.role === "qltb_khoa" && user.khoa_phong === item.khoa_phong_hien_tai
      const allowedRole = isTransferCoreRole || deptMatch
      return allowedRole && item.trang_thai === "cho_duyet"
    },
    [isRegionalLeader, isTransferCoreRole, user],
  )

  const setSelectedFacilityId = React.useCallback(
    (id: number | null) => {
      setFacilityId(id)
    },
    [setFacilityId],
  )

  React.useEffect(() => {
    setStatusFilter([])
  }, [activeTab])

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [activeTab, selectedFacilityId, debouncedSearch, statusFilter, dateRange])

  const handleToggleStatus = React.useCallback((status: TransferStatus) => {
    setStatusFilter((previous) =>
      previous.includes(status)
        ? previous.filter((item) => item !== status)
        : [...previous, status],
    )
  }, [])

  const handleClearStatuses = React.useCallback(() => {
    setStatusFilter([])
  }, [])

  const handleClearAllFilters = React.useCallback(() => {
    setStatusFilter([])
    setDateRange(null)
    clearSearch()
  }, [clearSearch])

  const handleRemoveFilter = React.useCallback(
    (key: "statuses" | "dateRange" | "searchText", subkey?: string) => {
      if (key === "statuses" && subkey) {
        setStatusFilter((prev) => prev.filter((s) => s !== subkey))
      } else if (key === "dateRange") {
        setDateRange(null)
      }
    },
    [],
  )

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (statusFilter.length > 0) count++
    if (dateRange?.from || dateRange?.to) count++
    return count
  }, [statusFilter.length, dateRange])

  const handleRefresh = React.useCallback(async () => {
    await Promise.all([refetchList(), refetchCounts()])
  }, [refetchCounts, refetchList])

  const handleEditTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      setEditingTransfer(mapToTransferRequest(item))
      setIsEditDialogOpen(true)
    },
    [isRegionalLeader, mapToTransferRequest, notifyRegionalLeaderRestricted],
  )

  const handleOpenDeleteDialog = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      setDeletingTransfer(item)
      setDeleteDialogOpen(true)
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted],
  )

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deletingTransfer) return

    try {
      await callRpc({ fn: "transfer_request_delete", args: { p_id: deletingTransfer.id } })
      toast({ title: "Thành công", description: "Đã xóa yêu cầu luân chuyển." })
      await Promise.all([refetchList(), refetchCounts()])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi xóa yêu cầu.",
      })
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTransfer(null)
    }
  }, [deletingTransfer, refetchCounts, refetchList, toast])

  const handleApproveTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: { p_id: item.id, p_status: "da_duyet", p_payload: { nguoi_duyet_id: user?.id ? parseInt(user.id, 10) : undefined } },
        })
        toast({ title: "Thành công", description: "Đã duyệt yêu cầu luân chuyển." })
        await Promise.all([refetchList(), refetchCounts()])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi duyệt yêu cầu.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, refetchCounts, refetchList, toast, user?.id],
  )

  const handleStartTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: {
            p_id: item.id,
            p_status: "dang_luan_chuyen",
            p_payload: { ngay_ban_giao: new Date().toISOString() },
          },
        })
        toast({ title: "Thành công", description: "Đã bắt đầu luân chuyển thiết bị." })
        await Promise.all([refetchList(), refetchCounts()])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi bắt đầu luân chuyển.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, refetchCounts, refetchList, toast],
  )

  const handleHandoverToExternal = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: {
            p_id: item.id,
            p_status: "da_ban_giao",
            p_payload: { ngay_ban_giao: new Date().toISOString() },
          },
        })
        toast({ title: "Thành công", description: "Đã bàn giao thiết bị cho đơn vị bên ngoài." })
        await Promise.all([refetchList(), refetchCounts()])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi bàn giao thiết bị.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, refetchCounts, refetchList, toast],
  )

  const handleReturnFromExternal = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_complete",
          args: { p_id: item.id, p_payload: { ngay_hoan_tra: new Date().toISOString() } },
        })
        toast({ title: "Thành công", description: "Đã xác nhận hoàn trả thiết bị từ đơn vị bên ngoài." })
        await Promise.all([refetchList(), refetchCounts()])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi xác nhận hoàn trả.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, refetchCounts, refetchList, toast],
  )

  const handleCompleteTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({ fn: "transfer_request_complete", args: { p_id: item.id } })
        toast({
          title: "Thành công",
          description:
            item.loai_hinh === "thanh_ly"
              ? "Đã hoàn tất yêu cầu thanh lý thiết bị."
              : item.loai_hinh === "noi_bo"
                ? "Đã hoàn thành luân chuyển nội bộ thiết bị."
                : "Đã xác nhận hoàn trả thiết bị.",
        })
        await Promise.all([refetchList(), refetchCounts()])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi hoàn thành luân chuyển.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, refetchCounts, refetchList, toast],
  )

  const handleGenerateHandoverSheet = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      const mapped = mapToTransferRequest(item)
      if (!mapped.thiet_bi) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: "Không tìm thấy thông tin thiết bị.",
        })
        return
      }
      setHandoverTransfer(mapped)
      setHandoverDialogOpen(true)
    },
    [isRegionalLeader, mapToTransferRequest, notifyRegionalLeaderRestricted, toast],
  )

  const handleViewDetail = React.useCallback(
    (item: TransferListItem) => {
      setDetailTransfer(mapToTransferRequest(item))
      setDetailDialogOpen(true)
    },
    [mapToTransferRequest],
  )

  const rowActions = React.useCallback(
    (item: TransferListItem) => {
      const actions: React.ReactNode[] = []
      const isEditable = canEditTransfer(item)
      const isDeletable = canDeleteTransfer(item)

      if (isEditable) {
        actions.push(
          <Tooltip key={`edit-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(event) => {
                  event.stopPropagation()
                  handleEditTransfer(item)
                }}
              >
                <Edit className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sửa</p>
            </TooltipContent>
          </Tooltip>,
        )
      }

      switch (item.trang_thai) {
        case "cho_duyet":
          if (isTransferCoreRole) {
            actions.push(
              <Tooltip key={`approve-${item.id}`}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-10 w-10 sm:h-8 sm:w-8"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleApproveTransfer(item)
                    }}
                  >
                    <Check className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Duyệt</p>
                </TooltipContent>
              </Tooltip>,
            )
          }
          break
        case "da_duyet":
          if (
            isTransferCoreRole ||
            (user?.role === "qltb_khoa" && user.khoa_phong === item.khoa_phong_hien_tai)
          ) {
            actions.push(
              <Tooltip key={`start-${item.id}`}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-10 w-10 sm:h-8 sm:w-8"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleStartTransfer(item)
                    }}
                  >
                    <Play className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bắt đầu</p>
                </TooltipContent>
              </Tooltip>,
            )
          }
          break
        case "dang_luan_chuyen":
          if (
            isTransferCoreRole ||
            (user?.role === "qltb_khoa" &&
              (user.khoa_phong === item.khoa_phong_hien_tai || user.khoa_phong === item.khoa_phong_nhan))
          ) {
            if (item.loai_hinh === "noi_bo") {
              actions.push(
                <Tooltip key={`handover-sheet-${item.id}`}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 sm:h-8 sm:w-8"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleGenerateHandoverSheet(item)
                      }}
                    >
                      <FileText className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Biên bản bàn giao</p>
                  </TooltipContent>
                </Tooltip>,
              )
              actions.push(
                <Tooltip key={`complete-${item.id}`}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-10 w-10 sm:h-8 sm:w-8"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleCompleteTransfer(item)
                      }}
                    >
                      <CheckCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hoàn thành</p>
                  </TooltipContent>
                </Tooltip>,
              )
            } else {
              actions.push(
                <Tooltip key={`handover-${item.id}`}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-10 w-10 sm:h-8 sm:w-8"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleHandoverToExternal(item)
                      }}
                    >
                      <Send className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bàn giao</p>
                  </TooltipContent>
                </Tooltip>,
              )
            }
          }
          break
        case "da_ban_giao":
          if (isTransferCoreRole) {
            actions.push(
              <Tooltip key={`return-${item.id}`}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-10 w-10 sm:h-8 sm:w-8"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleReturnFromExternal(item)
                    }}
                  >
                    <Undo2 className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Hoàn trả</p>
                </TooltipContent>
              </Tooltip>,
            )
          }
          break
        default:
          break
      }

      if (isDeletable) {
        actions.push(
          <Tooltip key={`delete-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-destructive hover:text-destructive sm:h-8 sm:w-8"
                onClick={(event) => {
                  event.stopPropagation()
                  handleOpenDeleteDialog(item)
                }}
              >
                <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Xóa</p>
            </TooltipContent>
          </Tooltip>,
        )
      }

      if (actions.length === 0) return null

      return (
        <TooltipProvider>
          <div className="flex items-center gap-2 sm:gap-1">{actions}</div>
        </TooltipProvider>
      )
    },
    [
      canDeleteTransfer,
      canEditTransfer,
      handleApproveTransfer,
      handleCompleteTransfer,
      handleOpenDeleteDialog,
      handleEditTransfer,
      handleGenerateHandoverSheet,
      handleHandoverToExternal,
      handleReturnFromExternal,
      handleStartTransfer,
      isTransferCoreRole,
      user?.khoa_phong,
      user?.role,
    ],
  )

  const columns = React.useMemo(
    () => getColumnsForType(activeTab, { renderActions: rowActions, referenceDate }),
    [activeTab, referenceDate, rowActions],
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
  })

  return (
    <>
      {/* Lazy mount dialogs - only render when open to prevent unnecessary initialization */}
      {isAddDialogOpen && (
        <AddTransferDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSuccess={async () => {
            await Promise.all([refetchList(), refetchCounts()])
          }}
        />
      )}

      {isEditDialogOpen && (
        <EditTransferDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={async () => {
            await Promise.all([refetchList(), refetchCounts()])
          }}
          transfer={editingTransfer}
        />
      )}

      {detailDialogOpen && (
        <TransferDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          transfer={detailTransfer}
        />
      )}

      {handoverDialogOpen && (
        <HandoverPreviewDialog
          open={handoverDialogOpen}
          onOpenChange={setHandoverDialogOpen}
          transfer={handoverTransfer}
        />
      )}

      <OverdueTransfersAlert
        onViewTransfer={(transfer) => {
          setDetailTransfer(transfer)
          setDetailDialogOpen(true)
        }}
      />

      {isFilterModalOpen && (
        <FilterModal
          open={isFilterModalOpen}
          onOpenChange={setIsFilterModalOpen}
          value={{
            statuses: statusFilter,
            dateRange,
          }}
          onChange={(newValue) => {
            setStatusFilter(newValue.statuses)
            setDateRange(newValue.dateRange ?? null)
          }}
          variant={isMobile ? "sheet" : "dialog"}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa yêu cầu luân chuyển này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Luân chuyển thiết bị</CardTitle>
            <CardDescription>
              Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2">
            {showFacilityFilter && (
              <>
                {/* Desktop: Select dropdown */}
                <div className="hidden sm:block">
                  <Select
                    value={selectedFacilityId?.toString() || "all"}
                    onValueChange={(value) =>
                      setSelectedFacilityId(value === "all" ? null : Number(value))
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <Building2 className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Tất cả cơ sở" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả cơ sở</SelectItem>
                      {(facilityOptionsData || []).map((facility) => (
                        <SelectItem key={facility.id} value={facility.id.toString()}>
                          {facility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile: Bottom sheet with larger button */}
                <div className="sm:hidden">
                  <Sheet open={isFacilitySheetOpen} onOpenChange={setIsFacilitySheetOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-start font-medium"
                        onClick={() => {
                          setTempFacilityId(selectedFacilityId)
                          setIsFacilitySheetOpen(true)
                        }}
                      >
                        <Building2 className="mr-2 h-5 w-5" />
                        <span className="truncate">
                          {selectedFacilityId
                            ? facilityOptionsData?.find((f) => f.id === selectedFacilityId)?.name ||
                            "Tất cả cơ sở"
                            : "Tất cả cơ sở"}
                        </span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh]">
                      <SheetHeader>
                        <SheetTitle>Chọn cơ sở</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4 flex flex-1 flex-col">
                        <div className="flex-1 space-y-2 overflow-y-auto pb-4">
                          <Button
                            variant={tempFacilityId === null ? "default" : "outline"}
                            className="h-12 w-full justify-start text-base"
                            onClick={() => setTempFacilityId(null)}
                          >
                            <Building2 className="mr-3 h-5 w-5" />
                            Tất cả cơ sở
                          </Button>
                          {(facilityOptionsData || []).map((facility) => (
                            <Button
                              key={facility.id}
                              variant={tempFacilityId === facility.id ? "default" : "outline"}
                              className="h-12 w-full justify-start text-base"
                              onClick={() => setTempFacilityId(facility.id)}
                            >
                              <Building2 className="mr-3 h-5 w-5" />
                              {facility.name}
                            </Button>
                          ))}
                        </div>
                        <SheetFooter className="flex flex-row gap-2 border-t pt-4">
                          <Button
                            variant="outline"
                            className="h-12 flex-1 text-base font-medium"
                            onClick={() => {
                              setTempFacilityId(selectedFacilityId)
                              setIsFacilitySheetOpen(false)
                            }}
                          >
                            Hủy
                          </Button>
                          <Button
                            className="h-12 flex-1 text-base font-medium"
                            onClick={() => {
                              setSelectedFacilityId(tempFacilityId)
                              setIsFacilitySheetOpen(false)
                            }}
                          >
                            Áp dụng
                          </Button>
                        </SheetFooter>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </>
            )}

            {/* Filter button - mobile optimized */}
            <Button
              variant="outline"
              onClick={() => setIsFilterModalOpen(true)}
              className="h-11 gap-2 font-medium sm:h-9"
            >
              <Filter className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Bộ lọc</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs sm:ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Create button - spans full width on mobile */}
            {!isRegionalLeader && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="col-span-2 h-11 gap-2 font-medium sm:col-span-1 sm:h-9"
              >
                <PlusCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                Tạo yêu cầu mới
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <TransferTypeTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={{
              noi_bo:
                activeTab === "noi_bo"
                  ? statusCounts?.totalCount ?? totalCount
                  : undefined,
              ben_ngoai:
                activeTab === "ben_ngoai"
                  ? statusCounts?.totalCount ?? totalCount
                  : undefined,
              thanh_ly:
                activeTab === "thanh_ly"
                  ? statusCounts?.totalCount ?? totalCount
                  : undefined,
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="hidden lg:block">
                <TransferStatusBadges
                  counts={statusCounts?.columnCounts}
                  isLoading={isCountsLoading}
                  selectedStatuses={statusFilter}
                  onToggleStatus={handleToggleStatus}
                  onClearStatuses={handleClearStatuses}
                />
              </div>

              <FilterChips
                value={{
                  statuses: statusFilter,
                  dateRange: dateRange
                    ? {
                      from: dateRange.from?.toLocaleDateString("vi-VN") ?? null,
                      to: dateRange.to?.toLocaleDateString("vi-VN") ?? null,
                    }
                    : null,
                }}
                onRemove={handleRemoveFilter}
                onClearAll={handleClearAllFilters}
              />

              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Tìm kiếm mã yêu cầu, thiết bị, lý do..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => clearSearch()}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="space-y-3 lg:hidden">
                {isListLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Đang tải dữ liệu...
                    </div>
                  </div>
                ) : tableData.length > 0 ? (
                  tableData.map((item) => (
                    <TransferCard
                      key={item.id}
                      transfer={item}
                      referenceDate={referenceDate}
                      onClick={() => handleViewDetail(item)}
                      actions={rowActions(item)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                    Không có dữ liệu phù hợp.
                  </div>
                )}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {isListLoading ? (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-40 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu...</p>
                          </TableCell>
                        </TableRow>
                      ) : table.getRowModel().rows.length > 0 ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-muted/60"
                            onClick={() => handleViewDetail(row.original)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-40 text-center text-sm text-muted-foreground"
                          >
                            Không có dữ liệu phù hợp.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {isListFetching && !isListLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang đồng bộ dữ liệu...
                </div>
              )}
            </div>
          </TransferTypeTabs>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <ResponsivePaginationInfo
            currentCount={table.getPaginationRowModel().rows.length}
            totalCount={totalCount}
            currentPage={pagination.pageIndex + 1}
            totalPages={pageCount}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm">Số dòng</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) =>
                  setPagination({ pageIndex: 0, pageSize: Number(value) })
                }
              >
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 w-10 rounded-xl p-0 sm:h-8 sm:w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
              <span className="text-sm font-medium">
                Trang {pagination.pageIndex + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                className="h-10 w-10 rounded-xl p-0 sm:h-8 sm:w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </>
  )
}
