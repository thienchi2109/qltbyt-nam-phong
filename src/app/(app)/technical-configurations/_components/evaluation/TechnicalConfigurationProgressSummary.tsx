import { Layers, ListChecks } from "lucide-react"

import { StatCard } from "@/components/ui/stat-card"

import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"

type TechnicalConfigurationProgressSummaryProps = {
  progress: TechnicalConfigurationEvaluationProgress
  isLoading: boolean
  isError: boolean
}

/** Renders compact selected-option progress without scoring or status breakdowns. */
export function TechnicalConfigurationProgressSummary({
  progress,
  isLoading,
  isError,
}: Readonly<TechnicalConfigurationProgressSummaryProps>) {
  if (isLoading) {
    return (
      <section className="rounded-lg border bg-muted/20 px-3 py-4" aria-label="Tiến độ đánh giá">
        <p className="text-sm text-muted-foreground" role="status">
          Đang tải tiến độ đánh giá...
        </p>
      </section>
    )
  }

  if (isError) {
    return (
      <section
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-4"
        aria-label="Tiến độ đánh giá"
      >
        <p className="text-sm text-destructive" role="alert">
          Chưa thể tính tiến độ đánh giá.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3" aria-label="Tiến độ đánh giá">
      <h3 className="text-sm font-semibold">Tiến độ đánh giá</h3>

      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 xl:grid-cols-5"
        data-testid="evaluation-progress-kpi-grid"
      >
        <div
          className="col-span-2 min-w-0 md:col-span-4 xl:col-span-1"
          data-testid="evaluation-progress-kpi-card"
        >
          <StatCard
            className="h-full"
            label="Tổng tiến độ"
            value={`${progress.evaluated} / ${progress.total}`}
            icon={<Layers className="size-5" aria-hidden="true" />}
          />
        </div>

        {progress.groups.map((group) => (
          <div
            key={group.id}
            className="min-w-0"
            data-testid="evaluation-progress-kpi-card"
            title={group.name}
          >
            <StatCard
              className="h-full"
              label={group.name}
              value={`${group.evaluated} / ${group.total}`}
              icon={<ListChecks className="size-5" aria-hidden="true" />}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
