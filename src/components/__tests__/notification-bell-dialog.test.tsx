import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationBellDialog } from "@/components/notification-bell-dialog"

describe("NotificationBellDialog", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

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
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: ResizeObserverMock,
    })
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      value: ResizeObserverMock,
    })
  })

  it("shows dated temperature counts and opens the exact equipment/reading", async () => {
    const user = userEvent.setup()
    render(
      <NotificationBellDialog
        temperature={{
          pending_review: 25,
          open_deviations: 2,
          from_date: "2026-06-01",
          to_date: "2026-06-30",
          items: [
            {
              equipment_id: 42,
              equipment_name: "Tủ lạnh",
              monitoring_date: "2026-06-30",
              reading_id: "reading42",
              kind: "review",
            },
          ],
        }}
      />
    )
    expect(screen.getByText("27")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /mở thông báo/i }))
    expect(screen.getByText("Sổ nhiệt độ · 2026-06-01 – 2026-06-30")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Chờ xác nhận:/ })).toHaveAttribute(
      "href",
      "/temperature-monitoring?kind=review_queue&from=2026-06-01&to=2026-06-30"
    )
    expect(screen.getByRole("link", { name: /Sai lệch mở:/ })).toHaveAttribute(
      "href",
      "/temperature-monitoring?kind=open_deviations&from=2026-06-01&to=2026-06-30"
    )
    expect(screen.getByRole("link", { name: /Tủ lạnh/ })).toHaveAttribute(
      "href",
      "/temperature-monitoring?equipment=42&date=2026-06-30&reading=reading42"
    )
  })

  it("includes maintenance count in the total badge and dialog content", async () => {
    const user = userEvent.setup()

    render(<NotificationBellDialog repairCount={2} transferCount={3} maintenanceCount={4} />)

    expect(screen.getByText("9")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /mở thông báo/i }))

    expect(screen.getByText("Thông báo và Cảnh báo (9)")).toBeInTheDocument()
    const maintenanceSection = screen.getByText("Yêu cầu Bảo trì (4)").closest("section")

    expect(maintenanceSection).not.toBeNull()
    expect(
      within(maintenanceSection!).getByText(
        "Có 4 kế hoạch bảo trì đã được duyệt đang chờ triển khai."
      )
    ).toBeInTheDocument()
    expect(
      within(maintenanceSection!).getByRole("link", { name: "Xem chi tiết →" })
    ).toHaveAttribute("href", "/maintenance")
  })

  it("shows the exact total badge count above 9", () => {
    render(<NotificationBellDialog repairCount={4} transferCount={4} maintenanceCount={4} />)

    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("closes the dialog after clicking a detail link", async () => {
    const user = userEvent.setup()

    render(<NotificationBellDialog repairCount={2} transferCount={0} maintenanceCount={0} />)

    await user.click(screen.getByRole("button", { name: /mở thông báo/i }))
    expect(screen.getByText("Thông báo và Cảnh báo (2)")).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Xem chi tiết →" }))

    await waitFor(() =>
      expect(screen.queryByText("Thông báo và Cảnh báo (2)")).not.toBeInTheDocument()
    )
  })

  it("links the existing bell dialog to notification settings without changing its counts", async () => {
    const user = userEvent.setup()

    render(<NotificationBellDialog repairCount={2} />)

    await user.click(screen.getByRole("button", { name: /mở thông báo/i }))

    expect(screen.getByText("Thông báo và Cảnh báo (2)")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Cài đặt nhận thông báo" })).toHaveAttribute(
      "href",
      "/notifications"
    )
  })
})
