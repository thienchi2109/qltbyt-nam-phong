"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { useSession } from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton"
import { MaintenanceProvider } from "./_components/MaintenanceContext"
import { MaintenancePageClient } from "./_components/MaintenancePageClient"

export default function MaintenancePage() {
  const { status } = useSession()

  // Redirect if not authenticated
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Vui long dang nhap de xem trang nay.</p>
        </div>
      </div>
    )
  }

  return <MaintenancePageWrapper />
}

function MaintenancePageWrapper() {
  const [taskRowSelection, setTaskRowSelection] = React.useState<RowSelectionState>({})

  return (
    <MaintenanceProvider
      taskRowSelection={taskRowSelection}
      setTaskRowSelection={setTaskRowSelection}
    >
      <MaintenancePageClient />
    </MaintenanceProvider>
  )
}
