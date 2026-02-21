import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaUnassignedList } from '../_components/DeviceQuotaUnassignedList'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)

describe('DeviceQuotaUnassignedList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows facility selection placeholder when no facility selected', () => {
    mockUseContext.mockReturnValue({
      unassignedEquipment: [],
      selectedEquipmentIds: new Set(),
      toggleEquipmentSelection: vi.fn(),
      selectAllEquipment: vi.fn(),
      clearEquipmentSelection: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
      isLoading: false,
      isFacilitySelected: false,
    } as any)

    render(<DeviceQuotaUnassignedList />)

    expect(screen.getByText('Chọn cơ sở')).toBeInTheDocument()
    expect(
      screen.queryByText('Tất cả thiết bị đã được phân loại vào các nhóm định mức.')
    ).not.toBeInTheDocument()
  })
})
