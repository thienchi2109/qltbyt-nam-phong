/**
 * Main wrapper for the change history tab.
 * Selects between loading, empty, and populated states.
 * UI-only — consumers provide entries and loading state.
 * @module components/change-history/ChangeHistoryTab
 */

import React from "react"

import type { ChangeHistoryEntry } from "./ChangeHistoryTypes"
import { ChangeHistoryLoadingState } from "./ChangeHistoryLoadingState"
import { ChangeHistoryEmptyState } from "./ChangeHistoryEmptyState"
import { ChangeHistoryTimeline } from "./ChangeHistoryTimeline"

interface ChangeHistoryTabProps {
  entries: ChangeHistoryEntry[]
  isLoading: boolean
}

export function ChangeHistoryTab({ entries, isLoading }: ChangeHistoryTabProps) {
  if (isLoading) {
    return <ChangeHistoryLoadingState />
  }

  if (entries.length === 0) {
    return <ChangeHistoryEmptyState />
  }

  return <ChangeHistoryTimeline entries={entries} />
}
