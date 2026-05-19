import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createCatalogSignature, mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
import { assertSuggestionAccess } from "@/app/api/device-quota/mapping/suggest/suggestion-supabase-provider"
import {
  createUnassignedSignature,
  fetchVmSuggestionInputs,
  assertPayloadSize,
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
  store,
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
  const jobStore = store ?? createServerSuggestionJobStore(user)

  const scopeKey = getUserScopeKey(user)
  const { categories, names } = await fetchInputs({ donViId, user })
  const catalogSignature = createCatalogSignature(categories)
  const dataSignature = `${catalogSignature}:${createUnassignedSignature(names)}`
  const existingJob = await jobStore.findActiveJob({ dataSignature, donViId, scopeKey })

  if (existingJob) return existingJob

  const emptyResult = { groups: [], unmatched: [], totalDevices: 0, matchedDevices: 0 }
  const chunks = chunkUnassignedNames({
    maxDeviceIdsPerChunk,
    maxUniqueNamesPerChunk,
    names,
  })

  return jobStore.createJobWithChunks({
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
      result: names.length === 0 ? emptyResult : null,
      scopeKey,
      status: names.length === 0 ? "succeeded" : "queued",
      totalUniqueNames: names.length,
    },
  })
}

function canAccessJob(job: SuggestionJobRecord, user: SuggestionAccessUser): boolean {
  return job.scopeKey === getUserScopeKey(user)
}

export async function getSuggestionJob({
  jobId,
  store,
  user,
}: {
  jobId: string
  store?: SuggestionJobStore
  user: SuggestionAccessUser
}): Promise<SuggestionJobRecord> {
  const jobStore = store ?? createServerSuggestionJobStore(user)
  const job = await jobStore.getJob(jobId)
  if (!job || !canAccessJob(job, user)) {
    throw new SuggestionRouteError("Suggestion job not found", 404)
  }
  return job
}

export async function retrySuggestionJob({
  jobId,
  store,
  user,
}: {
  jobId: string
  store?: SuggestionJobStore
  user: SuggestionAccessUser
}): Promise<SuggestionJobRecord> {
  const jobStore = store ?? createServerSuggestionJobStore(user)
  const job = await getSuggestionJob({ jobId, store: jobStore, user })
  if (job.status !== "failed") {
    throw new SuggestionRouteError("Only failed suggestion jobs can be retried", 409)
  }
  await jobStore.resetFailedChunks(job.id)
  await jobStore.markJobProcessing(job.id)
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
}): Promise<boolean> {
  const chunk = await store.getChunk(chunkId)
  if (!chunk || chunk.status === "succeeded") return false

  const job = await store.getJob(chunk.jobId)
  if (!job) {
    throw new SuggestionRouteError("Suggestion job not found", 404)
  }

  const claimed = await store.markChunkProcessing(chunk.id)
  if (!claimed) return false
  await store.markJobProcessing(job.id)

  try {
    const result = await (suggestChunk ?? suggestChunkWithVm)({ chunk, job })
    await store.markChunkSucceeded(chunk.id, result)
    await store.updateJobProgress(job.id)
    return true
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
  assertPayloadSize(vmRequest)
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
      const didProcess = await processSuggestionJobChunk({ chunkId: chunk.id, store, suggestChunk })
      if (didProcess) processed += 1
    } catch {
      failed += 1
    }
  }

  return { failed, processed }
}

export async function processSuggestionJobChunksForJob({
  jobId,
  limit = 1,
  store = createServerSuggestionJobStore(),
  suggestChunk,
  user,
}: {
  jobId: string
  limit?: number
  store?: SuggestionJobStore
  suggestChunk?: (args: {
    chunk: SuggestionJobChunkRecord
    job: SuggestionJobRecord
  }) => Promise<{ results: SearchResult[] }>
  user: SuggestionAccessUser
}): Promise<{ failed: number; job: SuggestionJobRecord; processed: number }> {
  const job = await getSuggestionJob({ jobId, store, user })
  if (job.status === "failed" || job.status === "succeeded") {
    return { failed: 0, job, processed: 0 }
  }

  const chunks = await store.getJobChunks(job.id)
  const queuedChunks = chunks
    .filter((chunk) => chunk.status === "queued")
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .slice(0, limit)

  let failed = 0
  let processed = 0

  for (const chunk of queuedChunks) {
    try {
      const didProcess = await processSuggestionJobChunk({ chunkId: chunk.id, store, suggestChunk })
      if (didProcess) processed += 1
    } catch {
      failed += 1
      break
    }
  }

  const updatedJob = await getSuggestionJob({ jobId, store, user })
  return { failed, job: updatedJob, processed }
}

export function mergeCompletedJobChunks(chunks: SuggestionJobChunkRecord[]) {
  const names = chunks.flatMap((chunk) => chunk.deviceNames)
  const results = chunks.flatMap((chunk) => chunk.result?.results ?? [])
  return mergeSuggestionResults(names, results)
}
