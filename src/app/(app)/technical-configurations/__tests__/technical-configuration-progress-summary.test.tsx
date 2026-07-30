import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TechnicalConfigurationProgressSummary } from "../_components/evaluation/TechnicalConfigurationProgressSummary"
import type { TechnicalConfigurationEvaluationProgress } from "../_components/evaluation/technical-configuration-evaluation-progress"

const progress: TechnicalConfigurationEvaluationProgress = {
  total: 6,
  evaluated: 4,
  statusCounts: {
    not_evaluated: 2,
    not_applicable: 1,
    fails: 1,
    unclear: 0,
    insufficient_evidence: 1,
    exceeds: 0,
    meets: 1,
  },
  groups: [
    { id: "group-1", name: "Thông số chính", total: 4, evaluated: 3 },
    { id: "group-2", name: "An toàn", total: 2, evaluated: 1 },
  ],
}

describe("P12B1 technical configuration progress summary", () => {
  it("renders compact selected-option and group evaluated totals only", () => {
    render(
      <TechnicalConfigurationProgressSummary
        progress={progress}
        isLoading={false}
        isError={false}
      />
    )

    const summary = screen.getByRole("region", { name: "Tiến độ đánh giá" })
    expect(within(summary).getByText("Đã đánh giá 4 / 6 tiêu chí")).toBeInTheDocument()

    const groupRows = within(summary).getAllByTestId("evaluation-progress-group")
    expect(groupRows).toHaveLength(2)
    expect(within(groupRows[0]!).getByText("Thông số chính")).toBeInTheDocument()
    expect(within(groupRows[0]!).getByText("3 / 4")).toBeInTheDocument()
    expect(within(groupRows[1]!).getByText("An toàn")).toBeInTheDocument()
    expect(within(groupRows[1]!).getByText("1 / 2")).toBeInTheDocument()

    expect(within(summary).queryByRole("progressbar")).not.toBeInTheDocument()
    expect(within(summary).queryByText(/%/)).not.toBeInTheDocument()
    for (const statusLabel of [
      "Chưa đánh giá",
      "Không áp dụng",
      "Không đạt",
      "Chưa rõ",
      "Chưa đủ bằng chứng",
      "Vượt yêu cầu",
      "Đạt",
    ]) {
      expect(within(summary).queryByText(statusLabel, { exact: true })).not.toBeInTheDocument()
    }
  })

  it("does not render false all-unassessed counters while progress is loading or failed", () => {
    const { rerender } = render(
      <TechnicalConfigurationProgressSummary
        progress={{ ...progress, evaluated: 0 }}
        isLoading
        isError={false}
      />
    )

    expect(screen.getByText("Đang tải tiến độ đánh giá...")).toBeInTheDocument()
    expect(screen.queryByText("Đã đánh giá 0 / 6 tiêu chí")).not.toBeInTheDocument()

    rerender(
      <TechnicalConfigurationProgressSummary
        progress={{ ...progress, evaluated: 0 }}
        isLoading={false}
        isError
      />
    )

    expect(screen.getByText("Chưa thể tính tiến độ đánh giá.")).toBeInTheDocument()
    expect(screen.queryByText("Đã đánh giá 0 / 6 tiêu chí")).not.toBeInTheDocument()
  })

  it("renders a truthful zero counter when the selected option has no comparison set", () => {
    render(
      <TechnicalConfigurationProgressSummary
        progress={{
          ...progress,
          evaluated: 0,
          statusCounts: {
            not_evaluated: 6,
            not_applicable: 0,
            fails: 0,
            unclear: 0,
            insufficient_evidence: 0,
            exceeds: 0,
            meets: 0,
          },
          groups: progress.groups.map((group) => ({ ...group, evaluated: 0 })),
        }}
        isLoading={false}
        isError={false}
      />
    )

    expect(screen.getByText("Đã đánh giá 0 / 6 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("0 / 4")).toBeInTheDocument()
    expect(screen.getByText("0 / 2")).toBeInTheDocument()
  })
})
