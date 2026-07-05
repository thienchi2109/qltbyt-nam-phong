import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TransfersToolbar } from "../_components/TransfersToolbar"

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: ({
    className,
    variant = "default",
  }: {
    className?: string
    variant?: "default" | "command"
  }) => (
    <button
      type="button"
      data-testid="tenant-selector"
      data-class-name={className}
      data-trigger-variant={variant}
    >
      Cơ sở
    </button>
  ),
}))

vi.mock("@/components/transfers/FilterChips", () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}))

vi.mock("@/components/transfers/TransfersViewToggle", () => ({
  TransfersViewToggle: () => <div data-testid="view-toggle" />,
}))

type TransfersToolbarProps = React.ComponentProps<typeof TransfersToolbar>

function buildProps(overrides: Partial<TransfersToolbarProps> = {}): TransfersToolbarProps {
  return {
    showFacilityFilter: true,
    isRegionalLeader: false,
    activeFilterCount: 2,
    onOpenFilterModal: vi.fn(),
    onOpenAddDialog: vi.fn(),
    filterChipsValue: {},
    onRemoveFilter: vi.fn(),
    onClearAllFilters: vi.fn(),
    searchTerm: "",
    onSearchTermChange: vi.fn(),
    filterValue: { statuses: [], dateRange: null },
    onFilterChange: vi.fn(),
    compactFilters: true,
    ...overrides,
  }
}

function renderToolbar(overrides: Partial<TransfersToolbarProps> = {}) {
  const props = buildProps(overrides)
  return {
    props,
    ...render(<TransfersToolbar {...props} />),
  }
}

describe("TransfersToolbar", () => {
  it("matches the Repair compact toolbar without the desktop title above the grid", () => {
    renderToolbar()

    expect(
      screen.queryByText("Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("transfers-toolbar-compact-tenant")).toContainElement(
      screen.getByTestId("tenant-selector")
    )

    const row = screen.getByTestId("transfers-toolbar-compact-row")
    const search = screen.getByRole("searchbox", {
      name: "Tìm kiếm mã yêu cầu, thiết bị, lý do...",
    })
    const filterButton = within(row).getByRole("button", { name: "Bộ lọc" })

    expect(row).toContainElement(search)
    expect(row).toContainElement(filterButton)
    expect(filterButton).toHaveTextContent("Bộ lọc")
    expect(within(filterButton).getByText("2")).toBeInTheDocument()
    expect(screen.getByTestId("transfers-toolbar-filter-chips")).toContainElement(
      screen.getByTestId("filter-chips")
    )
  })

  it("uses the shared mobile FAB contract for creating a transfer in compact mode", async () => {
    const onOpenAddDialog = vi.fn()
    renderToolbar({ onOpenAddDialog })

    const createButton = screen.getByRole("button", { name: "Tạo yêu cầu mới" })
    expect(createButton.className).toContain("fixed")
    expect(createButton.className).toContain("rounded-full")
    expect(createButton.className).toContain("md:hidden")

    await userEvent.setup().click(createButton)
    expect(onOpenAddDialog).toHaveBeenCalledTimes(1)
  })

  it("hides the compact create FAB for regional leaders", () => {
    renderToolbar({ isRegionalLeader: true })

    expect(screen.queryByRole("button", { name: "Tạo yêu cầu mới" })).not.toBeInTheDocument()
  })
})
