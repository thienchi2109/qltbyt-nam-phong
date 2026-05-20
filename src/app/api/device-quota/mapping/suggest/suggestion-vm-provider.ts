import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createCatalogSignature, mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
import {
  createSuggestionAlgorithmConfig,
  getVmCandidateTopK,
  rerankSuggestionResults,
  type SuggestionAlgorithmConfig,
} from "@/app/api/device-quota/mapping/suggest/suggestion-ai-reranker"
import {
  assertVmCircuitClosed,
  cacheSuggestionResult,
  createSuggestionRuntimeKey,
  enforceSuggestionThrottle,
  getCachedSuggestionResult,
  recordVmFailure,
  recordVmSuccess,
} from "@/app/api/device-quota/mapping/suggest/suggestion-traffic-control"
import { callVmSuggest, type VmSuggestRequest } from "@/app/api/device-quota/mapping/suggest/suggestion-vm-client"
import { callSupabaseRpc } from "@/app/api/device-quota/mapping/suggest/suggestion-supabase-provider"
import type {
  DinhMucNhomRow,
  SearchResult,
  SuggestionAccessUser,
  SuggestionProviderResult,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const DEFAULT_VM_MAX_PAYLOAD_BYTES = 1_000_000

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function stableHash(value: unknown): string {
  const input = JSON.stringify(value)
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

export function createUnassignedSignature(names: UnassignedName[]): string {
  const normalized = names
    .map((name) => ({
      name: name.ten_thiet_bi,
      deviceIds: [...name.device_ids].sort((left, right) => left - right),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
  return `v1-${normalized.length}-${stableHash(normalized)}`
}

export function createEmptyCategoryResult(names: UnassignedName[]): SearchResult[] {
  return names.map((name) => ({
    query_text: name.ten_thiet_bi,
    results: [],
  }))
}

export function toVmRequest({
  requestId,
  donViId,
  names,
  categories,
  catalogSignature,
  algorithmConfig,
}: {
  requestId: string
  donViId: number
  names: UnassignedName[]
  categories: DinhMucNhomRow[]
  catalogSignature: string
  algorithmConfig?: SuggestionAlgorithmConfig | undefined
}): VmSuggestRequest {
  return {
    requestId,
    facilityId: donViId,
    catalogSignature,
    unassignedSignature: createUnassignedSignature(names),
    deviceNames: names.map((name) => ({
      name: name.ten_thiet_bi,
      deviceIds: name.device_ids,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      code: category.ma_nhom,
      name: category.ten_nhom ?? category.ma_nhom ?? String(category.id),
      classification: category.phan_loai,
    })),
    options: {
      topK: algorithmConfig?.vmCandidateTopK ?? getVmCandidateTopK(),
      semanticWeight: 1,
      lexicalWeight: 1,
      minConfidence: 0.62,
      minMargin: 0.04,
    },
  }
}

export function assertPayloadSize(request: VmSuggestRequest): void {
  const maxBytes = parsePositiveInteger(
    process.env.DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES,
    DEFAULT_VM_MAX_PAYLOAD_BYTES,
  )
  const payloadBytes = new TextEncoder().encode(JSON.stringify(request)).length
  if (payloadBytes > maxBytes) {
    throw new SuggestionRouteError("VM suggestion payload is too large", 413, {
      payloadBytes,
      maxBytes,
    })
  }
}

export function toSearchResults(response: Awaited<ReturnType<typeof callVmSuggest>>): SearchResult[] {
  return response.suggestions.map((suggestion) => ({
    query_text: suggestion.deviceName,
    results: suggestion.candidates.map((candidate) => ({
      id: candidate.categoryId,
      ten_nhom: candidate.categoryName,
      ma_nhom: candidate.categoryCode ?? "",
      phan_loai: candidate.classification,
      rrf_score: candidate.score,
    })),
  }))
}

export async function runVmSuggestMapping({
  donViId,
  requestId,
  user,
}: {
  donViId: number
  requestId: string
  user: SuggestionAccessUser
}): Promise<SuggestionProviderResult> {
  const { categories, names } = await fetchVmSuggestionInputs({ donViId, user })

  const catalogSignature = createCatalogSignature(categories)
  const unassignedSignature = createUnassignedSignature(names)
  const algorithmConfig = createSuggestionAlgorithmConfig()
  const itemCounts = {
    unassignedNames: names.length,
    unassignedDevices: names.reduce((sum, name) => sum + name.device_ids.length, 0),
    categories: categories.length,
  }

  if (names.length === 0) {
    return {
      result: { groups: [], unmatched: [], totalDevices: 0, matchedDevices: 0 },
      itemCounts,
      catalogSignature,
    }
  }

  const runtimeKey = createSuggestionRuntimeKey({
    dataSignature: `${catalogSignature}:${unassignedSignature}:${algorithmConfig.signature}`,
    donViId,
    provider: "vm",
    user,
  })
  const cached = getCachedSuggestionResult(runtimeKey)
  if (cached) return cached

  if (categories.length === 0) {
    const result = {
      result: mergeSuggestionResults(names, createEmptyCategoryResult(names)),
      itemCounts,
      catalogSignature,
    }
    cacheSuggestionResult(runtimeKey, result)
    return result
  }

  const vmRequest = toVmRequest({
    algorithmConfig,
    requestId,
    donViId,
    names,
    categories,
    catalogSignature,
  })
  assertPayloadSize(vmRequest)
  enforceSuggestionThrottle(runtimeKey)
  assertVmCircuitClosed()

  try {
    const vmResponse = await callVmSuggest(vmRequest)
    const searchResults = await rerankSuggestionResults({
      algorithmConfig,
      categories,
      names,
      requestId,
      searchResults: toSearchResults(vmResponse),
    })
    const result = {
      result: mergeSuggestionResults(names, searchResults),
      itemCounts,
      catalogSignature,
    }
    recordVmSuccess()
    cacheSuggestionResult(runtimeKey, result)
    return result
  } catch (error) {
    if (error instanceof SuggestionRouteError && error.status >= 500) {
      recordVmFailure()
    }
    throw error
  }
}

export async function fetchVmSuggestionInputs({
  donViId,
  user,
}: {
  donViId: number
  user: SuggestionAccessUser
}): Promise<{ categories: DinhMucNhomRow[]; names: UnassignedName[] }> {
  const [names, categories] = await Promise.all([
    callSupabaseRpc<UnassignedName[]>(
      "dinh_muc_thiet_bi_unassigned_names",
      { p_don_vi: donViId },
      user,
    ),
    callSupabaseRpc<DinhMucNhomRow[]>("dinh_muc_nhom_list", { p_don_vi: donViId }, user),
  ])

  return { categories, names }
}
