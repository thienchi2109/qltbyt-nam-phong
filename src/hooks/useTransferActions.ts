// src/hooks/useTransferActions.ts
import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { transferDataGridKeys } from "@/hooks/useTransferDataGrid"
import { transferKanbanKeys } from "@/hooks/useTransfersKanban"
import type { TransferListItem } from "@/types/transfers-data-grid"
import type { TransferRequest } from "@/types/database"

interface UseTransferActionsReturn {
  // Status transition actions
  approveTransfer: (item: TransferListItem) => void
  startTransfer: (item: TransferListItem) => void
  handoverToExternal: (item: TransferListItem) => void
  returnFromExternal: (item: TransferListItem) => void
  completeTransfer: (item: TransferListItem) => void

  // CRUD actions
  confirmDelete: (item: TransferListItem) => void

  // Permission checks
  canEditTransfer: (item: TransferListItem) => boolean
  canDeleteTransfer: (item: TransferListItem) => boolean

  // Utility
  mapToTransferRequest: (item: TransferListItem) => TransferRequest
  isRegionalLeader: boolean
  isTransferCoreRole: boolean

  // Loading states for individual actions
  isApproving: boolean
  isStarting: boolean
  isHandingOver: boolean
  isReturning: boolean
  isCompleting: boolean
  isDeleting: boolean
}

export function useTransferActions(): UseTransferActionsReturn {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user
  const queryClient = useQueryClient()

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

  const invalidateTransferQueries = React.useCallback(() => {
    // Invalidate both table view and kanban view query keys
    queryClient.invalidateQueries({ queryKey: transferDataGridKeys.all })
    queryClient.invalidateQueries({ queryKey: transferKanbanKeys.all })
  }, [queryClient])

  // mapToTransferRequest - converts TransferListItem to TransferRequest
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
    []
  )

  // Permission checks
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
    [isRegionalLeader, isTransferCoreRole, user]
  )

  const canDeleteTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (!user || isRegionalLeader) return false
      const deptMatch = user.role === "qltb_khoa" && user.khoa_phong === item.khoa_phong_hien_tai
      const allowedRole = isTransferCoreRole || deptMatch
      return allowedRole && item.trang_thai === "cho_duyet"
    },
    [isRegionalLeader, isTransferCoreRole, user]
  )

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (item: TransferListItem) => {
      await callRpc({
        fn: "transfer_request_update_status",
        args: {
          p_id: item.id,
          p_status: "da_duyet",
          p_payload: { nguoi_duyet_id: user?.id ? parseInt(user.id, 10) : undefined },
        },
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã duyệt yêu cầu luân chuyển." })
      invalidateTransferQueries()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi duyệt yêu cầu.",
      })
    },
  })

  // Start transfer mutation
  const startMutation = useMutation({
    mutationFn: async (item: TransferListItem) => {
      await callRpc({
        fn: "transfer_request_update_status",
        args: {
          p_id: item.id,
          p_status: "dang_luan_chuyen",
          p_payload: { ngay_ban_giao: new Date().toISOString() },
        },
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã bắt đầu luân chuyển thiết bị." })
      invalidateTransferQueries()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi bắt đầu luân chuyển.",
      })
    },
  })

  // Handover to external mutation
  const handoverMutation = useMutation({
    mutationFn: async (item: TransferListItem) => {
      await callRpc({
        fn: "transfer_request_update_status",
        args: {
          p_id: item.id,
          p_status: "da_ban_giao",
          p_payload: { ngay_ban_giao: new Date().toISOString() },
        },
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã bàn giao thiết bị cho đơn vị bên ngoài." })
      invalidateTransferQueries()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi bàn giao thiết bị.",
      })
    },
  })

  // Return from external mutation
  const returnMutation = useMutation({
    mutationFn: async (item: TransferListItem) => {
      await callRpc({
        fn: "transfer_request_complete",
        args: { p_id: item.id, p_payload: { ngay_hoan_tra: new Date().toISOString() } },
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã xác nhận hoàn trả thiết bị từ đơn vị bên ngoài." })
      invalidateTransferQueries()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi xác nhận hoàn trả.",
      })
    },
  })

  // Complete transfer mutation
  const completeMutation = useMutation({
    mutationFn: async (item: TransferListItem) => {
      await callRpc({ fn: "transfer_request_complete", args: { p_id: item.id } })
      return item
    },
    onSuccess: (_data, item) => {
      toast({
        title: "Thành công",
        description:
          item.loai_hinh === "thanh_ly"
            ? "Đã hoàn tất yêu cầu thanh lý thiết bị."
            : item.loai_hinh === "noi_bo"
              ? "Đã hoàn thành luân chuyển nội bộ thiết bị."
              : "Đã xác nhận hoàn trả thiết bị.",
      })
      invalidateTransferQueries()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi hoàn thành luân chuyển.",
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: TransferListItem) => {
      await callRpc({ fn: "transfer_request_delete", args: { p_id: item.id } })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã xóa yêu cầu luân chuyển." })
      invalidateTransferQueries()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi xóa yêu cầu.",
      })
    },
  })

  // Wrapped action handlers with regional leader check
  const approveTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      approveMutation.mutate(item)
    },
    [approveMutation, isRegionalLeader, notifyRegionalLeaderRestricted]
  )

  const startTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      startMutation.mutate(item)
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, startMutation]
  )

  const handoverToExternal = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      handoverMutation.mutate(item)
    },
    [handoverMutation, isRegionalLeader, notifyRegionalLeaderRestricted]
  )

  const returnFromExternal = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      returnMutation.mutate(item)
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, returnMutation]
  )

  const completeTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      completeMutation.mutate(item)
    },
    [completeMutation, isRegionalLeader, notifyRegionalLeaderRestricted]
  )

  const confirmDelete = React.useCallback(
    (item: TransferListItem) => {
      deleteMutation.mutate(item)
    },
    [deleteMutation]
  )

  return {
    approveTransfer,
    startTransfer,
    handoverToExternal,
    returnFromExternal,
    completeTransfer,
    confirmDelete,
    canEditTransfer,
    canDeleteTransfer,
    mapToTransferRequest,
    isRegionalLeader,
    isTransferCoreRole,
    isApproving: approveMutation.isPending,
    isStarting: startMutation.isPending,
    isHandingOver: handoverMutation.isPending,
    isReturning: returnMutation.isPending,
    isCompleting: completeMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
