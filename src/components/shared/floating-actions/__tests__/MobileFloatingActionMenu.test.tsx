import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlusCircle, Sparkles } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { MobileFloatingActionMenu } from "../MobileFloatingActionMenu"

vi.mock("@heroui/react", () => ({
  Dropdown: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="heroui-dropdown">{children}</div>
  ),
  DropdownTrigger: ({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode
    className?: string
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  ),
  DropdownPopover: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="heroui-popover">
      {children}
    </div>
  ),
  DropdownMenu: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode
    "aria-label"?: string
  }) => (
    <div aria-label={ariaLabel} role="menu">
      {children}
    </div>
  ),
  DropdownItem: ({ children, onAction }: { children: React.ReactNode; onAction?: () => void }) => (
    <button type="button" role="menuitem" onClick={onAction}>
      {children}
    </button>
  ),
}))

describe("MobileFloatingActionMenu", () => {
  it("renders a single fixed mobile trigger using the floating action class contract", () => {
    render(
      <MobileFloatingActionMenu
        actions={[
          {
            id: "assistant",
            label: "Trợ lý AI",
            icon: <Sparkles />,
            onSelect: vi.fn(),
          },
        ]}
      />
    )

    const trigger = screen.getByRole("button", { name: "Mở tác vụ nhanh" })

    expect(trigger).toHaveClass("fixed")
    expect(trigger).toHaveClass("right-6")
    expect(trigger.className).toContain("bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)]")
    expect(trigger).toHaveClass("z-[100]")
    expect(trigger).toHaveClass("md:hidden")
    expect(trigger).toHaveClass("size-14")
    expect(trigger).toHaveClass("rounded-full")
    expect(screen.getByTestId("heroui-popover")).toHaveClass("z-[1001]")
  })

  it("renders accessible assistant and page actions and calls their callbacks", async () => {
    const user = userEvent.setup()
    const openAssistant = vi.fn()
    const openCreate = vi.fn()

    render(
      <MobileFloatingActionMenu
        actions={[
          {
            id: "assistant",
            label: "Trợ lý AI",
            icon: <Sparkles />,
            onSelect: openAssistant,
          },
          {
            id: "create-repair-request",
            label: "Tạo yêu cầu",
            icon: <PlusCircle />,
            onSelect: openCreate,
          },
        ]}
      />
    )

    await user.click(screen.getByRole("menuitem", { name: "Trợ lý AI" }))
    await user.click(screen.getByRole("menuitem", { name: "Tạo yêu cầu" }))

    expect(openAssistant).toHaveBeenCalledTimes(1)
    expect(openCreate).toHaveBeenCalledTimes(1)
  })
})
