import * as React from 'react'
import { calculateDaysRemaining } from '../utils'

interface DaysRemainingBarProps {
  /** ISO date string for the deadline */
  deadline: string
  /** Current request status */
  status: string
}

/**
 * Renders a progress bar showing days remaining until a deadline.
 * Returns null for completed requests or when no daysInfo is available.
 *
 * Extracted from RepairRequestsMobileList IIFE to comply with
 * rerender-no-inline-components rule (no components defined inside render).
 */
export function DaysRemainingBar({ deadline, status }: DaysRemainingBarProps) {
  const isCompleted = status === 'Hoàn thành' || status === 'Không HT'
  const daysInfo = !isCompleted ? calculateDaysRemaining(deadline) : null

  if (!daysInfo) return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${daysInfo.color} transition-all duration-300`}
          style={{
            width: daysInfo.days > 0
              ? `${Math.min(100, Math.max(10, (daysInfo.days / 14) * 100))}%`
              : '100%'
          }}
        />
      </div>
      <span className={`text-xs font-medium ${daysInfo.status === 'success' ? 'text-green-600' :
        daysInfo.status === 'warning' ? 'text-orange-600' : 'text-red-600'
        }`}>
        {daysInfo.text}
      </span>
    </div>
  )
}
