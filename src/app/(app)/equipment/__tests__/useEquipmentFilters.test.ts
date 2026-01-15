import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEquipmentFilters } from '../_hooks/useEquipmentFilters'

// Mock the debounce hook
vi.mock('@/hooks/use-debounce', () => ({
  useSearchDebounce: (value: string) => value, // Return immediately for tests
}))

describe('useEquipmentFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with empty search term', () => {
      const { result } = renderHook(() => useEquipmentFilters())
      expect(result.current.searchTerm).toBe('')
    })

    it('should initialize with empty sorting', () => {
      const { result } = renderHook(() => useEquipmentFilters())
      expect(result.current.sorting).toEqual([])
    })

    it('should initialize with empty column filters', () => {
      const { result } = renderHook(() => useEquipmentFilters())
      expect(result.current.columnFilters).toEqual([])
    })

    it('should default sortParam to id.asc when no sorting', () => {
      const { result } = renderHook(() => useEquipmentFilters())
      expect(result.current.sortParam).toBe('id.asc')
    })

    it('should initialize all selected filter arrays as empty', () => {
      const { result } = renderHook(() => useEquipmentFilters())
      expect(result.current.selectedDepartments).toEqual([])
      expect(result.current.selectedUsers).toEqual([])
      expect(result.current.selectedLocations).toEqual([])
      expect(result.current.selectedStatuses).toEqual([])
      expect(result.current.selectedClassifications).toEqual([])
    })
  })

  describe('Search Functionality', () => {
    it('should update searchTerm when setSearchTerm is called', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setSearchTerm('test search')
      })

      expect(result.current.searchTerm).toBe('test search')
    })

    it('should provide debouncedSearch value', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setSearchTerm('debounced test')
      })

      // With our mock, debounced value equals immediate value
      expect(result.current.debouncedSearch).toBe('debounced test')
    })
  })

  describe('Sorting Functionality', () => {
    it('should update sorting state', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setSorting([{ id: 'name', desc: false }])
      })

      expect(result.current.sorting).toEqual([{ id: 'name', desc: false }])
    })

    it('should generate correct sortParam for ascending', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setSorting([{ id: 'ten_thiet_bi', desc: false }])
      })

      expect(result.current.sortParam).toBe('ten_thiet_bi.asc')
    })

    it('should generate correct sortParam for descending', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setSorting([{ id: 'ngay_mua', desc: true }])
      })

      expect(result.current.sortParam).toBe('ngay_mua.desc')
    })

    it('should use first sort column when multiple exist', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setSorting([
          { id: 'name', desc: true },
          { id: 'date', desc: false },
        ])
      })

      expect(result.current.sortParam).toBe('name.desc')
    })
  })

  describe('Column Filters', () => {
    it('should update column filters', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      const filters = [
        { id: 'tinh_trang_hien_tai', value: ['Đang hoạt động'] },
      ]

      act(() => {
        result.current.setColumnFilters(filters)
      })

      expect(result.current.columnFilters).toEqual(filters)
    })

    it('should extract selectedStatuses from column filters', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setColumnFilters([
          { id: 'tinh_trang_hien_tai', value: ['Đang hoạt động', 'Hỏng'] },
        ])
      })

      expect(result.current.selectedStatuses).toEqual(['Đang hoạt động', 'Hỏng'])
    })

    it('should extract selectedDepartments from column filters', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setColumnFilters([
          { id: 'khoa_phong_quan_ly', value: ['Khoa Nội', 'Khoa Ngoại'] },
        ])
      })

      expect(result.current.selectedDepartments).toEqual(['Khoa Nội', 'Khoa Ngoại'])
    })

    it('should extract selectedUsers from column filters', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setColumnFilters([
          { id: 'nguoi_dang_truc_tiep_quan_ly', value: ['Nguyễn Văn A'] },
        ])
      })

      expect(result.current.selectedUsers).toEqual(['Nguyễn Văn A'])
    })

    it('should extract selectedClassifications from column filters', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setColumnFilters([
          { id: 'phan_loai_theo_nd98', value: ['Loại A', 'Loại B'] },
        ])
      })

      expect(result.current.selectedClassifications).toEqual(['Loại A', 'Loại B'])
    })

    it('should handle multiple filter types simultaneously', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setColumnFilters([
          { id: 'tinh_trang_hien_tai', value: ['Đang hoạt động'] },
          { id: 'khoa_phong_quan_ly', value: ['Khoa Nội'] },
          { id: 'phan_loai_theo_nd98', value: ['Loại A'] },
        ])
      })

      expect(result.current.selectedStatuses).toEqual(['Đang hoạt động'])
      expect(result.current.selectedDepartments).toEqual(['Khoa Nội'])
      expect(result.current.selectedClassifications).toEqual(['Loại A'])
    })

    it('should return empty array for non-existent filter', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      act(() => {
        result.current.setColumnFilters([
          { id: 'tinh_trang_hien_tai', value: ['Đang hoạt động'] },
        ])
      })

      // Departments filter not set, should be empty
      expect(result.current.selectedDepartments).toEqual([])
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all filters when resetFilters is called', () => {
      const { result } = renderHook(() => useEquipmentFilters())

      // Set some values first
      act(() => {
        result.current.setSearchTerm('test')
        result.current.setColumnFilters([
          { id: 'tinh_trang_hien_tai', value: ['Đang hoạt động'] },
        ])
      })

      expect(result.current.searchTerm).toBe('test')
      expect(result.current.columnFilters).toHaveLength(1)

      // Reset
      act(() => {
        result.current.resetFilters()
      })

      expect(result.current.searchTerm).toBe('')
      expect(result.current.columnFilters).toEqual([])
    })
  })

  describe('Memoization', () => {
    it('should maintain stable references for setters', () => {
      const { result, rerender } = renderHook(() => useEquipmentFilters())

      const initialSetSearchTerm = result.current.setSearchTerm
      const initialSetSorting = result.current.setSorting
      const initialSetColumnFilters = result.current.setColumnFilters
      const initialResetFilters = result.current.resetFilters

      rerender()

      expect(result.current.setSearchTerm).toBe(initialSetSearchTerm)
      expect(result.current.setSorting).toBe(initialSetSorting)
      expect(result.current.setColumnFilters).toBe(initialSetColumnFilters)
      expect(result.current.resetFilters).toBe(initialResetFilters)
    })
  })
})
