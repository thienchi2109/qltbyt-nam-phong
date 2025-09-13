"use client"

import * as React from "react"
import { ChartLoadingFallbackProps, ChartErrorFallbackProps } from "@/lib/chart-utils"

/**
 * Chart loading component to show while charts are being loaded
 */
export function ChartLoadingFallback({ height = 300 }: ChartLoadingFallbackProps) {
  return (
    <div 
      className="flex items-center justify-center bg-muted/20 rounded-lg animate-pulse"
      style={{ height: `${height}px` }}
    >
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-muted-foreground">Đang tải biểu đồ...</p>
      </div>
    </div>
  )
}

/**
 * Error fallback component for chart loading failures
 */
export function ChartErrorFallback({ 
  error, 
  onRetry, 
  height = 300 
}: ChartErrorFallbackProps) {
  return (
    <div 
      className="flex items-center justify-center bg-destructive/10 rounded-lg border border-destructive/20"
      style={{ height: `${height}px` }}
    >
      <div className="text-center space-y-3 p-4">
        <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
          <span className="text-destructive text-sm">!</span>
        </div>
        <div>
          <p className="text-sm font-medium text-destructive">Không thể tải biểu đồ</p>
          <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-primary hover:underline"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  )
}
