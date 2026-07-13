"use client"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"

import { TechnicalConfigurationsClient } from "./TechnicalConfigurationsClient"

/** Renders the authenticated technical configuration workspace route. */
export default function TechnicalConfigurationsPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {(user) => <TechnicalConfigurationsClient role={user.role} />}
    </AuthenticatedPageBoundary>
  )
}
