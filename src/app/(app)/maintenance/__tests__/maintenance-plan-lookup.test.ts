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

  it("returns a plan when found on the first page", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      data: [createPlan(123)],
      total: 1,
      page: 1,
      pageSize: 200,
    })

    const result = await findMaintenancePlanById(123)

    expect(result?.id).toBe(123)
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "maintenance_plan_list",
      args: {
        p_q: null,
        p_don_vi: null,
        p_page: 1,
        p_page_size: 200,
      },
    })
  })

  it("continues fetching pages until the target plan is found", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        data: [createPlan(1)],
        total: 300,
        page: 1,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        data: [createPlan(234, "9")],
        total: 300,
        page: 2,
        pageSize: 200,
      })

    const result = await findMaintenancePlanById(234)

    expect(result).toMatchObject({
      id: 234,
      don_vi: 9,
    })
    expect(mocks.callRpc).toHaveBeenCalledTimes(2)
    expect(mocks.callRpc.mock.calls[1]?.[0]).toEqual({
      fn: "maintenance_plan_list",
      args: {
        p_q: null,
        p_don_vi: null,
        p_page: 2,
        p_page_size: 200,
      },
    })
  })

  it("returns null after checking all pages when plan does not exist", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        data: [createPlan(10)],
        total: 250,
        page: 1,
        pageSize: 200,
      })
      .mockResolvedValueOnce({
        data: [createPlan(20)],
        total: 250,
        page: 2,
        pageSize: 200,
      })

    const result = await findMaintenancePlanById(999)

    expect(result).toBeNull()
    expect(mocks.callRpc).toHaveBeenCalledTimes(2)
  })
})
