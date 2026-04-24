import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParamsKey: "action=create",
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    toString: () => mocks.searchParamsKey,
  }),
  useRouter: () => ({
    replace: mocks.replace,
  }),
  usePathname: () => "/maintenance",
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

import { useMaintenanceDeepLink } from "../_hooks/use-maintenance-deep-link"

describe("useMaintenanceDeepLink create action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchParamsKey = "action=create"
  })

  it("does not open the create-plan dialog when create is not allowed", async () => {
    const setIsAddPlanDialogOpen = vi.fn()

    renderHook(() =>
      useMaintenanceDeepLink({
        plans: [],
        isLoadingPlans: false,
        setIsAddPlanDialogOpen,
        canCreatePlans: false,
        setSelectedPlan: vi.fn(),
        setActiveTab: vi.fn(),
      })
    )

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/maintenance", { scroll: false }))
    expect(setIsAddPlanDialogOpen).not.toHaveBeenCalled()
  })

  it("opens the create-plan dialog when create is allowed", async () => {
    const setIsAddPlanDialogOpen = vi.fn()

    renderHook(() =>
      useMaintenanceDeepLink({
        plans: [],
        isLoadingPlans: false,
        setIsAddPlanDialogOpen,
        canCreatePlans: true,
        setSelectedPlan: vi.fn(),
        setActiveTab: vi.fn(),
      })
    )

    await waitFor(() => expect(setIsAddPlanDialogOpen).toHaveBeenCalledWith(true))
    expect(mocks.replace).toHaveBeenCalledWith("/maintenance", { scroll: false })
  })
})
