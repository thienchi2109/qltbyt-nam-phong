import { generateObject } from "ai"
import { z } from "zod"

import type {
  CategoryCatalogItem,
  SearchResult,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"
import { getChatModel } from "@/lib/ai/provider"
import { normalizeSearchText } from "@/lib/search-normalize"

const DEFAULT_RERANK_TOP_K = 8
const DEFAULT_MIN_RERANK_CONFIDENCE = 0.72
const MAX_RERANK_TOP_K = 10
const DEFAULT_VM_TOP_K = 3

const rerankSchema = z
  .object({
    categoryId: z.number().int().positive().nullable(),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(300),
  })
  .strict()

type RerankInput = {
  categories: CategoryCatalogItem[]
  names: UnassignedName[]
  requestId: string
  searchResults: SearchResult[]
}

type Candidate = SearchResult["results"][number]

export type SuggestionAlgorithmConfig = {
  minConfidence: number
  rerankEnabled: boolean
  signature: string
  vmCandidateTopK: number
}

function readBooleanEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true"
}

function readPositiveNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function isAiRerankEnabled(): boolean {
  return readBooleanEnv(process.env.DEVICE_QUOTA_AI_RERANK_ENABLED)
}

export function getVmCandidateTopK(): number {
  if (!isAiRerankEnabled()) return DEFAULT_VM_TOP_K
  const configured = readPositiveNumberEnv(
    process.env.DEVICE_QUOTA_AI_RERANK_TOP_K,
    DEFAULT_RERANK_TOP_K,
  )
  return Math.min(Math.max(Math.trunc(configured), 4), MAX_RERANK_TOP_K)
}

function minRerankConfidence(): number {
  return Math.min(
    readPositiveNumberEnv(
      process.env.DEVICE_QUOTA_AI_RERANK_MIN_CONFIDENCE,
      DEFAULT_MIN_RERANK_CONFIDENCE,
    ),
    1,
  )
}

function buildAlgorithmSignature({
  minConfidence,
  rerankEnabled,
  vmCandidateTopK,
}: Omit<SuggestionAlgorithmConfig, "signature">): string {
  if (!rerankEnabled) return "dqss-rerank:v1:off"
  return `dqss-rerank:v1:on:topK=${vmCandidateTopK}:min=${minConfidence}`
}

export function createSuggestionAlgorithmConfig(): SuggestionAlgorithmConfig {
  const rerankEnabled = isAiRerankEnabled()
  const config = {
    minConfidence: minRerankConfidence(),
    rerankEnabled,
    vmCandidateTopK: getVmCandidateTopK(),
  }
  return {
    ...config,
    signature: buildAlgorithmSignature(config),
  }
}

export function createSuggestionAlgorithmSignature(): string {
  return createSuggestionAlgorithmConfig().signature
}

export function parseSuggestionAlgorithmSignature(
  signature: string | undefined,
): SuggestionAlgorithmConfig | undefined {
  if (signature === "dqss-rerank:v1:off") {
    return {
      minConfidence: DEFAULT_MIN_RERANK_CONFIDENCE,
      rerankEnabled: false,
      signature,
      vmCandidateTopK: DEFAULT_VM_TOP_K,
    }
  }

  const match = signature?.match(/^dqss-rerank:v1:on:topK=(\d+):min=([0-9.]+)$/)
  if (!match) return undefined

  const topK = Number(match[1])
  const minConfidence = Number(match[2])
  if (!Number.isInteger(topK) || topK <= 0 || !Number.isFinite(minConfidence)) return undefined

  const config = {
    minConfidence: Math.min(Math.max(minConfidence, 0), 1),
    rerankEnabled: true,
    vmCandidateTopK: Math.min(Math.max(topK, 4), MAX_RERANK_TOP_K),
  }
  return {
    ...config,
    signature: buildAlgorithmSignature(config),
  }
}

function hasAnyTerm(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term))
}

function isRespiratoryDevice(deviceName: string): boolean {
  const normalized = normalizeSearchText(deviceName)
  return hasAnyTerm(normalized, ["may giup tho", "may tho", "vsmart", "vfs", "ho hap"])
}

function isRehabOrFitnessDevice(deviceName: string): boolean {
  const normalized = normalizeSearchText(deviceName)
  return hasAnyTerm(normalized, [
    "tham tap",
    "tap the duc",
    "phuc hoi chuc nang",
    "vat ly tri lieu",
    "treadmill",
  ])
}

function candidateText(candidate: Candidate): string {
  return normalizeSearchText(
    [candidate.ten_nhom, candidate.ma_nhom, candidate.phan_loai ?? ""].join(" "),
  )
}

function isOphthalmologySurgery(candidate: Candidate): boolean {
  const text = candidateText(candidate)
  return hasAnyTerm(text, ["nhan khoa", "mat"]) && hasAnyTerm(text, ["mo mat", "phau thuat"])
}

function isOphthalmologyMeasurement(candidate: Candidate): boolean {
  const text = candidateText(candidate)
  return hasAnyTerm(text, ["nhan ap", "do nhan ap", "tonometer"])
}

function isDeterministicConflict(deviceName: string, candidate: Candidate): boolean {
  if (isRespiratoryDevice(deviceName) && isOphthalmologySurgery(candidate)) return true
  if (isRehabOrFitnessDevice(deviceName) && isOphthalmologyMeasurement(candidate)) return true
  return false
}

export function applyDeterministicGuardrails(searchResults: SearchResult[]): SearchResult[] {
  return searchResults.map((searchResult) => ({
    ...searchResult,
    results: searchResult.results.filter(
      (candidate) => !isDeterministicConflict(searchResult.query_text, candidate),
    ),
  }))
}

function categoryById(categories: CategoryCatalogItem[]): Map<number, CategoryCatalogItem> {
  return new Map(categories.map((category) => [category.id, category]))
}

function nameByText(names: UnassignedName[]): Map<string, UnassignedName> {
  return new Map(names.map((name) => [name.ten_thiet_bi, name]))
}

function reorderSelectedCandidate(candidates: Candidate[], selectedId: number): Candidate[] {
  const selected = candidates.find((candidate) => candidate.id === selectedId)
  if (!selected) return []
  return [selected, ...candidates.filter((candidate) => candidate.id !== selectedId)]
}

function buildPrompt({
  candidates,
  categoryLookup,
  requestId,
  searchResult,
  sourceName,
}: {
  candidates: Candidate[]
  categoryLookup: Map<number, CategoryCatalogItem>
  requestId: string
  searchResult: SearchResult
  sourceName?: UnassignedName
}): string {
  const candidatePayload = candidates.map((candidate) => {
    const catalog = categoryLookup.get(candidate.id)
    return {
      categoryId: candidate.id,
      code: candidate.ma_nhom,
      name: candidate.ten_nhom,
      classification: candidate.phan_loai,
      keywords: catalog?.tu_khoa ?? [],
      vmScore: candidate.rrf_score,
    }
  })

  return JSON.stringify({
    requestId,
    device: {
      name: searchResult.query_text,
      deviceIds: sourceName?.device_ids ?? [],
    },
    candidates: candidatePayload,
    instructions: [
      "Choose only one categoryId from candidates when the device clearly belongs there.",
      "Return categoryId null when candidates are unsafe, cross-specialty, or low confidence.",
      "Respiratory/ventilator devices must not map to ophthalmology surgery categories.",
      "Rehab or fitness devices must not map to ophthalmology eye-pressure measurement categories.",
    ],
  })
}

export async function rerankSuggestionResults({
  algorithmConfig = createSuggestionAlgorithmConfig(),
  categories,
  names,
  requestId,
  searchResults,
}: RerankInput & { algorithmConfig?: SuggestionAlgorithmConfig | undefined }): Promise<SearchResult[]> {
  const guardedResults = applyDeterministicGuardrails(searchResults)
  if (!algorithmConfig.rerankEnabled) return guardedResults

  try {
    const chatModel = getChatModel()
    const categoryLookup = categoryById(categories)
    const sourceNames = nameByText(names)
    const minConfidence = algorithmConfig.minConfidence
    const reranked: SearchResult[] = []

    for (const searchResult of guardedResults) {
      const candidates = searchResult.results
      if (candidates.length === 0) {
        reranked.push(searchResult)
        continue
      }

      const { object } = await generateObject({
        model: chatModel.model,
        providerOptions: chatModel.providerOptions,
        schema: rerankSchema,
        system:
          "You are a conservative Vietnamese medical equipment category reranker. Return null when the match is not clearly safe.",
        prompt: buildPrompt({
          candidates,
          categoryLookup,
          requestId,
          searchResult,
          sourceName: sourceNames.get(searchResult.query_text),
        }),
        temperature: 0,
      })

      if (object.categoryId === null || object.confidence < minConfidence) {
        reranked.push({ ...searchResult, results: [] })
        continue
      }

      reranked.push({
        ...searchResult,
        results: reorderSelectedCandidate(candidates, object.categoryId),
      })
    }

    return reranked
  } catch {
    return guardedResults
  }
}
