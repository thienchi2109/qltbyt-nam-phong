import type {
  DinhMucNhomRow,
  SearchResult,
  SuggestMappingResult,
  SuggestionItemCounts,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

export type SuggestionJobStatus = "queued" | "processing" | "succeeded" | "failed"

export type SuggestionJobRecord = {
  id: string
  donViId: number
  scopeKey: string
  dataSignature: string
  catalogSignature?: string
  status: SuggestionJobStatus
  provider: "vm"
  processedUniqueNames: number
  totalUniqueNames: number
  itemCounts: SuggestionItemCounts
  result: SuggestMappingResult | null
  error: string | null
  createdAt: string
  updatedAt: string
  categorySnapshot?: DinhMucNhomRow[]
}

export type SuggestionJobChunkRecord = {
  id: string
  jobId: string
  chunkIndex: number
  status: SuggestionJobStatus
  uniqueNameCount: number
  deviceNameCount: number
  deviceNames: UnassignedName[]
  result: { results: SearchResult[] } | null
  error: string | null
  attempts: number
}

export type CreateSuggestionJobPayload = {
  chunks: {
    chunkIndex: number
    deviceNameCount: number
    deviceNames: UnassignedName[]
    uniqueNameCount: number
  }[]
  job: Omit<SuggestionJobRecord, "createdAt" | "id" | "result" | "updatedAt">
}

export type SuggestionJobStore = {
  createJobWithChunks(payload: CreateSuggestionJobPayload): Promise<SuggestionJobRecord>
  findActiveJob(args: {
    dataSignature: string
    donViId: number
    scopeKey: string
  }): Promise<SuggestionJobRecord | null>
  getChunk(chunkId: string): Promise<SuggestionJobChunkRecord | null>
  getJob(jobId: string): Promise<SuggestionJobRecord | null>
  getJobChunks(jobId: string): Promise<SuggestionJobChunkRecord[]>
  listQueuedChunks(limit: number): Promise<SuggestionJobChunkRecord[]>
  markChunkFailed(chunkId: string, error: string): Promise<void>
  markChunkProcessing(chunkId: string): Promise<void>
  markChunkSucceeded(chunkId: string, result: { results: SearchResult[] }): Promise<void>
  markJobFailed(jobId: string, error: string): Promise<void>
  markJobProcessing(jobId: string): Promise<void>
  markJobSucceeded(jobId: string, result: SuggestMappingResult): Promise<void>
  resetFailedChunks(jobId: string): Promise<void>
  updateJobProgress(jobId: string): Promise<void>
}
