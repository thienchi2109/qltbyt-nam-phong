import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaCategoryDetailPane } from "../_components/DeviceQuotaCategoryDetailPane"
import type { CategoryListItem } from "../_types/categories"

vi.mock("../_components/DeviceQuotaCategoryAssignedEquipment", () => ({
  DeviceQuotaCategoryAssignedEquipment: ({
    canUnassign,
    nhomId,
    variant,
  }: {
    canUnassign?: boolean
    nhomId: number
    variant?: string
  }) => (
    <div
      data-testid="assigned-equipment-panel"
      data-can-unassign={canUnassign ? "true" : "false"}
      data-nhom-id={nhomId}
      data-variant={variant}
    >
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

type DetailPaneCandidateProps = React.ComponentProps<typeof DeviceQuotaCategoryDetailPane> & {
  canUnassign: boolean
}

const DetailPaneWithUnassignment =
  DeviceQuotaCategoryDetailPane as React.ComponentType<DetailPaneCandidateProps>

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

  it("keeps parent-category unlink actions scoped to equipment assigned directly to that parent", () => {
    const parentCategory = {
      ...leafCategory,
      id: 20,
      ten_nhom: "Nhóm cha",
      so_luong_hien_co: 1,
    }
    const childCategory = {
      ...leafCategory,
      id: 21,
      parent_id: 20,
      ten_nhom: "Nhóm con",
      so_luong_hien_co: 3,
    }

    render(
      <DetailPaneWithUnassignment
        category={parentCategory}
        allCategories={[parentCategory, childCategory]}
        aggregatedCount={4}
        aggregatedQuota={{ total: 8, hasUnknown: false }}
        isLeaf={false}
        donViId={7}
        canAssign
        canUnassign
        onStartAssignment={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "Thiết bị gán trực tiếp" })).toBeInTheDocument()
    expect(screen.getByTestId("assigned-equipment-panel")).toHaveAttribute("data-nhom-id", "20")
    expect(screen.getByTestId("assigned-equipment-panel")).toHaveAttribute(
      "data-can-unassign",
      "true"
    )
  })
})
