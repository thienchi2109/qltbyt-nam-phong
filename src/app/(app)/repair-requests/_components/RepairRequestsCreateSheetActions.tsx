"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RepairRequestsCreateSheetActionsProps {
  isSubmitting: boolean
  onCancel: () => void
}

export function RepairRequestsCreateSheetActions({
  isSubmitting,
  onCancel,
}: RepairRequestsCreateSheetActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button
        type="button"
        variant="outline"
        className="flex-1 touch-target"
        onClick={onCancel}
      >
        Hủy
      </Button>
      <Button type="submit" className="flex-1 touch-target" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
      </Button>
    </div>
  )
}
