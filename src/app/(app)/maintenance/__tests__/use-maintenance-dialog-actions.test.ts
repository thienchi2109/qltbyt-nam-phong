import * as React from "react"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MaintenanceTask } from "@/lib/data"
import type { Equipment } from "@/lib/data"
import type { MaintenancePlan, MaintenancePlanListResponse } from "@/hooks/use-cached-maintenance"
import { useMaintenanceDialogActions } from "../_hooks/use-maintenance-dialog-actions"

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: 1, ten_ke_hoach: "Kế hoạch A", nam: 2026, loai_cong_viec: "Bảo trì",
    khoa_phong: "Khoa A", nguoi_lap_ke_hoach: "Tester", trang_thai: "Đã duyệt",
    ngay_phe_duyet: null, nguoi_duyet: null, ly_do_khong_duyet: null,
    created_at: "2026-01-01T00:00:00Z", don_vi: 1, facility_name: "Cơ sở A",
    ...overrides,
  }
}

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

function makeEquipment(id: number): Equipment {
  return {
    id,
    ma_thiet_bi: `TB-${id}`,
    ten_thiet_bi: `Thiết bị ${id}`,
    khoa_phong_quan_ly: "Khoa A",
  } as Equipment
}

// ---------------------------------------------------------------------------
// Shared mocks
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
    cancelAllChanges: vi.fn(),
    saveAllChanges: vi.fn(async () => {}),
    fetchTasks: vi.fn(async () => {}),
    queryClient: {
      invalidateQueries: vi.fn(async () => {}),
      getQueriesData: vi.fn(() => []),
    },
  }
})

// ---------------------------------------------------------------------------
// Helper to render with defaults
// ---------------------------------------------------------------------------

function renderDialogActions(
  options: {
    selectedPlan?: MaintenancePlan | null
    hasChanges?: boolean
    draftTasks?: MaintenanceTask[]
  } = {}
) {
  if (options.draftTasks) {
    mocks.setDraftTasksState(options.draftTasks)
  }

  return renderHook(() =>
    useMaintenanceDialogActions({
      selectedPlan: options.selectedPlan ?? null,
      setSelectedPlan: vi.fn(),
      setActiveTab: vi.fn(),
      hasChanges: options.hasChanges ?? false,
      cancelAllChanges: mocks.cancelAllChanges,
      saveAllChanges: mocks.saveAllChanges,
      fetchTasks: mocks.fetchTasks,
      draftTasks: mocks.getDraftTasks(),
      setDraftTasks: mocks.setDraftTasks,
      toast: mocks.toast,
      queryClient: mocks.queryClient as Parameters<typeof useMaintenanceDialogActions>[0]["queryClient"],
    })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMaintenanceDialogActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setDraftTasksState([makeTask(10), makeTask(20)])
  })

  // --- Dialog state setters ---

  describe("dialog state setters", () => {
    it("setIsAddPlanDialogOpen toggles dialog state", () => {
      const { result } = renderDialogActions()

      act(() => { result.current.setIsAddPlanDialogOpen(true) })
      expect(result.current.dialogState.isAddPlanDialogOpen).toBe(true)

      act(() => { result.current.setIsAddPlanDialogOpen(false) })
      expect(result.current.dialogState.isAddPlanDialogOpen).toBe(false)
    })

    it("setEditingPlan sets editing plan in dialog state", () => {
      const plan = makePlan()
      const { result } = renderDialogActions()

      act(() => { result.current.setEditingPlan(plan) })
      expect(result.current.dialogState.editingPlan).toEqual(plan)

      act(() => { result.current.setEditingPlan(null) })
      expect(result.current.dialogState.editingPlan).toBeNull()
    })

    it("setIsConfirmingCancel clears pendingPlanSelection when closing", () => {
      const { result } = renderDialogActions({ selectedPlan: makePlan(), hasChanges: true })

      // Open confirming cancel via handleSelectPlan (sets pendingPlanSelection)
      const newPlan = makePlan({ id: 99 })
      act(() => { result.current.handleSelectPlan(newPlan) })
      expect(result.current.dialogState.isConfirmingCancel).toBe(true)

      // Close confirming cancel → should clear pending
      act(() => { result.current.setIsConfirmingCancel(false) })
      expect(result.current.dialogState.isConfirmingCancel).toBe(false)
    })
  })

  // --- handleSelectPlan ---

  describe("handleSelectPlan", () => {
    it("directly selects plan when no changes", () => {
      const setSelectedPlan = vi.fn()
      const setActiveTab = vi.fn()
      const plan = makePlan({ id: 5 })

      const { result } = renderHook(() =>
        useMaintenanceDialogActions({
          selectedPlan: null,
          setSelectedPlan,
          setActiveTab,
          hasChanges: false,
          cancelAllChanges: mocks.cancelAllChanges,
          saveAllChanges: mocks.saveAllChanges,
          fetchTasks: mocks.fetchTasks,
          draftTasks: [],
          setDraftTasks: mocks.setDraftTasks,
          toast: mocks.toast,
          queryClient: mocks.queryClient as Parameters<typeof useMaintenanceDialogActions>[0]["queryClient"],
        })
      )

      act(() => { result.current.handleSelectPlan(plan) })
      expect(setSelectedPlan).toHaveBeenCalledWith(plan)
      expect(setActiveTab).toHaveBeenCalledWith("tasks")
    })

    it("opens confirm dialog when there are unsaved changes", () => {
      const { result } = renderDialogActions({ selectedPlan: makePlan(), hasChanges: true })

      act(() => { result.current.handleSelectPlan(makePlan({ id: 99 })) })
      expect(result.current.dialogState.isConfirmingCancel).toBe(true)
    })
  })

  // --- handleCancelAllChanges ---

  describe("handleCancelAllChanges", () => {
    it("calls cancelAllChanges and closes confirming dialog", () => {
      const { result } = renderDialogActions()

      act(() => { result.current.handleCancelAllChanges() })
      expect(mocks.cancelAllChanges).toHaveBeenCalled()
      expect(result.current.dialogState.isConfirmingCancel).toBe(false)
    })

    it("navigates to pending plan after cancel", () => {
      const setSelectedPlan = vi.fn()
      const setActiveTab = vi.fn()
      const currentPlan = makePlan({ id: 1 })
      const pendingPlan = makePlan({ id: 99 })

      const { result } = renderHook(() =>
        useMaintenanceDialogActions({
          selectedPlan: currentPlan,
          setSelectedPlan,
          setActiveTab,
          hasChanges: true,
          cancelAllChanges: mocks.cancelAllChanges,
          saveAllChanges: mocks.saveAllChanges,
          fetchTasks: mocks.fetchTasks,
          draftTasks: [],
          setDraftTasks: mocks.setDraftTasks,
          toast: mocks.toast,
          queryClient: mocks.queryClient as Parameters<typeof useMaintenanceDialogActions>[0]["queryClient"],
        })
      )

      // Trigger pending plan
      act(() => { result.current.handleSelectPlan(pendingPlan) })

      // Cancel all changes → should navigate to pending plan
      act(() => { result.current.handleCancelAllChanges() })
      expect(mocks.cancelAllChanges).toHaveBeenCalled()
      expect(setSelectedPlan).toHaveBeenCalledWith(pendingPlan)
      expect(setActiveTab).toHaveBeenCalledWith("tasks")
    })
  })

  // --- handleAddTasksFromDialog ---

  describe("handleAddTasksFromDialog", () => {
    it("is a no-op when selectedPlan is null", () => {
      const { result } = renderDialogActions({ selectedPlan: null })

      act(() => { result.current.handleAddTasksFromDialog([makeEquipment(100)]) })

      expect(mocks.setDraftTasks).not.toHaveBeenCalled()
    })

    it("adds equipment as draft tasks with negative temp IDs", () => {
      const plan = makePlan({ id: 42 })
      const { result } = renderDialogActions({ selectedPlan: plan, draftTasks: [makeTask(10)] })

      act(() => { result.current.handleAddTasksFromDialog([makeEquipment(100), makeEquipment(200)]) })

      const updated = mocks.getDraftTasks()
      // Original task still there
      expect(updated.find((t) => t.id === 10)).toBeTruthy()
      // Two new tasks with negative IDs
      const newTasks = updated.filter((t) => t.id < 0)
      expect(newTasks).toHaveLength(2)
      expect(newTasks[0].ke_hoach_id).toBe(42)
      expect(newTasks[0].thiet_bi?.ma_thiet_bi).toBe("TB-100")

      // Dialog should close
      expect(result.current.dialogState.isAddTasksDialogOpen).toBe(false)
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Đã thêm vào bản nháp" }))
    })
  })

  // --- existingEquipmentIdsInDraft ---

  describe("existingEquipmentIdsInDraft", () => {
    it("returns equipment IDs from draft tasks", () => {
      const { result } = renderDialogActions({
        draftTasks: [makeTask(10, { thiet_bi_id: 100 }), makeTask(20, { thiet_bi_id: 200 })],
      })

      expect(result.current.existingEquipmentIdsInDraft).toEqual([100, 200])
    })
  })

  // --- fetchPlanDetails ---

  describe("fetchPlanDetails", () => {
    it("delegates to fetchTasks", async () => {
      const plan = makePlan()
      const { result } = renderDialogActions()

      await act(async () => { await result.current.fetchPlanDetails(plan) })

      expect(mocks.fetchTasks).toHaveBeenCalledWith(plan)
    })
  })
})
