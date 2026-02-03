/**
 * DeviceQuotaChiTietPageClient.tsx
 *
 * Main client page component for device quota decision detail.
 * Displays line items (chi tiet) for a specific decision with import capabilities.
 */

"use client"

import * as React from "react"

import { DeviceQuotaChiTietProvider } from "./DeviceQuotaChiTietContext"
import { DeviceQuotaChiTietToolbar } from "./DeviceQuotaChiTietToolbar"
import { DeviceQuotaChiTietTable } from "./DeviceQuotaChiTietTable"
import { DeviceQuotaImportDialog } from "@/app/(app)/device-quota/decisions/_components/DeviceQuotaImportDialog"
import { useDeviceQuotaChiTietContext } from "../_hooks/useDeviceQuotaChiTietContext"

/**
 * Inner component that renders the detail UI.
 * Separated to consume context within provider.
 */
function DeviceQuotaChiTietContent() {
  const {
    isImportDialogOpen,
    closeImportDialog,
    quyetDinhId,
    leafCategories,
    invalidateAndRefetch,
  } = useDeviceQuotaChiTietContext()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold mb-2">Chi tiết định mức</h1>
        <p className="text-sm text-muted-foreground">
          Danh sách định mức thiết bị theo quyết định
        </p>
      </div>

      {/* Toolbar */}
      <DeviceQuotaChiTietToolbar />

      {/* Table */}
      <DeviceQuotaChiTietTable />

      {/* Import Dialog */}
      <DeviceQuotaImportDialog
        open={isImportDialogOpen}
        onOpenChange={closeImportDialog}
        quyetDinhId={quyetDinhId}
        categories={leafCategories}
        onSuccess={invalidateAndRefetch}
      />
    </div>
  )
}

/**
 * Main page client component with provider wrapper
 */
interface DeviceQuotaChiTietPageClientProps {
  quyetDinhId: number
}

export function DeviceQuotaChiTietPageClient({ quyetDinhId }: DeviceQuotaChiTietPageClientProps) {
  return (
    <DeviceQuotaChiTietProvider quyetDinhId={quyetDinhId}>
      <DeviceQuotaChiTietContent />
    </DeviceQuotaChiTietProvider>
  )
}
