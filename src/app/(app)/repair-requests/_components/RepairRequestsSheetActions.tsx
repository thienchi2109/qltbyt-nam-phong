"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

interface RepairRequestsSheetActionsProps {
  readonly isSubmitting: boolean
  readonly onCancel: () => void
  readonly submitLabel: string
  readonly submittingLabel?: string
}

/** Renders shared submit and cancel actions for repair-request sheets. */
export function RepairRequestsSheetActions({
  isSubmitting,
  onCancel,
  submitLabel,
  submittingLabel,
}: RepairRequestsSheetActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button
        type="button"
        variant="outline"
        className="flex-1 touch-target"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Hủy
      </Button>
      <Button type="submit" className="flex-1 touch-target" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        {isSubmitting && submittingLabel ? submittingLabel : submitLabel}
      </Button>
    </div>
  )
}
