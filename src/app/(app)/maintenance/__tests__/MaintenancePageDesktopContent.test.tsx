import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/kpi", () => ({
  KpiStatusBar: () => <div data-testid="maintenance-kpi-bar" />,
}))

vi.mock("../_hooks/useMaintenanceContext", () => ({
  useMaintenanceContext: () => ({
    activeTab: "plans",
    setActiveTab: vi.fn(),
    selectedPlan: null,
    canManagePlans: true,
    setIsAddPlanDialogOpen: vi.fn(),
    handleSelectPlan: vi.fn(),
    isRegionalLeader: false,
    isPlanApproved: false,
    hasChanges: false,
    isSavingAll: false,
    tasks: [],
    isLoadingTasks: false,
    draftTasks: [],
    selectedTaskRowsCount: 0,
    setIsConfirmingCancel: vi.fn(),
    handleSaveAllChanges: vi.fn(),
    generatePlanForm: vi.fn(),
    setIsAddTasksDialogOpen: vi.fn(),
    handleBulkAssignUnit: vi.fn(),
    setIsBulkScheduleOpen: vi.fn(),
    setIsConfirmingBulkDelete: vi.fn(),
    handleMarkAsCompleted: vi.fn(),
    canCompleteTask: false,
    isCompletingTask: false,
    taskEditing: {
      editingTaskId: null,
    },
  }),
}))

vi.mock("../_components/plan-filters-bar", () => ({
  PlanFiltersBar: () => <div data-testid="plan-filters-bar" />,
}))

vi.mock("../_components/plans-table", () => ({
  PlansTable: () => <div data-testid="plans-table" />,
}))

vi.mock("../_components/tasks-table", () => ({
  TasksTable: () => <div data-testid="tasks-table" />,
}))

import { MaintenancePageDesktopContent } from "../_components/maintenance-page-desktop-content"

describe("MaintenancePageDesktopContent", () => {
  it("renders page title above KpiStatusBar and content card", () => {
    render(
      <MaintenancePageDesktopContent
        statusCounts={{ "Bản nháp": 1 }}
        isCountsLoading={false}
        isCountsError={false}
        showFacilityFilter={false}
        facilities={[]}
        selectedFacilityId={null}
        onFacilityChange={vi.fn()}
        isLoadingFacilities={false}
        totalCount={0}
        planSearchTerm=""
        onPlanSearchChange={vi.fn()}
        isMobile={false}
        mobilePlanCards={null}
        planTable={{} as never}
        planColumns={[]}
        currentPage={1}
        totalPages={1}
        pageSize={10}
        plans={[]}
        isLoadingPlans={false}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        isFiltered={false}
        taskTable={{} as never}
        taskColumns={[]}
      />,
    )

    const pageTitle = screen.getByRole("heading", { name: "Kế hoạch bảo trì" })
    const kpiBar = screen.getByTestId("maintenance-kpi-bar")
    const cardTitle = screen.getByText("Danh sách Kế hoạch")

    expect(
      Boolean(pageTitle.compareDocumentPosition(kpiBar) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true)
    expect(
      Boolean(kpiBar.compareDocumentPosition(cardTitle) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true)
  })
})
