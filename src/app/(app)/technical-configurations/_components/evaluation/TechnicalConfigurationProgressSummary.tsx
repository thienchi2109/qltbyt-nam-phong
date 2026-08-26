import { Skeleton } from "@/components/ui/skeleton"

import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"

type TechnicalConfigurationProgressSummaryProps = {
  progress: TechnicalConfigurationEvaluationProgress
  isLoading: boolean
  isError: boolean
}

function getProgressPercentage(evaluated: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((evaluated / total) * 100)))
}

/** Renders the selected option's progress once, without repeating hierarchy aggregates. */
export function TechnicalConfigurationProgressSummary({
  progress,
  isLoading,
  isError,
}: Readonly<TechnicalConfigurationProgressSummaryProps>) {
  if (isLoading) {
    return (
      <section
        className="flex min-h-28 items-center gap-4 border-y bg-muted/20 px-4 py-4"
        aria-label="Tiến độ đánh giá"
      >
        <div
          className="flex items-center gap-4"
          data-testid="evaluation-progress-summary-skeleton"
          role="status"
        >
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <span className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-36" />
          </span>
          <span className="sr-only">Đang tải tiến độ đánh giá...</span>
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section
        className="flex min-h-28 items-center border-y border-destructive/30 bg-destructive/5 px-4 py-4"
        aria-label="Tiến độ đánh giá"
      >
        <p className="text-sm text-destructive" role="alert">
          Chưa thể tính tiến độ đánh giá.
        </p>
      </section>
    )
  }

  const percentage = getProgressPercentage(progress.evaluated, progress.total)

  return (
    <section
      className="flex min-h-28 items-center gap-4 border-y bg-muted/20 px-4 py-4 sm:gap-5"
      aria-label="Tiến độ đánh giá"
    >
      <div
        className="grid size-20 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) 0)`,
        }}
        role="progressbar"
        aria-label="Tiến độ đánh giá"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${progress.evaluated} trên ${progress.total} tiêu chí đã đánh giá`}
      >
        <span className="grid size-16 place-items-center rounded-full bg-background text-base font-semibold tabular-nums">
          {percentage}%
        </span>
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-medium text-muted-foreground">Đã đánh giá</h3>
        <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
          {progress.evaluated} / {progress.total} tiêu chí
        </p>
      </div>
    </section>
  )
}
