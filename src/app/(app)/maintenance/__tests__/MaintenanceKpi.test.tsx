import * as React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCounts = {
  "Bản nháp": 2,
  "Đã duyệt": 3,
  "Không duyệt": 1,
}

const mocks = vi.hoisted(() => ({
  useMaintenanceContext: vi.fn(),
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
    statusCounts,
    isCountsLoading,
    isCountsError,
    onFacilityChange,
    onPlanSearchChange,
  }: {
    statusCounts?: Record<string, number>
    isCountsLoading?: boolean
    isCountsError?: boolean
    onFacilityChange: (facilityId: number | null) => void
    onPlanSearchChange: (value: string) => void
  }) => (
    <div
      data-testid="desktop-layout"
      data-counts={JSON.stringify(statusCounts ?? null)}
      data-loading={String(Boolean(isCountsLoading))}
      data-error={String(Boolean(isCountsError))}
    >
      <button type="button" onClick={() => onFacilityChange(7)}>
        set-facility
      </button>
      <button type="button" onClick={() => onPlanSearchChange("ngoai tim")}>
        set-search
      </button>
    </div>
  ),
}))

vi.mock("../_components/mobile-maintenance-layout", () => ({
  MobileMaintenanceLayout: ({
    statusCounts,
    isCountsLoading,
    isCountsError,
  }: {
    statusCounts?: Record<string, number>
    isCountsLoading?: boolean
    isCountsError?: boolean
  }) => (
    <div
      data-testid="mobile-layout"
      data-counts={JSON.stringify(statusCounts ?? null)}
      data-loading={String(Boolean(isCountsLoading))}
      data-error={String(Boolean(isCountsError))}
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

describe("Maintenance KPI integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useMaintenanceContext.mockReturnValue(createMaintenanceContext())
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

  it("calls useMaintenancePlanCounts with selectedFacilityId from local state", async () => {
    render(<MaintenancePageClient />)

    fireEvent.click(screen.getByRole("button", { name: "set-facility" }))

    await waitFor(() =>
      expect(mocks.useMaintenancePlanCounts).toHaveBeenLastCalledWith({
        facilityId: 7,
        search: undefined,
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
      })
    )
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
