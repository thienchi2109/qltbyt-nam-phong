"use client"

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface DateRange {
  from: Date
  to: Date
}

export interface ReportInventoryFilters {
  dateRange: DateRange
  selectedDepartment: string
  searchTerm: string
}

const defaultFilters = (): ReportInventoryFilters => ({
  // Default: last 3 full months (approx) – callers can override
  dateRange: {
    from: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  },
  selectedDepartment: 'all',
  searchTerm: '',
})

function filtersKey(tenantKey: string) {
  return ['reports', 'inventory', 'filters', tenantKey] as const
}

function storageKey(tenantKey: string) {
  return `reports_inventory_filters_${tenantKey}`
}

function serializeFilters(filters: ReportInventoryFilters) {
  return JSON.stringify({
    ...filters,
    dateRange: {
      from: filters.dateRange.from?.toISOString() ?? null,
      to: filters.dateRange.to?.toISOString() ?? null,
    },
  })
}

function deserializeFilters(raw: string | null): ReportInventoryFilters | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const fromStr = parsed?.dateRange?.from
    const toStr = parsed?.dateRange?.to
    const from = fromStr ? new Date(fromStr) : undefined
    const to = toStr ? new Date(toStr) : undefined
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return null
    }
    return {
      dateRange: { from, to },
      selectedDepartment: typeof parsed?.selectedDepartment === 'string' ? parsed.selectedDepartment : 'all',
      searchTerm: typeof parsed?.searchTerm === 'string' ? parsed.searchTerm : '',
    }
  } catch {
    return null
  }
}

export function useReportInventoryFilters(tenantKey: string) {
  const queryClient = useQueryClient()
  const cacheKey = filtersKey(tenantKey)

  // Local reactive state so components re-render immediately when filters change
  const [filters, setFilters] = React.useState<ReportInventoryFilters>(() => {
    // Prefer cache → localStorage → default
    const cached = queryClient.getQueryData<ReportInventoryFilters>(cacheKey)
    if (cached) return cached
    if (typeof window !== 'undefined') {
      const saved = deserializeFilters(window.localStorage.getItem(storageKey(tenantKey)))
      if (saved) return saved
    }
    return defaultFilters()
  })

  // Keep cache in sync on mount/tenant change
  React.useEffect(() => {
    const cached = queryClient.getQueryData<ReportInventoryFilters>(cacheKey)
    if (cached) {
      setFilters(cached)
    } else {
      let initial = defaultFilters()
      if (typeof window !== 'undefined') {
        const saved = deserializeFilters(window.localStorage.getItem(storageKey(tenantKey)))
        if (saved) initial = saved
      }
      setFilters(initial)
      queryClient.setQueryData(cacheKey, initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantKey])

  const set = React.useCallback((next: ReportInventoryFilters) => {
    setFilters(next)
    queryClient.setQueryData(cacheKey, next)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey(tenantKey), serializeFilters(next))
      }
    } catch {}
  }, [cacheKey, queryClient, tenantKey])

  const setDateRange = (dateRange: DateRange) => set({ ...filters, dateRange })
  const setSelectedDepartment = (selectedDepartment: string) => set({ ...filters, selectedDepartment })
  const setSearchTerm = (searchTerm: string) => set({ ...filters, searchTerm })

  return { filters, setDateRange, setSelectedDepartment, setSearchTerm }
}


