"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { TransfersPageContent } from "./_components/TransfersPageContent"

function TransfersSearchParamsFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function TransfersPage() {
  return (
    <AuthenticatedPageBoundary fallback={<TransfersSearchParamsFallback />}>
      {(user) => (
        <React.Suspense fallback={<TransfersSearchParamsFallback />}>
          <TransfersPageContent user={user} />
        </React.Suspense>
      )}
    </AuthenticatedPageBoundary>
  )
}
