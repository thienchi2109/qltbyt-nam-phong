/**
 * Empty state for the change history tab.
 * Shown when no history entries exist for the current entity.
 * @module components/change-history/ChangeHistoryEmptyState
 */

import React from "react"

export function ChangeHistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <p className="font-semibold">Chưa có lịch sử</p>
      <p className="text-sm mt-1">
        Mọi thay đổi sẽ được ghi lại tại đây.
      </p>
    </div>
  )
}
