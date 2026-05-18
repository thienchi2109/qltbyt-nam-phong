import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import { createCatalogSignature, mergeSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-merge"
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

function createUnassignedSignature(names: UnassignedName[]): string {
  const normalized = names
    .map((name) => ({
      name: name.ten_thiet_bi,
      deviceIds: [...name.device_ids].sort((left, right) => left - right),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
  return `v1-${normalized.length}-${stableHash(normalized)}`
}

function createEmptyCategoryResult(names: UnassignedName[]): SearchResult[] {
  return names.map((name) => ({
    query_text: name.ten_thiet_bi,
    results: [],
  }))
}

function toVmRequest({
  requestId,
  donViId,
  names,
  categories,
  catalogSignature,
}: {
  requestId: string
  donViId: number
  names: UnassignedName[]
  categories: DinhMucNhomRow[]
  catalogSignature: string
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
      topK: 3,
      semanticWeight: 1,
      lexicalWeight: 1,
      minConfidence: 0.62,
      minMargin: 0.04,
    },
  }
}

function assertPayloadSize(request: VmSuggestRequest): void {
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

function toSearchResults(response: Awaited<ReturnType<typeof callVmSuggest>>): SearchResult[] {
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
  const [names, categories] = await Promise.all([
    callSupabaseRpc<UnassignedName[]>(
      "dinh_muc_thiet_bi_unassigned_names",
      { p_don_vi: donViId },
      user,
    ),
    callSupabaseRpc<DinhMucNhomRow[]>("dinh_muc_nhom_list", { p_don_vi: donViId }, user),
  ])

  const catalogSignature = createCatalogSignature(categories)
  const unassignedSignature = createUnassignedSignature(names)
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
    dataSignature: `${catalogSignature}:${unassignedSignature}`,
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
    const result = {
      result: mergeSuggestionResults(names, toSearchResults(vmResponse)),
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
