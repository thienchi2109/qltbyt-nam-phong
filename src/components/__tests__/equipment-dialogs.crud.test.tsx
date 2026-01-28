import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
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
import { EditEquipmentDialog } from '../edit-equipment-dialog'
import { callRpc } from '@/lib/rpc-client'

const mockCallRpc = vi.mocked(callRpc)

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
  })

  describe('Update: EditEquipmentDialog', () => {
    it('submits update patch and closes on success', async () => {
      mockCallRpc.mockResolvedValue({})

      const onOpenChange = vi.fn()
      const onSuccess = vi.fn()

      const equipment = {
        id: 1,
        ma_thiet_bi: 'EQ-001',
        ten_thiet_bi: 'Máy siêu âm',
        vi_tri_lap_dat: 'Phòng 202',
        khoa_phong_quan_ly: 'Khoa Tim',
        nguoi_dang_truc_tiep_quan_ly: 'Trần Văn B',
        tinh_trang_hien_tai: 'Hoạt động',
      } as any

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
  })
})
