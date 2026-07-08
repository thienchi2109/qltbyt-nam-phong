import * as React from "react"
import { use } from "react"
import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { EquipmentHeroDropdown } from "../controls"

vi.mock("@heroui/react", () => {
  interface DropdownState {
    isOpen: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  }

  const DropdownContext = React.createContext<DropdownState | null>(null)

  function useDropdownState() {
    const state = use(DropdownContext)

    if (!state) {
      throw new Error("HeroUI dropdown mock used outside Dropdown")
    }

    return state
  }

  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Dropdown: ({ children }: { children: React.ReactNode }) => {
      const [isOpen, setOpen] = React.useState(false)

      return (
        <DropdownContext.Provider value={{ isOpen, setOpen }}>
          <div data-testid="heroui-dropdown">{children}</div>
        </DropdownContext.Provider>
      )
    },
    DropdownTrigger: ({
      children,
      className,
    }: {
      children: React.ReactNode
      className?: string
    }) => {
      const { setOpen } = useDropdownState()

      return (
        <button className={className} type="button" onClick={() => setOpen(true)}>
          {children}
        </button>
      )
    },
    DropdownPopover: ({
      children,
      className,
    }: {
      children: React.ReactNode
      className?: string
    }) => {
      const { isOpen } = useDropdownState()

      return isOpen ? (
        <div className={className} data-testid="source-menu">
          {children}
        </div>
      ) : null
    },
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
    DropdownItem: ({
      children,
      isDisabled,
      onAction,
      textValue,
    }: {
      children: React.ReactNode
      isDisabled?: boolean
      onAction?: () => void
      textValue?: string
    }) => {
      const { setOpen } = useDropdownState()

      return (
        <button
          aria-label={textValue}
          disabled={isDisabled}
          role="menuitem"
          type="button"
          onClick={() => {
            document.body.style.pointerEvents = "none"
            onAction?.()
            setOpen(false)
            document.body.style.pointerEvents = ""
          }}
        >
          {children}
        </button>
      )
    },
  }
})

describe("EquipmentHeroDropdown", () => {
  it("defers item actions until after the HeroUI source menu closes", async () => {
    vi.useFakeTimers()
    document.body.style.pointerEvents = ""

    const onAction = vi.fn(() => document.body.style.pointerEvents)

    try {
      render(
        <EquipmentHeroDropdown
          ariaLabel="Tác vụ kiểm thử"
          items={[
            {
              id: "open-dialog",
              label: "Mở hộp thoại",
              textValue: "Mở hộp thoại",
              onAction,
            },
          ]}
          trigger="Tác vụ kiểm thử"
        />
      )

      fireEvent.click(screen.getByRole("button", { name: "Tác vụ kiểm thử" }))
      fireEvent.click(screen.getByRole("menuitem", { name: "Mở hộp thoại" }))

      expect(screen.queryByTestId("source-menu")).not.toBeInTheDocument()
      expect(onAction).not.toHaveBeenCalled()
      expect(document.body.style.pointerEvents).not.toBe("none")

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(onAction).toHaveReturnedWith("")
    } finally {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
      document.body.style.pointerEvents = ""
    }
  })

  it("keeps disabled menu items from dispatching actions", async () => {
    const onAction = vi.fn()

    render(
      <EquipmentHeroDropdown
        ariaLabel="Tác vụ kiểm thử"
        items={[
          {
            id: "export",
            label: "Đang tải...",
            textValue: "Đang tải...",
            isDisabled: true,
            onAction,
          },
        ]}
        trigger="Tác vụ kiểm thử"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Tác vụ kiểm thử" }))

    expect(await screen.findByRole("menuitem", { name: "Đang tải..." })).toBeDisabled()
    expect(onAction).not.toHaveBeenCalled()
  })
})
