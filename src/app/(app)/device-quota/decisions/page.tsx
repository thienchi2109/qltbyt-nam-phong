"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { DeviceQuotaDecisionsProvider } from "./_components/DeviceQuotaDecisionsContext"
import { DeviceQuotaDecisionsToolbar } from "./_components/DeviceQuotaDecisionsToolbar"
import { DeviceQuotaDecisionsTable } from "./_components/DeviceQuotaDecisionsTable"
import { DeviceQuotaDecisionDialog } from "./_components/DeviceQuotaDecisionDialog"

/**
 * Device Quota Decisions Page
 *
 * Manages decisions defining equipment quotas for healthcare facilities.
 * Features:
 * - List decisions with filtering by status (draft, active, inactive)
 * - Create new decisions
 * - Edit draft decisions
 * - Activate decisions (auto-deactivates previous active decision)
 * - Delete draft decisions
 *
 * Architecture:
 * - Uses context pattern (DeviceQuotaDecisionsContext) for state management
 * - All dialogs are self-contained and controlled via context
 * - TanStack Query for data fetching and mutations
 * - RPC-only data access for security
 */
export default function DeviceQuotaDecisionsPage() {
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <DeviceQuotaDecisionsProvider>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quyết định định mức</h1>
          <p className="text-muted-foreground">
            Quản lý các quyết định định mức thiết bị y tế
          </p>
        </div>

        {/* Toolbar */}
        <DeviceQuotaDecisionsToolbar />

        {/* Table */}
        <DeviceQuotaDecisionsTable />

        {/* Dialog (controlled by context) */}
        <DeviceQuotaDecisionDialog />
      </div>
    </DeviceQuotaDecisionsProvider>
  )
}
