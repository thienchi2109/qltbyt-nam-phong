import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeviceQuotaSubNav } from "@/app/(app)/device-quota/_components/DeviceQuotaSubNav"

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
}))

describe("DeviceQuotaSubNav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.usePathname.mockReturnValue("/device-quota/categories")
  })

  it("shows one canonical Categories workspace entry", () => {
    render(<DeviceQuotaSubNav />)

    expect(screen.getByRole("link", { name: "Danh mục & phân loại" })).toHaveAttribute(
      "href",
      "/device-quota/categories"
    )
    expect(screen.getByRole("link", { name: "Danh mục & phân loại" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.queryByRole("link", { name: "Phân loại" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Danh mục" })).not.toBeInTheDocument()
  })

  it("does not expose the Mapping rollback route when it is loaded directly", () => {
    mocks.usePathname.mockReturnValue("/device-quota/mapping")

    render(<DeviceQuotaSubNav />)

    expect(screen.queryByRole("link", { name: "Phân loại" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Danh mục & phân loại" })).not.toHaveAttribute(
      "aria-current"
    )
  })
})
