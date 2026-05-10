import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InventoryReportTab } from "../inventory-report-tab"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  useInventoryData: vi.fn(),
  useReportInventoryFilters: vi.fn(),
  useEquipmentDistribution: vi.fn(),
  useMaintenanceStats: vi.fn(),
  useUsageAnalytics: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}))

vi.mock("../../hooks/use-inventory-data", () => ({
  useInventoryData: mocks.useInventoryData,
}))

vi.mock("../../hooks/use-report-filters", () => ({
  useReportInventoryFilters: mocks.useReportInventoryFilters,
}))

vi.mock("@/hooks/use-equipment-distribution", () => ({
  useEquipmentDistribution: mocks.useEquipmentDistribution,
}))

vi.mock("../../hooks/use-maintenance-stats", () => ({
  useMaintenanceStats: mocks.useMaintenanceStats,
}))

vi.mock("../../hooks/use-usage-analytics", () => ({
  useUsageAnalytics: mocks.useUsageAnalytics,
}))

vi.mock("../inventory-charts", () => ({
  InventoryCharts: () => <div data-testid="inventory-charts" />,
}))

vi.mock("../inventory-table", () => ({
  InventoryTable: () => <div data-testid="inventory-table" />,
}))

vi.mock("../export-report-dialog", () => ({
  ExportReportDialog: () => <div data-testid="export-report-dialog" />,
}))

vi.mock("@/components/shared/ListFilterSearchCard", () => ({
  ListFilterSearchCard: ({
    title,
    description,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    filterControls,
    actions,
  }: {
    title?: React.ReactNode
    description?: React.ReactNode
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    filterControls?: React.ReactNode
    actions?: React.ReactNode
  }) => (
    <section data-testid="reports-shared-filter-section">
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      {searchPlaceholder ? (
        <input
          aria-label={searchPlaceholder}
          value={searchValue ?? ""}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      ) : null}
      {filterControls}
      {actions}
    </section>
  ),
}))

vi.mock("@/components/interactive-equipment-chart", () => ({
  InteractiveEquipmentChart: () => <div data-testid="interactive-equipment-chart" />,
}))

vi.mock("@/components/equipment-distribution-summary", () => ({
  EquipmentDistributionSummary: () => <div data-testid="equipment-distribution-summary" />,
}))

vi.mock("@/components/unified-inventory-chart", () => ({
  UnifiedInventoryChart: () => <div data-testid="unified-inventory-chart" />,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

describe("InventoryReportTab", () => {
  const setSearchTerm = vi.fn()
  const setSelectedDepartment = vi.fn()
  const refetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useReportInventoryFilters.mockReturnValue({
      filters: {
        dateRange: {
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-01-31T00:00:00.000Z"),
        },
        selectedDepartment: "all",
        searchTerm: "",
      },
      setDateRange: vi.fn(),
      setSelectedDepartment,
      setSearchTerm,
    })
    mocks.useInventoryData.mockReturnValue({
      data: {
        data: [],
        summary: {
          totalImported: 0,
          totalExported: 0,
          currentStock: 0,
          netChange: 0,
        },
        departments: ["Khoa Nội"],
      },
      isLoading: false,
      error: null,
      refetch,
    })
    mocks.useEquipmentDistribution.mockReturnValue({ data: [] })
    mocks.useMaintenanceStats.mockReturnValue({ data: [] })
    mocks.useUsageAnalytics.mockReturnValue({ data: [] })
  })

  it("shows the plain-object error message in the destructive toast", async () => {
    mocks.useInventoryData.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "Inventory unavailable" },
      refetch,
    })

    render(<InventoryReportTab tenantFilter="all" effectiveTenantKey="tenant-a" />)

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi tải dữ liệu",
          description: "Inventory unavailable",
        })
      )
    })
  })

  it("renders inventory filters through the shared filter section and preserves search/action behavior", () => {
    render(<InventoryReportTab tenantFilter="1" effectiveTenantKey="tenant-a" />)

    expect(screen.getByTestId("reports-shared-filter-section")).toBeInTheDocument()
    expect(screen.getByText("Báo cáo Xuất-Nhập-Tồn thiết bị")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Tên hoặc mã thiết bị..." }), {
      target: { value: "máy siêu âm" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }))

    expect(setSearchTerm).toHaveBeenCalledWith("máy siêu âm")
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("keeps department filtering hidden for global or regional report contexts", () => {
    render(
      <InventoryReportTab
        tenantFilter="all"
        effectiveTenantKey="tenant-a"
        isGlobalOrRegionalLeader
      />
    )

    expect(screen.getByTestId("reports-shared-filter-section")).toBeInTheDocument()
    expect(screen.queryByText("Khoa/Phòng")).not.toBeInTheDocument()
    expect(setSelectedDepartment).not.toHaveBeenCalled()
  })
})
