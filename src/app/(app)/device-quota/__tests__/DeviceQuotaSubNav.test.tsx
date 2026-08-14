import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeviceQuotaSubNav } from "@/app/(app)/device-quota/_components/DeviceQuotaSubNav"

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

describe("DeviceQuotaSubNav role matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.usePathname.mockReturnValue("/device-quota/mapping")
  })

  it.each(["global", "admin", "to_qltb"])(
    "shows both current Mapping and Categories tabs for equipment-manager role %s",
    (role) => {
      mocks.useSession.mockReturnValue({
        status: "authenticated",
        data: { user: { role, don_vi: "1" } },
      })

      render(<DeviceQuotaSubNav />)

      expect(screen.getByRole("link", { name: "Phân loại" })).toHaveAttribute(
        "href",
        "/device-quota/mapping"
      )
      expect(screen.getByRole("link", { name: "Danh mục" })).toHaveAttribute(
        "href",
        "/device-quota/categories"
      )
    }
  )

  it("keeps regional_leader on Mapping without exposing Categories", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { role: "regional_leader", don_vi: "1" } },
    })

    render(<DeviceQuotaSubNav />)

    expect(screen.getByRole("link", { name: "Phân loại" })).toHaveAttribute(
      "href",
      "/device-quota/mapping"
    )
    expect(screen.getByRole("link", { name: "Phân loại" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Danh mục" })).not.toBeInTheDocument()
  })
})
