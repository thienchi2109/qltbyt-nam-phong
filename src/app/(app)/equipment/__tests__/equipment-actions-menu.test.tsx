import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

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
      onClick={() => onSelect?.()}
    >
      {children}
    </button>
  ),
}))

import { EquipmentActionsMenu } from '@/components/equipment/equipment-actions-menu'

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

  it('shows Xóa TB for global role', () => {
    setRole('global')
    renderMenu()

    expect(screen.getByText('Xóa TB')).toBeInTheDocument()
  })

  it('shows Xóa TB for to_qltb role', () => {
    setRole('to_qltb')
    renderMenu()

    expect(screen.getByText('Xóa TB')).toBeInTheDocument()
  })

  it('hides Xóa TB for regional_leader role', () => {
    setRole('regional_leader')
    renderMenu()

    expect(screen.queryByText('Xóa TB')).not.toBeInTheDocument()
  })

  it('hides Xóa TB for user role', () => {
    setRole('user')
    renderMenu()

    expect(screen.queryByText('Xóa TB')).not.toBeInTheDocument()
  })

  it('calls delete mutation when confirming Xóa TB', () => {
    setRole('to_qltb')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderMenu()
    fireEvent.click(screen.getByText('Xóa TB'))

    expect(confirmSpy).toHaveBeenCalled()
    expect(mocks.deleteMutate).toHaveBeenCalledWith('101')
  })

  it('does not call delete mutation when canceling Xóa TB', () => {
    setRole('to_qltb')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderMenu()
    fireEvent.click(screen.getByText('Xóa TB'))

    expect(confirmSpy).toHaveBeenCalled()
    expect(mocks.deleteMutate).not.toHaveBeenCalled()
  })
})
