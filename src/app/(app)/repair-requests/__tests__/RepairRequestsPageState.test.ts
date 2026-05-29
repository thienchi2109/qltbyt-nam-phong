import { describe, expect, it } from "vitest"
import type { ColumnFiltersState } from "@tanstack/react-table"

import {
  createRepairRequestsPageState,
  repairRequestsPageStateReducer,
} from "../_components/RepairRequestsPageState"

describe("repairRequestsPageStateReducer", () => {
  it("updates related table and filter state without dropping existing preferences", () => {
    const initial = createRepairRequestsPageState({
      uiFilters: { status: ["Chờ xử lý"], dateRange: null },
      columnVisibility: { trang_thai: false },
    })

    const withSearch = repairRequestsPageStateReducer(initial, {
      type: "set-search-term",
      value: "máy siêu âm",
    })
    const withFilters = repairRequestsPageStateReducer(withSearch, {
      type: "set-column-filters",
      updater: (current: ColumnFiltersState) => [
        ...current,
        { id: "trang_thai", value: ["Chờ xử lý"] },
      ],
    })
    const withModalOpen = repairRequestsPageStateReducer(withFilters, {
      type: "set-filter-modal-open",
      value: true,
    })

    expect(withModalOpen).toMatchObject({
      searchTerm: "máy siêu âm",
      columnFilters: [{ id: "trang_thai", value: ["Chờ xử lý"] }],
      columnVisibility: { trang_thai: false },
      isFilterModalOpen: true,
      uiFilters: { status: ["Chờ xử lý"], dateRange: null },
    })
  })
})
