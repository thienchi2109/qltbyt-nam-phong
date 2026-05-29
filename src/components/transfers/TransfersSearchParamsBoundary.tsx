"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

interface TransfersSearchParamsBoundaryProps {
  children: React.ReactNode
}

/** Wraps transfer search-param handling in a Suspense boundary. */
export function TransfersSearchParamsBoundary({
  children,
}: TransfersSearchParamsBoundaryProps) {
  return (
    <React.Suspense
      fallback={
        <output
          className="flex min-h-[50vh] items-center justify-center"
          aria-label="Đang tải bộ lọc điều chuyển"
          aria-live="polite"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </output>
      }
    >
      {children}
    </React.Suspense>
  )
}
