import { createClient } from "@supabase/supabase-js"

import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
import type {
  CreateSuggestionJobPayload,
  SuggestionJobChunkRecord,
  SuggestionJobRecord,
  SuggestionJobStatus,
  SuggestionJobStore,
} from "@/app/api/device-quota/mapping/suggest/suggestion-job-types"
import type {
  DinhMucNhomRow,
  SearchResult,
  SuggestMappingResult,
  SuggestionItemCounts,
  SuggestionAccessUser,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const JOB_STORE_RPC = "device_quota_suggestion_job_store_rpc"

type JsonRecord = Record<string, unknown>

type SuggestionJobRow = {
  catalog_signature: string
  category_snapshot: DinhMucNhomRow[] | null
  created_at: string
  data_signature: string
  don_vi_id: number
  error: string | null
  id: string
  item_counts: SuggestionItemCounts
  processed_unique_names: number
  provider: "vm"
  result: SuggestMappingResult | null
  scope_key: string
  status: SuggestionJobStatus
  total_unique_names: number
  updated_at: string
}

type SuggestionJobChunkRow = {
  attempts: number
  chunk_index: number
  device_name_count: number
  device_names: UnassignedName[]
  error: string | null
  id: string
  job_id: string
  result: { results: SearchResult[] } | null
  status: SuggestionJobStatus
  unique_name_count: number
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new SuggestionRouteError("Missing Supabase service configuration", 500)
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function mapJob(row: SuggestionJobRow): SuggestionJobRecord {
  return {
    catalogSignature: row.catalog_signature,
    categorySnapshot: row.category_snapshot ?? undefined,
    createdAt: row.created_at,
    dataSignature: row.data_signature,
    donViId: row.don_vi_id,
    error: row.error,
    id: row.id,
    itemCounts: row.item_counts,
    processedUniqueNames: row.processed_unique_names,
    provider: row.provider,
    result: row.result,
    scopeKey: row.scope_key,
    status: row.status,
    totalUniqueNames: row.total_unique_names,
    updatedAt: row.updated_at,
  }
}

function mapChunk(row: SuggestionJobChunkRow): SuggestionJobChunkRecord {
  return {
    attempts: row.attempts,
    chunkIndex: row.chunk_index,
    deviceNameCount: row.device_name_count,
    deviceNames: row.device_names,
    error: row.error,
    id: row.id,
    jobId: row.job_id,
    result: row.result,
    status: row.status,
    uniqueNameCount: row.unique_name_count,
  }
}

function getRpcErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Suggestion job store operation failed"
}

function toJobInsert(payload: CreateSuggestionJobPayload): JsonRecord {
  return {
    catalog_signature: payload.job.catalogSignature ?? payload.job.dataSignature,
    category_snapshot: payload.job.categorySnapshot ?? [],
    data_signature: payload.job.dataSignature,
    don_vi_id: payload.job.donViId,
    error: payload.job.error,
    item_counts: payload.job.itemCounts,
    processed_unique_names: payload.job.processedUniqueNames,
    provider: payload.job.provider,
    scope_key: payload.job.scopeKey,
    status: payload.job.status,
    total_unique_names: payload.job.totalUniqueNames,
  }
}

async function requireJob(store: SuggestionJobStore, jobId: string): Promise<SuggestionJobRecord> {
  const job = await store.getJob(jobId)
  if (!job) throw new SuggestionRouteError("Suggestion job not found", 404)
  return job
}

export function createServerSuggestionJobStore(_user?: SuggestionAccessUser): SuggestionJobStore {
  const supabase = createSupabaseAdminClient()

  async function callStoreRpc<T>(action: string, payload: JsonRecord = {}): Promise<T | null> {
    const { data, error } = await supabase.rpc(JOB_STORE_RPC, {
      p_action: action,
      p_payload: payload,
    })
    if (error) throw new SuggestionRouteError(getRpcErrorMessage(error), 500)
    return (data ?? null) as T | null
  }

  async function callRequiredRpc<T>(action: string, payload: JsonRecord = {}): Promise<T> {
    const data = await callStoreRpc<T>(action, payload)
    if (data === null) {
      throw new SuggestionRouteError("Suggestion job store operation returned no data", 500)
    }
    return data
  }

  return {
    async createJobWithChunks(payload) {
      const row = await callRequiredRpc<SuggestionJobRow>("create_job", {
        chunks: payload.chunks.map((chunk) => ({
          chunk_index: chunk.chunkIndex,
          device_name_count: chunk.deviceNameCount,
          device_names: chunk.deviceNames,
          unique_name_count: chunk.uniqueNameCount,
        })),
        job: toJobInsert(payload),
      })
      return mapJob(row)
    },

    async findActiveJob({ dataSignature, donViId, scopeKey }) {
      const row = await callStoreRpc<SuggestionJobRow>("find_active_job", {
        data_signature: dataSignature,
        don_vi_id: donViId,
        scope_key: scopeKey,
      })
      return row ? mapJob(row) : null
    },

    async getChunk(chunkId) {
      const row = await callStoreRpc<SuggestionJobChunkRow>("get_chunk", { chunk_id: chunkId })
      return row ? mapChunk(row) : null
    },

    async getJob(jobId) {
      const row = await callStoreRpc<SuggestionJobRow>("get_job", { job_id: jobId })
      return row ? mapJob(row) : null
    },

    async getJobChunks(jobId) {
      const rows = await callRequiredRpc<SuggestionJobChunkRow[]>("get_job_chunks", { job_id: jobId })
      return rows.map((row) => mapChunk(row))
    },

    async listQueuedChunks(limit) {
      const rows = await callRequiredRpc<SuggestionJobChunkRow[]>("list_queued_chunks", { limit })
      return rows.map((row) => mapChunk(row))
    },

    async markChunkFailed(chunkId, error) {
      await callRequiredRpc<JsonRecord>("mark_chunk_failed", { chunk_id: chunkId, error })
    },

    async markChunkProcessing(chunkId) {
      const result = await callRequiredRpc<{ claimed?: boolean }>("mark_chunk_processing", {
        chunk_id: chunkId,
      })
      return result.claimed === true
    },

    async markChunkSucceeded(chunkId, result) {
      await callRequiredRpc<JsonRecord>("mark_chunk_succeeded", { chunk_id: chunkId, result })
    },

    async markJobFailed(jobId, error) {
      await callRequiredRpc<JsonRecord>("mark_job_failed", { error, job_id: jobId })
    },

    async markJobProcessing(jobId) {
      await callRequiredRpc<JsonRecord>("mark_job_processing", { job_id: jobId })
    },

    async markJobSucceeded(jobId, result) {
      await callRequiredRpc<JsonRecord>("mark_job_succeeded", { job_id: jobId, result })
    },

    async resetFailedChunks(jobId) {
      await callRequiredRpc<JsonRecord>("reset_failed_chunks", { job_id: jobId })
    },

    async updateJobProgress(jobId) {
      const job = await requireJob(this, jobId)
      const chunks = await this.getJobChunks(jobId)
      const processedUniqueNames = chunks
        .filter((chunk) => chunk.status === "succeeded")
        .reduce((sum, chunk) => sum + chunk.uniqueNameCount, 0)
      const allSucceeded = chunks.length > 0 && chunks.every((chunk) => chunk.status === "succeeded")

      if (allSucceeded) {
        const names = chunks.flatMap((chunk) => chunk.deviceNames)
        const results = chunks.flatMap((chunk) => chunk.result?.results ?? [])
        const result = mergeSuggestionResults(names, results)
        await this.markJobSucceeded(job.id, result)
      }

      await callRequiredRpc<JsonRecord>("update_job_progress", {
        job_id: jobId,
        processed_unique_names: processedUniqueNames,
      })
    },
  }
}
