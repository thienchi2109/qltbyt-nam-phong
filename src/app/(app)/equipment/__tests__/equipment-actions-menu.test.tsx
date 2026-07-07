import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import "@testing-library/jest-dom"
import type { Equipment } from "@/types/database"

const state = vi.hoisted(() => ({
  role: "user",
  isGlobal: false,
  isRegionalLeader: false,
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  openDetailDialog: vi.fn(),
  openStartUsageDialog: vi.fn(),
  openEndUsageDialog: vi.fn(),
  openDeleteDialog: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    user: {
      id: 1,
      role: state.role,
    },
    isGlobal: state.isGlobal,
    isRegionalLeader: state.isRegionalLeader,
    openDetailDialog: mocks.openDetailDialog,
    openStartUsageDialog: mocks.openStartUsageDialog,
    openEndUsageDialog: mocks.openEndUsageDialog,
    openDeleteDialog: mocks.openDeleteDialog,
  }),
}))

import { EquipmentActionsMenu } from "../../../../components/equipment/equipment-actions-menu"

function setRole(role: string) {
  state.role = role
  state.isGlobal = role === "global" || role === "admin"
  state.isRegionalLeader = role === "regional_leader"
}

function renderMenu() {
  return render(
    <EquipmentActionsMenu
      equipment={{ id: 101, ten_thiet_bi: "TB Test" } as unknown as Equipment}
      activeUsageLogs={[]}
      isLoadingActiveUsage={false}
    />
  )
}

describe("EquipmentActionsMenu delete action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.role = "user"
    state.isGlobal = false
    state.isRegionalLeader = false
    document.body.style.pointerEvents = ""
  })

  it("shows Xóa Thiết bị for global role", async () => {
    const user = userEvent.setup()
    setRole("global")
    renderMenu()

    await user.click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByRole("menuitem", { name: "Xóa Thiết bị" })).toBeInTheDocument()
  })

  it("shows Xóa Thiết bị for to_qltb role", async () => {
    const user = userEvent.setup()
    setRole("to_qltb")
    renderMenu()

    await user.click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByRole("menuitem", { name: "Xóa Thiết bị" })).toBeInTheDocument()
  })

  it("hides Xóa Thiết bị for regional_leader role", () => {
    setRole("regional_leader")
    renderMenu()

    expect(screen.queryByText("Xóa Thiết bị")).not.toBeInTheDocument()
  })

  it("hides Xóa Thiết bị for user role", () => {
    setRole("user")
    renderMenu()

    expect(screen.queryByText("Xóa Thiết bị")).not.toBeInTheDocument()
  })

  it("calls openDeleteDialog when selecting delete action", async () => {
    const user = userEvent.setup()
    setRole("to_qltb")
    renderMenu()

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Xóa Thiết bị" }))

    await waitFor(() =>
      expect(mocks.openDeleteDialog).toHaveBeenCalledWith(
        expect.objectContaining({ id: 101 }),
        "actions_menu"
      )
    )
  })

  it("does not render local delete confirmation dialog content", async () => {
    const user = userEvent.setup()
    setRole("to_qltb")
    renderMenu()

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Xóa Thiết bị" }))

    expect(
      screen.queryByText("Bạn có chắc chắn muốn xóa thiết bị này không?")
    ).not.toBeInTheDocument()
  })

  it("opens details only after the row action menu has closed", async () => {
    const user = userEvent.setup()
    const callbackMenuState: boolean[] = []
    mocks.openDetailDialog.mockImplementation(() => {
      callbackMenuState.push(screen.queryByRole("menuitem", { name: "Xem chi tiết" }) !== null)
    })
    renderMenu()

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Xem chi tiết" }))

    await waitFor(() => expect(mocks.openDetailDialog).toHaveBeenCalledTimes(1))
    expect(callbackMenuState).toEqual([false])
    expect(document.body.style.pointerEvents).not.toBe("none")
  })
})
