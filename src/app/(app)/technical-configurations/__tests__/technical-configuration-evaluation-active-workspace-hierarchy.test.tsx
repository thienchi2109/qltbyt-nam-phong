import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationNavigatorPane } from "@/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationNavigatorPane"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "@/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "@/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-navigation"

const hierarchyRows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[] =
  [{ kind: "section", id: "section-1", name: "Thông số chính" }]

describe("P5C active evaluation workspace hierarchy integration", () => {
  it("renders a list-only loading indicator without rendering the hierarchy", () => {
    render(
      <TechnicalConfigurationEvaluationNavigatorPane
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        criteria={hierarchyRows}
        progress={null}
        assessmentsByCriterionId={{}}
        currentCriterionId={null}
        onSelectCriterion={vi.fn()}
        listOnly
        page={1}
        pageSize={50}
        total={1}
        onPageChange={vi.fn()}
        disabled={false}
        isLoading
        isError={false}
        error={null}
        onRetry={vi.fn()}
        isCurrentCriterionFilteredOut={false}
        hasNoMoreMatches={false}
      />
    )

    expect(
      screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId(/evaluation-hierarchy-section-/)).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải tiêu chí đánh giá...")
  })

  it("renders a list-only error without duplicating the workspace retry action", () => {
    const onRetry = vi.fn()

    render(
      <TechnicalConfigurationEvaluationNavigatorPane
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        criteria={hierarchyRows}
        progress={null}
        assessmentsByCriterionId={{}}
        currentCriterionId={null}
        onSelectCriterion={vi.fn()}
        listOnly
        page={1}
        pageSize={50}
        total={1}
        onPageChange={vi.fn()}
        disabled={false}
        isLoading={false}
        isError
        error={new Error("assessment read failed")}
        onRetry={onRetry}
        isCurrentCriterionFilteredOut={false}
        hasNoMoreMatches={false}
      />
    )

    expect(
      screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId(/evaluation-hierarchy-section-/)).not.toBeInTheDocument()
    expect(screen.getByText("Không thể tải tiêu chí đánh giá")).toBeInTheDocument()
    expect(screen.getByText("assessment read failed")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument()
  })
})
