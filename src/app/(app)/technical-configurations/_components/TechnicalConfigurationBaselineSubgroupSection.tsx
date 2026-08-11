"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import type { TechnicalConfigurationFocusTarget } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBaselineSubgroupCriteria } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupCriteria"
import type { TechnicalConfigurationBaselineEditorSubgroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type TechnicalConfigurationBaselineSubgroupSectionProps = Readonly<{
  subgroup: TechnicalConfigurationBaselineEditorSubgroup
  sectionOrdinal: string
  subgroupIndex: number
  expanded: boolean
  subgroupError?: string
  criterionErrors: Record<string, string>
  focusTarget: TechnicalConfigurationFocusTarget
  onExpandedChange: (expanded: boolean) => void
}>

/** Renders one presentation-only subgroup structural row and its criteria. */
export function TechnicalConfigurationBaselineSubgroupSection({
  subgroup,
  sectionOrdinal,
  subgroupIndex,
  expanded,
  subgroupError,
  criterionErrors,
  focusTarget,
  onExpandedChange,
}: TechnicalConfigurationBaselineSubgroupSectionProps): React.JSX.Element {
  const subgroupOrdinal = subgroupIndex + 1
  const subgroupLabel = subgroup.name.trim() || `Nhóm con ${subgroupOrdinal}`
  const subgroupContext = `nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}`
  const contentId = `baseline-subgroup-${subgroup.key}-content`
  const subgroupErrorId = subgroupError ? `baseline-subgroup-${subgroup.key}-error` : undefined
  const targetCriterion =
    focusTarget?.kind === "criterion" &&
    subgroup.criteria.some((criterion) => criterion.key === focusTarget.key)
      ? focusTarget
      : null
  const targetCriterionKey = targetCriterion?.key ?? null
  const targetCriterionToken = targetCriterion?.token ?? null
  const criterionErrorCount = subgroup.criteria.filter(
    (criterion) => criterionErrors[criterion.key]
  ).length

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <section
        aria-label={`Nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}: ${subgroupLabel}`}
        data-testid={`baseline-subgroup-${subgroup.key}`}
        className="min-w-0 border-t bg-muted/10"
      >
        <div className="grid min-w-0 gap-3 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="flex min-w-0 items-start gap-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${subgroupContext}: ${subgroupLabel}`}
                aria-controls={contentId}
                aria-describedby={subgroupErrorId}
                title={expanded ? "Thu gọn nhóm con" : "Mở rộng nhóm con"}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-semibold">
              {subgroupOrdinal}
            </span>
            <div className="min-w-0 pt-1">
              <h3 className="break-words text-sm font-semibold">{subgroupLabel}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{subgroup.criteria.length} tiêu chí</Badge>
                {subgroupError || criterionErrorCount > 0 ? (
                  <Badge variant="destructive">
                    {(subgroupError ? 1 : 0) + criterionErrorCount} lỗi
                  </Badge>
                ) : null}
              </div>
              {subgroupError ? (
                <p id={subgroupErrorId} className="mt-1 text-sm text-destructive">
                  {subgroupError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <CollapsibleContent id={contentId}>
          <div role="region" aria-label={`Nội dung ${subgroupContext}`} className="pb-4">
            <TechnicalConfigurationBaselineSubgroupCriteria
              criteria={subgroup.criteria}
              sectionOrdinal={sectionOrdinal}
              subgroupOrdinal={subgroupOrdinal}
              criterionErrors={criterionErrors}
              focusCriterionKey={targetCriterionKey}
              focusCriterionToken={targetCriterionToken}
            />
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
