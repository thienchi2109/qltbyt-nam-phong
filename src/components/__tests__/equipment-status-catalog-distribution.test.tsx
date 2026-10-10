import * as React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  distribution,
  statusCounts,
  statusCatalog,
} from "@/hooks/__tests__/equipment-status-distribution-fixtures"

const mocks = vi.hoisted(() => ({ distribution: vi.fn(), bar: vi.fn(), pie: vi.fn() }))
vi.mock("@/hooks/use-equipment-distribution", async (original) => ({
  ...(await original<typeof import("@/hooks/use-equipment-distribution")>()),
  useEquipmentDistribution: (...args: unknown[]) => mocks.distribution(...args),
}))
vi.mock("@/components/dynamic-chart", () => ({
  DynamicBarChart: (props: unknown) => {
    mocks.bar(props)
    return <div>Bar chart</div>
  },
  DynamicPieChart: (props: unknown) => {
    mocks.pie(props)
    return <div>Pie chart</div>
  },
}))
import { EquipmentDistributionSummary } from "../equipment-distribution-summary"
import { InteractiveEquipmentChart } from "../interactive-equipment-chart"
import { EquipmentChartTooltip } from "../interactive-equipment-chart-tooltip"

describe("catalog distribution consumers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.distribution.mockReturnValue({ data: distribution, isLoading: false, error: null })
  })
  it("uses future, inactive, and unknown counts in the actual summary with liquidation last", () => {
    render(<EquipmentDistributionSummary selectedDonVi={42} effectiveTenantKey="42" />)
    expect(
      screen.getByRole("progressbar", { name: "Tỷ lệ Đang đánh giá kỹ thuật" })
    ).toHaveAttribute("value", "25")
    expect(
      screen.getByRole("progressbar", { name: "Tỷ lệ Trạng thái đã ngừng cấp" })
    ).toHaveAttribute("value", "13")
    expect(screen.getByRole("progressbar", { name: "Tỷ lệ Giá trị lịch sử" })).toHaveAttribute(
      "value",
      "13"
    )
    const rows = screen.getAllByTestId("status-comparison-row")
    expect(rows.at(-1)).toHaveTextContent("Thanh lý nội bộ")
    expect(
      mocks.pie.mock.calls[0]?.[0].data.reduce(
        (sum: number, row: { value: number }) => sum + row.value,
        0
      )
    ).toBe(8)
    expect(mocks.distribution).toHaveBeenCalledWith(undefined, undefined, undefined, 42, "42")
  })
  it("keeps every known zero row visible without rendering zero donut wedges", () => {
    mocks.distribution.mockReturnValue({
      data: {
        ...distribution,
        totalEquipment: 0,
        byDepartment: [],
        statusCounts: Object.fromEntries(Object.keys(statusCounts).map((key) => [key, 0])),
        statusCatalog,
      },
      isLoading: false,
      error: null,
    })
    render(<EquipmentDistributionSummary />)
    for (const row of statusCatalog) expect(screen.getByText(row.status_value)).toBeInTheDocument()
    expect(screen.getByText("Không có dữ liệu trạng thái")).toBeInTheDocument()
    expect(mocks.pie).not.toHaveBeenCalled()
  })
  it("reconciles actual RPC khac-only unknown counts without dropping known zero rows", () => {
    const { "Giá trị lịch sử": historical, ...knownCounts } = statusCounts
    const rpcCounts = { ...knownCounts, khac: knownCounts.khac + historical }
    mocks.distribution.mockReturnValue({
      data: { ...distribution, statusCounts: rpcCounts },
      isLoading: false,
      error: null,
    })
    render(<EquipmentDistributionSummary />)
    expect(screen.getByRole("progressbar", { name: "Tỷ lệ Khác" })).toHaveAttribute("value", "25")
    expect(
      screen.queryByRole("progressbar", { name: "Tỷ lệ Giá trị lịch sử" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Tỷ lệ Chờ sửa chữa" })).toHaveAttribute(
      "value",
      "0"
    )
    expect(
      mocks.pie.mock.calls[0]?.[0].data.reduce(
        (sum: number, row: { value: number }) => sum + row.value,
        0
      )
    ).toBe(8)
  })
  it("uses the same dynamic status rows for the actual department and location chart caller", () => {
    render(<InteractiveEquipmentChart selectedDonVi={42} effectiveTenantKey="42" />)
    const bars = mocks.bar.mock.calls[0]?.[0].bars as Array<{ key: string; name: string }>
    expect(bars.map((row) => row.name)).toContain("Đang đánh giá kỹ thuật")
    expect(bars.map((row) => row.key)).toContain("Giá trị lịch sử")
    expect(bars.at(-1)?.name).toBe("Thanh lý nội bộ")
    expect(mocks.distribution).toHaveBeenCalledWith(undefined, "all", undefined, 42, "42")
  })
  it("shows chart payload labels for future and raw unknown statuses in the actual tooltip", () => {
    render(
      <EquipmentChartTooltip
        active
        payload={[
          {
            dataKey: "Đang đánh giá kỹ thuật",
            name: "Đang đánh giá kỹ thuật",
            value: 2,
            color: "#9ca3af",
            payload: { name: "Khoa Nội" },
          },
          {
            dataKey: "Giá trị lịch sử",
            name: "Giá trị lịch sử",
            value: 1,
            color: "#9ca3af",
            payload: { name: "Khoa Nội" },
          },
        ]}
      />
    )
    expect(screen.getByText("Đang đánh giá kỹ thuật")).toBeInTheDocument()
    expect(screen.getByText("Giá trị lịch sử")).toBeInTheDocument()
  })
})
