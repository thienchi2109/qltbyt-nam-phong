import * as React from "react"

import {
  hasTechnicalConfigurationBulkEntryInput,
  type TechnicalConfigurationBulkEntryPreview,
} from "@/app/(app)/technical-configurations/bulk-entry-utils"

export interface TechnicalConfigurationBulkEntrySession {
  readonly input: string
  readonly preview: TechnicalConfigurationBulkEntryPreview | null
}

export interface TechnicalConfigurationBulkEntrySessionsApi {
  readonly getSession: (groupKey: string) => TechnicalConfigurationBulkEntrySession
  readonly setInput: (groupKey: string, input: string) => void
  readonly setPreview: (
    groupKey: string,
    preview: TechnicalConfigurationBulkEntryPreview | null
  ) => void
  readonly clearSession: (groupKey: string) => void
  readonly syncGroupKeys: (groupKeys: readonly string[]) => void
  readonly setRecentlyAccepted: (criterionKeys: readonly string[]) => void
  readonly clearRecentHighlights: () => void
  readonly clearAll: () => void
  readonly hasPendingInput: boolean
  readonly recentlyAcceptedCriterionKeys: ReadonlySet<string>
}

const EMPTY_SESSION: TechnicalConfigurationBulkEntrySession = Object.freeze({
  input: "",
  preview: null,
})

/** Manages transient bulk-entry buffers and accepted-row highlights per group. */
export function useTechnicalConfigurationBulkEntrySessions(): TechnicalConfigurationBulkEntrySessionsApi {
  const [sessionsByGroup, setSessionsByGroup] = React.useState<
    Record<string, TechnicalConfigurationBulkEntrySession>
  >({})
  const [recentlyAcceptedCriterionKeys, setRecentlyAcceptedCriterionKeys] = React.useState<
    ReadonlySet<string>
  >(() => new Set())

  const getSession = React.useCallback(
    (groupKey: string) => sessionsByGroup[groupKey] ?? EMPTY_SESSION,
    [sessionsByGroup]
  )

  const setInput = React.useCallback((groupKey: string, input: string) => {
    setSessionsByGroup((current) => ({
      ...current,
      [groupKey]: { input, preview: null },
    }))
  }, [])

  const setPreview = React.useCallback(
    (groupKey: string, preview: TechnicalConfigurationBulkEntryPreview | null) => {
      setSessionsByGroup((current) => ({
        ...current,
        [groupKey]: {
          input: current[groupKey]?.input ?? "",
          preview,
        },
      }))
    },
    []
  )

  const clearSession = React.useCallback((groupKey: string) => {
    setSessionsByGroup((current) => {
      if (!(groupKey in current)) return current
      const next = { ...current }
      delete next[groupKey]
      return next
    })
  }, [])

  const syncGroupKeys = React.useCallback((groupKeys: readonly string[]) => {
    const allowedKeys = new Set(groupKeys)
    setSessionsByGroup((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([groupKey]) => allowedKeys.has(groupKey))
      )
      return Object.keys(next).length === Object.keys(current).length ? current : next
    })
  }, [])

  const setRecentlyAccepted = React.useCallback((criterionKeys: readonly string[]) => {
    setRecentlyAcceptedCriterionKeys(new Set(criterionKeys))
  }, [])

  const clearRecentHighlights = React.useCallback(() => {
    setRecentlyAcceptedCriterionKeys((current) => (current.size === 0 ? current : new Set()))
  }, [])

  const clearAll = React.useCallback(() => {
    setSessionsByGroup({})
    setRecentlyAcceptedCriterionKeys(new Set())
  }, [])

  const hasPendingInput = React.useMemo(
    () =>
      Object.values(sessionsByGroup).some((session) =>
        hasTechnicalConfigurationBulkEntryInput(session.input)
      ),
    [sessionsByGroup]
  )

  return {
    getSession,
    setInput,
    setPreview,
    clearSession,
    syncGroupKeys,
    setRecentlyAccepted,
    clearRecentHighlights,
    clearAll,
    hasPendingInput,
    recentlyAcceptedCriterionKeys,
  }
}
