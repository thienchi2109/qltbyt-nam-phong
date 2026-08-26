import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationFilters } from "../_components/evaluation/TechnicalConfigurationEvaluationFilters"

const counts = {
  all: 12,
  not_evaluated: 4,
  fails: 0,
  insufficient_evidence: 2,
} as const

describe("technical configuration evaluation filters", () => {
  it("renders the four contract filters with authoritative counts including zero", () => {
    render(
      <TechnicalConfigurationEvaluationFilters
        value="not_evaluated"
        counts={counts}
        onValueChange={vi.fn()}
      />
    )

    const segmented = screen.getByRole("group", { name: "Bộ lọc trạng thái đánh giá" })
    const buttons = within(segmented).getAllByRole("button")

    expect(buttons).toHaveLength(4)
    expect(within(segmented).getByRole("button", { name: "Tất cả 12" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(within(segmented).getByRole("button", { name: "Chưa đánh giá 4" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(within(segmented).getByRole("button", { name: "Không đạt 0" })).toBeInTheDocument()
    expect(
      within(segmented).getByRole("button", { name: "Chưa đủ bằng chứng 2" })
    ).toBeInTheDocument()
  })

  it("keeps desktop buttons and the mobile select on the same callback contract", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <TechnicalConfigurationEvaluationFilters
        value="all"
        counts={counts}
        onValueChange={onValueChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Không đạt 0" }))
    expect(onValueChange).toHaveBeenLastCalledWith("fails")

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(screen.getByRole("option", { name: "Chưa đủ bằng chứng 2" }))
    expect(onValueChange).toHaveBeenLastCalledWith("insufficient_evidence")
  })

  it("shows placeholders for unavailable counts and disables both responsive controls", () => {
    render(
      <TechnicalConfigurationEvaluationFilters
        value="all"
        counts={null}
        onValueChange={vi.fn()}
        disabled
      />
    )

    const segmented = screen.getByRole("group", { name: "Bộ lọc trạng thái đánh giá" })
    expect(within(segmented).getAllByText("-")).toHaveLength(4)
    for (const button of within(segmented).getAllByRole("button")) {
      expect(button).toBeDisabled()
    }
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toBeDisabled()
  })
})
