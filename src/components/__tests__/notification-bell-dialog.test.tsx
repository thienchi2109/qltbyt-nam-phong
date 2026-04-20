import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationBellDialog } from "../notification-bell-dialog"

describe("NotificationBellDialog", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("includes maintenance count in the total badge and dialog content", async () => {
    const user = userEvent.setup()

    render(
      <NotificationBellDialog
        repairCount={2}
        transferCount={3}
        maintenanceCount={4}
      />
    )

    expect(screen.getByText("9")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /mở thông báo/i }))

    expect(screen.getByText("Thông báo và Cảnh báo (9)")).toBeInTheDocument()
    const maintenanceSection = screen.getByText("Yêu cầu Bảo trì (4)").closest("section")

    expect(maintenanceSection).not.toBeNull()
    expect(
      within(maintenanceSection!).getByText("Có 4 kế hoạch bảo trì đã được duyệt đang chờ triển khai.")
    ).toBeInTheDocument()
    expect(within(maintenanceSection!).getByRole("link", { name: "Xem chi tiết →" })).toHaveAttribute(
      "href",
      "/maintenance"
    )
  })

  it("caps the total badge at 9+", () => {
    render(
      <NotificationBellDialog
        repairCount={4}
        transferCount={4}
        maintenanceCount={4}
      />
    )

    expect(screen.getByText("9+")).toBeInTheDocument()
  })
})
