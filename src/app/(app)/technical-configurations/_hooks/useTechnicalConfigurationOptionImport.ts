"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { useTechnicalConfigurationBeforeUnloadGuard } from "./useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationOptionResponsesQuery } from "./useTechnicalConfigurationOptionResponsesQuery"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import { isTechnicalConfigurationBaselineConflict } from "../technical-configuration-baseline-version-state"
import {
  fetchTechnicalConfigurationDossierRevision,
  updateTechnicalConfigurationDossierRevisionCache,
} from "../technical-configuration-dossier-revision-cache"
import { technicalConfigurationDossierDetailQueryKey } from "../technical-configuration-query-keys"
import {
  getTechnicalConfigurationOptionImportErrorMessage,
  toTechnicalConfigurationOptionWorkbookCriteria,
  validateParsedTechnicalConfigurationOptionWorkbook,
  withTechnicalConfigurationOptionImportRevision,
} from "../technical-configuration-option-import-state"
import { downloadTechnicalConfigurationOptionTemplate } from "../technical-configuration-option-import-download"
import { selectNewestTechnicalConfigurationOptionResponseSnapshot } from "../technical-configuration-option-response-state"
import {
  applyTechnicalConfigurationOptionImport,
  previewTechnicalConfigurationOptionImport,
} from "../technical-configuration-option-import-rpc"
import type {
  UseTechnicalConfigurationOptionImportOptions,
  UseTechnicalConfigurationOptionImportResult,
} from "../technical-configuration-option-import-types"
import type {
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationOptionImportPreviewWireResponse,
} from "../supplier-option-types"
import { useBulkImportState } from "@/components/bulk-import"
import { type TechnicalConfigurationOptionWorkbookParseResult } from "@/lib/technical-configuration-option-excel-contract"
import { createTechnicalConfigurationOptionWorkbookParser } from "@/lib/technical-configuration-option-excel-parse"

/** Owns the transient P9A3 option workbook, preview, apply, and stale-retry lifecycle. */
export function useTechnicalConfigurationOptionImport({
  dossier,
  option,
  baselineVersion,
  isBlocked,
  onRevisionChange,
}: UseTechnicalConfigurationOptionImportOptions): UseTechnicalConfigurationOptionImportResult {
  const queryClient = useQueryClient()
  const { queryKey, responseQuery } = useTechnicalConfigurationOptionResponsesQuery({
    optionId: option.id,
    baselineVersionId: baselineVersion?.id ?? null,
  })
  const [open, setOpen] = React.useState(false)
  const [preview, setPreview] =
    React.useState<TechnicalConfigurationOptionImportPreviewWireResponse | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = React.useState(false)
  const [isApplying, setIsApplying] = React.useState(false)
  const [isPreviewStale, setIsPreviewStale] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [revisionOverride, setRevisionOverride] = React.useState<number | null>(null)
  const previewedPayloadRef = React.useRef<TechnicalConfigurationOptionWorkbookParseResult | null>(
    null
  )
  const currentRevision = Math.max(
    dossier.revision,
    option.revision,
    baselineVersion?.revision ?? 0,
    responseQuery.data?.revision ?? 0,
    revisionOverride ?? 0
  )
  const expectedCriteria = React.useMemo(
    () => (baselineVersion ? toTechnicalConfigurationOptionWorkbookCriteria(baselineVersion) : []),
    [baselineVersion]
  )
  const parseWorkbook = React.useMemo(
    () =>
      createTechnicalConfigurationOptionWorkbookParser({
        expectedMetadata: {
          dossier_id: dossier.id,
          option_id: option.id,
          baseline_version_id: baselineVersion?.id ?? "",
          dossier_revision: currentRevision,
        },
        expectedCriteria,
      }),
    [baselineVersion?.id, currentRevision, dossier.id, expectedCriteria, option.id]
  )
  const bulkImport = useBulkImportState<
    TechnicalConfigurationOptionWorkbookParseResult,
    TechnicalConfigurationOptionWorkbookParseResult
  >({
    parseWorkbook,
    validateData: validateParsedTechnicalConfigurationOptionWorkbook,
  })
  const parsedPayload = bulkImport.state.parsedData[0] ?? null
  const payload = React.useMemo(
    () =>
      parsedPayload
        ? withTechnicalConfigurationOptionImportRevision(parsedPayload, currentRevision)
        : null,
    [currentRevision, parsedPayload]
  )
  const isReadOnly = Boolean(dossier.archived_at)
  const isDirty = Boolean(
    bulkImport.state.selectedFile ||
    bulkImport.state.parseError ||
    bulkImport.state.validationErrors.length > 0 ||
    preview ||
    isPreviewing ||
    isApplying
  )
  const isNavigationBlocked = isDirty || isDownloading
  const canUseActions =
    baselineVersion !== null && !isReadOnly && !isBlocked && responseQuery.isSuccess

  useTechnicalConfigurationBeforeUnloadGuard(isDirty)

  const reset = React.useCallback(() => {
    previewedPayloadRef.current = null
    bulkImport.resetState()
    setPreview(null)
    setOperationError(null)
    setIsPreviewStale(false)
  }, [bulkImport])

  const recoverFromConflict = React.useCallback(async () => {
    setIsPreviewStale(true)
    setOperationError(
      "Hồ sơ đã thay đổi trên máy chủ. File, dữ liệu chuẩn hóa và bản xem trước vẫn được giữ."
    )
    try {
      const refreshedRevision = await fetchTechnicalConfigurationDossierRevision(
        queryClient,
        dossier.id
      )
      setRevisionOverride(refreshedRevision)
      onRevisionChange?.(refreshedRevision)
    } catch {
      setOperationError(
        "Hồ sơ đã thay đổi nhưng không thể tải revision mới. File và bản xem trước vẫn được giữ."
      )
    }
  }, [dossier.id, onRevisionChange, queryClient])

  React.useEffect(() => {
    if (!baselineVersion || !open || !payload || isBlocked || isReadOnly || isApplying) return

    let cancelled = false
    setIsPreviewing(true)
    setOperationError(null)
    previewedPayloadRef.current = null

    void previewTechnicalConfigurationOptionImport({
      p_option_id: option.id,
      p_baseline_version_id: baselineVersion.id,
      p_template_metadata: payload.metadata,
      p_rows: payload.rows,
      p_expected_revision: currentRevision,
    })
      .then((response) => {
        if (cancelled) return
        previewedPayloadRef.current = payload
        setPreview(response)
        setIsPreviewStale(false)
      })
      .catch(async (error: unknown) => {
        if (cancelled) return
        if (isTechnicalConfigurationBaselineConflict(error)) {
          await recoverFromConflict()
          return
        }
        setOperationError(
          getTechnicalConfigurationOptionImportErrorMessage(
            error,
            "Không thể tạo bản xem trước phản hồi phương án."
          )
        )
      })
      .finally(() => {
        if (!cancelled) setIsPreviewing(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    baselineVersion,
    currentRevision,
    isApplying,
    isBlocked,
    isReadOnly,
    open,
    option.id,
    payload,
    recoverFromConflict,
  ])

  const openDialog = React.useCallback(() => {
    if (canUseActions) setOpen(true)
  }, [canUseActions])
  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (isPreviewing || isApplying)) return
      setOpen(nextOpen)
    },
    [isApplying, isPreviewing]
  )
  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!canUseActions) return
      previewedPayloadRef.current = null
      setPreview(null)
      setOperationError(null)
      setIsPreviewStale(false)
      await bulkImport.handleFileChange(event)
    },
    [bulkImport, canUseActions]
  )
  const downloadTemplate = React.useCallback(async () => {
    if (!canUseActions || !baselineVersion) return
    setIsDownloading(true)
    setOperationError(null)
    try {
      await downloadTechnicalConfigurationOptionTemplate({
        dossier,
        option,
        baselineVersion,
        comparisonSet: responseQuery.data ?? null,
        revision: currentRevision,
      })
    } catch (error: unknown) {
      setOperationError(
        getTechnicalConfigurationOptionImportErrorMessage(
          error,
          "Không thể tải template phản hồi phương án."
        )
      )
    } finally {
      setIsDownloading(false)
    }
  }, [baselineVersion, canUseActions, currentRevision, dossier.id, option.id, responseQuery.data])
  const applyPreview = React.useCallback(async () => {
    const previewedPayload = previewedPayloadRef.current
    if (
      !baselineVersion ||
      !previewedPayload ||
      !preview ||
      preview.errors.length > 0 ||
      isPreviewStale ||
      !canUseActions
    ) {
      return
    }

    setIsApplying(true)
    setOperationError(null)
    try {
      const response = await applyTechnicalConfigurationOptionImport({
        p_option_id: option.id,
        p_baseline_version_id: baselineVersion.id,
        p_template_metadata: previewedPayload.metadata,
        p_rows: previewedPayload.rows,
        p_expected_revision: previewedPayload.metadata.dossier_revision,
      })
      await Promise.all([
        queryClient.cancelQueries({ queryKey, exact: true }),
        queryClient.cancelQueries({
          queryKey: technicalConfigurationDossierDetailQueryKey(dossier.id),
          exact: true,
        }),
      ])
      const adoptedSnapshot =
        queryClient.setQueryData<TechnicalConfigurationComparisonSetWire | null>(
          queryKey,
          (current) =>
            selectNewestTechnicalConfigurationOptionResponseSnapshot(current, response.data)
        ) ?? response.data
      updateTechnicalConfigurationDossierRevisionCache(
        queryClient,
        dossier,
        adoptedSnapshot.revision
      )
      onRevisionChange?.(adoptedSnapshot.revision)
      reset()
      setOpen(false)
    } catch (error: unknown) {
      if (isTechnicalConfigurationBaselineConflict(error)) {
        await recoverFromConflict()
      } else {
        setOperationError(
          getTechnicalConfigurationOptionImportErrorMessage(
            error,
            "Không thể áp dụng phản hồi phương án."
          )
        )
      }
    } finally {
      setIsApplying(false)
    }
  }, [
    baselineVersion,
    canUseActions,
    dossier,
    isPreviewStale,
    onRevisionChange,
    option.id,
    preview,
    queryClient,
    queryKey,
    recoverFromConflict,
    reset,
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
    isDirty,
    isNavigationBlocked,
    canUseActions,
    openDialog,
    onOpenChange,
    handleFileChange,
    reset,
    downloadTemplate,
    applyPreview,
  }
}
