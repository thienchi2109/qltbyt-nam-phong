import * as React from "react"
import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlusCircle, Sparkles } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { MobileFloatingActionMenu } from "../MobileFloatingActionMenu"

vi.mock("@heroui/react", () => ({
  Dropdown: ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setOpen] = React.useState(true)

    return (
      <div data-testid="heroui-dropdown">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) {
            return child
          }

          return React.cloneElement(child, {
            isOpen,
            setOpen,
          } as Partial<{
            isOpen: boolean
            setOpen: React.Dispatch<React.SetStateAction<boolean>>
          }>)
        })}
      </div>
    )
  },
  DropdownTrigger: ({
    children,
    className,
    isOpen: _isOpen,
    setOpen,
    ...props
  }: {
    children: React.ReactNode
    className?: string
    isOpen?: boolean
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" className={className} onClick={() => setOpen?.(true)} {...props}>
      {children}
    </button>
  ),
  DropdownPopover: ({
    children,
    className,
    isOpen,
    setOpen,
  }: {
    children: React.ReactNode
    className?: string
    isOpen?: boolean
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  }) => (
    <div className={className} data-testid="heroui-popover">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) {
          return child
        }

        return React.cloneElement(child, {
          isOpen,
          setOpen,
        } as Partial<{
          isOpen: boolean
          setOpen: React.Dispatch<React.SetStateAction<boolean>>
        }>)
      })}
    </div>
  ),
  DropdownMenu: ({
    children,
    "aria-label": ariaLabel,
    isOpen,
    onAction,
    setOpen,
  }: {
    children: React.ReactNode
    "aria-label"?: string
    isOpen?: boolean
    onAction?: (key: React.Key) => void
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  }) => {
    if (!isOpen) {
      return null
    }

    return (
      <div aria-label={ariaLabel} role="menu">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement<{ id?: string }>(child)) {
            return child
          }

          return React.cloneElement(child, {
            onSelectKey: onAction,
            closeSourceMenu: () => setOpen?.(false),
          } as Partial<{
            closeSourceMenu: () => void
            onSelectKey: (key: React.Key) => void
          }>)
        })}
      </div>
    )
  },
  DropdownItem: ({
    children,
    closeSourceMenu,
    id,
    onSelectKey,
  }: {
    children: React.ReactNode
    closeSourceMenu?: () => void
    id?: string
    onSelectKey?: (key: React.Key) => void
  }) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        if (!id) {
          return
        }

        document.body.style.pointerEvents = "none"
        setTimeout(() => {
          closeSourceMenu?.()
          document.body.style.pointerEvents = ""
        }, 0)
        onSelectKey?.(id)
      }}
    >
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
    await waitFor(() => expect(openAssistant).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: "Mở tác vụ nhanh" }))
    await user.click(screen.getByRole("menuitem", { name: "Tạo yêu cầu" }))

    await waitFor(() => expect(openCreate).toHaveBeenCalledTimes(1))
  })

  it("defers selected actions until after the HeroUI source menu closes", async () => {
    vi.useFakeTimers()
    document.body.style.pointerEvents = ""

    const openAssistant = vi.fn(() => document.body.style.pointerEvents)

    try {
      render(
        <MobileFloatingActionMenu
          actions={[
            {
              id: "assistant",
              label: "Trợ lý AI",
              icon: <Sparkles />,
              onSelect: openAssistant,
            },
          ]}
        />
      )

      fireEvent.click(screen.getByRole("menuitem", { name: "Trợ lý AI" }))

      expect(screen.getByRole("menu", { name: "Tác vụ nhanh" })).toBeInTheDocument()
      expect(openAssistant).not.toHaveBeenCalled()
      expect(document.body.style.pointerEvents).toBe("none")

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(screen.queryByRole("menu", { name: "Tác vụ nhanh" })).not.toBeInTheDocument()
      expect(document.body.style.pointerEvents).not.toBe("none")
      expect(openAssistant).toHaveReturnedWith("")
    } finally {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
      document.body.style.pointerEvents = ""
    }
  })
})
