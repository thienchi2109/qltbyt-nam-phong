import {
  findTechnicalConfigurationBaselineCriterionOwnerByKey,
  getTechnicalConfigurationBaselineCriterionOwnerKey,
  type TechnicalConfigurationBaselineHierarchyAuthoring,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyAuthoring"
import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { UseTechnicalConfigurationHierarchyAuthoringOptions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationHierarchyAuthoringTypes"
import {
  appendTechnicalConfigurationBaselineEditorCriteriaToOwner,
  appendTechnicalConfigurationBaselineEditorCriterionToOwner,
  appendTechnicalConfigurationBaselineEditorSubgroup,
  getTechnicalConfigurationBaselineEditorOwnerCriteria,
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorGroupToIndex,
  moveTechnicalConfigurationBaselineEditorSubgroup,
  moveTechnicalConfigurationBaselineEditorSubgroupToIndex,
  removeTechnicalConfigurationBaselineEditorCriterionFromOwner,
  removeTechnicalConfigurationBaselineEditorSubgroup,
  setTechnicalConfigurationBaselineEditorCriterionTextInOwner,
  setTechnicalConfigurationBaselineEditorSubgroupName,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorCriterionOwner,
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { parseTechnicalConfigurationBulkEntry } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import type { TechnicalConfigurationBaselineDndCommand } from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"

/** Owns subgroup CRUD, criterion ownership, and subgroup-scoped entry transitions. */
export function useTechnicalConfigurationHierarchyAuthoring({
  draft,
  validation,
  activeValue,
  entryMode,
  bulkSessions,
  updateDraft,
  transitionView,
  nextFocusToken,
}: UseTechnicalConfigurationHierarchyAuthoringOptions): TechnicalConfigurationBaselineHierarchyAuthoring {
  const onAddSubgroup = (groupKey: string) => {
    if (!draft) return
    const nextDraft = appendTechnicalConfigurationBaselineEditorSubgroup(draft, groupKey)
    const subgroup = nextDraft.groups.find((group) => group.key === groupKey)?.subgroups.at(-1)
    updateDraft(nextDraft)
    if (!subgroup) return
    transitionView({
      activeValue: subgroup.key,
      entryMode: "row",
      focusTarget: { kind: "subgroup-name", key: subgroup.key, token: nextFocusToken() },
    })
  }

  const onDeleteSubgroup = (groupKey: string, subgroupKey: string) => {
    if (!draft) return
    const group = draft.groups.find((item) => item.key === groupKey)
    const subgroupIndex = group?.subgroups.findIndex((item) => item.key === subgroupKey) ?? -1
    const nextDraft = removeTechnicalConfigurationBaselineEditorSubgroup(
      draft,
      groupKey,
      subgroupKey
    )
    const nextGroup = nextDraft.groups.find((item) => item.key === groupKey)
    const nextSubgroup =
      nextGroup?.subgroups[Math.min(subgroupIndex, nextGroup.subgroups.length - 1)]
    updateDraft(nextDraft)
    bulkSessions.clearSession(subgroupKey)
    transitionView({
      activeValue: nextSubgroup?.key ?? groupKey,
      entryMode: "row",
      focusTarget: nextSubgroup
        ? { kind: "subgroup-disclosure", key: nextSubgroup.key, token: nextFocusToken() }
        : { kind: "add-subgroup", key: groupKey, token: nextFocusToken() },
    })
  }

  const onAddCriterion = (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => {
    if (!draft) return
    const nextDraft = appendTechnicalConfigurationBaselineEditorCriterionToOwner(draft, owner)
    const criterion = getTechnicalConfigurationBaselineEditorOwnerCriteria(nextDraft, owner).at(-1)
    updateDraft(nextDraft)
    transitionView({
      activeValue: getTechnicalConfigurationBaselineCriterionOwnerKey(owner),
      entryMode: "row",
      focusTarget: criterion
        ? { kind: "criterion", key: criterion.key, token: nextFocusToken() }
        : null,
    })
  }

  const onDeleteCriterion = (
    owner: TechnicalConfigurationBaselineEditorCriterionOwner,
    criterionKey: string
  ) => {
    if (!draft) return
    const criteria = getTechnicalConfigurationBaselineEditorOwnerCriteria(draft, owner)
    const criterionIndex = criteria.findIndex((criterion) => criterion.key === criterionKey)
    const nextDraft = removeTechnicalConfigurationBaselineEditorCriterionFromOwner(
      draft,
      owner,
      criterionKey
    )
    const nextCriteria = getTechnicalConfigurationBaselineEditorOwnerCriteria(nextDraft, owner)
    const nextCriterion = nextCriteria[Math.min(criterionIndex, nextCriteria.length - 1)]
    updateDraft(nextDraft)
    bulkSessions.clearRecentHighlights()
    transitionView({
      activeValue: getTechnicalConfigurationBaselineCriterionOwnerKey(owner),
      entryMode: "row",
      focusTarget: nextCriterion
        ? { kind: "criterion", key: nextCriterion.key, token: nextFocusToken() }
        : owner.subgroupKey
          ? { kind: "add-subgroup-criterion", key: owner.subgroupKey, token: nextFocusToken() }
          : { kind: "add-criterion", key: owner.groupKey, token: nextFocusToken() },
    })
  }

  const onOwnerModeChange = (nextOwnerKey: string, mode: TechnicalConfigurationEntryMode) => {
    if (!draft) return
    const owner = findTechnicalConfigurationBaselineCriterionOwnerByKey(draft, nextOwnerKey)
    if (!owner) return
    if (nextOwnerKey !== activeValue || mode !== entryMode) bulkSessions.clearRecentHighlights()
    const criteria = getTechnicalConfigurationBaselineEditorOwnerCriteria(draft, owner)
    const targetCriterion =
      criteria.find((criterion) => validation.criterionErrors[criterion.key]) ?? criteria[0]
    let focusTarget: TechnicalConfigurationFocusTarget
    if (mode === "bulk") {
      focusTarget = {
        kind: owner.subgroupKey ? "subgroup-bulk-input" : "bulk-input",
        key: nextOwnerKey,
        token: nextFocusToken(),
      }
    } else if (targetCriterion) {
      focusTarget = { kind: "criterion", key: targetCriterion.key, token: nextFocusToken() }
    } else if (owner.subgroupKey) {
      focusTarget = {
        kind: "add-subgroup-criterion",
        key: nextOwnerKey,
        token: nextFocusToken(),
      }
    } else {
      focusTarget = { kind: "add-criterion", key: owner.groupKey, token: nextFocusToken() }
    }
    transitionView({
      activeValue: nextOwnerKey,
      entryMode: mode,
      focusTarget,
    })
  }

  const onBulkAccept = (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => {
    if (!draft) return
    const key = getTechnicalConfigurationBaselineCriterionOwnerKey(owner)
    const session = bulkSessions.getSession(key)
    if (!session.preview?.canAccept) return
    const previousKeys = new Set(
      getTechnicalConfigurationBaselineEditorOwnerCriteria(draft, owner).map(
        (criterion) => criterion.key
      )
    )
    const nextDraft = appendTechnicalConfigurationBaselineEditorCriteriaToOwner(
      draft,
      owner,
      session.preview.rows.map((row) => row.requirementText)
    )
    const acceptedCriteria = getTechnicalConfigurationBaselineEditorOwnerCriteria(
      nextDraft,
      owner
    ).filter((criterion) => !previousKeys.has(criterion.key))
    updateDraft(nextDraft)
    bulkSessions.setRecentlyAccepted(acceptedCriteria.map((criterion) => criterion.key))
    bulkSessions.clearSession(key)
    transitionView({
      activeValue: key,
      entryMode: "row",
      focusTarget: acceptedCriteria[0]
        ? { kind: "criterion", key: acceptedCriteria[0].key, token: nextFocusToken() }
        : {
            kind: owner.subgroupKey ? "subgroup-mode-action" : "group-mode-action",
            key,
            token: nextFocusToken(),
          },
    })
  }

  const onHierarchyCommand = (command: TechnicalConfigurationBaselineDndCommand) => {
    if (!draft) return

    if (command.type === "move-group") {
      updateDraft(
        moveTechnicalConfigurationBaselineEditorGroupToIndex(
          draft,
          command.groupKey,
          command.targetIndex
        )
      )
      transitionView({
        activeValue: command.groupKey,
        entryMode: "row",
        focusTarget: {
          kind: "group-disclosure",
          key: command.groupKey,
          token: nextFocusToken(),
        },
      })
      return
    }

    if (command.type === "move-subgroup") {
      updateDraft(
        moveTechnicalConfigurationBaselineEditorSubgroupToIndex(
          draft,
          command.groupKey,
          command.subgroupKey,
          command.targetIndex
        )
      )
      transitionView({
        activeValue: command.subgroupKey,
        entryMode: "row",
        focusTarget: {
          kind: "subgroup-disclosure",
          key: command.subgroupKey,
          token: nextFocusToken(),
        },
      })
      return
    }

    updateDraft(
      moveTechnicalConfigurationBaselineEditorCriterionToOwner(
        draft,
        command.sourceOwner,
        command.criterionKey,
        command.targetOwner,
        command.targetIndex
      )
    )
    transitionView({
      activeValue: getTechnicalConfigurationBaselineCriterionOwnerKey(command.targetOwner),
      entryMode: "row",
      focusTarget: {
        kind: "criterion",
        key: command.criterionKey,
        token: nextFocusToken(),
      },
    })
  }

  return {
    activeOwnerKey: activeValue,
    entryMode,
    getBulkSession: bulkSessions.getSession,
    onOwnerModeChange,
    onAddSubgroup,
    onSubgroupNameChange: (groupKey, subgroupKey, name) => {
      if (draft)
        updateDraft(
          setTechnicalConfigurationBaselineEditorSubgroupName(draft, groupKey, subgroupKey, name)
        )
    },
    onMoveSubgroup: (groupKey, subgroupIndex, offset) => {
      if (draft)
        updateDraft(
          moveTechnicalConfigurationBaselineEditorSubgroup(draft, groupKey, subgroupIndex, offset)
        )
    },
    onDeleteSubgroup,
    onCriterionTextChange: (owner, criterionKey, field, value) => {
      if (draft)
        updateDraft(
          setTechnicalConfigurationBaselineEditorCriterionTextInOwner(
            draft,
            owner,
            criterionKey,
            field,
            value
          )
        )
    },
    onMoveCriterionWithinOwner: (owner, criterionIndex, offset) => {
      if (!draft) return
      const criterion = getTechnicalConfigurationBaselineEditorOwnerCriteria(draft, owner)[
        criterionIndex
      ]
      if (!criterion) return
      onHierarchyCommand({
        type: "move-criterion",
        sourceOwner: owner,
        criterionKey: criterion.key,
        targetOwner: owner,
        targetIndex: criterionIndex + offset,
      })
    },
    onMoveCriterionToOwner: (sourceOwner, criterionKey, targetOwner) => {
      if (!draft) return
      onHierarchyCommand({
        type: "move-criterion",
        sourceOwner,
        criterionKey,
        targetOwner,
        targetIndex: getTechnicalConfigurationBaselineEditorOwnerCriteria(draft, targetOwner)
          .length,
      })
    },
    onHierarchyCommand,
    onDeleteCriterion,
    onAddCriterion,
    onBulkInputChange: bulkSessions.setInput,
    onBulkPreview: (key) => {
      const session = bulkSessions.getSession(key)
      bulkSessions.setPreview(key, parseTechnicalConfigurationBulkEntry(session.input))
    },
    onBulkCancel: (key) => {
      bulkSessions.clearSession(key)
      const owner = findTechnicalConfigurationBaselineCriterionOwnerByKey(draft, key)
      transitionView({
        activeValue: key,
        entryMode: "row",
        focusTarget: {
          kind: owner?.subgroupKey ? "subgroup-mode-action" : "group-mode-action",
          key,
          token: nextFocusToken(),
        },
      })
    },
    onBulkAccept,
  }
}
