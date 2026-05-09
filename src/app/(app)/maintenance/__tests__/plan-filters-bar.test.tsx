import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PlanFiltersBar } from "../_components/plan-filters-bar"

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => (
    <button type="button" aria-label="Chọn cơ sở y tế" data-testid="tenant-selector-trigger">
      Chọn cơ sở y tế
    </button>
  ),
}))

describe("PlanFiltersBar", () => {
  it("uses the shared Equipment-style tenant slot before the search input on desktop", () => {
    render(
      <PlanFiltersBar
        showFacilityFilter={true}
        totalCount={3}
        searchTerm=""
        onSearchChange={vi.fn()}
        isRegionalLeader={false}
      />
    )

    const tenantTrigger = screen.getByTestId("tenant-selector-trigger")
    const searchInput = screen.getByRole("searchbox", {
      name: "Tìm kiếm theo tên kế hoạch, khoa/phòng, người lập...",
    })

    expect(tenantTrigger.compareDocumentPosition(searchInput)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("does not render a tenant trigger for non-privileged filter contexts", () => {
    render(
      <PlanFiltersBar
        showFacilityFilter={false}
        totalCount={3}
        searchTerm=""
        onSearchChange={vi.fn()}
        isRegionalLeader={false}
      />
    )

    expect(screen.queryByTestId("tenant-selector-trigger")).not.toBeInTheDocument()
    expect(screen.getByRole("searchbox", {
      name: "Tìm kiếm theo tên kế hoạch, khoa/phòng, người lập...",
    })).toBeInTheDocument()
  })
})
