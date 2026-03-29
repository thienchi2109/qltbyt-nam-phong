import * as React from "react"
import { render, waitFor } from "@testing-library/react"
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
  Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
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
      setSelectedDepartment: vi.fn(),
      setSearchTerm: vi.fn(),
    })
    mocks.useInventoryData.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "Inventory unavailable" },
      refetch: vi.fn(),
    })
    mocks.useEquipmentDistribution.mockReturnValue({ data: [] })
    mocks.useMaintenanceStats.mockReturnValue({ data: [] })
    mocks.useUsageAnalytics.mockReturnValue({ data: [] })
  })

  it("shows the plain-object error message in the destructive toast", async () => {
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
})
