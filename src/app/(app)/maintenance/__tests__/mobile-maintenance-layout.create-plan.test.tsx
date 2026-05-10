import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  context: {
    user: { role: "global" },
    isAuthLoading: false,
    activeTab: "plans",
    setActiveTab: vi.fn(),
    selectedPlan: null,
    canManagePlans: true,
    canCreatePlans: false,
    setIsAddPlanDialogOpen: vi.fn(),
    handleSelectPlan: vi.fn(),
    operations: {
      openApproveDialog: vi.fn(),
      openRejectDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
    },
    setEditingPlan: vi.fn(),
    tasks: [],
    draftTasks: [],
    hasChanges: false,
    isSavingAll: false,
    isLoadingTasks: false,
    isPlanApproved: false,
    canCompleteTask: true,
    isCompletingTask: new Set<string>(),
    taskEditing: {
      editingTaskId: null,
      editingTaskData: null,
      handleTaskDataChange: vi.fn(),
      handleSaveTask: vi.fn(),
      handleCancelEdit: vi.fn(),
      handleStartEdit: vi.fn(),
      setTaskToDelete: vi.fn(),
    },
    generatePlanForm: vi.fn(),
    setIsConfirmingCancel: vi.fn(),
    handleSaveAllChanges: vi.fn(),
    handleMarkAsCompleted: vi.fn(),
  },
  lastPlanCardsProps: null as { access?: { canCreatePlans?: boolean } } | null,
  lastTasksPanelProps: null as { panelState?: { isLoadingTasks?: boolean } } | null,
}))

vi.mock("@/components/kpi", () => ({
  KpiStatusBar: () => <div data-testid="maintenance-kpi-bar" />,
}))

vi.mock("../_hooks/useMaintenanceContext", () => ({
  useMaintenanceContext: () => mocks.context,
}))

vi.mock("../_components/maintenance-mobile-plan-cards", () => ({
  MaintenanceMobilePlanCards: (props: { access?: { canCreatePlans?: boolean } }) => {
    mocks.lastPlanCardsProps = props
    return <div data-testid="mobile-plan-cards" />
  },
}))

vi.mock("../_components/maintenance-mobile-tasks-panel", () => ({
  MaintenanceMobileTasksPanel: (props: { panelState?: { isLoadingTasks?: boolean } }) => {
    mocks.lastTasksPanelProps = props
    return <div data-testid="mobile-tasks-panel" />
  },
}))

import { MobileMaintenanceLayout } from "../_components/mobile-maintenance-layout"

function renderMobileLayout({
  planSearchTerm = "",
  totalPages = 1,
  totalCount = 0,
  currentPage = 1,
}: {
  planSearchTerm?: string
  totalPages?: number
  totalCount?: number
  currentPage?: number
} = {}) {
  return render(
    <MobileMaintenanceLayout
      countsState={{
        statusCounts: { "Bản nháp": 1 },
        isCountsLoading: false,
        isCountsError: false,
      }}
      plansState={{
        plans: [],
        isLoadingPlans: false,
        planSearchTerm,
        setPlanSearchTerm: vi.fn(),
        onClearSearch: vi.fn(),
      }}
      paginationState={{
        totalPages,
        totalCount,
        currentPage,
        setCurrentPage: vi.fn(),
      }}
      filterState={{ showFacilityFilter: false }}
      expandedTaskIds={{}}
      toggleTaskExpansion={vi.fn()}
    />,
  )
}

describe("MobileMaintenanceLayout create-plan entry points", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.context.user.role = "global"
    mocks.context.canManagePlans = true
    mocks.context.canCreatePlans = false
    mocks.context.activeTab = "plans"
    mocks.context.selectedPlan = null
    mocks.context.isLoadingTasks = false
    mocks.lastPlanCardsProps = null
    mocks.lastTasksPanelProps = null
  })

  it.each(["global", "admin"])("hides create-plan controls for %s users", (role) => {
    mocks.context.user.role = role

    renderMobileLayout()

    expect(screen.queryByRole("button", { name: "Tạo kế hoạch mới" })).not.toBeInTheDocument()
    expect(mocks.lastPlanCardsProps?.access?.canCreatePlans).toBe(false)
  })

  it("keeps create-plan controls available for non-global maintenance managers", () => {
    mocks.context.user.role = "to_qltb"
    mocks.context.canCreatePlans = true

    renderMobileLayout()

    expect(screen.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeInTheDocument()
    expect(mocks.lastPlanCardsProps?.access?.canCreatePlans).toBe(true)
  })

  it("passes grouped task state to the mobile tasks panel", () => {
    mocks.context.activeTab = "tasks"
    mocks.context.selectedPlan = {
      id: 1,
      ten_ke_hoach: "Kế hoạch tháng 5",
      nam: 2026,
      khoa_phong: "Khoa Nội",
      trang_thai: "Bản nháp",
    }
    mocks.context.isLoadingTasks = true

    renderMobileLayout()

    expect(screen.getByTestId("mobile-tasks-panel")).toBeInTheDocument()
    expect(mocks.lastTasksPanelProps?.panelState?.isLoadingTasks).toBe(true)
  })

  it("labels icon-only search and pagination controls", () => {
    renderMobileLayout({ planSearchTerm: "máy thở", totalPages: 3, totalCount: 12, currentPage: 2 })

    expect(screen.getByRole("button", { name: "Xóa tìm kiếm" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trang đầu" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trang cuối" })).toBeInTheDocument()
  })
})
