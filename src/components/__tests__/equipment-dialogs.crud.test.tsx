import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocks
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
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

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
    ...props
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <select
      {...props}
      value={value ?? ''}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

// Imports after mocks
import { AddEquipmentDialog } from '../add-equipment-dialog'
import { callRpc } from '@/lib/rpc-client'

const mockCallRpc = vi.mocked(callRpc)

const resolveTestFilePath = (relativePath: string) => {
  const url = new URL(relativePath, import.meta.url)
  return url.protocol === 'file:' ? fileURLToPath(url) : fileURLToPath(new URL(`file://${url.pathname}`))
}

function fillRequiredAddFields() {
  fireEvent.change(screen.getByLabelText('Mã thiết bị'), {
    target: { value: 'EQ-100' },
  })
  fireEvent.change(screen.getByLabelText('Tên thiết bị'), {
    target: { value: 'Máy xét nghiệm' },
  })
  fireEvent.change(screen.getByLabelText(/Vị trí lắp đặt/), {
    target: { value: 'Phòng 101' },
  })
  fireEvent.change(screen.getByLabelText(/Khoa\/Phòng quản lý/), {
    target: { value: 'Khoa Nội' },
  })
  fireEvent.change(screen.getByLabelText(/Người trực tiếp quản lý/), {
    target: { value: 'Nguyễn Văn A' },
  })
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('Equipment Dialogs CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not keep the legacy edit-equipment-dialog shell or RPC helper on disk', () => {
    expect(fs.existsSync(resolveTestFilePath('../edit-equipment-dialog.tsx'))).toBe(false)
    expect(fs.existsSync(resolveTestFilePath('../edit-equipment-dialog.rpc.ts'))).toBe(false)
  })

  describe('Create: AddEquipmentDialog', () => {
    it('submits create payload and closes on success', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        if (fn === 'equipment_create') {
          return { id: 99 }
        }
        return []
      })

      const onOpenChange = vi.fn()
      const onSuccess = vi.fn()

      render(
        <AddEquipmentDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
        { wrapper: createWrapper() }
      )

      fillRequiredAddFields()

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Hoạt động' } })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: 'equipment_create',
          args: {
            p_payload: expect.objectContaining({
              ma_thiet_bi: 'EQ-100',
              ten_thiet_bi: 'Máy xét nghiệm',
              vi_tri_lap_dat: 'Phòng 101',
              khoa_phong_quan_ly: 'Khoa Nội',
              nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
              tinh_trang_hien_tai: 'Hoạt động',
            }),
          },
        })
      })

      expect(onSuccess).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('shows plain-object RPC errors instead of an empty add-equipment toast description', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        if (fn === 'equipment_create') {
          throw { message: 'Permission denied' }
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      fillRequiredAddFields()
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Hoạt động' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Lỗi',
            description: 'Không thể thêm thiết bị. Permission denied',
          })
        )
      })
    })

    it('blocks create for regional leader', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'regional_leader', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockResolvedValue([])

      const onOpenChange = vi.fn()
      const onSuccess = vi.fn()

      render(
        <AddEquipmentDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
        { wrapper: createWrapper() }
      )

      const saveButton = screen.getByRole('button', { name: 'Lưu' })
      expect(saveButton).toBeDisabled()

      fireEvent.click(saveButton)

      await waitFor(() => {
        const createCalls = mockCallRpc.mock.calls.filter(
          ([args]) => (args as { fn?: string })?.fn === 'equipment_create'
        )
        expect(createCalls).toHaveLength(0)
      })
    })

    it('blocks create for role user even if the dialog is opened directly', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'user', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        if (fn === 'equipment_create') {
          return { id: 99 }
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      fillRequiredAddFields()
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Hoạt động' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

      await waitFor(() => {
        const createCalls = mockCallRpc.mock.calls.filter(
          ([args]) => (args as { fn?: string })?.fn === 'equipment_create'
        )
        expect(createCalls).toHaveLength(0)
      })
    })

    it('auto-fills decommission date only after status transitions to Ngưng sử dụng', async () => {
      const dateNowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2026-03-24T17:30:00.000Z').getTime())

      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      const decommissionDateInput = screen.getByLabelText('Ngày ngừng sử dụng')
      const statusSelect = screen.getByRole('combobox')

      expect(decommissionDateInput).toHaveValue('')

      fireEvent.change(statusSelect, { target: { value: 'Hoạt động' } })
      expect(decommissionDateInput).toHaveValue('')

      fireEvent.change(statusSelect, { target: { value: 'Ngưng sử dụng' } })
      expect(decommissionDateInput).toHaveValue('25/03/2026')

      dateNowSpy.mockRestore()
    })

    it('shows a status validation error when decommission date is entered for a non-decommissioned status', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        if (fn === 'equipment_create') {
          return { id: 99 }
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      fillRequiredAddFields()
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Hoạt động' },
      })
      fireEvent.change(screen.getByLabelText('Ngày ngừng sử dụng'), {
        target: { value: '25/03/2026' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

      expect(
        await screen.findByText('Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"')
      ).toBeInTheDocument()
    })

    it('shows a chronological validation error when decommission date is before a full usage date', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        if (fn === 'equipment_create') {
          return { id: 99 }
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      fillRequiredAddFields()
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Ngưng sử dụng' },
      })
      fireEvent.change(screen.getByLabelText('Ngày đưa vào sử dụng'), {
        target: { value: '26/03/2026' },
      })
      fireEvent.change(screen.getByLabelText('Ngày ngừng sử dụng'), {
        target: { value: '25/03/2026' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

      expect(
        await screen.findByText('Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng')
      ).toBeInTheDocument()
    })

    it('shows the current tenant as a read-only field', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      expect(await screen.findByDisplayValue('Đơn vị 5 (DV5)')).toBeDisabled()
    })

    it('fills the department field when a department badge is clicked', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }, { name: 'Khoa Ngoại' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        return []
      })

      render(
        <AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      fireEvent.click(await screen.findByText('Khoa Ngoại'))

      expect(screen.getByLabelText(/Khoa\/Phòng quản lý/)).toHaveValue('Khoa Ngoại')
    })

    it('resets the form when the dialog closes and opens again', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'admin', don_vi: 5 } },
        status: 'authenticated',
      })
      mockCallRpc.mockImplementation(async ({ fn }) => {
        if (fn === 'departments_list') {
          return [{ name: 'Khoa Nội' }]
        }
        if (fn === 'tenant_list') {
          return [{ id: 5, code: 'DV5', name: 'Đơn vị 5' }]
        }
        return []
      })

      const onOpenChange = vi.fn()
      const view = render(
        <AddEquipmentDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      fireEvent.change(screen.getByLabelText('Tên thiết bị'), {
        target: { value: 'Thiết bị tạm' },
      })
      expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('Thiết bị tạm')

      view.rerender(
        <AddEquipmentDialog open={false} onOpenChange={onOpenChange} onSuccess={vi.fn()} />
      )
      view.rerender(
        <AddEquipmentDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('')
      })
    })
  })

})
