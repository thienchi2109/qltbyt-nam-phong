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
      <section className="border-y py-3" aria-label="Tiến độ đánh giá">
        <p className="text-sm text-muted-foreground" role="status">
          Đang tải tiến độ đánh giá...
        </p>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="border-y py-3" aria-label="Tiến độ đánh giá">
        <p className="text-sm text-destructive" role="alert">
          Chưa thể tính tiến độ đánh giá.
        </p>
      </section>
    )
  }

  return (
    <section className="border-y py-3" aria-label="Tiến độ đánh giá">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">Tiến độ đánh giá</h3>
          <output className="text-sm tabular-nums text-muted-foreground">
            Đã đánh giá {progress.evaluated} / {progress.total} tiêu chí
          </output>
        </div>
        {progress.groups.length > 0 ? (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {progress.groups.map((group) => (
              <div
                key={group.id}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
                data-testid="evaluation-progress-group"
              >
                <dt className="min-w-0 truncate text-muted-foreground" title={group.name}>
                  {group.name}
                </dt>
                <dd className="shrink-0 tabular-nums font-medium">
                  {group.evaluated} / {group.total}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  )
}
