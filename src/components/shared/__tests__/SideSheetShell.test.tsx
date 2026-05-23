import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) =>
    open ? (
      <div data-testid="sheet-root">
        <button type="button" onClick={() => onOpenChange?.(false)}>
          close sheet
        </button>
        {children}
      </div>
    ) : null,
  SheetContent: ({
    side,
    className,
    children,
  }: {
    side?: string
    className?: string
    children: React.ReactNode
  }) => (
    <div data-testid="sheet-content" data-side={side} className={className}>
      {children}
    </div>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-header" className={className}>
      {children}
    </div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

import { SideSheetShell } from "@/components/shared/SideSheetShell"

describe("SideSheetShell", () => {
  it("renders a right-side sheet shell with header, body, footer, and merged sizing", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <SideSheetShell
        open
        onOpenChange={onOpenChange}
        title="Sheet title"
        description="Sheet description"
        contentClassName="sm:max-w-lg"
        headerClassName="custom-header"
        footer={<button type="button">Save</button>}
      >
        <div>Sheet body</div>
      </SideSheetShell>,
    )

    const content = screen.getByTestId("sheet-content")
    expect(content).toHaveAttribute("data-side", "right")
    expect(content.className).toContain("w-full")
    expect(content.className).toContain("p-0")
    expect(content.className).toContain("sm:max-w-lg")
    expect(screen.getByTestId("sheet-header").className).toContain("custom-header")
    expect(screen.getByText("Sheet title")).toBeInTheDocument()
    expect(screen.getByText("Sheet description")).toBeInTheDocument()
    expect(screen.getByText("Sheet body")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "close sheet" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
