import * as React from "react"
import "@testing-library/jest-dom"
import { flexRender, type CellContext } from "@tanstack/react-table"
import { render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { usePlanColumns, type PlanColumnOptions } from "../_components/maintenance-columns"
import { MaintenanceMobilePlanCards } from "../_components/maintenance-mobile-plan-cards"
import { MaintenancePageLegacyMobileCards } from "../_components/maintenance-page-legacy-mobile-cards"

function makePlan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: 77,
    ten_ke_hoach: "Kế hoạch bảo trì",
    nam: 2026,
    loai_cong_viec: "Bảo dưỡng",
    khoa_phong: null,
    nguoi_lap_ke_hoach: "Nguyễn Văn A",
    trang_thai: "Bản nháp",
    ngay_phe_duyet: null,
    nguoi_duyet: null,
    ly_do_khong_duyet: null,
    created_at: "2026-01-01T00:00:00Z",
    don_vi: 1,
    facility_name: "Cơ sở 1",
    ...overrides,
  }
}

function makePlanColumnOptions(overrides: Partial<PlanColumnOptions> = {}): PlanColumnOptions {
  return {
    sorting: [],
    setSorting: vi.fn(),
    onRowClick: vi.fn(),
    openApproveDialog: vi.fn(),
    openRejectDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    setEditingPlan: vi.fn(),
    canManagePlans: true,
    isRegionalLeader: false,
    ...overrides,
  }
}

function renderPlanActionsCell(options: PlanColumnOptions, plan = makePlan()) {
  const { result } = renderHook(() => usePlanColumns(options))
  const actionsColumn = result.current.find((column) => column.id === "actions")

  if (!actionsColumn?.cell) {
    throw new Error("Missing plan actions column cell")
  }

  return render(
    <>
      {flexRender(actionsColumn.cell, {
        row: { original: plan },
      } as CellContext<MaintenancePlan, unknown>)}
    </>
  )
}

function renderMobilePlanCards(
  actions: Partial<React.ComponentProps<typeof MaintenanceMobilePlanCards>["actions"]> = {}
) {
  return render(
    <MaintenanceMobilePlanCards
      plans={[makePlan()]}
      planState={{ isLoadingPlans: false, showFacilityFilter: false }}
      access={{ canManagePlans: true, canCreatePlans: true }}
      actions={{
        onOpenAddPlanDialog: vi.fn(),
        onSelectPlan: vi.fn(),
        onSetTasksTab: vi.fn(),
        onEditPlan: vi.fn(),
        onOpenApproveDialog: vi.fn(),
        onOpenRejectDialog: vi.fn(),
        onOpenDeleteDialog: vi.fn(),
        ...actions,
      }}
    />
  )
}

describe("Maintenance plan action menus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.pointerEvents = ""
  })

  it("opens the desktop edit dialog only after the plan action menu has closed", async () => {
    const user = userEvent.setup()
    const callbackMenuState: boolean[] = []
    const setEditingPlan = vi.fn(() => {
      callbackMenuState.push(screen.queryByRole("menuitem", { name: "Sửa" }) !== null)
    })

    renderPlanActionsCell(makePlanColumnOptions({ setEditingPlan }))

    await user.click(screen.getByRole("button", { name: "Mở menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Sửa" }))

    await waitFor(() =>
      expect(setEditingPlan).toHaveBeenCalledWith(expect.objectContaining({ id: 77 }))
    )
    expect(callbackMenuState).toEqual([false])
    expect(document.body.style.pointerEvents).not.toBe("none")
  })

  it("opens the mobile delete dialog only after the plan action menu has closed", async () => {
    const user = userEvent.setup()
    const callbackMenuState: boolean[] = []
    const onOpenDeleteDialog = vi.fn(() => {
      callbackMenuState.push(screen.queryByRole("menuitem", { name: "Xóa kế hoạch" }) !== null)
    })

    renderMobilePlanCards({ onOpenDeleteDialog })

    await user.click(screen.getAllByRole("button")[1])
    await user.click(screen.getByRole("menuitem", { name: "Xóa kế hoạch" }))

    await waitFor(() =>
      expect(onOpenDeleteDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 77 }))
    )
    expect(callbackMenuState).toEqual([false])
    expect(document.body.style.pointerEvents).not.toBe("none")
  })

  it("opens the legacy mobile approve dialog only after the plan action menu has closed", async () => {
    const user = userEvent.setup()
    const callbackMenuState: boolean[] = []
    const onOpenApproveDialog = vi.fn(() => {
      callbackMenuState.push(screen.queryByRole("menuitem", { name: "Duyệt" }) !== null)
    })

    render(
      <MaintenancePageLegacyMobileCards
        isLoading={false}
        plans={[makePlan()]}
        canManagePlans
        onSelectPlan={vi.fn()}
        onOpenApproveDialog={onOpenApproveDialog}
        onOpenRejectDialog={vi.fn()}
        onOpenDeleteDialog={vi.fn()}
        onEditPlan={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Mở menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Duyệt" }))

    await waitFor(() =>
      expect(onOpenApproveDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 77 }))
    )
    expect(callbackMenuState).toEqual([false])
    expect(document.body.style.pointerEvents).not.toBe("none")
  })
})
