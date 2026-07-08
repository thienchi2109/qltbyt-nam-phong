import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerMocks.push,
  }),
}))

import { DeviceQuotaDecisionsContext, type Decision } from "../DeviceQuotaDecisionsContext"
import { DeviceQuotaDecisionsTable } from "../DeviceQuotaDecisionsTable"

type DecisionsContextValue = NonNullable<
  React.ComponentProps<typeof DeviceQuotaDecisionsContext.Provider>["value"]
>

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 101,
    don_vi_id: 1,
    so_quyet_dinh: "QD-101",
    ngay_ban_hanh: "2026-01-01",
    ngay_hieu_luc: "2026-02-01",
    ngay_het_hieu_luc: null,
    nguoi_ky: "Nguyen Van A",
    chuc_vu_nguoi_ky: "Giam doc",
    trang_thai: "draft",
    ghi_chu: null,
    thay_the_cho_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    total_categories: 0,
    total_equipment_mapped: 0,
    ...overrides,
  }
}

function makeMutation(): DecisionsContextValue["activateMutation"] {
  return {
    mutate: vi.fn(),
    isPending: false,
  } as DecisionsContextValue["activateMutation"]
}

function renderTable(contextOverrides: Partial<DecisionsContextValue> = {}) {
  const value: DecisionsContextValue = {
    user: null,
    donViId: 1,
    decisions: [makeDecision()],
    statusFilter: "all",
    setStatusFilter: vi.fn(),
    dialogState: {
      isCreateOpen: false,
      isEditOpen: false,
      selectedDecision: null,
    },
    isCreateDialogOpen: false,
    isEditDialogOpen: false,
    selectedDecision: null,
    openCreateDialog: vi.fn(),
    openEditDialog: vi.fn(),
    closeDialogs: vi.fn(),
    createMutation: makeMutation(),
    updateMutation: makeMutation(),
    activateMutation: makeMutation(),
    deleteMutation: makeMutation(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    invalidateAndRefetch: vi.fn(),
    ...contextOverrides,
  }

  return render(
    <DeviceQuotaDecisionsContext.Provider value={value}>
      <DeviceQuotaDecisionsTable />
    </DeviceQuotaDecisionsContext.Provider>
  )
}

describe("DeviceQuotaDecisionsTable row action menu", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.pointerEvents = ""
  })

  it("opens the edit dialog only after the row action menu has closed", async () => {
    const user = userEvent.setup()
    const callbackMenuState: boolean[] = []
    const openEditDialog = vi.fn(() => {
      callbackMenuState.push(screen.queryByRole("menuitem", { name: "Chỉnh sửa" }) !== null)
    })

    renderTable({ openEditDialog })

    await user.click(screen.getByRole("button", { name: "Mở menu hành động" }))
    await user.click(screen.getByRole("menuitem", { name: "Chỉnh sửa" }))

    await waitFor(() =>
      expect(openEditDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 101 }))
    )
    expect(callbackMenuState).toEqual([false])
    expect(document.body.style.pointerEvents).not.toBe("none")
  })
})
