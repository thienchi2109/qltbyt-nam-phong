import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import "@testing-library/jest-dom"

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

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  buttonVariants: () => "",
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled, title, ...props }: any) => (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.preventDefault = vi.fn()
        onSelect?.(e)
      }}
      {...props}
    >
      {children}
    </button>
  ),
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
      equipment={{ id: 101, ten_thiet_bi: "TB Test" } as any}
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
  })

  it("shows Xóa Thiết bị for global role", () => {
    setRole("global")
    renderMenu()

    expect(screen.getByText("Xóa Thiết bị")).toBeInTheDocument()
  })

  it("shows Xóa Thiết bị for to_qltb role", () => {
    setRole("to_qltb")
    renderMenu()

    expect(screen.getByText("Xóa Thiết bị")).toBeInTheDocument()
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

  it("calls openDeleteDialog when selecting delete action", () => {
    setRole("to_qltb")
    renderMenu()

    fireEvent.click(screen.getByText("Xóa Thiết bị"))

    expect(mocks.openDeleteDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 101 }),
      "actions_menu"
    )
  })

  it("does not render local delete confirmation dialog content", () => {
    setRole("to_qltb")
    renderMenu()

    fireEvent.click(screen.getByText("Xóa Thiết bị"))

    expect(
      screen.queryByText("Bạn có chắc chắn muốn xóa thiết bị này không?")
    ).not.toBeInTheDocument()
  })
})
