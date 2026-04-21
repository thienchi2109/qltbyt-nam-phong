"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { MaintenanceProvider } from "./_components/MaintenanceContext"
import { MaintenancePageClient } from "./_components/MaintenancePageClient"

export default function MaintenancePage() {
  return (
    <AuthenticatedPageBoundary fallback={<MaintenancePageClientFallback />}>
      {() => <MaintenancePageWrapper />}
    </AuthenticatedPageBoundary>
  )
}

function MaintenancePageWrapper() {
  const [taskRowSelection, setTaskRowSelection] = React.useState<RowSelectionState>({})

  return (
    <MaintenanceProvider
      taskRowSelection={taskRowSelection}
      setTaskRowSelection={setTaskRowSelection}
    >
      <React.Suspense fallback={<MaintenancePageClientFallback />}>
        <MaintenancePageClient />
      </React.Suspense>
    </MaintenanceProvider>
  )
}

function MaintenancePageClientFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  )
}
