"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { MaintenanceProvider } from "./_components/MaintenanceContext"
import { MaintenancePageClient } from "./_components/MaintenancePageClient"

export default function MaintenancePage() {
  const { status } = useSession()
  const router = useRouter()

  // Handle unauthenticated redirect in useEffect (not during render)
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Show loading state for both loading and unauthenticated (while redirecting)
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
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
