import { describe, expect, test, vi } from "vitest"

import {
  createSuggestionJob,
  getSuggestionJob,
  processSuggestionJobChunk,
  processNextSuggestionJobChunks,
  retrySuggestionJob,
} from "@/app/api/device-quota/mapping/suggest/suggestion-job-service"
import type {
  SuggestionJobChunkRecord,
  SuggestionJobRecord,
  SuggestionJobStore,
} from "@/app/api/device-quota/mapping/suggest/suggestion-job-types"
import type {
  CategoryCatalogItem,
  SuggestionAccessUser,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const USER: SuggestionAccessUser = {
  id: "user-1",
  role: "to_qltb",
  don_vi: "17",
}

const CATEGORIES: CategoryCatalogItem[] = [
  { id: 11, ma_nhom: "MAY-THO", phan_loai: "medical", ten_nhom: "Máy thở" },
  { id: 12, ma_nhom: "MAY-SIEU-AM", phan_loai: "medical", ten_nhom: "Máy siêu âm" },
]

const UNASSIGNED_NAMES: UnassignedName[] = [
  { ten_thiet_bi: "Máy thở A", device_count: 2, device_ids: [101, 102] },
  { ten_thiet_bi: "Máy thở B", device_count: 1, device_ids: [103] },
  { ten_thiet_bi: "Máy siêu âm", device_count: 3, device_ids: [104, 105, 106] },
]

function createJob(overrides: Partial<SuggestionJobRecord> = {}): SuggestionJobRecord {
  return {
    id: "job-1",
    donViId: 17,
    scopeKey: "user:user-1",
    dataSignature: "signature-1",
    status: "queued",
    provider: "vm",
    processedUniqueNames: 0,
    totalUniqueNames: 3,
    itemCounts: {
      categories: 2,
      unassignedDevices: 6,
      unassignedNames: 3,
    },
    result: null,
    error: null,
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    ...overrides,
  }
}

function createChunk(overrides: Partial<SuggestionJobChunkRecord> = {}): SuggestionJobChunkRecord {
  return {
    id: "chunk-1",
    jobId: "job-1",
    chunkIndex: 0,
    status: "queued",
    uniqueNameCount: 2,
    deviceNameCount: 3,
    deviceNames: UNASSIGNED_NAMES.slice(0, 2),
    result: null,
    error: null,
    attempts: 0,
    ...overrides,
  }
}

function createStore(): SuggestionJobStore {
  return {
    createJobWithChunks: vi.fn(async () => createJob()),
    findActiveJob: vi.fn(async () => null),
    getChunk: vi.fn(async () => createChunk()),
    getJob: vi.fn(async () => createJob()),
    getJobChunks: vi.fn(async () => [createChunk()]),
    listQueuedChunks: vi.fn(async () => [createChunk()]),
    markChunkFailed: vi.fn(async () => undefined),
    markChunkProcessing: vi.fn(async () => undefined),
    markChunkSucceeded: vi.fn(async () => undefined),
    markJobFailed: vi.fn(async () => undefined),
    markJobProcessing: vi.fn(async () => undefined),
    markJobSucceeded: vi.fn(async () => undefined),
    resetFailedChunks: vi.fn(async () => undefined),
    updateJobProgress: vi.fn(async () => undefined),
  }
}

describe("device quota suggestion job service", () => {
  test("creates a queued job with chunks grouped by unique device names", async () => {
    const store = createStore()

    const job = await createSuggestionJob({
      donViId: 17,
      maxDeviceIdsPerChunk: 4,
      maxUniqueNamesPerChunk: 2,
      requestId: "req-1",
      store,
      user: USER,
      fetchInputs: vi.fn(async () => ({
        categories: CATEGORIES,
        names: UNASSIGNED_NAMES,
      })),
    })

    expect(job.status).toBe("queued")
    expect(store.createJobWithChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: [
          expect.objectContaining({ uniqueNameCount: 2 }),
          expect.objectContaining({ uniqueNameCount: 1 }),
        ],
        job: expect.objectContaining({
          dataSignature: expect.any(String),
          totalUniqueNames: 3,
        }),
      }),
    )
  })

  test("returns an existing active job for the same scope and data signature", async () => {
    const existingJob = createJob({ id: "job-existing", status: "processing" })
    const store = createStore()
    vi.mocked(store.findActiveJob).mockResolvedValue(existingJob)

    const job = await createSuggestionJob({
      donViId: 17,
      maxUniqueNamesPerChunk: 2,
      requestId: "req-1",
      store,
      user: USER,
      fetchInputs: vi.fn(async () => ({
        categories: CATEGORIES,
        names: UNASSIGNED_NAMES,
      })),
    })

    expect(job).toEqual(existingJob)
    expect(store.createJobWithChunks).not.toHaveBeenCalled()
  })

  test("processes one chunk and updates progress without touching completed chunks", async () => {
    const store = createStore()

    await processSuggestionJobChunk({
      chunkId: "chunk-1",
      store,
      suggestChunk: vi.fn(async () => ({
        results: [
          {
            query_text: "Máy thở A",
            results: [{ id: 11, ma_nhom: "MAY-THO", ten_nhom: "Máy thở", rrf_score: 0.9 }],
          },
        ],
      })),
    })

    expect(store.markChunkProcessing).toHaveBeenCalledWith("chunk-1")
    expect(store.markChunkSucceeded).toHaveBeenCalledWith(
      "chunk-1",
      expect.objectContaining({ results: expect.any(Array) }),
    )
    expect(store.updateJobProgress).toHaveBeenCalledWith("job-1")
  })

  test("marks only the failed chunk when VM work fails", async () => {
    const store = createStore()

    await expect(
      processSuggestionJobChunk({
        chunkId: "chunk-1",
        store,
        suggestChunk: vi.fn(async () => {
          throw new Error("VM timeout")
        }),
      }),
    ).rejects.toThrow("VM timeout")

    expect(store.markChunkFailed).toHaveBeenCalledWith("chunk-1", "VM timeout")
    expect(store.markJobFailed).toHaveBeenCalledWith("job-1", "VM timeout")
  })

  test("retry resets failed chunks only", async () => {
    const store = createStore()

    const job = await retrySuggestionJob({
      jobId: "job-1",
      store,
      user: USER,
    })

    expect(job.id).toBe("job-1")
    expect(store.resetFailedChunks).toHaveBeenCalledWith("job-1")
    expect(store.markJobProcessing).toHaveBeenCalledWith("job-1")
  })

  test("processes only the queued chunks selected by the store", async () => {
    const store = createStore()
    vi.mocked(store.listQueuedChunks).mockResolvedValue([
      createChunk({ id: "chunk-1", chunkIndex: 0 }),
      createChunk({ id: "chunk-2", chunkIndex: 1 }),
    ])

    const result = await processNextSuggestionJobChunks({
      limit: 2,
      suggestChunk: vi.fn(async () => ({ results: [] })),
      store,
    })

    expect(result).toEqual({ failed: 0, processed: 2 })
    expect(store.listQueuedChunks).toHaveBeenCalledWith(2)
    expect(store.markChunkSucceeded).toHaveBeenCalledTimes(2)
  })

  test("does not expose inaccessible jobs", async () => {
    const store = createStore()
    vi.mocked(store.getJob).mockResolvedValue(createJob({ scopeKey: "user:other-user" }))

    await expect(
      getSuggestionJob({
        jobId: "job-1",
        store,
        user: USER,
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
