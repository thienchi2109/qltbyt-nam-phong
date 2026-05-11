import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

interface MockFacilityRow {
  id: number
  name: string
  code?: string
  equipment_count: number
}

interface MockPieDatum {
  name: string
  value: number
  color?: string
}

const state = vi.hoisted(() => ({
  role: "technician",
  facilities: [] as MockFacilityRow[],
  dynamicPieChart: vi.fn<(props: { data: MockPieDatum[]; dataKey: string; nameKey: string }) => void>(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        role: state.role,
      },
    },
  }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: state.facilities,
    isLoading: false,
    error: null,
  }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(async () => []),
}))

vi.mock("@/lib/rbac", () => ({
  isGlobalRole: (role: string) => String(role).toLowerCase() === "global",
  isRegionalLeaderRole: (role: string) => String(role).toLowerCase() === "regional_leader",
}))

vi.mock("@/components/interactive-equipment-chart", () => ({
  InteractiveEquipmentChart: () => <div data-testid="interactive-equipment-chart" />,
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicBarChart: () => <div data-testid="dynamic-bar-chart" />,
  DynamicPieChart: (props: { data: MockPieDatum[]; dataKey: string; nameKey: string }) => {
    state.dynamicPieChart(props)

    return (
      <div data-testid="dynamic-pie-chart">
        {props.data.map((item) => (
          <div key={item.name}>
            {item.name}: {item.value}
          </div>
        ))}
      </div>
    )
  },
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { UnifiedInventoryChart } from "@/components/unified-inventory-chart"

describe("UnifiedInventoryChart hook stability", () => {
  beforeEach(() => {
    state.role = "technician"
    state.facilities = []
    state.dynamicPieChart.mockClear()
  })

  it("does not throw when rerendering from hidden to visible mode", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      state.role = "global"

      const { rerender } = render(
        <UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={false} />,
      )

      expect(() => {
        rerender(<UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={true} />)
      }).not.toThrow()

      expect(errorSpy).not.toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it("does not throw when rerendering from visible to hidden mode", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      state.role = "global"

      const { rerender } = render(
        <UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={true} />,
      )

      expect(() => {
        rerender(<UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={false} />)
      }).not.toThrow()

      expect(errorSpy).not.toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it("renders all-mode facilities chart path for visible global role", () => {
    state.role = "global"

    render(<UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={true} />)

    expect(screen.getByText("Phân bố thiết bị theo cơ sở")).toBeInTheDocument()
    expect(screen.getByText("Đang hiển thị tỷ trọng thiết bị theo cơ sở trên toàn hệ thống. Donut hiển thị Top 10 cơ sở và gộp phần còn lại vào “Khác”.")).toBeInTheDocument()
  })

  it("renders all-mode facility distribution as top ten plus other donut with full legend", () => {
    state.role = "global"
    state.facilities = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `Cơ sở ${index + 1}`,
      equipment_count: 12 - index,
    }))

    render(<UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={true} />)

    expect(screen.getByTestId("dynamic-pie-chart")).toBeInTheDocument()
    expect(state.dynamicPieChart).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: "value",
        nameKey: "name",
        data: expect.arrayContaining([
          expect.objectContaining({ name: "Cơ sở 1", value: 12 }),
          expect.objectContaining({ name: "Cơ sở 10", value: 3 }),
          expect.objectContaining({ name: "Khác", value: 3 }),
        ]),
      }),
    )
    expect(state.dynamicPieChart.mock.calls[0]?.[0].data).toHaveLength(11)
    expect(screen.queryByTestId("dynamic-bar-chart")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Hiển thị tất cả" })).not.toBeInTheDocument()
    expect(screen.getByTestId("facility-donut-legend")).toHaveTextContent("Cơ sở 1")
    expect(screen.getByTestId("facility-donut-legend")).toHaveTextContent("12 thiết bị")
    expect(screen.getByTestId("facility-donut-legend")).toHaveTextContent("15.4%")
    expect(screen.getByTestId("facility-donut-legend")).toHaveTextContent("Khác")
    expect(screen.getByTestId("facility-donut-legend")).toHaveTextContent("3 thiết bị")
    expect(screen.getByTestId("facility-donut-legend")).toHaveTextContent("3.8%")
  })

  it("renders interactive chart path for visible global role in single mode", () => {
    state.role = "global"

    render(<UnifiedInventoryChart tenantFilter="1" isGlobalOrRegionalLeader={true} />)

    expect(screen.getByTestId("interactive-equipment-chart")).toBeInTheDocument()
  })

  it("renders nothing for non-visible mode", () => {
    state.role = "global"

    const { container } = render(
      <UnifiedInventoryChart tenantFilter="all" isGlobalOrRegionalLeader={false} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
