import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MaintenanceTask } from "@/lib/data"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useMaintenanceDrafts } from "../_hooks/use-maintenance-drafts"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  callRpc: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

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

const mockPlan: MaintenancePlan = {
  id: 1,
  ten_ke_hoach: "Test Plan",
  nam: 2024,
  trang_thai: "Bản nháp",
  loai_cong_viec: "Bảo trì",
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

describe("useMaintenanceDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mocks.callRpc.mockReset()
  })

  describe("Initial state", () => {
    it("starts with empty tasks and drafts", () => {
      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: null })
      )

      expect(result.current.tasks).toEqual([])
      expect(result.current.draftTasks).toEqual([])
      expect(result.current.hasChanges).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isSaving).toBe(false)
    })
  })

  describe("getDraftCacheKey", () => {
    it("generates correct cache key", () => {
      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      expect(result.current.getDraftCacheKey(123)).toBe("maintenance_draft_123")
    })
  })

  describe("fetchTasks", () => {
    it("fetches tasks from RPC and sets state", async () => {
      const mockTasks = [createTask(1), createTask(2)]
      mocks.callRpc.mockResolvedValueOnce(mockTasks)

      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "maintenance_tasks_list_with_equipment",
        args: {
          p_ke_hoach_id: 1,
          p_thiet_bi_id: null,
          p_loai_cong_viec: "Bảo trì",
          p_don_vi_thuc_hien: null,
        },
      })

      await waitFor(() => {
        expect(result.current.tasks).toEqual(mockTasks)
        expect(result.current.draftTasks).toEqual(mockTasks)
      })
    })

    it("restores cached draft on fetch", async () => {
      const dbTasks = [createTask(1)]
      const cachedDrafts = [createTask(1, { ghi_chu: "Cached note" })]

      mocks.callRpc.mockResolvedValueOnce(dbTasks)
      // Mock getItem to return cached data for this specific test
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedDrafts))

      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      await waitFor(() => {
        expect(result.current.tasks).toEqual(dbTasks)
        expect(result.current.draftTasks).toEqual(cachedDrafts)
      })

      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Đã tải lại bản nháp chưa lưu của bạn.",
        })
      )
    })

    it("handles fetch error gracefully", async () => {
      mocks.callRpc.mockRejectedValueOnce(new Error("Network error"))

      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      await waitFor(() => {
        expect(result.current.tasks).toEqual([])
        expect(result.current.draftTasks).toEqual([])
      })

      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi tải công việc",
        })
      )
    })
  })

  describe("hasChanges detection", () => {
    it("detects when drafts differ from tasks", async () => {
      const mockTasks = [createTask(1)]
      mocks.callRpc.mockResolvedValueOnce(mockTasks)

      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      expect(result.current.hasChanges).toBe(false)

      act(() => {
        result.current.setDraftTasks([
          { ...createTask(1), ghi_chu: "Modified" },
        ])
      })

      expect(result.current.hasChanges).toBe(true)
    })
  })

  describe("cancelAllChanges", () => {
    it("resets drafts to original tasks", async () => {
      const mockTasks = [createTask(1)]
      mocks.callRpc.mockResolvedValueOnce(mockTasks)

      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      act(() => {
        result.current.setDraftTasks([
          { ...createTask(1), ghi_chu: "Modified" },
        ])
      })

      expect(result.current.hasChanges).toBe(true)

      act(() => {
        result.current.cancelAllChanges()
      })

      expect(result.current.draftTasks).toEqual(mockTasks)
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Đã hủy",
        })
      )
    })

    it("clears localStorage cache on cancel", async () => {
      const mockTasks = [createTask(1)]
      mocks.callRpc.mockResolvedValueOnce(mockTasks)

      const { result } = renderHook(() =>
        useMaintenanceDrafts({ selectedPlan: mockPlan })
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      act(() => {
        result.current.setDraftTasks([
          { ...createTask(1), ghi_chu: "Modified" },
        ])
      })

      act(() => {
        result.current.cancelAllChanges()
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("maintenance_draft_1")
    })
  })

  describe("Clearing state on plan change", () => {
    it("clears tasks when selectedPlan becomes null", async () => {
      const mockTasks = [createTask(1)]
      mocks.callRpc.mockResolvedValueOnce(mockTasks)

      const { result, rerender } = renderHook(
        ({ plan }) => useMaintenanceDrafts({ selectedPlan: plan }),
        { initialProps: { plan: mockPlan as MaintenancePlan | null } }
      )

      await act(async () => {
        await result.current.fetchTasks(mockPlan)
      })

      await waitFor(() => {
        expect(result.current.tasks.length).toBeGreaterThan(0)
      })

      rerender({ plan: null })

      await waitFor(() => {
        expect(result.current.tasks).toEqual([])
        expect(result.current.draftTasks).toEqual([])
      })
    })
  })
})
