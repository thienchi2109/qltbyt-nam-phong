"use client"

import * as React from "react"

import { TransferRowActions } from "@/components/transfers/TransferRowActions"
import type { TransferListItem } from "@/types/transfers-data-grid"
import type { TransferRequest } from "@/types/database"

type ToastOptions = {
  variant?: "default" | "destructive"
  title: string
  description: string
}

export interface UseTransfersRowActionsOptions {
  approveTransfer: (item: TransferListItem) => void
  startTransfer: (item: TransferListItem) => void
  handoverToExternal: (item: TransferListItem) => void
  returnFromExternal: (item: TransferListItem, viTriHoanTra: string) => Promise<void>
  completeTransfer: (item: TransferListItem) => void
  confirmDelete: (item: TransferListItem) => Promise<void> | void
  canEditTransfer: (item: TransferListItem) => boolean
  canDeleteTransfer: (item: TransferListItem) => boolean
  isTransferCoreRole: boolean
  userRole?: string
  userKhoaPhong?: string | null
  mapToTransferRequest: (item: TransferListItem) => TransferRequest
  toast: (options: ToastOptions) => void
}

export interface UseTransfersRowActionsResult {
  isEditDialogOpen: boolean
  setIsEditDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  editingTransfer: TransferRequest | null
  isDetailDialogOpen: boolean
  setIsDetailDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  detailTransfer: TransferRequest | null
  isHandoverDialogOpen: boolean
  setIsHandoverDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  handoverTransfer: TransferRequest | null
  isReturnLocationDialogOpen: boolean
  setIsReturnLocationDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  returnTransfer: TransferListItem | null
  isDeleteDialogOpen: boolean
  setIsDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  deletingTransfer: TransferListItem | null
  RowActions: (props: { item: TransferListItem }) => React.ReactNode
  openDetailTransfer: (transfer: TransferRequest) => void
  handleEditTransfer: (item: TransferListItem) => void
  handleViewDetail: (item: TransferListItem) => void
  handleOpenDeleteDialog: (item: TransferListItem) => void
  handleOpenReturnDialog: (item: TransferListItem) => void
  handleConfirmReturn: (viTriHoanTra: string) => Promise<void>
  handleConfirmDelete: () => Promise<void>
  handleGenerateHandoverSheet: (item: TransferListItem) => void
  renderRowActions: (item: TransferListItem) => React.ReactNode
}

export function useTransfersRowActions({
  approveTransfer,
  startTransfer,
  handoverToExternal,
  returnFromExternal,
  completeTransfer,
  confirmDelete,
  canEditTransfer,
  canDeleteTransfer,
  isTransferCoreRole,
  userRole,
  userKhoaPhong,
  mapToTransferRequest,
  toast,
}: UseTransfersRowActionsOptions): UseTransfersRowActionsResult {
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTransfer, setEditingTransfer] = React.useState<TransferRequest | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false)
  const [detailTransfer, setDetailTransfer] = React.useState<TransferRequest | null>(null)
  const [isHandoverDialogOpen, setIsHandoverDialogOpen] = React.useState(false)
  const [handoverTransfer, setHandoverTransfer] = React.useState<TransferRequest | null>(null)
  const [isReturnLocationDialogOpen, setIsReturnLocationDialogOpen] = React.useState(false)
  const [returnTransfer, setReturnTransfer] = React.useState<TransferListItem | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [deletingTransfer, setDeletingTransfer] = React.useState<TransferListItem | null>(null)

  const handleEditTransfer = React.useCallback(
    (item: TransferListItem) => {
      setEditingTransfer(mapToTransferRequest(item))
      setIsEditDialogOpen(true)
    },
    [mapToTransferRequest],
  )

  const handleViewDetail = React.useCallback(
    (item: TransferListItem) => {
      setDetailTransfer(mapToTransferRequest(item))
      setIsDetailDialogOpen(true)
    },
    [mapToTransferRequest],
  )

  const openDetailTransfer = React.useCallback((transfer: TransferRequest) => {
    setDetailTransfer(transfer)
    setIsDetailDialogOpen(true)
  }, [])

  const handleOpenDeleteDialog = React.useCallback((item: TransferListItem) => {
    setDeletingTransfer(item)
    setIsDeleteDialogOpen(true)
  }, [])

  const handleOpenReturnDialog = React.useCallback((item: TransferListItem) => {
    setReturnTransfer(item)
    setIsReturnLocationDialogOpen(true)
  }, [])

  const handleConfirmReturn = React.useCallback(
    async (viTriHoanTra: string) => {
      if (!returnTransfer) return

      try {
        await returnFromExternal(returnTransfer, viTriHoanTra)
        setReturnTransfer(null)
        setIsReturnLocationDialogOpen(false)
      } catch {
        // Mutation onError already surfaces the failure; keep the dialog open.
      }
    },
    [returnFromExternal, returnTransfer],
  )

  React.useEffect(() => {
    // Reset returnTransfer when the dialog is closed via cancel or overlay click.
    if (!isReturnLocationDialogOpen && returnTransfer) {
      setReturnTransfer(null)
    }
  }, [isReturnLocationDialogOpen, returnTransfer])

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deletingTransfer) return

    try {
      await confirmDelete(deletingTransfer)
      setIsDeleteDialogOpen(false)
      setDeletingTransfer(null)
    } catch {
      // Mutation onError already surfaces the failure; keep the dialog open.
    }
  }, [confirmDelete, deletingTransfer])

  const handleGenerateHandoverSheet = React.useCallback(
    (item: TransferListItem) => {
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
      setIsHandoverDialogOpen(true)
    },
    [mapToTransferRequest, toast],
  )

  const renderRowActions = React.useCallback(
    (item: TransferListItem) => (
      <TransferRowActions
        item={item}
        canEdit={canEditTransfer(item)}
        canDelete={canDeleteTransfer(item)}
        isTransferCoreRole={isTransferCoreRole}
        userRole={userRole || ""}
        userKhoaPhong={userKhoaPhong || undefined}
        onEdit={handleEditTransfer}
        onDelete={handleOpenDeleteDialog}
        onApprove={approveTransfer}
        onStart={startTransfer}
        onHandover={handoverToExternal}
        onReturn={handleOpenReturnDialog}
        onComplete={completeTransfer}
        onGenerateHandoverSheet={handleGenerateHandoverSheet}
      />
    ),
    [
      approveTransfer,
      canDeleteTransfer,
      canEditTransfer,
      completeTransfer,
      handleEditTransfer,
      handleGenerateHandoverSheet,
      handleOpenDeleteDialog,
      handleOpenReturnDialog,
      handoverToExternal,
      isTransferCoreRole,
      startTransfer,
      userKhoaPhong,
      userRole,
    ],
  )

  const RowActions = React.useCallback(
    ({ item }: { item: TransferListItem }) => renderRowActions(item),
    [renderRowActions],
  )

  return {
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingTransfer,
    isDetailDialogOpen,
    setIsDetailDialogOpen,
    detailTransfer,
    isHandoverDialogOpen,
    setIsHandoverDialogOpen,
    handoverTransfer,
    isReturnLocationDialogOpen,
    setIsReturnLocationDialogOpen,
    returnTransfer,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    deletingTransfer,
    RowActions,
    openDetailTransfer,
    handleEditTransfer,
    handleViewDetail,
    handleOpenDeleteDialog,
    handleOpenReturnDialog,
    handleConfirmReturn,
    handleConfirmDelete,
    handleGenerateHandoverSheet,
    renderRowActions,
  }
}
