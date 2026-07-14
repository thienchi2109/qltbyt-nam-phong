import * as React from "react"

import {
  appendTechnicalConfigurationBaselineEditorCriteria,
  appendTechnicalConfigurationBaselineEditorCriterion,
  createTechnicalConfigurationBaselineEditorGroup,
  moveTechnicalConfigurationBaselineEditorCriterion,
  moveTechnicalConfigurationBaselineEditorItem,
  removeTechnicalConfigurationBaselineEditorCriterion,
  setTechnicalConfigurationBaselineEditorCriterionText,
  setTechnicalConfigurationBaselineEditorGroupName,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { parseTechnicalConfigurationBulkEntry } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import { ALL_GROUPS_VALUE } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigation"
import type { useTechnicalConfigurationBulkEntrySessions } from "./useTechnicalConfigurationBulkEntrySessions"

type BulkSessions = ReturnType<typeof useTechnicalConfigurationBulkEntrySessions>

type TechnicalConfigurationEditorViewState = {
  activeValue: string
  entryMode: TechnicalConfigurationEntryMode
  focusTarget: TechnicalConfigurationFocusTarget
}

type UseTechnicalConfigurationInlineEditorOptions = {
  draft: TechnicalConfigurationBaselineEditorDraft | null
  validation: TechnicalConfigurationBaselineEditorValidation
  saveStatus: "idle" | "saved"
  bulkSessions: BulkSessions
  onEditorChange: (draft: TechnicalConfigurationBaselineEditorDraft) => void
}

/** Owns local group, mode, focus, and inline bulk-entry transitions. */
export function useTechnicalConfigurationInlineEditor({
  draft,
  validation,
  saveStatus,
  bulkSessions,
  onEditorChange,
}: UseTechnicalConfigurationInlineEditorOptions) {
  const [viewState, setViewState] = React.useState<TechnicalConfigurationEditorViewState>({
    activeValue: "",
    entryMode: "row",
    focusTarget: null,
  })
  const previousGroupKeysRef = React.useRef<readonly string[]>([])
  const focusTokenRef = React.useRef(0)
  const { activeValue, entryMode, focusTarget } = viewState

  const nextFocusToken = () => {
    focusTokenRef.current += 1
    return focusTokenRef.current
  }

  React.useEffect(() => {
    const groupKeys = draft?.groups.map((group) => group.key) ?? []
    const previousGroupKeys = previousGroupKeysRef.current
    previousGroupKeysRef.current = groupKeys
    bulkSessions.syncGroupKeys(groupKeys)
    setViewState((current) => {
      if (current.activeValue === ALL_GROUPS_VALUE) return current
      if (groupKeys.includes(current.activeValue)) return current
      const previousIndex = previousGroupKeys.indexOf(current.activeValue)
      return {
        ...current,
        activeValue: groupKeys[previousIndex] ?? groupKeys[0] ?? "",
        focusTarget: current.activeValue ? null : current.focusTarget,
      }
    })
  }, [draft?.groups, bulkSessions.syncGroupKeys])

  React.useEffect(() => {
    if (saveStatus === "saved") bulkSessions.clearRecentHighlights()
  }, [saveStatus, bulkSessions.clearRecentHighlights])

  const updateDraft = React.useCallback(
    (nextDraft: TechnicalConfigurationBaselineEditorDraft) => {
      onEditorChange(nextDraft)
    },
    [onEditorChange]
  )

  const addGroup = () => {
    if (!draft) return
    const group = createTechnicalConfigurationBaselineEditorGroup()
    updateDraft({ ...draft, groups: [...draft.groups, group] })
    bulkSessions.clearRecentHighlights()
    setViewState({
      activeValue: group.key,
      entryMode: "row",
      focusTarget: { kind: "group-name", key: group.key, token: nextFocusToken() },
    })
  }

  const deleteGroup = (groupKey: string) => {
    if (!draft) return
    const groupIndex = draft.groups.findIndex((group) => group.key === groupKey)
    const groups = draft.groups.filter((group) => group.key !== groupKey)
    updateDraft({ ...draft, groups })
    bulkSessions.clearSession(groupKey)
    bulkSessions.clearRecentHighlights()
    const nextGroupKey = groups[Math.min(groupIndex, groups.length - 1)]?.key
    setViewState({
      activeValue: nextGroupKey ?? "",
      entryMode: "row",
      focusTarget: nextGroupKey
        ? { kind: "group-tab", key: nextGroupKey, token: nextFocusToken() }
        : { kind: "add-group", token: nextFocusToken() },
    })
  }

  const addCriterion = (groupKey: string) => {
    if (!draft) return
    const nextDraft = appendTechnicalConfigurationBaselineEditorCriterion(draft, groupKey)
    const criterion = nextDraft.groups.find((group) => group.key === groupKey)?.criteria.at(-1)
    updateDraft(nextDraft)
    const nextFocusTarget: TechnicalConfigurationFocusTarget = criterion
      ? { kind: "criterion", key: criterion.key, token: nextFocusToken() }
      : null
    setViewState((current) => ({ ...current, focusTarget: nextFocusTarget }))
  }

  const deleteCriterion = (groupKey: string, criterionKey: string) => {
    if (!draft) return
    const group = draft.groups.find((item) => item.key === groupKey)
    const criterionIndex = group?.criteria.findIndex((item) => item.key === criterionKey) ?? -1
    const nextDraft = removeTechnicalConfigurationBaselineEditorCriterion(
      draft,
      groupKey,
      criterionKey
    )
    const nextGroup = nextDraft.groups.find((item) => item.key === groupKey)
    const nextCriterion =
      nextGroup?.criteria[Math.min(criterionIndex, nextGroup.criteria.length - 1)]
    updateDraft(nextDraft)
    if (bulkSessions.recentlyAcceptedCriterionKeys.has(criterionKey)) {
      bulkSessions.setRecentlyAccepted(
        [...bulkSessions.recentlyAcceptedCriterionKeys].filter((key) => key !== criterionKey)
      )
    }
    const nextFocusTarget: TechnicalConfigurationFocusTarget = nextCriterion
      ? { kind: "criterion", key: nextCriterion.key, token: nextFocusToken() }
      : { kind: "add-criterion", token: nextFocusToken() }
    setViewState((current) => ({ ...current, focusTarget: nextFocusTarget }))
  }

  const navigate = (value: string) => {
    if (value !== activeValue) bulkSessions.clearRecentHighlights()
    setViewState((current) => ({ ...current, activeValue: value, focusTarget: null }))
  }

  const changeMode = (mode: TechnicalConfigurationEntryMode) => {
    if (mode !== entryMode) bulkSessions.clearRecentHighlights()
    const selectedGroup = draft?.groups.find((group) => group.key === activeValue)
    const targetCriterion =
      selectedGroup?.criteria.find((criterion) => validation.criterionErrors[criterion.key]) ??
      selectedGroup?.criteria[0]
    const nextFocusTarget: TechnicalConfigurationFocusTarget =
      mode === "row"
        ? targetCriterion
          ? { kind: "criterion", key: targetCriterion.key, token: nextFocusToken() }
          : { kind: "add-criterion", token: nextFocusToken() }
        : { kind: "bulk-input", token: nextFocusToken() }
    setViewState((current) => ({
      ...current,
      entryMode: mode,
      focusTarget: nextFocusTarget,
    }))
  }

  const acceptBulk = () => {
    if (!draft || activeValue === ALL_GROUPS_VALUE) return
    const session = bulkSessions.getSession(activeValue)
    if (!session.preview?.canAccept) return
    const currentGroup = draft.groups.find((group) => group.key === activeValue)
    if (!currentGroup) return
    const nextDraft = appendTechnicalConfigurationBaselineEditorCriteria(
      draft,
      activeValue,
      session.preview.rows.map((row) => row.requirementText)
    )
    const nextGroup = nextDraft.groups.find((group) => group.key === activeValue)
    const newKeys =
      nextGroup?.criteria.slice(currentGroup.criteria.length).map((criterion) => criterion.key) ??
      []
    updateDraft(nextDraft)
    bulkSessions.clearSession(activeValue)
    bulkSessions.setRecentlyAccepted(newKeys)
    const nextFocusTarget: TechnicalConfigurationFocusTarget = newKeys[0]
      ? { kind: "criterion", key: newKeys[0], token: nextFocusToken() }
      : null
    setViewState((current) => ({
      ...current,
      entryMode: "row",
      focusTarget: nextFocusTarget,
    }))
  }

  const cancelBulk = () => {
    if (activeValue !== ALL_GROUPS_VALUE) bulkSessions.clearSession(activeValue)
    const nextFocusTarget: TechnicalConfigurationFocusTarget = {
      kind: "mode-tab",
      mode: "bulk",
      token: nextFocusToken(),
    }
    setViewState((current) => ({
      ...current,
      entryMode: "row",
      focusTarget: nextFocusTarget,
    }))
  }

  return {
    activeValue,
    entryMode,
    focusTarget,
    bulkSession: bulkSessions.getSession(activeValue === ALL_GROUPS_VALUE ? "" : activeValue),
    addGroup,
    deleteGroup,
    addCriterion,
    deleteCriterion,
    navigate,
    changeMode,
    acceptBulk,
    cancelBulk,
    prepareForReload: (firstGroupKey: string) =>
      setViewState({
        activeValue: firstGroupKey,
        entryMode: "row",
        focusTarget: firstGroupKey
          ? { kind: "group-tab", key: firstGroupKey, token: nextFocusToken() }
          : { kind: "add-group", token: nextFocusToken() },
      }),
    setGroupName: (groupKey: string, name: string) => {
      if (draft)
        updateDraft(setTechnicalConfigurationBaselineEditorGroupName(draft, groupKey, name))
    },
    moveGroup: (groupIndex: number, offset: -1 | 1) => {
      if (!draft) return
      updateDraft({
        ...draft,
        groups: [...moveTechnicalConfigurationBaselineEditorItem(draft.groups, groupIndex, offset)],
      })
    },
    setCriterionText: (
      groupKey: string,
      criterionKey: string,
      field: "title" | "requirementText",
      value: string
    ) => {
      if (draft) {
        updateDraft(
          setTechnicalConfigurationBaselineEditorCriterionText(
            draft,
            groupKey,
            criterionKey,
            field,
            value
          )
        )
      }
    },
    moveCriterion: (groupKey: string, criterionIndex: number, offset: -1 | 1) => {
      if (draft) {
        updateDraft(
          moveTechnicalConfigurationBaselineEditorCriterion(draft, groupKey, criterionIndex, offset)
        )
      }
    },
    setBulkInput: (input: string) => {
      if (activeValue !== ALL_GROUPS_VALUE) bulkSessions.setInput(activeValue, input)
    },
    previewBulk: () => {
      if (activeValue === ALL_GROUPS_VALUE) return
      const session = bulkSessions.getSession(activeValue)
      bulkSessions.setPreview(activeValue, parseTechnicalConfigurationBulkEntry(session.input))
    },
    activateOverviewCriterion: (groupKey: string, criterionKey: string) => {
      bulkSessions.clearRecentHighlights()
      setViewState({
        activeValue: groupKey,
        entryMode: "row",
        focusTarget: {
          kind: "criterion",
          key: criterionKey,
          token: nextFocusToken(),
        },
      })
    },
  }
}
