import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}))

import { HeaderEquipmentSearchEntry } from "@/app/(app)/_components/HeaderEquipmentSearchEntry"

describe("HeaderEquipmentSearchEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the entry only to admin, global, and regional leader users", () => {
    const elevatedRoles = ["admin", "global", "regional_leader"] as const
    const unsupportedRoles = ["to_qltb", "qltb_khoa", "technician", "user"] as const

    for (const role of elevatedRoles) {
      const { unmount } = render(<HeaderEquipmentSearchEntry role={role} />)

      expect(screen.getByRole("searchbox", { name: /tìm kiếm thiết bị/i })).toBeInTheDocument()
      unmount()
    }

    for (const role of unsupportedRoles) {
      const { unmount } = render(<HeaderEquipmentSearchEntry role={role} />)

      expect(
        screen.queryByRole("searchbox", { name: /tìm kiếm thiết bị/i })
      ).not.toBeInTheDocument()
      unmount()
    }
  })

  it("navigates to the Reports equipment-search tab with an encoded keyword on Enter submit", async () => {
    const user = userEvent.setup()
    render(<HeaderEquipmentSearchEntry role="global" />)

    await user.type(
      screen.getByRole("searchbox", { name: /tìm kiếm thiết bị/i }),
      "Máy X-quang & CT{Enter}"
    )

    expect(mocks.routerPush).toHaveBeenCalledWith(
      "/reports?tab=equipment-search&q=M%C3%A1y+X-quang+%26+CT"
    )
  })

  it("navigates to the Reports equipment-search tab with an encoded keyword on button submit", async () => {
    const user = userEvent.setup()
    render(<HeaderEquipmentSearchEntry role="regional_leader" />)

    await user.type(screen.getByRole("searchbox", { name: /tìm kiếm thiết bị/i }), "Monitor% khoa")
    await user.click(screen.getByRole("button", { name: /tìm kiếm thiết bị/i }))

    expect(mocks.routerPush).toHaveBeenCalledWith("/reports?tab=equipment-search&q=Monitor%25+khoa")
  })

  it("does not navigate while the user is only typing", async () => {
    const user = userEvent.setup()
    render(<HeaderEquipmentSearchEntry role="admin" />)

    await user.type(screen.getByRole("searchbox", { name: /tìm kiếm thiết bị/i }), "Máy thở")

    expect(mocks.routerPush).not.toHaveBeenCalled()
  })
})
