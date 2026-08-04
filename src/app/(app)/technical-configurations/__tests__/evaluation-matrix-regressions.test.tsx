import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"
import { createComparisonResult } from "./comparison-matrix-test-fixtures"

describe("technical configuration evaluation matrix regressions", () => {
  it("disables the empty-page previous action while evaluation navigation is blocked", () => {
    const result = createComparisonResult()

    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={{
          ...result,
          page: 2,
          data: {
            ...result.data,
            criteria: [],
          },
        }}
        visibleOptionIds={result.data.options.map((option) => option.id)}
        pinnedOptionIds={[]}
        focusedOptionId={null}
        evaluationDisabled
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Trang trước" })).toBeDisabled()
  })

  it("keeps read-only detail and evaluation as separate supplier-cell actions", async () => {
    const user = userEvent.setup()
    const result = createComparisonResult()
    const onOpenDetail = vi.fn()
    const onOpenEvaluation = vi.fn()

    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        visibleOptionIds={result.data.options.map((option) => option.id)}
        pinnedOptionIds={[]}
        focusedOptionId={null}
        activeEvaluationOptionId="option-b"
        activeEvaluationCriterionId="criterion-2"
        assessmentStatusByCriterionId={new Map([["criterion-2", "meets"]])}
        matchingEvaluationCriterionIds={new Set(["criterion-2"])}
        onOpenDetail={onOpenDetail}
        onOpenEvaluation={onOpenEvaluation}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    const detailButton = screen.getByRole("button", {
      name: "Xem chi tiết TS-02 · Nhà cung cấp B · Phương án B",
    })
    expect(detailButton.querySelector("div, p")).toBeNull()
    await user.click(detailButton)
    expect(onOpenDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        criterionCode: "TS-02",
        optionLabel: "Nhà cung cấp B · Phương án B",
      })
    )

    const evaluationButton = screen.getByRole("button", {
      name: "Đánh giá TS-02 · Nhà cung cấp B · Phương án B",
    })
    await user.click(evaluationButton)

    expect(onOpenEvaluation).toHaveBeenCalledWith({
      optionId: "option-b",
      criterionId: "criterion-2",
      trigger: evaluationButton,
    })
  })
})
