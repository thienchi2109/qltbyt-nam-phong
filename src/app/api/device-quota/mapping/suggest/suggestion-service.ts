import jwt from "jsonwebtoken"

import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import type {
  CategoryCatalogItem,
  DinhMucNhomRow,
  SearchResult,
  SuggestMappingResult,
  SuggestedGroup,
  SuggestionAccessUser,
  SuggestionProvider,
  SuggestionProviderResult,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const CHUNK_SIZE = 10
const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

type AccessDeps = {
  lookupAccessibleFacilityIds: (user: SuggestionAccessUser) => Promise<number[]>
}

export class SuggestionRouteError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toRole(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function parseStructuredDetails(details: unknown): unknown {
  if (typeof details !== "string") return details
  try {
    return JSON.parse(details) as unknown
  } catch {
    return details
  }
}

function getPayloadMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback
  const record = payload as Record<string, unknown>
  for (const key of ["message", "details", "hint"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim() !== "") return value
  }
  return fallback
}

function getPayloadDetails(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined
  const record = payload as Record<string, unknown>
  return parseStructuredDetails(record.details)
}

export async function lookupAccessibleFacilityIds(user: SuggestionAccessUser): Promise<number[]> {
  const rows = await callSupabaseRpc<unknown>("get_accessible_facilities", {}, user)
  if (!Array.isArray(rows)) return []

  const ids: number[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const id = toNumber((row as Record<string, unknown>).id as string | number | null | undefined)
    if (id !== null) ids.push(id)
  }
  return ids
}

export async function assertSuggestionAccess(
  user: SuggestionAccessUser,
  donViId: number,
  deps: AccessDeps = { lookupAccessibleFacilityIds },
): Promise<void> {
  const role = toRole(user.role)

  if (!["global", "admin", "to_qltb", "regional_leader"].includes(role)) {
    throw new SuggestionRouteError("Forbidden: insufficient role", 403)
  }

  if (isGlobalRole(role)) {
    return
  }

  if (isRegionalLeaderRole(role)) {
    const userRegionId = toNumber(user.dia_ban_id)
    if (userRegionId === null) {
      throw new SuggestionRouteError("Forbidden: facility scope denied", 403)
    }

    const accessibleFacilityIds = await deps.lookupAccessibleFacilityIds(user)
    if (!accessibleFacilityIds.includes(donViId)) {
      throw new SuggestionRouteError("Forbidden: facility scope denied", 403)
    }
    return
  }

  if (toNumber(user.don_vi) !== donViId) {
    throw new SuggestionRouteError("Forbidden: facility scope denied", 403)
  }
}

function createSupabaseJwt(user: SuggestionAccessUser): string {
  const role = toRole(user.role)
  const appRole = role === "admin" ? "global" : role
  const userId = user.id ? String(user.id) : ""
  const now = Math.floor(Date.now() / 1000)
  const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
  const expiresAt = now + 120
  const claims: Record<string, string | number | null> = {
    role: "authenticated",
    iat: issuedAt,
    exp: expiresAt,
    sub: userId,
    app_role: appRole,
    don_vi: user.don_vi ? String(user.don_vi) : null,
    user_id: userId,
    dia_ban: user.dia_ban_id ? String(user.dia_ban_id) : null,
    khoa_phong: user.khoa_phong ?? null,
  }

  return jwt.sign(claims, getEnv("SUPABASE_JWT_SECRET"), { algorithm: "HS256" })
}

async function callSupabaseRpc<TRes>(
  fn: string,
  args: Record<string, unknown>,
  user: SuggestionAccessUser,
): Promise<TRes> {
  const token = createSupabaseJwt(user)
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      apikey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    let message = `RPC ${fn} failed (${response.status})`
    let details: unknown
    try {
      const payload = (await response.json()) as unknown
      details = getPayloadDetails(payload)
      message = getPayloadMessage(payload, message)
    } catch {}
    throw new SuggestionRouteError(message, response.status, details)
  }

  return (await response.json()) as TRes
}

async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")
  const embeddings: number[][] = []

  for (const chunk of chunkArray(texts, CHUNK_SIZE)) {
    const response = await fetch(`${supabaseUrl}/functions/v1/embed-device-name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ texts: chunk }),
    })

    if (!response.ok) {
      throw new Error(`Embedding generation failed (${response.status})`)
    }

    const body = (await response.json()) as { embeddings?: number[][] }
    if (!Array.isArray(body.embeddings)) {
      throw new Error("Invalid embedding response")
    }
    embeddings.push(...body.embeddings)
  }

  return embeddings
}

async function searchCategories(
  queries: { text: string; embedding: number[] }[],
  donViId: number,
  user: SuggestionAccessUser,
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = []
  for (const chunk of chunkArray(queries, CHUNK_SIZE)) {
    const p_queries = chunk.map((query) => ({
      text: query.text,
      embedding: query.embedding,
    }))
    const results = await callSupabaseRpc<SearchResult[]>(
      "hybrid_search_category_batch",
      { p_queries, p_don_vi: donViId },
      user,
    )
    allResults.push(...(results ?? []))
  }
  return allResults
}

export function mergeSuggestionResults(
  names: UnassignedName[],
  searchResults: SearchResult[],
): SuggestMappingResult {
  const nameToDeviceInfo = new Map<string, UnassignedName>()
  for (const name of names) {
    nameToDeviceInfo.set(name.ten_thiet_bi, name)
  }

  const groupMap = new Map<number, SuggestedGroup>()
  const unmatched: { device_name: string; device_ids: number[] }[] = []

  for (const searchResult of searchResults) {
    const nameInfo = nameToDeviceInfo.get(searchResult.query_text)
    if (!nameInfo) continue

    if (!searchResult.results || searchResult.results.length === 0) {
      unmatched.push({
        device_name: searchResult.query_text,
        device_ids: nameInfo.device_ids,
      })
      continue
    }

    const best = searchResult.results[0]
    const existing = groupMap.get(best.id)
    if (existing) {
      existing.device_ids.push(...nameInfo.device_ids)
      if (!existing.device_names.includes(searchResult.query_text)) {
        existing.device_names.push(searchResult.query_text)
      }
      existing.device_name_to_ids[searchResult.query_text] = [
        ...(existing.device_name_to_ids[searchResult.query_text] ?? []),
        ...nameInfo.device_ids,
      ]
      existing.rrf_score = Math.max(existing.rrf_score, best.rrf_score)
    } else {
      groupMap.set(best.id, {
        nhom_id: best.id,
        nhom_label: best.ten_nhom,
        nhom_code: best.ma_nhom,
        phan_loai: best.phan_loai,
        rrf_score: best.rrf_score,
        device_names: [searchResult.query_text],
        device_ids: [...nameInfo.device_ids],
        device_name_to_ids: { [searchResult.query_text]: [...nameInfo.device_ids] },
      })
    }
  }

  const groups = Array.from(groupMap.values()).sort(
    (left, right) => right.device_ids.length - left.device_ids.length,
  )
  const matchedDevices = groups.reduce((sum, group) => sum + group.device_ids.length, 0)
  const totalDevices = names.reduce((sum, name) => sum + name.device_ids.length, 0)

  return { groups, unmatched, totalDevices, matchedDevices }
}

export function createCatalogSignature(categories: CategoryCatalogItem[]): string {
  const normalized = categories
    .map((category) => ({
      id: category.id,
      ma_nhom: category.ma_nhom ?? "",
      ten_nhom: category.ten_nhom ?? "",
      phan_loai: category.phan_loai ?? "",
      tu_khoa: [...(category.tu_khoa ?? [])].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.id - right.id)

  const input = JSON.stringify(normalized)
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0
  }
  return `v1-${normalized.length}-${hash.toString(36)}`
}

export async function runSuggestMapping({
  donViId,
  user,
}: {
  donViId: number
  provider: SuggestionProvider
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

  const texts = names.map((name) => name.ten_thiet_bi)
  const embeddings = await fetchEmbeddings(texts)
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Embedding response count mismatch: expected ${texts.length}, received ${embeddings.length}`,
    )
  }
  const searchResults = await searchCategories(
    texts.map((text, index) => ({ text, embedding: embeddings[index]! })),
    donViId,
    user,
  )

  return {
    result: mergeSuggestionResults(names, searchResults),
    itemCounts,
    catalogSignature,
  }
}
