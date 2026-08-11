import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import { normalizeTechnicalConfigurationBulkEntryText } from "./bulk-entry-utils"

export {
  cloneTechnicalConfigurationBaselineDraft,
  cloneTechnicalConfigurationBaselineEditorDraft,
  isTechnicalConfigurationBaselineEditorDirty,
} from "./technical-configuration-baseline-editor-snapshot"

export interface TechnicalConfigurationBaselineEditorCriterion {
  key: string
  id: string | null
  criterionCode: string | null
  title: string
  requirementText: string
}

export interface TechnicalConfigurationBaselineEditorSubgroup {
  key: string
  id: string | null
  name: string
  criteria: TechnicalConfigurationBaselineEditorCriterion[]
}

export interface TechnicalConfigurationBaselineEditorGroup {
  key: string
  id: string | null
  name: string
  criteria: TechnicalConfigurationBaselineEditorCriterion[]
  subgroups: TechnicalConfigurationBaselineEditorSubgroup[]
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
  subgroupErrors?: Record<string, string>
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
      criteria: group.criteria.map(toTechnicalConfigurationBaselineEditorCriterion),
      subgroups: (group.subgroups ?? []).map((subgroup) => ({
        key: subgroup.id,
        id: subgroup.id,
        name: subgroup.name,
        criteria: subgroup.criteria.map(toTechnicalConfigurationBaselineEditorCriterion),
      })),
    })),
  }
}

/** Creates one unsaved group row. */
export function createTechnicalConfigurationBaselineEditorGroup(
  key = createTechnicalConfigurationBaselineEditorKey("group")
): TechnicalConfigurationBaselineEditorGroup {
  return { key, id: null, name: "", criteria: [], subgroups: [] }
}

/** Creates one unsaved criterion row. */
export function createTechnicalConfigurationBaselineEditorCriterion(
  key = createTechnicalConfigurationBaselineEditorKey("criterion")
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
  const subgroupErrors: Record<string, string> = {}
  const criterionErrors: Record<string, string> = {}
  let hasSubgroups = false

  for (const group of draft.groups) {
    if (!group.name.trim()) {
      groupErrors[group.key] = "Tên nhóm là bắt buộc."
    }

    for (const criterion of group.criteria) {
      if (!criterion.requirementText.trim()) {
        criterionErrors[criterion.key] = "Nội dung yêu cầu là bắt buộc."
      }
    }

    for (const subgroup of group.subgroups ?? []) {
      hasSubgroups = true
      if (!subgroup.name.trim()) {
        subgroupErrors[subgroup.key] = "Tên nhóm con là bắt buộc."
      }

      for (const criterion of subgroup.criteria) {
        if (!criterion.requirementText.trim()) {
          criterionErrors[criterion.key] = "Nội dung yêu cầu là bắt buộc."
        }
      }
    }
  }

  return hasSubgroups
    ? { groupErrors, subgroupErrors, criterionErrors }
    : { groupErrors, criterionErrors }
}

/** Creates a stable client-side key for a new editor item. */
export function createTechnicalConfigurationBaselineEditorKey(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

function toTechnicalConfigurationBaselineEditorCriterion(
  criterion: TechnicalConfigurationBaselineDraftWire["groups"][number]["criteria"][number]
): TechnicalConfigurationBaselineEditorCriterion {
  return {
    key: criterion.id,
    id: criterion.id,
    criterionCode: criterion.criterion_code,
    title: criterion.title ?? "",
    requirementText: criterion.requirement_text,
  }
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
