import * as React from "react"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useMaintenanceOperations } from "../_hooks/use-maintenance-operations"

const mocks = vi.hoisted(() => ({
  approveMutate: vi.fn(),
  rejectMutate: vi.fn(),
  deleteMutate: vi.fn(),
}))

vi.mock("@/hooks/use-cached-maintenance", async () => {
  const actual = await vi.importActual("@/hooks/use-cached-maintenance")
  return {
    ...actual,
    useApproveMaintenancePlan: () => ({
      mutate: mocks.approveMutate,
      isPending: false,
    }),
    useRejectMaintenancePlan: () => ({
      mutate: mocks.rejectMutate,
      isPending: false,
    }),
    useDeleteMaintenancePlan: () => ({
      mutate: mocks.deleteMutate,
      isPending: false,
    }),
  }
})

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe("useMaintenanceOperations", () => {
  let setSelectedPlan: React.Dispatch<React.SetStateAction<MaintenancePlan | null>>
  let setActiveTab: React.Dispatch<React.SetStateAction<string>>
  let getDraftCacheKey: (planId: number) => string

  beforeEach(() => {
    setSelectedPlan = vi.fn()
    setActiveTab = vi.fn()
    getDraftCacheKey = vi.fn((planId) => `maintenance_draft_${planId}`)
    vi.clearAllMocks()
  })

  describe("Initial state", () => {
    it("starts with no dialog open", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      expect(result.current.confirmDialog.type).toBeNull()
      expect(result.current.confirmDialog.plan).toBeNull()
      expect(result.current.confirmDialog.rejectionReason).toBe("")
    })
  })

  describe("Dialog openers", () => {
    it("openApproveDialog sets dialog state", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openApproveDialog(mockPlan)
      })

      expect(result.current.confirmDialog.type).toBe("approve")
      expect(result.current.confirmDialog.plan).toEqual(mockPlan)
    })

    it("openRejectDialog sets dialog state", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openRejectDialog(mockPlan)
      })

      expect(result.current.confirmDialog.type).toBe("reject")
      expect(result.current.confirmDialog.plan).toEqual(mockPlan)
    })

    it("openDeleteDialog sets dialog state", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openDeleteDialog(mockPlan)
      })

      expect(result.current.confirmDialog.type).toBe("delete")
      expect(result.current.confirmDialog.plan).toEqual(mockPlan)
    })
  })

  describe("closeDialog", () => {
    it("resets dialog state", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openApproveDialog(mockPlan)
      })

      expect(result.current.confirmDialog.type).toBe("approve")

      act(() => {
        result.current.closeDialog()
      })

      expect(result.current.confirmDialog.type).toBeNull()
      expect(result.current.confirmDialog.plan).toBeNull()
    })
  })

  describe("setRejectionReason", () => {
    it("updates rejection reason in dialog state", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openRejectDialog(mockPlan)
      })

      act(() => {
        result.current.setRejectionReason("Thiếu thông tin")
      })

      expect(result.current.confirmDialog.rejectionReason).toBe("Thiếu thông tin")
    })
  })

  describe("handleApprovePlan", () => {
    it("calls approve mutation with correct args", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openApproveDialog(mockPlan)
      })

      act(() => {
        result.current.handleApprovePlan()
      })

      expect(mocks.approveMutate).toHaveBeenCalledWith(
        { id: 1, nguoi_duyet: "Test User" },
        expect.any(Object)
      )
    })

    it("handles approve success by updating selected plan and closing dialog", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openApproveDialog(mockPlan)
      })

      act(() => {
        result.current.handleApprovePlan()
      })

      const [, options] = mocks.approveMutate.mock.calls[0]

      act(() => {
        options.onSuccess()
      })

      expect(setSelectedPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPlan.id,
          trang_thai: "Đã duyệt",
          ngay_phe_duyet: expect.any(String),
        })
      )
      expect(result.current.confirmDialog.type).toBeNull()
      expect(result.current.confirmDialog.plan).toBeNull()
    })

    it("does nothing when no plan in dialog", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleApprovePlan()
      })

      expect(mocks.approveMutate).not.toHaveBeenCalled()
    })
  })

  describe("handleRejectPlan", () => {
    it("calls reject mutation with reason", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openRejectDialog(mockPlan)
      })

      act(() => {
        result.current.setRejectionReason("Không đủ điều kiện")
      })

      act(() => {
        result.current.handleRejectPlan()
      })

      expect(mocks.rejectMutate).toHaveBeenCalledWith(
        {
          id: 1,
          nguoi_duyet: "Test User",
          ly_do: "Không đủ điều kiện",
        },
        expect.any(Object)
      )
    })

    it("handles reject success by updating selected plan and closing dialog", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openRejectDialog(mockPlan)
        result.current.setRejectionReason("Không đáp ứng điều kiện")
      })

      act(() => {
        result.current.handleRejectPlan()
      })

      const [, options] = mocks.rejectMutate.mock.calls[0]

      act(() => {
        options.onSuccess()
      })

      expect(setSelectedPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPlan.id,
          trang_thai: "Không duyệt",
          ngay_phe_duyet: expect.any(String),
        })
      )
      expect(result.current.confirmDialog.type).toBeNull()
      expect(result.current.confirmDialog.plan).toBeNull()
    })

    it("does nothing when rejection reason is empty", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openRejectDialog(mockPlan)
      })

      // Don't set rejection reason

      act(() => {
        result.current.handleRejectPlan()
      })

      expect(mocks.rejectMutate).not.toHaveBeenCalled()
    })

    it("does nothing when rejection reason is whitespace only", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openRejectDialog(mockPlan)
      })

      act(() => {
        result.current.setRejectionReason("   ")
      })

      act(() => {
        result.current.handleRejectPlan()
      })

      expect(mocks.rejectMutate).not.toHaveBeenCalled()
    })
  })

  describe("handleDeletePlan", () => {
    it("calls delete mutation with plan ID", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openDeleteDialog(mockPlan)
      })

      act(() => {
        result.current.handleDeletePlan()
      })

      expect(mocks.deleteMutate).toHaveBeenCalledWith(1, expect.any(Object))
    })

    it("handles delete success by clearing draft cache and resetting selection", () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem")

      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openDeleteDialog(mockPlan)
      })

      act(() => {
        result.current.handleDeletePlan()
      })

      const [, options] = mocks.deleteMutate.mock.calls[0]

      act(() => {
        options.onSuccess()
      })

      expect(getDraftCacheKey).toHaveBeenCalledWith(mockPlan.id)
      expect(removeItemSpy).toHaveBeenCalledWith("maintenance_draft_1")
      expect(setSelectedPlan).toHaveBeenCalledWith(null)
      expect(setActiveTab).toHaveBeenCalledWith("plans")
      expect(result.current.confirmDialog.type).toBeNull()
      expect(result.current.confirmDialog.plan).toBeNull()

      removeItemSpy.mockRestore()
    })

    it("does nothing when no plan in dialog", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: null,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { full_name: "Test User" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleDeletePlan()
      })

      expect(mocks.deleteMutate).not.toHaveBeenCalled()
    })
  })

  describe("User name fallback", () => {
    it("uses username when full_name is missing", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: { username: "testuser" },
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openApproveDialog(mockPlan)
      })

      act(() => {
        result.current.handleApprovePlan()
      })

      expect(mocks.approveMutate).toHaveBeenCalledWith(
        { id: 1, nguoi_duyet: "testuser" },
        expect.any(Object)
      )
    })

    it("uses empty string when no user info", () => {
      const { result } = renderHook(
        () =>
          useMaintenanceOperations({
            selectedPlan: mockPlan,
            setSelectedPlan,
            setActiveTab,
            getDraftCacheKey,
            user: null,
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.openApproveDialog(mockPlan)
      })

      act(() => {
        result.current.handleApprovePlan()
      })

      expect(mocks.approveMutate).toHaveBeenCalledWith(
        { id: 1, nguoi_duyet: "" },
        expect.any(Object)
      )
    })
  })
})
