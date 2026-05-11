import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ChartTooltipProps } from "@/lib/chart-utils"

import { InteractiveEquipmentChart } from "@/components/interactive-equipment-chart"

type MockChartDatum = Record<string, string | number | undefined>

interface MockDynamicBarChartProps {
  data?: MockChartDatum[]
  height?: number
  xAxisKey: string
  yAxisKey?: string
  layout?: "horizontal" | "vertical"
  xAxisAngle?: number
  customTooltip?: React.FC<ChartTooltipProps<number, string>>
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

const mocks = vi.hoisted(() => ({
  useEquipmentDistribution: vi.fn(),
  dynamicBarChart: vi.fn<(props: MockDynamicBarChartProps) => void>(),
}))

vi.mock("@/hooks/use-equipment-distribution", () => ({
  useEquipmentDistribution: (...args: unknown[]) => mocks.useEquipmentDistribution(...args),
  STATUS_COLORS: {
    hoat_dong: "#22c55e",
    cho_sua_chua: "#ef4444",
    cho_bao_tri: "#f59e0b",
    cho_hieu_chuan: "#8b5cf6",
    ngung_su_dung: "#6b7280",
    chua_co_nhu_cau: "#9ca3af",
  },
  STATUS_LABELS: {
    hoat_dong: "Hoạt động",
    cho_sua_chua: "Chờ sửa chữa",
    cho_bao_tri: "Chờ bảo trì",
    cho_hieu_chuan: "Chờ HC/KĐ",
    ngung_su_dung: "Ngừng sử dụng",
    chua_co_nhu_cau: "Chưa có nhu cầu",
  },
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicBarChart: (props: MockDynamicBarChartProps) => {
    mocks.dynamicBarChart(props)

    const { data, customTooltip: Tooltip } = props
    const row = data?.[0] ?? {}
    const activeCount = typeof row.hoat_dong === "number" ? row.hoat_dong : 0

    return (
      <div data-testid="bar-chart">
        {Tooltip ? (
          <div data-testid="rendered-tooltip">
            <Tooltip
              active
              label={0}
              payload={[
                {
                  dataKey: "hoat_dong",
                  value: activeCount,
                  color: "#22c55e",
                  payload: row,
                },
              ]}
            />
          </div>
        ) : null}
      </div>
    )
  },
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode
    className?: string
    "data-testid"?: string
  }) => <div className={className} {...props}>{children}</div>,
  CardContent: ({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode
    className?: string
    "data-testid"?: string
  }) => <div className={className} {...props}>{children}</div>,
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

let latestTabValueChange: ((value: string) => void) | undefined

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
    className,
    onValueChange,
  }: {
    children: React.ReactNode
    className?: string
    value: string
    onValueChange?: (value: string) => void
  }) => {
    latestTabValueChange = onValueChange
    return <div data-testid="equipment-chart-tabs" className={className}>{children}</div>
  },
  TabsContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="equipment-chart-tab-content" className={className}>{children}</div>
  ),
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="equipment-chart-tabs-list" className={className}>{children}</div>
  ),
  TabsTrigger: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
    <button type="button" className={className} onClick={() => latestTabValueChange?.(value)}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function createChartDatum(index: number): MockChartDatum {
  return {
    name: `Khoa ${index}`,
    total: index,
    hoat_dong: index,
    cho_sua_chua: 0,
    cho_bao_tri: 0,
    cho_hieu_chuan: 0,
    ngung_su_dung: 0,
    chua_co_nhu_cau: 0,
  }
}

describe("InteractiveEquipmentChart tooltip", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useEquipmentDistribution.mockReturnValue({
      data: {
        totalEquipment: 7,
        byDepartment: [
          {
            name: "Khoa Nội",
            total: 4,
            hoat_dong: 4,
            cho_sua_chua: 0,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0,
          },
        ],
        byLocation: [
          {
            name: "Phòng Mổ",
            total: 3,
            hoat_dong: 3,
            cho_sua_chua: 0,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0,
          },
        ],
        departments: ["Khoa Nội"],
        locations: ["Phòng Mổ"],
      },
      isLoading: false,
      error: null,
    })
  })

  it("shows the department name in the custom bar tooltip when Recharts supplies a numeric category label", () => {
    render(<InteractiveEquipmentChart tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    const tooltip = screen.getAllByTestId("rendered-tooltip")[0]
    expect(within(tooltip).getByText("Khoa Nội", { selector: "p" })).toBeInTheDocument()
  })

  it("shows the location name in the custom bar tooltip when Recharts supplies a numeric category label", () => {
    render(<InteractiveEquipmentChart tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    fireEvent.click(screen.getByRole("button", { name: /Theo Vị trí/ }))

    const tooltipHeadings = screen
      .getAllByTestId("rendered-tooltip")
      .map((tooltip) => within(tooltip).getByText("Phòng Mổ", { selector: "p" }))
    expect(tooltipHeadings.length).toBeGreaterThan(0)
  })

  it("uses stacked responsive header and toolbar layouts for narrow desktop widths", () => {
    render(<InteractiveEquipmentChart tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    expect(screen.getByTestId("equipment-chart-header")).toHaveClass("flex-col", "xl:flex-row")
    expect(screen.getByTestId("equipment-chart-toolbar")).toHaveClass("flex-col", "xl:flex-row")
    expect(screen.getByTestId("equipment-chart-tabs-scroll")).toHaveClass("overflow-x-auto")
    expect(screen.getByTestId("equipment-chart-tabs-list")).toHaveClass("w-max", "min-w-max")
  })

  it("keeps the existing bar chart inside an internal horizontal scroll frame when the department list is dense", () => {
    const denseDepartments = Array.from({ length: 31 }, (_, index) => createChartDatum(index + 1))

    mocks.useEquipmentDistribution.mockReturnValue({
      data: {
        totalEquipment: 496,
        byDepartment: denseDepartments,
        byLocation: [],
        departments: denseDepartments.map((department) => String(department.name)),
        locations: ["Kho tổng"],
      },
      isLoading: false,
      error: null,
    })

    render(<InteractiveEquipmentChart tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    expect(screen.getByTestId("equipment-chart-card")).toHaveClass("min-w-0", "overflow-hidden")
    expect(screen.getByTestId("equipment-chart-content")).toHaveClass("min-w-0")
    expect(screen.getByTestId("equipment-chart-tabs")).toHaveClass("min-w-0")
    expect(screen.getAllByTestId("equipment-chart-tab-content")[0]).toHaveClass("min-w-0")
    expect(screen.getAllByTestId("equipment-chart-scroll-frame")[0]).toHaveClass(
      "w-0",
      "min-w-full",
      "max-w-full",
      "overflow-x-auto",
    )
    expect(screen.getAllByTestId("equipment-chart-scroll-inner")[0]).toHaveStyle({ width: "1736px" })
    expect(mocks.dynamicBarChart).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 400,
        xAxisAngle: -45,
        margin: { top: 20, right: 30, left: 20, bottom: 100 },
      })
    )
  })
})
