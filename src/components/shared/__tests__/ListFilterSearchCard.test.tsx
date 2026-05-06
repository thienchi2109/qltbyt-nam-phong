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
})
