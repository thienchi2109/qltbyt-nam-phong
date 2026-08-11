/*
 * Revision-chained mutations must run sequentially because each RPC consumes
 * the revision returned by the previous mutation.
 */

import type {
  TechnicalConfigurationBaselineEditorProgress,
  TechnicalConfigurationBaselineEditorRpc,
} from "./technical-configuration-baseline-save"
import {
  createNewGroups,
  deleteRemovedGroups,
  reorderGroups,
  type TechnicalConfigurationBaselineRunSaveStep,
  updateExistingGroups,
} from "./technical-configuration-baseline-save-steps"
import { toTechnicalConfigurationBaselineWireCriterion } from "./technical-configuration-baseline-save-mappers"
import {
  adoptSnapshot,
  appendWireCriterion,
  applyCriterionResponse,
  findWireCriterionLocation,
  findWireGroup,
  findWireSubgroup,
  getEditorCriterionLocations,
  getPersistedIds,
  getWireCriterionLocations,
  removeWireCriterion,
  replaceWireCriterion,
  replaceWireSubgroup,
  sameCriterionOwner,
  toWireSubgroup,
  type HierarchyEditorCriterionLocation,
  type HierarchyEditorGroup,
  type HierarchyEditorSubgroup,
} from "./technical-configuration-baseline-hierarchy-save-support"
import {
  sameOrder,
  updateNextCriterionNumber,
  updateRevision,
} from "./technical-configuration-baseline-save-support"

/** Runs the dormant P1E hierarchy mutation sequence with resumable progress. */
export async function runTechnicalConfigurationBaselineHierarchySaveSteps(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  await createNewGroups(progress, rpc, run)
  await updateExistingGroups(progress, rpc, run)
  await createAndUpdateSubgroups(progress, rpc, run)
  await createUpdateAndMoveCriteria(progress, rpc, run)
  await deleteRemovedCriteria(progress, rpc, run)
  await deleteRemovedSubgroups(progress, rpc, run)
  await deleteRemovedGroups(progress, rpc, run)
  await reorderGroups(progress, rpc, run)
  await reorderSubgroups(progress, rpc, run)
  await reorderCriterionOwners(progress, rpc, run)
}

async function createAndUpdateSubgroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    if (!group.id) continue
    for (const subgroup of group.subgroups) {
      if (!subgroup.id) {
        await run(
          () =>
            rpc.createSubgroup({
              p_group_id: group.id as string,
              p_name: subgroup.name,
              p_expected_revision: progress.baseDraft.revision,
            }),
          (response) => {
            subgroup.id = response.data.id
            subgroup.name = response.data.name
            findWireGroup(progress, group.id as string).subgroups = [
              ...(findWireGroup(progress, group.id as string).subgroups ?? []),
              toWireSubgroup(response.data),
            ]
            updateRevision(progress, response.data.revision)
          }
        )
        continue
      }

      const wireSubgroup = findWireSubgroup(progress, subgroup.id)
      if (wireSubgroup.name === subgroup.name) continue
      await run(
        () =>
          rpc.updateSubgroup({
            p_subgroup_id: subgroup.id as string,
            p_name: subgroup.name,
            p_expected_revision: progress.baseDraft.revision,
          }),
        (response) => {
          replaceWireSubgroup(progress, response.data)
          subgroup.name = response.data.name
          updateRevision(progress, response.data.revision)
        }
      )
    }
  }
}

async function createUpdateAndMoveCriteria(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  for (const location of getEditorCriterionLocations(progress)) {
    const editorCriterion = location.criterion
    if (!editorCriterion.id) {
      await createCriterion(location, progress, rpc, run)
      continue
    }

    const wireLocation = findWireCriterionLocation(progress, editorCriterion.id)
    if (
      (wireLocation.criterion.title ?? "") !== editorCriterion.title ||
      wireLocation.criterion.requirement_text !== editorCriterion.requirementText
    ) {
      await run(
        () =>
          rpc.updateCriterion({
            p_criterion_id: editorCriterion.id as string,
            p_title: editorCriterion.title.trim() || null,
            p_requirement_text: editorCriterion.requirementText,
            p_expected_revision: progress.baseDraft.revision,
          }),
        (response) => {
          replaceWireCriterion(progress, response.data)
          applyCriterionResponse(editorCriterion, response.data)
          updateRevision(progress, response.data.revision)
        }
      )
    }

    const currentLocation = findWireCriterionLocation(progress, editorCriterion.id as string)
    if (sameCriterionOwner(currentLocation, location)) continue
    await run(
      () =>
        rpc.moveHierarchyCriterion({
          p_criterion_id: editorCriterion.id as string,
          p_target_group_id: location.group.id as string,
          p_target_subgroup_id: location.subgroup?.id ?? null,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => {
        removeWireCriterion(progress, response.data.id)
        appendWireCriterion(progress, toTechnicalConfigurationBaselineWireCriterion(response.data))
        applyCriterionResponse(editorCriterion, response.data)
        updateRevision(progress, response.data.revision)
      }
    )
  }
}

async function createCriterion(
  location: HierarchyEditorCriterionLocation,
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  await run(
    () =>
      rpc.createHierarchyCriterion({
        p_group_id: location.group.id as string,
        p_subgroup_id: location.subgroup?.id ?? null,
        p_title: location.criterion.title.trim() || null,
        p_requirement_text: location.criterion.requirementText,
        p_expected_revision: progress.baseDraft.revision,
      }),
    (response) => {
      applyCriterionResponse(location.criterion, response.data)
      appendWireCriterion(progress, toTechnicalConfigurationBaselineWireCriterion(response.data))
      updateNextCriterionNumber(progress, response.data.criterion_code)
      updateRevision(progress, response.data.revision)
    }
  )
}

async function deleteRemovedCriteria(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  const editorIds = new Set(
    getEditorCriterionLocations(progress)
      .map(({ criterion }) => criterion.id)
      .filter((id): id is string => id !== null)
  )
  for (const location of getWireCriterionLocations(progress)) {
    const criterionId = location.criterion.id
    if (editorIds.has(criterionId)) continue
    await run(
      () =>
        rpc.deleteCriterion({
          p_criterion_id: criterionId,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => {
        removeWireCriterion(progress, criterionId)
        updateRevision(progress, response.data.revision)
      }
    )
  }
}

async function deleteRemovedSubgroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  const editorIds = new Set(
    progress.editorDraft.groups.flatMap((group) =>
      group.subgroups.map((subgroup) => subgroup.id).filter((id): id is string => id !== null)
    )
  )
  for (const group of progress.baseDraft.groups) {
    for (const subgroup of [...(group.subgroups ?? [])]) {
      if (editorIds.has(subgroup.id)) continue
      await run(
        () =>
          rpc.deleteSubgroup({
            p_subgroup_id: subgroup.id,
            p_expected_revision: progress.baseDraft.revision,
          }),
        (response) => {
          group.subgroups = (group.subgroups ?? []).filter((item) => item.id !== subgroup.id)
          updateRevision(progress, response.data.revision)
        }
      )
    }
  }
}

async function reorderSubgroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    if (!group.id) continue
    const editorIds = getPersistedIds(group.subgroups)
    const wireIds = (findWireGroup(progress, group.id).subgroups ?? []).map(
      (subgroup) => subgroup.id
    )
    if (sameOrder(editorIds, wireIds)) continue
    await run(
      () =>
        rpc.reorderSubgroups({
          p_group_id: group.id as string,
          p_subgroup_ids: editorIds,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => adoptSnapshot(progress, response.data)
    )
  }
}

async function reorderCriterionOwners(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    if (!group.id) continue
    await reorderCriterionOwner(group, null, progress, rpc, run)
    for (const subgroup of group.subgroups) {
      if (subgroup.id) await reorderCriterionOwner(group, subgroup, progress, rpc, run)
    }
  }
}

async function reorderCriterionOwner(
  group: HierarchyEditorGroup,
  subgroup: HierarchyEditorSubgroup | null,
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: TechnicalConfigurationBaselineRunSaveStep
): Promise<void> {
  const editorCriteria = subgroup?.criteria ?? group.criteria
  const editorIds = getPersistedIds(editorCriteria)
  const wireGroup = findWireGroup(progress, group.id as string)
  const wireCriteria = subgroup
    ? ((wireGroup.subgroups ?? []).find((item) => item.id === subgroup.id)?.criteria ?? [])
    : wireGroup.criteria
  const wireIds = wireCriteria.map((criterion) => criterion.id)
  if (sameOrder(editorIds, wireIds)) return

  await run(
    () =>
      rpc.reorderHierarchyCriteria({
        p_group_id: group.id as string,
        p_subgroup_id: subgroup?.id ?? null,
        p_criterion_ids: editorIds,
        p_expected_revision: progress.baseDraft.revision,
      }),
    (response) => adoptSnapshot(progress, response.data)
  )
}
