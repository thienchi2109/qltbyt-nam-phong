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
  readonly getSession: (ownerKey: string) => TechnicalConfigurationBulkEntrySession
  readonly setInput: (ownerKey: string, input: string) => void
  readonly setPreview: (
    ownerKey: string,
    preview: TechnicalConfigurationBulkEntryPreview | null
  ) => void
  readonly clearSession: (ownerKey: string) => void
  readonly syncOwnerKeys: (ownerKeys: readonly string[]) => void
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

/** Manages transient bulk-entry buffers and accepted-row highlights per criterion owner. */
export function useTechnicalConfigurationBulkEntrySessions(): TechnicalConfigurationBulkEntrySessionsApi {
  const [sessionsByOwner, setSessionsByOwner] = React.useState<
    Record<string, TechnicalConfigurationBulkEntrySession>
  >({})
  const [recentlyAcceptedCriterionKeys, setRecentlyAcceptedCriterionKeys] = React.useState<
    ReadonlySet<string>
  >(() => new Set())

  const getSession = React.useCallback(
    (ownerKey: string) => sessionsByOwner[ownerKey] ?? EMPTY_SESSION,
    [sessionsByOwner]
  )

  const setInput = React.useCallback((ownerKey: string, input: string) => {
    setSessionsByOwner((current) => ({
      ...current,
      [ownerKey]: { input, preview: null },
    }))
  }, [])

  const setPreview = React.useCallback(
    (ownerKey: string, preview: TechnicalConfigurationBulkEntryPreview | null) => {
      setSessionsByOwner((current) => ({
        ...current,
        [ownerKey]: {
          input: current[ownerKey]?.input ?? "",
          preview,
        },
      }))
    },
    []
  )

  const clearSession = React.useCallback((ownerKey: string) => {
    setSessionsByOwner((current) => {
      if (!(ownerKey in current)) return current
      const next = { ...current }
      delete next[ownerKey]
      return next
    })
  }, [])

  const syncOwnerKeys = React.useCallback((ownerKeys: readonly string[]) => {
    const allowedKeys = new Set(ownerKeys)
    setSessionsByOwner((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([ownerKey]) => allowedKeys.has(ownerKey))
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
    setSessionsByOwner({})
    setRecentlyAcceptedCriterionKeys(new Set())
  }, [])

  const hasPendingInput = React.useMemo(
    () =>
      Object.values(sessionsByOwner).some((session) =>
        hasTechnicalConfigurationBulkEntryInput(session.input)
      ),
    [sessionsByOwner]
  )

  return {
    getSession,
    setInput,
    setPreview,
    clearSession,
    syncOwnerKeys,
    setRecentlyAccepted,
    clearRecentHighlights,
    clearAll,
    hasPendingInput,
    recentlyAcceptedCriterionKeys,
  }
}
