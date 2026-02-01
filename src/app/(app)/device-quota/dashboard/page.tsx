"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { DeviceQuotaDashboardProvider } from "./_components/DeviceQuotaDashboardContext"
import { DeviceQuotaComplianceCards } from "./_components/DeviceQuotaComplianceCards"
import { DeviceQuotaUnassignedAlert } from "./_components/DeviceQuotaUnassignedAlert"
import { DeviceQuotaActiveDecision } from "./_components/DeviceQuotaActiveDecision"

/**
 * DeviceQuotaDashboardPage
 *
 * Dashboard overview for device quota compliance.
 *
 * Layout:
 * 1. Page header with title/description
 * 2. Unassigned equipment alert (conditional)
 * 3. Compliance KPI cards (4-card grid)
 * 4. Active decision information card
 *
 * Security: Protected route - requires authentication
 * Pattern: Context provider wraps all child components
 */
export default function DeviceQuotaDashboardPage() {
  const { status } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <DeviceQuotaDashboardProvider>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Định mức thiết bị</h1>
            <p className="text-muted-foreground">
              Tổng quan tình trạng định mức
            </p>
          </div>
        </div>

        {/* Unassigned Equipment Alert (shows only if > 0) */}
        <DeviceQuotaUnassignedAlert />

        {/* Compliance KPI Cards */}
        <DeviceQuotaComplianceCards />

        {/* Active Decision Info */}
        <DeviceQuotaActiveDecision />
      </div>
    </DeviceQuotaDashboardProvider>
  )
}
