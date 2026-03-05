import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUnassignedEquipmentFilters } from '../_hooks/useUnassignedEquipmentFilters'

describe('useUnassignedEquipmentFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with empty search and no filters', () => {
    const { result } = renderHook(() => useUnassignedEquipmentFilters())

    expect(result.current.searchTerm).toBe('')
    expect(result.current.debouncedSearch).toBe('')
    expect(result.current.selectedDepartments).toEqual([])
    expect(result.current.selectedUsers).toEqual([])
    expect(result.current.selectedLocations).toEqual([])
    expect(result.current.selectedFundingSources).toEqual([])
    expect(result.current.activeFilterCount).toBe(0)
    expect(result.current.hasActiveFilters).toBe(false)
  })

  it('updates searchTerm immediately and debouncedSearch after delay', () => {
    const { result } = renderHook(() => useUnassignedEquipmentFilters())

    act(() => {
      result.current.setSearchTerm('test')
    })

    expect(result.current.searchTerm).toBe('test')
    expect(result.current.debouncedSearch).toBe('')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.debouncedSearch).toBe('test')
  })

  it('counts active filters correctly', () => {
    const { result } = renderHook(() => useUnassignedEquipmentFilters())

    act(() => {
      result.current.setSelectedDepartments(['ICU'])
      result.current.setSelectedUsers(['Dr. A', 'Dr. B'])
    })

    expect(result.current.activeFilterCount).toBe(2)
    expect(result.current.hasActiveFilters).toBe(true)
  })

  it('resets all filters and search', () => {
    const { result } = renderHook(() => useUnassignedEquipmentFilters())

    act(() => {
      result.current.setSearchTerm('test')
      result.current.setSelectedDepartments(['ICU'])
      result.current.setSelectedLocations(['Room A'])
    })

    act(() => {
      result.current.resetAllFilters()
    })

    expect(result.current.searchTerm).toBe('')
    expect(result.current.selectedDepartments).toEqual([])
    expect(result.current.selectedLocations).toEqual([])
    expect(result.current.activeFilterCount).toBe(0)
  })
})
