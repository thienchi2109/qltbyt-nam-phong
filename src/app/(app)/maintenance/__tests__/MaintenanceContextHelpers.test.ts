import { describe, expect, it } from "vitest"
import type { MaintenanceTask } from "@/lib/data"
import {
  buildCompletionStatus,
  findPlanInCachedResponses,
  getNextMaintenanceTempTaskId,
  getSelectedTaskIds,
} from "../_components/MaintenanceContextHelpers"
import type { MaintenancePlanListResponse } from "@/hooks/use-cached-maintenance"
import { toMaintenanceTaskRowId } from "../_components/maintenance-task-row-id"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(id: number, overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    id,
    ke_hoach_id: 1,
    thiet_bi_id: id,
    loai_cong_viec: "Bảo trì",
    diem_hieu_chuan: null,
    don_vi_thuc_hien: null,
    thang_1: false,
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
    thiet_bi: { ma_thiet_bi: `TB-${id}`, ten_thiet_bi: `Thiết bị ${id}`, khoa_phong_quan_ly: "Khoa A" },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildCompletionStatus
// ---------------------------------------------------------------------------

describe("buildCompletionStatus", () => {
  it("returns empty map for empty task list", () => {
    expect(buildCompletionStatus([])).toEqual({})
  })

  it("returns empty map when no months are completed", () => {
    const tasks = [makeTask(1), makeTask(2)]
    expect(buildCompletionStatus(tasks)).toEqual({})
  })

  it("records completed month when both flag and date are present", () => {
    const task = makeTask(10, {
      thang_3_hoan_thanh: true,
      ngay_hoan_thanh_3: "2026-03-15",
    } as Partial<MaintenanceTask>)
    const result = buildCompletionStatus([task])
    expect(result["10-3"]).toEqual({ historyId: 0 })
  })

  it("does not record month when flag is true but date is missing", () => {
    const task = makeTask(10, {
      thang_5_hoan_thanh: true,
      ngay_hoan_thanh_5: null,
    } as Partial<MaintenanceTask>)
    const result = buildCompletionStatus([task])
    expect(result["10-5"]).toBeUndefined()
  })

  it("records only completed months, skips incomplete ones", () => {
    const task = makeTask(7, {
      thang_1_hoan_thanh: true,
      ngay_hoan_thanh_1: "2026-01-10",
      thang_2_hoan_thanh: false,
      ngay_hoan_thanh_2: "2026-02-10",
    } as Partial<MaintenanceTask>)
    const result = buildCompletionStatus([task])
    expect(result["7-1"]).toEqual({ historyId: 0 })
    expect(result["7-2"]).toBeUndefined()
  })

  it("handles multiple tasks", () => {
    const tasks = [
      makeTask(1, { thang_6_hoan_thanh: true, ngay_hoan_thanh_6: "2026-06-01" } as Partial<MaintenanceTask>),
      makeTask(2, { thang_12_hoan_thanh: true, ngay_hoan_thanh_12: "2026-12-01" } as Partial<MaintenanceTask>),
    ]
    const result = buildCompletionStatus(tasks)
    expect(result["1-6"]).toEqual({ historyId: 0 })
    expect(result["2-12"]).toEqual({ historyId: 0 })
    expect(Object.keys(result)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// getSelectedTaskIds
// ---------------------------------------------------------------------------

describe("getSelectedTaskIds", () => {
  it("returns empty array for empty selection", () => {
    expect(getSelectedTaskIds({})).toEqual([])
  })

  it("returns IDs only of selected rows", () => {
    const selection = {
      [toMaintenanceTaskRowId(101)]: true,
      [toMaintenanceTaskRowId(202)]: false,
    }
    expect(getSelectedTaskIds(selection)).toEqual([101])
  })

  it("filters out invalid row IDs (e.g. plain '0')", () => {
    expect(getSelectedTaskIds({ "0": true })).toEqual([])
  })

  it("handles multiple selected rows", () => {
    const selection = {
      [toMaintenanceTaskRowId(10)]: true,
      [toMaintenanceTaskRowId(20)]: true,
      [toMaintenanceTaskRowId(30)]: false,
    }
    const ids = getSelectedTaskIds(selection)
    expect(ids).toContain(10)
    expect(ids).toContain(20)
    expect(ids).not.toContain(30)
    expect(ids).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// findPlanInCachedResponses
// ---------------------------------------------------------------------------

describe("findPlanInCachedResponses", () => {
  const makePlanStub = (id: number) =>
    ({
      id,
      ten_ke_hoach: `Plan ${id}`,
      nam: 2026,
      loai_cong_viec: "Bảo trì",
      khoa_phong: "Khoa A",
      nguoi_lap_ke_hoach: "Tester",
      trang_thai: "Bản nháp",
      ngay_phe_duyet: null,
      nguoi_duyet: null,
      ly_do_khong_duyet: null,
      created_at: "2026-01-01T00:00:00Z",
      don_vi: 1,
      facility_name: "Cơ sở A",
    }) as import("@/hooks/use-cached-maintenance").MaintenancePlan

  const makeResponse = (...ids: number[]): [readonly unknown[], MaintenancePlanListResponse | undefined] => [
    ["key"],
    { data: ids.map(makePlanStub), total: ids.length, page: 1, pageSize: 50 },
  ]

  it("returns null for empty cache", () => {
    expect(findPlanInCachedResponses([], 1)).toBeNull()
  })

  it("finds plan across multiple cache pages", () => {
    const caches = [makeResponse(1, 2), makeResponse(3, 4)]
    expect(findPlanInCachedResponses(caches, 3)?.id).toBe(3)
  })

  it("returns null when plan ID not present in any cache", () => {
    const caches = [makeResponse(1, 2)]
    expect(findPlanInCachedResponses(caches, 99)).toBeNull()
  })

  it("handles undefined cache response gracefully", () => {
    const caches: [readonly unknown[], MaintenancePlanListResponse | undefined][] = [
      [["key"], undefined],
      makeResponse(5),
    ]
    expect(findPlanInCachedResponses(caches, 5)?.id).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// getNextMaintenanceTempTaskId
// ---------------------------------------------------------------------------

describe("getNextMaintenanceTempTaskId", () => {
  it("returns -2 when there are no temporary IDs", () => {
    expect(getNextMaintenanceTempTaskId([{ id: 10 }, { id: 20 }])).toBe(-2)
  })

  it("returns one less than the smallest temporary ID", () => {
    expect(getNextMaintenanceTempTaskId([{ id: -2 }, { id: -8 }, { id: 5 }])).toBe(-9)
  })

  it("handles large draft arrays without spreading IDs into function args", () => {
    const drafts = Array.from({ length: 70_000 }, (_, i) => ({ id: -(i + 1) }))
    expect(() => getNextMaintenanceTempTaskId(drafts)).not.toThrow()
    expect(getNextMaintenanceTempTaskId(drafts)).toBe(-70_001)
  })
})
