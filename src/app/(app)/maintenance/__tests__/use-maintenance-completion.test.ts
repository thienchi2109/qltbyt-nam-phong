import * as React from "react"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenanceTask } from "@/lib/data"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useMaintenanceCompletion } from "../_hooks/use-maintenance-completion"
import { toMaintenanceTaskRowId } from "../_components/maintenance-task-row-id"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  let draftTasks: MaintenanceTask[] = []
  return {
    getDraftTasks: () => draftTasks,
    setDraftTasksState: (next: MaintenanceTask[]) => { draftTasks = next },
    setDraftTasks: vi.fn((updater: React.SetStateAction<MaintenanceTask[]>) => {
      draftTasks = typeof updater === "function" ? updater(draftTasks) : updater
    }),
    toast: vi.fn(),
    callRpc: vi.fn(async () => {}),
    fetchPlanDetails: vi.fn(async () => {}),
    setTaskToDelete: vi.fn(),
    setIsBulkScheduleOpen: vi.fn(),
    setIsConfirmingBulkDelete: vi.fn(),
  }
})

vi.mock("@/lib/rpc-client", () => ({ callRpc: mocks.callRpc }))

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
    thang_1: false, thang_2: false, thang_3: false, thang_4: false,
    thang_5: false, thang_6: false, thang_7: false, thang_8: false,
    thang_9: false, thang_10: false, thang_11: false, thang_12: false,
    ghi_chu: null,
    thiet_bi: { ma_thiet_bi: `TB-${id}`, ten_thiet_bi: `Thiết bị ${id}`, khoa_phong_quan_ly: "Khoa A" },
    ...overrides,
  }
}

function makePlan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: 1, ten_ke_hoach: "Kế hoạch A", nam: 2026, loai_cong_viec: "Bảo trì",
    khoa_phong: "Khoa A", nguoi_lap_ke_hoach: "Tester", trang_thai: "Đã duyệt",
    ngay_phe_duyet: null, nguoi_duyet: null, ly_do_khong_duyet: null,
    created_at: "2026-01-01T00:00:00Z", don_vi: 1, facility_name: "Cơ sở A",
    ...overrides,
  }
}

const baseUser = { id: "u1", role: "to_qltb", full_name: "Tester" }

function makeWrapper(
  options: {
    selectedPlan?: MaintenancePlan | null
    taskRowSelection?: RowSelectionState
    setTaskRowSelection?: ReturnType<typeof vi.fn>
    canCompleteTask?: boolean
    taskToDelete?: MaintenanceTask | null
    tasks?: MaintenanceTask[]
  } = {}
) {
  return () =>
    useMaintenanceCompletion({
      selectedPlan: options.selectedPlan ?? null,
      user: baseUser as Parameters<typeof useMaintenanceCompletion>[0]["user"],
      canCompleteTask: options.canCompleteTask ?? true,
      tasks: options.tasks ?? [],
      fetchPlanDetails: mocks.fetchPlanDetails,
      draftTasks: mocks.getDraftTasks(),
      setDraftTasks: mocks.setDraftTasks,
      taskRowSelection: options.taskRowSelection ?? {},
      setTaskRowSelection: (options.setTaskRowSelection ?? vi.fn()) as React.Dispatch<React.SetStateAction<RowSelectionState>>,
      taskToDelete: options.taskToDelete ?? null,
      setTaskToDelete: mocks.setTaskToDelete,
      setIsBulkScheduleOpen: mocks.setIsBulkScheduleOpen,
      setIsConfirmingBulkDelete: mocks.setIsConfirmingBulkDelete,
      toast: mocks.toast,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMaintenanceCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setDraftTasksState([makeTask(101), makeTask(202), makeTask(303)])
    mocks.callRpc.mockResolvedValue(undefined)
  })

  // --- handleMarkAsCompleted ---

  it("toasts permission error when selectedPlan is null", async () => {
    const { result } = renderHook(makeWrapper({ selectedPlan: null }))

    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(1), 3)
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Không có quyền" })
    )
  })

  it("toasts permission error when canCompleteTask is false", async () => {
    const { result } = renderHook(makeWrapper({ selectedPlan: makePlan(), canCompleteTask: false }))

    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(1), 3)
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    )
  })

  it("is a no-op when the task-month is already completed", async () => {
    const { result } = renderHook(makeWrapper({ selectedPlan: makePlan() }))

    // First call sets completionStatus
    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(5), 6)
    })

    mocks.callRpc.mockClear()

    // Second call should be no-op
    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(5), 6)
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("calls maintenance_task_complete RPC and toasts success", async () => {
    const plan = makePlan()
    const { result } = renderHook(makeWrapper({ selectedPlan: plan }))

    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(7), 4)
    })

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({ fn: "maintenance_task_complete", args: { p_task_id: 7, p_month: 4 } })
    )
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Ghi nhận thành công" })
    )
    expect(mocks.fetchPlanDetails).toHaveBeenCalledWith(plan)
  })

  it("toasts error when RPC call fails", async () => {
    mocks.callRpc.mockRejectedValue(new Error("Server error"))
    const { result } = renderHook(makeWrapper({ selectedPlan: makePlan() }))

    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(9), 2)
    })

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Lỗi" })
    )
  })

  it("rolls back completionStatus when fetchPlanDetails fails after RPC success (no stuck state)", async () => {
    mocks.fetchPlanDetails.mockRejectedValueOnce(new Error("Network error"))
    const plan = makePlan()
    const { result } = renderHook(makeWrapper({ selectedPlan: plan }))

    // First call: RPC succeeds but fetchPlanDetails fails
    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(7), 4)
    })

    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    // Should toast error
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Lỗi" })
    )

    // Key should NOT be stuck in completionStatus → retry must be possible
    mocks.callRpc.mockClear()
    mocks.toast.mockClear()
    mocks.fetchPlanDetails.mockResolvedValueOnce(undefined)

    await act(async () => {
      await result.current.handleMarkAsCompleted(makeTask(7), 4)
    })

    // Second call should go through (not be silently ignored)
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
  })

  // --- completionStatus seeded from tasks ---

  it("seeds completionStatus from tasks so already-completed months are blocked", async () => {
    // Task with thang_3_hoan_thanh = true and ngay_hoan_thanh_3 set → already completed
    const completedTask = makeTask(7, {
      thang_3_hoan_thanh: true,
      ngay_hoan_thanh_3: "2026-03-15",
    } as Partial<MaintenanceTask>)

    const { result } = renderHook(
      makeWrapper({ selectedPlan: makePlan(), tasks: [completedTask] })
    )

    // Attempting to mark the same task-month should be a no-op (already seeded)
    await act(async () => {
      await result.current.handleMarkAsCompleted(completedTask, 3)
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  // --- handleBulkScheduleApply ---

  it("is a no-op when no tasks are selected", () => {
    const { result } = renderHook(makeWrapper({ taskRowSelection: {} }))

    act(() => {
      result.current.handleBulkScheduleApply({ thang_1: true })
    })

    expect(mocks.setDraftTasks).not.toHaveBeenCalled()
    expect(mocks.setIsBulkScheduleOpen).not.toHaveBeenCalled()
  })

  it("applies schedule to selected tasks only", () => {
    const { result } = renderHook(makeWrapper({
      taskRowSelection: { [toMaintenanceTaskRowId(202)]: true },
    }))

    act(() => {
      result.current.handleBulkScheduleApply({ thang_3: true, thang_4: true })
    })

    const updated = mocks.getDraftTasks()
    expect(updated.find((t) => t.id === 202)?.thang_3).toBe(true)
    expect(updated.find((t) => t.id === 101)?.thang_3).toBe(false)
    expect(mocks.setIsBulkScheduleOpen).toHaveBeenCalledWith(false)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Đã áp dụng lịch" }))
  })

  // --- handleBulkAssignUnit ---

  it("assigns unit to selected tasks only", () => {
    const { result } = renderHook(makeWrapper({
      taskRowSelection: { [toMaintenanceTaskRowId(303)]: true },
    }))

    act(() => { result.current.handleBulkAssignUnit("Nội bộ") })

    expect(mocks.getDraftTasks().find((t) => t.id === 303)?.don_vi_thuc_hien).toBe("Nội bộ")
    expect(mocks.getDraftTasks().find((t) => t.id === 101)?.don_vi_thuc_hien).toBeNull()
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Đã gán đơn vị" }))
  })

  it("is a no-op when no tasks are selected for bulk assign", () => {
    const { result } = renderHook(makeWrapper({ taskRowSelection: {} }))

    act(() => { result.current.handleBulkAssignUnit("Nội bộ") })

    expect(mocks.setDraftTasks).not.toHaveBeenCalled()
  })

  // --- confirmDeleteSingleTask ---

  it("is a no-op when taskToDelete is null", () => {
    const { result } = renderHook(makeWrapper({ taskToDelete: null }))

    act(() => { result.current.confirmDeleteSingleTask() })

    expect(mocks.setDraftTasks).not.toHaveBeenCalled()
  })

  it("removes taskToDelete from drafts", () => {
    const taskToDelete = makeTask(202)
    const { result } = renderHook(makeWrapper({ taskToDelete }))

    act(() => { result.current.confirmDeleteSingleTask() })

    expect(mocks.getDraftTasks().map((t) => t.id)).not.toContain(202)
    expect(mocks.setTaskToDelete).toHaveBeenCalledWith(null)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Đã xóa khỏi bản nháp" }))
  })

  // --- confirmDeleteSelectedTasks ---

  it("is a no-op when no tasks are selected for bulk delete", () => {
    const { result } = renderHook(makeWrapper({ taskRowSelection: {} }))

    act(() => { result.current.confirmDeleteSelectedTasks() })

    expect(mocks.setDraftTasks).not.toHaveBeenCalled()
  })

  it("removes all selected tasks and resets row selection", () => {
    const setTaskRowSelection = vi.fn()
    const { result } = renderHook(makeWrapper({
      taskRowSelection: {
        [toMaintenanceTaskRowId(101)]: true,
        [toMaintenanceTaskRowId(303)]: true,
      },
      setTaskRowSelection,
    }))

    act(() => { result.current.confirmDeleteSelectedTasks() })

    expect(mocks.getDraftTasks().map((t) => t.id)).toEqual([202])
    expect(setTaskRowSelection).toHaveBeenCalledWith({})
    expect(mocks.setIsConfirmingBulkDelete).toHaveBeenCalledWith(false)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Đã xóa khỏi bản nháp" }))
  })

  // --- selectedTaskRowsCount ---

  it("returns 0 for empty selection", () => {
    const { result } = renderHook(makeWrapper({ taskRowSelection: {} }))
    expect(result.current.selectedTaskRowsCount).toBe(0)
  })

  it("counts only selected (true) rows with valid task IDs", () => {
    const { result } = renderHook(makeWrapper({
      taskRowSelection: {
        [toMaintenanceTaskRowId(101)]: true,
        [toMaintenanceTaskRowId(202)]: false,
        "0": true, // invalid id
      },
    }))
    expect(result.current.selectedTaskRowsCount).toBe(1)
  })
})
