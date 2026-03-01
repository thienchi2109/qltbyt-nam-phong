import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  role: "technician",
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
    data: [],
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
    expect(screen.getByText("Đang hiển thị phân bố số lượng thiết bị theo cơ sở trên toàn hệ thống. Mặc định hiển thị Top 10; chọn “Hiển thị tất cả” để xem toàn bộ.")).toBeInTheDocument()
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
