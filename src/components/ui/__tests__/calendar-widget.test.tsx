import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CalendarWidget } from "../calendar-widget"

const mockToast = vi.fn()
const mockUseCalendarData = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/hooks/use-calendar-data", () => ({
  useCalendarData: (...args: unknown[]) => mockUseCalendarData(...args),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("CalendarWidget", () => {
  beforeEach(() => {
    mockToast.mockReset()
    mockUseCalendarData.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the calendar header and summary counts from hook data", async () => {
    mockUseCalendarData.mockReturnValue({
      data: {
        departments: ["Khoa A"],
        events: [
          {
            id: 1,
            title: "Bảo trì máy siêu âm",
            type: "Bảo trì",
            date: new Date("2026-04-11T00:00:00.000Z"),
            equipmentCode: "TB-001",
            equipmentName: "Máy siêu âm",
            department: "Khoa A",
            isCompleted: false,
            planName: "Kế hoạch 1",
            planId: 10,
            taskId: 100,
          },
          {
            id: 2,
            title: "Kiểm định monitor",
            type: "Kiểm định",
            date: new Date("2026-04-12T00:00:00.000Z"),
            equipmentCode: "TB-002",
            equipmentName: "Monitor",
            department: "Khoa A",
            isCompleted: true,
            planName: "Kế hoạch 2",
            planId: 20,
            taskId: 200,
          },
        ],
        stats: {
          total: 2,
          completed: 1,
          pending: 1,
          byType: {
            "Bảo trì": 1,
            "Kiểm định": 1,
          },
        },
      },
      error: null,
      isLoading: false,
    })

    render(<CalendarWidget />)

    await waitFor(() => {
      expect(screen.getAllByText("Lịch công việc").length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText("Tổng công việc").length).toBeGreaterThan(0)
    expect(screen.getAllByText("2").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Đã hoàn thành").length).toBeGreaterThan(0)
  })

  it("shows a destructive toast when data loading fails", async () => {
    mockUseCalendarData.mockReturnValue({
      data: undefined,
      error: new Error("RPC failed"),
      isLoading: false,
    })

    render(<CalendarWidget />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi tải dữ liệu",
          description: "RPC failed",
        })
      )
    })
  })

  it("handles swipe gestures even when the touch starts at clientX 0", async () => {
    mockUseCalendarData.mockReturnValue({
      data: {
        departments: [],
        events: [],
        stats: {
          total: 0,
          completed: 0,
          pending: 0,
          byType: {},
        },
      },
      error: null,
      isLoading: false,
    })

    const { container } = render(<CalendarWidget />)

    await waitFor(() => {
      expect(mockUseCalendarData).toHaveBeenCalled()
    })

    const [initialYear, initialMonth] = mockUseCalendarData.mock.calls[0] ?? []
    const swipeSurface = container.querySelector('[class*="md:pt-0"]')

    expect(swipeSurface).not.toBeNull()

    fireEvent.touchStart(swipeSurface!, {
      targetTouches: [{ clientX: 0 }],
    })
    fireEvent.touchMove(swipeSurface!, {
      targetTouches: [{ clientX: 100 }],
    })
    fireEvent.touchEnd(swipeSurface!)

    const expectedMonth = initialMonth === 1 ? 12 : initialMonth - 1
    const expectedYear = initialMonth === 1 ? initialYear - 1 : initialYear

    await waitFor(() => {
      expect(mockUseCalendarData).toHaveBeenLastCalledWith(expectedYear, expectedMonth)
    })
  })
})
