import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as React from "react"

// Mock excel-utils
const mockExportToExcel = vi.fn()
const mockGenerateEquipmentImportTemplate = vi.fn()
const mockDownloadBlob = vi.fn()
vi.mock("@/lib/excel-utils", () => ({
  exportToExcel: (...args: unknown[]) => mockExportToExcel(...args),
  generateEquipmentImportTemplate: (...args: unknown[]) =>
    mockGenerateEquipmentImportTemplate(...args),
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}))

// Mock print utils
const mockGenerateProfileSheet = vi.fn()
const mockGenerateDeviceLabel = vi.fn()
vi.mock("@/components/equipment/equipment-print-utils", () => ({
  generateProfileSheet: (...args: unknown[]) => mockGenerateProfileSheet(...args),
  generateDeviceLabel: (...args: unknown[]) => mockGenerateDeviceLabel(...args),
}))

// Mock useToast
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock callRpc
const mockCallRpc = vi.fn()
vi.mock("@/lib/rpc-client", () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

// Import after mocking
import type { UseEquipmentExportParams, ExportFilterParams } from "../_hooks/useEquipmentExport"
import type { Equipment } from "../types"

// Mock equipment data - typed as Equipment[]
const mockEquipmentList: Partial<Equipment>[] = [
  {
    id: 1,
    ma_thiet_bi: "EQ-001",
    ten_thiet_bi: "Test Equipment 1",
    model: "Model A",
    serial: "SN-001",
    don_vi: 5,
    khoa_phong_quan_ly: "Khoa Nội",
    tinh_trang_hien_tai: "Hoạt động",
    ngay_ngung_su_dung: null,
    vi_tri_lap_dat: "Phòng 101",
    nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
  },
  {
    id: 2,
    ma_thiet_bi: "EQ-002",
    ten_thiet_bi: "Test Equipment 2",
    model: "Model B",
    serial: "SN-002",
    don_vi: 5,
    khoa_phong_quan_ly: "Khoa Ngoại",
    tinh_trang_hien_tai: "Chờ sửa chữa",
    ngay_ngung_su_dung: "2024-12-31",
    vi_tri_lap_dat: "Phòng 102",
    nguoi_dang_truc_tiep_quan_ly: "Trần Thị B",
  },
]

const mockTenantBranding = {
  id: 5,
  name: "Test Hospital",
  code: "TH",
  logo_url: "https://example.com/logo.png",
}

const createDefaultFilterParams = (
  overrides?: Partial<ExportFilterParams>
): ExportFilterParams => ({
  debouncedSearch: "",
  sortParam: "id.asc",
  effectiveSelectedDonVi: 5,
  selectedDepartments: [],
  selectedUsers: [],
  selectedLocations: [],
  selectedStatuses: [],
  selectedClassifications: [],
  selectedFundingSources: [],
  ...overrides,
})

const createDefaultParams = (
  overrides?: Partial<UseEquipmentExportParams>
): UseEquipmentExportParams => ({
  total: mockEquipmentList.length,
  filterParams: createDefaultFilterParams(),
  tenantBranding: mockTenantBranding as UseEquipmentExportParams["tenantBranding"],
  userRole: "to_qltb",
  ...overrides,
})

// Store originals before mocking
const originalCreateElement = document.createElement.bind(document)
const originalCreateObjectURL = global.URL.createObjectURL
const originalRevokeObjectURL = global.URL.revokeObjectURL

beforeEach(() => {
  vi.clearAllMocks()
  // Mock URL.createObjectURL and URL.revokeObjectURL
  global.URL.createObjectURL = vi.fn(() => "blob:test-url")
  global.URL.revokeObjectURL = vi.fn()
  // Mock document methods
  vi.spyOn(document.body, "appendChild").mockImplementation(() => document.body)
  vi.spyOn(document.body, "removeChild").mockImplementation(() => document.body)
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return {
        href: "",
        download: "",
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

vi.mock("@/hooks/use-equipment-status-catalog", async () => {
  const { readyStatusCatalog } = await import("@/hooks/__tests__/equipment-status-catalog-fixtures")
  return { useEquipmentStatusCatalog: () => readyStatusCatalog }
})

export {
  createDefaultParams,
  createDefaultFilterParams,
  mockEquipmentList,
  mockTenantBranding,
  mockGenerateEquipmentImportTemplate,
  mockDownloadBlob,
  mockExportToExcel,
  mockCallRpc,
  mockToast,
  mockGenerateProfileSheet,
  mockGenerateDeviceLabel,
}
export type { Equipment, UseEquipmentExportParams, ExportFilterParams }
