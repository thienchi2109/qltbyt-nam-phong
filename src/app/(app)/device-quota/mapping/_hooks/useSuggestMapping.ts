// Orchestration hook for suggested mapping preview.
// Browser calls one server-side route; the route owns payload bundling,
// embedding/search provider orchestration, auth, and facility-scope checks.

import { useState, useEffect, useCallback, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"

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
  | "fetching-names"
  | "embedding"
  | "searching"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getRouteErrorMessage(status: number, payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error) {
    return payload.error
  }
  return `Suggestion preview failed (${status})`
}

function getRouteResult(payload: unknown): SuggestMappingResult {
  if (isRecord(payload) && isRecord(payload.result)) {
    return payload.result as unknown as SuggestMappingResult
  }
  throw new Error("Invalid suggestion preview response")
}

async function fetchSuggestedMapping(
  donViId: number,
  signal: AbortSignal,
): Promise<SuggestMappingResult> {
  const response = await fetch("/api/device-quota/mapping/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ donViId }),
    signal,
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    throw new Error(getRouteErrorMessage(response.status, payload))
  }

  return getRouteResult(payload)
}

// ============================================
// Hook
// ============================================

export function useSuggestMapping({ donViId, enabled }: UseSuggestMappingOptions) {
  const [pipelineStatus, setPipelineStatus] = useState<SuggestMappingStatus>("idle")
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const mutation = useMutation({
    mutationFn: async (dvId: number): Promise<SuggestMappingResult> => {
      const signal = abortRef.current!.signal

      if (!signal.aborted) setPipelineStatus("fetching-names")
      if (!signal.aborted) setProgress(0)

      const result = await fetchSuggestedMapping(dvId, signal)
      if (signal.aborted) throw new DOMException("Aborted", "AbortError")
      return result
    },
    onSuccess: (_data, _vars, _ctx) => {
      if (!abortRef.current?.signal.aborted) {
        setPipelineStatus("done")
        setProgress(100)
      }
    },
    onError: (err) => {
      // Don't set error state for intentional aborts
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
      mutation.reset()
      return
    }

    // Abort any in-flight pipeline before starting a new one
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    mutation.mutate(donViId)

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
    [saveMutation]
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    mutation.reset()
    saveMutation.reset()
    setPipelineStatus("idle")
    setProgress(0)
  }, [mutation, saveMutation])

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
    status,
    result: mutation.data ?? null,
    error: mutation.error?.message ?? null,
    progress,
    reset,
    saveBatch,
    saveStatus,
    saveResult: saveMutation.data ?? null,
    saveError: saveMutation.error?.message ?? null,
  }
}
