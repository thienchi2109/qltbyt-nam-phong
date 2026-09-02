import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogItemRow } from "../_components/DeviceQuotaDraftCatalogItemRow"
import type { DeviceQuotaMergedItemRow } from "../device-quota-draft-catalog-types"

const item: DeviceQuotaMergedItemRow = {
  id: "item-1",
  sourceLabel: "1.1",
  type: "item",
  level: 1,
  parentSourceIdentifier: "section-1",
  name: "Thiết bị 1",
  regulatoryUnit: "Máy",
  quotaLines: ["Tối thiểu 01 máy", "Tối đa 02 máy"],
  sourcePages: [12, 13],
  sourceReference: "Phụ lục, dòng 1",
  sourceOrder: 6,
  sourceIdentifier: "item-1",
  completeness: "incomplete",
  displayName: "Thiết bị 1",
  displayNameOverride: null,
  appliedUnit: null,
  appliedQuantity: null,
  notes: null,
  isExcluded: false,
  displayOrder: 6,
  regulatoryItemId: "reg-1",
  regulatoryName: "Thiết bị 1",
  regulatoryQuotaLines: ["Tối thiểu 01 máy", "Tối đa 02 máy"],
  regulatoryRules: [
    { lineOrder: 1, sourceText: "Tối thiểu 01 máy" },
    { lineOrder: 2, sourceText: "Tối đa 02 máy" },
  ],
  regulatoryFieldsReadOnly: true,
  editableFields: {
    displayName: true,
    appliedUnit: true,
    appliedQuantity: true,
    notes: true,
  },
}

function renderItem(
  overrides: Partial<React.ComponentProps<typeof DeviceQuotaDraftCatalogItemRow>> = {}
) {
  const props: React.ComponentProps<typeof DeviceQuotaDraftCatalogItemRow> = {
    row: item,
    isReadOnly: false,
    isMutationPending: false,
    isExpanded: true,
    onToggleExpanded: vi.fn(),
    onUpdate: vi.fn(),
    onExclude: vi.fn(),
    onRestore: vi.fn(),
    ...overrides,
  }

  return { ...render(<DeviceQuotaDraftCatalogItemRow {...props} />), props }
}

describe("DeviceQuotaDraftCatalogItemRow", () => {
  it("uses concise field labels and one intentional responsive field grid", () => {
    renderItem()

    const summary = screen.getByTestId("device-quota-catalog-summary-item-1")
    expect(within(summary).getByText("Số lượng đề xuất", { selector: "dt" })).toBeInTheDocument()

    const fieldGrid = screen.getByTestId("device-quota-catalog-field-grid-item-1")
    expect(fieldGrid).toHaveAttribute("data-field-grid", "shared")
    expect(fieldGrid).toHaveClass(
      "lg:grid-cols-2",
      "min-[1200px]:grid-cols-[minmax(0,1.2fr)_10rem_10rem_minmax(0,1fr)]"
    )
    expect(within(fieldGrid).getByText("Tên hiển thị", { selector: "label" })).toBeInTheDocument()
    expect(within(fieldGrid).getByText("Đơn vị áp dụng", { selector: "label" })).toBeInTheDocument()
    expect(
      within(fieldGrid).getByText("Số lượng đề xuất", { selector: "label" })
    ).toBeInTheDocument()
    expect(within(fieldGrid).getByText("Ghi chú", { selector: "label" })).toBeInTheDocument()
    expect(
      within(fieldGrid).getByRole("textbox", { name: "Tên hiển thị - Thiết bị 1" })
    ).toBeInTheDocument()
    expect(
      within(fieldGrid).getByRole("textbox", { name: "Đơn vị áp dụng - Thiết bị 1" })
    ).toBeInTheDocument()
    expect(
      within(fieldGrid).getByRole("spinbutton", { name: "Số lượng đề xuất - Thiết bị 1" })
    ).toBeInTheDocument()
    expect(
      within(fieldGrid).getByRole("textbox", { name: "Ghi chú - Thiết bị 1" })
    ).toBeInTheDocument()
  })

  it("keeps compact source context visible and discloses complete source and rules", async () => {
    const user = userEvent.setup()
    renderItem({ isExpanded: false })

    const row = screen.getByTestId("device-quota-catalog-row-item-1")
    expect(within(row).getByText("Nguồn 6 · Trang 12, 13 · Cấp 1")).toBeInTheDocument()
    expect(within(row).queryByText("Phụ lục, dòng 1")).not.toBeInTheDocument()
    expect(within(row).queryByText("section-1")).not.toBeInTheDocument()

    const sourceButton = within(row).getByRole("button", { name: "Xem nguồn Thiết bị 1" })
    expect(sourceButton).toHaveTextContent("Nguồn")
    await user.click(sourceButton)

    const sourceDetails = within(row).getByTestId("device-quota-source-details-item-1")
    expect(within(sourceDetails).getByText("Phụ lục, dòng 1")).toBeInTheDocument()
    expect(within(sourceDetails).getByText("12, 13")).toBeInTheDocument()
    expect(within(sourceDetails).getByText("6")).toBeInTheDocument()
    expect(within(sourceDetails).getByText("1")).toBeInTheDocument()
    expect(within(sourceDetails).getByText("section-1")).toBeInTheDocument()

    const ruleButton = within(row).getByRole("button", { name: "Xem quy tắc Thiết bị 1" })
    expect(ruleButton).toHaveTextContent("Quy tắc")
    await user.click(ruleButton)
    expect(within(row).getByText("Tối thiểu 01 máy")).toBeInTheDocument()
    expect(within(row).getByText("Tối đa 02 máy")).toBeInTheDocument()
  })

  it("shortens visible item actions while preserving callbacks and accessible names", async () => {
    const user = userEvent.setup()
    const { props, rerender } = renderItem({ isExpanded: false })

    const excludeButton = screen.getByRole("button", {
      name: "Loại khỏi bản nháp Thiết bị 1",
    })
    expect(excludeButton).toHaveTextContent("Loại trừ")
    expect(excludeButton).not.toHaveTextContent("Thiết bị 1")
    await user.click(excludeButton)
    expect(props.onExclude).toHaveBeenCalledWith("item-1")

    const onRestore = vi.fn()
    rerender(
      <DeviceQuotaDraftCatalogItemRow
        {...props}
        row={{ ...item, isExcluded: true, completeness: "excluded" }}
        onRestore={onRestore}
      />
    )

    const restoreButton = screen.getByRole("button", { name: "Khôi phục Thiết bị 1" })
    expect(restoreButton).toHaveTextContent("Khôi phục")
    expect(restoreButton).not.toHaveTextContent("Thiết bị 1")
    await user.click(restoreButton)
    expect(onRestore).toHaveBeenCalledWith("item-1")
  })
})
