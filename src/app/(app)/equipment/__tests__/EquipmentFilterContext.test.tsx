"use client"

/**
 * Tests for EquipmentFilterContext — sessionStorage persistence
 * for equipment filter state across page navigation.
 *
 * TDD Cycle 1: Context creation + hydration
 * TDD Cycle 2: Persistence on filter change
 * TDD Cycle 3: Reset + clear on tenant change
 * TDD Cycle 4: Logout cleanup
 * TDD Cycle 5: SSR safety + error handling
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
})

// Mock next-auth/react
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

// Import after mocking
import {
  EquipmentFilterProvider,
  useEquipmentFilterContext,
  EQUIPMENT_FILTER_STORAGE_KEY,
} from '@/contexts/EquipmentFilterContext'

// =============================================================================
// Helpers
// =============================================================================

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <EquipmentFilterProvider>{children}</EquipmentFilterProvider>
  }
}

function createSessionMock(status: 'authenticated' | 'unauthenticated' | 'loading') {
  if (status === 'authenticated') {
    return {
      data: { user: { id: 1, name: 'Test User', role: 'user' } },
      status: 'authenticated' as const,
    }
  }
  return { data: null, status }
}

// =============================================================================
// TDD Cycle 1: Context creation + hydration from sessionStorage
// =============================================================================

describe('EquipmentFilterContext — Cycle 1: Creation + Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
    mockUseSession.mockReturnValue(createSessionMock('authenticated'))
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

  it('hydrates filter state from sessionStorage on mount', () => {
    const stored: { searchTerm: string; sorting: SortingState; columnFilters: ColumnFiltersState } = {
      searchTerm: 'máy thở',
      sorting: [{ id: 'ten_thiet_bi', desc: false }],
      columnFilters: [
        { id: 'tinh_trang_hien_tai', value: ['active'] },
      ],
    }
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(stored))

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
    mockSessionStorage.getItem.mockReturnValue('{{invalid json}}}')

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
})

// =============================================================================
// TDD Cycle 2: Persistence to sessionStorage on filter change
// =============================================================================

describe('EquipmentFilterContext — Cycle 2: Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
    mockUseSession.mockReturnValue(createSessionMock('authenticated'))
  })

  it('persists columnFilters to sessionStorage when changed', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setColumnFilters([
        { id: 'khoa_phong_quan_ly', value: ['Khoa Nội'] },
      ])
    })

    const stored = JSON.parse(
      mockSessionStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}'
    )
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

    const stored = JSON.parse(
      mockSessionStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}'
    )
    expect(stored.searchTerm).toBe('monitor')
  })

  it('persists sorting to sessionStorage when changed', () => {
    const { result } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setSorting([{ id: 'ten_thiet_bi', desc: true }])
    })

    const stored = JSON.parse(
      mockSessionStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}'
    )
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
    mockSessionStorage.getItem.mockReturnValue(null)
    mockUseSession.mockReturnValue(createSessionMock('authenticated'))
  })

  it('resetFilters clears state AND sessionStorage', () => {
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
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      EQUIPMENT_FILTER_STORAGE_KEY
    )
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
// TDD Cycle 4: Logout cleanup
// =============================================================================

describe('EquipmentFilterContext — Cycle 4: Logout Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  it('clears sessionStorage when auth status changes to unauthenticated', () => {
    // Start authenticated
    mockUseSession.mockReturnValue(createSessionMock('authenticated'))

    const { result, rerender } = renderHook(() => useEquipmentFilterContext(), {
      wrapper: createWrapper(),
    })

    // Set some filters
    act(() => {
      result.current.setSearchTerm('test filter')
    })

    // Simulate logout
    mockUseSession.mockReturnValue(createSessionMock('unauthenticated'))
    rerender()

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      EQUIPMENT_FILTER_STORAGE_KEY
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
    mockSessionStorage.getItem.mockReturnValue(null)
    mockUseSession.mockReturnValue(createSessionMock('authenticated'))
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
