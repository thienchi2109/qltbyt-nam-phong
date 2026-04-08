import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import "@/components/kpi/index.exports.assertions"
import { KpiStatusBar } from "@/components/kpi/KpiStatusBar"
import type { StatusConfig } from "@/components/kpi/types"

// Mock StatCard to inspect props without rendering full UI
vi.mock("@/components/ui/stat-card", () => ({
  StatCard: (props: Record<string, unknown>) => (
    <div
      data-testid={`stat-card-${props.label}`}
      data-value={props.value}
      data-tone={props.tone}
      data-loading={props.loading}
      data-has-onclick={props.onClick !== undefined}
    >
      {String(props.label)}: {String(props.value)}
    </div>
  ),
}))

// Minimal test configs
type TestStatus = "pending" | "approved" | "completed"

const TEST_CONFIGS: StatusConfig<TestStatus>[] = [
  { key: "pending", label: "Pending", tone: "warning", icon: <span>⏳</span> },
  { key: "approved", label: "Approved", tone: "muted", icon: <span>✅</span> },
  { key: "completed", label: "Completed", tone: "success", icon: <span>🎉</span> },
]

const TEST_COUNTS: Record<TestStatus, number> = {
  pending: 5,
  approved: 10,
  completed: 3,
}

describe("KpiStatusBar", () => {
  it("renders total card + per-status cards from configs + counts", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} />)

    expect(screen.getByTestId("stat-card-Tổng")).toBeInTheDocument()
    expect(screen.getByTestId("stat-card-Pending")).toBeInTheDocument()
    expect(screen.getByTestId("stat-card-Approved")).toBeInTheDocument()
    expect(screen.getByTestId("stat-card-Completed")).toBeInTheDocument()
  })

  it("computes total as sum of all counts values", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} />)

    const totalCard = screen.getByTestId("stat-card-Tổng")
    expect(totalCard).toHaveAttribute("data-value", "18") // 5 + 10 + 3
  })

  it("shows 0 for statuses missing from counts", () => {
    const partialCounts: Partial<Record<TestStatus, number>> = { pending: 2 }
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={partialCounts} />)

    expect(screen.getByTestId("stat-card-Approved")).toHaveAttribute("data-value", "0")
    expect(screen.getByTestId("stat-card-Completed")).toHaveAttribute("data-value", "0")
  })

  it("hides total card when showTotal=false", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} showTotal={false} />)

    expect(screen.queryByTestId("stat-card-Tổng")).not.toBeInTheDocument()
    expect(screen.getByTestId("stat-card-Pending")).toBeInTheDocument()
  })

  it("uses custom totalLabel when provided", () => {
    render(
      <KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} totalLabel="Tổng danh mục" />
    )

    expect(screen.getByTestId("stat-card-Tổng danh mục")).toBeInTheDocument()
    expect(screen.queryByTestId("stat-card-Tổng")).not.toBeInTheDocument()
  })

  it("uses totalOverride when provided instead of computed sum", () => {
    render(
      <KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} totalOverride={42} />
    )

    const totalCard = screen.getByTestId("stat-card-Tổng")
    expect(totalCard).toHaveAttribute("data-value", "42")
  })

  it("passes loading=true to total and status cards", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} loading />)

    expect(screen.getByTestId("stat-card-Tổng")).toHaveAttribute("data-loading", "true")
    // Status cards should be loading
    expect(screen.getByTestId("stat-card-Pending")).toHaveAttribute("data-loading", "true")
    expect(screen.getByTestId("stat-card-Approved")).toHaveAttribute("data-loading", "true")
  })

  it("StatCard receives NO onClick prop (display-only)", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} />)

    const cards = screen.getAllByTestId(/^stat-card-/)
    for (const card of cards) {
      expect(card).toHaveAttribute("data-has-onclick", "false")
    }
  })

  it("forwards className to container", () => {
    const { container } = render(
      <KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} className="custom-class" />
    )

    const grid = container.firstElementChild
    expect(grid?.classList.contains("custom-class")).toBe(true)
  })

  it("renders correct grid cols for 4-item layout (3 configs + total)", () => {
    const { container } = render(
      <KpiStatusBar configs={TEST_CONFIGS} counts={TEST_COUNTS} />
    )

    const grid = container.firstElementChild
    expect(grid?.classList.contains("grid-cols-2")).toBe(true)
    expect(grid?.classList.contains("md:grid-cols-4")).toBe(true)
  })

  it("renders correct grid cols for 6-item layout (5 configs + total)", () => {
    const fiveConfigs: StatusConfig<string>[] = [
      ...TEST_CONFIGS,
      { key: "extra1", label: "Extra1", tone: "danger", icon: <span>❌</span> },
      { key: "extra2", label: "Extra2", tone: "default", icon: <span>📋</span> },
    ]
    const counts = { pending: 1, approved: 2, completed: 3, extra1: 4, extra2: 5 }

    const { container } = render(
      <KpiStatusBar configs={fiveConfigs} counts={counts} />
    )

    const grid = container.firstElementChild
    expect(grid?.classList.contains("lg:grid-cols-6")).toBe(true)
  })

  it("renders error fallback when error prop is truthy", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={undefined} error />)

    expect(screen.getByText("Không thể tải dữ liệu")).toBeInTheDocument()
    expect(screen.queryByTestId("stat-card-Tổng")).not.toBeInTheDocument()
  })

  it("handles undefined counts gracefully", () => {
    render(<KpiStatusBar configs={TEST_CONFIGS} counts={undefined} />)

    const totalCard = screen.getByTestId("stat-card-Tổng")
    expect(totalCard).toHaveAttribute("data-value", "0")

    expect(screen.getByTestId("stat-card-Pending")).toHaveAttribute("data-value", "0")
  })
})
