import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryTree } from '../_components/DeviceQuotaCategoryTree'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)

describe('DeviceQuotaCategoryTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state and triggers create dialog', () => {
    const openCreateDialog = vi.fn()

    mockUseContext.mockReturnValue({
      categories: [],
      isLoading: false,
      openCreateDialog,
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as any)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Chưa có danh mục nào')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tạo danh mục' }))
    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })

  it('renders category items', () => {
    mockUseContext.mockReturnValue({
      categories: [
        { id: 1, parent_id: null, ma_nhom: '01', ten_nhom: 'Nhóm 1', level: 1, so_luong_hien_co: 0 },
        { id: 2, parent_id: 1, ma_nhom: '01.01', ten_nhom: 'Nhóm 1.1', level: 2, so_luong_hien_co: 0 },
      ],
      isLoading: false,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as any)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Nhóm 1')).toBeInTheDocument()
    expect(screen.getByText('Nhóm 1.1')).toBeInTheDocument()
  })
})
