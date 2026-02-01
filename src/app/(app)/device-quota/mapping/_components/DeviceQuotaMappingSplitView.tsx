'use client'

import { cn } from '@/lib/utils'

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
    <div
      className={cn(
        // Responsive grid: stacked on mobile, 50/50 on desktop
        'grid grid-cols-1 lg:grid-cols-2',
        // Gap between panels
        'gap-6',
        // Min height to prevent layout shift
        'min-h-[600px]',
        className
      )}
    >
      {/* Left Panel */}
      <div
        className={cn(
          'space-y-4',
          // Optional: Add max height with scroll on desktop
          'lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto',
          leftClassName
        )}
      >
        {leftPanel}
      </div>

      {/* Right Panel */}
      <div
        className={cn(
          'space-y-4',
          // Optional: Add max height with scroll on desktop
          'lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto',
          rightClassName
        )}
      >
        {rightPanel}
      </div>
    </div>
  )
}
