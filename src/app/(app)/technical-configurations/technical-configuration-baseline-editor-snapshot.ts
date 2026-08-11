import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import type {
  TechnicalConfigurationBaselineEditorCriterion,
  TechnicalConfigurationBaselineEditorDraft,
} from "./technical-configuration-baseline-editor-state"

/** Clones the persisted draft tree used by resumable save progress. */
export function cloneTechnicalConfigurationBaselineDraft(
  draft: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationBaselineDraftWire {
  return {
    ...draft,
    groups: draft.groups.map((group) => ({
      ...group,
      criteria: group.criteria.map((criterion) => ({ ...criterion })),
      ...(group.subgroups === undefined
        ? {}
        : {
            subgroups: group.subgroups.map((subgroup) => ({
              ...subgroup,
              criteria: subgroup.criteria.map((criterion) => ({ ...criterion })),
            })),
          }),
    })),
  }
}

/** Clones the editable tree so failed-save progress never aliases caller state. */
export function cloneTechnicalConfigurationBaselineEditorDraft(
  draft: TechnicalConfigurationBaselineEditorDraft
): TechnicalConfigurationBaselineEditorDraft {
  return {
    ...draft,
    groups: draft.groups.map((group) => ({
      ...group,
      criteria: group.criteria.map((criterion) => ({ ...criterion })),
      subgroups: (group.subgroups ?? []).map((subgroup) => ({
        ...subgroup,
        criteria: subgroup.criteria.map((criterion) => ({ ...criterion })),
      })),
    })),
  }
}

/** Compares editable values and order while ignoring client-only row keys. */
export function isTechnicalConfigurationBaselineEditorDirty(
  baseDraft: TechnicalConfigurationBaselineDraftWire | null,
  editorDraft: TechnicalConfigurationBaselineEditorDraft | null
): boolean {
  if (!baseDraft || !editorDraft) return false
  if (baseDraft.groups.length !== editorDraft.groups.length) return true

  return baseDraft.groups.some((group, groupIndex) => {
    const editorGroup = editorDraft.groups[groupIndex]
    if (!editorGroup || group.id !== editorGroup.id || group.name !== editorGroup.name) return true
    if (group.criteria.length !== editorGroup.criteria.length) return true

    if (
      group.criteria.some((criterion, criterionIndex) =>
        isCriterionDirty(criterion, editorGroup.criteria[criterionIndex])
      )
    ) {
      return true
    }

    const subgroups = group.subgroups ?? []
    const editorSubgroups = editorGroup.subgroups ?? []
    if (subgroups.length !== editorSubgroups.length) return true

    return subgroups.some((subgroup, subgroupIndex) => {
      const editorSubgroup = editorSubgroups[subgroupIndex]
      if (
        !editorSubgroup ||
        subgroup.id !== editorSubgroup.id ||
        subgroup.name !== editorSubgroup.name ||
        subgroup.criteria.length !== editorSubgroup.criteria.length
      ) {
        return true
      }

      return subgroup.criteria.some((criterion, criterionIndex) =>
        isCriterionDirty(criterion, editorSubgroup.criteria[criterionIndex])
      )
    })
  })
}

function isCriterionDirty(
  criterion: TechnicalConfigurationBaselineDraftWire["groups"][number]["criteria"][number],
  editorCriterion: TechnicalConfigurationBaselineEditorCriterion | undefined
): boolean {
  return (
    !editorCriterion ||
    criterion.id !== editorCriterion.id ||
    criterion.criterion_code !== editorCriterion.criterionCode ||
    (criterion.title ?? "") !== editorCriterion.title ||
    criterion.requirement_text !== editorCriterion.requirementText
  )
}
