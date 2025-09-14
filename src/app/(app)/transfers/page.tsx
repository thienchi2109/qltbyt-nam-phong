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
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTransferRequests, useCreateTransferRequest, useUpdateTransferRequest, useApproveTransferRequest, transferKeys } from "@/hooks/use-cached-transfers"
import { useQueryClient } from "@tanstack/react-query"
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
  const router = useRouter()
  const queryClient = useQueryClient()

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
    // Allow edit in "cho_duyet" status for everyone
    // Allow edit in "da_duyet" status but with restrictions
    return transfer.trang_thai === 'cho_duyet' || transfer.trang_thai === 'da_duyet'
  }

  const canDelete = (transfer: TransferRequest) => {
    // Only allow delete in "cho_duyet" status
    return transfer.trang_thai === 'cho_duyet'
  }

  const handleEditTransfer = (transfer: TransferRequest) => {
    setEditingTransfer(transfer)
    setIsEditDialogOpen(true)
  }

  const handleDeleteTransfer = async (transferId: number) => {
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    if (!confirm("Bạn có chắc chắn muốn xóa yêu cầu luân chuyển này?")) {
      return
    }

    try {
      const { error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .delete()
        .eq('id', transferId)

      if (error) {
        throw error
      }

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
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    try {
      const { error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'da_duyet',
          nguoi_duyet_id: user?.id,
          ngay_duyet: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', transferId)

      if (error) {
        throw error
      }

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
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    try {
      const { error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'dang_luan_chuyen',
          ngay_ban_giao: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', transferId)

      if (error) {
        throw error
      }

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
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    try {
      const { error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'da_ban_giao',
          ngay_ban_giao: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', transferId)

      if (error) {
        throw error
      }

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
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    try {
      const { error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'hoan_thanh',
          ngay_hoan_tra: new Date().toISOString(),
          ngay_hoan_thanh: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', transferId)

      if (error) {
        throw error
      }

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
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    try {
      // Step 1: Update transfer request status
      const { error: updateError } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'hoan_thanh',
          ngay_hoan_thanh: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', transfer.id)

      if (updateError) throw updateError;

      // Step 2: Update equipment based on transfer type
      if (transfer.loai_hinh === 'noi_bo' && transfer.khoa_phong_nhan) {
        const { error: equipmentUpdateError } = await supabase
          .from('thiet_bi')
          .update({ khoa_phong_quan_ly: transfer.khoa_phong_nhan })
          .eq('id', transfer.thiet_bi_id)
        
        if (equipmentUpdateError) {
          toast({
            variant: "destructive",
            title: "Lỗi cập nhật thiết bị",
            description: `Đã hoàn thành yêu cầu, nhưng không thể cập nhật khoa/phòng mới cho thiết bị. ${equipmentUpdateError.message}`,
          });
        }
      } else if (transfer.loai_hinh === 'thanh_ly') {
        const { error: equipmentUpdateError } = await supabase
          .from('thiet_bi')
          .update({ 
            tinh_trang: 'Ngưng sử dụng',
            khoa_phong_quan_ly: 'Tổ QLTB'
          })
          .eq('id', transfer.thiet_bi_id)

        if (equipmentUpdateError) {
          toast({
            variant: "destructive",
            title: "Lỗi cập nhật thiết bị",
            description: `Đã hoàn thành yêu cầu thanh lý, nhưng không thể cập nhật trạng thái thiết bị. ${equipmentUpdateError.message}`,
          });
        }
      }

      // Step 3: Log the event to the general equipment history
      let mo_ta = '';
      let loai_su_kien = 'Luân chuyển';

      if (transfer.loai_hinh === 'noi_bo') {
        mo_ta = `Thiết bị được luân chuyển từ "${transfer.khoa_phong_hien_tai}" đến "${transfer.khoa_phong_nhan}".`;
      } else if (transfer.loai_hinh === 'thanh_ly') {
        mo_ta = `Thiết bị được thanh lý. Lý do: ${transfer.ly_do_luan_chuyen}`;
        loai_su_kien = 'Thanh lý';
      } else { // ben_ngoai
        mo_ta = `Thiết bị được hoàn trả từ đơn vị bên ngoài "${transfer.don_vi_nhan}".`;
      }

      const { error: historyError } = await supabase
        .from('lich_su_thiet_bi')
        .insert({
          thiet_bi_id: transfer.thiet_bi_id,
          loai_su_kien: loai_su_kien,
          mo_ta: mo_ta,
          chi_tiet: {
            ma_yeu_cau: transfer.ma_yeu_cau,
            loai_hinh: transfer.loai_hinh,
            khoa_phong_hien_tai: transfer.khoa_phong_hien_tai,
            khoa_phong_nhan: transfer.khoa_phong_nhan,
            don_vi_nhan: transfer.don_vi_nhan,
          },
          yeu_cau_id: transfer.id,
          nguoi_thuc_hien_id: user?.id,
          ngay_thuc_hien: new Date().toISOString()
        });

      if (historyError) {
        toast({
          variant: "destructive",
          title: "Lỗi ghi lịch sử",
          description: `Yêu cầu đã hoàn thành nhưng không thể ghi lại lịch sử thiết bị. ${historyError.message}`,
        });
      }

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
    const actions = []
    
    switch (transfer.trang_thai) {
      case 'cho_duyet':
        // Only admin and to_qltb can approve
        if (user && (user.role === 'admin' || user.role === 'to_qltb')) {
          actions.push(
            <Button
              key="approve"
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
        // Admin, to_qltb, and department managers can start transfer
        if (user && (
          user.role === 'admin' || 
          user.role === 'to_qltb' ||
          (user.role === 'qltb_khoa' && user.khoa_phong === transfer.khoa_phong_hien_tai)
        )) {
          actions.push(
            <Button
              key="start"
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
          user.role === 'admin' || 
          user.role === 'to_qltb' ||
          (user.role === 'qltb_khoa' && (
            user.khoa_phong === transfer.khoa_phong_hien_tai ||
            user.khoa_phong === transfer.khoa_phong_nhan
          ))
        )) {
          if (transfer.loai_hinh === 'noi_bo') {
            // For internal transfers - icon only handover sheet button and complete button
            actions.push(
              <Button
                key="handover-sheet"
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
                key="complete"
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
                key="handover"
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
        if (user && (
          user.role === 'admin' || 
          user.role === 'to_qltb'
        )) {
          actions.push(
            <Button
              key="return"
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
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Tạo yêu cầu mới
            </Button>
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
                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleEditTransfer(transfer)}>
                                      Sửa
                                    </Button>
                                  )}
                                  {canDelete(transfer) && (
                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => handleDeleteTransfer(transfer.id)}>
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