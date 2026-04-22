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
}))

vi.mock("@/app/(app)/device-quota/_components/DeviceQuotaSubNav", () => ({
  DeviceQuotaSubNav: () => <div data-testid="device-quota-subnav" />,
}))

import DeviceQuotaLayout from "@/app/(app)/device-quota/layout"
import { authOptions } from "@/auth/config"

describe("DeviceQuotaLayout auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects unauthenticated requests to the login page", async () => {
    mocks.getServerSession.mockResolvedValue(null)

    await expect(
      DeviceQuotaLayout({ children: <div>Protected Child</div> })
    ).rejects.toThrow("NEXT_REDIRECT:/")

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

      await expect(
        DeviceQuotaLayout({ children: <div>Protected Child</div> })
      ).rejects.toThrow("NEXT_REDIRECT:/dashboard")

      expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
      expect(mocks.redirect).toHaveBeenCalledWith("/dashboard")
    }
  )

  it("renders the device quota layout for allowed roles", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        role: "to_qltb",
      },
    })

    render(await DeviceQuotaLayout({ children: <div>Protected Child</div> }))

    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("device-quota-subnav")).toBeInTheDocument()
    expect(screen.getByText("Protected Child")).toBeInTheDocument()
  })
})
