import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TechnicalConfigurationProgressSummary } from "@/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationProgressSummary"
import type { TechnicalConfigurationEvaluationProgress } from "@/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-progress"

const emptyStatusCounts = {
  not_evaluated: 0,
  not_applicable: 0,
  fails: 0,
  unclear: 0,
  insufficient_evidence: 0,
  exceeds: 0,
  meets: 0,
} as const

const progress: TechnicalConfigurationEvaluationProgress = {
  total: 6,
  evaluated: 4,
  statusCounts: {
    ...emptyStatusCounts,
    not_evaluated: 2,
    fails: 1,
    unclear: 1,
    insufficient_evidence: 1,
    meets: 1,
  },
  groups: [
    { id: "group-1", name: "Thông số chính", total: 4, evaluated: 3 },
    { id: "group-2", name: "An toàn", total: 2, evaluated: 1 },
  ],
  hierarchy: [
    {
      id: "group-1",
      name: "Thông số chính",
      sortOrder: 1,
      total: 4,
      evaluated: 3,
      status: "failed",
      statusCounts: {
        ...emptyStatusCounts,
        not_evaluated: 1,
        fails: 1,
        insufficient_evidence: 1,
        meets: 1,
      },
      subgroups: [],
    },
  ],
}

describe("technical configuration progress summary", () => {
  it("renders one accessible progress ring and one meaningful ratio", () => {
    render(
      <TechnicalConfigurationProgressSummary
        progress={progress}
        isLoading={false}
        isError={false}
      />
    )

    const summary = screen.getByRole("region", { name: "Tiến độ đánh giá" })
    const ring = within(summary).getByRole("progressbar", { name: "Tiến độ đánh giá" })

    expect(ring).toHaveAttribute("aria-valuemin", "0")
    expect(ring).toHaveAttribute("aria-valuemax", "100")
    expect(ring).toHaveAttribute("aria-valuenow", "67")
    expect(within(ring).getByText("67%")).toBeInTheDocument()
    expect(within(summary).getByText("4 / 6 tiêu chí")).toBeInTheDocument()
    expect(within(summary).getByText("Đã đánh giá")).toBeInTheDocument()
    expect(within(summary).getAllByRole("progressbar")).toHaveLength(1)
  })

  it("removes repeated KPI, hierarchy and status summaries", () => {
    render(
      <TechnicalConfigurationProgressSummary
        progress={progress}
        isLoading={false}
        isError={false}
      />
    )

    const summary = screen.getByRole("region", { name: "Tiến độ đánh giá" })
    expect(within(summary).queryByTestId("evaluation-progress-kpi-grid")).not.toBeInTheDocument()
    expect(within(summary).queryByText("Thông số chính")).not.toBeInTheDocument()
    expect(within(summary).queryByText("Không đạt: 1")).not.toBeInTheDocument()
    expect(within(summary).queryByText("Chưa đủ bằng chứng: 1")).not.toBeInTheDocument()
  })

  it("keeps the summary footprint stable while loading and reports errors inline", () => {
    const { rerender } = render(
      <TechnicalConfigurationProgressSummary progress={progress} isLoading isError={false} />
    )

    const loadingSummary = screen.getByRole("region", { name: "Tiến độ đánh giá" })
    expect(within(loadingSummary).getByTestId("evaluation-progress-summary-skeleton")).toBeVisible()
    expect(within(loadingSummary).queryByRole("progressbar")).not.toBeInTheDocument()

    rerender(
      <TechnicalConfigurationProgressSummary progress={progress} isLoading={false} isError />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Chưa thể tính tiến độ đánh giá.")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("renders zero percent when the selected option has no criteria", () => {
    render(
      <TechnicalConfigurationProgressSummary
        progress={{
          total: 0,
          evaluated: 0,
          statusCounts: emptyStatusCounts,
          groups: [],
          hierarchy: [],
        }}
        isLoading={false}
        isError={false}
      />
    )

    const ring = screen.getByRole("progressbar", { name: "Tiến độ đánh giá" })
    expect(ring).toHaveAttribute("aria-valuenow", "0")
    expect(within(ring).getByText("0%")).toBeInTheDocument()
    expect(screen.getByText("0 / 0 tiêu chí")).toBeInTheDocument()
  })
})
