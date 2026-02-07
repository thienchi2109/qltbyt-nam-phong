import * as React from "react"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MaintenanceTask } from "@/lib/data"
import { useTaskEditing } from "../_components/task-editing"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}))

function createTask(id: number, overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
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
    ...overrides,
  }
}

describe("useTaskEditing", () => {
  let draftTasks: MaintenanceTask[]
  let setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>

  beforeEach(() => {
    draftTasks = [createTask(1), createTask(2), createTask(3)]
    setDraftTasks = vi.fn((updater) => {
      draftTasks = typeof updater === "function" ? updater(draftTasks) : updater
    })
    vi.clearAllMocks()
  })

  describe("Initial state", () => {
    it("starts with no task being edited", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      expect(result.current.editingTaskId).toBeNull()
      expect(result.current.editingTaskData).toBeNull()
      expect(result.current.taskToDelete).toBeNull()
    })
  })

  describe("handleStartEdit", () => {
    it("sets editing state with task data", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      const taskToEdit = createTask(2, { ghi_chu: "Test note" })

      act(() => {
        result.current.handleStartEdit(taskToEdit)
      })

      expect(result.current.editingTaskId).toBe(2)
      expect(result.current.editingTaskData).toEqual(expect.objectContaining({
        id: 2,
        ghi_chu: "Test note",
      }))
    })

    it("does not start editing when user cannot manage plans", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: false,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(2))
      })

      expect(result.current.editingTaskId).toBeNull()
      expect(result.current.editingTaskData).toBeNull()
    })

    it("does not start editing when plan is approved", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: true,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(2))
      })

      expect(result.current.editingTaskId).toBeNull()
      expect(result.current.editingTaskData).toBeNull()
    })
  })

  describe("handleCancelEdit", () => {
    it("clears editing state", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(2))
      })

      expect(result.current.editingTaskId).toBe(2)

      act(() => {
        result.current.handleCancelEdit()
      })

      expect(result.current.editingTaskId).toBeNull()
      expect(result.current.editingTaskData).toBeNull()
    })
  })

  describe("handleTaskDataChange", () => {
    it("updates editing data field", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(1))
      })

      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Updated note")
      })

      expect(result.current.editingTaskData?.ghi_chu).toBe("Updated note")
    })

    it("updates month schedule field", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(1))
      })

      act(() => {
        result.current.handleTaskDataChange("thang_6", true)
      })

      expect(result.current.editingTaskData?.thang_6).toBe(true)
    })

    it("updates don_vi_thuc_hien field", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(1))
      })

      act(() => {
        result.current.handleTaskDataChange("don_vi_thuc_hien", "Nội bộ")
      })

      expect(result.current.editingTaskData?.don_vi_thuc_hien).toBe("Nội bộ")
    })

    it("does nothing when not editing", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Test")
      })

      expect(result.current.editingTaskData).toBeNull()
    })

    it("does not update editing data when user cannot manage plans", () => {
      const { result, rerender } = renderHook(
        ({ canManagePlans, isPlanApproved }) =>
          useTaskEditing({
            draftTasks,
            setDraftTasks,
            canManagePlans,
            isPlanApproved,
          }),
        {
          initialProps: {
            canManagePlans: true,
            isPlanApproved: false,
          },
        }
      )

      act(() => {
        result.current.handleStartEdit(createTask(1, { ghi_chu: "Original" }))
      })

      rerender({
        canManagePlans: false,
        isPlanApproved: false,
      })

      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Blocked change")
      })

      expect(result.current.editingTaskData?.ghi_chu).toBe("Original")
    })

    it("does not update editing data when plan is approved", () => {
      const { result, rerender } = renderHook(
        ({ canManagePlans, isPlanApproved }) =>
          useTaskEditing({
            draftTasks,
            setDraftTasks,
            canManagePlans,
            isPlanApproved,
          }),
        {
          initialProps: {
            canManagePlans: true,
            isPlanApproved: false,
          },
        }
      )

      act(() => {
        result.current.handleStartEdit(createTask(1, { ghi_chu: "Original" }))
      })

      rerender({
        canManagePlans: true,
        isPlanApproved: true,
      })

      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Blocked change")
      })

      expect(result.current.editingTaskData?.ghi_chu).toBe("Original")
    })
  })

  describe("handleSaveTask", () => {
    it("updates draft tasks with edited data", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleStartEdit(createTask(2))
      })

      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Saved note")
        result.current.handleTaskDataChange("don_vi_thuc_hien", "Thuê ngoài")
      })

      act(() => {
        result.current.handleSaveTask()
      })

      expect(setDraftTasks).toHaveBeenCalled()
      expect(result.current.editingTaskId).toBeNull()
      expect(result.current.editingTaskData).toBeNull()
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Thành công",
          description: "Đã cập nhật công việc",
        })
      )
    })

    it("does nothing when not editing", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.handleSaveTask()
      })

      expect(setDraftTasks).not.toHaveBeenCalled()
      expect(mocks.toast).not.toHaveBeenCalled()
    })

    it("does not save when user cannot manage plans", () => {
      const { result, rerender } = renderHook(
        ({ canManagePlans, isPlanApproved }) =>
          useTaskEditing({
            draftTasks,
            setDraftTasks,
            canManagePlans,
            isPlanApproved,
          }),
        {
          initialProps: {
            canManagePlans: true,
            isPlanApproved: false,
          },
        }
      )

      act(() => {
        result.current.handleStartEdit(createTask(2))
        result.current.handleTaskDataChange("ghi_chu", "Saved note")
      })

      rerender({
        canManagePlans: false,
        isPlanApproved: false,
      })

      act(() => {
        result.current.handleSaveTask()
      })

      expect(setDraftTasks).not.toHaveBeenCalled()
      expect(mocks.toast).not.toHaveBeenCalled()
      expect(result.current.editingTaskId).toBe(2)
      expect(result.current.editingTaskData?.ghi_chu).toBe("Saved note")
    })

    it("does not save when plan is approved", () => {
      const { result, rerender } = renderHook(
        ({ canManagePlans, isPlanApproved }) =>
          useTaskEditing({
            draftTasks,
            setDraftTasks,
            canManagePlans,
            isPlanApproved,
          }),
        {
          initialProps: {
            canManagePlans: true,
            isPlanApproved: false,
          },
        }
      )

      act(() => {
        result.current.handleStartEdit(createTask(2))
        result.current.handleTaskDataChange("ghi_chu", "Saved note")
      })

      rerender({
        canManagePlans: true,
        isPlanApproved: true,
      })

      act(() => {
        result.current.handleSaveTask()
      })

      expect(setDraftTasks).not.toHaveBeenCalled()
      expect(mocks.toast).not.toHaveBeenCalled()
      expect(result.current.editingTaskId).toBe(2)
      expect(result.current.editingTaskData?.ghi_chu).toBe("Saved note")
    })
  })

  describe("setTaskToDelete", () => {
    it("sets task to delete", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      const task = createTask(3)

      act(() => {
        result.current.setTaskToDelete(task)
      })

      expect(result.current.taskToDelete).toEqual(task)
    })

    it("clears task to delete when set to null", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      act(() => {
        result.current.setTaskToDelete(createTask(3))
      })

      expect(result.current.taskToDelete).not.toBeNull()

      act(() => {
        result.current.setTaskToDelete(null)
      })

      expect(result.current.taskToDelete).toBeNull()
    })
  })

  describe("Edit workflow", () => {
    it("completes full edit-save cycle", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      // Start editing
      act(() => {
        result.current.handleStartEdit(createTask(1, { ghi_chu: "Original" }))
      })

      expect(result.current.editingTaskId).toBe(1)
      expect(result.current.editingTaskData?.ghi_chu).toBe("Original")

      // Make changes
      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Modified")
        result.current.handleTaskDataChange("thang_3", true)
      })

      expect(result.current.editingTaskData?.ghi_chu).toBe("Modified")
      expect(result.current.editingTaskData?.thang_3).toBe(true)

      // Save
      act(() => {
        result.current.handleSaveTask()
      })

      expect(result.current.editingTaskId).toBeNull()
      expect(setDraftTasks).toHaveBeenCalled()
      expect(mocks.toast).toHaveBeenCalled()
    })

    it("completes full edit-cancel cycle", () => {
      const { result } = renderHook(() =>
        useTaskEditing({
          draftTasks,
          setDraftTasks,
          canManagePlans: true,
          isPlanApproved: false,
        })
      )

      // Start editing
      act(() => {
        result.current.handleStartEdit(createTask(1))
      })

      // Make changes
      act(() => {
        result.current.handleTaskDataChange("ghi_chu", "Unsaved changes")
      })

      // Cancel
      act(() => {
        result.current.handleCancelEdit()
      })

      expect(result.current.editingTaskId).toBeNull()
      expect(result.current.editingTaskData).toBeNull()
      // setDraftTasks should NOT be called on cancel
      expect(setDraftTasks).not.toHaveBeenCalled()
    })
  })
})
