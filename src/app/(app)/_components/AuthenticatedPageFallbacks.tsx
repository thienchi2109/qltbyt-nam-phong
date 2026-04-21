"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

export function AuthenticatedPageSkeletonFallback() {
  return (
    <div
      className="flex items-center justify-center min-h-[50vh]"
      data-testid="authenticated-page-skeleton-fallback"
    >
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  )
}

export function AuthenticatedPageSpinnerFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      data-testid="authenticated-page-spinner-fallback"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
