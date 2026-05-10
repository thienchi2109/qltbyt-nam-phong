import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/dynamic-chart", () => ({
  DynamicAreaChart: () => <div data-testid="area-chart" />,
  DynamicBarChart: () => <div data-testid="bar-chart" />,
  DynamicLineChart: () => <div data-testid="line-chart" />,
  DynamicPieChart: () => <div data-testid="pie-chart" />,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  TabsContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="inventory-charts-tabs-list" className={className}>{children}</div>
  ),
  TabsTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>{children}</button>
  ),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}))

import { InventoryCharts } from "../inventory-charts"

describe("InventoryCharts responsive layout", () => {
  it("keeps chart tabs scrollable on narrow desktop widths", () => {
    render(
      <InventoryCharts
        isLoading={false}
        data={[
          {
            id: 1,
            ngay_nhap: "2026-01-05",
            created_at: "2026-01-05T00:00:00.000Z",
            ma_thiet_bi: "TB-001",
            ten_thiet_bi: "Máy siêu âm",
            type: "import",
            source: "manual",
            khoa_phong_quan_ly: "Khoa Nội",
            model: "M1",
            serial: "S1",
            quantity: 1,
          },
        ]}
      />
    )

    expect(screen.getByTestId("inventory-charts-tabs-scroll")).toHaveClass("overflow-x-auto")
    expect(screen.getByTestId("inventory-charts-tabs-list")).toHaveClass("w-max", "min-w-max")
  })
})
