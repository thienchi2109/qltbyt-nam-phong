import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode
  onPress?: () => void
}

type MockInputProps = InputHTMLAttributes<HTMLInputElement>

type MockElementProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode
}

function createMockElement(
  ReactRuntime: typeof import("react"),
  tagName: "div" | "span",
  testId: string
) {
  return ({ children, ...props }: MockElementProps) =>
    ReactRuntime.createElement(tagName, { ...props, "data-testid": testId }, children)
}

vi.mock("@heroui/react/button", async () => {
  const ReactRuntime = await import("react")

  return {
    Button: ({ children, onPress, onClick, ...props }: MockButtonProps) =>
      ReactRuntime.createElement(
        "button",
        {
          ...props,
          "data-testid": "heroui-button",
          onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
            onPress?.()
            onClick?.(event)
          },
        },
        children
      ),
  }
})

vi.mock("@heroui/react/input", async () => {
  const ReactRuntime = await import("react")

  return {
    Input: ReactRuntime.forwardRef<HTMLInputElement, MockInputProps>((props, ref) =>
      ReactRuntime.createElement("input", { ...props, ref, "data-testid": "heroui-input" })
    ),
  }
})

vi.mock("@heroui/react/badge", async () => {
  const ReactRuntime = await import("react")

  return { Badge: createMockElement(ReactRuntime, "span", "heroui-badge") }
})

vi.mock("@heroui/react/popover", async () => {
  const ReactRuntime = await import("react")

  type PopoverProps = {
    children: ReactNode
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
  }

  type PopoverChildProps = {
    children?: ReactNode
    className?: string
  } & Record<string, unknown>

  const Trigger = ({ children, ...props }: PopoverChildProps) =>
    ReactRuntime.createElement(
      "div",
      { ...props, "data-testid": "heroui-popover-trigger" },
      children
    )

  const Content = ({ children, ...props }: PopoverChildProps) =>
    ReactRuntime.createElement(
      "dialog",
      { ...props, open: true, "data-testid": "heroui-popover-content" },
      children
    )

  const Dialog = ({ children, ...props }: PopoverChildProps) =>
    ReactRuntime.createElement(
      "div",
      { ...props, "data-testid": "heroui-popover-dialog" },
      children
    )

  const Popover = Object.assign(
    ({ children, isOpen: controlledOpen, onOpenChange }: PopoverProps) => {
      const [uncontrolledOpen, setUncontrolledOpen] = ReactRuntime.useState(false)
      const open = controlledOpen ?? uncontrolledOpen
      const setOpen = (nextOpen: boolean) => {
        setUncontrolledOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }

      return ReactRuntime.createElement(
        "div",
        { "data-testid": "heroui-popover-root" },
        ReactRuntime.Children.map(children, (child) => {
          if (!ReactRuntime.isValidElement(child)) return child
          if (child.type === Content && !open) return null
          if (child.type === Trigger) {
            return ReactRuntime.cloneElement(child, {
              onClick: () => setOpen(!open),
            } as Partial<PopoverChildProps>)
          }
          return child
        })
      )
    },
    {
      Content,
      Dialog,
      Trigger,
    }
  )

  return { Popover }
})

import { FacetedMultiSelectFilter } from "../FacetedMultiSelectFilter"

const OPTIONS = [
  { label: "ICU", value: "ICU" },
  { label: "Surgery", value: "Surgery" },
]

describe("FacetedMultiSelectFilter HeroUI backing", () => {
  it("renders trigger, popover, search input, and selected count through HeroUI primitives", () => {
    render(
      <FacetedMultiSelectFilter
        title="Khoa/Phòng"
        options={OPTIONS}
        value={["ICU"]}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByTestId("heroui-popover-root")).toBeInTheDocument()
    expect(screen.getByTestId("heroui-popover-trigger")).toContainElement(
      screen.getByRole("button", { name: /Khoa\/Phòng/i })
    )
    expect(screen.getByTestId("heroui-button")).toHaveTextContent("Khoa/Phòng")
    expect(screen.getByTestId("heroui-badge")).toHaveTextContent("1")

    fireEvent.click(screen.getByRole("button", { name: /Khoa\/Phòng/i }))

    expect(screen.getByTestId("heroui-popover-content")).toBeInTheDocument()
    expect(screen.getByTestId("heroui-input")).toHaveAttribute(
      "aria-label",
      "Tìm lựa chọn Khoa/Phòng"
    )
  })
})
