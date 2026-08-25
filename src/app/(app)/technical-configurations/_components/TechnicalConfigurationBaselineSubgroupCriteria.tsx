"use client"

import * as React from "react"

import type {
  TechnicalConfigurationBaselineEditorCriterion,
  TechnicalConfigurationBaselineEditorCriterionOwner,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH,
  TechnicalConfigurationBaselineCriterionDropZone,
  TechnicalConfigurationBaselineCriterionRow,
} from "./TechnicalConfigurationBaselineCriterionRow"
import type { TechnicalConfigurationBaselineCriterionOwnerOption } from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type CriterionTextField = "title" | "requirementText"

type SubgroupCriteriaAuthoring = Readonly<{
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  ownerOptions: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  disabled: boolean
  onCriterionTextChange: (criterionKey: string, field: CriterionTextField, value: string) => void
  onMoveCriterion: (criterionIndex: number, offset: -1 | 1) => void
  onMoveCriterionToOwner: (
    criterionKey: string,
    owner: TechnicalConfigurationBaselineEditorCriterionOwner
  ) => void
  onDeleteCriterion: (criterionKey: string) => void
}>

type TechnicalConfigurationBaselineSubgroupCriteriaProps = Readonly<{
  criteria: readonly TechnicalConfigurationBaselineEditorCriterion[]
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  sectionOrdinal: string
  subgroupOrdinal: number
  criterionErrors: Record<string, string>
  focusCriterionKey: string | null
  focusCriterionToken: number | null
  authoring?: SubgroupCriteriaAuthoring
}>

/** Presents subgroup criteria with optional P4C authoring controls. */
export function TechnicalConfigurationBaselineSubgroupCriteria({
  criteria,
  owner,
  sectionOrdinal,
  subgroupOrdinal,
  criterionErrors,
  focusCriterionKey,
  focusCriterionToken,
  authoring,
}: TechnicalConfigurationBaselineSubgroupCriteriaProps): React.JSX.Element {
  const requirementRefs = React.useRef(new Map<string, HTMLElement>())
  const subgroupContext = `nhóm con ${subgroupOrdinal}, nhóm ${sectionOrdinal}`
  const locked = !authoring
  const disabled = authoring?.disabled ?? false

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
    <section aria-label={`Danh sách tiêu chí của ${subgroupContext}`} className="min-w-0">
      <div className="overflow-x-auto">
        <div
          data-testid="baseline-subgroup-criterion-grid"
          className={TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH}
        >
          {criteria.length === 0 ? (
            <TechnicalConfigurationBaselineCriterionDropZone
              owner={{
                kind: "subgroup",
                groupKey: owner.groupKey,
                subgroupKey: owner.subgroupKey ?? "",
              }}
              emptyText="Nhóm con này chưa có tiêu chí."
              locked={locked}
              dndEnabled={Boolean(authoring) && !disabled}
            />
          ) : (
            criteria.map((criterion, criterionIndex) => {
              const criterionOrdinal = criterionIndex + 1
              const criterionLabel = `tiêu chí ${criterionOrdinal} của ${subgroupContext}`
              const error = criterionErrors[criterion.key]
              const errorId = error
                ? `baseline-subgroup-requirement-error-${criterion.key}`
                : undefined
              return (
                <TechnicalConfigurationBaselineCriterionRow
                  key={criterion.key}
                  criterion={criterion}
                  criterionIndex={criterionIndex}
                  criterionCount={criteria.length}
                  criterionLabel={criterionLabel}
                  fieldIdPrefix="baseline-subgroup"
                  owner={{
                    kind: "subgroup",
                    groupKey: owner.groupKey,
                    subgroupKey: owner.subgroupKey ?? "",
                  }}
                  error={error}
                  errorId={errorId}
                  locked={locked}
                  disabled={disabled}
                  requirementRef={(node) => {
                    if (node) requirementRefs.current.set(criterion.key, node)
                    else requirementRefs.current.delete(criterion.key)
                  }}
                  onTextChange={(field, value) =>
                    authoring?.onCriterionTextChange(criterion.key, field, value)
                  }
                  onMove={(offset) => authoring?.onMoveCriterion(criterionIndex, offset)}
                  hierarchyEnabled={Boolean(authoring)}
                  ownerOptions={authoring?.ownerOptions}
                  onMoveToOwner={(owner) => authoring?.onMoveCriterionToOwner(criterion.key, owner)}
                  onDelete={() => authoring?.onDeleteCriterion(criterion.key)}
                />
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
