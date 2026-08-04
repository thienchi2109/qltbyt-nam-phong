import { Card } from "@/components/ui/card"

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

      <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
        <Card
          className="flex min-h-24 flex-col justify-between gap-2 border-primary/30 bg-primary/5 p-3 shadow-none"
          data-testid="evaluation-progress-kpi-card"
        >
          <dt className="text-xs font-medium text-muted-foreground">Tổng tiến độ</dt>
          <dd className="flex flex-col gap-2">
            <output className="text-xl font-semibold leading-none tabular-nums">
              {progress.evaluated} / {progress.total}
            </output>
            <span className="text-xs text-muted-foreground">tiêu chí đã đánh giá</span>
          </dd>
        </Card>

        {progress.groups.map((group) => (
          <Card
            key={group.id}
            className="flex min-h-24 flex-col justify-between gap-2 p-3 shadow-none"
            data-testid="evaluation-progress-kpi-card"
          >
            <dt
              className="line-clamp-2 text-xs font-medium leading-4 text-muted-foreground"
              title={group.name}
            >
              {group.name}
            </dt>
            <dd className="flex flex-col gap-2">
              <span className="text-xl font-semibold leading-none tabular-nums">
                {group.evaluated} / {group.total}
              </span>
              <span className="text-xs text-muted-foreground">tiêu chí đã đánh giá</span>
            </dd>
          </Card>
        ))}
      </dl>
    </section>
  )
}
