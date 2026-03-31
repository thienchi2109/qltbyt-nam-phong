import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Equipment } from '@/types/database'

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
import { EditEquipmentDialog } from '../edit-equipment-dialog'
import { callRpc } from '@/lib/rpc-client'

const mockCallRpc = vi.mocked(callRpc)

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

  describe('Update: EditEquipmentDialog', () => {
    it('resets dirty form values when the same equipment record is reopened', async () => {
      const equipment: Equipment = {
        id: 4,
        ma_thiet_bi: 'EQ-004',
        ten_thiet_bi: 'Máy điện tim',
        vi_tri_lap_dat: 'Phòng 301',
        khoa_phong_quan_ly: 'Khoa Tim mạch',
        nguoi_dang_truc_tiep_quan_ly: 'Ngô Văn E',
        tinh_trang_hien_tai: 'Hoạt động',
      }

      const view = render(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      const nameInput = await screen.findByLabelText('Tên thiết bị')
      expect(nameInput).toHaveValue('Máy điện tim')

      fireEvent.change(nameInput, {
        target: { value: 'Thiết bị đã sửa tạm' },
      })
      expect(nameInput).toHaveValue('Thiết bị đã sửa tạm')

      view.rerender(
        <EditEquipmentDialog
          open={false}
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />
      )
      view.rerender(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('Máy điện tim')
      })
    })

    it('clears stale form values when reopened without an equipment record', async () => {
      const equipment: Equipment = {
        id: 5,
        ma_thiet_bi: 'EQ-005',
        ten_thiet_bi: 'Máy thở',
        vi_tri_lap_dat: 'Phòng 401',
        khoa_phong_quan_ly: 'ICU',
        nguoi_dang_truc_tiep_quan_ly: 'Đỗ Văn F',
        tinh_trang_hien_tai: 'Hoạt động',
      }

      const view = render(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      const nameInput = await screen.findByLabelText('Tên thiết bị')
      expect(nameInput).toHaveValue('Máy thở')

      fireEvent.change(nameInput, {
        target: { value: 'Giá trị bẩn' },
      })
      expect(nameInput).toHaveValue('Giá trị bẩn')

      view.rerender(
        <EditEquipmentDialog
          open={false}
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={null}
        />
      )
      view.rerender(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={null}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('')
      })
    })

    it('submits update patch and closes on success', async () => {
      mockCallRpc.mockResolvedValue({})

      const onOpenChange = vi.fn()
      const onSuccess = vi.fn()

      const equipment: Equipment = {
        id: 1,
        ma_thiet_bi: 'EQ-001',
        ten_thiet_bi: 'Máy siêu âm',
        vi_tri_lap_dat: 'Phòng 202',
        khoa_phong_quan_ly: 'Khoa Tim',
        nguoi_dang_truc_tiep_quan_ly: 'Trần Văn B',
        tinh_trang_hien_tai: 'Hoạt động',
      }

      render(
        <EditEquipmentDialog
          open
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('Máy siêu âm')
      })

      fireEvent.change(screen.getByLabelText('Tên thiết bị'), {
        target: { value: 'Máy siêu âm A' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: 'equipment_update',
          args: {
            p_id: 1,
            p_patch: expect.objectContaining({
              ten_thiet_bi: 'Máy siêu âm A',
            }),
          },
        })
      })

      expect(onSuccess).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('shows plain-object RPC errors instead of an empty edit-equipment toast description', async () => {
      mockCallRpc.mockRejectedValueOnce({ message: 'Permission denied' })

      const equipment: Equipment = {
        id: 1,
        ma_thiet_bi: 'EQ-001',
        ten_thiet_bi: 'Máy siêu âm',
        vi_tri_lap_dat: 'Phòng 202',
        khoa_phong_quan_ly: 'Khoa Tim',
        nguoi_dang_truc_tiep_quan_ly: 'Trần Văn B',
        tinh_trang_hien_tai: 'Hoạt động',
      }

      render(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('Máy siêu âm')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Lỗi',
            description: 'Không thể cập nhật thiết bị. Permission denied',
          })
        )
      })
    })

    it('does not auto-fill on initial load and preserves a manual decommission date across status toggles', async () => {
      mockCallRpc.mockResolvedValue({})

      const onOpenChange = vi.fn()
      const onSuccess = vi.fn()

      const equipment: Equipment = {
        id: 1,
        ma_thiet_bi: 'EQ-001',
        ten_thiet_bi: 'Máy siêu âm',
        vi_tri_lap_dat: 'Phòng 202',
        khoa_phong_quan_ly: 'Khoa Tim',
        nguoi_dang_truc_tiep_quan_ly: 'Trần Văn B',
        tinh_trang_hien_tai: 'Ngưng sử dụng',
        ngay_ngung_su_dung: null,
      }

      render(
        <EditEquipmentDialog
          open
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      const decommissionDateInput = await screen.findByLabelText('Ngày ngừng sử dụng')
      expect(decommissionDateInput).toHaveValue('')

      fireEvent.change(decommissionDateInput, {
        target: { value: '24/03/2026' },
      })

      const statusSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(statusSelect, { target: { value: 'Hoạt động' } })
      fireEvent.change(statusSelect, { target: { value: 'Ngưng sử dụng' } })

      expect(decommissionDateInput).toHaveValue('24/03/2026')

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: 'equipment_update',
          args: {
            p_id: 1,
            p_patch: expect.objectContaining({
              ngay_ngung_su_dung: '2026-03-24',
            }),
          },
        })
      })
    })

    it('requires the user to choose a supported status when the persisted value is invalid', async () => {
      const equipment: Equipment = {
        id: 2,
        ma_thiet_bi: 'EQ-002',
        ten_thiet_bi: 'Monitor',
        vi_tri_lap_dat: 'Phòng 201',
        khoa_phong_quan_ly: 'Khoa Cấp cứu',
        nguoi_dang_truc_tiep_quan_ly: 'Lê Văn C',
        tinh_trang_hien_tai: 'Trạng thái cũ không hợp lệ',
      }

      render(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('Monitor')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

      await waitFor(() => {
        expect(screen.getByText('Tình trạng hiện tại là bắt buộc')).toBeInTheDocument()
      })

      expect(mockCallRpc).not.toHaveBeenCalledWith(
        expect.objectContaining({ fn: 'equipment_update' })
      )
    })

    it('still requires status selection when the persisted status is missing', async () => {
      const equipment: Equipment = {
        id: 3,
        ma_thiet_bi: 'EQ-003',
        ten_thiet_bi: 'Ventilator',
        vi_tri_lap_dat: 'Phòng 202',
        khoa_phong_quan_ly: 'ICU',
        nguoi_dang_truc_tiep_quan_ly: 'Phạm Văn D',
        tinh_trang_hien_tai: null,
      }

      render(
        <EditEquipmentDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          equipment={equipment}
        />,
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Tên thiết bị')).toHaveValue('Ventilator')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

      await waitFor(() => {
        expect(screen.getByText('Tình trạng hiện tại là bắt buộc')).toBeInTheDocument()
      })

      expect(mockCallRpc).not.toHaveBeenCalledWith(
        expect.objectContaining({ fn: 'equipment_update' })
      )
    })
  })
})
