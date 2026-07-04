import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ListFilterSearchCard } from "../ListFilterSearchCard"

describe("ListFilterSearchCard", () => {
  it("renders tenant control before search input", () => {
    render(
      <ListFilterSearchCard
        title="Danh mục thiết bị"
        description="Quản lý danh sách thiết bị."
        tenantControl={<button type="button">Cơ sở</button>}
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
      />
    )

    const tenant = screen.getByRole("button", { name: "Cơ sở" })
    const search = screen.getByRole("searchbox", { name: "Tìm kiếm chung..." })

    expect(tenant.compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("can override the tenant slot sizing for compact command tokens", () => {
    render(
      <ListFilterSearchCard
        tenantControl={<button type="button">Cơ sở</button>}
        tenantClassName="w-full md:w-auto"
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
      />
    )

    const tenantSlot = screen.getByRole("button", { name: "Cơ sở" }).parentElement

    expect(tenantSlot).toHaveClass("w-full", "md:w-auto")
    expect(tenantSlot).not.toHaveClass("xl:min-w-[260px]")
  })

  it("renders mobile filter control instead of desktop filter controls in compact mode", () => {
    render(
      <ListFilterSearchCard
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
        compactFilters
        filterControls={<button type="button">Tình trạng</button>}
        mobileFilterControl={<button type="button">Bộ lọc</button>}
      />
    )

    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tình trạng" })).not.toBeInTheDocument()
  })

  it("supports action and selection slots without owning their behavior", () => {
    render(
      <ListFilterSearchCard
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
        selectionActions={<div data-testid="selection-actions">Đã chọn 2</div>}
        actions={<button type="button">Tùy chọn</button>}
      />
    )

    expect(screen.getByTestId("selection-actions")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tùy chọn" })).toBeInTheDocument()
  })

  it("supports filter-only sections without rendering a search input", () => {
    render(
      <ListFilterSearchCard
        title="Bộ lọc báo cáo"
        filterControls={<button type="button">Khoảng thời gian</button>}
        actions={<button type="button">Làm mới</button>}
      />
    )

    expect(screen.getByRole("button", { name: "Khoảng thời gian" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Làm mới" })).toBeInTheDocument()
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  })

  it("aligns search input with labeled filter controls by their bottom edge", () => {
    const { container } = render(
      <ListFilterSearchCard
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tên hoặc mã thiết bị..."
        filterControls={
          <fieldset>
            <legend>Khoảng thời gian</legend>
            <button type="button">Từ ngày</button>
          </fieldset>
        }
      />
    )

    expect(container.querySelector(".md\\:items-end")).toBeInTheDocument()
    expect(container.querySelector(".md\\:items-center")).not.toBeInTheDocument()
  })

  it("can render as a plain surface for embedding inside an existing card", () => {
    const { container } = render(
      <ListFilterSearchCard
        surface="plain"
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
      />
    )

    expect(container.firstElementChild).not.toHaveClass("rounded-lg")
    expect(container.firstElementChild).not.toHaveClass("border")
  })

  it("forwards searchInputRef to the search input", () => {
    const searchInputRef = React.createRef<HTMLInputElement>()

    render(
      <ListFilterSearchCard
        searchInputRef={searchInputRef}
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Tìm kiếm chung..."
      />
    )

    expect(searchInputRef.current).toBe(
      screen.getByRole("searchbox", { name: "Tìm kiếm chung..." })
    )
  })

  it("can disable the shared search input", () => {
    render(
      <ListFilterSearchCard
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Chọn cơ sở để tìm kiếm..."
        searchDisabled
      />
    )

    expect(screen.getByRole("searchbox", { name: "Chọn cơ sở để tìm kiếm..." })).toBeDisabled()
  })
})
