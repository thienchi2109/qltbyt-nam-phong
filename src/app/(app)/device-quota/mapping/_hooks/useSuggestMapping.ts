// Orchestration hook for suggested mapping preview.
// Browser calls server-side routes; the routes own auth, facility scope,
// payload bundling, provider orchestration, and bounded job processing.

import { useState, useEffect, useCallback, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import {
  createSuggestionJobRequest,
  getJobFailureMessage,
  getJobResult,
  getProgressPercent,
  processSuggestionJobRequest,
  retrySuggestionJobRequest,
  waitForNextJobTick,
  type SuggestionJob,
} from "./useSuggestMappingJobClient"

// ============================================
// Types
// ============================================

export interface SuggestedGroup {
  nhom_id: number
  nhom_label: string
  nhom_code: string
  phan_loai: string | null
  rrf_score: number
  device_names: string[]
  device_ids: number[]
  device_name_to_ids: Record<string, number[]>
}

export interface SuggestMappingResult {
  groups: SuggestedGroup[]
  unmatched: { device_name: string; device_ids: number[] }[]
  totalDevices: number
  matchedDevices: number
}

export type SuggestMappingStatus =
  | "idle"
  | "starting-job"
  | "processing"
  | "done"
  | "error"

export type SaveStatus = "idle" | "saving" | "saved" | "save-error"

export interface SaveMapping {
  nhom_id: number
  thiet_bi_ids: number[]
}

export interface BatchSaveResult {
  affected_count: number
  skipped_already_assigned: number
  skipped_not_found: number
  groups: { nhom_id: number; affected: number; skipped: number }[]
}

interface UseSuggestMappingOptions {
  donViId: number | null
  enabled: boolean
}

// ============================================
// Hook
// ============================================

/** Runs the device-quota suggestion preview through the async job pipeline. */
export function useSuggestMapping({ donViId, enabled }: UseSuggestMappingOptions) {
  const [pipelineStatus, setPipelineStatus] = useState<SuggestMappingStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [processedUniqueNames, setProcessedUniqueNames] = useState(0)
  const [totalUniqueNames, setTotalUniqueNames] = useState(0)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const updateJobProgress = useCallback((job: SuggestionJob) => {
    setCurrentJobId(job.id)
    setProcessedUniqueNames(job.processedUniqueNames)
    setTotalUniqueNames(job.totalUniqueNames)
    setProgress(getProgressPercent(job))
  }, [])

  const waitForSuggestionJob = useCallback(
    async (initialJob: SuggestionJob, signal: AbortSignal): Promise<SuggestMappingResult> => {
      let job = initialJob
      updateJobProgress(job)

      while (!signal.aborted) {
        if (job.status === "succeeded") {
          setPipelineStatus("done")
          setProgress(100)
          return getJobResult(job)
        }

        if (job.status === "failed") {
          throw new Error(getJobFailureMessage(job))
        }

        setPipelineStatus("processing")
        job = await processSuggestionJobRequest(job.id, signal)
        updateJobProgress(job)

        if (job.status === "queued" || job.status === "processing") {
          await waitForNextJobTick(signal)
        }
      }

      throw new DOMException("Aborted", "AbortError")
    },
    [updateJobProgress],
  )

  const mutation = useMutation({
    mutationFn: async ({
      dvId,
      retryJobId,
    }: {
      dvId: number
      retryJobId?: string
    }): Promise<SuggestMappingResult> => {
      const signal = abortRef.current!.signal

      if (!signal.aborted) {
        setPipelineStatus("starting-job")
        setProgress(0)
        setProcessedUniqueNames(0)
        setTotalUniqueNames(0)
        if (!retryJobId) setCurrentJobId(null)
      }

      if (retryJobId) {
        const retryJob = await retrySuggestionJobRequest(retryJobId, signal)
        return waitForSuggestionJob(retryJob, signal)
      }

      const job = await createSuggestionJobRequest(dvId, signal)
      return waitForSuggestionJob(job, signal)
    },
    onSuccess: () => {
      if (!abortRef.current?.signal.aborted) {
        setPipelineStatus("done")
        setProgress(100)
      }
    },
    onError: (err) => {
      if (err instanceof DOMException && err.name === "AbortError") return
      if (!abortRef.current?.signal.aborted) {
        setPipelineStatus("error")
      }
    },
  })

  // Auto-trigger when enabled, auto-reset when disabled
  useEffect(() => {
    if (!enabled || donViId === null) {
      abortRef.current?.abort()
      abortRef.current = null
      setPipelineStatus("idle")
      setProgress(0)
      setProcessedUniqueNames(0)
      setTotalUniqueNames(0)
      setCurrentJobId(null)
      mutation.reset()
      return
    }

    // Abort any in-flight pipeline before starting a new one
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    mutation.mutate({ dvId: donViId })

    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, donViId])

  // ============================================
  // Save Batch Mutation
  // ============================================

  const saveMutation = useMutation({
    mutationFn: async (mappings: SaveMapping[]) => {
      return callRpc<BatchSaveResult>({
        fn: "dinh_muc_thiet_bi_link_batch",
        args: {
          p_mappings: mappings,
          p_don_vi: donViId,
        },
      })
    },
  })

  const saveBatch = useCallback(
    (mappings: SaveMapping[]) => {
      saveMutation.mutate(mappings)
    },
    [saveMutation],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    mutation.reset()
    saveMutation.reset()
    setPipelineStatus("idle")
    setProgress(0)
    setProcessedUniqueNames(0)
    setTotalUniqueNames(0)
    setCurrentJobId(null)
  }, [mutation, saveMutation])

  const retryFailedJob = useCallback(() => {
    if (donViId === null || currentJobId === null) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    mutation.mutate({ dvId: donViId, retryJobId: currentJobId })
  }, [currentJobId, donViId, mutation])

  const saveStatus: SaveStatus = saveMutation.isPending
    ? "saving"
    : saveMutation.isError
      ? "save-error"
      : saveMutation.isSuccess
        ? "saved"
        : "idle"

  // Derive public status from mutation + pipeline states
  const status: SuggestMappingStatus = mutation.isError
    ? "error"
    : mutation.isSuccess
      ? "done"
      : mutation.isPending
        ? pipelineStatus
        : "idle"

  return {
    canRetry: status === "error" && currentJobId !== null,
    status,
    result: mutation.data ?? null,
    error: mutation.error?.message ?? null,
    progress,
    processedUniqueNames,
    totalUniqueNames,
    retryFailedJob,
    reset,
    saveBatch,
    saveStatus,
    saveResult: saveMutation.data ?? null,
    saveError: saveMutation.error?.message ?? null,
  }
}
