"use client"

import { TechnicalConfigurationBaselineSubgroupSection } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupSection"
import { TechnicalConfigurationBulkEntryWorkbench } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench"
import { TechnicalConfigurationCriteriaSpreadsheet } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import type { TechnicalConfigurationBaselineGroupSectionProps } from "./TechnicalConfigurationBaselineGroupSectionTypes"

type TechnicalConfigurationBaselineGroupContentProps = Readonly<
  Pick<
    TechnicalConfigurationBaselineGroupSectionProps,
    | "group"
    | "mode"
    | "bulkSession"
    | "subgroupErrors"
    | "criterionErrors"
    | "disabled"
    | "interactionDisabled"
    | "focusTarget"
    | "recentlyAcceptedCriterionKeys"
    | "ownerOptions"
    | "hierarchyAuthoring"
    | "pendingInputDescriptionId"
    | "onCriterionTextChange"
    | "onMoveCriterion"
    | "onDeleteCriterion"
    | "onBulkInputChange"
    | "onBulkPreview"
    | "onBulkCancel"
    | "onBulkAccept"
  > & {
    ordinal: number
    sectionOrdinal: string
    groupLabel: string
    subgroups: NonNullable<TechnicalConfigurationBaselineEditorGroup["subgroups"]>
    expandedSubgroupKeys: ReadonlySet<string>
    onSubgroupExpandedChange: (subgroupKey: string, expanded: boolean) => void
  }
>

/** Renders direct criteria and nested subgroup editors inside one expanded group. */
export function TechnicalConfigurationBaselineGroupContent({
  group,
  ordinal,
  sectionOrdinal,
  groupLabel,
  mode,
  bulkSession,
  subgroups,
  expandedSubgroupKeys,
  subgroupErrors,
  criterionErrors,
  disabled,
  interactionDisabled = false,
  focusTarget,
  recentlyAcceptedCriterionKeys,
  ownerOptions,
  hierarchyAuthoring,
  pendingInputDescriptionId,
  onCriterionTextChange,
  onMoveCriterion,
  onDeleteCriterion,
  onBulkInputChange,
  onBulkPreview,
  onBulkCancel,
  onBulkAccept,
  onSubgroupExpandedChange,
}: TechnicalConfigurationBaselineGroupContentProps): React.JSX.Element {
  return (
    <section aria-label={`Nội dung nhóm ${sectionOrdinal}`} className="py-4">
      {mode === "row" ? (
        <TechnicalConfigurationCriteriaSpreadsheet
          group={group}
          groupIndex={ordinal}
          criterionErrors={criterionErrors}
          readOnly={disabled}
          disabled={interactionDisabled}
          focusCriterionKey={focusTarget?.kind === "criterion" ? focusTarget.key : null}
          focusCriterionToken={focusTarget?.kind === "criterion" ? focusTarget.token : null}
          recentlyAcceptedCriterionKeys={recentlyAcceptedCriterionKeys}
          onCriterionTextChange={(criterionKey, field, value) =>
            onCriterionTextChange(group.key, criterionKey, field, value)
          }
          onMoveCriterion={(criterionIndex, offset) =>
            onMoveCriterion(group.key, criterionIndex, offset)
          }
          onDeleteCriterion={(criterionKey) => onDeleteCriterion(group.key, criterionKey)}
          ownerOptions={hierarchyAuthoring ? ownerOptions : undefined}
          onMoveCriterionToOwner={
            hierarchyAuthoring
              ? (criterionKey, owner) =>
                  hierarchyAuthoring.onMoveCriterionToOwner(
                    { groupKey: group.key, subgroupKey: null },
                    criterionKey,
                    owner
                  )
              : undefined
          }
        />
      ) : (
        <TechnicalConfigurationBulkEntryWorkbench
          groupName={groupLabel}
          existingCriterionCount={group.criteria.length}
          session={bulkSession}
          disabled={disabled || interactionDisabled}
          focusInputToken={focusTarget?.kind === "bulk-input" ? focusTarget.token : null}
          onInputChange={onBulkInputChange}
          onPreview={onBulkPreview}
          onCancel={onBulkCancel}
          onAccept={onBulkAccept}
        />
      )}
      {subgroups.map((subgroup, subgroupIndex) => (
        <TechnicalConfigurationBaselineSubgroupSection
          key={subgroup.key}
          groupKey={group.key}
          subgroup={subgroup}
          sectionOrdinal={sectionOrdinal}
          subgroupIndex={subgroupIndex}
          subgroupCount={subgroups.length}
          expanded={expandedSubgroupKeys.has(subgroup.key)}
          subgroupError={subgroupErrors[subgroup.key]}
          criterionErrors={criterionErrors}
          focusTarget={focusTarget}
          readOnly={disabled}
          disabled={interactionDisabled}
          ownerOptions={ownerOptions}
          pendingInputDescriptionId={pendingInputDescriptionId}
          authoring={hierarchyAuthoring}
          onExpandedChange={(expanded) => onSubgroupExpandedChange(subgroup.key, expanded)}
        />
      ))}
    </section>
  )
}
