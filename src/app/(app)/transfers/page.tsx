"use client"

import * as React from "react"
import { PlusCircle, ArrowLeftRight, Filter, RefreshCw, FileText } from "lucide-react"

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
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { callRpc } from "@/lib/rpc-client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTransferRequests, useCreateTransferRequest, useUpdateTransferRequest, useApproveTransferRequest, transferKeys } from "@/hooks/use-cached-transfers"
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

const KANBAN_COLUMNS: { status: TransferStatus; title: string; description: string; color: string }[] = [
  {
    status: 'cho_duyet',
    title: 'Chờ duyệt',
    description: 'Yêu cầu mới, chờ phê duyệt',
    color: 'bg-slate-50 border-slate-200'
  },
  {
    status: 'da_duyet', 
    title: 'Đã duyệt',
    description: 'Đã được phê duyệt, chờ bàn giao',
    color: 'bg-blue-50 border-blue-200'
  },
  {
    status: 'dang_luan_chuyen',
    title: 'Đang luân chuyển', 
    description: 'Thiết bị đang được luân chuyển',
    color: 'bg-orange-50 border-orange-200'
  },
  {
    status: 'da_ban_giao',
    title: 'Đã bàn giao',
    description: 'Đã bàn giao cho bên ngoài, chờ hoàn trả',
    color: 'bg-purple-50 border-purple-200'
  },
  {
    status: 'hoan_thanh',
    title: 'Hoàn thành',
    description: 'Đã hoàn thành luân chuyển',
    color: 'bg-green-50 border-green-200'
  }
]

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

  // ✅ Use cached hooks instead of manual state
  const { data: transfers = [], isLoading, refetch: refetchTransfers } = useTransferRequests()
  const createTransferRequest = useCreateTransferRequest()
  const updateTransferRequest = useUpdateTransferRequest()
  const approveTransferRequest = useApproveTransferRequest()

  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTransfer, setEditingTransfer] = React.useState<TransferRequest | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false)
  const [detailTransfer, setDetailTransfer] = React.useState<TransferRequest | null>(null)
  const [handoverDialogOpen, setHandoverDialogOpen] = React.useState(false)
  const [handoverTransfer, setHandoverTransfer] = React.useState<TransferRequest | null>(null)

  // ✅ Remove manual fetchTransfers - now handled by cached hook

  // ✅ Remove useEffect for fetchTransfers - data loaded automatically by cached hook

  const handleRefresh = () => {
    setIsRefreshing(true)
    refetchTransfers().finally(() => setIsRefreshing(false)) // ✅ Use cached hook refetch
  }

  const getTransfersByStatus = (status: TransferStatus) => {
    return transfers.filter(transfer => transfer.trang_thai === status)
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
        <CardContent>
          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {KANBAN_COLUMNS.map((column) => {
              const columnTransfers = getTransfersByStatus(column.status)
              
              return (
                <Card key={column.status} className={`${column.color} min-h-[600px]`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {column.title}
                      </CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        {columnTransfers.length}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {column.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                      ))
                    ) : columnTransfers.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        Không có yêu cầu nào
                      </div>
                    ) : (
                      columnTransfers.map((transfer) => (
                        <Card 
                          key={transfer.id} 
                          className="mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleViewDetail(transfer)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium leading-none">
                                    {transfer.ma_yeu_cau}
                                  </p>
                                  <Badge variant={getTypeVariant(transfer.loai_hinh)}>
                                    {TRANSFER_TYPES[transfer.loai_hinh as keyof typeof TRANSFER_TYPES]}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Thiết bị</p>
                                  <p className="text-sm font-medium">
                                    {transfer.thiet_bi?.ma_thiet_bi} - {transfer.thiet_bi?.ten_thiet_bi}
                                  </p>
                                </div>
                                
                                {transfer.loai_hinh === 'noi_bo' ? (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Từ → Đến</p>
                                    <p className="text-sm">
                                      {transfer.khoa_phong_hien_tai} → {transfer.khoa_phong_nhan}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Đơn vị nhận</p>
                                      <p className="text-sm">{transfer.don_vi_nhan}</p>
                                    </div>
                                    {transfer.ngay_du_kien_tra && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Dự kiến hoàn trả</p>
                                        <div className="flex items-center gap-1">
                                          <p className="text-sm">
                                            {new Date(transfer.ngay_du_kien_tra).toLocaleDateString('vi-VN')}
                                          </p>
                                          {/* Overdue indicator for external transfers */}
                                          {(transfer.trang_thai === 'da_ban_giao' || transfer.trang_thai === 'dang_luan_chuyen') && 
                                           new Date(transfer.ngay_du_kien_tra) < new Date() && (
                                            <Badge variant="destructive" className="text-xs px-1 py-0">
                                              Quá hạn
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div>
                                  <p className="text-xs text-muted-foreground">Lý do</p>
                                  <p className="text-sm line-clamp-2">{transfer.ly_do_luan_chuyen}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between pt-2 border-t">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(transfer.created_at).toLocaleDateString('vi-VN')}
                                </p>
                                <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                  {/* Status Action Buttons */}
                                  {getStatusActions(transfer)}
                                  
                                  {/* Edit/Delete Buttons */}
                                  {canEdit(transfer) && (
                                    <Button key={`edit-${transfer.id}`} size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleEditTransfer(transfer)}>
                                      Sửa
                                    </Button>
                                  )}
                                  {canDelete(transfer) && (
                                    <Button key={`delete-${transfer.id}`} size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => handleDeleteTransfer(transfer.id)}>
                                      Xóa
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
} 