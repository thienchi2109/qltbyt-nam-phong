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
  },
  lastPlanCardsProps: null as { canCreatePlans?: boolean } | null,
}))

vi.mock("@/components/kpi", () => ({
  KpiStatusBar: () => <div data-testid="maintenance-kpi-bar" />,
}))

vi.mock("../_hooks/useMaintenanceContext", () => ({
  useMaintenanceContext: () => mocks.context,
}))

vi.mock("../_components/maintenance-mobile-plan-cards", () => ({
  MaintenanceMobilePlanCards: (props: { canCreatePlans?: boolean }) => {
    mocks.lastPlanCardsProps = props
    return <div data-testid="mobile-plan-cards" />
  },
}))

vi.mock("../_components/maintenance-mobile-tasks-panel", () => ({
  MaintenanceMobileTasksPanel: () => <div data-testid="mobile-tasks-panel" />,
}))

import { MobileMaintenanceLayout } from "../_components/mobile-maintenance-layout"

function renderMobileLayout() {
  return render(
    <MobileMaintenanceLayout
      statusCounts={{ "Bản nháp": 1 }}
      isCountsLoading={false}
      isCountsError={false}
      plans={[]}
      isLoadingPlans={false}
      planSearchTerm=""
      setPlanSearchTerm={vi.fn()}
      onClearSearch={vi.fn()}
      totalPages={1}
      totalCount={0}
      currentPage={1}
      setCurrentPage={vi.fn()}
      showFacilityFilter={false}
      facilities={[]}
      selectedFacilityId={null}
      isLoadingFacilities={false}
      isMobileFilterSheetOpen={false}
      setIsMobileFilterSheetOpen={vi.fn()}
      pendingFacilityFilter={null}
      setPendingFacilityFilter={vi.fn()}
      handleMobileFilterApply={vi.fn()}
      handleMobileFilterClear={vi.fn()}
      activeMobileFilterCount={0}
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
    mocks.lastPlanCardsProps = null
  })

  it.each(["global", "admin"])("hides create-plan controls for %s users", (role) => {
    mocks.context.user.role = role

    renderMobileLayout()

    expect(screen.queryByRole("button", { name: "Tạo kế hoạch mới" })).not.toBeInTheDocument()
    expect(mocks.lastPlanCardsProps?.canCreatePlans).toBe(false)
  })

  it("keeps create-plan controls available for non-global maintenance managers", () => {
    mocks.context.user.role = "to_qltb"
    mocks.context.canCreatePlans = true

    renderMobileLayout()

    expect(screen.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeInTheDocument()
    expect(mocks.lastPlanCardsProps?.canCreatePlans).toBe(true)
  })
})
