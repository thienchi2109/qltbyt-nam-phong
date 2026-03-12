import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryTree } from '../_components/DeviceQuotaCategoryTree'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)

const makeContext = (overrides: Record<string, unknown> = {}) => ({
  categories: [],
  allCategories: [],
  selectedCategoryId: null,
  setSelectedCategory: vi.fn(),
  categorySearchTerm: '',
  setCategorySearchTerm: vi.fn(),
  isLoading: false,
  ...overrides,
})

describe('DeviceQuotaCategoryTree (mapping)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links empty state CTA to categories page', () => {
    mockUseContext.mockReturnValue(makeContext() as any)

    render(<DeviceQuotaCategoryTree />)

    const link = screen.getByRole('link', { name: 'Tạo danh mục' })
    expect(link).toHaveAttribute('href', '/device-quota/categories')
  })

  it('shows no-results state when search has no matching categories', () => {
    mockUseContext.mockReturnValue(makeContext({
      allCategories: [
        { id: 1, parent_id: null, ma_nhom: 'A', ten_nhom: 'Alpha', phan_loai: null, level: 1, so_luong_hien_co: 0 },
      ],
      categories: [],
      categorySearchTerm: 'zzzzz',
    }) as any)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Không tìm thấy danh mục phù hợp')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tạo danh mục' })).not.toBeInTheDocument()
  })
})
