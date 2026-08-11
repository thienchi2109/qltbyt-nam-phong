import {
  getTechnicalConfigurationBaselineCriterionOwnerKey,
  type TechnicalConfigurationBaselineHierarchyAuthoring,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyAuthoring"
import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBulkEntrySessionsApi } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import {
  appendTechnicalConfigurationBaselineEditorCriteriaToOwner,
  appendTechnicalConfigurationBaselineEditorCriterionToOwner,
  appendTechnicalConfigurationBaselineEditorSubgroup,
  getTechnicalConfigurationBaselineEditorOwnerCriteria,
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorCriterionWithinOwner,
  moveTechnicalConfigurationBaselineEditorSubgroup,
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

type ViewTransition = Readonly<{
  activeValue?: string
  entryMode?: TechnicalConfigurationEntryMode
  focusTarget?: TechnicalConfigurationFocusTarget
}>

type UseTechnicalConfigurationHierarchyAuthoringOptions = Readonly<{
  draft: TechnicalConfigurationBaselineEditorDraft | null
  validation: TechnicalConfigurationBaselineEditorValidation
  activeValue: string
  entryMode: TechnicalConfigurationEntryMode
  bulkSessions: TechnicalConfigurationBulkEntrySessionsApi
  updateDraft: (draft: TechnicalConfigurationBaselineEditorDraft) => void
  transitionView: (transition: ViewTransition) => void
  nextFocusToken: () => number
}>

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
    const owner = findOwner(draft, nextOwnerKey)
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
      if (draft)
        updateDraft(
          moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
            draft,
            owner,
            criterionIndex,
            offset
          )
        )
    },
    onMoveCriterionToOwner: (sourceOwner, criterionKey, targetOwner) => {
      if (!draft) return
      updateDraft(
        moveTechnicalConfigurationBaselineEditorCriterionToOwner(
          draft,
          sourceOwner,
          criterionKey,
          targetOwner
        )
      )
      transitionView({
        activeValue: getTechnicalConfigurationBaselineCriterionOwnerKey(targetOwner),
        entryMode: "row",
        focusTarget: { kind: "criterion", key: criterionKey, token: nextFocusToken() },
      })
    },
    onDeleteCriterion,
    onAddCriterion,
    onBulkInputChange: bulkSessions.setInput,
    onBulkPreview: (key) => {
      const session = bulkSessions.getSession(key)
      bulkSessions.setPreview(key, parseTechnicalConfigurationBulkEntry(session.input))
    },
    onBulkCancel: (key) => {
      bulkSessions.clearSession(key)
      const owner = findOwner(draft, key)
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

function findOwner(
  draft: TechnicalConfigurationBaselineEditorDraft | null,
  key: string
): TechnicalConfigurationBaselineEditorCriterionOwner | null {
  if (!draft) return null
  for (const group of draft.groups) {
    if (group.key === key) return { groupKey: group.key, subgroupKey: null }
    if (group.subgroups.some((subgroup) => subgroup.key === key)) {
      return { groupKey: group.key, subgroupKey: key }
    }
  }
  return null
}
