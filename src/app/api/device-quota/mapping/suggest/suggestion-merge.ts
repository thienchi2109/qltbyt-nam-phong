import type {
  CategoryCatalogItem,
  SearchResult,
  SuggestMappingResult,
  SuggestedGroup,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

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
      const deviceNameToIds: Record<string, number[]> = Object.create(null) as Record<
        string,
        number[]
      >
      deviceNameToIds[searchResult.query_text] = [...nameInfo.device_ids]
      groupMap.set(best.id, {
        nhom_id: best.id,
        nhom_label: best.ten_nhom,
        nhom_code: best.ma_nhom,
        phan_loai: best.phan_loai,
        rrf_score: best.rrf_score,
        device_names: [searchResult.query_text],
        device_ids: [...nameInfo.device_ids],
        device_name_to_ids: deviceNameToIds,
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
