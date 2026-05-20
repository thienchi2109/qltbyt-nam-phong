import { afterEach, describe, expect, test, vi } from "vitest"

import { createSuggestionAlgorithmSignature } from "@/app/api/device-quota/mapping/suggest/suggestion-ai-reranker"
import { processSuggestionJobChunk } from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import type {
  SuggestionJobChunkRecord,
  SuggestionJobRecord,
  SuggestionJobStore,
} from "@/app/api/device-quota/mapping/suggest/suggestion-job-types"
import type { CategoryCatalogItem, UnassignedName } from "@/app/api/device-quota/mapping/suggest/suggestion-types"
import { callVmSuggest } from "@/app/api/device-quota/mapping/suggest/suggestion-vm-client"

vi.mock("@/app/api/device-quota/mapping/suggest/suggestion-vm-client", () => ({
  callVmSuggest: vi.fn(async () => ({ requestId: "job-1:0", suggestions: [] })),
}))

const CATEGORIES: CategoryCatalogItem[] = [
  { id: 11, ma_nhom: "MAY-THO", phan_loai: "medical", ten_nhom: "Máy thở" },
  { id: 12, ma_nhom: "MAY-SIEU-AM", phan_loai: "medical", ten_nhom: "Máy siêu âm" },
]

const NAMES: UnassignedName[] = [
  { ten_thiet_bi: "Máy thở A", device_count: 1, device_ids: [101] },
]

function createJob(dataSignature: string): SuggestionJobRecord {
  return {
    id: "job-1",
    donViId: 17,
    scopeKey: "user:user-1",
    dataSignature,
    catalogSignature: "catalog",
    status: "queued",
    provider: "vm",
    processedUniqueNames: 0,
    totalUniqueNames: 1,
    itemCounts: {
      categories: CATEGORIES.length,
      unassignedDevices: 1,
      unassignedNames: 1,
    },
    result: null,
    error: null,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    categorySnapshot: CATEGORIES,
  }
}

function createChunk(): SuggestionJobChunkRecord {
  return {
    id: "chunk-1",
    jobId: "job-1",
    chunkIndex: 0,
    status: "queued",
    uniqueNameCount: 1,
    deviceNameCount: 1,
    deviceNames: NAMES,
    result: null,
    error: null,
    attempts: 0,
  }
}

function createStore(job: SuggestionJobRecord): SuggestionJobStore {
  return {
    createJobWithChunks: vi.fn(),
    findActiveJob: vi.fn(),
    getChunk: vi.fn(async () => createChunk()),
    getJob: vi.fn(async () => job),
    getJobChunks: vi.fn(),
    listQueuedChunks: vi.fn(),
    markChunkFailed: vi.fn(),
    markChunkProcessing: vi.fn(async () => true),
    markChunkSucceeded: vi.fn(),
    markJobFailed: vi.fn(),
    markJobProcessing: vi.fn(),
    markJobSucceeded: vi.fn(),
    resetFailedChunks: vi.fn(),
    updateJobProgress: vi.fn(),
  }
}

describe("device quota suggestion job rerank config", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  test("processes queued chunks with the rerank algorithm captured at job creation", async () => {
    vi.stubEnv("DEVICE_QUOTA_AI_RERANK_ENABLED", "true")
    const algorithmSignature = createSuggestionAlgorithmSignature()
    vi.stubEnv("DEVICE_QUOTA_AI_RERANK_ENABLED", "false")
    const store = createStore(createJob(`catalog:unassigned:${algorithmSignature}`))

    await processSuggestionJobChunk({ chunkId: "chunk-1", store })

    expect(callVmSuggest).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ topK: 8 }),
      }),
    )
  })
})
