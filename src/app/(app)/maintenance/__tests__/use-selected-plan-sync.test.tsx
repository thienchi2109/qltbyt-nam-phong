import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useSelectedPlanSync } from "../_hooks/use-selected-plan-sync"

function createPlan(
  id: number,
  overrides: Partial<MaintenancePlan> = {}
): MaintenancePlan {
  return {
    id,
    ten_ke_hoach: `Kế hoạch ${id}`,
    nam: 2026,
    loai_cong_viec: "Bảo trì",
    khoa_phong: null,
    nguoi_lap_ke_hoach: null,
    trang_thai: "Bản nháp",
    ngay_phe_duyet: null,
    nguoi_duyet: null,
    ly_do_khong_duyet: null,
    created_at: "2026-01-01T00:00:00Z",
    don_vi: null,
    facility_name: null,
    ...overrides,
  }
}

describe("useSelectedPlanSync", () => {
  let fetchPlanDetails: ReturnType<typeof vi.fn>
  let clearTaskRowSelection: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchPlanDetails = vi.fn().mockResolvedValue(undefined)
    clearTaskRowSelection = vi.fn()
    vi.clearAllMocks()
  })

  it("fetches tasks when a plan is selected", async () => {
    const plan = createPlan(1)
    renderHook(() =>
      useSelectedPlanSync({
        selectedPlan: plan,
        fetchPlanDetails,
        clearTaskRowSelection,
      })
    )

    expect(fetchPlanDetails).toHaveBeenCalledWith(plan)
  })

  it("clears selection when plan becomes null", () => {
    renderHook(() =>
      useSelectedPlanSync({
        selectedPlan: null,
        fetchPlanDetails,
        clearTaskRowSelection,
      })
    )

    expect(fetchPlanDetails).not.toHaveBeenCalled()
    expect(clearTaskRowSelection).toHaveBeenCalled()
  })

  it("skips refetch when only object reference changes (same id, trang_thai, loai_cong_viec)", () => {
    const plan1 = createPlan(5, { trang_thai: "Bản nháp", loai_cong_viec: "Bảo trì" })
    const plan2 = createPlan(5, { trang_thai: "Bản nháp", loai_cong_viec: "Bảo trì", ten_ke_hoach: "Tên mới" })

    const { rerender } = renderHook(
      ({ plan }) =>
        useSelectedPlanSync({
          selectedPlan: plan,
          fetchPlanDetails,
          clearTaskRowSelection,
        }),
      { initialProps: { plan: plan1 as MaintenancePlan | null } }
    )

    expect(fetchPlanDetails).toHaveBeenCalledTimes(1)

    rerender({ plan: plan2 })

    // Same compound key → no refetch
    expect(fetchPlanDetails).toHaveBeenCalledTimes(1)
  })

  it("refetches when trang_thai changes (plan approved in-place)", () => {
    const draft = createPlan(5, { trang_thai: "Bản nháp" })
    const approved = createPlan(5, { trang_thai: "Đã duyệt" })

    const { rerender } = renderHook(
      ({ plan }) =>
        useSelectedPlanSync({
          selectedPlan: plan,
          fetchPlanDetails,
          clearTaskRowSelection,
        }),
      { initialProps: { plan: draft as MaintenancePlan | null } }
    )

    expect(fetchPlanDetails).toHaveBeenCalledTimes(1)
    expect(fetchPlanDetails).toHaveBeenCalledWith(draft)

    rerender({ plan: approved })

    expect(fetchPlanDetails).toHaveBeenCalledTimes(2)
    expect(fetchPlanDetails).toHaveBeenLastCalledWith(approved)
  })

  it("refetches when loai_cong_viec changes (work type edited in-place)", () => {
    const original = createPlan(5, { loai_cong_viec: "Bảo trì" })
    const edited = createPlan(5, { loai_cong_viec: "Hiệu chuẩn" })

    const { rerender } = renderHook(
      ({ plan }) =>
        useSelectedPlanSync({
          selectedPlan: plan,
          fetchPlanDetails,
          clearTaskRowSelection,
        }),
      { initialProps: { plan: original as MaintenancePlan | null } }
    )

    expect(fetchPlanDetails).toHaveBeenCalledTimes(1)

    rerender({ plan: edited })

    expect(fetchPlanDetails).toHaveBeenCalledTimes(2)
    expect(fetchPlanDetails).toHaveBeenLastCalledWith(edited)
  })

  it("refetches when switching to a different plan", () => {
    const planA = createPlan(1)
    const planB = createPlan(2)

    const { rerender } = renderHook(
      ({ plan }) =>
        useSelectedPlanSync({
          selectedPlan: plan,
          fetchPlanDetails,
          clearTaskRowSelection,
        }),
      { initialProps: { plan: planA as MaintenancePlan | null } }
    )

    expect(fetchPlanDetails).toHaveBeenCalledWith(planA)

    rerender({ plan: planB })

    expect(fetchPlanDetails).toHaveBeenCalledTimes(2)
    expect(fetchPlanDetails).toHaveBeenLastCalledWith(planB)
  })

  it("resets guard when plan becomes null, then refetches on reselection", () => {
    const plan = createPlan(1)

    const { rerender } = renderHook(
      ({ selectedPlan }) =>
        useSelectedPlanSync({
          selectedPlan,
          fetchPlanDetails,
          clearTaskRowSelection,
        }),
      { initialProps: { selectedPlan: plan as MaintenancePlan | null } }
    )

    expect(fetchPlanDetails).toHaveBeenCalledTimes(1)

    // Deselect
    rerender({ selectedPlan: null })
    expect(clearTaskRowSelection).toHaveBeenCalled()

    // Reselect same plan
    rerender({ selectedPlan: plan })
    expect(fetchPlanDetails).toHaveBeenCalledTimes(2)
  })

  it("cancels stale fetch when switching plans rapidly", async () => {
    // Slow fetch for plan A
    let resolveA: () => void
    const slowFetchA = new Promise<void>((resolve) => {
      resolveA = resolve
    })
    // Fast fetch for plan B
    const fastFetchB = Promise.resolve()

    fetchPlanDetails
      .mockReturnValueOnce(slowFetchA)  // Plan A: slow
      .mockReturnValueOnce(fastFetchB)  // Plan B: fast

    const planA = createPlan(1)
    const planB = createPlan(2)

    const { rerender } = renderHook(
      ({ plan }) =>
        useSelectedPlanSync({
          selectedPlan: plan,
          fetchPlanDetails,
          clearTaskRowSelection,
        }),
      { initialProps: { plan: planA as MaintenancePlan | null } }
    )

    // Quickly switch to plan B before A resolves
    rerender({ plan: planB })

    // Let plan B complete
    await act(async () => {
      await fastFetchB
    })

    // Plan B's clearTaskRowSelection should fire
    // (1 from null check is not expected here, so we check calls)
    const callsAfterSwitch = clearTaskRowSelection.mock.calls.length

    // Now resolve plan A (stale)
    await act(async () => {
      resolveA!()
      await slowFetchA
    })

    // Stale plan A's .then() should NOT have called clearTaskRowSelection again
    expect(clearTaskRowSelection).toHaveBeenCalledTimes(callsAfterSwitch)
  })
})
