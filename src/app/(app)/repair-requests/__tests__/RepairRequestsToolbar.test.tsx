import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

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
  showFacilityFilter: true,
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
    expect(screen.getByRole("button", { name: "Trạng thái" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cơ sở" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Từ ngày" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Đến ngày" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Bộ lọc" })).not.toBeInTheDocument()
  })

  it("keeps the compact filter trigger for mobile layouts", () => {
    render(<RepairRequestsToolbar {...baseProps} compactFilters />)

    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Trạng thái" })).not.toBeInTheDocument()
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

  it("omits the Equipment-style tenant slot when no tenant control is provided", () => {
    render(
      <RepairRequestsToolbar
        {...baseProps}
        showFacilityFilter={false}
        tenantControl={null}
      />
    )

    expect(screen.queryByRole("button", { name: "Cơ sở" })).not.toBeInTheDocument()
  })
})
