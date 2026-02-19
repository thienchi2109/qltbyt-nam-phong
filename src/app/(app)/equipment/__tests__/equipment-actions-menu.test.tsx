import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'

const state = vi.hoisted(() => ({
  role: 'user',
  isGlobal: false,
  isRegionalLeader: false,
  isDeleting: false,
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  openDetailDialog: vi.fn(),
  openStartUsageDialog: vi.fn(),
  openEndUsageDialog: vi.fn(),
  deleteMutate: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock('@/app/(app)/equipment/_hooks/useEquipmentContext', () => ({
  useEquipmentContext: () => ({
    user: {
      id: 1,
      role: state.role,
    },
    isGlobal: state.isGlobal,
    isRegionalLeader: state.isRegionalLeader,
    openDetailDialog: mocks.openDetailDialog,
    openStartUsageDialog: mocks.openStartUsageDialog,
    openEndUsageDialog: mocks.openEndUsageDialog,
  }),
}))

vi.mock('@/hooks/use-cached-equipment', () => ({
  useDeleteEquipment: () => ({
    mutate: mocks.deleteMutate,
    isPending: state.isDeleting,
  }),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  buttonVariants: () => '',
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled, title }: any) => (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.preventDefault = vi.fn()
        onSelect?.(e)
      }}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

import { EquipmentActionsMenu } from '../../../../components/equipment/equipment-actions-menu'

function setRole(role: string) {
  state.role = role
  state.isGlobal = role === 'global' || role === 'admin'
  state.isRegionalLeader = role === 'regional_leader'
}

function renderMenu() {
  return render(
    <EquipmentActionsMenu
      equipment={{ id: 101, ten_thiet_bi: 'TB Test' } as any}
      activeUsageLogs={[]}
      isLoadingActiveUsage={false}
    />
  )
}

describe('EquipmentActionsMenu delete action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.role = 'user'
    state.isGlobal = false
    state.isRegionalLeader = false
    state.isDeleting = false
  })

  it('shows Xóa Thiết bị for global role', () => {
    setRole('global')
    renderMenu()

    expect(screen.getByText('Xóa Thiết bị')).toBeInTheDocument()
  })

  it('shows Xóa Thiết bị for to_qltb role', () => {
    setRole('to_qltb')
    renderMenu()

    expect(screen.getByText('Xóa Thiết bị')).toBeInTheDocument()
  })

  it('hides Xóa Thiết bị for regional_leader role', () => {
    setRole('regional_leader')
    renderMenu()

    expect(screen.queryByText('Xóa Thiết bị')).not.toBeInTheDocument()
  })

  it('hides Xóa Thiết bị for user role', () => {
    setRole('user')
    renderMenu()

    expect(screen.queryByText('Xóa Thiết bị')).not.toBeInTheDocument()
  })

  it('calls delete mutation when confirming delete', () => {
    setRole('to_qltb')
    renderMenu()

    // Open dialog
    fireEvent.click(screen.getByText('Xóa Thiết bị'))

    // Check dialog content
    expect(screen.getByText('Bạn có chắc chắn muốn xóa thiết bị này không?')).toBeInTheDocument()

    // Click confirm
    fireEvent.click(screen.getByText('Xóa', { selector: 'button' }))

    expect(mocks.deleteMutate).toHaveBeenCalledWith('101', expect.anything())
  })

  it('does not call delete mutation when canceling delete', () => {
    setRole('to_qltb')
    renderMenu()

    // Open dialog
    fireEvent.click(screen.getByText('Xóa Thiết bị'))

    // Click cancel
    fireEvent.click(screen.getByText('Hủy'))

    expect(mocks.deleteMutate).not.toHaveBeenCalled()
  })
})
