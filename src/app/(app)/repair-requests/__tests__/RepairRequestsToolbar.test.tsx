import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

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

import { RepairRequestsToolbar } from "../_components/RepairRequestsToolbar"

const baseProps = {
  searchTerm: "",
  onSearchChange: vi.fn(),
  searchInputRef: React.createRef<HTMLInputElement>(),
  isFiltered: false,
  onClearFilters: vi.fn(),
  onOpenFilterModal: vi.fn(),
  uiFilters: { status: [], dateRange: null },
  selectedFacilityName: null,
  selectedFacilityId: null,
  showFacilityFilter: false,
  onFilterChange: vi.fn(),
  onRemoveFilter: vi.fn(),
  compactFilters: false,
}

describe("RepairRequestsToolbar", () => {
  it("renders desktop filter controls inline instead of only a filter dialog trigger", () => {
    render(
      <RepairRequestsToolbar
        {...baseProps}
        tenantControl={<button type="button">Chọn cơ sở</button>}
      />
    )

    const tenant = screen.getByRole("button", { name: "Chọn cơ sở" })
    const search = screen.getByRole("searchbox", { name: "Tìm thiết bị, mô tả..." })

    expect(search).toBeInTheDocument()
    expect(tenant.compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByRole("button", { name: "Trạng thái" })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.queryByRole("button", { name: "Cơ sở" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Từ ngày" })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.getByRole("button", { name: "Đến ngày" })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.queryByRole("button", { name: "Bộ lọc" })).not.toBeInTheDocument()
  })

  it("uses the Equipment-style command tenant selector on desktop layouts", () => {
    render(<RepairRequestsToolbar {...baseProps} showFacilityFilter />)

    const tenantSelector = screen.getByTestId("tenant-selector")
    expect(tenantSelector).toHaveAttribute("data-trigger-variant", "command")
    expect(tenantSelector).toHaveAttribute("data-class-name", "w-full md:w-auto")
    expect(tenantSelector.parentElement).toHaveClass("md:w-auto")
    expect(tenantSelector.parentElement).not.toHaveClass("xl:min-w-[260px]")
    expect(
      screen.getByRole("searchbox", { name: "Tìm thiết bị, mô tả..." }).parentElement?.parentElement
    ).toHaveClass("md:max-w-none", "xl:min-w-[520px]")
  })

  it("keeps the compact filter trigger for mobile layouts", () => {
    render(<RepairRequestsToolbar {...baseProps} compactFilters showFacilityFilter />)

    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Trạng thái" })).not.toBeInTheDocument()
    expect(screen.getByTestId("tenant-selector")).toHaveAttribute("data-trigger-variant", "command")
  })

  it("places compact search and filter trigger in one row with chips below", () => {
    render(
      <RepairRequestsToolbar
        {...baseProps}
        compactFilters
        isFiltered
        uiFilters={{ status: ["Đã duyệt"], dateRange: null }}
      />
    )

    const search = screen.getByRole("searchbox", { name: "Tìm thiết bị, mô tả..." })
    const filter = screen.getByRole("button", { name: "Bộ lọc" })
    const row = screen.getByTestId("repair-toolbar-compact-row")

    expect(row).toContainElement(search)
    expect(row).toContainElement(filter)
    expect(row).toHaveClass("grid", "gap-3")
    expect(screen.getByTestId("repair-toolbar-filter-chips")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Xóa trạng thái Đã duyệt" })).toBeInTheDocument()
  })

  it("updates status filters from the inline status control", async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()

    render(<RepairRequestsToolbar {...baseProps} onFilterChange={onFilterChange} />)

    await user.click(screen.getByRole("button", { name: "Trạng thái" }))
    await user.click(screen.getByRole("button", { name: "Chờ xử lý" }))

    expect(onFilterChange).toHaveBeenCalledWith({
      status: ["Chờ xử lý"],
      facilityId: null,
      dateRange: null,
    })
  })

  it("preserves search, clear, and chip removal callbacks", async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    const onClearFilters = vi.fn()
    const onRemoveFilter = vi.fn()

    render(
      <RepairRequestsToolbar
        {...baseProps}
        searchTerm="máy thở"
        onSearchChange={onSearchChange}
        isFiltered
        onClearFilters={onClearFilters}
        uiFilters={{ status: ["Chờ xử lý"], dateRange: null }}
        onRemoveFilter={onRemoveFilter}
      />
    )

    await user.type(screen.getByRole("searchbox", { name: "Tìm thiết bị, mô tả..." }), " A")
    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc" }))
    await user.click(screen.getByRole("button", { name: "Xóa trạng thái Chờ xử lý" }))

    expect(onSearchChange).toHaveBeenCalled()
    expect(onClearFilters).toHaveBeenCalledTimes(1)
    expect(onRemoveFilter).toHaveBeenCalledWith("status", "Chờ xử lý")
  })

  it("keeps the clear filter action grouped with desktop filter controls", () => {
    render(
      <RepairRequestsToolbar
        {...baseProps}
        isFiltered
        uiFilters={{ status: ["Chờ xử lý"], dateRange: null }}
      />
    )

    const endDate = screen.getByRole("button", { name: "Đến ngày" })
    const clear = screen.getByRole("button", { name: "Xóa bộ lọc" })

    expect(endDate.compareDocumentPosition(clear)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(clear.parentElement).toHaveClass("flex-wrap")
  })

  it("omits the Equipment-style tenant slot when no tenant control is provided", () => {
    render(<RepairRequestsToolbar {...baseProps} showFacilityFilter={false} tenantControl={null} />)

    expect(screen.queryByRole("button", { name: "Cơ sở" })).not.toBeInTheDocument()
  })
})
