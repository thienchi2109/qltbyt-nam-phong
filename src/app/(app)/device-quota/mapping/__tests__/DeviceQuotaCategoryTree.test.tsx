import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryTree } from '../_components/DeviceQuotaCategoryTree'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)

describe('DeviceQuotaCategoryTree (mapping)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links empty state CTA to categories page', () => {
    mockUseContext.mockReturnValue({
      categories: [],
      selectedCategoryId: null,
      setSelectedCategory: vi.fn(),
      isLoading: false,
    } as any)

    render(<DeviceQuotaCategoryTree />)

    const link = screen.getByRole('link', { name: 'Tạo danh mục' })
    expect(link).toHaveAttribute('href', '/device-quota/categories')
  })
})
