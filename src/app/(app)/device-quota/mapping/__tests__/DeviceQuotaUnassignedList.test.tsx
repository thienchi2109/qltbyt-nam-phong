import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaUnassignedList } from '../_components/DeviceQuotaUnassignedList'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'
import type { ListFilterSearchCardProps } from '@/components/shared/ListFilterSearchCard'
import type { FacetedMultiSelectFilterProps } from '@/components/shared/table-filters/FacetedMultiSelectFilter'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

vi.mock('@/components/shared/ListFilterSearchCard', () => ({
  ListFilterSearchCard: ({
    searchValue,
    onSearchChange,
    searchPlaceholder,
    searchDisabled,
    filterControls,
  }: ListFilterSearchCardProps) => (
    <section data-testid="shared-filter-search-card">
      {typeof searchPlaceholder === 'string' && typeof onSearchChange === 'function' ? (
        <input
          aria-label={searchPlaceholder}
          disabled={searchDisabled}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
      {filterControls}
    </section>
  ),
}))

vi.mock('@/components/shared/table-filters/FacetedMultiSelectFilter', () => ({
  FacetedMultiSelectFilter: <TData, TValue,>({
    title,
    options,
    value,
    onChange,
  }: FacetedMultiSelectFilterProps<TData, TValue>) => (
    <button
      type="button"
      onClick={() => onChange([...(value ?? []), options[0]?.value as TValue].filter(Boolean))}
    >
      {title}
    </button>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)
type MappingContext = ReturnType<typeof useDeviceQuotaMappingContext>

const makeContext = (overrides: Partial<MappingContext> = {}): MappingContext => ({
  user: null,
  donViId: 1,
  allCategories: [],
  categories: [],
  unassignedEquipment: [],
  totalEquipmentCount: 0,
  selectedEquipmentIds: new Set<number>(),
  toggleEquipmentSelection: vi.fn(),
  selectAllEquipment: vi.fn(),
  deselectPageEquipment: vi.fn(),
  clearEquipmentSelection: vi.fn(),
  selectedCategoryId: null,
  setSelectedCategory: vi.fn(),
  filters: {
    searchTerm: '',
    setSearchTerm: vi.fn(),
    debouncedSearch: '',
    selectedDepartments: [],
    setSelectedDepartments: vi.fn(),
    selectedUsers: [],
    setSelectedUsers: vi.fn(),
    selectedLocations: [],
    setSelectedLocations: vi.fn(),
    selectedFundingSources: [],
    setSelectedFundingSources: vi.fn(),
    activeFilterCount: 0,
    hasActiveFilters: false,
    resetAllFilters: vi.fn(),
  },
  filterOptions: {
    departments: [],
    users: [],
    locations: [],
    fundingSources: [],
  },
  pagination: {
    pagination: { pageIndex: 0, pageSize: 20 },
    pageCount: 1,
    canPreviousPage: false,
    canNextPage: false,
    setPagination: vi.fn(),
  } as unknown as MappingContext['pagination'],
  categorySearchTerm: '',
  setCategorySearchTerm: vi.fn(),
  linkEquipment: {} as unknown as MappingContext['linkEquipment'],
  isLoading: false,
  isLinking: false,
  isFacilitySelected: true,
  refetch: vi.fn(),
  ...overrides,
})

describe('DeviceQuotaUnassignedList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows facility selection placeholder when no facility selected', () => {
    mockUseContext.mockReturnValue(makeContext({
      isFacilitySelected: false,
    }))

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByTestId('shared-filter-search-card')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Chọn cơ sở để tìm kiếm...' })).toBeDisabled()
    expect(screen.getByText('Chọn cơ sở')).toBeInTheDocument()
    expect(
      screen.queryByText('Tất cả thiết bị đã được phân loại vào các nhóm định mức.')
    ).not.toBeInTheDocument()
  })

  it('shows no-results state when search/filters are active and no equipment matches', () => {
    mockUseContext.mockReturnValue(makeContext({
      filters: {
        ...makeContext().filters,
        debouncedSearch: 'zzz',
      },
    }))

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByText('Không có kết quả phù hợp')).toBeInTheDocument()
    expect(
      screen.queryByText('Tất cả thiết bị đã được phân loại vào các nhóm định mức.')
    ).not.toBeInTheDocument()
  })

  it('shows classified-empty state only when there is no active search/filter', () => {
    mockUseContext.mockReturnValue(makeContext())

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByText('Hoàn thành phân loại')).toBeInTheDocument()
  })

  it('uses shared search and faceted filters without changing existing callbacks', () => {
    const setSearchTerm = vi.fn()
    const setSelectedDepartments = vi.fn()

    mockUseContext.mockReturnValue(makeContext({
      filters: {
        ...makeContext().filters,
        setSearchTerm,
        selectedDepartments: [],
        setSelectedDepartments,
      },
      filterOptions: {
        departments: ['Khoa cấp cứu'],
        users: [],
        locations: [],
        fundingSources: [],
      },
    }))

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByTestId('shared-filter-search-card')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm thiết bị...' }), {
      target: { value: 'máy thở' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Khoa/Phòng' }))

    expect(setSearchTerm).toHaveBeenCalledWith('máy thở')
    expect(setSelectedDepartments).toHaveBeenCalledWith(['Khoa cấp cứu'])
  })

  it('exposes each equipment row as a single keyboard-toggle button', () => {
    const toggleEquipmentSelection = vi.fn()

    mockUseContext.mockReturnValue(makeContext({
      unassignedEquipment: [
        {
          id: 10,
          ma_thiet_bi: 'TB-010',
          ten_thiet_bi: 'Máy thở',
          model: 'MT-01',
          serial: 'SER-01',
          hang_san_xuat: null,
          khoa_phong_quan_ly: 'Khoa hồi sức',
          tinh_trang: null,
        },
      ],
      totalEquipmentCount: 1,
      toggleEquipmentSelection,
    }))

    render(<DeviceQuotaUnassignedList />)

    const rowButton = screen.getByRole('button', { name: /Máy thở/i })
    expect(rowButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)

    fireEvent.click(rowButton)

    expect(toggleEquipmentSelection).toHaveBeenCalledTimes(1)
    expect(toggleEquipmentSelection).toHaveBeenCalledWith(10)
  })
})
