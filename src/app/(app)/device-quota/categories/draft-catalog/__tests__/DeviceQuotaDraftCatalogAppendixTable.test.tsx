import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import {
  defaultEditorState,
  makeItem,
  makeRows,
  makeSection,
  makeTopLevelItem,
  metadata,
} from "./DeviceQuotaDraftCatalogTestSupport"

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof DeviceQuotaDraftCatalogEditor>> = {}
) {
  const props: React.ComponentProps<typeof DeviceQuotaDraftCatalogEditor> = {
    rows: makeRows(),
    metadata,
    validationErrors: {},
    state: defaultEditorState,
    onUpdateItem: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onExclude: vi.fn().mockResolvedValue(undefined),
    onRestore: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }

  return { ...render(<DeviceQuotaDraftCatalogEditor {...props} />), props }
}

describe("DeviceQuotaDraftCatalog appendix table contract", () => {
  it("renders grouped headers and every source row in source order", () => {
    renderEditor()

    const table = screen.getByRole("table", {
      name: "Phụ lục định mức thiết bị theo Thông tư 10/2026",
    })
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.trim())

    expect(headers).toEqual([
      "Theo Thông tư 10/2026",
      "Thông tin dự thảo của đơn vị",
      "TT",
      "Chủng loại",
      "Đơn vị tính",
      "Số lượng định mức",
      "ĐVT áp dụng",
      "SL đề xuất",
      "Ghi chú",
    ])
    expect(screen.getAllByTestId(/^device-quota-catalog-section-/)).toHaveLength(5)
    expect(screen.getAllByTestId(/^device-quota-catalog-row-/)).toHaveLength(37)
    expect(screen.getAllByTestId(/^device-quota-catalog-(row|section)-/)).toHaveLength(42)

    const sourceOrders = within(table)
      .getAllByTestId(/^device-quota-catalog-(row|section)-/)
      .map((row) => Number(row.getAttribute("data-source-order")))
    expect(sourceOrders).toEqual([...sourceOrders].sort((left, right) => left - right))
    const expectedIdentifiers = makeRows()
      .slice()
      .sort((left, right) => left.sourceOrder - right.sourceOrder)
      .map((row) => row.sourceIdentifier)
    const renderedIdentifiers = within(table)
      .getAllByTestId(/^device-quota-catalog-(row|section)-/)
      .map((row) =>
        row.getAttribute("data-testid")?.replace(/^device-quota-catalog-(?:row|section)-/, "")
      )
    expect(renderedIdentifiers).toEqual(expectedIdentifiers)
    expect(within(table).getAllByRole("rowgroup")).toHaveLength(6)
  })

  it("keeps source columns read-only and exposes only the three ordinary draft inputs", () => {
    renderEditor({ rows: [makeSection(1), makeItem(1, 1)] })

    const row = screen.getByTestId("device-quota-catalog-row-item-1")
    expect(within(row).getByText("1.1")).toBeInTheDocument()
    expect(within(row).getByText("Thiết bị 1")).toBeInTheDocument()
    expect(within(row).getByText("Máy", { selector: "[data-source-unit]" })).toBeInTheDocument()
    expect(within(row).getByText("Tối thiểu 01 máy")).toBeInTheDocument()
    expect(within(row).getByText("Tối đa 02 máy")).toBeInTheDocument()
    expect(within(row).getAllByRole("textbox")).toHaveLength(2)
    expect(within(row).getByRole("textbox", { name: "ĐVT áp dụng - Thiết bị 1" })).toHaveAttribute(
      "placeholder",
      "Máy"
    )
    expect(
      within(row).getByRole("spinbutton", { name: "SL đề xuất - Thiết bị 1" })
    ).toBeInTheDocument()
    expect(within(row).getByRole("textbox", { name: "Ghi chú - Thiết bị 1" })).toBeInTheDocument()
    expect(within(row).queryByRole("textbox", { name: /Chủng loại/ })).not.toBeInTheDocument()
  })

  it("shows the source unit as a non-persisted suggestion and preserves an override", () => {
    const onUpdateItem = vi.fn()
    const { rerender } = renderEditor({
      rows: [makeItem(1, 1)],
      onUpdateItem,
    })

    expect(screen.getByRole("textbox", { name: "ĐVT áp dụng - Thiết bị 1" })).toHaveValue("")
    expect(onUpdateItem).not.toHaveBeenCalled()

    rerender(
      <DeviceQuotaDraftCatalogEditor
        rows={[{ ...makeItem(1, 1), appliedUnit: "Hệ thống" }]}
        metadata={metadata}
        validationErrors={{}}
        state={defaultEditorState}
        onUpdateItem={onUpdateItem}
        onSave={vi.fn()}
        onExclude={vi.fn()}
        onRestore={vi.fn()}
      />
    )

    expect(screen.getByRole("textbox", { name: "ĐVT áp dụng - Thiết bị 1" })).toHaveValue(
      "Hệ thống"
    )
  })

  it("uses user-event for draft edits, secondary name editing, save, exclude, and restore", async () => {
    const user = userEvent.setup()
    const onUpdateItem = vi.fn()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onExclude = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderEditor({
      rows: [makeItem(1, 1)],
      state: { ...defaultEditorState, isDirty: true },
      onUpdateItem,
      onSave,
      onExclude,
    })

    await user.type(screen.getByRole("textbox", { name: "ĐVT áp dụng - Thiết bị 1" }), "B")
    expect(onUpdateItem).toHaveBeenLastCalledWith("item-1", { appliedUnit: "B" })
    await user.type(screen.getByRole("spinbutton", { name: "SL đề xuất - Thiết bị 1" }), "3")
    expect(onUpdateItem).toHaveBeenLastCalledWith("item-1", { appliedQuantity: 3 })
    await user.click(screen.getByRole("button", { name: "Chỉnh tên hiển thị Thiết bị 1" }))
    await user.type(screen.getByRole("textbox", { name: "Tên hiển thị - Thiết bị 1" }), "M")
    expect(onUpdateItem).toHaveBeenLastCalledWith("item-1", { displayNameOverride: "M" })
    await user.click(screen.getByRole("button", { name: "Lưu" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Loại khỏi bản nháp Thiết bị 1" }))
    expect(onExclude).toHaveBeenCalledWith("item-1")

    const onRestore = vi.fn().mockResolvedValue(undefined)
    rerender(
      <DeviceQuotaDraftCatalogEditor
        rows={[{ ...makeItem(1, 1), isExcluded: true, completeness: "excluded" }]}
        metadata={metadata}
        validationErrors={{}}
        state={defaultEditorState}
        onUpdateItem={onUpdateItem}
        onSave={onSave}
        onExclude={onExclude}
        onRestore={onRestore}
      />
    )
    await user.click(screen.getByRole("button", { name: "Khôi phục Thiết bị 1" }))
    expect(onRestore).toHaveBeenCalledWith("item-1")
  })

  it("keeps validation, read-only mode, top-level order, and table containment", () => {
    const topLevel = makeTopLevelItem()
    const { rerender } = renderEditor({
      rows: [makeSection(1), topLevel, makeItem(1, 1)],
      state: { ...defaultEditorState, isDirty: true },
      validationErrors: { "item-1": "Số lượng phải là số nguyên không âm." },
    })

    expect(screen.getByText("Số lượng phải là số nguyên không âm.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    const viewport = screen.getByTestId("device-quota-draft-catalog-table-viewport")
    expect(viewport).toHaveClass("overflow-auto", "min-w-0")
    expect(screen.getByTestId("device-quota-draft-catalog-sticky-tt")).toHaveClass("sticky")
    expect(screen.getByTestId("device-quota-draft-catalog-sticky-name")).toHaveClass("sticky")
    expect(screen.getByTestId("device-quota-catalog-row-top-level-item")).toBeInTheDocument()
    expect(screen.queryByTestId("device-quota-draft-catalog-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId(/^device-quota-catalog-summary-/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Mở rộng Thiết bị/ })).not.toBeInTheDocument()

    rerender(
      <DeviceQuotaDraftCatalogEditor
        rows={[makeItem(1, 1)]}
        metadata={{ ...metadata, mode: "readonly" }}
        validationErrors={{}}
        state={{ ...defaultEditorState, isReadOnly: true }}
        onUpdateItem={vi.fn()}
        onSave={vi.fn()}
        onExclude={vi.fn()}
        onRestore={vi.fn()}
      />
    )
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
  })

  it("locks every write affordance while a mutation is pending", () => {
    renderEditor({
      rows: [makeItem(1, 1)],
      state: { ...defaultEditorState, isDirty: true, isRecovering: true },
    })

    expect(screen.getByRole("button", { name: "Chỉnh tên hiển thị Thiết bị 1" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Loại khỏi bản nháp Thiết bị 1" })).toBeDisabled()
    expect(screen.getByRole("textbox", { name: "ĐVT áp dụng - Thiết bị 1" })).toBeDisabled()
    expect(screen.getByRole("spinbutton", { name: "SL đề xuất - Thiết bị 1" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
  })
})
