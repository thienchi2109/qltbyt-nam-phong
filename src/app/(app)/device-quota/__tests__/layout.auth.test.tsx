import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mocks.getServerSession(...args),
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
  usePathname: () => "/device-quota/categories",
}))

vi.mock("@/auth/config", () => ({
  authOptions: {},
}))

import DeviceQuotaLayout from "@/app/(app)/device-quota/layout"
import { authOptions } from "@/auth/config"

describe("DeviceQuotaLayout auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects unauthenticated requests to the login page", async () => {
    mocks.getServerSession.mockResolvedValue(null)

    await expect(DeviceQuotaLayout({ children: <div>Protected Child</div> })).rejects.toThrow(
      "NEXT_REDIRECT:/"
    )

    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
    expect(mocks.redirect).toHaveBeenCalledWith("/")
  })

  it.each(["user", "qltb_khoa", "technician"])(
    "redirects %s away from the device quota module",
    async (role) => {
      mocks.getServerSession.mockResolvedValue({
        user: {
          role,
        },
      })

      await expect(DeviceQuotaLayout({ children: <div>Protected Child</div> })).rejects.toThrow(
        "NEXT_REDIRECT:/dashboard"
      )

      expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
      expect(mocks.redirect).toHaveBeenCalledWith("/dashboard")
    }
  )

  it.each(["global", "admin", "regional_leader", "to_qltb"])(
    "renders the device quota layout for allowed role %s",
    async (role) => {
      mocks.getServerSession.mockResolvedValue({
        user: {
          role,
        },
      })

      render(await DeviceQuotaLayout({ children: <div>Protected Child</div> }))

      expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
      expect(mocks.redirect).not.toHaveBeenCalled()
      expect(screen.getByRole("link", { name: "Danh mục & phân loại" })).toHaveAttribute(
        "href",
        "/device-quota/categories"
      )
      expect(screen.queryByRole("link", { name: "Phân loại" })).not.toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "Danh mục" })).not.toBeInTheDocument()
      expect(screen.getByText("Protected Child")).toBeInTheDocument()
    }
  )
})
