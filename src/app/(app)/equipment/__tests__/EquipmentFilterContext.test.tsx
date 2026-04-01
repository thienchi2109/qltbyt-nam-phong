"use client"

/**
 * Tests for EquipmentFilterContext — sessionStorage persistence
 * for equipment filter state across page navigation.
 *
 * TDD Cycle 1: Context creation + hydration
 * TDD Cycle 2: Persistence on filter change
 * TDD Cycle 3: Reset + clear on tenant change
 * TDD Cycle 4: Logout cleanup (via clearAllEquipmentFilters)
 * TDD Cycle 5: Memoized filter arrays
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table'

// =============================================================================
// Mocks
// =============================================================================

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    _store: store,
    _reset: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
})

// Mock TenantSelectionContext (EquipmentFilterProvider now uses useTenantSelection)
const mockSelectedFacilityId = { current: 42 as number | null | undefined }
vi.mock('@/contexts/TenantSelectionContext', () => ({
  useTenantSelection: () => ({
    selectedFacilityId: mockSelectedFacilityId.current,
    setSelectedFacilityId: vi.fn(),
    facilities: [],
    showSelector: false,
    isLoading: false,
    shouldFetchData: true,
  }),
  TenantSelectionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Import after mocking
import {
  EquipmentFilterProvider,
  useEquipmentFilterContext,
  EQUIPMENT_FILTER_STORAGE_KEY_PREFIX,
  clearAllEquipmentFilters,
} from '@/contexts/EquipmentFilterContext'

// =============================================================================
// Helpers
// =============================================================================

/** Storage key for the test tenant (facilityId=42) */
const TEST_STORAGE_KEY = `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_42`

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <EquipmentFilterProvider>{children}</EquipmentFilterProvider>
  }
}

// =============================================================================
// TDD Cycle 1: Context creation + hydration from sessionStorage
// =============================================================================

describe('EquipmentFilterContext — Cycle 1: Creation + Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSelectedFacilityId.current = 42
  })

  it('provides default filter state when no sessionStorage data exists', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    expect(result.current.searchTerm).toBe('')
    expect(result.current.sorting).toEqual([])
    expect(result.current.columnFilters).toEqual([])
    expect(result.current.debouncedSearch).toBeDefined()
  })

  it('hydrates filter state from tenant-scoped sessionStorage on mount', () => {
    const stored: { searchTerm: string; sorting: SortingState; columnFilters: ColumnFiltersState } = {
      searchTerm: 'máy thở',
      sorting: [{ id: 'ten_thiet_bi', desc: false }],
      columnFilters: [
        { id: 'tinh_trang_hien_tai', value: ['active'] },
      ],
    }
    mockSessionStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(stored))

    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    expect(result.current.searchTerm).toBe('máy thở')
    expect(result.current.sorting).toEqual([{ id: 'ten_thiet_bi', desc: false }])
    expect(result.current.columnFilters).toEqual([
      { id: 'tinh_trang_hien_tai', value: ['active'] },
    ])
  })

  it('handles corrupted sessionStorage data gracefully', () => {
    mockSessionStorage.setItem(TEST_STORAGE_KEY, '{{invalid json}}}')

    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    // Should fall back to defaults, not crash
    expect(result.current.searchTerm).toBe('')
    expect(result.current.sorting).toEqual([])
    expect(result.current.columnFilters).toEqual([])
  })

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useEquipmentFilterContext())
    }).toThrow('useEquipmentFilterContext must be used within EquipmentFilterProvider')

    consoleSpy.mockRestore()
  })

  it('uses tenant-scoped storage key (not global)', () => {
    const stored = { searchTerm: 'test', sorting: [], columnFilters: [] }
    // Put data under wrong key — should NOT be hydrated
    mockSessionStorage.setItem(`${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_99`, JSON.stringify(stored))

    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    // Facility 42 has no stored data → defaults
    expect(result.current.searchTerm).toBe('')
  })

  it('rehydrates from the new tenant key without writing stale previous-tenant state', async () => {
    const tenant42Key = `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_42`
    const tenant99Key = `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_99`

    mockSessionStorage.setItem(
      tenant42Key,
      JSON.stringify({ searchTerm: 'tenant-42', sorting: [], columnFilters: [] })
    )
    mockSessionStorage.setItem(
      tenant99Key,
      JSON.stringify({ searchTerm: 'tenant-99', sorting: [], columnFilters: [] })
    )

    const { result, rerender } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    expect(result.current.searchTerm).toBe('tenant-42')

    mockSessionStorage.setItem.mockClear()

    act(() => {
      mockSelectedFacilityId.current = 99
    })
    rerender()

    await waitFor(() => {
      expect(result.current.searchTerm).toBe('tenant-99')
    })

    const writesToTenant99 = mockSessionStorage.setItem.mock.calls
      .filter((call: [string, string]) => call[0] === tenant99Key)
      .map((call: [string, string]) => JSON.parse(call[1]) as { searchTerm?: string })

    expect(writesToTenant99.map((entry) => entry.searchTerm)).not.toContain('tenant-42')
  })

  it('treats unresolved tenant state separately from explicit all-facilities selection', async () => {
    const allTenantKey = `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_all`
    mockSelectedFacilityId.current = undefined

    mockSessionStorage.setItem(
      allTenantKey,
      JSON.stringify({ searchTerm: 'all-facilities', sorting: [], columnFilters: [] })
    )

    const { result, rerender } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    expect(result.current.searchTerm).toBe('')

    mockSessionStorage.setItem.mockClear()

    act(() => {
      result.current.setSearchTerm('draft-before-selection')
    })

    const writesToAllBeforeSelection = mockSessionStorage.setItem.mock.calls.filter(
      (call: [string, string]) => call[0] === allTenantKey
    )
    expect(writesToAllBeforeSelection).toHaveLength(0)

    act(() => {
      mockSelectedFacilityId.current = null
    })
    rerender()

    await waitFor(() => {
      expect(result.current.searchTerm).toBe('all-facilities')
    })
  })
})

// =============================================================================
// TDD Cycle 2: Persistence to sessionStorage on filter change
// =============================================================================

describe('EquipmentFilterContext — Cycle 2: Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSelectedFacilityId.current = 42
  })

  it('persists columnFilters to tenant-scoped sessionStorage', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setColumnFilters([
        { id: 'khoa_phong_quan_ly', value: ['Khoa Nội'] },
      ])
    })

    // Find the last setItem call with the correct key
    const calls = mockSessionStorage.setItem.mock.calls.filter(
      (c: [string, string]) => c[0] === TEST_STORAGE_KEY
    )
    const stored = JSON.parse(calls.at(-1)?.[1] ?? '{}')
    expect(stored.columnFilters).toEqual([
      { id: 'khoa_phong_quan_ly', value: ['Khoa Nội'] },
    ])
  })

  it('persists searchTerm to sessionStorage when changed', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setSearchTerm('monitor')
    })

    const calls = mockSessionStorage.setItem.mock.calls.filter(
      (c: [string, string]) => c[0] === TEST_STORAGE_KEY
    )
    const stored = JSON.parse(calls.at(-1)?.[1] ?? '{}')
    expect(stored.searchTerm).toBe('monitor')
  })

  it('persists sorting to sessionStorage when changed', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setSorting([{ id: 'ten_thiet_bi', desc: true }])
    })

    const calls = mockSessionStorage.setItem.mock.calls.filter(
      (c: [string, string]) => c[0] === TEST_STORAGE_KEY
    )
    const stored = JSON.parse(calls.at(-1)?.[1] ?? '{}')
    expect(stored.sorting).toEqual([{ id: 'ten_thiet_bi', desc: true }])
  })
})

// =============================================================================
// TDD Cycle 3: Reset + clear sessionStorage
// =============================================================================

describe('EquipmentFilterContext — Cycle 3: Reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSelectedFacilityId.current = 42
  })

  it('resetFilters clears state AND sessionStorage for current tenant', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    // Set some filters first
    act(() => {
      result.current.setSearchTerm('test')
      result.current.setColumnFilters([
        { id: 'tinh_trang_hien_tai', value: ['active'] },
      ])
    })

    // Reset
    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.searchTerm).toBe('')
    expect(result.current.columnFilters).toEqual([])
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(TEST_STORAGE_KEY)
  })

  it('resetFilters does not recreate empty storage payload after clearing', async () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setSearchTerm('persist-me')
    })

    mockSessionStorage.setItem.mockClear()
    mockSessionStorage.removeItem.mockClear()

    act(() => {
      result.current.resetFilters()
    })

    await waitFor(() => {
      expect(result.current.searchTerm).toBe('')
    })

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(TEST_STORAGE_KEY)
    const recreatedWrites = mockSessionStorage.setItem.mock.calls.filter(
      (call: [string, string]) => call[0] === TEST_STORAGE_KEY
    )
    expect(recreatedWrites).toHaveLength(0)
  })

  it('resetFilters returns all memoized filter arrays to empty', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    // Set filters
    act(() => {
      result.current.setColumnFilters([
        { id: 'khoa_phong_quan_ly', value: ['Khoa A'] },
        { id: 'tinh_trang_hien_tai', value: ['active', 'maintenance'] },
      ])
    })

    expect(result.current.selectedDepartments).toEqual(['Khoa A'])
    expect(result.current.selectedStatuses).toEqual(['active', 'maintenance'])

    // Reset
    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.selectedDepartments).toEqual([])
    expect(result.current.selectedStatuses).toEqual([])
    expect(result.current.selectedUsers).toEqual([])
    expect(result.current.selectedLocations).toEqual([])
  })
})

// =============================================================================
// TDD Cycle 4: Logout cleanup (clearAllEquipmentFilters)
// =============================================================================

describe('EquipmentFilterContext — Cycle 4: Logout Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSelectedFacilityId.current = 42
  })

  it('clearAllEquipmentFilters removes all tenant-scoped eq_filters keys', () => {
    // Simulate multiple tenants' stored filters
    mockSessionStorage.setItem(
      `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_42`,
      JSON.stringify({ searchTerm: 'a', sorting: [], columnFilters: [] })
    )
    mockSessionStorage.setItem(
      `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_99`,
      JSON.stringify({ searchTerm: 'b', sorting: [], columnFilters: [] })
    )
    mockSessionStorage.setItem(
      `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_all`,
      JSON.stringify({ searchTerm: 'c', sorting: [], columnFilters: [] })
    )
    // Other unrelated key should be preserved
    mockSessionStorage.setItem('selectedFacilityId', '42')

    vi.clearAllMocks() // clear setItem/removeItem call counts

    clearAllEquipmentFilters()

    // All eq_filters keys removed
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_42`
    )
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_99`
    )
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      `${EQUIPMENT_FILTER_STORAGE_KEY_PREFIX}_all`
    )
    // Unrelated key NOT removed
    expect(mockSessionStorage.removeItem).not.toHaveBeenCalledWith(
      'selectedFacilityId'
    )
  })
})

// =============================================================================
// TDD Cycle 5: Memoized filter arrays (behavioral parity with useEquipmentFilters)
// =============================================================================

describe('EquipmentFilterContext — Cycle 5: Memoized Filter Arrays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSelectedFacilityId.current = 42
  })

  it('extracts selectedDepartments from columnFilters', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setColumnFilters([
        { id: 'khoa_phong_quan_ly', value: ['Khoa Nội', 'Khoa Ngoại'] },
      ])
    })

    expect(result.current.selectedDepartments).toEqual(['Khoa Nội', 'Khoa Ngoại'])
  })

  it('extracts selectedStatuses from columnFilters', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setColumnFilters([
        { id: 'tinh_trang_hien_tai', value: ['active', 'broken'] },
      ])
    })

    expect(result.current.selectedStatuses).toEqual(['active', 'broken'])
  })

  it('returns empty arrays when no matching filter exists', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    expect(result.current.selectedDepartments).toEqual([])
    expect(result.current.selectedUsers).toEqual([])
    expect(result.current.selectedLocations).toEqual([])
    expect(result.current.selectedStatuses).toEqual([])
    expect(result.current.selectedClassifications).toEqual([])
    expect(result.current.selectedFundingSources).toEqual([])
  })

  it('ignores malformed non-array filter payloads when deriving selected filters', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setColumnFilters([
        { id: 'khoa_phong_quan_ly', value: 'not-an-array' as unknown as string[] },
      ])
    })

    expect(result.current.selectedDepartments).toEqual([])
  })

  it('provides stable sortParam derived from sorting state', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    // Default: empty sorting → "id.asc"
    expect(result.current.sortParam).toBe('id.asc')

    act(() => {
      result.current.setSorting([{ id: 'ten_thiet_bi', desc: true }])
    })

    expect(result.current.sortParam).toBe('ten_thiet_bi.desc')
  })
})
