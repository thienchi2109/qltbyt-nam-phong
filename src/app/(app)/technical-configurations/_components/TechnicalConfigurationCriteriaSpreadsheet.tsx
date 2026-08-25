"use client"

import * as React from "react"

import type {
  TechnicalConfigurationBaselineEditorCriterionOwner,
  TechnicalConfigurationBaselineEditorGroup,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"

import {
  TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH,
  TechnicalConfigurationBaselineCriterionDropZone,
  TechnicalConfigurationBaselineCriterionRow,
} from "./TechnicalConfigurationBaselineCriterionRow"
import type { TechnicalConfigurationBaselineCriterionOwnerOption } from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type CriterionTextField = "title" | "requirementText"

type TechnicalConfigurationCriteriaSpreadsheetProps = Readonly<{
  group: TechnicalConfigurationBaselineEditorGroup
  groupIndex: number
  criterionErrors: Record<string, string>
  readOnly: boolean
  disabled: boolean
  focusCriterionKey: string | null
  focusCriterionToken: number | null
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
  onCriterionTextChange: (criterionKey: string, field: CriterionTextField, value: string) => void
  onMoveCriterion: (criterionIndex: number, offset: -1 | 1) => void
  onDeleteCriterion: (criterionKey: string) => void
  ownerOptions?: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  onMoveCriterionToOwner?: (
    criterionKey: string,
    owner: TechnicalConfigurationBaselineEditorCriterionOwner
  ) => void
}>

/** Renders editable criteria for one selected group in a stable spreadsheet grid. */
export function TechnicalConfigurationCriteriaSpreadsheet({
  group,
  groupIndex,
  criterionErrors,
  readOnly,
  disabled,
  focusCriterionKey,
  focusCriterionToken,
  recentlyAcceptedCriterionKeys,
  onCriterionTextChange,
  onMoveCriterion,
  onDeleteCriterion,
  ownerOptions,
  onMoveCriterionToOwner,
}: TechnicalConfigurationCriteriaSpreadsheetProps) {
  const requirementRefs = React.useRef(new Map<string, HTMLElement>())
  const sectionOrdinal = formatTechnicalConfigurationBaselineSectionOrdinal(groupIndex)
  const currentOwner: TechnicalConfigurationBaselineEditorCriterionOwner = {
    groupKey: group.key,
    subgroupKey: null,
  }

  React.useEffect(() => {
    if (!focusCriterionKey) return
    const timeoutId = window.setTimeout(() => {
      const target = requirementRefs.current.get(focusCriterionKey)
      target?.focus()
      target?.scrollIntoView?.({ block: "nearest" })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusCriterionKey, focusCriterionToken])

  return (
    <section
      aria-label={`Danh sách tiêu chí trực tiếp nhóm ${sectionOrdinal}`}
      className="ml-6 min-w-0 border-l border-border/70 pl-4"
    >
      <div className="overflow-x-auto">
        <div className={TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH}>
          {group.criteria.length === 0 ? (
            <TechnicalConfigurationBaselineCriterionDropZone
              owner={{ kind: "group", groupKey: group.key }}
              emptyText="Nhóm này chưa có tiêu chí."
              locked={readOnly}
              dndEnabled={!disabled && Boolean(ownerOptions && onMoveCriterionToOwner)}
            />
          ) : (
            group.criteria.map((criterion, criterionIndex) => {
              const criterionOrdinal = criterionIndex + 1
              const criterionLabel = `tiêu chí trực tiếp ${criterionOrdinal} của nhóm ${sectionOrdinal}`
              const error = criterionErrors[criterion.key]
              const errorId = error ? `baseline-requirement-error-${criterion.key}` : undefined

              return (
                <TechnicalConfigurationBaselineCriterionRow
                  key={criterion.key}
                  criterion={criterion}
                  criterionIndex={criterionIndex}
                  criterionCount={group.criteria.length}
                  criterionLabel={criterionLabel}
                  fieldIdPrefix="baseline"
                  owner={{ kind: "group", groupKey: currentOwner.groupKey }}
                  error={error}
                  errorId={errorId}
                  locked={readOnly}
                  disabled={disabled}
                  recentlyAccepted={recentlyAcceptedCriterionKeys.has(criterion.key)}
                  requirementRef={(node) => {
                    if (node) requirementRefs.current.set(criterion.key, node)
                    else requirementRefs.current.delete(criterion.key)
                  }}
                  onTextChange={(field, value) =>
                    onCriterionTextChange(criterion.key, field, value)
                  }
                  onMove={(offset) => onMoveCriterion(criterionIndex, offset)}
                  hierarchyEnabled={Boolean(ownerOptions && onMoveCriterionToOwner)}
                  ownerOptions={ownerOptions}
                  onMoveToOwner={(owner) => onMoveCriterionToOwner?.(criterion.key, owner)}
                  onDelete={() => onDeleteCriterion(criterion.key)}
                />
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
