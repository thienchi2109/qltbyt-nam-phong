import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "./FacetedMultiSelectFilter.test-utils"

type MockSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  ref?: Ref<HTMLInputElement>
  showClearButton?: boolean
  value: string
  onChange: (value: string) => void
}

vi.mock("@/components/shared/SearchInput", async () => {
  const ReactRuntime = await import("react")

  return {
    SearchInput: ({ ref, showClearButton, value, onChange, ...props }: MockSearchInputProps) =>
      ReactRuntime.createElement("input", {
        ...props,
        ref,
        value,
        "data-show-clear-button": String(showClearButton),
        "data-testid": "shared-search-input",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event.currentTarget.value),
      }),
  }
})

vi.mock("@heroui/react/button", async () => {
  const ReactRuntime = await import("react")

  return {
    Button: ({
      children,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) =>
      ReactRuntime.createElement("button", props, children),
  }
})

import { FacetedMultiSelectFilter } from "../FacetedMultiSelectFilter"

const OPTIONS = [
  { label: "ICU", value: "ICU" },
  { label: "Surgery", value: "Surgery" },
]

describe("FacetedMultiSelectFilter shared SearchInput backing", () => {
  it("renders option search through the shared SearchInput component", () => {
    render(<FacetedMultiSelectFilter title="Khoa/Phòng" options={OPTIONS} />)

    fireEvent.click(screen.getByRole("button", { name: /Khoa\/Phòng/i }))

    const optionSearch = screen.getByTestId("shared-search-input")
    expect(optionSearch).toHaveAttribute("aria-label", "Tìm lựa chọn Khoa/Phòng")
    expect(optionSearch).toHaveAttribute("placeholder", "Tìm lựa chọn...")
    expect(optionSearch).toHaveAttribute("data-show-clear-button", "false")
  })
})
