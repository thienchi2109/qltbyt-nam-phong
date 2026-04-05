/**
 * Timeline component for populated change history.
 * Renders a vertical timeline with dots and detail cards.
 * UI-only — no data fetching, no tenant/role logic.
 * @module components/change-history/ChangeHistoryTimeline
 */

import React from "react"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import type { ChangeHistoryEntry } from "./ChangeHistoryTypes"

interface ChangeHistoryTimelineProps {
  entries: ChangeHistoryEntry[]
}

export function ChangeHistoryTimeline({ entries }: ChangeHistoryTimelineProps) {
  return (
    <div className="relative pl-6 py-4 pr-4">
      {/* Vertical timeline line */}
      <div className="absolute left-3 top-0 h-full w-0.5 bg-border" />

      {entries.map((entry) => (
        <div key={entry.id} className="relative mb-8 last:mb-0">
          {/* Timeline dot */}
          <div className="absolute left-[-12px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background" />

          <div className="pl-2">
            {/* Header: action + timestamp */}
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-sm">{entry.actionLabel}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(entry.occurredAt), "dd/MM/yyyy HH:mm", {
                  locale: vi,
                })}
              </p>
            </div>

            {/* Actor */}
            {entry.actorName != null ? (
              <p className="text-xs text-muted-foreground mt-1">
                {entry.actorName}
              </p>
            ) : null}

            {/* Detail rows */}
            {entry.details.length > 0 ? (
              <div className="mt-2 p-3 rounded-md bg-muted/50 border">
                {entry.details.map((detail) => (
                  <div
                    key={`${entry.id}-${detail.label}-${detail.value}`}
                    className="flex items-baseline gap-2 text-sm"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {detail.label}
                    </span>
                    <span>{detail.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
