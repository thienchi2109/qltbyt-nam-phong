import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDynamicBarChart = vi.fn(() => <div data-testid="completion-histogram" />)
const mockDynamicLineChart = vi.fn(() => <div data-testid="completion-trend" />)

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="on-time-progress">{value}</div>,
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicBarChart: (props: unknown) => mockDynamicBarChart(props),
  DynamicLineChart: (props: unknown) => mockDynamicLineChart(props),
}))

import { MaintenanceReportCompletionTime } from "../maintenance-report-completion-time"

describe("MaintenanceReportCompletionTime", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const completionTime = {
    stats: {
      totalCompleted: 6,
      medianMinutes: 10800,
      averageMinutes: 18600,
      p90Minutes: 43200,
      onTimeCount: 4,
      onTimePercent: 66.7,
      thresholdDays: 14,
    },
    distribution: [
      { bucketKey: "0-1d", label: "0-1 ngày", count: 1, isOverThreshold: false },
      { bucketKey: "1-3d", label: "1-3 ngày", count: 1, isOverThreshold: false },
      { bucketKey: "3-7d", label: "3-7 ngày", count: 1, isOverThreshold: false },
      { bucketKey: "7-14d", label: "7-14 ngày", count: 1, isOverThreshold: false },
      { bucketKey: "14-30d", label: "14-30 ngày", count: 1, isOverThreshold: true },
      { bucketKey: "30d+", label: ">30 ngày", count: 1, isOverThreshold: true },
    ],
  }

  const completionTimeByMonth = [
    {
      period: "2026-03",
      medianMinutes: 10800,
      p90Minutes: 43200,
      averageMinutes: 18600,
      completedCount: 6,
    },
  ]

  it("renders KPI, histogram, and trend cards for completion-time data", () => {
    render(
      <MaintenanceReportCompletionTime
        isLoading={false}
        repairCompletionTime={completionTime}
        repairCompletionTimeByMonth={completionTimeByMonth}
      />
    )

    expect(screen.getByText("Thời gian hoàn thành yêu cầu sửa chữa")).toBeInTheDocument()
    expect(screen.getByText("Trung vị")).toBeInTheDocument()
    expect(screen.getByText("7,5 ngày")).toBeInTheDocument()
    expect(screen.getByText("Thời gian trung bình")).toBeInTheDocument()
    expect(screen.getByText("12,9 ngày")).toBeInTheDocument()
    expect(screen.getByText("Tỉ lệ đúng hạn (≤14 ngày)")).toBeInTheDocument()
    expect(screen.getByText("66,7%")).toBeInTheDocument()
    expect(screen.getByText("4/6 yêu cầu trong ngưỡng 14 ngày")).toBeInTheDocument()
    expect(screen.getByText("Xu hướng thời gian hoàn thành theo tháng")).toBeInTheDocument()
    expect(screen.getByTestId("completion-histogram")).toBeInTheDocument()
    expect(screen.getByTestId("completion-trend")).toBeInTheDocument()

    expect(mockDynamicBarChart).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ bucketKey: "30d+", count: 1, fill: "hsl(var(--destructive))" }),
        ]),
        bars: expect.arrayContaining([
          expect.objectContaining({ key: "count", cellColorKey: "fill" }),
        ]),
      })
    )
    expect(mockDynamicLineChart).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ key: "medianMinutes", name: "Trung vị" }),
          expect.objectContaining({ key: "p90Minutes", name: "90% hoàn thành trong" }),
          expect.objectContaining({ key: "averageMinutes", name: "Trung bình" }),
        ]),
      })
    )
  })

  it("renders an empty state when the date range has no completed repair requests", () => {
    render(
      <MaintenanceReportCompletionTime
        isLoading={false}
        repairCompletionTime={{
          stats: {
            totalCompleted: 0,
            medianMinutes: 0,
            averageMinutes: 0,
            p90Minutes: 0,
            onTimeCount: 0,
            onTimePercent: 0,
            thresholdDays: 14,
          },
          distribution: [],
        }}
        repairCompletionTimeByMonth={[]}
      />
    )

    expect(screen.getByText("Chưa có yêu cầu hoàn thành trong khoảng thời gian đã chọn.")).toBeInTheDocument()
    expect(mockDynamicBarChart).not.toHaveBeenCalled()
    expect(mockDynamicLineChart).not.toHaveBeenCalled()
  })
})
