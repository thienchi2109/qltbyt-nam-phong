import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryToolbar } from '../_components/DeviceQuotaCategoryToolbar'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)

describe('DeviceQuotaCategoryToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens create dialog when clicking create button', () => {
    const openCreateDialog = vi.fn()

    mockUseContext.mockReturnValue({
      openCreateDialog,
      openImportDialog: vi.fn(),
      searchTerm: '',
      setSearchTerm: vi.fn(),
    } as any)

    render(<DeviceQuotaCategoryToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Tạo danh mục' }))

    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })

  it('renders search input', () => {
    mockUseContext.mockReturnValue({
      openCreateDialog: vi.fn(),
      openImportDialog: vi.fn(),
      searchTerm: '',
      setSearchTerm: vi.fn(),
    } as any)

    render(<DeviceQuotaCategoryToolbar />)

    expect(screen.getByPlaceholderText('Tìm theo mã, tên nhóm...')).toBeInTheDocument()
  })
})
