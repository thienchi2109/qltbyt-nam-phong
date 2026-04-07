"use client"

import * as React from "react"

import { AddTransferDialog } from "@/components/add-transfer-dialog"
import { EditTransferDialog } from "@/components/edit-transfer-dialog"
import { HandoverPreviewDialog } from "@/components/handover-preview-dialog"
import { TransferDetailDialog } from "@/components/transfer-detail-dialog"
import { FilterModal, type FilterModalValue } from "@/components/transfers/FilterModal"
import { ReturnLocationDialog } from "@/components/transfers/ReturnLocationDialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { TransferRequest } from "@/types/database"
import type { TransferListItem } from "@/types/transfers-data-grid"

type FilterModalVariant = "dialog" | "sheet"

export type TransfersDialogsProps = Readonly<{
  isAddDialogOpen: boolean
  onAddDialogOpenChange: (open: boolean) => void
  onAddSuccess: () => void
  isEditDialogOpen: boolean
  onEditDialogOpenChange: (open: boolean) => void
  onEditSuccess: () => void
  editingTransfer: TransferRequest | null
  detailDialogOpen: boolean
  onDetailDialogOpenChange: (open: boolean) => void
  detailTransfer: TransferRequest | null
  handoverDialogOpen: boolean
  onHandoverDialogOpenChange: (open: boolean) => void
  handoverTransfer: TransferRequest | null
  returnLocationDialogOpen: boolean
  onReturnLocationDialogOpenChange: (open: boolean) => void
  returnTransfer: TransferListItem | null
  isReturning: boolean
  onConfirmReturn: (viTriHoanTra: string) => Promise<void>
  deleteDialogOpen: boolean
  onDeleteDialogOpenChange: (open: boolean) => void
  onConfirmDelete: () => void | Promise<void>
  isFilterModalOpen: boolean
  onFilterModalOpenChange: (open: boolean) => void
  filterValue: FilterModalValue
  onFilterChange: (value: FilterModalValue) => void
  filterVariant: FilterModalVariant
}>

export function TransfersDialogs({
  isAddDialogOpen,
  onAddDialogOpenChange,
  onAddSuccess,
  isEditDialogOpen,
  onEditDialogOpenChange,
  onEditSuccess,
  editingTransfer,
  detailDialogOpen,
  onDetailDialogOpenChange,
  detailTransfer,
  handoverDialogOpen,
  onHandoverDialogOpenChange,
  handoverTransfer,
  returnLocationDialogOpen,
  onReturnLocationDialogOpenChange,
  returnTransfer,
  isReturning,
  onConfirmReturn,
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  onConfirmDelete,
  isFilterModalOpen,
  onFilterModalOpenChange,
  filterValue,
  onFilterChange,
  filterVariant,
}: TransfersDialogsProps) {
  return (
    <>
      {isAddDialogOpen && (
        <AddTransferDialog
          open={isAddDialogOpen}
          onOpenChange={onAddDialogOpenChange}
          onSuccess={onAddSuccess}
        />
      )}

      {isEditDialogOpen && (
        <EditTransferDialog
          open={isEditDialogOpen}
          onOpenChange={onEditDialogOpenChange}
          onSuccess={onEditSuccess}
          transfer={editingTransfer}
        />
      )}

      {detailDialogOpen && (
        <TransferDetailDialog
          open={detailDialogOpen}
          onOpenChange={onDetailDialogOpenChange}
          transfer={detailTransfer}
        />
      )}

      {handoverDialogOpen && (
        <HandoverPreviewDialog
          open={handoverDialogOpen}
          onOpenChange={onHandoverDialogOpenChange}
          transfer={handoverTransfer}
        />
      )}

      {returnLocationDialogOpen && (
        <ReturnLocationDialog
          open={returnLocationDialogOpen}
          isSubmitting={isReturning}
          onOpenChange={onReturnLocationDialogOpenChange}
          transfer={returnTransfer}
          onConfirm={onConfirmReturn}
        />
      )}

      {isFilterModalOpen && (
        <FilterModal
          open={isFilterModalOpen}
          onOpenChange={onFilterModalOpenChange}
          value={filterValue}
          onChange={onFilterChange}
          variant={filterVariant}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa yêu cầu luân chuyển này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
            >
              Xóa
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
