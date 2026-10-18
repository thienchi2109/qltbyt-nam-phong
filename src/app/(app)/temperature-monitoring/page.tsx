"use client"

import { Suspense } from "react"
import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { TemperatureMonitoringPageClient } from "./TemperatureMonitoringPageClient"

/** Render the authenticated temperature workspace route. */
export default function TemperatureMonitoringPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {() => (
        <Suspense fallback={<AuthenticatedPageSkeletonFallback />}>
          <TemperatureMonitoringPageClient />
        </Suspense>
      )}
    </AuthenticatedPageBoundary>
  )
}
