import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
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

import { MobileFooterNav } from "@/components/mobile-footer-nav"

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

  it("shows the five field-work tabs without an overflow menu", () => {
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
    const transferLink = screen.getByText("Luân chuyển").closest("a")
    const qrLink = screen.getByText("Quét QR").closest("a")

    expect(screen.getByText("Tổng quan").closest("a")).toHaveAttribute("href", "/dashboard")
    expect(screen.getByText("Thiết bị").closest("a")).toHaveAttribute("href", "/equipment")
    expect(repairLink).not.toBeNull()
    expect(repairLink).toHaveAttribute("href", "/repair-requests")
    expect(transferLink).not.toBeNull()
    expect(transferLink).toHaveAttribute("href", "/transfers")
    expect(qrLink).not.toBeNull()
    expect(qrLink).toHaveAttribute("href", "/qr-scanner?autoStart=1")
    expect(qrLink!.querySelector("svg")).toHaveClass("text-white")
    expect(qrLink!.querySelector("svg")).not.toHaveClass("text-slate-500")

    expect(within(repairLink!).getByText("2")).toBeInTheDocument()
    expect(within(transferLink!).getByText("4")).toBeInTheDocument()

    expect(screen.queryByRole("button", { name: /thêm tùy chọn/i })).not.toBeInTheDocument()
    expect(screen.queryByText("Bảo trì")).not.toBeInTheDocument()
    expect(screen.queryByText("Báo cáo")).not.toBeInTheDocument()
  })
})
