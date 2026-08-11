import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
  TechnicalConfigurationBaselineSubgroupWire,
} from "./baseline-types"
import { cloneTechnicalConfigurationBaselineDraft } from "./technical-configuration-baseline-editor-state"
import type { TechnicalConfigurationBaselineEditorProgress } from "./technical-configuration-baseline-save"
import { toTechnicalConfigurationBaselineWireCriterion } from "./technical-configuration-baseline-save-mappers"
import { updateRevision } from "./technical-configuration-baseline-save-support"

export type HierarchyEditorGroup =
  TechnicalConfigurationBaselineEditorProgress["editorDraft"]["groups"][number]
export type HierarchyEditorSubgroup = HierarchyEditorGroup["subgroups"][number]
export type HierarchyEditorCriterion = HierarchyEditorGroup["criteria"][number]

export type HierarchyEditorCriterionLocation = Readonly<{
  criterion: HierarchyEditorCriterion
  group: HierarchyEditorGroup
  subgroup: HierarchyEditorSubgroup | null
}>

type WireCriterionLocation = Readonly<{
  criterion: TechnicalConfigurationBaselineCriterionWire
  group: TechnicalConfigurationBaselineGroupWire
  subgroup: TechnicalConfigurationBaselineSubgroupWire | null
}>

/** Maps each editor criterion to its current group and optional subgroup owner. */
export function getEditorCriterionLocations(
  progress: TechnicalConfigurationBaselineEditorProgress
): HierarchyEditorCriterionLocation[] {
  return progress.editorDraft.groups.flatMap((group) => [
    ...group.criteria.map((criterion) => ({ criterion, group, subgroup: null })),
    ...group.subgroups.flatMap((subgroup) =>
      subgroup.criteria.map((criterion) => ({ criterion, group, subgroup }))
    ),
  ])
}

/** Maps each persisted criterion to its current group and optional subgroup owner. */
export function getWireCriterionLocations(
  progress: TechnicalConfigurationBaselineEditorProgress
): WireCriterionLocation[] {
  return progress.baseDraft.groups.flatMap((group) => [
    ...group.criteria.map((criterion) => ({ criterion, group, subgroup: null })),
    ...(group.subgroups ?? []).flatMap((subgroup) =>
      subgroup.criteria.map((criterion) => ({ criterion, group, subgroup }))
    ),
  ])
}

/** Finds a persisted group by ID in the mutable save snapshot. */
export function findWireGroup(
  progress: TechnicalConfigurationBaselineEditorProgress,
  groupId: string
): TechnicalConfigurationBaselineGroupWire {
  const group = progress.baseDraft.groups.find((item) => item.id === groupId)
  if (!group) throw new Error(`Missing baseline group ${groupId}`)
  return group
}

/** Finds a persisted subgroup by ID in the mutable save snapshot. */
export function findWireSubgroup(
  progress: TechnicalConfigurationBaselineEditorProgress,
  subgroupId: string
): TechnicalConfigurationBaselineSubgroupWire {
  for (const group of progress.baseDraft.groups) {
    const subgroup = (group.subgroups ?? []).find((item) => item.id === subgroupId)
    if (subgroup) return subgroup
  }
  throw new Error(`Missing baseline subgroup ${subgroupId}`)
}

/** Finds a persisted criterion and its owner location by criterion ID. */
export function findWireCriterionLocation(
  progress: TechnicalConfigurationBaselineEditorProgress,
  criterionId: string
): WireCriterionLocation {
  const location = getWireCriterionLocations(progress).find(
    ({ criterion }) => criterion.id === criterionId
  )
  if (!location) throw new Error(`Missing baseline criterion ${criterionId}`)
  return location
}

/** Replaces one subgroup in the mutable save snapshot. */
export function replaceWireSubgroup(
  progress: TechnicalConfigurationBaselineEditorProgress,
  response: Omit<TechnicalConfigurationBaselineSubgroupWire, "criteria"> & { revision: number }
): void {
  for (const group of progress.baseDraft.groups) {
    group.subgroups = (group.subgroups ?? []).map((subgroup) =>
      subgroup.id === response.id
        ? { ...toWireSubgroup(response), criteria: subgroup.criteria }
        : subgroup
    )
  }
}

/** Replaces one criterion while preserving its current owner location. */
export function replaceWireCriterion(
  progress: TechnicalConfigurationBaselineEditorProgress,
  response: TechnicalConfigurationBaselineCriterionMutationWire
): void {
  const criterion = toTechnicalConfigurationBaselineWireCriterion(response)
  for (const group of progress.baseDraft.groups) {
    group.criteria = group.criteria.map((item) => (item.id === criterion.id ? criterion : item))
    for (const subgroup of group.subgroups ?? []) {
      subgroup.criteria = subgroup.criteria.map((item) =>
        item.id === criterion.id ? criterion : item
      )
    }
  }
}

/** Removes a criterion from its current owner and returns the updated snapshot. */
export function removeWireCriterion(
  progress: TechnicalConfigurationBaselineEditorProgress,
  criterionId: string
): void {
  for (const group of progress.baseDraft.groups) {
    group.criteria = group.criteria.filter((criterion) => criterion.id !== criterionId)
    for (const subgroup of group.subgroups ?? []) {
      subgroup.criteria = subgroup.criteria.filter((criterion) => criterion.id !== criterionId)
    }
  }
}

/** Appends a criterion to a direct group or subgroup owner. */
export function appendWireCriterion(
  progress: TechnicalConfigurationBaselineEditorProgress,
  criterion: TechnicalConfigurationBaselineCriterionWire
): void {
  const group = findWireGroup(progress, criterion.group_id)
  if (criterion.subgroup_id) {
    const subgroup = (group.subgroups ?? []).find((item) => item.id === criterion.subgroup_id)
    if (!subgroup) throw new Error(`Missing baseline subgroup ${criterion.subgroup_id}`)
    subgroup.criteria.push(criterion)
    return
  }
  group.criteria.push(criterion)
}

/** Applies a criterion mutation response and advances the chained revision. */
export function applyCriterionResponse(
  criterion: HierarchyEditorCriterion,
  response: TechnicalConfigurationBaselineCriterionMutationWire
): void {
  criterion.id = response.id
  criterion.criterionCode = response.criterion_code
  criterion.title = response.title ?? ""
  criterion.requirementText = response.requirement_text
}

/** Reports whether two criterion owner locations identify the same container. */
export function sameCriterionOwner(
  wire: WireCriterionLocation,
  editor: HierarchyEditorCriterionLocation
): boolean {
  return (
    wire.group.id === editor.group.id &&
    (wire.subgroup?.id ?? null) === (editor.subgroup?.id ?? null)
  )
}

/** Converts an editor subgroup into the persisted hierarchy wire shape. */
export function toWireSubgroup(
  response: Omit<TechnicalConfigurationBaselineSubgroupWire, "criteria"> & { revision: number }
): TechnicalConfigurationBaselineSubgroupWire {
  const { revision: _revision, ...subgroup } = response
  return { ...subgroup, criteria: [] }
}

/** Replaces the save runner snapshot with a server-returned hierarchy snapshot. */
export function adoptSnapshot(
  progress: TechnicalConfigurationBaselineEditorProgress,
  snapshot: TechnicalConfigurationBaselineEditorProgress["baseDraft"]
): void {
  progress.baseDraft = cloneTechnicalConfigurationBaselineDraft(snapshot)
  updateRevision(progress, snapshot.revision)
}

/** Narrows nullable persisted IDs to strings. */
export function isString(value: string | null): value is string {
  return value !== null
}

/** Collects non-null persisted IDs while preserving item order. */
export function getPersistedIds(items: readonly { id: string | null }[]): string[] {
  const ids: string[] = []
  for (const { id } of items) {
    if (isString(id)) ids.push(id)
  }
  return ids
}
