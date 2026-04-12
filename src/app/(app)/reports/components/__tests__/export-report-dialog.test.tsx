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

  it('keeps transaction statistics sorted by total descending in the export payload', async () => {
    mockCreateMultiSheetExcel.mockResolvedValueOnce(undefined)

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
          {
            ngay_nhap: '2026-01-03',
            ma_thiet_bi: 'TB-002',
            ten_thiet_bi: 'Máy siêu âm',
            model: null,
            serial: null,
            khoa_phong_quan_ly: 'Khoa B',
            type: 'import',
            source: 'manual',
            reason: null,
            destination: null,
            value: null,
          },
          {
            ngay_nhap: '2026-01-04',
            ma_thiet_bi: 'TB-003',
            ten_thiet_bi: 'Máy thở',
            model: null,
            serial: null,
            khoa_phong_quan_ly: 'Khoa A',
            type: 'export',
            source: 'manual',
            reason: 'Điều chuyển',
            destination: 'Kho B',
            value: null,
          },
        ]}
        summary={{
          totalImported: 2,
          totalExported: 1,
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

    fireEvent.click(await screen.findByRole('button', { name: /xuất excel/i }))

    await waitFor(() => {
      expect(mockCreateMultiSheetExcel).toHaveBeenCalled()
    })

    const [sheets] = mockCreateMultiSheetExcel.mock.calls[0] as [Array<{ name: string; data: unknown }>, string]
    const statsSheet = sheets.find((sheet) => sheet.name === 'Thống kê giao dịch')

    expect(statsSheet).toBeDefined()
    expect(statsSheet?.data).toEqual([
      { 'Khoa/Phòng': 'Khoa A', 'Nhập': 1, 'Xuất': 1, 'Tổng': 2 },
      { 'Khoa/Phòng': 'Khoa B', 'Nhập': 1, 'Xuất': 0, 'Tổng': 1 },
    ])
  })

  it('keeps the khac status in distribution export sheets', async () => {
    mockCreateMultiSheetExcel.mockResolvedValueOnce(undefined)

    render(
      <ExportReportDialog
        open
        onOpenChange={vi.fn()}
        data={[]}
        summary={{
          totalImported: 0,
          totalExported: 0,
          currentStock: 10,
          netChange: 0,
        }}
        dateRange={{
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-01-31T00:00:00.000Z'),
        }}
        department="all"
        distribution={{
          totalEquipment: 10,
          departments: ['Khoa A'],
          locations: ['Kho A'],
          byDepartment: [
            {
              name: 'Khoa A',
              total: 10,
              hoat_dong: 4,
              cho_sua_chua: 2,
              cho_bao_tri: 1,
              cho_hieu_chuan: 1,
              ngung_su_dung: 1,
              chua_co_nhu_cau: 0,
              khac: 1,
            },
          ],
          byLocation: [
            {
              name: 'Kho A',
              total: 10,
              hoat_dong: 4,
              cho_sua_chua: 2,
              cho_bao_tri: 1,
              cho_hieu_chuan: 1,
              ngung_su_dung: 1,
              chua_co_nhu_cau: 0,
              khac: 1,
            },
          ],
        }}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /xuất excel/i }))

    await waitFor(() => {
      expect(mockCreateMultiSheetExcel).toHaveBeenCalled()
    })

    const [sheets] = mockCreateMultiSheetExcel.mock.calls[0] as [Array<{ name: string; data: unknown }>, string]
    const overviewSheet = sheets.find((sheet) => sheet.name === 'Phân bố trạng thái')
    const byDepartmentSheet = sheets.find((sheet) => sheet.name === 'Trạng thái theo khoa')

    expect(overviewSheet?.data).toEqual(
      expect.arrayContaining([
        { 'Trạng thái': 'Khác', 'Số lượng': 1, 'Tỷ lệ (%)': 10 },
      ])
    )
    expect(byDepartmentSheet?.data).toEqual([
      {
        'Khoa/Phòng': 'Khoa A',
        'Hoạt động': 4,
        'Chờ sửa chữa': 2,
        'Chờ bảo trì': 1,
        'Chờ HC/KĐ': 1,
        'Ngừng sử dụng': 1,
        'Chưa có nhu cầu': 0,
        'Khác': 1,
        'Tổng': 10,
      },
    ])
  })

  it('adds repair cost summary rows to the maintenance export sheet without removing existing rows', async () => {
    mockCreateMultiSheetExcel.mockResolvedValueOnce(undefined)

    render(
      <ExportReportDialog
        open
        onOpenChange={vi.fn()}
        data={[]}
        summary={{
          totalImported: 0,
          totalExported: 0,
          currentStock: 0,
          netChange: 0,
        }}
        dateRange={{
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-01-31T00:00:00.000Z'),
        }}
        department="all"
        maintenanceStats={{
          repair_summary: {
            total_requests: 5,
            completed: 3,
            pending: 1,
            in_progress: 1,
            total_cost: 3500000,
            average_completed_cost: 1750000,
            cost_recorded_count: 2,
            cost_missing_count: 1,
          },
          maintenance_summary: {
            total_plans: 2,
            total_tasks: 10,
            completed_tasks: 6,
          },
        }}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /xuất excel/i }))

    await waitFor(() => {
      expect(mockCreateMultiSheetExcel).toHaveBeenCalled()
    })

    const [sheets] = mockCreateMultiSheetExcel.mock.calls[0] as [Array<{ name: string; data: Array<Record<string, unknown>> }>, string]
    const maintenanceSheet = sheets.find((sheet) => sheet.name === 'Sửa chữa - Tổng quan')

    expect(maintenanceSheet?.data).toEqual(
      expect.arrayContaining([
        { 'Chỉ số': 'Tổng YC sửa chữa', 'Giá trị': 5 },
        { 'Chỉ số': 'Tổng chi phí sửa chữa', 'Giá trị': 3500000 },
        { 'Chỉ số': 'Chi phí TB ca hoàn thành', 'Giá trị': 1750000 },
        { 'Chỉ số': 'Có ghi nhận chi phí', 'Giá trị': 2 },
        { 'Chỉ số': 'Thiếu chi phí', 'Giá trị': 1 },
      ])
    )
  })
})
