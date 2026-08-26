import { CircleCheck } from "lucide-react"

import type { TechnicalConfigurationAggregateStatus } from "@/lib/technical-configuration-hierarchy-aggregate-status"

import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"

type HierarchyProgress =
  | TechnicalConfigurationEvaluationProgress["hierarchy"][number]
  | TechnicalConfigurationEvaluationProgress["hierarchy"][number]["subgroups"][number]

type TechnicalConfigurationEvaluationHierarchyProgressProps = {
  name: string
  progress: HierarchyProgress | undefined
}

function getPercentage(evaluated: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((evaluated / total) * 100)))
}

function AggregateCheck({ status }: Readonly<{ status: TechnicalConfigurationAggregateStatus }>) {
  if (status !== "passed" && status !== "not_applicable") return null

  return (
    <span
      className={
        status === "passed"
          ? "inline-flex items-center gap-1 text-emerald-700"
          : "inline-flex items-center gap-1 text-muted-foreground"
      }
    >
      <CircleCheck className="size-3.5" aria-hidden="true" />
      {status === "passed" ? "Đạt" : "Không áp dụng"}
    </span>
  )
}

/** Shows one compact structural rollup without repeating zero-value status summaries. */
export function TechnicalConfigurationEvaluationHierarchyProgress({
  name,
  progress,
}: Readonly<TechnicalConfigurationEvaluationHierarchyProgressProps>) {
  if (!progress) {
    return <span className="shrink-0 tabular-nums text-muted-foreground">- / -</span>
  }

  const clarificationCount =
    progress.statusCounts.unclear + progress.statusCounts.insufficient_evidence
  const percentage = getPercentage(progress.evaluated, progress.total)
  const isPartial = progress.evaluated > 0 && progress.evaluated < progress.total

  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
      <span className="tabular-nums text-muted-foreground">
        {progress.evaluated} / {progress.total}
      </span>
      <AggregateCheck status={progress.status} />
      {progress.statusCounts.fails > 0 ? (
        <span className="font-medium text-destructive">
          Không đạt {progress.statusCounts.fails}
        </span>
      ) : null}
      {clarificationCount > 0 ? (
        <span className="font-medium text-amber-700">Cần làm rõ {clarificationCount}</span>
      ) : null}
      {isPartial ? (
        <span
          className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`Tiến độ ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${percentage}%` }}
          />
        </span>
      ) : null}
    </span>
  )
}
