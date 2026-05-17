'use client'

import { cn } from '@/lib/utils'
import { DeviceQuotaSplitPane } from '../../_components/DeviceQuotaSplitPane'

/**
 * Split-screen layout for device quota mapping interface
 *
 * Layout behavior:
 * - Mobile (< lg): Stacked vertically, left panel first
 * - Desktop (>= lg): Side-by-side 50/50 split
 *
 * Usage:
 * ```tsx
 * <DeviceQuotaMappingSplitView
 *   leftPanel={<CategoryTree />}
 *   rightPanel={<QuotaForm />}
 * />
 * ```
 */
interface DeviceQuotaMappingSplitViewProps {
  /** Content for left panel (category tree, filters, etc.) */
  leftPanel: React.ReactNode
  /** Content for right panel (quota form, details, etc.) */
  rightPanel: React.ReactNode
  /** Optional className for container */
  className?: string
  /** Optional className for left panel */
  leftClassName?: string
  /** Optional className for right panel */
  rightClassName?: string
}

export function DeviceQuotaMappingSplitView({
  leftPanel,
  rightPanel,
  className,
  leftClassName,
  rightClassName,
}: DeviceQuotaMappingSplitViewProps) {
  return (
    <DeviceQuotaSplitPane
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      className={cn(className)}
      leftClassName={leftClassName}
      rightClassName={rightClassName}
    />
  )
}
