/**
 * Loading state for the change history tab.
 * Shows skeleton placeholders while data is being fetched.
 * @module components/change-history/ChangeHistoryLoadingState
 */

import React from "react"

import { Skeleton } from "@/components/ui/skeleton"

const SKELETON_IDS = [
  "change-history-skeleton-1",
  "change-history-skeleton-2",
  "change-history-skeleton-3",
] as const

export function ChangeHistoryLoadingState() {
  return (
    <div className="flex flex-col gap-4 py-4 pr-4">
      {SKELETON_IDS.map((skeletonId) => (
        <div key={skeletonId} data-testid="change-history-skeleton" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}
