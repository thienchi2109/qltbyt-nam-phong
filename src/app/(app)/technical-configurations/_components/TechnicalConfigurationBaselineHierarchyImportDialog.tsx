"use client"

import type { UseTechnicalConfigurationBaselineHierarchyImportResult } from "../_hooks/useTechnicalConfigurationBaselineHierarchyImport"
import {
  BulkImportErrorAlert,
  BulkImportFileInput,
  BulkImportSuccessMessage,
} from "@/components/bulk-import"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { TechnicalConfigurationBaselineHierarchyImportPreview } from "./TechnicalConfigurationBaselineHierarchyImportPreview"

/** Renders the production hierarchy-import dialog with destructive replacement confirmation. */
export function TechnicalConfigurationBaselineHierarchyImportDialog({
  workflow,
}: Readonly<{
  workflow: UseTechnicalConfigurationBaselineHierarchyImportResult
}>) {
  const isBusy = workflow.isParsing || workflow.isPreviewing || workflow.isApplying
  const busyMessage = workflow.isApplying
    ? "Đang áp dụng thay thế toàn bộ cấu hình..."
    : "Đang kiểm tra workbook và tạo bản xem trước..."

  return (
    <Dialog open={workflow.open} onOpenChange={workflow.onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        showCloseButton={!isBusy}
        closeLabel="Đóng"
      >
        <DialogHeader>
          <DialogTitle>Nhập cấu hình phân cấp từ Excel</DialogTitle>
          <DialogDescription>
            Chọn workbook .xlsx do hệ thống phát hành để tạo bản xem trước từ máy chủ.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <BulkImportFileInput
            id="technical-configuration-baseline-hierarchy-import-file"
            fileInputRef={workflow.fileInputRef}
            onFileChange={(event) => void workflow.handleFileChange(event)}
            disabled={isBusy}
            accept=".xlsx"
            label="Chọn workbook cấu hình phân cấp"
          />
          <div
            role="alert"
            aria-label="Lỗi nhập cấu hình phân cấp"
            aria-live="assertive"
            aria-atomic="true"
          >
            <BulkImportErrorAlert error={workflow.parseError ?? workflow.operationError} />
          </div>
          {workflow.selectedFile && workflow.parsedResult ? (
            <BulkImportSuccessMessage
              fileName={workflow.selectedFile.name}
              recordCount={workflow.parsedResult.rows.length}
            />
          ) : null}
          {isBusy ? (
            <p
              role="status"
              aria-label="Trạng thái nhập cấu hình phân cấp"
              className="text-sm text-muted-foreground"
            >
              {busyMessage}
            </p>
          ) : null}
          {workflow.preview ? (
            <>
              <TechnicalConfigurationBaselineHierarchyImportPreview
                key={workflow.previewKey}
                preview={workflow.preview}
              />
              {workflow.preview.data.effects ? (
                <fieldset className="space-y-3 border-y py-4">
                  <legend className="text-sm font-semibold">
                    Xác nhận thay thế toàn bộ cấu hình
                  </legend>
                  <p className="text-sm">
                    Import sẽ thay thế toàn bộ cấu hình của baseline draft hiện tại.
                  </p>
                  <p className="text-sm font-medium text-destructive">
                    Xóa {workflow.preview.data.effects.groups.delete} mục chính,{" "}
                    {workflow.preview.data.effects.subgroups.delete} nhóm con và{" "}
                    {workflow.preview.data.effects.criteria.delete} tiêu chí.
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="technical-configuration-baseline-hierarchy-import-confirm"
                      checked={workflow.replacementConfirmed}
                      disabled={
                        isBusy || workflow.preview.errors.length > 0 || workflow.isPreviewStale
                      }
                      onCheckedChange={(checked) =>
                        workflow.setReplacementConfirmed(checked === true)
                      }
                    />
                    <label
                      htmlFor="technical-configuration-baseline-hierarchy-import-confirm"
                      className="text-sm leading-5"
                    >
                      Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa
                    </label>
                  </div>
                </fieldset>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={workflow.reset} disabled={isBusy}>
            Đặt lại
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => workflow.onOpenChange(false)}
            disabled={isBusy}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => void workflow.applyPreview()}
            disabled={
              isBusy ||
              !workflow.preview ||
              workflow.preview.errors.length > 0 ||
              workflow.isPreviewStale ||
              !workflow.replacementConfirmed
            }
          >
            Áp dụng thay thế toàn bộ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
