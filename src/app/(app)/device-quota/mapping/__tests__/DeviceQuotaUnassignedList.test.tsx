import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaUnassignedList } from '../_components/DeviceQuotaUnassignedList'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)

const makeContext = (overrides: Record<string, unknown> = {}) => ({
  unassignedEquipment: [],
  totalEquipmentCount: 0,
  selectedEquipmentIds: new Set<number>(),
  toggleEquipmentSelection: vi.fn(),
  selectAllEquipment: vi.fn(),
  clearEquipmentSelection: vi.fn(),
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
  },
  isLoading: false,
  isFacilitySelected: true,
  ...overrides,
})

describe('DeviceQuotaUnassignedList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows facility selection placeholder when no facility selected', () => {
    mockUseContext.mockReturnValue(makeContext({
      isFacilitySelected: false,
    }) as any)

    render(<DeviceQuotaUnassignedList />)

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
    }) as any)

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByText('Không có kết quả phù hợp')).toBeInTheDocument()
    expect(
      screen.queryByText('Tất cả thiết bị đã được phân loại vào các nhóm định mức.')
    ).not.toBeInTheDocument()
  })

  it('shows classified-empty state only when there is no active search/filter', () => {
    mockUseContext.mockReturnValue(makeContext() as any)

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByText('Hoàn thành phân loại')).toBeInTheDocument()
  })
})
