import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'

// Mock excel-utils
const mockExportToExcel = vi.fn()
const mockGenerateEquipmentImportTemplate = vi.fn()
vi.mock('@/lib/excel-utils', () => ({
  exportToExcel: (...args: any[]) => mockExportToExcel(...args),
  generateEquipmentImportTemplate: () => mockGenerateEquipmentImportTemplate(),
}))

// Mock print utils
const mockGenerateProfileSheet = vi.fn()
const mockGenerateDeviceLabel = vi.fn()
vi.mock('@/components/equipment/equipment-print-utils', () => ({
  generateProfileSheet: (...args: any[]) => mockGenerateProfileSheet(...args),
  generateDeviceLabel: (...args: any[]) => mockGenerateDeviceLabel(...args),
}))

// Mock useToast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Import after mocking
import { useEquipmentExport } from '../_hooks/useEquipmentExport'
import type { UseEquipmentExportParams } from '../_hooks/useEquipmentExport'

// Mock equipment data
const mockEquipmentList = [
  {
    id: 1,
    ma_thiet_bi: 'EQ-001',
    ten_thiet_bi: 'Test Equipment 1',
    model: 'Model A',
    serial: 'SN-001',
    don_vi: 5,
    khoa_phong_quan_ly: 'Khoa Nội',
    tinh_trang_hien_tai: 'Hoạt động',
    vi_tri_lap_dat: 'Phòng 101',
    nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
  },
  {
    id: 2,
    ma_thiet_bi: 'EQ-002',
    ten_thiet_bi: 'Test Equipment 2',
    model: 'Model B',
    serial: 'SN-002',
    don_vi: 5,
    khoa_phong_quan_ly: 'Khoa Ngoại',
    tinh_trang_hien_tai: 'Chờ sửa chữa',
    vi_tri_lap_dat: 'Phòng 102',
    nguoi_dang_truc_tiep_quan_ly: 'Trần Thị B',
  },
]

const mockTenantBranding = {
  id: 5,
  name: 'Test Hospital',
  code: 'TH',
  logo_url: 'https://example.com/logo.png',
}

const createDefaultParams = (overrides?: Partial<UseEquipmentExportParams>): UseEquipmentExportParams => ({
  data: mockEquipmentList as any,
  tenantBranding: mockTenantBranding as any,
  userRole: 'to_qltb',
  ...overrides,
})

describe('useEquipmentExport', () => {
  // Store originals before mocking
  const originalCreateElement = document.createElement.bind(document)
  const originalCreateObjectURL = global.URL.createObjectURL
  const originalRevokeObjectURL = global.URL.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
    global.URL.revokeObjectURL = vi.fn()
    // Mock document methods
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: vi.fn(),
        } as any
      }
      return originalCreateElement(tag)  // Use stored original, not the mocked function
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Restore URL methods manually since vi.restoreAllMocks doesn't cover direct assignments
    global.URL.createObjectURL = originalCreateObjectURL
    global.URL.revokeObjectURL = originalRevokeObjectURL
  })

  describe('handleDownloadTemplate', () => {
    it('should download template successfully', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      mockGenerateEquipmentImportTemplate.mockResolvedValueOnce(mockBlob)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleDownloadTemplate()
      })

      expect(mockGenerateEquipmentImportTemplate).toHaveBeenCalled()
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('should handle template download error', async () => {
      mockGenerateEquipmentImportTemplate.mockRejectedValueOnce(new Error('Template generation failed'))

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleDownloadTemplate()
      })

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải template. Vui lòng thử lại.',
      })
    })
  })

  describe('handleExportData', () => {
    it('should export data to Excel successfully', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockExportToExcel).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Xuất dữ liệu thành công',
        })
      )
    })

    it('should show error when no data to export', async () => {
      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ data: [] }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockExportToExcel).not.toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Không có dữ liệu',
        description: 'Không có dữ liệu phù hợp để xuất.',
      })
    })

    it('should handle export error', async () => {
      mockExportToExcel.mockRejectedValueOnce(new Error('Export failed'))

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xuất dữ liệu. Vui lòng thử lại.',
      })
    })

    it('should generate correct filename with date', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)
      const today = new Date().toISOString().slice(0, 10)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockExportToExcel).toHaveBeenCalledWith(
        expect.any(Array),
        `Danh_sach_thiet_bi_${today}.xlsx`,
        'Danh sách thiết bị',
        expect.any(Array)
      )
    })

    it('should format data correctly for export', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      const exportCall = mockExportToExcel.mock.calls[0]
      const formattedData = exportCall[0]

      // Should have same number of rows as data
      expect(formattedData).toHaveLength(2)

      // Each row should have column labels as keys
      expect(formattedData[0]).toHaveProperty('Mã thiết bị')
      expect(formattedData[0]).toHaveProperty('Tên thiết bị')
    })
  })

  describe('handleGenerateProfileSheet', () => {
    it('should generate profile sheet for equipment', async () => {
      mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
      const equipment = mockEquipmentList[0]

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleGenerateProfileSheet(equipment as any)
      })

      expect(mockGenerateProfileSheet).toHaveBeenCalledWith(
        equipment,
        expect.objectContaining({
          tenantBranding: mockTenantBranding,
          userRole: 'to_qltb',
          equipmentTenantId: 5,
        })
      )
    })

    it('should pass correct print context', async () => {
      mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
      const equipment = { ...mockEquipmentList[0], don_vi: 10 }

      const { result } = renderHook(() =>
        useEquipmentExport(
          createDefaultParams({
            userRole: 'global',
          })
        )
      )

      await act(async () => {
        await result.current.handleGenerateProfileSheet(equipment as any)
      })

      expect(mockGenerateProfileSheet).toHaveBeenCalledWith(
        equipment,
        expect.objectContaining({
          userRole: 'global',
          equipmentTenantId: 10,
        })
      )
    })

    it('should handle undefined don_vi', async () => {
      mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
      const equipment = { ...mockEquipmentList[0], don_vi: null }

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleGenerateProfileSheet(equipment as any)
      })

      expect(mockGenerateProfileSheet).toHaveBeenCalledWith(
        equipment,
        expect.objectContaining({
          equipmentTenantId: undefined,
        })
      )
    })
  })

  describe('handleGenerateDeviceLabel', () => {
    it('should generate device label for equipment', async () => {
      mockGenerateDeviceLabel.mockResolvedValueOnce(undefined)
      const equipment = mockEquipmentList[0]

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleGenerateDeviceLabel(equipment as any)
      })

      expect(mockGenerateDeviceLabel).toHaveBeenCalledWith(
        equipment,
        expect.objectContaining({
          tenantBranding: mockTenantBranding,
          userRole: 'to_qltb',
          equipmentTenantId: 5,
        })
      )
    })

    it('should work without tenant branding', async () => {
      mockGenerateDeviceLabel.mockResolvedValueOnce(undefined)
      const equipment = mockEquipmentList[0]

      const { result } = renderHook(() =>
        useEquipmentExport(
          createDefaultParams({
            tenantBranding: undefined,
          })
        )
      )

      await act(async () => {
        await result.current.handleGenerateDeviceLabel(equipment as any)
      })

      expect(mockGenerateDeviceLabel).toHaveBeenCalledWith(
        equipment,
        expect.objectContaining({
          tenantBranding: undefined,
        })
      )
    })
  })

  describe('Memoization', () => {
    it('should maintain stable handler references', () => {
      const { result, rerender } = renderHook(() => useEquipmentExport(createDefaultParams()))

      const initialHandlers = {
        handleDownloadTemplate: result.current.handleDownloadTemplate,
        handleExportData: result.current.handleExportData,
        handleGenerateProfileSheet: result.current.handleGenerateProfileSheet,
        handleGenerateDeviceLabel: result.current.handleGenerateDeviceLabel,
      }

      rerender()

      // Handlers should be stable (memoized) when params don't change
      expect(result.current.handleDownloadTemplate).toBe(initialHandlers.handleDownloadTemplate)
      expect(result.current.handleGenerateProfileSheet).toBe(initialHandlers.handleGenerateProfileSheet)
      expect(result.current.handleGenerateDeviceLabel).toBe(initialHandlers.handleGenerateDeviceLabel)
    })

    it('should update handlers when data changes', () => {
      const { result, rerender } = renderHook(
        ({ data }: { data: any[] }) => useEquipmentExport(createDefaultParams({ data })),
        { initialProps: { data: mockEquipmentList as any } }
      )

      const initialExportHandler = result.current.handleExportData

      rerender({ data: [mockEquipmentList[0]] as any })

      // handleExportData should change when data changes
      expect(result.current.handleExportData).not.toBe(initialExportHandler)
    })
  })

  describe('Edge Cases', () => {
    it('should handle equipment with null/undefined fields', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)
      const equipmentWithNulls = [
        {
          id: 1,
          ma_thiet_bi: 'EQ-001',
          ten_thiet_bi: 'Test',
          model: null,
          serial: undefined,
          don_vi: 5,
        },
      ]

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ data: equipmentWithNulls as any }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockExportToExcel).toHaveBeenCalled()
      // Should not throw error with null/undefined fields
    })

    it('should handle large dataset export', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        ma_thiet_bi: `EQ-${String(i + 1).padStart(4, '0')}`,
        ten_thiet_bi: `Equipment ${i + 1}`,
        don_vi: 5,
      }))

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ data: largeDataset as any }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockExportToExcel).toHaveBeenCalled()
      const exportCall = mockExportToExcel.mock.calls[0]
      expect(exportCall[0]).toHaveLength(1000)
    })
  })
})
