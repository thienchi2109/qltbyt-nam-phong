"use client"

import * as React from "react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSpinnerFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { TransfersPageContent } from "./_components/TransfersPageContent"

function TransfersSearchParamsFallback() {
  return <AuthenticatedPageSpinnerFallback />
}

export default function TransfersPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSpinnerFallback />}>
      {(user) => (
        <React.Suspense fallback={<TransfersSearchParamsFallback />}>
          <TransfersPageContent user={user} />
        </React.Suspense>
      )}
    </AuthenticatedPageBoundary>
  )
}
