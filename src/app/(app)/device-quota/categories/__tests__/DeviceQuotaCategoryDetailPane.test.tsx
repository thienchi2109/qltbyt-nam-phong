import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaCategoryDetailPane } from "../_components/DeviceQuotaCategoryDetailPane"
import type { CategoryListItem } from "../_types/categories"

vi.mock("../_components/DeviceQuotaCategoryAssignedEquipment", () => ({
  DeviceQuotaCategoryAssignedEquipment: ({
    nhomId,
    variant,
  }: {
    nhomId: number
    variant?: string
  }) => (
    <div data-testid="assigned-equipment-panel" data-nhom-id={nhomId} data-variant={variant}>
      Equipment panel
    </div>
  ),
}))

const leafCategory: CategoryListItem = {
  id: 10,
  parent_id: null,
  ma_nhom: "R",
  ten_nhom: "Root Leaf",
  phan_loai: "A",
  don_vi_tinh: null,
  thu_tu_hien_thi: 1,
  level: 1,
  so_luong_hien_co: 2,
  so_luong_toi_da: 5,
  so_luong_toi_thieu: null,
  mo_ta: null,
}

describe("DeviceQuotaCategoryDetailPane", () => {
  it("keeps the assigned equipment area in an internal vertical scroll region", () => {
    render(
      <DeviceQuotaCategoryDetailPane
        category={leafCategory}
        allCategories={[leafCategory]}
        aggregatedCount={2}
        aggregatedQuota={{ total: 5, hasUnknown: false }}
        isLeaf
        donViId={1}
      />
    )

    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    const assignedPanel = screen.getByTestId("assigned-equipment-panel")
    const scrollRegion = assignedPanel.parentElement

    expect(detailPane).toHaveClass("h-full", "flex", "flex-col", "overflow-hidden")
    expect(scrollRegion).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
  })
})
