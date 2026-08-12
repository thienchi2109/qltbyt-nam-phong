import "@testing-library/jest-dom"
import fs from "node:fs"
import path from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationNavigatorPane } from "../_components/evaluation/TechnicalConfigurationEvaluationNavigatorPane"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "../_components/evaluation/technical-configuration-evaluation-navigation"

const workspacePath = path.join(
  process.cwd(),
  "src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx"
)
const hierarchyRows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[] =
  [{ kind: "section", id: "section-1", name: "Thông số chính" }]

describe("P5C active evaluation workspace hierarchy integration", () => {
  it("passes page-local hierarchy rows and controlled expansion to the navigator pane", () => {
    const source = fs.readFileSync(workspacePath, "utf8")

    expect(source).toContain(
      'import { TechnicalConfigurationEvaluationNavigatorPane } from "./TechnicalConfigurationEvaluationNavigatorPane"'
    )
    expect(source).toMatch(
      /<TechnicalConfigurationEvaluationNavigatorPane[\s\S]*?criteria=\{navigator\.hierarchyRows\}[\s\S]*?progress=\{matrixPresentation\.progress\}[\s\S]*?listOnly[\s\S]*?expandedRowIds=\{navigator\.expandedRowIds\}[\s\S]*?onExpandedRowIdsChange=\{navigator\.onExpandedRowIdsChange\}[\s\S]*?\/>/
    )
    expect(source).not.toMatch(
      /<TechnicalConfigurationEvaluationNavigatorPane[\s\S]*?criteria=\{navigator\.projection\}/
    )
  })

  it("routes assessment cache loading and error state into the hierarchy navigator", () => {
    const source = fs.readFileSync(workspacePath, "utf8")

    expect(source).toMatch(
      /const isEvaluationReadLoading = comparisonSetQuery\.isLoading \|\| assessmentQuery\.isLoading/
    )
    expect(source).toMatch(
      /const hasEvaluationReadError = comparisonSetQuery\.isError \|\| assessmentQuery\.isError/
    )
    expect(source).toMatch(
      /<TechnicalConfigurationEvaluationNavigatorPane[\s\S]*?isLoading=\{[\s\S]*?isEvaluationReadLoading[\s\S]*?isError=\{navigator\.criteriaQuery\.isError \|\| hasEvaluationReadError\}/
    )
  })

  it.each([
    { label: "loading", isLoading: true, isError: false, error: null },
    {
      label: "error",
      isLoading: false,
      isError: true,
      error: new Error("assessment read failed"),
    },
  ])("does not render navigator hierarchy while the assessment cache is $label", (state) => {
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
        isLoading={state.isLoading}
        isError={state.isError}
        error={state.error}
        onRetry={vi.fn()}
        isCurrentCriterionFilteredOut={false}
        hasNoMoreMatches={false}
      />
    )

    expect(
      screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId(/evaluation-hierarchy-section-/)).not.toBeInTheDocument()
  })
})
