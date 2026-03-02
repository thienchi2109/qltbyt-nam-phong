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

// Column visibility
export function getColumnVisibility(): ColumnVisibility | null {
  return safeParse<ColumnVisibility>(safeGet('rr_col_vis'))
}
export function setColumnVisibility(v: ColumnVisibility) {
  safeSet('rr_col_vis', v)
}

// Density
export function getTableDensity(): ViewDensity {
  const raw = safeParse<ViewDensity>(safeGet('rr_table_density'))
  return raw ?? 'standard'
}
export function setTableDensity(v: ViewDensity) {
  safeSet('rr_table_density', v)
}

// Text wrap
export function getTextWrap(): TextWrap {
  const raw = safeParse<TextWrap>(safeGet('rr_text_wrap'))
  return raw ?? 'truncate'
}
export function setTextWrap(v: TextWrap) {
  safeSet('rr_text_wrap', v)
}

// UI Filters
export function getUiFilters(): UiFilters {
  const raw = safeParse<UiFilters>(safeGet('rr_filter_state'))
  return (
    raw ?? {
      status: [],
      dateRange: null,
    }
  )
}
export function setUiFilters(v: UiFilters) {
  safeSet('rr_filter_state', v)
}

// Saved filter sets per user (optional)
export type SavedFilterSet = { id: string; name: string; filters: UiFilters }

export function getSavedFilterSets(userId: string): SavedFilterSet[] {
  const key = 'rr_saved_filters_' + userId
  return safeParse<SavedFilterSet[]>(safeGet(key)) ?? []
}
export function setSavedFilterSets(userId: string, sets: SavedFilterSet[]) {
  const key = 'rr_saved_filters_' + userId
  safeSet(key, sets)
}