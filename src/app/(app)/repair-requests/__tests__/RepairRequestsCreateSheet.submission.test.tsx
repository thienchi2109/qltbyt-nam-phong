import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  closeAllDialogs: vi.fn(),
  createMutate: vi.fn(),
}))

const contextValue = {
  dialogState: {
    isCreateOpen: true,
    preSelectedEquipment: {
      id: 101,
      ma_thiet_bi: 'TB-001',
      ten_thiet_bi: 'Máy siêu âm A',
      khoa_phong_quan_ly: 'CDHA',
    },
  },
  closeAllDialogs: mocks.closeAllDialogs,
  createMutation: {
    mutate: mocks.createMutate,
    isPending: false,
  },
  user: { full_name: 'Test User', username: 'tester' },
  canSetRepairUnit: true,
  assistantDraft: null,
}

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => false,
}))

vi.mock('../_hooks/useRepairRequestsContext', () => ({
  useRepairRequestsContext: () => contextValue,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type = 'button', disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date | undefined) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date(2026, 2, 20))}>
      Pick calendar date
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { RepairRequestsCreateSheet } from '../_components/RepairRequestsCreateSheet'

describe('RepairRequestsCreateSheet submission regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the create-sheet submit payload and mutate path unchanged', async () => {
    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByLabelText('Thiết bị')).toHaveValue('Máy siêu âm A (TB-001)')
    })

    fireEvent.change(screen.getByLabelText('Mô tả sự cố'), {
      target: { value: 'Mất nguồn đột ngột' },
    })
    fireEvent.change(screen.getByLabelText('Các hạng mục yêu cầu sửa chữa (nếu có)'), {
      target: { value: 'Kiểm tra bo nguồn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pick calendar date' }))

    await waitFor(() => {
      expect(screen.getByText('20/03/2026')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))

    expect(mocks.createMutate).toHaveBeenCalledWith(
      {
        thiet_bi_id: 101,
        mo_ta_su_co: 'Mất nguồn đột ngột',
        hang_muc_sua_chua: 'Kiểm tra bo nguồn',
        ngay_mong_muon_hoan_thanh: '2026-03-20',
        nguoi_yeu_cau: 'Test User',
        don_vi_thuc_hien: 'noi_bo',
        ten_don_vi_thue: null,
      },
      { onSuccess: mocks.closeAllDialogs },
    )
  })

  it('allows submitting a repair request without repair items', async () => {
    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByLabelText('Thiết bị')).toHaveValue('Máy siêu âm A (TB-001)')
    })

    fireEvent.change(screen.getByLabelText('Mô tả sự cố'), {
      target: { value: 'Mất nguồn đột ngột' },
    })

    expect(screen.getByLabelText('Các hạng mục yêu cầu sửa chữa (nếu có)')).not.toBeRequired()

    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))

    expect(mocks.createMutate).toHaveBeenCalledWith(
      {
        thiet_bi_id: 101,
        mo_ta_su_co: 'Mất nguồn đột ngột',
        hang_muc_sua_chua: null,
        ngay_mong_muon_hoan_thanh: null,
        nguoi_yeu_cau: 'Test User',
        don_vi_thuc_hien: 'noi_bo',
        ten_don_vi_thue: null,
      },
      { onSuccess: mocks.closeAllDialogs },
    )
  })
})
