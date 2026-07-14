import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import { normalizeTechnicalConfigurationBulkEntryText } from "./bulk-entry-utils"

export interface TechnicalConfigurationBaselineEditorCriterion {
  key: string
  id: string | null
  criterionCode: string | null
  title: string
  requirementText: string
}

export interface TechnicalConfigurationBaselineEditorGroup {
  key: string
  id: string | null
  name: string
  criteria: TechnicalConfigurationBaselineEditorCriterion[]
}

export interface TechnicalConfigurationBaselineEditorDraft {
  id: string
  dossierId: string
  status: "draft" | "locked"
  revision: number
  groups: TechnicalConfigurationBaselineEditorGroup[]
}

export interface TechnicalConfigurationBaselineEditorValidation {
  groupErrors: Record<string, string>
  criterionErrors: Record<string, string>
}

/** Stable empty validation state used before an explicit save attempt. */
export const EMPTY_TECHNICAL_CONFIGURATION_BASELINE_EDITOR_VALIDATION: TechnicalConfigurationBaselineEditorValidation =
  {
    groupErrors: {},
    criterionErrors: {},
  }

/** Maps a persisted P2 draft into the editable form shape. */
export function toTechnicalConfigurationBaselineEditorDraft(
  draft: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationBaselineEditorDraft {
  return {
    id: draft.id,
    dossierId: draft.dossier_id,
    status: draft.status,
    revision: draft.revision,
    groups: draft.groups.map((group) => ({
      key: group.id,
      id: group.id,
      name: group.name,
      criteria: group.criteria.map((criterion) => ({
        key: criterion.id,
        id: criterion.id,
        criterionCode: criterion.criterion_code,
        title: criterion.title ?? "",
        requirementText: criterion.requirement_text,
      })),
    })),
  }
}

/** Creates one unsaved group row. */
export function createTechnicalConfigurationBaselineEditorGroup(
  key = createEditorKey("group")
): TechnicalConfigurationBaselineEditorGroup {
  return { key, id: null, name: "", criteria: [] }
}

/** Creates one unsaved criterion row. */
export function createTechnicalConfigurationBaselineEditorCriterion(
  key = createEditorKey("criterion")
): TechnicalConfigurationBaselineEditorCriterion {
  return {
    key,
    id: null,
    criterionCode: null,
    title: "",
    requirementText: "",
  }
}

/** Replaces one group name without mutating the editable tree. */
export function setTechnicalConfigurationBaselineEditorGroupName(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  name: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateTechnicalConfigurationBaselineEditorGroup(draft, groupKey, (group) => ({
    ...group,
    name,
  }))
}

/** Replaces one editable criterion text field without mutating the tree. */
export function setTechnicalConfigurationBaselineEditorCriterionText(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  criterionKey: string,
  field: "title" | "requirementText",
  value: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateTechnicalConfigurationBaselineEditorGroup(draft, groupKey, (group) => ({
    ...group,
    criteria: group.criteria.map((criterion) =>
      criterion.key === criterionKey ? { ...criterion, [field]: value } : criterion
    ),
  }))
}

/** Moves one criterion within its group without mutating the editable tree. */
export function moveTechnicalConfigurationBaselineEditorCriterion(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  criterionIndex: number,
  offset: -1 | 1
): TechnicalConfigurationBaselineEditorDraft {
  return updateTechnicalConfigurationBaselineEditorGroup(draft, groupKey, (group) => ({
    ...group,
    criteria: [
      ...moveTechnicalConfigurationBaselineEditorItem(group.criteria, criterionIndex, offset),
    ],
  }))
}

/** Removes one criterion without mutating the editable tree. */
export function removeTechnicalConfigurationBaselineEditorCriterion(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  criterionKey: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateTechnicalConfigurationBaselineEditorGroup(draft, groupKey, (group) => ({
    ...group,
    criteria: group.criteria.filter((criterion) => criterion.key !== criterionKey),
  }))
}

/** Appends one unsaved criterion without mutating the editable tree. */
export function appendTechnicalConfigurationBaselineEditorCriterion(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateTechnicalConfigurationBaselineEditorGroup(draft, groupKey, (group) => ({
    ...group,
    criteria: [...group.criteria, createTechnicalConfigurationBaselineEditorCriterion()],
  }))
}

/** Appends normalized unsaved criteria to one selected group without persistence. */
export function appendTechnicalConfigurationBaselineEditorCriteria(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  requirementTexts: readonly string[]
): TechnicalConfigurationBaselineEditorDraft {
  return updateTechnicalConfigurationBaselineEditorGroup(draft, groupKey, (group) => ({
    ...group,
    criteria: [
      ...group.criteria,
      ...requirementTexts.map((requirementText) => ({
        ...createTechnicalConfigurationBaselineEditorCriterion(),
        requirementText: normalizeTechnicalConfigurationBulkEntryText(requirementText),
      })),
    ],
  }))
}

/** Moves one editor row by a single position without mutating the input array. */
export function moveTechnicalConfigurationBaselineEditorItem<T>(
  items: readonly T[],
  index: number,
  offset: -1 | 1
): readonly T[] {
  const targetIndex = index + offset
  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  return next
}

/** Validates all local rows before the first explicit-save mutation. */
export function validateTechnicalConfigurationBaselineEditorDraft(
  draft: TechnicalConfigurationBaselineEditorDraft
): TechnicalConfigurationBaselineEditorValidation {
  const groupErrors: Record<string, string> = {}
  const criterionErrors: Record<string, string> = {}

  for (const group of draft.groups) {
    if (!group.name.trim()) {
      groupErrors[group.key] = "Tên nhóm là bắt buộc."
    }

    for (const criterion of group.criteria) {
      if (!criterion.requirementText.trim()) {
        criterionErrors[criterion.key] = "Nội dung yêu cầu là bắt buộc."
      }
    }
  }

  return { groupErrors, criterionErrors }
}

/** Clones the persisted draft tree used by resumable save progress. */
export function cloneTechnicalConfigurationBaselineDraft(
  draft: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationBaselineDraftWire {
  return cloneTechnicalConfigurationBaselineTree(draft)
}

/** Clones the editable tree so failed-save progress never aliases caller state. */
export function cloneTechnicalConfigurationBaselineEditorDraft(
  draft: TechnicalConfigurationBaselineEditorDraft
): TechnicalConfigurationBaselineEditorDraft {
  return cloneTechnicalConfigurationBaselineTree(draft)
}

function cloneTechnicalConfigurationBaselineTree<
  TCriterion extends object,
  TGroup extends { criteria: TCriterion[] },
  TDraft extends { groups: TGroup[] },
>(draft: TDraft): TDraft {
  return {
    ...draft,
    groups: draft.groups.map((group) => ({
      ...group,
      criteria: group.criteria.map((criterion) => ({ ...criterion })),
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

    return group.criteria.some((criterion, criterionIndex) => {
      const editorCriterion = editorGroup.criteria[criterionIndex]
      return (
        !editorCriterion ||
        criterion.id !== editorCriterion.id ||
        (criterion.title ?? "") !== editorCriterion.title ||
        criterion.requirement_text !== editorCriterion.requirementText
      )
    })
  })
}

function createEditorKey(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

function updateTechnicalConfigurationBaselineEditorGroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  update: (
    group: TechnicalConfigurationBaselineEditorGroup
  ) => TechnicalConfigurationBaselineEditorGroup
): TechnicalConfigurationBaselineEditorDraft {
  return {
    ...draft,
    groups: draft.groups.map((group) => (group.key === groupKey ? update(group) : group)),
  }
}
