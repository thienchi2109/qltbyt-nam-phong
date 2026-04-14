import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useMaintenanceReportData: vi.fn(),
}))

vi.mock("../../hooks/use-maintenance-data", () => ({
  useMaintenanceReportData: mocks.useMaintenanceReportData,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode; className?: string }) => <td>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode; className?: string }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode; className?: string }) => <tr>{children}</tr>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode; variant?: string }) => <span>{children}</span>,
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicBarChart: () => <div data-testid="bar-chart" />,
  DynamicLineChart: () => <div data-testid="line-chart" />,
  DynamicPieChart: () => <div data-testid="pie-chart" />,
  DynamicScatterChart: () => <div data-testid="scatter-chart" />,
}))

import { MaintenanceReportTab } from "../maintenance-report-tab"

describe("MaintenanceReportTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useMaintenanceReportData.mockReturnValue({
      data: {
        summary: {
          totalRepairs: 12,
          repairCompletionRate: 75,
          totalMaintenancePlanned: 8,
          maintenanceCompletionRate: 62.5,
          totalRepairCost: 3500000,
          averageCompletedRepairCost: 1750000,
          costRecordedCount: 2,
          costMissingCount: 1,
        },
        charts: {
          repairStatusDistribution: [],
          maintenancePlanVsActual: [],
          repairFrequencyByMonth: [],
          repairUsageCostCorrelation: {
            period: {
              points: [],
              dataQuality: {
                equipmentWithUsage: 0,
                equipmentWithRepairCost: 0,
                equipmentWithBoth: 0,
              },
            },
            cumulative: {
              points: [],
              dataQuality: {
                equipmentWithUsage: 0,
                equipmentWithRepairCost: 0,
                equipmentWithBoth: 0,
              },
            },
          },
        },
        topEquipmentRepairs: [],
        topEquipmentRepairCosts: [],
        recentRepairHistory: [],
      },
      isLoading: false,
    })
  })

  it("renders repair cost KPI cards from the maintenance report summary", () => {
    render(<MaintenanceReportTab selectedDonVi={1} effectiveTenantKey="tenant-a" />)

    expect(screen.getByText("Tổng chi phí sửa chữa")).toBeInTheDocument()
    expect(screen.getByText("3.500.000 đ")).toBeInTheDocument()
    expect(screen.getByText("Chi phí TB ca hoàn thành")).toBeInTheDocument()
    expect(screen.getByText("1.750.000 đ")).toBeInTheDocument()
    expect(screen.getByText("Có ghi nhận chi phí")).toBeInTheDocument()
    expect(screen.getByText("Thiếu chi phí")).toBeInTheDocument()
    expect(screen.getByText("2 ca hoàn thành đã ghi nhận")).toBeInTheDocument()
    expect(screen.getByText("1 ca hoàn thành chưa ghi nhận")).toBeInTheDocument()
  })
})
