import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useEquipmentExport, type UseEquipmentExportParams } from "../_hooks/useEquipmentExport"

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  template: vi.fn(),
  download: vi.fn(),
  rpc: vi.fn(),
  excel: vi.fn(),
  toast: vi.fn(),
}))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/lib/excel-utils", () => ({
  generateEquipmentImportTemplate: (...args: unknown[]) => mocks.template(...args),
  downloadBlob: (...args: unknown[]) => mocks.download(...args),
  exportToExcel: (...args: unknown[]) => mocks.excel(...args),
}))
vi.mock("@/lib/rpc-client", () => ({ callRpc: (...args: unknown[]) => mocks.rpc(...args) }))
vi.mock("@/components/equipment/equipment-print-utils", () => ({
  generateProfileSheet: vi.fn(),
  generateDeviceLabel: vi.fn(),
}))
const activeValues = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
  "Thanh lý nội bộ",
  "Đang đánh giá kỹ thuật",
]
const params: UseEquipmentExportParams = {
  total: 1,
  tenantBranding: undefined,
  userRole: "to_qltb",
  filterParams: {
    debouncedSearch: "",
    sortParam: "id.asc",
    effectiveSelectedDonVi: 1,
    selectedDepartments: [],
    selectedUsers: [],
    selectedLocations: [],
    selectedStatuses: ["Thanh lý nội bộ", "Giá trị lịch sử"],
    selectedClassifications: [],
    selectedFundingSources: [],
  },
}

describe("catalog equipment export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.catalog.mockReturnValue({ activeValues, canWrite: true, refetch: vi.fn() })
    mocks.template.mockResolvedValue(new Blob(["test"]))
    mocks.rpc.mockResolvedValue({
      data: [{ id: 1, tinh_trang_hien_tai: "Giá trị lịch sử" }],
      total: 1,
    })
  })
  it("passes every active catalog label to the actual template generator boundary", async () => {
    const { result } = renderHook(() => useEquipmentExport(params))
    await act(() => result.current.handleDownloadTemplate())
    expect(mocks.template).toHaveBeenCalledWith(activeValues)
    expect(mocks.download).toHaveBeenCalledOnce()
  })
  it.each(["load error", "paused refresh", "empty catalog"])(
    "prevents template generation during %s",
    async () => {
      mocks.catalog.mockReturnValue({ activeValues: [], canWrite: false, refetch: vi.fn() })
      const { result } = renderHook(() => useEquipmentExport(params))
      await act(() => result.current.handleDownloadTemplate())
      expect(mocks.template).not.toHaveBeenCalled()
      expect(mocks.download).not.toHaveBeenCalled()
    }
  )
  it("keeps historical export available and selected status labels unchanged without a writable catalog", async () => {
    mocks.catalog.mockReturnValue({ activeValues: [], canWrite: false, refetch: vi.fn() })
    const { result } = renderHook(() => useEquipmentExport(params))
    await act(() => result.current.handleExportData())
    expect(mocks.rpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_list_enhanced",
        args: expect.objectContaining({ p_tinh_trang_array: params.filterParams.selectedStatuses }),
      })
    )
    expect(mocks.excel).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ "Tình trạng": "Giá trị lịch sử" })]),
      expect.any(String),
      expect.any(String),
      expect.any(Array)
    )
  })
})
