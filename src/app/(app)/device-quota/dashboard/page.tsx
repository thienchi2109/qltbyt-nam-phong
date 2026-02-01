"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, FileText } from "lucide-react"

import { DeviceQuotaDashboardProvider } from "./_components/DeviceQuotaDashboardContext"
import { DeviceQuotaComplianceCards } from "./_components/DeviceQuotaComplianceCards"
import { DeviceQuotaUnassignedAlert } from "./_components/DeviceQuotaUnassignedAlert"
import { DeviceQuotaActiveDecision } from "./_components/DeviceQuotaActiveDecision"
import { DeviceQuotaReportDialog } from "./_components/DeviceQuotaReportDialog"
import { useDeviceQuotaDashboardContext } from "./_hooks/useDeviceQuotaDashboardContext"
import { Button } from "@/components/ui/button"

/**
 * DeviceQuotaDashboardPage
 *
 * Dashboard overview for device quota compliance.
 *
 * Layout:
 * 1. Page header with title/description and report button
 * 2. Unassigned equipment alert (conditional)
 * 3. Compliance KPI cards (4-card grid)
 * 4. Active decision information card
 * 5. Report preview dialog (modal)
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
      <DeviceQuotaDashboardPageContent />
    </DeviceQuotaDashboardProvider>
  )
}

/**
 * DeviceQuotaDashboardPageContent
 *
 * Inner component with access to dashboard context.
 * Separated to allow useDeviceQuotaDashboardContext hook usage.
 */
function DeviceQuotaDashboardPageContent() {
  const { complianceSummary, user } = useDeviceQuotaDashboardContext()
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false)

  // Extract facility name from user's don_vi info if available
  // For now, use a placeholder. In production, you might fetch this from a separate query.
  const facilityName = user?.full_name || "Đơn vị y tế"

  // Check if we have an active decision to show report button
  const hasActiveDecision = !!complianceSummary?.quyet_dinh_id

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Định mức thiết bị</h1>
          <p className="text-muted-foreground">
            Tổng quan tình trạng định mức
          </p>
        </div>

        {/* Report Button - Only show when there's an active decision */}
        {hasActiveDecision && (
          <Button
            variant="outline"
            onClick={() => setReportDialogOpen(true)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Xuất báo cáo
          </Button>
        )}
      </div>

      {/* Unassigned Equipment Alert (shows only if > 0) */}
      <DeviceQuotaUnassignedAlert />

      {/* Compliance KPI Cards */}
      <DeviceQuotaComplianceCards />

      {/* Active Decision Info */}
      <DeviceQuotaActiveDecision />

      {/* Report Preview Dialog */}
      {hasActiveDecision && (
        <DeviceQuotaReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          decisionId={complianceSummary.quyet_dinh_id!}
          facilityName={facilityName}
          decisionNumber={complianceSummary.so_quyet_dinh || "N/A"}
        />
      )}
    </div>
  )
}
