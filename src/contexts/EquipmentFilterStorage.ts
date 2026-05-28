import type * as React from "react"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"

/** Prefix for tenant-scoped equipment filter sessionStorage keys. */
export const EQUIPMENT_FILTER_STORAGE_KEY_PREFIX = "eq_filters"

export interface StoredFilterState {
  searchTerm: string
  sorting: SortingState
  columnFilters: ColumnFiltersState
}

export type ProviderFilterState = StoredFilterState & {
  storageKey: string | null
}

/** Empty persisted equipment filter state. */
export const EMPTY_STORED_FILTERS: StoredFilterState = {
  searchTerm: "",
  sorting: [],
  columnFilters: [],
}

/** Build a tenant-scoped storage key. `null` = "all", `undefined` = no tenant yet. */
export function buildEquipmentFilterStorageKey(tenantId: number | null | undefined): string | null {
  if (tenantId === undefined) return null
  const suffix = tenantId === null ? "_all" : `_${tenantId}`
  return `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}${suffix}`
}

/** Reads validated equipment filters from sessionStorage, falling back to empty state. */
export function getStoredFilters(key: string | null): StoredFilterState {
  if (!key) return EMPTY_STORED_FILTERS
  return readStoredFilters(key) ?? EMPTY_STORED_FILTERS
}

/** Persists non-empty equipment filters or clears the scoped storage key. */
export function persistStoredFilters(key: string | null, state: StoredFilterState): void {
  if (!key) return
  if (isEmptyStoredFilters(state)) {
    clearStoredFilters(key)
    return
  }
  writeStoredFilters(key, state)
}

/** Resolves a React state action against the current value. */
export function resolveStateAction<T>(action: React.SetStateAction<T>, current: T): T {
  return typeof action === "function"
    ? (action as (previous: T) => T)(current)
    : action
}

/**
 * Clear ALL tenant-scoped eq_filters keys from sessionStorage.
 * Called on logout from AppLayout (before provider unmounts).
 */
export function clearAllEquipmentFilters(): void {
  if (typeof window === "undefined") return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(EQUIPMENT_FILTER_STORAGE_KEY_PREFIX)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // Ignore storage errors
  }
}

function isEmptyStoredFilters(state: StoredFilterState): boolean {
  return (
    state.searchTerm === "" &&
    state.sorting.length === 0 &&
    state.columnFilters.length === 0
  )
}

function readStoredFilters(key: string): StoredFilterState | null {
  if (typeof window === "undefined") return null
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as StoredFilterState
    if (
      typeof parsed.searchTerm !== "string" ||
      !Array.isArray(parsed.sorting) ||
      !Array.isArray(parsed.columnFilters)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredFilters(key: string, state: StoredFilterState): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Ignore storage errors (quota, etc.)
  }
}

function clearStoredFilters(key: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}
