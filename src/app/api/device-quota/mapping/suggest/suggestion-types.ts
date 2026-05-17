export type SuggestionProvider = "supabase"

export type SuggestionAccessUser = {
  id?: string | number | null
  role?: string | null
  don_vi?: string | number | null
  dia_ban_id?: string | number | null
  khoa_phong?: string | null
}

export type SuggestedGroup = {
  nhom_id: number
  nhom_label: string
  nhom_code: string
  phan_loai: string | null
  rrf_score: number
  device_names: string[]
  device_ids: number[]
  device_name_to_ids: Record<string, number[]>
}

export type SuggestMappingResult = {
  groups: SuggestedGroup[]
  unmatched: { device_name: string; device_ids: number[] }[]
  totalDevices: number
  matchedDevices: number
}

export type SuggestionItemCounts = {
  unassignedNames: number
  unassignedDevices: number
  categories: number
}

export type SuggestionProviderResult = {
  result: SuggestMappingResult
  itemCounts: SuggestionItemCounts
  catalogSignature: string
}

export type UnassignedName = {
  ten_thiet_bi: string
  device_count: number
  device_ids: number[]
}

export type SearchResult = {
  query_text: string
  results: {
    id: number
    ten_nhom: string
    ma_nhom: string
    phan_loai: string | null
    rrf_score: number
  }[]
}

export type CategoryCatalogItem = {
  id: number
  ma_nhom: string | null
  ten_nhom: string | null
  phan_loai: string | null
  tu_khoa?: string[] | null
}

export type DinhMucNhomRow = CategoryCatalogItem & {
  parent_id?: number | null
  don_vi_tinh?: string | null
  level?: number | null
}
