"use client"

import * as React from "react"
import { RepairRequestsPageLoadingFallback } from "./RepairRequestsPageLoadingFallback"
import {
  RepairRequestsDeepLinkHandler,
  type RepairRequestsDeepLinkHandlerProps,
} from "./RepairRequestsDeepLinkHandler"

interface RepairRequestsDeepLinkBoundaryProps extends RepairRequestsDeepLinkHandlerProps {
  children: React.ReactNode
}

/** Wraps repair-request deep-link handling in a direct Suspense boundary. */
export function RepairRequestsDeepLinkBoundary({
  children,
  ...deepLinkProps
}: RepairRequestsDeepLinkBoundaryProps) {
  return (
    <React.Suspense fallback={<RepairRequestsPageLoadingFallback />}>
      <RepairRequestsDeepLinkHandler {...deepLinkProps} />
      {children}
    </React.Suspense>
  )
}
