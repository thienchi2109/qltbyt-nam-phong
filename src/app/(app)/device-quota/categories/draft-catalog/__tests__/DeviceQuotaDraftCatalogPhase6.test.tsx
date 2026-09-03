import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import { defaultEditorState, makeRows, metadata } from "./DeviceQuotaDraftCatalogTestSupport"

function renderEvidenceEditor() {
  return render(
    <DeviceQuotaDraftCatalogEditor
      rows={makeRows()}
      metadata={metadata}
      validationErrors={{}}
      state={defaultEditorState}
      onUpdateItem={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onExclude={vi.fn().mockResolvedValue(undefined)}
      onRestore={vi.fn().mockResolvedValue(undefined)}
    />
  )
}

describe("DeviceQuotaDraftCatalog Phase 6 visual evidence contracts", () => {
  it.each([
    { label: "1024px", width: 1024, height: 768 },
    { label: "1280x720", width: 1280, height: 720 },
    { label: "1366x768", width: 1366, height: 768 },
    { label: "1440x900", width: 1440, height: 900 },
  ])("keeps the appendix table contract at $label", async ({ width, height }) => {
    const user = userEvent.setup()
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height })
    renderEvidenceEditor()

    const viewport = screen.getByTestId("device-quota-draft-catalog-table-viewport")
    const table = screen.getByRole("table", {
      name: "Phụ lục định mức thiết bị theo Thông tư 10/2026",
    })
    expect(viewport).toHaveClass("min-w-0", "overflow-auto")
    expect(table).toBeInTheDocument()
    expect(screen.getAllByTestId(/^device-quota-catalog-row-/)).toHaveLength(37)
    expect(screen.getAllByTestId(/^device-quota-catalog-section-/)).toHaveLength(5)
    expect(screen.getByTestId("device-quota-draft-catalog-sticky-tt")).toHaveClass("sticky")
    expect(screen.getByTestId("device-quota-draft-catalog-sticky-name")).toHaveClass("sticky")
    expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Chỉnh tên hiển thị Thiết bị 1" }))
    expect(screen.getByRole("textbox", { name: "Tên hiển thị - Thiết bị 1" })).toBeInTheDocument()
  })
})
