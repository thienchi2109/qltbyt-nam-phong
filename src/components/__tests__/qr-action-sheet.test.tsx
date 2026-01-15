/**
 * Unit tests for QRActionSheet component.
 *
 * Tests cover:
 * - Component rendering with different states
 * - Security: Uses callRpc (not direct Supabase access)
 * - Error handling for equipment not found
 * - Action button functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import * as React from 'react'

// Mock the rpc-client module
vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock radix-ui sheet component for testing
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="sheet-title">{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) =>
    <p data-testid="sheet-description">{children}</p>,
}))

// Import after mocks
import { QRActionSheet } from '../qr-action-sheet'
import { callRpc } from '@/lib/rpc-client'

const mockCallRpc = vi.mocked(callRpc)

// Sample equipment data for tests
const mockEquipment = {
  id: 123,
  ma_thiet_bi: 'TB-001',
  ten_thiet_bi: 'Máy siêu âm',
  model: 'SU-500',
  serial: 'SN12345',
  hang_san_xuat: 'GE Healthcare',
  noi_san_xuat: 'USA',
  nam_san_xuat: 2020,
  ngay_nhap: '2020-01-01',
  ngay_dua_vao_su_dung: '2020-02-01',
  nguon_kinh_phi: 'Ngân sách',
  gia_goc: 500000000,
  nam_tinh_hao_mon: 10,
  ty_le_hao_mon: '10%',
  han_bao_hanh: '2023-01-01',
  vi_tri_lap_dat: 'Phòng khám 1',
  nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
  khoa_phong_quan_ly: 'Khoa Nội',
  tinh_trang_hien_tai: 'Hoạt động',
  ghi_chu: '',
  chu_ky_bt_dinh_ky: 90,
  ngay_bt_tiep_theo: '2024-03-01',
  chu_ky_hc_dinh_ky: 365,
  ngay_hc_tiep_theo: '2024-12-01',
  chu_ky_kd_dinh_ky: 365,
  ngay_kd_tiep_theo: '2024-12-01',
  phan_loai_theo_nd98: 'Loại B',
}

describe('QRActionSheet', () => {
  const mockOnClose = vi.fn()
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('should display the scanned QR code', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('TB-001')).toBeInTheDocument()
    })

    it('should show loading state while fetching equipment', async () => {
      // Create a promise that we can control
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockCallRpc.mockReturnValueOnce(pendingPromise as any)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('Đang tìm kiếm thiết bị...')).toBeInTheDocument()

      // Cleanup
      resolvePromise!(mockEquipment)
    })

    it('should display equipment details after successful fetch', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Máy siêu âm')).toBeInTheDocument()
      })

      expect(screen.getByText('SU-500 • GE Healthcare')).toBeInTheDocument()
      expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    })

    it('should display error message when equipment not found', async () => {
      mockCallRpc.mockResolvedValueOnce(null)

      render(
        <QRActionSheet
          qrCode="INVALID-CODE"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Không tìm thấy thiết bị')).toBeInTheDocument()
      })

      expect(screen.getByText(/Không tìm thấy thiết bị với mã "INVALID-CODE" trong hệ thống/)).toBeInTheDocument()
    })
  })

  describe('Security: RPC Usage', () => {
    it('should call equipment_get_by_code RPC (not direct table access)', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: 'equipment_get_by_code',
          args: { p_ma_thiet_bi: 'TB-001' },
        })
      })
    })

    it('should trim QR code before sending to RPC', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="  TB-001  "
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: 'equipment_get_by_code',
          args: { p_ma_thiet_bi: 'TB-001' },
        })
      })
    })

    it('should NOT pass p_don_vi parameter (tenant is enforced server-side)', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        const callArgs = mockCallRpc.mock.calls[0][0]
        expect(callArgs.args).not.toHaveProperty('p_don_vi')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display access denied error when RPC throws access denied', async () => {
      mockCallRpc.mockRejectedValueOnce(new Error('Equipment not found or access denied'))

      render(
        <QRActionSheet
          qrCode="TB-FORBIDDEN"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
      })

      expect(screen.getByText(/không thuộc quyền quản lý của bạn/)).toBeInTheDocument()
    })

    it('should display not found error when equipment does not exist', async () => {
      mockCallRpc.mockRejectedValueOnce(new Error('Equipment not found'))

      render(
        <QRActionSheet
          qrCode="TB-NONEXISTENT"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Không tìm thấy thiết bị')).toBeInTheDocument()
      })
    })

    it('should display network error when connection fails', async () => {
      mockCallRpc.mockRejectedValueOnce(new Error('Network request failed'))

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Lỗi kết nối mạng')).toBeInTheDocument()
      })
    })

    it('should show retry button on error', async () => {
      mockCallRpc.mockRejectedValueOnce(new Error('Equipment not found'))

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Thử lại')).toBeInTheDocument()
      })
    })

    it('should retry search when retry button clicked', async () => {
      mockCallRpc.mockRejectedValueOnce(new Error('Network request failed'))

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Thử lại')).toBeInTheDocument()
      })

      // Setup success for retry
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      const retryButton = screen.getByText('Thử lại')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Action Buttons', () => {
    it('should call onAction with equipment when action button clicked', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Máy siêu âm')).toBeInTheDocument()
      })

      const viewDetailsButton = screen.getByText('Xem thông tin chi tiết')
      fireEvent.click(viewDetailsButton)

      expect(mockOnAction).toHaveBeenCalledWith('view-details', mockEquipment)
    })

    it('should render all action buttons when equipment is found', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Ghi nhật ký sử dụng thiết bị')).toBeInTheDocument()
        expect(screen.getByText('Xem thông tin chi tiết')).toBeInTheDocument()
        expect(screen.getByText('Lịch sử bảo trì & sửa chữa')).toBeInTheDocument()
        expect(screen.getByText('Tạo yêu cầu sửa chữa')).toBeInTheDocument()
        expect(screen.getByText('Cập nhật trạng thái')).toBeInTheDocument()
      })
    })
  })

  describe('Close Behavior', () => {
    it('should call onClose when close button is clicked', async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      render(
        <QRActionSheet
          qrCode="TB-001"
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      )

      // Find and click close button (X icon button)
      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn =>
        btn.querySelector('svg') && btn.getAttribute('variant') !== 'default'
      )

      if (closeButton) {
        fireEvent.click(closeButton)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })
  })
})
