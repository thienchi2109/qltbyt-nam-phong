import { describe, expect, it, vi, beforeEach } from 'vitest'

import { generateProfileSheet } from '@/components/equipment/equipment-print-utils'

describe('equipment-print-utils', () => {
  const mockWindow = {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
  } as unknown as Window

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'open').mockReturnValue(mockWindow)
  })

  it('includes Ngày ngừng sử dụng in the profile sheet output', async () => {
    await generateProfileSheet(
      {
        id: 1,
        ma_thiet_bi: 'EQ-001',
        ten_thiet_bi: 'Máy siêu âm',
        khoa_phong_quan_ly: 'Khoa Nội',
        ngay_ngung_su_dung: '2024-12-31',
      } as any,
      {
        tenantBranding: null,
        userRole: 'to_qltb',
        equipmentTenantId: 1,
      }
    )

    const writtenHtml = (mockWindow.document.write as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(writtenHtml).toContain('Ngày ngừng sử dụng')
    expect(writtenHtml).toContain('31/12/2024')
  })
})
