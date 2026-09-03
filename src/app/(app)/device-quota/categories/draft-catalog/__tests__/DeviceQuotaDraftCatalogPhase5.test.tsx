import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import {
  defaultEditorState,
  makeItem,
  makeRows,
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

describe("DeviceQuotaDraftCatalog Phase 5 regression hardening", () => {
  it("keeps the long-list scroll region and save toolbar separate", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({ state: { ...defaultEditorState, isDirty: true, isIncomplete: false }, onSave })

    const workspace = screen.getByTestId("device-quota-draft-catalog-workspace")
    const toolbar = screen.getByTestId("device-quota-draft-catalog-toolbar")
    const scrollRegion = screen.getByRole("region", { name: "Các nhóm thiết bị pháp quy" })
    const viewport = screen.getByTestId("device-quota-draft-catalog-table-viewport")
    expect(workspace).toContainElement(toolbar)
    expect(scrollRegion).not.toContainElement(toolbar)
    expect(scrollRegion).toContainElement(viewport)

    viewport.scrollTop = 640
    expect(viewport).toHaveProperty("scrollTop", 640)
    await user.click(screen.getByRole("button", { name: "Lưu" }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("keeps staged editing, validation, secondary naming, and ordinary save semantics", async () => {
    const user = userEvent.setup()
    const onUpdateItem = vi.fn()
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({
      rows: [makeItem(1, 1)],
      state: { ...defaultEditorState, isDirty: true },
      validationErrors: { "item-1": "Số lượng phải là số nguyên không âm." },
      onUpdateItem,
      onSave,
    })

    expect(screen.getByText("Số lượng phải là số nguyên không âm.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Chỉnh tên hiển thị Thiết bị 1" }))
    await user.type(screen.getByRole("textbox", { name: "Tên hiển thị - Thiết bị 1" }), "M")
    expect(onUpdateItem).toHaveBeenLastCalledWith("item-1", { displayNameOverride: "M" })
    expect(onSave).not.toHaveBeenCalled()
  })

  it("keeps excluded rows visible, pending controls locked, and read-only mode non-editable", async () => {
    const user = userEvent.setup()
    const excludedRow = { ...makeItem(1, 1), isExcluded: true, completeness: "excluded" as const }
    const { rerender } = renderEditor({
      rows: [excludedRow],
      state: { ...defaultEditorState, isDirty: true, isExcluding: true },
    })

    expect(screen.getByTestId("device-quota-catalog-row-item-1")).toHaveAttribute(
      "data-excluded",
      "true"
    )
    expect(screen.getByRole("button", { name: "Khôi phục Thiết bị 1" })).toBeDisabled()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

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
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Loại khỏi bản nháp/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Xem nguồn Thiết bị 1" }))
    expect(screen.getByText("Phụ lục, dòng 1")).toBeInTheDocument()
  })
})
