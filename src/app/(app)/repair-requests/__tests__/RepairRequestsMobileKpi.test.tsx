import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RepairRequestsMobileKpi } from "../_components/RepairRequestsMobileKpi"
import type { RepairStatus } from "@/components/kpi"

const counts: Record<RepairStatus, number> = {
  "Chờ xử lý": 34,
  "Đã duyệt": 3,
  "Hoàn thành": 30,
  "Không HT": 2,
}

describe("RepairRequestsMobileKpi", () => {
  it("renders total as a full-width summary before a balanced 2x2 status grid", () => {
    render(<RepairRequestsMobileKpi counts={counts} loading={false} />)

    const total = screen.getByTestId("repair-mobile-kpi-total")
    const statusGrid = screen.getByTestId("repair-mobile-kpi-status-grid")

    expect(total).toHaveTextContent("Tổng")
    expect(total).toHaveTextContent("69")
    expect(total).toHaveClass("col-span-2")
    expect(total.compareDocumentPosition(statusGrid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    expect(within(statusGrid).getAllByTestId(/^repair-mobile-kpi-status-/)).toHaveLength(4)
    expect(screen.getByTestId("repair-mobile-kpi-status-Chờ xử lý")).toHaveTextContent("34")
    expect(screen.getByTestId("repair-mobile-kpi-status-Đã duyệt")).toHaveTextContent("3")
    expect(screen.getByTestId("repair-mobile-kpi-status-Hoàn thành")).toHaveTextContent("30")
    expect(screen.getByTestId("repair-mobile-kpi-status-Không HT")).toHaveTextContent("2")
  })

  it("uses zero counts while status counts are unavailable", () => {
    render(<RepairRequestsMobileKpi counts={undefined} loading={false} />)

    expect(screen.getByTestId("repair-mobile-kpi-total")).toHaveTextContent("0")
    expect(screen.getByTestId("repair-mobile-kpi-status-Chờ xử lý")).toHaveTextContent("0")
  })

  it("keeps status values readable in dark theme", () => {
    render(<RepairRequestsMobileKpi counts={counts} loading={false} />)

    expect(
      within(screen.getByTestId("repair-mobile-kpi-status-Chờ xử lý")).getByText("34")
    ).toHaveClass("dark:text-orange-300")
    expect(
      within(screen.getByTestId("repair-mobile-kpi-status-Đã duyệt")).getByText("3")
    ).toHaveClass("dark:text-blue-300")
    expect(
      within(screen.getByTestId("repair-mobile-kpi-status-Hoàn thành")).getByText("30")
    ).toHaveClass("dark:text-emerald-300")
    expect(
      within(screen.getByTestId("repair-mobile-kpi-status-Không HT")).getByText("2")
    ).toHaveClass("dark:text-red-300")
  })
})
