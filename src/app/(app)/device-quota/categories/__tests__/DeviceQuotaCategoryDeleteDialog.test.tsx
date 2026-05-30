import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { CategoryListItem } from '../_types/categories'
import { DeviceQuotaCategoryDeleteDialog } from '../_components/DeviceQuotaCategoryDeleteDialog'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { readonly className?: string }) => (
    <svg aria-hidden="true" className={className} data-testid="pending-spinner" />
  ),
}))

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly children: React.ReactNode
  }) =>
    open ? (
      <div data-testid="alert-dialog">
        <button type="button" onClick={() => onOpenChange(false)}>
          mock close
        </button>
        {children}
      </div>
    ) : null,
  AlertDialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    readonly children: React.ReactNode
    readonly disabled?: boolean
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    className,
    disabled,
    onClick,
  }: {
    readonly children: React.ReactNode
    readonly className?: string
    readonly disabled?: boolean
    readonly onClick?: () => void
  }) => (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)

const categoryToDelete: CategoryListItem = {
  id: 10,
  parent_id: null,
  ma_nhom: 'VT',
  ten_nhom: 'Nhóm 10',
  phan_loai: 'A',
  don_vi_tinh: 'cái',
  thu_tu_hien_thi: 1,
  level: 0,
  so_luong_hien_co: 0,
  so_luong_toi_da: null,
  so_luong_toi_thieu: null,
  mo_ta: null,
}

function setupContext({
  isPending = false,
  mutatingCategoryId = null,
}: {
  readonly isPending?: boolean
  readonly mutatingCategoryId?: number | null
} = {}) {
  const closeDeleteDialog = vi.fn()
  const deleteMutate = vi.fn()

  mockUseContext.mockReturnValue({
    categoryToDelete,
    closeDeleteDialog,
    deleteMutation: {
      mutate: deleteMutate,
      isPending,
    },
    mutatingCategoryId,
  } as ReturnType<typeof useDeviceQuotaCategoryContext>)

  return { closeDeleteDialog, deleteMutate }
}

describe('DeviceQuotaCategoryDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls delete mutation when confirming', async () => {
    const { deleteMutate } = setupContext()

    render(<DeviceQuotaCategoryDeleteDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Xóa danh mục' }))

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith(10)
    })
  })

  it('forwards close changes to close the delete dialog', () => {
    const { closeDeleteDialog } = setupContext()

    render(<DeviceQuotaCategoryDeleteDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'mock close' }))

    expect(closeDeleteDialog).toHaveBeenCalledTimes(1)
  })

  it('disables actions while the delete mutation is pending', () => {
    setupContext({ isPending: true })

    render(<DeviceQuotaCategoryDeleteDialog />)

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Xóa danh mục' })).toBeDisabled()
    expect(screen.getByTestId('pending-spinner')).toHaveClass('animate-spin')
  })

  it('disables actions while the selected category is mutating', () => {
    setupContext({ mutatingCategoryId: 10 })

    render(<DeviceQuotaCategoryDeleteDialog />)

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Xóa danh mục' })).toBeDisabled()
    expect(screen.getByTestId('pending-spinner')).toHaveClass('animate-spin')
  })
})
