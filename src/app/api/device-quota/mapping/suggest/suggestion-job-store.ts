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
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const JOBS_TABLE = "device_quota_suggestion_jobs"
const CHUNKS_TABLE = "device_quota_suggestion_job_chunks"

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

function getDbErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Database operation failed"
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

function toChunkInsert(jobId: string, payload: CreateSuggestionJobPayload): JsonRecord[] {
  return payload.chunks.map((chunk) => ({
    chunk_index: chunk.chunkIndex,
    device_name_count: chunk.deviceNameCount,
    device_names: chunk.deviceNames,
    job_id: jobId,
    status: "queued",
    unique_name_count: chunk.uniqueNameCount,
  }))
}

async function requireJob(store: SuggestionJobStore, jobId: string): Promise<SuggestionJobRecord> {
  const job = await store.getJob(jobId)
  if (!job) throw new SuggestionRouteError("Suggestion job not found", 404)
  return job
}

export function createServerSuggestionJobStore(): SuggestionJobStore {
  const supabase = createSupabaseAdminClient()

  return {
    async createJobWithChunks(payload) {
      const { data: jobRow, error: jobError } = await supabase
        .from(JOBS_TABLE)
        .insert(toJobInsert(payload))
        .select("*")
        .single()

      if (jobError || !jobRow) {
        throw new SuggestionRouteError(getDbErrorMessage(jobError), 500)
      }

      const job = mapJob(jobRow as SuggestionJobRow)
      const chunkRows = toChunkInsert(job.id, payload)
      if (chunkRows.length > 0) {
        const { error: chunkError } = await supabase.from(CHUNKS_TABLE).insert(chunkRows)
        if (chunkError) {
          await supabase.from(JOBS_TABLE).delete().eq("id", job.id)
          throw new SuggestionRouteError(getDbErrorMessage(chunkError), 500)
        }
      }

      return job
    },

    async findActiveJob({ dataSignature, donViId, scopeKey }) {
      const { data, error } = await supabase
        .from(JOBS_TABLE)
        .select("*")
        .eq("don_vi_id", donViId)
        .eq("scope_key", scopeKey)
        .eq("data_signature", dataSignature)
        .in("status", ["queued", "processing", "succeeded"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
      return data ? mapJob(data as SuggestionJobRow) : null
    },

    async getChunk(chunkId) {
      const { data, error } = await supabase
        .from(CHUNKS_TABLE)
        .select("*")
        .eq("id", chunkId)
        .maybeSingle()

      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
      return data ? mapChunk(data as SuggestionJobChunkRow) : null
    },

    async getJob(jobId) {
      const { data, error } = await supabase.from(JOBS_TABLE).select("*").eq("id", jobId).maybeSingle()

      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
      return data ? mapJob(data as SuggestionJobRow) : null
    },

    async getJobChunks(jobId) {
      const { data, error } = await supabase
        .from(CHUNKS_TABLE)
        .select("*")
        .eq("job_id", jobId)
        .order("chunk_index", { ascending: true })

      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
      return (data ?? []).map((row) => mapChunk(row as SuggestionJobChunkRow))
    },

    async listQueuedChunks(limit) {
      const { data, error } = await supabase
        .from(CHUNKS_TABLE)
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(limit)

      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
      return (data ?? []).map((row) => mapChunk(row as SuggestionJobChunkRow))
    },

    async markChunkFailed(chunkId, error) {
      const { error: updateError } = await supabase
        .from(CHUNKS_TABLE)
        .update({ error, status: "failed" })
        .eq("id", chunkId)
      if (updateError) throw new SuggestionRouteError(getDbErrorMessage(updateError), 500)
    },

    async markChunkProcessing(chunkId) {
      const chunk = await this.getChunk(chunkId)
      const attempts = (chunk?.attempts ?? 0) + 1
      const { error } = await supabase
        .from(CHUNKS_TABLE)
        .update({ attempts, status: "processing" })
        .eq("id", chunkId)
      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
    },

    async markChunkSucceeded(chunkId, result) {
      const { error } = await supabase
        .from(CHUNKS_TABLE)
        .update({ error: null, result, status: "succeeded" })
        .eq("id", chunkId)
      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
    },

    async markJobFailed(jobId, error) {
      const { error: updateError } = await supabase
        .from(JOBS_TABLE)
        .update({ error, status: "failed" })
        .eq("id", jobId)
      if (updateError) throw new SuggestionRouteError(getDbErrorMessage(updateError), 500)
    },

    async markJobProcessing(jobId) {
      const { error } = await supabase
        .from(JOBS_TABLE)
        .update({ error: null, status: "processing" })
        .eq("id", jobId)
      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
    },

    async markJobSucceeded(jobId, result) {
      const { error } = await supabase
        .from(JOBS_TABLE)
        .update({ error: null, result, status: "succeeded" })
        .eq("id", jobId)
      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
    },

    async resetFailedChunks(jobId) {
      const { error } = await supabase
        .from(CHUNKS_TABLE)
        .update({ error: null, status: "queued" })
        .eq("job_id", jobId)
        .eq("status", "failed")
      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
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

      const { error } = await supabase
        .from(JOBS_TABLE)
        .update({ processed_unique_names: processedUniqueNames })
        .eq("id", jobId)
      if (error) throw new SuggestionRouteError(getDbErrorMessage(error), 500)
    },
  }
}
