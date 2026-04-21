"use client"

import * as React from "react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSpinnerFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { DeviceQuotaMappingProvider } from "./_components/DeviceQuotaMappingContext"
import { DeviceQuotaMappingSplitView } from "./_components/DeviceQuotaMappingSplitView"
import { DeviceQuotaUnassignedList } from "./_components/DeviceQuotaUnassignedList"
import { DeviceQuotaCategoryTree } from "./_components/DeviceQuotaCategoryTree"
import { DeviceQuotaMappingActions } from "./_components/DeviceQuotaMappingActions"
import { DeviceQuotaMappingGuide } from "./_components/DeviceQuotaMappingGuide"
import { TenantSelector } from "@/components/shared/TenantSelector"

export default function DeviceQuotaMappingPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSpinnerFallback />}>
      {() => (
        <DeviceQuotaMappingProvider>
          <div className="container mx-auto py-6 space-y-6">
            {/* Page header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold">Phân loại thiết bị</h1>
                <p className="text-muted-foreground">
                  Gán thiết bị vào các nhóm định mức
                </p>
              </div>
              <TenantSelector hideAllOption />
            </div>

            {/* Manual mapping guide banner */}
            <DeviceQuotaMappingGuide />

            {/* Split view */}
            <DeviceQuotaMappingSplitView
              leftPanel={<DeviceQuotaUnassignedList />}
              rightPanel={<DeviceQuotaCategoryTree />}
            />

            {/* Action bar (sticky footer) */}
            <DeviceQuotaMappingActions />
          </div>
        </DeviceQuotaMappingProvider>
      )}
    </AuthenticatedPageBoundary>
  )
}
