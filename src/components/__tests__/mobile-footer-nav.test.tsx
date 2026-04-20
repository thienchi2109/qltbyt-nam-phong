import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

import { MobileFooterNav } from "../mobile-footer-nav"

describe("MobileFooterNav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.usePathname.mockReturnValue("/dashboard")
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          role: "global",
        },
      },
    })
  })

  it("shows repair badge on the tab and aggregates hidden counts on the more button", async () => {
    const user = userEvent.setup()

    render(
      <MobileFooterNav
        notificationCounts={{
          repair: 2,
          transfer: 4,
          maintenance: 8,
        }}
      />
    )

    const repairLink = screen.getByText("Sửa chữa").closest("a")
    const moreButton = screen.getByRole("button", { name: /thêm tùy chọn/i })

    expect(repairLink).not.toBeNull()
    expect(within(repairLink!).getByText("2")).toBeInTheDocument()
    expect(within(moreButton).getByText("9+")).toBeInTheDocument()

    await user.click(moreButton)

    const transferLink = screen.getByText("Luân chuyển").closest("a")
    const maintenanceLink = screen.getByText("Bảo trì").closest("a")

    expect(transferLink).not.toBeNull()
    expect(maintenanceLink).not.toBeNull()
    expect(within(transferLink!).getByText("4")).toBeInTheDocument()
    expect(within(maintenanceLink!).getByText("8")).toBeInTheDocument()
  })
})
