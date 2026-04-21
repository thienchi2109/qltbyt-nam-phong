"use client"

import * as React from "react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"

import RepairRequestsPageClient from "./_components/RepairRequestsPageClient"

export type { EquipmentSelectItem, RepairRequestWithEquipment, RepairUnit } from "./types"

export default function RepairRequestsPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {() => (
        <React.Suspense fallback={<AuthenticatedPageSkeletonFallback />}>
          <RepairRequestsPageClient />
        </React.Suspense>
      )}
    </AuthenticatedPageBoundary>
  )
}
