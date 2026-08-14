"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { canShowDeviceQuotaSuggestedMappingAction } from "./DeviceQuotaSuggestedMappingAccess"
import { SuggestedMappingPreviewDialog } from "./SuggestedMappingPreviewDialog"

type DeviceQuotaSuggestedMappingActionProps = Readonly<{
  donViId: number | null
  userRole: string | null
  label?: string
}>

/** Opens the existing facility-wide suggestion workflow from any Device Quota route. */
export function DeviceQuotaSuggestedMappingAction({
  donViId,
  userRole,
  label = "Gợi ý phân loại",
}: DeviceQuotaSuggestedMappingActionProps) {
  const [open, setOpen] = React.useState(false)

  if (!canShowDeviceQuotaSuggestedMappingAction(donViId, userRole)) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="touch-target-sm group"
        onClick={() => setOpen(true)}
        title="Sử dụng AI để gợi ý - tốn tài nguyên server, chỉ dùng khi cần"
      >
        <Sparkles className="size-4 text-amber-500 group-hover:animate-pulse" />
        {label}
      </Button>

      <SuggestedMappingPreviewDialog
        open={open}
        onOpenChange={setOpen}
        donViId={donViId}
        userRole={userRole}
      />
    </>
  )
}
