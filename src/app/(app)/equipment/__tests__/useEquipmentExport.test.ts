import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'

// Mock excel-utils
const mockExportToExcel = vi.fn()
const mockGenerateEquipmentImportTemplate = vi.fn()
vi.mock('@/lib/excel-utils', () => ({
  exportToExcel: (...args: unknown[]) => mockExportToExcel(...args),
  generateEquipmentImportTemplate: () => mockGenerateEquipmentImportTemplate(),
}))

// Mock print utils
const mockGenerateProfileSheet = vi.fn()
const mockGenerateDeviceLabel = vi.fn()
vi.mock('@/components/equipment/equipment-print-utils', () => ({
  generateProfileSheet: (...args: unknown[]) => mockGenerateProfileSheet(...args),
  generateDeviceLabel: (...args: unknown[]) => mockGenerateDeviceLabel(...args),
}))

// Mock useToast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock callRpc
const mockCallRpc = vi.fn()
vi.mock('@/lib/rpc-client', () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

// Import after mocking
import { useEquipmentExport } from '../_hooks/useEquipmentExport'
import type { UseEquipmentExportParams, ExportFilterParams } from '../_hooks/useEquipmentExport'
import type { Equipment } from '../types'

// Mock equipment data - typed as Equipment[]
const mockEquipmentList: Partial<Equipment>[] = [
  {
    id: 1,
    ma_thiet_bi: 'EQ-001',
    ten_thiet_bi: 'Test Equipment 1',
    model: 'Model A',
    serial: 'SN-001',
    don_vi: 5,
    khoa_phong_quan_ly: 'Khoa Nội',
    tinh_trang_hien_tai: 'Hoạt động',
    ngay_ngung_su_dung: null,
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
    ngay_ngung_su_dung: '2024-12-31',
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

const createDefaultFilterParams = (overrides?: Partial<ExportFilterParams>): ExportFilterParams => ({
  debouncedSearch: '',
  sortParam: 'id.asc',
  effectiveSelectedDonVi: 5,
  selectedDepartments: [],
  selectedUsers: [],
  selectedLocations: [],
  selectedStatuses: [],
  selectedClassifications: [],
  selectedFundingSources: [],
  ...overrides,
})

const createDefaultParams = (overrides?: Partial<UseEquipmentExportParams>): UseEquipmentExportParams => ({
  total: mockEquipmentList.length,
  filterParams: createDefaultFilterParams(),
  tenantBranding: mockTenantBranding as UseEquipmentExportParams['tenantBranding'],
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
        } as HTMLAnchorElement
      }
      return originalCreateElement(tag)
    })
    // Default mock for callRpc - returns equipment list
    mockCallRpc.mockResolvedValue({ data: mockEquipmentList, total: mockEquipmentList.length })
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
    it('should fetch all data and export to Excel successfully', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      // Should call RPC with p_page_size = 10000 (MAX_EXPORT_PAGE_SIZE)
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: 'equipment_list_enhanced',
          args: expect.objectContaining({
            p_page_size: 10000,
            p_page: 1,
          }),
        })
      )
      expect(mockExportToExcel).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Xuất dữ liệu thành công',
        })
      )
    })

    it('should show error when total is 0', async () => {
      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ total: 0 }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockCallRpc).not.toHaveBeenCalled()
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

    it('should include Ngày ngừng sử dụng in the exported column set', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      const exportCall = mockExportToExcel.mock.calls[0]
      const formattedData = exportCall[0]

      expect(formattedData[0]).toHaveProperty('Ngày ngừng sử dụng')
      expect(formattedData[1]).toHaveProperty('Ngày ngừng sử dụng')
      expect(formattedData[1]['Ngày ngừng sử dụng']).toBe('2024-12-31')
    })
  })

  describe('handleGenerateProfileSheet', () => {
    it('should generate profile sheet for equipment', async () => {
      mockGenerateProfileSheet.mockResolvedValueOnce(undefined)
      const equipment = mockEquipmentList[0]

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleGenerateProfileSheet(equipment as Equipment)
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
        await result.current.handleGenerateProfileSheet(equipment as Equipment)
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
        await result.current.handleGenerateProfileSheet(equipment as Equipment)
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
        await result.current.handleGenerateDeviceLabel(equipment as Equipment)
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
        await result.current.handleGenerateDeviceLabel(equipment as Equipment)
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

    it('should update handlers when filterParams change', () => {
      const initialFilterParams = createDefaultFilterParams()
      const { result, rerender } = renderHook(
        ({ filterParams }: { filterParams: ExportFilterParams }) => 
          useEquipmentExport(createDefaultParams({ filterParams })),
        { initialProps: { filterParams: initialFilterParams } }
      )

      const initialExportHandler = result.current.handleExportData

      // Change filterParams
      rerender({ filterParams: createDefaultFilterParams({ debouncedSearch: 'máy thở' }) })

      // handleExportData should change when filterParams changes
      expect(result.current.handleExportData).not.toBe(initialExportHandler)
    })
  })

  describe('Edge Cases', () => {
    it('should handle equipment with null/undefined fields from RPC', async () => {
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
      mockCallRpc.mockResolvedValueOnce({ data: equipmentWithNulls, total: 1 })
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ total: 1 }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockExportToExcel).toHaveBeenCalled()
      // Should not throw error with null/undefined fields
    })

    it('should handle large dataset export with warning toast', async () => {
      const largeDataset = Array.from({ length: 6000 }, (_, i) => ({
        id: i + 1,
        ma_thiet_bi: `EQ-${String(i + 1).padStart(4, '0')}`,
        ten_thiet_bi: `Equipment ${i + 1}`,
        don_vi: 5,
      }))
      mockCallRpc.mockResolvedValueOnce({ data: largeDataset, total: 6000 })
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ total: 6000 }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      // Should show warning toast for large dataset (>5000)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '⚠️ Danh sách lớn',
        })
      )
      expect(mockExportToExcel).toHaveBeenCalled()
    })
  })

  describe('Full Export Flow (Issue #170)', () => {
    it('should fetch ALL equipment with filters, not just current page', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)
      const filterParams = createDefaultFilterParams({
        debouncedSearch: 'máy thở',
        selectedDepartments: ['Khoa Nội'],
        selectedStatuses: ['Hoạt động'],
      })

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ total: 156, filterParams }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      // Should call RPC with same filters but large page size
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: 'equipment_list_enhanced',
          args: expect.objectContaining({
            p_q: 'máy thở',
            p_khoa_phong_array: ['Khoa Nội'],
            p_tinh_trang_array: ['Hoạt động'],
            p_page_size: 10000,
            p_page: 1,
          }),
        })
      )
    })

    it('should show confirmation toast with count before export', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ total: 156 }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      // First toast should be confirmation with count
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '📥 Chuẩn bị tải xuống',
          description: expect.stringContaining('156'),
        })
      )
    })

    it('should show active filters in confirmation toast', async () => {
      mockExportToExcel.mockResolvedValueOnce(undefined)
      const filterParams = createDefaultFilterParams({
        debouncedSearch: 'máy thở',
        selectedDepartments: ['Khoa Nội'],
      })

      const { result } = renderHook(() =>
        useEquipmentExport(createDefaultParams({ total: 50, filterParams }))
      )

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/máy thở.*Khoa Nội|Khoa Nội.*máy thở/s),
        })
      )
    })

    it('should set isExporting state during export', async () => {
      // Make the export take some time
      mockCallRpc.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: mockEquipmentList, total: 2 }), 50))
      )
      mockExportToExcel.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      expect(result.current.isExporting).toBe(false)

      let exportPromise: Promise<void>
      act(() => {
        exportPromise = result.current.handleExportData()
      })

      // isExporting should be true during fetch
      expect(result.current.isExporting).toBe(true)

      await act(async () => {
        await exportPromise
      })

      // isExporting should be false after completion
      expect(result.current.isExporting).toBe(false)
    })

    it('should handle RPC fetch error gracefully', async () => {
      mockCallRpc.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xuất dữ liệu. Vui lòng thử lại.',
      })
      expect(result.current.isExporting).toBe(false)
    })

    it('should handle empty RPC response', async () => {
      mockCallRpc.mockResolvedValueOnce({ data: [], total: 0 })

      const { result } = renderHook(() => useEquipmentExport(createDefaultParams({ total: 5 })))

      await act(async () => {
        await result.current.handleExportData()
      })

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Không có dữ liệu',
        description: 'Không thể lấy dữ liệu để xuất. Vui lòng thử lại.',
      })
    })
  })
})
