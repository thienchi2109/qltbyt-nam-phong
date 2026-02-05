import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryDeleteDialog } from '../_components/DeviceQuotaCategoryDeleteDialog'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)

describe('DeviceQuotaCategoryDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls delete mutation when confirming', async () => {
    const deleteMutate = vi.fn()

    mockUseContext.mockReturnValue({
      categoryToDelete: { id: 10, ten_nhom: 'Nhóm 10' },
      closeDeleteDialog: vi.fn(),
      deleteMutation: { mutate: deleteMutate, isPending: false },
      mutatingCategoryId: null,
    } as any)

    render(<DeviceQuotaCategoryDeleteDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Xóa danh mục' }))

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith(10)
    })
  })
})
