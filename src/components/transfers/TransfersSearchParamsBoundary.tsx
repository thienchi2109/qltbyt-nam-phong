"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

interface TransfersSearchParamsBoundaryProps {
  children: React.ReactNode
}

export function TransfersSearchParamsBoundary({
  children,
}: TransfersSearchParamsBoundaryProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {children}
    </React.Suspense>
  )
}
