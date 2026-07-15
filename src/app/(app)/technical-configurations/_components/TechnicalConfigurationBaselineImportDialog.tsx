"use client"

import {
  BulkImportErrorAlert,
  BulkImportFileInput,
  BulkImportSubmitButton,
  BulkImportSuccessMessage,
  BulkImportValidationErrors,
} from "@/components/bulk-import"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UseTechnicalConfigurationBaselineImportResult } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImport"

import { TechnicalConfigurationBaselineImportPreview } from "./TechnicalConfigurationBaselineImportPreview"

/** Composes shared P5A import parts with the P5D authoritative preview. */
export function TechnicalConfigurationBaselineImportDialog({
  workflow,
}: Readonly<{
  workflow: UseTechnicalConfigurationBaselineImportResult
}>) {
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
  const parsedPayload = state.parsedData[0] ?? null
  const recordCount = preview?.data.rows.length ?? parsedPayload?.rows.length ?? 0
  const isBusy = isPreviewing || isApplying

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"
        showCloseButton={!isBusy}
        closeLabel="Đóng"
      >
        <DialogHeader>
          <DialogTitle>Nhập cấu hình cơ sở từ Excel</DialogTitle>
          <DialogDescription>
            Chỉ template được tải từ phiên bản nháp hiện tại mới được chấp nhận.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <BulkImportFileInput
            id="technical-configuration-baseline-import-file"
            fileInputRef={fileInputRef}
            onFileChange={(event) => void handleFileChange(event)}
            disabled={isPreviewing || isApplying}
            accept=".xlsx, .xls"
            label="Chọn template cấu hình cơ sở"
          />
          <div
            role="alert"
            aria-label="Lỗi nhập cấu hình cơ sở"
            aria-live="assertive"
            aria-atomic="true"
            className="space-y-2"
          >
            <BulkImportErrorAlert error={state.parseError ?? operationError} />
            <BulkImportValidationErrors errors={state.validationErrors} />
          </div>

          {state.selectedFile && parsedPayload ? (
            <BulkImportSuccessMessage
              fileName={state.selectedFile.name}
              recordCount={parsedPayload.rows.length}
            />
          ) : null}

          {isPreviewing ? (
            <p className="text-sm text-muted-foreground" role="status">
              Đang tạo bản xem trước từ máy chủ...
            </p>
          ) : null}

          {preview ? <TechnicalConfigurationBaselineImportPreview preview={preview} /> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={reset} disabled={isBusy}>
            Đặt lại
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Hủy
          </Button>
          <BulkImportSubmitButton
            isSubmitting={isApplying}
            disabled={
              isApplying ||
              isPreviewing ||
              isPreviewStale ||
              !preview ||
              preview.errors.length > 0 ||
              recordCount === 0
            }
            recordCount={recordCount}
            labelSingular="dòng"
            labelPlural="dòng"
            onClick={() => void applyPreview()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
