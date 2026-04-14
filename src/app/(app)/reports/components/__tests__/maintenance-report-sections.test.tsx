import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDynamicBarChart = vi.fn(() => <div data-testid="bar-chart" />)
const mockDynamicLineChart = vi.fn(() => <div data-testid="line-chart" />)
const mockDynamicPieChart = vi.fn(() => <div data-testid="pie-chart" />)

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (range?: { from?: Date; to?: Date }) => void }) => (
    <button
      type="button"
      onClick={() => onSelect?.({ from: new Date("2026-04-14T00:00:00.000Z") })}
    >
      Select start date
    </button>
  ),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode; className?: string; title?: string }) => <td>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode; className?: string }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode; className?: string }) => <tr>{children}</tr>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode; variant?: string }) => <span>{children}</span>,
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicBarChart: (props: unknown) => mockDynamicBarChart(props),
  DynamicLineChart: (props: unknown) => mockDynamicLineChart(props),
  DynamicPieChart: (props: unknown) => mockDynamicPieChart(props),
}))

import { MaintenanceReportDateFilter } from "../maintenance-report-date-filter"
import { MaintenanceReportPlanChart } from "../maintenance-report-plan-chart"
import { MaintenanceReportRepairCharts } from "../maintenance-report-repair-charts"
import { MaintenanceReportRepairTables } from "../maintenance-report-repair-tables"

describe("maintenance report sections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("formats a single selected date with the Vietnamese locale and preserves it as a one-day range", () => {
    const onDateRangeChange = vi.fn()
    const selectedDate = new Date("2026-04-14T00:00:00.000Z")

    render(
      <MaintenanceReportDateFilter
        dateRange={{ from: selectedDate }}
        onDateRangeChange={onDateRangeChange}
      />
    )

    expect(screen.getByText("Thg 4 14, 2026")).toBeInTheDocument()

    screen.getByRole("button", { name: "Select start date" }).click()

    expect(onDateRangeChange).toHaveBeenCalledWith({
      from: selectedDate,
      to: selectedDate,
    })
  })

  it("renders repair chart cards and forwards chart data", () => {
    const repairTrendData = [
      { period: "Thg 1 2026", totalRequests: 9, completedRequests: 7 },
    ]
    const repairStatusData = [
      { name: "Hoàn thành", value: 7, color: "#22c55e" },
    ]

    render(
      <MaintenanceReportRepairCharts
        isLoading={false}
        repairTrendData={repairTrendData}
        repairStatusData={repairStatusData}
      />
    )

    expect(screen.getByText("Xu hướng sửa chữa theo thời gian")).toBeInTheDocument()
    expect(screen.getByText("Tình trạng yêu cầu sửa chữa")).toBeInTheDocument()
    expect(mockDynamicLineChart).toHaveBeenCalledWith(
      expect.objectContaining({ data: repairTrendData })
    )
    expect(mockDynamicPieChart).toHaveBeenCalledWith(
      expect.objectContaining({ data: repairStatusData })
    )
  })

  it("renders maintenance plan empty state when no plan chart data is available", () => {
    render(<MaintenanceReportPlanChart isLoading={false} maintenancePlanData={[]} />)

    expect(screen.getByText("Kế hoạch vs. Thực tế")).toBeInTheDocument()
    expect(screen.getByText("Không có dữ liệu kế hoạch bảo trì.")).toBeInTheDocument()
    expect(mockDynamicBarChart).not.toHaveBeenCalled()
  })

  it("renders repair tables with formatted counts and dates", () => {
    const numberFormatter = new Intl.NumberFormat("vi-VN")
    const formatDateDisplay = (value?: string | null) => (value ? "12/04/2026" : "—")

    render(
      <MaintenanceReportRepairTables
        isLoading={false}
        topEquipmentRows={[
          {
            equipmentId: 1,
            name: "Máy thở",
            totalRequests: 5,
            rank: 1,
            latestStatus: "Hoàn thành",
            latestCompletedDate: "2026-04-12",
          },
        ]}
        recentRepairHistory={[
          {
            id: 99,
            equipmentName: "Monitor",
            issue: "Không lên nguồn",
            requestedDate: "2026-04-12",
            status: "Đang xử lý",
            completedDate: null,
          },
        ]}
        numberFormatter={numberFormatter}
        formatDateDisplay={formatDateDisplay}
      />
    )

    expect(screen.getByText("Thiết bị sửa chữa nhiều nhất")).toBeInTheDocument()
    expect(screen.getByText("Máy thở")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("Lịch sử sửa chữa gần đây")).toBeInTheDocument()
    expect(screen.getByText("Monitor")).toBeInTheDocument()
    expect(screen.getAllByText("12/04/2026")).toHaveLength(2)
  })
})
