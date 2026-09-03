import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import { defaultEditorState, makeRows, metadata } from "./DeviceQuotaDraftCatalogTestSupport"

const originalInnerWidth = window.innerWidth
const originalInnerHeight = window.innerHeight
let measuredWorkspaceWidth = originalInnerWidth
let observedTargets: Element[] = []

class EvidenceResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    observedTargets.push(target)
    this.callback(
      [
        {
          target,
          contentRect: { width: measuredWorkspaceWidth } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this
    )
  }

  unobserve(): void {}

  disconnect(): void {}
}

function setViewport(width: number, height = originalInnerHeight): void {
  measuredWorkspaceWidth = width
  const fallbackWidth = width < 1200 ? 1280 : 1024
  Object.defineProperty(window, "innerWidth", { configurable: true, value: fallbackWidth })
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height })
}

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
  beforeEach(() => {
    window.sessionStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    observedTargets = []
    vi.stubGlobal("ResizeObserver", EvidenceResizeObserver)
  })

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    })
    vi.unstubAllGlobals()
  })

  it.each([
    { label: "1024px", width: 1024, height: 768 },
    { label: "1280x720", width: 1280, height: 720 },
    { label: "1366x768", width: 1366, height: 768 },
    { label: "1440x900", width: 1440, height: 900 },
  ])("keeps the desktop workspace contract at $label", async ({ width, height }) => {
    const user = userEvent.setup()
    setViewport(width, height)
    renderEvidenceEditor()

    const body = screen.getByTestId("device-quota-draft-catalog-body")
    const sidebar = screen.getByTestId("device-quota-draft-catalog-sidebar")
    const content = screen.getByRole("region", { name: "Các nhóm thiết bị pháp quy" })
    const toolbar = screen.getByTestId("device-quota-draft-catalog-toolbar")

    expect(observedTargets).toContain(body)

    if (width === 1024) {
      expect(body).toHaveAttribute("data-structure-layout", "rail")
      expect(body).toHaveStyle({ gridTemplateColumns: "48px minmax(0, 1fr)" })
      expect(sidebar).toHaveAttribute("data-expanded", "false")

      await user.click(within(sidebar).getByRole("button", { name: "Mở bảng cấu trúc" }))

      expect(body).toHaveAttribute("data-structure-layout", "overlay")
      expect(body).toHaveStyle({ gridTemplateColumns: "48px minmax(0, 1fr)" })
      expect(sidebar).toHaveAttribute("data-overlay", "true")
      expect(sidebar).toHaveStyle({ width: "176px" })
    } else {
      expect(body).toHaveAttribute("data-structure-layout", "panel")
      expect(body).toHaveStyle({ gridTemplateColumns: "176px minmax(0, 1fr)" })
      expect(sidebar).toHaveAttribute("data-expanded", "true")
    }

    expect(body).toHaveClass("min-h-0", "overflow-hidden")
    expect(content).toHaveClass("min-w-0", "overflow-y-auto")
    expect(content).not.toContainElement(toolbar)
    expect(within(toolbar).getByRole("button", { name: "Lưu" })).toBeInTheDocument()
    expect(screen.getAllByTestId(/^device-quota-catalog-row-/)).toHaveLength(37)
    expect(screen.getAllByTestId(/^device-quota-catalog-section-/)).toHaveLength(5)

    await user.click(screen.getByRole("button", { name: "Mở rộng Thiết bị 1" }))

    const fieldGrid = screen.getByTestId("device-quota-catalog-field-grid-item-1")
    expect(fieldGrid).toHaveAttribute("data-field-grid", "shared")
    expect(fieldGrid).toHaveClass(
      "lg:grid-cols-2",
      "min-[1200px]:grid-cols-[minmax(0,1.2fr)_10rem_10rem_minmax(0,1fr)]"
    )
    expect(screen.getAllByTestId(/^device-quota-catalog-field-grid-/)).toHaveLength(1)
  })
})
