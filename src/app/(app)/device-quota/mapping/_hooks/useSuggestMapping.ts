// Orchestration hook for suggested mapping pipeline.
// Uses useMutation from TanStack Query for the 3-stage pipeline:
// fetch unassigned names → embed → hybrid search.
// Returns grouped suggestions ready for preview display.

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

interface UnassignedName {
  ten_thiet_bi: string
  device_count: number
  device_ids: number[]
}

interface SearchResult {
  query_text: string
  results: {
    id: number
    ten_nhom: string
    ma_nhom: string
    phan_loai: string | null
    rrf_score: number
  }[]
}

const CHUNK_SIZE = 10

// ============================================
// Chunking helpers
// ============================================

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ============================================
// Pipeline logic (pure async, no React state)
// ============================================

async function fetchEmbeddings(
  texts: string[],
  signal: AbortSignal,
  onProgress?: (completedChunks: number, totalChunks: number) => void,
): Promise<number[][]> {
  const chunks = chunkArray(texts, CHUNK_SIZE)
  const allEmbeddings: number[][] = []

  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch("/api/embeddings/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: chunks[i] }),
      signal,
    })

    if (!res.ok) {
      throw new Error(`Embedding generation failed (${res.status})`)
    }

    const { embeddings } = await res.json()
    if (!Array.isArray(embeddings)) {
      throw new Error(`Invalid embedding response for chunk ${i + 1}`)
    }
    allEmbeddings.push(...embeddings)
    if (!signal.aborted) onProgress?.(i + 1, chunks.length)
  }

  return allEmbeddings
}

async function searchCategories(
  queries: { text: string; embedding: number[] }[],
  donViId: number,
  signal: AbortSignal,
  onProgress?: (completedChunks: number, totalChunks: number) => void,
): Promise<SearchResult[]> {
  const chunks = chunkArray(queries, CHUNK_SIZE)
  const allResults: SearchResult[] = []

  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")

    const chunk = chunks[i]
    const p_queries = chunk.map((q) => ({
      text: q.text,
      embedding: q.embedding,
    }))

    const results = await callRpc<SearchResult[]>({
      fn: "hybrid_search_category_batch",
      args: { p_queries, p_don_vi: donViId },
    })

    allResults.push(...(results ?? []))
    if (!signal.aborted) onProgress?.(i + 1, chunks.length)
  }

  return allResults
}

function mergeResults(
  names: UnassignedName[],
  searchResults: SearchResult[],
): SuggestMappingResult {
  const nameToDeviceInfo = new Map<string, UnassignedName>()
  for (const n of names) {
    nameToDeviceInfo.set(n.ten_thiet_bi, n)
  }

  const groupMap = new Map<number, SuggestedGroup>()
  const unmatched: { device_name: string; device_ids: number[] }[] = []

  for (const sr of searchResults) {
    const nameInfo = nameToDeviceInfo.get(sr.query_text)
    if (!nameInfo) continue

    if (!sr.results || sr.results.length === 0) {
      unmatched.push({
        device_name: sr.query_text,
        device_ids: nameInfo.device_ids,
      })
      continue
    }

    const best = sr.results[0]
    const existing = groupMap.get(best.id)

    if (existing) {
      existing.device_ids.push(...nameInfo.device_ids)
      if (!existing.device_names.includes(sr.query_text)) {
        existing.device_names.push(sr.query_text)
      }
      existing.device_name_to_ids[sr.query_text] = [
        ...(existing.device_name_to_ids[sr.query_text] ?? []),
        ...nameInfo.device_ids,
      ]
      existing.rrf_score = Math.max(existing.rrf_score, best.rrf_score)
    } else {
      groupMap.set(best.id, {
        nhom_id: best.id,
        nhom_label: best.ten_nhom,
        nhom_code: best.ma_nhom,
        phan_loai: best.phan_loai,
        rrf_score: best.rrf_score,
        device_names: [sr.query_text],
        device_ids: [...nameInfo.device_ids],
        device_name_to_ids: { [sr.query_text]: [...nameInfo.device_ids] },
      })
    }
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => b.device_ids.length - a.device_ids.length
  )

  const matchedDevices = groups.reduce((sum, g) => sum + g.device_ids.length, 0)
  const totalDevices = names.reduce((sum, n) => sum + n.device_count, 0)

  return { groups, unmatched, totalDevices, matchedDevices }
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

      // Stage 1: Fetch unassigned names
      if (!signal.aborted) setPipelineStatus("fetching-names")
      if (!signal.aborted) setProgress(0)

      const names = await callRpc<UnassignedName[]>({
        fn: "dinh_muc_thiet_bi_unassigned_names",
        args: { p_don_vi: dvId },
      })

      if (signal.aborted) throw new DOMException("Aborted", "AbortError")

      if (!names || names.length === 0) {
        return { groups: [], unmatched: [], totalDevices: 0, matchedDevices: 0 }
      }

      // Stage 2: Generate embeddings
      if (!signal.aborted) setPipelineStatus("embedding")
      const texts = names.map((n) => n.ten_thiet_bi)
      const totalStages = 3
      const embeddings = await fetchEmbeddings(texts, signal, (done, total) => {
        if (!signal.aborted) setProgress(Math.round((done / total) * (100 / totalStages)))
      })

      if (signal.aborted) throw new DOMException("Aborted", "AbortError")

      // Stage 3: Hybrid search
      if (!signal.aborted) setPipelineStatus("searching")
      const queries = texts.map((text, i) => ({
        text,
        embedding: embeddings[i],
      }))
      const searchResults = await searchCategories(queries, dvId, signal, (done, total) => {
        if (!signal.aborted) setProgress(Math.round(((2 + done / total) / totalStages) * 100))
      })

      if (signal.aborted) throw new DOMException("Aborted", "AbortError")

      return mergeResults(names, searchResults)
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

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    mutation.reset()
    setPipelineStatus("idle")
    setProgress(0)
  }, [mutation])

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
