import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import { defaultEditorState, makeRows, metadata } from "./DeviceQuotaDraftCatalogTestSupport"

describe("DeviceQuotaDraftCatalog Phase 5 regression hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("keeps long-list navigation, expansion, disclosures, and Save coherent", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <DeviceQuotaDraftCatalogEditor
        rows={makeRows()}
        metadata={metadata}
        validationErrors={{}}
        state={{ ...defaultEditorState, isDirty: true, isIncomplete: false }}
        onUpdateItem={vi.fn()}
        onSave={onSave}
        onExclude={vi.fn().mockResolvedValue(undefined)}
        onRestore={vi.fn().mockResolvedValue(undefined)}
      />
    )

    const workspace = screen.getByTestId("device-quota-draft-catalog-workspace")
    const toolbar = screen.getByTestId("device-quota-draft-catalog-toolbar")
    const scrollRegion = screen.getByRole("region", {
      name: "Các nhóm thiết bị pháp quy",
    })
    expect(workspace).toContainElement(toolbar)
    expect(workspace).toContainElement(scrollRegion)
    expect(scrollRegion).not.toContainElement(toolbar)

    scrollRegion.scrollTop = 640
    expect(scrollRegion).toHaveProperty("scrollTop", 640)

    const sectionButton = screen.getByRole("button", { name: "Nhóm 5" })
    await user.click(sectionButton)

    expect(sectionButton).toHaveAttribute("aria-current", "true")
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" })

    const lastRow = screen.getByTestId("device-quota-catalog-row-item-37")
    await user.click(within(lastRow).getByRole("button", { name: "Mở rộng Thiết bị 37" }))
    expect(
      within(lastRow).getByRole("textbox", {
        name: "Tên hiển thị - Thiết bị 37",
      })
    ).toBeInTheDocument()

    await user.click(within(lastRow).getByRole("button", { name: "Xem nguồn Thiết bị 37" }))
    expect(within(lastRow).getByTestId("device-quota-source-details-item-37")).toBeInTheDocument()

    await user.click(within(lastRow).getByRole("button", { name: "Xem quy tắc Thiết bị 37" }))
    expect(within(lastRow).getByText("01 máy")).toBeInTheDocument()

    const saveButton = screen.getByRole("button", { name: "Lưu" })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
