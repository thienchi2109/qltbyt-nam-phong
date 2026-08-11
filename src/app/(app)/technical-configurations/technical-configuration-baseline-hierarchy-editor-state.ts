import {
  createTechnicalConfigurationBaselineEditorCriterion,
  createTechnicalConfigurationBaselineEditorGroup,
  createTechnicalConfigurationBaselineEditorKey,
  moveTechnicalConfigurationBaselineEditorItem,
} from "./technical-configuration-baseline-editor-state"
import { normalizeTechnicalConfigurationBulkEntryText } from "./bulk-entry-utils"
import type {
  TechnicalConfigurationBaselineEditorCriterion,
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorGroup,
  TechnicalConfigurationBaselineEditorSubgroup,
} from "./technical-configuration-baseline-editor-state"

export interface TechnicalConfigurationBaselineEditorCriterionOwner {
  groupKey: string
  subgroupKey: string | null
}

/** Creates one unsaved subgroup block. */
export function createTechnicalConfigurationBaselineEditorSubgroup(
  key = createTechnicalConfigurationBaselineEditorKey("subgroup")
): TechnicalConfigurationBaselineEditorSubgroup {
  return { key, id: null, name: "", criteria: [] }
}

/** Appends one complete unsaved section without mutating the editor tree. */
export function appendTechnicalConfigurationBaselineEditorGroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  group = createTechnicalConfigurationBaselineEditorGroup()
): TechnicalConfigurationBaselineEditorDraft {
  return { ...draft, groups: [...draft.groups, group] }
}

/** Appends one complete subgroup block to a section. */
export function appendTechnicalConfigurationBaselineEditorSubgroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  subgroup = createTechnicalConfigurationBaselineEditorSubgroup()
): TechnicalConfigurationBaselineEditorDraft {
  return updateGroup(draft, groupKey, (group) => ({
    ...group,
    subgroups: [...(group.subgroups ?? []), subgroup],
  }))
}

/** Replaces one subgroup name without mutating the editor tree. */
export function setTechnicalConfigurationBaselineEditorSubgroupName(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  subgroupKey: string,
  name: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateGroup(draft, groupKey, (group) => {
    const currentSubgroups = group.subgroups ?? []
    const subgroupIndex = currentSubgroups.findIndex((subgroup) => subgroup.key === subgroupKey)
    if (subgroupIndex < 0) return group

    const subgroups = [...currentSubgroups]
    subgroups[subgroupIndex] = { ...subgroups[subgroupIndex], name }
    return { ...group, subgroups }
  })
}

/** Appends one criterion to either a direct section owner or a subgroup owner. */
export function appendTechnicalConfigurationBaselineEditorCriterionToOwner(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner,
  criterion = createTechnicalConfigurationBaselineEditorCriterion()
): TechnicalConfigurationBaselineEditorDraft {
  return updateOwnerCriteria(draft, owner, (criteria) => [...criteria, criterion])
}

/** Appends normalized unsaved criteria to a direct or subgroup owner. */
export function appendTechnicalConfigurationBaselineEditorCriteriaToOwner(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner,
  requirementTexts: readonly string[]
): TechnicalConfigurationBaselineEditorDraft {
  return updateOwnerCriteria(draft, owner, (criteria) => [
    ...criteria,
    ...requirementTexts.map((requirementText) => ({
      ...createTechnicalConfigurationBaselineEditorCriterion(),
      requirementText: normalizeTechnicalConfigurationBulkEntryText(requirementText),
    })),
  ])
}

/** Replaces one criterion field inside a direct or subgroup owner. */
export function setTechnicalConfigurationBaselineEditorCriterionTextInOwner(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner,
  criterionKey: string,
  field: "title" | "requirementText",
  value: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateOwnerCriteria(draft, owner, (criteria) =>
    criteria.map((criterion) =>
      criterion.key === criterionKey ? { ...criterion, [field]: value } : criterion
    )
  )
}

/** Reads the current criteria for a direct or subgroup owner. */
export function getTechnicalConfigurationBaselineEditorOwnerCriteria(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
): readonly TechnicalConfigurationBaselineEditorCriterion[] {
  return getOwnerCriteria(draft, owner) ?? []
}

/** Moves one section by a single stable position. */
export function moveTechnicalConfigurationBaselineEditorGroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupIndex: number,
  offset: -1 | 1
): TechnicalConfigurationBaselineEditorDraft {
  const groups = moveTechnicalConfigurationBaselineEditorItem(draft.groups, groupIndex, offset)
  return groups === draft.groups ? draft : { ...draft, groups: [...groups] }
}

/** Moves one complete subgroup block by a single stable position. */
export function moveTechnicalConfigurationBaselineEditorSubgroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  subgroupIndex: number,
  offset: -1 | 1
): TechnicalConfigurationBaselineEditorDraft {
  return updateGroup(draft, groupKey, (group) => {
    const currentSubgroups = group.subgroups ?? []
    const subgroups = moveTechnicalConfigurationBaselineEditorItem(
      currentSubgroups,
      subgroupIndex,
      offset
    )
    return subgroups === currentSubgroups ? group : { ...group, subgroups: [...subgroups] }
  })
}

/** Moves one criterion by a single position within its current owner. */
export function moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner,
  criterionIndex: number,
  offset: -1 | 1
): TechnicalConfigurationBaselineEditorDraft {
  return updateOwnerCriteria(draft, owner, (criteria) => {
    const nextCriteria = moveTechnicalConfigurationBaselineEditorItem(
      criteria,
      criterionIndex,
      offset
    )
    return nextCriteria === criteria ? criteria : [...nextCriteria]
  })
}

/** Relocates one existing criterion while preserving its key, ID, and code. */
export function moveTechnicalConfigurationBaselineEditorCriterionToOwner(
  draft: TechnicalConfigurationBaselineEditorDraft,
  sourceOwner: TechnicalConfigurationBaselineEditorCriterionOwner,
  criterionKey: string,
  targetOwner: TechnicalConfigurationBaselineEditorCriterionOwner,
  targetIndex?: number
): TechnicalConfigurationBaselineEditorDraft {
  const sourceCriteria = getOwnerCriteria(draft, sourceOwner)
  const targetCriteria = getOwnerCriteria(draft, targetOwner)
  if (!sourceCriteria || !targetCriteria) return draft

  const sourceIndex = sourceCriteria.findIndex((criterion) => criterion.key === criterionKey)
  if (sourceIndex < 0) return draft

  if (sameOwner(sourceOwner, targetOwner)) {
    const nextCriteria = moveItemToIndex(sourceCriteria, sourceIndex, targetIndex)
    return nextCriteria === sourceCriteria
      ? draft
      : updateOwnerCriteria(draft, sourceOwner, () => nextCriteria)
  }

  const criterion = sourceCriteria[sourceIndex]
  const withoutCriterion = sourceCriteria.filter((item) => item.key !== criterionKey)
  const insertionIndex = normalizeInsertionIndex(targetIndex, targetCriteria.length)
  const withCriterion = [...targetCriteria]
  withCriterion.splice(insertionIndex, 0, criterion)

  const withoutSource = updateOwnerCriteria(draft, sourceOwner, () => withoutCriterion)
  return updateOwnerCriteria(withoutSource, targetOwner, () => withCriterion)
}

/** Removes one complete section and all nested rows. */
export function removeTechnicalConfigurationBaselineEditorGroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string
): TechnicalConfigurationBaselineEditorDraft {
  const groups = draft.groups.filter((group) => group.key !== groupKey)
  return groups.length === draft.groups.length ? draft : { ...draft, groups }
}

/** Removes one complete subgroup block and all nested criteria. */
export function removeTechnicalConfigurationBaselineEditorSubgroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  subgroupKey: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateGroup(draft, groupKey, (group) => {
    const currentSubgroups = group.subgroups ?? []
    const subgroups = currentSubgroups.filter((subgroup) => subgroup.key !== subgroupKey)
    return subgroups.length === currentSubgroups.length ? group : { ...group, subgroups }
  })
}

/** Removes one criterion from its direct or subgroup owner. */
export function removeTechnicalConfigurationBaselineEditorCriterionFromOwner(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner,
  criterionKey: string
): TechnicalConfigurationBaselineEditorDraft {
  return updateOwnerCriteria(draft, owner, (criteria) => {
    const nextCriteria = criteria.filter((criterion) => criterion.key !== criterionKey)
    return nextCriteria.length === criteria.length ? criteria : nextCriteria
  })
}

function updateGroup(
  draft: TechnicalConfigurationBaselineEditorDraft,
  groupKey: string,
  update: (
    group: TechnicalConfigurationBaselineEditorGroup
  ) => TechnicalConfigurationBaselineEditorGroup
): TechnicalConfigurationBaselineEditorDraft {
  const groupIndex = draft.groups.findIndex((group) => group.key === groupKey)
  if (groupIndex < 0) return draft

  const group = draft.groups[groupIndex]
  const nextGroup = update(group)
  if (nextGroup === group) return draft

  const groups = [...draft.groups]
  groups[groupIndex] = nextGroup
  return { ...draft, groups }
}

function updateOwnerCriteria(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner,
  update: (
    criteria: TechnicalConfigurationBaselineEditorCriterion[]
  ) => TechnicalConfigurationBaselineEditorCriterion[]
): TechnicalConfigurationBaselineEditorDraft {
  return updateGroup(draft, owner.groupKey, (group) => {
    if (owner.subgroupKey === null) {
      const criteria = update(group.criteria)
      return criteria === group.criteria ? group : { ...group, criteria }
    }

    const currentSubgroups = group.subgroups ?? []
    const subgroupIndex = currentSubgroups.findIndex(
      (subgroup) => subgroup.key === owner.subgroupKey
    )
    if (subgroupIndex < 0) return group

    const subgroup = currentSubgroups[subgroupIndex]
    const criteria = update(subgroup.criteria)
    if (criteria === subgroup.criteria) return group

    const subgroups = [...currentSubgroups]
    subgroups[subgroupIndex] = { ...subgroup, criteria }
    return { ...group, subgroups }
  })
}

function getOwnerCriteria(
  draft: TechnicalConfigurationBaselineEditorDraft,
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
): TechnicalConfigurationBaselineEditorCriterion[] | null {
  const group = draft.groups.find((item) => item.key === owner.groupKey)
  if (!group) return null
  if (owner.subgroupKey === null) return group.criteria

  return (
    (group.subgroups ?? []).find((subgroup) => subgroup.key === owner.subgroupKey)?.criteria ?? null
  )
}

function moveItemToIndex<T>(items: T[], sourceIndex: number, targetIndex: number | undefined): T[] {
  if (sourceIndex < 0 || sourceIndex >= items.length) return items

  const insertionIndex = normalizeInsertionIndex(targetIndex, items.length - 1)
  if (sourceIndex === insertionIndex) return items

  const next = [...items]
  const [item] = next.splice(sourceIndex, 1)
  next.splice(insertionIndex, 0, item)
  return next
}

function normalizeInsertionIndex(targetIndex: number | undefined, maxIndex: number): number {
  if (targetIndex === undefined) return maxIndex
  return Math.min(Math.max(targetIndex, 0), maxIndex)
}

function sameOwner(
  left: TechnicalConfigurationBaselineEditorCriterionOwner,
  right: TechnicalConfigurationBaselineEditorCriterionOwner
): boolean {
  return left.groupKey === right.groupKey && left.subgroupKey === right.subgroupKey
}
