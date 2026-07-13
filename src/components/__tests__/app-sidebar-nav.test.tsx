import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import { ArrowLeftRight, HardHat, Home, ListChecks, Wrench } from "lucide-react"
import { describe, expect, it } from "vitest"

import { AppSidebarNav } from "../app-sidebar-nav"

describe("AppSidebarNav", () => {
  it("renders technical configurations as one direct sidebar link", () => {
    render(
      <AppSidebarNav
        items={[
          {
            href: "/technical-configurations",
            icon: ListChecks,
            label: "Cấu hình kỹ thuật",
            mobileSection: "more",
          },
        ]}
        pathname="/technical-configurations"
        isSidebarOpen
        notificationCounts={{ repair: 0, transfer: 0, maintenance: 0 }}
      />
    )

    const link = screen.getByRole("link", { name: "Cấu hình kỹ thuật" })
    expect(link).toHaveAttribute("href", "/technical-configurations")
    expect(link).toHaveAttribute("aria-current", "page")
    expect(link).not.toHaveAttribute("aria-haspopup")
  })

  it("renders per-type badges on matching navigation items only", () => {
    render(
      <AppSidebarNav
        items={[
          { href: "/dashboard", icon: Home, label: "Tổng quan" },
          { href: "/repair-requests", icon: Wrench, label: "Yêu cầu sửa chữa", badgeKey: "repair" },
          { href: "/maintenance", icon: HardHat, label: "Bảo trì", badgeKey: "maintenance" },
          { href: "/transfers", icon: ArrowLeftRight, label: "Luân chuyển", badgeKey: "transfer" },
        ]}
        pathname="/dashboard"
        isSidebarOpen
        notificationCounts={{
          repair: 2,
          transfer: 4,
          maintenance: 12,
        }}
        tourAttributes={{
          "/dashboard": "sidebar-nav-dashboard",
          "/repair-requests": "sidebar-nav-repairs",
          "/maintenance": "sidebar-nav-maintenance",
          "/transfers": "sidebar-nav-transfers",
        }}
      />
    )

    const repairLink = screen.getByText("Yêu cầu sửa chữa").closest("a")
    const maintenanceLink = screen.getByText("Bảo trì").closest("a")
    const transferLink = screen.getByText("Luân chuyển").closest("a")
    const dashboardLink = screen.getByText("Tổng quan").closest("a")

    expect(repairLink).not.toBeNull()
    expect(maintenanceLink).not.toBeNull()
    expect(transferLink).not.toBeNull()
    expect(dashboardLink).not.toBeNull()

    expect(within(repairLink!).getByText("2")).toBeInTheDocument()
    expect(within(transferLink!).getByText("4")).toBeInTheDocument()
    expect(within(maintenanceLink!).getByText("12")).toBeInTheDocument()
    expect(within(dashboardLink!).queryByText("2")).not.toBeInTheDocument()
    expect(within(dashboardLink!).queryByText("4")).not.toBeInTheDocument()
    expect(within(dashboardLink!).queryByText("12")).not.toBeInTheDocument()
  })
})
