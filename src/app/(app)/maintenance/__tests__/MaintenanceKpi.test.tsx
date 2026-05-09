import * as React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCounts = {
  "Bản nháp": 2,
  "Đã duyệt": 3,
  "Không duyệt": 1,
}

type MaintenancePlanRequest = {
  search: string | undefined
  facilityId: number | null
  page: number
  pageSize: number
}

const mocks = vi.hoisted(() => ({
  useMaintenanceContext: vi.fn(),
  useTenantSelection: vi.fn(),
  useIsMobile: vi.fn(),
  useFeatureFlag: vi.fn(),
  useSearchDebounce: vi.fn(),
  useMaintenancePlans: vi.fn(),
  useMaintenancePlanCounts: vi.fn(),
  useQuery: vi.fn(),
  usePlanColumns: vi.fn(),
  useTaskColumns: vi.fn(),
}))

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mocks.useQuery(...args),
  }
})

vi.mock("@tanstack/react-table", () => ({
  getCoreRowModel: () => vi.fn(),
  getFilteredRowModel: () => vi.fn(),
  getPaginationRowModel: () => vi.fn(),
  getSortedRowModel: () => vi.fn(),
  useReactTable: () => ({
    getRowModel: () => ({ rows: [] }),
  }),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.useIsMobile(),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mocks.useTenantSelection(),
}))

vi.mock("@/lib/feature-flags", () => ({
  useFeatureFlag: () => mocks.useFeatureFlag(),
}))

vi.mock("@/hooks/use-debounce", () => ({
  useSearchDebounce: (...args: unknown[]) => mocks.useSearchDebounce(...args),
}))

vi.mock("@/hooks/use-cached-maintenance", () => ({
  useMaintenancePlans: (...args: unknown[]) => mocks.useMaintenancePlans(...args),
}))

vi.mock("@/hooks/useMaintenancePlanCounts", () => ({
  useMaintenancePlanCounts: (...args: unknown[]) => mocks.useMaintenancePlanCounts(...args),
}))

vi.mock("../_hooks/useMaintenanceContext", () => ({
  useMaintenanceContext: () => mocks.useMaintenanceContext(),
}))

vi.mock("../_hooks/use-maintenance-deep-link", () => ({
  useMaintenanceDeepLink: () => undefined,
}))

vi.mock("../_hooks/use-selected-plan-sync", () => ({
  useSelectedPlanSync: () => undefined,
}))

vi.mock("../_components/maintenance-columns", () => ({
  usePlanColumns: (...args: unknown[]) => mocks.usePlanColumns(...args),
  useTaskColumns: (...args: unknown[]) => mocks.useTaskColumns(...args),
}))

vi.mock("../_components/maintenance-dialogs", () => ({
  MaintenanceDialogs: () => null,
}))

vi.mock("../_components/maintenance-page-legacy-mobile-cards", () => ({
  MaintenancePageLegacyMobileCards: () => <div data-testid="legacy-mobile-cards" />,
}))

vi.mock("../_components/maintenance-page-desktop-content", () => ({
  MaintenancePageDesktopContent: ({
    countsState,
    filterState,
    planListState,
  }: {
    countsState: {
      statusCounts?: Record<string, number>
      isCountsLoading?: boolean
      isCountsError?: boolean
    }
    filterState: {
      totalCount: number
      onPlanSearchChange: (value: string) => void
    }
    planListState: {
      plans: unknown[]
      onPageChange: (page: number) => void
    }
  }) => (
    <div
      data-testid="desktop-layout"
      data-counts={JSON.stringify(countsState.statusCounts ?? null)}
      data-loading={String(Boolean(countsState.isCountsLoading))}
      data-error={String(Boolean(countsState.isCountsError))}
      data-plan-count={String(planListState.plans.length)}
      data-total-count={String(filterState.totalCount)}
    >
      <button type="button" onClick={() => filterState.onPlanSearchChange("ngoai tim")}>
        set-search
      </button>
      <button type="button" onClick={() => planListState.onPageChange(3)}>
        set-page-3
      </button>
    </div>
  ),
}))

vi.mock("../_components/mobile-maintenance-layout", () => ({
  MobileMaintenanceLayout: ({
    countsState,
  }: {
    countsState: {
      statusCounts?: Record<string, number>
      isCountsLoading?: boolean
      isCountsError?: boolean
    }
  }) => (
    <div
      data-testid="mobile-layout"
      data-counts={JSON.stringify(countsState.statusCounts ?? null)}
      data-loading={String(Boolean(countsState.isCountsLoading))}
      data-error={String(Boolean(countsState.isCountsError))}
    />
  ),
}))

import { MaintenancePageClient } from "../_components/MaintenancePageClient"

function createMaintenanceContext() {
  return {
    user: { role: "global" },
    taskRowSelection: {},
    setTaskRowSelection: vi.fn(),
    setIsAddPlanDialogOpen: vi.fn(),
    setSelectedPlan: vi.fn(),
    setActiveTab: vi.fn(),
    selectedPlan: null,
    setDraftTasks: vi.fn(),
    fetchPlanDetails: vi.fn(),
    handleSelectPlan: vi.fn(),
    operations: {
      openApproveDialog: vi.fn(),
      openRejectDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
    },
    setEditingPlan: vi.fn(),
    canManagePlans: true,
    isRegionalLeader: false,
    taskEditing: {
      editingTaskId: null,
      editingTaskData: null,
      setTaskToDelete: vi.fn(),
      handleTaskDataChange: vi.fn(),
      handleSaveTask: vi.fn(),
      handleCancelEdit: vi.fn(),
      handleStartEdit: vi.fn(),
    },
    isPlanApproved: false,
    completionStatus: {},
    isLoadingCompletion: false,
    handleMarkAsCompleted: vi.fn(),
    isCompletingTask: false,
    canCompleteTask: false,
    draftTasks: [],
    activeTab: "plans",
  }
}

function expectLastPlanRequest(request: MaintenancePlanRequest): Promise<void> {
  return waitFor(() => {
    const lastCall = mocks.useMaintenancePlans.mock.calls.at(-1)
    expect(lastCall?.[0]).toEqual(request)
  })
}

function expectPlanRequestMissing(request: MaintenancePlanRequest): void {
  expect(mocks.useMaintenancePlans.mock.calls.map((call) => call[0])).not.toContainEqual(request)
}

function setTenantSelection(selectedFacilityId: number | null | undefined): void {
  mocks.useTenantSelection.mockReturnValue({
    selectedFacilityId,
    setSelectedFacilityId: vi.fn(),
    facilities: [],
    showSelector: true,
    isLoading: false,
    shouldFetchData: selectedFacilityId !== undefined,
  })
}

describe("Maintenance KPI integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useMaintenanceContext.mockReturnValue(createMaintenanceContext())
    setTenantSelection(null)
    mocks.useIsMobile.mockReturnValue(false)
    mocks.useFeatureFlag.mockReturnValue(false)
    mocks.useSearchDebounce.mockImplementation((value: string) => value)
    mocks.useMaintenancePlans.mockReturnValue({
      data: {
        data: [],
        total: 0,
      },
      isLoading: false,
    })
    mocks.useMaintenancePlanCounts.mockReturnValue({
      counts: mockCounts,
      isLoading: false,
      isError: false,
    })
    mocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })
    mocks.usePlanColumns.mockReturnValue([])
    mocks.useTaskColumns.mockReturnValue([])
  })

  it("calls useMaintenancePlanCounts with selectedFacilityId from tenant selection context", async () => {
    setTenantSelection(7)

    render(<MaintenancePageClient />)

    await waitFor(() =>
      expect(mocks.useMaintenancePlanCounts).toHaveBeenLastCalledWith({
        facilityId: 7,
        search: undefined,
        enabled: true,
      })
    )
  })

  it("forwards debouncedPlanSearch to counts hook", async () => {
    render(<MaintenancePageClient />)

    fireEvent.click(screen.getByRole("button", { name: "set-search" }))

    await waitFor(() =>
      expect(mocks.useMaintenancePlanCounts).toHaveBeenLastCalledWith({
        facilityId: null,
        search: "ngoai tim",
        enabled: true,
      })
    )
  })

  it("resets plan pagination when tenant selection context changes", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<MaintenancePageClient />)

    await user.click(screen.getByRole("button", { name: "set-page-3" }))
    await expectLastPlanRequest({ search: undefined, facilityId: null, page: 3, pageSize: 50 })

    setTenantSelection(7)
    rerender(<MaintenancePageClient />)

    expectPlanRequestMissing({ search: undefined, facilityId: 7, page: 3, pageSize: 50 })
    await expectLastPlanRequest({ search: undefined, facilityId: 7, page: 1, pageSize: 50 })
  })

  it("suppresses cached maintenance plans while privileged tenant selection is unresolved", () => {
    setTenantSelection(undefined)
    mocks.useMaintenancePlans.mockReturnValueOnce({
      data: {
        data: [{ id: 42 }],
        total: 1,
      },
      isLoading: false,
    })

    render(<MaintenancePageClient />)

    expect(screen.getByTestId("desktop-layout")).toHaveAttribute("data-plan-count", "0")
    expect(screen.getByTestId("desktop-layout")).toHaveAttribute("data-total-count", "0")
    expect(mocks.useMaintenancePlans).toHaveBeenLastCalledWith(
      expect.objectContaining({ facilityId: null }),
      expect.objectContaining({ enabled: false }),
    )
  })

  it("clears the selected plan and drafts when tenant selection changes", () => {
    const context = {
      ...createMaintenanceContext(),
      selectedPlan: { id: 42, ten_ke_hoach: "Kế hoạch cũ" },
      activeTab: "tasks",
      draftTasks: [{ id: 101 }],
    }
    mocks.useMaintenanceContext.mockReturnValue(context)
    const { rerender } = render(<MaintenancePageClient />)

    setTenantSelection(7)
    rerender(<MaintenancePageClient />)

    expect(context.setSelectedPlan).toHaveBeenCalledWith(null)
    expect(context.setActiveTab).toHaveBeenCalledWith("plans")
    expect(context.setDraftTasks).toHaveBeenCalledWith([])
    expect(context.setTaskRowSelection).toHaveBeenCalled()
  })

  it("resets plan pagination before applying debounced search", async () => {
    const user = userEvent.setup()
    render(<MaintenancePageClient />)

    await user.click(screen.getByRole("button", { name: "set-page-3" }))
    await expectLastPlanRequest({ search: undefined, facilityId: null, page: 3, pageSize: 50 })

    await user.click(screen.getByRole("button", { name: "set-search" }))

    expectPlanRequestMissing({ search: "ngoai tim", facilityId: null, page: 3, pageSize: 50 })
    await expectLastPlanRequest({ search: "ngoai tim", facilityId: null, page: 1, pageSize: 50 })
  })

  it("resets plan pagination when debounced search settles after page navigation", async () => {
    let debouncedPlanSearch = ""
    mocks.useSearchDebounce.mockImplementation(() => debouncedPlanSearch)

    const user = userEvent.setup()
    const { rerender } = render(<MaintenancePageClient />)

    await user.click(screen.getByRole("button", { name: "set-search" }))
    await user.click(screen.getByRole("button", { name: "set-page-3" }))
    await expectLastPlanRequest({ search: undefined, facilityId: null, page: 3, pageSize: 50 })

    // Simulate the mocked debounce value settling after the user navigated.
    debouncedPlanSearch = "ngoai tim"
    rerender(<MaintenancePageClient />)

    expectPlanRequestMissing({ search: "ngoai tim", facilityId: null, page: 3, pageSize: 50 })
    await expectLastPlanRequest({ search: "ngoai tim", facilityId: null, page: 1, pageSize: 50 })
  })

  it("passes loading state to desktop layout", () => {
    mocks.useMaintenancePlanCounts.mockReturnValueOnce({
      counts: mockCounts,
      isLoading: true,
      isError: false,
    })

    render(<MaintenancePageClient />)

    expect(screen.getByTestId("desktop-layout")).toHaveAttribute("data-loading", "true")
  })

  it("passes error state to desktop layout", () => {
    mocks.useMaintenancePlanCounts.mockReturnValueOnce({
      counts: mockCounts,
      isLoading: false,
      isError: true,
    })

    render(<MaintenancePageClient />)

    expect(screen.getByTestId("desktop-layout")).toHaveAttribute("data-error", "true")
  })

  it("renders mobile layout with KPI props", () => {
    mocks.useIsMobile.mockReturnValue(true)
    mocks.useFeatureFlag.mockReturnValue(true)

    render(<MaintenancePageClient />)

    expect(screen.getByTestId("mobile-layout")).toHaveAttribute(
      "data-counts",
      JSON.stringify(mockCounts)
    )
  })

  it("handles undefined counts gracefully", () => {
    mocks.useMaintenancePlanCounts.mockReturnValueOnce({
      counts: undefined,
      isLoading: false,
      isError: false,
    })

    render(<MaintenancePageClient />)

    expect(screen.getByTestId("desktop-layout")).toHaveAttribute("data-counts", "null")
  })
})
