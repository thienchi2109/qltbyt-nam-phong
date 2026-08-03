"use client"

import * as React from "react"
import { AlertTriangle, Clock3, Download, RotateCcw, TableProperties } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createTechnicalConfigurationResultExportState,
  getTechnicalConfigurationResultExportSelectionSummary,
  getTechnicalConfigurationResultExportValidationError,
  hasTechnicalConfigurationResultExportCurrentOptionPage,
  transitionTechnicalConfigurationResultExport,
  type TechnicalConfigurationResultExportContext,
  type TechnicalConfigurationResultExportCriterionScope,
  type TechnicalConfigurationResultExportDialogRequest,
  type TechnicalConfigurationResultExportOptionScope,
  type TechnicalConfigurationResultExportState,
  type TechnicalConfigurationResultExportValidationError,
} from "@/app/(app)/technical-configurations/technical-configuration-result-export-state"
import type { TechnicalConfigurationResultExportMode } from "@/app/(app)/technical-configurations/technical-configuration-result-export-types"
import { TechnicalConfigurationResultExportDialogChoice } from "./TechnicalConfigurationResultExportDialogChoice"

/** Controlled P14C1 dialog props. The parent owns visibility and receives one request intent. */
export type TechnicalConfigurationResultExportDialogProps = Readonly<{
  open: boolean
  context: TechnicalConfigurationResultExportContext
  onOpenChange: (open: boolean) => void
  onConfirm: (request: TechnicalConfigurationResultExportDialogRequest) => void
}>

const VALIDATION_MESSAGES: Record<TechnicalConfigurationResultExportValidationError, string> = {
  missing_identity: "Không thể xác định hồ sơ hoặc phiên bản cơ sở để xuất.",
  invalid_totals: "Tổng số phương án hoặc tiêu chí không hợp lệ.",
  unavailable_option_scope: "Phạm vi phương án này không còn khả dụng.",
  empty_current_option_page: "Trang hiện tại không có phương án để xuất.",
  empty_selected_options: "Chưa có phương án nào được chọn.",
  unavailable_criterion_scope: "Phạm vi tiêu chí này không còn khả dụng.",
  empty_current_criterion_page: "Trang hiện tại không có tiêu chí để xuất.",
}

const RESULT_EXPORT_MODES = [
  "full",
  "ranking_only",
  "detailed_matrix_only",
] as const satisfies readonly TechnicalConfigurationResultExportMode[]

function modeTitle(mode: TechnicalConfigurationResultExportMode): string {
  if (mode === "ranking_only") return "Chỉ xếp hạng"
  if (mode === "detailed_matrix_only") return "Chỉ ma trận chi tiết"
  return "Đầy đủ"
}

function modeDescription(mode: TechnicalConfigurationResultExportMode): string {
  if (mode === "ranking_only") return "Danh sách thứ hạng và trạng thái hoàn thiện"
  if (mode === "detailed_matrix_only") {
    return "Yêu cầu cơ sở, phản hồi và kết luận đánh giá"
  }
  return "Tổng quan, xếp hạng và ma trận chi tiết"
}

function ResultExportDialogContent({
  context,
  onOpenChange,
  onConfirm,
  returnFocusRef,
}: Readonly<{
  context: TechnicalConfigurationResultExportContext
  onOpenChange: (open: boolean) => void
  onConfirm: (request: TechnicalConfigurationResultExportDialogRequest) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}>) {
  const baseId = React.useId()
  const firstModeRef = React.useRef<HTMLInputElement>(null)
  const [storedState, setStoredState] = React.useState<TechnicalConfigurationResultExportState>(
    () => {
      const initial = createTechnicalConfigurationResultExportState(context)
      return transitionTechnicalConfigurationResultExport(initial, { type: "open" }).state
    }
  )
  const state = transitionTechnicalConfigurationResultExport(storedState, {
    type: "context_changed",
    context,
  }).state
  const validationError = getTechnicalConfigurationResultExportValidationError(state)
  const summary = getTechnicalConfigurationResultExportSelectionSummary(state)
  const hasCurrentOptionPage = hasTechnicalConfigurationResultExportCurrentOptionPage(state.context)

  function synchronizeContext(current: TechnicalConfigurationResultExportState) {
    return transitionTechnicalConfigurationResultExport(current, {
      type: "context_changed",
      context,
    }).state
  }

  function applyEvent(
    event:
      | Readonly<{ type: "reset" }>
      | Readonly<{ type: "mode_changed"; mode: TechnicalConfigurationResultExportMode }>
      | Readonly<{
          type: "option_scope_changed"
          scope: TechnicalConfigurationResultExportOptionScope
        }>
      | Readonly<{
          type: "criterion_scope_changed"
          scope: TechnicalConfigurationResultExportCriterionScope
        }>
  ) {
    setStoredState(
      (current) =>
        transitionTechnicalConfigurationResultExport(synchronizeContext(current), event).state
    )
  }

  function handleCancel() {
    setStoredState(
      (current) =>
        transitionTechnicalConfigurationResultExport(synchronizeContext(current), {
          type: "cancel",
        }).state
    )
    onOpenChange(false)
  }

  function handleConfirm() {
    const result = transitionTechnicalConfigurationResultExport(state, { type: "confirm" })
    if (!result.request) return
    setStoredState(result.state)
    onConfirm(result.request)
    onOpenChange(false)
  }

  const optionPage = state.context.options.page
  const criterionPage = state.context.criteria.page

  return (
    <DialogContent
      className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl"
      closeLabel="Đóng"
      onOpenAutoFocus={(event) => {
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement && activeElement !== document.body) {
          returnFocusRef.current = activeElement
        }
        event.preventDefault()
        firstModeRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        const returnTarget = returnFocusRef.current
        if (!returnTarget?.isConnected) return
        event.preventDefault()
        returnTarget.focus()
        returnFocusRef.current = null
      }}
    >
      <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Download className="size-5 text-emerald-700" aria-hidden="true" />
          Xuất kết quả Excel
        </DialogTitle>
        <DialogDescription>
          Chọn nội dung và phạm vi dữ liệu sẽ được đưa vào workbook.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 px-6 py-1">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Nội dung workbook</legend>
          <div className="overflow-hidden border">
            {RESULT_EXPORT_MODES.map((mode, index) => (
              <TechnicalConfigurationResultExportDialogChoice
                key={mode}
                id={`${baseId}-mode-${mode}`}
                name={`${baseId}-mode`}
                value={mode}
                checked={state.mode === mode}
                title={modeTitle(mode)}
                description={modeDescription(mode)}
                recommended={mode === "full"}
                inputRef={index === 0 ? firstModeRef : undefined}
                onChange={() => applyEvent({ type: "mode_changed", mode })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Phạm vi phương án</legend>
          <div className="overflow-hidden border">
            <TechnicalConfigurationResultExportDialogChoice
              id={`${baseId}-options-all`}
              name={`${baseId}-options`}
              value="all"
              checked={state.optionScope === "all"}
              title={`Tất cả ${state.context.options.total} phương án`}
              onChange={() => applyEvent({ type: "option_scope_changed", scope: "all" })}
            />
            {hasCurrentOptionPage && optionPage ? (
              <TechnicalConfigurationResultExportDialogChoice
                id={`${baseId}-options-current`}
                name={`${baseId}-options`}
                value="current_page"
                checked={state.optionScope === "current_page"}
                title={`${optionPage.currentIds.length} phương án đang hiển thị`}
                onChange={() => applyEvent({ type: "option_scope_changed", scope: "current_page" })}
              />
            ) : null}
            {optionPage ? (
              <TechnicalConfigurationResultExportDialogChoice
                id={`${baseId}-options-selected`}
                name={`${baseId}-options`}
                value="selected"
                checked={state.optionScope === "selected"}
                title={`${optionPage.selectedIds.length} phương án đã chọn`}
                onChange={() => applyEvent({ type: "option_scope_changed", scope: "selected" })}
              />
            ) : null}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Phạm vi tiêu chí</legend>
          <div className="overflow-hidden border">
            <TechnicalConfigurationResultExportDialogChoice
              id={`${baseId}-criteria-all`}
              name={`${baseId}-criteria`}
              value="all"
              checked={state.criterionScope === "all"}
              title={`Tất cả ${state.context.criteria.total} tiêu chí`}
              onChange={() => applyEvent({ type: "criterion_scope_changed", scope: "all" })}
            />
            {criterionPage ? (
              <TechnicalConfigurationResultExportDialogChoice
                id={`${baseId}-criteria-current`}
                name={`${baseId}-criteria`}
                value="current_page"
                checked={state.criterionScope === "current_page"}
                title={`Trang tiêu chí hiện tại · ${criterionPage.currentIds.length} tiêu chí`}
                onChange={() =>
                  applyEvent({ type: "criterion_scope_changed", scope: "current_page" })
                }
              />
            ) : null}
          </div>
        </fieldset>

        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y bg-muted/30 px-3 py-3 text-sm"
          aria-label="Tóm tắt phạm vi xuất"
        >
          <TableProperties className="size-4 text-emerald-700" aria-hidden="true" />
          <span>
            Sẽ xuất: {summary.optionCount} phương án x {summary.criterionCount} tiêu chí
          </span>
          <span aria-hidden="true">·</span>
          <span>{summary.visibleSheetCount} sheet hiển thị</span>
        </div>

        {validationError ? (
          <div
            role="alert"
            className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{VALIDATION_MESSAGES[validationError]}</span>
          </div>
        ) : null}

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Dữ liệu được tải lại theo cùng một snapshot trước khi tạo file.</p>
          {state.mode !== "detailed_matrix_only" ? (
            <p className="flex items-start gap-2 text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Xếp hạng chỉ mang tính tham khảo, không phải quyết định lựa chọn nhà cung cấp.
              </span>
            </p>
          ) : null}
          <p className="flex items-center gap-2">
            <Clock3 className="size-4 shrink-0" aria-hidden="true" />
            Có thể mất vài giây với phạm vi lớn.
          </p>
        </div>
      </div>

      <DialogFooter className="border-t px-6 py-4 sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => applyEvent({ type: "reset" })}>
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          Đặt lại
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Hủy
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={validationError !== null}>
            <Download className="mr-2 size-4" aria-hidden="true" />
            Xuất file .xlsx
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  )
}

/** Renders the isolated P14C1 result-export dialog without mounting any export side effect. */
export function TechnicalConfigurationResultExportDialog({
  open,
  context,
  onOpenChange,
  onConfirm,
}: TechnicalConfigurationResultExportDialogProps) {
  const returnFocusRef = React.useRef<HTMLElement | null>(null)
  const identityKey = JSON.stringify([context.dossierId, context.baselineVersionId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ResultExportDialogContent
          key={identityKey}
          context={context}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </Dialog>
  )
}
