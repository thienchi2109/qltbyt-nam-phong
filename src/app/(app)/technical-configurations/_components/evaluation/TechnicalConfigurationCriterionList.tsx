"use client"

import { Badge } from "@/components/ui/badge"
import {
  deriveTechnicalConfigurationEvaluationStatus,
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"
import { cn } from "@/lib/utils"

import type { TechnicalConfigurationAssessmentWire } from "../../assessment-types"
import type { TechnicalConfigurationComparisonCriterionRow } from "../../comparison-types"

type TechnicalConfigurationCriterionListProps = {
  criteria: readonly TechnicalConfigurationComparisonCriterionRow[]
  assessmentsByCriterionId: Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  currentCriterionId: string | null
  onSelectCriterion: (criterionId: string) => void
  disabled?: boolean
}

type TechnicalConfigurationCriterionGroup = {
  id: string
  name: string
  criteria: TechnicalConfigurationComparisonCriterionRow[]
}

function compareCanonicalCriteria(
  left: TechnicalConfigurationComparisonCriterionRow,
  right: TechnicalConfigurationComparisonCriterionRow
) {
  return (
    left.group.sortOrder - right.group.sortOrder ||
    left.group.id.localeCompare(right.group.id) ||
    left.criterion.sortOrder - right.criterion.sortOrder ||
    left.criterion.id.localeCompare(right.criterion.id)
  )
}

function groupCanonicalCriteria(
  criteria: readonly TechnicalConfigurationComparisonCriterionRow[]
): TechnicalConfigurationCriterionGroup[] {
  const groups: TechnicalConfigurationCriterionGroup[] = []

  for (const row of [...criteria].sort(compareCanonicalCriteria)) {
    const currentGroup = groups.at(-1)
    if (currentGroup?.id === row.group.id) {
      currentGroup.criteria.push(row)
      continue
    }

    groups.push({
      id: row.group.id,
      name: row.group.name,
      criteria: [row],
    })
  }

  return groups
}

function getCriterionStatus(
  assessment: TechnicalConfigurationAssessmentWire | undefined
): TechnicalConfigurationDerivedStatus {
  return deriveTechnicalConfigurationEvaluationStatus(
    assessment?.technical_axis,
    assessment?.evidence_axis
  )
}

function getStatusVariant(status: TechnicalConfigurationDerivedStatus) {
  if (status === "fails") return "destructive" as const
  if (status === "meets" || status === "exceeds") return "secondary" as const
  if (status === "not_evaluated") return "muted" as const
  return "outline" as const
}

/** Renders the canonical criterion sequence with one compact manual-status badge per row. */
export function TechnicalConfigurationCriterionList({
  criteria,
  assessmentsByCriterionId,
  currentCriterionId,
  onSelectCriterion,
  disabled = false,
}: Readonly<TechnicalConfigurationCriterionListProps>) {
  const groups = groupCanonicalCriteria(criteria)

  return (
    <nav aria-label="Danh sách tiêu chí đánh giá" className="divide-y border-y">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`evaluation-group-${group.id}`}>
          <h3
            id={`evaluation-group-${group.id}`}
            className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground"
          >
            {group.name}
          </h3>
          <div className="divide-y">
            {group.criteria.map((row) => {
              const criterionId = row.criterion.id
              const status = getCriterionStatus(assessmentsByCriterionId[criterionId])
              const isCurrent = criterionId === currentCriterionId

              return (
                <button
                  key={criterionId}
                  type="button"
                  data-testid="evaluation-criterion"
                  data-criterion-id={criterionId}
                  aria-current={isCurrent ? "true" : undefined}
                  disabled={disabled}
                  className={cn(
                    "grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 border-l-transparent px-3 py-2.5 text-left outline-none transition-colors",
                    "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    isCurrent && "border-l-primary bg-primary/10"
                  )}
                  onClick={() => onSelectCriterion(criterionId)}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-muted-foreground">
                      {row.criterion.criterionCode}
                    </span>
                    <span className="mt-1 block break-words text-sm font-medium leading-5">
                      {row.criterion.title ?? "Chưa có tiêu đề"}
                    </span>
                  </span>
                  <Badge
                    variant={getStatusVariant(status)}
                    className="max-w-32 justify-center whitespace-normal text-center"
                  >
                    {TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[status]}
                  </Badge>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}
