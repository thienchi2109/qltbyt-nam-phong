/**
 * Loading state for the change history tab.
 * Shows skeleton placeholders while data is being fetched.
 * @module components/change-history/ChangeHistoryLoadingState
 */

import React from "react"

import { Skeleton } from "@/components/ui/skeleton"

const SKELETON_COUNT = 3

export function ChangeHistoryLoadingState() {
  return (
    <div className="flex flex-col gap-4 py-4 pr-4">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} data-testid="change-history-skeleton" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}
