"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { MaintenanceProvider } from "./_components/MaintenanceContext"
import { MaintenancePageClient } from "./_components/MaintenancePageClient"

export default function MaintenancePage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
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
      <React.Suspense fallback={<AuthenticatedPageSkeletonFallback />}>
        <MaintenancePageClient />
      </React.Suspense>
    </MaintenanceProvider>
  )
}
