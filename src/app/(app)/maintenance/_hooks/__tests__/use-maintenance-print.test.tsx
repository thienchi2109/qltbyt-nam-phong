import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import type { MaintenanceTask } from "@/lib/data"
import { useMaintenancePrint } from "../use-maintenance-print"

const mocks = vi.hoisted(() => ({
  buildPrintTemplate: vi.fn(),
  callRpc: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("../maintenance-print-template", () => ({
  buildPrintTemplate: mocks.buildPrintTemplate,
}))

const selectedPlan: MaintenancePlan = {
  id: 17,
  ten_ke_hoach: "Kế hoạch bảo trì 2026",
  nam: 2026,
  loai_cong_viec: "Bảo trì",
  khoa_phong: "Khoa Xét nghiệm",
  nguoi_lap_ke_hoach: "Nguyễn Văn A",
  trang_thai: "Đã duyệt",
  ngay_phe_duyet: null,
  nguoi_duyet: null,
  ly_do_khong_duyet: null,
  created_at: "2026-07-28T00:00:00Z",
  don_vi: 42,
  facility_name: "CDC Cần Thơ",
}
const tasks: MaintenanceTask[] = [
  {
    id: 23,
    ke_hoach_id: selectedPlan.id,
    thiet_bi_id: 31,
    loai_cong_viec: "Bảo trì",
    diem_hieu_chuan: null,
    don_vi_thuc_hien: "Nội bộ",
    thang_1: true,
    thang_2: false,
    thang_3: false,
    thang_4: false,
    thang_5: false,
    thang_6: false,
    thang_7: false,
    thang_8: false,
    thang_9: false,
    thang_10: false,
    thang_11: false,
    thang_12: false,
    ghi_chu: null,
    thiet_bi: {
      ma_thiet_bi: "TB-031",
      ten_thiet_bi: "Máy xét nghiệm",
      khoa_phong_quan_ly: "Khoa Xét nghiệm",
    },
  },
]
const user = { full_name: "Người lập kế hoạch" }
const tenantBranding: TenantBranding = {
  id: selectedPlan.don_vi,
  name: "Trung tâm Y tế Quận 1",
  logo_url: "https://example.com/tenant-logo.png",
  print_location: "An Giang",
}
const fallbackLogoUrl = "https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo"

function mockPrintWindow(): void {
  vi.spyOn(window, "open").mockReturnValue({
    closed: false,
    document: {
      close: vi.fn(),
      open: vi.fn(),
      write: vi.fn(),
    },
  } as unknown as Window)
}

describe("useMaintenancePrint", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrintWindow()
    mocks.buildPrintTemplate.mockReturnValue("<html><body>plan</body></html>")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses the selected plan tenant branding when generating the plan form", async () => {
    mocks.callRpc.mockResolvedValue([tenantBranding])

    const { result } = renderHook(() => useMaintenancePrint({ selectedPlan, tasks, user }))

    await act(async () => {
      await result.current.generatePlanForm()
    })

    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "don_vi_branding_get",
      args: { p_id: selectedPlan.don_vi },
    })
    expect(mocks.buildPrintTemplate).toHaveBeenCalledWith({
      selectedPlan,
      tasks,
      user,
      organizationName: tenantBranding.name,
      logoUrl: tenantBranding.logo_url,
      printLocation: "An Giang",
    })
  })

  it("uses empty location and existing branding fallbacks when the branding RPC fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.callRpc.mockRejectedValue(new Error("RPC unavailable"))

    const { result } = renderHook(() => useMaintenancePrint({ selectedPlan, tasks, user }))

    await act(async () => {
      await result.current.generatePlanForm()
    })

    expect(mocks.buildPrintTemplate).toHaveBeenCalledWith({
      selectedPlan,
      tasks,
      user,
      organizationName: "Nền tảng QLTBYT",
      logoUrl: fallbackLogoUrl,
      printLocation: "",
    })
  })
})
