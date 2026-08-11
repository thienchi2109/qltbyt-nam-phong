import type {
  TechnicalConfigurationBaselineCriteriaReorderRpcArgs,
  TechnicalConfigurationBaselineCriterionCreateRpcArgs,
  TechnicalConfigurationBaselineCriterionDeleteRpcArgs,
  TechnicalConfigurationBaselineCriterionUpdateRpcArgs,
  TechnicalConfigurationBaselineCriterionWireResponse,
  TechnicalConfigurationBaselineDeleteWireResponse,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineDraftWireResponse,
  TechnicalConfigurationBaselineGroupCreateRpcArgs,
  TechnicalConfigurationBaselineGroupDeleteRpcArgs,
  TechnicalConfigurationBaselineGroupsReorderRpcArgs,
  TechnicalConfigurationBaselineGroupUpdateRpcArgs,
  TechnicalConfigurationBaselineGroupWireResponse,
} from "./baseline-types"
import {
  cloneTechnicalConfigurationBaselineDraft,
  cloneTechnicalConfigurationBaselineEditorDraft,
  validateTechnicalConfigurationBaselineEditorDraft,
} from "./technical-configuration-baseline-editor-state"
import type {
  TechnicalConfigurationBaselineHierarchyCriteriaReorderRpcArgs,
  TechnicalConfigurationBaselineHierarchyCriterionCreateRpcArgs,
  TechnicalConfigurationBaselineHierarchyCriterionMoveRpcArgs,
  TechnicalConfigurationBaselineHierarchyCriterionWireResponse,
  TechnicalConfigurationBaselineHierarchyDeleteWireResponse,
  TechnicalConfigurationBaselineHierarchyReorderWireResponse,
  TechnicalConfigurationBaselineSubgroupCreateRpcArgs,
  TechnicalConfigurationBaselineSubgroupDeleteRpcArgs,
  TechnicalConfigurationBaselineSubgroupsReorderRpcArgs,
  TechnicalConfigurationBaselineSubgroupUpdateRpcArgs,
  TechnicalConfigurationBaselineSubgroupWireResponse,
} from "./technical-configuration-baseline-hierarchy-mutation-types"
import { runTechnicalConfigurationBaselineHierarchySaveSteps } from "./technical-configuration-baseline-hierarchy-save-steps"
import {
  getEditorCriterionLocations,
  getWireCriterionLocations,
  sameCriterionOwner,
} from "./technical-configuration-baseline-hierarchy-save-support"
import { runTechnicalConfigurationBaselineSaveSteps } from "./technical-configuration-baseline-save-steps"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "./technical-configuration-baseline-editor-state"
import { isTechnicalConfigurationBaselineConflict } from "./technical-configuration-baseline-version-state"

export interface TechnicalConfigurationBaselineEditorProgress {
  baseDraft: TechnicalConfigurationBaselineDraftWire
  editorDraft: TechnicalConfigurationBaselineEditorDraft
}

export interface TechnicalConfigurationBaselineEditorRpc {
  createGroup(
    args: TechnicalConfigurationBaselineGroupCreateRpcArgs
  ): Promise<TechnicalConfigurationBaselineGroupWireResponse>
  updateGroup(
    args: TechnicalConfigurationBaselineGroupUpdateRpcArgs
  ): Promise<TechnicalConfigurationBaselineGroupWireResponse>
  deleteGroup(
    args: TechnicalConfigurationBaselineGroupDeleteRpcArgs
  ): Promise<TechnicalConfigurationBaselineDeleteWireResponse>
  reorderGroups(
    args: TechnicalConfigurationBaselineGroupsReorderRpcArgs
  ): Promise<TechnicalConfigurationBaselineDraftWireResponse>
  createCriterion(
    args: TechnicalConfigurationBaselineCriterionCreateRpcArgs
  ): Promise<TechnicalConfigurationBaselineCriterionWireResponse>
  updateCriterion(
    args: TechnicalConfigurationBaselineCriterionUpdateRpcArgs
  ): Promise<TechnicalConfigurationBaselineCriterionWireResponse>
  deleteCriterion(
    args: TechnicalConfigurationBaselineCriterionDeleteRpcArgs
  ): Promise<TechnicalConfigurationBaselineDeleteWireResponse>
  reorderCriteria(
    args: TechnicalConfigurationBaselineCriteriaReorderRpcArgs
  ): Promise<TechnicalConfigurationBaselineDraftWireResponse>
  createSubgroup(
    args: TechnicalConfigurationBaselineSubgroupCreateRpcArgs
  ): Promise<TechnicalConfigurationBaselineSubgroupWireResponse>
  updateSubgroup(
    args: TechnicalConfigurationBaselineSubgroupUpdateRpcArgs
  ): Promise<TechnicalConfigurationBaselineSubgroupWireResponse>
  deleteSubgroup(
    args: TechnicalConfigurationBaselineSubgroupDeleteRpcArgs
  ): Promise<TechnicalConfigurationBaselineHierarchyDeleteWireResponse>
  reorderSubgroups(
    args: TechnicalConfigurationBaselineSubgroupsReorderRpcArgs
  ): Promise<TechnicalConfigurationBaselineHierarchyReorderWireResponse>
  createHierarchyCriterion(
    args: TechnicalConfigurationBaselineHierarchyCriterionCreateRpcArgs
  ): Promise<TechnicalConfigurationBaselineHierarchyCriterionWireResponse>
  moveHierarchyCriterion(
    args: TechnicalConfigurationBaselineHierarchyCriterionMoveRpcArgs
  ): Promise<TechnicalConfigurationBaselineHierarchyCriterionWireResponse>
  reorderHierarchyCriteria(
    args: TechnicalConfigurationBaselineHierarchyCriteriaReorderRpcArgs
  ): Promise<TechnicalConfigurationBaselineHierarchyReorderWireResponse>
}

/** Carries resumable local and server progress after a multi-RPC explicit save fails. */
export class BaselineEditorSaveFailure extends Error {
  readonly isConflict: boolean
  readonly progress: TechnicalConfigurationBaselineEditorProgress
  readonly originalError: unknown

  constructor(error: unknown, progress: TechnicalConfigurationBaselineEditorProgress) {
    super(error instanceof Error && error.message ? error.message : "baseline_save_failed")
    this.name = "BaselineEditorSaveFailure"
    this.isConflict = isTechnicalConfigurationBaselineConflict(error)
    this.progress = cloneProgress(progress)
    this.originalError = error
  }
}

/** Carries field-level validation errors detected before any persistence call. */
export class BaselineEditorValidationFailure extends Error {
  readonly validation: TechnicalConfigurationBaselineEditorValidation

  constructor(validation: TechnicalConfigurationBaselineEditorValidation) {
    super("baseline_validation_failed")
    this.name = "BaselineEditorValidationFailure"
    this.validation = validation
  }
}

/** Persists one staged editor draft through the frozen P2 revision contract. */
export async function saveTechnicalConfigurationBaselineEditorDraft({
  baseDraft,
  editorDraft,
  rpc,
}: {
  baseDraft: TechnicalConfigurationBaselineDraftWire
  editorDraft: TechnicalConfigurationBaselineEditorDraft
  rpc: TechnicalConfigurationBaselineEditorRpc
}): Promise<TechnicalConfigurationBaselineEditorProgress> {
  const validation = validateTechnicalConfigurationBaselineEditorDraft(editorDraft)
  if (
    Object.keys(validation.groupErrors).length ||
    Object.keys(validation.subgroupErrors ?? {}).length ||
    Object.keys(validation.criterionErrors).length
  ) {
    throw new BaselineEditorValidationFailure(validation)
  }

  const progress = cloneProgress({ baseDraft, editorDraft })
  const run = async <T>(request: () => Promise<T>, apply: (response: T) => void) => {
    try {
      apply(await request())
    } catch (error) {
      throw new BaselineEditorSaveFailure(error, progress)
    }
  }

  const hasHierarchy =
    progress.baseDraft.groups.some((group) => (group.subgroups?.length ?? 0) > 0) ||
    progress.editorDraft.groups.some((group) => group.subgroups.length > 0) ||
    hasCriterionOwnerChanges(progress)

  if (hasHierarchy) {
    await runTechnicalConfigurationBaselineHierarchySaveSteps(progress, rpc, run)
  } else {
    await runTechnicalConfigurationBaselineSaveSteps(progress, rpc, run)
  }

  progress.editorDraft.revision = progress.baseDraft.revision
  return cloneProgress(progress)
}

function hasCriterionOwnerChanges(progress: TechnicalConfigurationBaselineEditorProgress): boolean {
  const wireLocations = new Map(
    getWireCriterionLocations(progress).map((location) => [location.criterion.id, location])
  )

  return getEditorCriterionLocations(progress).some((editorLocation) => {
    if (!editorLocation.criterion.id) return false
    const wireLocation = wireLocations.get(editorLocation.criterion.id)
    return wireLocation ? !sameCriterionOwner(wireLocation, editorLocation) : false
  })
}

function cloneProgress(
  progress: TechnicalConfigurationBaselineEditorProgress
): TechnicalConfigurationBaselineEditorProgress {
  return {
    baseDraft: cloneTechnicalConfigurationBaselineDraft(progress.baseDraft),
    editorDraft: cloneTechnicalConfigurationBaselineEditorDraft(progress.editorDraft),
  }
}
