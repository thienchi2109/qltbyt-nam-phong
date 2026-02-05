import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryDialog } from '../_components/DeviceQuotaCategoryDialog'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => (
    <select value={value ?? ''} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)

describe('DeviceQuotaCategoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits create payload when in create mode', async () => {
    const createMutate = vi.fn()

    mockUseContext.mockReturnValue({
      dialogState: { mode: 'create' },
      closeDialog: vi.fn(),
      createMutation: { mutate: createMutate, isPending: false },
      updateMutation: { mutate: vi.fn(), isPending: false },
      categories: [],
      getDescendantIds: vi.fn(() => new Set()),
    } as any)

    render(<DeviceQuotaCategoryDialog />)

    fireEvent.change(screen.getByLabelText('Mã nhóm'), { target: { value: 'DM01' } })
    fireEvent.change(screen.getByLabelText('Tên nhóm'), { target: { value: 'Danh mục 1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ ma_nhom: 'DM01', ten_nhom: 'Danh mục 1' })
      )
    })
  })

  it('includes phan_loai options C and D', () => {
    mockUseContext.mockReturnValue({
      dialogState: { mode: 'create' },
      closeDialog: vi.fn(),
      createMutation: { mutate: vi.fn(), isPending: false },
      updateMutation: { mutate: vi.fn(), isPending: false },
      categories: [],
      getDescendantIds: vi.fn(() => new Set()),
    } as any)

    render(<DeviceQuotaCategoryDialog />)

    expect(screen.getByRole('option', { name: 'C' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'D' })).toBeInTheDocument()
  })
})
