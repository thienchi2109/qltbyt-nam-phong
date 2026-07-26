"use client"

import * as React from "react"

import type { UseTechnicalConfigurationOptionImportResult } from "../technical-configuration-option-import-types"
import {
  BulkImportErrorAlert,
  BulkImportFileInput,
  BulkImportSubmitButton,
  BulkImportSuccessMessage,
  BulkImportValidationErrors,
} from "@/components/bulk-import"
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { TechnicalConfigurationOptionImportPreview } from "./TechnicalConfigurationOptionImportPreview"

/** Composes shared P5A import parts with the P9A2 authoritative preview/apply flow. */
export function TechnicalConfigurationOptionImportDialog({
  workflow,
}: Readonly<{
  workflow: UseTechnicalConfigurationOptionImportResult
}>) {
  const [isConfirmationOpen, setIsConfirmationOpen] = React.useState(false)
  const {
    open,
    state,
    fileInputRef,
    preview,
    operationError,
    isPreviewing,
    isApplying,
    isPreviewStale,
    onOpenChange,
    handleFileChange,
    reset,
    applyPreview,
  } = workflow
  const payload = state.parsedData[0] ?? null
  const recordCount = preview?.data.rows.length ?? payload?.rows.length ?? 0
  const validationErrors = [
    ...state.validationErrors,
    ...(preview?.errors.map((error) => error.message) ?? []),
  ]
  const isBusy = isPreviewing || isApplying

  const handleReset = React.useCallback(() => {
    setIsConfirmationOpen(false)
    reset()
  }, [reset])
  const handleConfirm = React.useCallback(() => {
    setIsConfirmationOpen(false)
    void applyPreview()
  }, [applyPreview])
  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setIsConfirmationOpen(false)
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"
        showCloseButton={!isBusy && !isConfirmationOpen}
        closeLabel="Đóng"
        onEscapeKeyDown={(event) => {
          if (isConfirmationOpen) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (isConfirmationOpen) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Nhập phản hồi phương án từ Excel</DialogTitle>
          <DialogDescription>
            Template là ảnh chụp đầy đủ của phương án trên đúng phiên bản cấu hình đã chọn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <BulkImportFileInput
            id="technical-configuration-option-import-file"
            fileInputRef={fileInputRef}
            onFileChange={(event) => void handleFileChange(event)}
            disabled={isBusy || isConfirmationOpen}
            accept=".xlsx, .xls"
            label="Chọn template phản hồi phương án"
          />
          <div
            role="alert"
            aria-label="Lỗi nhập phản hồi phương án"
            aria-live="assertive"
            aria-atomic="true"
            className="space-y-2"
          >
            <BulkImportErrorAlert error={state.parseError ?? operationError} />
            <BulkImportValidationErrors errors={validationErrors} />
          </div>

          {state.selectedFile && payload ? (
            <BulkImportSuccessMessage
              fileName={state.selectedFile.name}
              recordCount={payload.rows.length}
            />
          ) : null}

          {isPreviewing ? (
            <p className="text-sm text-muted-foreground" role="status">
              Đang tạo bản xem trước từ máy chủ...
            </p>
          ) : null}

          {preview ? (
            <TechnicalConfigurationOptionImportPreview preview={preview} isStale={isPreviewStale} />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={isBusy || isConfirmationOpen}
          >
            Đặt lại
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={isBusy || isConfirmationOpen}
          >
            Hủy
          </Button>
          <BulkImportSubmitButton
            isSubmitting={isApplying}
            disabled={
              isBusy ||
              isConfirmationOpen ||
              isPreviewStale ||
              !preview ||
              preview.errors.length > 0 ||
              recordCount === 0
            }
            recordCount={recordCount}
            labelSingular="dòng"
            labelPlural="dòng"
            onClick={() => setIsConfirmationOpen(true)}
          />
        </DialogFooter>
      </DialogContent>
      <DestructiveConfirmDialog
        open={open && isConfirmationOpen}
        onOpenChange={setIsConfirmationOpen}
        title="Ghi đè toàn bộ phản hồi phương án?"
        description="Mọi tiêu chí sẽ được đồng bộ theo bản xem trước. Ô trống sẽ xóa giá trị cũ tương ứng."
        confirmLabel="Áp dụng import"
        isPending={isApplying}
        onConfirm={handleConfirm}
      />
    </Dialog>
  )
}
