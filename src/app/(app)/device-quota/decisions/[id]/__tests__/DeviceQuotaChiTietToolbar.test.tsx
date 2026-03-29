import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaChiTietToolbar } from '../_components/DeviceQuotaChiTietToolbar'
import { useDeviceQuotaChiTietContext } from '../_hooks/useDeviceQuotaChiTietContext'

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  generateDeviceQuotaImportTemplate: vi.fn(),
}))

vi.mock('../_hooks/useDeviceQuotaChiTietContext', () => ({
  useDeviceQuotaChiTietContext: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock('@/lib/device-quota-excel', () => ({
  generateDeviceQuotaImportTemplate: mocks.generateDeviceQuotaImportTemplate,
}))

const mockUseContext = vi.mocked(useDeviceQuotaChiTietContext)
const mockGenerateDeviceQuotaImportTemplate = vi.mocked(mocks.generateDeviceQuotaImportTemplate)

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    decision: {
      trang_thai: 'draft',
      so_quyet_dinh: 'QD-01',
      ngay_ban_hanh: '2026-02-01',
      ngay_hieu_luc: '2026-02-02',
    },
    isDecisionLoading: false,
    leafCategories: [
      { id: 1, ma_nhom: '01.01', ten_nhom: 'Máy X quang', don_vi_tinh: 'Máy' },
    ],
    isCategoriesLoading: false,
    openImportDialog: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useDeviceQuotaChiTietContext>
}

describe('DeviceQuotaChiTietToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links alert CTA to categories page when no categories', () => {
    mockUseContext.mockReturnValue(
      createMockContext({ leafCategories: [] })
    )

    render(<DeviceQuotaChiTietToolbar />)

    const link = screen.getByRole('link', { name: /tạo danh mục/i })
    expect(link).toHaveAttribute('href', '/device-quota/categories')
  })

  describe('import buttons visibility by decision status', () => {
    it('shows download and import buttons for draft decisions', () => {
      mockUseContext.mockReturnValue(
        createMockContext({ decision: { trang_thai: 'draft', so_quyet_dinh: 'QD-01', ngay_ban_hanh: '2026-02-01', ngay_hieu_luc: '2026-02-02' } })
      )

      render(<DeviceQuotaChiTietToolbar />)

      expect(screen.getByRole('button', { name: /tải xuống file mẫu excel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /nhập định mức từ file excel/i })).toBeInTheDocument()
    })

    it('shows download and import buttons for active decisions', () => {
      mockUseContext.mockReturnValue(
        createMockContext({ decision: { trang_thai: 'active', so_quyet_dinh: '289/QĐ-SYT', ngay_ban_hanh: '2026-02-27', ngay_hieu_luc: '2026-02-27' } })
      )

      render(<DeviceQuotaChiTietToolbar />)

      expect(screen.getByRole('button', { name: /tải xuống file mẫu excel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /nhập định mức từ file excel/i })).toBeInTheDocument()
    })

    it('hides download and import buttons for inactive decisions', () => {
      mockUseContext.mockReturnValue(
        createMockContext({ decision: { trang_thai: 'inactive', so_quyet_dinh: 'QD-OLD', ngay_ban_hanh: '2025-01-01', ngay_hieu_luc: '2025-01-02' } })
      )

      render(<DeviceQuotaChiTietToolbar />)

      expect(screen.queryByRole('button', { name: /tải xuống file mẫu excel/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /nhập định mức từ file excel/i })).not.toBeInTheDocument()
    })
  })

  it('toasts the plain-object template download error message', async () => {
    mockUseContext.mockReturnValue(createMockContext())
    mockGenerateDeviceQuotaImportTemplate.mockRejectedValueOnce({ message: 'Không thể tạo biểu mẫu' })

    render(<DeviceQuotaChiTietToolbar />)

    fireEvent.click(screen.getByRole('button', { name: /tải xuống file mẫu excel/i }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Không thể tạo file mẫu. Không thể tạo biểu mẫu',
        })
      )
    })
  })

  describe('status badge display', () => {
    it('shows "Đang hiệu lực" badge for active decisions', () => {
      mockUseContext.mockReturnValue(
        createMockContext({ decision: { trang_thai: 'active', so_quyet_dinh: '289/QĐ-SYT', ngay_ban_hanh: '2026-02-27', ngay_hieu_luc: '2026-02-27' } })
      )

      render(<DeviceQuotaChiTietToolbar />)

      expect(screen.getByText('Đang hiệu lực')).toBeInTheDocument()
    })

    it('shows "Bản nháp" badge for draft decisions', () => {
      mockUseContext.mockReturnValue(
        createMockContext({ decision: { trang_thai: 'draft', so_quyet_dinh: 'QD-01', ngay_ban_hanh: '2026-02-01', ngay_hieu_luc: '2026-02-02' } })
      )

      render(<DeviceQuotaChiTietToolbar />)

      expect(screen.getByText('Bản nháp')).toBeInTheDocument()
    })
  })
})
