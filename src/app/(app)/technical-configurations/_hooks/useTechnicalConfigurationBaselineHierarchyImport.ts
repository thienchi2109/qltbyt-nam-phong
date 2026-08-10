"use client"

import * as React from "react"

import { useTechnicalConfigurationBaseline } from "./useTechnicalConfigurationBaseline"
import type { TechnicalConfigurationBaselineDecodedDraft } from "../baseline-types"
import {
  formatTechnicalConfigurationBaselineHierarchyImportPreviewError,
  toTechnicalConfigurationBaselineExistingHierarchy,
  toTechnicalConfigurationBaselineHierarchyImportRpcArgs,
} from "../technical-configuration-baseline-hierarchy-import"
import type {
  TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse,
  TechnicalConfigurationBaselineHierarchyImportRpcArgs,
} from "../technical-configuration-baseline-hierarchy-import-types"
import { getBaselineImportErrorMessage } from "../technical-configuration-baseline-import-utils"
import { isTechnicalConfigurationBaselineConflict } from "../technical-configuration-baseline-version-state"
import {
  parseTechnicalConfigurationBaselineWorkbookFile,
  type TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"

type UseTechnicalConfigurationBaselineHierarchyImportOptions = {
  selectedVersion: TechnicalConfigurationBaselineDecodedDraft | null
  isBlocked: boolean
  onApplied: (version: TechnicalConfigurationBaselineDecodedDraft) => Promise<void>
  onConflict: (versionId: string) => Promise<void>
  onUnresolvedStateChange: (unresolved: boolean) => void
}

const PREVIEW_STALE_MESSAGE =
  "Phiên bản đã thay đổi trên máy chủ. File và bản xem trước vẫn được giữ để đối chiếu."
const PREVIEW_REPLACEMENT_PENDING_MESSAGE =
  "Bản xem trước hiện tại thuộc workbook trước. Hãy xem trước thành công workbook mới trước khi áp dụng."

function getReplacementPreviewError(
  response: TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse
): string {
  if (response.errors.length === 0) {
    return "Workbook mới không tạo được bản xem trước hợp lệ. File và bản xem trước trước đó vẫn được giữ."
  }
  return response.errors
    .map(formatTechnicalConfigurationBaselineHierarchyImportPreviewError)
    .join(" ")
}

export interface UseTechnicalConfigurationBaselineHierarchyImportResult {
  open: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  selectedFile: File | null
  parsedResult: TechnicalConfigurationBaselineWorkbookCompatibleParseResult | null
  parseError: string | null
  preview: TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse | null
  previewKey: number
  operationError: string | null
  replacementConfirmed: boolean
  isPreviewStale: boolean
  isParsing: boolean
  isPreviewing: boolean
  isApplying: boolean
  hasUnresolvedState: boolean
  openDialog: () => void
  onOpenChange: (open: boolean) => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  setReplacementConfirmed: (confirmed: boolean) => void
  applyPreview: () => Promise<void>
  reset: () => void
}

/** Owns the dormant XLSX v2 hierarchy import parse and preview lifecycle. */
export function useTechnicalConfigurationBaselineHierarchyImport({
  selectedVersion,
  isBlocked,
  onApplied,
  onConflict,
  onUnresolvedStateChange,
}: UseTechnicalConfigurationBaselineHierarchyImportOptions): UseTechnicalConfigurationBaselineHierarchyImportResult {
  const rpc = useTechnicalConfigurationBaseline()
  const [open, setOpen] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [parsedResult, setParsedResult] =
    React.useState<TechnicalConfigurationBaselineWorkbookCompatibleParseResult | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [preview, setPreview] =
    React.useState<TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse | null>(null)
  const [previewedArgs, setPreviewedArgs] =
    React.useState<TechnicalConfigurationBaselineHierarchyImportRpcArgs | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const [replacementConfirmed, setReplacementConfirmed] = React.useState(false)
  const [isPreviewStale, setIsPreviewStale] = React.useState(false)
  const [isParsing, setIsParsing] = React.useState(false)
  const [isPreviewing, setIsPreviewing] = React.useState(false)
  const [isApplying, setIsApplying] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const parseAttemptRef = React.useRef(0)
  const previewKeyRef = React.useRef(0)
  const onAppliedRef = React.useRef(onApplied)
  const onConflictRef = React.useRef(onConflict)

  React.useEffect(() => {
    onAppliedRef.current = onApplied
    onConflictRef.current = onConflict
  }, [onApplied, onConflict])

  const reset = React.useCallback(() => {
    parseAttemptRef.current += 1
    setSelectedFile(null)
    setParsedResult(null)
    setParseError(null)
    setPreview(null)
    setPreviewedArgs(null)
    setOperationError(null)
    setReplacementConfirmed(false)
    setIsPreviewStale(false)
    setIsParsing(false)
    setIsPreviewing(false)
    setIsApplying(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (isParsing || isPreviewing || isApplying)) return
      setOpen(nextOpen)
      if (!nextOpen) reset()
    },
    [isApplying, isParsing, isPreviewing, reset]
  )

  const openDialog = React.useCallback(() => {
    if (isBlocked || selectedVersion?.status !== "draft") return
    setOperationError(null)
    setOpen(true)
  }, [isBlocked, selectedVersion?.status])

  const recoverFromConflict = React.useCallback(async (versionId: string) => {
    setIsPreviewStale(true)
    setOperationError(PREVIEW_STALE_MESSAGE)
    try {
      await onConflictRef.current(versionId)
    } catch {
      setOperationError(
        "Phiên bản đã thay đổi nhưng không thể tải trạng thái mới. File và bản xem trước vẫn được giữ."
      )
    }
  }, [])

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const attempt = ++parseAttemptRef.current
      const file = event.target.files?.[0]
      const preserveCurrentEvidence = Boolean(selectedFile && parsedResult)
      setParseError(null)
      setOperationError(null)
      setReplacementConfirmed(false)

      if (!file) {
        reset()
        return
      }
      if (isBlocked || selectedVersion?.status !== "draft") return

      if (!preserveCurrentEvidence) {
        setSelectedFile(null)
        setParsedResult(null)
        setPreview(null)
        setPreviewedArgs(null)
        setIsPreviewStale(false)
      } else {
        setIsPreviewStale(true)
        setOperationError(PREVIEW_REPLACEMENT_PENDING_MESSAGE)
      }
      setIsParsing(true)
      try {
        const parsed = await parseTechnicalConfigurationBaselineWorkbookFile(file, {
          existingHierarchy: toTechnicalConfigurationBaselineExistingHierarchy(selectedVersion),
        })
        if (attempt !== parseAttemptRef.current) return
        if (!preserveCurrentEvidence) {
          setSelectedFile(file)
          setParsedResult(parsed)
        }
        setIsPreviewing(true)
        const args = toTechnicalConfigurationBaselineHierarchyImportRpcArgs(parsed, selectedVersion)
        const response = await rpc.previewHierarchyImport(args)
        if (attempt !== parseAttemptRef.current) return
        if (
          preserveCurrentEvidence &&
          (response.errors.length > 0 || response.data.effects === null)
        ) {
          setParseError(getReplacementPreviewError(response))
          setIsPreviewStale(true)
          return
        }
        previewKeyRef.current += 1
        setSelectedFile(file)
        setParsedResult(parsed)
        setPreviewedArgs(args)
        setPreview(response)
        setIsPreviewStale(false)
        setOperationError(null)
      } catch (error: unknown) {
        if (attempt !== parseAttemptRef.current) return
        if (isTechnicalConfigurationBaselineConflict(error)) {
          await recoverFromConflict(selectedVersion.id)
          return
        }
        setParseError(
          getBaselineImportErrorMessage(error, "Không thể đọc workbook cấu hình phân cấp.")
        )
      } finally {
        if (attempt === parseAttemptRef.current) {
          setIsParsing(false)
          setIsPreviewing(false)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }
      }
    },
    [isBlocked, parsedResult, recoverFromConflict, reset, rpc, selectedFile, selectedVersion]
  )

  const previewTargetChanged = Boolean(
    previewedArgs &&
    (!selectedVersion ||
      selectedVersion.id !== previewedArgs.p_baseline_version_id ||
      selectedVersion.revision !== previewedArgs.p_expected_revision)
  )
  const effectivePreviewStale = isPreviewStale || previewTargetChanged
  const effectiveOperationError =
    operationError ?? (previewTargetChanged ? PREVIEW_STALE_MESSAGE : null)

  const hasUnresolvedState =
    open &&
    Boolean(
      selectedFile ||
      parsedResult ||
      parseError ||
      preview ||
      effectiveOperationError ||
      isParsing ||
      isPreviewing ||
      isApplying
    )

  const applyPreview = React.useCallback(async () => {
    if (
      !selectedVersion ||
      selectedVersion.status !== "draft" ||
      isBlocked ||
      !parsedResult ||
      !preview ||
      !previewedArgs ||
      preview.errors.length > 0 ||
      effectivePreviewStale ||
      !replacementConfirmed
    ) {
      return
    }

    setIsApplying(true)
    setOperationError(null)
    try {
      const response = await rpc.applyHierarchyImport(previewedArgs)
      try {
        await onAppliedRef.current(response.data)
      } catch {
        reset()
        setOperationError("Đã nhập cấu hình phân cấp nhưng không thể tải lại trạng thái hồ sơ.")
        return
      }
      reset()
      setOpen(false)
    } catch (error: unknown) {
      if (isTechnicalConfigurationBaselineConflict(error)) {
        await recoverFromConflict(previewedArgs.p_baseline_version_id)
      } else {
        setOperationError(
          getBaselineImportErrorMessage(error, "Không thể áp dụng cấu hình phân cấp.")
        )
      }
    } finally {
      setIsApplying(false)
    }
  }, [
    isBlocked,
    effectivePreviewStale,
    parsedResult,
    preview,
    previewedArgs,
    recoverFromConflict,
    replacementConfirmed,
    reset,
    rpc,
    selectedVersion,
  ])

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent -- The parent activation leaf must block navigation while a dormant import is unresolved.
    onUnresolvedStateChange(hasUnresolvedState)
  }, [hasUnresolvedState, onUnresolvedStateChange])

  return {
    open,
    fileInputRef,
    selectedFile,
    parsedResult,
    parseError,
    preview,
    previewKey: previewKeyRef.current,
    operationError: effectiveOperationError,
    replacementConfirmed,
    isPreviewStale: effectivePreviewStale,
    isParsing,
    isPreviewing,
    isApplying,
    hasUnresolvedState,
    openDialog,
    onOpenChange,
    handleFileChange,
    setReplacementConfirmed,
    applyPreview,
    reset,
  }
}
