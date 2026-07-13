import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
  TechnicalConfigurationBaselineGroupWire,
} from "./baseline-types"
import type {
  TechnicalConfigurationBaselineEditorProgress,
  TechnicalConfigurationBaselineEditorRpc,
} from "./technical-configuration-baseline-save"

type RunStep = <T>(request: () => Promise<T>, apply: (response: T) => void) => Promise<void>

/** Runs ordered P2 mutations while applying each successful revision to resumable progress. */
export async function runTechnicalConfigurationBaselineSaveSteps(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  await deleteRemovedGroups(progress, rpc, run)
  await deleteRemovedCriteria(progress, rpc, run)
  await createNewGroups(progress, rpc, run)
  await updateExistingGroups(progress, rpc, run)
  await createAndUpdateCriteria(progress, rpc, run)
  await reorderGroups(progress, rpc, run)
  await reorderCriteria(progress, rpc, run)
}

async function deleteRemovedGroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  for (const group of [...progress.baseDraft.groups]) {
    if (progress.editorDraft.groups.some((item) => item.id === group.id)) continue

    await run(
      () =>
        rpc.deleteGroup({
          p_group_id: group.id,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => {
        progress.baseDraft.groups = progress.baseDraft.groups
          .filter((item) => item.id !== group.id)
          .map((item, index) => ({ ...item, sort_order: index + 1 }))
        updateRevision(progress, response.data.revision)
      }
    )
  }
}

async function deleteRemovedCriteria(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  for (const group of [...progress.baseDraft.groups]) {
    const editorGroup = progress.editorDraft.groups.find((item) => item.id === group.id)
    if (!editorGroup) continue

    for (const criterion of [...group.criteria]) {
      if (editorGroup.criteria.some((item) => item.id === criterion.id)) continue

      await run(
        () =>
          rpc.deleteCriterion({
            p_criterion_id: criterion.id,
            p_expected_revision: progress.baseDraft.revision,
          }),
        (response) => {
          const currentGroup = findWireGroup(progress.baseDraft, group.id)
          currentGroup.criteria = currentGroup.criteria
            .filter((item) => item.id !== criterion.id)
            .map((item, index) => ({ ...item, sort_order: index + 1 }))
          updateRevision(progress, response.data.revision)
        }
      )
    }
  }
}

async function createNewGroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    if (group.id) continue

    await run(
      () =>
        rpc.createGroup({
          p_baseline_version_id: progress.baseDraft.id,
          p_name: group.name,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => {
        group.id = response.data.id
        group.name = response.data.name
        progress.baseDraft.groups.push(toWireGroup(response.data))
        updateRevision(progress, response.data.revision)
      }
    )
  }
}

async function updateExistingGroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    if (!group.id) continue
    const wireGroup = findWireGroup(progress.baseDraft, group.id)
    if (wireGroup.name === group.name) continue

    await run(
      () =>
        rpc.updateGroup({
          p_group_id: group.id as string,
          p_name: group.name,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => {
        replaceWireGroup(progress.baseDraft, response.data)
        group.name = response.data.name
        updateRevision(progress, response.data.revision)
      }
    )
  }
}

async function createAndUpdateCriteria(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    if (!group.id) continue

    for (const criterion of group.criteria) {
      if (criterion.id) continue

      await run(
        () =>
          rpc.createCriterion({
            p_group_id: group.id as string,
            p_title: criterion.title.trim() || null,
            p_requirement_text: criterion.requirementText,
            p_expected_revision: progress.baseDraft.revision,
          }),
        (response) => {
          criterion.id = response.data.id
          criterion.criterionCode = response.data.criterion_code
          criterion.title = response.data.title ?? ""
          criterion.requirementText = response.data.requirement_text
          findWireGroup(progress.baseDraft, group.id as string).criteria.push(
            toWireCriterion(response.data)
          )
          updateNextCriterionNumber(progress.baseDraft, response.data.criterion_code)
          updateRevision(progress, response.data.revision)
        }
      )
    }

    for (const criterion of group.criteria) {
      if (!criterion.id) continue
      const wireCriterion = findWireCriterion(progress.baseDraft, criterion.id)
      if (
        (wireCriterion.title ?? "") === criterion.title &&
        wireCriterion.requirement_text === criterion.requirementText
      ) {
        continue
      }

      await run(
        () =>
          rpc.updateCriterion({
            p_criterion_id: criterion.id as string,
            p_title: criterion.title.trim() || null,
            p_requirement_text: criterion.requirementText,
            p_expected_revision: progress.baseDraft.revision,
          }),
        (response) => {
          replaceWireCriterion(progress.baseDraft, response.data)
          criterion.title = response.data.title ?? ""
          criterion.requirementText = response.data.requirement_text
          updateRevision(progress, response.data.revision)
        }
      )
    }
  }
}

async function reorderGroups(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  const editorGroupIds = progress.editorDraft.groups.map((group) => group.id as string)
  if (
    sameOrder(
      progress.baseDraft.groups.map((group) => group.id),
      editorGroupIds
    )
  )
    return

  await run(
    () =>
      rpc.reorderGroups({
        p_baseline_version_id: progress.baseDraft.id,
        p_group_ids: editorGroupIds,
        p_expected_revision: progress.baseDraft.revision,
      }),
    (response) => {
      progress.baseDraft = cloneWireDraft(response.data)
      updateRevision(progress, response.data.revision)
    }
  )
}

async function reorderCriteria(
  progress: TechnicalConfigurationBaselineEditorProgress,
  rpc: TechnicalConfigurationBaselineEditorRpc,
  run: RunStep
): Promise<void> {
  for (const group of progress.editorDraft.groups) {
    const groupId = group.id as string
    const editorCriterionIds = group.criteria.map((criterion) => criterion.id as string)
    const wireCriterionIds = findWireGroup(progress.baseDraft, groupId).criteria.map(
      (criterion) => criterion.id
    )
    if (sameOrder(wireCriterionIds, editorCriterionIds)) continue

    await run(
      () =>
        rpc.reorderCriteria({
          p_group_id: groupId,
          p_criterion_ids: editorCriterionIds,
          p_expected_revision: progress.baseDraft.revision,
        }),
      (response) => {
        progress.baseDraft = cloneWireDraft(response.data)
        updateRevision(progress, response.data.revision)
      }
    )
  }
}

function cloneWireDraft(
  draft: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationBaselineDraftWire {
  return {
    ...draft,
    groups: draft.groups.map((group) => ({
      ...group,
      criteria: group.criteria.map((criterion) => ({ ...criterion })),
    })),
  }
}

function updateRevision(
  progress: TechnicalConfigurationBaselineEditorProgress,
  revision: number
): void {
  progress.baseDraft.revision = revision
  progress.editorDraft.revision = revision
}

function toWireGroup(
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

function toWireCriterion(
  criterion: TechnicalConfigurationBaselineCriterionMutationWire
): TechnicalConfigurationBaselineCriterionWire {
  const { revision: _revision, ...wireCriterion } = criterion
  void _revision
  return wireCriterion
}

function findWireGroup(
  draft: TechnicalConfigurationBaselineDraftWire,
  groupId: string
): TechnicalConfigurationBaselineGroupWire {
  const group = draft.groups.find((item) => item.id === groupId)
  if (!group) throw new Error(`Missing baseline group ${groupId}`)
  return group
}

function findWireCriterion(
  draft: TechnicalConfigurationBaselineDraftWire,
  criterionId: string
): TechnicalConfigurationBaselineCriterionWire {
  for (const group of draft.groups) {
    const criterion = group.criteria.find((item) => item.id === criterionId)
    if (criterion) return criterion
  }
  throw new Error(`Missing baseline criterion ${criterionId}`)
}

function replaceWireGroup(
  draft: TechnicalConfigurationBaselineDraftWire,
  group: TechnicalConfigurationBaselineGroupMutationWire
): void {
  draft.groups = draft.groups.map((item) =>
    item.id === group.id ? { ...toWireGroup(group), criteria: item.criteria } : item
  )
}

function replaceWireCriterion(
  draft: TechnicalConfigurationBaselineDraftWire,
  criterion: TechnicalConfigurationBaselineCriterionMutationWire
): void {
  for (const group of draft.groups) {
    group.criteria = group.criteria.map((item) =>
      item.id === criterion.id ? toWireCriterion(criterion) : item
    )
  }
}

function updateNextCriterionNumber(
  draft: TechnicalConfigurationBaselineDraftWire,
  criterionCode: string
): void {
  const sequence = Number.parseInt(criterionCode.replace(/^TC-/, ""), 10)
  if (Number.isFinite(sequence)) {
    draft.next_criterion_number = Math.max(draft.next_criterion_number, sequence + 1)
  }
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}
