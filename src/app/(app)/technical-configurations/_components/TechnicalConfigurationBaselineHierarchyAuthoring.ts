import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type {
  TechnicalConfigurationBaselineEditorCriterionOwner,
  TechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"

type CriterionTextField = "title" | "requirementText"

export type TechnicalConfigurationBaselineCriterionOwnerOption = Readonly<{
  label: string
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  value: string
}>

export type TechnicalConfigurationBaselineHierarchyAuthoring = Readonly<{
  activeOwnerKey: string
  entryMode: "row" | "bulk"
  getBulkSession: (ownerKey: string) => TechnicalConfigurationBulkEntrySession
  onOwnerModeChange: (ownerKey: string, mode: "row" | "bulk") => void
  onAddSubgroup: (groupKey: string) => void
  onSubgroupNameChange: (groupKey: string, subgroupKey: string, name: string) => void
  onMoveSubgroup: (groupKey: string, subgroupIndex: number, offset: -1 | 1) => void
  onDeleteSubgroup: (groupKey: string, subgroupKey: string) => void
  onCriterionTextChange: (
    owner: TechnicalConfigurationBaselineEditorCriterionOwner,
    criterionKey: string,
    field: CriterionTextField,
    value: string
  ) => void
  onMoveCriterionWithinOwner: (
    owner: TechnicalConfigurationBaselineEditorCriterionOwner,
    criterionIndex: number,
    offset: -1 | 1
  ) => void
  onMoveCriterionToOwner: (
    sourceOwner: TechnicalConfigurationBaselineEditorCriterionOwner,
    criterionKey: string,
    targetOwner: TechnicalConfigurationBaselineEditorCriterionOwner
  ) => void
  onDeleteCriterion: (
    owner: TechnicalConfigurationBaselineEditorCriterionOwner,
    criterionKey: string
  ) => void
  onAddCriterion: (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => void
  onBulkInputChange: (ownerKey: string, input: string) => void
  onBulkPreview: (ownerKey: string) => void
  onBulkCancel: (ownerKey: string) => void
  onBulkAccept: (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => void
}>

/** Returns the stable UI/session key for one criterion owner. */
export function getTechnicalConfigurationBaselineCriterionOwnerKey(
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
): string {
  return owner.subgroupKey ?? owner.groupKey
}

/** Returns the form value used by criterion owner selectors. */
export function getTechnicalConfigurationBaselineCriterionOwnerValue(
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
): string {
  return `${owner.groupKey}:${owner.subgroupKey ?? "direct"}`
}

/** Builds canonical direct/subgroup destinations for criterion move controls. */
export function getTechnicalConfigurationBaselineCriterionOwnerOptions(
  draft: TechnicalConfigurationBaselineEditorDraft
): TechnicalConfigurationBaselineCriterionOwnerOption[] {
  return draft.groups.flatMap((group, groupIndex) => {
    const sectionOrdinal = formatTechnicalConfigurationBaselineSectionOrdinal(groupIndex + 1)
    const sectionLabel = group.name.trim() || `Nhóm ${sectionOrdinal}`
    const directOwner = { groupKey: group.key, subgroupKey: null }
    const directOption: TechnicalConfigurationBaselineCriterionOwnerOption = {
      label: `${sectionOrdinal}. ${sectionLabel} - Trực tiếp`,
      owner: directOwner,
      value: getTechnicalConfigurationBaselineCriterionOwnerValue(directOwner),
    }
    const subgroupOptions = (group.subgroups ?? []).map((subgroup, subgroupIndex) => {
      const owner = { groupKey: group.key, subgroupKey: subgroup.key }
      return {
        label: `${sectionOrdinal}.${subgroupIndex + 1} ${subgroup.name.trim() || `Nhóm con ${subgroupIndex + 1}`}`,
        owner,
        value: getTechnicalConfigurationBaselineCriterionOwnerValue(owner),
      }
    })

    return [directOption, ...subgroupOptions]
  })
}
