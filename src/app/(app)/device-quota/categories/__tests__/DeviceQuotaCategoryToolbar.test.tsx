import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryToolbar } from '../_components/DeviceQuotaCategoryToolbar'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'
import type { ListFilterSearchCardProps } from '@/components/shared/ListFilterSearchCard'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock('@/components/shared/ListFilterSearchCard', () => ({
  ListFilterSearchCard: ({
    searchValue,
    onSearchChange,
    searchPlaceholder,
    actions,
  }: ListFilterSearchCardProps) => (
    <section data-testid="shared-category-toolbar">
      {typeof searchPlaceholder === 'string' && typeof onSearchChange === 'function' ? (
        <input
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
      {actions}
    </section>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)
type CategoryContext = ReturnType<typeof useDeviceQuotaCategoryContext>

const makeContext = (overrides: Partial<CategoryContext> = {}): CategoryContext => ({
  openCreateDialog: vi.fn(),
  openImportDialog: vi.fn(),
  searchTerm: '',
  setSearchTerm: vi.fn(),
  ...overrides,
} as unknown as CategoryContext)

describe('DeviceQuotaCategoryToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens create dialog when clicking create button', () => {
    const openCreateDialog = vi.fn()

    mockUseContext.mockReturnValue(makeContext({
      openCreateDialog,
    }))

    render(<DeviceQuotaCategoryToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Tạo danh mục' }))

    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })

  it('renders search input', () => {
    mockUseContext.mockReturnValue(makeContext())

    render(<DeviceQuotaCategoryToolbar />)

    expect(screen.getByPlaceholderText('Tìm theo mã, tên nhóm...')).toBeInTheDocument()
  })

  it('uses shared search layout and preserves toolbar callbacks', () => {
    const openImportDialog = vi.fn()
    const setSearchTerm = vi.fn()

    mockUseContext.mockReturnValue(makeContext({
      openImportDialog,
      setSearchTerm,
    }))

    render(<DeviceQuotaCategoryToolbar />)

    expect(screen.getByTestId('shared-category-toolbar')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm theo mã, tên nhóm...' }), {
      target: { value: 'x-quang' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nhập từ Excel' }))

    expect(setSearchTerm).toHaveBeenCalledWith('x-quang')
    expect(openImportDialog).toHaveBeenCalledTimes(1)
  })
})
