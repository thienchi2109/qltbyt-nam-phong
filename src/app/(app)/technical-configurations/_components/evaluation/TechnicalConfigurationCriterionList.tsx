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
import { cn } from "@/lib/utils"

import type { TechnicalConfigurationAssessmentWire } from "../../assessment-types"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "./technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "./technical-configuration-evaluation-navigation"
import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import { TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS } from "./technical-configuration-evaluation-status-badge"
import { TechnicalConfigurationEvaluationHierarchyProgress } from "./TechnicalConfigurationEvaluationHierarchyProgress"

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

function getCriterionAncestorRowIds(
  rows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[],
  criterionId: string | null
) {
  if (!criterionId) return new Set<string>()
  const criterionRow = rows.find(
    (row) => row.kind === "criterion" && row.row.criterion.id === criterionId
  )
  if (!criterionRow || criterionRow.kind !== "criterion") return new Set<string>()

  return new Set([
    criterionRow.row.group.id,
    ...(criterionRow.row.subgroup ? [criterionRow.row.subgroup.id] : []),
  ])
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
  const [uncontrolledExpandedRowIds, setUncontrolledExpandedRowIds] = React.useState<
    ReadonlySet<string>
  >(() => getCriterionAncestorRowIds(rows, currentCriterionId))
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
    (rowId: string) =>
      expandedRowIds ? expandedRowIds.has(rowId) : uncontrolledExpandedRowIds.has(rowId),
    [expandedRowIds, uncontrolledExpandedRowIds]
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

      const nextExpandedRowIds = new Set(uncontrolledExpandedRowIds)
      if (nextExpandedRowIds.has(rowId)) nextExpandedRowIds.delete(rowId)
      else nextExpandedRowIds.add(rowId)
      setUncontrolledExpandedRowIds(nextExpandedRowIds)
      onExpandedRowIdsChange?.(nextExpandedRowIds)
    },
    [expandedRowIds, onExpandedRowIdsChange, structuralRowIds, uncontrolledExpandedRowIds]
  )

  return (
    <nav aria-label="Danh sách tiêu chí đánh giá" className="divide-y border-y">
      <div className="hidden min-h-9 grid-cols-[7rem_minmax(0,1fr)_11rem] items-center gap-3 bg-muted/30 px-3 text-xs font-medium text-muted-foreground sm:grid">
        <span>Mã</span>
        <span>Nội dung tiêu chí</span>
        <span>Trạng thái</span>
      </div>
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
                className="h-auto min-h-11 w-full justify-start whitespace-normal rounded-none bg-muted/40 px-3 py-2 text-left text-sm font-semibold"
                onClick={() => toggleRow(hierarchyRow.id)}
              >
                {expanded ? (
                  <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                  <span className="break-words">{hierarchyRow.name}</span>
                  <TechnicalConfigurationEvaluationHierarchyProgress
                    name={hierarchyRow.name}
                    progress={progress}
                  />
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
              <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                <span className="break-words">{hierarchyRow.name}</span>
                <TechnicalConfigurationEvaluationHierarchyProgress
                  name={hierarchyRow.name}
                  progress={progress}
                />
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
              "grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-l-2 border-l-transparent px-3 py-2.5 text-left outline-none transition-colors sm:grid-cols-[7rem_minmax(0,1fr)_11rem]",
              "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              row.subgroup && "pl-9",
              isCurrent && "border-l-primary bg-primary/10"
            )}
            onClick={() => onSelectCriterion(criterionId)}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {row.criterion.criterionCode}
            </span>
            <span className="row-start-2 col-span-2 min-w-0 break-words text-sm font-medium leading-5 sm:row-auto sm:col-span-1">
              {row.criterion.title ?? "Chưa có tiêu đề"}
            </span>
            <span className="row-start-1 col-start-2 flex items-center justify-end gap-2 sm:row-auto sm:col-auto">
              <Badge
                variant={TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS[status]}
                className="max-w-32 justify-center whitespace-normal text-center"
              >
                {TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[status]}
              </Badge>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
                data-testid="evaluation-criterion-open-indicator"
              />
            </span>
          </button>
        )
      })}
    </nav>
  )
}
