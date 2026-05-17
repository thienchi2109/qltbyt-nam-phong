"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type DeviceQuotaSplitPaneRatio = "50-50" | "40-60"

interface DeviceQuotaSplitPaneProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  ratio?: DeviceQuotaSplitPaneRatio
  className?: string
  leftClassName?: string
  rightClassName?: string
}

const RATIO_CLASSES: Record<DeviceQuotaSplitPaneRatio, string> = {
  "50-50": "lg:grid-cols-2",
  "40-60": "lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)]",
}

export function DeviceQuotaSplitPane({
  leftPanel,
  rightPanel,
  ratio = "50-50",
  className,
  leftClassName,
  rightClassName,
}: DeviceQuotaSplitPaneProps) {
  return (
    <div
      data-testid="device-quota-split-pane"
      className={cn(
        "grid grid-cols-1 gap-6 min-h-[600px]",
        RATIO_CLASSES[ratio],
        className
      )}
    >
      <div
        className={cn(
          "min-w-0 space-y-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto",
          leftClassName
        )}
      >
        {leftPanel}
      </div>
      <div
        className={cn(
          "min-w-0 space-y-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto",
          rightClassName
        )}
      >
        {rightPanel}
      </div>
    </div>
  )
}
