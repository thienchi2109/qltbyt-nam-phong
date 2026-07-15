"use client"

import * as React from "react"

import { useTechnicalConfigurationBaseline } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline"
import type {
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineImportPreviewWireResponse,
} from "@/app/(app)/technical-configurations/baseline-types"
import {
  BASELINE_WORKBOOK_MIME_TYPE,
  getBaselineImportErrorMessage,
  toBaselineWorkbookRows,
  validateParsedBaselineWorkbook,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-import-utils"
import { isTechnicalConfigurationBaselineConflict } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { useBulkImportState } from "@/components/bulk-import"
import { downloadBlob } from "@/lib/excel-workbook"
import {
  BASELINE_WORKBOOK_TEMPLATE_KIND,
  BASELINE_WORKBOOK_TEMPLATE_VERSION,
  type TechnicalConfigurationBaselineWorkbookParseResult,
} from "@/lib/technical-configuration-baseline-excel-contract"
import { createTechnicalConfigurationBaselineWorkbook } from "@/lib/technical-configuration-baseline-excel-export"
import { createTechnicalConfigurationBaselineWorkbookParser } from "@/lib/technical-configuration-baseline-excel-parse"

type UseTechnicalConfigurationBaselineImportOptions = {
  dossierId: string
  selectedVersion: TechnicalConfigurationBaselineDraftWire | null
  isBlocked: boolean
  onApplied: (version: TechnicalConfigurationBaselineDraftWire) => Promise<void>
  onConflict: (versionId: string) => Promise<void>
  onUnresolvedStateChange: (unresolved: boolean) => void
}

export interface UseTechnicalConfigurationBaselineImportResult {
  open: boolean
  state: ReturnType<
    typeof useBulkImportState<
      TechnicalConfigurationBaselineWorkbookParseResult,
      TechnicalConfigurationBaselineWorkbookParseResult
    >
  >["state"]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  preview: TechnicalConfigurationBaselineImportPreviewWireResponse | null
  operationError: string | null
  isPreviewing: boolean
  isApplying: boolean
  isPreviewStale: boolean
  isDownloading: boolean
  hasUnresolvedState: boolean
  openDialog: () => void
  onOpenChange: (open: boolean) => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  reset: () => void
  downloadTemplate: () => Promise<void>
  applyPreview: () => Promise<void>
}

/** Owns the transient P5D workbook, preview, apply, and conflict lifecycle. */
export function useTechnicalConfigurationBaselineImport({
  dossierId,
  selectedVersion,
  isBlocked,
  onApplied,
  onConflict,
  onUnresolvedStateChange,
}: UseTechnicalConfigurationBaselineImportOptions): UseTechnicalConfigurationBaselineImportResult {
  const rpc = useTechnicalConfigurationBaseline()
  const [open, setOpen] = React.useState(false)
  const [preview, setPreview] =
    React.useState<TechnicalConfigurationBaselineImportPreviewWireResponse | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = React.useState(false)
  const [isApplying, setIsApplying] = React.useState(false)
  const [isPreviewStale, setIsPreviewStale] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const previewedPayloadRef =
    React.useRef<TechnicalConfigurationBaselineWorkbookParseResult | null>(null)
  const onAppliedRef = React.useRef(onApplied)
  const onConflictRef = React.useRef(onConflict)
  React.useEffect(() => {
    onAppliedRef.current = onApplied
    onConflictRef.current = onConflict
  }, [onApplied, onConflict])
  const recoverFromConflict = React.useCallback(async (message: string, versionId: string) => {
    setIsPreviewStale(true)
    setOperationError(message)
    try {
      await onConflictRef.current(versionId)
    } catch {
      setOperationError(
        "Phiên bản đã thay đổi nhưng không thể tải trạng thái mới. File và bản xem trước vẫn được giữ."
      )
    }
  }, [])
  const existingCriterionCodes = React.useMemo(
    () =>
      new Set(
        selectedVersion?.groups.flatMap((group) =>
          group.criteria.map((criterion) => criterion.criterion_code)
        ) ?? []
      ),
    [selectedVersion]
  )
  const parseWorkbook = React.useMemo(
    () => createTechnicalConfigurationBaselineWorkbookParser({ existingCriterionCodes }),
    [existingCriterionCodes]
  )
  const bulkImport = useBulkImportState<
    TechnicalConfigurationBaselineWorkbookParseResult,
    TechnicalConfigurationBaselineWorkbookParseResult
  >({
    parseWorkbook,
    validateData: validateParsedBaselineWorkbook,
  })
  const payload = bulkImport.state.parsedData[0] ?? null

  const reset = React.useCallback(() => {
    previewedPayloadRef.current = null
    setPreview(null)
    setOperationError(null)
    setIsPreviewing(false)
    setIsApplying(false)
    setIsPreviewStale(false)
    bulkImport.resetState()
  }, [bulkImport.resetState])

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (isPreviewing || isApplying)) return
      setOpen(nextOpen)
      if (!nextOpen) reset()
    },
    [isApplying, isPreviewing, reset]
  )

  const openDialog = React.useCallback(() => {
    if (isBlocked || selectedVersion?.status !== "draft") return
    setOperationError(null)
    setOpen(true)
  }, [isBlocked, selectedVersion?.status])

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      previewedPayloadRef.current = null
      setPreview(null)
      setOperationError(null)
      setIsPreviewStale(false)
      await bulkImport.handleFileChange(event)
    },
    [bulkImport.handleFileChange]
  )

  React.useEffect(() => {
    if (
      !open ||
      !payload ||
      isBlocked ||
      selectedVersion?.status !== "draft" ||
      previewedPayloadRef.current === payload
    ) {
      return
    }

    previewedPayloadRef.current = payload
    let cancelled = false
    setIsPreviewing(true)
    setPreview(null)
    setOperationError(null)
    setIsPreviewStale(false)

    void rpc
      .previewImport({
        p_baseline_version_id: selectedVersion.id,
        p_template_metadata: payload.metadata,
        p_rows: payload.rows,
        p_expected_revision: selectedVersion.revision,
      })
      .then((response) => {
        if (!cancelled) setPreview(response)
      })
      .catch(async (error: unknown) => {
        if (cancelled) return
        if (isTechnicalConfigurationBaselineConflict(error)) {
          await recoverFromConflict(
            "Phiên bản đã thay đổi trên máy chủ. Hãy tải template mới trước khi nhập lại.",
            selectedVersion.id
          )
          return
        }
        setOperationError(
          getBaselineImportErrorMessage(error, "Không thể tạo bản xem trước cấu hình cơ sở.")
        )
      })
      .finally(() => {
        if (!cancelled) setIsPreviewing(false)
      })

    return () => {
      cancelled = true
    }
  }, [isBlocked, open, payload, recoverFromConflict, rpc, selectedVersion])

  const hasUnresolvedState =
    open &&
    Boolean(
      bulkImport.state.selectedFile ||
      bulkImport.state.parseError ||
      bulkImport.state.validationErrors.length > 0 ||
      preview ||
      operationError ||
      isPreviewing ||
      isApplying
    )

  React.useEffect(() => {
    onUnresolvedStateChange(hasUnresolvedState)
  }, [hasUnresolvedState, onUnresolvedStateChange])

  const downloadTemplate = React.useCallback(async () => {
    if (isBlocked || selectedVersion?.status !== "draft") return
    setIsDownloading(true)
    setOperationError(null)
    try {
      const workbook = await createTechnicalConfigurationBaselineWorkbook({
        metadata: {
          template_kind: BASELINE_WORKBOOK_TEMPLATE_KIND,
          template_version: BASELINE_WORKBOOK_TEMPLATE_VERSION,
          dossier_id: dossierId,
          baseline_version_id: selectedVersion.id,
          baseline_revision: selectedVersion.revision,
          generated_at: new Date().toISOString(),
        },
        rows: toBaselineWorkbookRows(selectedVersion),
      })
      const buffer = await workbook.xlsx.writeBuffer()
      downloadBlob(
        new Blob([buffer], { type: BASELINE_WORKBOOK_MIME_TYPE }),
        `Mau_Cau_Hinh_Co_So_Phien_Ban_${selectedVersion.version_number}.xlsx`
      )
    } catch (error: unknown) {
      setOperationError(
        getBaselineImportErrorMessage(error, "Không thể tải template cấu hình cơ sở.")
      )
    } finally {
      setIsDownloading(false)
    }
  }, [dossierId, isBlocked, selectedVersion])

  const applyPreview = React.useCallback(async () => {
    if (
      !payload ||
      !preview ||
      isBlocked ||
      preview.errors.length > 0 ||
      isPreviewStale ||
      selectedVersion?.status !== "draft"
    ) {
      return
    }

    setIsApplying(true)
    setOperationError(null)
    try {
      const response = await rpc.applyImport({
        p_baseline_version_id: selectedVersion.id,
        p_template_metadata: payload.metadata,
        p_rows: payload.rows,
        p_expected_revision: selectedVersion.revision,
      })
      try {
        await onAppliedRef.current(response.data)
      } catch {
        reset()
        setOpen(false)
        setOperationError("Đã nhập cấu hình cơ sở nhưng không thể tải lại trạng thái hồ sơ.")
        return
      }
      reset()
      setOpen(false)
    } catch (error: unknown) {
      if (isTechnicalConfigurationBaselineConflict(error)) {
        await recoverFromConflict(
          "Phiên bản đã thay đổi trên máy chủ. File và bản xem trước vẫn được giữ để đối chiếu.",
          selectedVersion.id
        )
      } else {
        setOperationError(getBaselineImportErrorMessage(error, "Không thể áp dụng cấu hình cơ sở."))
      }
    } finally {
      setIsApplying(false)
    }
  }, [
    isBlocked,
    isPreviewStale,
    payload,
    preview,
    recoverFromConflict,
    reset,
    rpc,
    selectedVersion,
  ])

  return {
    open,
    state: bulkImport.state,
    fileInputRef: bulkImport.fileInputRef,
    preview,
    operationError,
    isPreviewing,
    isApplying,
    isPreviewStale,
    isDownloading,
    hasUnresolvedState,
    openDialog,
    onOpenChange,
    handleFileChange,
    reset,
    downloadTemplate,
    applyPreview,
  }
}
