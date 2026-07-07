import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MobileBottomSheet } from "../mobile-bottom-sheet"

describe("MobileBottomSheet", () => {
  let showModal: ReturnType<typeof vi.fn>
  let close: ReturnType<typeof vi.fn>

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    ariaLabel: "Test bottom sheet",
  }

  beforeEach(() => {
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "")
    })
    close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open")
    })
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    })
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close,
    })
  })

  it("opens the native dialog modally when open", () => {
    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Sheet content</p>
      </MobileBottomSheet>
    )

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
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

  it("calls onOpenChange(false) when the native dialog is cancelled", () => {
    const onOpenChange = vi.fn()

    render(
      <MobileBottomSheet {...defaultProps} onOpenChange={onOpenChange}>
        <button>Inside</button>
      </MobileBottomSheet>
    )

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls onOpenChange(false) on backdrop click", () => {
    const onOpenChange = vi.fn()

    render(
      <MobileBottomSheet {...defaultProps} onOpenChange={onOpenChange}>
        <p>Content</p>
      </MobileBottomSheet>
    )

    const backdrop = screen.getByTestId("mobile-bottom-sheet-backdrop")
    fireEvent.click(backdrop)
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

  it("locks the dialog container to the viewport so the backdrop and panel cannot shrink", () => {
    render(
      <MobileBottomSheet {...defaultProps}>
        <p>Content</p>
      </MobileBottomSheet>
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveClass("fixed", "inset-0", "w-screen", "h-screen", "max-w-none")
  })

  it("applies custom className to the sheet panel", () => {
    render(
      <MobileBottomSheet {...defaultProps} className="custom-class">
        <p>Content</p>
      </MobileBottomSheet>
    )

    const dialog = screen.getByRole("dialog")
    // The className should be on the inner panel, not the outer container
    const panel = dialog.querySelector(".custom-class")
    expect(panel).toBeInTheDocument()
  })
})
