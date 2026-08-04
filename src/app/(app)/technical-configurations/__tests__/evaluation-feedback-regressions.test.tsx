import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationFeedback } from "../_components/evaluation/TechnicalConfigurationEvaluationFeedback"
import { TechnicalConfigurationEvaluationMatrixControls } from "../_components/evaluation/TechnicalConfigurationEvaluationMatrixControls"
import { TechnicalConfigurationEvaluationSaveActions } from "../_components/evaluation/TechnicalConfigurationEvaluationSaveActions"

describe("technical configuration evaluation feedback regressions", () => {
  it("announces panel loading and keeps panel errors scoped to an open panel", () => {
    const props = {
      isPanelLoading: true,
      isPanelError: true,
      panelError: new Error("panel failed"),
      onRetryPanel: vi.fn(),
      hasEvaluationReadError: false,
      evaluationReadError: null,
      onRetryEvaluation: vi.fn(),
    }
    const { rerender } = render(
      <TechnicalConfigurationEvaluationFeedback {...props} isPanelOpen={false} />
    )

    expect(screen.queryByText("Đang tải tiêu chí...")).not.toBeInTheDocument()
    expect(screen.queryByText("Không thể tải tiêu chí đánh giá")).not.toBeInTheDocument()

    rerender(<TechnicalConfigurationEvaluationFeedback {...props} isPanelOpen />)

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải tiêu chí...")
    expect(screen.getByText("Không thể tải tiêu chí đánh giá")).toBeInTheDocument()
  })

  it("explains an empty evaluation flow and only offers reset for an active filter", () => {
    const props = {
      options: [],
      activeOptionId: "",
      onOptionChange: vi.fn(),
      onStatusFilterChange: vi.fn(),
      disabled: false,
      isLoading: false,
      isError: false,
      error: null,
      onRetry: vi.fn(),
      totalMatches: 0,
      isCurrentCriterionFilteredOut: false,
      hasNoMoreMatches: false,
    }
    const { rerender } = render(
      <TechnicalConfigurationEvaluationMatrixControls {...props} statusFilter="all" />
    )

    expect(
      screen.getByText("Phiên bản cấu hình này chưa có tiêu chí để đánh giá.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Xóa bộ lọc" })).not.toBeInTheDocument()

    rerender(<TechnicalConfigurationEvaluationMatrixControls {...props} statusFilter="fails" />)

    expect(screen.getByText("Không có tiêu chí nào khớp bộ lọc đang chọn.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Xóa bộ lọc" })).toBeEnabled()
  })

  it("announces the pending save state", () => {
    render(
      <TechnicalConfigurationEvaluationSaveActions
        disabled
        saving
        onSave={vi.fn()}
        onSaveAndContinue={vi.fn()}
      />
    )

    expect(screen.getByRole("status")).toHaveTextContent("Đang lưu đánh giá...")
  })
})
