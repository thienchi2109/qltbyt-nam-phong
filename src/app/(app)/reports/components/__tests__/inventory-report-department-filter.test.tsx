import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { statusCatalog } from "@/hooks/__tests__/equipment-status-distribution-fixtures"
import { InventoryReportTab } from "../inventory-report-tab"

type RpcRequest = { fn: string; args: Record<string, unknown> }
type ChartRow = { name: string; total: number }

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  useInventoryData: vi.fn(),
  useMaintenanceStats: vi.fn(),
  useUsageAnalytics: vi.fn(),
  callRpc: vi.fn<(request: RpcRequest) => Promise<unknown>>(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("../../hooks/use-inventory-data", () => ({
  useInventoryData: mocks.useInventoryData,
}))

vi.mock("../../hooks/use-maintenance-stats", () => ({
  useMaintenanceStats: mocks.useMaintenanceStats,
}))

vi.mock("../../hooks/use-usage-analytics", () => ({
  useUsageAnalytics: mocks.useUsageAnalytics,
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("../inventory-charts", () => ({ InventoryCharts: () => null }))
vi.mock("../inventory-table", () => ({ InventoryTable: () => null }))
vi.mock("../export-report-dialog", () => ({ ExportReportDialog: () => null }))
vi.mock("@/components/unified-inventory-chart", () => ({ UnifiedInventoryChart: () => null }))
vi.mock("../unused-equipment-report-section", () => ({ UnusedEquipmentReportSection: () => null }))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicPieChart: () => <div data-testid="summary-donut" />,
  DynamicBarChart: ({ data }: { data: ChartRow[] }) => (
    <div data-testid="equipment-chart-data">
      {data.map(({ name, total }) => `${name}:${total}`).join("|")}
    </div>
  ),
}))

vi.mock("@/components/interactive-equipment-chart-controls", () => ({
  EquipmentChartFilters: () => null,
}))

function distributionItem(name: string, total: number) {
  return {
    name,
    total,
    hoat_dong: total,
    cho_sua_chua: 0,
    cho_bao_tri: 0,
    cho_hieu_chuan: 0,
    ngung_su_dung: 0,
    chua_co_nhu_cau: 0,
  }
}

function distributionFor(selectedDepartment: unknown) {
  const totals = { "Khoa A": 10, "Khoa B": 20 }
  const departments =
    selectedDepartment === "Khoa A" || selectedDepartment === "Khoa B"
      ? [selectedDepartment]
      : Object.keys(totals)
  const byDepartment = departments.map((department) =>
    distributionItem(department, totals[department as keyof typeof totals])
  )
  const total = byDepartment.reduce((sum, department) => sum + department.total, 0)
  const statusCounts = {
    hoat_dong: total,
    cho_sua_chua: 0,
    cho_bao_tri: 0,
    cho_hieu_chuan: 0,
    ngung_su_dung: 0,
    chua_co_nhu_cau: 0,
  }

  return {
    total_equipment: total,
    status_counts: statusCounts,
    status_catalog: statusCatalog,
    by_department: byDepartment,
    by_location: [distributionItem("Phòng 1", total)],
    departments,
    locations: ["Phòng 1"],
  }
}

function displayedSummaryTotal() {
  const heading = screen.getByText("Tổng thiết bị")
  const card = heading.parentElement?.parentElement
  if (!card) throw new Error("Equipment summary card was not rendered")
  return within(card).getByText(/^\d+$/).textContent
}

function displayedChartData() {
  return within(screen.getByTestId("equipment-chart-card")).getByTestId("equipment-chart-data")
    .textContent
}

describe("InventoryReportTab department filter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.useInventoryData.mockReturnValue({
      data: {
        data: [],
        summary: { totalImported: 0, totalExported: 0, currentStock: 0, netChange: 0 },
        departments: ["Khoa A", "Khoa B"],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mocks.useMaintenanceStats.mockReturnValue({ data: [] })
    mocks.useUsageAnalytics.mockReturnValue({ data: [] })
    mocks.callRpc.mockImplementation(async ({ fn, args }: RpcRequest) => {
      expect(fn).toBe("equipment_status_distribution")
      return distributionFor(args.p_khoa_phong)
    })
  })

  it.each(["summary", "chart"] as const)(
    "updates the real %s widget for department A, B, and all",
    async (widget) => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(
        <QueryClientProvider client={queryClient}>
          <InventoryReportTab
            tenantFilter="unset"
            selectedDonVi={42}
            effectiveTenantKey="42"
            isGlobalOrRegionalLeader={false}
          />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(displayedSummaryTotal()).toBe("30")
        expect(displayedChartData()).toBe("Khoa A:10|Khoa B:20")
      })

      const expectedByDepartment = [
        { selected: "Khoa A", summary: "10", chart: "Khoa A:10" },
        { selected: "Khoa B", summary: "20", chart: "Khoa B:20" },
        { selected: "all", summary: "30", chart: "Khoa A:10|Khoa B:20" },
      ]

      for (const step of expectedByDepartment) {
        await user.click(screen.getByRole("combobox"))
        await user.click(
          await screen.findByRole("option", {
            name: step.selected === "all" ? "Tất cả" : step.selected,
          })
        )

        await waitFor(() => {
          expect(mocks.callRpc).toHaveBeenCalledWith(
            expect.objectContaining({
              fn: "equipment_status_distribution",
              args: expect.objectContaining({
                p_khoa_phong: step.selected === "all" ? null : step.selected,
              }),
            })
          )
        })

        await waitFor(() => {
          expect(widget === "summary" ? displayedSummaryTotal() : displayedChartData()).toBe(
            widget === "summary" ? step.summary : step.chart
          )
        })
      }
    }
  )
})
