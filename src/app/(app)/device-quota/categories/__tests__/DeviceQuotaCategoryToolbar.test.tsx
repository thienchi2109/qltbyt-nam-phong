import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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
    } as any)

    render(<DeviceQuotaCategoryToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Tạo danh mục' }))

    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })
})
