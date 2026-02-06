import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaChiTietToolbar } from '../_components/DeviceQuotaChiTietToolbar'
import { useDeviceQuotaChiTietContext } from '../_hooks/useDeviceQuotaChiTietContext'

vi.mock('../_hooks/useDeviceQuotaChiTietContext', () => ({
  useDeviceQuotaChiTietContext: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const mockUseContext = vi.mocked(useDeviceQuotaChiTietContext)

describe('DeviceQuotaChiTietToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links alert CTA to categories page when no categories', () => {
    mockUseContext.mockReturnValue({
      decision: {
        trang_thai: 'draft',
        so_quyet_dinh: 'QD-01',
        ngay_ban_hanh: '2026-02-01',
        ngay_hieu_luc: '2026-02-02',
      },
      isDecisionLoading: false,
      leafCategories: [],
      isCategoriesLoading: false,
      openImportDialog: vi.fn(),
    } as any)

    render(<DeviceQuotaChiTietToolbar />)

    const link = screen.getByRole('link', { name: /tạo danh mục/i })
    expect(link).toHaveAttribute('href', '/device-quota/categories')
  })
})
