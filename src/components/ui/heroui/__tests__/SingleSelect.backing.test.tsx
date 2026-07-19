import type { ButtonHTMLAttributes, HTMLAttributes, Key, ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

type MockSelectProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode
  fullWidth?: boolean
  selectedKey?: Key | null
  onSelectionChange?: (key: Key | null) => void
  isDisabled?: boolean
  placeholder?: string
  "aria-label"?: string
}

type MockListBoxItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode
  id?: Key
  textValue?: string
  isDisabled?: boolean
}

vi.mock("@heroui/react/select", async () => {
  const ReactRuntime = await import("react")

  const SelectRoot = ({
    children,
    fullWidth,
    selectedKey,
    onSelectionChange,
    isDisabled,
    placeholder,
    ...props
  }: MockSelectProps) =>
    ReactRuntime.createElement(
      "div",
      {
        ...props,
        "data-disabled": String(Boolean(isDisabled)),
        "data-full-width": String(Boolean(fullWidth)),
        "data-placeholder": placeholder,
        "data-selected-key": selectedKey === null ? "" : String(selectedKey),
        "data-testid": "heroui-select-root",
      },
      children,
      ReactRuntime.createElement(
        "button",
        {
          "data-testid": "select-next",
          onClick: () => onSelectionChange?.("next"),
          type: "button",
        },
        "Select next"
      ),
      ReactRuntime.createElement(
        "button",
        {
          "data-testid": "clear-selection",
          onClick: () => onSelectionChange?.(null),
          type: "button",
        },
        "Clear selection"
      )
    )

  const Select = Object.assign(SelectRoot, {
    Trigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
      ReactRuntime.createElement(
        "button",
        { ...props, "data-testid": "heroui-select-trigger", type: "button" },
        children
      ),
    Value: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) =>
      ReactRuntime.createElement(
        "span",
        { ...props, "data-testid": "heroui-select-value" },
        children
      ),
    Indicator: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) =>
      ReactRuntime.createElement(
        "span",
        { ...props, "data-testid": "heroui-select-indicator" },
        children
      ),
    Popover: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
      ReactRuntime.createElement(
        "div",
        { ...props, "data-testid": "heroui-select-popover" },
        children
      ),
  })

  return { Select }
})

vi.mock("@heroui/react/list-box", async () => {
  const ReactRuntime = await import("react")

  const ItemIndicator = ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) =>
    ReactRuntime.createElement(
      "span",
      { ...props, "data-testid": "heroui-listbox-item-indicator" },
      children
    )
  const Item = Object.assign(
    ({ children, id, textValue, isDisabled, ...props }: MockListBoxItemProps) =>
      ReactRuntime.createElement(
        "button",
        {
          ...props,
          "data-id": id === undefined ? "" : String(id),
          "data-text-value": textValue,
          "data-testid": "heroui-listbox-item",
          disabled: isDisabled,
          type: "button",
        },
        children
      ),
    { Indicator: ItemIndicator }
  )
  const ListBox = Object.assign(
    ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
      ReactRuntime.createElement("div", { ...props, "data-testid": "heroui-listbox" }, children),
    {
      Item,
      ItemIndicator,
    }
  )

  return { ListBox }
})

import { SingleSelect } from "../SingleSelect"

describe("SingleSelect HeroUI backing", () => {
  it("maps the app contract onto HeroUI compound components", () => {
    render(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        className="sm:w-[280px]"
        disabled
        onValueChange={vi.fn()}
        options={[
          { value: "draft-2", label: "Phiên bản 2 · Bản nháp" },
          {
            value: "locked-1",
            label: "Phiên bản 1 · Đã khóa",
            disabled: true,
          },
        ]}
        placeholder="Chọn phiên bản"
        value="draft-2"
      />
    )

    const root = screen.getByTestId("heroui-select-root")
    expect(root).toHaveClass("sm:w-[280px]")
    expect(root).toHaveAttribute("aria-label", "Lịch sử phiên bản")
    expect(root).toHaveAttribute("data-disabled", "true")
    expect(root).toHaveAttribute("data-full-width", "true")
    expect(root).toHaveAttribute("data-placeholder", "Chọn phiên bản")
    expect(root).toHaveAttribute("data-selected-key", "draft-2")
    expect(screen.getByTestId("heroui-select-trigger")).toHaveClass("h-10", "w-full")
    expect(screen.getByTestId("heroui-select-value")).toBeInTheDocument()
    expect(screen.getByTestId("heroui-select-popover")).toContainElement(
      screen.getByTestId("heroui-listbox")
    )
    expect(screen.getAllByTestId("heroui-listbox-item")[1]).toHaveAttribute(
      "data-text-value",
      "Phiên bản 1 · Đã khóa"
    )
    expect(screen.getAllByTestId("heroui-listbox-item")[1]).toBeDisabled()
    expect(screen.getAllByTestId("heroui-listbox-item-indicator")).toHaveLength(2)
  })

  it("forwards string selections and ignores null selections", () => {
    const onValueChange = vi.fn()

    render(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        onValueChange={onValueChange}
        options={[]}
        value={null}
      />
    )

    fireEvent.click(screen.getByTestId("select-next"))
    fireEvent.click(screen.getByTestId("clear-selection"))

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("next")
  })
})
