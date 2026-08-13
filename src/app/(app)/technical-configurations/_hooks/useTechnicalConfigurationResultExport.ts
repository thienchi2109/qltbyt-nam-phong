"use client"

import * as React from "react"

import { collectTechnicalConfigurationResultExportDataset } from "../technical-configuration-result-export-data"
import {
  TechnicalConfigurationResultExportError,
  type TechnicalConfigurationResultExportErrorKind,
} from "../technical-configuration-result-export-decoders"
import type { TechnicalConfigurationResultExportDialogRequest } from "../technical-configuration-result-export-state"
import type { TechnicalConfigurationBaselineGroupWire } from "../baseline-types"
import { downloadBlob } from "@/lib/excel-workbook"
import {
  createTechnicalConfigurationResultWorkbookModel,
  type TechnicalConfigurationResultWorkbookBuildInput,
} from "@/lib/technical-configuration-result-excel-contract"
import { serializeTechnicalConfigurationResultWorkbook } from "@/lib/technical-configuration-result-excel-export"

const RESULT_WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const RESULT_FILENAME_SEGMENT_MAX_LENGTH = 120

export type TechnicalConfigurationResultExportStatus = "idle" | "loading" | "success" | "error"

export type TechnicalConfigurationResultExportOrchestrationError = Readonly<{
  kind: TechnicalConfigurationResultExportErrorKind | "serialization"
  message: string
}>

type ResultExportState = Readonly<{
  identityKey: string
  status: TechnicalConfigurationResultExportStatus
  error: TechnicalConfigurationResultExportOrchestrationError | null
}>

type LastRequest = Readonly<{
  identityKey: string
  request: TechnicalConfigurationResultExportDialogRequest
}>

function idleState(identityKey: string): ResultExportState {
  return { identityKey, status: "idle", error: null }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function toOrchestrationError(
  error: unknown
): TechnicalConfigurationResultExportOrchestrationError {
  if (error instanceof TechnicalConfigurationResultExportError) {
    return { kind: error.kind, message: error.message }
  }
  return {
    kind: "serialization",
    message: error instanceof Error ? error.message : "Result workbook serialization failed.",
  }
}

function toFilesystemSafeSegment(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const bounded = normalized.slice(0, RESULT_FILENAME_SEGMENT_MAX_LENGTH).replace(/_+$/g, "")
  return bounded || "Ho_so"
}

function createResultWorkbookFilename(
  input: TechnicalConfigurationResultWorkbookBuildInput
): string {
  const dossierLabel =
    input.manifest.dossier.device_type_name ||
    input.manifest.dossier.name ||
    input.manifest.dossier.id
  return `Ket_qua_so_sanh_cau_hinh_${toFilesystemSafeSegment(dossierLabel)}_${input.generated_at.slice(0, 10)}.xlsx`
}

/** Orchestrates one stable P14 dataset into exactly one downloaded result workbook. */
export function useTechnicalConfigurationResultExport({
  dossierId,
  baselineVersionId,
  baselineRevision,
  baselineGroups,
  generatedBy,
}: Readonly<{
  dossierId: string
  baselineVersionId: string
  baselineRevision: number
  baselineGroups: readonly TechnicalConfigurationBaselineGroupWire[]
  generatedBy: string
}>) {
  const identityKey = JSON.stringify([dossierId, baselineVersionId, baselineRevision])
  const [storedState, setStoredState] = React.useState<ResultExportState>(() =>
    idleState(identityKey)
  )
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const lastRequestRef = React.useRef<LastRequest | null>(null)
  const runIdRef = React.useRef(0)
  const state = storedState.identityKey === identityKey ? storedState : idleState(identityKey)

  React.useLayoutEffect(
    () => () => {
      runIdRef.current += 1
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    },
    [identityKey]
  )

  const execute = React.useCallback(
    async (request: TechnicalConfigurationResultExportDialogRequest) => {
      const runId = runIdRef.current + 1
      runIdRef.current = runId
      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      lastRequestRef.current = { identityKey, request }
      setStoredState({ identityKey, status: "loading", error: null })

      try {
        const dataset = await collectTechnicalConfigurationResultExportDataset(
          {
            ...request,
            signal: abortController.signal,
          },
          { baselineRevision, baselineGroups }
        )
        if (runIdRef.current !== runId || abortController.signal.aborted) return

        const generatedAt = new Date().toISOString()
        const modelInput: TechnicalConfigurationResultWorkbookBuildInput = {
          ...dataset,
          option_ids: request.optionIds,
          criterion_ids: request.criterionIds,
          generated_at: generatedAt,
          generated_by: generatedBy,
        }
        const model = createTechnicalConfigurationResultWorkbookModel(modelInput)
        if (runIdRef.current !== runId || abortController.signal.aborted) return

        const buffer = await serializeTechnicalConfigurationResultWorkbook(model)

        if (runIdRef.current !== runId || abortController.signal.aborted) return
        downloadBlob(
          new Blob([buffer], { type: RESULT_WORKBOOK_MIME_TYPE }),
          createResultWorkbookFilename(modelInput)
        )
        setStoredState({ identityKey, status: "success", error: null })
      } catch (error) {
        if (runIdRef.current !== runId || abortController.signal.aborted || isAbortError(error)) {
          return
        }
        setStoredState({
          identityKey,
          status: "error",
          error: toOrchestrationError(error),
        })
      } finally {
        if (runIdRef.current === runId) {
          abortControllerRef.current = null
        }
      }
    },
    [baselineGroups, baselineRevision, generatedBy, identityKey]
  )

  const retry = React.useCallback(() => {
    const lastRequest = lastRequestRef.current
    if (!lastRequest || lastRequest.identityKey !== identityKey) return Promise.resolve()
    return execute(lastRequest.request)
  }, [execute, identityKey])

  const reset = React.useCallback(() => {
    setStoredState(idleState(identityKey))
  }, [identityKey])

  return {
    status: state.status,
    error: state.error,
    startExport: execute,
    retry,
    reset,
  }
}
