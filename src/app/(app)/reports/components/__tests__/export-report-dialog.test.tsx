import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockToast = vi.fn()
const mockCreateMultiSheetExcel = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@/lib/excel-utils', () => ({
  createMultiSheetExcel: (...args: unknown[]) => mockCreateMultiSheetExcel(...args),
}))

import { ExportReportDialog } from '../export-report-dialog'

describe('ExportReportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMultiSheetExcel.mockReset()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('surfaces string export errors in the destructive toast', async () => {
    mockCreateMultiSheetExcel.mockRejectedValueOnce('Không thể ghi file Excel')

    render(
      <ExportReportDialog
        open
        onOpenChange={vi.fn()}
        data={[
          {
            ngay_nhap: '2026-01-02',
            ma_thiet_bi: 'TB-001',
            ten_thiet_bi: 'Máy đo',
            model: null,
            serial: null,
            khoa_phong_quan_ly: 'Khoa A',
            type: 'import',
            source: 'manual',
            reason: null,
            destination: null,
            value: null,
          },
        ]}
        summary={{
          totalImported: 1,
          totalExported: 0,
          currentStock: 1,
          netChange: 1,
        }}
        dateRange={{
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-01-31T00:00:00.000Z'),
        }}
        department="all"
      />
    )

    const exportButton = await screen.findByRole('button', { name: /xuất excel/i })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockCreateMultiSheetExcel).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Lỗi xuất báo cáo',
        description: 'Không thể ghi file Excel',
      })
    })
  })
})
