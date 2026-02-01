"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"

const STORAGE_KEY = "device-quota-unassigned-dismissed"

export function DeviceQuotaUnassignedAlert() {
  const { complianceSummary } = useDeviceQuotaDashboardContext()
  const [isDismissed, setIsDismissed] = React.useState(false)

  // Load dismissed state from localStorage on mount
  React.useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === "true") {
      setIsDismissed(true)
    }
  }, [])

  const handleDismiss = React.useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(STORAGE_KEY, "true")
  }, [])

  const unassignedCount = complianceSummary?.unassigned_equipment ?? 0

  // Don't render if no unassigned equipment or dismissed
  if (unassignedCount === 0 || isDismissed) {
    return null
  }

  return (
    <Alert className="relative border-amber-200 bg-amber-50/80 text-amber-900">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Thiết bị chưa phân loại</AlertTitle>
      <AlertDescription className="mt-2 flex items-center justify-between gap-4">
        <span className="text-sm">
          Có <strong>{unassignedCount}</strong> thiết bị chưa được phân loại định mức.
        </span>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            <Link href="/device-quota/mapping">
              Phân loại ngay
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-700 hover:bg-amber-100"
            onClick={handleDismiss}
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
