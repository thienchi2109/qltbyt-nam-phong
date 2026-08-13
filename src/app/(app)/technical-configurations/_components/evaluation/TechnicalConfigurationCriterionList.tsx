"use client"

import * as React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  deriveTechnicalConfigurationEvaluationStatus,
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"
import { TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS } from "@/lib/technical-configuration-hierarchy-aggregate-status"
import { cn } from "@/lib/utils"

import type { TechnicalConfigurationAssessmentWire } from "../../assessment-types"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "./technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "./technical-configuration-evaluation-navigation"
import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import { TechnicalConfigurationEvaluationHierarchyStatusCounts } from "./TechnicalConfigurationEvaluationHierarchyStatusCounts"
import { TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS } from "./technical-configuration-evaluation-status-badge"

type TechnicalConfigurationCriterionListProps = {
  rows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[]
  hierarchyProgress: TechnicalConfigurationEvaluationProgress["hierarchy"] | null
  assessmentsByCriterionId: Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  currentCriterionId: string | null
  onSelectCriterion: (criterionId: string) => void
  disabled?: boolean
  expandedRowIds?: ReadonlySet<string>
  onExpandedRowIdsChange?: (expandedRowIds: ReadonlySet<string>) => void
}

function getCriterionStatus(
  assessment: TechnicalConfigurationAssessmentWire | undefined
): TechnicalConfigurationDerivedStatus {
  return deriveTechnicalConfigurationEvaluationStatus(
    assessment?.technical_axis,
    assessment?.evidence_axis
  )
}

/** Renders the canonical criterion sequence with one compact manual-status badge per row. */
export function TechnicalConfigurationCriterionList({
  rows,
  hierarchyProgress,
  assessmentsByCriterionId,
  currentCriterionId,
  onSelectCriterion,
  disabled = false,
  expandedRowIds,
  onExpandedRowIdsChange,
}: Readonly<TechnicalConfigurationCriterionListProps>) {
  const structuralRowIds = React.useMemo(
    () =>
      rows.flatMap((row) => {
        if (row.kind === "criterion") return []
        return [row.id]
      }),
    [rows]
  )
  const [collapsedRowIds, setCollapsedRowIds] = React.useState<ReadonlySet<string>>(() => new Set())
  const aggregateProgress = React.useMemo(() => {
    const sections = new Map<
      string,
      TechnicalConfigurationEvaluationProgress["hierarchy"][number]
    >()
    const subgroups = new Map<
      string,
      TechnicalConfigurationEvaluationProgress["hierarchy"][number]["subgroups"][number]
    >()

    for (const section of hierarchyProgress ?? []) {
      sections.set(section.id, section)
      for (const subgroup of section.subgroups) subgroups.set(subgroup.id, subgroup)
    }

    return { sections, subgroups }
  }, [hierarchyProgress])
  const isExpanded = React.useCallback(
    (rowId: string) => (expandedRowIds ? expandedRowIds.has(rowId) : !collapsedRowIds.has(rowId)),
    [collapsedRowIds, expandedRowIds]
  )
  const toggleRow = React.useCallback(
    (rowId: string) => {
      if (expandedRowIds) {
        const nextExpandedRowIds = new Set(
          structuralRowIds.filter((structuralRowId) =>
            structuralRowId === rowId
              ? !expandedRowIds.has(structuralRowId)
              : expandedRowIds.has(structuralRowId)
          )
        )
        onExpandedRowIdsChange?.(nextExpandedRowIds)
        return
      }

      const nextCollapsedRowIds = new Set(collapsedRowIds)
      if (nextCollapsedRowIds.has(rowId)) nextCollapsedRowIds.delete(rowId)
      else nextCollapsedRowIds.add(rowId)
      setCollapsedRowIds(nextCollapsedRowIds)
      onExpandedRowIdsChange?.(
        new Set(
          structuralRowIds.filter((structuralRowId) => !nextCollapsedRowIds.has(structuralRowId))
        )
      )
    },
    [collapsedRowIds, expandedRowIds, onExpandedRowIdsChange, structuralRowIds]
  )

  return (
    <nav aria-label="Danh sách tiêu chí đánh giá" className="divide-y border-y">
      {rows.map((hierarchyRow) => {
        if (hierarchyRow.kind === "section") {
          const expanded = isExpanded(hierarchyRow.id)
          const progress = aggregateProgress.sections.get(hierarchyRow.id)
          return (
            <h3 key={`section:${hierarchyRow.id}`}>
              <Button
                type="button"
                variant="ghost"
                data-testid={`evaluation-hierarchy-section-${hierarchyRow.id}`}
                aria-expanded={expanded}
                disabled={disabled}
                className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-none bg-muted/40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                onClick={() => toggleRow(hierarchyRow.id)}
              >
                {expanded ? (
                  <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-words">{hierarchyRow.name}</span>
                    {progress ? (
                      <Badge asChild variant="outline">
                        <span>
                          {TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS[progress.status]}
                        </span>
                      </Badge>
                    ) : null}
                  </span>
                  {progress ? (
                    <TechnicalConfigurationEvaluationHierarchyStatusCounts
                      statusCounts={progress.statusCounts}
                      testId={`evaluation-hierarchy-section-status-counts-${hierarchyRow.id}`}
                    />
                  ) : null}
                </span>
              </Button>
            </h3>
          )
        }

        if (hierarchyRow.kind === "subgroup") {
          if (!isExpanded(hierarchyRow.sectionId)) return null
          const expanded = isExpanded(hierarchyRow.id)
          const progress = aggregateProgress.subgroups.get(hierarchyRow.id)
          return (
            <Button
              key={`subgroup:${hierarchyRow.id}`}
              type="button"
              variant="ghost"
              data-testid={`evaluation-hierarchy-subgroup-${hierarchyRow.id}`}
              aria-expanded={expanded}
              disabled={disabled}
              className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-none bg-muted/20 px-6 py-2 text-left text-xs font-medium text-muted-foreground"
              onClick={() => toggleRow(hierarchyRow.id)}
            >
              {expanded ? (
                <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-words">{hierarchyRow.name}</span>
                  {progress ? (
                    <Badge asChild variant="outline">
                      <span>
                        {TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS[progress.status]}
                      </span>
                    </Badge>
                  ) : null}
                </span>
                {progress ? (
                  <TechnicalConfigurationEvaluationHierarchyStatusCounts
                    statusCounts={progress.statusCounts}
                    testId={`evaluation-hierarchy-subgroup-status-counts-${hierarchyRow.id}`}
                  />
                ) : null}
              </span>
            </Button>
          )
        }

        const row = hierarchyRow.row
        if (!isExpanded(row.group.id) || (row.subgroup && !isExpanded(row.subgroup.id))) {
          return null
        }
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
              row.subgroup && "pl-9",
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
              variant={TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS[status]}
              className="max-w-32 justify-center whitespace-normal text-center"
            >
              {TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[status]}
            </Badge>
          </button>
        )
      })}
    </nav>
  )
}
