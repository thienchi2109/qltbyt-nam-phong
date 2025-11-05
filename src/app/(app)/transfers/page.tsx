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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { AddTransferDialog } from "@/components/add-transfer-dialog"
import { EditTransferDialog } from "@/components/edit-transfer-dialog"
import { HandoverPreviewDialog } from "@/components/handover-preview-dialog"
import { OverdueTransfersAlert } from "@/components/overdue-transfers-alert"
import { ResponsivePaginationInfo } from "@/components/responsive-pagination-info"
import { TransferDetailDialog } from "@/components/transfer-detail-dialog"
import { TransferTypeTabs, useTransferTypeTab } from "@/components/transfers/TransferTypeTabs"
import { getColumnsForType } from "@/components/transfers/columnDefinitions"
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
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import { useToast } from "@/hooks/use-toast"
import { useTransferList, useTransferCounts } from "@/hooks/useTransferDataGrid"
import { useTransferSearch } from "@/hooks/useTransferSearch"
import { callRpc } from "@/lib/rpc-client"
import type { TransferListFilters, TransferListItem } from "@/types/transfers-data-grid"
import { type TransferRequest } from "@/types/database"

export default function TransfersPage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const user = session?.user as any
  const router = useRouter()

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

  const { data: facilityOptionsData } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["transfer_request_facilities"],
    queryFn: async () => {
      try {
        if (!user) return []
        const result = await callRpc<Array<{ id: number; name: string }>>({
          fn: "get_transfer_request_facilities",
          args: {},
        })
        return result || []
      } catch (error) {
        console.error("[transfers] Failed to fetch facility options:", error)
        return []
      }
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })

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

  const filters = React.useMemo<TransferListFilters>(() => {
    return {
      types: [activeTab],
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      q: debouncedSearch || undefined,
      facilityId: selectedFacilityId ?? null,
    }
  }, [activeTab, pagination, debouncedSearch, selectedFacilityId])

  const {
    data: transferList,
    isLoading: isListLoading,
    isFetching: isListFetching,
    refetch: refetchList,
  } = useTransferList(filters, {
    placeholderData: (previous) => previous,
  })

  const { refetch: refetchCounts } = useTransferCounts(filters)

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
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [activeTab, selectedFacilityId, debouncedSearch])

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

  const handleDeleteTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      if (!confirm("Bạn có chắc chắn muốn xóa yêu cầu luân chuyển này?")) {
        return
      }
      try {
        await callRpc({ fn: "transfer_request_delete", args: { p_id: item.id } })
        toast({ title: "Thành công", description: "Đã xóa yêu cầu luân chuyển." })
        await Promise.all([refetchList(), refetchCounts()])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi xóa yêu cầu.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, refetchCounts, refetchList, toast],
  )

  const handleApproveTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: { p_id: item.id, p_status: "da_duyet", p_payload: { nguoi_duyet_id: user?.id } },
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
          <Button
            key={`edit-${item.id}`}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation()
              handleEditTransfer(item)
            }}
          >
            Sửa
          </Button>,
        )
      }

      switch (item.trang_thai) {
        case "cho_duyet":
          if (isTransferCoreRole) {
            actions.push(
              <Button
                key={`approve-${item.id}`}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  void handleApproveTransfer(item)
                }}
              >
                Duyệt
              </Button>,
            )
          }
          break
        case "da_duyet":
          if (
            isTransferCoreRole ||
            (user?.role === "qltb_khoa" && user.khoa_phong === item.khoa_phong_hien_tai)
          ) {
            actions.push(
              <Button
                key={`start-${item.id}`}
                size="sm"
                className="h-7 px-2 text-xs"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation()
                  void handleStartTransfer(item)
                }}
              >
                Bắt đầu
              </Button>,
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
                <Button
                  key={`handover-sheet-${item.id}`}
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleGenerateHandoverSheet(item)
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>,
              )
              actions.push(
                <Button
                  key={`complete-${item.id}`}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleCompleteTransfer(item)
                  }}
                >
                  Hoàn thành
                </Button>,
              )
            } else {
              actions.push(
                <Button
                  key={`handover-${item.id}`}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleHandoverToExternal(item)
                  }}
                >
                  Bàn giao
                </Button>,
              )
            }
          }
          break
        case "da_ban_giao":
          if (isTransferCoreRole) {
            actions.push(
              <Button
                key={`return-${item.id}`}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  void handleReturnFromExternal(item)
                }}
              >
                Hoàn trả
              </Button>,
            )
          }
          break
        default:
          break
      }

      if (isDeletable) {
        actions.push(
          <Button
            key={`delete-${item.id}`}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation()
              void handleDeleteTransfer(item)
            }}
          >
            Xóa
          </Button>,
        )
      }

      if (actions.length === 0) return null

      return <div className="flex flex-wrap items-center gap-2">{actions}</div>
    },
    [
      canDeleteTransfer,
      canEditTransfer,
      handleApproveTransfer,
      handleCompleteTransfer,
      handleDeleteTransfer,
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
      <AddTransferDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={async () => {
          await Promise.all([refetchList(), refetchCounts()])
        }}
      />

      <EditTransferDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={async () => {
          await Promise.all([refetchList(), refetchCounts()])
        }}
        transfer={editingTransfer}
      />

      <TransferDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        transfer={detailTransfer}
      />

      <HandoverPreviewDialog
        open={handoverDialogOpen}
        onOpenChange={setHandoverDialogOpen}
        transfer={handoverTransfer}
      />

      <OverdueTransfersAlert
        onViewTransfer={(transfer) => {
          setDetailTransfer(transfer)
          setDetailDialogOpen(true)
        }}
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Luân chuyển thiết bị</CardTitle>
            <CardDescription>
              Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {showFacilityFilter && (
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
            )}
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>
            {!isRegionalLeader && (
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
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
              noi_bo: activeTab === "noi_bo" ? totalCount : undefined,
              ben_ngoai: activeTab === "ben_ngoai" ? totalCount : undefined,
              thanh_ly: activeTab === "thanh_ly" ? totalCount : undefined,
            }}
          >
            <div className="flex flex-col gap-3">
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
