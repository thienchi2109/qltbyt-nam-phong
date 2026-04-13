import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FilterModal } from "@/components/transfers/FilterModal"

describe("FilterModal", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as typeof window.matchMedia
  })

  it("clears status and date range filters from the modal controls", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <FilterModal
        open
        onOpenChange={vi.fn()}
        onChange={onChange}
        value={{
          statuses: ["cho_duyet"],
          dateRange: {
            from: new Date("2026-04-02T00:00:00.000Z"),
            to: new Date("2026-04-05T00:00:00.000Z"),
          },
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Xóa" }))

    expect(onChange).toHaveBeenCalledWith({
      statuses: [],
      dateRange: null,
    })
  })
})
