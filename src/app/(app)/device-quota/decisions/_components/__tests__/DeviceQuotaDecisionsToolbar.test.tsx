import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { DeviceQuotaDecisionsToolbar } from '../DeviceQuotaDecisionsToolbar'
import { useDeviceQuotaDecisionsContext } from '../../_hooks/useDeviceQuotaDecisionsContext'
import type { ListFilterSearchCardProps } from '@/components/shared/ListFilterSearchCard'
import type { StatusFilter } from '../DeviceQuotaDecisionsContext'

vi.mock('../../_hooks/useDeviceQuotaDecisionsContext', () => ({
  useDeviceQuotaDecisionsContext: vi.fn(),
}))

vi.mock('@/components/shared/ListFilterSearchCard', () => ({
  ListFilterSearchCard: ({
    filterControls,
    actions,
  }: ListFilterSearchCardProps) => (
    <section data-testid="shared-decisions-toolbar">
      {filterControls}
      {actions}
    </section>
  ),
}))

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  interface SelectProps {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }

  interface SelectItemProps {
    value: string
    children: React.ReactNode
  }

  return {
    Select: ({ value, onValueChange, children }: SelectProps) => (
      <select
        aria-label="Trạng thái"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: SelectItemProps) => (
      <option value={value}>{children}</option>
    ),
  }
})

const mockUseContext = vi.mocked(useDeviceQuotaDecisionsContext)
type DecisionsContext = ReturnType<typeof useDeviceQuotaDecisionsContext>

const makeContext = (overrides: Partial<DecisionsContext> = {}): DecisionsContext => ({
  statusFilter: 'all',
  setStatusFilter: vi.fn(),
  openCreateDialog: vi.fn(),
  refetch: vi.fn(),
  isLoading: false,
  ...overrides,
} as unknown as DecisionsContext)

describe('DeviceQuotaDecisionsToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses shared filter layout and preserves toolbar callbacks', () => {
    const setStatusFilter = vi.fn()
    const refetch = vi.fn()
    const openCreateDialog = vi.fn()

    mockUseContext.mockReturnValue(makeContext({
      setStatusFilter,
      refetch,
      openCreateDialog,
    }))

    render(<DeviceQuotaDecisionsToolbar />)

    expect(screen.getByTestId('shared-decisions-toolbar')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Trạng thái' }), {
      target: { value: 'active' satisfies StatusFilter },
    })
    fireEvent.click(screen.getByRole('button', { name: /làm mới/i }))
    fireEvent.click(screen.getByRole('button', { name: /tạo quyết định/i }))

    expect(setStatusFilter).toHaveBeenCalledWith('active')
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })
})
