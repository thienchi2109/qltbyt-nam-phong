import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SearchInput } from "../SearchInput"

describe("SearchInput", () => {
  it("preserves the controlled search input contract", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <SearchInput
        aria-label="Tìm kiếm thiết bị"
        value=""
        onChange={onChange}
        placeholder="Nhập từ khóa"
      />
    )

    const input = screen.getByRole("searchbox", { name: "Tìm kiếm thiết bị" })

    expect(input).toHaveAttribute("type", "search")
    expect(input).toHaveAttribute("placeholder", "Nhập từ khóa")

    await user.type(input, "abc")

    expect(onChange).toHaveBeenCalledWith("a")
    expect(onChange).toHaveBeenCalledWith("b")
    expect(onChange).toHaveBeenCalledWith("c")
  })

  it("forwards refs and disabled state to the input element", () => {
    const ref = React.createRef<HTMLInputElement>()

    render(<SearchInput ref={ref} aria-label="Tìm kiếm" value="" onChange={vi.fn()} disabled />)

    const input = screen.getByRole("searchbox", { name: "Tìm kiếm" })

    expect(ref.current).toBe(input)
    expect(input).toBeDisabled()
  })

  it("clears with the clear button, calls onClear, and refocuses the input", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onClear = vi.fn()

    render(<SearchInput aria-label="Tìm kiếm" value="abc" onChange={onChange} onClear={onClear} />)

    const input = screen.getByRole("searchbox", { name: "Tìm kiếm" })
    await user.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }))

    expect(onChange).toHaveBeenCalledWith("")
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(input).toHaveFocus()
  })

  it("clears with Escape only when a value exists", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onClear = vi.fn()

    const { rerender } = render(
      <SearchInput aria-label="Tìm kiếm" value="abc" onChange={onChange} onClear={onClear} />
    )

    await user.click(screen.getByRole("searchbox", { name: "Tìm kiếm" }))
    await user.keyboard("{Escape}")

    expect(onChange).toHaveBeenCalledWith("")
    expect(onClear).toHaveBeenCalledTimes(1)

    onChange.mockClear()
    onClear.mockClear()

    rerender(<SearchInput aria-label="Tìm kiếm" value="" onChange={onChange} onClear={onClear} />)

    await user.click(screen.getByRole("searchbox", { name: "Tìm kiếm" }))
    await user.keyboard("{Escape}")

    expect(onChange).not.toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()
  })

  it("supports icon, clear button, and end addon visibility controls", () => {
    render(
      <SearchInput
        aria-label="Tìm kiếm"
        value="abc"
        onChange={vi.fn()}
        showSearchIcon={false}
        showClearButton={false}
        endAddon={<span data-testid="search-addon">A</span>}
      />
    )

    expect(screen.getByTestId("search-addon")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Xóa tìm kiếm" })).not.toBeInTheDocument()
  })

  it("keeps the outer search field visually separated from filter containers on focus", () => {
    render(<SearchInput aria-label="Tìm kiếm" value="" onChange={vi.fn()} />)

    const input = screen.getByRole("searchbox", { name: "Tìm kiếm" })

    expect(input).toHaveClass("border-slate-300")
    expect(input).toHaveClass("bg-white")
    expect(input).toHaveClass("focus-visible:border-primary")
    expect(input).toHaveClass("focus-visible:ring-2")
    expect(input).toHaveClass("focus-visible:ring-primary/20")
  })

  it("uses HeroUI instead of the shadcn input backing", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/shared/SearchInput.tsx"),
      "utf8"
    )

    expect(source).toContain("@heroui/react")
    expect(source).not.toContain("@/components/ui/input")
  })
})
