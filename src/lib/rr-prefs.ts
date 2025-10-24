// Typed local persistence helpers for Repair Requests UI preferences
// Note: Safe to use only in client components

export type ViewDensity = 'compact' | 'standard' | 'spacious'
export type TextWrap = 'truncate' | 'wrap'

export type UiDateRange = { from: string | null; to: string | null }
export type UiFilters = {
  status: string[]
  dateRange?: UiDateRange | null
}

export type ColumnVisibility = Record<string, boolean>

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

const safeGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSet = (key: string, value: any) => {
  if (typeof window === 'undefined') return
  try {
    if (value === undefined || value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // ignore
  }
}

// Keys
export const RR_COL_VIS_KEY = 'rr_col_vis'
export const RR_TABLE_DENSITY_KEY = 'rr_table_density'
export const RR_TEXT_WRAP_KEY = 'rr_text_wrap'
export const RR_FILTER_STATE_KEY = 'rr_filter_state'
export const RR_SAVED_FILTERS_PREFIX = 'rr_saved_filters_' // + userId

// Column visibility
export function getColumnVisibility(): ColumnVisibility | null {
  return safeParse<ColumnVisibility>(safeGet(RR_COL_VIS_KEY))
}
export function setColumnVisibility(v: ColumnVisibility) {
  safeSet(RR_COL_VIS_KEY, v)
}

// Density
export function getTableDensity(): ViewDensity {
  const raw = safeParse<ViewDensity>(safeGet(RR_TABLE_DENSITY_KEY))
  return raw ?? 'standard'
}
export function setTableDensity(v: ViewDensity) {
  safeSet(RR_TABLE_DENSITY_KEY, v)
}

// Text wrap
export function getTextWrap(): TextWrap {
  const raw = safeParse<TextWrap>(safeGet(RR_TEXT_WRAP_KEY))
  return raw ?? 'truncate'
}
export function setTextWrap(v: TextWrap) {
  safeSet(RR_TEXT_WRAP_KEY, v)
}

// UI Filters
export function getUiFilters(): UiFilters {
  const raw = safeParse<UiFilters>(safeGet(RR_FILTER_STATE_KEY))
  return (
    raw ?? {
      status: [],
      dateRange: null,
    }
  )
}
export function setUiFilters(v: UiFilters) {
  safeSet(RR_FILTER_STATE_KEY, v)
}

// Saved filter sets per user (optional)
export type SavedFilterSet = { id: string; name: string; filters: UiFilters }

export function getSavedFilterSets(userId: string): SavedFilterSet[] {
  const key = RR_SAVED_FILTERS_PREFIX + userId
  return safeParse<SavedFilterSet[]>(safeGet(key)) ?? []
}
export function setSavedFilterSets(userId: string, sets: SavedFilterSet[]) {
  const key = RR_SAVED_FILTERS_PREFIX + userId
  safeSet(key, sets)
}