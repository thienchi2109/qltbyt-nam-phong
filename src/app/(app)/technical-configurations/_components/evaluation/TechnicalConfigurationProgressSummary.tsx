import { Layers, ListChecks } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS } from "@/lib/technical-configuration-hierarchy-aggregate-status"

import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import { TechnicalConfigurationEvaluationHierarchyStatusCounts } from "./TechnicalConfigurationEvaluationHierarchyStatusCounts"

type TechnicalConfigurationProgressSummaryProps = {
  progress: TechnicalConfigurationEvaluationProgress
  isLoading: boolean
  isError: boolean
}

/** Renders selected-option progress and authoritative hierarchy status breakdowns. */
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

      <TechnicalConfigurationEvaluationHierarchyStatusCounts
        statusCounts={progress.statusCounts}
        testId="evaluation-progress-status-counts-overall"
      />

      <div className="divide-y border-y" aria-label="Tiến độ theo cấu trúc">
        {progress.hierarchy.map((section) => (
          <div key={section.id} data-testid={`evaluation-progress-section-${section.id}`}>
            <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2">
              <p className="min-w-0 break-words text-sm font-semibold">{section.name}</p>
              <Badge variant="outline">
                {TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS[section.status]}
              </Badge>
              <span className="text-sm tabular-nums text-muted-foreground">
                {section.evaluated} / {section.total} tiêu chí
              </span>
            </div>
            <div className="px-3 pb-2">
              <TechnicalConfigurationEvaluationHierarchyStatusCounts
                statusCounts={section.statusCounts}
                testId={`evaluation-progress-section-status-counts-${section.id}`}
              />
            </div>
            {section.subgroups.length > 0 ? (
              <div className="divide-y border-t bg-muted/20">
                {section.subgroups.map((subgroup) => (
                  <div
                    key={subgroup.id}
                    data-testid={`evaluation-progress-subgroup-${subgroup.id}`}
                    className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 pl-8"
                  >
                    <p className="min-w-0 break-words text-sm">{subgroup.name}</p>
                    <Badge variant="outline">
                      {TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS[subgroup.status]}
                    </Badge>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {subgroup.evaluated} / {subgroup.total} tiêu chí
                    </span>
                    <span className="col-span-3">
                      <TechnicalConfigurationEvaluationHierarchyStatusCounts
                        statusCounts={subgroup.statusCounts}
                        testId={`evaluation-progress-subgroup-status-counts-${subgroup.id}`}
                      />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
