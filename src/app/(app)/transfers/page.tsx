"use client"

import * as React from "react"
import { PlusCircle, ArrowLeftRight, Filter, RefreshCw, FileText, Building2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTransfersKanban, useTransferCounts } from "@/hooks/useTransfersKanban"
import { AddTransferDialog } from "@/components/add-transfer-dialog"
import { EditTransferDialog } from "@/components/edit-transfer-dialog"
import { TransferDetailDialog } from "@/components/transfer-detail-dialog"
import { HandoverPreviewDialog } from "@/components/handover-preview-dialog"
import { OverdueTransfersAlert } from "@/components/overdue-transfers-alert"
import { 
  TransferRequest, 
  TRANSFER_STATUSES, 
  TRANSFER_TYPES,
  type TransferStatus
} from "@/types/database"
import { TransferKanbanFilters, KANBAN_COLUMNS } from "@/types/transfer-kanban"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import { CollapsibleLane, type TransferStatus as LaneTransferStatus } from "@/components/transfers/CollapsibleLane"
import { DensityToggle, type DensityMode } from "@/components/transfers/DensityToggle"
import { TransferCard } from "@/components/transfers/TransferCard"
import { FilterBar } from "@/components/transfers/FilterBar"
import { VirtualizedKanbanColumn } from "@/components/transfers/VirtualizedKanbanColumn"
import {
  getDensityMode,
  setDensityMode,
  getLaneCollapsedState,
  setLaneCollapsedState,
  getVisibleCounts,
  setVisibleCounts,
  type LaneCollapsedState,
  type VisibleCountsState,
} from "@/lib/kanban-preferences"

export default function TransfersPage() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const isRegionalLeader = user?.role === 'regional_leader'
  const isTransferCoreRole = user?.role === 'global' || user?.role === 'admin' || user?.role === 'to_qltb'
  const router = useRouter()
  const notifyRegionalLeaderRestricted = React.useCallback(() => {
    toast({
      variant: "destructive",
      title: "Không thể thực hiện",
      description: "Vai trò Trưởng vùng chỉ được xem yêu cầu luân chuyển."
    })
  }, [toast])

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

  // REMOVED: regional_leader page block - they now have read-only access

  // Fetch facilities for dropdown (lightweight RPC - only facilities with transfer requests)
  const { data: facilityOptionsData } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['transfer_request_facilities'],
    queryFn: async () => {
      try {
        if (!user) return [];
        // Call dedicated RPC that returns only facility IDs and names (lightweight ~1-2KB)
        const result = await callRpc<Array<{ id: number; name: string }>>({ 
          fn: 'get_transfer_request_facilities', 
          args: {} 
        });
        return result || [];
      } catch (error) {
        console.error('[transfers] Failed to fetch facility options:', error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60_000, // 5 minutes (facilities change rarely)
    gcTime: 10 * 60_000,
  });

  // Server-side facility filter (like Repair Requests page)
  const { selectedFacilityId, setSelectedFacilityId: setFacilityId, showFacilityFilter } = useFacilityFilter({
    mode: 'server',
    userRole: (user?.role as string) || 'user',
    facilities: facilityOptionsData || [],
  })

  // ✅ SERVER-SIDE FILTERS STATE
  const [filters, setFilters] = React.useState<TransferKanbanFilters>(() => ({
    facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
  }))

  // Update facility filter when it changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
    }))
  }, [selectedFacilityId])

  // Wrapper to trigger refetch when facility changes
  const setSelectedFacilityId = React.useCallback((id: number | null) => {
    setFacilityId(id);
    // TanStack Query will auto-refetch when queryKey changes
  }, [setFacilityId]);

  // ✅ SERVER-SIDE DATA FETCHING
  const { data, isLoading, refetch: refetchTransfers } = useTransfersKanban(filters)
  const { data: counts } = useTransferCounts(
    selectedFacilityId ? [selectedFacilityId] : undefined
  )

  // Phase 0: Kanban scalability state management
  const [densityMode, setDensityModeState] = React.useState<DensityMode>(() => getDensityMode())
  const [laneCollapsed, setLaneCollapsedState] = React.useState<LaneCollapsedState>(() => getLaneCollapsedState())
  const [visibleCounts, setVisibleCountsState] = React.useState<VisibleCountsState>(() => getVisibleCounts())

  // Persist density mode changes
  const handleDensityChange = React.useCallback((mode: DensityMode) => {
    setDensityModeState(mode)
    setDensityMode(mode)
  }, [])

  // Persist lane collapsed state changes
  const handleToggleCollapse = React.useCallback((status: TransferStatus) => {
    setLaneCollapsedState((prev) => {
      const next = { ...prev, [status]: !prev[status] }
      setLaneCollapsedState(next)
      return next
    })
  }, [])

  // Handle "Show more" for individual columns
  const handleShowMore = React.useCallback((status: TransferStatus) => {
    setVisibleCountsState((prev) => {
      const next = { ...prev, [status]: prev[status] + 50 }
      setVisibleCounts(next)
      return next
    })
  }, [])

  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTransfer, setEditingTransfer] = React.useState<TransferRequest | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false)
  const [detailTransfer, setDetailTransfer] = React.useState<TransferRequest | null>(null)
  const [handoverDialogOpen, setHandoverDialogOpen] = React.useState(false)
  const [handoverTransfer, setHandoverTransfer] = React.useState<TransferRequest | null>(null)

  const handleRefresh = () => {
    setIsRefreshing(true)
    refetchTransfers().finally(() => setIsRefreshing(false))
  }

  // Server-side filtering means no local filtering needed
  const getTransfersByStatus = (status: TransferStatus) => {
    return data?.transfers[status] || []
  }

  const getTypeVariant = (type: TransferRequest['loai_hinh']) => {
    switch (type) {
      case 'noi_bo':
        return 'default'
      case 'thanh_ly':
        return 'destructive'
      case 'ben_ngoai':
      default:
        return 'secondary'
    }
  }

  const canEdit = (transfer: TransferRequest) => {
    if (!user || isRegionalLeader) return false
    const deptMatch = user.role === 'qltb_khoa' && (
      user.khoa_phong === transfer.khoa_phong_hien_tai ||
      user.khoa_phong === transfer.khoa_phong_nhan
    )
  const allowedRole = isTransferCoreRole || deptMatch
    return allowedRole && (transfer.trang_thai === 'cho_duyet' || transfer.trang_thai === 'da_duyet')
  }

  const canDelete = (transfer: TransferRequest) => {
    if (!user || isRegionalLeader) return false
    const deptMatch = user.role === 'qltb_khoa' && user.khoa_phong === transfer.khoa_phong_hien_tai
  const allowedRole = isTransferCoreRole || deptMatch
    return allowedRole && transfer.trang_thai === 'cho_duyet'
  }

  const handleEditTransfer = (transfer: TransferRequest) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }
    setEditingTransfer(transfer)
    setIsEditDialogOpen(true)
  }

  const handleDeleteTransfer = async (transferId: number) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    if (!confirm("Bạn có chắc chắn muốn xóa yêu cầu luân chuyển này?")) {
      return
    }

    try {
      await callRpc({ fn: 'transfer_request_delete', args: { p_id: transferId } })

      toast({
        title: "Thành công",
        description: "Đã xóa yêu cầu luân chuyển."
      })

      refetchTransfers() // ✅ Use cached hook refetch
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi xóa yêu cầu."
      })
    }
  }

  const handleApproveTransfer = async (transferId: number) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    try {
      await callRpc({ fn: 'transfer_request_update_status', args: { p_id: transferId, p_status: 'da_duyet', p_payload: { nguoi_duyet_id: user?.id } } })

      toast({
        title: "Thành công",
        description: "Đã duyệt yêu cầu luân chuyển."
      })

      refetchTransfers() // ✅ Use cached hook refetch
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi duyệt yêu cầu."
      })
    }
  }

  const handleStartTransfer = async (transferId: number) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    try {
      await callRpc({ fn: 'transfer_request_update_status', args: { p_id: transferId, p_status: 'dang_luan_chuyen', p_payload: { ngay_ban_giao: new Date().toISOString() } } })

      toast({
        title: "Thành công",
        description: "Đã bắt đầu luân chuyển thiết bị."
      })

      refetchTransfers() // ✅ Use cached hook refetch
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi bắt đầu luân chuyển."
      })
    }
  }

  // New function for external handover
  const handleHandoverToExternal = async (transferId: number) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    try {
      await callRpc({ fn: 'transfer_request_update_status', args: { p_id: transferId, p_status: 'da_ban_giao', p_payload: { ngay_ban_giao: new Date().toISOString() } } })

      toast({
        title: "Thành công",
        description: "Đã bàn giao thiết bị cho đơn vị bên ngoài."
      })

      refetchTransfers() // ✅ Use cached hook refetch
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi bàn giao thiết bị."
      })
    }
  }

  // New function for returning equipment from external
  const handleReturnFromExternal = async (transferId: number) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    try {
      await callRpc({ fn: 'transfer_request_complete', args: { p_id: transferId, p_payload: { ngay_hoan_tra: new Date().toISOString() } } })

      toast({
        title: "Thành công",
        description: "Đã xác nhận hoàn trả thiết bị từ đơn vị bên ngoài."
      })

      refetchTransfers() // ✅ Use cached hook refetch
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi xác nhận hoàn trả."
      })
    }
  }

  const handleCompleteTransfer = async (transfer: TransferRequest) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    try {
      await callRpc({ fn: 'transfer_request_complete', args: { p_id: transfer.id } })

      toast({
        title: "Thành công",
        description: transfer.loai_hinh === 'thanh_ly'
          ? "Đã hoàn tất yêu cầu thanh lý thiết bị."
          : transfer.loai_hinh === 'noi_bo' 
          ? "Đã hoàn thành luân chuyển nội bộ thiết bị."
          : "Đã xác nhận hoàn trả thiết bị."
      })

      refetchTransfers() // ✅ Use cached hook refetch
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi hoàn thành luân chuyển."
      })
    }
  }

  // New function for generating handover sheet
  const handleGenerateHandoverSheet = (transfer: TransferRequest) => {
    if (isRegionalLeader) {
      notifyRegionalLeaderRestricted()
      return
    }

    if (!transfer.thiet_bi) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không tìm thấy thông tin thiết bị."
      })
      return
    }

    setHandoverTransfer(transfer)
    setHandoverDialogOpen(true)
  }

  const getStatusActions = (transfer: TransferRequest) => {
    if (isRegionalLeader) {
      return []
    }

    const actions = []
    
    switch (transfer.trang_thai) {
      case 'cho_duyet':
        // Only transfer core roles can approve
        if (user && isTransferCoreRole) {
          actions.push(
            <Button
              key={`approve-${transfer.id}`}
              size="sm"
              variant="default"
              className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => handleApproveTransfer(transfer.id)}
            >
              Duyệt
            </Button>
          )
        }
        break
        
      case 'da_duyet':
        // Core roles or origin department managers can start transfer
        if (user && (
          isTransferCoreRole ||
          (user.role === 'qltb_khoa' && user.khoa_phong === transfer.khoa_phong_hien_tai)
        )) {
          actions.push(
            <Button
              key={`start-${transfer.id}`}
              size="sm"
              variant="default"
              className="h-6 px-2 text-xs bg-orange-600 hover:bg-orange-700"
              onClick={() => handleStartTransfer(transfer.id)}
            >
              Bắt đầu
            </Button>
          )
        }
        break
        
      case 'dang_luan_chuyen':
        // Different actions for internal vs external transfers
        if (user && (
          isTransferCoreRole ||
          (user.role === 'qltb_khoa' && (
            user.khoa_phong === transfer.khoa_phong_hien_tai ||
            user.khoa_phong === transfer.khoa_phong_nhan
          ))
        )) {
          if (transfer.loai_hinh === 'noi_bo') {
            // For internal transfers - icon only handover sheet button and complete button
            actions.push(
              <Button
                key={`handover-sheet-${transfer.id}`}
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0 border-blue-600 text-blue-600 hover:bg-blue-50"
                onClick={() => handleGenerateHandoverSheet(transfer)}
                title="Xuất phiếu bàn giao"
              >
                <FileText className="h-3 w-3" />
              </Button>
            )
            actions.push(
              <Button
                key={`complete-${transfer.id}`}
                size="sm"
                variant="default"
                className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => handleCompleteTransfer(transfer)}
              >
                Hoàn thành
              </Button>
            )
          } else {
            // For external transfers - handover first
            actions.push(
              <Button
                key={`handover-${transfer.id}`}
                size="sm"
                variant="default"
                className="h-6 px-2 text-xs bg-purple-600 hover:bg-purple-700"
                onClick={() => handleHandoverToExternal(transfer.id)}
              >
                Bàn giao
              </Button>
            )
          }
        }
        break
        
      case 'da_ban_giao':
        // Only for external transfers - mark as returned
        if (user && isTransferCoreRole) {
          actions.push(
            <Button
              key={`return-${transfer.id}`}
              size="sm"
              variant="default"
              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => handleReturnFromExternal(transfer.id)}
            >
              Hoàn trả
            </Button>
          )
        }
        break
    }
    
    return actions
  }

  const handleViewDetail = (transfer: TransferRequest) => {
    setDetailTransfer(transfer)
    setDetailDialogOpen(true)
  }

  return (
    <>
      <AddTransferDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={refetchTransfers} // ✅ Use cached hook refetch
      />

      <EditTransferDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={refetchTransfers} // ✅ Use cached hook refetch
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

      <OverdueTransfersAlert onViewTransfer={handleViewDetail} />

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Luân chuyển thiết bị</CardTitle>
            <CardDescription>
              Quản lý luân chuyển thiết bị giữa các bộ phận và đơn vị bên ngoài
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Density toggle for card display mode */}
            <DensityToggle mode={densityMode} onChange={handleDensityChange} />
            
            {/* Facility filter for regional leaders and global users */}
            {showFacilityFilter && (
              <Select
                value={selectedFacilityId?.toString() || "all"}
                onValueChange={(value) => setSelectedFacilityId(value === "all" ? null : Number(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
            {/* Hide Create button for regional_leader - read-only access */}
            {!isRegionalLeader && (
              <Button
                size="sm"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Tạo yêu cầu mới
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ✅ FILTER BAR (NEW) */}
          <FilterBar 
            filters={filters}
            onFiltersChange={setFilters}
            facilityId={selectedFacilityId || undefined}
          />

          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Đang tải...</p>
            </div>
          ) : (
            <>
              {/* ✅ KANBAN BOARD (Always visible) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {KANBAN_COLUMNS.map((column) => {
                  const columnTransfers = data?.transfers[column.status] || []
                  const totalCount = counts?.columnCounts[column.status] || columnTransfers.length
                  
                  return (
                    <div key={column.status} className="flex flex-col gap-2">
                      {/* Column Header with Elegant Pastel Color */}
                      <div className={`p-4 rounded-t-lg border-2 ${column.bgColor} ${column.borderColor}`}>
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold ${column.textColor}`}>{column.title}</h3>
                          <Badge variant="secondary">{totalCount}</Badge>
                        </div>
                      </div>
                      
                      {/* Column Content with Virtualization */}
                      <div className={`flex-1 min-h-[400px] border-2 border-t-0 rounded-b-lg p-2 ${column.bgColor} ${column.borderColor}`}>
                        {columnTransfers.length === 0 ? (
                          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                            Không có yêu cầu nào
                          </div>
                        ) : (
                          <VirtualizedKanbanColumn
                            transfers={columnTransfers}
                            density={densityMode}
                            renderCard={(transfer, index) => (
                              <TransferCard
                                key={transfer.id}
                                transfer={transfer as any}
                                density={densityMode}
                                onClick={() => handleViewDetail(transfer as any)}
                                statusActions={getStatusActions(transfer as any)}
                                onEdit={() => handleEditTransfer(transfer as any)}
                                onDelete={() => handleDeleteTransfer(transfer.id)}
                                canEdit={canEdit(transfer as any)}
                                canDelete={canDelete(transfer as any)}
                              />
                            )}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total Count */}
              {data && data.totalCount > 0 && (
                <div className="text-sm text-muted-foreground text-center pt-4">
                  Tổng số: {data.totalCount} yêu cầu
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
} 