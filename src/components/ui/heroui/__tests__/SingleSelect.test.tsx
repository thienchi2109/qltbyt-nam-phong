import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SingleSelect } from "../SingleSelect"

const OPTIONS = [
  { value: "draft-2", label: "Phiên bản 2 · Bản nháp" },
  { value: "locked-1", label: "Phiên bản 1 · Đã khóa" },
] as const

describe("SingleSelect", () => {
  it("renders the selected label and placeholder", () => {
    const { rerender } = render(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        onValueChange={vi.fn()}
        options={OPTIONS}
        placeholder="Chọn phiên bản"
        value="locked-1"
      />
    )

    expect(screen.getByRole("button", { name: /Lịch sử phiên bản/ })).toHaveTextContent(
      "Phiên bản 1 · Đã khóa"
    )

    rerender(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        onValueChange={vi.fn()}
        options={OPTIONS}
        placeholder="Chọn phiên bản"
        value={null}
      />
    )

    expect(screen.getByRole("button", { name: /Lịch sử phiên bản/ })).toHaveTextContent(
      "Chọn phiên bản"
    )
  })

  it("opens with ArrowDown and reports an option click", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        onValueChange={onValueChange}
        options={OPTIONS}
        value="locked-1"
      />
    )

    const trigger = screen.getByRole("button", { name: /Lịch sử phiên bản/ })
    act(() => trigger.focus())
    await user.keyboard("{ArrowDown}")

    await user.click(await screen.findByRole("option", { name: "Phiên bản 2 · Bản nháp" }))

    expect(onValueChange).toHaveBeenCalledWith("draft-2")
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"))
  })

  it("keeps a disabled trigger and disabled option non-interactive", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    const { rerender } = render(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        disabled
        onValueChange={onValueChange}
        options={OPTIONS}
        value="locked-1"
      />
    )

    const disabledTrigger = screen.getByRole("button", { name: /Lịch sử phiên bản/ })
    expect(disabledTrigger).toBeDisabled()
    act(() => disabledTrigger.focus())
    await user.keyboard("{ArrowDown}")
    expect(screen.queryByRole("option")).not.toBeInTheDocument()

    rerender(
      <SingleSelect
        ariaLabel="Lịch sử phiên bản"
        onValueChange={onValueChange}
        options={[
          OPTIONS[0],
          {
            ...OPTIONS[1],
            disabled: true,
          },
        ]}
        value="draft-2"
      />
    )

    const trigger = screen.getByRole("button", { name: /Lịch sử phiên bản/ })
    await user.click(trigger)
    const disabledOption = await screen.findByRole("option", {
      name: "Phiên bản 1 · Đã khóa",
    })

    expect(disabledOption).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(disabledOption)
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
