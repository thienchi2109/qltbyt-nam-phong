"use client"

import * as React from "react"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenanceTask, Equipment } from "@/lib/data"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { MaintenanceProvider } from "../_components/MaintenanceContext"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"

const mocks = vi.hoisted(() => {
  let draftTasks: MaintenanceTask[] = []
  let tasks: MaintenanceTask[] = []

  return {
    getDraftTasks: () => draftTasks,
    setDraftTasksState: (next: MaintenanceTask[]) => {
      draftTasks = next
    },
    setTasksState: (next: MaintenanceTask[]) => {
      tasks = next
    },
    getTasks: () => tasks,
    setDraftTasks: vi.fn((updater: React.SetStateAction<MaintenanceTask[]>) => {
      draftTasks = typeof updater === "function" ? updater(draftTasks) : updater
    }),
    fetchTasks: vi.fn(async () => {}),
    saveAllChanges: vi.fn(async () => {}),
    cancelAllChanges: vi.fn(),
    getDraftCacheKey: vi.fn((planId: number) => `maintenance_draft_${planId}`),
    toast: vi.fn(),
    invalidateQueries: vi.fn(),
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
    taskToDelete: null as MaintenanceTask | null,
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
    hasChanges: false,
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
    taskToDelete: mocks.taskToDelete,
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

describe("MaintenanceContext - Extended Coverage", () => {
  beforeEach(() => {
    mocks.setDraftTasksState([createTask(101), createTask(202), createTask(303)])
    mocks.setTasksState([createTask(101), createTask(202), createTask(303)])
    mocks.taskToDelete = null
    vi.clearAllMocks()
  })

  describe("Dialog state management", () => {
    it("setIsAddPlanDialogOpen updates dialog state", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      expect(result.current.dialogState.isAddPlanDialogOpen).toBe(false)

      act(() => {
        result.current.setIsAddPlanDialogOpen(true)
      })

      expect(result.current.dialogState.isAddPlanDialogOpen).toBe(true)
    })

    it("setEditingPlan updates dialog state with plan", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      const mockPlan: MaintenancePlan = {
        id: 1,
        ten_ke_hoach: "Test Plan",
        nam: 2024,
        trang_thai: "Bản nháp",
        loai_cong_viec: "Bảo dưỡng",
        don_vi_id: 1,
        khoa_phong_id: null,
        khoa_phong: null,
        nguoi_lap_ke_hoach: "Test User",
        ngay_phe_duyet: null,
        nguoi_duyet: null,
        ly_do_khong_duyet: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }

      act(() => {
        result.current.setEditingPlan(mockPlan)
      })

      expect(result.current.dialogState.editingPlan).toEqual(mockPlan)
    })

    it("setIsAddTasksDialogOpen updates dialog state", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setIsAddTasksDialogOpen(true)
      })

      expect(result.current.dialogState.isAddTasksDialogOpen).toBe(true)
    })

    it("setIsBulkScheduleOpen updates dialog state", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setIsBulkScheduleOpen(true)
      })

      expect(result.current.dialogState.isBulkScheduleOpen).toBe(true)
    })

    it("setIsConfirmingCancel updates dialog state", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setIsConfirmingCancel(true)
      })

      expect(result.current.dialogState.isConfirmingCancel).toBe(true)
    })

    it("setIsConfirmingBulkDelete updates dialog state", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setIsConfirmingBulkDelete(true)
      })

      expect(result.current.dialogState.isConfirmingBulkDelete).toBe(true)
    })
  })

  describe("Bulk schedule operations", () => {
    it("handleBulkScheduleApply updates months for selected tasks", () => {
      const wrapper = createWrapper({ "101": true, "202": true }, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      const monthSchedule = {
        thang_1: true,
        thang_6: true,
        thang_12: true,
      }

      act(() => {
        result.current.handleBulkScheduleApply(monthSchedule)
      })

      const updated = mocks.getDraftTasks()
      expect(updated.find((t) => t.id === 101)?.thang_1).toBe(true)
      expect(updated.find((t) => t.id === 101)?.thang_6).toBe(true)
      expect(updated.find((t) => t.id === 202)?.thang_12).toBe(true)
      expect(updated.find((t) => t.id === 303)?.thang_1).toBe(false)
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Đã áp dụng lịch" })
      )
    })

    it("handleBulkScheduleApply does nothing when no tasks selected", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.handleBulkScheduleApply({ thang_1: true })
      })

      expect(mocks.setDraftTasks).not.toHaveBeenCalled()
    })
  })

  describe("Add tasks from dialog", () => {
    it("handleAddTasksFromDialog adds equipment as new tasks with temp IDs", () => {
      const mockPlan: MaintenancePlan = {
        id: 5,
        ten_ke_hoach: "Test Plan",
        nam: 2024,
        trang_thai: "Bản nháp",
        loai_cong_viec: "Hiệu chuẩn",
        don_vi_id: 1,
        khoa_phong_id: null,
        khoa_phong: null,
        nguoi_lap_ke_hoach: "Test User",
        ngay_phe_duyet: null,
        nguoi_duyet: null,
        ly_do_khong_duyet: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }

      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setSelectedPlan(mockPlan)
        result.current.setIsAddTasksDialogOpen(true)
      })

      const newEquipment: Equipment[] = [
        {
          id: 999,
          ma_thiet_bi: "TB-999",
          ten_thiet_bi: "New Equipment",
          khoa_phong_quan_ly: "Khoa B",
        } as Equipment,
        {
          id: 1000,
          ma_thiet_bi: "TB-1000",
          ten_thiet_bi: "Second Equipment",
          khoa_phong_quan_ly: "Khoa C",
        } as Equipment,
      ]

      act(() => {
        result.current.handleAddTasksFromDialog(newEquipment)
      })

      expect(mocks.setDraftTasks).toHaveBeenCalled()
      expect(result.current.dialogState.isAddTasksDialogOpen).toBe(false)

      const updatedDrafts = mocks.getDraftTasks()
      expect(updatedDrafts).toHaveLength(5)

      const firstAddedTask = updatedDrafts.at(-2)!
      const secondAddedTask = updatedDrafts.at(-1)!

      expect(firstAddedTask).toMatchObject({
        id: -2,
        ke_hoach_id: mockPlan.id,
        thiet_bi_id: 999,
        loai_cong_viec: mockPlan.loai_cong_viec,
        diem_hieu_chuan: null,
        don_vi_thuc_hien: null,
        ghi_chu: null,
        thiet_bi: {
          ma_thiet_bi: "TB-999",
          ten_thiet_bi: "New Equipment",
          khoa_phong_quan_ly: "Khoa B",
        },
      })

      expect(secondAddedTask).toMatchObject({
        id: -3,
        ke_hoach_id: mockPlan.id,
        thiet_bi_id: 1000,
        loai_cong_viec: mockPlan.loai_cong_viec,
        thiet_bi: {
          ma_thiet_bi: "TB-1000",
          ten_thiet_bi: "Second Equipment",
          khoa_phong_quan_ly: "Khoa C",
        },
      })

      expect(firstAddedTask.thang_1).toBe(false)
      expect(firstAddedTask.thang_12).toBe(false)
      expect(secondAddedTask.thang_6).toBe(false)

      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Đã thêm vào bản nháp",
        })
      )
    })

    it("handleAddTasksFromDialog does nothing without selected plan", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      const newEquipment: Equipment[] = [
        { id: 999, ma_thiet_bi: "TB-999", ten_thiet_bi: "New Equipment" } as Equipment,
      ]

      act(() => {
        result.current.handleAddTasksFromDialog(newEquipment)
      })

      expect(mocks.setDraftTasks).not.toHaveBeenCalled()
    })
  })

  describe("Delete single task", () => {
    it("confirmDeleteSingleTask removes task from drafts", () => {
      mocks.taskToDelete = createTask(202)
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.confirmDeleteSingleTask()
      })

      expect(mocks.getDraftTasks().map((t) => t.id)).toEqual([101, 303])
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Đã xóa khỏi bản nháp" })
      )
    })

    it("confirmDeleteSingleTask does nothing when no task to delete", () => {
      mocks.taskToDelete = null
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.confirmDeleteSingleTask()
      })

      expect(mocks.getDraftTasks().length).toBe(3)
    })
  })

  describe("Save and cancel changes", () => {
    it("handleSaveAllChanges calls saveAllChanges", async () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      expect(mocks.saveAllChanges).toHaveBeenCalled()
    })

    it("handleCancelAllChanges calls cancelAllChanges and closes dialog", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setIsConfirmingCancel(true)
      })

      expect(result.current.dialogState.isConfirmingCancel).toBe(true)

      act(() => {
        result.current.handleCancelAllChanges()
      })

      expect(mocks.cancelAllChanges).toHaveBeenCalled()
      expect(result.current.dialogState.isConfirmingCancel).toBe(false)
    })
  })

  describe("Auth state exposure", () => {
    it("exposes user and permission flags", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      expect(result.current.user).toBeDefined()
      expect(result.current.canManagePlans).toBe(true)
      expect(result.current.canCompleteTask).toBe(true)
      expect(result.current.isRegionalLeader).toBe(false)
    })
  })

  describe("Existing equipment IDs calculation", () => {
    it("existingEquipmentIdsInDraft returns equipment IDs from draft tasks", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      expect(result.current.existingEquipmentIdsInDraft).toEqual([101, 202, 303])
    })
  })

  describe("Selected task count", () => {
    it("selectedTaskRowsCount returns correct count", () => {
      const wrapper = createWrapper({ "101": true, "303": true }, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      expect(result.current.selectedTaskRowsCount).toBe(2)
    })

    it("selectedTaskRowsCount returns 0 when no tasks selected", () => {
      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      expect(result.current.selectedTaskRowsCount).toBe(0)
    })
  })

  describe("Plan approved state", () => {
    it("isPlanApproved returns true for approved plan", () => {
      const approvedPlan: MaintenancePlan = {
        id: 1,
        ten_ke_hoach: "Approved Plan",
        nam: 2024,
        trang_thai: "Đã duyệt",
        loai_cong_viec: "Bảo dưỡng",
        don_vi_id: 1,
        khoa_phong_id: null,
        khoa_phong: null,
        nguoi_lap_ke_hoach: "Test User",
        ngay_phe_duyet: "2024-01-15T00:00:00Z",
        nguoi_duyet: "Admin",
        ly_do_khong_duyet: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }

      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setSelectedPlan(approvedPlan)
      })

      expect(result.current.isPlanApproved).toBe(true)
    })

    it("isPlanApproved returns false for draft plan", () => {
      const draftPlan: MaintenancePlan = {
        id: 1,
        ten_ke_hoach: "Draft Plan",
        nam: 2024,
        trang_thai: "Bản nháp",
        loai_cong_viec: "Bảo dưỡng",
        don_vi_id: 1,
        khoa_phong_id: null,
        khoa_phong: null,
        nguoi_lap_ke_hoach: "Test User",
        ngay_phe_duyet: null,
        nguoi_duyet: null,
        ly_do_khong_duyet: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }

      const wrapper = createWrapper({}, vi.fn())
      const { result } = renderHook(() => useMaintenanceContext(), { wrapper })

      act(() => {
        result.current.setSelectedPlan(draftPlan)
      })

      expect(result.current.isPlanApproved).toBe(false)
    })
  })
})
