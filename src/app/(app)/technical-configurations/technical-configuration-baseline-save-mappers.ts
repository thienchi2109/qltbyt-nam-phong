import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupMutationWire,
  TechnicalConfigurationBaselineGroupWire,
} from "./baseline-types"
import type {
  TechnicalConfigurationBaselineEditorCriterion,
  TechnicalConfigurationBaselineEditorDraft,
} from "./technical-configuration-baseline-editor-state"

export interface TechnicalConfigurationBaselineEditorSaveSectionRow {
  kind: "section"
  key: string
  id: string | null
  name: string
  sortOrder: number
}

export interface TechnicalConfigurationBaselineEditorSaveSubgroupRow {
  kind: "subgroup"
  key: string
  id: string | null
  sectionKey: string
  name: string
  sortOrder: number
}

export interface TechnicalConfigurationBaselineEditorSaveCriterionRow {
  kind: "criterion"
  key: string
  id: string | null
  criterionCode: string | null
  sectionKey: string
  subgroupKey: string | null
  title: string
  requirementText: string
  sortOrder: number
}

export type TechnicalConfigurationBaselineEditorSaveRow =
  | TechnicalConfigurationBaselineEditorSaveSectionRow
  | TechnicalConfigurationBaselineEditorSaveSubgroupRow
  | TechnicalConfigurationBaselineEditorSaveCriterionRow

/** Maps a group mutation response into the persisted draft group shape. */
export function toTechnicalConfigurationBaselineWireGroup(
  group: TechnicalConfigurationBaselineGroupMutationWire
): TechnicalConfigurationBaselineGroupWire {
  return {
    id: group.id,
    baseline_version_id: group.baseline_version_id,
    name: group.name,
    sort_order: group.sort_order,
    created_at: group.created_at,
    created_by: group.created_by,
    updated_at: group.updated_at,
    updated_by: group.updated_by,
    criteria: [],
  }
}

/** Removes mutation-only revision metadata from a persisted criterion. */
export function toTechnicalConfigurationBaselineWireCriterion(
  criterion: TechnicalConfigurationBaselineCriterionMutationWire
): TechnicalConfigurationBaselineCriterionWire {
  const { revision: _revision, ...wireCriterion } = criterion
  return wireCriterion
}

/** Projects editor state into canonical dormant save rows without invoking RPCs. */
export function toTechnicalConfigurationBaselineEditorSaveRows(
  draft: TechnicalConfigurationBaselineEditorDraft
): TechnicalConfigurationBaselineEditorSaveRow[] {
  return draft.groups.flatMap((group, groupIndex) => {
    const sectionRow: TechnicalConfigurationBaselineEditorSaveSectionRow = {
      kind: "section",
      key: group.key,
      id: group.id,
      name: group.name,
      sortOrder: groupIndex + 1,
    }
    const directCriteria = group.criteria.map((criterion, criterionIndex) =>
      toTechnicalConfigurationBaselineEditorSaveCriterionRow({
        criterion,
        sectionKey: group.key,
        subgroupKey: null,
        sortOrder: criterionIndex + 1,
      })
    )
    const subgroupBlocks = (group.subgroups ?? []).flatMap((subgroup, subgroupIndex) => {
      const subgroupRow: TechnicalConfigurationBaselineEditorSaveSubgroupRow = {
        kind: "subgroup",
        key: subgroup.key,
        id: subgroup.id,
        sectionKey: group.key,
        name: subgroup.name,
        sortOrder: subgroupIndex + 1,
      }
      const criteria = subgroup.criteria.map((criterion, criterionIndex) =>
        toTechnicalConfigurationBaselineEditorSaveCriterionRow({
          criterion,
          sectionKey: group.key,
          subgroupKey: subgroup.key,
          sortOrder: criterionIndex + 1,
        })
      )
      return [subgroupRow, ...criteria]
    })

    return [sectionRow, ...directCriteria, ...subgroupBlocks]
  })
}

function toTechnicalConfigurationBaselineEditorSaveCriterionRow({
  criterion,
  sectionKey,
  subgroupKey,
  sortOrder,
}: {
  criterion: TechnicalConfigurationBaselineEditorCriterion
  sectionKey: string
  subgroupKey: string | null
  sortOrder: number
}): TechnicalConfigurationBaselineEditorSaveCriterionRow {
  return {
    kind: "criterion",
    key: criterion.key,
    id: criterion.id,
    criterionCode: criterion.criterionCode,
    sectionKey,
    subgroupKey,
    title: criterion.title,
    requirementText: criterion.requirementText,
    sortOrder,
  }
}
