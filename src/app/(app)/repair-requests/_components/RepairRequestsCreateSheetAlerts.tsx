"use client"

import * as React from "react"

interface RepairRequestsCreateSheetAlertsProps {
  hasAssistantDraft: boolean
  showUnresolvedDraftEquipment: boolean
}

export function RepairRequestsCreateSheetAlerts({
  hasAssistantDraft,
  showUnresolvedDraftEquipment,
}: RepairRequestsCreateSheetAlertsProps) {
  return (
    <>
      {hasAssistantDraft && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          📝 Được điền sẵn từ AI trợ lý. Vui lòng kiểm tra kỹ trước khi gửi.
        </div>
      )}
      {showUnresolvedDraftEquipment && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          ⚠️ Thiết bị trong bản nháp không tìm thấy ở cơ sở hiện tại. Vui lòng chọn thiết bị thủ công.
        </div>
      )}
    </>
  )
}
