import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenanceTask } from "@/lib/data"
import { maintenanceKeys, type MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { MaintenanceProvider } from "../_components/MaintenanceContext"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"

const mocks = vi.hoisted(() => {
  let draftTasks: MaintenanceTask[] = []
  let tasks: MaintenanceTask[] = []
  let hasChanges = true

  return {
    getDraftTasks: () => draftTasks,
    setDraftTasksState: (next: MaintenanceTask[]) => {
      draftTasks = next
    },
    setTasksState: (next: MaintenanceTask[]) => {
      tasks = next
    },
    getTasks: () => tasks,
    getHasChanges: () => hasChanges,
    setHasChangesState: (next: boolean) => {
      hasChanges = next
    },
    setDraftTasks: vi.fn((updater: React.SetStateAction<MaintenanceTask[]>) => {
      draftTasks = typeof updater === "function" ? updater(draftTasks) : updater
    }),
    fetchTasks: vi.fn(async () => {}),
    saveAllChanges: vi.fn(async () => {}),
    cancelAllChanges: vi.fn(),
    getDraftCacheKey: vi.fn((planId: number) => `maintenance_draft_${planId}`),
    toast: vi.fn(),
    invalidateQueries: vi.fn(async () => {}),
    getQueriesData: vi.fn(() => []),
    setTaskToDelete: vi.fn(),
    handleStartEdit: vi.fn(),
    handleCancelEdit: vi.fn(),
    handleTaskDataChange: vi.fn(),
    handleSaveTask: vi.fn(),
    openApproveDialog: vi.fn(),
    openRejectDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeDialog: vi.fn(),
    setRejectionReason: vi.fn(),
    handleApprovePlan: vi.fn(),
    handleRejectPlan: vi.fn(),
    handleDeletePlan: vi.fn(),
    generatePlanForm: vi.fn(),
  }
})

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "u1",
        role: "to_qltb",
        full_name: "Tester",
      },
    },
    status: "authenticated",
  }),
}))

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
      getQueriesData: mocks.getQueriesData,
    }),
  }
})

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}))

vi.mock("../_hooks/use-maintenance-drafts", () => ({
  useMaintenanceDrafts: () => ({
    tasks: mocks.getTasks(),
    draftTasks: mocks.getDraftTasks(),
    setDraftTasks: mocks.setDraftTasks,
    hasChanges: mocks.getHasChanges(),
    isLoading: false,
    isSaving: false,
    fetchTasks: mocks.fetchTasks,
    saveAllChanges: mocks.saveAllChanges,
    cancelAllChanges: mocks.cancelAllChanges,
    getDraftCacheKey: mocks.getDraftCacheKey,
  }),
}))

vi.mock("../_hooks/use-maintenance-operations", () => ({
  useMaintenanceOperations: () => ({
    confirmDialog: { type: null, plan: null, rejectionReason: "" },
    isApproving: false,
    isRejecting: false,
    isDeleting: false,
    closeDialog: mocks.closeDialog,
    setRejectionReason: mocks.setRejectionReason,
    handleApprovePlan: mocks.handleApprovePlan,
    handleRejectPlan: mocks.handleRejectPlan,
    handleDeletePlan: mocks.handleDeletePlan,
    openApproveDialog: mocks.openApproveDialog,
    openRejectDialog: mocks.openRejectDialog,
    openDeleteDialog: mocks.openDeleteDialog,
  }),
}))

vi.mock("../_hooks/use-maintenance-print", () => ({
  useMaintenancePrint: () => ({
    generatePlanForm: mocks.generatePlanForm,
    isGenerating: false,
  }),
}))

vi.mock("../_components/task-editing", () => ({
  useTaskEditing: () => ({
    editingTaskId: null,
    editingTaskData: null,
    taskToDelete: null,
    setTaskToDelete: mocks.setTaskToDelete,
    handleStartEdit: mocks.handleStartEdit,
    handleCancelEdit: mocks.handleCancelEdit,
    handleTaskDataChange: mocks.handleTaskDataChange,
    handleSaveTask: mocks.handleSaveTask,
  }),
}))

function createTask(id: number): MaintenanceTask {
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
    thiet_bi: {
      ma_thiet_bi: `TB-${id}`,
      ten_thiet_bi: `Thiết bị ${id}`,
      khoa_phong_quan_ly: "Khoa A",
    },
  }
}

function createPlan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: 1,
    ten_ke_hoach: "Kế hoạch gốc",
    nam: 2026,
    loai_cong_viec: "Bảo trì",
    khoa_phong: "Khoa A",
    nguoi_lap_ke_hoach: "Tester",
    trang_thai: "Bản nháp",
    ngay_phe_duyet: null,
    nguoi_duyet: null,
    ly_do_khong_duyet: null,
    created_at: "2026-01-01T00:00:00.000Z",
    don_vi: 1,
    facility_name: "Cơ sở A",
    ...overrides,
  }
}

function createWrapper(
  rowSelection: RowSelectionState,
  setTaskRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MaintenanceProvider
        taskRowSelection={rowSelection}
        setTaskRowSelection={setTaskRowSelection}
      >
        {children}
      </MaintenanceProvider>
    )
  }
}

describe("MaintenanceContext", () => {
  beforeEach(() => {
    mocks.setHasChangesState(true)
    mocks.setDraftTasksState([createTask(101), createTask(202), createTask(303)])
    mocks.setTasksState([createTask(101), createTask(202), createTask(303)])
    mocks.getQueriesData.mockReturnValue([])
    vi.clearAllMocks()
  })

  it("applies bulk unit assignment by selected task IDs", () => {
    const wrapper = createWrapper({ "202": true }, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

    act(() => {
      result.current.handleBulkAssignUnit("Nội bộ")
    })

    const updated = mocks.getDraftTasks()
    expect(updated.find((task) => task.id === 202)?.don_vi_thuc_hien).toBe("Nội bộ")
    expect(updated.find((task) => task.id === 101)?.don_vi_thuc_hien).toBeNull()
    expect(updated.find((task) => task.id === 303)?.don_vi_thuc_hien).toBeNull()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Đã gán đơn vị" })
    )
  })

  it("deletes selected tasks and resets row selection", () => {
    const setTaskRowSelection = vi.fn()
    const wrapper = createWrapper({ "101": true, "303": true }, setTaskRowSelection)
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

    act(() => {
      result.current.confirmDeleteSelectedTasks()
    })

    expect(mocks.getDraftTasks().map((task) => task.id)).toEqual([202])
    expect(setTaskRowSelection).toHaveBeenCalledWith({})
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Đã xóa khỏi bản nháp" })
    )
  })

  it("invalidates maintenance plan queries on mutation success", async () => {
    const wrapper = createWrapper({}, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

    await act(async () => {
      result.current.onPlanMutationSuccess()
      await Promise.resolve()
    })

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: maintenanceKeys.plans(),
    })
  })

  it("re-syncs selected plan from refreshed plan cache on mutation success", async () => {
    const wrapper = createWrapper({}, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

    const stalePlan = createPlan()
    const refreshedPlan = createPlan({
      ten_ke_hoach: "Kế hoạch đã cập nhật",
      trang_thai: "Đã duyệt",
    })

    mocks.getQueriesData.mockReturnValue([
      [
        ["maintenance", "plans", { filters: { page: 1 } }],
        {
          data: [refreshedPlan],
          total: 1,
          page: 1,
          pageSize: 50,
        },
      ],
    ])

    act(() => {
      result.current.setSelectedPlan(stalePlan)
    })

    act(() => {
      result.current.onPlanMutationSuccess()
    })

    await waitFor(() => {
      expect(result.current.selectedPlan?.ten_ke_hoach).toBe("Kế hoạch đã cập nhật")
      expect(result.current.selectedPlan?.trang_thai).toBe("Đã duyệt")
    })
  })

  it("opens cancel confirmation when switching plans with unsaved changes", () => {
    const wrapper = createWrapper({}, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })
    const currentPlan = createPlan({ id: 10, ten_ke_hoach: "Kế hoạch hiện tại" })
    const nextPlan = createPlan({ id: 11, ten_ke_hoach: "Kế hoạch mới" })

    act(() => {
      result.current.setSelectedPlan(currentPlan)
      result.current.setActiveTab("plans")
    })

    act(() => {
      result.current.handleSelectPlan(nextPlan)
    })

    expect(result.current.dialogState.isConfirmingCancel).toBe(true)
    expect(result.current.selectedPlan?.id).toBe(currentPlan.id)
  })

  it("switches to pending plan after confirming discard changes", () => {
    const wrapper = createWrapper({}, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })
    const currentPlan = createPlan({ id: 20, ten_ke_hoach: "Kế hoạch cũ" })
    const nextPlan = createPlan({ id: 21, ten_ke_hoach: "Kế hoạch mới" })

    act(() => {
      result.current.setSelectedPlan(currentPlan)
      result.current.setActiveTab("plans")
    })

    act(() => {
      result.current.handleSelectPlan(nextPlan)
    })

    act(() => {
      result.current.handleCancelAllChanges()
    })

    expect(mocks.cancelAllChanges).toHaveBeenCalled()
    expect(result.current.dialogState.isConfirmingCancel).toBe(false)
    expect(result.current.selectedPlan?.id).toBe(nextPlan.id)
    expect(result.current.activeTab).toBe("tasks")
  })

  it("switches plan immediately when there are no unsaved changes", () => {
    mocks.setHasChangesState(false)
    const wrapper = createWrapper({}, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })
    const currentPlan = createPlan({ id: 22, ten_ke_hoach: "Kế hoạch đang mở" })
    const nextPlan = createPlan({ id: 23, ten_ke_hoach: "Kế hoạch chuyển tới" })

    act(() => {
      result.current.setSelectedPlan(currentPlan)
      result.current.setActiveTab("plans")
    })

    act(() => {
      result.current.handleSelectPlan(nextPlan)
    })

    expect(result.current.dialogState.isConfirmingCancel).toBe(false)
    expect(result.current.selectedPlan?.id).toBe(nextPlan.id)
    expect(result.current.activeTab).toBe("tasks")
  })

  it("keeps current tab and plan when closing discard dialog without confirming", () => {
    const wrapper = createWrapper({}, vi.fn())
    const { result } = renderHook(() => useMaintenanceContext(), { wrapper })
    const currentPlan = createPlan({ id: 30, ten_ke_hoach: "Kế hoạch đang mở" })
    const nextPlan = createPlan({ id: 31, ten_ke_hoach: "Kế hoạch được chọn" })

    act(() => {
      result.current.setSelectedPlan(currentPlan)
      result.current.setActiveTab("plans")
    })

    act(() => {
      result.current.handleSelectPlan(nextPlan)
    })

    expect(result.current.dialogState.isConfirmingCancel).toBe(true)
    expect(result.current.selectedPlan?.id).toBe(currentPlan.id)
    expect(result.current.activeTab).toBe("plans")

    act(() => {
      result.current.setIsConfirmingCancel(false)
    })

    expect(result.current.dialogState.isConfirmingCancel).toBe(false)
    expect(result.current.selectedPlan?.id).toBe(currentPlan.id)
    expect(result.current.activeTab).toBe("plans")
  })
})
