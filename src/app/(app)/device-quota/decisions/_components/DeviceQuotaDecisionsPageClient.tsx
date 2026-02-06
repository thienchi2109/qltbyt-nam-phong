/**
 * DeviceQuotaDecisionsPageClient.tsx
 *
 * Main client page component for device quota decisions.
 * Wraps content with context provider and includes dialogs.
 */

"use client"

import * as React from "react"

import { DeviceQuotaDecisionsProvider } from "./DeviceQuotaDecisionsContext"
import { DeviceQuotaDecisionsToolbar } from "./DeviceQuotaDecisionsToolbar"
import { DeviceQuotaDecisionsTable } from "./DeviceQuotaDecisionsTable"
import { DeviceQuotaDecisionDialog } from "./DeviceQuotaDecisionDialog"

/**
 * Inner component that renders the decisions UI.
 * Separated to consume context within provider.
 */
function DeviceQuotaDecisionsContent() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Định mức - Quyết định</h1>
        <p className="text-muted-foreground">
          Quản lý quyết định định mức thiết bị y tế
        </p>
      </div>

      {/* Toolbar */}
      <DeviceQuotaDecisionsToolbar />

      {/* Table */}
      <DeviceQuotaDecisionsTable />

      {/* Dialogs */}
      <DeviceQuotaDecisionDialog />
    </div>
  )
}

/**
 * Main page client component with provider wrapper
 */
export function DeviceQuotaDecisionsPageClient() {
  return (
    <DeviceQuotaDecisionsProvider>
      <DeviceQuotaDecisionsContent />
    </DeviceQuotaDecisionsProvider>
  )
}
