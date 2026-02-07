import { beforeEach, describe, expect, it, vi } from "vitest"
import { findMaintenancePlanById } from "../_components/maintenance-plan-lookup"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

function createPlan(id: number, donVi: number | string | null = 1) {
  return {
    id,
    ten_ke_hoach: `Plan ${id}`,
    nam: 2025,
    loai_cong_viec: "Bảo dưỡng",
    khoa_phong: null,
    nguoi_lap_ke_hoach: "Tester",
    trang_thai: "Bản nháp",
    ngay_phe_duyet: null,
    nguoi_duyet: null,
    ly_do_khong_duyet: null,
    created_at: "2025-01-01T00:00:00Z",
    don_vi: donVi,
    facility_name: "Facility A",
  }
}

describe("findMaintenancePlanById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a plan when the id exists", async () => {
    mocks.callRpc.mockResolvedValueOnce(createPlan(123))

    const result = await findMaintenancePlanById(123)

    expect(result?.id).toBe(123)
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "maintenance_plan_get",
      args: { p_id: 123 },
    })
  })

  it("normalizes don_vi when the RPC returns a string id", async () => {
    mocks.callRpc.mockResolvedValueOnce(createPlan(234, "9"))

    const result = await findMaintenancePlanById(234)

    expect(result).toMatchObject({
      id: 234,
      don_vi: 9,
    })
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
  })

  it("returns null when the plan does not exist", async () => {
    mocks.callRpc.mockResolvedValueOnce(null)

    const result = await findMaintenancePlanById(999)

    expect(result).toBeNull()
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
  })
})
