import type { ReactNode } from "react"
import type { StatCardProps } from "@/components/ui/stat-card"

/** Tone values supported by StatCard */
export type StatusTone = NonNullable<StatCardProps["tone"]>

/**
 * Configuration for a single KPI status.
 * Maps a status key to its display label, visual tone, and icon.
 */
export interface StatusConfig<TStatus extends string> {
  /** Unique status identifier used as key in counts record */
  key: TStatus
  /** Display label shown on the card */
  label: string
  /** Visual tone (maps to StatCard's tone prop) */
  tone: StatusTone
  /** Icon element rendered inside the card */
  icon: ReactNode
}

/**
 * Props for the KpiStatusBar component.
 *
 * @template TStatus - Union of status keys (e.g. "Chờ xử lý" | "Đã duyệt")
 */
export interface KpiStatusBarProps<TStatus extends string> {
  /** Status configurations defining each card */
  configs: StatusConfig<TStatus>[]
  /** Counts per status key. Missing keys default to 0. */
  counts: Partial<Record<TStatus, number>> | undefined
  /** Show loading pulse animation on cards */
  loading?: boolean
  /** Show error fallback instead of cards */
  error?: boolean
  /** Additional CSS classes on the container */
  className?: string
  /** Whether to show the "Total" card (default: true) */
  showTotal?: boolean
  /** Custom label for the total card (default: "Tổng") */
  totalLabel?: string
  /** Override the total value instead of auto-computing from counts */
  totalOverride?: number
}
