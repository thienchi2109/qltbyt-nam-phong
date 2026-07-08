import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MobileBottomSheet } from "../mobile-bottom-sheet"

describe("MobileBottomSheet", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    ariaLabel: "Test bottom sheet",
  }

  it("opens without rendering a native dialog element", () => {
    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Sheet content</p>
      </MobileBottomSheet>
    )

    expect(document.querySelector("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Test bottom sheet" })).toBeInTheDocument()
  })

  it("does not call native showModal when opened", () => {
    const showModal = vi.fn(() => {
      throw new Error("native dialog API should not be used")
    })
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    })

    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Sheet content</p>
      </MobileBottomSheet>
    )

    expect(showModal).not.toHaveBeenCalled()
  })

  it("renders children when open", () => {
    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Sheet content</p>
      </MobileBottomSheet>
    )

    expect(screen.getByText("Sheet content")).toBeInTheDocument()
  })

  it("does not render when closed", () => {
    render(
      <MobileBottomSheet {...defaultProps} open={false}>
        <p>Sheet content</p>
      </MobileBottomSheet>
    )

    expect(screen.queryByText("Sheet content")).not.toBeInTheDocument()
  })

  it("calls onOpenChange(false) when Escape is pressed", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <MobileBottomSheet {...defaultProps} onOpenChange={onOpenChange}>
        <button>Inside</button>
      </MobileBottomSheet>
    )

    await user.keyboard("{Escape}")

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls onOpenChange(false) on backdrop click", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <MobileBottomSheet {...defaultProps} onOpenChange={onOpenChange}>
        <p>Content</p>
      </MobileBottomSheet>
    )

    const backdrop = screen.getByTestId("mobile-bottom-sheet-backdrop")
    await user.click(backdrop)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("renders a drag handle", () => {
    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Content</p>
      </MobileBottomSheet>
    )

    expect(screen.getByTestId("mobile-bottom-sheet-handle")).toBeInTheDocument()
  })

  it('has role="dialog" with correct aria-label and aria-modal', () => {
    render(
      <MobileBottomSheet {...defaultProps} ariaLabel="Filter sheet">
        <p>Content</p>
      </MobileBottomSheet>
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-label", "Filter sheet")
  })

  it("keeps the bottom sheet panel locked to the viewport width", () => {
    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Content</p>
      </MobileBottomSheet>
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveClass("fixed", "inset-x-0", "bottom-0", "w-full", "max-w-none")
  })

  it("applies custom className to the sheet panel", () => {
    render(
      <MobileBottomSheet {...defaultProps} className="custom-class">
        <p>Content</p>
      </MobileBottomSheet>
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveClass("custom-class")
  })

  it("restores focus to the opener when the sheet closes", async () => {
    const user = userEvent.setup()

    function ControlledSheet() {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open filters
          </button>
          <MobileBottomSheet open={open} onOpenChange={setOpen} ariaLabel="Test bottom sheet">
            <button type="button">Inside</button>
          </MobileBottomSheet>
        </>
      )
    }

    render(<ControlledSheet />)

    const opener = screen.getByRole("button", { name: "Open filters" })
    await user.click(opener)
    await user.keyboard("{Escape}")

    await waitFor(() => expect(opener).toHaveFocus())
  })
})
