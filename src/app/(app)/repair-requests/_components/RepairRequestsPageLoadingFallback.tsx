"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"

/** Renders the defensive loading fallback for the repair-requests feature client. */
export function RepairRequestsPageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  )
}
