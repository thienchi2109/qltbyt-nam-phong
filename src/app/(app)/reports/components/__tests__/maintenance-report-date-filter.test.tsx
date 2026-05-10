import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const JANUARY_START = new Date("2026-01-01T00:00:00.000Z")
const JANUARY_END = new Date("2026-01-31T00:00:00.000Z")
const FEBRUARY_START = new Date("2026-02-01T00:00:00.000Z")
const FEBRUARY_END = new Date("2026-02-28T00:00:00.000Z")

vi.mock("@/components/shared/ListFilterSearchCard", () => ({
  ListFilterSearchCard: ({
    title,
    description,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    filterControls,
  }: {
    title?: React.ReactNode
    description?: React.ReactNode
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    filterControls?: React.ReactNode
  }) => (
    <section data-testid="maintenance-report-shared-filter">
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
    </section>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (range: { from?: Date; to?: Date }) => void }) => (
    <button
      type="button"
      onClick={() => onSelect?.({
        from: FEBRUARY_START,
        to: FEBRUARY_END,
      })}
    >
      Chọn tháng 2
    </button>
  ),
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { MaintenanceReportDateFilter } from "../maintenance-report-date-filter"

describe("MaintenanceReportDateFilter", () => {
  it("renders through the shared filter section without a search box", () => {
    render(
      <MaintenanceReportDateFilter
        dateRange={{
          from: JANUARY_START,
          to: JANUARY_END,
        }}
        onDateRangeChange={vi.fn()}
      />
    )

    expect(screen.getByTestId("maintenance-report-shared-filter")).toBeInTheDocument()
    expect(screen.getByText("Bộ lọc báo cáo")).toBeInTheDocument()
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  })

  it("keeps date range selection behavior", () => {
    const onDateRangeChange = vi.fn()

    render(
      <MaintenanceReportDateFilter
        dateRange={{
          from: JANUARY_START,
          to: JANUARY_END,
        }}
        onDateRangeChange={onDateRangeChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Chọn tháng 2" }))

    expect(onDateRangeChange).toHaveBeenCalledWith({
      from: FEBRUARY_START,
      to: FEBRUARY_END,
    })
  })
})
