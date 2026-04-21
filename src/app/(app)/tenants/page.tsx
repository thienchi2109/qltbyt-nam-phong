"use client"

import * as React from "react"
import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { TenantsManagement } from "@/components/tenants-management"

export default function TenantsPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {() => <TenantsManagement />}
    </AuthenticatedPageBoundary>
  )
}
