import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
} from "@/lib/technical-configuration-evaluation"
import type { TechnicalConfigurationDerivedStatusCounts } from "@/lib/technical-configuration-hierarchy-aggregate-status"

type TechnicalConfigurationEvaluationHierarchyStatusCountsProps = {
  statusCounts: TechnicalConfigurationDerivedStatusCounts
  testId: string
}

/** Renders the canonical derived-status counts for one authoritative aggregate. */
export function TechnicalConfigurationEvaluationHierarchyStatusCounts({
  statusCounts,
  testId,
}: Readonly<TechnicalConfigurationEvaluationHierarchyStatusCountsProps>) {
  return (
    <span
      className="flex flex-wrap justify-end gap-x-2 gap-y-0.5 text-[11px] font-normal leading-4 text-muted-foreground"
      data-testid={testId}
    >
      {TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES.map((status) => (
        <span key={status} className="whitespace-nowrap tabular-nums">
          {TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[status]}: {statusCounts[status]}
        </span>
      ))}
    </span>
  )
}
