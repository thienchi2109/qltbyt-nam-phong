import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createCatalogSignature, mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
import { assertSuggestionAccess } from "@/app/api/device-quota/mapping/suggest/suggestion-supabase-provider"
import {
  createUnassignedSignature,
  fetchVmSuggestionInputs,
  toSearchResults,
  toVmRequest,
} from "@/app/api/device-quota/mapping/suggest/suggestion-vm-provider"
import { callVmSuggest } from "@/app/api/device-quota/mapping/suggest/suggestion-vm-client"
import {
  createServerSuggestionJobStore,
} from "@/app/api/device-quota/mapping/suggest/suggestion-job-store"
import type {
  SuggestionJobChunkRecord,
  SuggestionJobRecord,
  SuggestionJobStore,
} from "@/app/api/device-quota/mapping/suggest/suggestion-job-types"
import type {
  DinhMucNhomRow,
  SearchResult,
  SuggestionAccessUser,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const DEFAULT_MAX_UNIQUE_NAMES_PER_CHUNK = 50
const DEFAULT_MAX_DEVICE_IDS_PER_CHUNK = 500

type SuggestionInputs = {
  categories: DinhMucNhomRow[]
  names: UnassignedName[]
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getUserScopeKey(user: SuggestionAccessUser): string {
  const id = typeof user.id === "number" || typeof user.id === "string" ? String(user.id) : ""
  if (id === "") {
    throw new SuggestionRouteError("Unauthorized", 401)
  }
  return `user:${id}`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Suggestion job failed"
}

function chunkUnassignedNames({
  maxDeviceIdsPerChunk,
  maxUniqueNamesPerChunk,
  names,
}: {
  maxDeviceIdsPerChunk: number
  maxUniqueNamesPerChunk: number
  names: UnassignedName[]
}): UnassignedName[][] {
  const chunks: UnassignedName[][] = []
  let current: UnassignedName[] = []
  let currentDeviceIds = 0

  for (const name of names) {
    const nextDeviceIds = currentDeviceIds + name.device_ids.length
    const uniqueLimitReached = current.length >= maxUniqueNamesPerChunk
    const deviceLimitReached = current.length > 0 && nextDeviceIds > maxDeviceIdsPerChunk

    if (uniqueLimitReached || deviceLimitReached) {
      chunks.push(current)
      current = []
      currentDeviceIds = 0
    }

    current.push(name)
    currentDeviceIds += name.device_ids.length
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

export async function createSuggestionJob({
  donViId,
  fetchInputs = fetchVmSuggestionInputs,
  maxDeviceIdsPerChunk = parsePositiveInteger(
    process.env.DEVICE_QUOTA_SUGGESTION_JOB_MAX_DEVICE_IDS_PER_CHUNK,
    DEFAULT_MAX_DEVICE_IDS_PER_CHUNK,
  ),
  maxUniqueNamesPerChunk = parsePositiveInteger(
    process.env.DEVICE_QUOTA_SUGGESTION_JOB_MAX_UNIQUE_NAMES_PER_CHUNK,
    DEFAULT_MAX_UNIQUE_NAMES_PER_CHUNK,
  ),
  requestId,
  store = createServerSuggestionJobStore(),
  user,
}: {
  donViId: number
  fetchInputs?: (args: { donViId: number; user: SuggestionAccessUser }) => Promise<SuggestionInputs>
  maxDeviceIdsPerChunk?: number
  maxUniqueNamesPerChunk?: number
  requestId: string
  store?: SuggestionJobStore
  user: SuggestionAccessUser
}): Promise<SuggestionJobRecord> {
  await assertSuggestionAccess(user, donViId)

  const scopeKey = getUserScopeKey(user)
  const { categories, names } = await fetchInputs({ donViId, user })
  const catalogSignature = createCatalogSignature(categories)
  const dataSignature = `${catalogSignature}:${createUnassignedSignature(names)}`
  const existingJob = await store.findActiveJob({ dataSignature, donViId, scopeKey })

  if (existingJob) return existingJob

  const chunks = chunkUnassignedNames({
    maxDeviceIdsPerChunk,
    maxUniqueNamesPerChunk,
    names,
  })

  return store.createJobWithChunks({
    chunks: chunks.map((chunk, chunkIndex) => ({
      chunkIndex,
      deviceNameCount: chunk.reduce((sum, name) => sum + name.device_ids.length, 0),
      deviceNames: chunk,
      uniqueNameCount: chunk.length,
    })),
    job: {
      catalogSignature,
      categorySnapshot: categories,
      dataSignature,
      donViId,
      error: null,
      itemCounts: {
        categories: categories.length,
        unassignedDevices: names.reduce((sum, name) => sum + name.device_ids.length, 0),
        unassignedNames: names.length,
      },
      processedUniqueNames: 0,
      provider: "vm",
      scopeKey,
      status: "queued",
      totalUniqueNames: names.length,
    },
  })
}

function canAccessJob(job: SuggestionJobRecord, user: SuggestionAccessUser): boolean {
  return job.scopeKey === getUserScopeKey(user)
}

export async function getSuggestionJob({
  jobId,
  store = createServerSuggestionJobStore(),
  user,
}: {
  jobId: string
  store?: SuggestionJobStore
  user: SuggestionAccessUser
}): Promise<SuggestionJobRecord> {
  const job = await store.getJob(jobId)
  if (!job || !canAccessJob(job, user)) {
    throw new SuggestionRouteError("Suggestion job not found", 404)
  }
  return job
}

export async function retrySuggestionJob({
  jobId,
  store = createServerSuggestionJobStore(),
  user,
}: {
  jobId: string
  store?: SuggestionJobStore
  user: SuggestionAccessUser
}): Promise<SuggestionJobRecord> {
  const job = await getSuggestionJob({ jobId, store, user })
  await store.resetFailedChunks(job.id)
  await store.markJobProcessing(job.id)
  return { ...job, error: null, status: "processing" }
}

export async function processSuggestionJobChunk({
  chunkId,
  store = createServerSuggestionJobStore(),
  suggestChunk,
}: {
  chunkId: string
  store?: SuggestionJobStore
  suggestChunk?: (args: {
    chunk: SuggestionJobChunkRecord
    job: SuggestionJobRecord
  }) => Promise<{ results: SearchResult[] }>
}): Promise<void> {
  const chunk = await store.getChunk(chunkId)
  if (!chunk || chunk.status === "succeeded") return

  const job = await store.getJob(chunk.jobId)
  if (!job) {
    throw new SuggestionRouteError("Suggestion job not found", 404)
  }

  await store.markChunkProcessing(chunk.id)
  await store.markJobProcessing(job.id)

  try {
    const result = await (suggestChunk ?? suggestChunkWithVm)({ chunk, job })
    await store.markChunkSucceeded(chunk.id, result)
    await store.updateJobProgress(job.id)
  } catch (error) {
    const message = getErrorMessage(error)
    await store.markChunkFailed(chunk.id, message)
    await store.markJobFailed(job.id, message)
    throw error
  }
}

async function suggestChunkWithVm({
  chunk,
  job,
}: {
  chunk: SuggestionJobChunkRecord
  job: SuggestionJobRecord
}): Promise<{ results: SearchResult[] }> {
  const categories = job.categorySnapshot ?? []
  const catalogSignature = job.catalogSignature ?? job.dataSignature.split(":")[0] ?? ""
  const vmRequest = toVmRequest({
    catalogSignature,
    categories,
    donViId: job.donViId,
    names: chunk.deviceNames,
    requestId: `${job.id}:${chunk.chunkIndex}`,
  })
  const response = await callVmSuggest(vmRequest)
  return { results: toSearchResults(response) }
}

export async function processNextSuggestionJobChunks({
  limit = 1,
  suggestChunk,
  store = createServerSuggestionJobStore(),
}: {
  limit?: number
  suggestChunk?: (args: {
    chunk: SuggestionJobChunkRecord
    job: SuggestionJobRecord
  }) => Promise<{ results: SearchResult[] }>
  store?: SuggestionJobStore
} = {}): Promise<{ failed: number; processed: number }> {
  const chunks = await store.listQueuedChunks(limit)
  let failed = 0
  let processed = 0

  for (const chunk of chunks) {
    try {
      await processSuggestionJobChunk({ chunkId: chunk.id, store, suggestChunk })
      processed += 1
    } catch {
      failed += 1
    }
  }

  return { failed, processed }
}

export function mergeCompletedJobChunks(chunks: SuggestionJobChunkRecord[]) {
  const names = chunks.flatMap((chunk) => chunk.deviceNames)
  const results = chunks.flatMap((chunk) => chunk.result?.results ?? [])
  return mergeSuggestionResults(names, results)
}
