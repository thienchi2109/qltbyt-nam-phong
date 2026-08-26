import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TechnicalConfigurationEvaluationOverview } from "../_components/evaluation/TechnicalConfigurationEvaluationOverview"

describe("technical configuration evaluation overview", () => {
  it("keeps one responsive utility toolbar followed by the primary evaluation flow", () => {
    render(
      <TechnicalConfigurationEvaluationOverview
        comparisonControls={<div data-testid="comparison-controls" />}
        exportControl={<div data-testid="export-control" />}
        progressSummary={<div data-testid="progress-summary" />}
        evaluationControls={<div data-testid="evaluation-controls" />}
      />
    )

    const overview = screen.getByRole("region", { name: "Tổng quan đánh giá" })
    const toolbar = screen.getByTestId("evaluation-utility-toolbar")
    const progress = screen.getByTestId("progress-summary")
    const controls = screen.getByTestId("evaluation-controls")

    expect(overview).toContainElement(toolbar)
    expect(toolbar).toHaveClass("grid", "sm:grid-cols-[minmax(0,1fr)_auto]")
    expect(toolbar).toContainElement(screen.getByTestId("comparison-controls"))
    expect(toolbar).toContainElement(screen.getByTestId("export-control"))
    expect(toolbar.compareDocumentPosition(progress)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(progress.compareDocumentPosition(controls)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
