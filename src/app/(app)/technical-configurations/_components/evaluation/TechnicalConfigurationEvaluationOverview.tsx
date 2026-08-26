import type { ReactNode } from "react"

type TechnicalConfigurationEvaluationOverviewProps = {
  comparisonControls: ReactNode
  exportControl: ReactNode
  progressSummary: ReactNode
  evaluationControls: ReactNode
}

/** Composes the evaluation overview without owning workflow state. */
export function TechnicalConfigurationEvaluationOverview({
  comparisonControls,
  exportControl,
  progressSummary,
  evaluationControls,
}: Readonly<TechnicalConfigurationEvaluationOverviewProps>) {
  return (
    <section className="space-y-4" aria-label="Tổng quan đánh giá">
      <div
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
        data-testid="evaluation-utility-toolbar"
      >
        <div className="min-w-0">{comparisonControls}</div>
        <div className="flex sm:justify-end">{exportControl}</div>
      </div>
      {progressSummary}
      {evaluationControls}
    </section>
  )
}
